# Instructor Applicant Workflow — Implementation Plan

## Context
Premium, end-to-end Instructor Applicant Workflow extending the existing YPP Portal. Covers intake → reviewer assignment → initial review → interviewer assignment → scheduling + required uploads → post-interview evaluation → chair review → final outcome. Must feel native (lavender/purple design system, existing kanban + slideout + rubric patterns) and reuse the mature `InstructorApplication` / `InstructorInterviewGate` infrastructure already in place.

---

# PART 1 — Decisions, Architecture, Routes

## A. Confirmed product decisions (locked)

| Area | Decision |
|------|----------|
| Route strategy | Extend in place: `/admin/instructor-applicants` + `/chapter-lead/instructor-applicants` share one rebuilt `InstructorApplicantsCommandCenter` component, role-scoped |
| Chair role | New `RoleType.HIRING_CHAIR` (first-class role, permission updates in `lib/chapter-hiring-permissions.ts`) |
| Interviewers per applicant | 1–2 via new `InstructorApplicationInterviewer` join (`role = LEAD | SECOND`) |
| Assignment UX | Manual-first with live signals (active load, chapter, subject match, last-assigned date) — no hard cap, no ranking algo in V1 |
| Rubric categories | Add `SUBJECT_MATTER_FIT`; reuse `PROFESSIONALISM_AND_FOLLOW_THROUGH` with UI copy "Interview Readiness & Professionalism". Final set = 7 categories |
| Interview rec enum | Rename `ACCEPT_WITH_REVISIONS` → `ACCEPT_WITH_SUPPORT` (single migration) |
| Pre-interview docs | New `ApplicantDocument` table. Soft gate: slot confirmable, but `Materials missing` chip blocks "Ready for interview" column + triggers applicant email |
| Chair queue | New page `/admin/instructor-applicants/chair-queue`. Chapter-first tabs + YPP-wide toggle. Slideout comparison panel |
| Status lifecycle | Add `CHAIR_REVIEW` between `INTERVIEW_COMPLETED` and `APPROVED/REJECTED` |
| Detail surface | Full-page cockpit at `/applications/instructor/[id]` + 640px right-drawer quick-actions from pipeline cards |
| Scheduling UX | Inline scheduling panel in applicant detail + deep-link `Open in scheduling workspace` → `/interviews/schedule?applicationId=` |
| Terminal visibility | Keep on board 30 days, then `?tab=archive` view |
| Capacity tracking V1 | Live "active load" badges only, no hard cap |
| Notifications V1 | Reviewer-assigned, Interviewer-assigned (LEAD + SECOND), Materials-missing (applicant), Chair-queue daily digest |
| Required fields | Soft warnings only — chair is never hard-blocked. "Decision Readiness" checklist is informational |

## B. Workflow architecture (end-to-end)

```
[Applicant submits] 
      ↓  status = SUBMITTED
[Admin/Chapter Lead assigns Reviewer]       (new: reviewer surface + load badge)
      ↓  status = UNDER_REVIEW
[Reviewer writes InstructorApplicationReview (7-cat rubric) + nextStep]
      ↓
  ├─ MOVE_TO_INTERVIEW → assign LEAD (+ optional SECOND) interviewer → offer slots
  │       ↓  status = INTERVIEW_SCHEDULED
  │     [Candidate confirms slot | submits availability request]
  │     [Candidate uploads Course Outline + First Class Plan]
  │       ↓  pill: Materials missing → Ready for interview
  │     [Interview conducted; InstructorInterviewReview per interviewer]
  │       ↓  status = INTERVIEW_COMPLETED
  │     [Auto-advance → CHAIR_REVIEW when all assigned reviews submitted]
  │       ↓  status = CHAIR_REVIEW
  │     [Chair acts: APPROVED | REJECTED | ON_HOLD | INFO_REQUESTED |
  │                   back to INTERVIEW_SCHEDULED (2nd interview)]
  │       ↓
  ├─ REQUEST_INFO → INFO_REQUESTED → applicant responds → UNDER_REVIEW
  ├─ HOLD        → ON_HOLD
  └─ REJECT      → REJECTED (terminal, 30-day decay to archive)

APPROVED → triggers existing onboarding sync (TrainingAssignment create,
           InstructorInterviewGate.status=PASSED if pre-interview evidence,
           INSTRUCTOR role grant) via existing syncInstructorApplicationWorkflow()
```

## C. Route structure

| Route | Type | Owner | Purpose |
|-------|------|-------|---------|
| `/admin/instructor-applicants` | Extend | ADMIN | Command Center: kanban + search + filters (stage, chapter, reviewer, interviewer, materials-missing, overdue), archive tab |
| `/chapter-lead/instructor-applicants` | Extend | CHAPTER_PRESIDENT | Same component, auto-scoped to user's chapter |
| `/admin/instructor-applicants/chair-queue` | **New** | ADMIN, HIRING_CHAIR | Chair decision cockpit — chapter tabs + YPP-wide toggle, comparison slideout |
| `/applications/instructor/[id]` | Rebuild | Multi-role | Full evaluation cockpit — sticky action bar, summary, timeline, reviews, scheduling panel, uploads, decision panel |
| `/applications/instructor/[id]/interview` | Extend | Interviewer | Structured interview workspace — pre-interview brief + post-interview evaluation editor (7-cat rubric, new rec enum) |
| `/interviews` + `/interviews/schedule` | Reuse | ADMIN, CHAPTER_PRESIDENT, HIRING_CHAIR, feature-gated INTERVIEWER | Accepts `applicationId` query param to focus on one applicant |
| `/admin/instructor-applicants?tab=archive` | **New tab** | ADMIN | 30+ day terminal outcomes with full audit |
| `/chapter-lead/instructor-applicants?tab=archive` | **New tab** | CHAPTER_PRESIDENT | Same, chapter-scoped |
| Drawer (no route) | New surface | All | 640px right slideout from pipeline cards — quick assign / confirm / comment / open full cockpit |

## D. Nav additions (`components/nav.tsx`)

