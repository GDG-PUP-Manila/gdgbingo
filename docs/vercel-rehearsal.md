# Vercel rehearsal handoff

The local two-account rehearsal is user-confirmed. This deployment remains a
development rehearsal; production OAuth audience, eligibility, quota headroom
and hosted capacity still require verification. No push or deployment has been
performed by the agent.

## Publish the reviewed source

The base application was pushed as `9ef5f72` on `feat/8-phase1-spikes` and
deployed as a Vercel Preview. The approved UI, event-link interaction and
development React cache fix are included in the owner's requested local UI
commit. Push that same branch yourself to publish the changes. Importing the old `main`
does not include this application. Follow the repository's PR-to-`dev` policy;
do not merge to `main` just to make a rehearsal available.

Suggested commit message:

```text
feat: apply approved GDG Bingo UI and fix development hydration
```

Never stage `.env`, `.private/`, `test-results/`, generated artifacts or
`node_modules/`; they are ignored. Include `package-lock.json` and the reviewed
`drizzle/` migrations.

## Configure the rehearsal project

| Setting | Value |
|---|---|
| Plan | Existing eligible Hobby account |
| Source | Reviewed application branch, not old main |
| Framework | Astro |
| Root directory | Repository root; not `spikes/phase1` |
| Install | `npm ci` |
| Build | `npm run build` |
| Output directory | Framework default |
| Node | 24.x |
| Function region | Singapore (`sin1`), configured in `vercel.json` |

Use the existing **development** Neon branch for this rehearsal. Add these
server environment variables to the Vercel environment you will deploy:

```text
DATABASE_URL
NEON_AUTH_BASE_URL
NEON_AUTH_COOKIE_SECRET
CODE_DIGEST_KEY
CODE_ENCRYPTION_KEY
```

Copy values privately from the ignored root `.env`; never paste them into
chat. Keep both code keys identical to the existing development environment:
changing them invalidates lookup/redisplay of previously issued invitations
and codes. Never prefix them with `PUBLIC_`. Google client credentials remain
configured in Neon and are not application runtime variables.

Builds do not migrate or seed a database. The development database already has
the application migrations. Deployment must not run production migrations.

## Authorise the HTTPS origin

After Vercel assigns a URL, add that exact HTTPS origin to the development
Neon Auth trusted domains. Use a stable project/branch alias so the allowed
origin does not change for every deployment. The Google provider redirect
remains the development Neon Auth URL plus `/callback/google`; the app's
post-login destination is its own `/auth/callback`.

If deployment protection shows a Vercel login screen, account for it before
testing attendee access or CDN caching. Google Testing mode still permits
only the configured test accounts; it is not ready for 300 attendees.

## Hosted checks

1. Sign in with each test account in separate browser profiles. Verify refresh,
   sign-out and private-state isolation. The ordinary account must receive
   `403` from host endpoints, not merely see hidden controls.
2. Verify `/api/session`, own state and host responses use private/no-store and
   never return another account's codes. Never copy cookies into shared logs.
3. Request the public board repeatedly from the same location and inspect
   `x-vercel-cache`/`Age` and cache headers. Test requests with and without
   cookies; successful cache headers alone are not evidence of cache hits.
4. The original rehearsal may already be closed. Create a fresh synthetic
   development event using the documented seed command for another full round;
   never reset a live event or reuse spent codes. Rehearse exchange, claim,
   close, reveal, consent and export over HTTPS.
5. Record actual region, cold wake-up behaviour, Vercel/Neon usage before and
   after, and remaining free allowances. No hosted load burst until required
   provider authorisation exists. Local baseline results do not prove hosted
   capacity or quota fit.

Report the deployed URL and redacted outcomes to continue verification.

## Before distributing the tester link

- Publish the latest local recovery/privacy fixes and confirm Vercel builds
  that source revision. The local audit evidence is in
  [development-status.md](development-status.md#pre-tester-audit-after-successful-hosted-sign-in).
- Use the trusted stable branch origin:
  `https://gdgbingo-git-feat-8-phase1-spikes-gdgpupmnls-projects.vercel.app`.
  The earlier per-deployment URL failed the Neon callback-origin check.
- Add each tester's Google account to the OAuth Testing audience and confirm
  they can access the preview without organiser-only Vercel protection.
- Create a fresh development rehearsal with the existing validated test host;
  event `28b13ac3-b8a8-45db-abfa-6f05914c8f8f` is closed. Follow the seed
  instructions in README; never restart it by editing database status.
- Share the new event URL plus a separate unused invitation per tester.
  Keep the invitation manifest private. Start the round only after they join.
- Recheck claim exchange, spent-code rejection, refresh, consent withdrawal,
  host close/reveal/export, and ordinary-player host denial on the deployed
  revision. Record results before expanding the tester group.

These steps prepare controlled testing. Final host assignment, production
audience access and hosted capacity/headroom checks still precede event launch.
