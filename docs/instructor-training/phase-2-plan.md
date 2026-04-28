# Phase 2 — Instructor Training Architecture Plan

Sequenced improvement plan derived from
[`phase-1-audit.md`](./phase-1-audit.md). Each workstream lands as its own
small PR. No rewrite.

## 1. Planning Summary

The chassis is good. The interactive journey engine, beat scoring, unlock
gating, the Studio gate single-source pattern, and the instructor-readiness
aggregate are all worth preserving. Phase 2 makes completion **trustworthy**,
makes the canonical path **explicit**, and makes training evidence
**legible** to reviewers — without introducing any color-graded or numeric
rating into the learner-facing training experience.

**Product rule that constrains the plan:** training stays pass / complete.
The portal's purple / green / yellow / red rating system is only used in
interview review, admin readiness signals, and applicant risk summaries. It
does not appear in training UI.

**Product correction (post-audit): training videos are deprecated.** The
required training path is the interactive portal-based modules (interactive
journeys + Lesson Design Studio output). The Phase 1 audit's video
completion finding is no longer a priority integrity fix; legacy video
code is classified under WS2 / WS6 rather than hardened.

The strategy is incremental:

- **Fix integrity first** so every later improvement rests on data that
  actually means something.
- **Then declare semantics** (canonical completion path, Studio capstone
  state) so admins, learners, and reviewers all read the same signal.
- **Then surface and connect** that signal into reviewer / admin views.
- **Then clean up** confusion and **audit content quality** independently.

Every workstream is a single small PR. None require touching unrelated
subsystems.

## 2. Dependency Order

| Step | Workstream | Depends On | Why This Comes Now |
|---|---|---|---|
| 1 | WS1 — Completion Integrity | nothing | Spoofable quiz/video make every later metric meaningless. Security + data trust foundation. |
| 2 | WS3 — Studio Capstone Semantics | none (orthogonal to WS1) | Same shape of fix (one boolean → trustworthy boolean). Small. Safe to land alongside or just after WS1. |
| 3 | WS2 — Canonical Completion Model | WS1 | Once completion is honest, we can declare interactive-journey canonical and mark video-only as supplementary without lying about rigor. |
| 4 | WS6 — Cleanup / Confusion Reduction | none structurally | Best to interleave. Naming, archive removal, helper extraction. |
| 5 | WS4 — Training Evidence for Reviewers | WS1 + WS2 | Surfacing module pass + journey `scorePct` + Studio rubric only makes sense when those values are honest and canonical. |
| 6 | WS5 — Admin Cohort Triage | WS1 + WS2 (+ WS4 helps) | Same data dependency. Adds one screen; doesn't change source of truth. |
| 7 | WS7 — Curriculum Content Quality Pass | none structurally | Read-only audit, then small content edit PRs. |

## 3. Workstream Plans

### Workstream 1: Completion Integrity

**Goal:** Make module completion impossible to spoof from the client on
the **required** training path (interactive journeys).

**Problem from Phase 1:** Findings #1 (quiz score is client-trusted) and
#5 (reflection beats are unscored and ungated). Finding #2 (video
completion is client-asserted) is **deprioritized** — training videos are
deprecated; legacy video code is classified under WS2 / WS6.

**Product Decision:**
- Quiz pass is computed **server-side only** from the submitted answers
  vs. stored `correctAnswer`. Client-supplied `scorePct` is ignored.
  *(Shipped — commit `a7db9b4`.)*
- Reflection beats remain unscored, but a non-empty submission is
  **required** for the journey to be considered complete.

Training stays pass / complete. No grades, no colors, no public scores.
Video completion is **not** part of this workstream's scope.

**Likely Files Involved:**
- `lib/training-actions.ts` — `submitTrainingQuizAttempt` (shipped).
- `lib/training-journey/actions.ts` — `completeInteractiveJourney`
  readiness check (add reflection-submission requirement when a reflection
  beat is in the visible set).
- `lib/training-journey/kinds/reflection.ts` and its scorer — confirm a
  non-empty submission is the gate signal.
- Tests under `tests/lib/training-journey/*`.

**Implementation Shape:**
- In `submitTrainingQuizAttempt`: drop the `scorePctRaw` early-return;
  always compute from `answersJson` *(shipped)*.
- In `completeInteractiveJourney`: in the readiness loop, if a beat kind
  is `REFLECTION` and visible, require its latest attempt to exist with
  a non-empty submission. Reflections remain ungraded.

**Validation Steps:**
- Unit tests: `scorePct=100` with all-wrong answers → recorded as failed
  *(shipped)*; empty reflection on a visible reflection beat →
  `JOURNEY_NOT_READY`; non-empty reflection → journey can complete.
- `npm run typecheck`, `npm run test`.
- Manual QA: complete one interactive journey end-to-end as a learner.

