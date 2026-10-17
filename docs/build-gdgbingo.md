---
spine_type: BUILD
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

# Build Guide: GDG Bingo

**IDEA:** [idea-gdgbingo.md](idea-gdgbingo.md)
**PRD:** [prd-gdgbingo.md](prd-gdgbingo.md)
**SDD:** [sdd-gdgbingo.md](sdd-gdgbingo.md)

---

## 1. How to build from these docs

Read in this order before writing code:

1. `docs/index.md`
2. `IDEA` — scope, and especially §4 Out of Scope and §4.1 invariants
3. `PRD` — the feature you are implementing, by ID
4. `SDD` — how it fits the system; §3 ERD is the schema contract
5. The `RFC` for that feature, if one exists
6. This guide
7. `QAD` — before calling anything done

**Default: build against `Locked` docs.** On 2026-10-18 the owner explicitly
authorised full phased development against the Draft specifications. Continue
within that authorisation without requesting it again. Document locks and
launch acceptance remain separate gates. Each issue names its feature and
invariant scope.

### To build X, read Y

| To implement… | Read | Verify against |
|---------------|------|----------------|
| A feature `PRD-F#` | PRD → SDD → RFC if one exists | QAD cases tagged with that ID |
| A schema change | SDD §3 ERD first (CR if Locked), then the migration | Migration applies cleanly; ERD and schema file agree |
| An API endpoint | SDD §4 | QAD sad and abuse cases |
| A UI surface | PRD + PRD-F13 criteria | QAD happy path and accessibility cases |

---

## 2. Pinned stack

The root package and lockfile now pin the application dependencies. The
original isolated package remains in `spikes/phase1/`. Current commands and
evidence are in the root README and `docs/development-status.md`. Hosted
runtime, quotas and launch acceptance remain unverified.

| Layer | Technology | Version | Verified | Source |
|-------|-----------|---------|----------|--------|
| Runtime | Node.js | 24.8.0 local; 24.x Vercel artifact | local build only; hosted runtime pending | https://vercel.com/docs/functions/runtimes/node-js |
| Language | TypeScript | 5.9.3 spike candidate | Astro check passed locally | https://www.npmjs.com/package/typescript |
| Framework | Astro | 7.4.0 candidate | isolated local build passed | https://docs.astro.build/ |
| UI | React via `@astrojs/react` | 19.3.1 / 7.1.0 | root island built; five mocked-HTTP Chromium cases passed | https://docs.astro.build/en/guides/integrations-guide/react/ |
| Adapter | `@astrojs/vercel` | 11.0.15 candidate | Node 24 artifact inspected; deployed cache pending | https://docs.astro.build/en/guides/integrations-guide/vercel/ |
| Styling | Tailwind CSS | 4.3.3 | root build and phone browser-island checks passed | https://tailwindcss.com/docs |
| ORM | Drizzle ORM / Drizzle Kit | 0.45.4 / 0.31.11 | full-schema local tests and actual development migrations/join passed | https://orm.drizzle.team/ |
| DB driver | `@neondatabase/serverless` | 1.2.0 candidate | 8 bounded Neon Pool transaction checks passed; capacity pending | https://neon.com/docs/serverless/serverless-driver |
| Auth | Neon JS 0.8.0-beta, generic server adapter | isolated spike lockfile | 11 local auth/API checks; user-reported localhost OAuth lifecycle passed; hosted verification pending | https://neon.com/docs/auth/overview |
| Unit/integration tests | Node test runner | Node 24 | 38 checks passed; wider QAD cases remain | https://nodejs.org/api/test.html |
| Browser tests | Playwright | 1.64.1 | five browser-island checks passed with mocked HTTP | https://playwright.dev/ |
| Load tests | k6 | TBD at Phase 5 | unverified | https://grafana.com/docs/k6/latest/ |

The spike deliberately pins TypeScript 5.9.3 and passes Astro checking; it does
not establish TypeScript 7 compatibility. Current checks use Node test,
Playwright and a compressed local service/database workload. Full HTTP/Auth
capacity and QAD acceptance remain separate; k6 is a future hosted-test candidate.

See [spike results](../spikes/phase1/results.md) for exact checks, dependency
override, beta-peer warnings, and remaining limitations; see
[setup](../spikes/phase1/SETUP.md) to configure the live test services.

### Known deprecations

| Deprecated | Use instead | Since | Notes |
|-----------|-------------|-------|-------|
| Neon Auth Next.js helpers in an Astro app | Neon Auth browser SDK + server-side session validation | n/a | Not an Astro integration (architecture.md) |
| `@astrojs/vercel/serverless` import path | `@astrojs/vercel` | adapter v8 | Verify at scaffold |

---

## 3. Commands

Current root commands are recorded in `package.json`; migrations are explicit.

| Task | Command |
|------|---------|
| Install | `npm ci` |
| Dev | `npm run dev` |
| Build | `npm run build` |
| Test | `npm test` |
| E2E | `npm run test:e2e` |
| Dependency audit | `npm audit` |
| Typecheck | `npm run typecheck` (`astro check`) |
| Local workload | `npm run test:load:local` |
| Artifact check | `npm run verify:build` |
| Migrations | `npm run db:generate`, `npm run db:migrate` |
| Docs | `python $SPINE_HOME/scripts/check.py docs/` |

