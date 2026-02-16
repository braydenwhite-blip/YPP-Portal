# Primary-Role Dashboard + 45-Day Expansion Plan

## 1. Objective
Create one fast command center at `/` for the user's primary role only, then expand Chapter OS operations in sequenced phases.

North-star metric:
1. Reduce time from dashboard load to first required action completion.

## 2. What Is Live Now
1. Primary-role dashboard resolver is active.
2. Dashboard renders:
   - role hero,
   - KPI strip,
   - live queue board,
   - next actions,
   - searchable all-tools explorer.
3. Dashboard analytics events are logged:
   - `dashboard_card_open`
   - `dashboard_queue_open`
   - `dashboard_search`
4. Chapter recruiting deep links now support tab targeting:
   - `positions`
   - `candidates`
   - `interviews`
   - `decisions`
5. Feature flag exists:
   - `ENABLE_UNIFIED_ALL_TOOLS_DASHBOARD`

## 3. Rollout Steps (Simple and Safe)
### Step 1: Staging
1. Set `ENABLE_UNIFIED_ALL_TOOLS_DASHBOARD=true` in staging.
2. Verify each role sees only primary-role modules.
3. Verify queue cards open correct route and tab.
4. Check analytics events are written.

### Step 2: Production soft rollout
1. Deploy with flag enabled.
2. Watch logs and feedback for Admin and Chapter Lead users first.
3. Confirm no cross-chapter data leakage.

### Step 3: Full rollout
1. Keep flag on for all roles.
2. Retire legacy dashboard references after one stable week.

## 4. Day-by-Day Plan (45 Days)
## Phase 1 (Days 1-14): Command Center Hardening
1. Add SLA labels to queue cards:
   - `needs action today`
   - `overdue`
   - `healthy`
2. Add chapter queue export actions (CSV) for:
   - interview queue,
   - decision-ready queue,
   - readiness blockers.
3. Add dashboard performance monitoring:
   - p95 data resolver latency,
   - p95 page render latency.
4. Add role-specific smoke tests for dashboard payloads.

Success target:
1. 40% faster first required action completion for Admin and Chapter Lead.

## Phase 2 (Days 15-30): Onboarding Tracker + Parent Ops
1. Add onboarding tracker models:
   - `OnboardingTrack`
   - `OnboardingTask`
   - `OnboardingTaskUpdate`
2. Add routes:
   - `/chapter/onboarding`
   - `/admin/onboarding-ops`
3. Add parent communication toolkit models:
   - `ParentCommsTemplate`
   - `ParentCommsSendLog`
4. Add routes:
   - `/chapter/parent-comms`
   - `/admin/parent-comms`
5. Add dashboard queue cards for:
   - onboarding blockers,
   - parent sends due.

Success target:
1. New chapter onboarding runs without external spreadsheet tracking.

## Phase 3 (Days 31-45): Governance + Risk Controls
1. Add chapter KPI snapshot model:
   - `ChapterKpiSnapshot`
2. Add SLA/ops rules model:
   - `OpsRule`
3. Add automatic at-risk panel on dashboard.
4. Add role matrix audit page by chapter and route.
5. Add escalation workflows for overdue queues.

Success target:
1. Cross-team handoffs run from portal state, not side Slack memory.

## 5. Weekly Operating Cadence
### Monday
1. Review queue trends and SLA breaches.
2. Prioritize top 3 platform blockers.

### Wednesday
1. Validate metrics after fixes.
2. Confirm no role/chapter permission regressions.

### Friday
1. Ship one operational speed improvement.
2. Update this runbook with outcome and next week priority.

## 6. Verification Checklist
1. Dashboard shows only primary-role tools.
2. All visible cards resolve to valid routes.
3. Chapter links with `?tab=` open the correct command-center section.
4. Queue counts are non-negative and scoped correctly.
5. Analytics events are captured for interactions.

## 7. Rollback Plan
If a production issue appears:
1. Set `ENABLE_UNIFIED_ALL_TOOLS_DASHBOARD=false`.
2. Redeploy.
3. Investigate with analytics + server logs before re-enabling.
