# Development evidence — 2026-10-18

This is an implementation checkpoint, not a launch approval. The owner
authorised development against the Draft specifications. Private SPINE
validation/document locks, hosted verification, and event readiness remain open.
No commits, pushes, issue closures or Vercel deployments were performed.
Evidence describes the uncommitted working tree on `feat/8-phase1-spikes`,
not a released commit. Capture the reviewed commit ID when publishing it.

## Approved rules

- Original rules: two outgoing codes per participant, globally single-use.
  Both codes may confirm different squares for the same other participant.
  There is no claimant/confirmer uniqueness constraint.
- Development defaults: 12-minute round; first-line qualification with equal
  database acceptance times sharing the outcome; public display names/progress;
  recruitment consent off by default; event records deleted 30 days after the
  round ends through the organiser's retention runbook.
- Google OAuth is configured on the development Neon branch. The owner
  confirmed localhost sign-in, browser/server sessions, refresh, sign-out and
  re-login in the isolated spike. This is user-reported manual evidence.
- Final square labels/prizes, event date, production audience access, invitation
  distribution/recovery and host eligibility still need release decisions.

## What exists

| Phase | Implementation and evidence | Remaining acceptance work |
|---|---|---|
| 1 — integrations | Spike retained; Neon Auth localhost lifecycle reported; Neon Pool transaction checks passed; Hobby account reported | HTTPS auth, cookie isolation, shared-network sign-in, live CDN, account headroom/eligibility and private validator |
| 2 — foundation | Root Astro/React/Tailwind package; 11-table Drizzle schema and migrations; secure token helpers; transactional joins; saved cards and encrypted redisplay; development seed | Returning-device real-browser rehearsal and production migration review |
| 3 — gameplay | Player island; claims; database-time admission; same-ID replay; shared limiter; scoring; unknown-outcome recovery | Full HTTP-to-real-Auth/Neon browser run, fault/network review and accessibility audit |
| 4 — host and board | Paginated public board; visible-only polling/backoff; host start/close; equal-time qualification; distinct-confirmer reveal; opt-in and neutralised CSV | Two-account hosted authorisation checks, real cache evidence, final consent/recovery review |
| 5 — readiness | Local correctness, browser-island tests and compressed 350-player database workload | Full 12-minute/20-minute scenario over HTTP/Auth/CDN; cold wake-up, provider usage and shared-network measurements; real phone/screen-reader checks |
| 6 — deployment | Vercel adapter/Node 24 artifact and Singapore region configuration; development event ready | User-controlled Vercel deploy, production OAuth/configuration, quota check, rehearsal, backup/rollback evidence and launch decision |

No phase is represented as fully accepted merely because its code exists.

## Recorded local checks

Environment: Windows x64, Node 24.8.0; real temporary PostgreSQL 18.4 on loopback.
Tests apply the full generated application schema to a fresh local database.

- `npm.cmd test`: **38 passed**, including parent suite counts. Covers competing
  joins, invitation ownership, full rollback, stable cards/codes, concurrent
  claims, same-ID replay and changed payloads, two codes from one confirmer,
  square-conflict rollback, invalid/foreign/self claims, timing, shared limits,
  host guards, reveal/export consent, unknown COMMIT acknowledgement, actual
  closure blocking, event-scoped retention and a code lock crossing the deadline.
- `npm.cmd run test:e2e`: **5 passed**, Chromium at 360 × 800. Mounts the actual
  compiled React island against mocked HTTP responses. Checks join/card/codes,
  default consent, horizontal fit and button sizes, focused claim input,
  confirmed progress, same-request retry after refresh, host rejection and
  visibility/closure polling. This is not full deployed-stack E2E evidence.
- `npm.cmd run typecheck`: no errors, warnings or hints.
- `npm.cmd ci --no-fund --loglevel=error`: clean installation succeeded from
  the root lockfile (603 packages added, zero reported vulnerabilities).
