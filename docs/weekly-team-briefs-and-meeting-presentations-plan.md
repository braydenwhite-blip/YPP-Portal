# Weekly Team Briefs & Meeting Presentations — Implementation Plan

> Status: **PLAN ONLY — not implemented.** No schema, migrations, server actions, or
> UI in this change. This document is the design contract for a future build.
>
> Naming follows the repo convention `docs/<name>-plan.md` (cf.
> `docs/people-strategy-operating-system-plan.md`,
> `docs/action-experience-overhaul-plan.md`). There is no `docs/plans/` directory.

---

## 1. Executive summary

### Product correction after approval: Team Meetings are distinct from Officer Meetings

The approved implementation must represent two meeting types as separate workflow steps.
The **Team Meeting** is the operating meeting for one initiative workstream/team and uses
the Weekly Team Brief as its working document. The **Officer Meeting** remains the
leadership meeting backed by the existing `OfficerMeeting` agenda, decision, and follow-up
infrastructure. Prepared items may move from a finalized or submitted Team Meeting into an
Officer Meeting, but routine task updates stay inside the team workflow.

This changes the original plan's "build on `OfficerMeeting` only" recommendation. The
implementation should preserve `OfficerMeeting` for leadership, add only a thin
`TeamMeeting` layer connected to `WeeklyTeamBrief`, and use explicit source links when a
prepared Team Meeting item is accepted onto an Officer Meeting agenda.

**Problem.** Strategic initiatives at YPP (e.g. *Communication and Expansion Priorities*,
led by Aveena and Sanvi) are run by teams (Social Media, School Outreach, Partnerships,
Chapter Expansion). Each team owns tasks (Instagram, Facebook, content calendar). Today the
portal can track the *tasks* (the Action Tracker) and the *officer meeting* (OfficerMeeting +
agenda + decisions + follow-ups), but there is **no weekly connective tissue** that:

1. forces each team to show up to the officer meeting with **both** a team status **and the
   actual deliverables** produced for each task (a social post, a graphic, a schedule, an
   outreach list, a document), and
2. lets officers, **during the meeting**, set the **specific topics, questions, expectations,
   and deliverables** each team/task must present **next** week — and have those expectations
   appear automatically in next week's team document.

The result is meetings driven by verbal status updates with no artifact review, expectations
that live in people's heads, and no organizational memory of what each team committed to.

**Proposed solution.** A thin **Weekly Team Brief** layer that sits *on top of* the systems
that already exist, rather than a new parallel system:

- **Initiative** → reuse the existing initiative **config** (`STRATEGIC_INITIATIVES` in
  `lib/people-strategy/strategic-initiatives.ts`); extend it with co-leads.
