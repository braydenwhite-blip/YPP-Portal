# N1 — Student Operating System: Verification Report

Phase **N1** built the **Growth Engine** — the unified Student Operating System that turns
"many disconnected features" into "one journey where every action contributes toward meaningful
growth." This report records what shipped, how it was verified, and how to turn it on.

> Design: `docs/student-os/N1-STUDENT-OPERATING-SYSTEM.md`. Flag: `ENABLE_GROWTH_OS` (default **off**).

---

## 1. What shipped (by disciplined slice)

| Slice | Commit | Contents |
|---|---|---|
| 1 — Architecture | `docs(student-os)` | The N1 design doc (committed first). |
| 2 — Schema | `slice 2` | 8 additive `Growth*` models + 2 enums + hand-written idempotent migration; `ENABLE_GROWTH_OS`. |
| 3 — Engine | `slice 3` | Pure, IO-free `lib/growth/{constants,events,hierarchy,achievements,opportunities,profile,tracks}.ts` + 60 unit tests. |
| 4 — Events | `slice 4` | `emit.ts` (flag-gated, idempotent ingress) + `recompute.ts` (idempotent fold-forward) + `queries.ts`. |
| 5 — Dashboards | `slice 5` | `getMyGrowthView` / `getGrowthAdminOverview`, `/my-growth` + `/admin/growth`, student server actions, flag-gated nav. |
| 6 — Integrations | `slice 6` | M2 bridge → hierarchy seeding, `MENTOR_MATCHED` / `MENTORSHIP_COMPLETED` hooks wired, domain hook API, backfill. |
| 7 — Verification | `slice 7` | This report + env/README docs. |

### Data model (additive only)

`GrowthProfile`, `GrowthVision`, `GrowthGoal`, `GrowthMilestone`, `GrowthAction`,
`GrowthAchievement`, `GrowthOpportunity`, `GrowthProgressEvent`; enums `GrowthTrack`,
`GrowthObjectiveStatus`. The only change to existing tables is `User` back-relations (no column
or semantic changes anywhere else).

### Engine (deterministic, explainable, unit-tested)

- **Hierarchy** — Vision → Goal → Milestone → Action rollup math.
- **Achievements** — a code registry where every achievement connects to a growth dimension
  (leadership / impact / teaching / mentorship / project / chapter / community); `evaluateAchievements`
  + `nextAchievements` answer "what did I accomplish?" and "what can I unlock next?".
- **Opportunities** — ordered, scored, deterministic rules; **every recommendation carries its
  WHY** (`reason`), is reproducible, and is never re-suggested once dismissed.
- **Profile** — additive signal derivation + the "who you're becoming" line.
- **Tracks** — unifies instructor / leadership / chapter / hiring onto one model, reusing the
  existing `lib/growth-pathway` role ladders (no forked definition).

### Event-driven design

`emitGrowthEvent` is the single ingress future systems use — a no-op unless `ENABLE_GROWTH_OS`,
idempotent on `(userId, dedupeKey)`, best-effort, and self-healing (each emit triggers an
idempotent recompute). Domain hooks in `lib/growth/integrations.ts` keep call sites one-liners.

---

## 2. Verification

### Type safety
`tsc --noEmit` (project config) — **0 errors** across the whole repo after every slice.

### Unit tests (deterministic core)
`vitest run tests/lib/growth/` — **67 tests, all green** across 9 files (constants, events,
hierarchy, achievements, opportunities, profile, tracks, mentorship-plan, nav-gating). Every
achievement award, every opportunity rule + its WHY, every rollup number, the profile
derivation, the bridge→hierarchy mapping, and the dark-launch nav gating are covered with fixed
inputs and fixed expected outputs.

### Migration (real Postgres 16, `pg_virtualenv`)
The hand-written migration was applied **twice** on a throwaway database: it is valid DDL,
**idempotent** (second apply is a clean no-op), and produces exactly the declared 8 tables,
2 enums, 13 foreign keys, and unique indexes.

### End-to-end server flow (real Postgres, `prisma db push`)
- **Emit/recompute:** flag-off no-op; flag-on records events; duplicate `sourceId` is idempotent
  (1 event); achievements awarded; profile counters + confidence areas updated; opportunities
  reconciled — **a dismissed opportunity stays dismissed and is never re-suggested**, new ones
  appear.
- **Mentorship integration:** an approved match seeds **3 goals / 2 milestones / 3 actions**
  (track `MENTORSHIP`) from the M2 bridge, awards `mentor_matched`, suggests
  `advance_mentorship_action` (with its WHY), is **idempotent** on re-run, and completion awards
  `mentorship_graduate`.

### Regression check
The full suite (`vitest run`) shows **6 failing files / 13 failing tests** — all confirmed
**pre-existing** by running the identical files against `origin/main` in a clean worktree (same
6 files, same 13 tests fail there). They are unrelated domains (MotionProvider/RecoveryPrompt,
summer-workshop schema, journey-editor validation, chair-queue routing, onboarding steps) plus
`page-helper-coverage` (a registry already stale by 60+ unrelated routes). **N1 introduced zero
new test failures.** `nav:check` is likewise red on `main` for unrelated core-map link counts.

---

## 3. How to turn it on

1. Set `ENABLE_GROWTH_OS=true` (see `.env.example` / README env table).
2. (Optional) Seed history: `ENABLE_GROWTH_OS=true npx tsx scripts/backfill-growth-os.ts`.
3. Students/instructors see **My Growth** in the Progress nav group; admins/leadership get
   `/admin/growth`. With the flag off, every surface is hidden/`notFound()` and emits are no-ops.

---

## 4. Follow-ups (intentionally out of N1 scope)

- Wire the remaining domain emit sites (class publish/complete, chapter join/event, certificate,
  leadership role) — the hooks already exist in `lib/growth/integrations.ts`; only the call-site
  one-liners remain.
- Visions are modeled and rendered; a richer vision/goal editor (beyond the current quick-add)
  can layer on later.
- Deeper `/admin/growth` analytics (cohorts, funnels) on top of the foundation aggregates.

— End of N1 verification report.
