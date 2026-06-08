# YPP Operating System — Maximum Pass Plan

> **Status:** Living plan. Phase 4 (Camp & Partner Pipeline) is implemented in this
> pass behind the `ENABLE_PARTNER_PIPELINE` flag (default OFF). Everything else is a
> grounded roadmap that respects the systems already shipped.
>
> **Author note:** This is a *connective-tissue* pass, not a greenfield rebuild. The
> audit below shows that the "YPP Command Center" vision is **already substantially
> designed and shipped** under the team's own naming (People Strategy Command Center,
> Action Tracker, Operations Hub, Leadership Pathway, People Dashboard). The job is to
> close honest gaps without destroying working systems.

---

## 1. Executive Summary

Youth Passion Project runs a large, mature Next.js 16 + Prisma 5 + Supabase Auth
portal: **601 route files, a ~12.8k-line Prisma schema, 156 migrations**, plain CSS
on a YPP purple design-token system. Across five parallel domain audits we confirmed
that the central nervous system the prompt asks for **mostly exists**:

- **Execution layer** — the **People Strategy Action Tracker** (`/actions/*`, `ActionItem`
  model family) with polymorphic `relatedEntityType/relatedEntityId` links, a reusable
  `linked-actions-panel`, smart urgency buckets, cron accountability emails, escalation →
  Leadership → Board roll-up, and a **Command Center** (`/actions/command-center`).
- **People layer** — `InstructorProfile` (lifecycle stages, readiness/reliability scores,
  notes, tasks, **namespaced tags**), the `InstructorApplication` pipeline (11-state review
  workflow + Kanban + timeline), and the leadership **People Dashboard** (`/people`).
- **Readiness layer** — Training Modules + the **admin Journey Editor** (`/admin/journeys`,
  versioned Draft/Published/Archived) — actively in development.
- **Advancement layer** — **Leadership Pathway** (`/leadership-pathway`, stage-inferred).
- **Support layer** — a deep **Mentorship** system (`Mentorship`, cycles, check-ins,
  `MentorshipActionItem`, 8-tab admin command center).

The **single biggest genuine gap** is the **Camp & Partner Pipeline**. The `Partner`
model is bare CRUD (`name`, `type`, `website`, `notes`, `relationshipLeadId`, `archivedAt`)
with **no pipeline status, no contact fields, no program-needs tracking, no instructor
matching, and no pipeline board**. It is also self-contained (low blast radius) and
already wired to the Action Tracker via the existing `PARTNER` link type — making it the
ideal high-value, low-risk slice to implement now. This pass ships that slice and lays out
the rest as a precise, safe roadmap.

---

## 2. Current State Audit

**Stack reality (trust this, not the older `TECH_STACK.md`/`README.md`):**
Next.js **16** App Router, React 18, TypeScript (strict), Prisma **5.22** + Supabase
Postgres, **Supabase Auth** (NextAuth retired → 410 but still a dependency; legacy
HMAC-cookie fallback still load-bearing). Edge logic lives in **`proxy.ts`**; the session
helper is **`lib/auth-supabase.ts`** (`getSession`/`getSessionUser`). **Plain CSS** (no
Tailwind), one ~14.5k-line `globals.css` with `--ypp-purple-*` tokens. Realtime via Pusher;
email via Resend/nodemailer; SMS via Twilio; **7 Vercel cron jobs**.

**Quality baseline & guardrails:**
- `next.config.mjs` sets `typescript.ignoreBuildErrors = isVercelBuild` → Vercel ships with
  type errors hidden. The repo therefore carries **pre-existing `tsc` errors** and ~6
  pre-existing failing vitest files. **Every change must prove zero *new* errors vs the
  captured baseline.**
- Migrations are **hand-written, idempotent** (`ADD COLUMN IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`), timestamp-prefixed, **additive + feature-flagged +
  default-OFF**. The team **deliberately avoids Postgres enums** for editable vocabularies,
  using `TEXT` columns validated by TS unions/Zod (see `actionType`, `relatedEntityType`,
  `goalCategory`). **Never `prisma db push`.**
- Feature flags (`lib/feature-flags.ts`) default People-Strategy surfaces **OFF**:
  `ENABLE_ACTION_TRACKER`, `ENABLE_OPERATIONS_HUB`, `ENABLE_PEOPLE_DASHBOARD`,
  `ENABLE_QUARTERLY_REVIEWS`, `ENABLE_PROVISIONAL_CLOCK`, etc.

