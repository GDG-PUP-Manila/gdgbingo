---
spine_type: BUILD
spine_version: 0.3.0
project: GDG Bingo
slug: gdgbingo
doc_version: 0.1
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

**Only build against `Locked` docs.** If the doc you need is `Draft`, ask before
proceeding. Each GitHub issue names the `PRD-F#` / `INV-#` it implements.

### To build X, read Y

| To implement… | Read | Verify against |
|---------------|------|----------------|
| A feature `PRD-F#` | PRD → SDD → RFC if one exists | QAD cases tagged with that ID |
| A schema change | SDD §3 ERD first (CR if Locked), then the migration | Migration applies cleanly; ERD and schema file agree |
| An API endpoint | SDD §4 | QAD sad and abuse cases |
| A UI surface | PRD + PRD-F13 criteria | QAD happy path and accessibility cases |

---

## 2. Pinned stack

No `package.json` exists yet. Versions below are the npm registry `latest` on
2026-10-18 and are candidates only; the scaffold issue pins exact versions from
the lockfile and updates this table.

| Layer | Technology | Version | Verified | Source |
|-------|-----------|---------|----------|--------|
| Runtime | Node.js | 22.21.1 (local); Vercel runtime TBD at scaffold | unverified | https://vercel.com/docs/functions/runtimes/node-js |
| Language | TypeScript | 7.0.2 candidate | unverified | https://www.npmjs.com/package/typescript |
| Framework | Astro | 7.4.0 candidate | unverified | https://docs.astro.build/ |
| UI | React via `@astrojs/react` | 19.3.1 / 7.1.0 candidate | unverified | https://docs.astro.build/en/guides/integrations-guide/react/ |
| Adapter | `@astrojs/vercel` | 11.0.15 candidate | unverified | https://docs.astro.build/en/guides/integrations-guide/vercel/ |
| Styling | Tailwind CSS | 4.3.3 candidate | unverified | https://tailwindcss.com/docs |
| ORM | Drizzle ORM / Drizzle Kit | 0.45.4 / 0.31.11 candidate | unverified | https://orm.drizzle.team/ |
| DB driver | `@neondatabase/serverless` | 1.2.0 candidate | unverified | https://neon.com/docs/serverless/serverless-driver |
| Auth | Neon Auth | TBD at Phase 1 spike | unverified | https://neon.com/docs/auth/overview |
| Unit/integration tests | Vitest | 5.0.5 candidate | unverified | https://vitest.dev/ |
| Browser tests | Playwright | 1.64.1 candidate | unverified | https://playwright.dev/ |
| Load tests | k6 | TBD at Phase 5 | unverified | https://grafana.com/docs/k6/latest/ |

TypeScript 7 is the native-compiler release; confirm Astro's type tooling
supports it at scaffold time, else pin the newest 5.x.

### Known deprecations

| Deprecated | Use instead | Since | Notes |
|-----------|-------------|-------|-------|
| Neon Auth Next.js helpers in an Astro app | Neon Auth browser SDK + server-side session validation | n/a | Not an Astro integration (architecture.md) |
| `@astrojs/vercel/serverless` import path | `@astrojs/vercel` | adapter v8 | Verify at scaffold |

---

## 3. Commands

Planned; will be copied from `package.json` once the scaffold lands.

| Task | Command |
|------|---------|
| Install | `npm ci` |
| Dev | `npm run dev` |
| Build | `npm run build` |
| Test | `npm test` |
| E2E | `npm run test:e2e` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` (`astro check`) |
| Migrations | `npm run db:generate`, `npm run db:migrate` |
| Docs | `python $SPINE_HOME/scripts/check.py docs/` |

Long-running commands (dev servers, watchers) must be run by the owner in their
own terminal, not by an agent in a blocking shell call.

---

## 4. Repo conventions

| Area | Convention |
|------|-----------|
| Branch policy | `main` is protected; work on `feat/<issue>-<slug>` or `fix/<issue>-<slug>`; merge by PR |
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
- **INV-2:** claim insert and code spend happen in one transaction; no other code path writes `code.redeemed_claim_id`.
- **INV-3:** only digests of codes and invitations are stored; the logger redacts token fields; board DTOs are built from an allowlist.
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
