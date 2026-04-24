# YPP Instructor Training — Interactive Rebuild

_Plan file. Sections 1–3. Subsequent sections appended in follow-up edits._

---

## 1. Executive Summary

### What we're building

A premium, scenario-driven Instructor Training Academy that replaces the current video-and-quiz kanban with a short (30–45 min before capstone), highly interactive journey. Five new modules, each a sequence of micro-"beats" (concept reveals, scenario choices, drag-orders, branching decisions, spot-the-mistakes, reflections) that end with a scored Readiness Check gating the existing Lesson Design Studio capstone.

### Why this is the right system

- **Reuses the existing readiness spine, doesn't replace it.** `TrainingModule` / `TrainingAssignment` / `getInstructorReadiness()` already compute the gate into Lesson Design Studio, class-settings offering approval, and the interview lane. The new interactive modules register as `TrainingModule` records of a new type `INTERACTIVE_JOURNEY`; on completion we upsert `TrainingAssignment.status = COMPLETE` and the rest of the portal (dashboard, admin readiness board, chapter-lead view, publish gates) works unchanged.
- **Content is authored in TypeScript, stored in DB.** Satisfies the "database-backed" requirement (admins can see/inspect records, future in-app editor is possible) while keeping content in code review today. The existing `training:import` / `training:validate` / `training:seed-content` script pipeline is extended, not replaced.
- **One viewer, one hub.** `/instructor-training` and `/training/[id]` are rebuilt in place. The viewer branches on module type: video modules keep working for legacy/admin-created content; interactive journeys render the new `JourneyPlayer`. No parallel routes, no redirects to maintain.
- **Motion is additive, not structural.** Framer Motion powers the beat transitions, stagger entrances, progress ring, and celebration moments. Respects `prefers-reduced-motion`. The underlying CSS design system (`--ypp-purple`, `--surface`, `--shadow-purple`, `--radius-lg`, `--transition-base`) carries the visual weight; motion just makes it feel alive.
- **Scoring is uniform and auditable.** One `BeatScorer(beat, response) → {correct, score}` contract per beat kind, Zod-validated at import and runtime, with `schemaVersion` so per-kind evolution doesn't corrupt history. All attempts append-only in `InteractiveBeatAttempt`; one materialized `InteractiveJourneyCompletion` row per user per module, upserted on replay.

### Non-goals

- Rebuilding the Lesson Design Studio (out of scope; we connect into it via the existing `?entry=training` link).
- Changing the instructor interview gate, offering-approval flow, or admin application review.
- In-app content authoring UI for the new modules (beats are imported from TS files; admin can view & force-reset progress, but editing is a later surface).
- Replacing admin-created video modules — those continue to render through the legacy path.

### Success criteria

1. An instructor can complete all five new modules end-to-end in ≤45 min with no video.
2. On passing Readiness Check, `/instructor/lesson-design-studio?entry=training` is unlocked via the existing readiness lib — zero new gate code in consumer routes.
3. Lighthouse a11y ≥95 on hub, module, and completion screens; full keyboard operation of every beat kind.
4. Hub first contentful paint ≤1.5s on mid-tier mobile; no CLS on beat transitions.
5. Admin can see, per instructor, module-by-module completion + per-beat attempt history, and can reset a journey.

---

## 2. User Flow

### Entry

Instructor (or admin/chapter president with the same access via `hasApprovedInstructorTrainingAccess`) lands on `/instructor-training` from the "My Pathway" dashboard. Role gate reuses `lib/training-access.ts` unchanged.

### Hub screen — `/instructor-training`

Replaces today's 3-column kanban with:

