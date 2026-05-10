# Instructor-Side Mentorship Audit — Follow-Up (Pass 2)

This is a deeper second-pass audit performed after the MC-001 → MC-009
implementation. It captures gaps and risks that were not in scope for the
first pass or that surfaced when re-reading the related code at a finer
grain. Nothing in this doc has been implemented yet.

## A. New / confirmed bugs (instructor-facing)

### A1. Reflection CTA on mentee dashboard links to the wrong page (BUG)
File: `app/(app)/mentorship/_components/mentee-dashboard.tsx:262,267`

The "Submit Reflection →" button (and the "View Reflection" button) link to
`/mentorship-program/reviews`, which `permanentRedirect`s to
`/mentorship/reviews` — the **chair review inbox**, not the reflection
submission form.

The actual reflection submission lives at `/my-program/reflect`. The
new Next-Action card I added in MC-002 already points there; the older
`Monthly Reflection` card section needs to be updated to match (or be merged
with the next-action card to avoid duplicate CTAs altogether).

**Impact:** instructor mentees clicking the legacy CTA land on a chair-only
page that probably redirects them again or shows nothing. Fixable in one
edit.

### A2. `markKickoffComplete` permission too broad (PERMISSION GAP)
File: `lib/mentorship-hub-actions.ts:958`

Same shape as the `setMentorTag` issue I fixed in MC-008: the action only
checks `flags.canSupport` (any MENTOR/INSTRUCTOR/CHAPTER_PRESIDENT/ADMIN/
STAFF), not whether the caller is the mentor or chair on the specific
mentorship. Any user with one of those roles can mark **any** pairing's
kickoff complete.

Fix: same pattern — admin OR `mentorId === session.user.id` OR
`chairId === session.user.id`.

### A3. Instructor sidebar does not include `/mentorship`
File: `lib/navigation/instructor-v1-allowlist.ts`

`INSTRUCTOR_V1_ALLOWED_HREFS` excludes `/mentorship` and `/mentorship/mentees`.
Instructors who are also active mentors on a `Mentorship` record have no
sidebar entry to reach their mentees — they have to type the URL or click
through `/my-program`. The MC-001 fix corrected the page logic, but the
nav still hides the door.

Fix options (any one):
- Add `/mentorship` to `INSTRUCTOR_V1_ALLOWED_HREFS` so it appears for
  instructors whose role merge resolves it.
- Add a contextual link from `/my-program` topbar that appears when the
  instructor has at least one mentee.

### A4. Instructor mentees cannot use `/mentor/feedback` to request feedback
File: `app/(app)/mentor/feedback/page.tsx:50,83`

The feedback portal hides the "Request Feedback" form behind
`isStudent = roles.includes("STUDENT")`. An instructor mentee who wants to
request private feedback through this surface cannot. Whether to support
this is a product call, but today the page silently excludes them.

### A5. `/mentor/feedback` mentor copy is student-centric
File: `app/(app)/mentor/feedback/page.tsx:79`

Subtitle reads "Review submitted work from students…" even when an
instructor mentor is reviewing instructor mentees. The `isMentor` flag here
includes INSTRUCTOR but the copy assumes students.

### A6. `getMyFeedbackRequests` returns shape with `.student`
File: `lib/feedback-actions.ts:148-160`

The response shape uses the field name `student: { id, name }` even though
the underlying mentee may be an instructor. The caller in
`/mentor/feedback/page.tsx` then displays this as a generic mentee. Field
name is purely cosmetic but locks in student framing in the data layer too.

### A7. `MentorshipCheckIn` exists but is never surfaced
File: `lib/mentorship-actions.ts:300-340`

`addMentorshipCheckIn` and `getMentorshipCheckIns` are defined but no UI
calls them. The MentorshipCheckIn rows are dormant. Either:
- Wire them in (mentor can log light-weight check-ins between full reviews;
  the original task mentioned "monthly check-ins"), or
- Delete the dead actions and the Prisma model in a follow-up.

The instructor-facing flow today uses `MentorshipSession` for
"check-ins" (e.g., session type `CHECK_IN`). That overlaps semantically with
`MentorshipCheckIn`. Worth a model decision before launch.

