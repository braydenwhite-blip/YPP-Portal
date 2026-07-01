# Data 360 · Workflow Intelligence · Operating Analytics — Implementation Notes

Deepening pass on top of the completed workflow activation layer
(branch `claude/ypp-workflow-activation-5cnsca`, now merged into
`claude/ypp-operating-intelligence-layer-2gio1u`).

## Audit findings — what already exists (REUSE, do not rebuild)

### Workflow engine library (`lib/workflow-engine/`)
- `health.ts` — `computeWorkflowHealth()` → `WorkflowHealth = { status, reasons[] }`.
  Statuses: `BLOCKED | OVERDUE | STALLED | NEEDS_ATTENTION | ON_TRACK | COMPLETE | ARCHIVED`.
  Reason-based, deterministic, pure.
- `analytics.ts` — pure portfolio analytics: `buildPortfolioAnalytics`, `completionRate`,
  `countByStatus`, `overdueCount`, `blockedCount`, `activeCount`, `averageCycleHours`,
  `velocityPerWeek`, `averageStageDurations`, `identifyBottlenecks`. Portfolio-WIDE only.
- `queries.ts` — `getWorkflowAnalytics({templateId?})`, `listInstances(filter)`,
  `getInstanceDetail(id)`, `listTemplates()`. `InstanceFilter` supports status/templateId/ownerId/chapterId.
- `card-data.ts` — `getEntityWorkflowSummary`, `getWorkflowLinkedActionsData`,
  `getWorkflowLinkedMeetingsData`, `getWorkflowTimelineData`, `getWorkflowContextForActionItems`.
- `attachment.ts` — attach/detach/get/ensure; `WorkflowAttachment` (secondary entity links).
- `needs-attention.ts` — `loadWorkflowAttentionInputs()` feeds people-strategy engine.
- `meeting-sync.ts` — `getWorkflowContextForMeeting`, `WorkflowMeetingContext`.
- `entity-types.ts` — `WORKFLOW_ENTITY_TYPE_VALUES` (12 types) + labels.
- Blueprint template keys: `partner-acquisition`, `instructor-hiring`, `instructor-recruiting-campaign`,
  `chapter-launch`, `chapter-recovery`, `class-weekly-operations`, `curriculum-approval`,
  `mentorship`, `program-launch`, etc.

### Data 360 (already Phase-1 live) — `lib/data-360/` + `app/(app)/data-360/`
- `registry.ts` — 21-metric `MetricDefinition[]` registry (people/programs/chapters/pipeline/work/partners/fundraising).
  **Zero workflow metrics today.**
- `overview.ts` `loadData360Overview`, `needs-attention.ts`, `range.ts` (`resolveRange`/`rangeWhere`),
  `timeseries.ts` (`buildMonthlyCumulative`, `seriesWindowStart`), `metrics.ts`, `views.ts` (role lenses).
- UI: `page.tsx` (requireLeadership), `data-360-shell.tsx` (tabs/lens/range/search),
  `sections.tsx` (Overview/People/Programs/Chapters/Fundraising/Performance/Geography/Dictionary),
  `primitives.tsx` (hand-rolled SVG `AreaChart`, `BarRows`, `KpiCard`, `Panel`).

### Chapter analytics — `lib/chapters/`
- `chapter-growth.ts` — 15 KPI keys, `WEEK_TARGETS` (10-week playbook expectations),
  `buildChapterKpiSnapshot`, `compareKpiSnapshots`, `getPlaybookTargetsForWeek`,
  `getChapterGrowthStatus/Signals/NextAction/Milestones`, `summarizeChapterGrowth`.
- `snapshot-capture.ts` — `captureChapterKpiSnapshot(chapterId, weekStart)` → `ChapterWeeklyKpiSnapshot`.
- `operating-system.ts` `loadChapterOperatingSystem`; `leadership.ts` `loadChapterAnalytics`; `impact-meeting.ts`.

### Needs Attention — `lib/people-strategy/needs-attention.ts`
- `computeNeedsAttention` → `AttentionItem { category, severity, reason, subjectKind, subjectId, subjectLabel, daysDelta, confidential }`.
- Already has `WORKFLOW_*` categories (STEP_OVERDUE, INSTANCE_STALLED, OWNER_MISSING, BLOCKED, MEETING_MISSING, ESCALATED, STAGE_DURATION_EXCEEDED).
- `loadPeopleStrategyAttention()` composes people/escalation/mentorship/workflow inputs.

### Week bucketing — `lib/weekly-meetings/week.ts`
- `weekStartFor` (Mon 00:00 UTC), `weekEndFor`, `addWeeks`, `parseWeekKey`, `weekKey`, `weekLabel`.

### Visualization — hand-rolled SVG (no chart lib originally)
- `GrowthSparkline`, `ActionStatusDonut`, `DepartmentBars`.
- **Now added `recharts@^3.9.1`** (user requested a chart library) for premium time-series/trend charts.
- ui-v2 primitives: `StatCardV2`, `MetricStrip`, `PageHeaderV2`, `SectionHeaderV2`, `CardV2`,
  `DataTableShell`/`TableV2`, `StatusBadge`, `EntityChip`, `EmptyStateV2`, `FilterBar`/`FilterChipLink`, `ModalV2`.

