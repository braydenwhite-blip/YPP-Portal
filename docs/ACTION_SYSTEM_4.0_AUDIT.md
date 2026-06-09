# Action System 4.0 — Audit & Implementation Plan

> Status: **Audit complete.** Authored before implementation (Phase A of the
> Action System 4.0 rebuild). This document maps the *current* action system
> exactly as it ships, identifies the honest data-contract gaps that blocked the
> Strategic Initiatives 3.5 pass from touching action **creation**, and lays out
> a concrete, backwards-compatible implementation plan.

The People-Strategy **Action Tracker** is already a large, mature system. This
pass does **not** rewrite it. It closes the one structural gap the 3.5 report
called out — *actions cannot honestly record where they came from or which
strategic project/initiative they serve* — and then builds a pure, tested
derivation + UX layer on top of that honest contract.

---

## 1. Current action data model

### Core model: `ActionItem` (`prisma/schema.prisma` §"ACTION TRACKER")

| Field | Type | Notes |
| --- | --- | --- |
| `id` | cuid | |
| `title` | String | |
| `description` | Text? | |
| `goalCategory` | String? | free-text ladder category |
| `actionType` | String? | controlled vocab (`lib/people-strategy/action-types.ts`) |
| `departmentId` | FK? | `Department` (functional area) |
| `status` | enum | `NOT_STARTED, IN_PROGRESS, COMPLETE, OVERDUE, BLOCKED, DROPPED` |
| `priority` | enum | `LOW, MEDIUM, HIGH, URGENT` |
| `deadlineStart` | DateTime | required |
| `deadlineEnd` | DateTime? | range end (canonical due = `deadlineEnd ?? deadlineStart`) |
| `completedAt` | DateTime? | set on COMPLETE |
| `visibility` | enum | `OFFICERS_ONLY, ALL_LEADERSHIP` |
| `leadId` | FK | single accountable lead (denormalized) |
| `officerMeetingId` | FK? | `OfficerMeeting` link |
| `createdById` | FK | |
| `flaggedAt` / `escalatedToLeadershipAt` / `resolvedAt` / `boardRolledUpAt` | DateTime? | escalation lifecycle |
| `relatedEntityType` / `relatedEntityId` | String? | **polymorphic** link |

### Relationships
- `assignments` → `ActionAssignment` (`LEAD / EXECUTING / INPUT`)
- `comments` → `ActionComment` (`NOTE / INPUT_REQUESTED`)
- `fileLinks` → `ActionFileLink`
- `emailLogs` → `ActionEmailLog`
- `meetingNotes` → `MeetingNote` (per officer-meeting discussion)
- Back-relations from the Meetings Tracker: `convertedFromAgendaItems`
  (`MeetingAgendaItem.convertedActionId`), `linkedFromDecisions`
  (`MeetingDecision.linkedActionId`), `linkedFromFollowUps`
  (`MeetingFollowUp.linkedActionId`).

### Polymorphic related-entity vocabulary (`lib/people-strategy/constants.ts`)
```
RELATED_ENTITY_TYPE_VALUES = [CLASS_OFFERING, MENTORSHIP, USER, INSTRUCTOR_APPLICATION, PARTNER]
```
`DEPARTMENT` / `OFFICER_MEETING` are deliberately excluded (dedicated FKs);
`LEADERSHIP_PATHWAY` has no stable id. Validated by `parseRelatedEntityRef` /
`parseRelatedEntityUpdate` (pure, both-or-neither, enum membership, trim) which
back the create/update Zod schemas.

### What relationships are **missing** (the honest-contract gap)
1. **No source provenance.** An action does not record *how it was created*
   (manual / meeting / decision / project / initiative / entity / weekly review /
   command center / follow-up). Today provenance is *inferred* from
   `officerMeetingId` being non-null, or from the meeting back-relations. There
   is no first-class `sourceType` / `sourceId`, and **no project/initiative/
   follow-up provenance at all**.