- `npm.cmd run build` and `npm.cmd run verify:build`: static landing page,
  dynamic auth/private/game routes and one Node 24 function artifact passed.
- `npm.cmd audit`: zero reported vulnerabilities. Scoped overrides fix Vercel
  routing's `path-to-regexp` and Drizzle Kit's legacy esbuild utility. The direct
  browser-test esbuild version matches Vite's supported range. Neon beta peer
  warnings remain documented; audit alone does not prove compatibility.

## Local workload baseline

`npm.cmd run test:load:local` runs only on a fresh local PostgreSQL process.
It ignores cloud environment values and has no hosted target option.
It uses 15 concurrent workers, 350 synthetic players, 700 valid claims and
30 board reads, then closes the event and checks integrity.

| Operation | Samples | p95 | Maximum |
|---|---:|---:|---:|
| Join | 350 | 88 ms | 485 ms |
| Claim | 700 | 85 ms | 105 ms |
| Board | 30 | 389 ms | 390 ms |

Integrity: 350 participations, 700 issued codes, 700 claims, 700 spent codes,
zero inconsistent claim/code links. The workload is deliberately compressed;
it does not simulate 12-minute pacing, 350 concurrent HTTP connections, real
OAuth, serverless cold starts, CDN behaviour or monthly service consumption.
Machine-readable output is ignored at `test-results/local-load.json`.

This run includes the stricter deadline-admission check and was recorded at
2026-10-17 18:47:57 UTC (2026-10-18 in Manila). Rerun after future material
performance changes before quoting it as a current result.

## Actual development Neon changes

The configured development branch had no public application tables before
migration. The reviewed generated migrations were then applied successfully.
No production branch was changed. The root ignored `.env` was created from
the existing development spike values, with independent random token keys.
Credentials and private invitations were never printed.

Created development rehearsal event `af4bd016-3570-4265-a666-3e938c763bf8` with
provisional squares and 350 private invitations. The sole existing development
Google test account was assigned as host and joined as **Host rehearsal**.
Actual Neon Pool/Drizzle join and rejoin returned the same participation, a
25-cell card and exactly two codes; rejoin created no extra participation.
The round was initially left draft for the user-led browser rehearsal.

Subsequent user-led localhost rehearsal started the round and joined a second
Google test account. A database inspection confirmed one committed claim for
the second participant and one spent outgoing code for the host. A diagnostic
replay of that exact saved request through Neon returned the original success
and progress 1/24. The browser's pending display alone was not a failed claim.
The UI now distinguishes an in-flight check from an unresolved saved claim;
browser confirmation of the final retry display remains a manual follow-up.

The user subsequently confirmed the proposed local rehearsal sequence worked:
claimed progress surviving refresh, spent-code reuse rejection, exchange in the
opposite direction, closing the round and rejecting new claims, skill reveal
and CSV download. Record this as user-reported manual evidence, separate from
the automated checks. Hosted HTTPS behaviour, private-data isolation, CDN hits,
production OAuth audience and actual provider usage remain unverified.

The invitation manifest is in ignored `.private/`; its first invitation is
already redeemed by the host. Never commit or publish this manifest.

## Immediate rehearsal

Stop the isolated spike server, then run from the repository root:

```powershell
cd 'C:\Users\KIAN FLORENDO\gdgbingo'
npm.cmd run dev
```

Open `http://localhost:4321/events/af4bd016-3570-4265-a666-3e938c763bf8` with
the existing Google test account. Check the saved card, two codes and Host tab.
A second test account needs to be allowed in Google OAuth and use a separate
unredeemed private invitation. Test Teams DM exchange, claim, close, reveal
and export. Do not share environment or invitation manifests in screenshots.

For the application Vercel project, use repository root `.` rather than
`spikes/phase1`. Keep the rehearsal on development credentials. The configured
function region is Singapore (`sin1`), matching the development Neon region;
actual deployed placement and latency remain unverified.
