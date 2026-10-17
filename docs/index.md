---
spine_type: INDEX
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
| IDEA · Idea Brief | [idea-gdgbingo.md](idea-gdgbingo.md) | 0.1 | Draft | 2026-10-18 | 2026-10-18 |
| PRD · Product Requirements | [prd-gdgbingo.md](prd-gdgbingo.md) | 0.1 | Draft | 2026-10-18 | 2026-10-18 |
| SDD · System Design | [sdd-gdgbingo.md](sdd-gdgbingo.md) | 0.1 | Draft | 2026-10-18 | 2026-10-18 |
| QAD · QA & Test Plan | [qad-gdgbingo.md](qad-gdgbingo.md) | 0.1 | Draft | 2026-10-18 | 2026-10-18 |
| OPS · Ops & Observability | [ops-gdgbingo.md](ops-gdgbingo.md) | 0.1 | Draft | 2026-10-18 | 2026-10-18 |
| BUILD · Build Guide | [build-gdgbingo.md](build-gdgbingo.md) | 0.1 | Draft | 2026-10-18 | 2026-10-18 |
| LOG · Session Log | [log-gdgbingo.md](log-gdgbingo.md) | 0.1 | Draft | 2026-10-18 | 2026-10-18 |

**Materialized at repo root (not in `docs/`):** `AGENTS.md` (SPINE pointer),
`CLAUDE.md`, `GEMINI.md`, IDE rule pointers. Owner source drafts
[architecture.md](../architecture.md) and [plansv1.md](../plansv1.md) remain at
the root as input material; this suite supersedes them where they differ.

### 1.1 RFCs

| RFC ID | File | Feature | Status | Updated |
|--------|------|---------|--------|---------|
| gdgbingo-rfc-001 | [rfc-gdgbingo-claim-redemption.md](rfc-gdgbingo-claim-redemption.md) | Atomic claim redemption and round closure (PRD-F4, PRD-F6) | Draft | 2026-10-18 |

---

## 2. Change Log

| CR ID | Date | Summary | Trigger doc | Docs touched | File |
|-------|------|---------|-------------|--------------|------|
| none | | No CRs this session | | | |

---

## 3. Traceability Matrix

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

| INV-# | Rule | Status | Enforced in | Negative test |
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
- [x] §3.1 Invariant Matrix: every `Active` invariant is enforced and has a negative test
- [x] Validator green (`python $SPINE_HOME/scripts/check.py docs/`)
- [ ] Latest checkpoint verifies clean (`python $SPINE_HOME/scripts/checkpoint.py verify`)
- [x] No secrets committed in `docs/`

---

## 6. Notes

All documents are `Draft`. Per SPINE, implementation against Draft docs needs the
owner's go-ahead; Phase 1 issues (decisions and spikes) are safe to start now.
Owner decisions blocking a lock are listed in LOG §2 (Q1 to Q7) and tracked as
GitHub issues under the "Phase 1" milestone.
