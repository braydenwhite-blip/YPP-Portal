# Final Review Cockpit — Redesign Plan

A redesign of the Instructor Application Final Review experience (the
`CHAIR_REVIEW` stage in `prisma/schema.prisma`) so a Hiring Chair can read,
trust, and decide on a candidate in under two minutes for clear cases and under
eight for borderline ones. This document is the source of truth for the
redesign; implementation work should reference it.

## Table of Contents

1. **Chair Job-To-Be-Done & Decision Flow** — who the chair is, what they need,
   how the new flow plays out
2. **Visual Language & Motion Polish** — typography, spacing, surface hierarchy,
   Framer Motion patterns, accessibility
3. **Page Architecture & Layout** — the new route, grid, responsive breakpoints,
   information density
4. **Component Specifications** — every new component, props, state, LOC budget
5. **Unified Feedback System** — ReviewSignal abstraction, pinning, sentiment,
   consensus, threading, @mentions, filters
6. **Data Model & Server Actions** — schema deltas, migrations, RBAC matrix,
   autosave
7. **Quality, Edge Cases & Launch Readiness** — regressions, edge cases, test
   plan, performance budgets, launch checklist
8. **Execution Roadmap & Open Questions** — phased rollout, quick wins vs.
   bigger builds, final recommendation, product decisions needed

---

## 1. Chair Job-To-Be-Done & Decision Flow

### 1.1 What's wrong with today

The current Final Review surface is `ChairComparisonSlideout.tsx` — a 600 px
right-edge drawer that stacks every interview review, every reviewer note, and
every category score into one long scroll. The chair gets two free-text boxes
("Rationale" and "Comparison notes") and five action buttons. There is no
consensus signal, no side-by-side comparison, no way to pin a quote, no
keyboard support, no autosave indicator, and no queue-aware navigation. The
shape of the UI says "fill out a form." The shape we want is "make a decision
and move."

Internal shadowing puts current per-applicant time at **6–11 minutes**.
Throughput for a chair clearing a 15-applicant queue is roughly two hours,
most of it spent context-switching between sections rather than actually
deciding. The chair leaves the session unsure whether they read the right
notes — which is the worst possible feeling for the person granting trust to
a future instructor.

### 1.2 Who the chair actually is

A Hiring Chair is **not a re-interviewer**. They have not met the candidate.
Their job is to weigh the people who *did* meet the candidate, sanity-check
for red flags, ratify the recommendation, and own the audit record. The four
implicit questions in their head, in order:

1. **Do my interviewers agree?** (consensus)
2. **If not, where exactly do they disagree?** (dimensional comparison)
3. **Did anyone flag something I should look at directly?** (red flags)
4. **Is the candidate's prep work credible?** (course outline, first-class
   plan, resume — only if 1–3 leave doubt)

Everything else is reference material. The redesign optimizes for those four
questions being answered above the fold within five seconds of the page
loading.

### 1.3 Decision-time benchmarks

Three flows, three different speeds. The UI must adapt to the case, not force
the chair through one path:

| Flow | Profile | Target time | Volume share |
|------|---------|-------------|---------------|
| **Strong hire** | Unanimous ACCEPT, no risk flags, materials green | < 60 s | ~55% |
| **Clear reject** | Unanimous REJECT or any RED_FLAG concurred | < 90 s | ~15% |
| **Borderline** | Split recommendations, ACCEPT_WITH_SUPPORT, HOLD, or any conflicting signal | 5–8 min | ~30% |

A "soft cap" nudge appears at the **10-minute mark** on a single applicant:
*"This is taking a while — want to request a second interview or loop in
another chair?"* Decisions past 10 minutes don't get better, just later.

Throughput target: **median 3 minutes per applicant, p90 8 minutes**. A chair
clearing 15 applicants on a Sunday afternoon should finish in under an hour
instead of two.

### 1.4 Information hierarchy (above-the-fold contract)

The first 600 px of vertical space — what loads before the chair touches the
scroll wheel — is the most expensive real estate in the product. It must
carry the four implicit questions. Ranking by zone, on a 1440 px desktop:

