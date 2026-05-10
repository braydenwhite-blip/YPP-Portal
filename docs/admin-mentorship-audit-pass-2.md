# Admin instructor-mentorship — second-pass audit

> Companion to `docs/admin-mentorship-audit.md`. This pass evaluates the
> code that now sits on the branch after MC-001..MC-012, looking for new
> issues, duplication, gaps, and edge cases the first pass missed.
> Audit-only — no implementation in this commit.

## Summary

What now exists for admin instructor mentorship:

- A central `/admin/mentorship` page with 10 tabs:
  Pulse / Needs Action / Unassigned / Workload / G&R / Check-ins /
  Approvals / Pairings / Goals / Committees.
- A larger `/admin/mentorship-program` "Command Center" with population
  lanes, watchlist, matching, staffing, governance, and a chair queue.
- A new `/admin/mentorship/relationships/[mentorshipId]` admin detail
  surface.
- `lib/instructor-mentorship-ops.ts` as the canonical, admin-gated data
  layer for the new tabs.
- `reassignProgramMentor` and `setProgramMentorshipStatus` server
  actions in the legacy `lib/mentorship-program-actions.ts` module.
- 15 mentorship-focused tests added.

Things still off, ranked by severity:

## High

H1. **`/admin/mentorship-program` analytics still sum STUDENT mentorships.**
`lib/admin-mentorship-command-center.ts:125` runs
`prisma.mentorship.findMany({ where: { status: "ACTIVE" } })` with no
`type: { not: "STUDENT" }` filter. The `analytics.activeCircles =
mentorships.length` (line 518) and the program-wide signal cards on
`/admin/mentorship-program` therefore include student mentorships
even though the lane is hidden. `unassignedMentees` is filtered by
visible lanes (line 315), but `circleSummaries`, `mentorships`, and
`reviewCounts` are not. A page labeled "Instructor Mentorship Command
Center" that mixes student data is misleading.

H2. **Two sources of truth for "active mentorships" on the same page.**
The Pulse tab on `/admin/mentorship` calls `getPulseData()` which counts
`prisma.mentorship.count({ where: { status: "ACTIVE" } })` (no STUDENT
filter, line 70 of the page) and uses that for the
"Active instructor mentorships" KPI card. Right next to it, the
"Instructors without a mentor" card reads from
`getInstructorMentorshipOpsSummary()` which **does** filter STUDENT.
If any STUDENT mentorships exist, the two cards reference different
universes. The same mismatch exists for "Pending chair approval" and
"Mentors over capacity (3+)" because those derive from `getPulseData`.

H3. **Pairings tab is incomplete and student-leaky.**
`getPairingsData()` (line 126 of `app/(app)/admin/mentorship/page.tsx`)
selects only users with `roles: { some: { role: "MENTOR" } }`. Instructors
who mentor other instructors (a launch use case) but who don't carry the
explicit MENTOR role are silently excluded. It also doesn't filter
`mentorship.type` — student mentees would appear in the chips. The
`getMentorWorkload` ops helper does this correctly with
`OR: [{ MENTOR role }, { mentorPairs: { some: ACTIVE } }]`. Pairings is
the older path and should defer to or be deleted in favour of Workload.

## Medium

M1. **`setProgramMentorshipStatus` overwrites mentorship notes.**
`lib/mentorship-program-actions.ts:533` writes
`notes: reason ? reason : undefined`. Any prior governance notes on
that mentorship are clobbered with the status-change reason. Consider
keeping a status-change history on `Mentorship.notes` as appended
breadcrumbs, or write the change reason to the audit log only and leave
`notes` alone.

M2. **`reassignProgramMentor` overwrites notes on the old mentorship too.**
`lib/mentorship-program-actions.ts:454` sets the old (now COMPLETE)
mentorship's notes to `Reassigned to {newMentor.name} — Reason: …`.
Existing notes are lost. Same fix shape as M1.

M3. **Dead helper / dead import.**
`getMentorCapacityStatus` in `lib/mentorship-access.ts` is only
referenced as an unused import in
`app/(app)/admin/mentorship/page.tsx:14`. After MC-003 the import is
no longer used; `getMentorCapacityStatus` itself has zero call sites.
Drop the import and the helper, or wire it into the workload tab.

