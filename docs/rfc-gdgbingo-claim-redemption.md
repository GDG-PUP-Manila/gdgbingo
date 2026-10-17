---
spine_type: RFC
spine_version: 0.3.0
project: GDG Bingo
slug: gdgbingo
rfc_id: gdgbingo-rfc-001
doc_version: 0.1
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

One PostgreSQL transaction (READ COMMITTED) per redemption. The event row is the
closure coordination point: redemptions take `FOR SHARE` on it, manual close
takes `FOR UPDATE`. The code row is the contention point: `FOR UPDATE` serialises
racers for the same code. Unique indexes are the final backstop.

## 4. Specification

Request: `POST /api/events/:eventId/claims` with JSON
`{ "squareKey": string, "code": string, "requestId": uuid }`.

1. Validate session, `Origin`, input shape, participation in `:eventId`, and the
   rate-limit bucket. Rate-limit failure returns `429` before any transaction.
2. `BEGIN`.
3. `SELECT status, opens_at, closes_at, closed_at, now() FROM event WHERE id = $1 FOR SHARE`.
4. Look up `claim` by `(event_id, claimant_participation_id, request_id)`.
   - Found and `request_hash` equals the digest of `(squareKey, code)`: `COMMIT`,
     return `200` with the original claim and current progress. This happens
     even if the round is now closed.
   - Found with a different hash: `ROLLBACK`, return `409 request_id_reused`.
5. Reject with `409 round_not_open` unless `status = 'open'`, `now() >= opens_at`,
   `closed_at IS NULL`, and `now() < closes_at`.
6. `SELECT ... FROM code WHERE event_id = $1 AND token_digest = $2 FOR UPDATE`.
   Missing: `404 code_invalid`. `redeemed_claim_id IS NOT NULL`: `409 code_spent`.
   Owner equals claimant: `422 self_claim`.
7. Resolve `squareKey` to the claimant's `card_cell`. Not on card or free centre:
   `422 square_invalid`.
8. `INSERT INTO claim ...`. A unique violation on claimant/square returns
   `409 square_already_claimed`; on claimant/confirmer, `409 confirmer_already_used`;
   on request ID (a concurrent identical retry), re-run step 4.
9. `UPDATE code SET redeemed_claim_id = $claim WHERE id = $code`.
10. `COMMIT`; return `201` with progress (claimed count, lines, blackout).

Any rejection from step 5 onward issues `ROLLBACK`, so no code is spent.

Manual close: `BEGIN; SELECT ... FROM event WHERE id = $1 FOR UPDATE; UPDATE event SET status = 'closed', closed_at = now(); INSERT host_audit_event; COMMIT`.
Because redemptions hold `FOR SHARE`, close waits for in-flight redemptions to
finish; redemptions starting after close see `closed_at` and are rejected.

### 4.1 Worked example

```
Alice owns code K. Bob and Carol submit K at the same instant.
Bob's tx locks K (step 6), inserts claim C1, sets K.redeemed_claim_id = C1, commits.
Carol's tx was blocked on K's row lock; after Bob commits it re-reads K,
sees redeemed_claim_id = C1, returns 409 code_spent, rolls back.
Result: one claim (C1), K spent once. Carol's own state is unchanged.
```

## 5. Edge cases

| Case | Behavior |
|------|----------|
| Lost success response, client retries same payload | Step 4 returns original success |
| Same request ID, different square or code | `409 request_id_reused` |
| Two different codes onto one square concurrently | One commits; the other hits the claimant/square unique index, rolls back, code stays usable |
| Two squares from one confirmer concurrently | One commits; the other hits claimant/confirmer unique index |
| Code from another event | Step 6 lookup is event-scoped: `404 code_invalid` |
| Close arrives mid-redemption | Close waits on the event row; redemption commits first |
| Deadline passes mid-transaction | `now()` is transaction start time; a claim that started before the deadline may commit |
| Database connection drops after commit | Client retries; step 4 returns success |

## 6. Security considerations

Codes are looked up by keyed digest (HMAC-SHA-256 with a server key), never
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

QAD cases H-04, S-04 to S-09, AB-01 to AB-04, NT-01, NT-02, NT-04 run against a
real PostgreSQL (Neon test branch or local Postgres), including a concurrency
harness that fires parallel requests.
