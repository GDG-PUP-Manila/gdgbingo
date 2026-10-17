---
spine_type: RFC
spine_version: 0.3.0
project: GDG Bingo
slug: gdgbingo
rfc_id: gdgbingo-rfc-001
doc_version: 0.2
status: Draft
owner: slvdrvncntjvr
created: 2026-10-18
updated: 2026-10-18
reconciled: 2026-10-18
---

# RFC 001: Atomic claim redemption and round closure

**Implements:** PRD-F4, PRD-F6
**SDD:** [sdd-gdgbingo.md](sdd-gdgbingo.md)

---

## 1. Problem

Hundreds of players redeem codes concurrently while the host may close the
round at any moment. Two players can race for one code, one claimant can race
two codes onto one square, a lost response causes retries, and serverless
instances share nothing but the database. The redemption must be exactly-once
per code, never consume a code on failure, and order deterministically against
closure.

## 2. Goals and non-goals

**Goals**
- Exactly one committed claim per code under any concurrency (INV-1).
- A rejected or rolled-back claim leaves its code unspent (INV-2).
- Safe idempotent retry by request ID, including after closure.
- Deterministic ordering against manual closure and the deadline, using database time (INV-4).

**Non-goals**
- Distributed locks outside PostgreSQL.
- Offline claim queueing on the client.

## 3. Design

One PostgreSQL transaction (READ COMMITTED) per redemption attempt. A transaction-
scoped advisory lock serialises requests with the same event, claimant, and
request ID before the committed result is checked. The event row is the
closure coordination point: redemptions take `FOR SHARE` on it, manual close
takes `FOR UPDATE`. The code row is the contention point: `FOR UPDATE` serialises
racers for the same code. Unique indexes are the final backstop.

## 4. Specification

Request: `POST /api/events/:eventId/claims` with JSON
`{ "squareKey": string, "code": string, "requestId": uuid }`.

1. Validate session, `Origin`, input shape, participation in `:eventId`, and the
   rate-limit bucket. Rate-limit failure returns `429` before any transaction.
2. `BEGIN` at READ COMMITTED. Acquire `pg_advisory_xact_lock(request_lock_key)`:
   derive the signed 64-bit key deterministically from a namespaced, unambiguous
   encoding of `(event_id, claimant_participation_id, request_id)`. Include no
   raw code in the lock key or logs. Hash collisions may add contention but must
   never replace the full-scope result lookup or uniqueness checks.
3. After acquiring the request lock, look up `claim` by
   `(event_id, claimant_participation_id, request_id)` in a new SQL statement.
   Under READ COMMITTED this sees a preceding request's committed claim after
   waiting for its transaction to finish.
   - Found and `request_hash` equals a server-keyed digest of the canonical
     `(squareKey, normalized code)` payload: `COMMIT`,
     return `200` with the original claim and current progress. This happens
     even if the round is now closed.
   - Found with a different hash: `ROLLBACK`, return `409 request_id_reused`.
4. Lock the event row `FOR SHARE`, then read state and fresh database
   `clock_timestamp()` in a new statement after any lock wait. Reject with
   `409 round_not_open` unless status is open, opening has passed, closure
   is unset and the deadline is still in the future.
5. `SELECT ... FROM code WHERE event_id = $1 AND token_digest = $2 FOR UPDATE`.
   Missing: `404 code_invalid`. `redeemed_claim_id IS NOT NULL`: `409 code_spent`.
   Owner equals claimant: `422 self_claim`.
6. Resolve `squareKey` to the claimant's `card_cell`. Not on card or free centre:
   `422 square_invalid`.
7. `INSERT INTO claim ...` with a materialized database acceptance time and
   an opening/deadline predicate checked again after the code-row lock wait.
   That timestamp becomes `created_at`; zero inserted rows means
   `409 round_not_open`. On any `23505` unique violation, first roll back
   the whole transaction; never issue a result query inside the failed
   transaction. In a fresh transaction, reacquire the same request lock and
   perform step 3 before classifying the named constraint. If the request has
   committed, return its replay or changed-payload result. Otherwise a known
   claimant/square conflict returns `409 square_already_claimed`, a known
   code conflict returns `409 code_spent`. An unexpected request-ID conflict
   without a matching committed result is an internal consistency error,
   not permission to insert again. Unknown constraints are unexpected errors.
   End the fresh read-only recovery transaction before returning an error.
8. `UPDATE code SET redeemed_claim_id = $claim WHERE id = $code`.
9. `COMMIT`; return `201` with progress (claimed count, lines, blackout).

Any rejection rolls back the attempt, so that attempt spends no code. A code
already spent by a different committed request remains spent. Request IDs are
bound to payloads by committed successful claims; failed attempts do not reserve
them permanently. Identity/origin checks and transport rate limits also apply
to retries; a throttled retry may return `429`, without a second mutation.

