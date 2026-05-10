# Admin-Side Instructor Mentorship Audit

> Scope: admin-side operations for instructor mentorship.
> Status: audit pass produced 2026-05-10. Implementation pass in same branch.
> Mentorship is **instructor-only** at this stage. Student mentorship is out of
> scope and has been hidden / relabeled on admin surfaces where safe. The
> Prisma `MentorshipType.STUDENT`, `MentorshipProgramGroup.STUDENT`, and
> `MentorshipGovernanceMode.CONNECTED_STUDENT` enum values remain so existing
> data and migrations are not disturbed.

## 1. Lifecycle map (admin perspective)

| Stage | Where it lives today | Server action / query | DB fields | Permission gate | Gaps |
| --- | --- | --- | --- | --- | --- |
| A. Instructor eligible | implicit — anyone with `INSTRUCTOR`/`CHAPTER_PRESIDENT`/`ADMIN`/`STAFF` primary role | `getAdminMentorshipCommandCenterData()` collects "potential mentees" | `User.primaryRole`, `User.roles[]` | none — admin page only | Eligibility is implicit. No explicit "needs mentor" status. |
| B. Admin assigns mentor | `/admin/mentorship-program?focus=matching` and `/admin/mentorship-program` staffing form | `assignProgramMentor` (admin only), `assignSupportCircleMember`, `approveMentorMatch` | `Mentorship` row created with `status=ACTIVE`, `programGroup`, `governanceMode`, `chairId`, kickoff session created | `requireAdmin()` on actions; page-level admin redirect | Reassignment requires manually ending old `Mentorship` then creating a new one. There is no single "reassign" action. |
| C. Goals & Resources created | mentee G&R doc surfaces under `/gr` and admin panel `gr-assignments` | `lib/gr-actions.ts` | `GRDocument`, `GRDocumentGoal`, `GRDocumentSuccessCriteria`, `GRDocumentResource`, `GRPlanOfAction`, `GRGoalChange` | mentor/mentee/admin via `requireGoalsAccess`-like helpers | Admin has no consolidated view of G&R completeness across instructor relationships. |
| D. Instructor reflections / progress | `/mentorship`, `/reflections` | `submitMonthlySelfReflection`, `addMentorshipCheckIn`, etc. | `MonthlySelfReflection`, `MentorshipCheckIn`, `ReflectionSubmission` | mentor + admin via `requireMentorOfUser` / role checks | Admin oversight is fragmented across approvals tab and reflection form admin page. |
| E. Mentor reviews / feedback | `/mentorship/reviews`, `/admin/mentorship-program` approvals tab | `saveGoalReview`, `submitMonthlyGoalReview`, `approveGoalReview`, `requestReviewChanges` | `MentorGoalReview`, `MonthlyGoalReview`, `GoalReviewRating` | mentor/admin/chair gates | Solid coverage. |
| F. Admin monitors health | `/admin/mentorship`, `/admin/mentorship-program` | `getAdminMentorshipCommandCenterData`, `getReviewCompletionStatus`, `getChairQueueEnriched` | various | admin redirect on pages | Page is dense and lane-based around STUDENT/INSTRUCTOR/LEADERSHIP. With student mentorship out, the lane structure adds noise. |
| G. Admin handles overdue / stalled | "watchlist" section + `cadenceRiskItems` in command center | `getAdminMentorshipCommandCenterData` derives stale relationships (>21d) | `MentorshipSession`, `MentorshipActionItem.dueAt`, latest review status | admin only | No overdue check-in queue, no stalled goal queue, no “last self-reflection submitted” bucket. |
| H. Admin reassigns mentor | Effectively `endProgramMentorship` followed by `assignProgramMentor` | `endProgramMentorship`, `assignProgramMentor` | `Mentorship.status`, `Mentorship.endDate`, `MentorshipCircleMember.isActive` | admin only | No single action that transfers mentee to a new mentor in one step. No audit trail of reassignment reason in `Mentorship`. |
| I. Relationship completes / pauses | `endProgramMentorship` accepts `status` formData (defaults to `COMPLETE`) | `endProgramMentorship` | `Mentorship.status` (`ACTIVE` / `PAUSED` / `COMPLETE`) | admin only | UI offers no quick "Pause" or "Complete" control on relationship cards. |

## 2. Admin routes / pages inventory

