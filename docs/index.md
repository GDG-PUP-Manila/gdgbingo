---
spine_type: INDEX
spine_version: 0.3.0
project: GDG Bingo
slug: gdgbingo
doc_version: 0.3
status: Draft
owner: slvdrvncntjvr
created: 2026-10-18
updated: 2026-10-18
reconciled: 2026-10-18
---

# Documentation Index: GDG Bingo

**Project slug:** `gdgbingo`
**Tier:** 3 (Product)
**Maintained by:** slvdrvncntjvr
**Work tracking:** GitHub issues and milestones in GDG-PUP-Manila/gdgbingo

Built on SPINE 0.3.0

---

## 1. Document Suite

| Document | File | Version | Status | Updated | Reconciled |
|----------|------|---------|--------|---------|------------|
| IDEA · Idea Brief | [idea-gdgbingo.md](idea-gdgbingo.md) | 0.2 | Draft | 2026-10-18 | 2026-10-18 |
| PRD · Product Requirements | [prd-gdgbingo.md](prd-gdgbingo.md) | 0.2 | Draft | 2026-10-18 | 2026-10-18 |
| SDD · System Design | [sdd-gdgbingo.md](sdd-gdgbingo.md) | 0.2 | Draft | 2026-10-18 | 2026-10-18 |
| QAD · QA & Test Plan | [qad-gdgbingo.md](qad-gdgbingo.md) | 0.2 | Draft | 2026-10-18 | 2026-10-18 |
| OPS · Ops & Observability | [ops-gdgbingo.md](ops-gdgbingo.md) | 0.1 | Draft | 2026-10-18 | 2026-10-18 |
| BUILD · Build Guide | [build-gdgbingo.md](build-gdgbingo.md) | 0.2 | Draft | 2026-10-18 | 2026-10-18 |
| LOG · Session Log | [log-gdgbingo.md](log-gdgbingo.md) | 0.3 | Draft | 2026-10-18 | 2026-10-18 |

**Materialized at repo root (not in `docs/`):** `AGENTS.md` (SPINE pointer),
`CLAUDE.md`, `GEMINI.md`, IDE rule pointers. Owner source drafts
[architecture.md](../architecture.md) and [plansv1.md](../plansv1.md) remain at
the root as input material; this suite supersedes them where they differ.

### 1.1 RFCs

| RFC ID | File | Feature | Status | Updated |
|--------|------|---------|--------|---------|
| gdgbingo-rfc-001 | [rfc-gdgbingo-claim-redemption.md](rfc-gdgbingo-claim-redemption.md) | Atomic claim redemption and round closure (PRD-F4, PRD-F6) | Draft | 2026-10-18 |

### 1.2 Supplementary evidence and rehearsal handoff

| Document | File | Version | Status | Updated | Reconciled |
|----------|------|---------|--------|---------|------------|
| Development evidence | [development-status.md](development-status.md) | Unversioned | Not recorded (frontmatter missing) | 2026-10-18 | Not recorded; LOG Q10 |
| Vercel rehearsal handoff | [vercel-rehearsal.md](vercel-rehearsal.md) | Unversioned | Not recorded (frontmatter missing) | 2026-10-18 | Not recorded; LOG Q10 |

These existing filenames are retained to preserve links and historical evidence.
Dates above are supported by their git history; owner reconciliation is not
established by their creation or update date. Neither document supplies launch
approval. Metadata repair is tracked in LOG Q10.

---

## 2. Change Log

| CR ID | Date | Summary | Trigger doc | Docs touched | File |
|-------|------|---------|-------------|--------------|------|
| none | | No CRs this session | | | |

---

## 3. Traceability Matrix

These tables describe documentation coverage only. `yes`, design locations,
and test IDs mean a specification or planned test exists; they do not mean
application code enforces the rule or a product test has run. Root application
code and executable tests now exist; see [development-status.md](development-status.md)
for exact results and gaps. The isolated Phase 1 experiments remain separately
recorded under `spikes/phase1`.
RFC 001 is draft version 0.2.

