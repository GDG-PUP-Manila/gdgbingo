# GDG Bingo — Version One Plan

Status: Proposed plan. Current scope is documentation only; no application deployment or service purchase.

Architecture source of truth: [architecture.md](architecture.md).

Fixed service budget: $0 using ongoing free plans. No paid upgrades, trial-credit dependencies, purchased domains, paid messaging, or paid cache services. Capacity and reliability must be demonstrated; perfect operation cannot be guaranteed from drafts.

Selected application stack: Astro + TypeScript, React islands, Tailwind CSS, Neon PostgreSQL/Auth, and Drizzle. Deploy the website and API only to Vercel using `@astrojs/vercel`. Neon remains the external data/auth service. No alternate application host is planned.

## Intended outcome

A phone-friendly website for 300+ participants with private codes, automatically validated claims, bingo scoring, a public board, host controls, a skill reveal, and CSV exports.

Initial readiness target: a successful 350-participant burst test and a rehearsal using the production configuration. Capacity remains unverified until tested.

## Scope

Include one active round per event, versioned 5 x 5 cards, controlled invitations, persistent identity, proposed six-code allowance, one confirmation per other participant, line/blackout detection, countdown, periodic board refresh, host start/close, consent-aware reveal, and exports.

Defer Teams bot/tenant integration, live subscriptions, chat, booth quests, automated recruitment messages, payments, and a general-purpose event builder. Multiple events may fit the schema without requiring a full event-management product.

## Phase 1 — Confirm rules and integrations

- Resolve architecture decisions before building affected features.
- Finalise square labels, categories, code allowance, prizes, and ties.
- Select sign-in and invitation distribution/recovery.
- Verify Neon Auth with Astro and the React integration: supported browser SDK, server-side session validation, redirects, secure cookies, returning sessions, CSRF/origin checks, and host roles. Do not assume a Next.js-specific helper works in Astro.
- Verify Neon driver/Drizzle compatibility with transactions and row locks.
- Verify the free deployment requirements and dated quota snapshot in the architecture. Record remaining allowances across the actual accounts.
- Establish Vercel Hobby eligibility for the actual owner/event/repository. If unsuitable or unresolved, record the Vercel-only/$0 constraint as unmet; do not change hosts or upgrade automatically.
- Verify Astro's Vercel adapter, Node.js runtime, private-cache headers, public CDN caching, and transactional database access on the intended deployment configuration.
- Select sign-in and recovery that require no paid SMTP or SMS service.
- Verify production OAuth credentials and attendee access; do not rely on Neon shared development email delivery or OAuth test-user-only access. Test multiple attendees behind one public IP. Plan for players to sign in and join 15–30 minutes before the round.

Exit: agreed rules and entry flow, with a verified path for authentication and transactional database access. Revise the draft if a selected integration does not meet requirements.

## Phase 2 — Foundation and schema

- Scaffold Astro, TypeScript, Tailwind CSS, Drizzle, `@astrojs/react`, and `@astrojs/vercel`; pin compatible supported versions.
- Prerender public instructions and page shells; keep personal views and API routes on demand. Do not prerender private data or perform per-player database work at build time.
- Implement server-only database/auth/game modules and API routes under `src/pages/api/`. Avoid an extra session store unless required by the verified auth flow.
- Add README instructions, environment-variable template, migration commands, and verification commands.
- Isolate development/test data and create reviewed schema migrations.
- Implement the architecture's records, indexes, foreign keys, and uniqueness constraints.
- Add synthetic event/player seeds, excluded from production.
- Implement secure code generation, digest lookup, encrypted redisplay, and private invitation generation.
- Make joining transactional and idempotent.

Exit: one participant gets exactly one stable card and the configured code allowance; returning sessions never mint more codes; private state cannot be fetched by other participants.

## Phase 3 — Core game correctness

- Build Astro layouts/instructions and React islands for sign-in/join, card, private-code copy controls, and claim form. Hydrate the active game immediately and share one state owner for card/claim/progress.
- Establish UI tokens and verify readable card labels, touch targets, accessible dialogs, focus styles, responsive layouts, and reduced-motion behaviour. Astro helps control delivered JavaScript; UI quality still requires design and review.
- Implement atomic redemption, server-side permissions, indexed PostgreSQL rate-limit buckets with bounded retention, and request-ID retries. Do not depend on a paid Redis service.
- Calculate square counts, lines, and blackout from committed claims.
- Enforce database-time deadlines and coordinate manual closure with in-flight claims.
- Keep unrelated joins/claims concurrent: use compatible event-state locks and narrow code-row locks, rather than an exclusive event-wide lock per mutation. Test deterministic lock ordering and bounded retries.
- Handle invalid/spent codes, repeated squares/people, self-claims, and temporary errors clearly.
- Preserve input during failures and restore the card after refresh or reconnect.

Required checks:

| Scenario | Expected outcome |
|---|---|
| Valid redemption | One claim and one spent code |
| Two players redeem one code concurrently | Exactly one succeeds |
| Retry after lost success response | Original success; no extra claim |
| Request ID reused with changed input | Rejected |
| Self-claim or code from another event | Rejected; code remains unspent |
| Two codes submitted for one square concurrently | One claim; losing code remains usable |
| Two squares from one confirmer concurrently | One claim under the proposed rule |
| Forged identity, invalid square, or free-cell claim | Rejected |
| Before opening, after deadline, or during closure | Deterministic enforcement of timing policy |
| Refresh, rejoin, or sign in again | Same participation, layout, and codes |

