# Training Curriculum Import — Verification & Handoff

Status snapshot for the M2/M3/M4/M5 interactive-journey curriculum rebuild on
branch `claude/ypp-instruc-hhfZz`.

## Branch & commits verified

- Branch: `claude/ypp-instruc-hhfZz`
- Commits in scope:
  - `83711f5` — Add Module 3 (Student Situations) compact authoring file
  - `a3dd787` — Register training curriculum modules (M2, M3, M4 added to `lib/training-curriculum/index.ts`)
  - `3a54770` — Fix training journey TypeScript blockers (`lib/training-journey/actions.ts`)
  - `d797465` — Verify training curriculum import readiness (verification doc + read-only verify script)
  - (this branch tip) — Add readiness check training curriculum (`lib/training-curriculum/readiness-check.ts`, M5 registered)

## Code-side verification (no DB required)

| Check                                  | Command                                  | Result                                    |
| -------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| Strict TypeScript                      | `npx tsc --noEmit -p tsconfig.json`      | exit 0, no errors                         |
| Project typecheck                      | `npm run typecheck`                      | exit 0                                    |
| Curriculum + legacy JSON validators    | `npm run training:validate`              | 5 curricula validated                     |

Validator output also surfaces six pre-existing legacy JSON warnings on
`data/training-academy/content.v1.json` (quiz < 4 questions and required
modules with < 3 checkpoints). These are warnings, not errors, and are
unchanged by this work.

## Required environment variables

The importer (`tsx scripts/import-training-academy-content.mjs`) instantiates
a `PrismaClient`, so the DB must be reachable even for `--dry-run`.

- `DATABASE_URL` — Postgres pooled URL (Prisma datasource)
- `DIRECT_URL`   — Postgres direct URL (Prisma migrations / advisory lock)

Sample shapes are in `.env.example`. In the verification environment used for
this report, both vars were **missing**, so the DB-touching phases were
deferred to handoff (this document).

## DB-touching steps (run in DB-enabled environment)

Execute on a branch checkout of `claude/ypp-instruc-hhfZz` with `DATABASE_URL`
and `DIRECT_URL` set.

1. Sanity:
   ```bash
   git checkout claude/ypp-instruc-hhfZz
   git pull --ff-only
   npm install
   npx tsc --noEmit -p tsconfig.json
   npm run training:validate
   ```

2. Dry-run import (no writes):
   ```bash
   npm run training:import -- --dry-run
   ```
   Expected output highlights:
   - Connects to DB without error.
   - Legacy JSON pass: warnings as listed above; no errors.
   - Curriculum registry pass logs `[dry-run] Would upsert curriculum: <contentKey>` for:
     - `academy_ypp_standard_001`
     - `academy_run_session_002`
     - `academy_student_situations_003`
     - `academy_communication_004`
     - `academy_readiness_check_005`
   - Curriculum summary counters reflect `journeysCreated >= 1` and
     `beatsCreated` covering all flat beats. (For first-time imports this is
     the total beat count; for re-imports the importer reuses existing
     journeys/beats by `sourceKey`.)
   - **Do not proceed** if you see: connection errors, schema mismatches,
     unexpected deletes, or any of M2/M3/M4 missing from the dry-run log.

3. Real import (no prune):
   ```bash
   npm run training:import
   ```
   `--prune` is intentionally omitted; pruning should only be used after a
   subsequent clean re-run has confirmed the upsert is stable.

4. Post-import validators:
   ```bash
   npm run training:validate
   npx tsc --noEmit -p tsconfig.json
   ```

