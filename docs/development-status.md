# Development evidence — 2026-10-18

This is an implementation checkpoint, not a launch approval. The owner
authorised development against the Draft specifications. Private SPINE
validation/document locks, hosted verification, and event readiness remain open.
The initial implementation evidence described the uncommitted working tree.
The user subsequently committed and pushed `9ef5f72` on `feat/8-phase1-spikes`
and deployed it as a Vercel Preview. Hosted observations below refer to that
commit; subsequent evidence-only edits are not part of its deployed source.
No GitHub issues have been closed by the agent.

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

## Hosted preview observations — 2026-10-18

Preview source: `9ef5f72`; branch alias:
`https://gdgbingo-git-feat-8-phase1-spikes-gdgpupmnls-projects.vercel.app`.
The first probe redirected all requests to Vercel login (302). Subsequent
requests reached the application after the user adjusted preview access.
The user reported the second account's saved card loading and showed the
host's controls, closed round, both players' one-square progress and one
remaining outgoing code each. This is browser evidence supplied by the user.

Low-volume unauthenticated HTTP probes confirmed:

- `/api/session`, event `me` and event `host/state` return 401 rather than
  private data, with `Cache-Control: private, no-store`.
- The public board returns 200; repeated requests produced Vercel `MISS`
  followed by `HIT`. A request carrying an arbitrary non-authentication cookie
  returned the same body and a cache HIT. Neither board response set cookies.
- Board player fields were exactly display name, claimed count, line count,
  blackout and codes remaining. No private codes or account IDs were present.

These probes establish public cache operation and anonymous guards, not full
two-signed-in-user isolation, cold-start performance or 350-player capacity.

Prepared fresh development event `28b13ac3-b8a8-45db-abfa-6f05914c8f8f`, titled
**GDG Bingo HTTPS rehearsal**. Both existing test accounts joined with their
existing display names, fresh stable cards, zero claims and two codes each.
The original host remains host; the fresh event is draft. The previous event
was preserved without reopening it or resetting its codes. Private invitations
remain only in the ignored event manifest; none were printed.

The user subsequently demonstrated successful HTTPS claims in both directions,
confirmed both of the host's codes became spent, and showed standings with
Kian at two claims and the host at one. Reveal showed two distinct Figma
confirmers and one Git confirmer, matching those exchanges. After the close,
CSV and non-host-control checks were requested, the user confirmed the
sequence was okay. Record closure/export/access results as user-reported
manual evidence, not an independently captured signed-in HTTP trace.

The two-account HTTPS rehearsal is therefore user-confirmed. Production OAuth
audience, signed-in isolation under broader scenarios, actual region/headroom,
shared-network sign-in, full-duration hosted capacity and release readiness
remain pending. No hosted load burst or production promotion has occurred.

## Approved UI implementation — 2026-10-18

The owner selected the light GDG direction, requested `frame.gdgpup.org` as the
reference, reviewed the Superdesign player-screen draft v3, and approved its
implementation. The working tree now implements that direction across landing,
invitation/sign-in, player card and private wallet, public board, host controls,
skill reveal and optional preferences. The actual reference-site logo assets
are stored locally under `public/brand/`; Outfit 5.3.0 is pinned and self-hosted
through Fontsource. No runtime dependency on the design canvas was introduced.

The landing page accepts an event link or ID and always navigates within this
deployment. Giving and receiving codes have separate instructions. Preferences
are collapsed and consent remains off by default. Host closure requires an
explicit confirmation. Claim receipts update the card immediately; a subsequent
refresh failure no longer mislabels a confirmed claim as an unknown outcome.
Unknown claims still retry the identical persisted request ID and payload.

Validation on this working tree:

- Astro checking: 39 files, zero errors, warnings or hints.
- Production build and `verify:build` passed; private dynamic routes, Node 24
  artifact, Singapore configuration and static secret checks remain intact.
