# Leadership Roles & Contributions

Concrete leadership/contribution roles instructors can hold beyond teaching —
assignable, actionable, and counted as evidence in reviews and Senior/Lead
promotions. Gated by `ENABLE_LEADERSHIP_ROLES` (defaults **ON**; set to
`false` as a kill-switch).

## What was added

**Roles (the `LeadershipRoleCategory` enum + code catalog):** Student Advisor,
Instructor Mentor, Curriculum Reviewer, Interviewer, Onboarding & Training
Helper, Class Quality Reviewer, Student Project Mentor, Instruction Committee
Member, Lead Instructor (class/program/subject), Partner Relationship Lead,
Recruitment Lead, Training & Development Lead, Student Success Lead,
Mentorship Program Lead, Curriculum Lead, Initiative/Project Owner, and Other.

Role *definitions* (label, description, default weight, default expected
level, ownership flag) are a code catalog in `lib/leadership/constants.ts` —
new roles are added by extending the enum + catalog, and anything ad-hoc fits
under `OTHER` with a custom title.

**Data model** (`prisma/migrations/20260611120000_add_leadership_roles_contributions`):

| Model | Purpose |
| --- | --- |
| `LeadershipContribution` | One role held by an instructor: category, title, status (`SUGGESTED / ASSIGNED / ACTIVE / COMPLETED / PAUSED / NEEDS_ATTENTION`), expected level (`SENIOR_INSTRUCTOR / LEAD_INSTRUCTOR / EITHER`), weight 1-3, ownership flag, optional links to a student/class offering/partner/free-text program, start/end dates, notes, admin owner, review visibility. |
| `LeadershipContributionActivity` | Append-only evidence log (notes, check-ins, completed reviews/interviews, recommendations, status changes). |
| `StudentAdvisorAssignment` | One advisor's responsibility for one student: advising status (`ENGAGED / NEEDS_ATTENTION / INACTIVE / READY_FOR_NEXT`), follow-up flag + note, next steps, last check-in. Back-links to the advisor's `STUDENT_ADVISOR` contribution. |
| `AdvisingNote` | Advising notes and logged check-ins. |
| `AdvisingRecommendation` | Recommended next steps (class / project / mentor / opportunity / pathway) with a `SUGGESTED / IN_PROGRESS / DONE / DISMISSED` lifecycle. |

## How Student Advisor works

1. **Admin assigns** an advisor to one or more students from `/admin/leadership`
   (`assignStudentAdvisor`). This get-or-creates an ACTIVE `STUDENT_ADVISOR`
   contribution for the advisor, so the role immediately exists on their
   leadership record. Re-assigning a previously ended pair reactivates the row.
2. **The advisor works the caseload** from `/my-advisees`: each student links to
   an advising workspace (`/my-advisees/[id]`) showing the student's interests,
   goal, mentor, and recent classes, plus controls to log check-ins/notes, set
   advising status, flag follow-up, maintain "next steps", and recommend
   classes/projects/mentors/opportunities. Check-ins update `lastCheckInAt`.
3. **Admin reviews the role** from `/admin/leadership`: advisor caseloads (high
   ≥ 8, low ≤ 2), activity health (ACTIVE = check-in within 30 days, STALE ≤ 60,
   INACTIVE beyond), students with no advisor, and flagged follow-ups.
4. **Students see it** on `/profile`: advisor name, advising status, next
   steps, and active recommendations. The `/admin/students` table also gains an
   Advisor column linking into the advising workspace.
5. **It counts in reviews**: caseload size, check-ins, and recommendations feed
   the advisor's review evidence ("Supports N students through advising…").

Ending an advisor's last active assignment marks their `STUDENT_ADVISOR`
contribution COMPLETED so the leadership record reflects reality.

## How other contributions are assigned/tracked

