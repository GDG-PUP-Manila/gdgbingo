---
spine_type: PRD
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

# Product Requirements: GDG Bingo

**IDEA:** [idea-gdgbingo.md](idea-gdgbingo.md)

---

## 1. Scope statement

Version one runs one bingo round per event for 300+ invited attendees on their
phones: join by invitation, exchange private single-use codes, claim squares,
and get server-calculated lines and blackout. Hosts start and close the round,
see standings, resolve winners, reveal peer-confirmed skill matches, and export
consented results.

Participants send outgoing bingo codes through Teams DMs, then paste received
codes into the website. No Teams integration or email code delivery is needed;
website authentication is separate. Rehearse attendee/guest DM permissions.

## 2. Users

| User | Goal | Priority |
|------|------|----------|
| Participant | Join, exchange codes, fill the card, see results | Primary |
| Host | Run the round fairly and export results | Primary |
| Chapter lead | Consented follow-up list and talent map | Secondary |

## 3. Features

| ID | Feature | Priority | Description |
|----|---------|----------|-------------|
| PRD-F1 | Invitation join | Must-Have | Signed-in attendee redeems a private invitation; creates exactly one participation per user per event |
| PRD-F2 | Stable bingo card | Must-Have | 5 x 5 card, free centre, 24 squares shuffled per participant from a versioned square set and persisted |
| PRD-F3 | Private outgoing codes | Must-Have | Each participant receives a fixed allowance of two single-use codes, viewable and copyable on any of their signed-in devices |
| PRD-F4 | Claim redemption | Must-Have | Claimant submits a square and another participant's code; the server validates and commits atomically |
| PRD-F5 | Line and blackout scoring | Must-Have | Server computes claimed-square count, full rows/columns/diagonals, and blackout from committed claims |
| PRD-F6 | Round lifecycle | Must-Have | Host opens and closes the round; deadline enforced with database time; browser countdown is informational |
| PRD-F7 | Public board | Must-Have | Polled standings with display names, claimed count, line count, codes remaining; no private data |
| PRD-F8 | Host dashboard | Must-Have | Protected controls: start/close, standings, qualification, tie resolution |
| PRD-F9 | Skill reveal | Must-Have | Per skill, count of distinct confirmers (code owners) matched, labelled as peer-confirmed self-reported |
| PRD-F10 | Recruitment consent and skill selections | Must-Have | Explicit opt-in for follow-up, plus optional self-reported skills kept separate from claim-derived counts |
| PRD-F11 | Protected CSV export | Must-Have | Host-only, formula-injection-safe CSV of results and consented follow-up data |
| PRD-F12 | Shared rate limiting | Must-Have | Per-authenticated-player limits backed by PostgreSQL, shared across all server instances |
| PRD-F13 | Accessible phone UI | Must-Have | Readable labels, touch targets, keyboard and screen-reader support, contrast, reduced motion |
| PRD-F14 | Host audit trail | Should-Have | Record host actions (start, close, reveal, export) with actor and time |
| PRD-F15 | Event data tooling | Should-Have | Synthetic seeds for dev/test, invitation generation output, event-scoped rehearsal cleanup |

Priority vocabulary: `Must-Have`, `Should-Have`, `Could-Have`, `Dropped`.

### 3.1 Acceptance criteria

**PRD-F1 — Invitation join**
- Given a signed-in user with an unredeemed invitation, when they join, then one participation, one card, and the configured code allowance exist for them.
- Given a user who already joined, when they join again from any device or retry the request, then the same participation is returned and no extra codes exist.
- Given a single-use invitation already redeemed by another user, when a different user submits it, then the join is rejected.
- Given an active shared event invitation link, different signed-in accounts may join with the same invitation; each receives one separate participation, card and two gameplay codes. The invitation is carried in a URL fragment, removed from the address bar before requests, and retained through sign-in. A returning account receives its saved state without another issuance. Shared invitations never grant host access and cannot admit new accounts after expiry or round closure. Shared mode was authorised by the owner after the individual-invitation rehearsal.
- Sign-in uses a production-configured OAuth provider with the organiser's own credentials; no attendee depends on Neon's shared development email sender or OAuth test-user access.
- Many attendees behind one public IP can sign in and join without being throttled as one client.
- Joining opens 15–30 minutes before the round; sessions persist through gameplay; a late join burst still succeeds.
- p95 join latency at most 3 s under the 350-player test after warm-up (GDGBINGO-M2).

**PRD-F2 — Stable bingo card**
- Given a joined participant, when they reload or sign in on another device, then the layout is identical.
- Every card has exactly 24 distinct squares from the event's square set plus a free centre.

**PRD-F3 — Private outgoing codes**
- A participant sees only their own codes, with copy controls and spent/unspent state.
- Codes never appear in another participant's responses, the public board, URLs, or logs.

**PRD-F4 — Claim redemption**
- A valid claim commits exactly one claim and spends exactly one code.
- Two concurrent redemptions of one code commit exactly one claim.
- A retry with the same request ID and payload returns the original success; a changed payload with the same request ID is rejected.
- Concurrent requests under the same event/claimant/request ID are ordered before spent-code or closure checks; a successful original is replayed, including after closure. A changed concurrent payload is rejected against that committed original.
- Self-claims, codes from another event, spent codes, a repeated square, the free cell, and claims outside the open round are rejected without newly spending a code. Previously spent codes remain spent.
- If COMMIT acknowledgement is lost, the outcome is unknown until recovered with the same request ID; the client must not treat the code as unspent or mint a new request ID automatically.
- p95 successful claim latency at most 2 s under test (GDGBINGO-M1).