- ADMIN group: "Instructor Applicants" (existing) + new sub-item "Chair Queue" with badge = count of `CHAIR_REVIEW`.
- Surface "Chair Queue" in its own group for HIRING_CHAIR users (primary nav item for that role).
- Chapter President nav: keep "Instructor Applicants" as-is; add archive tab awareness.
- Badges consume existing `NavBadges` interface; add `chairQueueCount` field.

---

# PART 2 — Schema, Permissions, Lifecycle

## A. Prisma schema changes (`prisma/schema.prisma`)

### A.1 Enum changes

| Enum | Change |
|------|--------|
| `RoleType` | **Add** `HIRING_CHAIR` |
| `InstructorApplicationStatus` | **Add** `CHAIR_REVIEW` (placed between `INTERVIEW_COMPLETED` and `APPROVED`) |
| `InstructorReviewCategoryKey` | **Add** `SUBJECT_MATTER_FIT` |
| `InstructorInterviewRecommendation` | **Rename** `ACCEPT_WITH_REVISIONS` → `ACCEPT_WITH_SUPPORT` (use `@map` or single-migration rename) |
| `InterviewSlotSource` | No change — reuse `REVIEWER_POSTED` / `INSTRUCTOR_REQUESTED` |
| **New enum** `ApplicantDocumentKind` | `COURSE_OUTLINE`, `FIRST_CLASS_PLAN`, `RESUME`, `OTHER` |
| **New enum** `ChairDecisionAction` | `APPROVE`, `REJECT`, `HOLD`, `REQUEST_INFO`, `REQUEST_SECOND_INTERVIEW` |

### A.2 New models

```prisma
model InstructorApplicationInterviewer {
  id             String   @id @default(cuid())
  applicationId  String
  application    InstructorApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  interviewerId  String
  interviewer    User     @relation("InterviewerAssignments", fields: [interviewerId], references: [id])
  role           InterviewerAssignmentRole  // LEAD | SECOND
  assignedAt     DateTime @default(now())
  assignedById   String
  assignedBy     User     @relation("InterviewerAssignedBy", fields: [assignedById], references: [id])
  removedAt      DateTime?
  @@unique([applicationId, role])
  @@index([interviewerId, removedAt])
}

enum InterviewerAssignmentRole { LEAD SECOND }

model ApplicantDocument {
  id             String   @id @default(cuid())
  applicationId  String
  application    InstructorApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  kind           ApplicantDocumentKind
  fileUrl        String
  originalName   String?
  fileSize       Int?
  note           String?
  uploadedById   String
  uploadedBy     User     @relation("ApplicantDocUploader", fields: [uploadedById], references: [id])
  uploadedAt     DateTime @default(now())
  supersededAt   DateTime?   // for re-uploads, old version retained for audit
  @@index([applicationId, kind, supersededAt])
}

model InstructorApplicationChairDecision {
  id               String   @id @default(cuid())
  applicationId    String   @unique
  application      InstructorApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  chairId          String
  chair            User     @relation("ChairDecisions", fields: [chairId], references: [id])
  action           ChairDecisionAction
  rationale        String?
  comparisonNotes  String?
  decidedAt        DateTime @default(now())
  supersededAt     DateTime?
}

model InstructorApplicationTimelineEvent {
  id            String   @id @default(cuid())
  applicationId String
  application   InstructorApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  kind          String   // "STATUS_CHANGE" | "REVIEWER_ASSIGNED" | "INTERVIEWER_ASSIGNED" | "DOC_UPLOADED" | "NOTE_ADDED" | "SLOT_POSTED" | "SLOT_CONFIRMED" | "INTERVIEW_COMPLETED" | "CHAIR_DECISION"
  actorId       String?
  actor         User?    @relation("TimelineActor", fields: [actorId], references: [id])
  payload       Json     // {from, to, meta...}
  createdAt     DateTime @default(now())
  @@index([applicationId, createdAt])
}
```

### A.3 Field additions to `InstructorApplication`

| Field | Type | Purpose |
|-------|------|---------|
| `reviewerId` | `String?` | Explicit primary reviewer (FK → User). Distinct from review authorship |
| `reviewerAssignedAt` | `DateTime?` | For "last assigned" sort + overdue signal |
| `reviewerAssignedById` | `String?` | Audit |
| `chairQueuedAt` | `DateTime?` | When status moved to CHAIR_REVIEW (used for SLA + digest filtering) |
| `materialsReadyAt` | `DateTime?` | Set when both required ApplicantDocuments exist; drives "Ready for interview" |
| `archivedAt` | `DateTime?` | Computed/set on terminal + 30d; drives archive tab |
| Relations | `interviewerAssignments InstructorApplicationInterviewer[]`, `documents ApplicantDocument[]`, `chairDecision InstructorApplicationChairDecision?`, `timeline InstructorApplicationTimelineEvent[]`, `reviewer User? @relation("InstructorApplicationReviewer")` | |

### A.4 Migration notes

- **Single migration** named `instructor_applicant_workflow_v1`.
- Rename enum value `ACCEPT_WITH_REVISIONS` → `ACCEPT_WITH_SUPPORT`: use Postgres `ALTER TYPE ... RENAME VALUE` (safe, no data loss).
- Backfill `reviewerId` from the most recent `InstructorApplicationReview.reviewerId` where `isLeadReview = true`; null otherwise.
- Backfill `InstructorApplicationTimelineEvent` with coarse `STATUS_CHANGE` rows derived from `updatedAt` where possible; otherwise start fresh.
- No destructive operations. All additive except the enum rename.

## B. Permissions model (`lib/chapter-hiring-permissions.ts`)

### B.1 Role → capability matrix