| PRD-F# | Feature | Priority | In SDD | In QAD | In RFC |
|--------|---------|----------|--------|--------|--------|
| PRD-F1 | Invitation join | Must-Have | yes | yes | N/A |
| PRD-F2 | Stable bingo card | Must-Have | yes | yes | N/A |
| PRD-F3 | Private outgoing codes | Must-Have | yes | yes | N/A |
| PRD-F4 | Claim redemption | Must-Have | yes | yes | rfc-001 |
| PRD-F5 | Line and blackout scoring | Must-Have | yes | yes | N/A |
| PRD-F6 | Round lifecycle | Must-Have | yes | yes | rfc-001 |
| PRD-F7 | Public board | Must-Have | yes | yes | N/A |
| PRD-F8 | Host dashboard | Must-Have | yes | yes | N/A |
| PRD-F9 | Skill reveal | Must-Have | yes | yes | N/A |
| PRD-F10 | Recruitment consent and skill selections | Must-Have | yes | yes | N/A |
| PRD-F11 | Protected CSV export | Must-Have | yes | yes | N/A |
| PRD-F12 | Shared rate limiting | Must-Have | yes | yes | N/A |
| PRD-F13 | Accessible phone UI | Must-Have | yes | yes | N/A |

### 3.1 Invariant Matrix

| INV-# | Rule | Status | Planned enforcement | Planned negative test |
|-------|------|--------|-------------|---------------|
| INV-1 | Never commit more than one claim per code | Active | SDD §5.1, RFC 001 | NT-01 |
| INV-2 | Never spend a code on a rejected claim | Active | SDD §5.1, RFC 001 | NT-02 |
| INV-3 | Never expose codes, invitations, or secrets publicly or in logs | Active | SDD §5.1 | NT-03 |
| INV-4 | Never trust browser identity, permissions, scores, or timing | Active | SDD §5.1 | NT-04 |
| INV-5 | Never create a second participation or allowance per user per event | Active | SDD §5.1 | NT-05 |
| INV-6 | Never serve host or other-player private data to unauthorised users | Active | SDD §5.1 | NT-06 |
| INV-7 | Never depend on a paid service or upgrade automatically | Active | SDD §5.1, BUILD §5 | NT-07 |

---

## 4. Incident Log

| PM ID | Date | Severity | Summary | Actions closed | File |
|-------|------|----------|---------|----------------|------|
| none | | | | | |

---

## 5. Health Check

- [ ] Every `Locked` doc's `reconciled` date is newer than the last code change in its area
- [ ] No doc has sat in `Draft` past its expected movement date
- [x] Every open change record has propagated downstream
- [x] Every feature ID referenced by SDD, RFC, or QAD still exists in the PRD
- [x] §3 Traceability Matrix covers every Must-Have
- [x] §3.1 Invariant Matrix maps each `Active` invariant to a planned design and negative test
- [ ] Application enforcement implemented and invariant tests recorded as passing
- [ ] Current revision validated with SPINE 0.3.0 (`python $SPINE_HOME/scripts/check.py docs/ --strict`); evidence pending, see BUILD §3.1
- [ ] Latest checkpoint verifies clean (`python $SPINE_HOME/scripts/checkpoint.py verify`)
- [x] No secrets committed in `docs/`

---

## 6. Notes

All documents remain `Draft`. On 2026-10-18 the owner authorised full phased
development against the Draft specifications. This authorises implementation,
not document validation, complete acceptance or event readiness.
Owner decisions blocking a lock are listed in LOG §2 (Q1 to Q7) and tracked as
GitHub issues under the "Phase 1" milestone.

Phase 1 status: isolated local experiments have passed 11 auth/API checks,
8 real local-PostgreSQL checks, Astro type checking, Vercel artifact generation,
and dependency audit after a scoped override. See the
[spike README](../spikes/phase1/README.md),
[recorded results](../spikes/phase1/results.md), and
[account setup instructions](../spikes/phase1/SETUP.md).
A follow-up development-database run also passed all 8 transaction checks
through Neon Pool and Drizzle's Neon adapter on PostgreSQL 18.6. A root application
and compressed local 350-player database baseline now also exist; see the
[development status](development-status.md). Hosted CDN/Auth/capacity checks
remain open.
Q1–Q7, full acceptance of #8–#11, and private validator access/evidence remain
prerequisites for the appropriate document locks and first checkpoint in #12.
A document lock approves a specification; it is not a product test pass.