**Auth & roles:** `RoleType` = ADMIN, INSTRUCTOR, STUDENT, MENTOR, CHAPTER_PRESIDENT,
STAFF, PARENT, APPLICANT, HIRING_CHAIR. ADMIN is refined by `AdminSubtype` (SUPER_ADMIN,
HIRING_ADMIN, MENTORSHIP_ADMIN, INTAKE_ADMIN, CONTENT_ADMIN, COMMUNICATIONS_ADMIN,
LEADERSHIP). Route protection: `app/(app)/admin/layout.tsx` + `lib/admin-capabilities.ts`
domain map + per-page guards (`lib/page-guards.ts`: `requireAdminPage()`, etc.) and
`lib/authorization-helpers.ts` (`requireAdmin()`). **Known risk:** non-admin reviewers
(HIRING_CHAIR/CHAPTER_PRESIDENT) pass the admin layout, so each page must call its own
guard; a forgotten guard could leak data.

---

## 3. Existing Routes Discovered (representative)

- **Actions / execution:** `/actions`, `/actions/all`, `/actions/all/classes`,
  `/actions/command-center`, `/actions/people`, `/actions/responsibility`,
  `/actions/meetings`, `/actions/new`, `/actions/[id]`, `/actions/[id]/edit`;
  legacy redirects `/my-actions`, `/all-actions`, `/admin/actions`; `/operations`.
- **Legacy execution:** `/admin/action-center` (+ `tasks`/`meetings`/`weekly`/`import`) —
  `LeadershipActionItem` system, slated for retirement into `/actions/*`.
- **People:** `/people`, `/people/[id]`, `/people/board-rollup`, `/people-strategy`;
  `/admin/instructors` (+ `attention`/`directory`/`hub`/`lifecycle`/`[id]`),
  `/admin/instructor-applicants` (+ `activity`), `/admin/instructor-approvals`,
  `/admin/instructor-readiness`, `/admin/instructor-assignments`, `/instructor-growth`.
- **Programs:** `/admin/training`, `/admin/journeys` (+ `[id]`), `/training`,
  `/instructor-training`, `/admin/pathways`, `/admin/pathway-tracking`, `/leadership-pathway`,
  `/admin/course-library`, `/admin/curricula`.
- **Partnerships:** `/admin/partners` (bare CRUD — **the gap**).
- **Mentorship:** `/mentorship/*`, `/mentorship-program/*`, `/my-mentor/*`,
  `/admin/mentorship`, `/admin/mentor-match`, `/admin/instructor-mentor-matching`.
- **Reports/accountability:** `/actions/command-center`, `/actions/reporting`,
  `/people/board-rollup`, `/admin/analytics`, `/admin/chapter-reports`.

## 4. Existing Data Models Discovered (representative)

- **`ActionItem`** (+ `ActionAssignment` LEAD/EXECUTING/INPUT, `ActionComment`,
  `ActionFileLink`, `ActionEmailLog`, `OfficerMeeting`, `MeetingNote`). Enums:
  `ActionItemStatus`, `ActionPriority`, `ActionItemVisibility`. Polymorphic
  `relatedEntityType` union includes **`PARTNER`**, `CLASS_OFFERING`, `MENTORSHIP`,
  `USER`, `INSTRUCTOR_APPLICATION`. `actionType` is a TEXT vocabulary.
- **`LeadershipActionItem`** (legacy parallel tracker, to retire).
- **`InstructorProfile`** (`InstructorLifecycleStage`: APPLICANT/ONBOARDING/ACTIVE/BENCH/
  PAUSED/ALUMNI; readiness/reliability scores; `isLeadershipTrack`, `isOnHold`) +
  `InstructorNote`, `InstructorTask`, `InstructorTag` → **`Tag`** (`TagNamespace`:
  SKILL/INTEREST/LANGUAGE/AVAILABILITY/TRAIT/CERTIFICATION/CUSTOM).
- **`InstructorApplication`** (`InstructorApplicationStatus`, 11 states) +
  `InstructorApplicationTimelineEvent`, `ReviewSignal`.
- **`WorkshopOpportunity`** (`topicTags[]`) + `InstructorAssignment` + matching in
  `lib/instructor-assignment-matching.ts`.
