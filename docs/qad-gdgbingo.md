---
spine_type: QAD
spine_version: 0.3.0
project: GDG Bingo
slug: gdgbingo
doc_version: 0.2
status: Draft
owner: slvdrvncntjvr
created: 2026-10-18
updated: 2026-10-18
reconciled: 2026-10-18
---

# QA & Test Plan: GDG Bingo

**PRD:** [prd-gdgbingo.md](prd-gdgbingo.md)
**SDD:** [sdd-gdgbingo.md](sdd-gdgbingo.md)

---

## 1. Strategy

Execution status: the case register below is the full acceptance plan. A subset
is implemented and tested as recorded in `docs/development-status.md`.
Do not infer a case pass merely from similarity to an executable test.
Coverage matrices describe written cases, not passing tests. Record future
results with commit SHA, environment/versions, command, date, outcome, and
redacted evidence location; a document review cannot mark a runtime test passed.

Isolated Phase 1 experiments now have local results in
[`spikes/phase1/results.md`](../spikes/phase1/results.md). Eleven auth/API checks
use simulated upstream responses; eight database checks use real local
PostgreSQL with a reduced schema. A follow-up run also passed all eight database
checks through actual Neon Pool/Drizzle on PostgreSQL 18.6. They remain partial
design evidence, not a pass for this product acceptance suite, live OAuth,
remaining database fault cases, or the 350-player path.

- Unit tests (Node test runner) for pure logic: shuffling, scoring, CSV neutralisation, digest and encryption helpers.
- Integration tests (Node test runner) against a real PostgreSQL for join, claim, closure, rate limiting, and invariants. Concurrency cases fire parallel requests.
- Browser tests (Playwright) for join, claim, board, host flows, and accessibility checks with axe.
- Load test (k6) for the 350-player scenario: local first; hosted only with provider authorisation.
- Manual: phone layouts on real devices, screen reader pass, rehearsal with test attendees.

**Runner:** `npm test` (unit + integration), `npm run test:e2e` (Playwright), `npm run test:load` (k6)
**Location:** `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/load/`

## 2. Happy path cases

| ID | PRD-F# | Case | Steps | Expected |
|----|--------|------|-------|----------|
| H-01 | PRD-F1 | Join with valid invitation | Sign in, submit invitation | One participation, 24-square card, code allowance issued |
| H-02 | PRD-F2 | Card stable across devices | Join, sign in on second browser | Identical layout |
| H-03 | PRD-F3 | View and copy own codes | Open player page | All own codes shown with spent state; copy works |
| H-04 | PRD-F4 | Valid redemption | B submits A's code for an open square | 201; one claim; A's code spent |
| H-05 | PRD-F5 | Line detection | Claim a full row | Response reports one line |
| H-06 | PRD-F6 | Host opens and closes | Host opens, later closes | Status transitions; audit rows written |
| H-07 | PRD-F7 | Board refresh | Keep board visible 90 s | Updates within 45 s; polling continues |
| H-08 | PRD-F8 | Standings and ties | Close round with tied players | Qualification follows tie policy |
| H-09 | PRD-F9 | Skill reveal | Several confirmers with a skill | Count equals distinct confirmers |
| H-10 | PRD-F10 | Consent opt-in | Toggle consent, select skills | Saved; shown separately from claims |
| H-11 | PRD-F11 | Export | Host downloads CSV | File opens; consented rows only in follow-up columns |
| H-12 | PRD-F12 | Normal use under limit | Ten claims over two minutes | None rate limited |
| H-13 | PRD-F13 | Phone layout | 360 px viewport | Card readable, targets ≥ 44 px, no horizontal scroll |

## 3. Sad path cases