5. Read-only DB verification:
   ```bash
   npm run training:verify
   ```
   Implemented in `scripts/verify-training-curriculum-import.mjs` (added on
   this branch). The script only reads. It checks, per curriculum:
   - `TrainingModule` exists with `type=INTERACTIVE_JOURNEY` and matching
     `contentKey`.
   - `InteractiveJourney` is attached.
   - Top-level `InteractiveBeat` count (rows with `parentBeatId IS NULL` and
     `removedAt IS NULL`) matches the authored count in the registry.
   - All authored `kind` values appear in the DB.
   - Journey is non-empty.

   Expected pass criteria after the real import:

   | contentKey                          | Top-level beats | Notable kinds                                                                                  |
   | ----------------------------------- | --------------- | ---------------------------------------------------------------------------------------------- |
   | `academy_ypp_standard_001`          | (per M1 source) | (per M1 source)                                                                                |
   | `academy_run_session_002`           | 9               | CONCEPT_REVEAL, SORT_ORDER, SCENARIO_CHOICE, FILL_IN_BLANK, COMPARE, REFLECTION                |
   | `academy_student_situations_003`    | 8               | CONCEPT_REVEAL, MULTI_SELECT, BRANCHING_SCENARIO, SORT_ORDER, MESSAGE_COMPOSER                 |
   | `academy_communication_004`         | 7               | MULTI_SELECT, MESSAGE_COMPOSER, SCENARIO_CHOICE, SPOT_THE_MISTAKE, CONCEPT_REVEAL              |
   | `academy_readiness_check_005`       | 10              | CONCEPT_REVEAL, MULTI_SELECT, SORT_ORDER, MATCH_PAIRS, BRANCHING_SCENARIO, MESSAGE_COMPOSER, FILL_IN_BLANK |

   The script computes the expected counts dynamically from
   `lib/training-curriculum/index.ts`, so future curriculum changes do not
   require editing it.

## App-readiness

- Runtime journey loading goes through `lib/training-journey/actions.ts` and
  the journey page under `app/(app)/training/[id]/`. These read from the DB
  by `moduleId` and do not depend on the registry export at request time —
  the registry is import-time only.
- After a successful import, M2/M3/M4/M5 will appear in the academy module
  list and be loadable via the existing `[id]` route as soon as their
  `TrainingModule` rows exist with `type=INTERACTIVE_JOURNEY`. M5
  (`Readiness Check`) is authored with `strictMode: true`, so the player
  enforces single-attempt scoring per beat for that journey.
- The instructor-training hub (`app/(app)/instructor-training/page.tsx`) now
  visually locks the Lesson Design Studio kanban card until the user's
  `academy_readiness_check_005` assignment status is `COMPLETE`. While
  locked, the card shows a "Locked — pass Readiness Check first" pill and a
  disabled button instead of the "Open Studio" link. If the Readiness Check
  module hasn't been imported yet, the card stays unlocked (legacy
  behavior), so the gate only takes effect after the M5 import lands in DB.
- `npm run build` was not executed in the verification environment (env vars
  missing, Next.js build is expensive). `tsc --noEmit` is green for the whole
  project.

## Known warnings

- Legacy JSON content emits the same six pre-existing validator warnings.
  Not blocking.
- `tsconfig.json` `baseUrl` deprecation notice (TS5101). Non-blocking until
  TypeScript 7.0.
- Two pre-existing TypeScript errors in `lib/training-journey/actions.ts` were
  fixed on commit `3a54770` (null-narrowing for `typeof journey` and the
  missing `response` field on `JourneyAttemptSummary`).

## Remaining risks

- DB import has not been executed in this verification pass. The first real
  import in a DB-enabled environment is the next gate.
- `--prune` is deliberately not yet exercised. After a clean second import
  shows no churn, an admin may opt into `--prune` to remove modules that no
  longer correspond to a `contentKey` in the registry.
- The `training:verify` script has not been runtime-exercised against a real
  DB in this pass. It is a small Prisma read-only script; review the source
  before first use.

## Lesson Design Studio Capstone Gate

The Readiness Check (M5) gates entry into the Lesson Design Studio capstone.
The gate is enforced both client-visibly on the hub and server-side on the
LDS route.

### Source of truth

- M5 `contentKey`: `academy_readiness_check_005`
- Helper: `lib/lesson-design-studio-gate.ts`
  - `getLessonDesignStudioGateStatus(userId, roles)` — async DB-backed check.
  - `evaluateLessonDesignStudioGateFromAssignment({ roles, readinessCheckModuleId, readinessCheckAssignmentStatus })`
    — pure function for callers (e.g. the hub) that already loaded the data.

