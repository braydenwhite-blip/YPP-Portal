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
3. **Page Architecture & Routing** — the new route, data flow, URL state,
   dual-rollout strategy
4. **Layout, Grid & Responsive** — 12-column grid, sticky regions, breakpoints,
   touch adaptations
5. **Components — Phase 1: Shell & Layout Primitives** — cockpit shell, context,
   layout wrappers, shared chips
6. **Components — Phase 2A: Snapshot & Queue Navigator** — situational awareness,
   queue control, status banner
7. **Components — Phase 2B: Decision Dock & Draft Rationale** — the decision
   surface composed, autosave, adaptive dock state (no commit yet)
8. **Components — Phase 2C: Confirmation & Action Forms** — the pre-commit
   modal, conditions editor, reason code picker, contrarian warning
9. **Components — Phase 2D: Commit Wiring & Happy Path** — `chairDecide`
   extension, idempotency key, optimistic UI, toast advance
10. **Components — Phase 2D.6: Transactional Failure Surfaces** — sync
    rollback banner, stale-click recovery, deadlock handling, validation
    errors, network-drop recovery
11. **Components — Phase 2D.8: Notification & Soft Failure Surfaces** —
    email failure banner with retry, contrarian-override audit, soft
    warnings, post-commit notification errors
12. **Components — Phase 2E: Rescind & Audit** — superseding prior decisions,
    conditions display, rescind modal for SUPER_ADMINs
13. **Components — Phase 3: Feedback, Consensus & Matrix** — the world-class
    differentiation layer
14. **Unified Feedback System** — ReviewSignal abstraction, pinning, sentiment,
    consensus, threading, @mentions, filters
15. **Data Model & Server Actions** — schema deltas, migrations, RBAC matrix,
    autosave
16. **Quality, Edge Cases & Launch Readiness** — regressions, edge cases, test
    plan, performance budgets, launch checklist
17. **Execution Roadmap & Open Questions** — phased rollout, quick wins vs.
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
consensus — Hire" and the risk-flag pill is empty, the chair can click
Approve *now*.  If it reads "Mixed: 1 Hire, 1 Hold," the chair scrolls
— and the score matrix auto-highlights the categories where reviewers
diverge most.

**Decide.** Three fast paths:

- **Path A — Strong hire (~15 s).** Click Approve. A compact
  confirmation slides up with the rationale field pre-filled (`"Unanimous
  accept, no flags. Approved."`). Click Confirm. The decision is recorded.

- **Path B — Clear reject (~45 s).** Click Reject. Modal requires one
  *required reason code* (drop-down: *Teaching fit*, *Communication*,
  *Professionalism*, *Red flag*, *Other*) plus free text. The reason
  code drives the legally-safe candidate email template — chairs no
  longer have to author rejection prose from scratch.

- **Path C — Borderline (~5–8 min).** Click Approve-with-Conditions, or
  scroll. The matrix auto-highlights divergent categories. The chair
  pins quotes from the activity feed with a click on the pin icon;
  pinned quotes appear in the rationale draft as cited citations.
  APPROVE_WITH_CONDITIONS opens a *checklist* of common conditions
  (mentorship pair-up, mid-semester check-in, teaching shadow) rather
  than a free-text void — the chair is rarely inventing a new condition;
  they're picking from a vocabulary the program already uses.

**Commit (<2 s).** Decision saves through the existing `chairDecide()` server
action. Optimistic UI flips the dock state immediately, with rollback on
server error. A toast confirms: *"Decision recorded — email queued."* If the
notification email fails (existing `lastNotificationError` field), a
persistent banner surfaces — silent failure is the single most damaging bug in
the current system and the redesign fixes it visibly.

**Next.** The success toast offers the next applicant in the queue with
their avatar, name, and chapter visible: *"Next: Alex Morgan, MIT →."*
One click on the toast's primary CTA and the chair lands on the next
applicant. Zero round trips through the queue page. The chair stays in
flow.

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
   arrows.
2. **Dropdown of remaining queued applicants** under the counter, with avatar
   + chapter + days-in-queue, so the chair can re-order intuition (do the
   week-old ones first, do same-chapter in batch).
3. **Auto-advance toast** after each decision offers the next applicant by
   name; one click on the toast lands on it instantly. Next.js
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
3. **They felt the system worked with them, not against them.** Autosave,
   queue-aware navigation, smart defaults, and adaptive dock states — the
   software disappeared into the workflow.

That's the bar. Sections 2–8 of this plan are implementation in service of
those three outcomes.

---

## 2. Visual Language & Motion Polish

This is the section that makes the difference between a functional redesign
and a *world-class* one. The cockpit must feel like a premium decision tool —
calm, confident, considered — not a form. The visual language carries that
promise; motion delivers the daily delight that keeps a chair returning to
the queue without dread.

### 2.1 Design philosophy in three words

**Calm. Decisive. Trustworthy.**

- *Calm* — generous whitespace, restrained color, no UI shouting for
  attention. The chair's brain is the loudest thing on the page.
- *Decisive* — every element earns its place. If a control isn't going to be
  used in 9 out of 10 sessions, it's behind a disclosure. Hierarchy is
  obvious within 200 ms of glance.
- *Trustworthy* — the tone of error states, the precision of timestamps, the
  honesty of the readiness meter. The cockpit never bluffs. If consensus is
  uncertain, it says so. If a notification failed, the banner is loud.

### 2.2 Type system

The app already loads **Inter** via `next/font/google` (`app/layout.tsx`).
We keep it; it's the right choice — high-density, neutral, excellent at
small sizes. We extend it with a stricter scale and intentional weights.

```css
/* Add to app/globals.css under the existing :root tokens */
--font-display:    -0.02em letter-spacing, weight 600
--font-headline:   -0.015em, 600
--font-title:      -0.01em, 600
--font-body:       -0.005em, 400
--font-label:       0,       500, uppercase, tracking 0.04em
--font-mono:       'JetBrains Mono', monospace, 400  /* for keyboard kbd */

--text-xs:    11px / 16px line-height
--text-sm:    13px / 20px
--text-base:  14px / 22px   /* default body */
--text-md:    16px / 24px
--text-lg:    18px / 26px
--text-xl:    22px / 30px   /* applicant name */
--text-2xl:   28px / 36px   /* consensus headline */
--text-3xl:   36px / 44px   /* reserved — page-level statement, used sparingly */
```

Rules of the road:

- **One display element per fold.** The consensus headline at the top of the
  feedback panel is the only `--text-2xl` above the fold. Anything else that
  big is competing for the wrong reason.
- **Body type is 14 px, not 16 px.** This is an information-dense decision
  surface for a logged-in admin, not a marketing page. Reviewers' notes,
  timeline, score chips all use 14/22.
- **Numbers in tabular figures.** Score counts, queue position, days-in-queue
  use `font-variant-numeric: tabular-nums` so columns align without jitter
  during animation.
- **Labels are uppercase + tracked.** The `Strong Hire`, `Mixed`, `Concern`
  sentiment chips and section labels (`CONSENSUS`, `RISK FLAGS`) use the
  `--font-label` style. This signals "metadata," not content.

### 2.3 Spacing rhythm

A **4 px base unit** with a constrained scale. Every margin, padding, and
gap is a multiple. This is non-negotiable — it's what makes the page feel
designed instead of assembled.

```css
--space-1:  4px
--space-2:  8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px   /* default panel padding */
--space-8: 32px
--space-10: 40px
--space-12: 48px  /* section gaps */
--space-16: 64px
```

Cadence rules:
- Inside a card: `--space-6` padding, `--space-4` between elements.
- Between cards in a panel: `--space-4`.
- Between major panels: `--space-8`.
- Above the dock: `--space-16` (so content never crowds the dock).
- Page horizontal gutters: `--space-6` desktop, `--space-4` tablet,
  `--space-3` mobile.

### 2.4 Surface hierarchy

Three surface levels. Every element belongs to exactly one.

| Level | Token | Use | Visual treatment |
|------|------|-----|--------|
| **Canvas** | `--cockpit-canvas: #f7f5fb` (a 2% purple-tinted off-white) | Page background | Flat, no shadow |
| **Surface** | `--cockpit-surface: #ffffff` | Cards, panels, dock | `border: 1px solid var(--cockpit-line)`, `box-shadow: var(--cockpit-shadow)` |
| **Surface-strong** | `--cockpit-surface-strong: #faf8ff` (subtle purple wash) | Sticky bars, hover states, selected states | Slightly tinted to feel "elevated above the surface but not floating" |

Plus one accent for **glass overlays** (modal backdrop, dropdown):
`backdrop-filter: blur(12px) saturate(1.4)` over `rgba(15, 7, 36, 0.4)`.
Used only on `<dialog>` and floating menus — never on inline content.

Border radius scale (already defined; we constrain usage):
- `--radius-xs: 6px` — pills, chips, kbd keys
- `--radius-sm: 8px` — buttons, inputs
- `--radius-md: 12px` — cards
- `--radius-lg: 16px` — panels, modals, the dock

Shadows are purple-tinted (existing convention); we add one new token for
the floating dock so it reads as "above" the page:

```css
--shadow-dock: 0 -8px 32px rgba(59, 15, 110, 0.10),
               0 -2px 8px  rgba(59, 15, 110, 0.06);
```

### 2.5 Color and meaning

We extend, don't replace, the existing palette. Brand purple stays
`--ypp-primary: #6b21c8`. Functional colors get tightened so each carries
exactly one meaning:

| Token | Hex | Used for | Never used for |
|-------|-----|----------|----------------|
| `--ypp-primary` | #6b21c8 | Primary actions, focus rings, active selections | Status, scoring |
| `--score-strong` | #16a34a | Score `ABOVE_AND_BEYOND`, sentiment `STRONG_HIRE` | Buttons |
| `--score-good` | #22c55e | Score `ON_TRACK`, sentiment `HIRE` | Buttons |
| `--score-mixed` | #eab308 | Score `GETTING_STARTED`, sentiment `MIXED` | Errors |
| `--score-weak` | #ef4444 | Score `BEHIND_SCHEDULE`, sentiment `REJECT`, risk flags | Brand |
| `--score-concern` | #f97316 | Sentiment `CONCERN` (orange — distinct from reject red) | Score scale |
| `--ink-default` | #1a0533 | Body text | Backgrounds |
| `--ink-muted` | #6b5f7a | Metadata, timestamps | Headlines |
| `--ink-faint` | #a89cb8 | Disabled text, placeholder | Body |

**WCAG AA compliance is non-negotiable.** Every text/background combination
ships at ≥4.5:1 contrast. Score chips ship at ≥3:1 (large text exception
applies to chip labels). Spot-check during build with a deuteranopia
simulator on the score matrix; if any cell becomes ambiguous, the icon +
label fix in §2.9 takes care of it.

### 2.6 Motion principles

Framer Motion is now in the dependency set. We use it with discipline.
Motion serves **continuity, feedback, and spatial reasoning** — never
decoration.

**Five motion roles, five durations, two easings:**

| Role | Duration | Easing | Example |
|------|----------|--------|---------|
| **Micro-feedback** | 120 ms | `easeOut` | Button press, chip select, toggle |
| **State change** | 200 ms | `easeInOut` | Pin → unpin, expand → collapse, score change |
| **Layout transition** | 300 ms | spring `{ stiffness: 280, damping: 30 }` | Pinned-comments shuffle, queue advance |
| **Surface entry** | 400 ms | spring `{ stiffness: 220, damping: 26 }` | Decision dock entrance, modal open, toast slide-up |
| **Page transition** | 500 ms | `easeInOut` | Route change between applicants — fade + slight Y offset |

**Three Framer Motion patterns to standardize:**

```tsx
// Pattern 1: Decision dock entrance — slides up from below on first paint
const dockVariants = {
  hidden: { y: 32, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 220, damping: 26 } },
}

// Pattern 2: Activity feed item — staggered reveal so the eye can scan
const feedListVariants = {
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
}
const feedItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}

// Pattern 3: Pinned signal — uses layoutId so the same card animates
// from the feed position to the pinned rail (shared element transition)
<motion.div layoutId={`signal-${signal.id}`} layout transition={{ type: "spring", stiffness: 280, damping: 30 }} />
```

**`prefers-reduced-motion` is a first-class branch, not an afterthought.**
Wrap the whole cockpit in a `MotionConfig` that flips `transition` to
`{ duration: 0 }` when the user prefers reduced motion. Visual hierarchy
must still work without animation — animation is the polish, not the signal.

```tsx
<MotionConfig reducedMotion="user">
  <FinalReviewCockpit ... />
</MotionConfig>
```

### 2.7 Micro-interactions that earn delight

Five interactions that, done right, will get noticed. Done wrong, they
degrade the whole product.

**1. Autosave indicator.** A 16 px dot next to "Saved 3s ago" that subtly
pulses for 200 ms when a save lands. On error, the dot turns amber and the
text becomes "Retrying…" — never a blocking spinner. Lives in the
`SaveStateIndicator` component (§4).

**2. Pin a quote.** A pin-icon button appears on hover in the top-right
of each feed item. Click it. The item gets a purple left-border accent
(200 ms ease-in-out), the pin icon switches to filled state (120 ms),
and the item animates via `layoutId` to the pinned rail above the feed.
The animation makes the *spatial relationship* between "feed" and
"pinned" obvious without requiring explanation.

**3. Decision confirm modal.** Backdrop fades in 200 ms; the dialog itself
springs up from the dock with a subtle `scale: 0.96 → 1` and `y: 16 → 0`.
Cancel reverses cleanly. Esc dismisses but only after a confirm-on-dirty
guard if rationale has unsaved characters.

**4. Queue advance.** After a decision is recorded, the page shows a brief
success tick (300 ms scale-in on a green check), then crossfades to the
next applicant's data. The applicant snapshot bar uses `layoutId` so
the avatar morphs into the new one rather than blink-replacing — a small
moment that makes the chair feel like the system is *paying attention* to
them.

**5. Risk flag click.** The flag pill expands inline (height auto via
`AnimatePresence` + `initial={{ height: 0 }}`) showing the exact tagged
quotes with attribution. Re-click collapses. No modal, no scroll jump.

### 2.8 Empty, loading, and error states

A premium product is judged on its weakest moment. Three states the cockpit
must handle gracefully:

**Empty states.** Composed, never apologetic.
- *No interview reviews yet:* a soft purple icon, headline *"Interviews
  haven't been scored yet,"* one-line context *"This applicant is in chair
  review with 2 of 2 interviews complete but no scorecards submitted,"* and
  a primary action *"Nudge interviewers."*
- *No risk flags:* a small green check + *"No flags detected."* No big
  empty illustration — that's overkill for a successful-by-default state.
- *No pinned signals:* one line of help text *"Click the pin icon on any
  comment to save it here for your rationale."*

**Loading states.** Skeletons that match the shape of the content.
- Snapshot bar: gray pill placeholders for name, chapter, and chips.
- Score matrix: dotted-outline cells in the right grid layout.
- Activity feed: 3 placeholder cards with shimmer.
- Consensus card: a gray pill placeholder where the headline goes.

The skeleton's color uses `--cockpit-skeleton: rgba(107, 33, 200, 0.06)`
with a subtle `linear-gradient` shimmer animating left-to-right at 1.4 s.
Respects `prefers-reduced-motion` (no shimmer, just the static fill).

**Error states.** Loud where it matters, quiet where it doesn't.
- Notification email failed: a persistent red-amber banner at the top of
  the feedback panel with an explicit *Resend* button. Reuses the existing
  `NotificationFailureBanner.tsx` shell with new styling.
- Server action failed (network): inline error chip on the affected
  control, *not* a global toast. The chair knows where the failure
  happened.
- Sync rollback (chair-decide compensator fired): full-width red banner
  with the rollback message + a link to a runbook/contact.
- LLM consensus generation failed: silent degrade to heuristic summary
  with a small footnote *"Pattern summary (LLM unavailable)."*

### 2.9 Iconography — and the WCAG fix

Add `lucide-react` (already recommended). Used everywhere the score color
appears, paired with a shape. This is the WCAG 1.4.1 fix called out in §7.

```tsx
const SCORE_DISPLAY = {
  ABOVE_AND_BEYOND: { icon: ArrowUpRight, label: "Above", color: "var(--score-strong)" },
  ON_TRACK:         { icon: ArrowRight,   label: "On",    color: "var(--score-good)"   },
  GETTING_STARTED:  { icon: Minus,        label: "Mid",   color: "var(--score-mixed)"  },
  BEHIND_SCHEDULE:  { icon: ArrowDownLeft,label: "Below", color: "var(--score-weak)"   },
}
```

Other icon usages, for consistency:
- Pin: `Pin` (filled when active, outline when inactive)
- Reply: `MessageCircle`
- Mention: `AtSign`
- Approve: `Check`
- Reject: `X`
- Hold: `Pause`
- Waitlist: `Clock`
- Request info: `HelpCircle`
- Second interview: `RotateCw`
- Risk flag: `AlertTriangle` (severity-colored)
- Materials missing: `FileQuestion`

All icons render at **16 px** in chips, **20 px** in primary buttons,
**24 px** in section headers. Stroke width 1.75 (lucide default 2 reads too
heavy at small sizes).

### 2.10 Accessibility as first-class

Not a checklist at the end — a constraint we design within from the start.

**Keyboard.** Every action reachable without a mouse. Focus rings visible
(2 px solid `--ypp-primary`, 2 px offset, never `outline: none` without a
replacement). Focus order matches visual order. Tab cycles within the
decision modal's focus trap; Esc returns focus to the trigger.

**Screen reader.** Decision buttons carry `aria-describedby` referencing a
visually-hidden consequence string: *"Approve. Grants instructor role,
sends approval email, moves applicant to APPROVED."* Consensus chips use
`aria-live="polite"` so a reviewer submitting a new score updates the
announcement without stealing focus. Pinned-rail item count announces on
change.

**Touch targets.** ≥44 px on all decision controls. Phone is read-only;
tablet (768–1023 px) supports full decisioning.

**Dark mode readiness.** Tokens are defined; we don't ship dark mode in
this redesign but we don't preclude it. Every color in §2.5 has a
designated dark-mode counterpart in a TODO block at the top of
`globals.css` so the future swap is mechanical.

```css
/* TODO: dark-mode pairings (future work)
   --cockpit-canvas:        #0f0a1c
   --cockpit-surface:       #1a1330
   --cockpit-surface-strong:#231a3f
   --cockpit-line:          rgba(255,255,255,0.08)
   --ink-default:           #f4eeff
   --ink-muted:             #b09cc8
*/
```

