# YPP Classes — Master Implementation Plan (Classes-Only Pass)

> Scope: **only** the YPP Classes system. This pass deeply audits, improves, and
> connects every class-related workflow. It does **not** rebuild mentorship, the
> Action Tracker, the leadership pathway, or the admin dashboard, except for
> small class-related entry points. A prior "operating-system" pass already built
> most of the class machinery; this pass **fills genuine gaps and fixes real
> bugs** — it does not rebuild what already works.

Date: 2026-06-08 · Branch: `claude/sharp-lovelace-nC2J3`

---

## 0. Executive summary of the audit

The classes system is **far more mature than a greenfield**. The canonical model
is the **`ClassOffering`** family (not the legacy `Course` family). The student
catalog, detail/enrollment, confirmation, admin dashboard, review, roster, and
instructor authoring already exist and were recently polished (commits
`fa89c80`, `01b3dba`, people-suite primitives). Therefore the right move is
**surgical**: a shared status/derivation layer, a publish-readiness checklist,
a class reports page, security/bug fixes, and connective tissue (notifications,
fit-check persistence, progress visibility, empty/trust copy) — all additive,
reusing existing primitives, with **no destructive migrations**.

---

## 1. Current classes system audit

### Two parallel systems (important)
- **Legacy `Course` family** — `Course`, `Enrollment` (string status),
  `WaitlistEntry`, `CourseReview`, `CourseInstructor`, `AttendanceSession`,
  `AttendanceRecord`. Routes: `/courses` (now **redirects** to `/curriculum`),
  `/my-courses` (legacy, deprecated), `/instructor/analytics/attendance/[courseId]`,
  `/instructor/engagement/[courseId]`, `/instructor/duplicate-course`,
  `/api/courses/*`. **Status: legacy, being retired. Do not extend.**
- **Canonical `ClassOffering` family** — `ClassTemplate` → `ClassOffering` →
  `ClassSession` / `ClassEnrollment` / `ClassAttendanceRecord` / `ClassReminder` /
  `ClassAssignment` / `ClassAnnouncement`, plus `ClassOfferingApproval` and
  `ClassOfferingTimelineEvent` (audit). **This is the heart of the platform.**

### Existing public/student class routes (`ClassOffering`)
- `/curriculum` — **student class catalog** (`app/(app)/curriculum/page.tsx`).
  Filters by learner-fit level, interest area, delivery mode, semester; search;
  capacity/waitlist badges; recommendations; chapter-local boost. Auth-gated.
- `/curriculum/[id]` — **class detail + enrollment** (`page.tsx` + `client.tsx`).
  "Guided Fit Check" modal → `enrollInClass`; waitlist; drop; instructor overlay
  (session manager + roster); progress bar; `enrollment-confirmation.tsx` modal.
- `/curriculum/recommended`, `/curriculum/schedule` — student discovery/schedule.
- `/my-classes` — **student hub** (`page.tsx`): active + waitlisted classes,
  upcoming sessions, due assignments, announcements, recommendations.
- `/pathways/[id]` — pathway steps surface linked offerings with enroll buttons.
- `/parent` — parent portal lists available offerings (`ParentEnrollOffering`).
- `/courses` → redirects to `/curriculum?notice=legacy-courses-root`.

### Existing admin class routes (`ClassOffering`)
- `/admin/classes` — operations dashboard (`page.tsx` + `class-operations-list.tsx`):
  stat cards (awaiting review / ready to publish / open / full-waitlist /
  logistics gaps), 6 tabs, enrollment meters, action-flag pills, cursor paging.
- `/admin/classes/[id]` — detail: status, instructor (reassign), partner,
  schedule, location/arrival/materials, capacity, curriculum, publishing
  controls, quick links, activity, **timeline audit log**.
- `/admin/classes/[id]/review` — approval panel (approve / request revisions /
  reject) over `ClassOfferingApproval`.
- `/admin/classes/[id]/roster` — roster grouped by status (confirmed / waitlisted
  / dropped / completed), capacity editor, promote-from-waitlist, duplicate
  detection, parent/guardian info.
- `/admin/course-library` — `ClassTemplate` catalog instructors clone from.

### Existing instructor class routes
- `/instructor/workspace` — instructor hub (curricula, lesson plans, offerings,
  readiness). Primary "my classes" surface for teachers.
- `/instructor/class-settings` — **create/edit `ClassOffering`** (select template,
  schedule, delivery, location, zoom, intro video, capacity, reminders, semester),
  request approval, publish (gated on readiness + approval).