### A8. `/mentor/resources` page is not access-gated and uses student copy
File: `app/(app)/mentor/resources/page.tsx`

- No role/permission gate — any authenticated user (including PARENT) can
  read the library. The publish form is gated, but the read view isn't.
- "← Support Hub" back-link could read "← Instructor Mentorship" in the
  instructor mentor case, but currently it's the same for all viewers.
- Empty state copy mentions "students" generically.

This page is shared with student-side mentorship per the original
architecture, so a clean fix would route the back-link based on the
viewer's primary role.

### A9. `getMentorshipPendingActionCount` is exported but never used
File: `lib/mentorship-notifications.ts:228`

This count is exactly the kind of next-step rollup the new mentee dashboard
could surface in a single line ("3 mentorship items waiting on you"). Worth
wiring into the My Mentorship section.

### A10. `mentorship/feedback/[menteeId]/feedback-form.tsx` is dead code
File: `app/(app)/mentorship/feedback/[menteeId]/feedback-form.tsx`

The route `page.tsx` redirects, and nothing imports the form file. Holds
the bulk of the remaining "student-facing summary" / "Escalate this student
review" copy. Easiest fix is deletion.

### A11. `/mentorship/unlock-sections` is a student-section-unlock page
File: `app/(app)/mentorship/unlock-sections/page.tsx`

Sits inside the `/mentorship` URL space but is a student-section-unlock
recommendation surface. Doesn't pollute instructor mentorship views (the
new `/mentorship` page no longer links it) but it confuses the URL space —
arguably it belongs under `/admin/...` or `/mentor/...` rather than
`/mentorship/...`. Out of scope; flag only.

## B. Architectural smells that affect instructor mentorship

### B1. Chapter-president scoping returns ALL chapter members
File: `lib/mentorship-access.ts:33-49`

`getMentorshipAccessibleMenteeIds` for a CHAPTER_PRESIDENT returns every
user in the chapter, not just users they actually mentor or chair. That
means a chapter-president-as-mentor will see "everyone in chapter" in the
mentees-they-mentor view, not only their mentees. Acceptable today but
clearly broader than the MC-005 framing claims.

A tighter version would intersect with `Mentorship` rows where the
chapter-president is mentor or chair, plus their `MentorshipCircleMember`
rows.

### B2. `getInstructorMentorshipMembership` ignores chair-only assignments
File: `lib/mentorship-access.ts` (added in MC-001)

The membership helper treats `mentorId` and `chairId` as both indicating
"I mentor someone." That matches `getMentorshipAccessibleMenteeIds` but
arguably a chair is a different role than a mentor. Today the
distinction is invisible in the UI; a future "Instructors I Mentor" vs
"Instructors I Chair" split would need to use the underlying role
correctly.

### B3. `MentorshipType { INSTRUCTOR, STUDENT }` enum still includes STUDENT
File: `prisma/schema.prisma:210-213`

Per the task "There is currently NO student mentorship", the STUDENT
enum value is dead but live in the schema. The seed and code paths still
use it for student support circles (`MentorshipProgramGroup.STUDENT`). A
removal would be a multi-PR migration; flagging only.

### B4. `mentorship-hub.ts.MENTOR_ROLES` includes INSTRUCTOR but `mentorship/page.tsx` did not
This was the MC-001 bug. There is now duplicated knowledge of "what role
counts as a mentor" across files:
- `lib/mentorship-hub.ts:14` `MENTOR_ROLES`
- `lib/mentorship-hub-actions.ts:214` `PRIMARY_MENTOR_ELIGIBLE_ROLES`
- (removed) `app/(app)/mentorship/page.tsx` MENTOR_ROLES

A single source of truth for "who can mentor an instructor" would prevent
the next regression.

## C. UX polish opportunities (nothing broken, just stiff)

### C1. Mentee dashboard double CTA
After MC-002 the dashboard now has two reflection-related cards: the new
Next-Action card at the top, and the older "Monthly Reflection" block.
They're consistent, but the Monthly Reflection block can be folded into
the next-action card for a single source of truth.

