---
spine_type: OPS
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

# Ops & Observability: GDG Bingo

**SDD:** [sdd-gdgbingo.md](sdd-gdgbingo.md)

The existing public site is https://gdgbingo.vercel.app/ (HTTP 200 observed
2026-10-18). Its exact deployed commit, production environment configuration
and Git branch tracking remain unverified: the current Vercel CLI account
cannot access the hosting team. Local checks and the earlier two-account
rehearsal do not establish production capacity or complete this runbook.

---

## 1. Environments

| Environment | URL | Branch | Deploy trigger | Owner |
|-------------|-----|--------|----------------|-------|
| Production | `https://gdgbingo.vercel.app/` | `main` intended; verify Vercel setting | Vercel Git integration; production tracking and eligibility still need confirmation | slvdrvncntjvr |
| Preview | Vercel preview URLs | PR branches | Vercel Git integration | slvdrvncntjvr |
| Local | `http://localhost:4321` | any | `npm run dev` | developer |

Production and preview/test use separate Neon branches or databases.

## 2. Deploy

Promote `dev` to `main` through a pull request. In the existing Vercel project's
Settings → Environments → Production → Branch Tracking, select `main`.
Use the repository root, Astro, `npm ci` and `npm run build`; root
`engines.node` selects Node 24.x for builds and functions. Confirm the existing
production secrets in §3, preserving code keys for already-issued tokens and
using the matching production database/Auth branch. Preview/test credentials
remain scoped separately. The production origin must be trusted in Neon Auth.
These account settings require a maintainer with hosting-team access; changing
GitHub branches alone does not verify a new production deployment.

Configuration reference (2026-10-18): [Vercel Git deployment settings](https://vercel.com/docs/git).

| Step | Command | Notes |
|------|---------|-------|
| Verify docs and tests | `npm test && python $SPINE_HOME/scripts/check.py docs/` | Must pass |
| Apply migrations | `npm run db:migrate -- --environment=production --reviewed-production-migration` with matching environment and production URL | Manual, reviewed, never in build |
| Deploy | Merge to `main` | Vercel builds and deploys |
| Smoke check | `GET /api/events/:eventId/board` and sign-in flow | Also wakes the database |

**Rollback:** promote the previous deployment in the Vercel dashboard (Instant Rollback) — last verified: never (TBD before event).

## 3. Configuration and secrets

| Name | Purpose | Store | Required |
|------|---------|-------|----------|
| `DATABASE_URL` | Pooled Neon connection | Vercel env / local `.env` | yes |
| `DATABASE_ENVIRONMENT` | Migration/seed guard: development or production | Local `.env` / migration shell | tooling only |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` | Branch Auth URL and private signing secret | Vercel env / local `.env` | yes |
| `CODE_DIGEST_KEY` | HMAC key for code and invitation digests | Vercel env | yes |
| `CODE_ENCRYPTION_KEY` | Encrypts code redisplay values | Vercel env | yes |
| `--host-user-id` | Explicit synthetic-seed host ID | Local seed command, never browser role input | seed only |

Values are never recorded in this document or any other doc in `docs/`.

## 4. Monitoring

Free-tier only; no paid observability.

| Signal | Source | Threshold | Alert |
|--------|--------|-----------|-------|
| 5xx rate | Vercel runtime logs | > 1 % over 5 min during event | Host watches dashboard |
| Function invocations remaining | Vercel usage page | < 50,000 before event | Pre-event checklist |
| Neon CU-hours remaining | Neon console | < 20 before event | Pre-event checklist |
| Claim p95 latency | Structured log timings | > 2 s | Host watches dashboard |

### 4.1 Logging

| Level | Used for | Destination | Retention |
|-------|----------|-------------|-----------|
| info | Request route, status, duration, error code | Vercel runtime logs | Hobby default |
| error | Unexpected exceptions without payloads | Vercel runtime logs | Hobby default |

Never log secrets, tokens, codes, invitations, or full request bodies (INV-3).

## 5. Runbooks

### High error rate

**Symptom:** players report failed claims; 5xx rate above 1 %.
**Likely cause:** database cold start, connection limits, or quota exhaustion.
**Diagnose:** Vercel runtime logs filtered by status ≥ 500; Neon console compute status.
**Fix:** announce a pause in Teams; wait for wake-up; if quota exhausted, close the round from committed data. Never award prizes from browser state.
**Escalate to:** slvdrvncntjvr

### Quota near exhaustion

**Symptom:** Vercel or Neon usage near the free limit.
**Likely cause:** rehearsals, runaway polling, other projects on the account.
**Diagnose:** Vercel usage page; Neon usage page.
**Fix:** stop rehearsals; confirm polling stops after closure; reduce scope or postpone. Do not upgrade (INV-7).
**Escalate to:** slvdrvncntjvr

### Slow claims

**Symptom:** claim p95 above 2 s.
**Likely cause:** lock contention, region mismatch, missing index.
**Diagnose:** log timings per route; Neon query stats.
**Fix:** check region pairing and indexes in SDD §3.3; extend round if needed.
**Escalate to:** slvdrvncntjvr

### Retention

Organisers run event-scoped cleanup 30 days after the round ends. First use
`npm run retention -- --event-id=EVENT_UUID` to verify eligibility without
deleting anything. After reviewing the selected event and export needs, add
`--apply`. It deletes only the expired event's private records; public square
definitions and other events remain. No automatic scheduled purge is deployed.

## 6. Backup and recovery

| What | Frequency | Location | Restore tested |
|------|-----------|----------|----------------|
| Event results | CSV export at close | Host's device | never (TBD) |
| Database | Neon point-in-time restore window (Free plan) | Neon | never (TBD) |

## 7. Production readiness gate

- [ ] Rollback tested within the last 7 days before the event
- [ ] Every alert in §4 has a runbook in §5
- [ ] Restore from backup tested
- [ ] No secrets in the repo or in `docs/`
- [ ] Every network-exposed endpoint has auth, or a documented exception (public board, SDD §5)
- [ ] Vercel Hobby eligibility recorded in LOG
- [ ] Dated free-tier usage snapshot recorded before and after the load test
- [ ] Production OAuth credentials configured; no reliance on the development email sender or OAuth test users
- [ ] Joining opens 15–30 minutes before the round; attendees asked to sign in early
