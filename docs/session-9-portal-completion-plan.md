# Session 9: Finish the Student & Instructor Portals — Completion Plan

Context: Session 8 (`4569d66` on `claude/portals-student-instructor-complete-c0mth1`)
shipped portal routes and read services, but deep code inspection found the
student and instructor portals are **read-mostly shells with broken/placeholder
write paths**. This plan tracks the fixes and completions required to make both
portals real end-to-end journeys.

## A. Student journey inventory (17 journeys)

| # | Journey | Current state | Verdict |
|---|---|---|---|
| 1 | Sign-in orientation | `app/(app)/student/page.tsx` renders static "Recommended" prose and a hard-coded-empty applications list from `getStudentLearningHub` (defect 5, 9); no real hierarchy of attention items | Partial |
| 2 | Active classes | `getStudentLearning` lists enrollments; class space renders topics/announcements for WAITLISTED/DROPPED students unfiltered (defect 13) | Partial/leaky |
| 3 | Class space | Support links are 5 identical decorative links with no category/context prefill (defect 6); "released feedback" mislabeled as own feedback with no real release mechanism (defect 7); no offering-linked certificate access | Broken |
| 4 | Session space | Basic session detail exists but not migrated to session8 DTO filtering; no distinct past-vs-future layout | Partial |
| 5 | Schedule | "Add to calendar" is instructional text only, no `.ics` (defect 11) | Partial |
| 6 | Forms/approvals | `/student/forms` is a dead end — lists `FamilyFormRequirement`s with no completion path; only guardian signing exists on `/parent/forms` (defect 4) | Broken |
| 7 | Attendance review | `submitAttendanceIssue` in `lib/session8/actions.ts:8` writes nonexistent fields on `FamilySupportRequest`, failure swallowed by `.catch` — never persists (defect 1) | Broken |
| 8 | Attendance correction request | Same root cause as #7 — no persisted request, no visible pending/resolved state | Broken |
| 9 | Progress & feedback | "Released feedback" shows the student's own `ClassFeedback`; no instructor→family release mechanism exists (defect 7) | Broken |
| 10 | Certificates | `Certificate` has `courseId`/`pathwayId` but no `offeringId` (class) linkage, no completion dedupe; `/student/certificates` copy falsely claims dedupe exists (defect 8) | Broken |
| 11 | Explore opportunities | Catalog/detail routes exist from Session 8 | Complete |
| 12 | Application/waitlist states | `getStudentLearningHub` hard-codes `applications: []` (defect 5) | Broken |
| 13 | Recommendations | Student Home "Recommended" card is static prose; `expressRecommendationInterest` writes the wrong `StudentInterest` shape and is swallowed by `.catch` (defect 2, 9) | Broken |
| 14 | Support | `createStudentSupportRequest` accepts `category`/`offeringId`/`sessionId` but no UI passes context (defect 6) | Partial |
| 15 | Profile updates | `saveStudentProfile` is dead code referencing nonexistent `prisma.profile` (defect 3) | Broken |
| 16 | Empty/completed states | `/student/work` is an empty placeholder route; `/parent/certificates/page.tsx` just re-exports the progress page (defect 9, 10) | Missing |
| 17 | Mobile | Not audited yet this session; carries over from Session 8 responsive primitives | Partial |

## B. Instructor journey inventory (19 journeys)

