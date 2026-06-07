# People Strategy Operating System — Phased Plan

> **Status:** Planning committed. Implementation not started.
> **Owner doc for:** turning the YPP Portal's People Strategy area into one connected operating system.
> **How to use this file:** each phase below is designed to be implemented in its own separate Claude Code session. A session should read this whole document first, implement only its phase's "Owns" list, respect its "Must NOT touch" list, and stop at the phase boundary unless explicitly told to continue.

---

## 1. Product goal

The YPP Portal's People Strategy domain is currently a set of loosely-coupled tools. The goal is to make it feel like one connected internal operating system.

The core triangle:

1. **Mentorship**
2. **Action Tracker** (`ActionItem`)
3. **Instructor Classes / Course Operations** (`ClassOffering`)

Scope also includes anything else clearly connected to People Strategy: instructor onboarding, instructor readiness, instructor applications (where connected), leadership pathway, the People Strategy command center, officer meetings, departments, user profiles, role-based dashboards, admin people views, gamification / points / ratings / badges / progress, escalations, crons & reminders, capacity tracking, matching workflows, follow-up workflows, team oversight, every `lib/people-strategy/*` module, and any legacy People Strategy routes or duplicated people-management pages that still affect the experience.

When finished, the portal should answer at a glance:

- Who needs help?
- Who is responsible?
- What is overdue?
- Which instructors need support?
- Which classes are at risk?
- Which mentorships need follow-up?
- Who is preparing for leadership or instructor roles?
- Which officers or leaders own which work?
- Which departments have stuck work?
- Which users have actions but no support?
- Which classes have support but no action plan?
- Which mentorships are active but not connected to execution?
- Which instructor applicants or new instructors need onboarding?
- Which mentors have capacity?
- Which leadership pathway users are ready for the next step?
- What should each role do next?

This should feel like a real internal operating system for YPP — not a collection of disconnected admin tools.

---

## 2. Technical architecture

- **`ActionItem` becomes the connective tissue** via a polymorphic `relatedEntityType` / `relatedEntityId` link (no foreign key; string-typed; validated by a TS union + Zod).
- A **role-aware Operations Hub** at `/operations` aggregates cross-system state into one operating picture.
- **Cross-surface panels** make connections visible directly on class, mentorship, instructor, person, and profile pages.
- The **Action Tracker** gains linked-entity filters and grouping so it becomes a true execution layer.
- Everything is **additive and feature-flagged**. Existing routes are preserved. The known legacy duplication (`/actions/*` vs `/my-actions` / `/all-actions`) is **documented, not merged**, in this program.

### Repo conventions this plan follows
- Next.js 16 App Router, TypeScript (strict), Prisma 5 + Supabase Postgres, NextAuth.
- Migrations are hand-written, idempotent, timestamp-prefixed directories under `prisma/migrations/` (pattern reference: `20260601180000_add_action_escalation_state`).
- Feature flags live in `lib/feature-flags.ts` (default-OFF opt-ins use `process.env.ENABLE_X === "true"`).
- `next.config.mjs` sets `typescript.ignoreBuildErrors` on Vercel builds, so the repo carries pre-existing `tsc` errors that do not block builds. Every phase must run `tsc --noEmit` and prove it adds **zero new** errors (diff the error count against the baseline before editing).

---

## 3. Feature flags

Add a new default-OFF flag (during Phase 1):

```ts
// lib/feature-flags.ts
export function isOperationsHubEnabled(): boolean {
  return process.env.ENABLE_OPERATIONS_HUB === "true";
}
```

Requirements (treated as a regression guard):

- Existing users see **no behavior change** when `ENABLE_OPERATIONS_HUB` is off.
- The `/operations` route is **unavailable** (`notFound()`) when the flag is off.
- New panels are **hidden** when the flag is off.
- New nav entries are **hidden** when the flag is off.
- Any tracker-powered feature must still respect `ENABLE_ACTION_TRACKER`.
- Pages that need both systems must require **both** flags.

---

## 4. Data model change (Phase 1)

Extend `model ActionItem` (`prisma/schema.prisma`, around line 12269):

```prisma
/// Polymorphic link to a related domain entity (CLASS_OFFERING / MENTORSHIP /
/// USER / INSTRUCTOR_APPLICATION). String-typed (no FK) to mirror the
/// loosely-typed goalCategory field and keep cross-domain linking flexible.
/// Validated by a TS union + Zod. NOTE: department and officer-meeting links
/// use the EXISTING departmentId / officerMeetingId FKs, NOT this field, to
/// avoid two sources of truth.
relatedEntityType String?
relatedEntityId   String?

// add to the model's index block:
@@index([relatedEntityType, relatedEntityId])
```

