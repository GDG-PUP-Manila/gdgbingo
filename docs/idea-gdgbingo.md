---
spine_type: IDEA
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

# Idea Brief: GDG Bingo

Source drafts: [architecture.md](../architecture.md), [plansv1.md](../plansv1.md)
(owner-written, 2026-10-18). Where this suite and those drafts disagree, this
suite wins.

---

## 1. One-line summary

A phone-friendly networking bingo for a GDG event of 300+ attendees, where
squares are confirmed by private single-use codes exchanged through Teams DMs and
results are calculated by the server, not trusted from the browser.

## 2. The problem

At a large chapter event, attendees mostly talk to people they already know.
A networking bingo pushes them to meet others ("find someone who ships
Flutter apps"), but paper or honour-system bingo cannot be verified, scales
badly past a few dozen people, and gives organisers no usable record of who
met whom or what skills are in the room. Hand-checking 300 cards for winners
and ties at the end of a round is slow and disputable.

## 3. Who it is for

| User | What they need | How they work around it today |
|------|----------------|-------------------------------|
| Participant (registered attendee) | Join quickly on a phone, hand out codes, claim squares, see progress and whether they won | Paper cards, self-reported marks, nobody checks |
| Host (organiser) | Start and close a round, see standings, resolve winners and ties fairly, reveal skill matches, export results | Manual counting, screenshots, disputes |
| Chapter leads (recruitment follow-up) | A consented list of attendees and self-reported skills | Separate sign-up forms after the event |

## 4. Out of scope

Explicit non-goals for version one. Anything listed here must not appear in the
PRD, the SDD, or the code without a change record.

- A Microsoft Teams bot, Teams app, or tenant integration. Teams is used only to
  share the event link, for conversation, and for participant-to-participant
  code exchange in DMs. The website never reads or sends Teams messages.
- Live push updates (WebSockets, SSE, paid realtime services). The board polls.
- In-app chat or messaging between participants.
- Booth quests, multiple concurrent rounds per event, or a general-purpose event
  builder.
- Automated recruitment messages, email campaigns, SMS, or any messaging API.
- Payments, tickets, or prize fulfilment.
- Media uploads (avatars, photos).
- Self-service account rebinding after an invitation is redeemed.
- Any paid service, paid plan upgrade, trial-credit dependency, purchased domain,
  paid analytics, paid cache, or paid email delivery.
- Any application host other than Vercel.
- Treating a claim as proof of a verified skill. Matches are peer-confirmed,
  self-reported.

### 4.1 Invariants (must-never rules)

Transcribed from the owner's must-never statements in
[architecture.md](../architecture.md) and [plansv1.md](../plansv1.md) launch
gates. Owner confirmation pending (LOG Q1).

| ID | The product must never | Why | Status |
|----|------------------------|-----|--------|
| INV-1 | Commit more than one claim against a single code | A double-spent code corrupts scoring and fairness | Active |
| INV-2 | Mark a code spent when its claim is rejected or rolled back | Players would lose codes to errors they did not cause | Active |
| INV-3 | Expose a private code, invitation token, or server secret in a public board response, a URL, analytics, or a log line | Leaked codes can be redeemed by anyone; leaked secrets compromise the event | Active |
| INV-4 | Accept identity, permissions, scores, or round timing from the browser | Browser input is untrusted; results must be authoritative | Active |
| INV-5 | Create a second participation, card, or code allowance for the same user in the same event | Retries and rejoins must not mint extra codes | Active |
| INV-6 | Let a non-host reach host controls or exports, or let any user read another participant's private state | Exports and codes are private data | Active |
| INV-7 | Depend on a paid service or perform an automatic paid upgrade | Fixed $0 recurring service budget | Active |

Status vocabulary: `Active`, `Retired`.

## 5. Success looks like

- 300+ attendees join and play one round on their phones without staff help
  beyond the pinned instructions.
- Every committed claim is valid; zero double-spent codes and zero duplicate
  participations in the event data.
- The host announces winners within a minute of closing the round, with no
  disputed tie.
- Organisers leave with a consented, exportable list of attendees and
  peer-confirmed skill matches.
- The event costs $0 in hosting and service charges.

## 6. Constraints

| Kind | Constraint | Source |
|------|-----------|--------|
| Cost | $0 recurring service cost on ongoing free plans (Vercel Hobby, Neon Free); no trial credits | architecture.md "Budget requirement" |
| Platform | Application deploys only to Vercel; Neon is the external database and auth provider | architecture.md "Free deployment requirements" |
| Platform | Phone-first web; no native app, no Teams app | architecture.md "Purpose" |
| Scale | Design target 300+ participants, validated against 350 simulated players | architecture.md "Purpose" |
| Policy | Vercel Hobby is personal, non-commercial only; eligibility must be established before deploy | https://vercel.com/docs/plans/hobby |
| Policy | Hosted load testing requires provider authorisation | https://vercel.com/docs/limits/fair-use-guidelines |
| Time | Event date not yet set | LOG Q4 |

## 7. Open questions

Mirrored into [log-gdgbingo.md](log-gdgbingo.md) §2.

- `TBD(owner)` Confirm INV-1 to INV-7 as transcribed (LOG Q1).
- `TBD(owner)` Event date and expected peak attendance (LOG Q4).
- `TBD(owner)` Is the Vercel Hobby account eligible for this event under the
  personal, non-commercial terms? If not, the $0 / Vercel-only constraints are
  unmet and launch waits (LOG Q5).