### Behavior

| Condition                                         | Gate           | Reason                          |
| ------------------------------------------------- | -------------- | ------------------------------- |
| Caller has role `ADMIN` or `CHAPTER_PRESIDENT`    | unlocked       | `REVIEWER_BYPASS`               |
| M5 `TrainingModule` row not present in DB         | unlocked       | `READINESS_CHECK_NOT_IMPORTED`  |
| M5 row present, user assignment `status=COMPLETE` | unlocked       | `READY`                         |
| M5 row present, any other assignment state        | locked         | `READINESS_CHECK_REQUIRED`      |

### Where the gate is wired

- **Hub card** (`app/(app)/instructor-training/page.tsx`):
  - Lesson Design Studio `KanbanCard` renders dimmed with a
    "Complete Readiness Check to unlock" pill while locked.
  - When the M5 row is known, the locked card's CTA deep-links to
    `/training/<m5ModuleId>` so the user can start the Readiness Check
    immediately.
  - When the page is visited with `?locked=lesson-design-studio` and the
    user is still locked, a banner appears at the top of the hub.
- **LDS server pages** (hard gate):
  - `app/(app)/instructor/lesson-design-studio/page.tsx`
  - `app/(app)/instructor/lesson-design-studio/[draftId]/[step]/page.tsx`
  - Both call `getLessonDesignStudioGateStatus` after the existing role
    check. If locked, they `redirect("/instructor-training?locked=lesson-design-studio")`.
- **Reviewer roles** (`ADMIN`, `CHAPTER_PRESIDENT`) bypass the gate
  everywhere.

### Tests

`tests/lib/lesson-design-studio-gate.test.ts` covers all six gate states
plus admin short-circuit. Run with `npm test -- tests/lib/lesson-design-studio-gate.test.ts`.

### Manual QA checklist

After importing the curriculum into a DB-enabled environment and clicking
through M5:

1. **Pre-M5 DB row absent**: with no `TrainingModule` row for
   `academy_readiness_check_005`, an instructor can open `/instructor/lesson-design-studio`
   and see the LDS card unlocked on the hub. (Backward compatibility.)
2. **M5 imported, instructor has not passed**: the LDS card shows the
   locked pill and an "Open Readiness Check" CTA. Direct navigation to
   `/instructor/lesson-design-studio` redirects to
   `/instructor-training?locked=lesson-design-studio`, which renders the
   locked banner.
3. **Instructor completes M5** (`InteractiveJourneyCompletion.passed=true` →
   `TrainingAssignment.status=COMPLETE`): hub card unlocks, "Open Studio"
   CTA returns, direct LDS URL works.
4. **Reviewer roles** (`ADMIN`, `CHAPTER_PRESIDENT`): the gate never engages
   regardless of M5 status.
5. **No regressions**: M2/M3/M4 journeys still load via `/training/[id]` and
   `npm run training:validate` still reports 5 curricula.

### Reminder

The hard gate only takes effect after `npm run training:import` lands the M5
row in the DB. Until then, every user keeps the legacy unlocked behavior.
This must still be run in a DB-enabled environment with `DATABASE_URL` and
`DIRECT_URL` set.

## Next recommended phase chunk

In a DB-enabled environment:
1. Run the steps under "DB-touching steps" above.
2. If `training:verify` reports OK for all five curricula, hand off to QA to
   click through M2/M3/M4/M5 in the app and confirm beat rendering for each
   new beat kind (`BRANCHING_SCENARIO`, `MESSAGE_COMPOSER`, `SORT_ORDER`,
   `MATCH_PAIRS`, `MULTI_SELECT`, `SCENARIO_CHOICE`, `SPOT_THE_MISTAKE`,
   `FILL_IN_BLANK`, `COMPARE`, `REFLECTION`, `CONCEPT_REVEAL`). Pay
   particular attention to M5's strict-mode behavior (no per-beat retry).
3. Only then consider a `--prune` re-import to clean up stale modules.
