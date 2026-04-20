# Instructor Applicant Workflow V1 — Operator Runbook

## 1. Overview

This runbook covers day-to-day and incident operations for the **Instructor Applicant Workflow V1** — the end-to-end pipeline that takes an instructor application from initial submission through reviewer evaluation, structured interviews, chair decision, and onboarding sync.

The workflow is guarded by the feature flag `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1`. When the flag is off the portal falls back to the pre-V1 application management experience; no data is lost.

Related docs:
- Product spec: `docs/instructor-applicant-implementation-plan.md`
- Rollout guide: `docs/brayden/instructor-applicant-workflow-rollout.md`
- Native training + interview gate: `docs/brayden/instructor-training-interview-native-runbook.md`

---

## 2. Roles

| Role | Who | What they can do |
|------|-----|-----------------|
| **ADMIN** | Portal admins | Full access: assign any reviewer/interviewer, act as chair, see all chapters, force-send to chair, archive |
| **HIRING_CHAIR** | Designated hiring chairs (assigned via Admin → User Management) | See and act on the Chair Queue across all chapters; approve / reject / hold / request info / request second interview |
| **CHAPTER_PRESIDENT** | Chapter leads | See and manage applicants from their own chapter; assign reviewers + interviewers; cannot act as chair |
| **Reviewer** | Staff assigned to review an application | Write the 7-category rubric review and set a next-step recommendation |
| **Interviewer** | Staff assigned to conduct an interview | Access the interviewer workspace, submit 7-category interview rubric |
| **Applicant** | Instructor candidate | Confirm interview slots, upload Course Outline + First Class Plan |

### Assigning the HIRING_CHAIR role

1. Admin → Users → find the user.
2. Add role: **HIRING_CHAIR**.
3. The user will see a "Chair Queue" entry in their primary nav on next login.

If no HIRING_CHAIR is assigned, ADMINs retain full chair authority as fallback.

---

## 3. Full Workflow Walkthrough

### Stage 1 — Intake (status: `SUBMITTED`)

An instructor submits an application via the public portal. The system:
- Creates an `InstructorApplication` record with `status = SUBMITTED`.
- Fires `sendNewApplicationNotification` to chapter leads and admins.
- The application appears in the **New** column of the Command Center kanban.

**Admin/Chapter President action**: Open the application from the pipeline or the Quick Drawer. Assign a reviewer using the Reviewer Assign Picker (shows active load badge, chapter match, last-assigned date). On assignment:
- Status advances automatically to `UNDER_REVIEW`.
- Reviewer receives an assignment email (debounced: one email per 5-minute window per reviewer).

### Stage 2 — Reviewer Evaluation (status: `UNDER_REVIEW` / `INFO_REQUESTED`)

The assigned reviewer opens `/applications/instructor/[id]` and completes the 7-category rubric:

| Category | What it measures |
|----------|-----------------|
| Curriculum Strength | Lesson design quality |
| Relationship Building | Student connection skills |
| Organization & Commitment | Follow-through and reliability |
| Community Fit | YPP culture alignment |
| Long-Term Potential | Growth trajectory |
| Professionalism & Follow-Through (Interview Readiness) | Communication and readiness |
| Subject Matter Fit | Teaching subject depth |

The reviewer selects a **next step**:
- `MOVE_TO_INTERVIEW` → triggers interviewer assignment
- `REQUEST_INFO` → moves to `INFO_REQUESTED`; applicant must respond to re-enter `UNDER_REVIEW`
- `HOLD` → parks the application as `ON_HOLD`
- `REJECT` → terminal state

**Overdue signal**: If a reviewer has not submitted within 5 days of assignment, the pipeline card shows an **Overdue** chip.

### Stage 3 — Interview Assignment & Scheduling (status: `INTERVIEW_SCHEDULED`)

After `MOVE_TO_INTERVIEW`:
1. Assign a **LEAD** interviewer (required) and optionally a **SECOND** interviewer.
2. Interviewers receive assignment emails (debounced per 5-minute window).
3. The applicant confirms a slot or submits preferred times.

**Materials gate** (soft): The application shows a **Materials missing** chip until the applicant uploads both:
- Course Outline (`COURSE_OUTLINE`)
- First Class Plan (`FIRST_CLASS_PLAN`)

Once both are uploaded `materialsReadyAt` is stamped and the card moves from **Interview Prep** to **Ready for Interview**.

### Stage 4 — Post-Interview Evaluation (status: `INTERVIEW_COMPLETED` → `CHAIR_REVIEW`)