- **Team** → reuse the existing **workstream** concept (`WorkstreamDef`, already "the layer
  between the initiative and its milestones"); extend it with a team lead.
- **Task** → reuse the existing **`ActionItem`** (the canonical task system) — no new task model.
- **Deliverable** → reuse the existing **`ActionFileLink`** (label + URL attached to an action).
- **Officer meeting / agenda / decision / follow-up** → reuse **`OfficerMeeting`**,
  **`MeetingAgendaItem`**, **`MeetingDecision`**, **`MeetingFollowUp`**.
- **Weekly Team Brief + per-task update + presentation expectation** → the genuinely **new**
  records. These hold only what cannot be derived: the team's authored weekly narrative, the
  per-task "what I did / what's blocked / who presents / am I ready," the officer-set
  presentation expectations and required questions, and the frozen historical snapshot.

**Intended experience.** One calm **weekly team brief** per team per week, generated from live
portal data, that the team fills in (status + deliverable links + presenter + readiness). When
ready, the team's items flow onto the officer meeting agenda, clearly separated into *status
updates* vs *deliverable reviews* vs *decisions needed*. During the meeting there is a
present-mode that explicitly prompts "open the actual work product," officers record decisions,
and officers set next week's expectations by task — which land in next week's brief
automatically. The completed brief freezes into a readable historical record.

This is the **"integrated initiative operating room with a simple weekly team brief"** model the
product direction asks for: the completeness of the initiative operating system, surfaced through
one calm weekly document.

---

## 2. Current-state findings

All paths verified to exist in this repository at plan time.

### 2.1 Reusable as-is

| Concept | Where it lives | Notes |
|---|---|---|
| Strategic initiatives (config + derivation) | `lib/people-strategy/strategic-initiatives.ts` (`STRATEGIC_INITIATIVES`, `StrategicInitiativeDef`, `WorkstreamDef`, `InitiativeMilestoneDef`, `InitiativeMatch`) | **Pure config, no DB.** The flag comment in `lib/feature-flags.ts` confirms: "the initiative LAYER is pure config + derivation (no schema, no migration)." |
| Initiative derivation engines | `lib/people-strategy/strategic-initiative-health.ts`, `…-summary.ts`, `…-attention.ts`, `lib/people-strategy/strategic-workstreams.ts`, `…-queries.ts` (`getStrategicInitiativesOverview`) | Pure functions: health/momentum/risk/progress/ownership, plus per-workstream summaries reusing the same engines. |
| Tasks | `ActionItem` (`prisma/schema.prisma`, model `ActionItem`) + `lib/people-strategy/action-items-actions.ts`, `action-queries.ts`, `action-permissions.ts` | The canonical task system. Has lead, assignments (LEAD/EXECUTING/INPUT), status, deadlines, `blockedReason`, `successDefinition`, `completionNote`, `officerMeetingId`, `strategicInitiativeId`, `strategicProjectId`, `sourceType`, `sourceActionId`. |
| Deliverables / artifacts | `ActionFileLink` (model in `prisma/schema.prisma`) + UI in `components/people-strategy/action-detail-card.tsx` ("Files & Links" section) + `addActionFileLink()` | `{ label, url, addedBy, addedAt }` attached to an action. This **is** the deliverable-link system. |
| Officer meetings | `OfficerMeeting`, `MeetingAttendee`, `MeetingAgendaItem`, `MeetingDecision`, `MeetingFollowUp`, `MeetingNote` (`prisma/schema.prisma`) + `lib/people-strategy/meetings-actions.ts`, `meetings-queries.ts`, `officer-meetings-actions.ts` | Pages: `app/(app)/actions/meetings/page.tsx` (weekly command center), `…/[id]/page.tsx` (workspace), `…/new/page.tsx`. `app/(app)/officer-meetings/page.tsx` is a legacy redirect into `/actions/meetings`. |
| Agenda → action bridges | `MeetingAgendaItem.convertedActionId`, `MeetingDecision.linkedActionId`, `MeetingFollowUp.linkedActionId`, `ActionItem.officerMeetingId` | Bidirectional: `convertAgendaItemToAction`, `convertDecisionToAction`, `convertFollowUpToAction`, `assignActionItemToMeeting`. |
| Command Center / weekly loop | `app/(app)/operations/command-center/page.tsx`, `app/(app)/operations/weekly-execution/page.tsx`, `lib/people-strategy/operations-summary.ts`, `operational-digest.ts` | Already derives a leadership-wide weekly view; the team brief is a per-team slice of the same idea. |
| Work Hub | `app/(app)/work/page.tsx` + queue engine | Cross-domain "mission control"; aggregates actions + meetings into lanes. No weekly/snapshot concept of its own. |
| Permissions | `lib/authorization.ts` (`requireSessionUser`, `requireLeadership` L173, `requireOfficer` L209), `lib/authorization-helpers.ts` (`requireAdmin` L52), `action-permissions.ts` | Reuse directly; do not invent new role plumbing. |
| Notifications | `Notification` model + `lib/notifications.ts` (`createNotification`), `notification-delivery.ts`, `notification-policy.ts` | `NotificationType` is an enum; would need new members for brief/expectation events. |
| Audit history | `AuditLog` model + `AuditAction` enum (`prisma/schema.prisma`) | `{ action, actorId, targetType, targetId, description, metadata }`. No meeting/brief actions yet; enum is extensible. |
| Weekly snapshot precedent | `ActionPulseSnapshot` (model; `weekStart @unique`, counts) + `app/api/cron/action-weekly-digest/route.ts` (Mondays 08:00 UTC) + `lib/people-strategy/action-cron.ts`, `pulse-snapshot.ts` | The **pattern** to copy for "one record per week, idempotent, cron-generated." |

### 2.2 Needs extension

| Concept | Current state | Extension needed |
|---|---|---|
| Initiative leads | `StrategicInitiativeDef.owner?: string` — single optional free-text owner | Support **co-leads** (Aveena + Sanvi). Add `leads?: string[]` (or `leadUserIds?: string[]`), keep `owner` for back-compat. |
| Team leads | `WorkstreamDef` has `owner?: string` but no user linkage | Add a team-lead field (`leadUserId?: string`) so the brief knows who presents the team status. |
| Agenda item semantics | `MeetingAgendaItem` has `title`, `description`, `status` (OPEN/DISCUSSED/DEFERRED/CONVERTED), `sortOrder`, `ownerId`, `convertedActionId`. **No presenter, no source-team, no source-task, no item kind.** | To distinguish *initiative overview* / *team status* / *deliverable review* / *decision* / *written-only* and to link back to a team + task + presenter, either extend `MeetingAgendaItem` (add `presenterId`, `sourceWorkstreamId`, `sourceActionId`, `itemKind`, `briefId`) **or** keep agenda derived and store linkage on the brief. See §6.4 for the recommended choice. |
| Follow-ups as "next-week commitments" | `MeetingFollowUp` has title, description, status, priority, `dueDate`, `area`, `ownerId`, `linkedActionId` | Add optional `workstreamId` (team) and `sourceActionId` (task) so a commitment can target a specific team/task and flow into that team's next brief. |

### 2.3 Missing entirely (the only new storage)

- A **per-team, per-week document** identity (one row per team per reporting period).
- A **per-task weekly update** authored by the team (narrative + deliverable refs + presenter +
  readiness) that is *not* derivable from `ActionItem`.
- An **officer-set presentation expectation** (required topic, required question, who presents,
  due, return-to-next-agenda) connected to initiative + team + task.
- A **finalized historical snapshot** of the above.

### 2.4 Duplicate / conflicting systems to NOT expand

- **Two meeting systems exist.** `OfficerMeeting` (canonical, rich: agenda/decisions/follow-ups,
  pages under `/actions/meetings`) and `LeadershipMeeting` (simpler; only links
  `LeadershipActionItem`). **Build on `OfficerMeeting` only.** Do not extend `LeadershipMeeting`
  or `LeadershipActionItem` for this feature.
- **Multiple "action" notions.** `ActionItem` (canonical), `LeadershipActionItem` (legacy),
  `WorkflowActionItem`, `MentorshipActionItem` (historical/legacy), `QuickAction`,
  `GrowthAction`. **Tasks here are `ActionItem` only.** Do not create a new task entity and do not
  route through the legacy action tables.
- **Existing "brief/digest" surfaces are org-wide and ephemeral.** The leadership briefing
  (`lib/people-strategy/leadership-briefing.ts`) and the weekly digest email are
  org-scoped and email-only (no stored per-team record). The Weekly Team Brief is **team-scoped
  and persisted**; it does not replace or duplicate the leadership briefing — it feeds the same
  meeting from the team's side.
- **Initiatives are config, not rows.** Do not add an `Initiative` Prisma model. References to an
  initiative/workstream use the **config string id** (the same pattern as
  `ActionItem.strategicInitiativeId`, which is a validated registry id, *not* a foreign key).

---

## 3. Core product model

```
Strategic Initiative (config id)         e.g. communication-expansion  — leads: Aveena, Sanvi
  └─ Team = Workstream (config id)        e.g. social-media            — lead: <user>
       └─ Task = ActionItem (DB row)      e.g. "Instagram carousel"    — lead/owner: <user>
            └─ Deliverable = ActionFileLink (DB row, label+url)
       └─ Weekly Team Brief (NEW)         one per (workstream, weekStart)
            └─ Weekly Task Update (NEW)   one per (brief, ActionItem)
       └─ Presentation Expectation (NEW)  officer-set, per (initiative, workstream, task?)
  ─────────────────────────────────────────────────────────────────────
Officer Meeting (OfficerMeeting)
  └─ Agenda Item (MeetingAgendaItem)      links back to brief / team / task / presenter
  └─ Decision (MeetingDecision)
  └─ Follow-up / Commitment (MeetingFollowUp)  → flows into next week's brief
  └─ Historical snapshot = finalized Weekly Team Brief
```

| Model concept | Mechanism | New / reuse |
|---|---|---|
| Strategic initiative | `STRATEGIC_INITIATIVES` config entry | **Reuse** (extend leads) |
| Initiative lead(s) | `StrategicInitiativeDef.leads` | **Extend** config type |
| Team | `WorkstreamDef` config entry | **Reuse** (extend lead) |
| Team lead | `WorkstreamDef.leadUserId` | **Extend** config type |
| Task / action | `ActionItem` row | **Reuse** |
| Task owner | `ActionItem.leadId` + `ActionAssignment(role=LEAD)` | **Reuse** |
| Weekly team brief | `WeeklyTeamBrief` | **New** |
| Weekly task update | `WeeklyTaskUpdate` | **New** |
| Deliverable | `ActionFileLink` (optionally referenced by a task update) | **Reuse** |
| Presentation expectation | `TeamPresentationExpectation` | **New** |
| Agenda item | `MeetingAgendaItem` (+ linkage fields) | **Reuse / extend** |
| Decision | `MeetingDecision` | **Reuse** |
| Commitment (next-week) | `MeetingFollowUp` (+ `workstreamId`, `sourceActionId`) | **Reuse / extend** |
| Meeting | `OfficerMeeting` | **Reuse** |
| Historical snapshot | finalized `WeeklyTeamBrief` + `WeeklyTaskUpdate` rows | **New** (mirrors `ActionPulseSnapshot` discipline) |

**Key modelling decisions**

1. **Team = Workstream.** The repo already defines workstreams as "parallel programs within an
   initiative" sitting "between the initiative and its milestones" (`strategic-initiatives.ts`,
   `WorkstreamDef`). The user's *teams within an initiative* map onto this 1:1. No new "Team"
   model is needed — and adding one would duplicate workstreams.