### 2.11 The "polish budget"

Not every redesign is a polish redesign. This one is. Allocate explicit
polish time in the schedule:

- **0.5 day** per major component for hover/focus/active states and
  motion variants (~10 components → 5 dev days)
- **1 day** for the consensus card alone — the headline element
- **1 day** for the score matrix — the densest signal in the cockpit
- **1 day** for skeletons across all loading states
- **1 day** for the empty-state composition pass

Total polish budget: **~10 days** beyond the functional implementation.
Tracking these as separate line items in §8's roadmap so they don't get
silently absorbed into "feature complete."

---

## 3. Page Architecture & Routing

Where the cockpit lives in the app, how its data flows, and how we ship it
alongside the existing slideout without breaking in-flight reviews. This
section is structural — the spatial concerns (grid, breakpoints, sticky
behavior) live in §4.

### 3.1 The routing decision — full page, not slideout

**Kill the slideout for final review.** It was the right pattern for quick
peeks from the kanban (reviewer assignment, interviewer brief) and it stays
for those. It is the wrong pattern for the final decision, for three reasons:

1. **600 px is not enough real estate.** A side-by-side score matrix needs
   ~900 px; comparing interviewer narratives side-by-side needs more. The
   slideout forces a vertical stack that buries the disagreement signal
   we're trying to surface.
2. **Chairs open a browser full-screen for this work.** The "small panel
   floating over the kanban" affordance suggests "quick glance." The
   decision deserves a destination, not a peek.