After the interview, each assigned interviewer opens their workspace at `/applications/instructor/[id]/interview` and submits a 7-category interview rubric with a recommendation:
- `ACCEPT`
- `ACCEPT_WITH_SUPPORT`
- `HOLD`
- `REJECT`

When **all active** (non-removed) interviewers submit their review, the system **auto-advances** the application:

```
INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED → CHAIR_REVIEW
```

This happens atomically in a transaction with a row-level status check to prevent race conditions.

**Stuck applications**: If an application remains in `INTERVIEW_COMPLETED` for more than 7 days, a **Stuck** chip appears on the pipeline card. An admin can use **Force to Chair** (from the Quick Drawer) to advance it manually with an override reason (required for audit).

### Stage 5 — Chair Queue (status: `CHAIR_REVIEW`)

HIRING_CHAIRs and ADMINs see the application in the Chair Queue at `/admin/instructor-applicants/chair-queue`. The board is organized by chapter tab with a YPP-wide toggle.

Clicking an application row opens the **Chair Comparison Slideout**, which shows:
- Applicant summary (name, chapter, subjects, materials status, days in queue)
- Decision Readiness Checklist (informational — no hard blocks)
- Reviewer note
- Per-interviewer rubric dots + recommendation + summary
- Materials viewer (Course Outline, First Class Plan)
- Rationale textarea + Comparison Notes (internal)

**Chair actions**:

| Action | Resulting status | Notes |
|--------|-----------------|-------|
| Approve | `APPROVED` | Triggers onboarding sync atomically; if sync fails, decision is rolled back |
| Reject | `REJECTED` | Terminal; archived at T+30d |
| Hold | `ON_HOLD` | Can resume to review or interview |
| Request Info | `INFO_REQUESTED` | Applicant must respond |
| 2nd Interview | `INTERVIEW_SCHEDULED` | Prior reviews are preserved; audit note recorded |

**Stale-state guard**: If the application status changed while the slideout was open, the chair sees an amber toast: "This application was updated since you opened it — close and reopen." The decision is blocked until the page is refreshed.

### Stage 6 — Approval & Onboarding Sync (status: `APPROVED`)

On `APPROVE`, the following run atomically:
1. `InstructorApplicationChairDecision` is recorded.
2. `InstructorApplication.status` → `APPROVED`.
3. `User.primaryRole` → `INSTRUCTOR`.
4. `UserRole` upsert: `INSTRUCTOR`.
5. `InstructorApproval` created (if missing) with `TRAINING_IN_PROGRESS`.

Then, in a separate post-transaction call, `syncInstructorApplicationWorkflow()` runs to sync the native interview gate and training assignment.

**If sync fails**: The decision is rolled back (status reverts to `CHAIR_REVIEW`, decision is superseded, a `SYNC_ROLLBACK` timeline event is written). The chair sees: "Onboarding sync failed — decision was reversed. Please try again."

### Stage 7 — Archive

Terminal applications (`APPROVED`, `REJECTED`, `WITHDRAWN`) older than 30 days are archived nightly by the auto-archive cron. They move to the **Archive** tab (`?tab=archive`). Admins can also manually archive from the application cockpit.

---

## 4. Feature Flag

| Variable | Default | Effect |
|----------|---------|--------|
| `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1` | `true` | Controls the new pipeline UI and all V1 actions. Set to `false` to fall back to the legacy experience without data loss. |

To flip the flag in Vercel:
1. Vercel Dashboard → Project → Settings → Environment Variables.
2. Update `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1` to `false`.
3. Redeploy (or use instant rollback if available).

---

## 5. Cron Jobs

| Job | Route | Schedule (default) | Env var |
|-----|-------|--------------------|---------|
| Chair digest email | `POST /api/admin/applicants/chair-digest` | `0 14 * * 1-5` (2 pm Mon–Fri) | `INSTRUCTOR_CHAIR_DIGEST_CRON` |
| Auto-archive terminal apps | `POST /api/admin/applicants/auto-archive` | `0 3 * * *` (3 am daily) | — |

Both routes require `Authorization: Bearer ${CRON_SECRET}` header.

**`CRON_SECRET`** must be set in Vercel environment variables and match the value in `vercel.json`.

To manually trigger:
```bash
curl -X POST https://your-domain.com/api/admin/applicants/auto-archive \
  -H "Authorization: Bearer $CRON_SECRET"
```

The digest skips sending if there are no `CHAIR_REVIEW` applications. Both jobs are idempotent.

---

## 6. Rollout & Rollback

See `docs/brayden/instructor-applicant-workflow-rollout.md` for the full staged rollout checklist.

**Quick rollback**:
1. Set `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1=false` in Vercel.
2. Redeploy or use instant rollback.
3. Schema is purely additive — no down-migration needed.
4. All workflow data persists and is visible again when the flag is re-enabled.