2. **Tasks stay `ActionItem`.** Membership of a task in a team is resolved the same way the
   initiative system already resolves work: by the workstream's `match` rule and/or an explicit
   `strategicInitiativeId` on the action. We add an explicit team tag only if derivation proves
   too loose (see §16, open question OQ-2).
3. **Live vs authored split.** Anything factual (open tasks, deliverable links, blocked reason,
   decisions, completion) stays **live** on `ActionItem`/`ActionFileLink`/`MeetingDecision`. The
   brief stores only **authored narrative + presenter + readiness + officer expectations**, then
   **freezes** a copy on finalize for history.

---

## 4. Proposed user workflow

### Happy path

1. **Officers set expectations (end of meeting).** In the meeting's present-mode (or the meeting
   workspace), an officer adds a `TeamPresentationExpectation` to a team/task: e.g. "Present the
   final Instagram carousel; show caption + publish date; explain the target audience." Saved with
   presenter, due date, and `returnToNextAgenda = true`.
2. **Brief is generated (start of week).** A Monday cron (mirroring
   `action-weekly-digest`) creates **one** `WeeklyTeamBrief` per active team per week (idempotent
   on `(workstreamId, weekStart)`). It seeds `WeeklyTaskUpdate` rows for every active task in the
   team and carries forward unresolved expectations + incomplete commitments from last week.
3. **Team updates the brief.** The team lead and task owners fill each task update: status, work
   completed this week, **deliverable link** (new or existing `ActionFileLink`), what remains,
   blocker, decision needed, next action, presenter, and **"ready for the officer meeting"**.
   Editing the deliverable/blocker writes through to the live `ActionItem` where applicable (§7).
4. **Agenda is generated.** When a meeting exists for the week, the briefs that are marked ready
   feed the agenda. Items are typed: *Initiative overview*, *Team status*, *Deliverable review*
   (one per task with a deliverable/expectation), *Decision needed*, *Blocked / missed commitment*,
   *Written-review-only*. Each agenda item links back to its brief + team + task + presenter.
5. **Team presents.** Present-mode walks the flow: (a) initiative lead → initiative overview,
   (b) team lead → team status, (c) task owners → **open the actual deliverable** (the UI
   explicitly prompts to open the artifact, not just read the status), (d) officers review
   blockers + record `MeetingDecision`s, (e) officers set the next expectations by task.
6. **Officers set the next cycle.** Each new expectation/commitment captures: what must be
   completed (`MeetingFollowUp`), what must be shown / what question answered
   (`TeamPresentationExpectation`), who is responsible, who presents, due date, and whether it
   returns to next agenda.
7. **Brief finalizes → history.** On meeting completion (or explicit finalize), the brief locks:
   status `FINALIZED`, authored fields frozen, a snapshot of each task's title/status/deliverable
   URLs/decisions captured so the record stays readable even if the live action later changes.

### Exception paths

- **No officer meeting this week.** The brief is still generated and editable; agenda generation
  is skipped; "ready" items roll into the next meeting that is created. Expectations with
  `returnToNextAgenda` persist until consumed.
- **Meeting postponed.** Briefs are not re-frozen; they remain editable and re-target the
  rescheduled meeting. No duplicate brief is created (idempotency is on week, not meeting).
- **Task completed mid-week.** The task update remains in the brief (so its deliverable can still
  be presented and recognized) but is flagged "completed this week"; it is not carried forward
  next week.
- **Task moves to another team.** The current week's update stays attached to the brief it was
  authored in (history is immutable); next week the task is seeded into the *new* team's brief.
- **Team has no active tasks.** A brief is still generated with the team objective + overall
  status prompt and an empty-tasks state; it can carry an initiative-overview/`expectation` even
  with zero tasks. (Configurable: skip generation for teams with no tasks and no expectations —
  see OQ-5.)
- **Expectation references a task that was deleted/dropped.** The expectation is surfaced as
  "orphaned" on the brief with a prompt to re-target or dismiss; it never hard-fails the brief.

---

## 5. Information architecture

The feature must add **no more than one** new primary navigation destination. Everything else
hangs off pages that already exist.

| Surface | Role | New page? |
|---|---|---|
| **Team Weekly Brief workspace** | The team's home for the week: objective, overall status, task updates, deliverables, expectations, readiness. Full-screen. | **New** route, e.g. `app/(app)/operations/initiatives/[initiativeId]/teams/[workstreamId]/brief/[weekStart]/page.tsx` (nested under the initiative it belongs to — no new top-level nav). |
| **Initiative operating room** | The existing initiative detail page gains a "Teams & weekly briefs" section listing each team, its current brief status, and readiness. | **Extend** `app/(app)/operations/initiatives/[initiativeId]/page.tsx`. |
| **Meeting agenda / present-mode** | Agenda generation + present-mode + decision/expectation capture. | **Extend** `app/(app)/actions/meetings/[id]/page.tsx` (it already has a "Meeting Now Focus" present lead and agenda/decision/follow-up sections). |
| **Command Center** | Surfaces "teams not ready" and "expectations due" as attention items for the week. | **Extend** `app/(app)/operations/command-center/page.tsx` via `operations-summary.ts`. |
| **Weekly Execution** | The officer pre-meeting loop links to each team brief that is ready/at-risk. | **Extend** `app/(app)/operations/weekly-execution/page.tsx`. |
| **Action detail** | A task shows "appears in this week's brief for <team>" + its presentation expectations. | **Extend** `app/(app)/actions/[id]/page.tsx`. |
| **Work Hub** | Add a "Brief updates due from me" lane (task updates I owe). | **Extend** `app/(app)/work/page.tsx` queue lanes. |
| **Person 360** | A person's page shows briefs/tasks they present or own. | **Extend** existing entity-360 (`components/operations/entity-360-body.tsx`). |

**Recommendation:** the only genuinely new destination is the **Team Weekly Brief workspace**,
reached by drilling Initiative → Team → This week. The officer experience lives entirely inside
the existing meeting workspace and command center.

---

## 6. Data model plan

> All new models live in `prisma/schema.prisma`. Initiative/workstream references are **config
> string ids**, not foreign keys (mirrors `ActionItem.strategicInitiativeId`). New enums sit
> beside the existing meeting/action enums.