**PRD-F5 — Line and blackout scoring**
- Lines and blackout are computed from committed claims only; the free centre counts toward lines.
- The response to a successful claim includes updated progress without a second fetch.

**PRD-F6 — Round lifecycle**
- Claims before opening or after the deadline/closure are rejected deterministically, using database time.
- Manual closure and in-flight claims are ordered by a transaction lock so each claim is either committed before closure or rejected.
- Unrelated joins and claims run concurrently: mutations take a shared event-state lock, only closure takes an exclusive one.

**PRD-F7 — Public board**
- Board data is at most 45 s stale under normal connectivity (GDGBINGO-M4).
- Clients poll every 30 s with jitter, only while visible, without overlapping requests, and stop after final closure. Waiting players keep the event page open to receive the host's round start without manual refresh.
- The board endpoint reads no cookies and is cacheable at the CDN.

**PRD-F8 — Host dashboard**
- Only authorised hosts of the event can load the dashboard or call host endpoints.
- After closure, qualifiers and tie outcomes follow the agreed tie policy (LOG Q6).

**PRD-F9 — Skill reveal**
- Counts are distinct code owners per matched skill, not claim rows or claimants.

**PRD-F10 — Recruitment consent and skill selections**
- Consent defaults to not given and is recorded explicitly.
- Self-selected skills are displayed and exported separately from claim-derived counts.

**PRD-F11 — Protected CSV export**
- Only hosts can download; cells beginning with `=`, `+`, `-`, `@`, tab, or carriage return are neutralised.
- Follow-up columns include only consenting participants.

**PRD-F12 — Shared rate limiting**
- Limits are keyed by authenticated player, not IP, and hold across server instances.
- Exceeding a limit returns a retryable error and never consumes a code.

**PRD-F13 — Accessible phone UI**
- Usable at 360 px width; touch targets at least 44 x 44 px; WCAG 2.2 AA contrast; all controls keyboard-operable with visible focus; respects `prefers-reduced-motion`.

## 4. Explicit exclusions

| Excluded | Why | Revisit when |
|----------|-----|--------------|
| Teams bot or app | IDEA §4 | After v1 event |
| Live push updates | IDEA §4; polling fits free tier | Board freshness gate fails |
| Chat, booth quests, multi-round, event builder | IDEA §4 | After v1 event |
| Automated recruitment messaging, SMS, paid email | IDEA §4; INV-7 | Never in v1 |
| Payments and prize fulfilment | IDEA §4 | Never in v1 |
| Non-Vercel hosting, paid plans | IDEA §4; INV-7 | Owner CR only |

### 4.1 Must-never rules

| INV-# | The system shall never | Constrains |
|-------|------------------------|------------|
| INV-1 | Commit more than one claim per code | PRD-F4 |
| INV-2 | Leave a code spent after its claim is rejected or rolled back | PRD-F4, PRD-F12 |
| INV-3 | Return or log a private code or server secret outside its owner's private response; send the shared invitation fragment to the server or expose it outside the attendee link | PRD-F1, PRD-F3, PRD-F7, PRD-F11 |
| INV-4 | Trust browser-supplied identity, permissions, scores, or timing | PRD-F4, PRD-F5, PRD-F6, PRD-F8 |
| INV-5 | Create a second participation, card, or code allowance for one user in one event | PRD-F1, PRD-F2, PRD-F3 |
| INV-6 | Serve host controls, exports, or another participant's private state to an unauthorised user | PRD-F3, PRD-F8, PRD-F11 |
| INV-7 | Require a paid service or upgrade automatically to a paid plan | PRD-F7, PRD-F12, PRD-F15 |

## 5. Metrics

Proposed launch gates from [plansv1.md](../plansv1.md) Phase 5; targets, not
measured results.

| ID | Metric | Target | How measured |
|----|--------|--------|--------------|
| GDGBINGO-M1 | p95 successful claim latency | ≤ 2 s | 350-player load test |
| GDGBINGO-M2 | p95 join latency after warm-up | ≤ 3 s | 350-player load test |
| GDGBINGO-M3 | Unexpected server errors | < 1 % of requests, validation rejections reported separately | Load test and event logs |
| GDGBINGO-M4 | Board staleness | ≤ 45 s | Load test probe |
| GDGBINGO-M5 | Double-spent codes, invalid claims, duplicate participations | 0 | Post-test integrity queries |
| GDGBINGO-M6 | Dynamic requests per event | ≈ 25,000 including reserve | Vercel usage before/after |
| GDGBINGO-M7 | Vercel function invocations remaining before event | ≥ 50,000 | Vercel dashboard |
| GDGBINGO-M8 | Neon CU-hours remaining before event | ≥ 20 | Neon dashboard |

## 6. Candidates (not decided)

| Candidate | Raised by | Notes |
|-----------|-----------|-------|
| Prize tiers beyond first line / blackout | architecture.md | Pending LOG Q6 |
| Multiple events in one deployment | plansv1.md | Schema allows it; no event-management UI in v1 |

## 7. Open questions

- Approved 2026-10-18: two codes per participant; both can confirm different squares for the same other participant.
- Approved development defaults: 12-minute round, first-line qualification, equal-time ties shared. Final square set and actual prizes remain pending.
- Development defaults approved: public display names/progress, recruitment opt-in off by default, 30-day retention; final consent copy remains a release review item.