3. **Deep-linking matters.** Emails to chairs currently link to the kanban
   with `?applicant=<id>`, which pops the slideout. A proper URL like
   `/admin/instructor-applicants/[id]/review` is shareable ("hey, can you
   look at this one with me?"), bookmarkable, and survives browser reloads
   cleanly — which the slideout's query-param mount does not.

**The new route:** `/admin/instructor-applicants/[id]/review`

App Router layout:
```
app/(app)/admin/instructor-applicants/[id]/review/
├── page.tsx        (server component, data fetching, RBAC gate)
├── loading.tsx     (skeleton per §2.8)
└── error.tsx       (route error boundary, "Back to chair queue" link)
```

The kanban and chair queue stay where they are. Row clicks navigate to the
new page (via `<Link prefetch>`) instead of opening the slideout.

### 3.2 What happens to the existing slideout

`ChairComparisonSlideout.tsx` becomes a **thin redirect shim** during the
rollout window, then gets deleted.

```tsx
// During rollout, when flag is on:
export function ChairComparisonSlideout({ application, onClose }) {
  const router = useRouter()
  useEffect(() => {
    router.push(`/admin/instructor-applicants/${application.id}/review`)
    onClose()
  }, [application.id])
  return null
}
```

Any caller still mounting the slideout (email links, bookmarks, stale
kanban handlers) gets auto-redirected. Once telemetry confirms the shim
fires zero times for two weeks, the file is deleted in a cleanup PR. No
data migration required — URLs are just routes.

### 3.3 Data flow — RSC fetches, client components interact

Next.js 16 App Router idioms. The server component at
`page.tsx` does all the data loading in parallel; every interactive
subsection is a client component that receives props.

```tsx
// app/(app)/admin/instructor-applicants/[id]/review/page.tsx
export default async function FinalReviewPage({ params }) {
  const actor = await getHiringActor()
  if (!actor) redirect("/login")

  const [application, timeline, queue, draft, consensus] = await Promise.all([
    getApplicationForFinalReview(params.id),            // application + all reviews + interviews + docs
    getApplicationTimeline(params.id),                  // timeline events
    getChairQueueNeighbors({ currentId: params.id }),   // prev/next/position/total
    getChairDraft({ applicationId: params.id, chairId: actor.id }), // autosaved rationale
    getConsensusSummary(params.id),                     // cached or generate
  ])

  assertCanActOnApplication(actor, application)

  return (
    <FinalReviewCockpit
      application={serialize(application)}
      timeline={serialize(timeline)}
      queue={queue}
      initialDraft={draft}
      consensus={consensus}
      actorId={actor.id}
    />
  )
}
```

**Five queries in parallel, one await, one render.** Payload target per §7's
performance budget: 50–150 kB. No streaming — a single batched fetch keeps
the code simple and the data internally consistent (a timeline event and
the decision it references won't render out of sync).

Three helpers are new and live in `lib/final-review-queries.ts`:
- `getApplicationForFinalReview(id)` — one Prisma query with the
  appropriate `include` tree, replacing the scattered fetches the slideout
  does today
- `getChairQueueNeighbors({ currentId, scope?, chapterId? })` — returns
  `{ prev, next, position, total, siblings[] }` without shipping the full
  queue payload
- `getChairDraft({ applicationId, chairId })` — returns the autosaved
  rationale from the new `InstructorApplicationChairDraft` model (§7)

The consensus fetch (`getConsensusSummary`) reads from the cached
summary row (§7); if stale or missing, it kicks off a background
regeneration and returns the last known value with `stale: true`. Never
blocks the render on an LLM call.

### 3.4 Server vs client boundary

The `FinalReviewCockpit` shell is a **client component** (it owns
context state, the decision-confirm modal, and Framer Motion contexts).
Every heavy
sub-tree below it stays client because they share state through a
`FinalReviewContext`. Three pieces of *presentational* content are
server-rendered and passed as children for the smallest possible initial
JS payload:

- The applicant identity block inside the snapshot bar (no interactivity)
- The static portion of the score matrix (cells with no hover state)
- The timeline events list (read-only, no client state)

Everything else — feed, pin rail, dock, matrix hover, confirmation modal —
is client. This is a deliberate trade: the cockpit is behind auth and
used by a small set of users, so JS bundle is secondary to interaction
quality. Target: **≤ 80 kB gzipped** delta for the new page (§7
performance budget).

### 3.5 URL as state

Four pieces of state belong in the URL, not in component local state:

| Param | Purpose | Example |
|-------|---------|---------|
| `?focusedReviewer=<id>` | Which reviewer column to highlight in matrix + feed | `?focusedReviewer=clx...` |
| `?pinned=<id>,<id>` | Chair's personal pinned signals for this session | `?pinned=sig1,sig2` |
| `?filter=<source>,<source>` | Active filter chips on the activity feed | `?filter=INTERVIEW,INTERNAL` |
| `?confirm=<ACTION>` | Decision confirm modal is open (survives refresh) | `?confirm=APPROVE` |

URL mutations use `router.replace(url, { scroll: false })` so they don't
pollute browser history. A chair hitting back should return to the queue,
not scrub through every filter chip they tried.

**Why the URL and not a client store?**
- Sharable links ("look at what I've pinned")
- Refresh-safe (chair pauses mid-decision to double-check, survives reload)
- Inspectable in analytics (which filters do chairs actually use?)
- Zero runtime state sync bugs

### 3.6 Suspense boundaries

One boundary: route-level (`loading.tsx`). Inside the cockpit, no Suspense.

The rationale: the payload is small enough (50–150 kB) that
streaming subsections doesn't meaningfully help TTFB, and inner boundaries
would flash skeletons during every route change, creating visual noise.
The route-level skeleton (§2.8) is tuned to match the final layout so
the transition is imperceptible at 1440 px and a single 200 ms fade at
narrower widths.

The one exception: **`regenerateConsensus`** uses `useTransition` on the
client, not Suspense. Chair hits "Regenerate" → button shows a spinner dot
for up to 8 s → card updates in place. No unmount.

### 3.7 Prefetching and queue walking

Next.js `<Link prefetch>` does most of the work for free. Two explicit
prefetch points:

1. **Queue navigator prev/next buttons** — `<Link prefetch>` primes the
   next/prev applicant's route chunk on hover + viewport entry. By the
   time the chair clicks, the code is in the bfcache.
2. **Post-decision auto-advance toast** — when the toast renders, it
   preloads the next applicant's data via `router.prefetch(nextUrl)` so
   clicking the toast button lands in under 200 ms.

What we **don't** prefetch:
- Sibling applicants in the dropdown (cardinality is too high; only the
  adjacent two matter)
- The applicant's raw documents (PDFs, etc.) — opened on demand in a new
  tab

### 3.8 Dual-rollout behind a feature flag

Add a new flag: `ENABLE_FINAL_REVIEW_V2` in `lib/feature-flags.ts`. It
depends on the existing `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1` (v2 can't
ship if v1 is off). Default `false` at launch; flip on in stages.

**Gating at three layers:**

1. **Route layer.** Middleware redirect: if `ENABLE_FINAL_REVIEW_V2 = false`,
   the new route redirects to the kanban with `?applicant=<id>` so the
   legacy slideout opens. When `true`, the route renders the cockpit.
2. **Kanban row click.** The `ChairQueueBoard` row click handler checks the
   flag: `true` → `<Link href="/...review">`, `false` → open slideout.
3. **Slideout shim.** The redirect shim from §3.2 also respects the flag —
   only redirects when `true`.

This means flipping the flag is instant and reversible, no redeploy. A
flag flip causes chairs in flight to either (a) see the shim redirect
next time they open an applicant if flipped on, or (b) fall back to the
slideout if flipped off. Any autosaved rationale persists in either
direction (the draft model is shared — §7).

**Per-user or per-chapter rollout:** the flag helper accepts a user context
so we can toggle for internal admins first, then a specific chapter, then
globally. Staged plan in §9.

### 3.9 RBAC enforcement at the page level

Route-level permission check runs inside `page.tsx` before the `Promise.all`
fetch, so unauthorized users never see data loads:

```tsx
const actor = await getHiringActor()
if (!actor) redirect("/login")

const application = await prisma.instructorApplication.findUnique({ where: { id }, ... })
if (!application) notFound()

// Central permission gate — throws 403
assertCanViewFinalReview(actor, application)
```

The check lives in `lib/chapter-hiring-permissions.ts` alongside the
existing `assertCanActAsChair` (which only gates the server action, not
the page read — separately enforced).

**Important open question flagged in §9**: today `assertCanActAsChair`
does NOT enforce chapter scope. A HIRING_CHAIR in Chapter A can currently
decide on an applicant from Chapter B. The redesign must decide whether to
preserve that (chairs-are-global) or tighten to chapter-scoped. This is a
product decision, not a technical one, and it's called out prominently.

### 3.10 What this route does not handle

Deliberately out of scope for this route:
- **Reviewer-stage UI** (before interview) — stays on the existing kanban
  + applicant detail panel. That stage's redesign is a separate workstream.
- **Interviewer review editor** — `interview-review-editor.tsx` continues
  to own the write-side of interview reviews. The cockpit is read-only
  over that data.
- **Document upload** — applicants upload via the existing panel; chairs
  read, they don't upload. `QuickDocuments` in §5 is a thin read-only view.
- **Training post-approval** — once APPROVED, the applicant flows into
  `InstructorApproval` training state. The cockpit's job ends at the
  decision; re-review after training is handled by the existing
  `TRAINING_NOTE` projection in the feed (§6).

Keeping the surface focused is how we ship a world-class decision tool
without scope-creeping into a generic "applicant management" rewrite.

---

## 4. Layout, Grid & Responsive

The spatial contract. Where things live on the screen, how they behave as
the viewport shrinks, and how the sticky regions compose without fighting
each other. Pixel-concrete so ambiguity can't eat into build time.

### 4.1 Breakpoints

Four breakpoints, one off-ramp:

| Breakpoint | Range | Treatment |
|------------|-------|-----------|
| **Ultrawide** | ≥ 1920 px | Content max-width caps at 1440 px, centered. No new columns. |
| **Desktop** | 1280–1919 px | Full two-column cockpit, 7/5 split |
| **Laptop** | 1024–1279 px | Two-column, 8/4 split (right rail narrows) |
| **Tablet** | 768–1023 px | Single column, right rail becomes a top strip |
| **Mobile** | 375–767 px | Read-only + "open on laptop" prompt (see §4.8) |
| **Sub-mobile** | < 375 px | Unsupported; degrades to plain vertical scroll of all content |

Breakpoint names match what the existing `app/globals.css` tends to use so
the `@media` blocks are readable by anyone already in the codebase.

### 4.2 The 12-column grid (desktop)

The cockpit sits inside a standard page container with a 12-column grid,
24 px gutters, and a 1440 px max content width. Horizontal padding matches
the app shell: 32 px desktop, 24 px laptop, 20 px tablet.

```
|--- col 1 ---|--- 2 ---|--- 3 ---|--- 4 ---|--- 5 ---|--- 6 ---|
|--- col 7 ---|--- 8 ---|--- 9 ---|--- 10 ---|--- 11 ---|--- 12 ---|

FeedbackPanel: grid-column: 1 / span 7   (columns 1-7)
SignalPanel:   grid-column: 8 / span 5   (columns 8-12)
```

**Why 7/5 and not 8/4 or 6/6?**

- 6/6 puts the score matrix and the feed at equal visual weight, which is
  wrong — the chair reads narrative more than they scan the matrix.
- 8/4 is too narrow on the right; at 1280 px laptop width the score
  matrix columns start crushing (32 px cells become unreadable).
- 7/5 gives the feed ~760 px (enough for comfortable reading at 14 px
  type, ~14 words per line) and the right rail ~520 px (enough for a
  4-column score matrix with readable cells).

At laptop breakpoint (1024–1279 px) the split slides to 8/4 because the
total grid width drops from ~1408 px to ~960 px, and the right rail
can't afford to stay wide without cannibalizing feed readability. The
score matrix adapts — see §4.6.

### 4.3 Fold anatomy

The "fold" is the viewport height below the sticky snapshot bar, before
the dock. On a standard laptop (1440 × 900), that's roughly **716 px**
of visible content:

```
┌──────────────────────────────────────┐  y = 0
│  ApplicantSnapshotBar       72 px    │  (sticky)
├──────────────────────────────────────┤  y = 72
│                                      │
│  ReviewWorkspace                     │
│  ┌─────────────────┬──────────────┐  │
│  │ Feedback        │ Signal       │  │
│  │  · Consensus    │  · Matrix    │  │  ← everything in the fold
│  │  · Risk pill    │  · Readiness │  │
│  │  · Feed start   │  · Docs peek │  │
│  │                 │              │  │
│  └─────────────────┴──────────────┘  │
│                                      │  y = 788 (fold edge)
│   (scroll zone continues below)      │
│                                      │
├──────────────────────────────────────┤  y = 900 - 112 = 788
│  DecisionDock              112 px    │  (sticky)
└──────────────────────────────────────┘  y = 900
```

**What must fit above the fold at 1440 × 900:**

Left column (feedback, ~760 px wide):
- Consensus headline + sentiment chip row (~120 px)
- Risk flags pill (~40 px)
- Top of activity feed — first 2 pinned items OR 3 chronological items
  (~480 px)

Right column (signal, ~520 px wide):
- Score comparison matrix condensed (~240 px — reviewers × 4 categories)
- Readiness meter ring + legend (~180 px)
- Quick documents row (~80 px)

Nothing below the fold is critical to the default decision. The timeline,
full matrix, full feed, and internal notes all live below, one scroll away.

### 4.4 Sticky regions and z-index

Three sticky regions, one floating overlay layer, one modal layer.

```
z-index scale (explicit, no magic numbers)
─────────────────────────────────────────
  0   canvas / default flow
  1   SnapshotBar contents
  10  SnapshotBar container (sticky top)
  20  DecisionDock container (sticky bottom)
  30  QueueNavigator dropdown, tooltips, hover cards
  40  Toast region (decision confirmation, save state)
  50  Modal backdrop (decision confirm, keyboard help)
  60  Modal content
  70  Global UI (error boundary banners)
```

Sticky behavior:
- **SnapshotBar** — `position: sticky; top: 0;`. Always visible on scroll.
- **SignalPanel** — `position: sticky; top: calc(72px + 24px);`. The right
  rail stays in view while the chair scrolls the feed. This is the key
  move: the score matrix, readiness meter, and risk flags are reference
  data; they should not scroll away while the chair reads narrative.
- **DecisionDock** — `position: sticky; bottom: 0;`. Always accessible.

Page container has `padding-bottom: 136px` (dock height + gap) so content
never occludes under the dock.

### 4.5 Scroll regions

The page itself scrolls. Inside the page, **no nested scroll containers** —
nested scrollbars are disorienting and a mobile accessibility anti-pattern.
Two implications:

1. **The activity feed is not a fixed-height scroll box.** It grows to its
   natural height and scrolls with the page. The right rail staying
   sticky is what makes this work.
2. **The score matrix overflows horizontally on narrow screens** — it
   gets its own `overflow-x: auto` with a subtle gradient mask on the
   right edge to hint at more content. Only this one element is allowed
   a nested scroll, and only on the x-axis.

### 4.6 Score matrix responsive behavior

The matrix is the densest signal on the page; it needs its own plan.

**Desktop (≥ 1280 px, right rail ~520 px):** 4-column compact layout.
Rows = reviewers (up to 4: reviewer + up to 3 interviewers). Columns =
the 4 most divergent categories (computed by variance). Cell is 48 × 48 px
with a color chip + label. "Show all 7 categories" expands to a full
7-column matrix overlaid in a `<details>` disclosure.

**Laptop (1024–1279 px, right rail ~360 px):** 3-column matrix. Categories
are chosen by the same variance rule. "Show all" expands to the full grid
in a side-by-side overlay.

**Tablet (768–1023 px, right rail → top strip):** Horizontal scroll
strip. Rows become columns; the chair swipes left/right across reviewers.
This is the one exception to "no nested scroll." Scroll snap points align
with each reviewer column so swipe feels deliberate.

**Mobile:** Not first-class. Shows a read-only summary row ("3 reviewers,
2 Hire, 1 Hold — open on laptop to compare") and hides the full matrix.

### 4.7 Tablet collapse strategy

At 1023 px and below, the two-column workspace collapses into a single
column. The right rail (signal panel) moves **above** the feedback panel,
not below, because the signals are calibration data — the chair wants to
see them before they read narrative.

```
Tablet order (top → bottom):
  1. ApplicantSnapshotBar (sticky)
  2. SignalPanel (score matrix condensed, readiness ring, risk pill, docs)
  3. FeedbackPanel (consensus, activity feed, pinned)
  4. DecisionDock (sticky)
```

CSS:
```css
@media (max-width: 1023px) {
  .review-workspace {
    grid-template-columns: 1fr;
  }
  .review-workspace__right { order: -1; }   /* signal panel first */
  .review-workspace__left  { order: 0; }
}
```

The dock's decision buttons reflow from inline row to a 2-column grid
(Approve and Reject as equal-width primary/destructive; other three
stack below as a secondary row).

### 4.8 Mobile: deliberately read-only

Chairs occasionally review on phone (coffee shop, commute). Building a
fully responsive decision surface for 375 px width is not worth the
effort — it encourages rushed decisions and loses the matrix entirely.
Our choice:

**At < 768 px, the cockpit renders a read-only summary:**
- Applicant snapshot (full)
- Consensus headline
- Interviewer recommendations as stacked chips (no matrix)
- Risk flags (full)
- Activity feed (full, chronological only — no pinning)
- A prominent button: *"Open on laptop to decide"* with a "send me this
  link" option that emails the chair the URL

Decision actions are **hidden** on mobile. A chair can read context and
prepare mentally, but cannot approve/reject from their phone. This is a
deliberate product choice — the hiring decision is too important to
make on glass. Called out in §9 as a decision to confirm with product.

### 4.9 Touch target and focus sizing

- All interactive elements ≥ 44 × 44 px on tablet and below (WCAG 2.5.8).
- Desktop decision buttons are 44 px tall; secondary buttons 36 px; chips
  32 px (chips aren't primary decision actions).
- Focus ring: `2 px solid var(--ypp-primary)` with `2 px` offset. Visible
  on every interactive element including the dock buttons, where the
  ring sits *inside* the button to avoid being clipped by the sticky
  container.

### 4.10 Content reflow rules

Six rules the layout must respect, in priority order:

1. **The dock never covers content.** Page container padding-bottom
   matches dock height + 24 px gap at every breakpoint.
2. **The snapshot bar never covers focused content.** When a field gets
   keyboard focus via Tab, scroll-padding-top on the page container
   equals snapshot bar height (`scroll-padding-top: 96px`) so the
   focused element lands below the bar, not under it.
3. **Long applicant names ellipsize.** `max-width` on the identity block
   with `text-overflow: ellipsis`. Full name available via hover tooltip.
4. **Long category labels wrap once, then ellipsize.** Two-line max in
   matrix column headers.
5. **Feed items with code-like long strings wrap at word boundaries
   where possible, character boundaries when not.** `overflow-wrap: anywhere`
   on signal bodies.
6. **Right rail never exceeds 520 px.** Wider than this and the matrix
   starts feeling like the primary content, breaking hierarchy.

### 4.11 Print and export

Chairs occasionally export a decision record for a candidate file. We
don't ship a custom print stylesheet in this redesign, but the layout
must not break:

- `@media print { .decision-dock, .queue-navigator { display: none } }`
- Background colors print as white; text prints as `--ink-default`.
- Sticky positions become static.

A proper "Export to PDF" feature is a §9 future-work item, not shipped in
v1 of the redesign.

### 4.12 Layout at a glance (summary table)

| Zone | Desktop ≥1280 | Laptop 1024–1279 | Tablet 768–1023 | Mobile <768 |
|------|---------------|------------------|-----------------|-------------|
| SnapshotBar | Sticky 72 px, full width, 12 cols | Sticky 72 px | Sticky 88 px (wraps) | Static 120 px |
| FeedbackPanel | 7 cols | 8 cols | Full width, below signals | Full width |
| SignalPanel | 5 cols, sticky | 4 cols, sticky | Full width, above feedback | Condensed |
| ScoreMatrix | 4 divergent cols | 3 divergent cols | Horizontal scroll strip | Summary chip only |
| DecisionDock | Sticky 112 px | Sticky 112 px | Sticky 144 px (stacked rows) | Hidden (read-only) |
| Page max-width | 1440 px | 100% of container | 100% | 100% |
| Gutter | 32 px | 24 px | 20 px | 16 px |

---

## 5. Components — Phase 1: Shell & Layout Primitives

**Phase 1 mission:** ship the skeleton. After Phase 1 merges, a chair can
navigate to the new route, see the applicant identity, feel the page
architecture, and scroll through placeholder panels — but cannot yet make
a decision. This phase is deliberately decoupled from decision logic so
we can validate the data flow, sticky layout, motion system, and design
tokens in isolation before adding behavior.

It's also where the shared primitives (`ReviewerIdentityChip`,
`RecommendationBadge`, `RatingChip`, `SaveStateIndicator`) get extracted
and exercised, because every later phase depends on them.

**Exit criteria for Phase 1:**
1. Route `/admin/instructor-applicants/[id]/review` loads behind the
   `ENABLE_FINAL_REVIEW_V2` flag with real application data in the
   identity and queue positions
2. Snapshot bar and decision dock placeholders are sticky; right rail is
   sticky; scroll behavior matches §4
3. Framer Motion `MotionConfig` respects `prefers-reduced-motion`
4. Focus management: tabbing through all interactive placeholders
   follows visual order, focus rings visible, no `outline: none`
5. Visual regression snapshots taken at all four breakpoints
6. Zero decision actions wired up (placeholders only)

### 5.1 Components in this phase

| # | Component | File | LOC | Client? |
|---|-----------|------|-----|---------|
| 1 | `FinalReviewCockpit` | `components/instructor-applicants/final-review/FinalReviewCockpit.tsx` | ~150 | yes |
| 2 | `FinalReviewContext` | `components/instructor-applicants/final-review/FinalReviewContext.tsx` | ~90 | yes |
| 3 | `ReviewWorkspace` | `components/instructor-applicants/final-review/ReviewWorkspace.tsx` | ~40 | no |
| 4 | `FeedbackPanel` | `components/instructor-applicants/final-review/FeedbackPanel.tsx` | ~30 | no |
| 5 | `SignalPanel` | `components/instructor-applicants/final-review/SignalPanel.tsx` | ~30 | no |
| 6 | `ReviewerIdentityChip` (shared) | `components/instructor-applicants/shared/ReviewerIdentityChip.tsx` | ~50 | no |
| 7 | `RecommendationBadge` (shared) | `components/instructor-applicants/shared/RecommendationBadge.tsx` | ~40 | no |
| 8 | `RatingChip` (shared) | `components/instructor-applicants/shared/RatingChip.tsx` | ~40 | no |
| 9 | `SaveStateIndicator` (shared) | `components/shared/SaveStateIndicator.tsx` | ~50 | yes |

Plus CSS additions in `app/globals.css` covering the layout, surfaces,
and tokens defined in §2 — approximately 200 LOC scoped to Phase 1.

### 5.2 `FinalReviewCockpit` — the client shell

**Purpose.** Top-level client component mounted by the server route. Owns
the cross-section context, Framer Motion config, and the skip-to-dock
accessibility link.

**Props.**
```ts
interface FinalReviewCockpitProps {
  application: SerializedApplicationForReview;
  timeline: SerializedTimelineEvent[];
  queue: QueueNeighbors;                // prev/next/position/total/siblings
  initialDraft: ChairDraftSnapshot;     // { rationale, comparisonNotes, savedAt }
  consensus: ConsensusSnapshot | null;  // Phase 3 populates this; Phase 1 accepts null
  actorId: string;
}
```

**State.** None at the top level — all state is delegated to
`FinalReviewContext`. The cockpit is a composition shell.

**Motion.** Wraps the page body in `<MotionConfig reducedMotion="user">`.
Mounts a single `<AnimatePresence>` that wraps the route transition, so
cross-applicant navigation uses the fade-and-slight-Y pattern (§2.6).

**Loading/empty/error.** Delegates to route-level `loading.tsx` and
`error.tsx`. If `application.status !== "CHAIR_REVIEW"`, renders a
read-only banner *"Decision already recorded — view audit trail below"*
and continues to render the timeline for audit.

### 5.3 `FinalReviewContext` — cross-section state

**Purpose.** A React Context owning the two pieces of state that need to
be visible to multiple sibling sections: `focusedReviewerId` (for matrix
↔ feed highlighting) and `pinnedSignalIds` (for the pinned rail).

**API.**
```ts
interface FinalReviewContextValue {
  focusedReviewerId: string | null;
  setFocusedReviewerId: (id: string | null) => void;
  pinnedSignalIds: string[];
  togglePin: (signalId: string) => void;
  quoteIntoRationale: (signalId: string) => void;  // wire-ready; Phase 2 uses it
}

export function FinalReviewProvider({ children, initialPinned }: ...): JSX.Element;
export function useFinalReviewContext(): FinalReviewContextValue;
export function useFocusedReviewer(): [string | null, (id: string | null) => void];
export function usePinnedSignals(): { ids: string[]; toggle: (id: string) => void };
```

**URL sync.** Both pieces of state read from and write to `URLSearchParams`
on mount and on change, per §3.5. `setFocusedReviewerId(id)` calls
`router.replace(?focusedReviewer=...)` without scroll.

**Why split into two hooks.** `useFocusedReviewer` and `usePinnedSignals`
expose minimal slices so the matrix re-renders on focus change without
the entire feed re-rendering on pin change. Context split can come later
if the profiler shows waste; for v1, one context, two narrow hooks.

### 5.4 `ReviewWorkspace` / `FeedbackPanel` / `SignalPanel`

Three thin layout wrappers — pure presentation, zero state.

| Component | Purpose | CSS class |
|-----------|---------|-----------|
| `ReviewWorkspace` | 12-col grid per §4; responsive reflow | `.review-workspace` |
| `FeedbackPanel` | Left column (7 cols), stacks children with `--space-4` gap | `.feedback-panel` |
| `SignalPanel` | Right column (5 cols), sticky below snapshot bar | `.signal-panel` |

**Props.** `{ children: React.ReactNode }` for all three.

**State.** None.

**Why not CSS-only.** These could be raw `<section>` tags with class
names. We wrap them as components so that (a) the contract is documented,
(b) future `aria-labelledby` wiring has a place to live, and (c) the
Framer Motion scroll context — if we add one — has a natural mount
point.

### 5.5 Shared primitive — `ReviewerIdentityChip`

**Purpose.** Avatar + name + role pill. Used in the score matrix rows,
activity feed item headers, consensus dissent callout, and the existing
`ApplicantCockpitHeader` owner chips. Replaces at least three
copy-pasted implementations currently in the codebase.

**Props.**
```ts
interface ReviewerIdentityChipProps {
  user: { id: string; name: string | null; avatarUrl?: string | null };
  role: "LEAD_INTERVIEWER" | "INTERVIEWER" | "REVIEWER" | "CHAIR" | "STAFF" | "SYSTEM";
  round?: number;                    // "· Interview Round 2"
  size?: "sm" | "md" | "lg";
  onClick?: () => void;              // optional, for clickable variant in matrix
}
```

**Visual.** Role drives the pill color (per §2.5). Name uses
`--font-body`; role pill uses `--font-label` (uppercase, tracked). No
avatar image uploaded? Render initials circle in `--ypp-purple-400`.

**Motion.** None in Phase 1. Phase 2 adds a subtle hover state (scale
1.02, 120 ms) for clickable variants.

### 5.6 Shared primitive — `RecommendationBadge`

**Purpose.** Single source of truth for recommendation and sentiment
labels + colors. Replaces the `REC_COLOR` inline-style map currently
duplicated in `ChairComparisonSlideout.tsx:73-78` and
`ChairQueueBoard.tsx:63-75`.

**Props.**
```ts
interface RecommendationBadgeProps {
  recommendation?: InstructorInterviewRecommendation | null;
  sentiment?: SentimentTag | null;   // Phase 3 passes this; Phase 1 ignores
  size?: "sm" | "md";
  showIcon?: boolean;                // default true — WCAG fix (§2.9)
}
```

**Behavior.** If both `recommendation` and `sentiment` are passed, the
sentiment wins (derived from recommendation per §8's mapping table).
Missing recommendation renders as a muted *"Not yet reviewed"* chip.

**Icons.** Uses lucide-react per §2.9:
- `STRONG_HIRE` → `Check` with `--score-strong`
- `HIRE` → `ThumbsUp` with `--score-good`
- `MIXED` → `Minus` with `--score-mixed`
- `CONCERN` → `AlertTriangle` with `--score-concern`
- `REJECT` → `X` with `--score-weak`

### 5.7 Shared primitive — `RatingChip`

**Purpose.** Renders a `ProgressStatus` rating (the 4-point
`BEHIND_SCHEDULE | GETTING_STARTED | ON_TRACK | ABOVE_AND_BEYOND` scale)
as an icon + label + color chip. Used in the score matrix cells and in
activity feed items that surface a category rating.

**Props.**
```ts
interface RatingChipProps {
  rating: ProgressStatus | null;
  label?: string;                 // optional category label ("Communication")
  variant?: "solid" | "outline";  // solid for cells, outline for inline callouts
  size?: "xs" | "sm" | "md";
}
```

**WCAG fix.** Always pairs color with the icon from §2.9's
`SCORE_DISPLAY` map + a 2–5 letter text label. Color is never the sole
signal. Deuteranopia and high-contrast mode both preserve meaning.

**Empty state.** Missing rating renders as a dashed-outline chip with
"—" label, not a red or gray "fail" state. This matters because a
missing rating is "not yet scored," not "poor."

### 5.8 Shared primitive — `SaveStateIndicator`

**Purpose.** The autosave status chip used in the decision dock's
`DraftRationaleField` (Phase 2) and ready for reuse in any future inline
editor. One of the five signature micro-interactions (§2.7).

**Props.**
```ts
interface SaveStateIndicatorProps {
  state: "idle" | "saving" | "saved" | "error";
  lastSavedAt: string | null;   // ISO; drives "Saved 3s ago" ticker
  onRetry?: () => void;         // shown when state = "error"
}
```

**Behavior.**
- `idle` → hidden
- `saving` → pulsing purple dot + "Saving…"
- `saved` → green dot (200 ms scale-in per §2.6 micro-feedback) + ticker
  label "Saved 3s ago" / "Saved 1m ago" (update every 10 s via
  `setInterval` inside a `useEffect`)
- `error` → amber dot + "Couldn't save — retry" with clickable retry

**Motion.** Dot pulse uses a 2-frame Framer keyframes animation, 1.2 s
cycle, respects reduced-motion (swaps to a static dot). The scale-in
on `saved` is a 200 ms spring with `stiffness: 380, damping: 22`.

### 5.9 Files touched in Phase 1

| Status | Path | Notes |
|--------|------|-------|
| [NEW] | `app/(app)/admin/instructor-applicants/[id]/review/page.tsx` | Server route, five-query fetch per §3.3 |
| [NEW] | `app/(app)/admin/instructor-applicants/[id]/review/loading.tsx` | Skeleton per §2.8 |
| [NEW] | `app/(app)/admin/instructor-applicants/[id]/review/error.tsx` | Route error boundary |
| [NEW] | `components/instructor-applicants/final-review/FinalReviewCockpit.tsx` | §5.2 |
| [NEW] | `components/instructor-applicants/final-review/FinalReviewContext.tsx` | §5.3 |
| [NEW] | `components/instructor-applicants/final-review/ReviewWorkspace.tsx` | §5.5 |
| [NEW] | `components/instructor-applicants/final-review/FeedbackPanel.tsx` | §5.5 |
| [NEW] | `components/instructor-applicants/final-review/SignalPanel.tsx` | §5.5 |
| [NEW] | `components/instructor-applicants/shared/ReviewerIdentityChip.tsx` | §5.6 |
| [NEW] | `components/instructor-applicants/shared/RecommendationBadge.tsx` | §5.7 |
| [NEW] | `components/instructor-applicants/shared/RatingChip.tsx` | §5.8 |
| [NEW] | `components/shared/SaveStateIndicator.tsx` | §5.9 |
| [NEW] | `lib/final-review-queries.ts` | `getApplicationForFinalReview`, `getChairQueueNeighbors`, `getChairDraft` |
| [MODIFY] | `lib/feature-flags.ts` | Add `ENABLE_FINAL_REVIEW_V2` flag helper |
| [MODIFY] | `app/globals.css` | ~200 LOC of tokens + layout classes from §2 + §4 |
| [MODIFY] | `components/instructor-applicants/ApplicantCockpitHeader.tsx` | Swap inline owner-chip markup for `<ReviewerIdentityChip>` |
| [MODIFY] | `components/instructor-applicants/ChairQueueBoard.tsx` | Delete `REC_COLOR`/`REC_LABELS` maps, use `<RecommendationBadge>` |

### 5.10 Dependencies between Phase 1 components

```
FinalReviewCockpit
  ├── MotionConfig (framer-motion)
  ├── FinalReviewContext.Provider
  └── ReviewWorkspace
        ├── FeedbackPanel (placeholder children in Phase 1)
        └── SignalPanel   (placeholder children in Phase 1)

Shared primitives (standalone, zero dependencies between them):
  ReviewerIdentityChip, RecommendationBadge, RatingChip, SaveStateIndicator
```

No circular dependencies. The shared primitives can be built in parallel
by a second developer while the shell is being built.

### 5.11 Phase 1 risks

- **CSS bloat.** `app/globals.css` is already 9000+ lines. Adding 200
  more without structure invites entropy. Mitigation: put the new Phase 1
  styles under a clear `/* ======= Final Review Cockpit: Phase 1 =======
  */` block so Phase 2 and 3 can find their insertion points.
- **Framer Motion bundle size.** Pulls ~25 kB gzipped. Acceptable per
  §7's 80 kB budget but leaves less headroom for Phase 3. Audit with
  `@next/bundle-analyzer` before merging Phase 1.
- **Context re-render storms.** If a future contributor adds state to
  `FinalReviewContext` without splitting providers, matrix + feed can
  re-render unnecessarily. Mitigation: add a Storybook performance test
  as part of Phase 1's exit criteria.

---

## 6. Components — Phase 2A: Snapshot & Queue Navigator

**Phase 2A mission:** give the chair situational awareness and queue
control. After 2A merges, a chair can open any applicant, instantly
understand who they're looking at, see how ready they are to decide,
and walk prev/next through the queue with keyboard or click. They
*still cannot decide* — the dock stays a placeholder until Phase 2B.

Why the split matters: Phase 2A is low-risk, reversible, and
information-density work. Phase 2B is the transactional, high-risk
work that grants roles and sends emails. Keeping them separate lets
2A ship and get real-user feedback on the header system before 2B's
server-action wiring hits production.

**Exit criteria for Phase 2A:**
1. Snapshot bar renders identity, status, subjects, owners, and
   days-in-queue at all four breakpoints
2. `DecisionReadinessMeter` accurately reflects the four signals
   (interviews, materials, recommendation, info requests)
3. Queue navigator prev/next works with `<Link prefetch>` — click
   navigation lands the next route in under 200 ms on warm cache
4. Dropdown lists remaining queued applicants, sortable
5. If `status !== CHAIR_REVIEW`, `ApplicantStatusBanner` replaces the
   readiness meter with a read-only decided-by summary
6. Post-decision toast component exists (mounted, not yet triggered)
7. Analytics events `final_review.viewed` and `final_review.queue_advance`
   fire

### 6.1 Components in this phase

| # | Component | File | LOC | Client? |
|---|-----------|------|-----|---------|
| 1 | `ApplicantSnapshotBar` | `components/instructor-applicants/final-review/ApplicantSnapshotBar.tsx` | ~160 | yes |
| 2 | `ApplicantIdentity` | `components/instructor-applicants/final-review/ApplicantIdentity.tsx` | ~90 | no |
| 3 | `DecisionReadinessMeter` (compact) | `components/instructor-applicants/final-review/DecisionReadinessMeter.tsx` | ~130 | yes |
| 4 | `QueueNavigator` | `components/instructor-applicants/final-review/QueueNavigator.tsx` | ~180 | yes |
| 5 | `QueueSiblingDropdown` | `components/instructor-applicants/final-review/QueueSiblingDropdown.tsx` | ~120 | yes |
| 6 | `ApplicantStatusBanner` | `components/instructor-applicants/final-review/ApplicantStatusBanner.tsx` | ~80 | no |
| 7 | `PostDecisionToast` (shell) | `components/instructor-applicants/final-review/PostDecisionToast.tsx` | ~90 | yes |

Plus ~120 LOC of CSS in `app/globals.css` scoped to Phase 2A.

### 6.2 `ApplicantSnapshotBar` — the sticky header

**Purpose.** The 72 px sticky bar that carries applicant identity, the
compact readiness meter, and the queue navigator. The one element that
never leaves the chair's view as they scroll.

**Props.**
```ts
interface ApplicantSnapshotBarProps {
  application: {
    id: string;
    status: InstructorApplicationStatus;
    preferredFirstName: string | null;
    legalName: string | null;
    applicant: { id: string; name: string | null; email: string };
    chapter: { id: string; name: string } | null;
    subjectsOfInterest: string | null;
    schoolName: string | null;
    graduationYear: number | null;
    chairQueuedAt: string | null;
    materialsReadyAt: string | null;
    interviewerAssignments: InterviewerAssignment[];
    reviewer: { id: string; name: string | null } | null;
  };
  readiness: ReadinessSignals;
  queue: QueueNeighbors;
  latestDecision?: ChairDecisionSummary | null;
}
```

**State.** None — purely derived from props. The hover/dropdown state
lives in the child `QueueNavigator`.

**Layout.**
- Left (grid-cols 1–6): `<ApplicantIdentity size="md">`
- Center (grid-cols 7–9): compact `<DecisionReadinessMeter compact>` OR
  `<ApplicantStatusBanner>` if decision already recorded
- Right (grid-cols 10–12): `<QueueNavigator>` with prev/next/counter

At tablet, wraps to two rows (identity on top, meter + queue below).

**Motion.** On first mount, fade-in-from-below (y: -8 → 0, 200 ms
easeOut). On applicant change, the avatar inside `<ApplicantIdentity>`
uses `layoutId="applicant-avatar"` so it morphs between applicants
during queue advance (§2.7 signature interaction).

### 6.3 `ApplicantIdentity`

**Purpose.** Avatar + name + status pill + chapter + subject +
days-in-queue. The "who is this person" block, used in the snapshot
bar, in the confirm modal header, and in queue dropdown rows.

**Props.**
```ts
interface ApplicantIdentityProps {
  applicant: { id: string; name: string | null; avatarUrl?: string | null };
  preferredFirstName: string | null;
  legalName: string | null;
  status: InstructorApplicationStatus;
  chapterName: string | null;
  subjectsOfInterest: string | null;  // CSV
  daysInQueue: number | null;          // computed from chairQueuedAt
  schoolName?: string | null;
  graduationYear?: number | null;
  size?: "sm" | "md" | "lg";
  showSchoolLine?: boolean;            // default true at md/lg, false at sm
}
```

**Composition rules.**
- Display name = `preferredFirstName ?? legalName ?? applicant.name ?? "—"`
- If both preferred and legal differ, render `"Preferred (Legal)"` style,
  legal in `--ink-muted`
- Status pill uses the existing `.pill.pill-*` classes from
  `globals.css`, reused verbatim for consistency with the kanban
- Subjects split on CSV → max 2 pill chips visible, `"+N more"` chip for
  overflow, full list in a hover tooltip
- Days-in-queue shows `"2d in queue"` if `daysInQueue ≥ 1`, `"queued today"`
  otherwise; `null` hides the pill
- Long names truncate per §4.10 rules

**Accessibility.** Full legal name is announced via `aria-label` on the
display-name heading so screen readers don't miss it if the rendered
form is ambiguous.

### 6.4 `DecisionReadinessMeter` — the calibration ring

**Purpose.** A 48 px conic-gradient SVG ring showing how many of the
four readiness signals are met. Hover/tap on each segment surfaces the
specific gap. One of the three core trust mechanisms from §1.6.

**Props.**
```ts
interface DecisionReadinessMeterProps {
  signals: {
    hasSubmittedInterviewReviews: boolean;       // ≥1 interview review with status=SUBMITTED
    hasMaterialsComplete: boolean;               // course outline + first class plan uploaded
    hasReviewerRecommendation: boolean;          // InstructorApplicationReview.status=SUBMITTED
    hasNoOpenInfoRequest: boolean;               // infoRequest === null
  };
  compact?: boolean;                             // snapshot bar vs right rail
}
```

**Visual.** Four arc segments, each 90°, colored `--score-good` when
complete, `--ink-faint` when incomplete. Center shows count: `3 / 4`
in `--font-headline`. Below the ring (or to the right in compact mode),
a legend lists the four signals with check/empty icons.

**Motion.** On mount, each completed segment animates from 0° to 90°
over 300 ms with a 60 ms stagger — the ring "fills in" rather than
appearing whole. Reduced-motion renders filled immediately.

**Interaction.** Hovering any segment opens a popover (via floating-ui,
already in deps) showing the specific gap: *"Missing: 1 of 2 interview
reviews (Alex Chen — DRAFT)"*. Click opens the feed filtered to that
source (Phase 3 wires the filter action; Phase 2A shows the popover
only).

**Empty/error states.** All four false → ring is fully gray, center
shows `0 / 4`, helper text below: *"Application isn't ready for a
decision yet."*

### 6.5 `QueueNavigator`

**Purpose.** Prev/next arrows + position counter + sibling dropdown
trigger. The chair's way to walk the queue without returning to the
kanban.

**Props.**
```ts
interface QueueNavigatorProps {
  currentId: string;
  prevId: string | null;
  nextId: string | null;
  position: number;                    // 1-indexed
  total: number;
  siblings: QueueSibling[];            // for the dropdown
}

type QueueSibling = {
  id: string;
  displayName: string;
  chapterName: string | null;
  daysInQueue: number | null;
  recommendation: "STRONG_HIRE" | "HIRE" | "MIXED" | "CONCERN" | "REJECT" | null;
};
```

**Behavior.**
- Arrow buttons use `<Link prefetch>` so hover primes the next route
- Disabled state when prev/next is null (end of queue)
- Position counter reads `"3 of 12"` in `--font-label`
- Clicking the counter opens `<QueueSiblingDropdown>`
- Arrow buttons are large tap targets (44 × 44 px) with clearly
  distinct disabled states — no need to hunt for where to click

**Motion.** Arrow buttons have a 120 ms translateX press effect (-2 px
on press, 0 on release). Queue-advance arrow briefly shows a success
check glyph before the navigation fires — gives the chair visual
confirmation their keystroke landed.

**Edge cases.**
- `total === 1` → hide arrows, hide dropdown, keep the counter
- `total === 0` → component returns null
- Queue changes mid-session (another chair decides on one of the
  siblings) → `router.refresh()` on the snapshot after a decision
  commits, which reloads queue neighbors

### 6.6 `QueueSiblingDropdown`

**Purpose.** The full list of remaining queued applicants, sortable by
days-in-queue, chapter, or recommendation strength. Lets the chair
jump non-sequentially (do all same-chapter in batch, or clear the
oldest first).

**Props.**
```ts
interface QueueSiblingDropdownProps {
  siblings: QueueSibling[];
  currentId: string;
  anchorRef: RefObject<HTMLElement>;
  onClose: () => void;
}
```

**State.** Local `sortKey` (default `"daysInQueue-desc"`), local
`searchQuery` for quick-filter.

**Rendering.** Each row is an `<ApplicantIdentity size="sm">` + a
`<RecommendationBadge size="sm">` (Phase 3 data; Phase 2A renders
"—" when null). Click navigates via `<Link>`. `Tab` cycles through
rows with focus ring.

**Max height.** 480 px with internal scroll. If siblings.length < 8,
fits without scroll. Scrolls within itself (allowed exception to §4.5's
"no nested scroll" rule — this is a floating overlay, not inline
content).

**Accessibility.** `role="listbox"`, each row `role="option"`. `Esc`
closes. Focus returns to the counter trigger on close.

### 6.7 `ApplicantStatusBanner`

**Purpose.** When the application is no longer in `CHAIR_REVIEW` (already
approved, rejected, on hold, waitlisted, withdrawn), the snapshot bar
replaces the readiness meter with a read-only banner summarizing the
latest decision. This is the "audit view" — the chair can read context
and timeline but cannot re-decide.

**Props.**
```ts
interface ApplicantStatusBannerProps {
  status: InstructorApplicationStatus;
  latestDecision: ChairDecisionSummary | null;
  // includes: action, chair name, decidedAt, rationale preview, conditions count
}
```

**Visual.** A single-line banner with a status-colored left border,
icon, and text like *"Approved with conditions by Alex Chen · 2 days
ago"*. Click opens a detail popover with full rationale and
superseded-decisions link.

**Rescind affordance.** If the current actor has `SUPER_ADMIN` role,
a subtle *"Rescind decision"* link appears on hover. Clicking opens
the Phase 2B rescind flow (not available in 2A; link is disabled with
tooltip *"Rescind flow coming in Phase 2B"*).

### 6.8 `PostDecisionToast` (shell)

**Purpose.** The toast that appears after `chairDecide` succeeds,
offering the next applicant with their avatar + name. Phase 2A ships
the *component* (mount, slot, styling); Phase 2B wires up the trigger
from the confirm modal's success handler.

**Props.**
```ts
interface PostDecisionToastProps {
  open: boolean;
  decidedAction: ChairDecisionAction | null;
  decidedApplicant: { name: string; chapterName: string | null } | null;
  nextApplicant: { id: string; name: string; avatarUrl?: string | null; chapterName: string | null } | null;
  onDismiss: () => void;
  onAdvance: () => void;               // navigates to nextApplicant
}
```

**Behavior.**
- Slides up from the dock region (400 ms spring per §2.6 surface-entry)
- Auto-dismisses after 8 s unless hovered (pauses the timer)
- Primary CTA button inside the toast is autofocused, so a single
  `Enter` press (the universal browser behavior, not a custom hotkey)
  triggers `onAdvance`
- If `nextApplicant === null`, shows *"Queue cleared — nice work"* with
  a link back to the chair queue page

**Motion.** Avatar morphs via `layoutId="applicant-avatar"` from the
snapshot bar into the toast, then after advance morphs again into the
new snapshot bar. Zero jump cuts.

**Accessibility.** `role="status"` with `aria-live="polite"` so screen
readers announce the result without stealing focus. The advance button
is the autofocused element when the toast opens.

### 6.9 Files touched in Phase 2A

| Status | Path | Notes |
|--------|------|-------|
| [NEW] | `components/instructor-applicants/final-review/ApplicantSnapshotBar.tsx` | §6.2 |
| [NEW] | `components/instructor-applicants/final-review/ApplicantIdentity.tsx` | §6.3 |
| [NEW] | `components/instructor-applicants/final-review/DecisionReadinessMeter.tsx` | §6.4 — replaces the existing `DecisionReadinessChecklist` inline styles with tokenized CSS |
| [NEW] | `components/instructor-applicants/final-review/QueueNavigator.tsx` | §6.5 |
| [NEW] | `components/instructor-applicants/final-review/QueueSiblingDropdown.tsx` | §6.6 |
| [NEW] | `components/instructor-applicants/final-review/ApplicantStatusBanner.tsx` | §6.7 |
| [NEW] | `components/instructor-applicants/final-review/PostDecisionToast.tsx` | §6.8 shell only |
| [NEW] | `lib/readiness-signals.ts` | Pure function `computeReadinessSignals(application)` returning the 4 booleans |
| [MODIFY] | `components/instructor-applicants/final-review/FinalReviewCockpit.tsx` | Mount snapshot bar as first child of page body |
| [MODIFY] | `lib/final-review-queries.ts` | Extend `getChairQueueNeighbors` to include `siblings` with recommendation data |
| [MODIFY] | `app/globals.css` | ~120 LOC of snapshot-bar + meter-ring + dropdown styles under a `/* Phase 2A */` block |
| [DEPRECATE] | `components/instructor-applicants/DecisionReadinessChecklist.tsx` | Kept as-is for the old applicant detail panel; cockpit uses the new meter |

### 6.10 Dependencies between Phase 2A components

```
ApplicantSnapshotBar
  ├── ApplicantIdentity (size="md")                    — from Phase 1 primitives
  ├── DecisionReadinessMeter (compact)
  │     └── floating-ui popover (already in deps)
  ├── ApplicantStatusBanner (conditional)
  └── QueueNavigator
        └── QueueSiblingDropdown
              └── ApplicantIdentity (size="sm")

PostDecisionToast (mounted at cockpit root, not inside snapshot bar)
  ├── ApplicantIdentity (size="sm")
  └── RecommendationBadge                              — from Phase 1 primitives
```

All Phase 2A components depend only on Phase 1 primitives. Nothing
depends on the decision dock or the feedback feed. Safe to ship behind
the feature flag alone.

### 6.11 Analytics events introduced in Phase 2A

| Event | Payload | Purpose |
|-------|---------|---------|
| `final_review.viewed` | `{ applicationId, source: "kanban" \| "queue" \| "direct" \| "toast" }` | Entry-point attribution |
| `final_review.queue_advance` | `{ from: applicationId, to: applicationId, method: "click" \| "keyboard" \| "toast" }` | Measure keyboard adoption |
| `final_review.sibling_dropdown_opened` | `{ applicationId, queueTotal }` | Is non-sequential navigation valuable? |
| `final_review.readiness_segment_hovered` | `{ applicationId, segment: "interviews" \| "materials" \| "recommendation" \| "info_request" }` | Which readiness gaps chairs care about most |

All events go through the existing `trackEvent` helper (`lib/analytics-actions.ts`).

### 6.12 Phase 2A risks

- **`layoutId` avatar morph regression.** Framer Motion's layout
  animations can flicker if the parent container doesn't have a stable
  ID. Mitigation: explicit Storybook test of the advance transition
  across all four breakpoints.
- **Queue neighbor query cost.** `getChairQueueNeighbors` with siblings
  could be expensive at scale (100+ queued apps). Mitigation: cap
  `siblings` at 30 items in the query; the dropdown shows "+N more"
  with a link to the full queue page.
- **Status banner stealing meter space.** On decided-but-still-on-page
  views, the snapshot bar becomes information-dense. Mitigation:
  `ApplicantStatusBanner` replaces (not coexists with) the meter — the
  page is audit-mode, no decision possible.

---

## 7. Components — Phase 2B: Decision Dock & Draft Rationale

**Phase 2B mission:** compose the decision surface without actually
committing anything. After 2B merges, the chair sees the sticky dock,
can type a rationale that autosaves, can pick comparison notes, and can
*click* an action button — which opens a confirmation modal shell with
all the right context but no server mutation. The shell stays
disabled-on-confirm until Phase 2C wires the actual commit.

This split isolates the composition work (pure UI, zero risk) from the
transactional work (role grants, emails, rollback) so the high-risk
server-action code in 2C lands after 2B's ergonomics are proven in
staging.

**Exit criteria for Phase 2B:**
1. `DecisionDock` renders sticky at bottom with correct z-index (20) at
   all four breakpoints per §4.4
2. `DraftRationaleField` autosaves via the new `saveChairDraft` server
   action with 800 ms debounce; `SaveStateIndicator` accurately shows
   idle / saving / saved / error
3. Draft persists across page reload (server source of truth, localStorage
   warm fallback)
4. On applicant change, the draft context resets cleanly — no bleed
   from previous applicant's rationale
5. Six action buttons render with adaptive primary state per the
   state machine in §1.7 (readiness signals determine which is the
   focused primary button)
6. Clicking any action button opens the confirm modal *shell* (Phase 2C
   fills it); Cancel closes it with preserved draft
7. Rationale character counter appears at 8 k (soft), blocks at 10 k
   (hard, server-enforced in 2C)
8. Analytics events `final_review.draft_autosaved` and
   `final_review.decision_intent` fire

### 7.1 Components in this phase

| # | Component | File | LOC | Client? |
|---|-----------|------|-----|---------|
| 1 | `DecisionDock` | `components/instructor-applicants/final-review/DecisionDock.tsx` | ~140 | yes |
| 2 | `DraftRationaleField` | `components/instructor-applicants/final-review/DraftRationaleField.tsx` | ~180 | yes |
| 3 | `DecisionButtons` | `components/instructor-applicants/final-review/DecisionButtons.tsx` | ~120 | yes |
| 4 | `ActionButton` (inner primitive) | `components/instructor-applicants/final-review/ActionButton.tsx` | ~90 | yes |
| 5 | `DraftCharCounter` | `components/instructor-applicants/final-review/DraftCharCounter.tsx` | ~50 | yes |

Plus ~140 LOC of CSS in `app/globals.css` scoped to Phase 2B.

### 7.2 `DecisionDock` — sticky bottom orchestrator

**Purpose.** The 112 px sticky bottom bar. Holds the draft rationale
field on the left and the decision buttons on the right. One of the
three sticky regions from §4.4; z-index 20 keeps it below modals
(50/60) but above the page flow.

**Props.**
```ts
interface DecisionDockProps {
  applicationId: string;
  applicantDisplayName: string;      // for confirm modal headers in 2C
  actorId: string;
  initialDraft: {
    rationale: string;
    comparisonNotes: string;
    savedAt: string | null;
  };
  readiness: ReadinessSignals;       // drives adaptive primary button
  hasAnyInterviewReview: boolean;    // enables the red-flag override path
  pendingIntent: ChairDecisionAction | null;   // for confirm modal in 2C
  onIntentOpen: (action: ChairDecisionAction) => void;
  onIntentClose: () => void;
}
```

**Layout.**
- Left (grid-cols 1–8 on desktop): `<DraftRationaleField>` with tabbed
  rationale / comparison notes, `<DraftCharCounter>` below.
- Right (grid-cols 9–12): `<DecisionButtons>` with 6 action buttons.
- On tablet: stacks into two rows (rationale on top, buttons below).
- Dock has `box-shadow: var(--shadow-dock)` pointing upward so it reads
  as "floating above" the content.

**State.** Owns `pendingIntent: ChairDecisionAction | null` — surfaced
to parent via props so Phase 2C can mount the modal at cockpit root
rather than inside the dock (required for focus trap + backdrop).

**Motion.** First-mount entrance per §2.6 pattern 1 (spring, y: 32 → 0,
220 stiffness). On applicant change, no motion — the dock is "the same
dock," only its contents change. Content changes inside (rationale
field resetting, buttons re-computing primary state) animate per §2.6
state-change (200 ms easeInOut).

**Read-only mode.** When `status !== CHAIR_REVIEW` (already decided),
the dock renders collapsed to a 56 px row showing *"This application
was already decided — [view audit trail]."* No rationale field, no
action buttons. Phase 2C adds the rescind link for super-admins.

### 7.3 `DraftRationaleField` — autosaved tabbed textarea

**Purpose.** The rationale composer. Two tabs — *Rationale* (what the
applicant sees paraphrased in emails) and *Comparison notes* (internal
only, for the audit trail). Autosaves with visible status feedback.
One of the five signature micro-interactions (§2.7).

**Props.**
```ts
interface DraftRationaleFieldProps {
  applicationId: string;
  actorId: string;
  initialRationale: string;
  initialComparisonNotes: string;
  initialSavedAt: string | null;
  onChange: (draft: { rationale: string; comparisonNotes: string }) => void;
  requiredForIntent: ChairDecisionAction | null;
  // if set, shows "required" asterisk and tooltip explaining why
}
```

**State.**
- Local: `rationale`, `comparisonNotes`, `activeTab` ("rationale" | "notes"),
  `saveState` ("idle" | "saving" | "saved" | "error"), `lastSavedAt`.
- Uses a single `useRef<NodeJS.Timeout>` for debounce.

**Autosave behavior.**
- On any change, immediately call `onChange` (so parent dock knows)
  and schedule a debounced save 800 ms out.
- Debounced save calls `saveChairDraft({ applicationId, rationale,
  comparisonNotes })` — the new server action introduced in §11.
- State machine:
  - user types → `saveState = "idle"`, timer starts
  - timer fires → `saveState = "saving"`, server action called
  - success → `saveState = "saved"`, `lastSavedAt = now`
  - failure → `saveState = "error"`, timer does not retry
    automatically; user-triggered retry via `<SaveStateIndicator>`
- `beforeunload` listener prompts if `saveState !== "saved"` and
  rationale is non-empty.
- localStorage warm cache keyed by `final-review-draft:{applicationId}:{actorId}`
  — written on every change, read on mount if the server draft is
  stale (older than localStorage) or missing. This is the belt-and-
  suspenders defense against the crash-mid-compose scenario.

**Tabs.**
- *Rationale* is the default-active tab. Prominent label "What goes in
  the applicant email."
- *Comparison notes* tab is marked with `(internal)` in small label
  type. Prominent label "Visible to chairs only — never sent to the
  applicant."
- Switching tabs does not trigger a save (each tab has its own
  debounced save lifecycle, sharing the same backing row).

**Required-for-intent affordance.** When `requiredForIntent` is set
(e.g., `REJECT` or `REQUEST_INFO`), a red asterisk appears next to
the tab label and the textarea placeholder changes to *"Required —
explain why this applicant is being rejected"*. The `DecisionButtons`
child prevents the chair from opening the confirm modal if the
required field is empty.

**Pre-fill templates.** On first open, if the rationale is empty and
all readiness signals are green and consensus is unanimous, the
textarea is pre-populated with *"Unanimous accept, no flags.
Approved."* as a placeholder (not actual value) — chair can Tab to
accept or just start typing. This is the Path-A fast-path (§1.5).

**Motion.** Tab switch uses Framer's `AnimatePresence` with a 120 ms
easeOut fade on the content swap. `SaveStateIndicator` handles its
own dot pulse.

### 7.4 `DecisionButtons` — adaptive action row

**Purpose.** Six action buttons in a visual hierarchy that *adapts* to
the applicant. Implements the state machine from §1.7.

**Props.**
```ts
interface DecisionButtonsProps {
  readiness: ReadinessSignals;
  hasRedFlags: boolean;
  hasMajorityReject: boolean;           // 2+ reviewers recommend REJECT
  draftMeetsRequirements: boolean;      // rationale present if needed
  onChoose: (action: ChairDecisionAction) => void;
  disabled?: boolean;                   // during pending commit in 2C
}
```

**The six actions (ChairDecisionAction enum extended per §11):**

| Action | Icon | Default tone | Notes |
|--------|------|--------------|-------|
| `APPROVE` | `Check` | Primary | Adaptive — becomes muted if red flags |
| `APPROVE_WITH_CONDITIONS` | `CheckCircle2` | Primary-alt | Becomes focused primary on split consensus |
| `HOLD` | `Pause` | Secondary | Never primary |
| `WAITLIST` | `Clock` | Secondary | Never primary |
| `REQUEST_INFO` | `HelpCircle` | Secondary | Never primary |
| `REQUEST_SECOND_INTERVIEW` | `RotateCw` | Secondary | Never primary |
| `REJECT` | `X` | Destructive | Adaptive — becomes primary on red flags or majority-reject |

**Adaptive primary rules** (only one action is visually primary at a
time):
1. If `hasRedFlags` OR `hasMajorityReject` → `REJECT` is primary;
   Approve requires a confirmation checkbox inside the modal before
   enabling
2. Else if `hasMixedConsensus` (split recommendations) →
   `APPROVE_WITH_CONDITIONS` is primary
3. Else → `APPROVE` is primary

Primary button is full-width at tablet (stacks above the secondary
row of other four at that breakpoint). Secondary buttons are outline
style with the lucide icon + label.

**`onChoose` contract.** Does NOT commit. Calls `onChoose(action)`
which the dock forwards to parent. Parent opens the confirm modal
(Phase 2C). If `draftMeetsRequirements === false`, clicking the
action button instead focuses the rationale field with a shake
animation (200 ms keyframes, reduced-motion swap to outline pulse)
and a tooltip *"Rationale is required for this action"*.

**Motion.** Primary button has a subtle 1.5 s pulse glow (box-shadow
animation) to draw the eye when it changes — e.g., if a new review
submits mid-session and the primary flips from Approve to Reject,
the new primary pulses once so the chair notices. Respects
reduced-motion (static styling instead).

### 7.5 `ActionButton` — the inner primitive

**Purpose.** The actual button element. Encapsulates the icon + label
+ tone + disabled-loading states so `DecisionButtons` stays a pure
composer.

**Props.**
```ts
interface ActionButtonProps {
  action: ChairDecisionAction;
  tone: "primary" | "primary-alt" | "secondary" | "destructive";
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  description: string;                  // aria-describedby target
  disabled?: boolean;
  loading?: boolean;                    // Phase 2C toggles during commit
  onClick: () => void;
}
```

**Accessibility (critical).** Each button has `aria-describedby` pointing
to a visually-hidden `<span>` with the consequence string per §2.10:

```tsx
<span id={`action-${action}-desc`} className="sr-only">
  Approve. Grants instructor role, sends approval email,
  moves applicant to APPROVED status.
</span>
```

Screen readers announce "Approve. Grants instructor role…" when the
button receives focus.

**Loading state.** When `loading === true`, button shows a spinner dot
in place of the icon, label stays, button becomes `aria-disabled` but
NOT `disabled` (so the label keeps announcing during the transition).

**Keyboard-accessible confirmation.** Button is a plain `<button>` —
`Enter` and `Space` trigger `onClick` per browser default.
Importantly: no custom hotkey interpretation. The chair uses mouse,
trackpad, or Tab+Enter — whichever they prefer — without surprise.

### 7.6 `DraftCharCounter`

**Purpose.** Subtle character counter below the rationale textarea.
Only becomes visible at 8 000 characters (80% of the hard cap) so
it doesn't add cognitive load during normal writing.

**Props.**
```ts
interface DraftCharCounterProps {
  text: string;
  softLimit?: number;    // default 8_000 — starts showing
  hardLimit?: number;    // default 10_000 — server rejects beyond
}
```

**Behavior.**
- `text.length < softLimit` → renders nothing
- `text.length ≥ softLimit && < hardLimit` → renders amber chip
  *"8 312 / 10 000 — approaching limit"*
- `text.length ≥ hardLimit` → renders red chip
  *"10 024 / 10 000 — reduce length to save"*; dock disables submission

The 10 k cap is server-enforced in Phase 2C's `chairDecide` guard —
client-side is purely advisory. Prevents paste-bomb (§11 edge-case D9).

### 7.7 The `saveChairDraft` server action (introduced here)

Full schema and RBAC details in §11; summarized here because Phase 2B
depends on it.

**Signature.**
```ts
"use server"
export async function saveChairDraft(formData: FormData): Promise<
  { success: true; savedAt: string } | { success: false; error: string }
>;
```

**Inputs.** `applicationId`, `rationale` (≤ 10 k chars), `comparisonNotes`
(≤ 10 k chars).

**Writes.** Upserts a new `InstructorApplicationChairDraft` row per
`(applicationId, chairId)` (see §11 schema addition). Does NOT touch
`InstructorApplication` or `InstructorApplicationChairDecision`.

**RBAC.** Actor must be HIRING_CHAIR, HIRING_ADMIN, or SUPER_ADMIN with
view permission on the application. Cross-chapter question flagged in
§13 applies.

**Idempotence.** Safe to call repeatedly. Last-writer-wins. If two
chairs are drafting simultaneously on the same applicant, the draft
row is scoped by chairId so they don't collide.

**Failure semantics.** On 4xx, returns `{ success: false, error }`;
UI shows the `error` state on `SaveStateIndicator`. On 5xx, the
server action bubbles the error; `DraftRationaleField` catches and
flips to error state, leaving the localStorage warm cache intact.

### 7.8 Files touched in Phase 2B

| Status | Path | Notes |
|--------|------|-------|
| [NEW] | `components/instructor-applicants/final-review/DecisionDock.tsx` | §7.2 |
| [NEW] | `components/instructor-applicants/final-review/DraftRationaleField.tsx` | §7.3 |
| [NEW] | `components/instructor-applicants/final-review/DecisionButtons.tsx` | §7.4 |
| [NEW] | `components/instructor-applicants/final-review/ActionButton.tsx` | §7.5 |
| [NEW] | `components/instructor-applicants/final-review/DraftCharCounter.tsx` | §7.6 |
| [NEW] | `lib/chair-draft-actions.ts` | `saveChairDraft` server action |
| [MODIFY] | `prisma/schema.prisma` | Add `InstructorApplicationChairDraft` model (details in §11) |
| [MODIFY] | `components/instructor-applicants/final-review/FinalReviewCockpit.tsx` | Mount `<DecisionDock>` as last child; pass `onIntentOpen` handler; hold `pendingIntent` state (modal mount deferred to 2C) |
| [MODIFY] | `lib/final-review-queries.ts` | `getChairDraft` already added in Phase 1 — wire through cockpit props |
| [MODIFY] | `app/globals.css` | ~140 LOC under `/* Phase 2B */` block: dock, draft field, action buttons, character counter |

### 7.9 Dependencies between Phase 2B components

```
DecisionDock
  ├── DraftRationaleField
  │     ├── SaveStateIndicator                 — from Phase 1
  │     └── DraftCharCounter
  └── DecisionButtons
        └── ActionButton (×6)                  — one per ChairDecisionAction
```

All Phase 2B components depend only on Phase 1 primitives
(`SaveStateIndicator`) plus Phase 2A's `ReadinessSignals` type. Zero
cross-dependency with Phase 2C — the confirm modal, reason code
picker, and conditions editor live entirely in 2C.

### 7.10 Analytics events introduced in Phase 2B

| Event | Payload | Purpose |
|-------|---------|---------|
| `final_review.draft_autosaved` | `{ applicationId, rationaleLength, comparisonNotesLength, durationMs }` | Measure draft-save latency; 30s p95 SLO |
| `final_review.draft_autosave_failed` | `{ applicationId, error }` | Alert on save errors — draft data loss risk |
| `final_review.decision_intent` | `{ applicationId, action, draftLength, readinessPercentage }` | Which actions the chair clicks through on; conversion funnel input for 2C's actual commits |
| `final_review.rationale_required_nudge` | `{ applicationId, action }` | How often chairs hit the "rationale required" shake — if high, we're pushing too hard on required fields |

### 7.11 Phase 2B risks

- **Autosave race with server action.** If the chair triggers `chairDecide`
  while a draft save is still in flight, the decision could commit with
  a rationale that wasn't persisted. Mitigation: `DecisionButtons`
  disables all actions for 200 ms after a save completes; Phase 2C's
  `chairDecide` also reads the in-memory draft from the form submission,
  not the persisted one.
- **localStorage quota.** Chairs with many in-flight drafts across
  applicants could theoretically hit 5 MB LS quota (unlikely at < 10 k
  chars × tens of drafts, but possible). Mitigation: garbage-collect
  drafts older than 7 days on cockpit mount.
- **Tab switching loses focus.** Switching between rationale and notes
  tabs can lose the cursor position. Mitigation: `DraftRationaleField`
  preserves `selectionStart` per tab in local state, restores on tab
  switch.
- **Adaptive primary button confusion.** If the primary shifts from
  Approve to Reject mid-session (new review lands), the chair may be
  surprised. Mitigation: pulse animation per §7.4 draws attention;
  also a passive toast *"Consensus changed — reject is now the suggested
  action"* (non-blocking, dismissible).

---

## 8. Components — Phase 2C: Confirmation & Action Forms

**Phase 2C mission:** the pre-commit UI. After 2C merges, clicking any
action button in the dock opens a fully-formed confirmation modal with
a summary of what is about to happen, action-specific inputs
(conditions checklist, reject reason code), and a contrarian warning
when the chair's choice disagrees with the interviewer consensus or
the data is incomplete. The Confirm button is still a no-op —
2D wires `chairDecide()`.

The split matters because 2C is pure form UI, validation, and copy —
reviewable by the hiring team without any backend risk. Product can
sign off on the reason codes and condition presets before the
transactional code lands in 2D.

**Exit criteria for Phase 2C:**
1. `DecisionConfirmModal` renders for all seven `ChairDecisionAction`
   values with action-specific content
2. `DecisionSummaryCard` inside the modal shows consequence string,
   superseded-prior-decision warning if any, email preview snippet,
   and readiness gaps
3. `ApproveWithConditionsEditor` renders for `APPROVE_WITH_CONDITIONS`
   with the preset checklist from product + custom "Add condition"
   affordance
4. `RejectReasonCodePicker` renders for `REJECT` with five reason
   codes driving the email template selection
5. `ContrarianWarningModal` appears before the main confirm modal when
   the chair's pick contradicts consensus (e.g., Approve with a
   `RED_FLAG` tag) or data is incomplete (zero submitted interview
   reviews, chair picks Approve)
6. Esc closes; backdrop click closes (except when required field is
   dirty — confirm-before-close prompt)
7. Focus trap works per §2.10; focus returns to the originating action
   button on close
8. All action-specific text content copy-reviewed by product
9. Analytics events `final_review.confirm_modal_opened` and
   `final_review.confirm_modal_dismissed` fire

### 8.1 Components in this phase

| # | Component | File | LOC | Client? |
|---|-----------|------|-----|---------|
| 1 | `DecisionConfirmModal` | `components/instructor-applicants/final-review/DecisionConfirmModal.tsx` | ~200 | yes |
| 2 | `DecisionSummaryCard` | `components/instructor-applicants/final-review/DecisionSummaryCard.tsx` | ~140 | no |
| 3 | `ApproveWithConditionsEditor` | `components/instructor-applicants/final-review/ApproveWithConditionsEditor.tsx` | ~190 | yes |
| 4 | `RejectReasonCodePicker` | `components/instructor-applicants/final-review/RejectReasonCodePicker.tsx` | ~120 | yes |
| 5 | `ContrarianWarningModal` | `components/instructor-applicants/final-review/ContrarianWarningModal.tsx` | ~130 | yes |
| 6 | `EmailPreviewSnippet` | `components/instructor-applicants/final-review/EmailPreviewSnippet.tsx` | ~80 | no |

Plus ~160 LOC of CSS in `app/globals.css` scoped to Phase 2C (modal
chrome, editor checklist styles, reason picker).

### 8.2 `DecisionConfirmModal` — the container

**Purpose.** The focus-trapped native `<dialog>` that mounts at the
cockpit root (not inside the dock, so the backdrop can cover the
full viewport). Renders action-specific children in a consistent
frame: header, body slot, footer with Cancel + primary Confirm.

**Props.**
```ts
interface DecisionConfirmModalProps {
  open: boolean;
  action: ChairDecisionAction;
  application: {
    id: string;
    displayName: string;
    chapterName: string | null;
    status: InstructorApplicationStatus;
  };
  rationale: string;
  comparisonNotes: string;
  readiness: ReadinessSignals;
  priorDecision: ChairDecisionSummary | null;  // for supersede warning
  interviewerConsensus: {
    totalReviews: number;
    recommendations: Record<InstructorInterviewRecommendation, number>;
    redFlagCount: number;
  };
  onCancel: () => void;
  onConfirm: (payload: ConfirmPayload) => void;   // 2D wires this
  submitting: boolean;                            // 2D controls this
  error: string | null;                           // 2D provides this
}
```

**Body slot routing.**
- `APPROVE` → `<DecisionSummaryCard>` only
- `APPROVE_WITH_CONDITIONS` → `<DecisionSummaryCard>` + `<ApproveWithConditionsEditor>`
- `REJECT` → `<DecisionSummaryCard>` + `<RejectReasonCodePicker>`
- `HOLD` / `WAITLIST` / `REQUEST_INFO` / `REQUEST_SECOND_INTERVIEW` →
  `<DecisionSummaryCard>` with action-appropriate copy; no extra
  inputs

**Confirm button state.** Disabled until:
- Required rationale is present (REJECT, REQUEST_INFO)
- At least one condition is added for APPROVE_WITH_CONDITIONS
- A reason code is selected for REJECT
- `submitting === false`

**Motion.** Backdrop fades in 200 ms; modal dialog springs up with
`scale: 0.96 → 1` and `y: 16 → 0` per §2.7 micro-interaction #3.
Reduced-motion: no scale/translate, just opacity fade.

**Confirm-before-close.** If the chair has added conditions or typed
in the reason-code "other" textarea and then hits Esc or clicks
backdrop, show a second inline confirm: *"Discard unsaved changes?"*.
Only fires when there's actually dirty state beyond the already-
autosaved rationale.

**Accessibility.**
- Native `<dialog>` for built-in focus trap
- `aria-labelledby` points to the modal header
- `aria-describedby` points to the consequence string in the summary
  card
- Focus lands on the first focusable element in the body on open; on
  close, focus returns to the originating `<ActionButton>`

### 8.3 `DecisionSummaryCard` — what's about to happen

**Purpose.** A read-only summary block at the top of the confirm modal
body. Answers the chair's final question: *"What will this actually
do?"* before they click Confirm.

**Props.**
```ts
interface DecisionSummaryCardProps {
  action: ChairDecisionAction;
  applicantDisplayName: string;
  chapterName: string | null;
  rationale: string;
  readiness: ReadinessSignals;
  priorDecision: ChairDecisionSummary | null;
  consensusSnapshot: ConsensusSnapshot;
}
```

**Rendering layers (top to bottom):**

1. **Headline** — action-specific, e.g., *"Approve Jane Doe for Physics
   instructor role — MIT chapter."* Uses `--text-xl` + `--font-title`.
2. **Consequence string** — exact, plain-language: what changes in the
   system. Examples:
   - `APPROVE` → *"This grants Jane the INSTRUCTOR role, enrolls her in
     training, and sends an approval email. This action supersedes the
     prior decision by Alex Chen from 3 days ago (HOLD)."* (supersede
     line only if `priorDecision != null`)
   - `REJECT` → *"This sets the application status to REJECTED and
     sends Jane a rejection email using the selected reason code."*
   - `WAITLIST` → *"This sets the application status to WAITLISTED.
     No email is sent automatically — add the applicant to the
     waitlist roster manually."*
   - `REQUEST_SECOND_INTERVIEW` → *"This returns the application to
     interview scheduling (Round 2). Prior round-1 interviews remain
     visible in the audit trail."*
3. **Readiness warning** — if `readinessPercentage < 100`, lists the
   missing signals with icons (e.g., *"⚠ 1 of 2 interview reviews
   pending — Alex Chen's review is still DRAFT"*).
4. **Consensus snapshot** — three chips summarizing reviewer
   recommendations: *"Accept ×2 · Hold ×1 · Reject ×0"*. Color-matched
   to the sentiment palette from §2.5.
5. **Email preview** — `<EmailPreviewSnippet>` showing the first ~200
   chars of the outgoing email with a *"see full email"* disclosure.
   Only for actions that send emails (APPROVE, APPROVE_WITH_CONDITIONS,
   REJECT, HOLD, REQUEST_INFO).

**State.** None — pure presentational.

**Motion.** None on mount — the card is static content inside the
already-animated modal.

### 8.4 `ApproveWithConditionsEditor`

**Purpose.** A checklist-first conditions editor for
APPROVE_WITH_CONDITIONS. The vast majority of conditions are picked
from a preset vocabulary — chair should not have to type them from
scratch. A custom "Other" field exists for edge cases.

**Props.**
```ts
interface ApproveWithConditionsEditorProps {
  conditions: DecisionCondition[];
  onChange: (conditions: DecisionCondition[]) => void;
  presetOptions: ConditionPreset[];  // loaded from lib/condition-presets.ts
}

type ConditionPreset = {
  id: string;
  label: string;        // "Mentorship pair-up for first semester"
  defaultOwner: "CHAIR" | "CHAPTER_LEAD" | "INSTRUCTOR" | null;
  defaultDueOffsetDays: number | null;   // from decisionAt
};

type DecisionCondition = {
  id: string;           // cuid, generated client-side
  label: string;
  ownerId: string | null;
  dueAt: string | null; // ISO
  source: "preset" | "custom";
};
```

**Preset vocabulary (v1 — reviewable by product before ship):**
1. Mentorship pair-up for first semester
2. Mid-semester instructor check-in with chair
3. Teaching shadow with an experienced instructor before first class
4. Complete asynchronous onboarding module 1 before class start
5. Submit signed agreement form by due date
6. Attend chapter president 1:1 within first 2 weeks
7. First-class observation by chapter lead

Each preset is a checkbox. Checking adds a `DecisionCondition` to the
array; unchecking removes it. Owner and due date are populated from
the preset defaults and are edit-in-place inline.

**Custom condition input.** Below the preset list, an `+ Add custom
condition` button reveals a textarea + owner dropdown + due-date
picker. Hard cap: **10 conditions total** (presets + custom combined).
Soft warning at 6. Zero conditions blocks Confirm.

**Validation.**
- `label.trim().length > 0` and `≤ 300` chars
- `ownerId` must reference a valid User (loaded via existing
  typeahead pattern from `components/instructor-applicants/InterviewerAssignPicker.tsx`)
- `dueAt` must be today or later

**Motion.** Adding/removing a condition uses
`AnimatePresence` + `motion.li` with `layout` so the list reflows
smoothly (250 ms spring). Reduced-motion: instant.

### 8.5 `RejectReasonCodePicker`

**Purpose.** A structured reason code selector for REJECT. Drives the
rejection email template so chairs don't author rejection prose from
scratch and so legal has consistent language in the candidate file.

**Props.**
```ts
interface RejectReasonCodePickerProps {
  reasonCode: RejectReasonCode | null;
  onChange: (code: RejectReasonCode, freeText: string | null) => void;
  freeText: string | null;
}

type RejectReasonCode =
  | "TEACHING_FIT"
  | "COMMUNICATION"
  | "PROFESSIONALISM"
  | "RED_FLAG"
  | "OTHER";
```

**Rendering.** Five radio cards in a vertical stack, each with:
- Title (e.g., *"Teaching fit"*)
- One-line description (e.g., *"Curriculum depth or pedagogical
  approach not aligned with program expectations."*)
- An inline snippet showing the email tone that will be generated

Selecting `OTHER` reveals a required textarea with 500-char cap:
*"Describe the reason — this text replaces the standard email
template for this case."*

**Validation.** If `reasonCode === null`, parent modal disables
Confirm. If `reasonCode === "OTHER"` and `freeText.trim() === ""`,
parent disables Confirm.

**State.** None — fully controlled.

**Product decision (§15).** The exact copy for each reason code's
email template is a product deliverable, not an engineering one. This
component is ready to render any text product provides; template
content lives in `lib/email-templates/rejection.ts` (new file in
Phase 2D).

### 8.6 `ContrarianWarningModal`

**Purpose.** A pre-pre-confirm step when the chair's chosen action
disagrees with reviewer consensus or data is materially incomplete.
Triggers before `DecisionConfirmModal` opens. If the chair confirms
the warning, proceed to the main modal. If they cancel, return to
the dock with the draft intact.

**Triggers.** Computed by a pure function `detectContrarianSignals`
(`lib/contrarian-signals.ts`, new):
- Action is `APPROVE` or `APPROVE_WITH_CONDITIONS` but ≥1 interview
  review contains a `RED_FLAG` tag
- Action is `APPROVE` or `APPROVE_WITH_CONDITIONS` and majority of
  submitted interview reviews recommend `REJECT`
- Action is `APPROVE` or `APPROVE_WITH_CONDITIONS` and
  `hasSubmittedInterviewReviews === false` (zero interviews; the
  QA-flagged P0 edge case)
- Action is `REJECT` and majority of submitted interview reviews
  recommend `ACCEPT` or `ACCEPT_WITH_SUPPORT`
- Action is `REJECT` and `priorDecision?.action === "APPROVE"` (chair
  is reversing a prior approval — should usually use rescind flow in
  Phase 2E instead)

**Props.**
```ts
interface ContrarianWarningModalProps {
  open: boolean;
  signals: ContrarianSignal[];
  action: ChairDecisionAction;
  onCancel: () => void;
  onConfirm: () => void;   // proceeds to DecisionConfirmModal
}
```

**Rendering.** A focused modal (smaller than the main confirm) with
one amber `AlertTriangle` icon at top, a headline like *"Your
decision conflicts with reviewer feedback"*, then each signal
rendered as a bullet with evidence:
- *"2 interviewers recommended Reject — Alex Chen, Jordan Patel"*
- *"1 red-flag tag raised by Alex Chen on question 'Handling a
  disruptive student'"*

Footer: *"Go back"* (secondary) and *"Continue to confirmation"*
(primary, amber-toned to reinforce the caution). No auto-dismiss.

**Audit.** If the chair proceeds, `final_review.contrarian_override`
analytics event fires with the signal list; 2D passes the same
`overrideWarnings: true` flag into `chairDecide` so the server
records the override in the timeline event payload.

### 8.7 `EmailPreviewSnippet`

**Purpose.** A small, read-only preview of what the outgoing email
will look like, rendered inside `DecisionSummaryCard`. Gives the
chair last-second confidence that the email tone is appropriate
before committing.

**Props.**
```ts
interface EmailPreviewSnippetProps {
  action: ChairDecisionAction;
  applicantDisplayName: string;
  rationale: string;
  conditions?: DecisionCondition[];
  rejectReasonCode?: RejectReasonCode | null;
  rejectFreeText?: string | null;
}
```

**Rendering.** A 2-line subject + first ~200 chars of body in a
gray-bordered card styled like an email client preview pane. A
disclosure toggle expands the full rendered HTML email in a read-only
iframe sandboxed for safety.

**Data source.** Uses the same `lib/email-templates/*` modules that
the server action will use at commit time, so preview and actual
email stay in sync. For actions that don't send emails (WAITLIST,
REQUEST_SECOND_INTERVIEW), renders a muted *"No email sent for this
action."*

### 8.8 Files touched in Phase 2C

| Status | Path | Notes |
|--------|------|-------|
| [NEW] | `components/instructor-applicants/final-review/DecisionConfirmModal.tsx` | §8.2 |
| [NEW] | `components/instructor-applicants/final-review/DecisionSummaryCard.tsx` | §8.3 |
| [NEW] | `components/instructor-applicants/final-review/ApproveWithConditionsEditor.tsx` | §8.4 |
| [NEW] | `components/instructor-applicants/final-review/RejectReasonCodePicker.tsx` | §8.5 |
| [NEW] | `components/instructor-applicants/final-review/ContrarianWarningModal.tsx` | §8.6 |
| [NEW] | `components/instructor-applicants/final-review/EmailPreviewSnippet.tsx` | §8.7 |
| [NEW] | `lib/condition-presets.ts` | The preset vocabulary; reviewable by product |
| [NEW] | `lib/contrarian-signals.ts` | Pure function `detectContrarianSignals(application, action)` |
| [NEW] | `lib/email-templates/approval.ts` | Template renderer; shared with 2D's email send |
| [NEW] | `lib/email-templates/approval-with-conditions.ts` | |
| [NEW] | `lib/email-templates/rejection.ts` | Keyed by `RejectReasonCode` |
| [NEW] | `lib/email-templates/hold.ts` | |
| [NEW] | `lib/email-templates/request-info.ts` | |
| [MODIFY] | `components/instructor-applicants/final-review/FinalReviewCockpit.tsx` | Mount `<DecisionConfirmModal>` and `<ContrarianWarningModal>` at cockpit root; wire `pendingIntent` flow from dock |
| [MODIFY] | `app/globals.css` | ~160 LOC under `/* Phase 2C */`: modal chrome, editor, reason picker, preview card |

### 8.9 Dependencies between Phase 2C components

```
FinalReviewCockpit
  ├── [Phase 2B] DecisionDock → emits action intent
  ├── ContrarianWarningModal (conditionally precedes the main modal)
  └── DecisionConfirmModal
        ├── DecisionSummaryCard
        │     └── EmailPreviewSnippet
        ├── ApproveWithConditionsEditor  (when action = APPROVE_WITH_CONDITIONS)
        └── RejectReasonCodePicker       (when action = REJECT)
```

All Phase 2C components depend on Phase 1 primitives
(`RecommendationBadge`, `RatingChip` for consensus snapshot) plus the
Phase 2A `ReadinessSignals` type. Pure UI — no server actions invoked
by any 2C component.

### 8.10 Analytics events introduced in Phase 2C

| Event | Payload | Purpose |
|-------|---------|---------|
| `final_review.confirm_modal_opened` | `{ applicationId, action, readinessPercentage, hasContrarianWarning }` | Funnel: click → intent → confirm |
| `final_review.confirm_modal_dismissed` | `{ applicationId, action, reason: "cancel" \| "backdrop" \| "escape" \| "discard_dirty" }` | Where chairs bail out |
| `final_review.contrarian_warning_shown` | `{ applicationId, action, signals: string[] }` | How often the warning fires |
| `final_review.contrarian_override` | `{ applicationId, action, signals: string[] }` | Chair proceeds anyway — audit input |
| `final_review.condition_added` | `{ applicationId, source: "preset" \| "custom", presetId?: string }` | Preset adoption — tune the vocabulary |
| `final_review.reject_reason_selected` | `{ applicationId, reasonCode }` | Distribution of rejection reasons |

### 8.11 Phase 2C risks

- **Preset vocabulary churn.** If product iterates the condition list
  after launch, the change is a one-file edit (`lib/condition-presets.ts`)
  — no migration. But: existing `InstructorApplicationChairDecision.conditions`
  rows reference the labels as strings, so renamed presets don't
  retroactively rename decided records. This is intentional; the
  decision captures the label as-of-decide-time. Documented in §13
  schema notes.
- **Email preview diverging from actual email.** The preview and the
  commit-time email must render from the same template module. Shared
  `lib/email-templates/*` files enforce this. Integration test in §14
  asserts the preview string equals the first ~200 chars of the sent
  email body.
- **Contrarian warning fatigue.** If chairs hit the warning on every
  split decision, they'll train themselves to click through without
  reading. Mitigation: the signals list is specific (names and quote
  excerpts, not generic counts) and the button copy is *"Continue to
  confirmation"* not *"I understand"* — making the chair acknowledge
  the next step, not the warning itself.
- **Conditions payload validation.** Client-side validation prevents
  common errors but is not authoritative. 2D's `chairDecide` server
  action must re-validate: label length, ownerId exists, dueAt in
  the future, max 10 items. This is enumerated in §11.
- **Modal backdrop over sticky regions.** The dock (z-index 20) and
  snapshot bar (z-index 10) must not bleed through the modal backdrop
  (z-index 50). Verified by Playwright visual regression at all four
  breakpoints.

---

## 9. Components — Phase 2D: Commit Wiring & Happy Path

**Phase 2D mission:** wire Confirm to the server. After 2D merges, a
chair clicking Confirm in the Phase 2C modal actually commits the
decision — role grants happen, emails send, the `PostDecisionToast`
(shell built in 2A) activates and offers the next applicant. The
happy path is complete end-to-end.

This phase is deliberately scoped to the *successful* commit. Failure
surfaces (sync rollback banner, email failure banner, stale-click
recovery, retry flows) land in Phase 2D.5. The split matters because
happy-path wiring is simpler than the branches needed for every
failure mode; shipping 2D first proves the contract and lets QA
exercise it before 2D.5 adds the red-path polish.

**Exit criteria for Phase 2D:**
1. Clicking Confirm in `DecisionConfirmModal` calls `chairDecide()` via
   the new `useCommitDecision` hook
2. All seven actions commit successfully end-to-end: `APPROVE`,
   `APPROVE_WITH_CONDITIONS`, `REJECT`, `HOLD`, `WAITLIST`,
   `REQUEST_INFO`, `REQUEST_SECOND_INTERVIEW`
3. Conditions payload persists to `InstructorApplicationChairDecision.conditions`
   (JSON column added in §14)
4. Reject reason code + free text persist to
   `InstructorApplicationChairDecision.rationale` (structured prefix)
5. Idempotency key prevents duplicate commits when the client retries
   a request that already succeeded on the server
6. `PostDecisionToast` triggers on success, preloaded with the next
   queued applicant; clicking its CTA navigates
7. Optimistic UI flips the dock to "pending" state immediately on
   Confirm; rolls back to "editable" if the server returns an error
   (failure UX is minimal in 2D — just an inline error chip; 2D.5
   layers the richer banners)
8. Analytics fire for commit start, commit success, idempotent replay,
   and toast advance

### 9.1 Components in this phase

| # | Component | File | LOC | Client? |
|---|-----------|------|-----|---------|
| 1 | `useCommitDecision` (hook) | `lib/use-commit-decision.ts` | ~160 | yes |
| 2 | `DecisionPendingOverlay` | `components/instructor-applicants/final-review/DecisionPendingOverlay.tsx` | ~80 | yes |
| 3 | `PostDecisionToast` activation (modify the 2A shell) | `components/instructor-applicants/final-review/PostDecisionToast.tsx` | +~60 | yes |

Server-action work (detailed in §14, summarized here):
- `chairDecide()` in `lib/instructor-application-actions.ts` — extended
  signature; new branches for WAITLIST and APPROVE_WITH_CONDITIONS;
  idempotency check.
- `InstructorApplicationChairDecision` model — new `conditions Json?`
  column; full schema deltas in §14.
- `ChairDecisionCommitAttempt` — new table keyed by idempotency key.

Plus ~60 LOC of CSS for the pending overlay and toast motion variants.

### 9.2 `useCommitDecision` — the commit hook

**Purpose.** Encapsulates everything the client needs to commit a
decision: idempotency key generation, optimistic state management,
server-action dispatch, rollback on failure, toast trigger on success.
This is the only place that talks to `chairDecide()` from the UI —
keeping the surface tiny reduces the attack surface for bugs.

**API.**
```ts
interface CommitDecisionInput {
  applicationId: string;
  action: ChairDecisionAction;
  rationale: string;
  comparisonNotes: string;
  conditions?: DecisionCondition[];        // for APPROVE_WITH_CONDITIONS
  rejectReasonCode?: RejectReasonCode;     // for REJECT
  rejectFreeText?: string;                 // for REJECT
  overrideWarnings?: boolean;              // true when chair confirmed through contrarian modal
}

type CommitDecisionState =
  | { status: "idle" }
  | { status: "pending";  startedAt: number; idempotencyKey: string }
  | { status: "success";  decidedAt: string; nextApplicantId: string | null }
  | { status: "error";    error: CommitDecisionError; canRetry: boolean };

interface UseCommitDecisionReturn {
  state: CommitDecisionState;
  commit: (input: CommitDecisionInput) => Promise<void>;
  reset: () => void;      // clears error state; used when chair cancels modal
}

export function useCommitDecision(): UseCommitDecisionReturn;
```

**Idempotency key generation.** On first `commit()` call for an
applicant + action combination, generate a UUID v4 and store it in
state. If the call fails and the chair retries the *same action*
within 60 seconds, reuse the same key so the server recognizes the
replay. If the chair changes the action (e.g., Approve → Hold),
generate a new key.

```ts
const idempotencyKey = useRef<string | null>(null);

async function commit(input: CommitDecisionInput) {
  if (!idempotencyKey.current) {
    idempotencyKey.current = crypto.randomUUID();
  }
  // ... dispatch with idempotencyKey.current
}
```

**Optimistic UI.** On `commit()`, immediately:
1. Set `state = { status: "pending", ... }`
2. Dock collapses its buttons to disabled state (`DecisionPendingOverlay`
   covers the dock contents with a blur + spinner)
3. Dispatch `chairDecide(formData)` server action

On success:
1. Set `state = { status: "success", decidedAt, nextApplicantId }`
2. Close the confirm modal
3. Trigger `PostDecisionToast.open()` with the decided action + next
   applicant data (pre-fetched by `router.prefetch(nextUrl)`)
4. Fire analytics event `final_review.commit_succeeded`

On error (non-idempotent replay):
1. Set `state = { status: "error", error, canRetry }`
2. Uncollapse the dock buttons (let the chair retry)
3. Show minimal inline error chip in the confirm modal
4. Fire analytics event `final_review.commit_failed`
5. Phase 2D.5 layers richer banners on top of this state

**Idempotent replay.** When the server returns `{ replayed: true,
decidedAt, ... }` — meaning the idempotency key matched a prior
successful commit — the hook treats it as a normal success. Fires
analytics event `final_review.commit_replayed` so we can see how often
this happens in production (helps size the retry window and detect
flaky network conditions).

**Reset.** When the chair cancels the modal or changes action,
`reset()` clears the idempotency key so the next commit starts fresh.

### 9.3 `DecisionPendingOverlay`

**Purpose.** A lightweight overlay that covers the `DecisionDock`
during commit so the chair can't double-click Confirm or change the
rationale mid-commit. Visual confirmation that the system is working.

**Props.**
```ts
interface DecisionPendingOverlayProps {
  open: boolean;
  action: ChairDecisionAction | null;   // for label display
  elapsedMs: number;                    // for "Finalizing…" messaging on long commits
}
```

**Visual.** Covers the dock with `backdrop-filter: blur(4px) saturate(0.9)`
over `rgba(255, 255, 255, 0.6)` (matches the modal glass pattern in
§2.4 but at 60% opacity — readable through). Centered spinner dot plus
label:
- 0–800 ms: *"Recording decision…"*
- 800–3000 ms: *"Finalizing…"*
- 3000+ ms: *"Still working — this usually takes 1–2 seconds"*

The last message is important: `APPROVE` can take 4–8 seconds because
it runs the role grant transaction and syncs the workflow. Without
feedback, chairs assume the system hung.

**Motion.** Fade in 120 ms easeOut; fade out 200 ms easeIn when
`open → false`. Respects `prefers-reduced-motion` (instant toggle).

**Accessibility.** `role="status"` `aria-live="polite"` so screen
readers announce the state change but don't steal focus. Focus
remains on the Confirm button so when the overlay closes (success or
error), the chair's focus is exactly where they left it.

### 9.4 `PostDecisionToast` activation

The shell for this component was built in Phase 2A (§6.8). Phase 2D
wires up the trigger.

**The wiring.** `FinalReviewCockpit` already holds the toast's `open`
state. When `useCommitDecision.state.status === "success"`:

```tsx
useEffect(() => {
  if (commit.state.status === "success") {
    openToast({
      decidedAction: commit.state.input.action,
      decidedApplicant: { name: applicant.preferredFirstName, ... },
      nextApplicant: queue.next
        ? { id: queue.next.id, name: queue.next.displayName, ... }
        : null,
    });
    router.refresh();  // re-fetch for the audit banner on current page
  }
}, [commit.state]);
```

**Prefetching the next applicant.** On toast open, it calls
`router.prefetch(/admin/instructor-applicants/${nextApplicant.id}/review)`
so clicking the CTA lands in under 200 ms on warm cache.

**Analytics.**
- `final_review.toast_shown` — `{ applicationId, decidedAction, nextApplicantId }`
- `final_review.toast_advance_clicked` — `{ from, to }`
- `final_review.toast_dismissed` — `{ applicationId, reason: "timeout" | "manual" }`

**Queue-empty state.** When `nextApplicant === null`, the toast reads
*"Queue cleared — nice work"* with a link to the chair queue page. A
subtle confetti burst animation (200 ms Framer-motion variants — 30
SVG dots with randomized y/rotation, respecting reduced-motion)
celebrates a rare-enough moment that it feels earned, not gimmicky.

### 9.5 `chairDecide()` server action — extensions

Full schema and field-level detail in §14. Summary of what Phase 2D
adds to the existing 254-line function at
`lib/instructor-application-actions.ts:1796–2050`:

**New FormData fields:**
- `action` — extend existing enum check to accept `WAITLIST` and
  `APPROVE_WITH_CONDITIONS`
- `conditions` — JSON-stringified `DecisionCondition[]` (required
  when `action === "APPROVE_WITH_CONDITIONS"`)
- `rejectReasonCode` — enum (required when `action === "REJECT"`)
- `rejectFreeText` — string (required when `action === "REJECT"`)
- `idempotencyKey` — UUID v4 string (required)
- `overrideWarnings` — boolean (true when contrarian modal was
  confirmed)

**Idempotency check** — new preamble, before the existing
`assertCanActAsChair` gate at line 1823:

```ts
const existing = await prisma.chairDecisionCommitAttempt.findUnique({
  where: { idempotencyKey: input.idempotencyKey }
});
if (existing) {
  if (existing.result === "SUCCESS") {
    // Replay: return the prior result without re-committing
    return {
      success: true,
      replayed: true,
      decidedAt: existing.decidedAt,
      nextApplicantId: existing.nextApplicantId,
    };
  }
  // existing.result === "FAILED" — let the retry proceed, but log it
  await logIdempotencyRetry(existing);
}
```

**Conditions validation** — inside the existing transaction at line
1882, extending the block for `APPROVE_WITH_CONDITIONS`:

```ts
if (action === "APPROVE_WITH_CONDITIONS") {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new ApplicantWorkflowError("CONDITIONS_REQUIRED");
  }
  if (conditions.length > 10) {
    throw new ApplicantWorkflowError("TOO_MANY_CONDITIONS");
  }
  for (const c of conditions) {
    if (typeof c.label !== "string" || c.label.trim().length === 0) {
      throw new ApplicantWorkflowError("CONDITION_LABEL_INVALID");
    }
    if (c.label.length > 300) {
      throw new ApplicantWorkflowError("CONDITION_LABEL_TOO_LONG");
    }
    if (c.ownerId && !(await prisma.user.findUnique({ where: { id: c.ownerId } }))) {
      throw new ApplicantWorkflowError("CONDITION_OWNER_NOT_FOUND");
    }
  }
}
```

**Reject reason code** — structured prefix for the `rationale` field:

```ts
if (action === "REJECT") {
  if (!rejectReasonCode || !rejectFreeText?.trim()) {
    throw new ApplicantWorkflowError("REJECT_REASON_REQUIRED");
  }
  rationale = `[${rejectReasonCode}] ${rejectFreeText.trim()}`;
}
```

This keeps the DB storage simple (single `rationale` string) while
giving the email generator a structured prefix to pick a template.

**Status mapping** — extend the existing `statusByAction` map at line
1846:

```ts
const statusByAction = {
  APPROVE:                  "APPROVED",
  APPROVE_WITH_CONDITIONS:  "APPROVED",
  REJECT:                   "REJECTED",
  HOLD:                     "ON_HOLD",
  REQUEST_INFO:             "INFO_REQUESTED",
  REQUEST_SECOND_INTERVIEW: "INTERVIEW_SCHEDULED",
  WAITLIST:                 "WAITLISTED",  // new
};
```

`APPROVE_WITH_CONDITIONS` uses the same role-grant path as `APPROVE`
(lines 1902–1940 in the existing code); conditions ride on the
decision row but don't affect the user's INSTRUCTOR role grant.
`WAITLIST` requires a new `WAITLISTED` value on the
`InstructorApplicationStatus` enum (§14) and a new
`sendWaitlistEmail()` template.

**Response shape** — expanded return value:

```ts
return {
  success: true,
  replayed: false,
  decidedAt: result.decidedAt.toISOString(),
  nextApplicantId: await getNextChairQueuedApplicantId(actor.id, chapter?.id),
  emailStatus: emailFailure ? "failed" : "queued",
};
```

`nextApplicantId` is computed inside the action using the same logic
as `getChairQueueNeighbors()` — single source of truth for queue
order.

**Override warnings** — when `overrideWarnings === true`, the timeline
payload records the fact so audit logs show the chair proceeded
through a warning:

```ts
await tx.instructorApplicationTimelineEvent.create({
  data: {
    applicationId,
    kind: "CHAIR_DECISION",
    actorId: chair.id,
    payload: { action, from, to, rationale, overrodeWarnings: input.overrideWarnings ?? false },
  },
});
```

### 9.6 `ChairDecisionCommitAttempt` — new table

Full schema in §14. Purpose here: give the idempotency check
something to query against. One row per `(chairId, idempotencyKey)`
pair, written at commit time.

Key fields:
- `idempotencyKey` (UUID v4, unique index)
- `chairId`, `applicationId`, `action`
- `result` (`"SUCCESS" | "FAILED"`)
- `decidedAt` (copy of the committed timestamp, null on failure)
- `nextApplicantId` (cached for replay)
- `createdAt`, `updatedAt`

Rows older than 7 days are garbage-collected by a nightly cron (small
table — worst case a few hundred rows per day).

### 9.7 Files touched in Phase 2D

| Status | Path | Notes |
|--------|------|-------|
| [NEW] | `lib/use-commit-decision.ts` | §9.2 hook |
| [NEW] | `components/instructor-applicants/final-review/DecisionPendingOverlay.tsx` | §9.3 |
| [MODIFY] | `components/instructor-applicants/final-review/PostDecisionToast.tsx` | Activate trigger from Phase 2A shell (§9.4) |
| [MODIFY] | `components/instructor-applicants/final-review/FinalReviewCockpit.tsx` | Mount pending overlay; wire `useCommitDecision` to confirm modal's onConfirm; open toast on success |
| [MODIFY] | `components/instructor-applicants/final-review/DecisionConfirmModal.tsx` | Call `commit.commit(...)` on Confirm; show inline error chip if `commit.state.status === "error"` (2D.5 replaces with richer banner) |
| [MODIFY] | `lib/instructor-application-actions.ts` | §9.5 — extend `chairDecide()` at lines 1796–2050 with new fields, validation, status mapping, response shape |
| [MODIFY] | `prisma/schema.prisma` | Add `InstructorApplicationStatus.WAITLISTED`; add `ChairDecisionAction.APPROVE_WITH_CONDITIONS` and `WAITLIST`; add `conditions Json?` column on `InstructorApplicationChairDecision`; add new `ChairDecisionCommitAttempt` model |
| [NEW] | `lib/email/wait-list-template.ts` | `sendWaitlistEmail()` — uses the same pattern as `sendApplicationRejectedEmail()` |
| [MODIFY] | `app/globals.css` | ~60 LOC under `/* Phase 2D */` block: pending overlay blur, toast celebration confetti, commit button pending state |

### 9.8 Dependencies between Phase 2D components

```
FinalReviewCockpit
  ├── useCommitDecision()                     — new hook from §9.2
  ├── DecisionPendingOverlay                  — covers the dock during commit
  ├── DecisionConfirmModal (Phase 2C)         — calls commit.commit() on Confirm
  ├── PostDecisionToast (Phase 2A shell)      — now activated
  └── router.prefetch(nextUrl)                — warms the next applicant
```

Server-side:
```
chairDecide()                                 — extended; existing rollback logic preserved
  ├── idempotency check (new)
  │     └── ChairDecisionCommitAttempt (new table)
  ├── assertCanActAsChair (existing)
  ├── conditions validation (new, for APPROVE_WITH_CONDITIONS)
  ├── reject reason validation (new, for REJECT)
  ├── existing transaction: supersede, create decision, update status, role grant
  └── email send (existing; failure handling in Phase 2D.5)
```

All existing compensation logic (lines 1962–2013) is preserved
without modification. Phase 2D does not change the rollback contract;
Phase 2D.5 surfaces it in the UI.

### 9.9 Analytics events introduced in Phase 2D

| Event | Payload | Purpose |
|-------|---------|---------|
| `final_review.commit_started` | `{ applicationId, action, idempotencyKey }` | Funnel entry — intent → start |
| `final_review.commit_succeeded` | `{ applicationId, action, durationMs, syncedWorkflow: boolean, emailStatus }` | Core success metric; durationMs is the northstar |
| `final_review.commit_replayed` | `{ applicationId, action, idempotencyKey, originalDecidedAt }` | How often network flakiness triggers idempotent replay |
| `final_review.commit_failed` | `{ applicationId, action, error }` | 2D.5 adds retry tracking |
| `final_review.toast_shown` | `{ applicationId, decidedAction, nextApplicantId }` | Throughput input — did chairs see the next applicant? |
| `final_review.toast_advance_clicked` | `{ from, to, dwellMs }` | Does the toast actually accelerate queue walking? |
| `final_review.toast_dismissed` | `{ applicationId, reason }` | Opt-out signal; if high, rework the toast copy |

### 9.10 Phase 2D risks

- **`chairDecide` function length.** The existing function is already
  254 lines and dense. Adding WAITLIST + APPROVE_WITH_CONDITIONS +
  idempotency pushes it toward 320. Mitigation: extract `validateInputs()`
  and `computeStatusTransition()` helpers at the top of the file so
  the core transaction stays readable. Not a full refactor — just
  surgical extraction.
- **Idempotency key reuse across actions.** If the chair opens the
  modal, cancels, changes action, and commits, we must reset the key
  (`useCommitDecision.reset()`). If we don't, the server would replay
  the original action even though the chair intended a different one.
  Mitigation: `DecisionConfirmModal`'s `onClose` prop calls
  `commit.reset()` — covered by an e2e test.
- **Toast timing with `router.refresh()`.** `router.refresh()` fires
  after the commit to update the current page's audit banner. If the
  toast opens before the refresh completes, the chair can click
  advance before the current page has its new state. Mitigation:
  `router.refresh()` and toast `open()` fire in parallel; the toast's
  CTA navigates to `nextApplicant`, which is fetched on that route's
  own server component — not dependent on the current page's state.
- **Prefetch thrashing.** If a chair opens and closes the toast
  repeatedly, `router.prefetch(nextUrl)` fires once per open.
  Next.js dedupes prefetch requests internally, but monitor the
  dev tools Network tab during QA to confirm.
- **APPROVE_WITH_CONDITIONS timeline payload size.** JSON-stringified
  conditions could inflate the timeline payload to a few KB per
  decision. Postgres JSON columns handle this fine, but over a year
  of decisions the timeline table grows. Mitigation: §14 indexes the
  timeline by `applicationId` and `createdAt` — the payload size is
  not in the hot query path.

---

## 10. Components — Phase 2D.6: Transactional Failure Surfaces

**Phase 2D.6 mission:** when the commit transaction fails, gets rolled
back, or races with another chair, the chair sees exactly what happened
and knows what to do next. Never silent failure, never data loss, never
ambiguous state. The *high-severity* family of failures — the ones that
leave the database in a recoverable-but-non-obvious state.

Phase 2D shipped the happy path with a minimal inline error chip. This
phase replaces that chip with purpose-built surfaces for each failure
family:

| Failure family | What happened in the DB | UI surface |
|----------------|-------------------------|------------|
| **Sync rollback** | Decision committed then automatically reversed because workflow sync failed | Full-width red banner with retry |
| **Stale click** | Another chair won the race; status is no longer `CHAIR_REVIEW` | Modal showing who won with what action |
| **Validation** | Server rejected inputs (missing conditions, invalid reject reason, etc.) | Field-targeted error inside the confirm modal |
| **Deadlock** | Transient Postgres deadlock; Prisma retries exhausted | Soft toast with automatic retry |
| **Network drop** | Client never got the server's response | Idempotent retry via the existing key |

**Exit criteria for Phase 2D.6:**
1. `SyncRollbackBanner` renders when `chairDecide()` returns
   `{ error: "SYNC_ROLLBACK" }` — sticky at page top, z-index 70 (above
   dock + snapshot bar), never dismissible until the chair either
   retries successfully or navigates away
2. `StaleClickRecoveryModal` opens when `chairDecide()` returns
   `{ error: "STATUS_CHANGED", winnerChairName, winnerAction,
   winnerDecidedAt }` — auto-refreshes the page after the chair
   acknowledges
3. `CommitErrorModal` (new) replaces the inline error chip from 2D —
   handles validation errors with jump-to-field affordance
4. Deadlock errors silently auto-retry (up to 3 attempts, exponential
   backoff) and surface only if all retries fail
5. Network-drop recovery reuses the idempotency key from §9.2 — chair
   clicks Retry, same key, server replays if first attempt succeeded
   or processes freshly if it didn't
6. All five failure families have Playwright e2e coverage (§16 test plan)
7. Analytics events fire for each failure family; dashboards flag any
   rate > 1% as a P1 signal

### 10.1 Components in this phase

| # | Component | File | LOC | Client? |
|---|-----------|------|-----|---------|
| 1 | `SyncRollbackBanner` | `components/instructor-applicants/final-review/SyncRollbackBanner.tsx` | ~110 | yes |
| 2 | `StaleClickRecoveryModal` | `components/instructor-applicants/final-review/StaleClickRecoveryModal.tsx` | ~140 | yes |
| 3 | `CommitErrorModal` | `components/instructor-applicants/final-review/CommitErrorModal.tsx` | ~160 | yes |
| 4 | `DeadlockRetryToast` | `components/instructor-applicants/final-review/DeadlockRetryToast.tsx` | ~60 | yes |
| 5 | `NetworkRecoveryBanner` | `components/instructor-applicants/final-review/NetworkRecoveryBanner.tsx` | ~90 | yes |

Plus ~120 LOC of CSS for the banners, modal content, and toast motion.

### 10.2 `SyncRollbackBanner` — the highest-severity surface

**Purpose.** Tells the chair, unambiguously, that their decision was
*committed and then reversed* because the workflow-sync step after
the transaction failed. The existing `chairDecide()` at lines 1962–2013
already runs the compensator (reverts role grants, flips status back
to `CHAIR_REVIEW`, writes a `SYNC_ROLLBACK` timeline event). Phase 2D.6
surfaces that compensator firing.

**Props.**
```ts
interface SyncRollbackBannerProps {
  applicationId: string;
  rolledBackAction: ChairDecisionAction;
  reversedAt: string;
  reason: string;                         // server-provided human-readable
  onRetry: () => void;                    // calls commit.commit() with same inputs
  onContactSupport: () => void;           // opens mailto + copies context to clipboard
}
```

**Visual.** Full-width (spans the grid), red left-border (8 px
`--score-weak`), pale red background (`rgba(239, 68, 68, 0.06)`),
icon-label-color per §2.9 with `AlertOctagon`. Copy:

> **Decision was reversed.** We couldn't finalize "Approve" for
> *Alex Morgan* because the onboarding pipeline didn't update. The
> decision record was removed and the applicant is back in your
> queue. [Retry] [Contact support]

**Behavior.**
- Mounts at page top, sticky (`position: sticky; top: 0; z-index: 70`)
  — overlays the snapshot bar until dismissed or resolved
- Dock buttons remain enabled; the chair can retry immediately or edit
  the rationale first
- Retry reuses the Phase 2D idempotency key (if the original
  `ChairDecisionCommitAttempt` was marked `FAILED`, retry processes
  freshly; if somehow marked `SUCCESS`, replay returns the same
  result — defensive)
- Contact support copies a diagnostic block to clipboard:
  `applicationId`, `rolledBackAction`, `reversedAt`, `reason`,
  `chairId`, `idempotencyKey` — so the chair can paste into an email
  without having to screenshot and narrate

**Motion.** Slide in from top (220 ms spring per §2.6 surface-entry).
Never auto-dismisses — this is a serious event, the chair must act.

**Accessibility.** `role="alert"` `aria-live="assertive"` — screen
readers announce immediately and interrupt current speech. The retry
button is autofocused when the banner appears so the chair can act
without hunting.

### 10.3 `StaleClickRecoveryModal` — the race loser's recovery

**Purpose.** Two chairs can race on the same applicant. The first to
commit wins; the second gets `STATUS_CHANGED`. The loser needs to
know who won, what they decided, and see the page update to reflect
reality.

Today (pre-redesign) the loser just sees a generic error. Phase 2D.6
shows the winner's decision clearly, then auto-refreshes the page so
the status banner (§6.7 `ApplicantStatusBanner`) reflects the actual
new state.

**Props.**
```ts
interface StaleClickRecoveryModalProps {
  open: boolean;
  winnerChairName: string;
  winnerAction: ChairDecisionAction;
  winnerDecidedAt: string;
  winnerRationalePreview: string;         // first 240 chars
  attemptedAction: ChairDecisionAction;   // what THIS chair tried to do
  onAcknowledge: () => void;              // closes + router.refresh()
}
```

**Visual.** Standard modal (backdrop + centered card, z-index 50/60).
Card header: `AlertCircle` icon (amber, not red — this is unexpected
but not an error).

> **This applicant was just decided by another chair.**
>
> *Alex Chen* marked *Alex Morgan* as **Approved with Conditions**
> about 12 seconds ago.
>
> Their rationale (preview):
> > "Strong curriculum and teaching demo. Conditions: complete
> > onboarding module 2 within 30 days…"
>
> [See full decision] [Back to queue] [Continue reviewing audit]

**Behavior.**
- On "Back to queue" → navigate to `/admin/instructor-applicants/chair-queue`
- On "Continue reviewing audit" → close modal, `router.refresh()`, the
  page re-renders with `ApplicantStatusBanner` reflecting the new
  decision; dock collapses to read-only per §7.2
- On "See full decision" → expands the modal to show full rationale +
  conditions (if any) + link to the other chair's profile
- This chair's draft rationale is preserved in localStorage (§7.3)
  — if they walk away and the decision is later rescinded, their
  draft is still there

**Preemption.** If the chair's rationale differs from the winner's in
substantive ways, offer *"Send your rationale to the winning chair?"*
— creates a `ReviewSignalReply` anchored on the decision with the
chair's draft as the body. Valuable for edge cases where the loser
saw something the winner missed.

**Motion.** Standard modal entrance (300 ms spring, §2.6 layout).

### 10.4 `CommitErrorModal` — validation failures with jump-to-field

**Purpose.** Replaces the inline error chip from Phase 2D for
validation errors. When `chairDecide()` rejects inputs (missing
conditions, invalid reject reason, conditions too long), the chair
sees exactly which field was wrong and can jump back to fix it.

**Props.**
```ts
interface CommitErrorModalProps {
  open: boolean;
  error: {
    code: CommitValidationErrorCode;
    field?: "conditions" | "rejectReasonCode" | "rejectFreeText" | "rationale";
    fieldIndex?: number;                  // for conditions[3].label
    message: string;                      // server-provided
  };
  onJumpToField: () => void;              // closes modal + focuses field
  onDismiss: () => void;
}

type CommitValidationErrorCode =
  | "CONDITIONS_REQUIRED"
  | "CONDITION_LABEL_INVALID"
  | "CONDITION_LABEL_TOO_LONG"
  | "CONDITION_OWNER_NOT_FOUND"
  | "TOO_MANY_CONDITIONS"
  | "REJECT_REASON_REQUIRED"
  | "RATIONALE_TOO_LONG"
  | "CONTRARIAN_OVERRIDE_MISSING";        // chair skipped Phase 2C warning somehow
```

**Visual.** Compact modal (narrower than decision confirm), amber
accent (not red — validation isn't a system failure, just "try again").

> **We couldn't save this decision.**
>
> *Condition #3 is missing a label.*
>
> Conditions must have a clear label (1–300 characters) so the
> applicant and onboarding team know what to do.
>
> [Fix condition #3] [Cancel]

**Behavior.** Clicking "Fix condition #3" closes the error modal,
keeps the main confirm modal open, scrolls to that condition's row in
`ApproveWithConditionsEditor`, and focuses its label input with a
brief red outline pulse (200 ms).

**Why not inline.** Inline validation on every keystroke would be
noise. The server is the authority; surface its error at commit time
in a way that's recoverable without rebuilding the entire form.

### 10.5 `DeadlockRetryToast` — silent auto-retry

**Purpose.** Postgres deadlocks are transient — another transaction
held a lock, Prisma's retry exhausted, `chairDecide()` returns
`{ error: "DEADLOCK_DETECTED" }`. Rather than showing an error banner,
the client auto-retries with exponential backoff and only surfaces UI
if all retries fail.

**Behavior (lives inside `useCommitDecision`, not a visible component most
of the time).**

```ts
// Inside useCommitDecision.commit():
for (let attempt = 1; attempt <= 3; attempt++) {
  const result = await chairDecide(formData);
  if (result.error !== "DEADLOCK_DETECTED") return result;
  setState({ status: "pending-retry", attempt });
  await sleep(200 * 2 ** attempt);  // 400ms, 800ms, 1600ms
}
// all retries failed — show the toast
```

**Props (toast shell only, visible during retry).**
```ts
interface DeadlockRetryToastProps {
  open: boolean;
  attempt: number;                        // 1, 2, or 3
  maxAttempts: number;
}
```

**Visual.** Small toast, bottom-left, amber. Copy:
> *"Busy moment — retrying… (attempt 2 of 3)"*

If all 3 fail, toast is replaced by a `CommitErrorModal` with code
`DEADLOCK_EXHAUSTED` and copy *"Database is busy. Wait a moment and
try again."* — no auto-retry beyond 3.

**Motion.** Slide in from bottom-left (180 ms easeOut). Auto-dismisses
on success. Reduced-motion: instant toggle.

### 10.6 `NetworkRecoveryBanner`

**Purpose.** When the client detects a fetch timeout or `AbortError`
during commit, it can't know whether the server processed the
request. The banner surfaces this ambiguity and lets the chair retry
safely using the idempotency key.

**Props.**
```ts
interface NetworkRecoveryBannerProps {
  applicationId: string;
  attemptedAction: ChairDecisionAction;
  attemptedAt: string;
  idempotencyKey: string;
  onRetry: () => void;
  onCheckStatus: () => void;              // polls current application status
}
```

**Visual.** Amber banner (sticky top, z-index 70, below SyncRollbackBanner
priority). Copy:

> **We couldn't confirm whether your decision saved.**
>
> Your connection dropped mid-submit. If the server already
> processed it, retrying is safe — we'll detect the duplicate.
>
> [Retry] [Check status]

**Behavior.**
- "Retry" calls `commit.commit()` with the same idempotency key. If
  the server processed the first attempt successfully, the call
  returns `{ replayed: true }` and the toast flow activates normally.
  If the server never saw the first attempt, the call processes
  fresh.
- "Check status" calls a lightweight `getApplicationStatus(id)` query
  (new, ~5 LOC in `lib/final-review-queries.ts`) and renders a
  state-dependent follow-up:
  - Status changed to APPROVED (or whatever) → close banner, refresh
    page, show success toast after the fact
  - Status still CHAIR_REVIEW → safe to retry

**Motion.** Slide from top (180 ms easeOut). Persistent until resolved.

### 10.7 Error-code contract — client ↔ server

For all of the above to work cleanly, `chairDecide()` must return
structured error codes, not just error strings. Extend the existing
`ApplicantWorkflowError` class to carry a machine-readable code plus
an optional `context` object:

```ts
class ApplicantWorkflowError extends Error {
  constructor(
    public code:
      | "STATUS_CHANGED"
      | "SYNC_ROLLBACK"
      | "DEADLOCK_DETECTED"
      | "CONDITIONS_REQUIRED"
      | "CONDITION_LABEL_INVALID"
      | "CONDITION_LABEL_TOO_LONG"
      | "CONDITION_OWNER_NOT_FOUND"
      | "TOO_MANY_CONDITIONS"
      | "REJECT_REASON_REQUIRED"
      | "RATIONALE_TOO_LONG"
      | "CONTRARIAN_OVERRIDE_MISSING"
      | "UNAUTHORIZED"
      | "APPLICATION_NOT_FOUND",
    public context?: Record<string, unknown>
  ) {
    super(code);
  }
}
```

The server action's outer try/catch serializes this into the response
shape:

```ts
return {
  success: false,
  error: err.code,
  context: err.context,
  message: HUMAN_MESSAGES[err.code],
};
```

Client discriminates on `error` to pick the right surface:

| `error` code | UI surface |
|---------------|------------|
| `STATUS_CHANGED` | `StaleClickRecoveryModal` |
| `SYNC_ROLLBACK` | `SyncRollbackBanner` |
| `DEADLOCK_DETECTED` | `DeadlockRetryToast` (then modal on exhaustion) |
| `CONDITIONS_REQUIRED` + friends | `CommitErrorModal` with `field` |
| `REJECT_REASON_REQUIRED` | `CommitErrorModal` with `field: "rejectReasonCode"` |
| `RATIONALE_TOO_LONG` | `CommitErrorModal` + focus rationale field |
| `UNAUTHORIZED` / `APPLICATION_NOT_FOUND` | Navigate to `/admin/instructor-applicants/chair-queue` with a toast |
| (timeout/AbortError client-side) | `NetworkRecoveryBanner` |

This is a tight, exhaustive switch — the `useCommitDecision` hook
discriminates once and routes to the right surface. No string parsing,
no drift.

### 10.8 Files touched in Phase 2D.6

| Status | Path | Notes |
|--------|------|-------|
| [NEW] | `components/instructor-applicants/final-review/SyncRollbackBanner.tsx` | §10.2 |
| [NEW] | `components/instructor-applicants/final-review/StaleClickRecoveryModal.tsx` | §10.3 |
| [NEW] | `components/instructor-applicants/final-review/CommitErrorModal.tsx` | §10.4 |
| [NEW] | `components/instructor-applicants/final-review/DeadlockRetryToast.tsx` | §10.5 |
| [NEW] | `components/instructor-applicants/final-review/NetworkRecoveryBanner.tsx` | §10.6 |
| [MODIFY] | `lib/use-commit-decision.ts` | §10.5 auto-retry loop; §10.7 error discrimination routes to the right surface |
| [MODIFY] | `lib/instructor-application-actions.ts` | §10.7 extend `ApplicantWorkflowError` with structured codes; wire existing rollback + sync-rollback to return `{ error: "SYNC_ROLLBACK" }` structured response |
| [MODIFY] | `components/instructor-applicants/final-review/FinalReviewCockpit.tsx` | Mount the five new surfaces at cockpit root; route events from `useCommitDecision.state.error` |
| [MODIFY] | `components/instructor-applicants/final-review/DecisionConfirmModal.tsx` | Remove the inline error chip from 2D; error display now delegated to `CommitErrorModal` |
| [NEW] | `lib/final-review-queries.ts` | Add `getApplicationStatus(id)` — tiny query for network-recovery "Check status" action |
| [MODIFY] | `app/globals.css` | ~120 LOC under `/* Phase 2D.6 */` block: banner variants, deadlock toast, error modal accent |

### 10.9 Dependencies between Phase 2D.6 components

```
FinalReviewCockpit
  ├── useCommitDecision (from 2D, now with retry loop)
  │     ├── SyncRollbackBanner          — when error === "SYNC_ROLLBACK"
  │     ├── StaleClickRecoveryModal     — when error === "STATUS_CHANGED"
  │     ├── CommitErrorModal            — when error === validation codes
  │     ├── DeadlockRetryToast          — during auto-retry attempts
  │     └── NetworkRecoveryBanner       — when AbortError/timeout
  └── DecisionConfirmModal (from 2C)    — onJumpToField from CommitErrorModal routes here
```

Server-side dependencies: all of Phase 2D.6's UI depends on the
structured error codes from `chairDecide()`. The existing compensation
logic at lines 1962–2013 is preserved unchanged; Phase 2D.6 only adds
the structured error contract, it does not alter the transactional
flow.

### 10.10 Analytics events introduced in Phase 2D.6

| Event | Payload | Purpose |
|-------|---------|---------|
| `final_review.sync_rollback_shown` | `{ applicationId, action, reason }` | Count rate of `SYNC_ROLLBACK` — target < 0.1% of commits |
| `final_review.sync_rollback_retried` | `{ applicationId, attempt, outcome }` | Do chairs recover from rollback? |
| `final_review.stale_click_shown` | `{ applicationId, attemptedAction, winnerAction, raceWindowMs }` | Concurrency pressure signal |
| `final_review.stale_click_sent_rationale_to_winner` | `{ fromChairId, toChairId, applicationId }` | Measure the cross-chair rationale-handoff feature |
| `final_review.validation_error_shown` | `{ applicationId, code, field }` | Which validation errors chairs hit most |
| `final_review.deadlock_auto_retry` | `{ applicationId, attempt, succeeded }` | Deadlock rate; if > 1% investigate DB pressure |
| `final_review.network_recovery_shown` | `{ applicationId, action }` | Network-drop rate |
| `final_review.network_recovery_check_status` | `{ applicationId, resolvedStatus }` | Does the "Check status" affordance actually help? |

All events hit the existing `trackEvent` helper. Dashboard thresholds:

| Event | P1 alert | P0 alert |
|-------|----------|----------|
| `sync_rollback_shown` rate | > 0.5% | > 2% |
| `stale_click_shown` rate | > 5% | > 20% (queue race problem) |
| `validation_error_shown` rate | > 3% (UX issue, not system) | > 10% |
| `deadlock_auto_retry` rate | > 1% | > 5% |

### 10.11 Phase 2D.6 risks

- **Banner stacking.** If both `SyncRollbackBanner` and
  `NetworkRecoveryBanner` fire in rapid succession (rare but possible
  — network drops during the compensator), the UI must render only
  the higher-severity one. Mitigation: explicit `z-index` hierarchy
  (sync rollback 70, network 65) plus `useCommitDecision` only holds
  one error at a time — newer errors supersede older ones, which is
  correct because the newer state is authoritative.
- **Silent auto-retry masking real problems.** If we auto-retry
  deadlocks transparently, we may hide a growing DB contention issue.
  Mitigation: every auto-retry fires an analytics event; a dashboard
  alert triggers if the rate exceeds 1%.
- **`SyncRollbackBanner` copy is scary.** "Decision was reversed" is
  an alarming phrase. Mitigation: the copy emphasizes what's true
  and actionable ("back in your queue", "Retry"), not what's broken.
  Copy should be reviewed with product/comms before launch.
- **Stale-click modal as a privacy leak.** The winning chair's name
  and rationale preview are surfaced to the loser. This is already
  visible in the audit timeline, so no new leak — but worth
  confirming with legal that hiring chairs seeing other chairs'
  decisions is acceptable. Flagged in §17.
- **`onJumpToField` brittleness.** The jump requires
  `CommitErrorModal` to know the DOM structure of
  `ApproveWithConditionsEditor`. Mitigation: fields expose stable
  `data-testid` attributes; the jump uses `document.querySelector`
  on that attribute, not on DOM position.
- **Idempotency key reuse during `SYNC_ROLLBACK`.** When the
  compensator fires, the `ChairDecisionCommitAttempt` row should be
  marked `FAILED` (not `SUCCESS`) so retry processes freshly. Mitigation:
  §14 makes this explicit in the schema — `result: SUCCESS` is set
  only after the compensator's guard clause confirms no rollback was
  needed.

---

*Sections 11–17 to follow.*