Long-running commands (dev servers, watchers) must be run by the owner in their
own terminal, not by an agent in a blocking shell call.

### 3.1 Private SPINE validation and evidence

SPINE 0.3.0 is private. Contributors without access may use `docs/` directly
under the explicit exception in `AGENTS.md`. Do not replace the canonical
validator with an invented equivalent or describe manual checks as a SPINE pass.

Access check on 2026-10-18: `SPINE_HOME` unset, neither documented home-directory
fallback present, and the authenticated GitHub request for
`repos/slvdrvncntjvr/spine/git/ref/tags/v0.3.0` returned HTTP 404. This establishes
that the current login cannot resolve the pinned ref; it does not establish
whether the private repository or tag is missing. Validator not run locally.

To satisfy the lock gate without exposing private engine contents:

1. An authorised maintainer resolves tag `v0.3.0`, records its immutable engine
   commit, and uses the canonical checker from that revision.
2. Validate the exact candidate project commit with
   `python <engine-root>/scripts/check.py docs/ --strict`.
3. Attach redacted output, exit code, project commit, engine commit/tag, Python
   version, and date to the lock review. Grant collaborator access separately
   if local reproducibility is required; never commit tokens or private engine
   source into this repository.
4. Re-run after subsequent document changes; a pass for an older revision is
   historical evidence only. Checkpoint verification is a separate command
   required only when checkpoints exist.

A maintainer-run report is the proposed access route, not a completed check.
Until the owner accepts that route and the report exists, index validation
stays pending and the affected document locks remain blocked. Manual link/ID
checks may support review but do not substitute for SPINE validation.

### 3.2 Pre-development gate

- Resolve and record Q1–Q7 / issues #1–#7 with explicit owner answers.
- Complete issues #8–#11 as bounded integration spikes: Astro/Neon Auth,
  PostgreSQL locking/retry recovery, Vercel static/private/CDN behaviour, and
  dated quotas/eligibility. Store reproducible results, not documentation claims.
- Keep spike code separate from production application scaffolding; spikes
  may evaluate Draft designs without representing those designs as Locked.
- Propagate approved decisions and spike findings through IDEA → PRD → SDD →
  RFC → QAD/OPS/BUILD and update INDEX. Obtain the private validator evidence.
- Issue #12 locks only reviewed, decision-complete documents. Keep LOG as a
  living record. Product tests and 350-player capacity remain future release
  gates even when design documents are Locked.
- Issue #12 also requires the first checkpoint. An authorised SPINE maintainer
  must create it following the pinned engine's instructions and record a clean
  `python <engine-root>/scripts/checkpoint.py verify` result against the committed
  candidate. No checkpoint has been created by this documentation pass.
- The owner has now authorised application development while these gates remain
  open. They remain requirements for document locks and launch acceptance, not
  a reason to repeat implementation approval. Documentation corrections alone
  never imply issue closure or a production deployment.

---

## 4. Repo conventions

| Area | Convention |
|------|-----------|
| Branch policy | `main` is release (production deploys); `dev` is integration. Work on `feat/<issue>-<slug>` or `fix/<issue>-<slug>` off `dev`, PR into `dev`; promote `dev` → `main` by PR |
| Commit format | Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`), referencing the issue (`#12`) |
| Directory layout | `src/pages/` routes and `src/pages/api/` endpoints; `src/components/` React islands; `src/layouts/`; `src/server/` server-only modules; `drizzle/` migrations; `tests/`; `scripts/` |
| Naming | kebab-case files, PascalCase components, camelCase functions, snake_case database columns |
| Error handling | Server modules throw typed domain errors; API routes map them to status + stable `code`; no raw error messages to clients |
| Test location | `tests/unit`, `tests/integration`, `tests/e2e`, `tests/load` |

---

## 5. Guardrails

- Never commit secrets. Secrets live in Vercel project environment variables and a local `.env` that is gitignored; `.env.example` lists names only.
- Never import `src/server/` from client components; never prefix a secret env var with `PUBLIC_`.
- Never prerender a page that reads session, codes, or host data.
- **INV-1:** claims commit only through `src/server/game/claim.ts` (RFC 001), backed by `UNIQUE (code_id)`.
- **INV-2:** claim insert and code spend happen in one transaction. Only event-scoped retention may clear the reference while deleting both claims and codes atomically; it cannot expose unspent codes.
- **INV-3:** code lookup uses keyed digests, private redisplay uses encrypted ciphertext, and invitations use digests; no plaintext tokens stored; the logger redacts token fields; board DTOs are built from an allowlist.
- **INV-4:** identity comes from the session, time from SQL `now()`, scores from the game module; request bodies never carry them.
- **INV-5:** joins go through `src/server/game/join.ts` with `UNIQUE (event_id, auth_user_id)`.
- **INV-6:** every private route calls `requireParticipation` or `requireHost` before doing work.
- **INV-7:** no dependency or provider that bills; adding any external service needs an owner decision in `LOG`.

---

## 6. Definition of done

- [ ] Implements a `Locked` requirement, by ID
- [ ] Build passes: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] Lint and typecheck clean
- [ ] QAD cases for the feature ID pass
- [ ] Docs updated if behavior changed; `INDEX` row bumped
