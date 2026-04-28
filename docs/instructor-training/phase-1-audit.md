# Phase 1 — Instructor Training Modules Audit

Read-only discovery audit of the Instructor Training Modules system in
YPP-Portal. No code was modified during Phase 1.

## 1. System Map

### Already built (and largely solid)

- **Interactive Training Journey engine** (`lib/training-journey/*`,
  `components/training/journey/*`): 12 beat kinds (concept-reveal,
  scenario-choice, branching-scenario, multi-select, sort-order, match-pairs,
  spot-the-mistake, fill-in-blank, reflection, compare, hotspot,
  message-composer); Zod-validated configs/responses; per-kind scorers;
  branching with `showWhen`; server-side scoring + persistence
  (`InteractiveBeat`, `InteractiveBeatAttempt`,
  `InteractiveJourneyCompletion`); feature-flagged; rate-limited;
  transaction-safe.
- **Training curriculum authoring**: TS-source curricula in
  `lib/training-curriculum/*` (run-a-great-session, communication-reliability,
  student-situations, ypp-standard, readiness-check), imported idempotently
  via `sourceKey` through scripts.
- **Module unlock gating**: `computeModuleUnlockState` linearly gates
  required modules by `sortOrder`. Pure, tested.
- **Lesson Design Studio**: multi-step editor (start → course-map → sessions
  → readiness → review-launch), draft chooser, examples library, comment
  threads, print/PDF, rich editor, micro-checks.
- **Studio gate**: single source of truth (`lesson-design-studio-gate.ts`) —
  Studio unlocks when readiness-check module is COMPLETE; reviewers bypass;
  safe fallback if M5 not yet imported.
- **Instructor readiness aggregate** (`instructor-readiness.ts`): combines
  required-modules-complete + studio-capstone-submitted + interview-passed;
  surfaces typed `missingRequirements` and a `nextAction`.
- **Admin applicant kanban + decision-readiness 4-signal meter**
  (`readiness-signals.ts`): interview reviews / materials / lead-recommendation
  / no-open-info-request.
- **Admin training**: module CMS (create/edit/clone/reorder/delete), quiz
  builder, learner-progress view, evidence review with rubric → linked back
  to curriculum draft.
- **Onboarding**: `instructor-steps.tsx` routes to `nextReadinessAction`
  (start-training | schedule-interview).

### Partially built / weak

- **Two parallel completion paths**: legacy academy (video + checkpoints +
  quiz + evidence) vs. interactive-journey (beat scoring → `passScorePct`).
  Both write into `TrainingAssignment.status`, but the rules differ.
- **Checkpoints quietly disabled as a gate**: comment in
  `syncAssignmentFromArtifacts` — *"Goals are now purely informational —
  they no longer gate completion."*
- **Studio capstone = submitted-or-approved draft**: submission alone passes
  the readiness flag; reviewer approval not required.
- **Quiz scoring trusts a client-supplied `scorePct`** in
  `submitTrainingQuizAttempt`. Real spoof risk.
- **Video completion trusts client `completed=true`** with no watched-seconds
  threshold.

### Missing

- Connection between **training results and the applicant/interview cockpit**.
  Admin readiness signals don't surface module pass/fail or studio rubric
  scores; reviewers can't see "this candidate scored low on X scenario"
  before interview.
- **Admin "who's ready / who's stuck / who hasn't started"** at-a-glance
  view across the cohort with deltas.
- **Readiness-check → interview-prep handoff**: passing the readiness module
  unlocks Studio but does not feed structured signals into the interview
  review.