M4. **Two cap constants that must stay in sync.**
`MENTOR_CAPACITY_SOFT_CAP = 3` in `lib/mentorship-access.ts` and
`FULL_PROGRAM_MENTOR_CAP = 3` in `lib/mentorship-canonical.ts` are both
hard-coded to `3`. Either consolidate (re-export from canonical) or
add a guard to keep them aligned.

M5. **String-literal STUDENT comparisons.**
`lib/instructor-mentorship-ops.ts` filters by `type: { not: "STUDENT" }`
in 10 places using string literals. Switch to the typed
`MentorshipType.STUDENT` enum so a future enum rename surfaces as a
TypeScript error rather than a silent miss. Same for
`programGroup === "STUDENT"`.

M6. **`INSTRUCTOR_OPS_PRIMARY_ROLES` is exported but unused.**
`lib/instructor-mentorship-ops.ts:22` exports a four-role tuple
documenting the launched scope but no caller (including this same
module) uses it. The actual queries hard-code `"INSTRUCTOR"` only
(line 76). Either start using the constant for the boundary or delete
it; the inconsistency invites future drift.

M7. **`unassignedInstructors` summary != Unassigned tab vs lane filter.**
`getUnassignedInstructorQueue` and the summary's
`unassignedInstructors` count both look at `primaryRole = "INSTRUCTOR"`
only. But the Command Center's `LEADERSHIP` lane (chapter presidents,
admins, staff) treats those users as mentees — they appear there as
"Need primary mentor" but never on the Pulse / Needs Action /
Unassigned tabs. The dashboard says "Instructors without a mentor"
which is consistent with the narrow definition, but admins toggling
between the two surfaces will see different totals. Pick one boundary
(either include the leadership lane or drop it from the Command
Center) and document it.

M8. **`reassignProgramMentor` capacity check is outside the transaction.**
`lib/mentorship-program-actions.ts:441` runs
`enforceFullProgramMentorCapacity` before the `$transaction` that
creates the new mentorship. Two concurrent admin reassignments to the
same target mentor could each pass the check and create a fourth
relationship. Low likelihood given admin concurrency, but worth either
moving the check inside the transaction or relying on a DB constraint.

M9. **Missing `revalidatePath` for the admin relationship detail page.**
`reassignProgramMentor` and `setProgramMentorshipStatus` revalidate
`/admin/mentorship`, `/admin/mentorship-program`, and
`/mentorship/mentees/{id}`. They do **not** revalidate
`/admin/mentorship/relationships/{id}`. After a status change the form
returns to the same URL but the cached data may be stale. Add
`revalidatePath(\`/admin/mentorship/relationships/${id}\`)` to both
actions.

M10. **No tests for the new admin relationship detail page.**
The page composes a complex Prisma query, an admin gate, and two
forms. There is currently no integration or snapshot test covering it
— the closest is `mentorship-program-reassignment.test.ts`, which only
exercises the server actions. A simple test that the page calls
`redirect` for non-admins and renders for admins would close a hole.

M11. **No test for the `/admin/mentor-match` admin gate.**
MC-002 added `redirect("/")` for non-admins on the redirect-only page,
but there's no test that the gate fires before the redirect. One
small test would lock this in.

## Low

L1. **Tab overload on `/admin/mentorship`.**
10 tabs is on the high side. Pulse + Needs Action are the operational
landing pages; Unassigned / Workload / G&R / Check-ins are sub-views;
Approvals / Pairings / Goals / Committees are mixed setup + queue.
Pairings now duplicates most of Workload (mentor-grouped active
relationships). Consider:
  - Drop or fold Pairings into Workload.
  - Group Goals + Committees + Approvals under a "Reviews" tab.

L2. **`/admin/mentorship` and `/admin/mentorship-program` overlap.**
Both expose chair queues, governance, goal templates, and pairings.
The newer `/admin/mentorship` is the better home now that it has the
ops tabs, but `/admin/mentorship-program` is the page the e2e nightly
smoke pings and also where matching + staffing live. There is no
canonical landing page; admins will guess. A short audit decision
would help: either consolidate to one, or split them by job
("Operations" vs "Program setup").

