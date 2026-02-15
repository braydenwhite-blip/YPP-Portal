# Instructor Training + Interview Native Runbook

## 1. Purpose
This runbook explains exactly how to operate the native instructor readiness flow in YPP Portal.

The flow is:
1. Instructor joins (application accepted or manually added).
2. Instructor completes required academy modules.
3. Instructor schedules interview (posted slot or availability request).
4. Reviewer records interview completion and outcome.
5. First class publish is blocked until training + interview pass/waive.

## 2. Feature Flags
Set these environment variables to control rollout:

1. `ENABLE_NATIVE_INSTRUCTOR_GATE=true`
2. `ENFORCE_PRE_OFFERING_INTERVIEW=true`

Safe rollout order:
1. Deploy code with both flags set to `false`.
2. Run backfill script.
3. Set `ENABLE_NATIVE_INSTRUCTOR_GATE=true`.
4. Verify readiness dashboards.
5. Set `ENFORCE_PRE_OFFERING_INTERVIEW=true`.

## 3. One-Time Backfill
Run once per environment (safe to rerun):

```bash
node scripts/backfill-native-instructor-readiness.mjs
```

Backfill does this:
1. Seeds missing training assignments for required modules.
2. Creates missing interview gates.
3. Auto-passes accepted applications that already have interview evidence.
4. Creates teaching permissions from legacy approvals.
5. Marks existing `PUBLISHED`/`IN_PROGRESS` offerings as grandfathered.

## 4. Daily Reviewer Operations (Admin)
Route: `/admin/instructor-readiness`

### 4.1 Review training evidence
1. Open **Training Evidence Queue**.
2. Open file.
3. Choose `APPROVED`, `REVISION_REQUESTED`, or `REJECTED`.
4. Submit review notes.

### 4.2 Review readiness requests
1. Open **Readiness Review Queue**.
2. Approve and assign level (101/201/301/401), or request revision.
3. Confirm instructor interview gate is passed/waived before approving.

### 4.3 Manage interview gate
1. Open **Interview Queue**.
2. Post a slot OR accept a preferred-time request.
3. After interview happens, mark slot completed.
4. Set final outcome: `PASS`, `HOLD`, `FAIL`, `WAIVE` (waive is admin-only).

### 4.4 Grant manual teaching permissions
1. Use **Per-Instructor Readiness** card.
2. Select level and reason.
3. Submit grant.

### 4.5 Manage academy curriculum content
Route: `/admin/training`

1. Open a module card.
2. Add or update required checkpoints.
3. Add or update quiz questions and correct answers.
4. Keep `requiresQuiz` enabled only when questions exist.
5. Keep required modules actionable with at least one path:
   video OR required checkpoints OR quiz OR evidence.

## 5. Daily Reviewer Operations (Chapter Lead)
Route: `/chapter-lead/instructor-readiness`

Scope rules:
1. Chapter leads can only act on instructors in their own chapter.
2. Admin can act across all chapters.
3. Waive outcome remains admin-only.

## 6. Instructor Operations
Route: `/instructor-training`

1. Complete each module at `/training/[id]`.
2. Submit required quiz/evidence.
3. Confirm a posted interview slot OR submit preferred times.
4. Request readiness review after required modules are complete.
5. Wait for reviewer decision.

Compatibility note:
1. Legacy links to `/instructor/training-progress` redirect to `/instructor-training`.

## 7. Publish Gate Behavior
Publish transitions in class offerings now check readiness.

Blocked if all are true:
1. Native gate enabled.
2. Instructor is publishing first live offering.
3. Required training not complete OR interview not passed/waived.

Allowed when:
1. Instructor meets training + interview readiness, or
2. Offering has `grandfatheredTrainingExemption=true`.

## 8. Edge Cases
1. **Instructor already interviewed during application flow**
   The gate auto-syncs to passed if interview evidence exists.
2. **Instructor has existing live class before rollout**
   Backfill marks live offerings as grandfathered to avoid disruption.
3. **Duplicate scheduling attempts**
   System blocks multiple confirmed interview slots for the same gate.
4. **Outcome before completion**
   System blocks PASS/HOLD/FAIL outcome unless an interview slot is marked completed.

## 9. Verification Checklist
1. Instructor cannot publish first offering without readiness.
2. Instructor can schedule interview from training progress.
3. Admin and chapter lead can clear blockers from readiness pages.
4. Existing live offerings still run after rollout.
5. Dashboard shows one next action from readiness engine.

## 10. Bring Your Own Academy Data (JSON + Scripts)
Source-of-truth file:
1. `data/training-academy/content.v1.json`

Command sequence:
1. Validate file:
   - `npm run training:validate`
2. Preview changes:
   - `npm run training:import -- --file=data/training-academy/content.v1.json --dry-run`
3. Apply changes:
   - `npm run training:import -- --file=data/training-academy/content.v1.json`
4. Optional prune stale rows:
   - `npm run training:import -- --file=data/training-academy/content.v1.json --prune=true`
5. Export DB -> JSON:
   - `npm run training:export -- --file=data/training-academy/content.v1.json`

## 11. Video Watch Tracking Notes
1. Required-module video tracking is supported only for `YOUTUBE`, `VIMEO`, and `CUSTOM`.
2. Completion threshold is 90% watched.
3. Progress saves automatically on interval and on page-hide/unload.
4. If an instructor reports stuck progress, verify:
   - module has `videoProvider` set,
   - module `videoDuration` is set correctly,
   - provider is one of supported values above.