- `/instructor/curriculum-builder` — template/curriculum authoring.
- `/curriculum/[id]` — instructor overlay: `session-manager.tsx` (session edit +
  attendance), enrolled roster table, announcements.
- Legacy/`Course`-only and **broken for `ClassOffering`**:
  `/instructor/analytics/attendance/[courseId]`, `/instructor/engagement/[courseId]`,
  `/instructor/duplicate-course/[courseId]`.

### Existing class data models (schema highlights)
- `ClassOffering`: title, startDate, endDate, meetingDays[], meetingTime, timezone,
  deliveryMode (`DeliveryMode`: IN_PERSON|VIRTUAL|HYBRID), location fields, zoomLink,
  intro video fields, capacity, enrollmentOpen, reminders, `status`
  (`ClassOfferingStatus`: DRAFT|PUBLISHED|IN_PROGRESS|COMPLETED|CANCELLED),
  chapterId, partnerId, semester, grandfatheredTrainingExemption, instructorId.
- `ClassTemplate`: title, description, interestArea, difficultyLevel, learnerFit,
  prerequisites[], weeklyTopics, learningOutcomes[], durationWeeks, sessionsPerWeek,
  min/ideal/maxStudents, deliveryModes[], targetAgeGroup, classDurationMin, etc.
- `ClassSession`: sessionNumber, date, startTime, endTime, topic, description,
  learningOutcomes[], milestone, materials/recording/notes URLs, isCancelled.
- `ClassEnrollment`: studentId (**FK to `User` — account-based, not guest signup**),
  offeringId, `status` (`ClassEnrollmentStatus`: ENROLLED|WAITLISTED|DROPPED|
  COMPLETED), enrolledAt, droppedAt, completedAt, sessionsAttended,
  outcomesAchieved[], instructorNotes, waitlistPosition.
- `ClassAttendanceRecord`: sessionId, studentId, `status`
  (`AttendanceStatus`: PRESENT|ABSENT|LATE|EXCUSED), notes, checkedInAt.
- `ClassOfferingApproval`: status (`ClassOfferingApprovalStatus`: NOT_REQUESTED|
  REQUESTED|UNDER_REVIEW|APPROVED|CHANGES_REQUESTED|REJECTED), request/review notes.
- `ClassOfferingTimelineEvent`: append-only audit (`ClassOfferingTimelineKind`).

### Existing enrollment/signup model
- Account-based: a logged-in **student** enrolls themselves via `enrollInClass`.
  No anonymous/guest signup (all routes are behind `(app)` auth). Parents enroll
  linked students via the parent portal. Race-safe seat allocation handles
  capacity/waitlist.

### Existing roster/attendance models
- Roster = `ClassEnrollment` rows grouped by status (admin roster page + instructor
  overlay table). Attendance = `ClassAttendanceRecord` per `ClassSession`, recorded
  from `session-manager.tsx` via `recordClassAttendance`.

### Existing class components
- Shared primitives (**reuse these**): `components/empty-state.tsx`,
  `components/loading-states.tsx`, `components/error-boundaries.tsx`,
  `components/data-table.tsx`, `components/people-strategy/people-suite.tsx`
  (`PeopleAvatar`, `IdentityCell`, `Meter`, `SuiteChip`, `CertChip`),
  `components/parent-enroll-offering.tsx`.
- Co-located: `admin/classes/class-operations-list.tsx`,
  `curriculum/[id]/client.tsx`, `curriculum/[id]/enrollment-confirmation.tsx`,
  `curriculum/[id]/session-manager.tsx`.

### Existing class forms
- Create/edit offering: `instructor/class-settings/client.tsx`.
- Enrollment fit-check: `curriculum/[id]/client.tsx`.
- Admin inline forms: capacity, logistics, reassign instructor, enrollment status,
  approval decisions.

### Existing class API / server actions
- `lib/class-management-actions.ts` — `createClassOffering`, `updateClassOffering`,
  `publishClassOffering`, `enrollInClass`, `dropClass`, `recordClassAttendance`,
  `updateClassSession`, `markOutcomeAchieved`, `enrollStudentInOffering`.
- `lib/admin-class-operations.ts` — admin publish/unpublish/close/reopen/cancel/
  complete/capacity/logistics/reassign/promote/enrollment-status, all journaled.
