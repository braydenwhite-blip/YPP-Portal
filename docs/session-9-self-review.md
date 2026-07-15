# Session 9 Self Review

Created at session start and maintained during implementation.

## 0. Starting State

- Branch: `claude/portals-student-instructor-complete-c0mth1`
- Starting SHA: `4569d66`
- Working tree: clean at session start
- Baseline: Session 8 shipped portal routes and read services; Session 9 code
  inspection found the student and instructor portals are read-mostly shells
  with broken/placeholder write paths (25 verified defects — see
  `docs/session-9-portal-completion-plan.md` section C for the full inventory).

## 1. Starting Risk Inventory

- **Permission leakage — guardian scoping (S9-012)**: `lib/session8/student-portal.ts:33-35`
  parent-scoped reads ignore `canViewLearning`; guardians with
  `canViewLearning:false` still see attendance/progress/certificates unless
  gated on `canGuardianViewLearning` (`lib/family-access.ts:72`).
- **Permission leakage — waitlisted/dropped students (S9-013)**:
  `getStudentClassSpace` serves WAITLISTED/DROPPED students full session
  topics and unfiltered announcements with no `audience` filtering.
- **Permission leakage — co-instructors (S9-023)**: `requireInstructorAssigned`
  (`lib/operational-permissions.ts:23`) rejects co-instructors on mutation
  paths even though read queries accept `regularInstructorAssignments`.
- **Permission leakage — chapter scope (S9-024)**: `actor()` in
  `lib/operational/workspace-actions.ts:18` never populates `chapterIds`, so
  any CHAPTER_PRESIDENT can mutate any offering org-wide.
- **Misattribution/crash risk (S9-025)**: `updateSessionReadiness` writes prep
  under `offering.instructorId` instead of the acting user — misattribution
  plus a null-key crash risk when the offering is unassigned.
- **Silent-failure actions**: `submitAttendanceIssue` (S9-001) and
  `expressRecommendationInterest` (S9-002) in `lib/session8/actions.ts` write
  to the wrong model shapes and swallow the resulting Prisma errors in
  `.catch` blocks — both journeys appear to succeed in the UI while doing
  nothing server-side. Any fix must remove swallowed-error patterns and
  surface real failures.
- **Dead code risk**: `saveStudentProfile` (S9-003) references a nonexistent
  `prisma.profile` model; must confirm no live callers depend on it before
  deletion.
- **Migration risk on a ~14k-line schema**: `prisma/schema.prisma` is large
  and hand-maintained; the Session 9 migration must be a single idempotent
  file (`CREATE TABLE IF NOT EXISTS`, guarded `CREATE TYPE`/`ADD CONSTRAINT`
  blocks per CLAUDE.md) covering `Certificate.offeringId` + unique,
  `InstructorStudentFeedback`, `ClassAttendanceRecord.finalizedAt`,
  `InstructorAvailability`, `InstructorOnboardingTask`. SQL must match the
  schema diff exactly or `prisma migrate deploy` (run during `npm run build`)
  will fail.
- **`nav:check` constraints**: `scripts/validate-nav.mjs` enforces no
  duplicate hrefs/labels per role and resolvable routes; adding
  `/student/forms/[requirementId]`, `/instructor/support`, and de-duplicated
  instructor dev pages must not violate the core-link cap or create
  duplicates. `/instructor/training-progress` redirect stub (S9-022) needs
  resolution, not just a new entry alongside it.
- **Build risk**: `npm run build` runs `prisma migrate deploy` via
  `scripts/maybe-db-sync.mjs`, which requires `DATABASE_URL`/`DIRECT_URL`. If
  DB env is unavailable in this environment, build verification will be
  limited to `next build` alone and must be recorded honestly rather than
  claimed as full verification.

## 2. Issue Log