- **Training:** `TrainingModule`, `Journey`/`JourneyVersion` (`JourneyVersionStatus`:
  DRAFT/PUBLISHED/ARCHIVED), `InteractiveBeat`, `JourneyGate`, `JourneyAssignmentRule`,
  `JourneyAuditLog`.
- **Pathways:** `Pathway`, `PathwayStep`, `ChapterPathway` (`ChapterPathwayRunStatus`),
  `PathwayFallbackRequest`.
- **Mentorship:** `Mentorship` (`MentorshipStatus`, `MentorshipCycleStage`),
  `MentorshipCheckIn`, `MentorshipActionItem`, `MentorshipSession`, `MentorshipRequest`,
  `MentorGoalReview`, `MentorshipTrack`, `MentorCommittee`.
- **`Partner`** — `id`, `name`(unique), `type?`, `website?`, `notes?`,
  `relationshipLeadId?`, `classOfferings[]`, `archivedAt?`. **No pipeline fields.**

## 5. Existing Components Discovered (representative)

`components/people-strategy/*` — `action-card`, `action-detail-card`, `action-item-form`,
`action-filters-bar`, `action-analytics-cards`, **`linked-actions-panel`** (the reusable
"RelatedActionsPanel", already embedded on class/instructor/mentorship/profile pages),
`action-tracker-tabs`, `people-dashboard-table`, `escalation-queue`, `pills`, `person-link`,
`profile-drawer`, `people-suite` (IdentityCell/Meter primitives), `stat-card`.
`components/leadership-action-center/*` (legacy), `components/mentorship/*`,
`components/leadership-pathway/*`, `components/instructor-applicants/*`,
`components/training/journey/*`. UI primitives are **scattered** (no central
`components/ui/`); `components/empty-state.tsx` exists.

## 6. Existing Admin Workflows Discovered

- **Action lifecycle:** create → assign (LEAD/EXECUTING/INPUT) → comment/flag → escalate to
  Leadership (48h) → Board roll-up → complete; weekly digest + deadline + escalation crons.
- **Applicant review:** submit → assign reviewer → score → pre-approve → interview → chair
  review → approve/reject, with full timeline.
- **Instructor ops:** lifecycle stage management, tagging, notes/tasks, readiness gate.
- **Mentorship:** match → kickoff → reflection/review cycle → approvals → check-ins.
- **Training authoring:** versioned journey editing with beats/gates/assignments/preview.

## 7. Existing Pain Points

1. **Partner pipeline is a flat directory** — no stage, no follow-up date, no needs, no
   matching, no board. Relationship work happens off-portal and goes cold.
2. **Two parallel action trackers** (`ActionItem` flagship vs legacy `LeadershipActionItem`).
3. **Action Tracker view presets missing** — Saved Views backend exists but **no UI**;
   common presets (Unassigned, Due Soon, High Priority, Blocked, Waiting) are not surfaced.
4. **Cross-system links are partial** — Leadership Pathway and Training do **not** connect to
   Actions; mentorship goals don't link to actions.
5. **No instructor↔partner matching surface** despite instructor tags + a workshop matcher.
6. **Scattered UI primitives** make consistency reliant on discipline.

## 8. Disconnected Systems

- Leadership Pathway ↔ Actions (no link).  Training completion ↔ Actions (no link).
- Mentorship goals ↔ Actions (separate `MentorshipActionItem` vs `ActionItem`).
- Partner ↔ Instructor (no matching).  Applicant approval ↔ InstructorProfile creation
  (conversion path not explicit).

## 9. Redundant Systems

- `LeadershipActionItem` (legacy `/admin/action-center`) vs `ActionItem` (`/actions/*`).
- `MentorshipActionItem` vs `ActionItem` (intentional for now; candidate for unification).
- Multiple request caches / feature systems / auth layers (consolidation noted in
  `docs/portal-consolidation-plan.md`).

## 10. Broken or Risky Systems

- **Type safety hidden in prod** (`ignoreBuildErrors`) — latent errors can ship.
- **Page-guard reliance** — a forgotten `requireAdminPage()` under `/admin/*` could leak data
  to non-admin reviewers.
- **Legacy HMAC auth fallback** still load-bearing while NextAuth is retired.

---

## 11. Product Diagnosis