- A clear **first-class "module sequence" rationale** documented in code/UI
  (`sortOrder` is mechanical; learners aren't shown why).

### Confusing / duplicated

- Two concepts both called "readiness": `instructor-readiness` (gate for
  the instructor) vs. `readiness-signals` (admin-side meter for the
  applicant).
- Two curriculum sources: hand-coded TS modules in `lib/training-curriculum/`
  and JSON in `data/training-academy/content.v2.json` (legacy + v2).
  Multiple import scripts (`seed`, `import`, `verify`, `validate`, `export`,
  `sync`).
- `student-training` route + bulk-assign-to-students action — students appear
  to share the same training pipeline. Likely vestigial for instructor-only
  modules.
- `MatchPairs` placeholder text + a `TODO(M3)` for parentBeatId DAG traversal
  in `JourneyPlayer`.

### Should stay as-is (do NOT rebuild)

- Beat scoring engine and `scoreBeat()` dispatch
  (`lib/training-journey/scoring.ts`) — clean, well-defended.
- `computeModuleUnlockState` (`lib/training-journey/progress.ts`) — pure,
  simple, tested.
- `lesson-design-studio-gate.ts` single-source-of-truth pattern.
- 12 beat kind components and renderer dispatch.
- The interactive-journey `submitBeatAttempt` / `completeInteractiveJourney`
  server actions — security posture is strong.

## 2. Highest-Signal Files Reviewed

| File | Purpose | Why it matters |
|---|---|---|
| `lib/training-journey/progress.ts` | Linear unlock state per module | Defines learner sequence — no obvious bug |
| `lib/training-journey/actions.ts` | Beat submit + journey complete server actions | Canonical scored-completion path; well-defended |
| `lib/training-journey/scoring.ts` | Per-kind scorer dispatch | Strong Zod safeguards; clean |
| `lib/training-actions.ts` | Legacy academy completion (video/checkpoint/quiz/evidence) | Surface area for the **trust-the-client** issues |
| `lib/instructor-readiness.ts` | Aggregate readiness gate (training + studio + interview) | Single decision struct used to publish offerings |
| `lib/lesson-design-studio-gate.ts` | Studio access gate | Clean, but only depends on M5 completion |
| `lib/readiness-signals.ts` | Admin 4-signal applicant meter | Distinct from `instructor-readiness`; reviewer view |
| `lib/training-curriculum/types.ts` | Authoring shape for beats/journeys | Defines what authors can build |

## 3. Severity-Ranked Findings

### Critical

1. **Quiz score is client-trusted** — `submitTrainingQuizAttempt` accepts
   `scorePctRaw` from the form and uses it directly when finite; the
   answers-vs-`correctAnswer` recompute only runs when `scorePctRaw` is
   missing/NaN. A learner can POST `scorePct=100` and pass any required
   quiz. *Direction:* **Rework** — always score server-side from
   `answersJson`; ignore any client-provided `scorePct`.
2. **Video completion trusts `completed=true` from the client with no
   watched-seconds threshold** — `requestedCompleted = formData.get("completed") === "true"`
   flips the row to completed. *Direction:* **Rework** — require
   `watchedSeconds ≥ videoDuration × 0.9` (or similar) in addition to the
   client signal; or compute completion server-side.

### High

3. **Checkpoints removed as a completion gate** — `checkpointsReady = true`
   is hard-coded with the comment that goals are now informational. *Direction:*
   **Decide and document** — either re-enable required checkpoints as a
   gate, or remove the UI entirely so the system isn't lying about what's
   required.
4. **Two parallel "module complete" rules** — interactive journey requires
   `scorePct ≥ journey.passScorePct` over visible scored beats; legacy
   academy requires video+quiz+evidence (with the trust issues above).
   Same `TrainingAssignment.status` flips through both paths. *Direction:*
   **Rework** — declare interactive-journey the canonical path for new
   modules; mark video-only modules as supplementary.
5. **Studio capstone passes on submission, not approval** —
   `studioCapstoneComplete` = any `curriculumDraft` with status in
   `SUBMITTED | APPROVED`. *Direction:* **Rework** — require `APPROVED`,
   with `SUBMITTED` shown as "in review" but not yet complete.
6. **Training results don't surface to interviewers** — admin/applicant
   cockpit reads the 4-signal meter but doesn't display per-module
   pass/fail, journey scorePct, or studio rubric scores. *Direction:*
   **Connect/integrate** — surface a compact "training evidence" card on
   the applicant detail panel and chair queue.

### Medium

7. **Naming clash: two "readiness" concepts** —
   `lib/instructor-readiness.ts` vs. `lib/readiness-signals.ts` +
   `app/.../instructor-readiness/*`. *Direction:* **Polish** — rename to
   disambiguate at the code level.
8. **Module-config validation hides which module is broken** — when a
   required module has a config issue, the missing-requirement message says
   "Contact an admin to finish setup" without naming the module. *Direction:*
   **Polish** — include module title.
9. **Reflection beats are completely unscored** — `scoringWeight: 0` and
   excluded from completion. *Direction:* **Polish** — track reflection
   submission (text length / present) without scoring; require submission
   for journey completion.
10. **Student-training pathway shares plumbing** —
    `bulkAssignModuleToStudents`, `student-training/page.tsx`, and dual
    revalidation of `/instructor-training` + `/student-training` everywhere.
    *Direction:* **Hide until ready** or **Remove** if not used.
11. **No "module rationale" surfaced to learner** — sequence is mechanical
    (`sortOrder`). *Direction:* **Polish** — add a short outcome statement
    on each module card.

### Low

12. `TODO(M3)` in `JourneyPlayer.tsx` for parentBeatId/multi-level DAG
    traversal. *Direction:* **Keep**, file as backlog.
13. `MatchPairs` has a placeholder visual. *Direction:* **Polish** when
    touching that beat.
14. Multiple `revalidatePath` chains repeated across `training-actions.ts`
    (10+ sites of the same set). *Direction:* **Polish** — extract a helper.
15. `data/training-academy/content.v1.legacy-archive.json` still in repo.
    *Direction:* **Remove** or move to `output/`.

## 4. Training Pass / Completion Audit

| Question | Current state |
|---|---|
| What counts as "passed" or "completed"? | Interactive-journey path: `scorePct ≥ journey.passScorePct` (default 80%) over visible scored beats. Legacy academy path: `videoReady && true && quizReady && evidenceReady`. |
| Can it be clicked through? | **Yes** in the legacy path — quiz score is client-trusted; video completion is client-asserted. Interactive-journey path is robust. |
| Are required modules clearly defined? | Yes (`required: true` on `TrainingModule`) with linear `sortOrder` gating. |
| Is completion persisted? | Yes — `TrainingAssignment.status` (NOT_STARTED / IN_PROGRESS / COMPLETE) and `InteractiveJourneyCompletion`. |
| Checks for understanding? | In journeys: yes (per-kind scoring + retries). In legacy academy: only via quiz, which is bypassable. Reflection beats not gated. |
| Studio output required before completion / interview? | Submission required for `studioCapstoneComplete`, but **approval** is not. |
| Admin visibility (passed / stuck / not started / ready)? | Per-instructor `learner-progress.tsx` exists. No cohort triage queue. Applicant readiness signals don't surface training data. |
| Avoids unnecessary scoring while proving readiness? | Mostly — color/tier system is correctly absent in training. Internal `passScorePct` and XP are present (for the journey engine), but not exposed as a P/G/Y/R rating. |

## 5. Curriculum / Content Quality Notes

The content of the 5 hand-coded curriculum modules and `content.v2.json` was
not deep-read in Phase 1; that needs a focused content-quality pass. From
structure alone:

- **Strong existing**: 5 hand-coded curricula targeting concrete YPP topics
  (run-a-great-session, communication-reliability, student-situations,
  ypp-standard, readiness-check). The interactive beat library can express
  realistic scenarios — the chassis is right.
- **Likely needs major rework**: parent-communication module isn't visible
  by name in the curriculum list — may live under "communication-reliability"
  or be missing.
- **Likely missing**: an explicit "what makes a good YPP class" capstone
  scenario; a "first-class checklist" instructors run through before
  publishing; structured connection to Goals & Resources / mentorship
  content.

## 6. UX / Product Flow Audit

- **Sequence**: Linear, gated, mechanically correct. Lacks a one-screen
  "training journey" map showing the whole arc and where you are.
- **Next-step clarity**: `nextAction` field is a strong primitive — make
  sure every entry point uses it.
- **Progress clarity**: `JourneyProgress` exists; module-level progress in
  hub is clear.
- **Empty / loading / error**: `components/empty-state.tsx`,
  `loading-states.tsx`, `error-boundaries.tsx` exist as primitives; adoption
  across training pages should be audited.
- **Real onboarding feel vs. static pages**: interactive journey is real;
  the academy/video path feels more static. The two coexist visually with
  no clear distinction.
- **Unfinished features visible**: legacy `student-training` route,
  `content.v1.legacy-archive.json`, `TODO(M3)` parent-beat DAG. None
  catastrophic; should be cleaned before launch.
- **Duplicate routes**: `/instructor-training` (hub) vs. `/training/[id]`
  (player) vs. `/student-training` (parallel).

## 7. Integration Gaps

| From → To | State |
|---|---|
| Training modules → Lesson Design Studio | Solid: M5 completion unlocks Studio via single-source-of-truth gate. |
| Training pass → Interview workflow | **Weak**: scores/evidence don't appear in interviewer/reviewer views. |
| Training progress → Admin readiness signals | **Weak**: applicant 4-signal meter ignores training data. |
| Training pass → Approval / onboarding | Solid: `assertReadinessAllowsPublish` blocks offering publish. |
| Studio rubric → Applicant decision | Connected via evidence-review → curriculum-draft, but rubric scores aren't surfaced on applicant detail. |
| P / G / Y / R rating | Correctly **absent** from training. Used in interview/admin contexts (and award tiers, separately). Don't introduce it into training. |

## 8. Technical Risks

- **Mock vs. persisted**: training data is fully Prisma-persisted — no mocks.
- **Types / models**: strong (Zod + Prisma + dedicated authoring types).
  Branching predicates have a homegrown `ShowWhen` discriminated union that
  should be Zod-validated at import time too.
- **State**: server-driven; client receives serialized snapshots. Good.
- **Routes**: parallel `/instructor-training` + `/student-training` and dual
  revalidations indicate a bygone pivot — risk of drift.
- **Permissions**: `requireAdmin`, `requireAdminOrChapterLead`,
  `requireTrainingLearner`, `assertReviewerCanManageInstructor` are clear
  and chapter-scoped where appropriate.
- **Performance**: `getInstructorReadinessMany` batches well. Per-action
  revalidation lists are repetitive but cheap.
- **Maintainability**: import / validate / export script proliferation
  around training-academy content suggests authoring friction. Consider
  consolidating to one `training:sync` entry point.
- **Scale**: linear gating + idempotent re-import is fine to scale globally.

## 9. Top Shipping Risks (as-is)

1. **Quiz / video completion can be spoofed (Critical)** — fastest path to
   a "trained" instructor who hasn't actually trained.
2. **Studio capstone passes on submission (High)** — instructors can submit
   a stub plan and clear the gate.
3. **Reviewers fly blind on training (High)** — interviews aren't informed
   by what the candidate did or struggled with.
4. **Two completion engines, one column (High)** — silent inconsistencies
   in module rigor.
5. **Checkpoints disabled but UI may still imply they matter (Medium)** —
   credibility risk.
6. **Naming overlap and duplicate routes (Medium)** — onboarding confusion
   for engineers and admins.
7. **Curriculum content not yet content-reviewed (Medium)** — chassis is
   good but the *teaching* hasn't been audited.

## 10. Recommended Phase 2 Scope

Seven small, sequenced workstreams, each shippable as its own PR:

1. **Pass / completion integrity** — server-side quiz scoring; watched-seconds
   video gate; reflection-must-be-submitted.
2. **Canonical completion path** — interactive-journey first-class; video-only
   marked supplementary or migrated.
3. **Studio capstone semantics** — require approval, not just submission, for
   readiness; expose "in review" as a distinct state.
4. **Training-evidence visibility** — surface module completion + journey
   `scorePct` + studio rubric on applicant detail and chair queue (still no
   P/G/Y/R for training; just structured evidence).
5. **Admin cohort triage** — one screen showing who's stuck / where, with
   module-level drill-down.
6. **Cleanup / confusion reduction** — naming clash, legacy archive JSON,
   vestigial student-training surface (if confirmed unused).
7. **Curriculum content audit** — read and grade the 5 modules for YPP voice,
   scenario realism, parent-comms coverage, Goals & Resources linkage.

See [`phase-2-plan.md`](./phase-2-plan.md) for the detailed plan.