2. **No honest strategic link.** Projects and initiatives are **config
   registries** (`STRATEGIC_INITIATIVES`, `STRATEGIC_PROJECTS` — stable string
   ids like `summer-camps-2026`), matched to work by **keyword/signal matchers**
   (`matchesInitiative`, `matchWork`). Strategic membership is therefore
   *derived by string-matching only* — there is no stored, user-affirmed link.
   This is exactly the "display-only assumption" the 3.5 report refused to build
   creation flows on top of.
3. **No "definition of done."** No `successDefinition`.
4. **No blocker reason.** `BLOCKED` status exists but carries no `blockedReason`.
5. **No completion outcome.** `completedAt` exists but no `completionNote` /
   `completionOutcome`.
6. **No next-follow-up date.** `deadlineEnd` is a range end, not a follow-up.
7. **No action→action follow-up link.** A follow-up action cannot point at the
   action it follows.

---

## 2. Current creation flow

- **Entry point:** `app/(app)/actions/new/page.tsx` → `ActionItemForm`
  (`components/people-strategy/action-item-form.tsx`, ~22 KB).
- **Server action:** `createActionItem` (`lib/people-strategy/action-items-actions.ts`),
  Zod `CreateActionItemSchema` + `superRefine` (related-entity + action-type
  validation), writes `prisma.actionItem.create`, seeds assignment rows + a
  "Action created" comment, notifies assignees, revalidates.
- **Prefill via URL params** (`lib/people-strategy/action-prefill.ts`,
  `ACTION_PREFILL_PARAM_KEYS`): `title, desc, relatedType, relatedId,
  fromMeeting, area, type, priority, dueInDays`. Builders exist for
  decision/entity/meeting (`buildActionPrefillFrom*`). Duplicate detection
  (`findDuplicateActionCandidates`, `titleSimilarity`) is already pure + tested.
- **Templates:** `ActionTemplate` model + `lib/people-strategy/action-templates.ts`
  (`listActionTemplates`, `getActionTemplate`, `templateToFormInitial`).

### What context is lost / too generic / confusing
- Prefill can carry an **entity** link and a **meeting** id, but **cannot carry a
  project or initiative**, a **source type**, a **success definition**, a
  **suggested owner**, or a **suggested due date** as first-class params.
- The form is one generic field dump. There is **no guided "quality builder"**
  (what / who / by when / done / blocker / next), **no inline quality warnings**,
  and the submit CTA is generic rather than context-aware.
- Strategic project/initiative CTAs (`buildProjectActionPrefill`,
  `buildInitiativeActionPrefill`) only pass `area` (goal category) and a title
  prefix, relying on the **matcher** to re-derive membership — i.e. the link is
  never affirmed, only hinted.

---

## 3. Current viewing flow

- **Inbox/list:** `app/(app)/actions/page.tsx` (My Actions) and
  `app/(app)/actions/all/page.tsx` (All Actions). Filtering/grouping is already
  strong: `applyActionFilters`, `matchesActionPreset`
  (`unassigned, due_soon, high_priority, blocked, waiting`),
  `groupActionsByLinkedEntity`, `smartBucket` (8-level actionable bucket),
  `effectiveStatus` (OVERDUE override). Presets + saved views exist.
- **Detail:** `app/(app)/actions/[id]/page.tsx` → `ActionDetailCard`
  (~28 KB). Already loads `getActionsForEntity`, `getActionsForMeeting`,
  `deriveStrategicContextForAction` (derived strategic context section).
- **Command Center:** `command-center-os.tsx` +
  `command-center-selectors.ts` — `buildAttentionQueue` / `attentionReason`
  (severity hierarchy: escalated, overdue≥7, flagged, blocked / stale≥14d,
  unowned, overdue 1-6, urgent / not-started-due-this-week), `buildWeeklyPulse`,
  `buildPersonMomentum`, `buildWinLog`.

### What is missing from viewing
- The inbox is **filter-first**, not **operational-inbox-first**: there is no
  single "Needs attention" ranked feed that fuses overdue + blocked + unowned +
  stale + missing-due-date + strategic-but-unlinked + decision-without-action,
  no "Fastest wins", no first-class "By source" grouping (the new contract
  enables this), and cards do not surface source/strategic context or a specific
  next-move CTA.