| Capability | ADMIN | HIRING_CHAIR | CHAPTER_PRESIDENT | Assigned Reviewer | Assigned Interviewer | Applicant |
|------------|:-----:|:------------:|:-----------------:|:-----------------:|:--------------------:|:---------:|
| View any applicant | ✅ | ✅ | chapter only | assigned only | assigned only | self only |
| Assign/reassign reviewer | ✅ | — | chapter only | — | — | — |
| Assign/reassign interviewers (LEAD/SECOND) | ✅ | — | chapter only | LEAD may add SECOND | — | — |
| Write InstructorApplicationReview | ✅ | ✅ | ✅ | ✅ | — | — |
| Post/cancel interview slots | ✅ | — | chapter only | ✅ (assigned applicants) | ✅ (assigned applicants) | — |
| Confirm slot / submit availability | — | — | — | — | — | ✅ (self) |
| Upload required docs | — | — | chapter only (on behalf) | — | — | ✅ (self) |
| Submit InstructorInterviewReview | ✅ | — | — | — | ✅ (assigned) | — |
| Advance status SUBMITTED → UNDER_REVIEW → INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED | ✅ | — | chapter only | reviewer: to INTERVIEW_SCHEDULED | interviewer: to INTERVIEW_COMPLETED (on review submit) | — |
| Auto-advance INTERVIEW_COMPLETED → CHAIR_REVIEW | system (on final interviewer review submission) | | | | | |
| Chair decision (APPROVED/REJECTED/HOLD/INFO/2nd interview) | ✅ | ✅ | — | — | — | — |
| Override WAIVE interview gate | ✅ only | — | — | — | — | — |
| See chair queue | ✅ | ✅ | — | — | — | — |
| See archive tab | ✅ | ✅ | chapter only | — | — | — |

### B.2 New helpers in `lib/chapter-hiring-permissions.ts`

- `isHiringChair(actor)` — `actor.roles.includes("HIRING_CHAIR")`.
- `isAssignedReviewer(actor, application)` — `application.reviewerId === actor.id`.
- `isAssignedInterviewer(actor, application)` — `application.interviewerAssignments.some(a => a.interviewerId === actor.id && !a.removedAt)`.
- `assertCanAssignInterviewers(actor, application)` — ADMIN OR (CHAPTER_PRESIDENT and same chapter) OR (isAssignedReviewer AND target role=SECOND).
- `assertCanActAsChair(actor, application)` — ADMIN OR HIRING_CHAIR. (Chapter presidents are explicitly NOT chairs by decision.)
- `assertCanViewApplicant(actor, application)` — role-based rules above.
- `canSeeChairQueue(actor)` → boolean for nav badge + page guard.

### B.3 Feature flags

- Reuse existing `ENABLE_NATIVE_INSTRUCTOR_GATE` — controls downstream approval sync on ACCEPT.
- **New** `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1` — defaults true; allows quick kill-switch.
- New env `INSTRUCTOR_CHAIR_DIGEST_CRON` (e.g. `0 14 * * 1-5`) — daily chair digest schedule.

## C. Status lifecycle (state machine)

### C.1 State transitions

```
SUBMITTED
  └─(assignReviewer)──► UNDER_REVIEW
UNDER_REVIEW
  ├─(nextStep=MOVE_TO_INTERVIEW + interviewer assigned)──► INTERVIEW_SCHEDULED
  ├─(nextStep=REQUEST_INFO)──► INFO_REQUESTED
  ├─(nextStep=HOLD)──► ON_HOLD
  └─(nextStep=REJECT)──► REJECTED
INFO_REQUESTED
  └─(applicant responds)──► UNDER_REVIEW
PRE_APPROVED   (HIRING_ADMIN fast-track, existing)
  └─(assign interviewer)──► INTERVIEW_SCHEDULED
INTERVIEW_SCHEDULED
  ├─(interviewer completes + all reviews submitted)──► INTERVIEW_COMPLETED
  └─(admin manual hold)──► ON_HOLD
INTERVIEW_COMPLETED
  └─(auto on last review submit)──► CHAIR_REVIEW
CHAIR_REVIEW
  ├─(chair APPROVE)──► APPROVED  ── triggers onboarding sync
  ├─(chair REJECT)──► REJECTED
  ├─(chair HOLD)──► ON_HOLD
  ├─(chair REQUEST_INFO)──► INFO_REQUESTED
  └─(chair REQUEST_SECOND_INTERVIEW)──► INTERVIEW_SCHEDULED (retains prior reviews + audit note)
ON_HOLD
  ├─(resume to review)──► UNDER_REVIEW
  └─(resume to interview)──► INTERVIEW_SCHEDULED
APPROVED (terminal)  — archives at T+30d
REJECTED (terminal)  — archives at T+30d
WITHDRAWN (terminal, applicant-initiated)
```

### C.2 Derived column mapping (kanban + filters)

| Board column | Underlying statuses |
|--------------|---------------------|
| New | `SUBMITTED` |
| Needs Review | `UNDER_REVIEW`, `INFO_REQUESTED` |
| Interview Prep | `PRE_APPROVED`, `INTERVIEW_SCHEDULED` where `materialsReadyAt IS NULL` |
| Ready for Interview | `INTERVIEW_SCHEDULED` where `materialsReadyAt IS NOT NULL` AND slot confirmed |
| Post-Interview | `INTERVIEW_COMPLETED` |
| Chair Review | `CHAIR_REVIEW` |
| Decided (30d) | `APPROVED`, `REJECTED`, `ON_HOLD` where `archivedAt IS NULL` |
| Archive (tab) | any terminal where `archivedAt IS NOT NULL` OR `WITHDRAWN` |

### C.3 Invariants enforced at action boundary

1. Cannot move to `INTERVIEW_SCHEDULED` without ≥1 interviewer in `interviewerAssignments` with `removedAt IS NULL`.
2. Cannot auto-advance to `CHAIR_REVIEW` until every non-removed interviewer has submitted an `InstructorInterviewReview.status = SUBMITTED`.
3. `materialsReadyAt` is set/cleared automatically by an action-side helper whenever an `ApplicantDocument` of kind `COURSE_OUTLINE` or `FIRST_CLASS_PLAN` is added or superseded.
4. Chair action is only accepted when `status = CHAIR_REVIEW` (prevents stale clicks).
5. `APPROVED` action always runs inside a Prisma transaction together with the existing `syncInstructorApplicationWorkflow()` to guarantee onboarding side-effects.
6. Every status change writes an `InstructorApplicationTimelineEvent`.

---

# PART 3 — Components, Build Order, Backend Actions

## A. Components

### A.1 Reuse as-is (do NOT rebuild)

