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

**2. Pin a quote.** Press `P` while hovering a feed item. The item gets a
purple left-border accent (200 ms ease-in-out), a small `📌` indicator
fades in (120 ms), and the item animates via `layoutId` to the pinned rail
above the feed. The animation makes the *spatial relationship* between
"feed" and "pinned" obvious without requiring explanation.

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
- *No pinned signals:* one line of help text *"Press `P` while hovering a
  comment to pin it for your rationale."*

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

**Keyboard shortcuts and input scope.** The single most-likely UX bug is
the chair typing rationale and the letter `A` triggering Approve. Solution:
the `useHotkeys` hook (per `react-hotkeys-hook`) ignores events whose
target is `input | textarea | [contenteditable]` unless the user holds
`Meta`/`Ctrl`. Help overlay (`?` key) lists every shortcut.

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
- **1 day** for keyboard shortcut hints + the `?` help overlay
- **1 day** for skeletons across all loading states
- **1 day** for the empty-state composition pass

Total polish budget: **~10 days** beyond the functional implementation.
Tracking these as separate line items in §8's roadmap so they don't get
silently absorbed into "feature complete."

---

*Sections 3–8 to follow.*
