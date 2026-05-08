# Admin Journey Editor — Implementation Plan

Owner: training infra · Status: planning · Last updated: 2026-05-08

This document is the living implementation plan for the Admin Journey Editor.
It is the source of truth for the audit, target architecture, micro-commit
sequence, and acceptance criteria. Update it as commits land.

## 1. Goal

Admins can create, edit, version, gate, assign, preview, publish, and roll
back interactive training journeys without breaking learner progress or
shipping invalid content.

## 2. Current-state audit

### 2.1 Tech stack
- Next.js 16 (App Router, Server Actions). React 18. TypeScript strict.
- Prisma 5 + PostgreSQL.
- Auth via `next-auth` 4 + `lib/auth-supabase.ts`.
- Validation via `zod` 3.
- Tests via `vitest` + `@playwright/test`. Plain CSS. `@dnd-kit` for reorder.

### 2.2 Data model already in place (`prisma/schema.prisma`)
- `TrainingModule` (1528) — top-level module; `contentKey`, `sortOrder`,
  `archivedAt`, `passScorePct`.
- `InteractiveJourney` (10620) — 1:1 with module; `estimatedMinutes`,
  `passScorePct`, `strictMode`, `version: Int @default(1)`.
  **No status / draft / published flag yet.**
- `InteractiveBeat` (10637) — `journeyId`, unique `sourceKey`, unique
  `sortOrder`, `kind` (12-value enum), `config: Json`, `schemaVersion`,
  `parentBeatId` (branching), `showWhen: Json?`, `removedAt`.
  **`@@unique([journeyId, sortOrder])` will block reordering — must change.**
- `InteractiveBeatAttempt` (10672), `InteractiveJourneyCompletion` (10694)
  keyed to `beatId` / `journeyId`. **Progress is bound to live beat rows**, so
  beats must not be deleted/replaced on republish.
- `InteractiveBeatKind` (10605): CONCEPT_REVEAL, SCENARIO_CHOICE, MULTI_SELECT,
  SORT_ORDER, MATCH_PAIRS, SPOT_THE_MISTAKE, FILL_IN_BLANK, BRANCHING_SCENARIO,
  REFLECTION, COMPARE, HOTSPOT, MESSAGE_COMPOSER — all 12 already have player
  components and Zod config/response schemas in `lib/training-journey/kinds/`.
- `Enrollment` (1513) ties user → module with `TrainingStatus`.

### 2.3 Beat infrastructure ready (`lib/training-journey/`)
- `kinds/*.ts` each export `{ configSchema, responseSchema, scorer }` —
  reused unchanged.
- `schemas.ts`, `scoring.ts`, `actions.ts` (server actions:
  `submitBeatAttempt`, `completeInteractiveJourney`, `resumeJourney`).
- `readiness.ts` already encodes Module 5 readiness logic — gates can hook
  into this.

### 2.4 Currently authored journeys (5)

Source of truth: `lib/training-curriculum/`. Imported via
`npm run training:import`.

| # | contentKey | Title | File |
|---|---|---|---|
| M1 | `academy_ypp_standard_001` | The YPP Standard | `lib/training-curriculum/ypp-standard.ts` |
| M2 | `academy_run_session_002` | Run a Great Session | `lib/training-curriculum/run-a-great-session.ts` |
| M3 | `academy_student_situations_003` | Student Situations | `lib/training-curriculum/student-situations.ts` |
| M4 | `academy_communication_004` | Communication & Reliability | `lib/training-curriculum/communication-reliability.ts` |
| M5 | `academy_readiness_check_005` | Readiness Check (gates LDS) | `lib/training-curriculum/readiness-check.ts` |

### 2.5 Admin surface
- `/app/(app)/admin/training/page.tsx` — module CRUD via `TrainingManager`,
  `@dnd-kit` reorder, learner-progress table.
- Server actions in `lib/training-actions.ts` gated by `requireAdmin()`.
- **No journey/beat editor exists.**

### 2.6 Roles
- `RoleType` (`prisma/schema.prisma:20`): ADMIN, INSTRUCTOR, STUDENT, MENTOR,
  CHAPTER_LEAD, CHAPTER_PRESIDENT, STAFF, PARENT, APPLICANT, HIRING_CHAIR.