| Rank | Element | Zone | Why it's there |
|------|---------|------|----------------|
| 1 | **Consensus headline** ("3 of 3 reviewers recommend Hire" + sentiment chips) | Top center, bold | Answers Q1 in one glance |
| 2 | **Applicant snapshot** (name, chapter, subject, days-in-queue) | Top left | Anchors identity |
| 3 | **Risk flags chip** (count + severity, expand inline) | Top right | Answers Q3, never hidden |
| 4 | **Decision dock** (5 actions, sticky bottom) | Bottom, always visible | Action is one keystroke away from the moment they orient |
| 5 | **Decision-readiness meter** (4-signal ring) | Right rail, sticky | Gives the chair calibration: *am I ready?* |

Below the fold is where dimensional comparison (the score matrix), individual
interviewer narratives, training materials, and the timeline live. They are
one scroll or one click away — never two.

### 1.5 The five-step chair flow

```
Open  →  Orient  →  Decide  →  Commit  →  Next
0s        5s         varies      <2s       1 click
```

**Open (0s).** The chair clicks an applicant in the queue. The page loads
already showing snapshot, consensus, risk-flag count, and the decision dock.
No spinners on the critical path. (Skeletons cover the matrix and feed if the
payload streams late, never the snapshot.)

**Orient (5–20 s).** Eyes go to the consensus chip. If it reads "Strong
consensus — Hire" and the risk-flag pill is empty, the chair can hit `A` *now*.
If it reads "Mixed: 1 Hire, 1 Hold," the chair scrolls — and the score matrix
auto-highlights the categories where reviewers diverge most.

**Decide.** Three fast paths:

- **Path A — Strong hire (~15 s).** Hit `A`. A compact confirmation slides up
  with the rationale field pre-filled (`"Unanimous accept, no flags. Approved."`).
  Hit `Enter`. The decision is recorded.

- **Path B — Clear reject (~45 s).** Hit `R`. Modal requires one *required
  reason code* (drop-down: *Teaching fit*, *Communication*, *Professionalism*,
  *Red flag*, *Other*) plus free text. The reason code drives the
  legally-safe candidate email template — chairs no longer have to author
  rejection prose from scratch.

- **Path C — Borderline (~5–8 min).** Hit `C` to enter the conditional-approve
  flow, or scroll. The matrix auto-highlights divergent categories. The chair
  pins quotes from the activity feed by hitting `P`; pinned quotes appear in
  the rationale draft as cited citations. APPROVE_WITH_CONDITIONS opens a
  *checklist* of common conditions (mentorship pair-up, mid-semester check-in,
  teaching shadow) rather than a free-text void — the chair is rarely
  inventing a new condition; they're picking from a vocabulary the program
  already uses.

**Commit (<2 s).** Decision saves through the existing `chairDecide()` server
action. Optimistic UI flips the dock state immediately, with rollback on
server error. A toast confirms: *"Decision recorded — email queued."* If the
notification email fails (existing `lastNotificationError` field), a
persistent banner surfaces — silent failure is the single most damaging bug in
the current system and the redesign fixes it visibly.

**Next.** The success toast offers the next applicant in the queue with their
avatar, name, and chapter visible: *"Next: Alex Morgan, MIT — press `J`."*
This is the single biggest throughput win — zero round trips through the
queue page. The chair stays in flow.

### 1.6 Trust and confidence design

The chair's worst feeling is realizing three days later that they missed
something. The UI must answer that *before* the chair submits, not after.
Three trust mechanisms:

**Consensus summary.** A one-line generated sentence above the feed:
*"3 of 3 reviewers recommend Hire. Lowest-rated category: Communication
(On Track). No red flags."* This replaces the chair having to synthesize
across reviews. When opinions split, it reads honestly:
*"Reviewers split: 1 Hire, 1 Hold. Disagreement in Demeanor."*

**Decision-readiness meter.** A four-segment ring on the right rail showing
which prerequisites are met: interviews complete, materials submitted,
recommendation received, no unresolved info requests. Below 100%, the
primary decision button shows a warning state — but never blocks. A chair
can override (and the override is recorded in the timeline) for legitimate
edge cases like an applicant who interviewed in person and the form was lost.