| Component | Path | Use for |
|-----------|------|---------|
| `KanbanBoard` + `KanbanDetailPanel` + CSS | `components/kanban/*` | Command Center board |
| `DataTable` | `components/data-table.tsx` | Archive tab, chair queue list fallback |
| `ApplicationReviewEditor` | `components/instructor-review/application-review-editor.tsx` | Initial reviewer rubric (add SUBJECT_MATTER_FIT label) |
| `InterviewReviewEditor` | `components/instructor-review/interview-review-editor.tsx` | Interviewer rubric (add SUBJECT_MATTER_FIT + renamed rec) |
| `FileUpload` | `components/file-upload.tsx` | Course Outline + First Class Plan uploads |
| `ApplicantVideoUpload` | `components/applicant-video-upload.tsx` | Existing motivation video |
| `EmptyState` | `components/empty-state.tsx` | Empty chair queue, empty archive |
| `ApplicationProgressStepper` | `components/application-progress-stepper.tsx` | Cockpit header progress |
| `ApplicationStatusFilter` | `components/application-status-filter.tsx` | Command Center filter bar |
| `DecisionTemplates` / `InterviewNoteTemplates` | `components/decision-templates.tsx`, `components/interview-note-templates.tsx` | Chair rationale + interview notes |
| `AddToCalendarButton` | `components/add-to-calendar-button.tsx` | Slot confirmation email + cockpit |
| Interviews hub pieces | `components/interviews/*` | Deep-link scheduling surface |

### A.2 Extend existing

| Component | Path | Extension |
|-----------|------|-----------|
| `nav.tsx` | `components/nav.tsx` | Add Chair Queue entry + `chairQueueCount` badge; surface for `HIRING_CHAIR` role |
| `ApplicationReviewEditor` | `components/instructor-review/application-review-editor.tsx` | Support 7th category (SUBJECT_MATTER_FIT); relabel PROFESSIONALISM copy to "Interview Readiness & Professionalism" |
| `InterviewReviewEditor` | `components/instructor-review/interview-review-editor.tsx` | Same + update recommendation select (`ACCEPT_WITH_SUPPORT`) |
| Kanban column defs | `lib/instructor-applicant-board.ts` (new, but exported to existing kanban config) | New columns (Needs Review, Interview Prep, Ready for Interview, Post-Interview, Chair Review, Decided) |
| `NavBadges` type | `components/nav.tsx` + `lib/nav-badges.ts` | Add `chairQueueCount: number` |

### A.3 New components (all under `components/instructor-applicants/`)

| Component | Purpose |
|-----------|---------|
| `InstructorApplicantsCommandCenter.tsx` | Top-level shell (tabs: Pipeline / Chair Queue / Archive), wraps KanbanBoard + filter toolbar; consumes role-scoped props |
| `ApplicantPipelineCard.tsx` | Kanban card — name + chapter + subjects + materials chip + overdue chip + reviewer avatar + interviewer avatars |
| `ApplicantQuickDrawer.tsx` | 640px right slideout opened from pipeline card — summary, assign reviewer/interviewer, confirm slot, open cockpit link |
| `ApplicantCommandFilters.tsx` | Chapter pivot, reviewer filter, interviewer filter, "Materials missing", "Overdue", "My cases only" toggles |
| `ApplicantCockpitHeader.tsx` | Summary band on full-page detail — legal name, preferred name, chapter chip, subjects, graduation year, school, progress stepper, sticky next-action CTA |
| `ApplicantCockpitSidebar.tsx` | Right rail on cockpit — assigned reviewer, interviewers, timeline preview, materials checklist |
| `ApplicantNextActionBar.tsx` | Sticky bottom-of-viewport action bar — contextual CTAs (Assign reviewer / Assign interviewer / Post slots / Submit review / Request info / Send to chair) |
| `ReviewerAssignPicker.tsx` | Searchable user picker — shows active load badge, chapter chip, subject-match hint, last-assigned date. Sortable |
| `InterviewerAssignPicker.tsx` | Same API as ReviewerAssignPicker + supports LEAD vs SECOND mode |
| `ApplicantDocumentsPanel.tsx` | Uploads surface — required Course Outline + First Class Plan with "missing" chip; re-upload with supersededAt history; inline viewer |
| `InterviewSchedulingInlinePanel.tsx` | Embedded in cockpit — lists existing slots, shows availability requests, quick-post slot form, deep link to `/interviews/schedule?applicationId=` |
| `ApplicantTimelineFeed.tsx` | Renders `InstructorApplicationTimelineEvent[]` with grouped days + tone-stripe dots (urgent/warning/info/accent mapped from event.kind) |
| `DecisionReadinessChecklist.tsx` | Chair-only soft checklist — reviewer note ✅/❌, ≥1 interview review ✅/❌, materials ✅/❌, subjects clarity ✅/❌ |
| `ChairQueueBoard.tsx` | List view, chapter tabs, "YPP-wide" toggle, each row opens `ChairComparisonSlideout` |
| `ChairComparisonSlideout.tsx` | Right sheet — applicant summary, reviewer note, per-interviewer rec + category dots, materials preview, rationale + comparison-notes textarea, action buttons (APPROVE / REJECT / HOLD / REQUEST_INFO / REQUEST_SECOND_INTERVIEW) |
| `InterviewerBriefCard.tsx` | Pre-interview brief on `/applications/instructor/[id]/interview` — applicant summary, subjects, reviewer note, materials viewer, interview guide placeholder |
| `MaterialsMissingChip.tsx` | Reusable pill derived from `materialsReadyAt` |
| `ActiveLoadBadge.tsx` | Reusable chip for reviewer/interviewer pickers |
| `ArchiveTable.tsx` | DataTable configuration wrapper for archive tab |

### A.4 CSS additions

- Extend `app/globals.css`: add status-pill tones for `chair-review`, `interview-prep`, `ready-for-interview`, `materials-missing`, `overdue`.
- Extend `components/kanban/kanban-board.css` with new column status mappings.

## B. Backend actions

### B.1 Extend `lib/instructor-application-actions.ts`

