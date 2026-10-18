# Free account setup for Phase 1

Start here to enable the live integration checks. The local experiments already
run without accounts. These steps do not make the game event-ready and do not
authorise changing the repository visibility or subscribing to paid plans.

## 1. Create the Neon test project

1. Sign in at [Neon](https://console.neon.tech/) and choose **Free**, not a trial
   or usage-based plan. Name the project `gdgbingo`.
2. Select a supported region near the intended Vercel function region. Record
   both before the hosted test; a nearby region alone does not prove latency.
3. Create/select a disposable development/test branch and database. Keep real
   attendee data out of it. Production will use separate data during Phase 2.
4. Enable **Auth / Managed Better Auth** for that branch. Save its Auth base URL.
5. In **Connect**, select the branch/database and pooling. Copy the connection
   URL into the ignored local `.env` described below, not into chat or Git.

No cloud API key is needed for the current local runner. Actual project
creation, plan selection, and remaining usage are not verified by this guide.

## 2. Create the local environment file

Run these commands from PowerShell:

```powershell
cd 'C:\Users\KIAN FLORENDO\gdgbingo\spikes\phase1'
if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
```

Edit `.env` locally with these fields:

```dotenv
SPIKE_DATABASE_URL=<pooled URL of the disposable Neon test database>
SPIKE_ALLOW_EXTERNAL_DATABASE=yes
NEON_AUTH_BASE_URL=<Auth base URL from the same Neon test branch>
NEON_AUTH_COOKIE_SECRET=<random secret of at least 32 characters>
```

Generate a cookie secret locally if needed:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste that output only into the local file and the appropriate Vercel secret
field. The `.env` file is ignored. `.env.example` contains field names only.
For an external test the database URL must identify a disposable database:
the runner creates and retains a uniquely named schema for inspection.

Check the Neon Pool/Drizzle path:

```powershell
npm.cmd ci
npm.cmd run test:database
```

Success must identify **Neon Pool** in the result. A result identifying
**node-postgres local** did not test the hosted pool. A failed check is a
finding to resolve, not permission to change the budget or claim readiness.

## 3. Configure the approved OAuth provider

Google is the proposed default, still awaiting the owner's explicit decision.
Teams DM exchange does not select a login provider. If Google is approved:

1. Create/select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Configure the OAuth consent app with an app name, support contact, and an
   audience appropriate for the attendees. Use only necessary identity scopes.
3. Create a **Web application** OAuth client. In the Neon provider configuration
   dialog, copy the exact provider callback URL; it is based on the branch's
   Auth URL followed by `/callback/google`. Register that URL with Google.
4. Put the OAuth client ID and secret into the Neon provider settings. The
   Google client secret belongs in Neon, not in browser code or this repository.
5. Add the local/test application origins to Neon's trusted domains. Add the
   final Vercel origin after its URL exists. Follow the provider's origin settings.
6. Resolve production publishing/verification requirements before inviting the
   full audience. Test-user-only access is not a 300-attendee login solution.

The provider callback and the app's post-login destination are different URLs.
Use the callback shown by Neon, not a guessed Vercel `/api/auth/callback` URL.
See [Neon's OAuth setup](https://neon.com/docs/auth/guides/setup-oauth).

The spike now includes Google sign-in, session checks, sign-out, and an
SDK-backed callback challenge exchange. With your Google test user added:

```powershell
cd 'C:\Users\KIAN FLORENDO\gdgbingo\spikes\phase1'
npm.cmd run dev
```

Open `http://localhost:4321`, select **Sign in with Google**, and choose the
account on Google's test-user list. After returning, expect **Signed in:
browser and server session checks both succeeded.** Refresh and check the
session again, then sign out and confirm the session is unauthenticated.
Keep the terminal running during these checks. Report the page's status text
if anything fails; do not share environment files, cookies, or tokens.

Real browser verification, HTTPS deployment checks, sign-out/revocation,
session refresh, and account recovery remain required before production.

## 4. Prepare Vercel Hobby

1. Sign in at [Vercel](https://vercel.com/) using the GitHub identity that will
   own the deployment; remain on **Hobby**, without a Pro trial.
2. Confirm the actual event qualifies for Hobby's personal/non-commercial rules.
   A free event does not by itself establish this. Record the owner decision.
3. The repository was verified as **public** and organisation-owned on
   2026-10-18. Check GitHub App access and import permissions in the dashboard.
   Vercel documents restrictions for private organisation repositories and
   commit-author identity on Hobby. Do not change repo visibility or Git author
   details to work around a rejection.
4. For the eventual isolated preview, choose Astro, root **`spikes/phase1`**,
   install **`npm ci`**, build **`npm run build`**, and Node **24.x**.
   Let the Astro adapter generate the output; no custom static output directory.
5. Use only test Auth values in the preview's server environment:
   `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`. The local database
   experiment variables are not needed by the hosted session/cache probe.
6. Configure a stable authorised preview origin for the live auth test. Inspect
   deployment protection: a login interstitial affects both cache probes and
   attendee access. Confirm the intended access explicitly.

Current local changes are uncommitted and unpushed, so importing `main` now
will not include these experiments. Review and publish the spike branch only
when ready; this guide has not created a project or deployment. The production
game will have its own approved configuration after Phase 1.

Sources: [Hobby plan](https://vercel.com/docs/plans/hobby),
[Git deployment rules](https://vercel.com/docs/git#using-hobby-teams).

## 5. Evidence needed to finish Phase 1

- Neon Pool test output, with no connection strings or credentials.
- Real OAuth login and Astro server validation, session isolation, refresh,
  sign-out, and shared-network checks.
- Live Vercel public-cache/private-no-store behaviour and actual runtime/region.
- Dated free-plan selection, remaining quotas, and eligibility decision.
- Owner answers for rules, event details, privacy, and prizes.
- SPINE maintainer validation and the first checkpoint before document locks.

Tell the agent when the test projects and ignored local fields are configured.
Do not paste secrets into the conversation. No hosted load test or paid upgrade
is part of this setup.
