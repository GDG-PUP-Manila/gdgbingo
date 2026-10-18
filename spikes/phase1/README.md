# Phase 1 integration spikes

Isolated experiments for issues #8–#11. This is not the production bingo app,
a completed OAuth implementation, or evidence of 350-player capacity.
The canonical specifications remain Draft. Do not use real attendee data here.

## Run locally

Requirements: Node 24, npm, and Windows x64 for the bundled local database
runner. Other platforms can use an explicitly configured disposable Neon
test branch. No Docker daemon is required for the Windows path.

```powershell
cd 'C:\Users\KIAN FLORENDO\gdgbingo\spikes\phase1'
npm.cmd ci
npm.cmd test
npm.cmd run check
npm.cmd run test:database
npm.cmd run build
npm.cmd run verify:build
npm.cmd audit
```

All package versions are recorded in `package-lock.json`. Local auth/API tests
use the actual generic Neon SDK with simulated upstream HTTP responses.
They do not contact Neon or exercise a real OAuth account.

The database command starts a real PostgreSQL 18.4 process bound to loopback,
uses a fresh local data directory and isolated schema, and stops the process
in `finally`. The ignored `.local-postgres/` data remains for inspection; no
existing database or user tables are deleted. The schema is deliberately
smaller than the production ERD and is not a production migration.

The optional native package supports Windows x64. Local builds must not
assume that binary is available on Vercel's Linux runtime. No request handler
imports the database harness or native binaries.

## What each experiment checks

| Issue | Local experiment | Still requires external verification |
|---|---|---|
| #8 | Astro Request/cookie adapter using `createAuthServer` from `@neondatabase/neon-js/auth/server`; fail-closed session endpoint and narrow same-origin auth proxy | Real project, production OAuth, callback/session-challenge handling, sign-out/revocation, session refresh, guest/shared-network entry |
| #9 | Drizzle transactions against real local Postgres: code contention, duplicate/changed retries, rollback, closure ordering, unrelated concurrency | Neon Pool/Drizzle path, exact schema, deadline policy, bounded retries, real unknown-COMMIT fault injection |
| #10 | Prerendered Astro shell + React island, dynamic API endpoints, private/public header policies, Vercel Node 24 artifact | Deployed HTTP/cache behaviour, two-user cookie isolation, production runtime and region |
| #11 | Dated published quotas and request arithmetic in `results.md` | Actual account eligibility, remaining usage, measured resource consumption |

## Continue with Neon safely

1. Use a Neon Free project and a disposable test branch/database, never production.
2. Enable Auth in the Neon console; copy its base URL into a local `.env`
   created from `.env.example`. Generate a random cookie secret of at least
   32 characters. Do not put credentials in chat, docs, or Git.
3. Choose/configure the approved OAuth provider with organiser-owned credentials.
   Configure trusted origins and callback URLs from the actual Neon configuration.
   Do not assume Microsoft sign-in from the fact that conversation uses Teams.
4. For the external database run, set `SPIKE_DATABASE_URL` to the test branch's
   pooled URL and `SPIKE_ALLOW_EXTERNAL_DATABASE=yes` in that local file. The
   command creates a uniquely named schema and retains it for inspection;
   it does not run production migrations or delete schemas. It uses the Neon
   WebSocket Pool and `drizzle-orm/neon-serverless` on this path.
5. Re-run `npm.cmd run test:database` and record the actual driver/version and
   outcome. A local Postgres pass is not a Neon Pool pass.

The session probe provides Google sign-in, session checks, sign-out, and an
SDK-backed callback challenge exchange. These are candidates for live browser
verification, not a completed production login flow.
Never enable participation or host authority based on a browser assertion.

To inspect the spike interactively, run `npm.cmd run dev` in your own terminal.
The script loads the ignored local `.env`. The agent does not leave a dev
server running. Verify the full cookie/redirect flow on HTTPS before using it
with participants; localhost behaviour alone is insufficient.

## Vercel rehearsal configuration

No deployment has been created by this spike. When preview deployment is
authorised and Hobby eligibility is resolved:

- Set the Vercel project root directory to `spikes/phase1` for this isolated
  preview, framework Astro, build `npm run build`, runtime Node 24.x.
- Set only the test Neon auth variables in Preview; never share a production
  database with this experiment. Do not put server secrets in `PUBLIC_` variables.
- Verify `/` is served as a static artifact and `/api/session` is private/no-store.
- Request `/api/public-status` repeatedly from the same location and record
  `x-vercel-cache`, `Age`, cache-control headers, and timestamps. Test both
  anonymous requests and requests carrying cookies. Header configuration alone
  does not prove a CDN hit.
- Test two real sessions independently; no shared cached private data or cookies.
- Do not merge or deploy this spike as the production game. The production
  project root and migration process will be established during Phase 2.
- No hosted load test without required provider authorisation; no paid upgrade.

## Dependency findings

The initial adapter dependency graph pulled `path-to-regexp@6.1.0`, which
triggered GHSA-9wv6-86v2-598j. A scoped override pins only
`@vercel/routing-utils`'s copy to 6.3.0; the Astro adapter itself is not
downgraded. Audit and build must pass together after changes.

The current Neon SDK is beta and emits Better Auth peer-resolution warnings.
Local checks do not establish compatibility for every OAuth/session path.
Resolve those paths in the live spike before selecting a production lockfile.

## Evidence

See [results.md](results.md). Local successes are partial evidence; keep
issues open until their full acceptance criteria and document-lock gates pass.