| Route | What it does | Access | Loads | Student-mentorship assumption? | Score | Needed fix |
| --- | --- | --- | --- | --- | --- | --- |
| `/admin/mentorship` | Tabbed pulse / approvals / pairings / goals / committees | `roles.includes("ADMIN")` redirect to `/` | KPI counts, pairings grouped by mentor, goal reviews, monthly reviews, goal templates, chairs | Mostly neutral — pulse & pairings are mentor/relationship oriented | YELLOW | Header/copy is generic; needs an "instructor mentorship" framing. Add explicit unassigned-instructor + needs-attention surfaces. |
| `/admin/mentorship-program` | Big "Command Center" with population lanes (Students/Instructors/Leadership), watchlist, matching, staffing, governance | `roles.includes("ADMIN")` redirect to `/` | Command-center bundle, governance forms, kanban boards | YES — heavy student lane + "students" copy | YELLOW | Hide / collapse the Students lane while only instructor mentorship is launched. Default lane to Instructors. Update intro copy. |
| `/admin/mentor-match` | Redirect to `/admin/mentorship-program?focus=matching` | role-agnostic at file level (action target gates) | n/a | none | GREEN | Add admin gate before redirect. |
| `/admin/goals` | Goal templates and bulk role assignment | `roles.includes("ADMIN")` redirect to `/` | `GoalTemplate`, users, chapters | none directly | GREEN | Lists `STUDENT` as a roleType in some admin selects; constrain to mentorship-relevant roles where used in mentorship workflows. |
| `/admin/reflections` | All reflection submissions | admin/chapter-pres/mentor mixed | `getAllReflectionSubmissions` | none | GREEN | Acceptable. |
| `/admin/reflection-forms` | Manage reflection form templates | admin | `getReflectionForms` | none | GREEN | Acceptable. |
| `/admin/governance` | Ops/risk dashboard | admin | governance dashboard | none directly | GREEN | Acceptable. |
| `/admin/mentorship-program/gr-assignments` etc. | G&R sub-tools | admin | G&R helpers | none | YELLOW | Surface "instructors with no active G&R" upstream so admins discover gaps. |

## 3. Data-model audit

Mentorship core (`prisma/schema.prisma`):

- **Relationship**: `Mentorship` has `mentorId`, `menteeId`, `type` (`MentorshipType`), `programGroup`, `governanceMode`, `status` (`MentorshipStatus`), `startDate`, `endDate`, `notes`, `trackId`, `chairId`, kickoff timestamps, gamification streaks, `cycleStage`. Fully sufficient to represent instructor-as-mentee and admin/instructor-as-mentor; user can be on both sides through different rows.
- **Capacity**: `MentorshipTrack.mentorCap` (default 3) plus `enforceFullProgramMentorCapacity` enforce the cap on assignment. No explicit per-user opt-in cap, but `FULL_PROGRAM_MENTOR_CAP=3` is enforced for non-student/non-connected tracks.
- **Goals**: dual lineage — legacy `Goal` / `GoalTemplate` / `ProgressUpdate` (marked deprecated) and modern `GRDocument*` / `GoalLifecycleStatus` / `GoalProgressState`. The G&R doc model already has lifecycle/progress/priority/dueDate/completedAt fields needed for stalled/overdue tracking.
- **Reflections**: legacy `ReflectionSubmission` plus modern `MonthlySelfReflection` (cycle-driven). Both writeable.
- **Reviews**: legacy `MonthlyGoalReview`, modern `MentorGoalReview` with `MentorshipReviewStatus` and `GoalReviewStatus`. Solid.
- **Check-ins**: `MentorshipCheckIn` is minimal (`notes`, `rating`, `createdAt`). Sessions live in `MentorshipSession` with `scheduledAt`, `completedAt`. Both are usable for overdue/stalled detection.
- **Active/inactive**: `MentorshipCircleMember.isActive` exists. Mentors are not separately marked active/inactive; `Mentorship.status` is the de-facto active flag.
- **Audit**: `AuditAction.MENTORSHIP_CREATED/UPDATED` are emitted from the program actions; we can extend this for reassignments/pauses without schema changes.

Yes/no answers:

- Instructor-as-mentee — yes (`primaryRole=INSTRUCTOR`, `programGroup=INSTRUCTOR`).
- Instructor-as-mentor — yes (any user can be a `mentorId`; `governanceUsers` query already includes `INSTRUCTOR`).
- Admin-as-mentor — yes (admin roles included in `governanceUsers`).
- User as both mentor and mentee — yes (separate `Mentorship` rows; UI represents them naturally).
- Admin assign / reassign — yes via `assignProgramMentor` + `endProgramMentorship`; missing one-shot reassignment.
- Unassigned instructors — yes via `unassignedMentees` in command center; lane filter currently still defaults to "Students" which hides the instructor list one click away.
- Overdue check-ins — partially. There is `cadenceRiskItems` (no session in 21d), but no explicit overdue queue.
- Stalled goals — partially (G&R has lifecycle/progress fields but no admin queue surfaces it).
- Student-only assumptions in models / actions — present (program-group switches), but easy to gate at the UI layer without schema change.
- Two conflicting mentorship models — yes-ish: legacy `MonthlyGoalReview` and modern `MentorGoalReview`, plus legacy `Goal` vs `GRDocumentGoal`. Schema annotates this with `@deprecated` and the codebase already migrated most write paths.

