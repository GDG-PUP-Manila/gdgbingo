# GDG Bingo

Networking bingo for Teams events. Astro/React on Vercel; Neon Auth and
PostgreSQL; Drizzle migrations. Players exchange codes manually through Teams
DMs. The website does not send or read Teams messages.

Application development is in progress. The application implements invitation
joins, saved cards, two private outgoing codes, claims, scoring, board, host
controls, reveal and exports. Hosted acceptance and event readiness are pending.
See [development status](docs/development-status.md) and [specifications](docs/index.md).
The isolated integration spike stays in `spikes/phase1`.

The UI follows the owner-approved light GDG direction based on
[GDG DP Blast](https://frame.gdgpup.org/). The landing page accepts an organiser's
event link; player cards, private outgoing codes, board and host controls share
the same responsive layout. Logo assets and the Outfit font are served locally.
Reference-inspired animation includes floating shapes, fade-up entrances and
hover effects. Operating-system reduced-motion preferences are respected
automatically.

## Local development

Node 24 and npm 11 are the tested development tools. `.nvmrc` selects the Node
24 line for compatible version managers; npm rejects other Node majors before
installing dependencies or running scripts. With nvm-windows, the locally tested
version can be installed and selected explicitly:

```powershell
nvm install 24.8.0
nvm use 24.8.0
node --version
```

Then, from the repository root:

```powershell
npm.cmd ci
# Optional: create the ignored root environment from your existing development
# spike. This never overwrites an existing .env or changes a database.
npm.cmd run setup:local
npm.cmd run dev
```

Otherwise copy `.env.example` to `.env` and configure it privately. Use the
development Neon branch. Auth uses the same development Google provider and
trusted localhost origin as the spike. Keep all environment variables
server-only. Never copy `.env`, session cookies or private manifests into chat.

`CODE_DIGEST_KEY` and `CODE_ENCRYPTION_KEY` must be different 32-byte hex values.
Keep them stable for the lifetime of issued invitations/codes; changing either
can invalidate outstanding tokens. Tokens have 128 bits of randomness; lookup
uses purpose-separated HMAC; redisplay uses AES-256-GCM bound to event, owner and
code ID. Only the authenticated owner's private response contains plaintext.

## Checks

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run verify:build
npm.cmd run test:e2e
npm.cmd run test:load:local
npm.cmd audit
```

The current foundation tests use Node's test runner and a real temporary local
PostgreSQL 18 database on Windows x64. They never read `DATABASE_URL`, connect to
Neon, or delete an existing database. Local data directories remain ignored for
inspection; the runner stops PostgreSQL when finished. Playwright browser-island
checks use mocked HTTP and require a prior build and an installed Chromium
(`npx.cmd playwright install chromium`). The local 350-player workload measures
service/database calls only. These checks do not establish Vercel capacity or
all QAD cases passing.

## Schema and synthetic event

Generate SQL offline with `npm.cmd run db:generate`, then review files in
`drizzle/`. Builds never migrate a database. Applying a migration is explicit:

```powershell
npm.cmd run db:migrate -- --environment=development
npm.cmd run seed -- --development-only --host-user-id=YOUR_VALIDATED_AUTH_USER_ID
```

These commands change your configured development database. Seeding creates
a new synthetic event, provisional 24-square set, host assignment and one
shared event invitation in a private ignored `.private/` manifest. Everyone
can use that invitation with their own Google account; each receives their
own card and two single-use gameplay codes. Add `--individual-invitations`
to seed to retain the older 350 single-use invitation mode. It does not create real
attendees or delete data. A `prepared` manifest is not evidence of a committed
seed; inspect the event before distributing it. Event creation and reviewed
production migrations are separate release steps. Event-data retention is
30 days after the round ends by the approved development default. Organisers
run `npm.cmd run retention -- --event-id=EVENT_UUID` for an eligibility dry run;
add `--apply` only after reviewing that event. It rejects rounds that ended
fewer than 30 days ago. No automatic scheduled purge is deployed.

For an existing draft/open development event, create a shared invitation after
applying migration `0002_shared_event_invitation.sql`:

```powershell
node --env-file-if-exists=.env scripts/shared-invitation.mjs --development-only --event-id=EVENT_UUID
```

The shared invitation is saved in `.private/shared-invitation-EVENT_UUID.json`,
not printed or placed in a public response. To make one attendee link, append
the value as a fragment to the event URL:
`https://gdgbingo.vercel.app/events/EVENT_UUID#invite=SHARED_INVITATION`.
The browser removes the fragment immediately and keeps it through sign-in; URL
fragments are not sent to the server. Treat the full link as the event's access
link and share it only with attendees. Existing individual invitations remain
valid; a shared invitation does not grant host access or affect the two
single-use gameplay codes. Expired invitations and closed rounds reject new
joins. Deploy the updated server and apply migration 0002 before distributing
the shared invitation; older servers understand only single-use redemption.
For a live event, first apply the reviewed migration to the production database,
then configure `DATABASE_URL` and `DATABASE_ENVIRONMENT=production` for that
database and run the same helper with `--production` instead of
`--development-only`. This writes a private local manifest; keep it out of Git
and share its invitation only with attendees. The helper will not create events
or host assignments; provision and verify those separately.

## Deployment

Use the **repository root** for the application Vercel project; the existing
`spikes/phase1` root is only for the separate integration rehearsal. Framework:
Astro; install: `npm ci`; build: `npm run build`; Node: 24.x. `vercel.json`
selects Singapore (`sin1`) near the development database. Leave the output
directory on its framework default. Configure the names in `.env.example` in
the intended Vercel environment and add its exact HTTPS origin to Neon Auth.
Google credentials remain configured in Neon; they are not runtime variables
for this app.

The existing public site is [gdgbingo.vercel.app](https://gdgbingo.vercel.app/).
Use `main` for production and `dev` for ongoing work. In the existing Vercel
project, set **Settings → Environments → Production → Branch Tracking** to
`main`; pushes to `dev` should create previews. The connected Git repository,
production branch and exact deployed commit still need verification by someone
with access to the hosting team. Do not create a replacement project to work
around missing team access. `engines.node` selects Node 24.x for Vercel builds
and functions.

Configure the five runtime secrets from `.env.example` in Vercel's Production
environment. Use the intended production database and matching Auth branch;
preserve the original code digest/encryption keys for any existing invitations
and codes. `DATABASE_ENVIRONMENT` is a tooling guard for explicit migrations.
The spike's `SPIKE_DATABASE_URL` is not the application's `DATABASE_URL`.

This release does not apply production migrations. After deployment, verify
Google sign-in, player join/card/claim, host start/close/export, and anonymous
private-route rejection on the production origin. The local 350-player database
baseline passed; hosted capacity is unverified.
A Hobby account alone does not establish event eligibility or
remaining quota. Resolve the [launch checks](docs/ops-gdgbingo.md) and production
OAuth audience access before inviting attendees.