| Action | Signature (shape) | Behavior |
|--------|-------------------|----------|
| `assignReviewer` (already exists) | `(formData: {applicationId, reviewerId})` | Also set `reviewerAssignedAt`, `reviewerAssignedById`; write timeline; emit notification; auto-advance SUBMITTED→UNDER_REVIEW if still SUBMITTED |
| `reassignReviewer` | same | Sets previous reviewer off, emits notification to new reviewer |
| `assignInterviewer` | `(formData: {applicationId, interviewerId, role})` | Creates `InstructorApplicationInterviewer`; enforces LEAD present before SECOND; writes timeline; notifies interviewer |
| `removeInterviewer` | `(formData: {assignmentId})` | Sets `removedAt`; timeline |
| `sendToChair` | `(formData: {applicationId})` | Guard: status = INTERVIEW_COMPLETED AND all assigned interviewer reviews submitted. Sets `status=CHAIR_REVIEW`, `chairQueuedAt=now()`, enqueues digest row |
| `chairDecide` | `(formData: {applicationId, action, rationale?, comparisonNotes?})` | Validates chair role + status=CHAIR_REVIEW. Writes `InstructorApplicationChairDecision`. For APPROVE runs in transaction with existing onboarding sync; for REQUEST_SECOND_INTERVIEW moves status back to INTERVIEW_SCHEDULED, timeline note |
| `archiveApplication` | `(formData: {applicationId})` | Admin-only manual archive |
| `autoArchiveTerminalApplications` | server-only cron | Sets `archivedAt` on terminal apps older than 30d |

### B.2 New `lib/applicant-documents-actions.ts`

| Action | Behavior |
|--------|----------|
| `uploadApplicantDocument(formData)` | POST to `/api/upload` (reuses existing), creates `ApplicantDocument`, marks prior same-kind with `supersededAt`. Recomputes `materialsReadyAt` on `InstructorApplication`. Timeline event. If `materialsReadyAt` transitions to NOT NULL, cancel any queued "materials-missing" reminder |
| `deleteApplicantDocument(formData)` | Admin/chapter_lead soft-delete (sets `supersededAt`). Recomputes `materialsReadyAt` |
| `getApplicantDocuments(applicationId)` | Server query respecting permissions |

### B.3 New `lib/instructor-applicant-board-queries.ts`

| Query | Behavior |
|-------|----------|
| `getApplicantPipeline({scope, chapterId?, filters})` | Returns applications grouped by derived column; includes reviewer, interviewer assignments, materialsReadyAt, chair state, overdue flag |
| `getChairQueue({scope, chapterId?})` | Applications where status=CHAIR_REVIEW; includes reviewer note preview + per-interviewer recommendation |
| `getArchivedApplications({scope, chapterId?, since?})` | Terminal + archivedAt not null; sortable |
| `getInterviewerLoad(userId)` | Count of active (non-removed, non-terminal) assignments; last-assigned date |
| `getReviewerLoad(userId)` | Count of applications where `reviewerId = userId AND status IN (UNDER_REVIEW, INFO_REQUESTED, INTERVIEW_SCHEDULED, INTERVIEW_COMPLETED, CHAIR_REVIEW)` |
| `getCandidateInterviewers(applicationId, {role})` | Returns user list with load + subject-overlap + chapter match |

### B.4 Extend `lib/instructor-interview-actions.ts`

- On `completeInstructorInterviewAndSetOutcome` / `submitInterviewReview`: after write, check whether all assigned interviewers have submitted; if yes, auto-advance status to `CHAIR_REVIEW` and set `chairQueuedAt`.
- Update rec enum handling to `ACCEPT_WITH_SUPPORT`.

### B.5 New API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/applicants/[id]/chair-decide` | POST | Thin wrapper over `chairDecide` for client-side form action |
| `/api/admin/applicants/chair-digest` | POST (cron-protected) | Sends daily digest to HIRING_CHAIR users; accepts `Authorization: Bearer ${CRON_SECRET}` |
| `/api/admin/applicants/auto-archive` | POST (cron-protected) | Runs `autoArchiveTerminalApplications` |
| `/api/upload` | reused | No change |

### B.6 Notification hooks (`lib/notification-policy.ts` + `lib/email.ts`)

- `sendReviewerAssignedEmail(userId, applicationId)` — new template.
- `sendInterviewerAssignedEmail(userId, applicationId, role)` — new template.
- `sendMaterialsMissingReminderEmail(applicantId, applicationId)` — fires when slot confirms and `materialsReadyAt` is null; retries once 48h before scheduled slot.
- `sendChairDigestEmail(chairId, pendingApplicationsSummary)` — daily, skips if empty.

## C. Page-by-page build order (Sonnet-executable sequence)

**Step 0 — permanence:** copy this plan file to `docs/instructor-applicant-implementation-plan.md`.

**Step 1 — Schema + migration**
1. Edit `prisma/schema.prisma` per Part 2.A.
2. Run `npx prisma migrate dev --name instructor_applicant_workflow_v1`.
3. Update `prisma/seed.ts` to seed one HIRING_CHAIR user + 3 realistic applications spanning SUBMITTED / UNDER_REVIEW / INTERVIEW_SCHEDULED / CHAIR_REVIEW for demo.

**Step 2 — Permissions + helpers**
1. Extend `lib/chapter-hiring-permissions.ts` with helpers from Part 2.B.2.
2. Add unit-style tests (or assertion blocks in `tests/`) for each helper.

**Step 3 — Server actions + queries**
1. Build `lib/applicant-documents-actions.ts`.
2. Build `lib/instructor-applicant-board-queries.ts`.
3. Extend `lib/instructor-application-actions.ts` (assignReviewer flow, assignInterviewer, sendToChair, chairDecide, archive).
4. Extend `lib/instructor-interview-actions.ts` auto-advance logic.
5. Extend `lib/notification-policy.ts` + `lib/email.ts` for the 4 new triggers.

**Step 4 — Shared primitives**
1. `MaterialsMissingChip`, `ActiveLoadBadge` (tiny, reused everywhere).
2. `ReviewerAssignPicker`, `InterviewerAssignPicker`.
3. `ApplicantDocumentsPanel`.
4. `ApplicantTimelineFeed`.
5. Extend `ApplicationReviewEditor` + `InterviewReviewEditor` for new rubric + rec.