## 4. Permissions / security audit

| Area | Behavior today | Severity if wrong | Status |
| --- | --- | --- | --- |
| `/admin/mentorship` page | redirects unless `roles.includes("ADMIN")` | High | OK |
| `/admin/mentorship-program` page | redirects unless `roles.includes("ADMIN")` | High | OK |
| `/admin/mentor-match` | only redirects, no gate | Medium | Needs an admin gate even though the redirect target is gated; otherwise the URL becomes a soft probe. **Fixed in MC-002.** |
| `assignProgramMentor`, `endProgramMentorship`, `assignCommitteeChair`, `removeCommitteeChair`, `createMentorshipTrack`, `createMentorCommittee`, `addMentorCommitteeMember`, `updateMentorshipGovernance`, `createProgramGoal`, `toggleProgramGoal`, `updateProgramGoal` | gated by `requireAdmin()` | High | OK |
| `assignSupportCircleMember` | gated to `ADMIN`/`STAFF`/`CHAPTER_PRESIDENT` via `requireSupportAdmin` | High | OK |
| `updateGoalReviewStage`, `updateMonthlyReviewStage`, `updateMenteeMatchingStage` | `requireAdmin()` | High | OK |
| `getMentorshipGoalReviews`, `getMentorshipMonthlyReviews` | return `[]` for non-admins | Medium | OK |
| `getChairQueueEnriched`, `getReviewCompletionStatus` | only checks logged-in, not admin | Medium | Tightened in MC-002 to admin/chair-only since the page is admin-gated but the helpers are exported server actions. |
| `getMentorshipStats` | `requireSession` plus admin-role check | Medium | OK |
| `addMentorshipCheckIn`, `getMentorshipCheckIns` | mentor-of or admin | Medium | OK |
| `requireMentorOfUser` | mentor or admin | Medium | OK |
| Inactive mentors | `Mentorship.status='ACTIVE'` is the sole gate; if a mentor is rolled off, ending the relationship removes their access | Medium | OK if relationships are ended on offboarding. There is no global "deactivate this mentor" toggle today, but the existing flow is sound. |
| Direct relationship URLs (`/mentorship/mentees/:id`) | gated by `getMentorshipAccessibleMenteeIds` | High | OK |

No critical findings. The two notable mediums (`/admin/mentor-match` and the chair queue helpers) are addressed in MC-002.

## 5. Admin UX audit

- The two top-level admin entry points (`/admin/mentorship`, `/admin/mentorship-program`) overlap. `/admin/mentorship` is the lighter "tabbed" view; `/admin/mentorship-program` is the dense Command Center.
- The Command Center centers on Students/Instructors/Leadership lanes — for an instructor-only launch this is noise. The default lane is `STUDENTS`.
- Pulse cards under `/admin/mentorship?tab=pulse` cover active pairings, pending chair approvals, reflections overdue, completion %, and over-capacity mentors. These are the right primitives.
- Missing top-level signals on the dashboard: "instructors without a mentor", "stalled / overdue goals", "no recent activity", a single "needs admin action" tally.
- Relationship detail is accessible via `/mentorship/mentees/:id`, but admins cannot easily reassign or pause from a single page.
- "Inactive mentor still assigned" is impossible to surface since there is no inactive-mentor flag — for launch we surface it as `mentor with 0 active relationships AND >0 ended relationships in the last 30 days` only if needed, but skip for now.

## 6. Status lifecycle audit

`Mentorship.status` already supports `ACTIVE`, `PAUSED`, `COMPLETE`. Derived states:

- `NEEDS_MENTOR` → user with no `Mentorship` row where `status=ACTIVE`.
- `ACTIVE` → `Mentorship.status=ACTIVE`.
- `NEEDS_CHECK_IN` → no `MentorshipSession` (completed or scheduled) in the last 21 days, derived in command center as `cadenceRiskItems`.
- `STALLED` → no completed session in 30+ days, OR `MentorGoalReview` not submitted for current cycle. Use `getReviewCompletionStatus` to surface.
- `NEEDS_REASSIGNMENT` → manual; no field today. Add UI affordance only.
- `PAUSED` → `Mentorship.status=PAUSED`.
- `COMPLETED` → `Mentorship.status=COMPLETE`.