### 6.1 `WeeklyTeamBrief` — NEW

- **Purpose:** the one document per team per reporting week; identity + authored team-level
  narrative + lifecycle state + (on finalize) frozen snapshot.
- **Fields:**
  - `id String @id @default(cuid())`
  - `initiativeId String` — config id (e.g. `communication-expansion`)
  - `workstreamId String` — config id (the "team", e.g. `social-media`)
  - `weekStart DateTime` — Monday 00:00 UTC of the reporting week (same convention as
    `ActionPulseSnapshot.weekStart` / `LeadershipActionItem.weekStart`)
  - `weekEnd DateTime` — Sunday 23:59:59 UTC (denormalized for readability)
  - `status WeeklyBriefStatus @default(DRAFT)` — see enum below
  - `teamObjective String? @db.Text` — snapshot of the team purpose (seeded from config)
  - `overallStatus String? @db.Text` — team-authored overall status narrative
  - `teamLeadId String?` → `User?` (SetNull) — who presents the team status
  - `readyForMeeting Boolean @default(false)`
  - `submittedAt DateTime?`, `finalizedAt DateTime?`, `reopenedAt DateTime?`
  - `officerMeetingId String?` → `OfficerMeeting?` (SetNull) — the meeting this brief targets
  - `snapshotJson Json?` — frozen copy of tasks/updates/deliverables/decisions at finalize
  - `createdById String?` / `createdBy User?` (SetNull), `createdAt`, `updatedAt`
  - relations: `taskUpdates WeeklyTaskUpdate[]`, `expectations TeamPresentationExpectation[]`
- **Status values (`WeeklyBriefStatus`):** `DRAFT → SUBMITTED → PRESENTED → FINALIZED`, plus
  `REOPENED` (a finalized brief reopened by an officer/admin; distinct so history shows the edit).
- **Uniqueness (prevents duplicate weekly records):** `@@unique([workstreamId, weekStart])`.
- **Indexes:** `[initiativeId, weekStart]`, `[status]`, `officerMeetingId`, `weekStart`.
- **Historical behavior:** once `FINALIZED`, authored fields + `snapshotJson` are read-only; the
  live tasks may change but the snapshot preserves what was presented.
- **Deletion/archiving:** never hard-deleted by users; `status` carries lifecycle. Cascade only
  for its own `taskUpdates`. If a team config id is retired, briefs remain (read-only history).

### 6.2 `WeeklyTaskUpdate` — NEW

- **Purpose:** the team-authored, per-task overlay for a brief — the part that cannot be derived.
- **Fields:**
  - `id`, `briefId String` → `WeeklyTeamBrief` (Cascade)
  - `actionItemId String?` → `ActionItem?` (SetNull) — the task (nullable so an update survives
    if the action is later deleted; `taskTitleSnapshot` keeps it readable)
  - `taskTitleSnapshot String` — frozen task title for history
  - `statusNarrative String? @db.Text` — current status in the team's words
  - `workCompleted String? @db.Text` — what was done this week
  - `remaining String? @db.Text` — what's unfinished
  - `blockerNote String? @db.Text` — blocker / explanation
  - `decisionNeeded String? @db.Text` — decision or input needed from leadership
  - `nextAction String? @db.Text` — next concrete action
  - `presenterId String?` → `User?` (SetNull)
  - `readyForMeeting Boolean @default(false)`
  - `carriedForward Boolean @default(false)` — seeded from an unfinished prior-week update
  - `deliverableLinkIds String[] @default([])` — ids of `ActionFileLink` rows presented for this
    task (deliverables stay in `ActionFileLink`; this references them)
  - `createdAt`, `updatedAt`
- **Uniqueness:** `@@unique([briefId, actionItemId])` — one update per task per brief.
- **Indexes:** `briefId`, `actionItemId`, `presenterId`.
- **Sync:** editing `blockerNote`/status here can write through to `ActionItem.blockedReason` /
  `status` (§7); the field is also kept on the update so history is self-contained.

### 6.3 `TeamPresentationExpectation` — NEW

- **Purpose:** the officer-set, forward-looking "what you must present next" — topics, questions,
  presenter, due, and whether it returns to the next agenda. This is the concept the product
  brief calls out as the meeting's most important output and which **no** existing model captures
  (`MeetingFollowUp` covers *completion* commitments, not *presentation* requirements/questions).
- **Fields:**
  - `id`, `initiativeId String`, `workstreamId String`
  - `actionItemId String?` → `ActionItem?` (SetNull) — the task it concerns (optional: an
    expectation can be team-level)
  - `kind ExpectationKind` — `PRESENT_DELIVERABLE | SHOW_STATUS | ANSWER_QUESTION | MAKE_DECISION`
  - `prompt String @db.Text` — "Present the final Instagram carousel + caption + publish date"
  - `requiredQuestion String? @db.Text` — "Which decision do you need from leadership?"
  - `presenterId String?` → `User?` (SetNull)
  - `dueDate DateTime?`
  - `returnToNextAgenda Boolean @default(true)`
  - `status ExpectationStatus @default(OPEN)` — `OPEN → ADDRESSED → DISMISSED`
  - `sourceMeetingId String?` → `OfficerMeeting?` (SetNull) — meeting where it was set
  - `addressedInBriefId String?` → `WeeklyTeamBrief?` (SetNull) — the brief that satisfied it
  - `createdById String?` / `createdBy User?`, `createdAt`, `updatedAt`
- **Indexes:** `[workstreamId, status]`, `[initiativeId, status]`, `actionItemId`,
  `sourceMeetingId`, `dueDate`.
- **Carry-forward:** an `OPEN` expectation with `returnToNextAgenda` is automatically surfaced in
  the next brief for its team/task until `ADDRESSED`/`DISMISSED`.

### 6.4 `MeetingAgendaItem` — EXTEND (recommended) vs derive (alternative)

The agenda must distinguish item kinds and link back to team/task/presenter. Two options:

- **Option A (recommended): persist linkage.** Add to `MeetingAgendaItem`:
  `briefId String?` (→ `WeeklyTeamBrief`), `sourceWorkstreamId String?` (config id),
  `sourceActionId String?` (→ `ActionItem`), `presenterId String?` (→ `User`),
  `itemKind AgendaItemKind?`. New enum `AgendaItemKind`:
  `INITIATIVE_OVERVIEW | TEAM_STATUS | DELIVERABLE_REVIEW | DECISION | BLOCKED | WRITTEN_REVIEW | EXPECTATION_SETTING`.
  Rationale: officers reorder/annotate agenda items; persistence keeps that stable across reloads
  and lets `convertAgendaItemToAction` keep working unchanged.
- **Option B (no schema): derive the agenda** each render from ready briefs + expectations, store
  nothing on the agenda. Lighter, but loses officer reordering/annotation and the explicit
  status-vs-deliverable separation as data.

