# Portal Reliability Matrix

> Last updated: 2026-03-18
>
> Purpose: one step-by-step map for the most important portal workflows so product, engineering, QA, and admins all verify the same behavior.

## 1. Ground Rules

### Canonical systems
- Instructor and chapter-president hiring should use the recruiting system first:
  - `/chapter/recruiting`
  - `/positions`
  - `/applications`
- Legacy compatibility surfaces remain available during the transition:
  - `/application-status`
  - `/admin/instructor-applicants`
  - `/admin/chapter-president-applicants`

### Reliability rule
- Every user-visible state change should have all 5 things:
  1. one clear owning route or action
  2. one permission rule
  3. one persisted state change
  4. one user/admin notification expectation
  5. one analytics or audit expectation

### Shared analytics dimensions
- `dateRange`
- `chapterId`
- `interestArea`

If a record has no usable `interestArea`, analytics must place it in `Unmapped`.

---

## 2. Recruiting Workflow Matrix

### 2.1 Position lifecycle

| Step | State change | Owning route/action | Who may do it | Notification expectation | Analytics / audit expectation |
|---|---|---|---|---|---|
| Open position | no row -> `Position.isOpen=true` | `createPosition`, `createChapterPosition` | Admin; Chapter President for own chapter | none required immediately | `chapter_hiring_position_create` |
| Edit position | update position fields | `updateChapterPosition` | Admin; Chapter President for own chapter | none required immediately | `chapter_hiring_position_update` |
| Close position | `isOpen=true -> false` | `closeChapterPosition` | Admin; Chapter President for own chapter | none required immediately | `chapter_hiring_position_close` |
| Reopen position | `isOpen=false -> true` | `reopenChapterPosition` | Admin; Chapter President for own chapter | none required immediately | `chapter_hiring_position_reopen` |
| Change visibility | visibility update | `updatePositionVisibility` | Admin; Chapter President for own chapter | none required immediately | `chapter_hiring_position_visibility` |

### 2.2 Application lifecycle

| Step | State change | Owning route/action | Who may do it | Notification expectation | Analytics / audit expectation |
|---|---|---|---|---|---|
| Apply | no row -> `Application.status=SUBMITTED` | `submitApplication` | Authenticated applicant | reviewer notification; applicant confirmation email | applicant-facing record created; reviewer queue count increases |
| Start review | `SUBMITTED -> UNDER_REVIEW` | `updateApplicationStatus` from recruiting/application workspace | Admin; Chapter President or interviewer with permission | applicant receives status update | `chapter_hiring_application_status` |
| Interview scheduled | `UNDER_REVIEW -> INTERVIEW_SCHEDULED` | `postApplicationInterviewSlot`, `postApplicationInterviewSlotsBulk` | Admin; Chapter President or interviewer with permission | applicant notified of slot(s) | `chapter_hiring_interview_slot_posted` or `chapter_hiring_interview_slot_bulk_posted` |
| Interview confirmed | slot `POSTED -> CONFIRMED` | `confirmApplicationInterviewSlot` | Applicant | reviewers notified | applicant timeline shows confirmed interview |
| Interview cancelled | slot `POSTED/CONFIRMED -> CANCELLED` | `cancelApplicationInterviewSlot` | Admin; Chapter President or interviewer with permission | applicant notified | `chapter_hiring_interview_slot_cancelled` |
| Interview completed | slot `CONFIRMED -> COMPLETED`; app usually moves toward `INTERVIEW_COMPLETED` | `completeInterviewSlot`, `confirmInterviewSlot` follow-up path | Admin; Chapter President or interviewer with permission | applicant notified of completion/update | `chapter_hiring_interview_completed` |
| Structured note saved | note added with recommendation | `saveStructuredInterviewNote` | Admin; Chapter President or interviewer with permission | none required immediately | `chapter_hiring_interview_note` or `chapter_hiring_interview_completed_with_note` |
| Decision submitted | decision draft -> chair pending | `makeDecision`, `chapterMakeDecision` | Admin or same-chapter Chapter President for allowed roles | applicant notified that decision is under chair review; admins notified | `chapter_hiring_decision_submitted` |
| Decision approved | `PENDING_CHAIR -> APPROVED`; app -> `ACCEPTED` or `REJECTED` | `approveHiringDecision` | Admin acting as chair | applicant notified; decision submitter notified | `chapter_hiring_decision_approved` |
| Decision returned | `PENDING_CHAIR -> RETURNED` | `returnHiringDecision` | Admin acting as chair | decision submitter notified | `chapter_hiring_decision_returned` |

### 2.3 Recruiting blockers that must stay true
- A final decision cannot be approved twice.
- The same person cannot both submit and chair-approve a decision.
- If `position.interviewRequired=true`, the decision must stay blocked until:
  - at least one interview slot is `COMPLETED`
  - at least one interview note includes a recommendation