- `AdminSubtype` includes `CONTENT_ADMIN`.
- Helpers: `lib/authorization.ts`, `lib/training-access.ts`.

### 2.7 Validation pattern
`'use server'` + `getSession()` + `requireAdmin()` + `zod.parse()` +
Prisma + `revalidatePath()`. No RHF — vanilla `<form action={...}>`.

### 2.8 Gaps
1. No journey draft/publish state.
2. No `JourneyVersion` / `PublishedSnapshot` table.
3. No gate/unlock-rule model.
4. No assignment-rule (auto-enroll by role) model.
5. No editor UI.

## 3. Target architecture

| Entity | Purpose |
|---|---|
| `Journey` | Stable identity (slug, title, role-targets, archive flag). |
| `JourneyVersion` | A draft or published revision: `status` (DRAFT/PUBLISHED/ARCHIVED), `versionNumber`, `publishedAt`, `publishedBy`, `notes`. |
| `Module` | Existing `TrainingModule`, unchanged. A published `JourneyVersion` may bind to one. |
| `InteractiveBeat` | Existing — beats become children of a `JourneyVersion` via new `journeyVersionId` FK. `journeyId` retained for backward compat. |
| `JourneyGate` | New: gates a beat/module on a precondition (`READINESS_CHECK`, `BEAT_COMPLETE`, `MODULE_COMPLETE`, `SCORE_THRESHOLD`). |
| `JourneyAssignmentRule` | New: maps `JourneyAudienceRole` → published Journey, with `autoEnroll`. |
| `LearnerProgress` | Existing `InteractiveBeatAttempt` + `InteractiveJourneyCompletion`, unchanged. Attempts are keyed by **beatId**, which now lives on a published `JourneyVersion` snapshot. |
| `AdminDraft` | A `JourneyVersion` with `status=DRAFT`. |
| `PublishedSnapshot` | A `JourneyVersion` with `status=PUBLISHED`. Beats are immutable inside the snapshot. |
| `JourneyAuditLog` | Append-only edit/publish/rollback log with actor + diff. |

**Why versioned snapshots**: `InteractiveBeat` rows carry attempts, so we
cannot mutate them on republish without orphaning progress. Each
`JourneyVersion` owns its own beats; learner progress points to the snapshot
they took, and old snapshots remain queryable forever.

## 4. Data-model plan

See §2 of this file for the new Prisma models. Migration strategy:

1. Add new tables + new columns nullable.
2. Backfill: for each `InteractiveJourney`, create one `Journey` + one
   `JourneyVersion` (PUBLISHED, v1) and copy beats' `journeyVersionId`.
3. Leave `journeyId` on beats untouched; both pointers coexist.

Versioning:
- Edit creates/uses a DRAFT version.
- Publish: validate → set `status=PUBLISHED`, increment `versionNumber`,
  demote prior PUBLISHED → ARCHIVED, all in one `prisma.$transaction`.
- Rollback: re-publish a prior ARCHIVED version (clones its beats into a new
  PUBLISHED snapshot).

Progress is preserved: republish never updates old beat rows; new beats
belong to the new version.

## 5. Admin UX plan

Routes under `app/(app)/admin/journeys/`:
- `/admin/journeys` — list of journeys (latest version status, audience).
- `/admin/journeys/[id]` — tabs: Overview / Beats / Gates / Assignments /
  Versions / Preview.
- `/admin/journeys/[id]/preview?version=draft|<id>` — sandboxed runtime.

Beat editor dispatches a kind-specific form derived from
`lib/training-journey/kinds/*` `configSchema`s. First wave: SORT_ORDER,
FILL_IN_BLANK, MATCH_PAIRS. Remaining 9 kinds added one-per-commit.

Validation panel (right rail) lists zod errors, missing fields, broken gate
refs, missing audience assignments. Publish disabled while errors exist.

## 6. Learner-runtime plan

- `lib/training-journey/resolve.ts` (new): given userId + moduleId, pick the
  currently PUBLISHED `JourneyVersion`. If learner has in-flight attempts on
  another version, keep them on it until completion.
- Existing `JourneyPlayer.tsx` keeps consuming `ClientBeat[]`; we change the
  data source to "beats of resolved version".