**Recommendation: Option A** — it is the smallest extension that satisfies "agenda items link back
to the source team and task" and "distinguish status updates from deliverable presentations" as
*data* (testable), and it composes with the existing agenda→action bridge.

### 6.5 `MeetingFollowUp` — EXTEND

Add optional `workstreamId String?` (config id) and `sourceActionId String?` (→ `ActionItem`,
SetNull) so a "what must be completed" commitment targets a specific team/task and can be carried
into that team's next brief. No behavior change for existing follow-ups (both nullable).

### 6.6 Config type extensions (no DB)

In `lib/people-strategy/strategic-initiatives.ts`:
- `StrategicInitiativeDef.leads?: string[]` (co-leads; `owner` retained).
- `WorkstreamDef.leadUserId?: string` and/or `WorkstreamDef.leads?: string[]`.

### 6.7 New enums summary

`WeeklyBriefStatus`, `ExpectationKind`, `ExpectationStatus`, `AgendaItemKind` — all additive,
placed next to existing `MeetingAgendaStatus` / `MeetingFollowUpStatus` / `ActionItemStatus`.

### 6.8 Version / audit history

- Brief lifecycle transitions and reopen events write `AuditLog` rows
  (new `AuditAction` members: `WEEKLY_BRIEF_SUBMITTED`, `WEEKLY_BRIEF_FINALIZED`,
  `WEEKLY_BRIEF_REOPENED`, `EXPECTATION_SET`, `EXPECTATION_ADDRESSED`).
- The frozen `snapshotJson` is the version-of-record for a finalized week; live edits after
  reopen produce a new `AuditLog` trail rather than overwriting silently.

---

## 7. Generation and synchronization rules

**When a brief is generated.**
- **Automatic:** a weekly cron at Monday 08:00 UTC (mirror `app/api/cron/action-weekly-digest/route.ts`;
  add `app/api/cron/weekly-team-briefs/route.ts` and a `generateWeeklyTeamBriefs(now)` service in
  `lib/people-strategy/`).
- **Manual:** an officer or team lead can "Generate this week's brief" on demand (same service,
  same idempotency) so a newly formed team mid-week is not blocked.

**Idempotency.** Generation is keyed on `(workstreamId, weekStart)` via the unique constraint.
Re-running:
- never creates a second brief for a team/week (insert is a no-op if present);
- re-seeds **only missing** `WeeklyTaskUpdate` rows for newly-active tasks (existing authored
  updates are never overwritten);
- re-surfaces still-`OPEN` expectations and still-incomplete carried commitments without
  duplicating them (dedupe on `(briefId, actionItemId)` / expectation id).

**What is pulled live into the brief (read-through, never copied until finalize).**
- Active tasks for the team: `ActionItem`s whose membership resolves to the workstream (via the
  workstream `match` rule and/or `strategicInitiativeId`), excluding `COMPLETE`/`DROPPED` unless
  completed within the week.
- Deliverables: the task's `ActionFileLink`s.
- Blockers: `ActionItem.blockedReason` / `status = BLOCKED`.
- Decisions made: `MeetingDecision`s linked to the team's tasks/meeting.

**What becomes a historical snapshot (frozen at finalize).** Task titles, statuses, deliverable
URLs+labels, the authored narrative, presenter, and the decisions recorded — copied into
`snapshotJson` so the finalized brief reads correctly even if the live action later changes.

**Sync with actions.**
- Adding a deliverable in the brief calls `addActionFileLink(actionId, label, url)` (existing) and
  records the new id in `WeeklyTaskUpdate.deliverableLinkIds`.
- Entering a blocker may call `captureActionBlocker` and set `ActionItem.status = BLOCKED`.
- Marking "next action" can optionally create a follow-up `ActionItem` via the existing
  follow-up/`createActionItem` path; it is not duplicated — the brief references the action id.

**Deliverables → agenda.** A task update that is `readyForMeeting` and has ≥1 deliverable (or an
`OPEN` `PRESENT_DELIVERABLE` expectation) generates a `DELIVERABLE_REVIEW` agenda item; a ready
update with none generates a `TEAM_STATUS`/`WRITTEN_REVIEW` item. This is how the agenda
"distinguishes status updates from deliverable presentations."

**Expectations → next brief.** On generation, `TeamPresentationExpectation`s that are `OPEN` and
`returnToNextAgenda` for the team are attached to the new brief and rendered as "required this
week"; the matching task update is pre-flagged.

**Edge transitions.**
- **Task changes teams:** current-week update stays with its brief; next generation seeds it into
  the new team's brief (resolved by the new workstream match).
- **Task completed mid-week:** kept in the current brief flagged "completed this week"; excluded
  next week.
- **Meeting postponed:** brief stays `SUBMITTED`/editable; re-targets the new meeting; no
  re-freeze, no duplicate.
- **No officer meeting:** brief generates and is editable; agenda generation is skipped; ready
  items + expectations roll to the next created meeting.
- **No active tasks:** brief generates with objective + overall-status prompt + empty-tasks state
  (or is skipped if the team also has no open expectations — OQ-5).

---

## 8. Permissions plan

Reuse `lib/authorization.ts` / `action-permissions.ts`; add a small
`lib/people-strategy/weekly-brief-permissions.ts` of pure predicates (mirrors
`action-permissions.ts`).

| Capability | Initiative lead | Team lead | Task owner | Officer | Leadership/Board | Super admin | General member |
|---|---|---|---|---|---|---|---|
| View brief | ✅ (own initiative) | ✅ (own team) | ✅ (own team) | ✅ all | ✅ all | ✅ all | ❌ (unless on team) |
| Edit overall team status | ✅ | ✅ | ❌ | ✅ | via officer | ✅ | ❌ |
| Edit a task update | ✅ | ✅ | ✅ (own task) | ✅ | via officer | ✅ | ❌ |
| Add deliverable (file link) | ✅ | ✅ | ✅ (own task) | ✅ | via officer | ✅ | ❌ |
| Set presentation expectation | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Add agenda item | ❌ | propose | ❌ | ✅ | ✅ | ✅ | ❌ |
| Mark item ready | ✅ | ✅ | ✅ (own task) | ✅ | ✅ | ✅ | ❌ |
| Record decision | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Finalize / lock brief | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Reopen finalized brief | ❌ | ❌ | ❌ | ✅ (own) | ✅ | ✅ | ❌ |

- "Officer" = `requireOfficer()`; "Leadership/Board" = `requireLeadership()`; "Super admin" =
  `ADMIN` role (always allowed, consistent with the rest of the portal).
- Team/task membership is derived from `WorkstreamDef.leadUserId` + `ActionItem.leadId` /
  `ActionAssignment` — no new role table.
- Visibility honors `ActionItem.visibility` (`OFFICERS_ONLY` tasks are not shown to general team
  members in a brief).

