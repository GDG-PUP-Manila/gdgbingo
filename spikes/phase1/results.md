# Phase 1 evidence — 2026-10-18

Branch: `feat/8-phase1-spikes`, based on commit `60cb979` with uncommitted
pre-development corrections and spike files. No application release,
production schema, GitHub issue closure, push, or deployment is represented.

## Local environment and scope

- Windows x64; Node 24.8.0; npm 11.6.2.
- Astro 7.4.0, React 19.3.1, `@astrojs/react` 7.1.0,
  `@astrojs/vercel` 11.0.15, TypeScript 5.9.3.
- Neon JS 0.8.0-beta, Neon serverless driver 1.2.0, Drizzle 0.45.4.
- Real local PostgreSQL 18.4 with node-postgres 8.23.1, not Neon pooling.
- Follow-up hosted run: Neon Pool + `drizzle-orm/neon-serverless`, PostgreSQL
  `18.6 (653b019)`, with the user-configured disposable development database.
- Exact resolved packages and security override are in `package-lock.json`.

## Recorded checks

| Command | Result | What it proves |
|---|---|---|
| `npm.cmd ci` | Passed; 570 packages installed, 0 reported vulnerabilities | Reproducible clean installation from the spike lockfile; documented beta-peer warnings remain |
| `npm.cmd test` | 11 passed | Actual generic Neon server SDK imports/adapts to Astro-like context; simulated upstream session handling, fail-closed behaviour, origin/method restrictions, minimal private response, public header contract, fixed callback redirects and OAuth verifier cookie exchange |
| `npm.cmd run test:database` | 8 passed on local PostgreSQL 18.4 | Competing codes, identical/changed concurrent requests, square conflict rollback, post-close replay, rejection safety, unrelated concurrency, manual close waiting |
| `npm.cmd run test:database` with ignored development configuration | 8 passed through Neon Pool on PostgreSQL 18.6 | The same bounded transaction/locking checks pass through the actual Neon serverless driver and Drizzle Neon adapter |
| `npm.cmd run check` | Passed after dependency override: 0 errors, 0 warnings, 0 hints | Astro/React/endpoint TypeScript compatibility in this isolated workspace |
| `npm.cmd run build` | Passed after dependency override | Static page and dynamic API can be packaged by the official adapter |
| `npm.cmd run verify:build` | Passed after dependency override | Static HTML + hydrated React island + dynamic API routes + one Node 24 function; live route/cache behaviour remains untested |
| `npm.cmd audit --json` | 0 vulnerabilities after scoped override | No advisories reported for that resolved dependency graph at check time |

The database harness uses a reduced disposable schema and Drizzle transactions.
It does not implement or validate the complete ERD, scoring, invitations,
deadline timing, full constraint-error response mapping, or real network loss
during COMMIT. Those checks remain pending; do not mark all QAD cases passed.

After the final pooling-related change, the local database suite passed all
8 checks again. Schema selection and timeouts use `SET LOCAL` inside a
transaction; no remote test assumes session-level settings persist across
PgBouncer transactions. This is a design safeguard, not a hosted Neon result.
The later hosted run now verifies these eight scenarios through Neon Pool;
it does not verify the full production schema, remaining fault cases, or
350-player performance. The isolated test schema was retained for inspection.
Auth/API tests and artifact verification also passed after clean installation.
The dev script's CLI path was verified using `npm.cmd run dev -- --help`;
no long-running development server was left running.

Initial audit reported GHSA-9wv6-86v2-598j via Vercel routing utilities and
`path-to-regexp@6.1.0`. Scoped override: 6.3.0 for that routing dependency.
No force downgrade or blanket audit suppression was used. The Neon SDK beta
graph still emits Better Auth peer-resolution warnings; these require live
compatibility verification before production selection.

## Published quota snapshot

Read on 2026-10-18; these are public allowances, not the account's remaining
usage or a capacity test.

