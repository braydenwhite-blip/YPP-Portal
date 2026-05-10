# Instructor-Side Mentorship Audit (Branch: claude/audit-instructor-mentorship-O9HA7)

Scope: instructor-facing mentorship surfaces only. Student mentorship, admin
global dashboards, hiring, donations, signup are out of scope.

## 1. Current instructor mentorship journey

Today an instructor:

1. Lands in the sidebar item "Mentorship & Program" which routes to
   `/my-program` (the participant hub).
2. Can also visit `/mentorship` (the mentorship dashboard) directly. There is
   no first-class link from the default instructor sidebar.
3. At `/mentorship`, the page picks ONE of two views by role membership:
   - mentor view — Kanban of mentees they mentor.
   - mentee view — own goals, reflections, feedback, awards.
4. From the mentor view, drilldown is `/mentorship/mentees`, then
   `/mentorship/mentees/[id]` (the "Support Circle Workspace") and
   `/mentorship/reviews/[menteeId]` to write the monthly review.
5. From the mentee view, the next action surfaces are
   `/mentorship-program/reviews` (now redirects to `/mentorship/reviews`)
   and `/my-program/reflect` for monthly reflections.

## 2. Routes (instructor-relevant)

| Route | Purpose | Notes |
| --- | --- | --- |
| `/mentorship` | dual dashboard (mentor OR mentee) | needs both-section support |
| `/mentorship/mentees` | "My Mentees" Kanban + list | header copy is generic |
| `/mentorship/mentees/[id]` | mentee detail / "Support Circle Workspace" | uses "student" copy + "Support Circle" framing |
| `/mentorship/reviews` | chair queue (admin/lead/mentor) | OK |
| `/mentorship/reviews/[menteeId]` | write monthly review | OK |
| `/mentorship/calendar` | mentor schedule | not changed here |
| `/mentorship/feedback/[menteeId]` | redirect → reviews | OK |
| `/mentorship/unlock-sections` | student section unlocks | NOT instructor mentorship; out of scope |
| `/mentor/ask`, `/mentor/feedback`, `/mentor/incubator`, `/mentor/resources` | mentor utility pages | not changed here |
| `/my-mentor` | redirect → `/mentorship` | OK |
| `/mentorship-program/...` | mostly redirects to `/mentorship/...` | OK |

## 3. Data model (relevant)

- `Mentorship { mentorId, menteeId, programGroup (OFFICER/INSTRUCTOR/STUDENT),
   governanceMode, status, cycleStage, mentorTag, kickoffScheduledAt,
   kickoffCompletedAt, reflectionStreak, reviewStreak, ... }`
- `MentorshipCircleMember { menteeId, userId, role:SupportRole, isActive }`
- `MentorshipCheckIn { mentorshipId, notes, rating }`
- `MentorshipSession`, `MentorshipActionItem`, `MentorshipResource`,
  `MentorshipRequest`, `MentorshipRequestResponse`
- `MonthlySelfReflection`, `MentorGoalReview`, `MonthlyGoalReview`,
  `GoalReviewRating`
- `GRDocument` / `GRDocumentGoal` for goals & resources, plus legacy
  `MentorshipProgramGoal`
- Enums: `MentorshipType { INSTRUCTOR, STUDENT }`,
  `MentorshipProgramGroup { OFFICER, INSTRUCTOR, STUDENT }`

## 4. Permissions

- `canAccessMentorship(primaryRole)` — blocks STUDENT/APPLICANT/PARENT.
- `getMentorshipAccessibleMenteeIds(userId, roles)` —
  - ADMIN → null (unrestricted)
  - CHAPTER_PRESIDENT → all users in their chapter (broad; not strictly the
    mentee set, but matches existing rules)
  - else → union of (active pairings where user is mentor or chair) and
    active circle memberships
- `hasMentorshipMenteeAccess` — covers self/admin and the accessible list.
- `/mentorship/page.tsx` `isMentorView` short-circuit uses
  `MENTOR_ROLES = MENTOR | ADMIN | CHAPTER_PRESIDENT | STAFF`. This **excludes
  `INSTRUCTOR`** so an instructor who is assigned as a mentor on a
  `Mentorship` record never sees the mentor view. Fixed in MC-001 by checking
  the actual mentor relationships in the DB.
- `setMentorTag(mentorshipId, tag)` only checks `canSupport`, not that the
  caller mentors that specific pairing. Tightened in MC-008.
- Direct-URL access to `/mentorship/mentees/[id]` and
  `/mentorship/reviews/[menteeId]` is gated by accessible-mentee scoping. OK.

## 5. UX blockers found

- Instructors with both roles can only see one view at `/mentorship`.
- An instructor mentor without `MENTOR` role in their `roles[]` array is
  treated as a mentee.
- "My Mentees" header / instructor-mentee detail page use student framing
  ("students you mentor", "Support Circle Roster", "student wins").
- Mentee dashboard never shows resources recommended to the instructor or
  ones the instructor recommends.
- Mentor view has no "next action" rollup separate from the kanban columns.
- Empty states are present but vague ("no mentor assigned yet").
- `setMentorTag` permission check is too broad.

See git history on branch `claude/audit-instructor-mentorship-O9HA7` for the
implemented fixes (commits MC-001 through MC-009).
