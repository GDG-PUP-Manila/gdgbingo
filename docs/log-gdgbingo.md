---
spine_type: LOG
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

# Session Log: GDG Bingo

---

## 1. Decisions

| Date | Decision | Rationale | Docs touched |
|------|----------|-----------|--------------|
| 2026-10-18 | Work is tracked as GitHub issues in GDG-PUP-Manila/gdgbingo, one milestone per plan phase, each issue citing PRD-F# / INV-# | Owner asked for tasks as GitHub issues | index.md |
| 2026-10-18 | Tier 3 SPINE suite, slug `gdgbingo` | 300+ users, deployed, other people depend on it on event day | all |
| 2026-10-18 | Docs derived from owner drafts architecture.md and plansv1.md; drafts kept at repo root as source material | Owner-written intent; this suite supersedes them where they differ | all |
| 2026-10-18 | Stack: Astro + TypeScript, React islands, Tailwind, Drizzle, Neon PostgreSQL/Auth, Vercel only | Selected in architecture.md | SDD, BUILD |
| 2026-10-18 | Test stack: Vitest, Playwright, k6 | Agent choice; architecture.md left the load tool open | QAD, BUILD |
| 2026-10-18 | Claim redemption designed in RFC 001 with event-row FOR SHARE / FOR UPDATE coordination | Needed a precise closure ordering | RFC, SDD |

## 2. Open questions

| ID | Raised | Question | Blocking | Status |
|----|--------|----------|----------|--------|
| Q1 | 2026-10-18 | Confirm INV-1 to INV-7 as transcribed from the drafts | IDEA lock | Open |
| Q2 | 2026-10-18 | Six codes per participant and one accepted confirmation per other participant? | PRD-F3, PRD-F4 | Open |
| Q3 | 2026-10-18 | Sign-in method (which OAuth provider via Neon Auth), invitation distribution channel, and account recovery | PRD-F1 | Open |
| Q4 | 2026-10-18 | Event date and peak attendance | OPS, Phase 5 | Open |
| Q5 | 2026-10-18 | Vercel Hobby eligibility for this account and event | Deploy | Open |
| Q6 | 2026-10-18 | Square set, round duration, prize tiers, tie policy | PRD-F2, PRD-F8 | Open |
| Q7 | 2026-10-18 | Public display-name visibility, consent wording, data retention period | PRD-F7, PRD-F10, SDD §3.2 | Open |

## 3. Resolved questions

| ID | Resolved | Question | Answer |
|----|----------|----------|--------|
| — | | | |

## 4. Dead ends

| Date | Approach | Why it failed |
|------|----------|---------------|
| — | | |

## 5. Recoveries

| Date | Checkpoint | What went wrong | Resolution | Docs restored |
|------|------------|-----------------|------------|---------------|
| — | | | | |