---

## 9. Page and component plan

> Tailwind-first, Calm Mode default (`components/command-center/command-mode` `CalmOnly` /
> `CalmCollapse`), reusing `components/ui-v2/*` and `components/command-center/simple` primitives.

### 9.1 Team Weekly Brief workspace (NEW page)

- **Purpose:** the team's single weekly home.
- **Shows:** header (initiative · team · week · status chip), team objective, overall status
  editor, "required this week" (carried expectations), task-update list, readiness summary, link
  to the target meeting.
- **Actions:** edit overall status; per task: edit update, attach/select deliverable, mark ready;
  team lead: submit brief.
- **Empty state:** "No active tasks for this team this week — add the team objective and any
  expectations, or create a task." **Loading:** skeleton rows. **Error:** inline retry; never a
  hard 404 (the brief is created on first visit if generation hasn't run). **Permission-restricted:**
  read-only render with an explanatory banner. **Mobile:** task updates collapse to stacked cards;
  present-mode is officer/desktop-first but read-only viewable on mobile.

### 9.2 Task update section (component)

- **Shows:** task title + live status/owner, status narrative, work completed, remaining, blocker,
  decision needed, next action, presenter picker, deliverable list, "ready" toggle.
- **Actions:** save (writes update + optional write-through to action), "Open deliverable,"
  "Add deliverable." **Empty deliverable state:** "No deliverable attached — presentations require
  the actual work product" (concrete nudge). **Loading/Error/Permission/Mobile** as §9.1.

### 9.3 Deliverable presentation card (component)

- **Shows:** deliverable label, type hint (link/graphic/doc), "Open" (new tab), who added + when,
  the expectation it satisfies. **Actions:** open; mark presented. **Empty:** prompt to attach.

### 9.4 Initiative operating room (EXTEND existing initiative detail)

- **Adds:** "Teams & this week" grid — each team with brief status, % tasks ready, presenter,
  blockers count, link to the brief. Reuses existing initiative health/summary rendering.

### 9.5 Meeting agenda section + present-mode (EXTEND meeting workspace)

- **Agenda:** grouped by kind (Initiative overview → Team status → Deliverable reviews → Decisions
  → Blocked/missed → Written-only). Each item links to brief/team/task/presenter.
- **Present-mode:** full-screen, one item at a time; for deliverable items it **forces** an "Open
  the work product" step; officer panel to record a decision or set the next expectation inline.
- **States:** empty ("No teams ready — agenda will populate as briefs are submitted"); loading;
  error; permission (non-officers get read-only present view).

### 9.6 Officer expectation editor (component)

- **Shows/Actions:** kind, prompt, required question, presenter, due, return-to-next-agenda;
  attach to initiative/team/task. Lives in the meeting workspace + present-mode.

### 9.7 Historical weekly brief view (read-only render of a finalized brief)

- Renders `snapshotJson` verbatim with a "Finalized <date>" banner; deliverable links open;
  decisions and expectations shown as set. Reopen button for officers (audited).

---

## 10. Worked example

**Initiative (config):** `communication-expansion` — *Communication and Expansion Priorities*,
`leads: ["Aveena", "Sanvi"]`.
**Teams (workstreams):** `social-media`, `school-outreach`, `partnerships`, `chapter-expansion`.
**Tasks (ActionItems) in Social Media:** "Instagram", "Facebook", "Content calendar",
"Campaign graphics", "Summer promotion campaign".

### Week of 2026-06-15 — Social Media Team brief (generated Mon 06-15)

- **Team objective:** "Grow reach and drive summer enrollment across channels."
- **Overall status (authored by team lead):** "On track; Instagram strong, Facebook scheduling
  blocked on brand assets."
- **Carried expectations (set at last meeting):**
  - *Instagram* — PRESENT_DELIVERABLE: "Present the final Instagram carousel; show caption +
    publish date; explain target audience." presenter: Maya. returnToNextAgenda: true.
  - *Facebook* — ANSWER_QUESTION: "Which decision do you need from leadership to unblock the
    content calendar?"

**Task updates:**

| Task | Status | Work this week | Deliverable | Remaining | Blocker | Decision needed | Next action | Presenter | Ready |
|---|---|---|---|---|---|---|---|---|---|
| Instagram | IN_PROGRESS | Built launch carousel | `ActionFileLink`: "IG carousel v3" → drive URL | Final caption polish | — | — | Publish Thu | Maya | ✅ |
| Facebook | BLOCKED | Drafted calendar | `ActionFileLink`: "FB content calendar" → sheet URL | Need brand assets | Waiting on graphics from design | Approve external designer? | Get assets | Leo | ✅ |
| Content calendar | IN_PROGRESS | Merged channels | "Q3 calendar" → doc URL | Partner dates TBD | — | — | Confirm dates | Maya | ❌ |

### Generated officer-meeting agenda (for the week's OfficerMeeting)

1. **Initiative overview** — Communication & Expansion (Aveena/Sanvi).
2. **Team status — Social Media** (presenter: team lead). "On track; Facebook blocked."
3. **Deliverable review — Instagram carousel** (Maya) — *Open: "IG carousel v3."* Caption +
   Thu publish; audience: rising 9th–12th graders. *(satisfies the carousel expectation)*
4. **Deliverable review — Facebook content calendar** (Leo) — *Open: "FB content calendar."*
5. **Decision needed — Facebook** — "Approve external designer to unblock brand assets?"
6. **Blocked / missed** — Facebook blocked on graphics (7 days).
7. **Written-review-only** — Content calendar (not yet ready; read offline).
8. **Expectation-setting** — officers set next week.

### In the meeting

- **Decision recorded** (`MeetingDecision`): "Approved external designer, $X cap" → optionally
  `convertDecisionToAction` to a tracked `ActionItem` for design.
- **Next-week expectations set** (`TeamPresentationExpectation` + `MeetingFollowUp`):
  - *Facebook* — PRESENT_DELIVERABLE: "Show the rescheduled calendar with brand assets applied,"
    presenter: Leo, due next meeting, returnToNextAgenda.
  - *Summer promotion campaign* — SHOW_STATUS: "Present the campaign plan + first asset."
  - Commitment (`MeetingFollowUp`): "Finalize brand asset pack," owner: design, due Fri,
    `workstreamId: social-media`.

### Next week's brief (generated Mon 06-22)

Social Media brief auto-includes: the two new expectations (Facebook deliverable, Summer
promotion status), the carried "Content calendar" task update (was not ready), and the new design
follow-up — with no duplication and the prior week readable as a finalized snapshot.

---

## 11. Integration plan

| System | Integration | Do NOT duplicate |
|---|---|---|
| Initiatives | Brief references initiative/workstream by config id; initiative room shows team briefs | No `Initiative`/`Team` DB model |
| Actions | Tasks are `ActionItem`s; deliverables are `ActionFileLink`s; blockers/next-actions write through | No new task entity; no second file-link model |
| Meetings | Briefs feed `MeetingAgendaItem`s; agenda→action bridge reused (`convertAgendaItemToAction`) | No new meeting model; not `LeadershipMeeting` |
| Decisions | `MeetingDecision` (+ existing `convertDecisionToAction`) | No new decision model |
| Follow-ups / commitments | `MeetingFollowUp` (+ `workstreamId`, `sourceActionId`) | No new commitment model |
| Command Center / Weekly Execution | `operations-summary.ts` gains "teams not ready / expectations due"; weekly-execution links briefs | Reuse derivation; don't fork "loose end"/attention logic |
| Notifications | `createNotification` for "brief ready to fill," "you're presenting," "expectation set" (new `NotificationType` members) | Reuse delivery/policy; no parallel notifier |
| Activity history | `AuditLog` for brief lifecycle + expectations | Reuse; no new audit table |
| People (Person 360) | Show briefs/tasks a person presents/owns | Reuse `entity-360` |
| Attachments | `ActionFileLink` only | No new attachment storage |

---

## 12. Migration and backward compatibility

- **Migrations needed?** Yes — three new tables (`WeeklyTeamBrief`, `WeeklyTaskUpdate`,
  `TeamPresentationExpectation`), additive nullable columns on `MeetingAgendaItem` and
  `MeetingFollowUp`, and new enums. All additive; **no destructive changes**.
- **Existing initiatives/actions:** unchanged. Briefs are layered on; an action with no brief
  behaves exactly as today.
- **Existing meetings:** no migration. New agenda columns are nullable; legacy agenda items render
  unchanged (no `itemKind` → treated as generic). `convertAgendaItemToAction` is untouched.
- **Incremental rollout:** data can be introduced team-by-team; generating a brief for one team
  does not require any other team to participate.
- **Feature flag:** add `isWeeklyTeamBriefsEnabled()` to `lib/feature-flags.ts`
  (`ENABLE_WEEKLY_TEAM_BRIEFS`, default **OFF** until verified — matching the kill-switch pattern,
  e.g. `isGrowthOsEnabled`). With the flag off: cron is a no-op, the new pages `notFound()`, new
  server actions throw, and existing meeting/action workflows are byte-for-byte unchanged. Gating
  also requires `isActionTrackerEnabled()` + `isOperationsHubEnabled()` (the brief is meaningless
  without the action/operations surfaces).
- **Avoiding breakage:** all writes through to actions use the existing exported server actions;
  no direct cross-writes; the agenda generator only *adds* typed items and never mutates existing
  ones.

---

## 13. Implementation phases

> Each phase is independently shippable behind `ENABLE_WEEKLY_TEAM_BRIEFS`.

### Phase 0 — Confirm architecture & resolve open decisions
- **Scope:** ratify §16 decisions (especially OQ-1 team identity, OQ-3 expectation vs follow-up).
- **Files:** this doc.
- **Deps:** none. **Tests:** n/a. **Acceptance:** decisions recorded here. **Risks:** scope creep.

### Phase 1 — Data model & domain services
- **Scope:** new models/enums; config type extensions; pure services for membership resolution,
  brief assembly (read-through), and idempotent generation.
- **Files:** `prisma/schema.prisma`; new migration; `lib/people-strategy/strategic-initiatives.ts`
  (lead fields); new `lib/people-strategy/weekly-team-briefs.ts`,
  `weekly-brief-permissions.ts`, `weekly-brief-generation.ts`; `lib/feature-flags.ts`.
- **Deps:** Phase 0. **Tests:** unit (membership resolution, week boundaries), idempotency,
  permission predicates. **Acceptance:** `generateWeeklyTeamBriefs(now)` creates exactly one brief
  per active team per week and is a no-op on re-run. **Risks:** loose `match` membership (OQ-2).

### Phase 2 — Weekly brief generation + task updates (team-facing)
- **Scope:** the Team Weekly Brief workspace (read + edit), task-update writes, manual generate.
- **Files:** new `app/(app)/operations/initiatives/[initiativeId]/teams/[workstreamId]/brief/[weekStart]/page.tsx`
  + components; server actions in `weekly-team-briefs.ts`.
- **Deps:** Phase 1. **Tests:** server-action permission/validation; component render
  (empty/loading/error). **Acceptance:** a team lead can fill and submit a brief; deliverable add
  creates an `ActionFileLink`. **Risks:** write-through divergence (cover with tests).

### Phase 3 — Deliverables & presentation expectations
- **Scope:** deliverable presentation card; officer expectation editor; carry-forward into briefs.
- **Files:** components above; `weekly-team-briefs.ts` (expectation CRUD + carry-forward);
  extend `app/(app)/actions/[id]/page.tsx`.
- **Deps:** Phase 2. **Tests:** expectation carry-forward idempotency; permission (officers only).
  **Acceptance:** officer-set expectation appears in next brief; deliverable nudge enforced.
  **Risks:** orphaned expectations (handled per §4).

### Phase 4 — Meeting agenda integration
- **Scope:** agenda generation from ready briefs; typed agenda items; links back to team/task.
- **Files:** extend `app/(app)/actions/meetings/[id]/page.tsx`,
  `lib/people-strategy/meetings-actions.ts` / `meetings-queries.ts`; `MeetingAgendaItem` columns.
- **Deps:** Phase 2–3. **Tests:** agenda separates status vs deliverable; each item links to
  source; idempotent regeneration. **Acceptance:** ready briefs populate a typed agenda; existing
  agenda/decision/follow-up flows still pass. **Risks:** agenda churn on re-gen (dedupe by source).

### Phase 5 — During-meeting workflow + next-cycle commitments
- **Scope:** present-mode (forced "open deliverable"); inline decision + expectation capture;
  follow-up creation with team/task linkage; finalize → snapshot.
- **Files:** meeting workspace components; `weekly-team-briefs.ts` (finalize/snapshot);
  `MeetingFollowUp` columns.
- **Deps:** Phase 4. **Tests:** finalize freezes `snapshotJson`; commitments flow to next brief.
  **Acceptance:** officers can run a full meeting and set next week's expectations. **Risks:**
  snapshot completeness.

### Phase 6 — Initiative operating room & historical views
- **Scope:** initiative-room "Teams & this week"; historical finalized-brief view; reopen.
- **Files:** extend `app/(app)/operations/initiatives/[initiativeId]/page.tsx`; history component.
- **Deps:** Phase 5. **Tests:** finalized brief renders from snapshot; reopen audited.
  **Acceptance:** past weeks readable unchanged after live tasks change. **Risks:** none major.

### Phase 7 — Notifications, polish, analytics, rollout
- **Scope:** notifications (brief ready / you present / expectation set); Command Center + Work Hub
  + Weekly Execution surfacing; metrics; flag-on rollout.
- **Files:** `lib/notifications.ts` (+ enum), `operations-summary.ts`, `work` queue lanes,
  `weekly-execution`; cron `app/api/cron/weekly-team-briefs/route.ts` + `vercel.json`.
- **Deps:** Phase 1–6. **Tests:** notification dedupe; digest idempotency; regression on existing
  cron. **Acceptance:** end-to-end weekly loop with the flag on. **Risks:** email noise (respect
  `notification-policy`).

---

## 14. Testing strategy

Use the repo's existing **Vitest** infrastructure (`vitest.config.ts`, `npm run test`,
`tests/**`). **No Playwright** — the project has Playwright but unit/component coverage via Vitest
+ Testing Library is the norm for this kind of logic, and there is no existing E2E requirement for
these surfaces.