The portal already answers most of the "five daily questions" (what's due, who owns it,
what's stuck, who's ready, where we're growing) **for internal execution and people ops**.
The growth/partnership leg is the weakest: the org cannot see partner conversations as a
pipeline, cannot tie follow-ups to partners with confidence, and cannot match its strongest
instructors to partner needs. Closing that — *using the connective tissue that already
exists* — produces the largest marginal gain with the least risk.

## 12. Proposed Operating System Vision

Keep the team's established spine (Action Tracker = execution, People Dashboard = people,
Leadership Pathway = advancement, Mentorship = support, Command Center = visibility) and
**add the growth leg**: a real **Partner Pipeline** that is a first-class relationship
manager, fully wired into the Action Tracker (follow-ups), the People layer (instructor
matching by tag), and accountability (overdue follow-ups, cold partners).

## 13. Proposed Information Architecture

Adopt the prompt's admin grouping *incrementally* (Command Center · Action Tracker · People ·
Programs · **Partnerships** · Growth · Reports · Settings) by adding nav entries, not by
moving working routes. This pass adds a **Partnerships → Partners** pipeline entry (flagged).

## 14. Proposed Route Map (this pass)

- `/admin/partners` — upgraded: **pipeline board** with stage columns, priority, next
  follow-up, open-action counts, and stuck/cold flags (flag ON); falls back to the existing
  simple list when the flag is OFF.
- `/admin/partners/[id]` — **new** partner profile: Overview · Contact · Program Needs ·
  Instructor Matches · Related Actions (`linked-actions-panel`) · Notes & Timeline · Outcome.
  Returns `notFound()` when the flag is OFF (existence not leaked).

## 15. Proposed Data Relationship Map (this pass — additive only)

```
Partner (extended)
 ├─ stage / priority / partnerType        (TEXT vocab, TS-union validated — no PG enum)
 ├─ contactName/Title/Email/Phone, location, source
 ├─ lastContactedAt / nextFollowUpAt / meetingDate
 ├─ requestedSubjects / requestedAgeGroups / requestedDates / programFormat
 ├─ expectedStudents / instructorCountNeeded / constraints / outcome
 ├─ relationshipLead → User           (existing)
 ├─ classOfferings   → ClassOffering  (existing)
 ├─ pipelineNotes    → PartnerNote[]  (NEW table; FK-less authorId per house style)
 └─ ⇄ ActionItem via relatedEntityType="PARTNER" (EXISTING polymorphic link)

Instructor match (computed, no schema):
 Partner.requestedSubjects ↔ InstructorProfile.tags(Tag.label/slug, SKILL|INTEREST)
   scored by overlap + lifecycle ACTIVE + leadership track + readiness; isOnHold excluded.
```

## 16. Proposed Component Architecture (this pass)

- `app/(app)/admin/partners/pipeline-board.tsx` (client) — stage columns + filters.
- `app/(app)/admin/partners/[id]/*` — profile sections (server) reusing `linked-actions-panel`,
  `PersonLink`, and existing CSS primitives (`card`, `badge`, `form-grid`).
- `lib/partners-constants.ts` — stage/priority/type/note-kind vocab + labels + Zod.
- `lib/partners-queries.ts` / `lib/partners-actions.ts` — extended additively.
- `lib/partner-instructor-matching.ts` — tag-overlap matcher (pure + query helper).

## 17. Proposed Workflow Architecture (Partner)

Create partner → set stage + relationship lead → record contact + program needs → log a
follow-up note (auto-stamps `lastContactedAt`) → set `nextFollowUpAt` → advance stage
(Reached out → Responded → Meeting scheduled → Proposal sent → Active partnership) → match
instructors by tag → create linked actions for assignment → record outcome. Overdue
`nextFollowUpAt` and "no next step" surface as **stuck/cold** flags on the board.

## 18. Proposed 8-Phase Implementation Plan