- Gates: resolver checks `JourneyGate` rules (Module 5 readiness via
  `readiness.ts`, beat completion via `InteractiveBeatAttempt`, module via
  `Enrollment.status`).
- Old completions resolve via `journeyVersionId` stored on the completion
  row.

## 7. Permission/security plan

- `requireJourneyEditor()` in `lib/authorization.ts`: ADMIN, ADMIN+CONTENT_ADMIN,
  STAFF (read-only).
- All `lib/journey-editor/actions.ts` calls start with `requireJourneyEditor()`
  and write a `JourneyAuditLog` row in the same Prisma transaction.
- `app/(app)/admin/journeys/layout.tsx` enforces the same gate.
- Publish rate-limited at 5/hour/user via existing `checkRateLimit()` in
  `lib/rate-limit-redis.ts`.

## 8. Validation plan

`lib/journey-editor/validation.ts`:
- Title min 3, slug `[a-z0-9-]+`.
- ≥1 non-removed beat per draft.
- Each beat's `config` parses cleanly via the kind's `configSchema`.
- `sourceKey` unique per draft; `sortOrder` strictly increasing per parent.
- `parentBeatId` references in-draft beats; no cycles.
- `JourneyGate.targetRef` / `requiredRef` resolve to existing draft beats /
  sibling modules.
- ≥1 `JourneyAssignmentRule` before publish.
- LDS-special-case: any LDS beat requires a `READINESS_CHECK` gate against
  `module:readiness-check`.

Unit tests in `lib/journey-editor/__tests__/validation.test.ts` cover one
test per rule plus a known-good fixture.

## 9. Micro-commit sequence

| # | Goal | Status |
|---|---|---|
| 0a | Remove legacy WORKSHOP/SCENARIO_PRACTICE seed modules from `prisma/seed.ts` | ✅ landed |
| 0b | Idempotent archive script for legacy modules already in DBs | ✅ landed |
| 1 | Audit + plan doc (this file) and `lib/journey-editor/types.ts` stub | ✅ landed |
| 2 | Prisma additions: Journey/JourneyVersion/JourneyGate/JourneyAssignmentRule/JourneyAuditLog + backfill migration | ⏳ next |
| 3 | `lib/journey-editor/validation.ts` + vitest unit tests | ⏳ |
| 4 | Sample-journey fixture + `prisma/seed.journey-editor.ts` | ⏳ |
| 5 | `/admin/journeys` list page | ⏳ |
| 6 | Journey detail/editor shell + `updateJourneyMeta` | ⏳ |
| 7 | Beats tab: reorder + add/remove (soft) | ⏳ |
| 8 | Beat editors for SORT_ORDER, FILL_IN_BLANK, MATCH_PAIRS | ⏳ |
| 9 | Gate builder | ⏳ |
| 10 | Preview as learner (`previewMode` prop on `JourneyPlayer`) | ⏳ |
| 11 | Publish + rollback flow | ⏳ |
| 12 | Runtime resolver behind `JOURNEY_VERSIONS_ENABLED` flag | ⏳ |
| 13 | Auto-enroll by audience + mid-flight version protection | ⏳ |
| 14 | Permission hardening + role matrix tests | ⏳ |
| 15 | QA polish + admin guide | ⏳ |
| 16 | Delete legacy admin authoring chain (after editor stable) | ⏳ |
| 17 | Drop unused Prisma models / columns | ⏳ |

Each commit must satisfy:
- one focused diff, independently revertable
- `npx tsc --noEmit` clean (and `npm run lint`, `npm run test` once
  node_modules is available in CI)
- updated entry in this file's table

## 10. Rollback paths

| Scope | Path |
|---|---|
| Any commit before Commit 12 lands | `git revert <sha>`; nothing else needed. |
| Commits 12–13 (runtime resolver) | Flip `JOURNEY_VERSIONS_ENABLED=false` env var; resolver falls back to legacy `InteractiveJourney` reads. |
| Bad publish | Use Versions tab → "Restore" on a prior PUBLISHED version (creates a new PUBLISHED snapshot from that version's beats). |
| Catastrophic data issue | `JourneyAuditLog.diff` JSON contains every prior state; replay manually. |