- `lib/offering-approval-actions.ts` — request/approve/revise/reject approval.
- `lib/class-seat-allocation.ts` — `takeSeatRaceSafe`, `dropAndPromoteRaceSafe`,
  `promoteNextWaitlistedRaceSafe` (serializable + retry).
- `lib/class-visibility.ts` — `publicOfferingWhere`, `isOfferingPubliclyVisible`.
- `lib/class-offering-timeline.ts` — audit journaling.
- `lib/student-class-portal.ts` — catalog, recommendations, my-classes data.
- `lib/people-strategy/class-tracker.ts` — read-only leadership Classes feed.
- Tests: `tests/lib/{admin-class-operations,class-seat-allocation,enroll-in-class,
  class-enrollment-visibility,class-offering-timeline,people-strategy-class-tracker}.test.ts`.

### Current class lifecycle (as built)
Template (draft → submitted → approved) → instructor creates offering (DRAFT) →
requests approval → admin approves (`ClassOfferingApproval=APPROVED`) → admin (or
instructor) publishes (`status=PUBLISHED`, `enrollmentOpen=true`) → students
discover on `/curriculum` → enroll/waitlist (race-safe) → confirmation modal →
roster fills → instructor runs sessions + records attendance → admin marks
`IN_PROGRESS`/`COMPLETED` → timeline journals every step.

### Current signup flow
`/curriculum` → `/curriculum/[id]` → "Guided Fit Check" modal → `enrollInClass`
(`ENROLLED` or `WAITLISTED` + position) → `EnrollmentConfirmation` modal → land on
`/my-classes`.

### Current admin workflow
`/admin/classes` ops dashboard → tab/triage → `/admin/classes/[id]` (detail) /
`[id]/review` (approve) / `[id]/roster` (manage seats) → status controls →
timeline records everything.

### Current instructor workflow
`/instructor/workspace` → `/instructor/class-settings` (author offering) → request
approval → publish → `/curriculum/[id]` overlay to run sessions + attendance.

---

## 2. Current broken / weak areas (the gap list this pass targets)

| # | Area | Problem | Severity |
|---|------|---------|----------|
| B1 | Attendance security | `recordClassAttendance` checks role only, **not** offering ownership; any instructor could mark attendance for any class. | **High (security)** |
| B2 | Attendance UI bug | `session-manager.tsx` offers `TARDY`; enum/server is `LATE` → status silently wrong. | High |
| B3 | Publish readiness | No unified pre-publish checklist; field validation scattered across instructor form / approval / admin publish; instructors discover gaps late. | High |
| B4 | Class reports | No `/admin/classes/reports`; leadership can't see pipeline / enrollment health / subject demand / instructor load. | High |
| B5 | Fit-check discarded | Student goal + note collected in modal but never persisted or shown to instructor. | Medium |
| B6 | Waitlist promotion silent | Auto-promotion (`dropAndPromoteRaceSafe`) sends no notification to the promoted student. | Medium |
| B7 | Student progress | Attendance/outcomes recorded but no student-facing progress view. | Medium |
| B8 | Public status labels | Status badges derived ad hoc per surface; risk of contradictory states ("Open" + "closed"). No single source of truth for public labels. | Medium |
| B9 | Empty/trust copy | Some surfaces use thin empty states; trust copy ("free enrichment", "student instructor") uneven. | Low |

---

## 3. Proposed ideal class lifecycle (target)

Keep the existing lifecycle; make each transition **legible and connected**:
idea → template → review → instructor assigned → schedule confirmed → published →
discovered → signed up → enrolled/confirmed → waitlist handled → roster generated →
instructor sees roster → class runs → attendance recorded → completed → feedback →
outcome recorded → repeat/archive. Every class has a status; every signup has a
status; every surface derives **public** status from one helper.

---

## 4. Proposed route architecture (additive only)

- **Reuse** all existing routes (`/curriculum`, `/curriculum/[id]`, `/my-classes`,
  `/admin/classes/*`, `/instructor/class-settings`, `/instructor/workspace`).
- **Add** `/admin/classes/reports` — read-only class reports.
- No renames, no deletions, no new public/unauthenticated routes this pass
  (the app is intentionally auth-gated; a marketing catalog is out of scope).

## 5. Proposed component architecture (reuse-first)

- **Add** `lib/class-status.ts` — single source of truth for **public** class
  status derivation (Open / Almost Full / Full / Waitlist Available / Registration
  Closed / Starts Soon / Running / Completed) + tone, from an offering + counts.
- **Add** `lib/class-publish-readiness.ts` — pure function returning the
  "missing before publish" checklist for an offering.