### C2. Resources block on mentee dashboard does not split "to me" vs "by me"
The original task mentioned both "resources recommended to the instructor"
and "resources recommended by the instructor." Today the dashboard only
shows resources scoped to the user as mentee. An instructor who is *also*
a mentor and recommends resources to their own mentees has no way to see
those from their dashboard.

### C3. "Instructors I Mentor" header still has Kanban as the dominant view
The kanban is a good tool but for new instructor mentors the list view
(roster + next action per mentee) is friendlier. Consider switching the
default for instructor-as-mentor when total mentees ≤ 3.

### C4. No "what's expected of me as a mentor" guide on `/mentorship` for
new instructor mentors
The mentee side has the next-action card. The mentor side has the kanban
columns and the new pending-review/needs-kickoff banners, but no high-level
"this month you owe X reviews" rollup. Could pair with A9
(`getMentorshipPendingActionCount`).

### C5. Mentee detail page intake-plan and Support Circle copy
The "Pre-assignment intake plan is live" banner on
`/mentorship/mentees/[id]` is a student-intake concept. Even though the
copy doesn't say "student", an instructor mentee will never have an
`StudentIntakeCase` row, so this branch never fires for them. Code is
inert for the instructor case but carries cognitive load.

## D. Tests gaps

### D1. No e2e/component test for the dual-section mentorship page
The new `/mentorship` page conditionally renders `MenteeDashboard` and
`MentorDashboard`. The pure helper (`getInstructorMentorshipMembership`)
is unit-tested, but the page-level rendering is not — a regression that
re-introduces the role-array short-circuit would not be caught by current
tests.

### D2. No regression test for `markKickoffComplete` permission
A1's sibling. If A2 is fixed, add a corresponding test pattern to
`mentorship-hub-actions.test.ts` matching the `setMentorTag` test.

### D3. No assertion that `/mentor/feedback` instructor copy is correct
Today the page renders student-centric copy for instructor mentors with
no test pinning the language. If anyone changes A5, the copy could
regress.

## E. Suggested follow-up implementation slate (priority order)

1. **MC-101 (BUG)** Point the dashboard's Submit Reflection / View
   Reflection links to `/my-program/reflect` (or merge into next-action
   card). [A1, C1]
2. **MC-102 (PERMISSION)** Tighten `markKickoffComplete` to mentor/chair
   on the pairing or admin. Add test. [A2, D2]
3. **MC-103 (NAV)** Add `/mentorship` to `INSTRUCTOR_V1_ALLOWED_HREFS` or
   add a contextual link from `/my-program` for instructor mentors. [A3]
4. **MC-104 (COPY)** Reframe `/mentor/feedback` mentor copy to use
   "mentee" generically when reviewer is an instructor mentor. Pin via a
   test. [A5, D3]
5. **MC-105 (FEATURE)** Surface `getMentorshipPendingActionCount` on the
   mentee + mentor sections. [A9, C4]
6. **MC-106 (CLEANUP)** Delete `mentorship/feedback/[menteeId]/feedback-form.tsx`
   if it remains unimported after the redirect lands. [A10]
7. **MC-107 (FEATURE)** Mentee dashboard split: "Resources Recommended To
   You" and "Resources I Recommended As Mentor". [C2]
8. **MC-108 (PRODUCT)** Decide whether to wire `MentorshipCheckIn` UI or
   delete the model. [A7]

## F. Things that are still NOT in scope for this branch

- Admin-wide mentorship dashboards (`/admin/mentorship*`)
- Hiring chair flows
- Class signup, donation system
- The student mentorship program group (any STUDENT-scoped Mentorship)
- The `unlock-sections` student-section-unlock page

## G. Confidence summary

The MC-001…MC-009 work covers the **core launch-blocking** instructor
mentorship UX (both-roles support, navigation framing, copy, next action,
write-action permission tightening, tests). The follow-up slate above is
**polish + small fixes**, not blockers, except for:

- A1 (wrong link target) — minor user impact, fix is a one-liner.
- A2 (kickoff write-permission gap) — same severity as MC-008 was.

A1 and A2 are worth fixing before launch. The rest can wait for a
post-launch polish PR.
