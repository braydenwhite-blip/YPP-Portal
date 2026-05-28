# Plan: Perfect the YPP Portal Mentorship System (Consolidation & Redesign)

## Context

The YPP Portal already has a **mature, feature-complete mentorship system** — pairings, monthly self-reflections, mentor goal reviews, chair approval chains, achievement points/awards, G&R living documents, support circles, and rich admin dashboards. The exact purple/green/yellow/red rubric already exists as enums.

It "sucks" not because features are missing, but because the **surfaces are fragmented and duplicated**, so no role has one clear home:

- **3 mentor surfaces**: `/mentorship`, `/mentorship-program`, `/mentor/*`
- **4 admin surfaces**: `/admin/mentorship`, `/admin/mentorship-program`, `/admin/mentor-match`, `/admin/instructor-mentor-matching`
- **Scattered mentee surface**: `/my-mentor`, `/mentorship` (mentee tab), `/mentorship-program`, `/leadership-pathway`
- **Duplicate/legacy models**: `MonthlyGoalReview` (deprecated) vs `MentorGoalReview`; `Goal`/`MentorshipProgramGoal`/`CustomGoal`/`GRDocumentGoal`

**This plan consolidates the system into three distinct, clean experiences (Admin / Mentee / Mentor), reusing all existing data models and business logic.** No new tables. Advanced concepts (points, awards, committees, streaks, G&R) stay visible. Scope = **instructor + global-leadership/chapter-president lanes**; the student lane stays gated off (`SHOW_STUDENT_MENTORSHIP_LANE`).

Goal: each role lands on ONE page that answers "what do I need to do?" — admins see program health, mentors see who needs action, mentored instructors see goals/support/next steps.

---

## 1. Executive Summary

- **Problem**: duplicated, scattered mentorship surfaces; no single command center per role.
- **Approach**: pick ONE canonical route per experience, fold the duplicates into it, redirect deprecated routes, retire deprecated data models. Reuse existing actions/components.
- **Outcome**: three polished experiences — Admin command center (`/admin/mentorship`), Mentor workspace (`/mentorship`), Mentee home (`/my-mentor`) — built on the existing schema.
- **Risk profile**: low–medium. The hard logic exists and is tested; the work is IA consolidation, route redirects, UX, and dead-code removal.

## 2. Current State Audit

### Mentorship-related functionality that exists (reuse)
- **Schema** (`prisma/schema.prisma`): `Mentorship` (2645), `MentorshipCheckIn` (2693), `MentorshipSession` (2730), `MentorshipCircleMember` (2706), `MentorshipRequest` (2836), `MentorshipResource` (2889), `MonthlySelfReflection` (8950), `MentorGoalReview` (9012), `GoalReviewRating` (9083), `GRDocument`/`GRDocumentGoal` (10161/10192), `AchievementPointSummary`/`Log` (9106/9121), `AwardNomination` (9140), `MentorCommittee`/`Member` (3336/3353), `QuarterlyCommitteeReview` (3447), `MentorshipTrack` (3305), `MentorshipProgramGoal` (8929).
- **Rubric enums**: `ProgressStatus` (541) and `GoalRatingColor` (583) = RED (BEHIND_SCHEDULE) / YELLOW (GETTING_STARTED) / GREEN (ACHIEVED) / PURPLE (ABOVE_AND_BEYOND). **The requested framework already exists — do not invent a new one.**
- **Actions/libs** (~30 files): `lib/mentorship-access.ts`, `lib/mentorship-chair-access.ts`, `lib/mentorship-kanban-actions.ts`, `lib/mentor-overview.ts`, `lib/admin-mentorship-command-center.ts`, `lib/goal-review-actions.ts`, `lib/mentorship-gr-binding.ts`, `lib/mentor-matching.ts`, `lib/mentorship-canonical.ts` (point/award thresholds), `lib/mentorship-scheduling-actions.ts`, `lib/mentorship-program-actions.ts`, `lib/incubator-actions.ts`.
- **Components**: `components/mentorship/*` (9: goal-review-form, check-in-panel, cycle-status-block, deadline-chip, review-spine, goal-trajectory, awards-summary-panel, ai-coaching-sidebar, kickoff-status-row); `components/leadership-pathway/*` (mentor-card, mentees-overview); `app/(app)/mentorship/_components/*` (mentor-priority-list, mentor-command-center, mentee-dashboard, mentorship-tab-shell, empty-state-editorial).