- **Unit / domain-service tests** (`tests/lib/people-strategy/…`): week-boundary math; team
  membership resolution; brief assembly read-through; expectation carry-forward; snapshot freeze.
- **Idempotency tests:** `generateWeeklyTeamBriefs` run twice → one brief, no duplicate updates/
  expectations; `@@unique([workstreamId, weekStart])` enforced.
- **Permission tests** (mirror `tests/lib/…permissions`): the §8 matrix, including super-admin
  allow and general-member deny, and `OFFICERS_ONLY` task hiding.
- **Integration tests:** brief → agenda generation separates status vs deliverable; agenda items
  link to source team/task; finalize → snapshot; commitment → next brief.
- **Component tests** (Testing Library, `tests/components/…`): brief workspace, task-update
  section, deliverable card, expectation editor, present-mode — empty/loading/error/permission
  states.
- **Regression tests:** existing meeting tests (`tests/app/…`, `tests/lib/people-strategy/meetings*`)
  and action tests still pass; `convertAgendaItemToAction`/`convertDecisionToAction` unaffected;
  with the flag OFF, new pages `notFound()` and cron no-ops (a `feature-flag-off` test).
- **Manual verification (no Playwright):** seed an initiative + workstream + a couple of
  `ActionItem`s; run the generation service; load the brief workspace as a team lead; fill +
  submit; load the meeting workspace as an officer; confirm agenda separation, record a decision,
  set an expectation, finalize; confirm next week's brief carries it forward.