**Risk Level:** Medium. Touches the canonical completion path. Strong
test coverage required.

**Commit Scope:** Two small PRs total — quiz (shipped) + reflection
gating (next).

**Stop Condition:** Both integrity tests green, existing tests still
pass, manual end-to-end completion still works for honest submissions.

---

### Workstream 2: Canonical Completion Model

**Goal:** Eliminate silent rigor differences between the two parallel
completion paths.

**Problem from Phase 1:** Finding #3 (interactive-journey vs. legacy
academy paths both write to `TrainingAssignment.status`).

**Product Decision:**
- Interactive-journey is the **canonical** required path.
- Video-based modules are **deprecated**: they must not be used as
  required training going forward. Existing required video-only modules
  are not migrated automatically, but the admin form should clearly mark
  the video path as legacy/deprecated and discourage new video-required
  modules.
- Once usage is confirmed in WS6, legacy video-completion code paths
  (`updateVideoProgress`, `videoReady` branch in
  `syncAssignmentFromArtifacts`, `student-training` revalidations) should
  be hidden, removed, or quarantined rather than hardened.

**Likely Files Involved:**
- `lib/training-actions.ts` — `assertValidModuleConfiguration` adds a
  "rigor classification" check based on `type` and required flag.
- `app/(app)/admin/training/module-form.tsx` and `training-manager.tsx` —
  admin UI surfaces the classification.
- `lib/instructor-readiness.ts` — extend `moduleConfigIssueById` reasoning.

**Implementation Shape:**
- Add a derived classification (no schema change required if it's computed
  from existing fields).
- Admin UI shows a clear label and a help tooltip explaining the difference.

**Validation Steps:** Typecheck + lint + new unit test for the
classification function.

**Risk Level:** Low. Mostly typing and UI labels.

**Commit Scope:** One PR.

**Stop Condition:** Required modules visibly classified in admin UI; no
behavioral change to learners.

---

### Workstream 3: Lesson Design Studio Capstone Semantics

**Goal:** Fix the "submission = complete" loophole on the Studio capstone.