Manual close: `BEGIN; SELECT ... FROM event WHERE id = $1 FOR UPDATE; UPDATE event SET status = 'closed', closed_at = clock_timestamp(); INSERT host_audit_event; COMMIT`.
Because redemptions hold `FOR SHARE`, close waits for in-flight redemptions to
finish; redemptions starting after close see `closed_at` and are rejected.

`FOR SHARE` locks are compatible with each other, so unrelated redemptions never
serialise on the event row; an exclusive event lock per mutation is forbidden.
Claim locks are always taken in the order request advisory lock, event row,
then code row. Closure takes only the event lock and must not subsequently
acquire a claim request lock. Advisory locks are transaction-scoped, released
on commit/rollback, and must use the same database connection as the transaction;
session-scoped advisory locks are forbidden with pooled connections.

On a confirmed deadlock (`40P01`) or serialization rollback (`40001`), retry the
entire transaction at most 3 additional times with jittered backoff and the
same request ID/payload. Each attempt checks for committed replay before
round state; an uncommitted retry may now fail the deadline. If retries exhaust,
return `503 retry_later`; the rolled-back attempts spent no code. Configure
bounded lock/statement waits so a duplicate request cannot wait indefinitely.

A dropped connection during COMMIT has an unknown outcome. Do not label its
code unspent or automatically generate a new request ID. Recover through a
fresh transaction using the same request lock and result lookup. If recovery
cannot complete, return `503 result_unknown` and instruct the client to retry
the same request ID/payload. Never compensate by clearing a spent code.

### 4.1 Worked example

```
Alice owns code K. Bob and Carol submit K at the same instant.
Bob's tx locks K (step 5), inserts claim C1, sets K.redeemed_claim_id = C1, commits.
Carol's tx was blocked on K's row lock; after Bob commits it re-reads K,
sees redeemed_claim_id = C1, returns 409 code_spent, rolls back.
Result: one claim (C1), K spent once. Carol's own state is unchanged.
```

For two identical requests by Bob, the second waits on Bob's request advisory
lock, then reads C1 at step 3 and returns `200`, even after closure. It never
reaches the spent-code check. If Bob reuses that request ID with a different
payload while the first request succeeds, the waiter returns
`409 request_id_reused` before checking code or round state.

## 5. Edge cases

| Case | Behavior |
|------|----------|
| Lost success response, client retries same payload | Step 3 returns original success |
| Concurrent identical requests while original is in flight | Request lock waits; step 3 returns committed success without code-spent rejection |
| Concurrent changed payload under one request ID | Wait, then reject against the committed original payload; second code stays usable |
| Unique violation | Full rollback, fresh transaction/request lock/result lookup, then named-constraint classification |
| Same request ID, different square or code | `409 request_id_reused` |
| Two different codes onto one square concurrently | One commits; the other hits the claimant/square unique index, rolls back, code stays usable |
| Two different squares from one confirmer using their two distinct codes | Both may commit |
| Code from another event | Step 5 lookup is event-scoped: `404 code_invalid` |
| Close arrives mid-redemption | Close waits on the event row; redemption commits first |
| Deadline passes while waiting for a code lock | Fresh database admission time rejects it without spending the code |
| Database connection drops during/after commit | Resolve through the same request lock/result lookup; until resolved the outcome is unknown |
| Deadlock or serialization failure | Up to 3 additional retries, then `503 retry_later`; rolled-back attempts spend no code |
| Many unrelated claims in one event | Run concurrently; only closure blocks them |

## 6. Security considerations

Codes are looked up by keyed digest (HMAC-SHA-256 with a server key); encrypted
redisplay values are stored separately as specified in SDD §3. Codes are never
stored or logged in plaintext. Error codes reveal nothing about other
participants beyond "invalid" vs "spent", which the code holder already knows.
Rate limits bound guessing; codes carry at least 40 bits of entropy from a CSPRNG.

## 7. Alternatives considered

| Alternative | Rejected because |
|------------|------------------|
| SERIALIZABLE isolation with retry loop | Higher abort rate under burst; row locks are sufficient and explicit |
| Advisory locks per code | Duplicates what the row lock gives; easier to leak |
| Optimistic `UPDATE code ... WHERE redeemed_claim_id IS NULL` without lock | Workable, but closure ordering still needs the event lock; kept explicit for clarity |

## 8. Verification

Planned verification: QAD cases H-04, S-04 to S-09, AB-01 to AB-04,
AB-18, AB-20 to AB-24, NT-01, NT-02, and NT-04 must run against real PostgreSQL
(Neon test branch or local Postgres). Force overlapping transactions with
barriers/held locks, including the same request ID with different code rows,
closure while an identical retry waits, and a connection loss at COMMIT.
Prove transaction-scoped advisory locking works with the selected pooled driver.
No implementation, executable tests, or passing results exist for this RFC yet.

References: [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html),
[savepoint recovery](https://www.postgresql.org/docs/current/sql-rollback-to.html).