**Risk flags pill.** Counts of `RED_FLAG` and `WEAK_ANSWER` tags, plus
"materials missing" and "review divergence detected." Click to expand the
exact tagged quotes with attribution. One click to evidence — no hunting
through long notes.

**Calibration hint (tertiary).** *"You've approved 12 of 15 chairs in Physics
this cycle — chapter average is 70%."* Shown only when a chair is more than
2σ from peer behavior. Used sparingly. Purpose: gentle pattern-break, not
shame. This is the kind of feature that makes the system feel like it's
helping the chair do their job better, not surveilling them.

### 1.7 Smart defaults and the dock state machine

The decision dock is not a static row of five buttons. It adapts to the
applicant:

- **All interviewers ACCEPT, no flags →** Approve is the focused primary
  button. Reject is muted secondary.
- **Any RED_FLAG →** Approve requires a confirmation checkbox first
  (*"I've reviewed the red flag from [Interviewer]"*) before becoming
  enabled. Reject becomes the visually primary button.
- **Mixed recommendations →** Approve-with-Conditions becomes primary; the
  others are equal weight. UI nudges toward the path most likely to be
  correct without locking the chair out of any decision.
- **Already decided (status ≠ CHAIR_REVIEW) →** dock collapses to a
  read-only banner with timestamp and the chair who decided. A
  `SUPER_ADMIN`-only "Rescind decision" link is shown (see §6 for RBAC and
  §7 for the audit guarantees on rescinding).

The UI never *removes* an action — every chair can always pick any of the six
verbs (Approve, Approve-with-Conditions, Hold, Waitlist, Request Info,
Request Second Interview, Reject). It just makes the right one obvious.

### 1.8 Queue-aware navigation

The queue is an integral part of the cockpit, not a separate page the chair
returns to between decisions. Three integration points:

1. **Sticky snapshot bar** carries a `3 of 12 in queue` counter and prev/next
   arrows. `J`/`K` keys navigate.
2. **Dropdown of remaining queued applicants** under the counter, with avatar
   + chapter + days-in-queue, so the chair can re-order intuition (do the
   week-old ones first, do same-chapter in batch).
3. **Auto-advance toast** after each decision offers the next applicant by
   name; chair hits `J` (or clicks) to land on it instantly. Next.js
   `<Link prefetch>` makes the navigation feel instant.

### 1.9 Collaboration model

Most decisions are solo. The 5–10% that aren't get explicit support:

- **Ask another chair.** A primary action next to Submit. Opens a typeahead
  of chairs in the same chapter/subject plus a short message. Recipient gets
  a deep-link with a "second chair" banner. The second chair's recommendation
  is recorded as advisory, not binding, unless co-chair mode is enabled (a
  product decision flagged in §8).

- **@mentions in rationale.** `@alex` creates a notification and a comment
  thread anchored to the rationale field. Alex can reply inline; the thread
  renders below the rationale in the audit timeline. Mentions reuse the
  existing `notifications.ts` infrastructure (Resend + in-app), with a new
  `REVIEW_MENTION` notification type.

- **Disagreement surfacing.** If a second chair's advisory recommendation
  differs from the primary chair's draft, a non-blocking banner appears:
  *"Chair Alex suggested Waitlist; your draft is Approve. [See their
  rationale]."* Hard to miss, easy to override.

Every collaboration event lands in `InstructorApplicationTimelineEvent` with
actor, timestamp, and payload — the compliance story is preserved.

### 1.10 The chair's emotional contract

If we get this right, three things should be true the day after a chair uses
the new cockpit:

1. **They trust their decisions.** Because the consensus, readiness, and risk
   surfaces showed them what to weigh, they don't second-guess later.
2. **They moved fast.** A 15-applicant queue cleared in under an hour, with
   the borderline cases getting the time they deserved.
3. **They felt the system worked with them, not against them.** Keyboard
   shortcuts, autosave, queue-aware navigation, smart defaults — the
   software disappeared into the workflow.

That's the bar. Sections 2–8 of this plan are implementation in service of
those three outcomes.

---

*Sections 2–8 to follow.*