**Step 5 — Command Center shell**
1. Build `InstructorApplicantsCommandCenter.tsx` + `ApplicantCommandFilters.tsx` + `ApplicantPipelineCard.tsx` + `ApplicantQuickDrawer.tsx`.
2. Wire `/admin/instructor-applicants/page.tsx` and `/chapter-lead/instructor-applicants/page.tsx` to the shared shell with role-scoped server props.
3. Add archive tab (`?tab=archive`) using `ArchiveTable`.

**Step 6 — Applicant cockpit (full page)**
1. Rebuild `/applications/instructor/[id]/page.tsx` using `ApplicantCockpitHeader` + `ApplicantNextActionBar` + `ApplicantCockpitSidebar` + sections (summary, reviews, scheduling, materials, timeline, decision).
2. Embed `InterviewSchedulingInlinePanel` with deep-link to `/interviews/schedule?applicationId=`.

**Step 7 — Interviewer workspace**
1. Rebuild `/applications/instructor/[id]/interview/page.tsx` with `InterviewerBriefCard` + updated `InterviewReviewEditor`.

**Step 8 — Chair queue**
1. Build `/admin/instructor-applicants/chair-queue/page.tsx` with `ChairQueueBoard` + `ChairComparisonSlideout` + `DecisionReadinessChecklist`.
2. Wire `chairDecide` API route.

**Step 9 — Nav + badges**
1. Extend `components/nav.tsx` with Chair Queue entry + badge count.
2. Surface HIRING_CHAIR-specific nav grouping.

**Step 10 — Cron + automation**
1. Implement `/api/admin/applicants/chair-digest` and `/api/admin/applicants/auto-archive`.
2. Add `vercel.json` cron schedules.

**Step 11 — Tests + verification**
1. Unit tests for new queries + permissions.
2. Playwright smoke: submit → assign → review → assign interviewer → upload docs → confirm slot → submit interview review → chair approve → downstream sync fires.

---

# PART 4 — Automation, Migration, Risks, V1/V2, First Steps

## A. Notifications & automation opportunities

### A.1 V1 triggers (wired immediately)

| Trigger | Channel | Template | Throttle |
|---------|---------|----------|----------|
| Reviewer assigned | Email + in-app | `reviewer-assigned` | One per assignment |
| Interviewer assigned (LEAD/SECOND) | Email + in-app | `interviewer-assigned-{role}` | One per assignment |
| Applicant slot confirmed with missing materials | Email to applicant | `materials-missing-reminder` | Once on confirm + once 48h before slot |
| Application enters CHAIR_REVIEW | In-app immediately; email via daily digest | `chair-daily-digest` | Digest cron; skip if empty |
| Chair decision recorded | Email to applicant + assigned reviewer/interviewers | `chair-decision-{action}` | One per decision |

### A.2 V1 automation (implemented)

- **Auto-advance** `INTERVIEW_COMPLETED → CHAIR_REVIEW` on last submitted interview review (server action guard).
- **Auto-compute** `materialsReadyAt` on `ApplicantDocument` insert/supersede.
- **Auto-archive** terminal applications at T+30d via cron.
- **Auto-compute** `overdue` chip when `reviewerAssignedAt < now - 5 days` and status `UNDER_REVIEW` (pure derived).

### A.3 V2 automation (not built now, stubs reserved)

- Smart reviewer/interviewer ranking (subject+load+chapter weighted score).
- Hard interviewer capacity caps with time-off awareness.
- Calendar integration (Google/ICS two-way sync) via existing `AddToCalendarButton` foundation.
- Auto-reminders for overdue reviewer cases.
- Applicant-facing self-serve status page.

## B. Migration strategy (from current system)

**Principle:** pure-additive schema, zero data loss, safe to ship behind `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1`.

1. **Pre-migration audit** — script counts existing `InstructorApplication` rows by status; reviewers implied from `isLeadReview = true` reviews.
2. **Migration `instructor_applicant_workflow_v1`** (single file):
   - Add enums (`HIRING_CHAIR`, `CHAIR_REVIEW`, `SUBJECT_MATTER_FIT`, `ApplicantDocumentKind`, `InterviewerAssignmentRole`, `ChairDecisionAction`).
   - `ALTER TYPE "InstructorInterviewRecommendation" RENAME VALUE 'ACCEPT_WITH_REVISIONS' TO 'ACCEPT_WITH_SUPPORT'`.
   - Create 4 new tables (`InstructorApplicationInterviewer`, `ApplicantDocument`, `InstructorApplicationChairDecision`, `InstructorApplicationTimelineEvent`).
   - Add optional fields on `InstructorApplication` (all nullable).
3. **Backfill script** `scripts/backfill-instructor-applicant-workflow.mjs` (idempotent):
   - Populate `reviewerId` from latest lead `InstructorApplicationReview`.
   - Seed `InstructorApplicationTimelineEvent` with coarse `STATUS_CHANGE` entries using `updatedAt`.
   - Compute `materialsReadyAt` as NULL across all existing rows (no docs yet).
   - Set `archivedAt = updatedAt` on terminal applications older than 30d.
4. **Feature flag gate** — new UI/actions guarded by `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1`. If flag off: old `/admin/instructor-applicants` renders (legacy code preserved via git history; shared component is additive).
5. **Rollout order**
   - Deploy schema + backfill (flag off).
   - Verify backfill counts match pre-audit.
   - Enable flag in staging; run Playwright smoke.
   - Enable flag in production; watch chair digest + auto-advance telemetry for 1 week.
6. **Rollback** — flip flag off; schema is additive so no rollback migration needed.

## C. Risks & edge cases