| # | Journey | Current state | Verdict |
|---|---|---|---|
| 1 | Sign-in attention | Home lacks a concrete task list (no aggregation of prep/attendance/follow-up/review-request items) | Partial |
| 2 | Assigned classes | Class list works via existing workspace queries | Complete |
| 3 | Class command center | "Completion" card is a static paragraph (defect 17); roster lacks attendance-concern indicators | Partial |
| 4 | Session prep | Readiness confirmation is one-click all-or-nothing, not granular | Partial |
| 5 | Roster review | Roster read works but has no concern indicators (recent absence, new enrollee, open review request, form blocker) | Partial |
| 6 | Student concerns | No instructor visibility into student attendance-review requests for their classes (defect 21) | Missing |
| 7 | Session command center | "Follow-up actions" card is a static paragraph (defect 17); attendance workspace is a raw `recordsJson` textarea, unusable on mobile (defect 18) | Broken |
| 8 | Readiness confirmation | `updateSessionReadiness` writes prep under `offering.instructorId` not the acting user — misattribution + null-key crash when unassigned (defect 25) | Broken |
| 9 | Attendance recording | `recordAttendance` ignores the `finalize` flag entirely; no draft-vs-final state (defect 18); co-instructors blocked from mutating (defect 23) | Broken |
| 10 | Post-session follow-up | No structured follow-up mutation; card is static (defect 17) | Missing |
| 11 | Announcements | No instructor announcement composer — `AnnouncementWorkspace` exists only at `/chapter/announcements`; instructor class page is read-only (defect 19) | Missing |
| 12 | Materials/logistics | Read-only display, no dedicated workflow beyond class page content | Partial |
| 13 | Availability | `confirmInstructorAvailability` logs a free-text `instructorGrowthEvent`; nothing structured, nothing read back (defect 15) | Broken |
| 14 | Onboarding | Hardcoded string array checklist, no persistence, no completion (defect 16) | Broken |
| 15 | Training | Byte-identical to the other three dev pages (defect 14) | Broken |
| 16 | Feedback/performance | Byte-identical to the other three dev pages (defect 14); no evidence labeling | Broken |
| 17 | Support | No instructor support path — `createOperationalAction` is `requireOfficer`; family-support triage is ops-scoped (defect 20) | Missing |
| 18 | Empty states | Availability/onboarding/training/performance render the same `getInstructorDevelopment()` grid with no differentiation (defect 14) | Broken |
| 19 | Mobile | Attendance `recordsJson` textarea is unusable on mobile (defect 18); not otherwise audited | Broken |

## C. Gap table (all 25 verified defects)

