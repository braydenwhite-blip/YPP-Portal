# YPP Instructor Training Academy — Redesign & Rebuild Plan

## Context

YPP instructors are the product. Their job is to **create engaging, meaningful, high-quality learning experiences that help students explore and develop their passions**, while building strong family relationships, staying reliable and professional, contributing to the YPP community, and growing into greater roles (**Instructor → Senior Instructor → Lead Instructor**). The portal already has a substantial, recently-rebuilt Instructor Training Academy — but it does **not** train instructors against the actual role framework (the **5 GOALS**), it feels disconnected across too many surfaces, the experience layer has visual inconsistencies and a few dead/spoofable paths, and two competing growth taxonomies exist. The result reads as a polished-but-hollow module checklist rather than a guided academy that produces an excellent YPP Instructor.

This plan rebuilds the training to **mirror the official role framework 1:1**, using YPP's real vocabulary throughout, while **reusing the strong engine that already exists** (do not rebuild the journey/scoring/readiness spine). It is a single source of truth that folds in the experience layer **and** the backend integrity work currently split into `docs/instructor-training/phase-2-plan.md`.

### Decisions locked with stakeholder (Brayden)
1. **Structure:** Rebuild into **Welcome/Role Mission + one module per GOAL (5) + Readiness Check capstone**, replacing the current 3-phase (Deliver → Prove → Design) framing.
2. **Goals 4 & 5 depth:** **Lighter touch** — orientation + expectations + promotion-ladder preview. Concentrate interactive depth on **Goals 1–3** (the classroom goals that matter before a first class).
3. **Vocabulary:** **Standardize on the official ladder** (Instructor → Senior → Lead) and the **5 GOAL names** in all training UI. Retire the whimsical `InstructorGrowthTier` names (SPARK/PRACTITIONER/CATALYST/PATHMAKER/LEADER/LUMINARY/FELLOW) from instructor-facing training surfaces.
4. **Scope:** **One unified plan** — experience (structure, content, visuals, cohesion) **plus** backend integrity (completion, semantics, admin visibility).

### Canonical vocabulary to use everywhere (microcopy + code labels)
- **Role mission line:** "Create engaging, meaningful, high-quality learning experiences that help students explore and develop their passions."
- **The 5 GOALS** (exact names): **GOAL 1 — Curriculum & Class Delivery**, **GOAL 2 — Student & Family Relationships**, **GOAL 3 — Organization, Commitment & Reliability**, **GOAL 4 — YPP Community Involvement**, **GOAL 5 — Long-Term Growth & Increased Involvement**.
- **The ladder:** **Instructor → Senior Instructor → Lead Instructor** (promotion after 2–4 strong months at each level).
- Training teaches to the **Instructor** column of each GOAL's competency rubric; it **previews** the Senior/Lead columns as "where this goes."

---

## 1. Current-State Audit

### Tech stack
Next.js (App Router) + React + TypeScript, Prisma/Postgres, Framer Motion, a token-based CSS design system in `globals.css` (`--ypp-purple-*`, `--surface`, `--radius-*`, `--shadow-*`, `--ease-launchpad`), Vitest + Playwright. Training content is **authored in TypeScript** under `lib/training-curriculum/` and **imported into the DB** via scripts.

### Existing routes (instructor training)
- `app/(app)/instructor-training/page.tsx` — the **hub** ("Your Training Journey"). Renders `TrainingAcademyShell` + `TrainingHome`. **Contains inline-styled status banners with hardcoded hex** (`#a78bfa`, `#f5f3ff`, `#16a34a`, `#f59e0b`…) — the main visual-inconsistency offender.
- `app/(app)/instructor-training/layout.tsx`, `app/(app)/instructor-training/readiness/page.tsx` — readiness/curriculum-review surface.
- `app/(app)/training/[id]/{page,client,journey-shell}.tsx` — the **module player** (branches on module type → interactive `JourneyPlayer`).
- `app/(app)/instructor-onboarding/page.tsx` — the **Launchpad**, which **embeds the same `getTrainingHomeModel` view** as Step 3 (training is a phase of onboarding).
- `app/(app)/student-training/page.tsx` — **vestigial** parallel student pipeline (dual-revalidated everywhere; likely dead).
- `app/(app)/admin/training/*` — admin CMS: `training-manager.tsx`, `module-form.tsx`, `learner-progress.tsx`, `quiz-option-builder.tsx`, `media-editor.tsx`, `sortable-module-list.tsx`, `markdown-editor.tsx`.
- `app/(app)/learn/*` — a **separate self-paced student learning system** (`getPublishedModules`, practice). Out of scope but a naming/clarity hazard ("modules" overload).