| # | Risk / Edge case | Mitigation |
|---|------------------|------------|
| 1 | Chair acts on stale state (e.g. second interview was added after queue) | `chairDecide` guard re-reads status within the transaction; rejects if status ≠ CHAIR_REVIEW |
| 2 | Interviewer reassignment while review already submitted | Reassignment sets `removedAt` and preserves the review; auto-advance recomputes against active assignments |
| 3 | SECOND interviewer never submits → case stuck | `sendToChair` allows ADMIN override with audit note; surfaced as "Stuck" chip |
| 4 | Enum rename breaks existing interview reviews | `ALTER TYPE RENAME VALUE` is data-preserving in Postgres; UI + queries updated in same release |
| 5 | Applicant uploads wrong doc kind | `ApplicantDocumentsPanel` enforces kind per upload slot; re-upload creates supersede chain |
| 6 | Cross-chapter applicants (candidate chapter ≠ position chapter) | `assertCanActAsChair` defers to ADMIN/HIRING_CHAIR (chapter-agnostic); chapter presidents can still review but not decide |
| 7 | Notification spam on bulk reassignment | Add `DEBOUNCE_WINDOW_MS` in `notification-policy.ts`; one email per assignee per 5-min window |
| 8 | Auto-advance fires during race when two interviewers submit near-simultaneously | Wrap auto-advance in `prisma.$transaction` with row-level check on `InstructorApplication.status` |
| 9 | Archive tab grows unbounded | Paginate; index on `(archivedAt DESC, chapterId)` |
| 10 | Chair decides APPROVE but downstream onboarding sync fails | Wrap in transaction; if sync fails, rollback chair decision; surface error in UI |
| 11 | Timeline event volume | Keep payload small; index `(applicationId, createdAt DESC)`; paginate to 50 |
| 12 | Existing PRE_APPROVED fast-track still valid | Preserve: PRE_APPROVED → INTERVIEW_SCHEDULED path stays; chair queue ignores PRE_APPROVED until interview completes |
| 13 | HIRING_CHAIR role not yet assigned to anyone | Nav + page empty-state; ADMINs always retain chair power as fallback |
| 14 | Re-uploaded doc invalidates prior interviewer prep | Timeline event fires; `InterviewerBriefCard` highlights "Materials updated since brief read" |

## D. V1 vs V2 scope split

### V1 (this implementation)
- Full workflow + new state machine.
- Reviewer assignment with load badge.
- 1–2 interviewer assignment (LEAD/SECOND) with load badge.
- Required documents (Course Outline, First Class Plan) with soft gate.
- 7-category rubric + `ACCEPT_WITH_SUPPORT`.
- Chair role + Chair Queue page + comparison slideout + decision readiness checklist.
- Pipeline command center (kanban + filters + archive tab).
- Applicant cockpit full page + drawer.
- Inline scheduling + deep link to `/interviews/schedule`.
- Timeline audit log.
- 4 notification triggers + daily chair digest + auto-archive cron.

### V2 (explicitly deferred)
- Smart ranking / auto-suggest for reviewers + interviewers.
- Hard capacity caps + time-off awareness.
- Two-way calendar integration.
- Applicant self-serve status portal.
- Chapter-vs-chapter chair comparison dashboards.
- Bulk actions (bulk assign, bulk advance).
- Structured interview guide / rubric library with versioning.
- ML-assisted applicant screening.

## E. Exact first coding steps (Sonnet-executable sequence)

1. **Copy plan**: write this spec to `docs/instructor-applicant-implementation-plan.md` (verbatim).
2. **Create branch**: `git checkout -b claude/implement-instructor-workflow-Kwx2M` (already designated).
3. **Schema edit**: update `prisma/schema.prisma` — add `HIRING_CHAIR` to `RoleType`, add `CHAIR_REVIEW` to `InstructorApplicationStatus`, add `SUBJECT_MATTER_FIT` to `InstructorReviewCategoryKey`, rename recommendation enum value, add new enums + models + fields from Part 2.A.
4. **Migrate**: run `npx prisma migrate dev --name instructor_applicant_workflow_v1`.
5. **Permissions**: edit `lib/chapter-hiring-permissions.ts` — add `isHiringChair`, `isAssignedReviewer`, `isAssignedInterviewer`, `assertCanAssignInterviewers`, `assertCanActAsChair`, `canSeeChairQueue`.
6. **Feature flag**: add `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1` to `.env.example` + a `lib/feature-flags.ts` helper (or extend existing flag util).
7. **Queries**: create `lib/instructor-applicant-board-queries.ts` with `getApplicantPipeline`, `getChairQueue`, `getArchivedApplications`, `getReviewerLoad`, `getInterviewerLoad`, `getCandidateInterviewers`.
8. **Actions**: create `lib/applicant-documents-actions.ts`; extend `lib/instructor-application-actions.ts` with `assignInterviewer`, `removeInterviewer`, `sendToChair`, `chairDecide`, `archiveApplication`; extend `lib/instructor-interview-actions.ts` auto-advance.
9. **Primitives**: build `MaterialsMissingChip`, `ActiveLoadBadge`, `ReviewerAssignPicker`, `InterviewerAssignPicker`, `ApplicantDocumentsPanel`, `ApplicantTimelineFeed`.
10. **Command Center**: build `InstructorApplicantsCommandCenter` + card + filters + drawer; wire both existing routes.
11. **Cockpit**: rebuild `/applications/instructor/[id]/page.tsx` with header + sidebar + action bar + inline scheduling.
12. **Interviewer workspace**: rebuild `/applications/instructor/[id]/interview/page.tsx`.
13. **Chair queue**: build `/admin/instructor-applicants/chair-queue/page.tsx`.
14. **Nav**: extend `components/nav.tsx` + badge count.
15. **Cron**: add `/api/admin/applicants/chair-digest` + `/api/admin/applicants/auto-archive` + `vercel.json` schedule.
16. **Seed**: update `prisma/seed.ts` with HIRING_CHAIR user + demo applications.
17. **Tests**: add Playwright smoke (`tests/instructor-applicants.spec.ts`) covering full lifecycle.
18. **Backfill script**: `scripts/backfill-instructor-applicant-workflow.mjs`.
19. **Commit + push** to `claude/implement-instructor-workflow-Kwx2M`.

---

# FINAL SECTION

## A. Top 5 immediate coding tasks