Goal/check-in: G&R already exposes `GoalLifecycleStatus { ACTIVE, COMPLETED, ARCHIVED }` and `GoalProgressState { NOT_STARTED, IN_PROGRESS, DONE, BLOCKED }`. Review state has `DRAFT / PENDING_CHAIR_APPROVAL / APPROVED / RETURNED / CHANGES_REQUESTED`. We map to the request lifecycle on the surface, no enum changes needed.

## 7. Goals & Resources audit

Today admins can:

- View goal templates (`/admin/goals`).
- View G&R templates and assignments (`/admin/mentorship-program/gr-templates`, `gr-assignments`).
- See the chair approval queue (`getChairQueueEnriched`).

Missing for admin oversight:

- "Active instructor relationships with no published G&R doc."
- Stale goals = `GRDocumentGoal.lifecycleStatus=ACTIVE` and either `dueDate < now` or `progressState=NOT_STARTED` for >X days.
- Goals needing review = `MentorGoalReview.status=PENDING_CHAIR_APPROVAL`.
- Filters by mentor / instructor / status.

MC-007 introduces a server query plus a small admin G&R oversight panel.

## 8. Check-in / reflection audit

Today admins can:

- Browse all reflection submissions (`/admin/reflections`).
- See reflection completion percent on Pulse.

Missing:

- A single "instructors with no completed session in last X days" view.
- Mentor follow-through (mentors with mentees but no reviews submitted).
- Per-relationship view of reflections + check-ins + reviews.

Captured in MC-008 + the relationship detail in MC-006.

## 9. Mentor assignment / capacity audit

Today admins can:

- Assign via `/admin/mentorship-program?focus=matching` (`assignProgramMentor`).
- End relationship via `endProgramMentorship`.
- See mentor capacity via Pulse "Mentors over capacity (3+)".

Missing:

- One-shot reassignment.
- A standalone capacity view that surfaces mentors at exactly 3 (at cap, not over) and inactive mentors.

Captured in MC-005 and MC-009.

## 10. Test coverage audit

Existing tests:

- `tests/lib/mentorship-admin-helpers.test.ts` — lane parsing + support role gap labels.
- `tests/lib/mentorship-access.test.ts` — admin / chapter / mentor / circle access.
- `tests/lib/mentorship-canonical.test.ts` — program group, chair approval, mentor capacity.
- `tests/lib/mentorship-program-actions.test.ts` — kickoff backfill via `submitMonthlyGoalReview`.
- `tests/lib/mentorship-hub-actions.test.ts` — circle staffing actions.
- `tests/lib/mentor-matching.test.ts` — mentor suggestions.

Missing — added in MC-011:

- A focused unit test for the new instructor-mentorship-only admin payload (only instructor lane data, no STUDENT data).
- A sanity test for `assignProgramMentor` requiring `ADMIN`.
- A sanity test for `getReviewCompletionStatus` requiring admin/chair-eligible role.

## Implementation plan (priorities)

The task list mirrors MC-001..MC-012. Priorities:

1. Product framing — collapse student lane on admin surfaces, default to instructors. (MC-001)
2. Permission hardening on `/admin/mentor-match` redirect and chair queue helpers. (MC-002)
3. Admin operations dashboard upgrade (MC-003) plus needs-action queue (MC-010).
4. Unassigned instructors queue (MC-004).
5. Mentor reassignment server action + UI affordance (MC-005).
6. Relationship detail page improvements (MC-006).
7. G&R oversight / check-in oversight surfaces (MC-007, MC-008).
8. Mentor workload (MC-009).
9. Tests (MC-011) + verification (MC-012).

## Decisions / launch-friendly assumptions

- Mentorship lane on admin pages defaults to `INSTRUCTORS`. The `STUDENTS` lane is hidden behind a launch flag-like constant (`SHOW_STUDENT_MENTORSHIP_LANE = false`) so we can re-enable when student mentorship ships.
- We do not modify the Prisma `STUDENT` enum values. Removing them would force a migration with data loss and is out of scope.
- "Reassign" is implemented as a single server action that ends the existing active relationship and creates a new one in a transaction, preserving audit history.
- Inactive-mentor handling: we surface "mentors with 0 active mentees and 1+ recent ended relationships" as a soft signal only. We do not add a new schema column.