Hand-written idempotent migration `prisma/migrations/20260608120000_add_action_related_entity/migration.sql`:

```sql
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "relatedEntityType" TEXT;
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "relatedEntityId" TEXT;
CREATE INDEX IF NOT EXISTS "ActionItem_relatedEntityType_relatedEntityId_idx"
  ON "ActionItem"("relatedEntityType", "relatedEntityId");
```

### Related entity types — audited decision

`RELATED_ENTITY_TYPE_VALUES` (in `lib/people-strategy/constants.ts`) ships with the values that map to clean, stable entities. The originally-proposed 7-value list was narrowed after auditing the codebase:

| Value | Label | Decision | Rationale |
|---|---|---|---|
| `CLASS_OFFERING` | Class | **Ship + fully wire** | Stable `ClassOffering`; safe detail pages (`/admin/classes/[id]`, `/instructor/class-settings`). |
| `MENTORSHIP` | Mentorship | **Ship + fully wire** | Stable `Mentorship`; safe detail page (`/mentorship/mentees/[id]`). |
| `USER` | Person | **Ship + fully wire** | Stable `User`; safe detail pages (`/people/[id]`, `/admin/instructors/[id]`, `/profile`). |
| `INSTRUCTOR_APPLICATION` | Instructor Application | **Include as a valid value** (Zod + existence check); **defer the panel** | `InstructorApplication` is a clean, persistent entity, so linking is safe. Its detail page is a redirect proxy → `/applications/instructor/[id]`, which is risky to modify; defer the on-page panel. |
| `DEPARTMENT` | Department | **Exclude from polymorphic field** | `ActionItem.departmentId` already exists. Using both = two sources of truth. No department UI exists; surface department work as a hub rollup grouped by `departmentId`. |
| `OFFICER_MEETING` | Officer Meeting | **Exclude from polymorphic field** | `ActionItem.officerMeetingId` already exists with a relation. No per-meeting detail route exists; surface meeting follow-ups in the hub via the existing FK + `officer-meetings-queries.ts`. |
| `LEADERSHIP_PATHWAY` | Leadership Pathway | **Exclude entirely (document only)** | The leadership stage is config-inferred (`lib/leadership-pathway.ts`) with no stable DB id. Link actions to `USER` and show stage context instead. |

Human-readable labels (`RELATED_ENTITY_TYPE_LABELS`): `CLASS_OFFERING → Class`, `MENTORSHIP → Mentorship`, `USER → Person`, `INSTRUCTOR_APPLICATION → Instructor Application` (plus `DEPARTMENT → Department`, `OFFICER_MEETING → Officer Meeting`, `LEADERSHIP_PATHWAY → Leadership Pathway` retained as label constants for any future use, even though they are not shipped polymorphic values).

### Validation rules

- `relatedEntityType` and `relatedEntityId` must be **both present or both absent**.
- `relatedEntityType` must be one of the allowed values.
- `relatedEntityId` must be **trimmed and non-empty** if present.
- Never trust URL params without validation.
- Never trust client-supplied viewer information.
- No permission bypasses; use server-side permission checks everywhere.

### Hard "do not" list for this program

- Do **not** add hard foreign keys.
- Do **not** create a Postgres enum for `relatedEntityType`.
- Do **not** backfill old rows (unless trivial and explicitly approved).
- Do **not** replace `MentorshipActionItem` with `ActionItem` (keep them separate; show side by side).
- Do **not** delete or merge legacy routes unless obviously safe.
- Do **not** rewrite the whole People Strategy system.
- Do **not** use fake data.

---

## 5. Permissions model

Reuse the pure predicates in `lib/people-strategy/action-permissions.ts`:
`canViewAction`, `canCreateAction`, `canEditAction`, `isOfficerTier`, `isLeadershipOrBoard`, `isBoard`, evaluated against a **trusted server `ActionViewer`** (`{ id, roles, primaryRole, adminSubtypes }`) resolved from `lib/auth-supabase.ts` — never a client-supplied viewer.

New read helpers always filter results through `canViewAction`. Role scoping:

- Admins / leadership → system-wide visibility.
- Mentors → their mentees.
- Instructors → their own classes/actions (unless they hold a broader role).
- Mentees / members → their own relevant information.
- Officers / team leads → their appropriate scope.

No client param may expose private data; no query may return actions past `canViewAction`.

---

## 6. The four phases

Each phase is independently implementable in a separate session, has its own branch, makes its own focused commits, and ends at its boundary.

### PHASE 1 — Foundation: audit, flag, data model, action linking
**Branch:** `claude/people-strategy-foundation`

