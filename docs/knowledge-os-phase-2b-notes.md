# Knowledge OS V2 — Phase 2B Implementation Notes

**Scope shipped:** Instructor and Student full-360 record pages on Design
System 2.0, the student Advisor section, advisor caseload visibility (record
section + `/people?advisor=` filter), admin list consolidation banners into
`/people`, check-in scheduling wiring, and Entity 360 → record-page linking.
Companion to `docs/ypp-organizational-knowledge-os-master-plan.md` (§11, §12,
§21, §27) and `docs/knowledge-os-phase-2a-notes.md`.

## Record pages

- **Instructor full-360 — `/admin/instructors/[id]`** (rebuilt, ui-v2):
  ProfileHeader identity + stage badge, KeyFactsGrid (current classes,
  training, last review, open actions, advisees, mentor), a concrete
  next-step card (attention flag → onboarding blocker → missing first
  review), Classes (current/past/legacy + per-class approval state),
  Upcoming sessions, Reviews & interviews (latest quarterly review + history
  + application/interview records), Mentorship & leadership (pairs as
  EntityChips + active `LeadershipContribution`s), **Advisor caseload**
  (overdue-first, per-advisee check-in state, links to the advising
  workspace and the People caseload view), Open work (linked actions +
  meetings mentioned in), and Recent activity. No bare
  performance/health labels anywhere (§19).
- The operationally rich legacy admin page (tags/notes/tasks editors,
  quarterly review form, provisional clock, people-strategy panel,
  contribution assignment) was **kept intact at
  `/admin/instructors/[id]/manage`** — linked from the record header
  ("Admin tools") and next-step card. This is the plan's "rebuilds must not
  destroy operational tooling" mitigation; nothing was deleted.
- **Student full-360 — `/admin/students/[id]`** (new route, ui-v2; the admin
  student altitude previously had no detail page at all): ProfileHeader with
  advisor-state badges (`No advisor` / `Check-in overdue` /
  `Follow-up flagged`), KeyFactsGrid (advisor, last/next check-in, classes
  enrolled, mentor, open actions), advisor-driven next-step card, the
  **Advisor section** (assignment + status + cadence + last/next check-in +
  overdue + follow-up note + advisor's next-steps summary + recommendations
  + recent advising notes, with "Log check-in / open workspace" →
  `/my-advisees/[assignmentId]` and "Assign an advisor" →
  `/admin/leadership` when unassigned), Classes (ClassEnrollment rows with
  attendance n/m + legacy course enrollments), Mentorship & family
  (mentor + approved parent/guardian chips), and Open work.
- New loaders: `lib/people/instructor-record.ts` (advisor caseload, upcoming
  sessions, quarterly review history) and `lib/people/student-record.ts`
  (the full student record read). Both pages otherwise reuse the existing
  loaders unchanged (`getInstructorOpsProfile`, `loadInstructorLeadership`,
  `getLatestQuarterlyReview`, `getOperationalContextForEntity`).

## Advisor caseload visibility

- Instructor record: `#caseload` section, overdue-first.
- `/people` accepts `advisor=<userId>` (caseload view): students actively
  advised by that user, with a labelled clear-filter chip. Linked from the
  caseload section ("View caseload in People").
- Check-in scheduling is now actually maintained
  (`lib/leadership/advisor-actions.ts`): logging a `CHECK_IN` advising note
  sets `lastCheckInAt` **and** advances `nextCheckInDueAt` by the
  assignment's `checkInCadenceDays`; `assignStudentAdvisor` seeds
  `nextCheckInDueAt` (+14 days) on create/reactivate. Previously
  `nextCheckInDueAt` was never written, so the overdue flag could only fire
  for manually-seeded rows.

## Consolidation into /people

- `/admin/students` and `/admin/instructors` keep their admin-only bulk
  tooling (bulk mentor/chapter assignment; ops kanban/lifecycle/saved views)
  and now carry a `MasterDirectoryBanner` routing normal browsing to
  `/people?role=student` / `/people?role=instructor`. Full redirects were
  deliberately not done — both pages hold bulk tools with no `/people`
  equivalent yet (plan §9 keeps bulk tooling under Admin).
- `/admin/students` rows now link to the new student record page.
- Person Entity 360 "Open full 360" is viewer-aware: admins land on
  `/admin/students/[id]` (students) or `/admin/instructors/[id]`
  (instructors); everyone else keeps `/people/[id]` (the record pages gate
  on ADMIN).
- `/admin/instructors/[id]` deep links elsewhere (leadership dashboard,
  matching boards, lifecycle, attention flags) now land on the new full-360;
  the one anchor deep-link (`#people-strategy` from the People Dashboard)
  was retargeted to `/manage`.

## New ui-v2 primitives

- `ProfileHeader` — record identity header (avatar/initials, back link,
  eyebrow, badges, quick actions).
- `KeyFactsGrid` / `KeyFact` — the key-facts strip (concrete values only;
  optional `href` + `attention` tone).
- `RecordSection` — anchored card section with SectionHeader; callers hide
  empty sections.

## Help Agent / search

- Suggestion set unchanged — Phase 2A already covers the seeded queries
  (students without advisors, check-ins overdue, overdue instructor reviews,
  applicants waiting, classes with no lead, partner views). Person search
  results keep `/people/[id]` hrefs (member-safe); admins reach the record
  pages through the 360 preview's "Open full 360", which is now role-aware.
- `/api/search` still runs live Prisma queries — the SearchDocument cutover
  remains future work (unchanged from Phase 2A).

## Visual baselines / CSS deletion milestone 1 — NOT executed

- This environment has **no `DATABASE_URL`** (and no Supabase env), so the
  Playwright screenshot spec
  (`tests/e2e/nightly/knowledge-os-shell-visual.spec.ts`) still cannot run
  and no baselines exist. Per the Phase 2A rule ("delete only after a
  DB-enabled environment has captured the visual baselines"), **no
  `globals.css` lines were deleted** and the freeze baseline is unchanged
  (17,443 lines).
- Outstanding, unchanged from Phase 2A: run
  `npm run test:e2e:seed && npx playwright test
  tests/e2e/nightly/knowledge-os-shell-visual.spec.ts --update-snapshots`
  in a DB-enabled environment, commit the baselines, then execute deletion
  milestone 1 (the dead `.nav*` blocks ~620–976, sidebar skin parts,
  `.sidebar-card*`, `.sidebar-marble-panel*`, `.sidebar-user-*`,
  `.sidebar-footer-card*`) and lower the freeze baseline.

## Known limitations / next pass

- The student record's "Log check-in" routes to the existing
  `/my-advisees/[assignmentId]` workspace rather than an inline form — an
  inline ui-v2 check-in action on the record page is a natural next step.
- The advisor caseload has no standalone route; it lives on the instructor
  record + the `/people?advisor=` view.
- Attendance shows `sessionsAttended / total sessions scheduled`; per-absence
  detail is 360-altitude work for the Class 360 pass.
- `/admin/students` and `/admin/instructors` lists still exist (banner-only
  consolidation); full redirects await `/people` bulk tooling.
- Applicant-record (Application 360) and leadership Home remain the open
  Phase 2 items (§27.5–.6).