---

## 7. Backfill Instructions

After deploying the migration to an existing database, run:

```bash
npm run backfill:applicant-workflow
```

This script (`scripts/backfill-instructor-applicant-workflow.mjs`) is **idempotent** (safe to rerun). It:
1. Populates `reviewerId` from the latest lead `InstructorApplicationReview` per application.
2. Seeds coarse `STATUS_CHANGE` timeline events from `updatedAt` timestamps.
3. Sets `materialsReadyAt = NULL` for all existing rows (no documents yet).
4. Sets `archivedAt = updatedAt` on terminal applications older than 30 days.

**Verify after backfill**:
```bash
# Count applications by status
node -e "
const { prisma } = require('./lib/prisma');
prisma.instructorApplication.groupBy({ by: ['status'], _count: true }).then(console.log);
"
```

Compare against the pre-migration audit counts.

---

## 8. Troubleshooting

### Risk 1 — Chair acts on stale state
**Symptom**: Chair sees amber toast "This application was updated since you opened it."
**Cause**: Another admin changed the status (e.g. added a second interview) between the chair opening the slideout and clicking Approve.
**Fix**: Close and reopen the slideout. The fresh status will be loaded.

### Risk 2 — Removed interviewer's review still affects auto-advance
**Behavior by design**: When an interviewer is removed (`removedAt` is set), their existing review is preserved for audit. The auto-advance count uses only active (non-removed) assignments. This means removing an interviewer who already reviewed should not block auto-advance.
**Verify**: Check `InstructorApplicationInterviewer` — active assignments have `removedAt = NULL`.

### Risk 3 — Second interviewer never submits (Stuck)
**Symptom**: Pipeline card shows **Stuck** chip after 7 days in `INTERVIEW_COMPLETED`.
**Fix**: Admin opens the Quick Drawer → "Force to Chair" → provide an override reason. The application advances to `CHAIR_REVIEW` with the override reason in the timeline.

### Risk 7 — Notification spam on bulk reassignment
**Behavior**: Assignment emails are debounced: one email per assignee per application per 5-minute window (in-process store, serverless-safe within a single invocation).
**Note**: In concurrent serverless invocations, duplicate emails are theoretically possible. Upgrade to Redis-backed debounce (YPP-1003) if this becomes a problem.

### Risk 8 — Auto-advance race (two interviewers submit simultaneously)
**Behavior by design**: The auto-advance uses a `prisma.$transaction` with a row-level status re-read. If the status was already advanced by a concurrent request, the second transaction exits silently. No duplicate events or digests are produced.
**Verify**: Check `InstructorApplicationTimelineEvent` — should have exactly one `STATUS_CHANGE` row per transition.

### Risk 10 — Onboarding sync failure on APPROVE
**Symptom**: Chair sees "Onboarding sync failed — decision was reversed."
**Cause**: `syncInstructorApplicationWorkflow()` threw after the transaction committed.
**Fix**: 
1. Check server logs for `[chairDecide] onboarding sync failed` — includes the error.
2. Verify the application status is back to `CHAIR_REVIEW` (the compensation ran).
3. Check `InstructorApplicationTimelineEvent` for a `SYNC_ROLLBACK` entry.
4. Resolve the underlying sync error (often a DB connectivity issue), then retry the chair decision.

### Risk 12 — PRE_APPROVED applications don't appear in Chair Queue
**Behavior by design**: `PRE_APPROVED` applications go through the interview pipeline first. They are excluded from the chair queue until the interview completes and auto-advance moves them to `CHAIR_REVIEW`.

### Risk 13 — HIRING_CHAIR not yet assigned to anyone
**Symptom**: Chair Queue page shows an empty state for HIRING_CHAIR users; ADMINs see the queue normally.
**Fix**: Assign the `HIRING_CHAIR` role to at least one user via Admin → Users. ADMINs always retain chair authority as fallback.

### Chair digest not delivering
1. Confirm `CRON_SECRET` is set and matches `vercel.json`.
2. Check Vercel Cron logs (Dashboard → Functions → Cron).
3. Manually trigger: `curl -X POST .../api/admin/applicants/chair-digest -H "Authorization: Bearer $CRON_SECRET"`.
4. Digest skips sending if there are zero `CHAIR_REVIEW` applications — verify counts first.

### Auto-archive not running
1. Check Vercel Cron logs for `auto-archive` route.
2. Manually trigger: `curl -X POST .../api/admin/applicants/auto-archive -H "Authorization: Bearer $CRON_SECRET"`.
3. Confirm `archivedAt` is set on qualifying rows.