### Admin-facing pieces that exist
- `/admin/mentorship` (mature, tabbed: Pulse, Needs Action, Unassigned, Workload, G&R, Check-ins, Approvals, Goals, Committees) — **keep as canonical**.
- `/admin/mentorship-program` (focus modes: queue/matching/staffing/governance; panels: matching, mentee-matching-board, pairings, chairs, goals, goal-reviews-board, review-approvals-board, analytics; GR sub-pages: gr-assignments, gr-templates, gr-resources).
- `/admin/mentor-match`, `/admin/instructor-mentor-matching` (drag-drop assignment boards). **Overlap heavily with each other and with the program matching panel.**

### Mentor-facing pieces that exist
- `/mentorship` (role-aware via `MentorshipTabShell`; mentor kanban/command strip/engagement) — **keep as canonical mentor home**.
- `/mentorship-program` + children (reviews, schedule, chair, awards, quarterly, chair/prep-packet) — structured program workflow.
- `/mentor/*` (incubator, feedback, ask, resources) — mentor utilities, plus incubator project review.

### Instructor (mentee)-facing pieces that exist
- `/my-mentor` (mentor card + mentees overview, from `getLeadershipContext`).
- `/mentorship` mentee tab (`MenteeDashboard`).
- `/mentorship-program/reviews`, `/schedule` (mentee reflection/scheduling).
- `/leadership-pathway` (stage progression).

### Unfinished / confusing / duplicated / risky
- **Duplicated matching UIs**: `/admin/mentor-match` vs `/admin/instructor-mentor-matching` vs program `matching-panel.tsx`/`mentee-matching-board.tsx`.
- **Three mentor entry points** create "which page do I use?" confusion; mentor reviews/schedule live under `/mentorship-program` while the mentor dashboard lives under `/mentorship`.
- **Mentee surface split** across 3–4 routes.
- **Legacy models still referenced**: `MonthlyGoalReview`, `ReflectionForm`, `ReflectionSubmission` (superseded by `MentorGoalReview` / `MonthlySelfReflection`); multiple goal models.
- **Risk**: consolidation must preserve chair-approval routing, point/award calculation on approval, and `canAccessMentorship`/lane gating.

### Reuse vs. redesign verdict
- **Reuse as-is**: all schema, all lib actions, rubric enums, kanban/command-center data builders, goal-review form, scheduling, points/awards, G&R binding.
- **Redesign (IA/UX only)**: route structure, navigation, page composition, empty states, what's surfaced vs tucked away.
- **Retire**: duplicate matching routes; deprecated models after callers migrate.

## 3. Core Product Vision

A clear command center where every user sees exactly what they need:
- **Admins** see the health of the whole program and act only where flagged.
- **Mentors** see who they help and the single next action per mentee.
- **Mentored instructors** see their mentor, goals, resources, and next steps — supportive, never punitive.

Built entirely on the existing engine; the change is consolidation, IA, and tone — not new mechanics.

## 4. User Types and Jobs to Be Done

| User | Primary route | Job to be done |
|---|---|---|
| Admin (`ADMIN` + `MENTORSHIP_ADMIN`/`SUPER_ADMIN`) | `/admin/mentorship` | Oversee program health, assign/reassign mentors, resolve flags, manage templates |
| Mentor (`MENTOR`, or instructor/CP mentoring others) | `/mentorship` | See mentees, complete monthly review, set color status, assign goals/resources, flag concerns |
| Mentored instructor / leader (mentee) | `/my-mentor` | See mentor, goals, resources, next steps; submit reflection; request help |
| Chair (committee chair) | `/mentorship/chair` (under mentor workspace) | Approve mentor reviews for their lane |
| Dual-role user | both, cross-linked | Switch between "being mentored" and "mentoring" without confusion |

Lanes in scope: **INSTRUCTOR** and **CHAPTER_PRESIDENT / GLOBAL_LEADERSHIP**. Student lane stays hidden via existing gate.

## 5. Admin Experience Plan — canonical `/admin/mentorship`

Keep the existing tabbed dashboard (`app/(app)/admin/mentorship/page.tsx`) and **absorb** the other three admin trees as tabs/panels. Final tab set:

1. **Overview / Pulse** (exists) — KPIs + rating-distribution fairness check (reuse `admin-mentorship-command-center.ts`).
2. **Needs Attention** (exists) — unified queue: unmatched, missing G&R, overdue check-ins, stalled goals, pending approvals, flags.
3. **Assignments** — merge `/admin/mentor-match` + `/admin/instructor-mentor-matching` + program `matching-panel`/`mentee-matching-board` into ONE board. Reuse `lib/mentor-matching.ts`.
4. **Capacity / Workload** (exists) — mentor load matrix (soft cap 3).
5. **Approvals** (exists) — goal-review + monthly-review chair boards.
6. **Goals & Resources Templates** — fold program `goals-panel` + `gr-templates`/`gr-resources`/`gr-assignments`.
7. **Committees & Chairs** (exists) — chair assignments per lane.
8. **Analytics** — fold program `analytics-panel`.

For each tab define: purpose, primary data, primary actions, empty state, filters (lane/status/mentor/mentee/activity), permission (subtype gating via `lib/admin-capabilities.ts`), and what NOT to show (hide raw streak internals here).

## 6. Mentored Instructor Experience Plan — canonical `/my-mentor`

Make `/my-mentor` the single mentee home (rename surface concept to "My Mentorship"). Relocate `MenteeDashboard` content here from `/mentorship`. Sub-pages:

- **My Mentor** (home) — mentor card (reuse `components/leadership-pathway/mentor-card.tsx`), why I'm in mentorship, next check-in, current color status shown supportively.
- **My Goals** — from `GRDocumentGoal` / `MentorshipProgramGoal`; supportive framing.
- **My Resources** — `MentorshipResource` / `GRDocumentResource`.
- **My Progress** — `goal-trajectory.tsx` + released review history (only `releasedToMenteeAt` content).
- **My Reflection** — `MonthlySelfReflection` submission (move from `/mentorship-program/reviews`).
- **Ask / Request Help** — `MentorshipRequest` (move from `/mentor/ask`).

For each: purpose, info shown, actions, **tone** (encouraging), what feedback is visible (only released/mentee-visible fields), what stays private, empty states, how to avoid feeling punitive (language for color statuses).

## 7. Mentor Experience Plan — canonical `/mentorship`

Keep `/mentorship` as the mentor workspace (existing mentor kanban/command strip is strong). **Absorb** `/mentorship-program/*` and `/mentor/*` as children:

- **Dashboard** (exists) — command strip + priority list + engagement panels (reuse `mentorship-kanban-actions.ts`, `mentor-overview.ts`).
- **My Mentees** + **Mentee Detail** (`/mentorship/mentees`, `/mentees/[id]`, `/mentees/[id]/gr` exist).
- **Monthly Review** — `goal-review-form.tsx` (move from `/mentorship-program/reviews/[reflectionId]`).
- **Schedule** — `mentorship-scheduling-actions.ts` (from `/mentorship-program/schedule`).
- **Resources** — recommend `MentorshipResource` (from `/mentor/resources`).
- **Ask / Flag** — `MentorshipRequest` + admin flag (from `/mentor/ask`, `/mentor/feedback`).
- **Awards** — `awards-summary-panel.tsx` (from `/mentorship-program/awards`).
- **Chair** — chair approval queue for chairs only (from `/mentorship-program/chair`), gated by `lib/mentorship-chair-access.ts`.
- **Incubator** — keep `/mentor/incubator` linked but distinct (it's project mentoring, not the monthly loop).

For each: purpose, info, actions, required vs optional fields, editable vs view-only, what triggers an admin flag (e.g., RED status), how to keep check-ins fast.

## 8. Role and Permission Model

Reuse existing primitives — **do not add roles**:
- `RoleType` (ADMIN, INSTRUCTOR, MENTOR, CHAPTER_PRESIDENT, STAFF, …), `AdminSubtype` (`MENTORSHIP_ADMIN`, `SUPER_ADMIN`).
- Guards: `canAccessMentorship` (`lib/mentorship-access.ts`), `getMentorshipAccessibleMenteeIds`, `hasMentorshipMenteeAccess`, `isChairForLane` (`lib/mentorship-chair-access.ts`), `canAccessAdminRoute` (`lib/admin-capabilities.ts`).

Access matrix (view/edit/create/never-see) per role for: relationships, reviews, ratings, resources, flags, templates, private notes. Edge cases to handle explicitly: mentor who is also a mentee (cross-link both homes), instructor with no mentor yet (empty states), mentor leaving YPP (reassign flow), over-capacity mentor (capacity tab warning), mentee changing mentors (reassign reason, private), mentee exiting mentorship (status COMPLETED), RED mentee (auto-flag), multi-role user (lane-aware routing via `primaryRole`).

## 9. Proposed Data Model — REUSE existing; no new tables

Map the prompt's requested entities onto what exists:

| Requested | Existing model | Notes |
|---|---|---|
| Mentorship Relationship | `Mentorship` (2645) | status, kickoff, cycle stage, streaks already present |
| Monthly Check-In | `MentorGoalReview` (9012) + `MonthlySelfReflection` (8950) + `MentorshipCheckIn` (2693) | mentor review carries color status, comments, plan-of-action, mentee-visible release |
| Goal | `GRDocumentGoal` (10192) (preferred) / `MentorshipProgramGoal` (8929) templates | use `GRDocumentGoal` for instances |
| Resource Recommendation | `MentorshipResource` (2889) / `GRDocumentResource` | already supports visibility/tags |
| Admin Flag | `MentorshipRequest` (2836) + `WorkflowItem` | kind/visibility/status/assignee already modeled |

**Schema change = minimal/none.** Only candidate additions if a gap is confirmed during build: a dedicated `severity`/`flag` enum value on `MentorshipRequest` if flags aren't first-class. **Migration cleanup (separate, careful step):** retire `MonthlyGoalReview`, `ReflectionForm`, `ReflectionSubmission` and the redundant goal models AFTER all callers move to `MentorGoalReview`/`MonthlySelfReflection`/`GRDocumentGoal` — do NOT drop tables in V1; mark deprecated and migrate callers first.

## 10. Purple / Green / Yellow / Red Framework — already exists, standardize the language

Use `ProgressStatus`/`GoalRatingColor`. Centralize labels/colors/copy in one place (extend `lib/mentorship-canonical.ts`) so every surface renders consistently:
- **Purple** (ABOVE_AND_BEYOND) — exceptional; leadership/mentor candidate.
- **Green** (ACHIEVED) — on track.
- **Yellow** (GETTING_STARTED) — needs attention/support.
- **Red** (BEHIND_SCHEDULE) — serious concern; **auto-creates an admin flag**.
Colors: Red #ef4444, Yellow #f59e0b, Green #22c55e, Purple #a855f7. For each: meaning, example, mentor action, admin action, **supportive mentee-facing wording**, flag trigger (RED), dashboard rollup (reuse Pulse fairness check). Keep mentee-facing copy encouraging.

## 11. Monthly Mentorship Workflow (lightweight, already supported by cycles)

Reuse cycle machinery (`cycleMonth`/`cycleNumber`, `cycle-status-block.tsx`, `review-spine.tsx`, cron `mentorship-cycle-rollover`):
1. Mentee submits `MonthlySelfReflection`.
2. Mentor completes `MentorGoalReview` (color status + per-goal ratings + plan of action + 1–3 resources).
3. Chair approves (lane-gated) → points/awards calculated → released to mentee.
4. Mentee sees a simple released summary + next steps.
5. Admin Needs-Attention surfaces overdue/flagged only.
Missed check-in → overdue flag; YELLOW/RED → attention + (RED) admin flag; PURPLE → award nomination eligibility; COMPLETED → exit flow.

## 12. Navigation and UX Plan

Update `lib/navigation/*` so each role sees ONE mentorship entry, role-labeled:
- **Admin nav**: "Mentorship" → `/admin/mentorship` (tabs inside).
- **Mentor nav**: "Mentorship" → `/mentorship` (Dashboard / My Mentees / Reviews / Schedule).
- **Mentee nav**: "My Mentorship" → `/my-mentor` (My Mentor / Goals / Resources / Progress).
- Hide all mentorship nav when `canAccessMentorship` is false.
- Dual-role: show both entries, each cross-linking the other (banner on `/mentorship` → "You're also being mentored → My Mentorship").
Relevant files: `lib/navigation/instructor-v1-nav-layout.ts`, `lib/navigation/resolve-nav.ts`, allowlists, `lib/navigation/admin-primary-nav-filter.ts`. Match existing CSS system (`app/globals.css`: `.card`, `.kpi`, `.button`, `.topbar`, `.badge`; no Tailwind). Reuse `components/empty-state.tsx` and `empty-state-editorial.tsx`.

## 13. Privacy and Visibility Rules

- **Mentee-visible**: mentor identity, current goals, recommended resources, released review summary (`releasedToMenteeAt`), next steps, upcoming check-in.
- **Mentor-visible**: assigned mentee profile, goals, resources, full review/check-in history, status history, chair guidance.
- **Admin-visible**: everything — flags, private notes, mentor performance, reassignment history, analytics.
- **Never mentee-visible**: unreleased mentor drafts, private admin/chair notes, reassignment reasoning, pre-review concern notes, `InstructorNote` with `visibility=PRIVATE`.
Enforce in data fetchers (filter by release/visibility), not just UI.

## 14. Phased Build Roadmap

**V1 — Must have (the consolidation):**
- Designate canonical routes; add redirects from `/mentorship-program/*` → `/mentorship/*`, `/mentor/*` → `/mentorship/*`, `/admin/mentorship-program|mentor-match|instructor-mentor-matching` → `/admin/mentorship?tab=…`.
- Move mentee content to `/my-mentor`; move mentor reviews/schedule/resources/ask into `/mentorship`.
- Merge the 3 matching UIs into the Assignments tab.
- Centralize rubric labels/colors/copy.
- Update navigation to one entry per role + dual-role cross-links.
- Acceptance: each role has exactly one mentorship home; no orphaned/duplicate routes; all existing actions still work; lane gating intact; student lane hidden.

**V2 — Should have:** capacity view polish, progress history, goal/resource templates UX, improved filters, reminder notifications, mentorship-completion flow, retire deprecated models (callers migrated).

**V3 — Nice to have:** deeper analytics, mentor quality score, automated resource suggestions (AI sidebar exists), training integration, mentee→mentor promotion pipeline.

For each phase: what/why/dependencies/risks/acceptance criteria (above).

## 15. Risks and Simplification Recommendations

- **Too many dashboards** → enforce one canonical route per role; redirect the rest.
- **Matching duplication** → single Assignments board.
- **Mentorship feels punitive** → supportive copy layer over the color rubric; mentee sees only released, encouraging summaries.
- **Admin manual overload** → Needs-Attention queue surfaces only exceptions.
- **Mentors forget check-ins** → reuse cron digests + overdue flags.
- **Privacy confusion** → enforce visibility in fetchers; explicit matrix (§13).
- **Role confusion** → lane-aware routing via `primaryRole`; dual-role cross-links.
- **Regression risk during consolidation** → keep logic untouched, change only IA/UX; add redirects before deleting; rely on existing Vitest/Playwright suites.

## 16. Open Questions

- Should `/leadership-pathway` remain separate or merge into `/my-mentor`? (Proposed: keep separate, cross-link.)
- Should the incubator mentor workspace (`/mentor/incubator`) stay outside the consolidated mentor home? (Proposed: yes — different domain, just link it.)
- Confirm chair experience lives under `/mentorship/chair` vs. a dedicated route.
- Exact timing for dropping deprecated models (V2) — needs a caller-migration audit first.

## 17. Final Recommendation

Do the **V1 consolidation**: one canonical route per experience, redirect/retire the duplicates, relocate (don't rewrite) existing components, merge the matching UIs, and standardize the rubric copy. This fixes the actual problem (fragmentation) with minimal risk because the underlying engine is mature and tested. Keep all advanced concepts visible per scope. Defer model cleanup and analytics to V2/V3.

## Verification

1. **Run app**: `docker compose up -d` → `npm install` → `npm run db:migrate` → `npm run db:seed` → `npm run dev` (http://localhost:3000). Seeded accounts incl. `brayden.white@youthpassionproject.org` (Admin+Instructor), `avery.lin@…` (Instructor).
2. **Per-role walkthroughs**: log in as admin → `/admin/mentorship` shows all tabs incl. merged Assignments; mentor → `/mentorship` shows dashboard + reviews + schedule; mentee → `/my-mentor` shows mentor/goals/resources/progress.
3. **Redirects**: hit every deprecated route (`/mentorship-program/*`, `/mentor/*`, `/admin/mentor-match`, `/admin/instructor-mentor-matching`) → lands on canonical equivalent.
4. **Gating**: student/applicant/parent get no mentorship nav; student lane stays hidden.
5. **Rubric**: a RED rating auto-creates an admin flag and shows supportive mentee copy.
6. **Tests**: `npm run typecheck`, `npm run test` (Vitest), `npm run test:e2e:smoke` (Playwright) — extend `tests/lib/mentorship-*.test.ts` for redirects and visibility filters.