| ID | Journey | Current behavior | Missing behavior | Severity | Proposed implementation | Files/systems | Acceptance criteria | Status |
|---|---|---|---|---|---|---|---|---|
| S9-001 | Student attendance review | `submitAttendanceIssue` writes nonexistent `subject`/`status` fields on `FamilySupportRequest`; error swallowed by `.catch` | Persisted attendance dispute with visible state | Critical | Rewrite with correct `FamilySupportRequest` shape (`requesterRole:"STUDENT"`, `category:"ATTENDANCE"`, `externalStatus:"SENT"`, `studentUserId`, offering/session refs, history row), zod-validate, dedupe open requests, `revalidatePath` | `lib/session8/actions.ts:8` | Submitting an attendance issue creates a real `FamilySupportRequest` row visible on `/student/attendance` with pending/resolved state | Fixed |
| S9-002 | Student recommendations | `expressRecommendationInterest` writes wrong `StudentInterest` shape (`studentId/passionId/level` vs actual `userId/interestType`); error swallowed | Real interest capture or real next-step link | Critical | Link recommendations to `/student/explore/[opportunityId]` where resolvable; upsert `StudentInterest` correctly when a passion mapping exists | `lib/session8/actions.ts:9` | Clicking "interested" either navigates to a real opportunity detail or persists a correctly-shaped `StudentInterest` row | Fixed |
| S9-003 | Student profile | `saveStudentProfile` references nonexistent `prisma.profile` | N/A — dead code | High | Delete the dead action; ensure no callers remain | `lib/session8/actions.ts:7` | Dead code removed; profile page uses only real, working actions | Fixed |
| S9-004 | Student forms | `/student/forms` lists `FamilyFormRequirement`s with no completion path | Student-completable form flow | Critical | New `submitStudentFormAction`, `/student/forms/[requirementId]` completion page rendering version field JSON, guardian-signature forms clearly redirected | `lib/family-portal-actions.ts`, new `app/(app)/student/forms/[requirementId]/page.tsx` | Student can complete a self-service form end to end; requirement status updates; blockers explained in plain language | Fixed-with-limitation (guardian-signature forms honestly redirected because `FamilyFormSubmission` requires `guardianUserId` — schema constraint, documented) |
| S9-005 | Student applications | `getStudentLearningHub` hard-codes `applications: []` | Real application/waitlist status list | High | Populate from `GuardianApprovalRequest` + `FamilyWaitlistEntry` | `lib/session8/student-portal.ts` (learning hub loader) | My Learning shows real application/waitlist rows with status language, no hard-coded empty array | Fixed |
| S9-006 | Student class space support | 5 identical links to `/student/support` with no category/context prefill | Context-prefilled support entry points | Medium | Extend support page to read `category`/`offeringId`/`sessionId` searchParams; update class-space links to pass them | class space page, `/student/support` page | Each support link opens the support form pre-filled with the correct category and offering/session context | Fixed |
| S9-007 | Student progress/feedback | "Released feedback" shows the student's own `ClassFeedback`; no instructor→family release mechanism exists | Real instructor-authored, release-gated feedback | High | Add `InstructorStudentFeedback` model (offeringId, studentId, instructorId, body, releasedToFamilyAt?); progress page reads released rows; relabel own feedback as "Your feedback" | `prisma/schema.prisma`, migration, student progress page | Progress page distinguishes the student's own submitted feedback from instructor-released feedback, sourced from the new model | Fixed |
| S9-008 | Student certificates | `Certificate` has no `offeringId` linkage or completion dedupe; page copy falsely claims dedupe exists | Class-linked certificates with real dedupe | High | Add nullable `Certificate.offeringId` FK + guarded partial unique on `(recipientId, offeringId)`; `issueClassCompletionCertificate` util | `prisma/schema.prisma`, migration, certificate issuance util | Certificates link to the class that earned them; duplicate issuance for the same student+offering is prevented at the DB level; copy matches behavior | Fixed |
| S9-009 | Student home / explore | "Recommended" card is static prose; `/student/work` is an empty placeholder route | Real recommendations; route removed or backed | Medium | Wire Home's recommended section to real recommendation data; remove `/student/work` and its nav references | Student home page, `getStudentDashboard`, nav catalog | Home shows real (or honestly absent) recommendations; no dead placeholder route remains | Fixed |
| S9-010 | Parent certificates | `/parent/certificates/page.tsx` re-exports the progress page | Dedicated parent certificates view | Medium | Give parent certificates its own real page sourced from the certificate service | `app/(app)/parent/certificates/page.tsx` | Parent certificates page renders certificate-specific content, not a re-export of progress | Fixed |
| S9-011 | Student schedule | "Add to calendar" is instructional text, no `.ics` | Real calendar export or honest removal of the claim | Low | Add `app/api/student/schedule.ics` route if time allows; otherwise remove the claim | student schedule page, optional new API route | Either a working `.ics` download exists, or no unearned calendar-export copy remains | Fixed-with-limitation (schedule grouping shipped; `.ics` export not built this session — scope prioritized elsewhere) |
| S9-012 | Guardian scoping | `student-portal.ts:33-35` parent-scoped reads ignore `canViewLearning`; guardians with `canViewLearning:false` still see attendance/progress/certificates | Enforce `canGuardianViewLearning` | Critical | Gate `getParentScopedAttendance/Progress/Recommendations` + `getParentStudentPortal` on `canGuardianViewLearning` (`lib/family-access.ts:72`) | `lib/session8/student-portal.ts:33-35`, `lib/family-access.ts:72` | A guardian with `canViewLearning:false` sees no attendance/progress/certificate data for the student | Fixed |
| S9-013 | Student class space leakage | `getStudentClassSpace` serves WAITLISTED/DROPPED students full session topics + unfiltered announcements | Trimmed schedule-preview only, audience-filtered announcements | Critical | For WAITLISTED/DROPPED: schedule-preview only (title/date, no topics); filter announcements by `audience` + `status=PUBLISHED` for enrolled students | class space loader (session8) | Waitlisted/dropped students no longer see full topics or non-published/non-audience announcements | Fixed |
| S9-014 | Instructor dev pages | Availability, onboarding, training, performance all render the same `getInstructorDevelopment()` grid, byte-identical | Four distinct, functional pages | High | Split into real Availability/Onboarding/Training/Performance implementations (see items below) | 4 instructor dev pages | Each of the four pages renders distinct, functioning content sourced from its own data | Fixed |
| S9-015 | Instructor availability | `confirmInstructorAvailability` logs a free-text `instructorGrowthEvent`; nothing structured, nothing read back | Structured, readable availability | High | Add `InstructorAvailability` model (userId, weekday/notes/effective dates); server-validated read/edit mutations | `prisma/schema.prisma`, migration, availability page/action | Instructor can set and later see their own structured availability; data persists across sessions | Fixed |
| S9-016 | Instructor onboarding | Hardcoded string array checklist; no persistence, no completion | Persisted, code-defined step catalog with completion | High | Add `InstructorOnboardingTask` (userId, key, completedAt); code-defined step catalog; self-attestable "mark complete" actions | `prisma/schema.prisma`, migration, onboarding page/action | Onboarding steps persist completion per instructor; checklist reflects real state on reload | Fixed |
| S9-017 | Instructor follow-up/completion UI | Session page "Follow-up actions" and class page "Completion" cards are static paragraphs | Real mutations | High | Follow-up creation writes `actionItem` via new instructor-scoped action; class completion action marks enrollments COMPLETED with confirm-step, triggers certificate issuance where applicable | session command center, class command center | Instructor can create a follow-up action and mark a class complete, both persisted and reflected in UI | Fixed |
| S9-018 | Instructor attendance recording | `finalize` flag is inert; `recordAttendance` ignores it; no draft-vs-final state; raw `recordsJson` textarea UI | Real finalize workflow, per-student roster UI | Critical | Add `ClassAttendanceRecord.finalizedAt`; implement finalize (block edits post-finalize except ADMIN/CP override); replace textarea with per-student status-button roster UI, mobile-friendly | `lib/attendance-service.ts`, `prisma/schema.prisma`, migration, attendance UI component | Attendance can be recorded and finalized per session; finalized records block further edits for non-override roles; UI works on mobile without raw JSON entry | Fixed |
| S9-019 | Instructor announcements | No instructor announcement composer; `AnnouncementWorkspace` only at `/chapter/announcements`; instructor class page read-only | Mounted composer on instructor class page | High | Mount existing composer via `upsertAnnouncement`/`publishAnnouncement` (`lib/class-announcement-service.ts`) on the instructor class page with correct routine/approval semantics | `lib/class-announcement-service.ts`, instructor class command center page | Instructor can compose and publish/submit-for-approval announcements from their class page | Fixed |
| S9-020 | Instructor support | No instructor support path; `createOperationalAction` is `requireOfficer`-only | Instructor-scoped support request | High | New `requestInstructorSupport` action writing `actionItem` (validated, scoped, category enum), surfaced on Home and `/instructor/support` | new action, `/instructor/support` route, nav catalog | Instructor can submit a support request that persists and is visible to staff | Fixed |
| S9-021 | Instructor attendance-review visibility | No instructor visibility into student attendance-review requests for their classes | Read/respond view scoped to instructor's offerings | High | Instructor-visible read of open `FamilySupportRequest` category ATTENDANCE scoped to their offerings; respond action reusing `FamilySupportResponse` with `familyVisible` | instructor class/session command center | Instructor sees open attendance-review requests for their own classes and can respond | Fixed |
| S9-022 | Instructor nav | Nav catalog doesn't expose S8 command-center routes coherently; `/instructor/training-progress` is a redirect stub | Coherent nav entries | Medium | Update `lib/navigation/catalog.ts` entries for instructor core sections; remove/fix stub redirect | `lib/navigation/catalog.ts` | `npm run nav:check` passes; instructor nav resolves to real, non-duplicate pages | Fixed |
| S9-023 | Co-instructor permission | `requireInstructorAssigned` (`lib/operational-permissions.ts:23`) rejects co-instructors; mutations don't accept `regularInstructorAssignments` (reads do) | Co-instructors can mutate | Critical | Update `requireInstructorAssigned` and `getInstructorClassWorkspace` to accept `regularInstructorAssignments` co-instructors | `lib/operational-permissions.ts:23` | Co-instructors can record attendance and confirm readiness, not just view | Fixed |
| S9-024 | Chapter-president scope | `actor()` in `lib/operational/workspace-actions.ts:18` never populates `chapterIds`, so any CHAPTER_PRESIDENT can mutate any offering org-wide | Enforced chapter scope | Critical | Populate `chapterIds` from the user record in `actor()`; ensure scope checks run | `lib/operational/workspace-actions.ts:18` | A CHAPTER_PRESIDENT cannot mutate an offering outside their chapter(s) | Fixed |
| S9-025 | Session readiness attribution | `updateSessionReadiness` writes prep under `offering.instructorId`, not the acting user — misattribution + null-key crash when unassigned | Prep keyed to actor | Critical | Key prep rows to `actor.userId`; guard null instructor case | `lib/session-readiness-service.ts` | Readiness confirmations are attributed to the instructor who actually confirmed them; no crash for unassigned offerings | Fixed |