**Owns:**
1. Full People Strategy audit notes (captured in this doc / a phase note).
2. Feature flag `ENABLE_OPERATIONS_HUB` + `isOperationsHubEnabled()`.
3. Related-entity constants + labels in `lib/people-strategy/constants.ts`; add `"/operations"` to `ACTION_ITEM_PATHS`.
4. Prisma schema change (the two fields + index).
5. Idempotent migration `20260608120000_add_action_related_entity`.
6. `ActionItem` create/update support for `relatedEntityType` / `relatedEntityId` in `lib/people-strategy/action-items-actions.ts`, with Zod (both-or-neither `superRefine`, enum membership, trim) and an `assertRelatedEntityExists(type, id)` helper (switch over `classOffering` / `mentorship` / `user` / `instructorApplication`).
7. Read helpers in `lib/people-strategy/action-queries.ts`: `getActionsForEntity(type, id, viewer)` and batch `getActionsForEntities(refs, viewer)` — reuse `ACTION_ITEM_INCLUDE`, gate by `isActionTrackerEnabled()`, filter by `canViewAction`, avoid N+1 (batch builds one `OR` query and groups into a `Map`).
8. Basic tests for validation and visibility filtering where feasible.

**Files likely involved:** `docs/people-strategy-operating-system-plan.md`, `lib/feature-flags.ts`, `lib/people-strategy/constants.ts`, `prisma/schema.prisma`, `prisma/migrations/20260608120000_add_action_related_entity/migration.sql`, `lib/people-strategy/action-items-actions.ts`, `lib/people-strategy/action-queries.ts`, relevant tests.

**Must NOT touch:** Operations Hub UI, cross-surface panels, tracker grouping UI, broad UI polish, mentorship redesign, legacy route consolidation.

**Acceptance criteria:**
- Plan committed before implementation.
- `ActionItem` can safely store a related entity link.
- Existing action creation still works without related-entity fields; updates never accidentally erase them; clearing is intentional.
- Read helpers return only actions the viewer can see.
- No user-facing behavior changes when the flag is off.
- `prisma validate` and `prisma generate` pass.
- Zero new TypeScript errors.

**Checks:** `npx prisma validate`, `npx prisma generate`, `npx tsc --noEmit` (diff vs baseline), targeted `vitest`.

---

### PHASE 2 — Core triangle connections
**Branch:** `claude/people-strategy-core-connections`