- Chapter Presidents can only act inside their own chapter and only for chapter-scoped position types.

### 2.4 Chapter-president hiring rule
- Canonical first-wave path: `Position.type=CHAPTER_PRESIDENT` through the recruiting system.
- Legacy CP application pages stay available only as compatibility surfaces until feature parity and migration are complete.

---

## 3. Training, Curriculum, And First Publish Matrix

### 3.1 Training and readiness

| Step | State change | Owning route/action | Who may do it | Notification expectation | Analytics / audit expectation |
|---|---|---|---|---|---|
| Module starts | assignment stays or becomes `IN_PROGRESS` | `/instructor-training`, training module actions | Applicant / Instructor / allowed learner | none required immediately | training progress reflected in readiness and dashboard counts |
| Checkpoint complete | checkpoint completion row created | `setTrainingCheckpointCompletion` | Learner | none required immediately | module artifact state updates |
| Quiz submitted | quiz attempt row created; may mark pass path ready | `submitTrainingQuiz` | Learner | immediate pass/fail feedback | latest attempt appears in readiness calculations |
| Evidence submitted | evidence row -> `PENDING_REVIEW` | `submitTrainingEvidence` | Learner | reviewer queue entry appears | evidence backlog increases |
| Evidence approved | `PENDING_REVIEW -> APPROVED` | `reviewTrainingEvidence` | Admin; Chapter President for own chapter | learner sees approval | evidence backlog decreases; curriculum draft may move to `APPROVED` |
| Evidence revision requested | `PENDING_REVIEW -> REVISION_REQUESTED` | `reviewTrainingEvidence` | Admin; Chapter President for own chapter | learner sees revision request | curriculum draft may move to `NEEDS_REVISION` |
| Evidence rejected | `PENDING_REVIEW -> REJECTED` | `reviewTrainingEvidence` | Admin; Chapter President for own chapter | learner sees rejection | curriculum draft may move to `REJECTED` |
| Offering approval requested | no row -> `ClassOfferingApproval.status=REQUESTED` | `requestOfferingApproval` | Instructor / eligible user | reviewer queue entry appears | offering approval backlog increases |
| Offering approved | `REQUESTED/UNDER_REVIEW -> APPROVED` | `approveOfferingApproval` | Admin; Chapter President for own chapter | instructor sees approval | publish gate opens for that offering |
| Offering changes requested | -> `CHANGES_REQUESTED` | `requestOfferingApprovalRevision` | Admin; Chapter President for own chapter | instructor sees requested changes | offering stays blocked from publish |
| Offering rejected | -> `REJECTED` | `requestOfferingApprovalRevision` with `REJECTED` | Admin; Chapter President for own chapter | instructor sees rejection | offering stays blocked from publish |

### 3.2 Interview gate inside readiness

| Step | State change | Owning route/action | Who may do it | Notification expectation | Analytics / audit expectation |
|---|---|---|---|---|---|
| Reviewer posts slot | interview slot row -> `POSTED` | `postInterviewSlot`, `postInstructorInterviewSlotsBulk` | Admin; Chapter President for own chapter | instructor notified | interview availability activity recorded |
| Instructor confirms slot | `POSTED -> CONFIRMED` | `confirmPostedInterviewSlot` | Instructor / applicant | reviewer notified | interview funnel advances |
| Instructor submits preferred times | availability request -> `PENDING` | `submitInterviewAvailabilityRequest` | Instructor / applicant | reviewer notified | backlog count increases |
| Reviewer resolves request | request `PENDING -> ACCEPTED/DECLINED` and slot may be created | instructor interview actions | Admin; Chapter President for own chapter | instructor notified | request aging metrics update |
| Interview completed | slot `CONFIRMED -> COMPLETED`; gate may move forward | instructor interview actions | Admin; Chapter President for own chapter | instructor notified | `analyticsEvent` row emitted from interview workflow |
| Outcome recorded | gate -> `PASSED`, `HOLD`, `FAILED`, or `WAIVED` | instructor interview actions | Admin; Chapter President for own chapter; `WAIVED` admin only | instructor notified | readiness publish eligibility changes |

### 3.3 Curriculum review and launch path