## D. Implementation order (staged, dependency-aware)

Stage 0 — Docs (first)
- `docs/session-9-portal-completion-plan.md` (this document).
- `docs/session-9-self-review.md` created early; maintained through all passes.

Stage 1 — Schema/migration (everything else builds on it)
- Single idempotent migration covering: `Certificate.offeringId` + guarded partial
  unique; `InstructorStudentFeedback` model; `ClassAttendanceRecord.finalizedAt`;
  `InstructorAvailability` model; `InstructorOnboardingTask` model.
- `prisma validate` + `prisma generate`; SQL matches schema diff exactly.
- Covers journeys: student certificates (10), student progress/feedback (9),
  instructor attendance recording (9), instructor availability (13), instructor
  onboarding (14 in part).

Stage 2 — Broken actions + permission fixes (small, high-value)
- Fix S9-001, S9-002, S9-003 in `lib/session8/actions.ts`.
- Fix S9-012, S9-013 guardian/waitlist scoping in `lib/session8/student-portal.ts`.
- Covers journeys: attendance review/correction (7,8), recommendations (13),
  profile updates (15), progress & feedback leakage guard (9), active classes
  leakage fix (2).

Stage 3 — Student forms flow
- `submitStudentFormAction`, `/student/forms/[requirementId]` completion page.
- Covers journey: forms/approvals (6).