| ID | Severity | Portal | Journey | Evidence | Fix | Verification | Status |
|---|---|---|---|---|---|---|---|
| S9-001 | Critical | Student | Attendance review | `lib/session8/actions.ts:8` `submitAttendanceIssue` writes nonexistent `subject`/`status` fields on `FamilySupportRequest`; error swallowed by `.catch` | TBD | TBD | Open |
| S9-002 | Critical | Student | Recommendations | `lib/session8/actions.ts:9` `expressRecommendationInterest` writes wrong `StudentInterest` shape (`studentId/passionId/level` vs actual `userId/interestType`); error swallowed | TBD | TBD | Open |
| S9-003 | High | Student | Profile updates | `lib/session8/actions.ts:7` `saveStudentProfile` references nonexistent `prisma.profile` | TBD | TBD | Open |
| S9-004 | Critical | Student | Forms/approvals | `/student/forms` lists `FamilyFormRequirement`s with no completion path | TBD | TBD | Open |
| S9-005 | High | Student | Application/waitlist states | `getStudentLearningHub` hard-codes `applications: []` | TBD | TBD | Open |
| S9-006 | Medium | Student | Class space / support | 5 identical decorative links to `/student/support`, no category/context prefill | TBD | TBD | Open |
| S9-007 | High | Student | Progress & feedback | "Released feedback" shows the student's own `ClassFeedback`; no instructor→family release mechanism | TBD | TBD | Open |
| S9-008 | High | Student | Certificates | `Certificate` lacks `offeringId` linkage and completion dedupe; copy falsely claims dedupe exists | TBD | TBD | Open |
| S9-009 | Medium | Student | Sign-in orientation / empty states | Home "Recommended" card is static prose; `/student/work` is an empty placeholder route | TBD | TBD | Open |
| S9-010 | Medium | Student (Parent) | Certificates | `/parent/certificates/page.tsx` re-exports the progress page | TBD | TBD | Open |
| S9-011 | Low | Student | Schedule | "Add to calendar" is instructional text, no `.ics` | TBD | TBD | Open |
| S9-012 | Critical | Student (Parent) | Progress / attendance / certificates | `student-portal.ts:33-35` parent-scoped reads ignore `canViewLearning` | TBD | TBD | Open |
| S9-013 | Critical | Student | Class space | `getStudentClassSpace` serves WAITLISTED/DROPPED students full topics + unfiltered announcements | TBD | TBD | Open |
| S9-014 | High | Instructor | Availability/onboarding/training/performance | Four dev pages byte-identical, all render `getInstructorDevelopment()` | TBD | TBD | Open |
| S9-015 | High | Instructor | Availability | `confirmInstructorAvailability` logs free-text `instructorGrowthEvent`; nothing structured, nothing read back | TBD | TBD | Open |
| S9-016 | High | Instructor | Onboarding | Hardcoded string array checklist, no persistence, no completion | TBD | TBD | Open |
| S9-017 | High | Instructor | Post-session follow-up / class completion | Session "Follow-up actions" and class "Completion" cards are static paragraphs | TBD | TBD | Open |
| S9-018 | Critical | Instructor | Attendance recording | `finalize` flag inert; `recordAttendance` ignores it; raw `recordsJson` textarea, unusable on mobile | TBD | TBD | Open |
| S9-019 | High | Instructor | Announcements | No instructor announcement composer; instructor class page read-only | TBD | TBD | Open |
| S9-020 | High | Instructor | Support | No instructor support path; `createOperationalAction` is `requireOfficer`-only | TBD | TBD | Open |
| S9-021 | High | Instructor | Student concerns | No instructor visibility into student attendance-review requests for their classes | TBD | TBD | Open |
| S9-022 | Medium | Instructor | Navigation | Nav catalog doesn't expose S8 command-center routes coherently; `/instructor/training-progress` is a redirect stub | TBD | TBD | Open |
| S9-023 | Critical | Instructor | Attendance recording / readiness | `requireInstructorAssigned` rejects co-instructors on mutation paths | TBD | TBD | Open |
| S9-024 | Critical | Instructor | Class command center (scope) | `actor()` never populates `chapterIds`; CHAPTER_PRESIDENT can mutate any offering org-wide | TBD | TBD | Open |
| S9-025 | Critical | Instructor | Readiness confirmation | `updateSessionReadiness` writes prep under `offering.instructorId`, not the acting user | TBD | TBD | Open |

## 3. Review Passes

### Pass 1: Student Home / My Learning
- Status: Not started

### Pass 2: Student class / session / schedule / forms
- Status: Not started

### Pass 3: Student attendance / progress / certificates / recommendations / support
- Status: Not started

### Pass 4: Instructor Home / classes
- Status: Not started

### Pass 5: Instructor command centers (class + session)
- Status: Not started

### Pass 6: Instructor attendance / prep / comms / availability / onboarding / training / performance / support
- Status: Not started

### Pass 7: Permissions & data leakage
- Status: Not started

### Pass 8: Navigation / mobile / a11y / states
- Status: Not started

### Pass 9: Final audit
- Status: Not started

## 4. Verification Log

- `prisma validate`: (pending)
- `prisma generate`: (pending)
- `npm run typecheck`: (pending)
- `npm run lint`: (pending)
- `npm run nav:check`: (pending)
- `npm test`: (pending)
- `npm run build`: (pending)
- Browser QA (Playwright, desktop + 390px): (pending)

## Independent Final Audit

- Pending.