| Step | State change | Owning route/action | Who may do it | Notification expectation | Analytics / audit expectation |
|---|---|---|---|---|---|
| Draft in progress | `CurriculumDraft.status=IN_PROGRESS` | `/instructor/lesson-design-studio` | Instructor / applicant | none required immediately | draft progress visible in studio |
| Draft ready | `IN_PROGRESS -> COMPLETED` | lesson design studio submit readiness checks | Instructor / applicant | none required immediately | curriculum funnel advances to review-ready |
| Review submitted | `COMPLETED -> SUBMITTED` through evidence/review flow | studio + evidence submission path | Instructor / applicant | reviewer queue entry appears | curriculum review backlog increases |
| Review approved | `SUBMITTED -> APPROVED` | `reviewTrainingEvidence` when linked to studio draft | Admin; Chapter President for own chapter | instructor sees approval | launch package created |
| Review revision requested | `SUBMITTED -> NEEDS_REVISION` | `reviewTrainingEvidence` when linked to studio draft | Admin; Chapter President for own chapter | instructor sees requested changes | revision backlog increases |
| Review rejected | `SUBMITTED -> REJECTED` | `reviewTrainingEvidence` when linked to studio draft | Admin; Chapter President for own chapter | instructor sees rejection | rejection count increases |
| First publish allowed | readiness gate passes | offering publish flow + `assertReadinessAllowsPublish` | Instructor with offering permissions | publish succeeds | first-publish-ready count increases |
| First publish blocked | gate fails | offering publish flow + `assertReadinessAllowsPublish` | Instructor with offering permissions | clear blocking message shown | first-publish-blocked count increases |

### 3.4 Publish invariants
- Readiness approval cannot be granted before interview gate is `PASSED` or `WAIVED`.
- First publish must stay blocked unless training + interview readiness is satisfied or grandfathered exemption applies.
- Required modules must always have at least one actionable path: video, checkpoint, quiz, or evidence.

---

## 4. Mentorship Review Cycle Matrix

### 4.1 Mentorship operations

| Step | State change | Owning route/action | Who may do it | Notification expectation | Analytics / audit expectation |
|---|---|---|---|---|---|
| Pairing created | mentorship row -> `ACTIVE` | mentorship program / hub actions | Admin or allowed support operator | mentee/mentor can see pairing | active pairing count increases |
| Session scheduled | session row created | mentorship hub actions | Mentor / Admin / allowed supporter | participant sees session | cadence metrics update |
| Action item created | action item row -> `OPEN` | mentorship hub actions | Mentor / Admin / allowed supporter | owner sees item | overdue-action metrics can update later |
| Support request opened | request row -> `OPEN` | mentorship hub actions | Mentee / supporter | assignee or support circle sees request | open-request count increases |
| Request answered | response added; request may resolve later | mentorship hub actions | Mentor / Admin / supporter | requester sees response | public/private knowledge metrics update |

### 4.2 Reflection and goal review cycle

| Step | State change | Owning route/action | Who may do it | Notification expectation | Analytics / audit expectation |
|---|---|---|---|---|---|
| Self-reflection submitted | reflection row created for cycle | self-reflection actions | Mentee | mentor can see pending review | reflection cycle counts increase |
| Mentor saves draft review | review row -> `DRAFT` | `saveGoalReview` | Assigned mentor; Admin | none required immediately | review workload reflected |
| Mentor submits for approval | `DRAFT -> PENDING_CHAIR_APPROVAL` | `saveGoalReview` with submit flag | Assigned mentor; Admin | chair/admin queue should show waiting review | pending-chair count increases |
| Chair requests changes | -> `CHANGES_REQUESTED` | `requestReviewChanges` | Admin chair | mentor sees change request | audit log `MENTORSHIP_UPDATED` |
| Chair approves and releases | -> `APPROVED`; `releasedToMenteeAt` set | `approveGoalReview` | Admin chair | mentee can view approved review | audit log `MENTORSHIP_UPDATED`; points awarded |

### 4.3 Mentorship invariants
- Only the assigned mentor or admin can author a review.
- Approved reviews cannot be edited.
- Chair approval releases the review to the mentee and must also update the achievement summary and point log.

---

## 5. Test Expectations By Workflow

### Recruiting
- Test one clean happy path per position type in scope.
- Test same-chapter permission allow and cross-chapter permission deny.
- Test decision blockers for missing completed interview and missing recommendation note.
- Test accepted instructor handoff into readiness/interview gate sync.

### Training and curriculum launch
- Test checkpoint, quiz, and evidence branches.
- Test evidence review outcomes: approve, revision requested, reject.
- Test readiness request, approval, and rejection/revision flow.
- Test curriculum review statuses and launch package creation.
- Test first publish block and unblock behavior.

### Mentorship
- Test reflection submission, draft review, chair approval, and release.
- Test stale/open workload metrics using seeded data.

### Analytics
- Every seeded fixture count must reconcile against the admin analytics dashboard under:
  - all chapters
  - single chapter
  - single `interestArea`
  - `Unmapped`

---

## 6. Rollout Notes
- Keep legacy instructor and CP application screens readable during transition.
- Treat recruiting data as the analytics and QA source of truth.
- Add automated checks in layers:
  - fast PR smoke checks
  - deeper nightly workflow checks
  - artifact capture for failures so staff can see where a workflow broke