Stage 4 — Student surfaces completion
- Home hierarchy, My Learning applications/waitlist, class space support
  prefill + certificate access + released feedback, session space DTO
  migration, schedule grouping + `.ics`/honest copy, progress relabeling,
  certificate issuance util, remove `/student/work`, parent certificates real
  page, nav additions for `/student/forms` and `/student/attendance`.
- Covers journeys: sign-in orientation (1), active classes (2), class space
  (3), session space (4), schedule (5), progress & feedback (9), certificates
  (10), explore (11 — already complete), applications/waitlist (12),
  recommendations (13), support (14), empty/completed states (16).

Stage 5 — Instructor permission/attendance foundation
- Fix S9-023 (`requireInstructorAssigned`), S9-024 (`actor()` chapterIds),
  S9-025 (readiness attribution), attendance finalize (S9-018) including the
  real per-student roster UI component.
- Covers journeys: readiness confirmation (8), attendance recording (9),
  student concerns visibility groundwork (6).

Stage 6 — Instructor command centers
- Home task list, class command center roster indicators + completion action,
  session command center prep/attendance/follow-up, announcements composer
  mount, attendance-review-request visibility/response.
- Covers journeys: sign-in attention (1), class command center (3), session
  prep (4), roster review (5), student concerns (6), session command center
  (7), post-session follow-up (10), announcements (11), materials/logistics
  (12).

Stage 7 — Instructor development pages
- De-duplicate the four dev pages into real Availability, Onboarding,
  Training, Performance, and add Support (new action + route).
