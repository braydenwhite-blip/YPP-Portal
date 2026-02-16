# Chapter OS Runbook (Recruiting + Interviews + Decisions)

## 1. Purpose
This runbook explains exactly how a chapter team runs hiring in the portal without side instructions.

Canonical route:
1. `/chapter/recruiting`

## 2. Who Can Do What
### 2.1 Admin
1. Can manage positions in any chapter.
2. Can run interview actions for any chapter application.
3. Can make final decisions for all position types.
4. Keeps override authority for protected/global roles.

### 2.2 Chapter Lead
1. Can manage positions only in their own chapter.
2. Can run interview actions only for applications in their own chapter.
3. Can make final decisions only for chapter-scoped types:
   - `INSTRUCTOR`
   - `MENTOR`
   - `STAFF`
   - `CHAPTER_PRESIDENT`
4. Cannot make final decisions for `GLOBAL_ADMIN`.

## 3. Daily Chapter Hiring Workflow
### 3.1 Open a new position
1. Open `/chapter/recruiting`.
2. Click `+ New Opening`.
3. Fill title, role type, description, requirements.
4. Set `visibility`, `interviewRequired`, deadline, and target start date.
5. Submit.

### 3.2 Review incoming candidates
1. In `/chapter/recruiting`, check `Candidate Pipeline`.
2. Open each candidate in `/applications/[id]`.
3. Move status to `UNDER_REVIEW` if needed.
4. Post interview slot(s).

### 3.3 Run interview operations
1. Post slot (`POSTED`) from `/chapter/recruiting` or `/applications/[id]`.
2. Candidate confirms slot (`CONFIRMED`).
3. Reviewer marks interview complete (`COMPLETED`).
4. If needed, cancel unused slot (`CANCELLED`).

### 3.4 Save structured interview notes
1. In `/applications/[id]`, submit note with:
   - summary content,
   - recommendation (`STRONG_YES`, `YES`, `MAYBE`, `NO`),
   - strengths,
   - concerns,
   - next-step suggestion.
2. Keep at least one recommendation note before decision.

### 3.5 Finalize decision
1. Confirm decision banner shows no blockers.
2. Submit chapter decision (or admin decision if role requires admin authority).
3. Candidate is notified automatically.

## 4. Decision Blockers (What Must Be True First)
If `position.interviewRequired=true`, final decision stays blocked until both are true:
1. At least one interview slot is `COMPLETED`.
2. At least one interview note includes a recommendation.

## 5. Position Visibility Rules
1. `CHAPTER_ONLY`: visible to same chapter users (plus privileged reviewers).
2. `NETWORK_WIDE`: visible to logged-in portal users.
3. `PUBLIC`: visible broadly.

Use `/positions` filters to verify discoverability by:
1. Chapter,
2. Role type,
3. Visibility,
4. Open/closed status.

## 6. Decision Authority Matrix
1. `INSTRUCTOR`: Chapter Lead (same chapter) or Admin
2. `MENTOR`: Chapter Lead (same chapter) or Admin
3. `STAFF`: Chapter Lead (same chapter) or Admin
4. `CHAPTER_PRESIDENT`: Chapter Lead (same chapter) or Admin
5. `GLOBAL_ADMIN`: Admin only

## 7. Escalation Path
1. If role type is `GLOBAL_ADMIN`: escalate to Admin reviewer immediately.
2. If candidate belongs to another chapter: escalate to that chapter lead or Admin.
3. If chapter assignment is missing/wrong: escalate to Admin to correct user/position chapter mapping.
4. If interview timeline is inconsistent (e.g., completed before confirmed): escalate to Admin to normalize slot state in workspace.

## 8. Auditing and Notifications
System writes audit metadata for:
1. position create/edit/close/reopen/visibility changes,
2. interview slot lifecycle transitions,
3. final decision actions.

System notifications fire for:
1. interview slot posted,
2. interview slot confirmed,
3. interview slot cancelled,
4. interview completed,
5. final decision posted.

## 9. Compatibility and Transition
1. `/chapter/applicants` remains available and links to `/chapter/recruiting`.
2. Recruiters should use `/chapter/recruiting` as the source of truth.

## 10. Smoke Test Checklist
1. Chapter lead creates position in own chapter.
2. Position appears in `/positions` with correct visibility.
3. Candidate applies and appears in pipeline.
4. Slot goes `POSTED -> CONFIRMED -> COMPLETED`.
5. Structured recommendation note saved.
6. Decision button unblocks only after requirements are met.
7. Candidate receives decision notice.