L3. **`/admin/mentor-match` is a redirect-only page.**
After MC-002 it has an admin gate, but it still exists only to
redirect. Either delete the route and make any deep links go straight
to `/admin/mentorship-program?focus=matching`, or keep it as a stable
URL and document why.

L4. **Heading drift vs nightly smoke.**
The `/admin/mentorship-program` page heading was previously
"Mentorship Command Center"; MC-001 changed it to "Instructor
Mentorship Command Center" and the nightly smoke
(`tests/e2e/nightly/workflow-surfaces.spec.ts`) was updated. There is
no other page that smoke-tests `/admin/mentorship`'s heading, so
future copy changes will silently pass. A nightly-style assertion on
"Instructor Mentorship Oversight" is cheap insurance.

L5. **Status-controls UX is sparse.**
The relationship detail "Status" form renders the current status as
the default `<select>` value. If an admin opens the form on an ACTIVE
relationship and clicks "Update status" without changing anything, the
action no-ops (good). But the UI gives no confirmation that nothing
happened. Minor.

L6. **`getStalledGoalQueue` uses `take: 200`.**
Same for `getOverdueCheckInQueue`. Reasonable safety cap, but the
G&R and Check-ins tabs render those rows directly; admins can't
scroll past 200. Add pagination or a "more" affordance once any
chapter approaches that ceiling.

L7. **`__TEST_ONLY__` export ships in production.**
`lib/instructor-mentorship-ops.ts:622` exports a `__TEST_ONLY__`
constants bag but no test currently consumes it. Either start using
it (e.g., in the new tests for the stale-day cutoffs) or delete it.

## Test-coverage gaps (re-checked)

- ✓ Ops library: 7 tests.
- ✓ Reassignment + status actions: 8 tests.
- ✗ Relationship detail page: 0 tests (M10).
- ✗ `/admin/mentor-match` redirect gate: 0 tests (M11).
- ✗ `getInstructorMentorshipOpsSummary` against the Command Center's
  numbers (so a future drift between the two summary sources surfaces
  in CI).

## Risks if shipped as-is

- Admins on a multi-program tenant will see student-mentorship data
  bleed into the Command Center analytics (H1) and the Pulse KPI cards
  (H2). For a launch where student mentorship is explicitly hidden,
  this is the loudest correctness issue.
- Pairings tab will under-report instructor-as-mentor relationships
  (H3).
- Note overwrite (M1, M2) is recoverable from the audit log but
  surprises admins who used the notes field for governance context.
- Capacity race (M8) is unlikely in practice but worth a single-line
  fix.

## Suggested next pass (MC-013 onward)

A small, focused round to resolve the Highs and Mediums:

1. MC-013 — add `type: { not: "STUDENT" }` to the Command Center
   `findMany` and to `Pulse`'s `mentorship.count` calls; switch
   string literals to `MentorshipType.STUDENT`.
2. MC-014 — fix `getPairingsData` to include
   `mentorPairs: { some: { status: "ACTIVE" } }` users and filter
   STUDENT type, OR delete the Pairings tab.
3. MC-015 — change reassignment + status actions to append rather
   than overwrite `Mentorship.notes`; also add the relationship-detail
   `revalidatePath` and move the capacity check inside the
   transaction.
4. MC-016 — drop `getMentorCapacityStatus` and consolidate the two
   cap constants under `FULL_PROGRAM_MENTOR_CAP`.
5. MC-017 — decide on the leadership-lane boundary; either include
   chapter presidents in the unassigned queue or document why they
   live only on the Command Center.
6. MC-018 — add tests for the relationship detail admin gate and a
   parity test for the two summary sources.
7. MC-019 — UX consolidation: collapse Pairings into Workload, add
   a `/admin/mentorship` heading smoke, prune `__TEST_ONLY__` and
   `INSTRUCTOR_OPS_PRIMARY_ROLES`.