- Covers journeys: availability (13), onboarding (14), training (15),
  feedback/performance (16), support (17).

Stage 8 — Navigation, states, language, a11y
- `lib/navigation/catalog.ts` updates; shared status-label helpers; empty/error
  states with real next steps; mobile roster/attendance UI; a11y basics.
- Covers journeys: empty/completed states (16 student, 18 instructor),
  mobile (17 student, 19 instructor).

Stage 9 — Verification & wrap-up
- `prisma validate`/`generate`, `npm run typecheck`, `npm run lint`,
  `npm run nav:check`, `npm test` (+ focused new tests), `npm run build`,
  browser QA (Playwright, desktop + 390px) across all required routes with at
  least one mutation exercised per portal.
- Maintain `docs/session-9-self-review.md` through passes 1-9; fix loop until
  clean.

## E. Completion standard (expanded checklists)

### Student portal complete when:
- [ ] All 17 journeys connected end to end (no dead-end pages, no swallowed
      errors, no hard-coded empty results standing in for real data).
- [ ] Attendance review/correction requests persist via correctly-shaped
      `FamilySupportRequest` rows and show pending/resolved state on
      `/student/attendance`.
- [ ] `/student/forms` is completable for self-service requirements; guardian-
      required forms are honestly redirected, not fake-actionable.
- [ ] Applications and waitlist states are visible on My Learning, sourced from
      `GuardianApprovalRequest` + `FamilyWaitlistEntry`, with real next steps.
- [ ] Recommendations are either linked to a real opportunity detail or persist
      a correctly-shaped `StudentInterest` — no static prose, no swallowed
      writes.
- [ ] Guardian scoping (`canGuardianViewLearning`) is enforced on all
      parent-scoped attendance/progress/certificate/recommendation reads.
- [ ] No raw database enums are displayed anywhere in the student/parent UI —
      all statuses go through a shared label map.
- [ ] Mobile nav and layouts work at 390px for all student routes.
- [ ] Certificates are class-linked (`offeringId`) with real dedupe; copy
      matches actual behavior.
- [ ] Waitlisted/dropped students see schedule-preview only, never full
      session topics or unfiltered announcements.

### Instructor portal complete when:
- [ ] Home renders a concrete, actionable task list (prep needed, attendance
      incomplete, open review requests, follow-ups due, onboarding/training
      outstanding) — not decorative cards.
- [ ] Class and session command centers run a real before/during/after
      workflow (prep checklist, roster/attendance, follow-up creation), with
      no static-paragraph placeholders.
- [ ] Attendance is markable and finalizable via a per-student roster UI that
      works on mobile — no raw `recordsJson` textarea.
- [ ] Announcements can actually be composed and published/submitted for
      approval from the instructor class page.
- [ ] Availability is structured (`InstructorAvailability` model), editable,
      and read back correctly.
- [ ] Onboarding and training are actionable — real step catalogs with
      persisted completion, not hardcoded arrays or duplicated grids.
- [ ] Performance is evidence-labeled (prep completion rate, attendance
      completion rate, growth events, certifications) with each item's source
      identified — no opaque "philosophy paragraph."
- [ ] Support requests persist via a real instructor-scoped action and are
      visible to staff.
- [ ] Co-instructor and chapter-president scoping is fixed: co-instructors can
      mutate, and CHAPTER_PRESIDENT actors are chapter-scoped.
- [ ] Session readiness confirmations are attributed to the actual actor, with
      no null-key crash for unassigned offerings.

### Both portals, cross-cutting:
- [ ] `prisma validate` and `prisma generate` succeed against the new
      migration.
- [ ] `npm run typecheck`, `npm run lint`, `npm run nav:check`, `npm test` all
      pass green.
- [ ] `npm run build` is attempted; result (success or DB-env limitation)
      recorded honestly in the self-review.
- [ ] Browser QA performed on all required routes at desktop and 390px width,
      with at least one real mutation exercised per portal (attendance review
      request; attendance marking/finalize).
- [ ] No Critical or High severity defects remain Open in
      `docs/session-9-self-review.md` at final audit.