**Owns:**
1. New-action prefill: `/actions/new?relatedType=CLASS_OFFERING|MENTORSHIP|USER&relatedId=…` with **server-side label fetch** and safe param validation (invalid params fail safely).
2. Action form "Linked to {label}" read-only chip (`components/people-strategy/action-item-form.tsx`).
3. **Admin class detail panel** (`app/(app)/admin/classes/[id]/page.tsx`): linked actions, open/overdue actions, support/mentor status (is the lead instructor a mentee in an active `Mentorship`? who's the mentor?), "Create action for this class" CTA.
4. **Mentorship mentee detail panel** (`app/(app)/mentorship/mentees/[id]/page.tsx`): related teaching classes (`getMyTeachingClasses`), readiness (`getInstructorReadiness`), tracker actions for the mentorship/person, with `MentorshipActionItem` shown **separately** (clearly distinct from global tracker actions). Requires both flags (class-tracker loaders are tracker-gated).
5. **Instructor class-settings panel** (`app/(app)/instructor/class-settings/page.tsx`, only when `?offering=` set): the instructor's own mentor/support, related class actions, next steps, create/view CTA where role allows.
6. Safe empty states, server-side permission checks, feature-flag guards everywhere.

**Files likely involved:** `components/people-strategy/action-item-form.tsx`, `app/(app)/actions/new/page.tsx`, `app/(app)/admin/classes/[id]/page.tsx`, `app/(app)/mentorship/mentees/[id]/page.tsx`, `app/(app)/instructor/class-settings/page.tsx`, small shared panel components if useful.

**Must NOT touch:** Operations Hub, advanced tracker grouping/filtering, department/officer/leadership-pathway integrations (unless trivial), major redesigns outside the triangle.

**Acceptance criteria:**
- A linked action can be created from a class page and from a mentorship page.
- Linked actions appear on the correct class or mentorship surface.
- Instructors can see relevant class support and actions where allowed.
- `MentorshipActionItem` and `ActionItem` are not merged or confused.
- Flag-off behavior preserves existing pages.
- No permission leaks; mobile layout is safe.

**Checks:** `npx tsc --noEmit`, `vitest`, manual flag-on/off matrix on touched pages.

---

### PHASE 3 — Operations Hub + broader People Strategy integrations
**Branch:** `claude/people-strategy-operations-hub`

**Owns:**
1. Navigation entry for the Operations Hub + `requiresOperationsHub` (or equivalent) nav gating.
2. Thread `operationsHubEnabled` through `app/(app)/layout.tsx` → `components/app-shell.tsx` → `components/nav.tsx` → `lib/navigation/resolve-nav.ts` (mirror the existing `actionTrackerEnabled` wiring); add `requiresOperationsHub?` to `lib/navigation/types.ts` and the entry to `lib/navigation/catalog.ts`.
3. `lib/people-strategy/operations-hub.ts` with `loadOperationsHub(viewer, now)` composing existing loaders where safe: `loadCommandCenter(viewer, now)`, `loadMentorshipHealth(now)`, `listTrackerClasses()`, `getMyTeachingClasses(userId)`, `getInstructorReadiness(userId)`, `getActionsForEntity()` / `getActionsForEntities()`, and any safe department / officer-meeting / escalation / leadership-pathway / user-support loaders.
4. Derived lists (each independently guarded so one empty system never breaks the page):
   - Instructors without mentor support
   - Mentees preparing to teach
   - Classes needing leadership follow-up
   - Classes with overdue linked actions
   - Classes with no linked actions
   - Active mentorships with no tracker actions
   - Users with overdue actions
   - People with actions but no support connection
   - Mentors with capacity
   - Departments with overdue actions (via `departmentId`) — if supported
   - Officer meetings with unresolved follow-ups (via `officerMeetingId`) — if supported
   - Leadership pathway users ready for next step — if supported
   - Instructor applicants / new instructors needing onboarding — if supported
   - Escalations needing attention — if supported
   - Recent wins / recently completed actions
5. `app/(app)/operations/page.tsx` — `dynamic = "force-dynamic"`, `notFound()` when the flag is off; **role-aware**:
   - **Admins / leadership:** full command center (overall health, open/overdue actions, stuck classes, mentorship gaps, instructor support gaps, department bottlenecks, officer-meeting follow-ups, escalations, people needing support, suggested next actions).
   - **Mentors:** my mentees, their open actions, their classes/readiness, check-in nudges, support gaps, suggested next mentor actions.
   - **Mentees:** my mentor, my next actions, my readiness/leadership progress, related classes, what to do before the next check-in.
   - **Instructors:** my classes, class tasks, linked actions, my support person/mentor, missing class information, what to finish next.
   - **Officers / team leads:** my department/team actions, people I support, meetings needing follow-up, overdue work, bottlenecks, suggested next actions.
   - **Users with no data:** a helpful empty state explaining the page and one clear next step.
6. Safe panels on stable surfaces where they exist: `/people/[id]` (via `lib/people-strategy/public-profile.ts` + `components/people-strategy/profile-body.tsx`), `/admin/instructors/[id]` (extend `components/people-strategy/member-people-strategy-section.tsx`), `/profile` (after `RoleStrip`). Department / officer-meeting / leadership-pathway integrations only if their pages exist and are stable; otherwise document as deferred.

**Files likely involved:** `lib/people-strategy/operations-hub.ts`, `app/(app)/operations/page.tsx`, `lib/navigation/types.ts`, `lib/navigation/resolve-nav.ts`, `lib/navigation/catalog.ts`, `app/(app)/layout.tsx`, `components/app-shell.tsx`, `components/nav.tsx`, optional `/people/[id]`, `/admin/instructors/[id]`, `/profile` and any safe department/officer/leadership pages.

**Must NOT touch:** large visual redesigns across the whole People Strategy area, legacy route consolidation, risky schema expansions, backfills, hard foreign keys.

**Acceptance criteria:**
- Operations Hub appears only when both feature flags and role permissions allow it.
- Hub gives admins/leaders a real operating view; mentors see mentee needs; mentees see next steps; instructors see class tasks/support; officers/team leads see relevant follow-ups if supported.
- Users with no data get a helpful empty state.
- No private-data leaks; flag-off behavior remains safe.
- All broader integrations are either implemented safely or documented as deferred.

**Checks:** `npx tsc --noEmit`, `vitest` (hub pure derived logic), manual role matrix.

---

### PHASE 4 — Polish, tracker power features, permissions audit, tests, docs
**Branch:** `claude/people-strategy-polish-safety`

**Owns:**
1. **Action Tracker upgrade** (`lib/people-strategy/action-filters.ts`, `components/people-strategy/action-filters-bar.tsx`, `app/(app)/actions/all/page.tsx`): `relatedType` filter; group-by linked entity / owner / department / status; owner / status / priority (if supported) / overdue / category filters; "needs attention" and "recently completed" sections. Keep the current default view unchanged.
2. **UI/UX polish:** page titles, card hierarchy, badges, CTA labels, filter labels, empty states, spacing, mobile layout, loading states, error states.
3. **Copywriting pass:** full sentences; student-friendly language; clear next actions; no corporate jargon. Good: "This instructor does not have mentor support yet." / "This class has 3 open actions." / "No actions are linked to this mentorship yet." Bad: "Manage engagement architecture." / "Optimize pipeline execution."
4. **Permissions audit:** admins, mentors, mentees, instructors, officers/team leads, users with no role data — documented.
5. **Testing:** validation tests; `getActionsForEntity` and `getActionsForEntities` visibility tests; operations-hub derived-logic tests; feature-flag hidden-behavior tests if feasible.
6. **Documentation:** update this plan with what shipped; document deferred items, known legacy route warts, and next moves.

**Files likely involved:** `components/people-strategy/action-filters-bar.tsx`, `app/(app)/actions/all/page.tsx`, operations-hub components, cross-surface panel components, tests, `docs/people-strategy-operating-system-plan.md`, any affected People Strategy UI components.

**Must NOT touch:** new risky data models, major schema changes, legacy route deletion, backfills (unless explicitly approved later).

**Acceptance criteria:**
- Action Tracker is a true execution layer; users can group/filter by linked entity.
- People Strategy UI feels cohesive; mobile experience is strong; copy is clear and helpful.
- Permissions audit is documented.
- Tests/checks pass, or pre-existing failures are clearly separated from new ones.
- Final documentation explains what shipped and what remains.

---

## 7. Risks & deferrals

- The polymorphic link has **no referential integrity** — a deleted class/mentorship can leave a dangling `relatedEntityId`. Mitigation: panels render only entities that still exist; the optional write-time `assertRelatedEntityExists` reduces (cannot eliminate) orphans. Acceptable for this program.
- **Two parallel action surfaces** exist (`/actions/*` and legacy `/my-actions` / `/all-actions` / `/admin/actions`). All new "Create" CTAs point at the canonical `/actions/new`. The duplication is documented, **not** consolidated, here.
- `MentorshipActionItem` is a **separate table** from `ActionItem`; this program shows them side by side and never merges them.
- **Departments** and **officer meetings** use their existing dedicated FKs (`departmentId`, `officerMeetingId`), not the polymorphic field; they are surfaced as hub rollups.
- **Leadership pathway** and **instructor readiness** are computed (no persistent id); actions link to `USER` with their context surfaced.
- **Deep gamification** (points / badges / XP / recognition) is deferred — the hub surfaces "recent wins" (recently completed actions) only.
- **Instructor-applicant on-page panel** is deferred (its detail page is a risky redirect proxy), though `INSTRUCTOR_APPLICATION` is a valid link value.

---

## 8. How future Claude sessions continue from this plan

Each phase = a fresh session:
1. Read `docs/people-strategy-operating-system-plan.md` in full.
2. Branch from latest `main` (or the prior completed phase branch).
3. Implement only that phase's **Owns** list; respect its **Must NOT touch** list.
4. Make focused commits per the flow in §9.
5. Run checks after each meaningful chunk.
6. Document pre-existing failures separately from new failures.
7. Stop at the phase boundary unless explicitly asked to continue.

General rules for all phases:
- Prefer additive integration over risky replacement.
- Protect existing users; feature-flag all new user-facing surfaces.
- Run checks after each meaningful chunk.
- Never use fake data.
- Never expose private data through URL params.
- Never bypass server-side permissions.
- Never assume every user has every role.

---

## 9. Branch & commit flow

**Branches:**
- `claude/people-strategy-plan` — planning (this commit)
- `claude/people-strategy-foundation` — Phase 1
- `claude/people-strategy-core-connections` — Phase 2
- `claude/people-strategy-operations-hub` — Phase 3
- `claude/people-strategy-polish-safety` — Phase 4

**Suggested commit flow:**
1. `docs: add people strategy operating system phased plan`
2. `feat(flags): add operations hub feature flag`
3. `feat(actions): add related entity link foundation`
4. `feat(actions): support linked action creation`
5. `feat(people-strategy): add class and mentorship action panels`
6. `feat(operations): add people strategy operations hub`
7. `feat(actions): add linked entity filters and grouping`
8. `polish(people-strategy): improve copy, empty states, and mobile layout`
9. `test(people-strategy): add linked action and hub coverage`
10. `docs: document shipped integrations and deferred work`