---

## 15. Acceptance criteria

1. Exactly **one** `WeeklyTeamBrief` exists per team per reporting week (`@@unique` enforced);
   re-generation is a no-op.
2. A brief contains **all** active tasks for its team (resolved from live `ActionItem`s), plus any
   carried-forward incomplete tasks.
3. Officers can define expectations **by task** (`TeamPresentationExpectation` with kind, prompt,
   required question, presenter, due, return-to-agenda).
4. Teams can attach or link **actual deliverables** per task (`ActionFileLink`), and the brief
   explicitly nudges when a presentation has no work product attached.
5. Generated agendas **distinguish** status updates from deliverable presentations (typed
   `AgendaItemKind`), plus decisions, blocked/missed, and written-only.
6. Every agenda item **links back** to its source team and task (`sourceWorkstreamId`,
   `sourceActionId`, `briefId`).
7. Officers can record **decisions** (`MeetingDecision`), optionally converting to actions.
8. New **commitments/expectations flow into the next reporting cycle** automatically, without
   duplication.
9. Finalized briefs remain **readable as historical snapshots** even after the live tasks change
   (`snapshotJson`).
10. **Permissions** prevent unauthorized edits (the §8 matrix), with super-admin allow and
    general-member deny verified by tests.
11. Generation **never** creates duplicate weekly records, task updates, or expectations.
12. Existing **action and meeting workflows continue functioning** unchanged, and with
    `ENABLE_WEEKLY_TEAM_BRIEFS` off the feature is fully inert.

---

## 16. Risks and open questions (with recommendations)

- **OQ-1 — Is "team = workstream" sufficient, or do some teams span initiatives?** *Recommendation:*
  start with team = workstream (config). It matches the example exactly and avoids a new entity. If
  a cross-initiative team appears, model it later as a config "team" that maps to multiple
  workstreams — do **not** add a DB team model preemptively.
- **OQ-2 — Task→team membership: derive via `match` or require an explicit tag?** *Recommendation:*
  derive first (reuse the initiative classifier), but allow an explicit override field
  (`ActionItem.strategicInitiativeId` already exists; add lightweight workstream tagging only if
  derivation proves too loose in pilot).
- **OQ-3 — One expectation model or reuse `MeetingFollowUp`?** *Recommendation:* keep them
  separate. `MeetingFollowUp` = "what must be **completed**"; `TeamPresentationExpectation` =
  "what must be **shown / which question answered**, by whom, returning to agenda." Folding them
  loses the required-question + presenter + return-to-agenda semantics and risks duplicating
  completion tracking.
- **OQ-4 — Persist the agenda (Option A) or derive it (Option B)?** *Recommendation:* persist
  (Option A) — officers reorder/annotate, and "links back to team/task" must be testable data.
- **OQ-5 — Generate a brief for teams with zero tasks and zero expectations?** *Recommendation:*
  skip generation for fully-empty teams (no tasks, no open expectations) to avoid noise; generate
  the moment a task or expectation exists.
- **OQ-6 — Reporting week definition (timezone).** *Recommendation:* Monday 00:00 **UTC** start,
  matching `ActionPulseSnapshot.weekStart` and the existing digest cron, for consistency.
- **Risk — schema churn on meetings.** Mitigated by additive nullable columns + a flag-off
  regression test.
- **Risk — write-through divergence (brief vs action).** Mitigated by routing all writes through
  existing exported server actions and storing self-contained snapshot copies.
- **Risk — notification overload.** Mitigated by `notification-policy` reuse and dedupe keys.
- **Risk — derivation looseness mislabeling team membership.** Mitigated by the explicit-override
  escape hatch (OQ-2) and pilot tuning of `match` keywords.

---

## 17. Recommended implementation sequence

After this plan is approved, build in this order:

1. **Phase 1 first:** the data model + `generateWeeklyTeamBriefs` service + membership resolution +
   permission predicates, all behind `ENABLE_WEEKLY_TEAM_BRIEFS` (default off), with unit +
   idempotency + permission tests. This de-risks the only genuinely new storage and proves "one
   brief per team per week" before any UI exists.
2. Then **Phase 2** (team brief workspace + task updates) so a team can actually use it end-to-end
   against a seeded initiative, followed by **Phase 3** (deliverables + expectations).
3. Only then wire the **meeting side** (Phases 4–5), reusing the existing agenda/decision/follow-up
   machinery, and finish with the **operating room + history** (Phase 6) and **notifications/rollout**
   (Phase 7).

The smallest first commit that delivers value and is safe to merge: **Phase 1** — schema + service
+ flag + tests, no UI, no behavior change with the flag off.