**Problem from Phase 1:** Finding #6 — `studioCapstoneComplete =
curriculumDraft with status SUBMITTED | APPROVED`.

**Product Decision:**
- `studioCapstoneComplete` requires `APPROVED`.
- A new readiness state, "studio capstone in review," is shown when the
  draft is `SUBMITTED` but not yet approved. It does **not** unlock
  offering publish, but it does count toward "we're waiting on a reviewer"
  so the learner isn't blamed.

**Likely Files Involved:**
- `lib/instructor-readiness.ts` — narrow `studioCapstoneComplete` to
  `APPROVED`; add `studioCapstoneInReview: boolean`.
- `lib/lesson-design-studio-gate.ts` — unchanged.
- `components/onboarding/instructor-steps.tsx` and any "next action"
  surfaces — show "in review" state.

**Implementation Shape:**
- Tighten the Prisma `where` clause from `status: { in: ["SUBMITTED",
  "APPROVED"] }` to `status: "APPROVED"`.
- Add a parallel small query for `SUBMITTED` to populate the "in review"
  flag.

**Validation Steps:** Unit test on `buildInstructorReadinessFromSnapshot`
for three cases: no draft, submitted, approved. Backfill awareness check.

**Risk Level:** Medium — changes who can publish.

**Commit Scope:** One PR.

**Stop Condition:** Submission alone no longer satisfies readiness;
"in review" state visible to learner and reviewer.

---

### Workstream 4: Training Evidence for Reviewers / Admins

**Goal:** Make training results legible at the moment a reviewer is forming
a recommendation, without turning training into a graded color rating.

**Problem from Phase 1:** Finding #7 — applicant cockpit and chair queue
don't surface training data.

**Product Decision:**
- A compact "Training evidence" card on the applicant detail panel and
  chair-review page, showing:
  - Required modules: complete / in progress / not started.
  - Per-journey: completed at, `scorePct` against `passScorePct`
    (internal, factual, not styled as a grade).
  - Beats with retry counts above a threshold (e.g., 3+ attempts) — flagged
    as "topics to probe" without scoring them.
  - Studio rubric summary (existing fields: clarity, sequencing,
    studentExperience, launchReadiness, summary).
- **No color tier on training.** The card is purely factual.
- The existing P/G/Y/R rating on the **interview review** continues
  unchanged.

**Likely Files Involved:**
- `lib/instructor-readiness.ts` — extend (or add a sibling query) to
  include training-evidence fields, batched.
- `components/instructor-applicants/*` — add a `TrainingEvidenceCard` to
  the detail panel and chair workspace.
- `app/(app)/admin/instructor-applicants/[id]/review/page.tsx` and
  `chair-queue/[applicationId]/page.tsx` — render the new card.

**Implementation Shape:**
- Read `InteractiveJourneyCompletion` rows for the candidate; group by
  module; compute aggregate.
- For "topics to probe," query `InteractiveBeatAttempt` aggregated by
  `beatId`, sort top-N by attempt count desc.
- Read the latest `curriculumDraft.reviewRubric` for the Studio summary.

**Validation Steps:** Unit test for the data-shaping function. Render test
for the card with three fixtures. Manual QA on a seeded applicant.

**Risk Level:** Medium. Adds queries to a hot admin page; batch carefully.

**Commit Scope:** One PR, scoped to data + one card component + two render
sites.

**Stop Condition:** Reviewers see training evidence on applicant detail;
no P/G/Y/R applied to training.

---

### Workstream 5: Admin Cohort Triage

**Goal:** One screen that answers "who's stuck, who's ready, who hasn't
started?" across the cohort.

**Problem from Phase 1:** Finding #8 — admin visibility today is
per-instructor, not cohort-level.

**Product Decision:**
- Add or extend the existing `learner-progress.tsx` admin view into a
  triage queue with five buckets:
  1. Not started
  2. In progress
  3. Stuck (in progress with last activity > N days ago)
  4. Passed (all required modules complete)
  5. Awaiting Studio review (capstone submitted but not approved)
- Each bucket links to per-instructor detail.
- Reuse existing kanban / data-table primitives.

**Likely Files Involved:**
- `app/(app)/admin/training/learner-progress.tsx`.
- `lib/instructor-readiness.ts` or a new `lib/training-cohort-triage.ts` —
  bucketing function (pure).
- `components/data-table.tsx` and `components/empty-state.tsx`.

**Implementation Shape:**
- Pure bucketing function over the readiness-many output.
- Tabbed/sectioned view, default tab "Stuck".

**Validation Steps:** Unit test on the bucketing function. Render test for
empty + populated state.

**Risk Level:** Low. New view; no change to source-of-truth logic.

**Commit Scope:** One PR.

**Stop Condition:** Admin can see cohort triage in one screen with working
drill-down.

---

### Workstream 6: Cleanup / Confusion Reduction

**Goal:** Remove ambient confusion that doesn't change behavior but slows
everyone down.

**Problem from Phase 1:** Finding #9 — readiness naming clash, legacy
archive JSON, repeated revalidation chains, possibly unused
`student-training` route.

**Product Decision:**
- Disambiguate the two "readiness" concepts at the code level only
  (rename types and clarify comments — keep public route paths stable).
- Extract the repeated `revalidatePath` chains in `lib/training-actions.ts`
  into one helper.
- Move `data/training-academy/content.v1.legacy-archive.json` to `output/`
  or delete after confirming it isn't read at runtime.
- For `student-training`: do NOT remove. Confirm usage with one targeted
  search in a follow-up; if unused, remove behind a separate small PR.

**Likely Files Involved:**
- `lib/training-actions.ts` (helper extraction).
- `lib/instructor-readiness.ts`, `lib/readiness-signals.ts` (comments /
  types only).
- `data/training-academy/content.v1.legacy-archive.json` (move / remove).

**Implementation Shape:** Pure refactor. No behavior change.

**Validation Steps:** Typecheck + lint + tests.

**Risk Level:** Low.

**Commit Scope:** One small PR for the helper + comments. A separate tiny
PR for archive removal if confirmed safe.

**Stop Condition:** Diff reads as smaller, names are unambiguous in code,
no functional change.

---

### Workstream 7: Curriculum Content Quality Pass

**Goal:** Audit the actual teaching content for YPP voice, scenario realism,
parent-comms coverage, "what makes a good YPP class," and Goals & Resources
linkage. Propose, do not implement.

**Problem from Phase 1:** Finding #10 — chassis is good, content not yet
audited.

**Product Decision:**
- Read the 5 hand-coded curriculum modules and the import JSON.
- Produce a short content-grading document per module covering: tone,
  realism, accuracy, gaps, parent-comms, mentorship / Goals & Resources
  hooks.
- Propose specific edits in a follow-up — do not edit content here.

**Likely Files Involved (read-only):**
- `lib/training-curriculum/run-a-great-session.ts`
- `lib/training-curriculum/communication-reliability.ts`
- `lib/training-curriculum/student-situations.ts`
- `lib/training-curriculum/ypp-standard.ts`
- `lib/training-curriculum/readiness-check.ts`
- `data/training-academy/content.v2.json`
- A few `data/training-academy/video-scripts/*` for tone reference.

**Implementation Shape:** A short audit doc per module (5–10 bullets each).
Recommendations grouped: keep / polish / rework / add.

**Validation Steps:** None — output is a document.

**Risk Level:** Low.

**Commit Scope:** One PR adding audit notes under
`docs/instructor-training/content-audit/`.

**Stop Condition:** Five module audits delivered with concrete
recommendations.

## 4. Recommended First Implementation PR

**WS1 — Completion Integrity, narrowed to the quiz fix only.**

**Exact objective:** In `lib/training-actions.ts`, change
`submitTrainingQuizAttempt` so that `scorePct` is always computed
server-side from `answersJson` against stored `correctAnswer` values; ignore
any client-supplied `scorePctRaw`. Reject submissions with missing or
malformed `answersJson`.

**Likely files:**
- `lib/training-actions.ts` (`submitTrainingQuizAttempt` only).
- A new test file at `tests/lib/training-quiz-scoring.test.ts` (or
  co-located).

**Acceptance criteria:**
- A submission with `scorePct=100` and all-wrong answers is recorded with
  the server-computed score and `passed=false`.
- A submission with no `answers` field is rejected with a clear error.
- A submission with valid answers passes / fails based purely on
  server-side comparison.
- `passScorePct` per module continues to drive the pass threshold.
- Existing honest-submission flow still works end-to-end.
- Type, lint, and test suites pass.

**Tests to run:**
- `npm run typecheck`
- `npm run lint`
- `npm run test` (with the new quiz-attempt tests)
- Manual: complete one quiz honestly in the dev app; verify
  `TrainingAssignment.status` flips correctly.

**Why first:** It is the single highest-impact, smallest-blast-radius
change in the entire plan. It closes the most direct way to fake training
completion, requires no schema migration, no UI work, and no cross-system
coordination. Every later workstream depends on completion data actually
meaning something — this PR is what makes that true.

> **Status:** Shipped as commit `a7db9b4` —
> `fix: compute training quiz scores server-side`. Helper extracted to
> `lib/training-quiz-scoring.ts`; 14 unit tests added at
> `tests/lib/training-quiz-scoring.test.ts`.

### Recommended Next Implementation PR

**WS1 PR-2 — Reflection / required-response gating.**

**Exact objective:** In `completeInteractiveJourney`
(`lib/training-journey/actions.ts`), require any visible `REFLECTION` beat
to have a non-empty submission before the journey can be marked complete.
Reflections remain ungraded. Training stays pass / complete; no scoring
UI is added.

**Likely files:**
- `lib/training-journey/actions.ts` — extend the readiness loop.
- `lib/training-journey/kinds/reflection.ts` and its scorer — confirm or
  expose a "submitted" predicate (response text non-empty after trim).
- `tests/lib/training-journey/kinds/reflection.test.ts` and a small test
  in `tests/lib/training-journey/` covering the journey-readiness
  behavior.

**Acceptance criteria:**
- A journey with a visible reflection beat and no attempt → `JOURNEY_NOT_READY`.
- A journey with a visible reflection beat whose latest attempt has empty
  / whitespace-only text → `JOURNEY_NOT_READY`.
- A journey with a visible reflection beat whose latest attempt has
  meaningful text → completion proceeds (subject to the existing
  `passScorePct` check on scored beats).
- A reflection beat that is **not visible** (filtered out by `showWhen`)
  does not gate completion.
- No grading or scoring of reflection text is introduced.

**Why next:** Closes the second remaining click-through path on the
required training path (the first being quiz scoring, now fixed). Small
diff, isolated to journey completion logic, no UI change required.

> **Out of scope:** video completion (deprecated), Studio capstone
> semantics (WS3), reviewer evidence (WS4), admin triage (WS5), naming
> cleanup (WS6), content audit (WS7).

## 5. What Not To Do

- **No rewrite.** Preserve the journey engine, beat scoring, unlock
  gating, Studio gate, and readiness aggregate.
- **No purple/green/yellow/red on training.** Training stays
  pass / complete. Color ratings remain only on interview review and
  applicant decision support.
- **No new public numeric grades on training.** `passScorePct` is an
  internal threshold, not a learner-facing grade or ranking.
- **No massive one-shot PR.** Each workstream lands as its own small PR.
- **No broad codebase refactor.** Naming and helper-extraction touches are
  scoped to the training subsystem.
- **No deleting `student-training`, legacy academy content, or any
  "duplicate-looking" route until usage is confirmed** with a targeted
  grep in its own PR.
- **No UI redesign before completion logic is safe.** Any cockpit / triage
  UI work happens after WS1 ships.
- **No introducing new Prisma migrations** unless a workstream truly
  requires one — the plan as written is migration-free.

## 6. Final Checkpoint

- Phase 2 plan complete (with post-audit correction: training videos are
  deprecated and the video integrity track has been removed from WS1).
- WS1 PR-1 shipped (commit `a7db9b4`).
- Recommended next: **WS1 PR-2 — reflection / required-response gating**.
- Then: WS3 / WS2 / WS6 / WS4 / WS5 / WS7 per the dependency table.
  Legacy video code is classified and cleaned up under WS2 / WS6, not
  hardened.