- The detail page derives strategic context but has **no "what matters now"**
  next-move panel, **no structured completion capture** (note/outcome/follow-up),
  **no structured blocker panel**, and **no honest source-provenance panel**
  (because the provenance isn't stored).

---

## 4. Current meeting ↔ action connection

- **Conversion:** `convertDecisionToAction` / `convertFollowUpToAction`
  (`lib/people-strategy/meetings-actions.ts`). A decision/follow-up becomes a
  real `ActionItem`; the meeting link is stored via `officerMeetingId`, and the
  decision/follow-up row stores `linkedActionId` (two-way).
- **Preserved today:** meeting id (`officerMeetingId`), decision text → title
  (`actionTitleFromDecision`), meeting category → `area`, entity link inherited
  from the meeting, `actionType=FOLLOW_UP`, default deadline.
- **Lost today:** explicit `MEETING_DECISION` vs `FOLLOW_UP` **source type**, the
  **decision id** (only the meeting id is kept), a **suggested owner** from
  meeting participants, and a **success definition** seeded from the decision.
- **No "Meeting Follow-Up Pack"** view: decisions-without-actions, open/overdue/
  recently-completed actions for a meeting, and suggested follow-ups are not
  aggregated as one derivation. `MeetingDecision.linkedActionId == null` is the
  honest signal for "decision without action" and is not yet surfaced as a list.

---

## 5. Current entity ↔ action connection

- `getActionsForEntity(type, id)` (`action-queries.ts`) returns actions for a
  polymorphic entity; `deriveStrategicEntityContext` aggregates strategic context
  for an entity's actions+meetings. Member/people pages render
  `member-people-strategy-section.tsx`, `strategic-entity-panel.tsx`,
  `operational-context-panel.tsx`.
- **Missing:** a consistent **Action Operating Panel** per entity (Person /
  Partner / Class / Instructor / Mentorship) showing open / overdue / blocked /
  last-completed / suggested-next + a context-passing "create action" CTA +
  "meeting decisions for this entity without actions". The data to do this
  honestly (entity link, meeting link, decision link) already exists; the
  derivation + panel do not.

---

## 6. Current strategic / project connection

- **Can an action connect to a project/initiative today?** Only by **derivation**
  (`deriveStrategicContextForAction` runs the registry matchers on the action's
  title/description/goalCategory/type/entity). There is **no stored link**, so:
  - membership silently changes if the title is edited,
  - a genuinely strategic action with an unfortunate title shows as non-strategic,
  - "create a project action" cannot *guarantee* the action joins the project.
- **Exact contract needed:** an explicit, optional, **registry-validated** string
  link on `ActionItem` — `strategicInitiativeId` / `strategicProjectId` —
  mirroring how `relatedEntityType` is a validated string (no Postgres FK,
  because initiatives/projects are config, not rows). Validated against
  `getInitiativeDef` / `getProjectDef`. The matcher stays, demoted to a
  **suggestion** engine for prefill + "looks strategic, link it?" hints.

---

## 7. Existing strengths to preserve (do NOT rewrite)

- Pure, tested derivation core: `my-actions-selectors.ts`,
  `command-center-selectors.ts`, `action-filters.ts`, `momentum.ts`,
  `strategic-context.ts`, `strategic-entity-context.ts`, `action-prefill.ts`
  (incl. duplicate detection), `action-types.ts`, `constants.ts` validators.
- The create/update server actions with Zod + `superRefine` + write-time
  existence checks, assignment-row seeding, notifications, revalidation.
- Filtering / presets / saved views / grouping / analytics on the inbox.
- Meeting conversion + two-way `linkedActionId` bookkeeping.
- Feature-flag gating (`ENABLE_ACTION_TRACKER`, `ENABLE_OPERATIONS_HUB`,
  `ENABLE_STRATEGIC_INITIATIVES`, `ENABLE_ACTION_TRACKER_EMAILS`).

---

## 8. Action System 4.0 implementation plan

### Phase B — Honest data contract (additive, backwards-compatible)
New **nullable** columns on `ActionItem` + idempotent migration
(`IF NOT EXISTS` / `DO $$`, matching repo convention):
- `sourceType String?` — vocab `MANUAL, MEETING, MEETING_DECISION, PROJECT,
  INITIATIVE, ENTITY, WEEKLY_REVIEW, COMMAND_CENTER, FOLLOW_UP` (validated string,
  pure helpers in a new `action-source.ts`).
- `sourceId String?` — generic source id (decision id, project/initiative id,
  parent-context id) for sources without a dedicated column.
- `sourceActionId String?` + self-relation `ActionFollowUps` — follow-up→parent.
- `strategicInitiativeId String?` / `strategicProjectId String?` — registry-
  validated explicit strategic link.
- `successDefinition Text?`, `blockedReason Text?`, `completionNote Text?`,
  `completionOutcome String?` (vocab `DELIVERED, PARTIAL, SUPERSEDED, ABANDONED`),
  `nextFollowUpAt DateTime?`.
- Indexes on `sourceType`, `strategicInitiativeId`, `strategicProjectId`,
  `sourceActionId`, `nextFollowUpAt`.
- Extend `CreateActionItemSchema` / `UpdateActionItemSchema` + the prisma writes
  to persist them (all optional → legacy create calls unchanged). Extend the
  action query `select` to return them.
- **Normalization** (`normalizeActionContext`): explicit link wins; otherwise
  derive a *suggested* source/strategic context for legacy rows — clearly tagged
  `explicit` vs `derived` so the UI never lies.

### Phase C — Pure derivation layer (the heart; fully tested, no React/DB)
New `lib/people-strategy/action-intel.ts` (+ focused siblings) implementing the
named functions from the brief, reusing existing primitives:
- `deriveActionSource` / `deriveActionSourceLabel`, `deriveActionStrategicLinkage`
- `deriveActionUrgency`, `rankActionAttention`, `deriveActionInboxGroups`
- `deriveActionNextMove`, `deriveActionQualityWarnings` / `deriveActionQualityLabels`
- `deriveActionFastestWins`, `deriveActionStaleGroup`
- `deriveMeetingFollowUpPack`, `deriveMeetingDecisionsWithoutActions`
- `deriveWeeklyActionReview`, `deriveCommandCenterActionQueue`,
  `deriveActionAccountabilitySummary`, `deriveEntityActionPanel`
Each with a dedicated `tests/lib/*.test.ts`.

### Phase D–I — UX wiring (use existing design system)
- **Creation 4.0:** context-aware header, source/strategic context panel,
  quality warnings, smart CTA, prefill carrying source/strategic/owner/success;
  extend `ACTION_PREFILL_PARAM_KEYS`.
- **Detail 4.0:** "what matters now", honest source-provenance panel, structured
  completion + blocker capture wired to the new fields, derived timeline.
- **Inbox 4.0:** grouped operational inbox (Needs attention / By source / Fastest
  wins / Stale) powered by the derivations.
- **Meeting → action:** persist `MEETING_DECISION` source + decision id + suggested
  owner/success; Meeting Follow-Up Pack panel.
- **Entity / project / initiative / command center / weekly review:** Action
  Operating Panels + context-passing CTAs + action-aware review/command sections.

### Phase J–K — Quality engine + polish
Labels (`strong / needs owner / needs due date / define done / blocked needs
escalation / stale / overdue / follow-up needed / ready to close / missing
context`) surfaced across creation, detail, inbox, command center, weekly review;
honest empty-states + accessible, scannable cards using existing tokens.

### Validation commands
- `npm run typecheck`
- `node_modules/.bin/vitest run tests/lib/...` (new pure-lib suites)
- targeted component/page tests
- `npm run lint` on changed files; `npm run nav:check` if nav changes.

### Commit boundaries
1. Audit doc (this file). 2. Data contract + migration + write/query plumbing.
3. Pure derivations + tests. 4. Creation 4.0. 5. Detail 4.0. 6. Inbox 4.0.
7. Meeting→action. 8. Entity/project/CC/weekly integrations. 9. Polish + docs.

### Backwards-compatibility guarantees
All new columns nullable; no data migration; legacy rows normalize to sensible
derived context; existing create/detail/inbox flows untouched in behavior; new
derivations are additive pure functions; feature flags unchanged.