| ID | PRD-F# | Case | Input | Expected |
|----|--------|------|-------|----------|
| S-01 | PRD-F1 | Invitation redeemed by someone else | Second user's token | Rejected |
| S-02 | PRD-F1 | Rejoin | Same user joins twice | Same participation; no extra codes |
| S-03 | PRD-F2 | Reload mid-game | Refresh page | Card and progress restored |
| S-04 | PRD-F4 | Self-claim | Own code | 422; code unspent |
| S-05 | PRD-F4 | Spent code | Already used code | 409 code_spent |
| S-06 | PRD-F4 | Code from another event | Foreign code | 404; code unspent |
| S-07 | PRD-F4 | Free cell or square not on card | Bad square key | 422 |
| S-08 | PRD-F4 | Retry after lost response | Same request ID and payload | Original success; no extra claim |
| S-09 | PRD-F4 | Request ID reused with changed payload | Same ID, new square | 409 |
| S-10 | PRD-F5 | Exhausted outgoing codes | All own codes spent | Still able to receive confirmations |
| S-11 | PRD-F6 | Claim before open / after deadline / after close | Valid code | 409 round_not_open; code unspent |
| S-12 | PRD-F7 | Hidden tab | Background the board | Polling pauses; resumes on visible |
| S-13 | PRD-F7 | Round closed | Final state received | Polling stops |
| S-14 | PRD-F8 | Ordinary player opens host page | Non-host session | 403 |
| S-15 | PRD-F9 | Skill with no confirmers | — | Zero, not omitted silently |
| S-16 | PRD-F10 | No consent given | Default | Excluded from follow-up export |
| S-17 | PRD-F11 | Export by non-host | Player session | 403 |
| S-18 | PRD-F12 | Limit exceeded | Burst of claims | 429 retryable; code unspent |
| S-19 | PRD-F13 | Keyboard only | Tab through claim flow | All controls reachable; focus visible |
| S-20 | PRD-F1 | Late join burst | 100 joins in the final minute before closure | All succeed within GDGBINGO-M2 |

## 4. Abuse cases

| ID | PRD-F# | Vector | Attempt | Expected defense |
|----|--------|--------|---------|------------------|
| AB-01 | PRD-F4 | Race | Two players redeem one code concurrently | Exactly one claim |
| AB-02 | PRD-F4 | Race | Two codes onto one square concurrently | One claim; losing code usable |
| AB-03 | PRD-F4 | Race | Two squares from one confirmer concurrently, with distinct codes | Both claims commit |
| AB-04 | PRD-F4 | Enumeration | Script guesses codes | Rate limited; no hits within budget |
| AB-05 | PRD-F1 | Forged identity | Body includes another user ID | Ignored; session identity used |
| AB-06 | PRD-F1 | Concurrent joins | Same user joins from two tabs at once | One participation |
| AB-07 | PRD-F2 | Forged card | Client sends modified layout | Ignored; server layout used |
| AB-08 | PRD-F3 | Cross-user read | Request another participant's state | 403 / not found |
| AB-09 | PRD-F5 | Forged score | Client posts score | No endpoint accepts it |
| AB-10 | PRD-F6 | Close race | Close during claim burst | Every claim either committed before close or rejected |
| AB-11 | PRD-F7 | Cache poisoning | Board request with session cookie | Response identical to anonymous; no private fields |
| AB-12 | PRD-F8 | CSRF | Cross-origin POST to host close | Rejected by origin check |
| AB-13 | PRD-F9 | Inflation | One confirmer used many times | Counted once |
| AB-14 | PRD-F10 | Tamper | Set another user's consent | 403 |
| AB-15 | PRD-F11 | CSV injection | Display name `=HYPERLINK(...)` | Cell neutralised |
| AB-16 | PRD-F12 | Shared IP | 50 players behind one NAT | Each limited independently |
| AB-17 | PRD-F13 | Oversized input | 1 MB display name | 413 / validation error |
| AB-18 | PRD-F4 | Throughput | 350 players claiming unrelated codes during a close attempt | Claims proceed concurrently; close orders cleanly; no deadlock leaks a spent code |
| AB-19 | PRD-F1 | Shared network | 50 attendees sign in from one public IP | All authenticate; none blocked by IP throttling |
| AB-20 | PRD-F4 | Concurrent identical retry | Hold original transaction, send same event/claimant/request ID and payload | One 201, eventual replay 200; same claim ID, no code_spent or second claim |
| AB-21 | PRD-F4 | Concurrent changed payload | Same request ID with a different valid code/square, while first succeeds | Wait, then 409 request_id_reused; second code unspent |
| AB-22 | PRD-F4, PRD-F6 | Retry overlaps closure | Identical duplicate waits while original succeeds and host closes | Original success replayed after closure; no round_not_open for committed replay |
| AB-23 | PRD-F4 | Constraint failure recovery | Force named 23505 constraints in the claim transaction | Full rollback before fresh lookup/classification; no query in aborted transaction; losing code not newly spent |
| AB-24 | PRD-F4 | Unknown commit outcome | Drop connection/acknowledgement at COMMIT with committed and rolled-back variants | Same-ID recovery yields original claim or safe re-attempt; unresolved result_unknown never asserts unspent; no duplicate claim |