Exit: database-backed correctness and concurrency checks plus critical browser flows pass.

## Phase 4 — Board and host workflow

- Add paginated standings, claim/line counts, and remaining outgoing-code counts.
- Poll every 30 seconds only while the board is visible, with random staggering; pause hidden/idle tabs and stop after final closure. Verify Vercel CDN caching on the unauthenticated public aggregate endpoint and private/no-store responses for personal, auth, mutation, and host data.
- Authorise every host endpoint and protected view.
- Implement start/close, audit records, automatic qualification, and agreed tie rules.
- Implement distinct-confirmer skill reveal and separately labelled optional skill selections.
- Collect recruitment consent and provide protected, formula-safe CSV exports.

Exit: a host can run a round and export results; ordinary players cannot access controls, exports, or private credentials.

## Phase 5 — Verify event readiness

- Check phone layouts, keyboard use, focus handling, screen-reader labels, and contrast.
- Run a 12-minute round inside a 20-minute scenario with 350 simulated participants: join burst, valid claims, contested codes, board reads, and closure. Follow the host's testing rules; Vercel requires authorisation for load testing. Do not run a hosted burst without required provider authorisation.
- Test lost responses, slow connections, retries, cold database wake-up, and session recovery.
- Test the actual production sign-in method, a late join burst, and shared-network attendees. Include auth/session checks in the measured request budget rather than assuming MAU allowance proves burst capacity.
- Measure request latency/errors, query timings, transaction conflicts, connections, and provider usage.
- Verify codes/secrets are absent from public responses and logs.
- Fix failures, rerun affected checks, and document remaining limits.

Proposed launch gates:

- Zero double-spent codes, invalid committed claims, duplicate participation, or prohibited duplicate claims.
- Zero private credential exposure or unauthorised host access.
- Under the tested workload, p95 successful claim latency at most 2 seconds and join latency at most 3 seconds after warm-up.
- Unexpected server errors below 1%; report expected validation rejections separately.
- Board freshness within 45 seconds under normal connectivity.
- Safe retry after a lost response, with tested deadline and closure behaviour.
- Verified ongoing free plans and host eligibility, with no paid service required for entry, recovery, rate limits, exports, or caching.
- Measured resource usage fits the remaining Vercel Hobby/Neon Free allowances; inspect CPU, memory, transfer, and compute as well as request counts. Verify Astro's deployed static/on-demand route split.
- Event budget targets: approximately 25,000 dynamic requests including reserve, at least 50,000 Vercel function invocations remaining, and at least 20 Neon CU-hours remaining. Reserve measured CPU/memory/transfer headroom too. Include account-shared traffic and additional auth requests in actual measurements.
- Exercise quota failure, backoff, stopped polling after closure, and safe resumption without code loss.

These are proposed thresholds, not measured results. Record the exact deployment configuration, workload, and cold-start findings. If gates fail, tune or change the configuration and retest before launch.

Exit: written readiness evidence supports the expected attendance on Astro/Vercel Hobby with Neon Free. If gates fail, tune or reduce scope and retest; do not resolve failures with a host change or automatic paid upgrade. Account for tests and rehearsals within the same monthly usage cycle; a different test day does not reset allowances.

## Phase 6 — Deploy and rehearse

- When deployment is requested, deploy Astro to the eligible Vercel Hobby account using `@astrojs/vercel`; configure production secrets and auth redirects. Use the included `vercel.app` HTTPS subdomain.
- Apply reviewed migrations, create the real event, and assign hosts.
- Rehearse join, share, claim, qualify, close, reveal, and export with test attendees.
- Remove rehearsal data using an event-scoped procedure before issuing real codes.
- Distribute private invitations using the agreed process.
- Open joining 15–30 minutes before gameplay and ask attendees to sign in early. Retain and verify sessions through the round; keep late joining functional.
- Prepare the pinned Teams message, participant instructions, host checklist, and incident procedure.
- Check remaining free quotas before opening registration and before the countdown; verify database wake-up with a smoke check. Avoid continuous keep-alive jobs that consume the monthly compute allowance.
- During an outage, pause activity and communicate status; do not award prizes from uncommitted browser state.

Exit: production smoke checks pass and the host has working access, the event link, and operating instructions. Do not publish or buy services as part of this drafting task.

## Implementation deliverables

- Application source and database migrations.
- Local setup, deployment guide, and secret-free environment template.
- Seed/import tooling and private invitation distribution output.
- Correctness tests and reproducible load scenario.
- Readiness report identifying tested capacity and limitations.
- A dated free-tier eligibility/resource checklist and measured before/after usage, including development, rehearsal, and expected event headroom.
- Host runbook, recovery instructions, and protected exports.

## Effort and order

Expect several focused development days plus provider setup, load testing, and rehearsal; refine estimates after Phase 1. This is a custom application rather than a five-minute script deployment. Account access, invitation distribution, rule changes, and test findings may affect the schedule.

Build claim correctness before board polish. Complete capacity verification before inviting the full audience. Implementation completion alone is not evidence of event readiness.