| Service | Published resources relevant to this event |
|---|---|
| Vercel Hobby | 1,000,000 function invocations/month; 4 active CPU-hours; 360 provisioned GB-hours; 100 GB fast transfer; 10 GB origin transfer |
| Neon Free | 100 CU-hours/project/month; 1 GB DB storage; 5 GB public transfer; up to 60,000 auth MAUs |

The repo was checked through GitHub's API: visibility `public`, owner type
`Organization`, default branch `main`. Account identity, import permission,
actual plan, remaining quota, and Hobby eligibility are still unverified.

For 300 players and 20 minutes at 30-second polling: 12,000 board requests
plus at most 600 successful two-code claims. The 20,000-request example allows
7,400 other requests; the 350-player verification envelope remains 25,000.
This arithmetic excludes unmeasured auth amplification and is not measured
CPU/memory/transfer usage. Keep all account-shared usage in the actual budget.

Sources: [Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Neon pricing](https://neon.com/pricing),
[Neon OAuth setup](https://neon.com/docs/auth/guides/setup-oauth),
[Vercel Git rules](https://vercel.com/docs/git#using-hobby-teams),
[routing advisory](https://github.com/advisories/GHSA-9wv6-86v2-598j).

## Outstanding gates

| Item | State |
|---|---|
| #1–#7 owner decisions | Pending; earlier proposed defaults have not been approved |
| #8 real Neon Auth/Astro OAuth | 11 local checks passed; user confirmed localhost Google login, browser/server session checks, refresh, sign-out and re-login; HTTPS, two-user isolation and shared-network checks pending |
| #9 actual Neon Pool + Drizzle locking | 8 local and 8 actual Neon Pool checks passed; full-schema/deadline/unknown-COMMIT fault scenarios still pending |
| #10 hosted Vercel runtime/cache | Build artifact generated; live deployment, cache hits, cookie isolation pending |
| #11 account-specific quota/eligibility | Published snapshot recorded; actual account headroom and eligibility pending |
| #12 SPINE lock/checkpoint | Private access unresolved; documents remain Draft; no checkpoint created |
| Production app and 350-player capacity | Not implemented / not measured |

User requested account setup instructions. Follow [SETUP.md](SETUP.md) before
running external checks; keep credentials in the ignored local environment file.

User has since configured the development pooled database URL and authorised
the external spike. Its credentials were not displayed. An auth cookie secret
was generated into the ignored local `.env` without displaying its value.
The development Auth base URL was subsequently saved and its unauthenticated
`get-session` endpoint returned HTTP 200. After the user supplied Google
credentials in the ignored local file, the existing development Google
provider was updated through Neon's branch-scoped API. A fresh provider listing
confirmed its stored client ID matches the supplied custom ID. No credentials
were printed. The production branch was not changed. Production audience
access remains unverified.

The user reports adding one Google test user. The React probe now provides
Google sign-in, browser/server session checks, and sign-out. The callback uses
the official SDK middleware to exchange the OAuth verifier and forward cookies,
then redirects to a fixed same-origin page without the verifier query.
Eleven local auth/API checks pass with simulated upstream responses; Astro
check, build, and Vercel artifact verification pass. The user subsequently
reported successful browser and server session checks after Google login and
confirmed the refresh, sign-out, unauthenticated check and re-login steps.
This is user-reported localhost evidence, not an agent-observed browser test.
HTTPS, independent-user isolation, shared-network behaviour, recovery and
production audience access remain unverified; issue #8 remains open.

During the browser rehearsal, both required auth fields were found empty in
the ignored local environment file. The development Auth URL was restored and
a random cookie secret generated without printing it. Configuration validation
passed and the upstream unauthenticated session endpoint returned HTTP 200.

The console's shared-Google Configure dialog showed no custom credential
fields. CLI 8.8.0's API command accepted the update body via `--data=-` from
stdin; `--data -` was parsed incorrectly and failed before the successful
update. This workaround does not place secret values in shell command text.

Owner subsequently selected the original two-code rules; the reduced Phase 1
fixture still tests its original candidate design. Current game acceptance
evidence belongs in `docs/development-status.md`, not this historical spike.