For AB-20–AB-24 use deterministic barriers or held locks, not timing-only
sleeps. Check request-lock release on commit, rollback, and timeout with the
selected pooled driver. Distinct request IDs must not be serialised globally.

### 4.1 Negative tests (invariants)

| ID | INV-# | Attempt to break the rule | Expected |
|----|-------|---------------------------|----------|
| NT-01 | INV-1 | 50 parallel redemptions of one code | Exactly one claim row for the code |
| NT-02 | INV-2 | Force rejection at each validation step and a mid-transaction error | Code `redeemed_claim_id` stays null |
| NT-03 | INV-3 | Scan board, error responses, and captured logs for code and invitation plaintext | No matches |
| NT-04 | INV-4 | Send forged user ID, host flag, score, and timestamp fields | All ignored; server values used |
| NT-05 | INV-5 | Concurrent and repeated joins by one user | One participation, one card, fixed code count |
| NT-06 | INV-6 | Player session hits every host route and another player's state | All 403 / not found |
| NT-07 | INV-7 | Review dependency manifest and provider config for paid services; verify polling stop and backoff | No paid dependency; polling bounded |

## 5. Coverage matrix

| PRD-F# | Happy | Sad | Abuse |
|--------|-------|-----|-------|
| PRD-F1 | H-01 | S-01, S-02, S-20 | AB-05, AB-06, AB-19 |
| PRD-F2 | H-02 | S-03 | AB-07 |
| PRD-F3 | H-03 | S-10 | AB-08 |
| PRD-F4 | H-04 | S-04 to S-09 | AB-01 to AB-04, AB-18, AB-20 to AB-24 |
| PRD-F5 | H-05 | S-10 | AB-09 |
| PRD-F6 | H-06 | S-11 | AB-10, AB-22 |
| PRD-F7 | H-07 | S-12, S-13 | AB-11 |
| PRD-F8 | H-08 | S-14 | AB-12 |
| PRD-F9 | H-09 | S-15 | AB-13 |
| PRD-F10 | H-10 | S-16 | AB-14 |
| PRD-F11 | H-11 | S-17 | AB-15 |
| PRD-F12 | H-12 | S-18 | AB-16 |
| PRD-F13 | H-13 | S-19 | AB-17 |

### 5.1 Invariant coverage

| INV-# | Negative tests |
|-------|----------------|
| INV-1 | NT-01 |
| INV-2 | NT-02 |
| INV-3 | NT-03 |
| INV-4 | NT-04 |
| INV-5 | NT-05 |
| INV-6 | NT-06 |
| INV-7 | NT-07 |

## 6. Not tested

| Area | Why not tested | Risk accepted by |
|------|---------------|------------------|
| Hosted 350-player load without Vercel authorisation | Prohibited by provider policy | TBD(owner) |
| Multiple accounts per person | Mitigated by invitations, not detectable | TBD(owner) |

## 7. Release gate

- [ ] All Must-Have happy cases pass
- [ ] All Must-Have sad cases pass
- [ ] All abuse cases pass or have a signed-off exception in §6
- [ ] All invariant negative tests pass; no exceptions allowed
- [ ] No secrets in test fixtures
- [ ] PRD §5 metrics GDGBINGO-M1 to GDGBINGO-M8 measured and within target