## Data-model constraints (honest gaps)
- `WorkflowInstance.chapterId` optional/loose (no FK). Workflows without chapterId cannot be per-chapter grouped → bucket as "Unassigned".
- `WorkflowStepExecution` / `WorkflowEvent` / `WorkflowAttachment` have no direct chapterId → JOIN via instance.
- "Actions created from workflows" = `WorkflowStepExecution.linkedActionItemId IS NOT NULL` (reliable). Meetings = `linkedMeetingId`.
- `InstructorApplication`, `CurriculumDraft`, `Mentorship` have no direct chapterId (via user.chapterId, may be null).
- `Partner.stage` is a String vocabulary, not an enum.
- No master `/sessions` list route → sessions drilldown shows an honest disabled state.
- `Chapter` has no reliable createdAt for week bucketing (use `launchedAt`/`lifecycleUpdatedAt`).

## Plan (build on top; verify continuously)

1. **`lib/data-360/expectations.ts`** — central chapter + workflow expectations (Part 9). Pure + tested.
2. **`lib/data-360/workflow-metrics.ts`** — workflow-operating metric definitions appended to the registry.
3. **`lib/data-360/workflow-analytics.ts`** — pure aggregations + server loaders:
   overview, byChapter, byEntityType, byTemplate, healthDistribution, stepAnalytics,
   linkedActionAnalytics, linkedMeetingAnalytics, attachmentAnalytics, needsAttentionAnalytics,
   `workflowData360DrilldownHref`.
4. **`lib/data-360/workflow-trends.ts`** — pure week bucketing + loader for week-by-week workflow series.
5. **`lib/data-360/chapter-analytics.ts`** — chapter comparison rows (growth + workflow KPIs) vs expectations, ranking, trends.
6. **`lib/data-360/suggestions.ts`** — deterministic gap → workflow-template suggestions.
7. **`components/data-360/charts/`** — recharts wrappers themed to brand: `TrendChart` (multi-series week),
   `Sparkline`, `MiniBars`, `HealthBar`. Client components.
8. **Data 360 surfaces** — new "Workflows" section + deepened "Chapters" comparison grid (expectations row),
   workflow health strip on Overview, operating trends, Needs Attention queue, suggestions panel.
9. **Workflow cockpit** — add a Workflow Intelligence panel (why/source/metric/trend/timing) without duplicating existing sections.
10. **Embedded visuals** — sparklines/mini charts in `EntityWorkflowCard`, meeting runner, home.
11. **Chapter Impact Meeting** — structured "Chapter Health Update" table (metric/expected/current/Δ/status/trend/records/workflow-suggestion).
12. **Drilldowns** — add `?chapterId/?templateId/?health/?entityType` to `/workflows`; honest disabled states where impossible.
13. **Scoped-out investigation** — Student Advising / Weekly Leadership triggers / follow-up carry-forward (document hooks, add manual suggestion where no clean hook).
14. **Tests** — expectations, week bucketing, workflow aggregations, health distribution, drilldown hrefs, chapter comparison, suggestions.
15. **Verify** — typecheck, lint, nav:check, vitest (compare against base for pre-existing failures).

## Non-goals (preserve prior work)
- No second workflow engine, health engine, action/meeting sync, or metric registry.
- No vague health scores, no fake data, no dead links.

## Scoped-out areas — investigation findings (Part 13)

### Student Advising auto-start
- A status hook DOES exist: `StudentAdvisorAssignment.advisingStatus`
  (`enum AdvisingStatus = ENGAGED | NEEDS_ATTENTION | INACTIVE | READY_FOR_NEXT`),
  indexed `[isActive, advisingStatus]`, transitioned in `lib/advising/relationship.ts`.
- BUT an end-to-end auto-start still needs two product decisions that would be *inventing*
  rules: (a) there is no advising blueprint template to start, and (b) `WORKFLOW_ENTITY_TYPE`
  has only `USER` (covers students) — no advising-assignment subject type, so no
  `WorkflowTrigger.subjectType` to match. Missing hook, stated precisely: a seeded advising
  blueprint + a `subjectType` convention for the advising assignment.
- Safe manual surface ALREADY exists: the student detail page renders `EntityWorkflowCard`
  (entityType `USER`), so staff can start an advising workflow manually today. Not auto-wired
  here to avoid fabricating a template/trigger.

### Weekly Leadership Meeting auto-start
- No clean hook. `MeetingType = OFFICER | WEEKLY_TEAM_IMPACT | CHAPTER_IMPACT | GENERIC` — there
  is no dedicated leadership meeting type and no recurring/cadence model in the schema. Missing
  hook: a cadence/recurring-meeting model or a distinct leadership meeting type + status
  transition. Manual path remains `/workflows/new` and the meeting runner's workflow context.

### Unresolved follow-ups carry-forward
- No cadence model to pair meetings automatically. `meeting-sync.ts` already has
  `carryForwardWorkflowItems(meetingId)` but it only NOTES unresolved items on the workflow
  timeline (does not re-parent). The correct next step is a MANUAL "carry forward to next
  selected meeting" action (`carryForwardFollowUp({ followUpId, targetMeetingId })` that
  re-parents `MeetingFollowUp.meetingId`) — deferred here rather than guessing automatic
  pairing, per the brief. Documented, not fabricated.

## Final verification
- typecheck: 31 pre-existing errors, **0 new** (baseline captured post-merge, pre-Data-360).
- lint: clean on all new/changed files.
- nav:check: passes (224 catalog routes; no new routes added — reused /workflows, /data-360, /meetings).
- vitest: new `tests/lib/data-360/**` (38 tests) pass; full suite compared against pre-existing failures.
