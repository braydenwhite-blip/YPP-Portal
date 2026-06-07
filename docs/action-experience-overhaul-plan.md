# Action Experience Overhaul — Audit & Upgrade Plan

> Goal: make **creating, viewing, and managing actions** feel like the central
> execution layer of the YPP Portal. This document records the current state of
> the Action Tracker, its real weaknesses, and the concrete, additive upgrade
> path implemented in the accompanying commits.

## 1. Current model (what already exists)

The Action Tracker (`lib/people-strategy/*`, `components/people-strategy/*`,
`app/(app)/actions/*`) is already a mature system, not a bare checklist.

**Data model — `ActionItem`** (`prisma/schema.prisma`):

- Core: `title`, `description`, `goalCategory` (free-text), `departmentId`.
- Workflow: `status` (`NOT_STARTED / IN_PROGRESS / BLOCKED / COMPLETE / OVERDUE
  / DROPPED`), `priority` (`LOW / MEDIUM / HIGH / URGENT`), `deadlineStart`,
  `deadlineEnd`, `completedAt`, `visibility`.
- Ownership: denormalized `leadId` + `ActionAssignment` rows (`LEAD / EXECUTING
  / INPUT`).
- Escalation: `flaggedAt`, `escalatedToLeadershipAt`, `resolvedAt`,
  `boardRolledUpAt`.
- **Polymorphic link**: `relatedEntityType` / `relatedEntityId` (string-typed,
  no FK) pointing at `CLASS_OFFERING / MENTORSHIP / USER /
  INSTRUCTOR_APPLICATION`. Department + officer-meeting links use their own FK
  columns.
- Supporting models: `ActionAssignment`, `ActionComment`, `ActionFileLink`,
  `ActionEmailLog`, `ActionPulseSnapshot`, `ActionTemplate`, `Department`.

**Creation**: `/actions/new` with a template gallery (`ActionTemplate`),
create-from-context via `?relatedType=&relatedId=` (resolved + existence-checked
server-side), and a flat sectioned form (`action-item-form.tsx`).

**Viewing**: My Actions, All Actions (group by department or linked entity),
Command Center (weekly pulse, leadership attention queue, momentum, win log),
Classes, Responsibility map, People dashboard. Cards (`action-card.tsx`),
detail (`action-detail-card.tsx`), filters (`action-filters-bar.tsx`), saved
views, CSV export, and cron emails (digest / warnings / escalation).

**Integration**: `linked-actions-panel.tsx` is mounted on admin class detail,
instructor class settings, person profile, admin instructor detail, my profile,
and mentee workspace. An operations hub rolls up class / mentorship / instructor
gaps.

## 2. Real weaknesses & gaps (vs. the product goal)

After a full audit, the genuine gaps — the things that are *missing*, not merely
polishable — are:

1. **No action _type_.** Every action is typed only by a free-text
   `goalCategory`. There is no controlled vocabulary distinguishing _outreach_
   from _follow-up_ from _instructor recruiting_ from _class planning_. This is
   the single most-requested capability: it should drive helper text, scannable
   badges, and filtering.
2. **Partners are not connectable.** "Camps" do **not** exist as a model — but
   `Partner` does (org/school behind a class, carrying a `relationshipLeadId` =
   "relationship lead"). Actions cannot link to a Partner, so partnership
   follow-ups have nowhere to live and relationships go cold silently.
3. **My Actions is not bucketed by urgency.** It shows three static panels
   (Executing / Needs input / Upcoming) with no Overdue / Due-today /
   Due-this-week / Later / No-date grouping.
4. **Empty states are passive** — they describe the void instead of offering the
   next step.

## 3. Upgrade path (implemented in these commits)

Each phase is additive, follows the existing idioms (string-typed loosely-coupled
enums validated by a TS union + Zod, exhaustiveness-guarded resolvers, pure
unit-tested selectors), and ships behind the existing `ENABLE_ACTION_TRACKER`
flag.

### Phase A — Action Type system (data + server)

- `ActionItem.actionType String?` + index (idempotent migration, mirroring the
  `relatedEntityType` pattern — no Postgres enum, validated in app code).
- `lib/people-strategy/action-types.ts`: `ACTION_TYPE_VALUES`,
  `ACTION_TYPE_LABELS`, per-type guidance (helper text + which fields matter),
  and `parseActionType` / `isActionType` validators.
- Wire `actionType` through the create / update Zod schemas + writes.

### Phase B — Action Type in the UI

- Form: a guided Action Type selector that surfaces type-specific helper text.
- Card + detail: a quiet Action Type badge so lists are scannable.
- Filters: filter by Action Type (URL-driven, consistent with the export).
- Templates: map a template to a default Action Type.

### Phase C — Partner linking (the real "camp / partner")

- Add `PARTNER` to the polymorphic related-entity union (no migration — the
  column is already a string). The exhaustiveness guards force complete handling
  in the existence check + the summary/label resolvers.
- Resolve a Partner to its name + admin link; make it prefillable.
- Surface "Create linked action" + a linked-action count on the Partners admin
  page so a relationship lead can spin up a follow-up in one click.

### Phase D — My Actions urgency buckets + actionable empty states

- Group the viewer's open work into Overdue / Due today / Due this week / Later
  via a pure, unit-tested selector (`bucketByUrgency`). There is no "no due
  date" bucket — every action carries a required deadline — so it is
  intentionally omitted rather than shipped perpetually empty.
- Replace passive empty copy with a clear next step + CTA ("Create your first
  action" on My Actions; a "don't let it go cold" follow-up nudge on each
  partner).

## 4. Safety

- The migration is additive and idempotent (`ADD COLUMN IF NOT EXISTS`); no
  existing rows change and `actionType` defaults to `NULL` (= "untyped",
  rendered as no badge).
- Every new value funnels through the same validate-on-write path as the
  existing polymorphic link, so a bad type can never be persisted.
- All new derivations are pure functions with unit tests; UI changes reuse the
  existing design-system pills, filter bar, and form primitives so nothing
  visually disconnects.
</content>
</invoke>