| Phase | Scope | This pass |
|---|---|---|
| 1 | Command Center | ✅ already shipped (`/actions/command-center`) — roadmap only |
| 2 | Action Tracker views/filters | Roadmap: surface Saved Views UI + preset chips (Unassigned/Due Soon/High Priority/Blocked/Waiting) |
| 3 | People ops (instructor profiles) | Already strong — roadmap: add `linked-actions-panel` parity + match surfacing |
| 4 | **Camp & Partner pipeline** | **✅ IMPLEMENTED this pass (flagged)** |
| 5 | Training admin editor | In-flight (`/admin/journeys`) — finish Commits 3–17 |
| 6 | Leadership Pathway → Actions | Roadmap: persist stage override; link pathway steps to actions |
| 7 | Mentorship integration | Strong — roadmap: unify `MentorshipActionItem` ↔ `ActionItem`; check-in SLAs |
| 8 | Reports & accountability | Roadmap: add Partnership Report + Action Completion Report pages |

## 19. Which Phases Are Safe To Implement Now

Phase 4 (this pass — self-contained, additive, flagged). Phase 2 preset chips (UI-only).
Phase 8 read-only report pages (UI-only over existing data). These touch no destructive paths.

## 20. Which Phases Require Database Changes

Phase 4 (additive `Partner` columns + new `PartnerNote` table — shipped here). Phase 6
(persist `User.stage`/pathway-action links). Phase 7 unification (data backfill). All others
are UI-only or already-migrated.

## 21. Which Phases Can Be UI-Only

Phase 2 (preset chips over existing filters), Phase 3 (panel parity), Phase 8 (reports over
existing aggregates), and the read paths of Phase 1.

## 22. Migration Risks

- **Partner columns:** additive, nullable/defaulted, `ADD COLUMN IF NOT EXISTS` — no risk to
  existing rows or queries. TEXT vocab avoids enum DDL hazards.
- **`PartnerNote`:** brand-new table, `CREATE TABLE IF NOT EXISTS`, FK-less author per house
  style — no impact on `User`.
- **General:** never `prisma db push`; `scripts/maybe-db-sync.mjs` runs `migrate deploy` on
  Vercel build, so the migration must be idempotent (it is).

## 23. Rollback Plan

- **Instant:** unset `ENABLE_PARTNER_PIPELINE` → board/profile revert to the prior simple
  list; new routes return `notFound()`. No data loss.
- **Code:** revert the feature commits; the additive columns/table remain harmless (unused).
- **Schema (only if required):** the new columns/table are inert when unused; a down-migration
  is not needed for safety and is intentionally omitted to avoid destructive ops.

## 24. Manual QA Plan

With `ENABLE_PARTNER_PIPELINE=true` (and `ENABLE_ACTION_TRACKER=true` for action links):
1. `/admin/partners` loads as a pipeline board; stage columns + counts render; empty states
   are warm and actionable.
2. Create a partner; it appears in the correct stage column.
3. Open `/admin/partners/[id]`; all sections render; non-admin is redirected.
4. Advance stage; log a follow-up note → `lastContactedAt` updates, timeline shows it.
5. Set `nextFollowUpAt` in the past → partner shows a "follow-up overdue" flag.
6. Record program needs → Instructor Matches surfaces tagged instructors with reasons; warm
   empty state when no matches.
7. Create a linked action from the profile → appears in `linked-actions-panel` and `/actions`.
8. With the flag OFF: `/admin/partners` is the original list; `/admin/partners/[id]` →
   `notFound()`. **No behavior change for existing users.**
9. `npm run typecheck` shows **zero new** errors vs baseline; `npm run lint` clean for
   changed files; `npm run build` succeeds.

## 25. Future Roadmap

Phase 2 Saved-Views UI + preset chips · Phase 6 pathway↔action links + persisted stage ·
Phase 7 action-model unification · Phase 8 Partnership/Action-Completion report pages ·
retire `LeadershipActionItem` into `ActionItem` · consolidate caches/feature systems/auth ·
flip off `ignoreBuildErrors` once the baseline is clean · central `components/ui/` primitives.

## 26. Open Questions

1. Should "Camps" be a distinct `partnerType` value (recommended) or a separate model? This
   pass treats camp as a `partnerType` to avoid a parallel pipeline.
2. Final partner stage vocabulary — confirm the 12 stages match how the team actually works.
3. Should partner matching weight `readinessScore`/`reliabilityScore` once those are
   reliably populated? (Currently a light bonus.)
4. Should `nextFollowUpAt` auto-create an `ActionItem` (vs. a soft board flag)? This pass uses
   a soft flag + one-click "Create follow-up action" to avoid duplicate-action noise.
5. Confirm the preferred Leadership/CPO label before any enum/column rename (high-risk).
