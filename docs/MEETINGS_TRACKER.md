# Meetings Tracker — Weekly Command Center

The Meetings Tracker is the leadership operating rhythm for YPP: it tracks what
is happening each week, what was discussed, what was decided, and what action
items came out of each meeting. It is part of the Action Tracker (People
Strategy) surface and is gated behind `ENABLE_ACTION_TRACKER`, officer-tier and
above (`requireOfficer()`).

It is built on, and feeds, the existing **Action Tracker** — meetings produce
decisions, decisions produce follow-ups, and follow-ups become tracked Action
Items. It does not introduce a second task system.

## Routes

| Route | What it is |
| --- | --- |
| `/actions/meetings` | **Weekly Command Center** — the weekly dashboard. `?week=<offset>` navigates between operating weeks (Mon–Sun). |
| `/actions/meetings/[id]` | **Meeting workspace** — agenda, notes, decisions, follow-ups, and linked actions for one meeting. |

The "Meetings" tab in the Action Tracker tab bar and the nav catalog point here.

## Data model (Prisma)

The existing `OfficerMeeting` model was **extended** (all new columns optional /
defaulted, so legacy Officer Meetings keep working) and four models were added:

- `OfficerMeeting` + `title`, `purpose`, `category` (YPP area), `priority`
  (shared `ActionPriority`), `endTime`, `recurrence`, `location`, `notesText`,
  `facilitatorId`, `relatedEntityType/Id`.
- `MeetingAttendee` — join of meeting ↔ user.
- `MeetingAgendaItem` — `status` (`OPEN`/`DISCUSSED`/`DEFERRED`/`CONVERTED`),
  optional owner, `convertedActionId`.
- `MeetingDecision` — `decision`, `rationale`, `decidedBy`, `linkedActionId`.
- `MeetingFollowUp` — `status` (`OPEN`/`IN_PROGRESS`/`COMPLETED`; `OVERDUE` is
  computed), `priority`, `dueDate`, `area`, and **`linkedActionId`** — the bridge
  to the Action Tracker.

Migration: `prisma/migrations/20260608200000_add_meetings_command_center/`.

## Status is computed, never stored

Mirroring the Action Tracker's computed `OVERDUE`, effective statuses are derived
in `lib/people-strategy/meetings-status.ts` (pure, unit-tested):

- **Meeting** → `today` / `in_progress` / `upcoming` / `completed` /
  `needs_follow_up` / `canceled`, from the stored `SCHEDULED/COMPLETED/CANCELLED`
  status, the date/end window, and whether open follow-ups remain.
- **Follow-up** → `overdue` when past due and not completed.
- Dashboard metrics, the Department Pulse, and the weekly grouping are all pure
  functions of the meeting views.

## Action Tracker integration (both directions)

- **Meetings → Actions:** `convertFollowUpToAction` / `convertAgendaItemToAction`
  (`lib/people-strategy/meetings-actions.ts`) create a real `ActionItem` via the
  shared `createActionItem`, with `officerMeetingId` set, and store the new
  action id back on the follow-up / agenda item. The "Add Follow-Up" drawer can
  do this in one step via its "Create linked Action Tracker item" toggle.
- **Actions → Meetings:** the Action query includes the source `officerMeeting`;
  the action card shows a `Source: <meeting> · <date>` badge and the action
  detail has a "Source Meeting" panel that deep-links back to the meeting.

## Cross-portal operational context (the nervous system)

Meetings and actions are the two universal operational objects, and they are
connected to the rest of the portal through one shared layer:

- **Vocabulary bridge** (`lib/people-strategy/operational-context.ts`): the
  operating **area** (the meeting category — Classes, Mentorship, …) and the
  concrete **related entity** (`CLASS_OFFERING` / `MENTORSHIP` / `USER` /
  `INSTRUCTOR_APPLICATION` / `PARTNER`) are joined by `areaForRelatedEntityType`
  / `primaryEntityTypeForArea`. `computeOperationalHealth` turns raw signal
  counts into a deterministic `healthy → critical` read.
- **Unified loader** (`lib/people-strategy/operational-context-queries.ts`):
  `getOperationalContextForEntity` returns, for one entity, every related
  meeting + visible action + open follow-up + recent decision + a health read;
  `getOperationalContextForArea` does the same for a whole area. Meetings link to
  entities via `OfficerMeeting.relatedEntityType/Id` and are read with
  `getMeetingsForEntity` (the mirror of `getActionsForEntity`).
- **Shared UI** (`components/people-strategy/`): `OperationalContextPanel`
  (`operational-context-panel.tsx`) renders the whole picture as one card and is
  embedded on the Classes, Instructor, Mentorship, Partner, and Person surfaces;
  `operational-badges.tsx` / `related-meetings-list.tsx` provide the reusable
  `RelatedEntityBadge` / `SourceMeetingBadge` / `OperationalHealthBadge` /
  `RelatedMeetingsList` atoms.
- **Create-from-context**: entity pages deep-link `?new=1&relatedType&relatedId`
  into the Weekly Command Center, which auto-opens the New Meeting drawer
  prefilled and linked to that entity. Actions carry the same link, and the
  Action Tracker can filter by source (meeting-generated vs manual).

## Key files

- `lib/people-strategy/meeting-categories.ts` — YPP operating-area vocabulary + tones
- `lib/people-strategy/meetings-status.ts` — computed status, metrics, pulse, grouping
- `lib/people-strategy/meetings-queries.ts` — queries + serializable DTO mappers
- `lib/people-strategy/meetings-actions.ts` — server actions + the Action bridge
- `lib/people-strategy/meeting-templates.ts` — New Meeting templates
- `components/people-strategy/weekly-command-center-client.tsx` — the dashboard
- `components/people-strategy/meeting-detail-client.tsx` — the meeting workspace
- `components/people-strategy/new-meeting-drawer.tsx`, `meeting-followup-drawer.tsx` — forms

Sample data is seeded by `seedMeetingsTracker()` in `prisma/seed.ts`.