### Existing components
- `components/instructor-training/`: `training-academy-shell.tsx`, `training-home.tsx` (+ `.module.css`), `current-task-hero.tsx`, `phase-map.tsx`, `phase-module-rows.tsx`, `progress-ring.tsx`, `parallax-layer.tsx`, `training-scroll-context.tsx`, `training-academy.module.css`.
- `components/training/journey/`: `JourneyPlayer.tsx`, `JourneyIntro.tsx`, `JourneyProgress.tsx`, `JourneyComplete.tsx`, `ConfettiBurst.tsx`, `RoomMeters.tsx`, `MotionProvider.tsx`, `journey.css`, and **12 beat kinds** under `beats/` (ConceptReveal, ScenarioChoice, BranchingScenario, MultiSelect, SortOrder, MatchPairs, SpotTheMistake, FillInBlank, Reflection, Compare, Hotspot, MessageComposer) + `BeatRenderer/BeatShell/BeatActions/BeatFeedback`.
- `components/instructor-onboarding/`: `instructor-onboarding-guide.tsx`, `onboarding-stepper.tsx`.

### Existing data/curriculum
- **5 curriculum modules** authored in `lib/training-curriculum/` and registered in `index.ts`:
  - `ypp-standard.ts` — **The YPP Standard** (6 min): mission/expectations, parent updates, red flags, reliability.
  - `run-a-great-session.ts` — **Run a Great Session** (8 min): session arc (open → teach → check → close), pacing.
  - `student-situations.ts` — **Student Situations** (7 min): confused/disengaged students, intervention ladder, check-ins.
  - `communication-reliability.ts` — **Communication & Reliability** (6 min): messaging, parent comms, tone, missed sessions.
  - `readiness-check.ts` — **Readiness Check** (9 min): capstone across all domains; gates the Lesson Design Studio.
- Engine libs: `lib/training-journey/*` (scoring, actions, progress, schemas, types, `kinds/*`), `lib/training-phases.ts` (3-phase view-model), `lib/training-home-model.ts`, `lib/training-access.ts`, `lib/training-constants.ts`, `lib/instructor-readiness.ts`, `lib/lesson-design-studio-gate.ts`.
- Schema: `TrainingModule`, `TrainingAssignment`, `VideoProgress`, `TrainingCheckpoint(+Completion)`, `TrainingQuizQuestion(+Attempt)`, `TrainingEvidenceSubmission`, `InteractiveJourney`/`InteractiveBeat`/`InteractiveBeatAttempt`/`InteractiveJourneyCompletion`, `InstructorProfile.readinessScore`. Plus the **existing G&R / growth system**: `lib/growth-model.ts`, `lib/leadership-pathway.ts`, `lib/gr-actions.ts`, `lib/goal-review-actions.ts`, enums `InstructorGrowthTier` (7 whimsical tiers) + `InstructorGrowthCategory` (TEACHING/GROWTH/COMMUNITY/IMPACT), `PromotionRecommendation`.

### Current flow
Launchpad (onboarding) → Training hub (`/instructor-training`) → linear modules via `/training/[id]` (journey player) → Readiness Check passes → unlocks **Lesson Design Studio** capstone (`?entry=training`) → curriculum review + offering approval on the Readiness page → cleared to teach. Interview lane runs in parallel for applicants.