1. **Hero band** — progress ring (overall %), current XP, next action CTA ("Continue: Run a Great Session"). Interview-gate + offering-approval status compressed into two small chips on the right (they used to own the middle of the page; they're secondary to the learning journey now).
2. **Module rail** — five large cards in a vertical-on-mobile, horizontal-on-desktop rail, each showing: title, 1-line purpose, estimated minutes, state (Locked / Ready / In Progress / Complete), earned badge on complete. Sequential unlock by `sortOrder`.
3. **Capstone card** — Lesson Design Studio card, locked with a lock icon + "Pass Readiness Check to unlock" until `studioCapstoneComplete` is false AND the new Readiness Check is passed. On unlock: pulses, then routes to `/instructor/lesson-design-studio?entry=training`.
4. **Legacy modules section (collapsible, admin-visible only if present)** — any `TrainingModule` with type !== `INTERACTIVE_JOURNEY` and !== the studio marker renders here in a compact list for backward compatibility. Hidden entirely when empty.
5. **Earned badges strip** — five slots, fill as modules complete. Tiny, celebratory, not dominant.

### Module landing — `/training/[id]` (interactive journey branch)

When the module's `type === INTERACTIVE_JOURNEY`, the viewer renders a **JourneyIntro** screen instead of the video shell:

- Module title, 1-paragraph why-this-matters, estimated time, number of beats
- "Start" button (or "Resume" if there's in-progress attempt state)
- Back link to hub

### Journey player — same route, after Start

`JourneyPlayer` client component takes over the viewport:

- Top bar: progress dots (one per beat) + close/exit to hub (saves state)
- Stage: one beat rendered at a time via `<AnimatePresence mode="wait">`
- Bottom bar: context-sensitive action ("Check", "Next", "Try again")
- Feedback panel: slides up on answer, explains why; on incorrect, user can retry until correct (scoring records first-attempt correctness)

### Beat-by-beat progression

- Each beat is a self-contained screen. The user answers → clicks Check → feedback animates in → clicks Next → next beat slides in (right-to-left on advance, left-to-right on back).
- Beat renders by `kind` through a `BeatRenderer` switch. Each kind has its own component, keyboard map, ARIA semantics.
- On answer submit, server action writes `InteractiveBeatAttempt` with `attemptNumber`, response JSON, correct/score, timeMs. Client holds optimistic state; server authoritative.

### Journey complete

When the last beat is scored, `JourneyComplete` screen:

- Confetti burst (framer-motion, reduced-motion respectful)
- Score summary: X of Y correct on first try, total XP earned, badge revealed
- Server action upserts `InteractiveJourneyCompletion` (with `passed = scorePct >= passScorePct`) and upserts `TrainingAssignment.status = COMPLETE` for this moduleId; revalidates `/instructor-training`.
- Two CTAs: "Back to Academy" (primary) and "Start next module" (if one is unlocked).

### Readiness Check (Module 5)

Same journey mechanics, but:

- Beats are a mixed bank drawn from all four preceding domains (not all from the same module).
- First-try correctness is the only thing scored (no retry-to-correct loop; user has to live with their choice).
- Pass threshold: 80%. Below 80%: completion screen shows per-domain score breakdown, points back to the weakest module(s), offers "Retake Readiness Check" (new attempt cycle). Readiness is retakable; on retake the most recent completion row is the source of truth.
- On pass: `InteractiveJourneyCompletion.passed = true`, assignment COMPLETE, hub capstone card unlocks, user is offered "Open Lesson Design Studio" as the primary CTA.

### Capstone handoff

Existing link pattern preserved: `/instructor/lesson-design-studio?entry=training`. No new code in the studio. The studio's existing `studioCapstoneComplete` signal continues to own the final training-complete flag.

### State & resume

- Progress is server-truth (attempts table + completion row). Client keeps optimistic "which beat am I on" state only.
- Leave and return: `JourneyIntro` detects in-progress (any attempt exists but no completion row) → "Resume" button. Advances to first beat without a successful attempt.
- No timed sessions. User can take days between beats.

### Gamification touches

- XP per beat: 10 base, 2× on first-try correct.
- Module badge: one per completed journey (e.g. "Standard Bearer", "Session Ace", "Classroom Whisperer", "Reliable Pro", "Ready to Teach"). Derived from completion rows; no new badge table.
- Readiness score: a second, "official" number shown in the completion screen and on the hub after the Readiness Check is passed.
- No leaderboards, no streaks, no external-facing levels. Stays professional.

---

## 3. Routes / Information Architecture

### Routes modified

| Route | File | Change |
| --- | --- | --- |
| `/instructor-training` | `app/(app)/instructor-training/page.tsx` | Replace kanban with new hub (hero + module rail + capstone + legacy fallback). Still RSC; fetches modules + assignments + completions + readiness. |
| `/training/[id]` | `app/(app)/training/[id]/page.tsx` + `client.tsx` | Branch on `module.type`. If `INTERACTIVE_JOURNEY`, render new `JourneyShell` (intro → player → complete). Else, existing video/quiz/evidence UI unchanged. |

### Routes unchanged (but linked into)

- `/instructor/lesson-design-studio?entry=training` — capstone handoff
- `/interviews/schedule` — interview lane (moved off-hub into a chip)
- `/admin/instructor-readiness`, `/chapter-lead/instructor-readiness` — admin boards keep reading from the same readiness lib and begin to see interactive-journey completions automatically
- `/admin/training` — legacy module manager still governs admin-created video content

### New routes

| Route | Purpose |
| --- | --- |
| `/admin/training/journeys` | Read-only admin dashboard: list journeys, per-user progress, reset per-journey |
| `/admin/training/journeys/[moduleId]` | Inspector for one journey: beats list, attempt counts, avg score, drop-off by beat |

(No new user-facing routes. Everything else is a component swap inside existing routes.)

### Navigation

- Sidebar entry "Instructor Training" unchanged; points to `/instructor-training`.
- Breadcrumb inside `/training/[id]`: "Academy / {Module Title}". Exiting a journey mid-way returns to `/instructor-training` with a toast: "Progress saved."
- Admin nav: under existing "Admin → Training" add a subitem "Journeys".

### Information hierarchy on the hub (top → bottom)

1. Back link ("← My Pathway") — small, top-left
2. Page title + "Step 1 of Your Instructor Pathway" badge
3. Hero: overall progress ring, current XP, primary CTA (Continue / Start)
4. Readiness band (only after Module 5 is passed): readiness score + per-domain chips
5. Module rail (5 cards, sequential)
6. Capstone card (Lesson Design Studio)
7. Collapsible: "Interview Readiness" (compressed version of today's large section)
8. Collapsible: "Offering Approval" (compressed)
9. Collapsible: "Legacy modules" (only if any exist)
10. Earned badges strip + training certificate

Today's page is ~580 lines of inline JSX; the rebuilt hub pulls presentational pieces into `/components/training/hub/*` and keeps `page.tsx` as an RSC data orchestrator under ~200 lines.

---

## 4. Module Specs

All five modules share the same engine: a linear journey of 6–10 beats drawn from the beat library (Section 5), with a terminal `JourneyComplete` screen. `passScorePct` defaults to 80 but is per-module. `estimatedMinutes` surfaces on the hub card and in the intro screen.

---

### Module 1 — The YPP Standard

- **`contentKey`**: `academy_ypp_standard_001`
- **`sortOrder`**: 1 (first to unlock)
- **Estimated time**: 5–7 min
- **Pass threshold**: 80%

**Learning objective.** By the end, the instructor can articulate YPP's teaching bar, recognize red-flag instructor behaviors in context, and identify the decisions that separate a strong instructor from a compliant one.

**Beat sequence (8 beats):**

1. `CONCEPT_REVEAL` — "What YPP expects." Three-tab reveal (Prepare / Show Up / Follow Through). Each tab uncovers one expectation with a one-sentence example. Not scored.
2. `COMPARE` — Two instructor session recaps side-by-side (same class, two approaches). User picks the one that meets the YPP standard and gets feedback on why.
3. `SCENARIO_CHOICE` — "A parent emails asking for a progress update two weeks in. You…" — 4 choices, only one meets the bar.
4. `MULTI_SELECT` — "Which of these are red flags during a first session?" 6 options; select the 3 that are actually red flags. `scoringRule: "threshold"` (all 3 correct, no false positives).
5. `SPOT_THE_MISTAKE` — Short lesson-plan excerpt rendered as a card; user clicks the phrase that violates the standard. One hotspot.
6. `SCENARIO_CHOICE` — "An instructor cancels 30 min before class with no backup plan." Pick the best next-step as a peer instructor.
7. `REFLECTION` — One-sentence prompt: "Which expectation will be hardest for you to meet, and what will you do about it?" Not scored, stored as a `TrainingReflection` attempt for mentor visibility.
8. `JourneyComplete` — score, badge "Standard Bearer", XP tally.

**Scoring.** 6 scored beats × base weight 10 = 60 max. First-try correct doubles to 120 XP ceiling. Pass = ≥80% of _scored_ weight (threshold of 48/60 correct-weight).

**Completion criteria.** `InteractiveJourneyCompletion.passed = true` → `TrainingAssignment.status = COMPLETE`. Unlocks Module 2.

---

### Module 2 — Run a Great Session

- **`contentKey`**: `academy_run_session_002`
- **`sortOrder`**: 2
- **Estimated time**: 7–9 min
- **Pass threshold**: 80%

**Learning objective.** Instructor can structure a session's first 10 minutes, pace a 60-minute block, and respond to confusion without derailing the lesson.

**Beat sequence (9 beats):**

1. `CONCEPT_REVEAL` — "The shape of a strong session." Timeline graphic with 4 phases; tap each to reveal purpose + time.
2. `SORT_ORDER` — Drag 5 opening-minutes activities into the best order (icebreaker, recap-last-session, state-today's-outcome, first-hands-on, check-for-understanding). Scoring: exact order or adjacent-pair credit via `scoringRule: "ordered"`.
3. `SCENARIO_CHOICE` — Mid-session, a student says "I don't get it." Pick best teacher response among 4 options (the wrong ones are: repeat verbatim / skip ahead / assign homework / the right one: ask which part and re-ground).
4. `FILL_IN_BLANK` — "A good pacing check asks ______." Short answer, graded against 3 acceptable keyword patterns (e.g. "what we just did", "explain in your own words"). Fuzzy match via normalized-lowercase substring.
5. `COMPARE` — Two teacher questions shown; user picks the stronger one (open vs. closed).
6. `SORT_ORDER` — Drag a weak lesson outline into a stronger one (merge two beats, move closure to the end).
7. `SCENARIO_CHOICE` — "Class is 15 min ahead of pace." 4 options; best one extends depth, not pads time.
8. `REFLECTION` — "Describe your first 10 minutes for your own class." Stored, not scored.
9. `JourneyComplete` — badge "Session Ace".

**Scoring.** 7 scored beats, weighted (sort-orders = 15, others = 10) → ~75 max. ≥80% to pass.

**Completion criteria.** Unlocks Module 3.

---

### Module 3 — Student Situations

- **`contentKey`**: `academy_student_situations_003`
- **`sortOrder`**: 3
- **Estimated time**: 8–10 min (branching adds time)
- **Pass threshold**: 75% (branching is nuanced; lower bar)

**Learning objective.** Instructor can diagnose and respond to five recurring classroom moments (quiet student, distracted student, "I don't get it", student who dominates, low-energy room) with approaches that match the student, not just the script.

**Beat sequence (7 beats, including 3 branching scenarios):**

1. `CONCEPT_REVEAL` — "Read the room, then the student." Quick intro: diagnose before responding.
2. `BRANCHING_SCENARIO` — "Quiet student." Root beat asks what you'd try first (4 options). Child beats: each option leads to 1–2 follow-up beats showing the consequence and asking what to do next. Each leaf scored individually.
3. `BRANCHING_SCENARIO` — "Distracted student." Same pattern. The "correct" path isn't a single golden answer — it's any sequence where the final state is re-engaged without shaming.
4. `SCENARIO_CHOICE` — "'I don't get it' — what do you ask first?" Single-beat, no branching.
5. `BRANCHING_SCENARIO` — "Student dominates the discussion." Branches explore cutting off vs. redirecting vs. reframing.
6. `MATCH_PAIRS` — Match each of the 5 situations to the single strongest diagnostic question.
7. `JourneyComplete` — badge "Classroom Whisperer".

**Branching mechanic (how it's scored).** Per the schema-review memo, branches are first-class beats with `parentBeatId` and `showWhen` predicate. Each visited leaf is a scored `InteractiveBeatAttempt`. The journey's beat-count denominator only counts beats the user actually saw (not the whole DAG) — otherwise users are penalized for taking different paths. Scorer: sum of visited-beat scores ÷ sum of visited-beat weights.

**Scoring.** Visited-beat denominator; ≥75% to pass.

**Completion criteria.** Unlocks Module 4.

---

### Module 4 — Communication & Reliability

- **`contentKey`**: `academy_communication_004`
- **`sortOrder`**: 4
- **Estimated time**: 5–7 min
- **Pass threshold**: 80%

**Learning objective.** Instructor can write a parent/admin message in the right tone for the situation, knows what to communicate and when, and recovers from a missed commitment professionally.

**Beat sequence (7 beats):**

1. `CONCEPT_REVEAL` — "Three rules of YPP communication." Reveal cards: respond within 24h, lead with the student, no surprises.
2. `MESSAGE_COMPOSER` — "You're running 10 min late to class." User picks a tone (apologetic / neutral / overexplaining) and picks from 3 opening lines, 3 middle lines, 3 closing lines. Scoring: tone rubric (apologetic + specific-ETA + no-excuses combo is correct).
3. `MESSAGE_COMPOSER` — Parent email: "My child isn't learning anything." User composes from building blocks; scored on whether the reply is (a) acknowledging, (b) specific about what's been taught, (c) proposing a next step.
4. `MULTI_SELECT` — "Which of these need to be communicated to a parent proactively?" 6 options.
5. `SCENARIO_CHOICE` — "You missed a session. What's your first action?" 4 options; best is a specific ETA + make-up plan in one message.
6. `SPOT_THE_MISTAKE` — A real-looking parent email reply with one tone problem; click the line.
7. `JourneyComplete` — badge "Reliable Pro".

**`MESSAGE_COMPOSER` scoring.** Rubric-based: each composed message is validated against a set of required attributes (expressed in beat config). Correct if all required attrs present AND no banned attrs present. Attrs are typed tags on each message-block option, not free-form.

**Scoring.** 6 scored beats, ≥80%.

**Completion criteria.** Unlocks Module 5.

---

### Module 5 — Readiness Check

- **`contentKey`**: `academy_readiness_check_005`
- **`sortOrder`**: 5
- **Estimated time**: 8–10 min
- **Pass threshold**: 80%
- **Unique behavior**: _no retry-to-correct on individual beats_; single-attempt scoring for the whole check.

**Learning objective.** Demonstrate integrated readiness across all four prior domains before unlocking the capstone.

**Beat sequence (10 beats, mixed-bank):**

- 2 beats drawn from Module 1 domain (standard / red flags)
- 2 from Module 2 (session flow / pacing)
- 2 from Module 3 (student situations — but single-beat versions, not branching, to keep length bounded)
- 2 from Module 4 (communication / reliability)
- 2 "capstone-flavored" integration beats: multi-domain scenarios that require holding two things in mind at once (e.g., "mid-class disruption that also requires a parent notification by end of day").

**Beat kinds used**: `SCENARIO_CHOICE`, `MULTI_SELECT`, `SORT_ORDER`, `MATCH_PAIRS`, `MESSAGE_COMPOSER` — the same components as prior modules, rendered in a mode that disables per-beat retry (via a `strictMode` prop on `JourneyPlayer`).

**Bank source.** Separate `readinessBank: true` beats authored alongside each module's TS curriculum file; imported into the same `InteractiveBeat` table with `journeyId` = the Readiness Check journey. Not drawn dynamically at runtime (order stable per user to allow fair retries and honest comparison across cohorts).

**Scoring.** All 10 beats scored once, first answer counts. Pass = ≥80%. On submit, writes `InteractiveJourneyCompletion` with:
- `passed`
- `scorePct`
- `moduleBreakdown` JSON: `{ "ypp_standard": 0.83, "run_session": 0.75, ... }` (one entry per source domain)
- `personalizedTips` JSON: array of human-readable strings computed from lowest-scoring domains, pointing back to specific modules

Per the schema-review memo, we do **not** create a separate `ReadinessCheckSnapshot` table — `moduleBreakdown` + `personalizedTips` live on the Readiness Check's own `InteractiveJourneyCompletion` row to avoid two sources of truth.

**Retake.** Upsert on replay (same unique `[journeyId, userId]`). Previous attempts stay in `InteractiveBeatAttempt` history; the completion row is overwritten. No cooldown.

**Fail UX.** Completion screen shows per-domain score bars (red if <80%) with a "Review this module" link per weak area. Primary CTA: "Retake Readiness Check" (secondary: "Review weakest module first").

**Pass UX.** Capstone card on the hub unlocks with a celebratory motion; primary CTA: "Open Lesson Design Studio". Badge: "Ready to Teach".

**Completion criteria.** `InteractiveJourneyCompletion.passed = true` AND assignment COMPLETE is the signal that `academyModulesComplete` transitions to true in `getInstructorReadiness()` (after the readiness-lib patch in Section 7). Studio gate then depends only on the existing `studioCapstoneComplete` lane, which the user completes inside Lesson Design Studio — unchanged.

---

### Module 6 — Lesson Design Studio (handoff, not rebuilt)

- **`contentKey`**: `academy_lesson_studio_004` (existing — preserved)
- **`sortOrder`**: 6 (re-sequenced after Readiness Check)
- **Module type**: unchanged (existing special-case handling in `KanbanCard` at `app/(app)/instructor-training/page.tsx:40–95`)
- **Hub treatment**: a sixth card after the 5 modules, rendered by a separate `CapstoneCard` component. Locked until Readiness Check is passed. Click routes to `/instructor/lesson-design-studio?entry=training`.
- **No changes** to the studio codebase.

---

## 5. Interactivity System

### The principle

No wall of text is ever rendered. Any prose longer than ~40 words is broken into a reveal, a compare, or a decision. Every screen has one primary interaction and one decision. Feedback is immediate, specific, and explainable — never "Correct!" on its own.

### The beat shell

Every beat kind renders inside a single `BeatShell` wrapper so the player is uniform:

```
<BeatShell>
  ├── BeatHeader    (sortOrder "3 of 8", kind chip, title)
  ├── BeatBody      (kind-specific interaction — the one component that differs)
  ├── BeatFeedback  (hidden until submitted; slides up; explains)
  └── BeatActions   (Check / Try again / Next — disabled until answer is valid)
</BeatShell>
```

Transitions between beats: `<AnimatePresence mode="wait">` with a horizontal slide on advance/back, 180ms duration, 8px displacement. Shell stays mounted; only `BeatBody`/`BeatFeedback` swap. Progress dots at the top animate their fill state (framer-motion `layout` prop).

### The scoring contract

One pure function per kind. All registered in a single registry:

```ts
// lib/training-journey/scoring.ts
type BeatScorer<K extends InteractiveBeatKind> = (
  beat: InteractiveBeat & { config: BeatConfigByKind[K] },
  response: BeatResponseByKind[K]
) => { correct: boolean; score: number; feedback: BeatFeedback };

const SCORERS: { [K in InteractiveBeatKind]: BeatScorer<K> } = { ... };

export function scoreBeat(beat: InteractiveBeat, response: unknown) {
  const scorer = SCORERS[beat.kind];
  const cfg = beatConfigSchema(beat.kind).parse(beat.config);       // Zod
  const res = beatResponseSchema(beat.kind).parse(response);        // Zod
  return scorer({ ...beat, config: cfg }, res);
}
```

All beat `config` and `response` shapes live in Zod schemas keyed by `kind` + `schemaVersion` in `lib/training-journey/schemas.ts`. The importer (`training:import`) runs the same `beatConfigSchema` against every authored TS beat before upserting — invalid content fails CI.

### The feedback contract

Every scorer returns a `BeatFeedback` object:

```ts
type BeatFeedback = {
  tone: "correct" | "partial" | "incorrect" | "noted";
  headline: string;          // "Close, but not quite" | "That's the YPP move"
  body: string;              // 1-2 sentences explaining why
  hint?: string;             // if incorrect, surfaced on "Try again"
  callouts?: {               // highlights on the user's response
    label: string;
    target: string | number; // which option/hotspot/slot is being referenced
  }[];
};
```

Authors write `correctFeedback` and a map of `incorrectFeedback` keyed by the specific wrong response (or `default`) inside the beat's TS definition. No generic "Try again" — feedback is always specific to what the user picked.

### The beat library (12 kinds)

| Kind | Interaction | Scoring | Used in |
| --- | --- | --- | --- |
| `CONCEPT_REVEAL` | Tabs/steps that progressively reveal content; user must visit each to advance | Not scored (`scoringWeight: 0`). Advance gated on all panels viewed. | All modules (intros) |
| `SCENARIO_CHOICE` | One scenario, one question, 3–5 options, one correct | Exact match on correct option | M1, M2, M3, M4, M5 |
| `MULTI_SELECT` | Check all that apply, 4–7 options | `scoringRule: "threshold"` (configurable): all-correct-no-false-positives, or ≥N-correct | M1, M4, M5 |
| `SORT_ORDER` | Drag-to-reorder list (dnd-kit, already in deps) | Exact-order OR adjacent-pair partial credit (configurable) | M2, M5 |
| `MATCH_PAIRS` | Left column ↔ right column pairing (dnd-kit or tap-left-then-right on mobile) | N correct pairs / N total | M3, M5 |
| `SPOT_THE_MISTAKE` | Click the offending word/phrase in a rendered passage | Exact-hit on the author-tagged target span | M1, M4 |
| `FILL_IN_BLANK` | Short answer; 1–3 word expected | Normalized match against an array of accepted answers + optional regex fallback | M2 |
| `BRANCHING_SCENARIO` | A root beat + child beats gated by `showWhen` predicate on parent response | Per-visited-leaf scoring; denominator is visited beats only | M3 |
| `REFLECTION` | Open text, 1–3 sentences | Not scored (`scoringWeight: 0`), stored for mentor visibility | M1, M2 |
| `COMPARE` | Two options side-by-side (cards, messages, outlines); pick the better | Exact match on correct option + required rationale tag (optional) | M1, M2 |
| `HOTSPOT` | Click the correct region of an image/diagram | Hit-test against author-tagged regions | (optional, M1 or M2) |
| `MESSAGE_COMPOSER` | Build a reply by picking from pools of opening / middle / closing snippets; each snippet carries a tag set (e.g. `apologetic`, `specific-eta`, `blame-shifting`) | Rubric: all required tags present, no banned tags present | M4, M5 |

### How static readings become interactive

Anywhere we'd be tempted to render a paragraph of instructions, we use one of these transforms instead:

- **Tap-to-reveal** (`CONCEPT_REVEAL` with tabs): 2–4 tabs, each a single sentence + one example. No scroll, no tl;dr.
- **Inline quiz check**: a single-sentence `SCENARIO_CHOICE` mid-way through a reveal, forcing active recall.
- **Highlight the key idea** (`SPOT_THE_MISTAKE` variant): user clicks the most important phrase in a short passage. Disagreement with the author's choice is itself a teaching moment.
- **Compare two examples** (`COMPARE`): the concept is taught through contrast, not assertion.
- **Expandable example**: in `CONCEPT_REVEAL`, author can attach an "See it in practice" expandable that unfolds a mini-dialogue.
- **Hover definition**: small tooltip component (`<Term>YPP Standard</Term>`) used inside prompts and reveals. Tap on mobile.
- **Fill in the blank**: teach a concept, then ask the user to complete the teacher's line.
- **Drag to order**: sequencing IS understanding — used when the lesson is about order/priority.
- **Match concept to example**: teach N concepts via pairings, not definitions.
- **Reflection prompt at phase boundaries**: forces the user to commit their own version before moving on. Not scored, but visible to mentors.

### Reading budget rules (enforced at import)

The `training:validate` script fails the build if:
- Any `prompt` exceeds 280 characters.
- A journey has more than 1 `CONCEPT_REVEAL` beat per 4 total beats.
- More than 2 beats in a row are un-scored (`scoringWeight: 0`).
- Any journey has zero scored beats before the halfway mark.

These are opinionated quality gates, not aesthetic preferences. They prevent "marketing page disguised as a module."

### Feedback timing rules

- **Immediate on submit.** Never batched, never on a "Next" click.
- **Retry encouraged for teaching modules (M1–M4).** After incorrect, the feedback panel shows the `hint` and the "Check" button becomes "Try again." First-try correctness is scored; subsequent tries still complete the beat.
- **No retry for Readiness Check (M5).** `strictMode` on `JourneyPlayer` locks the answer on submit and advances to the next beat with feedback inline.
- **Reflections.** Show a "Saved" acknowledgment after submit. Author can define an optional "Compare your reflection" panel that reveals 2–3 sample answers AFTER the user submits theirs (prevents anchoring).

### Accessibility contract per beat kind

- Every kind has keyboard support: arrow keys for option nav, space/enter to select, tab to advance to Check button.
- Drag kinds (`SORT_ORDER`, `MATCH_PAIRS`) expose a keyboard alternative (dnd-kit's `KeyboardSensor` is already on the dep list) — Shift+↑/↓ moves items.
- `SPOT_THE_MISTAKE` and `HOTSPOT` render an accessible list of "targetable spans" alongside the visual, so screen-reader users can activate regions by name.
- Feedback panels use `aria-live="polite"` with focus trapped in the feedback region only after a `correct` result (so retries don't yank focus).
- All text passes WCAG AA contrast on `--ypp-purple` surfaces; accent colors (`--progress-behind`, `--progress-on-track`) are paired with icons, not color alone.

### Reuse inventory

- **dnd-kit** (`@dnd-kit/core`, `@dnd-kit/sortable`) — already a dep (used in lesson studio). Powers `SORT_ORDER` and `MATCH_PAIRS`. No new lib.
- **clsx** — already a dep. Used for conditional class joins on beat states.
- **zod** — already a dep. Powers the config/response schema registry.
- **Existing CSS tokens** — `--ypp-purple`, `--ypp-blush`, `--shadow-purple`, `--radius-lg`, `--transition-base`, the `--progress-*` series. Zero new tokens for phase 1.
- **Existing `.card`, `.button`, `.pill`, `.pill-success` classes** — continue to anchor the visual language; new components use them plus scoped CSS modules for the motion-specific states.

---

## 6. Animation System

### Principles

1. **Motion has a job.** Every animation tells the user something: "this is new", "this is the answer", "you just earned this". If it doesn't communicate, it doesn't ship.
2. **Fast > smooth.** 150–220ms for most UI transitions; 280–400ms only for moments (module unlock, badge reveal, confetti). Never longer.
3. **One hero motion per screen.** Don't stack. A beat advancing is the hero; dots filling is subordinate.
4. **Easing: one curve, one family.** `cubic-bezier(0.4, 0, 0.2, 1)` — matches the existing `--transition-base` token in `globals.css:121–123` and framer-motion's default. No bouncy springs in the learning flow (one exception: the badge-reveal gets a gentle spring).
5. **Respect `prefers-reduced-motion`.** Via framer-motion's `useReducedMotion()` hook, mapped to a `MotionProvider` that swaps `motion.div` variants to instant opacity-only versions. Tested on macOS "Reduce motion" and `@media (prefers-reduced-motion: reduce)` in Playwright.
6. **Never animate scroll position.** The user controls scroll; we don't yank them.
7. **No layout thrash.** Motion is on `transform` and `opacity` only. Height/width tweens go through `layout` prop with care (and only for the progress ring and module cards).

### Library

- **`framer-motion`** — new dep. Pin at `^11.x` (React 18 compatible). ~60KB gzipped; rendered into the existing bundle for `/instructor-training` and `/training/[id]` only — no impact on the rest of the portal.
- **No other motion libs.** Confetti is a ~40-line canvas particle emitter (`ConfettiBurst` component) driven by `requestAnimationFrame`, so we don't add a third dep for 2.5 seconds of celebration.

### Motion tokens (new)

A single `lib/training-journey/motion.ts` file:

```ts
export const EASE = [0.4, 0, 0.2, 1] as const;

export const DURATIONS = {
  instant: 0.001,
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
  moment: 0.4,
} as const;

export const VARIANTS = {
  fadeUp: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: DURATIONS.base, ease: EASE } },
    exit:    { opacity: 0, y: -8, transition: { duration: DURATIONS.fast, ease: EASE } },
  },
  beatAdvance: {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0,  transition: { duration: DURATIONS.base, ease: EASE } },
    exit:    { opacity: 0, x: -24, transition: { duration: DURATIONS.fast, ease: EASE } },
  },
  beatBack: {
    initial: { opacity: 0, x: -24 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: 24 },
  },
  staggerChildren: {
    visible: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
  },
  tapScale: { whileTap: { scale: 0.97 } },
  hoverLift: { whileHover: { y: -2, transition: { duration: DURATIONS.fast, ease: EASE } } },
  badgePop: {
    initial: { scale: 0.6, opacity: 0, rotate: -8 },
    animate: { scale: 1,   opacity: 1, rotate: 0,
               transition: { type: "spring", stiffness: 380, damping: 22 } },
  },
  checkmarkDraw: {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1, transition: { duration: DURATIONS.slow, ease: EASE } },
  },
} as const;
```

All components import from this file. No ad-hoc inline tweens. Reduced-motion mode swaps `VARIANTS.beatAdvance` / `beatBack` to `VARIANTS.fadeUp` with `DURATIONS.instant`.

### Where motion happens (exhaustive)

| Location | Motion | Trigger | Duration |
| --- | --- | --- | --- |
| Hub load | Stagger-in of module cards (top-down) | RSC mount → client hydrate | 180–320ms cascade |
| Hub progress ring | `pathLength` tween from old → new % | State change after completion | 400ms |
| Hub XP chip | Numeric count-up (framer-motion `animate` on `motionValue`) | New XP earned (on nav back to hub) | 600ms |
| Module card (unlocked state arrives) | Lock icon fades out, card pulses `--shadow-purple` twice | Prior module completion observed | 700ms total |
| Module card (hover) | `hoverLift` — 2px up, shadow deepens | Pointer hover | 150ms |
| Module card (tap) | `tapScale` 0.97 | Pointer down | 60ms |
| Capstone card unlock | Lock shatter (SVG path split into 4 fragments, each tweened out with different trajectories), then card glows | Readiness Check passed | 900ms total (moment) |
| Journey intro → player | Page-transition: stage fades/scales up from the clicked card's bounding rect (framer-motion `layoutId` shared between hub card and `BeatShell` header) | "Start" click | 260ms |
| Beat → beat | `beatAdvance` / `beatBack` slide | Next / Back click | 220ms |
| Progress dots | Dot fill animates `layout`; completed dot gets a 280ms `scale` pop | Beat scored | 280ms |
| Option selection | Selected option: border color tweens, background fades to `--ypp-purple-100`, subtle 1px inset ring | Click | 150ms |
| Multi-select toggle | Checkmark SVG path draws in (`checkmarkDraw`) | Toggle on | 320ms |
| Drag in `SORT_ORDER` | dnd-kit default (already smooth); we wrap in `LayoutGroup` so dropped items animate to their new index | Drag end | 200ms |
| Feedback panel (correct) | Slides up from below with `fadeUp`; green left-border draws in; subtle glow pulses once | Correct submit | 240ms total |
| Feedback panel (incorrect) | Slides up with `fadeUp`; red left-border; 2× 6px horizontal shake on the incorrect option | Incorrect submit | 260ms total |
| Retry | Feedback fades out, user's selection un-commits with an `exit` fade | "Try again" click | 150ms |
| Journey complete | Stage crossfades to `JourneyComplete`; score counts up; badge pops in with spring; confetti bursts (3 seconds, respecting reduced-motion — in reduced-motion mode, confetti is replaced by a static sparkle graphic) | Last beat scored | 400ms + 3s confetti (non-blocking) |
| Badge reveal | `badgePop` spring + 1s shimmer gradient sweep | Badge mounts | 1.2s total |
| "Continue" CTA pulse (next module ready) | 2× scale 1.0 → 1.03 → 1.0 pulse on the primary CTA if idle >4s on completion screen | Idle timer | subtle |

### Page-level transitions

- **`/instructor-training` internal state changes** (card state updates after mutation): no full-page transition. The `revalidatePath` round-trip + framer-motion `layout` on affected cards is enough — user sees the card's own state animate in place, not the whole page.
- **`/training/[id]` intro → player**: in-viewport crossfade using a shared `layoutId`, not a Next.js route transition. This keeps us on the same RSC page.
- **Between beats**: client-only; `AnimatePresence` on a `motion.div` keyed by `currentBeatId` inside `JourneyPlayer`.
- **Exit from a journey back to hub**: standard Next.js navigation; the hub re-enters with its stagger cascade.

### Performance rules

- **GPU-friendly only.** `transform`, `opacity`, `filter` (for shadow pulses). Height/width via `layout` prop only on ≤3 simultaneous elements.
- **No continuous animations** (no ambient shimmer, no rotating gradients) except during a "moment" (badge reveal, confetti). Idle screens are static.
- **Confetti budget.** Max 120 particles, 3s lifespan, requestAnimationFrame loop that self-terminates. On mobile (`(pointer: coarse)`), cap at 60 particles.
- **`will-change` used surgically.** Only on `BeatShell` wrapper during a transition; removed after.
- **Mobile framerate.** Target 60fps on iPhone 12 / mid-tier Android. Measured with Playwright + CDP traces in the e2e suite on a throttled CPU preset.
- **Bundle.** framer-motion is only imported in client components under `components/training/**`. The hub RSC doesn't ship it; the client islands do. Verified by checking the Next.js build output for client chunk size.

### Reduced-motion mode

Activated by:
1. User setting `prefers-reduced-motion: reduce` at the OS level.
2. An explicit user toggle in a future settings page (out of scope for launch; hooks wired now so we can add it without refactor).

In reduced-motion mode:
- All `beatAdvance`/`beatBack` → opacity-only fades at `DURATIONS.instant`.
- Confetti → static sparkle SVG with a single 200ms fade-in.
- Badge `badgePop` spring → opacity fade with no scale/rotate.
- Progress ring still animates (meaningful), but `DURATIONS.fast`.
- `hoverLift` and `tapScale` disabled.

Implementation: `MotionProvider` at the top of `JourneyShell` reads `useReducedMotion()` and provides a variant-map context. All `motion.*` components consume the context-resolved variants, not the raw exports. Single swap point.

### Design review rules (self-enforced)

Before merge, every animated surface has to answer three questions:
1. **What does this motion tell the user?** If the answer is "it looks nice", cut it.
2. **Does it slow down a power user?** Motion should never gate action — `Enter` works the instant an answer is valid, regardless of whether a panel is mid-animation.
3. **How does it behave in reduced-motion?** If the answer is "I didn't think about it", the PR is blocked.

---

## 7. Data Model

### Existing surface we reuse (no schema change, integration only)

- **`TrainingModule`** — each of the 5 new modules is one row, identified by `contentKey`. No column additions; we use the existing `required`, `sortOrder`, `passScorePct`, `type`, `videoUrl` (left null), `videoProvider` (null), `requiresQuiz` (false), `requiresEvidence` (false).
- **`TrainingAssignment`** — single source of truth for "is this module complete for this user". On `InteractiveJourneyCompletion.passed = true`, we `upsert` `TrainingAssignment { userId, moduleId, status: COMPLETE, completedAt }`. This is the ONE hook that makes `getInstructorReadiness()` pick up the new modules.
- **`Certificate` / `CertificateTemplate`** — training completion certificate on the hub still flows through the existing `TRAINING_COMPLETION` template. No change.
- **`InstructorInterviewGate`** — untouched. The interview lane keeps its own life cycle.
- **`CurriculumDraft`** — untouched. The studio capstone lane stays independent.

### New enum value (one migration, on its own)

```prisma
enum TrainingModuleType {
  WORKSHOP
  SCENARIO_PRACTICE
  CURRICULUM_REVIEW
  RESOURCE
  INTERACTIVE_JOURNEY   // NEW
}
```

**Migration hazard (per schema-review memo):** Postgres `ALTER TYPE ... ADD VALUE` cannot run inside the same transaction as subsequent DDL in older Prisma migrations. The enum addition ships as a dedicated migration `YYYYMMDD_training_journey_enum`, applied first. Table creation ships in a second migration `YYYYMMDD_training_journey_tables`.

### New enum: beat kinds

```prisma
enum InteractiveBeatKind {
  CONCEPT_REVEAL
  SCENARIO_CHOICE
  MULTI_SELECT
  SORT_ORDER
  MATCH_PAIRS
  SPOT_THE_MISTAKE
  FILL_IN_BLANK
  BRANCHING_SCENARIO
  REFLECTION
  COMPARE
  HOTSPOT
  MESSAGE_COMPOSER
}
```

### New tables

```prisma
model InteractiveJourney {
  id               String   @id @default(cuid())
  moduleId         String   @unique
  module           TrainingModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  estimatedMinutes Int                // for hub card
  passScorePct     Int      @default(80)
  strictMode       Boolean  @default(false)  // true for Readiness Check (no retry per beat)
  version          Int      @default(1)      // bump when content materially changes

  beats            InteractiveBeat[]
  completions      InteractiveJourneyCompletion[]

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model InteractiveBeat {
  id               String   @id @default(cuid())
  journeyId        String
  journey          InteractiveJourney @relation(fields: [journeyId], references: [id], onDelete: Cascade)

  // Stable per-beat identity for idempotent re-import (per schema-review memo).
  // Shape: "ypp-standard/beat-03-red-flags". Unique per journey.
  sourceKey        String

  sortOrder        Int
  kind             InteractiveBeatKind
  title            String
  prompt           String   @db.Text
  mediaUrl         String?

  // Kind-specific payload. Zod-validated at import AND at runtime.
  config           Json
  schemaVersion    Int      @default(1)  // per-kind schema version

  // Scoring
  scoringWeight    Int      @default(10)  // 0 = not scored
  scoringRule      String?                // "exact" | "threshold" | "ordered" | "pairs" | "rubric" | "manual"

  // Branching (only populated for child beats inside a BRANCHING_SCENARIO tree)
  parentBeatId     String?
  parent           InteractiveBeat?  @relation("BeatBranch", fields: [parentBeatId], references: [id], onDelete: Cascade)
  children         InteractiveBeat[] @relation("BeatBranch")
  showWhen         Json?   // predicate evaluated against ancestor responses: e.g. { "ancestorSourceKey": "beat-02", "equals": "option-a" }

  attempts         InteractiveBeatAttempt[]

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([journeyId, sourceKey])
  @@unique([journeyId, sortOrder])
  @@index([parentBeatId])
}

model InteractiveBeatAttempt {
  id              String   @id @default(cuid())
  beatId          String
  beat            InteractiveBeat @relation(fields: [beatId], references: [id], onDelete: Cascade)
  userId          String
  user            User @relation(fields: [userId], references: [id], onDelete: Cascade)

  attemptNumber   Int      // 1..N per (userId, beatId), append-only
  response        Json     // kind-specific, Zod-validated
  responseSchemaVersion Int @default(1)
  correct         Boolean
  score           Int
  timeMs          Int?
  hintsShown      Int      @default(0)

  attemptedAt     DateTime @default(now())

  @@unique([beatId, userId, attemptNumber])
  @@index([userId, beatId, attemptedAt])   // latest-attempt-per-beat reads
  @@index([userId, attemptedAt])            // admin analytics scan
}

model InteractiveJourneyCompletion {
  id               String   @id @default(cuid())
  journeyId        String
  journey          InteractiveJourney @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  userId           String
  user             User @relation(fields: [userId], references: [id], onDelete: Cascade)

  totalScore       Int
  maxScore         Int
  scorePct         Int
  passed           Boolean
  firstTryCorrectCount Int @default(0)
  xpEarned         Int      @default(0)
  visitedBeatCount Int      // branching support: denominator used at time of scoring

  // Readiness Check only (null on non-check journeys):
  moduleBreakdown  Json?    // { "ypp_standard": 0.83, "run_session": 0.75, ... }
  personalizedTips Json?    // [{ module: "run_session", tip: "Revisit pacing…" }, ...]

  completedAt      DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([journeyId, userId])    // upsert-on-replay (retakes overwrite)
  @@index([userId, completedAt])
}
```

(`User.interactiveBeatAttempts` and `User.interactiveJourneyCompletions` relations added back-side.)

### What we deliberately did NOT add

- **`ReadinessCheckSnapshot`** — removed per memo. `InteractiveJourneyCompletion` for the Readiness Check module already carries `moduleBreakdown` + `personalizedTips`. One source of truth.
- **`TrainingBadge` / badge table** — badges are derived at render time from `InteractiveJourneyCompletion` rows (one per completed module). No extra persistence.
- **`TrainingPrereq` / unlock table** — unlock is derived from `sortOrder` + prior-module completion. Linear, no graph.
- **Per-beat XP snapshot** — XP is derived from `score + firstTryBonus` at render time for history views; totals are stored on `InteractiveJourneyCompletion.xpEarned` for the dashboard.

### Zod schema registry

`lib/training-journey/schemas.ts` — exports two maps keyed by `kind`:

```ts
export const BEAT_CONFIG_SCHEMAS: { [K in InteractiveBeatKind]: z.ZodType<BeatConfigByKind[K]> } = { ... };
export const BEAT_RESPONSE_SCHEMAS: { [K in InteractiveBeatKind]: z.ZodType<BeatResponseByKind[K]> } = { ... };
```

Both are consulted by:
- `scripts/validate-training-academy-content.mjs` (existing `training:validate` script, extended) — fails CI on any invalid authored beat.
- `scripts/import-training-academy-content.mjs` (existing `training:import`, extended) — validates before upsert.
- `lib/training-journey/scoring.ts` `scoreBeat()` at runtime — defense-in-depth against drift.
- `lib/training-journey/actions.ts` submit path — validates `response` before touching DB.

`schemaVersion` increments per-kind if the shape changes incompatibly. Attempts stamp the version they were recorded against, so historical responses stay parseable.

### Content registry (authoring source)

`lib/training-curriculum/` — new directory, TypeScript source of truth:

```
lib/training-curriculum/
  types.ts
  ypp-standard.ts
  run-a-great-session.ts
  student-situations.ts
  communication-reliability.ts
  readiness-check.ts
  index.ts        // exports REGISTRY: Record<contentKey, CurriculumDefinition>
```

Each curriculum file exports a `CurriculumDefinition`:

```ts
type CurriculumDefinition = {
  contentKey: string;            // e.g. "academy_ypp_standard_001"
  module: {
    title: string;
    description: string;
    sortOrder: number;
    required: boolean;
    passScorePct: number;
  };
  journey: {
    estimatedMinutes: number;
    strictMode: boolean;
    version: number;
  };
  beats: BeatDefinition[];       // ordered; branches nested via `children`
};
```

The registry is consumed by the importer script to upsert:
1. `TrainingModule` (by `contentKey`)
2. `InteractiveJourney` (by `moduleId`)
3. `InteractiveBeat` (by `[journeyId, sourceKey]` — stable across re-imports so attempt history is never orphaned)

Orphan detection: beats that exist in DB but not in the registry are soft-disabled via a `removedAt` timestamp (not deleted), so historical attempts still resolve. A quarterly cleanup job reviews soft-deletes. (This is a small extra column on `InteractiveBeat`: `removedAt DateTime?`. Included in the table spec.)

Adding that column now:

```prisma
model InteractiveBeat {
  // ...
  removedAt        DateTime?   // soft-delete to preserve attempt history
  // ...
}
```

### Readiness lib patch (required for this to work)

Per the schema-review memo (and confirmed by reading `lib/instructor-readiness.ts:148–194` and the `select` at `lib/instructor-readiness.ts:314–331`): the current `hasActionablePath` check excludes any module that has no videoUrl AND no checkpoints AND doesn't require quiz/evidence. An `INTERACTIVE_JOURNEY` module has none of those, so today it would be flagged `TRAINING_CONFIGURATION_REQUIRED` and block publish forever.

**Patch:**

1. In the `prisma.trainingModule.findMany` select (lib/instructor-readiness.ts:314–331), add:
   ```ts
   type: true,
   interactiveJourney: { select: { id: true } },
   ```
2. In `buildInstructorReadinessFromSnapshot`, extend `hasActionablePath`:
   ```ts
   const hasActionablePath =
     Boolean(trainingModule.videoUrl) ||
     requiredCheckpointCount > 0 ||
     trainingModule.requiresQuiz ||
     trainingModule.requiresEvidence ||
     (trainingModule.type === "INTERACTIVE_JOURNEY" && Boolean(trainingModule.interactiveJourney));
   ```
3. `RequiredTrainingModule` type (lib/instructor-readiness.ts:43–52) extended with `type: string` and `interactiveJourney: { id: string } | null`.

No other changes to readiness logic. Completion is still expressed as `TrainingAssignment.status === "COMPLETE"`, which we upsert from the completion server action.

### Completion write path (server action contract)

```ts
// lib/training-journey/actions.ts
"use server";

export async function completeInteractiveJourney({
  moduleId,
  userId,
}: { moduleId: string; userId: string }) {
  // 1. Load journey + all beats (including children where visited) + latest attempt per beat for this user.
  // 2. Compute: visitedBeats, totalScore, maxScore, scorePct, firstTryCorrectCount, xpEarned.
  //    For BRANCHING_SCENARIO, "visited" = any beat that has at least one attempt by this user in this journey.
  //    For Readiness Check, compute moduleBreakdown + personalizedTips from beat.config.sourceDomain tags.
  // 3. Upsert InteractiveJourneyCompletion (@@unique [journeyId, userId]).
  // 4. If passed: upsert TrainingAssignment { userId, moduleId, status: COMPLETE, completedAt }.
  // 5. If this is the training-completion trigger (all required modules complete), the existing certificate issuer 
  //    (wherever it lives today) fires via the same path it already does when legacy modules complete.
  // 6. revalidatePath("/instructor-training"); revalidatePath(`/training/${moduleId}`).
}
```

All writes in a single `prisma.$transaction` so a partial failure doesn't leave the user "completed" without an assignment row (or vice versa).

### Indexes summary (all on new tables)

- `InteractiveBeat`: `@@unique([journeyId, sourceKey])`, `@@unique([journeyId, sortOrder])`, `@@index([parentBeatId])`
- `InteractiveBeatAttempt`: `@@unique([beatId, userId, attemptNumber])`, `@@index([userId, beatId, attemptedAt])`, `@@index([userId, attemptedAt])`
- `InteractiveJourneyCompletion`: `@@unique([journeyId, userId])`, `@@index([userId, completedAt])`

### Migrations checklist

1. **`YYYYMMDD_training_journey_enum`** — `ALTER TYPE "TrainingModuleType" ADD VALUE 'INTERACTIVE_JOURNEY';` only.
2. **`YYYYMMDD_training_journey_tables`** — creates `InteractiveBeatKind`, the four new tables, all indexes/uniques, adds the 1:1 relation field on `TrainingModule`.
3. **`YYYYMMDD_training_journey_seed`** — (data-only, idempotent) runs `training:import` in CI against the curriculum registry to populate all 5 modules + 5 journeys + ~41 beats in one shot.

### Observability

- Every server action logs (via existing `pino` logger already a dep): `userId`, `moduleId`, `beatSourceKey`, `attemptNumber`, `correct`, `score`, `elapsedMs`.
- Aggregate analytics are just SQL queries over `InteractiveBeatAttempt` — no event pipeline needed at launch. A small helper in `/lib/training-journey/analytics.ts` exposes:
  - `getBeatDropoffRates(journeyId)` — counts users with ≥1 attempt on beat N vs N+1.
  - `getBeatAvgScore(beatId)` — mean first-try score.
  - `getJourneyCompletionTime(journeyId)` — median `MAX(attemptedAt) - MIN(attemptedAt)` per user.

---

## 8. Admin System

### Principles

- **No new admin-editable surface at launch.** Content lives in TS files under `lib/training-curriculum/` and is review-in-PR. Admins get full visibility + operational controls (reset, inspect) without an authoring UI.
- **Reuse existing admin shell.** The portal already has `/admin/training` (module CRUD) and `/admin/instructor-readiness` (per-instructor readiness board). Journey visibility slots into both — one new dedicated area, one inline extension.
- **Permissions match the rest of admin training.** Gate on `ADMIN` + existing `AdminSubtype.CONTENT_ADMIN` for content ops; `ADMIN` + `HIRING_ADMIN` / `SUPER_ADMIN` for learner records and resets. `CHAPTER_PRESIDENT` gets read-only visibility into their chapter's learners (same scope as `/chapter-lead/instructor-readiness` today).

### New routes

#### `/admin/training/journeys` — Journey overview

Landing for interactive-journey admin. One row per journey (5 rows), columns:

- Module title + `contentKey` + `sortOrder`
- Version (`InteractiveJourney.version`)
- Beat count (excluding soft-deleted)
- Active learners (users with ≥1 attempt in last 30 days)
- Completion rate (last 30 days): `COUNT(passed) / COUNT(users with any attempt)`
- Avg first-try score
- Median time-to-complete
- Drop-off alerts (inline chip if any beat has >30% drop-off vs the one before it)
- Quick actions: "Inspect", "Export attempts CSV"

RSC page. Data is SQL aggregates over `InteractiveBeatAttempt` + `InteractiveJourneyCompletion`. `pino`-logged access.

#### `/admin/training/journeys/[moduleId]` — Journey inspector

Three tabs (using the existing `.pill` / tab-like pattern already in the app):

1. **Beats** — ordered list of all beats (including branch children, nested with indentation). Columns: `sourceKey`, `kind`, `sortOrder`, `scoringWeight`, attempts count, first-try correct %, avg time, `removedAt` chip if soft-deleted. Click a beat to open a drawer with the Zod-parsed `config` rendered (not editable; read-only JSON tree with labels).
2. **Learners** — table of every user who has at least one attempt on this journey. Columns: name, chapter, status (Not Started / In Progress / Passed / Failed / Retake Pending), score %, last attempt, beats completed / total visited. Filters: role, chapter, status, date range. Row action: "Open learner record".
3. **Analytics** — per-beat drop-off chart (horizontal bars, one per beat), first-try correct % per beat (useful for content tuning), cohort completion funnel (started → first beat → halfway → completed → passed).

No writes in the Beats tab. Learners tab supports a per-row "Reset progress" action (see below). Analytics tab is read-only.

#### `/admin/training/journeys/[moduleId]/[userId]` — Learner record drawer (sub-route or modal)

Per-user view of one user's journey history:

- All `InteractiveBeatAttempt` rows for this user and journey, in order: `sourceKey`, `attemptNumber`, `correct`, `score`, `timeMs`, `attemptedAt`. Expandable to show the Zod-parsed `response` JSON.
- Current `InteractiveJourneyCompletion` row if any.
- Actions (gated on `ADMIN` + not `CHAPTER_PRESIDENT`): "Reset journey" (see below), "Mark passed (manual override)" (rare; audit-logged).

### Extensions to existing admin surfaces

#### `/admin/training` (existing module manager at `app/(app)/admin/training/page.tsx`)

- Each `TrainingModule` row gains a "Journey" badge if it has an attached `InteractiveJourney`.
- Interactive journey modules are **not editable** through the existing form fields (`requiresQuiz`, `videoUrl`, etc. are hidden/disabled for these rows). The form shows a note: "This module is an Interactive Journey — content managed in `lib/training-curriculum/`. Use `/admin/training/journeys` to inspect."
- Sorting, required-toggle, and publish-state remain editable through the existing UI.

#### `/admin/instructor-readiness` (existing at `app/(app)/admin/instructor-readiness/page.tsx`)

Today the board reads from `getInstructorReadinessMany()`. After the readiness-lib patch, interactive-journey module completions flow through automatically — the board already shows "N of M modules complete" and that number now includes them. No other change needed there except a light visual:

- Inline per-module chips on each instructor row become color-coded by whether it's a journey pass (full color), in-progress (muted), or not-started. Purely presentational; data already there.
- A new "Readiness Check %" column, pulled from `InteractiveJourneyCompletion.scorePct` where `journey.contentKey = academy_readiness_check_005`. Sortable.

#### `/chapter-lead/instructor-readiness`

Same treatment as `/admin/instructor-readiness`, scoped to the chapter. Chapter Presidents see the new "Readiness Check %" column for their chapter's learners. No write actions; the reset flow is admin-only.

### Reset flow

"Reset journey" on a learner record:

1. Confirmation modal (required action; ADMIN-only).
2. Server action in `lib/training-journey/admin-actions.ts`:
   - Soft-delete all `InteractiveBeatAttempt` rows for `[journeyId, userId]` (mark with `resetAt` column — small addition to the table spec below — so audit history survives).
   - Delete the `InteractiveJourneyCompletion` row.
   - Upsert `TrainingAssignment { userId, moduleId, status: NOT_STARTED, completedAt: null }`.
   - Log to `pino` with actor ID and reason.
3. `revalidatePath` on the learner's hub and the journey inspector.

**Schema addendum** for this: add `resetAt DateTime?` and `resetByUserId String?` to `InteractiveBeatAttempt`. Index on `[userId, beatId, resetAt]` is not needed — we filter `WHERE resetAt IS NULL` for live reads and skip this in analytics queries.

### Content ops (authoring + deploy)

Admins with repo access author curriculum via TS files. The deploy path:

1. Author edits `lib/training-curriculum/*.ts` in a PR.
2. CI runs `npm run training:validate` (Zod schema check + reading-budget rules).
3. On merge + deploy, `npm run training:import` runs as part of `db-sync` (the existing `scripts/maybe-db-sync.mjs` path wired into the build) — upserting `TrainingModule`, `InteractiveJourney`, and `InteractiveBeat` rows by `contentKey` / `sourceKey`.
4. Beats removed from TS files are soft-deleted in DB (`removedAt` set). Attempt history preserved.

Runtime effect: admins never touch a content editor; content changes flow through PR → CI → auto-import on deploy.

### Export / audit

- **CSV export** from the journey inspector's Beats tab: one row per attempt, anonymized (`userId` hashed) by default; ADMIN + `HIRING_ADMIN` can toggle to show names.
- **Certificate audit**: training-completion certificates are still issued via the existing path. The journey completion feeds `TrainingAssignment.status`, which the certificate issuer already listens to. No new audit surface.
- **Manual override log**: `mark-passed` actions write to an existing admin audit log if one exists; if not, a minimal `TrainingManualOverride` row is added in its own lightweight table:
  ```prisma
  model TrainingManualOverride {
    id         String @id @default(cuid())
    userId     String
    moduleId   String
    actorId    String
    reason     String
    createdAt  DateTime @default(now())
    @@index([userId, moduleId])
  }
  ```
  (Kept in the plan as an "if needed" table — we check for an existing portal-wide admin audit table before adding this.)

### Chapter + role matrix

| Role | Hub | Journeys overview | Journey inspector (Beats) | Journey inspector (Learners) | Reset | Manual override |
| --- | --- | --- | --- | --- | --- | --- |
| `INSTRUCTOR` (self) | Yes | — | — | — | — | — |
| `CHAPTER_PRESIDENT` | Yes (own chapter learners via readiness board) | — | — | Read (own chapter only) | — | — |
| `ADMIN` + `CONTENT_ADMIN` | Yes | Yes | Yes | Read | — | — |
| `ADMIN` + `HIRING_ADMIN` | Yes | Yes | Yes | Yes | Yes | — |
| `ADMIN` + `SUPER_ADMIN` | Yes | Yes | Yes | Yes | Yes | Yes |

Role checks use the existing `lib/authorization-helpers.ts` utilities (already present per audit), with one new helper `canInspectTrainingJourneys(session)` + `canResetTrainingJourney(session)` to keep gate logic DRY.

### Nav

- Add "Journeys" as a subitem under "Admin → Training" in the existing admin sidebar component. Gated by `canInspectTrainingJourneys`.
- No new top-level entry.

---

## 9. Technical Architecture

### RSC / client boundary

Every data fetch is an RSC; every interaction is a client island. No client data fetching for the hub or journey start. The line:

- **RSC**: `/instructor-training/page.tsx`, `/training/[id]/page.tsx`, `/admin/training/journeys/**/page.tsx`. These read Prisma via `withPrismaFallback`, compute all derived state server-side, and pass plain JSON props to client islands.
- **Client islands**: `JourneyPlayer` (stateful beat runner), `JourneyIntro` (Start/Resume trigger), `JourneyComplete` (celebration + XP count-up), `ConfettiBurst`, each `Beat<Kind>` component, `ModuleCard` (hover/tap motion only), `ProgressRing` (animated path). Everything else stays RSC.

`framer-motion` is imported exclusively inside client islands under `components/training/**`, so the hub RSC payload does not ship it.

### Directory layout

```
app/(app)/
  instructor-training/
    page.tsx                         # rebuilt hub RSC (~200 lines)
    hub.module.css                   # scoped hub styles
  training/[id]/
    page.tsx                         # modified: branches on module.type
    client.tsx                       # existing video/quiz viewer (untouched)
    journey-shell.tsx                # NEW client boundary for INTERACTIVE_JOURNEY
  admin/training/
    journeys/
      page.tsx                       # journeys overview (RSC)
      [moduleId]/
        page.tsx                     # inspector (RSC)
        [userId]/page.tsx            # learner record (RSC)
        beats-tab.tsx                # client tab state
        learners-tab.tsx             # client filters
        analytics-tab.tsx            # client charts (recharts? keep vanilla SVG)

components/training/
  hub/
    Hero.tsx                         # progress ring + XP + next CTA
    ModuleRail.tsx                   # 5 module cards
    ModuleCard.tsx                   # one card (framer motion)
    CapstoneCard.tsx                 # studio handoff card
    ReadinessBand.tsx                # post-check readiness display
    LegacyModulesSection.tsx         # collapsible fallback
    BadgesStrip.tsx                  # earned badges
    CollapsibleBand.tsx              # shared Interview/Offering collapsers
  journey/
    JourneyIntro.tsx                 # title + why + Start/Resume
    JourneyPlayer.tsx                # beat orchestrator (strictMode prop)
    JourneyComplete.tsx              # celebration + score + badge + CTAs
    JourneyProgress.tsx              # progress dots with framer layout
    MotionProvider.tsx               # reduced-motion swap point
    ConfettiBurst.tsx                # canvas particle emitter
    beats/
      BeatShell.tsx                  # header/body/feedback/actions scaffold
      BeatRenderer.tsx               # switch(kind) → specific component
      BeatFeedback.tsx               # shared feedback panel
      BeatActions.tsx                # Check / Try again / Next
      ConceptReveal.tsx
      ScenarioChoice.tsx
      MultiSelect.tsx
      SortOrder.tsx                  # dnd-kit wrapper
      MatchPairs.tsx                 # dnd-kit wrapper
      SpotTheMistake.tsx
      FillInBlank.tsx
      BranchingScenario.tsx          # navigates child beats via showWhen
      Reflection.tsx
      Compare.tsx
      Hotspot.tsx
      MessageComposer.tsx
  admin/
    JourneyInspectorDrawer.tsx
    BeatConfigTree.tsx               # read-only JSON tree
    LearnerAttemptList.tsx

lib/training-journey/
  types.ts                           # BeatConfig, BeatResponse, BeatFeedback, CurriculumDefinition
  schemas.ts                         # BEAT_CONFIG_SCHEMAS, BEAT_RESPONSE_SCHEMAS (Zod)
  scoring.ts                         # scoreBeat(), one scorer per kind
  motion.ts                          # EASE, DURATIONS, VARIANTS
  actions.ts                         # server actions: submitBeatAttempt, completeJourney
  admin-actions.ts                   # server actions: resetJourney, markPassed
  access.ts                          # canInspectTrainingJourneys, canResetTrainingJourney
  analytics.ts                       # SQL helpers for inspector
  progress.ts                        # computeModuleUnlockState, computeHubState
  readiness.ts                       # computeReadinessBreakdown, computePersonalizedTips

lib/training-curriculum/
  types.ts
  ypp-standard.ts
  run-a-great-session.ts
  student-situations.ts
  communication-reliability.ts
  readiness-check.ts
  index.ts                           # REGISTRY

scripts/
  validate-training-academy-content.mjs   # extended (existing)
  import-training-academy-content.mjs     # extended (existing)
  export-training-academy-content.mjs     # extended (existing)

prisma/migrations/
  YYYYMMDD_training_journey_enum/
  YYYYMMDD_training_journey_tables/
  YYYYMMDD_training_journey_seed/

tests/
  lib/
    training-journey/
      scoring.test.ts                # Zod-parsed unit tests per kind
      readiness.test.ts              # breakdown + tips
      progress.test.ts               # unlock logic
      access.test.ts                 # gate helpers
  e2e/
    training-journey.e2e.ts          # full M1 happy path
    training-journey-readiness.e2e.ts# readiness fail + retake
    training-journey-a11y.e2e.ts     # keyboard + reduced-motion
```

### Server action contracts

All under `lib/training-journey/actions.ts`, marked `"use server"`. Return plain JSON, never throw to the client except via typed error shapes.

```ts
type BeatSubmitInput = {
  moduleId: string;
  beatSourceKey: string;
  response: unknown;                 // Zod-validated against kind schema
};

type BeatSubmitResult =
  | { ok: true; correct: boolean; score: number; feedback: BeatFeedback;
      nextBeatSourceKey: string | null;
      journeyPassed?: { passed: boolean; scorePct: number; xpEarned: number; badgeKey: string | null } }
  | { ok: false; code: "UNAUTHORIZED" | "MODULE_NOT_FOUND" | "BEAT_NOT_FOUND" | "INVALID_RESPONSE" | "JOURNEY_LOCKED"; message: string };

export async function submitBeatAttempt(input: BeatSubmitInput): Promise<BeatSubmitResult>;
export async function completeInteractiveJourney(input: { moduleId: string }): Promise<CompleteResult>;
export async function resumeInteractiveJourney(input: { moduleId: string }): Promise<ResumeResult>;
```

Every action:
1. Reads session via `getSession()` (existing, `lib/auth-supabase.ts`, `cache()`-wrapped).
2. Authorizes via `hasApprovedInstructorTrainingAccess(roles)` (existing).
3. Validates input with Zod (existing dep).
4. Rate-limits via `@upstash/ratelimit` (existing dep) — 60 submissions / 60s / user. `UNAUTHORIZED` surface is 429-equivalent.
5. Writes in a `prisma.$transaction`.
6. Logs via `pino` with structured fields.
7. Calls `revalidatePath` on the two affected routes.

### Client state model

- **Single source of truth is server.** The client `JourneyPlayer` keeps only ephemeral UI state: which beat is active, the in-flight answer before submit, feedback panel open/closed, reduced-motion preference.
- **No React Query / no SWR.** The journey loads all beat definitions in one RSC render; subsequent attempts are server-action RPCs. No cache layer.
- **Optimistic UI.** When the user clicks "Check", the player shows a "Checking..." state for <150ms while the server action resolves, then the authoritative feedback renders. If the action fails, we surface a toast and let the user retry — we do NOT fake a correct/incorrect state.
- **Resume state derivation.** On page load, the RSC computes `firstUnscoredBeatSourceKey` from `InteractiveBeatAttempt` and passes it as a prop. The client starts there. No localStorage.

### Caching and revalidation

- Hub (`/instructor-training`) and viewer (`/training/[id]`) are dynamic RSCs (they depend on session). No `force-cache`; they inherit the existing `fetch-cache` defaults for Supabase session reads.
- On completion/submit, server actions call `revalidatePath("/instructor-training")` and `revalidatePath(`/training/${moduleId}`)`.
- Admin routes (`/admin/training/journeys/**`) use `revalidatePath` after reset/override.
- No Next.js `unstable_cache` usage. SQL aggregates on the admin overview are cheap enough at current scale (< 1k learners) that we don't precompute.

### Types (shared between server and client)

Single source at `lib/training-journey/types.ts`:

```ts
export type BeatKind = Prisma.$Enums.InteractiveBeatKind;

export type BeatDefinition<K extends BeatKind = BeatKind> = {
  sourceKey: string;
  kind: K;
  title: string;
  prompt: string;
  mediaUrl?: string;
  config: BeatConfigByKind[K];
  scoringWeight: number;
  scoringRule?: string;
  parentSourceKey?: string;
  showWhen?: ShowWhenPredicate;
  children?: BeatDefinition[];
};

export type JourneySnapshot = {
  moduleId: string;
  contentKey: string;
  title: string;
  estimatedMinutes: number;
  strictMode: boolean;
  beats: BeatDefinition[];           // flattened with branch metadata
  userAttempts: Array<{              // server-computed per-beat latest attempt for this user
    beatSourceKey: string;
    correct: boolean;
    score: number;
    attemptNumber: number;
  }>;
  resumeBeatSourceKey: string | null;
  journeyPassed: boolean;
};
```

The client never imports Prisma types directly — only these plain-data types. Prisma stays server-side.

### Security

- **Authorization at every layer.** RSC pages re-check `hasApprovedInstructorTrainingAccess`; server actions re-check independently (defense in depth — the same pattern the rest of the portal uses, verified in the audit).
- **Input validation.** Every server-action input is parsed through a Zod schema. Unknown fields stripped (`.strict()`). Malformed `response` returns `INVALID_RESPONSE`, never hits the scorer.
- **No client-side scoring.** The correct answer is never sent to the client. `BeatDefinition.config` is shape-filtered on the server before being sent to the client so fields like `correctOptionId`, `acceptedAnswers`, and `requiredTags` are stripped. The client only renders options and sends back the user's pick; the server computes correctness. This is enforced in a single `serializeBeatForClient(beat)` helper used by every RSC that ships beats to the wire.
- **Rate limiting.** `@upstash/ratelimit` already wired in the portal. 60 `submitBeatAttempt` / 60s / user; 6 `completeInteractiveJourney` / 60s / user; 10 `resetJourney` / 60s / admin.
- **CSRF.** Server actions are protected by Next.js's built-in POST-origin check; no extra tokens needed.
- **Audit.** Admin write actions log actor, target, timestamp via `pino` with a `surface: "training-journey-admin"` field for easy filtering.
- **PII.** Reflections are free-text and may contain names — stored in `InteractiveBeatAttempt.response`. Admin CSV export hashes `userId` by default; reflection text is excluded from default exports and only available with `HIRING_ADMIN` + explicit toggle.

### Error handling

- **RSC-level**: wrap all Prisma reads in `withPrismaFallback` (existing helper). If the DB is slow/down, hub and viewer degrade gracefully — same pattern the current code uses.
- **Server action errors**: always return typed `{ ok: false, code, message }`. Client `JourneyPlayer` renders a `<BeatErrorBoundary>` with a "Try again" action. If a specific beat's config fails Zod at runtime (shouldn't happen, CI catches it), the player skips that beat, logs a critical error, and auto-reports to `pino`. User sees "This beat is temporarily unavailable — your progress is saved."
- **Network failure mid-submit**: optimistic "Checking..." state times out at 8s → error toast → retry available → no duplicate attempt rows (server dedupes on `[beatId, userId, attemptNumber]` where `attemptNumber = MAX(existing) + 1` computed atomically in the transaction).

### Feature flag

One env flag: `ENABLE_INTERACTIVE_TRAINING_JOURNEY` (default: `true` in dev, `true` after launch). When `false`:

- The hub falls back to the old kanban exactly as it is today.
- The viewer always renders the legacy video shell for `INTERACTIVE_JOURNEY` modules with a "Coming soon" placeholder.
- Admin journey routes return 404.
- The readiness-lib patch remains active regardless — interactive modules that are marked complete still count — so nothing breaks if we flip this on/off mid-flight.

Follows the existing env-var pattern in `lib/instructor-readiness.ts:112–127` (`isNativeInstructorGateEnabled`).

### Testing strategy

- **Unit (vitest):** every beat scorer gets a test file with ≥5 cases per kind (correct, several incorrect variants, edge cases). Zod schemas tested. Readiness breakdown + tips tested against fixture completions. Progress / unlock logic tested against fixture TrainingAssignment arrays.
- **Integration (vitest):** server actions tested with an in-memory Prisma mock (existing test util in `/tests/lib` patterns). Covers auth failure, rate limit, invalid response, happy path, branch-visited scoring, strict-mode no-retry.
- **E2E (playwright):** three scripts — happy path through Module 1, Readiness Check fail → review → retake → pass, accessibility & reduced-motion (forced via CDP). Seeded via existing `scripts/seed-portal-e2e.ts` (extended with 1 test user + curriculum import).
- **Perf budget:** playwright trace asserts hub FCP ≤1.5s and beat→beat transition < 320ms at 90th percentile on a throttled CPU preset.

### Performance

- **Bundle**: framer-motion only in the training client islands. Hub RSC ships no framer code (ModuleCard hover/tap is the only client island in the initial hub view; that's where framer lives).
- **Data**: the viewer RSC fetches the journey + all beats + the user's latest attempt per beat in three queries via `Promise.all`. No N+1. For branching, all children are loaded eagerly — the journey is always ≤30 beats including all branches, so this is cheap.
- **Image assets**: every `mediaUrl` runs through `next/image` with explicit width/height to avoid CLS.
- **RSC payload**: typical beat definition is <1KB post-stripping. A 10-beat journey ships ~10KB of JSON — trivial.

---

## 10. Build Roadmap — Part 1 (Foundations through Content)

Each phase exits with the system in a shippable state (behind the `ENABLE_INTERACTIVE_TRAINING_JOURNEY` flag until Phase 8). Nothing is half-finished at a phase boundary.

### Phase 1 — Schema & readiness-lib patch (foundation)

**Goal.** Land the schema, enum, and readiness patch in isolation so every subsequent phase has the substrate it needs. Zero user-visible change.

**Touch surface.**
- `prisma/schema.prisma` — add `INTERACTIVE_JOURNEY` to `TrainingModuleType` enum; add `InteractiveBeatKind` enum; add `InteractiveJourney`, `InteractiveBeat`, `InteractiveBeatAttempt`, `InteractiveJourneyCompletion`, and (conditionally) `TrainingManualOverride` models; relations on `User` and `TrainingModule`.
- `prisma/migrations/YYYYMMDD_training_journey_enum/` — enum-only SQL migration (standalone per Postgres `ALTER TYPE` hazard).
- `prisma/migrations/YYYYMMDD_training_journey_tables/` — all new tables + indexes + uniques.
- `lib/instructor-readiness.ts` — apply the 3-part patch (lines 43–52, 148–194, 314–331).
- `tests/lib/instructor-readiness.test.ts` — extend with 2 cases: `INTERACTIVE_JOURNEY` with attached journey counts as actionable; without attached journey flags `TRAINING_CONFIGURATION_REQUIRED`.
- `lib/training-journey/types.ts` — shared types.

**Exit criteria.**
- `npx prisma migrate dev` clean on a fresh DB.
- Existing vitest suite green.
- New readiness tests green.
- No UI change visible; `/instructor-training` renders identically to today.

**Estimated effort.** ~1 focused session.

### Phase 2 — Beat library & scoring engine (no UI yet)

**Goal.** Stand up the typed, Zod-validated scoring substrate end-to-end. Every kind scorable from a unit test; no beats rendered yet.

**Touch surface.**
- `lib/training-journey/schemas.ts` — Zod schema per kind for `config` + `response`.
- `lib/training-journey/scoring.ts` — one `BeatScorer` per kind, registered in `SCORERS` map; `scoreBeat(beat, response)` runs Zod → dispatch.
- `lib/training-journey/motion.ts` — motion tokens (pure constants, no React yet).
- `tests/lib/training-journey/scoring.test.ts` — ≥5 cases per kind (~60 tests). Covers correct, plausible-wrong, malformed, branching visited-denominator, rubric `MESSAGE_COMPOSER`.
- `tests/lib/training-journey/schemas.test.ts` — schema round-trip tests.
- `lib/training-journey/readiness.ts` — `computeReadinessBreakdown()` + `computePersonalizedTips()` pure functions.
- `lib/training-journey/progress.ts` — `computeModuleUnlockState()` pure function.

**Exit criteria.**
- 100% scorer-branch coverage.
- `npm run test` green.
- No new routes, no new components.

**Estimated effort.** ~2 sessions.

### Phase 3 — Content pipeline + Module 1 authored

**Goal.** Prove the authoring → validate → import → render path with the first module. Module 1 exists in DB; no UI yet.

**Touch surface.**
- `lib/training-curriculum/types.ts` — `CurriculumDefinition`, `BeatDefinition` types.
- `lib/training-curriculum/ypp-standard.ts` — **Module 1 authored** (8 beats: concept reveal, compare, scenario, multi-select, spot-the-mistake, scenario, reflection).
- `lib/training-curriculum/index.ts` — REGISTRY.
- `scripts/validate-training-academy-content.mjs` — extend to validate via Zod + reading-budget rules.
- `scripts/import-training-academy-content.mjs` — upsert `TrainingModule` + `InteractiveJourney` + `InteractiveBeat` by stable keys; soft-delete orphans.
- `prisma/migrations/YYYYMMDD_training_journey_seed/` — data-only migration running the importer against the registry.
- `scripts/export-training-academy-content.mjs` — extend for DB → TS round-trip (verify import is lossless).
- `tests/scripts/training-import.test.ts` — idempotency + orphan soft-delete.
- `scripts/maybe-db-sync.mjs` — invoke `training:import` in the build pipeline.

**Exit criteria.**
- `npm run training:validate` green on Module 1.
- `npm run training:import` idempotent.
- Module 1 row exists in `TrainingModule`; journey + beats exist; export round-trip lossless.
- Readiness lib sees Module 1 as actionable.

**Estimated effort.** ~2 sessions.

### Phase 4 — Journey player UI + Module 1 renderable

**Goal.** First working vertical slice. Authorized user behind the flag can complete Module 1 and see `TrainingAssignment` flip to `COMPLETE`.

**Touch surface.**
- `components/training/journey/MotionProvider.tsx` — reduced-motion swap point.
- `components/training/journey/JourneyIntro.tsx` — Start/Resume.
- `components/training/journey/JourneyPlayer.tsx` — `<AnimatePresence>` orchestrator, advance/back, progress dots, strictMode prop.
- `components/training/journey/JourneyComplete.tsx` — score, badge reveal.
- `components/training/journey/JourneyProgress.tsx` — animated dots.
- `components/training/journey/ConfettiBurst.tsx` — canvas particle emitter.
- `components/training/journey/beats/` — `BeatShell`, `BeatRenderer`, `BeatFeedback`, `BeatActions`, plus **the 6 body components used by M1** (`ConceptReveal`, `ScenarioChoice`, `MultiSelect`, `SpotTheMistake`, `Compare`, `Reflection`).
- `app/(app)/training/[id]/journey-shell.tsx` — client boundary.
- `app/(app)/training/[id]/page.tsx` — branch on `type === 'INTERACTIVE_JOURNEY'`, serialize beats via `serializeBeatForClient()`, render `<JourneyShell>`.
- `lib/training-journey/actions.ts` — `submitBeatAttempt`, `completeInteractiveJourney`, `resumeInteractiveJourney`.
- `tests/e2e/training-journey-m1.e2e.ts` — happy path.
- `tests/e2e/training-journey-a11y.e2e.ts` — keyboard-only + reduced-motion via CDP.
- `package.json` — add `framer-motion ^11.x`.

**Exit criteria.**
- Test user completes M1 end-to-end behind the flag.
- `TrainingAssignment.status = COMPLETE` upserted; existing readiness/admin board picks it up.
- Keyboard-only completion passes.
- Reduced-motion verified.
- Perf: beat→beat transition <320ms on throttled CPU.

**Estimated effort.** ~3 sessions.

### Phase 5 — Remaining modules + remaining beat kinds

**Goal.** Modules 2, 3, 4 fully authored and playable. All 12 beat kinds implemented.

**Touch surface.**
- `components/training/journey/beats/SortOrder.tsx` + `MatchPairs.tsx` — dnd-kit wrappers with keyboard sensor.
- `components/training/journey/beats/FillInBlank.tsx` — normalized match grading.
- `components/training/journey/beats/BranchingScenario.tsx` — navigates child beats via `showWhen`.
- `components/training/journey/beats/MessageComposer.tsx` — snippet-pool builder with tag-based scoring.
- `components/training/journey/beats/Hotspot.tsx` — click-region + accessible alternate list.
- `lib/training-curriculum/run-a-great-session.ts` — M2 (9 beats).
- `lib/training-curriculum/student-situations.ts` — M3 (7 beats including 3 branching trees).
- `lib/training-curriculum/communication-reliability.ts` — M4 (7 beats including 2 `MESSAGE_COMPOSER`).
- Extend `tests/e2e/` — one script per module covering its unique kinds.

**Exit criteria.**
- All four modules playable.
- Branching scorer correctly computes visited-beat denominator (unit + e2e).
- `MESSAGE_COMPOSER` rubric verified against ≥3 scenarios.
- dnd-kit drag kinds pass keyboard-only e2e.
- Sequential module unlock works (M2 locked until M1 complete, etc.).

**Estimated effort.** ~4 sessions.

### Phase 5 — In-flight status (as of this commit)

This commit lands the **majority** of Phase 5. The remaining items below are scoped, small, and unblocked — any follow-up session can pick them up without re-planning.

**✅ Done in this commit:**

Beat kinds (all 12 now implemented end-to-end):
- `SortOrder.tsx` — dnd-kit `DndContext` + `MouseSensor` + `TouchSensor` + `KeyboardSensor` (via `sortableKeyboardCoordinates`); `role="list"` + `aria-label` on each row with position/label; custom `announcements` for drag start/over/end/cancel.
- `MatchPairs.tsx` — left slots via `useDroppable`, right chips via `useDraggable`; plus a `<select>` fallback per slot (lists unassigned right items + current assignment) for keyboard/screen-reader paths; a right chip in a slot removes it from any previous pair.
- `FillInBlank.tsx` — `<textarea>` with `maxLength: 200`, `aria-label` wired to `beat.prompt`; optional `hint` rendered below with `aria-live="polite"`; emits `null` when empty so Check disables.
- `Hotspot.tsx` — visual overlay zones are `aria-hidden` + `tabIndex={-1}`; **all keyboard/AT input routes through a parallel `role="radiogroup"` list** (plan §11 R7). Image `onError` falls back to a text label.
- `BranchingScenario.tsx` — scenario-framed radiogroup mirroring `ScenarioChoice` keyboard/ARIA; displays `config.rootPrompt` as a styled scenario block; non-null `leadsToChildSourceKey` shows a `⤷` indicator with `aria-label="leads to a follow-up scenario"`.
- `MessageComposer.tsx` — per-pool fieldset with radio (max=1) or checkbox (max>1) pattern; live `aria-live="polite"` preview of the composed message; `isResponseValid = pools.every(p => selectedIds.length >= (p.minSelections ?? 1))`.

`BeatRenderer.tsx` switch is now exhaustive — all 12 kinds have a `case`. The Phase-4 "unsupported kind" fallback still exists as a safety net but should be unreachable.

Branching traversal wired end-to-end:
- `JourneyAttemptSummary` extended with `response: unknown | null` (in `lib/training-journey/client-contracts.ts`) so the client can resolve predicates on ancestor attempts.
- Viewer RSC (`app/(app)/training/[id]/page.tsx`) now threads `attempt.response` into the summary shipped to the shell.
- `JourneyPlayer.evaluateShowWhen()` is no longer a stub — it looks up the ancestor's `{ selectedOptionId }` in the in-memory attempts list and compares via `equals` / `in` / `notEquals`.
- `JourneyPlayer.setAttempts(...)` now carries the submitted response through on every beat submit (so M3 children resolve without a page refresh).
- `lib/training-journey/actions.ts` `completeInteractiveJourney()` now filters `scoredBeats` through the same `showWhen` evaluator **server-side** — the readiness check only demands visible scored beats, and `maxScore` denominator sums only visible weights. This is the plan §4 Module 3 rule: "denominator only counts beats the user actually saw". `visitedBeatCount` retains its prior semantics (any beat with at least one attempt).

Curriculum:
- `lib/training-curriculum/run-a-great-session.ts` — **M2** authored (9 beats: CONCEPT_REVEAL, SORT_ORDER×2 with `partialCredit`, SCENARIO_CHOICE×2, FILL_IN_BLANK with regex fallbacks, COMPARE, REFLECTION, completion CONCEPT_REVEAL). ~70 pts scored; 80% pass.
- `lib/training-curriculum/communication-reliability.ts` — **M4** authored (7 beats: CONCEPT_REVEAL, MESSAGE_COMPOSER×2, MULTI_SELECT threshold, SCENARIO_CHOICE, SPOT_THE_MISTAKE, completion CONCEPT_REVEAL).
  - Beat 2 rubric: `requiredTags: ["apologetic","specific-eta"]`, `bannedTags: ["blame-shifting","vague-eta"]`. Correct combo: `open-apology + mid-specific-eta + any closing`.
  - Beat 3 rubric: `requiredTags: ["acknowledging","specific-taught","next-step"]`, `bannedTags: ["defensive","dismissive"]`. Correct combo: `ack-direct + spec-lesson + next-action`.

**🚧 Remaining (do these next — small, unblocked):**

1. **Author Module 3** — `lib/training-curriculum/student-situations.ts`. Detailed spec (7 beats, three BRANCHING_SCENARIO trees with 2 children each, MATCH_PAIRS, two CONCEPT_REVEAL) is in `/root/.claude/plans/write-only-hzlf-of-crystalline-firefly.md`. Author directly in two passes (the subagent route hit stream-idle timeouts on this file twice). Key schema: children nested under `children[]` with `showWhen: { ancestorSourceKey, equals: <optionId> }`; "Distracted student" root uses `correctOptionId: null` (the scorer treats every choice as "noted" in that mode); "Quiet" and "Dominates" roots have a clear `correctOptionId`.
2. **Register all three new modules** in `lib/training-curriculum/index.ts` — add imports for `M2_RUN_A_GREAT_SESSION`, `M3_STUDENT_SITUATIONS`, `M4_COMMUNICATION_RELIABILITY` and add their `contentKey`s to `CURRICULUM_REGISTRY`.
3. **Run `npm run training:validate`** — the Zod validator should pass on all four modules. If a prompt exceeds 280 chars or feedback is missing a `"default"` key, the script prints a pointed error.
4. **E2E tests** (new files under `tests/e2e/`, mirror the structure of `training-journey-m1.e2e.ts`):
    - `training-journey-m2.e2e.ts` — complete M2 keyboard-only including both `SORT_ORDER` beats (arrow keys + Space to move items). Assert the hub marks M2 complete.
    - `training-journey-m3.e2e.ts` — walk TWO different branches through the "Quiet student" tree (path A: `soft-invite` → child 2a; path B: `cold-call` → child 2b), assert the other path's child does NOT render, assert both complete scores correctly use the visited-only denominator.
    - `training-journey-m4.e2e.ts` — run the "running late" composer with the correct trio → pass; swap to `open-blame` (blame-shifting banned) → verify score 0. Repeat for the parent-email composer: correct trio → pass; replace ack with defensive snippet → fail.
    - `training-hub-unlock.e2e.ts` — fresh user, only M1 unlocked; complete M1, refresh, M2 unlocked; complete M2, M3 unlocked; etc.
5. **Scoring unit tests** — extend `tests/lib/training-journey/scoring.test.ts` (create if absent) with:
    - `BRANCHING_SCENARIO`: correct pick → correct + full score; wrong pick → incorrect + 0; `correctOptionId: null` → correct + full score for any pick (tone: "noted").
    - `MESSAGE_COMPOSER`: required-tags-present + no-banned → full score; banned-tag present → score 0 regardless of required; partial — some required missing, no banned → partial credit proportional to hits.
    - Visited-denominator: consider adding a unit test for `completeInteractiveJourney`'s visible-filter logic by factoring the `isVisible` helper out to a pure function in `lib/training-journey/scoring.ts` or a neighbouring file so it's unit-testable without DB mocks. (Fine to defer — the e2e test above covers it end-to-end.)

**Exit gate (re-stated, authoritative for this phase):** all four modules playable and registered; `training:validate` passes; the five e2e scripts above pass; the three scoring unit test groups pass.

---

## 10.5. Build Roadmap — Part 2 (Gate, Hub, Admin, Launch)

### Phase 6 — Readiness Check + capstone gate

**Goal.** Ship Module 5 (strictMode) and the bidirectional hook into the existing Lesson Design Studio lane. Full end-to-end training journey works.

**Touch surface.**
- `lib/training-curriculum/readiness-check.ts` — Module 5 authored (10 mixed-bank beats including 2 integration beats, tagged with `sourceDomain` metadata for breakdown computation).
- `lib/training-journey/readiness.ts` — confirm `computeReadinessBreakdown()` correctly groups by `sourceDomain` and `computePersonalizedTips()` yields 1–3 tips pointing back to specific modules.
- `components/training/journey/JourneyPlayer.tsx` — implement `strictMode` path: no retry, locks answer on submit, auto-advances with feedback inline.
- `components/training/journey/JourneyComplete.tsx` — readiness variant: per-domain score bars, "Review this module" links on weak areas, "Retake Readiness Check" secondary CTA, "Open Lesson Design Studio" primary CTA on pass.
- `lib/training-journey/actions.ts` — `completeInteractiveJourney` populates `moduleBreakdown` + `personalizedTips` on the Readiness Check's completion row.
- `tests/e2e/training-journey-readiness.e2e.ts` — **the critical script**: fail (≤79%) → breakdown shown → retake → pass (≥80%) → capstone unlocks → click to `/instructor/lesson-design-studio?entry=training`.
- Verify existing `lib/instructor-readiness.ts` `studioCapstoneComplete` lane is untouched and still reads from `CurriculumDraft.status`.

**Exit criteria.**
- Readiness Check fail → accurate per-domain breakdown → retake works (upserts completion, preserves attempts).
- Pass unlocks capstone card visually AND the studio route is reachable via the existing `?entry=training` deeplink.
- Zero changes to Lesson Design Studio codebase (verified by git diff scope).
- End-to-end: fresh user → all 5 modules → capstone entry → ≤45 minute budget hit on a stopwatch run.

**Estimated effort.** ~2 sessions.

### Phase 7 — Hub rebuild

**Goal.** Replace the kanban hub with the new academy UI. Every training-route user sees the new hub.

**Touch surface.**
- `app/(app)/instructor-training/page.tsx` — rewrite as a data orchestrator (~200 lines vs today's ~580). Fetches modules + assignments + completions + readiness via `Promise.all` + `withPrismaFallback`. Passes plain JSON to client islands.
- `app/(app)/instructor-training/hub.module.css` — scoped styles (if any beyond the existing design-token classes).
- `components/training/hub/Hero.tsx` — progress ring, XP total, primary CTA (Continue / Start / Review).
- `components/training/hub/ModuleRail.tsx` + `ModuleCard.tsx` — 5 cards with lock state, hover lift, unlock pulse.
- `components/training/hub/CapstoneCard.tsx` — studio handoff card with lock-shatter moment.
- `components/training/hub/ReadinessBand.tsx` — post-check readiness display (only renders when `readinessCompletion?.passed`).
- `components/training/hub/LegacyModulesSection.tsx` — collapsible fallback for any non-journey, non-studio `TrainingModule` rows.
- `components/training/hub/BadgesStrip.tsx` — earned badges derived from completions.
- `components/training/hub/CollapsibleBand.tsx` — shared collapser for Interview + Offering sections (demoted from today's prominence, same data).
- `lib/training-journey/progress.ts` — `computeHubState()` aggregates all module states for the client island.
- `tests/e2e/training-hub.e2e.ts` — hub renders correctly for: net-new user (M1 unlocked only), mid-journey user, all-complete user, failed-readiness user, all-legacy-only user (ensures fallback section shows).
- Leave `KanbanCard` and the old layout fully deleted — no dead code.

**Exit criteria.**
- New hub renders for all 5 user states in e2e.
- Interview + Offering + Certificate bands behave identically to before (same data, collapsed default).
- No visual regression on chapter-lead / admin views (they don't use this route).
- Lighthouse a11y ≥95 on hub.
- Hub FCP ≤1.5s on throttled CPU in playwright trace.
- No unused imports or dead branches from the old kanban code.

**Estimated effort.** ~3 sessions.

### Phase 8 — Admin system + chapter-lead integration

**Goal.** Full admin visibility, reset flow, and inline extensions to existing admin + chapter-lead boards. Content ops deploy path verified.

**Touch surface.**
- `lib/training-journey/admin-actions.ts` — `resetJourney`, `markPassed` server actions with rate limits, audit logging, `prisma.$transaction`.
- `lib/training-journey/access.ts` — `canInspectTrainingJourneys()`, `canResetTrainingJourney()`, `canManualOverrideTrainingJourney()` helpers.
- `app/(app)/admin/training/journeys/page.tsx` — overview (5-row aggregate table).
- `app/(app)/admin/training/journeys/[moduleId]/page.tsx` — inspector shell with three client tabs.
- `app/(app)/admin/training/journeys/[moduleId]/beats-tab.tsx`, `learners-tab.tsx`, `analytics-tab.tsx` — client islands.
- `app/(app)/admin/training/journeys/[moduleId]/[userId]/page.tsx` — learner record with attempt history, reset + override actions.
- `components/admin/JourneyInspectorDrawer.tsx` + `BeatConfigTree.tsx` + `LearnerAttemptList.tsx` — shared admin components.
- `lib/training-journey/analytics.ts` — `getBeatDropoffRates`, `getBeatAvgScore`, `getJourneyCompletionTime` SQL helpers.
- Schema addendum: `resetAt DateTime?` + `resetByUserId String?` on `InteractiveBeatAttempt` (add in this phase's migration).
- `app/(app)/admin/training/page.tsx` — add "Journey" badge on INTERACTIVE_JOURNEY rows; hide video/quiz fields in the form for these rows with the pointer message.
- `app/(app)/admin/instructor-readiness/page.tsx` — add "Readiness Check %" sortable column + color-coded per-module chips (data already in readiness).
- `app/(app)/chapter-lead/instructor-readiness/page.tsx` — same Readiness Check % column, scoped to chapter.
- Admin nav — add "Journeys" subitem under "Admin → Training", gated by `canInspectTrainingJourneys`.
- CSV export endpoint for inspector Beats tab.
- `tests/e2e/admin-training-journeys.e2e.ts` — admin happy path: list journeys → inspect → open learner → reset → verify hub reflects reset on next login.
- `tests/lib/training-journey/access.test.ts` — exhaustive role matrix tests.

**Exit criteria.**
- All five role × surface combinations from Section 8's matrix verified.
- Reset is atomic (attempts soft-deleted + completion deleted + assignment NOT_STARTED, or nothing happens).
- Chapter President can see but not mutate.
- PR-driven content update: author edits a beat in `lib/training-curriculum/ypp-standard.ts` → push → CI runs `training:validate` → deploy runs `training:import` → DB reflects change → attempt history preserved.

**Estimated effort.** ~3 sessions.

### Phase 9 — Polish, QA, perf, a11y

**Goal.** Take the shipped-but-flagged system to launch bar. No new features — every hour in this phase goes to feel.

**Touch surface (no new files expected).**
- **Motion polish pass.** Every screen reviewed against Section 6's three review questions. Any "because it looks nice" motion cut. Durations retuned on real mobile devices. Confetti budget verified on low-end Android.
- **Copy polish pass.** Every `prompt`, every `correctFeedback`, every `incorrectFeedback` reviewed. Target voice: warm, direct, unpatronizing. Reading-budget rules enforced.
- **Empty / edge states.** What does the hub look like for: a user with no modules configured? An admin browsing before the seed ran? A journey whose content got rolled back mid-session? A Readiness Check retake during a partial DB outage? Each gets a designed state.
- **Cross-browser.** Safari 17, Chrome 120, Firefox 120. Mobile Safari. Drag kinds verified on touch.
- **A11y audit.** NVDA + VoiceOver pass on every beat kind. Focus trap review after feedback. Keyboard-only completion of all 5 modules measured for time.
- **Perf audit.** Real-user Lighthouse from a throttled connection on all three pages (hub, viewer, completion). Bundle analyzer check that framer-motion didn't leak into the hub RSC. Prisma query plans eyeballed on the inspector aggregates.
- **Error handling walkthrough.** Throttle the network, kill the DB mid-submit, force Zod failure via corrupted response. Every failure mode surfaces a human-readable message and no data corruption.
- **Docs.** One-page `docs/training-journeys.md` explaining the authoring flow for future contributors. No README proliferation.

**Exit criteria.**
- Lighthouse a11y ≥95, perf ≥90 on both user-facing pages.
- Every beat kind passes an NVDA + VoiceOver pass.
- Bundle size delta ≤70KB gzipped on affected routes (framer-motion + new components).
- Zero console warnings / errors in a full happy-path run.
- "Would a top startup product team ship this?" — the team agrees yes.

**Estimated effort.** ~3 sessions.

### Phase 10 — Launch + post-launch watchlist

**Goal.** Flip the flag, watch the system, correct course quickly.

**Rollout.**
1. Flag on in staging; internal team completes all five modules. Feedback captured.
2. Enable for a single chapter (pilot) via the existing chapter-scoped env overrides. Monitor drop-off and first-try correctness per beat.
3. Enable globally.

**Launch checklist.**
- `ENABLE_INTERACTIVE_TRAINING_JOURNEY=true` in all prod environments.
- `training:import` ran cleanly on the prod DB — verified via a SQL `SELECT COUNT(*) FROM "InteractiveBeat"`.
- Old kanban code confirmed deleted (not just feature-flagged hidden).
- Admin has read the new `/admin/training/journeys` flow.
- At least one real instructor completes the full journey before public announcement.

**Week-1 watchlist.**
- Per-beat drop-off rates (via `analytics.ts` helpers). Any beat with >40% drop-off is a content bug, not a user bug — fix fast.
- First-try correct % per beat. Anything below 20% (too hard) or above 95% (not teaching) gets rewritten.
- Readiness Check pass rate. Target 60–75% first attempt; if it's >90% we've made the gate meaningless, if <40% we've made it unfair.
- Time-to-complete distribution per module. If any module's median is >1.5× its `estimatedMinutes`, we have a prompt-length problem.
- Error log via `pino` filter on `surface: "training-journey-*"` — zero tolerance for hard errors; investigate within the hour.

**Fast-turn content edits.**
Because content is code, any rewrite is a small PR with `training:validate` in CI + auto-import on deploy. Targeted iteration time ~1 hour from identifying a bad prompt to it being live. That's the whole point of the TS-first content path.

**Exit criteria.**
- First week at >90% of logged-in instructors starting the journey within 7 days of login.
- No P1 bugs open.
- Lesson Design Studio entries from the new path at parity with or above historical volume.

**Estimated effort.** ~1 session for the rollout itself, ongoing for the watchlist.

### Roadmap totals

~24 focused sessions end-to-end, front-loaded in foundation (Phases 1–3 are unlocks for everything else). Phases 4–6 are the largest vertical build. Phases 7–9 are polish-dominated. Phase 10 is flip + watch.

Every phase is independently shippable because of the flag, the soft-delete posture, and the readiness-lib patch landing in Phase 1 (so the system can't get stuck in a split-brain state even if we stop mid-roadmap).

---

## 11. Risks & Mitigations

Ordered by likelihood × blast radius, highest first.

### R1 — Readiness-lib patch silently regresses existing modules

**Likelihood:** medium. **Blast radius:** high (could block publish for every instructor).

The `hasActionablePath` check at `lib/instructor-readiness.ts:148–194` is the most-used piece of code we're touching. A faulty patch could flag legacy video modules as misconfigured.

**Mitigation.**
- Patch is additive: we add a new OR-branch to the existing `||` chain; the existing four conditions are preserved byte-for-byte.
- Extend the existing `tests/lib/instructor-readiness.test.ts` with cases for every pre-existing shape (video-only, checkpoint-only, quiz-only, evidence-only, and all combinations) before adding the new `INTERACTIVE_JOURNEY` case. Regression surface locked down first.
- Ship Phase 1 alone, merge + deploy, observe the admin readiness board for 24 hours with zero new modules of the new type, before starting Phase 2.

### R2 — Content authoring bottleneck

**Likelihood:** high. **Blast radius:** medium (quality cap on the whole system).

5 modules × ~8 beats = ~41 beats of scenario-and-feedback copy. A wall of placeholder content ships and erodes trust fast.

**Mitigation.**
- Every authored beat passes the reading-budget rules enforced at `training:validate` time — prompts ≤280 chars, etc. CI fails placeholder content.
- Phase 3 authors Module 1 end-to-end before any UI work begins. That's the standard. Modules 2–5 are copy-reviewed against M1 before they ship.
- `correctFeedback` and `incorrectFeedback` are required fields, not optional. Zod rejects beats without both.
- Week-1 watchlist (Phase 10) flags any beat with <20% or >95% first-try correct for rewrite — content QA continues post-launch.

### R3 — Branching scenario complexity leaks into the renderer

**Likelihood:** medium. **Blast radius:** medium (M3 quality + maintainer cost).

Branching is the one beat kind that's a graph, not a list. Naive implementations put routing logic in multiple places.

**Mitigation.**
- Per the schema-review memo, branches are first-class `InteractiveBeat` rows with `parentBeatId` + `showWhen` predicates — not nested JSON. One storage model, one traversal function.
- `showWhen` is a small declarative predicate schema (`{ ancestorSourceKey, equals | in | notEquals }`), not arbitrary code. Zod-validated at import.
- The journey player's advance logic filters by `showWhen` in one place (`JourneyPlayer` — `getNextVisibleBeat()`). Scorer doesn't know about branching; it just sees attempts.
- Only M3 uses branching at launch. If the primitive proves fragile, we can keep it scoped to that module.

### R4 — framer-motion bundle creep

**Likelihood:** medium. **Blast radius:** low-medium (bundle regression on non-training pages if imports leak).

framer-motion is ~60KB gzipped. If any non-training RSC imports from a client component that imports framer-motion, the whole app's bundle inflates.

**Mitigation.**
- All framer-motion-using components live under `components/training/**`. Lint rule (`no-restricted-imports`) blocks any file outside that tree from importing `framer-motion`.
- Phase 4 exit criteria include a bundle-analyzer check verifying framer-motion appears only in the expected chunks.
- Phase 9 polish re-verifies.

### R5 — Content pipeline race on concurrent deploys

**Likelihood:** low. **Blast radius:** medium (partial imports could leave DB in inconsistent state).

If two deploys race the `training:import` step, beats could be upserted twice or orphan-soft-deleted prematurely.

**Mitigation.**
- Import script runs inside a `prisma.$transaction` per curriculum definition — atomic per module.
- Importer acquires an advisory PostgreSQL lock (`pg_advisory_xact_lock`) keyed on `training:import`, so concurrent runs serialize.
- Orphan detection has a grace period: beats not seen in the registry get `removedAt` set, but aren't hard-deleted until a separate quarterly cleanup that requires manual invocation. Ephemeral misses don't destroy attempt history.

### R6 — Readiness Check becomes a guess-the-pattern exercise

**Likelihood:** medium. **Blast radius:** medium (defeats the purpose of the gate).

If instructors pattern-match on the question order or specific wording of beats they saw during training modules, the Check doesn't measure transfer.

**Mitigation.**
- Readiness Check beats are a distinct authored bank (`readinessBank: true`) — not copy-pasted from M1–M4. They use the same _kinds_ but different _scenarios_.
- Integration beats (2 of 10) deliberately require holding two domains in mind at once, which isn't directly practiced anywhere else.
- Week-1 watchlist monitors pass rate; if it drifts toward 95% we rotate scenarios.

### R7 — Accessibility regression at speed

**Likelihood:** medium. **Blast radius:** medium (blocks some real instructors).

Motion-heavy UIs ship a11y bugs first. `SORT_ORDER`, `MATCH_PAIRS`, and `HOTSPOT` are the riskiest kinds.

**Mitigation.**
- dnd-kit's `KeyboardSensor` wired in from day one (Phase 5); no "make it work with mouse, add keyboard later" path.
- `HOTSPOT` ships with a parallel accessible list of named regions, not as an afterthought.
- Playwright `training-journey-a11y.e2e.ts` runs in CI and keyboard-only-completes every beat kind. Breaking it blocks merge.
- `prefers-reduced-motion` coverage in the same e2e file via CDP.

### R8 — Existing `/training/[id]/client.tsx` drift breaks legacy video viewer

**Likelihood:** low. **Blast radius:** medium (breaks admin-created video training that still ships).

Changing `/training/[id]/page.tsx` to branch on type could touch shared imports and regress the legacy path.

**Mitigation.**
- Phase 4 explicitly preserves `client.tsx` byte-for-byte; the branch lives in `page.tsx` and routes to either the legacy client or the new `<JourneyShell>`.
- An existing playwright smoke test for the legacy viewer (or a new one added in Phase 4) passes before merge.

### R9 — Over-long total time budget erodes "fast" promise

**Likelihood:** medium. **Blast radius:** medium (instructor trust + completion rate).

45 minutes is already the upper bound. A few chatty prompts + thoughtful reflections can push past that.

**Mitigation.**
- Reading-budget rules cap prompt length.
- `estimatedMinutes` on each journey is displayed up-front — public accountability.
- Phase 10 watchlist flags any module with median time >1.5× estimate.
- Reflection beats are non-gating — user can submit "skip for now" if short on time and come back. (Stretch; not required at launch, but the data model supports it.)

### R10 — Studio handoff breaks if the studio's own gate moves

**Likelihood:** low. **Blast radius:** medium.

`studioCapstoneComplete` currently derives from `CurriculumDraft.status`. If the studio team changes that without coordination, the final "training complete" signal could regress.

**Mitigation.**
- We don't own the studio; we read from its existing signal only. Our Phase 6 e2e asserts the existing `?entry=training` deeplink still lands on the studio entry. If that breaks upstream, the e2e fails before deploy.
- Plan file (this document) is committed to the repo so the studio team sees the contract.

### R11 — Admin reset accidentally wipes attempt history

**Likelihood:** low. **Blast radius:** low-medium (audit / reporting loss).

A power-user admin could reset every learner by accident.

**Mitigation.**
- `resetJourney` is per-learner, per-journey — no bulk button at launch.
- Attempts are soft-deleted (`resetAt`), not hard-deleted. Restorable via admin tooling or a direct SQL update.
- Confirmation modal with reason field (required, logged).
- Rate-limited to 10/minute per admin.

---

## 12. Final Recommendation

**Ship this plan.** The architecture is load-bearing in exactly the right places:

- The **readiness-lib patch** is the single keystone. It's three lines of logic in `lib/instructor-readiness.ts` plus two extra fields on a Prisma select. Landing it in Phase 1 unlocks every downstream phase and keeps the existing offering-approval and capstone gates working unchanged.
- The **`TrainingAssignment` upsert hook** means the new system earns its place in the readiness spine without any consumer code changes. Admin boards, chapter-lead boards, the publish gate, and the certificate issuer all light up for free.
- The **TS-in-repo → DB-via-importer content path** gives us DB-backed content (per the user's choice) without the hidden cost of building an admin authoring UI at launch. Content becomes a small-PR surface with CI validation. Iteration cycle on a bad prompt: ~1 hour.
- The **Zod + `schemaVersion` posture on beat configs** is the difference between a system that rots and one that evolves. It costs us a small registry file and pays us for years.
- The **branching-as-first-class-beats** decision (from the Plan agent memo) was worth the early friction — it keeps scoring uniform, keeps analytics sane, and makes M3 actually trustworthy.
- The **in-place rebuild** of `/instructor-training` and `/training/[id]` — rather than a parallel `/training/academy` — means there are no redirects to orphan, no two systems to reconcile, and no "which URL do I send the instructor to" ambiguity. Feature-flag + legacy-fallback absorbs the risk.
- **framer-motion only inside the training tree** keeps the bundle honest.
- The **10-phase roadmap** is structured so the system is never half-built. Phase 1 is independently shippable (patches the readiness gate, ships zero user-visible change). Phase 4 is independently shippable (first module behind a flag). Phase 7 is independently shippable (new hub). Each phase passes a real exit bar before the next begins.

**What this plan deliberately is not:**

- It's not a Lesson Design Studio rebuild. We connect into the existing capstone; we don't touch it.
- It's not an in-app content editor. Authors use TS + PRs; admins inspect and operate but don't edit.
- It's not a gamification pivot. XP, badges, and the readiness score are all derived — no new leaderboard, streak, or ladder surface.
- It's not a video platform. Legacy video modules continue to render through the existing path; new content is scenario-first.

**Measured against the user's decision standard:**

- _Would a top startup product team ship this?_ Yes — the motion, scoring, and feedback standard is set by Phase 4 and enforced thereafter.
- _Would a real instructor enjoy this?_ Yes — 30–45 min, zero walls of text, immediate specific feedback, a real score they can point at.
- _Does this increase readiness?_ Yes — the Readiness Check is a measured, retakeable, domain-weighted gate, not a form.
- _Is this faster + better than videos?_ Yes — the absence of video is the point. Scenario-driven learning at a fifth of the time of the current path.
- _Does this feel premium?_ Yes — when the motion, the copy, and the scoring fidelity are all on the same standard, it does.

**Ready for execution.** The next action is Phase 0 (push this plan to the branch) followed by Phase 1 (schema + readiness patch), which unlocks everything else.

---

## Phase 0 — Ship the Plan

**Goal.** Get this plan into the branch so every subsequent phase executes against a committed, reviewable source of truth. No code, no schema — just the document itself, in the right place, on the right branch.

**Why this phase exists.** The plan currently lives at `/root/.claude/plans/memoized-forging-charm.md` (a Claude Code harness scratch path, not the repo). Every downstream phase needs to be able to quote from it, link to it, and amend it. Landing it as `docs/instructor-training-rebuild.md` on `claude/ypp-instructor-training-system-FH06A` means:
- Reviewers can read the plan alongside any PR that implements a phase.
- Subsequent phase prompts can reference concrete line numbers / section anchors.
- If we need to edit the plan mid-execution, Git history records the rationale.

**Touch surface.**

- `docs/instructor-training-rebuild.md` — new file, verbatim copy of `/root/.claude/plans/memoized-forging-charm.md`. The `docs/` folder already exists (verified in the audit); this fits the existing convention alongside `TECH_STACK.md`, `IMPLEMENTATION_PLAN.md`, `IMPROVEMENT-PLAN.md`, `plan.md` at the repo root. We intentionally use `docs/` (not repo root) because this plan is training-specific, not portal-wide.

**Steps.**

1. `cp /root/.claude/plans/memoized-forging-charm.md /home/user/YPP-Portal/docs/instructor-training-rebuild.md`
2. `git status` to confirm only the new file shows.
3. `git add docs/instructor-training-rebuild.md`
4. `git commit -m "Add instructor training rebuild plan"` (commit message style matches recent history: short verb-led, no trailing period).
5. `git push -u origin claude/ypp-instructor-training-system-FH06A` (retry up to 4× with 2s/4s/8s/16s backoff on network failure, per the branch rules).
6. Confirm the file is visible on the remote branch.

**Non-goals for this phase.**
- No pull request. The user will open one when they're ready.
- No edits to the plan content — this phase ships it verbatim.
- No touching of any other file (no README linking, no docs index, no nav).

**Exit criteria.**
- `docs/instructor-training-rebuild.md` exists on the remote branch `claude/ypp-instructor-training-system-FH06A`.
- `git status` is clean.
- The remote file content is byte-identical to `/root/.claude/plans/memoized-forging-charm.md` (verified via a quick diff).

**Estimated effort.** ~5 minutes. One commit, one push.

**Hand-off note.** After Phase 0, every subsequent prompt in the "Phase Execution Prompts" section below references the plan at `docs/instructor-training-rebuild.md` (on the branch). That's the canonical location going forward — the `/root/.claude/plans/` copy is a working scratch copy and may drift.

---

