# Instructor Applicant Workflow V1 — Staged Rollout Checklist

## Overview

This document tracks the staged rollout of `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1`.
The schema migration (`instructor_applicant_workflow_v1`) is purely additive;
rollback requires only a flag flip — no down-migration.

Ref: `docs/brayden/instructor-applicant-workflow-runbook.md`

---

## Pre-Deploy Checklist

- [ ] Confirm migration `instructor_applicant_workflow_v1` is committed and present in `prisma/migrations/`
- [ ] Confirm staging `DATABASE_URL` and `DIRECT_URL` are set and accessible
- [ ] Run `npx prisma migrate deploy` in staging and verify zero errors
- [ ] Verify new tables exist:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_name IN (
    'InstructorApplicationInterviewer',
    'ApplicantDocument',
    'InstructorApplicationChairDecision',
    'InstructorApplicationTimelineEvent'
  );
  ```
- [ ] Verify enum values added:
  ```sql
  SELECT enumlabel FROM pg_enum
  JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
  WHERE pg_type.typname IN ('InstructorApplicationStatus','RoleType');
  ```
  Expected: `CHAIR_REVIEW` in `InstructorApplicationStatus`; `HIRING_CHAIR` in `RoleType`.
- [ ] Verify enum rename: `ACCEPT_WITH_SUPPORT` exists in `InstructorInterviewRecommendation` (not `ACCEPT_WITH_REVISIONS`)
- [ ] Set `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1=false` in staging (flag off before backfill)
- [ ] Run backfill:
  ```bash
  npm run backfill:applicant-workflow
  ```
- [ ] Verify backfill counts match pre-migration audit:
  ```bash
  # Count applications by status
  node scripts/count-applicant-status.mjs
  # (or use prisma studio / SQL)
  ```
- [ ] Confirm `backfill:applicant-workflow` is idempotent — run it twice and verify no duplicate rows

---

## Staging Rollout (Week 1)

- [ ] Set `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1=true` in staging
- [ ] Verify `/admin/instructor-applicants` loads with new kanban columns
- [ ] Verify `/admin/instructor-applicants/chair-queue` loads (may be empty — expected)
- [ ] Verify `/applications/instructor/[id]` cockpit loads for an existing application
- [ ] Run Playwright smoke suite:
  ```bash
  npx playwright test tests/e2e/smoke/instructor-applicants.spec.ts
  ```
- [ ] Manually walk the full lifecycle with the seeded HIRING_CHAIR account:
  1. Assign reviewer → verify `UNDER_REVIEW`
  2. Submit reviewer rubric → pick `MOVE_TO_INTERVIEW`
  3. Assign LEAD + SECOND interviewer → verify assignment emails (debounce test: reassign within 5 min → confirm single email)
  4. Upload Course Outline + First Class Plan → verify `Ready for Interview` column
  5. Submit both interview reviews → verify auto-advance to `CHAIR_REVIEW`
  6. Chair Approve → verify `APPROVED` + onboarding sync fires
- [ ] Watch telemetry for auto-advance anomalies (`applicant.status.auto_advanced` events):
  - Enable `TELEMETRY_ENABLED=true` in staging
  - Confirm one event per application per advance, not duplicates
- [ ] Verify chair digest email delivers at configured cron time
- [ ] Verify `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1=false` path: flag off → legacy `/admin/instructor-applicants` renders without errors

---

## Production Rollout

Deploy during a **low-traffic window** (weekday morning, before 9 am chapter time).

- [ ] Apply migration in production: `npx prisma migrate deploy` (automatic on Vercel deploy)
- [ ] Run backfill in production:
  ```bash
  DATABASE_URL="$PROD_DATABASE_URL" npm run backfill:applicant-workflow
  ```
- [ ] Set `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1=true` in Vercel production env vars
- [ ] Redeploy or trigger instant rollback to pick up new flag value
- [ ] Verify home page + instructor-applicants page load correctly
- [ ] Assign `HIRING_CHAIR` role to at least one production user
- [ ] Monitor chair digest delivery for **2 business days**:
  - Check Vercel Cron logs for `chair-digest` route
  - Confirm digest fires at configured schedule and delivers to HIRING_CHAIR users
- [ ] Monitor auto-advance telemetry for **1 week**:
  - Watch for `applicant.status.auto_advanced` events with duplicate applicationIds (race regression)
  - Alert threshold: >1 auto-advance event per application per hour

---

## Rollback

If issues are found after production enable:

1. Set `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1=false` in Vercel
2. Redeploy or use Vercel instant rollback
3. **No down-migration needed** — schema is additive; all V1 data persists
4. All workflow data is visible again when the flag is re-enabled

If a breaking schema issue is found (should not happen — all changes are additive):
1. Follow the standard Prisma migration rollback procedure
2. Create a new migration that reverts only the problematic change
3. Never use `prisma db push` in production

---

## Post-Rollout Checklist (T+30 days)

After the flag has been on in production for 30 days with stable traffic:

- [ ] Confirm no regression issues open in GitHub related to this workflow
- [ ] Confirm auto-archive cron is cleaning up terminal applications correctly
- [ ] Confirm telemetry shows expected event ratios (reviewer assigned : interviewer assigned : chair decided ≈ 1:1.5:1)
- [ ] Review notification delivery logs — confirm no duplicate assignment emails in bulk-reassign scenarios
- [ ] Merge any V2 features that were deferred (`docs/instructor-applicant-implementation-plan.md` Part 5)
- [ ] Remove the legacy application management code paths if confirmed safe:
  - Search for `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1` flag gates
  - Remove `false` branches and the flag itself once rollout is confirmed stable
  - Open a separate PR for the legacy cleanup to keep the diff reviewable