- All 38 Node unit/integration checks passed against isolated local PostgreSQL.
- All 12 Chromium browser checks passed. These use mocked HTTP for gameplay and
  the built static landing page for event entry, with 360px mobile and 1440px
  desktop screenshots. Visible buttons meet 44px minimum dimensions; checked
  mobile pages have no horizontal overflow. This is not a full accessibility
  audit or a signed-in hosted browser acceptance run.
- The dependency install reported zero audit vulnerabilities; existing beta
  auth peer-dependency warnings remain as previously documented.

Screenshots remain ignored in `test-results/`; canvas context and resume state
remain ignored in `.superdesign/`. No existing event, invitation or issued code
was reset. No database migration, commit, push or deployment was performed in
this UI implementation pass. Production OAuth audience, quota/capacity and
event-readiness gates described above remain open.

### Local development follow-up

After the owner reported the landing action still failing, a browser against
the existing localhost server reproduced `_jsxDEV is not a function` in
`EventEntry`. Its Vite dependency file contained React's production JSX-dev
runtime (`jsxDEV` was undefined), and client rendering removed the entry form.
The built-page checks had not exercised this development-server failure.
Astro configuration now isolates dependency caches by command so build/check
cannot overwrite a running development server's cache. The production build
and three landing browser cases pass after this change. After the owner
confirmed the app worked, a fresh browser against localhost verified that the
event-link input exists, clicking the play link focuses it, and no page errors
occur. No user-owned server process was stopped by the agent. A fresh build
artifact verification also passed before the updated Vercel preview handoff.

### Deployment-testing recheck

Fresh checks after the owner requested a final deployment/testing review:
production build and artifact verification passed; Astro checking reported
zero errors/warnings/hints across 39 files; all 38 Node checks and all 13
Chromium browser cases passed; npm audit reported zero vulnerabilities.
After the build/check run, a browser against the owner's existing localhost
server confirmed the play action focuses a rendered event-entry input, no
horizontal overflow at 390px, and no page errors. Anonymous requests to the
existing hosted preview's session and host-state endpoints returned 401 with
private/no-store. These hosted probes cover the already-deployed base commit,
not the local UI changes, which still await commit/push. All five required
local runtime settings were present; neither secret values nor cookies were
printed, and no private environment or canvas state is tracked.

Conclusion: ready for an updated Vercel preview and controlled testing with
configured Google test accounts. This does not grant production/event launch
acceptance or verify 350-player hosted capacity. The final host account is
still to be supplied by the owner; full-round retesting needs a fresh test
event if the earlier rehearsal is closed. No deployment, database mutation or
host assignment was performed during this recheck.

### Reference motion applied

The owner subsequently requested the effects and animation from
`https://frame.gdgpup.org/`. A fresh browser inspection of that site verified
four staggered 5.6/5.8/6.0/6.2-second shape bounces, 650–900ms fade-up entrances,
and 200ms button/card hover lift and scale. Those patterns are now applied to
Bingo, with a fading graph-paper background and small desktop-pointer parallax.
Claim and confirmation panels have short entrances; confirmed squares briefly
emphasise success. Gameplay state and API contracts did not change.

A native checkbox control in the header pauses motion without relying on React
hydration. Reduced-motion preferences disable entrances, bounces, transitions
and parallax while leaving content visible. Pointer effects are limited to
fine mouse pointers, throttled with requestAnimationFrame, and reset when the
page loses visibility/focus. No animation service or dependency was added.

Validation: production build and artifact verification passed; Astro checking
reported zero diagnostics across 41 files; all 15 Chromium browser cases passed,
including pause/reduced-motion and the existing claim/host flows. A live
localhost browser independently observed the bounce and parallax, one pause
control, no page errors and no horizontal overflow. The owner subsequently
authorised a local commit of this UI/motion changeset and will run the push
themselves. Remote publication and Vercel deployment remain owner-controlled.