- **Add** `components/classes/publish-readiness-checklist.tsx` — presentational
  checklist (reused on admin detail + instructor settings).
- **Add** `components/classes/public-class-status-badge.tsx` — thin badge over
  `lib/class-status.ts`.
- **Reuse** people-suite `Meter`/`SuiteChip`/`IdentityCell`, `EmptyState`.

## 6. Proposed data model improvements (no destructive migration)

- **No schema change required** for the core pass. Public statuses are **derived**,
  not stored (matches existing `class-visibility` convention).
- Fit-check persistence (B5) reuses the **existing** `ClassEnrollment.instructorNotes`
  field — no migration.
- Class feedback (optional, deferred): if added, an **additive** `ClassFeedback`
  model with all-nullable/defaulted columns; documented as a follow-up so this pass
  stays safe. Not required to land this pass.

---

## 7. Implementation phases (this pass)

- **Phase 1 — Plan & foundation:** this doc (commit), then `lib/class-status.ts`
  + `PublicClassStatusBadge` (single source of truth).
- **Phase 2 — Security/bug fixes:** B1 (attendance ownership), B2 (TARDY→LATE).
- **Phase 3 — Publish readiness:** `lib/class-publish-readiness.ts` +
  `PublishReadinessChecklist`, surfaced on admin detail + instructor settings.
- **Phase 4 — Class reports:** `/admin/classes/reports` (pipeline, enrollment
  health, upcoming, subject demand, instructor teaching) with real data + empty
  states; link from `/admin/classes`.
- **Phase 5 — Connective tissue:** B6 (waitlist-promotion notification),
  B5 (fit-check persistence → instructor roster), B7 (student progress visibility).
- **Phase 6 — Polish & QA:** empty/trust copy, status badge application, mobile
  check; run typecheck/lint/build/tests.

Each phase = one or more micro-commits.

---

## 8. Risks

- **Conflict with recent overhaul.** Mitigation: additive files + surgical edits;
  no rewrite of `class-operations-list.tsx`/catalog markup beyond wiring helpers.
- **Status double-derivation.** Mitigation: `lib/class-status.ts` is additive and
  applied where surfaces already compute status, replacing ad-hoc logic only when
  low-risk.
- **Security regressions.** Mitigation: ownership check mirrors the existing
  `updateClassSession` gate; covered by a new test.
- **Build/typecheck cost.** Large app; mitigation: run `typecheck` + targeted
  `vitest` before each push; full `build` at the end.
- **Notifications noise.** Mitigation: reuse existing notification helper + types;
  no new email sending (screen + in-app only) to avoid false "you'll get an email".

## 9. Rollback plan

- All work is on `claude/sharp-lovelace-nC2J3` in **micro-commits**; any single
  change reverts via `git revert <sha>` without touching others.
- New files (`lib/class-status.ts`, `lib/class-publish-readiness.ts`,
  `components/classes/*`, `/admin/classes/reports`) are isolated; deleting/reverting
  them removes the feature cleanly.
- No destructive schema migrations → no data rollback needed.
- Edits to existing files (attendance fix, session-manager, signup wiring) are
  small, localized hunks that revert cleanly.

## 10. QA checklist

- `npm run typecheck`, `npm run lint`, targeted `npx vitest run`, `npm run build`.
- Public catalog: loads; filters work; Open/Full/Waitlist/Closed labels correct &
  non-contradictory; mobile cards.
- Detail: CTA logic matches status; full→waitlist; closed→closed; completed shows
  completed.
- Signup: validation; success creates `ClassEnrollment`; confirmation modal; full +
  waitlist enabled → waitlist; idempotent re-enroll; fit-check note reaches roster.
- Admin: dashboard + filters; detail; **publish readiness checklist** blocks &
  explains; roster; reports load with real data + empty states; no student PII public.
- Instructor: sees only own classes; roster loads; **attendance gated to own
  offering**; PRESENT/ABSENT/LATE/EXCUSED save.
- Security: public can't see rosters; non-admin can't hit `/admin/classes/*`;
  instructor can't record attendance for another instructor's class.
- Final: no broken nav; no TS/lint errors; build passes.

---

## 11. Out of scope (explicitly not touched)

Mentorship, Action Tracker internals, leadership pathway, broad admin dashboard,
legacy `Course`/`Enrollment` system (left as-is; `/courses` already redirects),
email sending infrastructure, anonymous marketing catalog, and any non-class system.