1. Copy plan to `docs/instructor-applicant-implementation-plan.md` and create/checkout branch `claude/implement-instructor-workflow-Kwx2M`.
2. Update `prisma/schema.prisma` with all enum changes, new models, and new fields; run `prisma migrate dev --name instructor_applicant_workflow_v1`.
3. Extend `lib/chapter-hiring-permissions.ts` with new helpers; add `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1` flag.
4. Create `lib/instructor-applicant-board-queries.ts` and `lib/applicant-documents-actions.ts`; extend `lib/instructor-application-actions.ts` + `lib/instructor-interview-actions.ts` for new state transitions.
5. Build the Command Center shell (`components/instructor-applicants/*`) and wire `/admin/instructor-applicants` + `/chapter-lead/instructor-applicants` to the shared component.

## B. Files likely to change first

- `docs/instructor-applicant-implementation-plan.md` (new, copy of this plan)
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_instructor_applicant_workflow_v1/migration.sql`
- `prisma/seed.ts`
- `.env.example`
- `lib/chapter-hiring-permissions.ts`
- `lib/feature-flags.ts` (create if missing)
- `lib/instructor-applicant-board-queries.ts` (new)
- `lib/applicant-documents-actions.ts` (new)
- `lib/instructor-application-actions.ts`
- `lib/instructor-interview-actions.ts`
- `lib/notification-policy.ts`
- `lib/email.ts`
- `components/instructor-applicants/*` (new directory)
- `components/instructor-review/application-review-editor.tsx`
- `components/instructor-review/interview-review-editor.tsx`
- `components/nav.tsx`
- `app/(app)/admin/instructor-applicants/page.tsx`
- `app/(app)/admin/instructor-applicants/chair-queue/page.tsx` (new)
- `app/(app)/chapter-lead/instructor-applicants/page.tsx`
- `app/(app)/applications/instructor/[id]/page.tsx`
- `app/(app)/applications/instructor/[id]/interview/page.tsx`
- `app/api/admin/applicants/chair-decide/route.ts` (new)
- `app/api/admin/applicants/chair-digest/route.ts` (new)
- `app/api/admin/applicants/auto-archive/route.ts` (new)
- `vercel.json`
- `app/globals.css`
- `components/kanban/kanban-board.css`
- `scripts/backfill-instructor-applicant-workflow.mjs` (new)
- `tests/instructor-applicants.spec.ts` (new)

## C. Biggest implementation risks

1. **Enum rename** (`ACCEPT_WITH_REVISIONS` → `ACCEPT_WITH_SUPPORT`) — Postgres `ALTER TYPE RENAME VALUE` is safe, but every reference in code/UI/templates must be updated in the same commit. Grep before committing.
2. **Auto-advance race** on simultaneous interviewer submissions — must wrap in transaction with row-level status check; otherwise duplicate CHAIR_REVIEW events + duplicate digests.
3. **Chair APPROVE must atomically trigger** the existing `syncInstructorApplicationWorkflow()` (training assignment, interview gate sync, INSTRUCTOR role grant). Wrap in one transaction; test rollback.
4. **Permission regression** — chapter presidents previously could decide (via existing `approveInstructorApplication`); they must now route to chair. Audit all call sites and ensure old actions check `CHAIR_REVIEW` status invariant.
5. **Materials soft-gate semantics** — confirming a slot without docs must NOT block confirmation but MUST surface chip + email. UI and action layer must agree or we'll get false "stuck" cases.
6. **Timeline event volume** — write-heavy; ensure index is in place and payload is small.
7. **Feature-flag off path** must still render the existing `/admin/instructor-applicants` acceptably (don't break current users during rollout).

## D. Exact first prompt to give Sonnet

> You are continuing the "Instructor Applicant Workflow" implementation in the YPP Portal repo (`/home/user/YPP-Portal`). The complete implementation spec lives at `docs/instructor-applicant-implementation-plan.md` (you will create it in your first step by copying from `/root/.claude/plans/read-the-attached-ypp-portal-zip-ethereal-moonbeam.md`). All product decisions are locked — do not re-litigate.
>
> Work on branch `claude/implement-instructor-workflow-Kwx2M` (create if it does not exist). Execute ONLY Steps 1–4 of "E. Exact first coding steps" in the plan:
>
> 1. Copy the plan file into `docs/instructor-applicant-implementation-plan.md` verbatim.
> 2. Ensure you are on branch `claude/implement-instructor-workflow-Kwx2M`.
> 3. Edit `prisma/schema.prisma` per Part 2.A of the plan: add `HIRING_CHAIR` to `RoleType`; add `CHAIR_REVIEW` to `InstructorApplicationStatus`; add `SUBJECT_MATTER_FIT` to `InstructorReviewCategoryKey`; rename `ACCEPT_WITH_REVISIONS` → `ACCEPT_WITH_SUPPORT` in `InstructorInterviewRecommendation`; add enums `ApplicantDocumentKind`, `InterviewerAssignmentRole`, `ChairDecisionAction`; add models `InstructorApplicationInterviewer`, `ApplicantDocument`, `InstructorApplicationChairDecision`, `InstructorApplicationTimelineEvent`; add nullable fields on `InstructorApplication` (`reviewerId`, `reviewerAssignedAt`, `reviewerAssignedById`, `chairQueuedAt`, `materialsReadyAt`, `archivedAt`) and relations listed in the plan.
> 4. Update every code reference to `ACCEPT_WITH_REVISIONS` in the repo (grep `ACCEPT_WITH_REVISIONS` and replace in `.ts`, `.tsx`, templates, tests).
> 5. Run `npx prisma migrate dev --name instructor_applicant_workflow_v1` and commit the generated migration SQL.
> 6. Commit as `feat(applicant-workflow): schema + enum rename for Instructor Applicant V1` on the feature branch. Do NOT push or create a PR yet.
>
> Constraints: additive changes only (besides the enum rename, which is safe via `ALTER TYPE RENAME VALUE`); keep the feature flag `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1` in mind but don't implement gating logic yet. After committing, stop and report a summary — what changed, any grep hits you had to update, and the new migration file path. I will then instruct you to proceed with Steps 5+ (permissions, queries, actions, components).

---

**PART 4 COMPLETE**