- Admins assign any role from `/admin/leadership` or from the **Leadership**
  section of `/admin/instructors/[id]` (`assignContribution`). Category
  defaults (weight/level/ownership) come from the catalog and can be
  overridden per assignment. Partner-lead roles can link a `Partner`;
  class-scoped roles can link a `ClassOffering`; anything else uses the
  free-text program field.
- The assigned instructor acts on the role from `/my-leadership`: they can
  activate/pause/complete it and log activity (mentor check-ins, completed
  curriculum reviews, completed interviews, committee work…). Every status
  change is logged as a `STATUS_CHANGE` activity.
- Admins can change status, remove records, and see last-activity recency in
  the dashboard's filterable table (by role type, instructor, level, status,
  search).

The mentor / curriculum-reviewer / interviewer / committee / partner-lead
workflows are all instances of this one model: assign the category, the
instructor logs the corresponding activity kinds, the admin completes or
re-statuses the record, and it surfaces as review evidence.

## Profiles and reviews

- **Instructor profile** (`/admin/instructors/[id]` → Leadership tab): current
  and past roles with activity history, Senior/Lead progress bars, advising
  stats, and a **Review evidence** card with suggested review language and a
  promotion-readiness line. It sits alongside the existing Quarterly Review
  section so reviewers see leadership evidence while writing reviews.
- **Suggested language** (`lib/leadership/review-summary.ts`) is generated from
  review-visible contributions: "Contributes beyond own classroom", "Supports N
  students through advising", "Mentors newer instructors", "Takes ownership of
  curriculum/program quality", "Owns a meaningful partner/program/system (…)",
  or "Needs more initiative beyond teaching" when nothing meaningful exists.
  Contributions with `reviewVisible: false` are excluded everywhere.

## Senior/Lead expectation math

Implemented in `lib/leadership/expectations.ts` (pure, tested):

- A contribution **counts** when review-visible and ASSIGNED / ACTIVE /
  NEEDS_ATTENTION / COMPLETED. SUGGESTED and PAUSED never count.
- It is **meaningful** when it counts and `weight >= 2`.
- **Senior Instructor:** met at ≥ 1 meaningful contribution; target 2.
- **Lead Instructor:** met at ≥ 2 meaningful contributions including ≥ 1
  ownership role; target 3.
- Standing rolls up to `LEAD_READY / SENIOR_READY / BELOW_EXPECTATIONS /
  NO_CONTRIBUTIONS`, shown per instructor on `/admin/leadership` (strong
  candidates, below expectations, and uncovered ownership areas).

## Key files

- `lib/leadership/` — `constants.ts` (catalog + vocabularies + thresholds),
  `expectations.ts`, `review-summary.ts`, `caseload.ts`, `filters.ts` (pure
  logic); `queries.ts` (loaders); `contribution-actions.ts`,
  `advisor-actions.ts` (server actions).
- `app/(app)/my-advisees`, `app/(app)/my-leadership`,
  `app/(app)/admin/leadership` — the three new surfaces.
- `components/leadership/` — shared cards, pills, and client controls.
- `tests/lib/leadership/` — 60 tests across assignment logic, caseload/status
  math, expectation progress, review summaries, filters, and the role catalog.

## Follow-up ideas

- Auto-create contributions from existing systems (e.g. an `Mentorship` row of
  type INSTRUCTOR → `INSTRUCTOR_MENTOR`; `InstructorApplicationInterviewer` →
  `INTERVIEWER`; `Partner.relationshipLeadId` → `PARTNER_RELATIONSHIP_LEAD`)
  via a backfill script + event hooks.
- Nightly job to flip stale contributions to `NEEDS_ATTENTION` (no activity in
  N days) and surface them in the instructor attention inbox.
- Emit `GrowthProgressEvent`s (track `LEADERSHIP`) when contributions complete,
  so leadership work feeds the Growth OS timeline.
- Student-side acknowledgement of recommendations ("I did this") and a nudge
  when a recommendation sits in SUGGESTED for too long.
- Quarterly Review form pre-fill from the generated review language.