### What genuinely works (keep — do NOT rebuild)
- **Journey engine + scoring**: `lib/training-journey/scoring.ts`, `actions.ts`, `progress.ts` — Zod-validated, server-scored, append-only attempts, branching. Strong security posture.
- **12 beat-kind components** + renderer dispatch.
- **Premium hero**: `current-task-hero.tsx` — spring physics, pointer-reactive orb, parallax, progress ring, reduced-motion-safe.
- **Design-token CSS** in `training-home.module.css` (hue identities, responsive, reduced-motion).
- **Readiness/gate spine**: `instructor-readiness.ts`, `lesson-design-studio-gate.ts` single-source-of-truth, `computeModuleUnlockState`.
- **Idempotent content pipeline**: `training:validate` / `training:import` / `training:sync` keyed by stable `sourceKey`.

### What feels broken / confusing (the "kinda sucks")
1. **Doesn't speak the role framework.** Modules are craft-themed, not the **5 GOALS**. Nothing trains/sets expectations for **GOAL 4 (Community)** or **GOAL 5 (Growth)**, and the **promotion ladder is invisible** — new instructors never see where they're going.
2. **Surface fragmentation.** Training is spread across Launchpad, standalone hub, Readiness page, Studio, and interview lane with **inconsistent framing** ("phases" vs "journey" vs "launchpad" vs "mission control"). Reads as disconnected.
3. **Visual inconsistency.** Hub banners bypass the design system with **hardcoded inline hex**; `.card` utilities mix with CSS-module styling; the player and hub don't share a visual signature.
4. **Beat monotony.** Heavy reliance on SORT_ORDER / FILL_IN_BLANK / MULTI_SELECT makes journeys feel quiz-like rather than like teaching.
5. **Two completion engines, one column.** Legacy video/quiz/checkpoint path and the interactive-journey path both flip `TrainingAssignment.status`, with different rigor.
6. **Competing taxonomies.** `InstructorGrowthTier` (SPARK/PRACTITIONER/…) competes with the official Instructor/Senior/Lead ladder.
7. **Dead/half-built bits.** `student-training` route, `content.v1.legacy-archive.json`, `TODO(M3)` DAG in `JourneyPlayer`, `MatchPairs` placeholder visual.

---

## 2. Educational Critique

Mapping current content against the role framework and the 12 instructor competencies:

| Competency / GOAL | Covered today? | Where |
|---|---|---|
| Understand YPP's mission | ✅ | `ypp-standard.ts` |
| **Design a good course** | ❌ in training | Lives only in Lesson Design Studio capstone — not *taught* first |
| Plan a session | ✅ | `run-a-great-session.ts` |
| Teach younger students / age-adapt | ⚠️ thin | implied, no explicit differentiation |
| Keep students engaged | ✅ | `student-situations.ts` |
| Handle different skill levels | ❌ | not an explicit topic |
| Manage behavior respectfully | ⚠️ partial | `student-situations.ts` |
| Use activities not lecture | ⚠️ partial | `run-a-great-session.ts` |
| Communicate professionally | ✅ | `communication-reliability.ts` |
| Prepare materials | ⚠️ thin | only the prep sequence in readiness check |
| Reflect & improve after teaching | ⚠️ | only via ungated reflection beats |
| **What makes an excellent YPP Instructor** | ⚠️ | implied, never named via the rubric |
| **GOAL 4 — Community Involvement** | ❌ | nonexistent |
| **GOAL 5 — Long-Term Growth / ladder** | ❌ | nonexistent |

**Teaches well:** session arc, student support loop, professional messaging, reliability norms (24-hr response, 100% meeting attendance), red-flags/escalation. Content voice is concrete and YPP-specific.

**Fails to teach / missing:** course **design** as a pre-taught skill (differentiation, learning goals, activity design, age-adaptation, materials prep); the **excellence bar** named explicitly via the GOAL-1 Instructor rubric; **GOAL 4** (collaborative culture, events/trainings, building relationships with staff/mentors) and **GOAL 5** (openness to feedback, expanded responsibilities, the promotion path).

**Merge:** fold the family/parent half of `communication-reliability.ts` into **GOAL 2 (Student & Family Relationships)**; keep the punctuality/responsiveness/admin half in **GOAL 3 (Organization, Commitment & Reliability)**.

**Rewrite:** `ypp-standard.ts` → **Welcome / Role Mission** (mission line, what makes YPP different, the Instructor role, the ladder preview). `readiness-check.ts` → reframe as a **G&R-aligned capstone** that checks judgment across Goals 1–3 and confirms expectations for 4–5.

**Add:** a **GOAL 1 design block** (learning goals, activity-over-lecture, differentiation/age-adaptation, materials prep) feeding the Studio; **GOAL 4** orientation; **GOAL 5** growth orientation + ladder.

**Remove:** nothing from the engine. Deprecate legacy video/quiz/checkpoint modules from the *required* path.

---

## 3. Proposed New Training Architecture

**Seven sections. One roadmap. ~45–55 min before the Studio capstone.** Replaces "Deliver → Prove → Design" phases with a **GOAL-mirrored pathway**. Sequential unlock by `sortOrder` (reuse `computeModuleUnlockState`).

| # | Section (contentKey) | GOAL | Depth | ~min | Teaches (Instructor column) | Checkpoint / activity |
|---|---|---|---|---|---|---|
| 0 | **Welcome to YPP** `academy_welcome_000` | Role Mission | Orientation | 5 | Mission line; what makes YPP different; the Instructor role; **the Instructor → Senior → Lead ladder**; how the 5 GOALS work | CONCEPT_REVEAL + one REFLECTION ("why you're here"); **ungraded** |
| 1 | **GOAL 1 — Curriculum & Class Delivery** `academy_goal1_delivery` | 1 | **Deep** | 12 | Organized, engaging, approved-curriculum classes; learning goals; **activities over lecture**; **differentiation & age-adaptation**; materials prep; adapting to classroom dynamics; the session arc | SORT_ORDER (session arc) + SCENARIO_CHOICE (differentiation) + SPOT_THE_MISTAKE (lecture-heavy plan) + COMPARE (weak vs strong recap). **Scored, 80%** |
| 2 | **GOAL 2 — Student & Family Relationships** `academy_goal2_relationships` | 2 | **Deep** | 10 | Supportive, inclusive classroom; responsive **professional family communication**; advising students toward more YPP; the student-support loop | BRANCHING_SCENARIO (confused/disengaged student) + MESSAGE_COMPOSER (parent update) + MULTI_SELECT (inclusive-environment moves). **Scored, 80%** |
| 3 | **GOAL 3 — Organization, Commitment & Reliability** `academy_goal3_reliability` | 3 | **Deep** | 8 | **Respond within 24 hrs**; **100% meeting/class attendance**; prepared & on time; reliable admin/task completion; proactive on issues | SCENARIO_CHOICE (you'll miss a session) + MESSAGE_COMPOSER (running late) + SORT_ORDER (pre-class prep) + SPOT_THE_MISTAKE (tone). **Scored, 80%** |
| 4 | **GOAL 4 — YPP Community Involvement** `academy_goal4_community` | 4 | **Light** | 5 | Positive, collaborative culture; relationships with instructors/mentors/staff beyond the minimum; participating in events/trainings; **how this grows toward Senior** | CONCEPT_REVEAL + MULTI_SELECT (what contributing looks like) + REFLECTION (one way you'll contribute). **Submission-gated, ungraded** |
| 5 | **GOAL 5 — Long-Term Growth & Increased Involvement** `academy_goal5_growth` | 5 | **Light** | 5 | Openness to feedback; contributing beyond core teaching; the **promotion ladder** and what Senior/Lead look like; how G&R reviews work | CONCEPT_REVEAL (ladder) + COMPARE (Instructor vs Senior behaviors) + REFLECTION (your 3-month growth goal). **Submission-gated, ungraded** |
| 6 | **Readiness Check** `academy_readiness_capstone` | Capstone | Scored gate | 9 | Applied judgment across Goals 1–3; confirms expectations for 4–5 | Mixed beats; one attempt each; **80% gates the Lesson Design Studio** |

**Then:** Readiness Check pass → **Lesson Design Studio** capstone (`/instructor/lesson-design-studio?entry=training`, unchanged gate) → curriculum review + **offering approval (requires APPROVED, not just SUBMITTED)** → cleared to teach.

**Recommended order rationale (surfaced to the learner):** mission first (why) → deliver a great class (Goal 1, the core craft) → the people you serve (Goal 2) → the reliability that makes you trustable (Goal 3) → the community you join (Goal 4) → where you're headed (Goal 5) → prove it (Readiness) → build it (Studio). Each card shows a one-line **outcome statement** drawn from the GOAL's Instructor rubric.

---

## 4. Visual Redesign Plan

**Principle:** one cohesive "Academy" signature shared by hub, player, and completion. Keep the existing token system and hero physics; remove inconsistency and the checklist feel.

- **Hub (`/instructor-training` + Launchpad Step 3):** keep the **Current-Task Hero + Progress Ring**. Replace the 3-phase `PhaseMap` with a **GOAL roadmap/stepper**: a vertical-on-mobile / horizontal-on-desktop **pathway of 7 nodes** (Welcome, G1–G5, Readiness) each as a `TrainingGoalCard` with: GOAL name, one-line outcome, est. minutes, state (Locked / Ready / In Progress / Complete), and an **earned GOAL badge** on complete. Studio capstone is the final, distinct node.
- **Kill the inline-hex banners** in `app/(app)/instructor-training/page.tsx` → a single `TrainingBanner` component using design tokens (`--ypp-purple-*`, `--surface`, status variants), not raw hex.
- **Module page (`/training/[id]`):** `JourneyIntro` shows GOAL name, "why this matters," the **Instructor-column outcome it builds toward**, est. time, beat count. `TrainingLessonShell` gives every journey one frame (progress, back-to-roadmap, GOAL accent hue).
- **Progress UI:** overall ring + per-GOAL completion; "~N min to teach-ready" momentum chip (already exists, keep). Add a **5-GOAL coverage meter** ("You've built skills across 4 of 5 goals").
- **Completion states:** per-GOAL badge pop (`ConfettiBurst`, reduced-motion-safe) + a **TrainingCompletionPanel** at full completion that states the **role mission in the instructor's own framing** and **introduces the ladder** ("You're an Instructor. Here's the path to Senior."). Optional lightweight **certificate** (printable, reuses Studio print pattern).
- **Empty/loading:** adopt existing `components/empty-state.tsx` + `loading-states.tsx` consistently on hub, player, admin triage.
- **Mobile:** roadmap collapses to a single vertical spine; hero stacks (already handled at `max-width:720px`); ensure tap targets ≥44px on `TrainingGoalCard` CTAs.
- **Framer Motion opportunities (additive only):** staggered roadmap-node entrance; node check-in on return (`?from=` already plumbed); GOAL-badge pop; subtle hue cross-fade when the active GOAL changes; respect `prefers-reduced-motion` + the user motion preference already in the codebase.

---

## 5. Cohesion Plan

- **Onboarding ↔ Training:** already unified (`instructor-onboarding/page.tsx` reuses `getTrainingHomeModel`). **Rename framing** consistently to "Instructor Academy" and the 7-GOAL roadmap so Launchpad Step 3 and the standalone hub read identically.
- **Training ↔ Curriculum builder (Lesson Design Studio):** keep the `lesson-design-studio-gate.ts` single-source gate. **GOAL 1** explicitly previews the Studio ("you'll design this for real next") so the capstone feels earned, not bolted on.
- **Training ↔ Instructor profile / readiness:** on completion, upsert `TrainingAssignment.status = COMPLETE` (unchanged spine) so dashboard, `readinessScore`, and publish gates work. Surface a **"Academy complete · 5 GOALS"** chip on the instructor profile.
- **Training ↔ G&R / growth system (the real win):** the 5 training GOALS are **the same 5 G&R goals** the portal already reviews against (`lib/gr-actions.ts`, `lib/goal-review-actions.ts`, `lib/growth-model.ts`, `lib/leadership-pathway.ts`). Wire training so completing **GOAL n** seeds/links the instructor's **G&R Goal n** baseline, and **GOAL 5** introduces the same promotion ladder used by `PromotionRecommendation`. **Standardize vocab:** retire `InstructorGrowthTier` whimsical names from training UI; map the four `InstructorGrowthCategory` values (TEACHING/GROWTH/COMMUNITY/IMPACT) to the official GOAL language in any shared surface.
- **Training ↔ action tracker / admin:** extend `app/(app)/admin/training/learner-progress.tsx` into a **cohort triage** view (Not started / In progress / Stuck / Passed / Awaiting Studio review) and surface **training evidence** (per-GOAL pass, journey `scorePct`, "topics to probe" from high-retry beats, Studio rubric) on the **applicant detail + chair queue** so reviewers/chairs see readiness against the same 5 GOALS.

---

## 6. Component Plan

Rename/replace the "phase" components with GOAL-framed ones (keep the engine + hero):

| Component | Responsibility | Status |
|---|---|---|
| `TrainingAcademyShell` | Page frame, rail, milestones | **Exists** — relabel phases→GOALS |
| `TrainingHome` (→ keep name) | Mission control: hero + roadmap + momentum | **Exists** — swap `PhaseMap` for roadmap |
| `CurrentTaskHero` | One actionable task + ring | **Exists** — keep as-is |
| `TrainingGoalRoadmap` | 7-node GOAL stepper/roadmap | **New** (replaces `phase-map.tsx`) |
| `TrainingGoalCard` | One GOAL node: name, outcome, state, badge | **New** (replaces `phase-module-rows.tsx`) |
| `TrainingBanner` | Token-based status banners | **New** (replaces inline-hex banners) |
| `TrainingLessonShell` | Single frame around every journey | **New** (wraps `JourneyPlayer`) |
| `JourneyPlayer` + 12 beats | Interactive lesson runtime | **Exists** — keep |
| `TrainingCheckpoint` | Per-GOAL scored/submission gate | **Exists** as beats — formalize naming |
| `TrainingReflectionPrompt` | Reflection beat (submission-gated) | **Exists** (`beats/Reflection.tsx`) — gate it |
| `TrainingCompletionPanel` | Final state: mission framing + ladder + certificate | **New** (extends `JourneyComplete`) |
| `InstructorReadinessScore` | Readiness summary chip/widget | **Exists** (`instructor-readiness-widget.tsx`) — reuse |
| `AdminTrainingReviewPanel` | Cohort triage + per-GOAL evidence | **Extend** `learner-progress.tsx` |
| `GoalBadge` | Earned per-GOAL badge | **New** (small, celebratory) |

---

## 7. Data Model Plan

**Migration-light. Reuse existing models; add fields only where the GOAL framework needs them.**

- **`TrainingModule`**: add `goalKey String?` (enum-like: `WELCOME | GOAL_1 … GOAL_5 | CAPSTONE`) + `outcomeStatement String?` (the Instructor-column one-liner shown on the card). Drives the roadmap grouping without a new table.
- **User progress:** unchanged — keep `TrainingAssignment` + `InteractiveJourneyCompletion` as the source of truth. Derive per-GOAL completion from `module.goalKey`.
- **Reflections:** no new model — store as `InteractiveBeatAttempt` on REFLECTION beats; enforce **non-empty submission as a completion gate** in `completeInteractiveJourney` (WS1 PR-2 — already designed).
- **Completion status:** keep `TrainingAssignment.status`; declare **interactive-journey canonical**; classify video/quiz/checkpoint modules as **legacy/deprecated** (computed from `type` + `required`, no schema change).
- **Studio capstone semantics:** narrow `studioCapstoneComplete` to **`APPROVED`** (add `studioCapstoneInReview` for SUBMITTED) in `lib/instructor-readiness.ts`.
- **Admin feedback / evidence:** no new model — aggregate `InteractiveJourneyCompletion` (per-GOAL `scorePct`), `InteractiveBeatAttempt` (high-retry "topics to probe"), and the Studio `reviewRubric` into a `TrainingEvidence` read-shape for reviewer surfaces.
- **Readiness score:** keep `InstructorProfile.readinessScore`; ensure it's recomputed from canonical completion only.
- **Certificates/badges:** add a small `goalBadges Json?` (or derive entirely from per-GOAL completion — **prefer derived, no column**). Certificate is render-only (print), no persistence required for v1.
- **Vocabulary standardization:** do **not** add a new tier enum. Reference the official ladder via existing `PromotionRecommendation`; suppress `InstructorGrowthTier` whimsical names in training UI via a label map, not a migration.

---

## 8. Broken / Incomplete Functionality Checklist

**Verified issues (from code + `phase-1-audit.md`):**
- [ ] **Inline-hex banners** in `app/(app)/instructor-training/page.tsx` — off-design-system. → `TrainingBanner`.
- [ ] **Quiz score client-trusted** in `submitTrainingQuizAttempt`. → *Fixed* (commit `a7db9b4`); verify no regressions.
- [ ] **Video completion client-asserted** (no watched-seconds). → Deprecate (videos not required).
- [ ] **Checkpoints disabled as a gate** but UI may imply they matter (`syncAssignmentFromArtifacts` "purely informational"). → Decide: re-gate or remove UI.
- [ ] **Studio capstone passes on SUBMITTED, not APPROVED.** → Require APPROVED; add "in review."
- [ ] **Reflection beats ungated.** → Require non-empty submission (WS1 PR-2).
- [ ] **Two completion engines** flipping the same status column. → Declare journey canonical.
- [ ] **`student-training` vestigial route** + dual revalidations. → Confirm-unused grep, then remove behind its own PR.
- [ ] **`data/training-academy/content.v1.legacy-archive.json`** in repo. → Move to `output/` or delete.
- [ ] **`TODO(M3)` parentBeatId DAG** in `JourneyPlayer.tsx`. → Backlog (low).
- [ ] **`MatchPairs` placeholder visual.** → Polish when touched.

**To verify during Phase 1 (buttons/routes I flagged but did not exhaustively click-test):**
- [ ] Hub "review" collapse button (`phaseReviewBtn`) and roadmap node CTAs route correctly in every state.
- [ ] "Go to your dashboard" (`href="/"`) on the done state — confirm correct destination per role.
- [ ] Legacy-module CTAs on the hub (if any legacy modules still present) don't dead-end.
- [ ] Readiness link + capstone unlock CTA behave when Readiness Check is incomplete vs passed.
- [ ] Summer-workshop / promoted-from-workshop banner CTAs.

---

## 9. Implementation Roadmap

Each phase is a small, shippable PR set. **Do not** rewrite the engine.

- **Phase 1 — Audit & cleanup (foundation):** confirm `student-training` unused & remove; move/delete legacy archive JSON; extract repeated `revalidatePath` chains; add `goalKey`/`outcomeStatement` to `TrainingModule` (one migration); disambiguate the two "readiness" concepts in code.
- **Phase 2 — Information architecture:** author the **7 GOAL-mirrored curricula** in `lib/training-curriculum/` (rewrite `ypp-standard`→Welcome; split `communication-reliability` across Goals 2/3; add Goal 1 design block, Goal 4, Goal 5; reframe `readiness-check`). Update `index.ts` registry + `sortOrder`/`goalKey`. Run `training:validate` + `training:sync`.
- **Phase 3 — Visual redesign:** `TrainingGoalRoadmap`, `TrainingGoalCard`, `TrainingBanner`, `TrainingLessonShell`, `TrainingCompletionPanel`, `GoalBadge`; relabel shell/home; adopt empty/loading states; motion polish.
- **Phase 4 — Educational content rewrite:** deepen Goals 1–3 beats (differentiation, age-adaptation, materials, activity-over-lecture); light Goals 4–5 with ladder preview; align all microcopy to the canonical vocabulary.
- **Phase 5 — Progress/completion system:** declare journey canonical; gate reflections; narrow Studio capstone to APPROVED; derive per-GOAL completion + badges; certificate render.
- **Phase 6 — Admin visibility:** cohort triage in `learner-progress.tsx`; **training-evidence card** (per-GOAL pass, scorePct, topics-to-probe, Studio rubric) on applicant detail + chair queue.
- **Phase 7 — QA & polish:** Vitest for new curricula + completion gating; Playwright smoke for full academy run; a11y ≥95 on hub/player/completion; keyboard ops on every beat; `nav:check`.

---

## 10. Risks & Anti-Bloat Guidance

- **Biggest risk: rebuilding what works.** Keep `lib/training-journey/*`, the 12 beats, the hero, the gate spine, and the import pipeline. This is a **content + IA + skin + integrity** project, not an engine rewrite.
- **Over-gamification:** retire the whimsical tier names; the official ladder (Instructor/Senior/Lead) **is** the motivation. One badge per GOAL + one certificate. No XP leaderboards in training. **No P/G/Y/R color rating on training** (it stays pass/complete; color ratings remain in interview/admin only).
- **Too long:** keep total to ~45–55 min before the Studio. Goals 4–5 stay light by design.
- **Surface sprawl:** do not add new routes — rebuild `/instructor-training` and `/training/[id]` in place; one viewer, one hub.
- **Taxonomy confusion:** standardize vocab via a label map, **not** new enums/migrations.
- **Simplest version that still feels excellent:** Welcome + 5 GOAL roadmap + Readiness capstone, one cohesive Academy skin, per-GOAL badges, a completion panel that names the mission and the ladder, honest completion, and admin evidence against the same 5 GOALS. That alone moves it from "polished checklist" to "guided instructor academy."

---

## Prioritized Action List

### Must fix now
1. Author the **7 GOAL-mirrored curricula** + register them (`lib/training-curriculum/*`, `index.ts`); deepen Goals 1–3, add Goals 4–5 (light) with the ladder.
2. Replace inline-hex banners → `TrainingBanner`; swap `PhaseMap` → `TrainingGoalRoadmap` + `TrainingGoalCard`; relabel all "phase" framing to the **5 GOALS** + official vocab.
3. Add `goalKey`/`outcomeStatement` to `TrainingModule` (one migration) + `training:sync`.
4. Completion integrity: declare journey canonical, **gate reflections**, narrow Studio capstone to **APPROVED**.

### Nice to have
5. `TrainingCompletionPanel` + per-GOAL `GoalBadge` + printable certificate.
6. Admin **cohort triage** + **training-evidence card** on applicant detail / chair queue.
7. Link each completed training GOAL to the matching **G&R goal** baseline.

### Future version
8. In-app curriculum/beat authoring UI; multi-level branching DAG (`TODO(M3)`); `MatchPairs` visual polish.
9. Post-onboarding **Community & Growth** deep track (full Goals 4–5) unlocked once teaching.
10. Retire `student-training` plumbing and legacy video path entirely once confirmed unused.

---

## Verification

- `npm run training:validate` then `npm run training:sync` — new curricula import cleanly (idempotent `sourceKey`s).
- `npm run typecheck && npm run lint && npm run test` — unit tests for new curricula, reflection gating, Studio-APPROVED semantics, per-GOAL completion derivation.
- `npm run test:e2e:smoke` (Playwright) — complete the full academy end-to-end (Welcome → G1–G5 → Readiness → Studio unlock) as a seeded instructor in ≤55 min, no video.
- Manual: hub + player + completion render with tokenized styling (no hardcoded hex), reduced-motion safe, mobile roadmap spine, a11y ≥95.
- `npm run nav:check` — no broken nav entries; verify every flagged button/route in §8.
- Admin: triage buckets populate; training-evidence card shows per-GOAL pass + scorePct on a seeded applicant.
