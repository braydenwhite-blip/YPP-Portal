# Action System 4.0 — Delivered

> Companion to `docs/ACTION_SYSTEM_4.0_AUDIT.md`. Records what shipped in this
> pass: the honest data contract that unblocked action creation, the pure tested
> derivation layer, and the creation / detail / inbox / meeting-conversion
> surfaces wired on top of it.

The Strategic Initiatives 3.5 pass deliberately left action **creation**
untouched because actions had no honest way to record where they came from or
which strategic project/initiative they served. This pass builds that contract
and the execution layer on it — **additively, backwards-compatibly, and with no
fake links**.

---

## 1. Data contract changes (Phase B)

New **nullable, additive** columns on `ActionItem`
(`prisma/migrations/20260609120000_add_action_system_4_contract/`):

| Column | Purpose |
| --- | --- |
| `sourceType` | Honest provenance (`MANUAL / MEETING / MEETING_DECISION / PROJECT / INITIATIVE / ENTITY / WEEKLY_REVIEW / COMMAND_CENTER / FOLLOW_UP`) |
| `sourceId` | Fine-grained source id (decision id, registry id, …) |
| `sourceActionId` | Self-relation FK → parent action (follow-up chains) |
| `strategicInitiativeId` / `strategicProjectId` | **Explicit, registry-validated** strategic link |
| `successDefinition` | Definition of done |
| `blockedReason` | Why an action is BLOCKED |
| `completionNote` / `completionOutcome` | Captured on completion (`DELIVERED / PARTIAL / SUPERSEDED / ABANDONED`) |
| `nextFollowUpAt` | Next revisit date |

- Migration is idempotent (`ADD COLUMN IF NOT EXISTS`, `DO $$` FK guard,
  `CREATE INDEX IF NOT EXISTS`) — matches the repo convention; safe to re-run.
- Initiatives/projects are **config registries** (stable string ids), so the
  strategic link is a **validated string** (mirroring `relatedEntityType`), not
  a Postgres FK. Validated against `getInitiativeDef` / `getProjectDef`.
- Create/update server actions persist every field; the query layer returns them
  automatically (the `ACTION_ITEM_INCLUDE` `include` covers new scalars).
- **Backwards compatible:** all columns nullable, no backfill. Legacy rows
  normalize to a derived source (`deriveActionSource`) and resolve no strategic
  link unless one is stored.

---

## 2. New lib modules (all pure; `now` injected)

| Module | What it provides |
| --- | --- |
| `lib/people-strategy/action-source.ts` | Source vocabulary + labels/headers; `parseActionSourceType`, `parseStrategicLink(Update)` (registry-validated, project↔initiative consistency), `parseActionCompletionOutcome`; read normalizers `deriveActionSource`, `deriveActionSourceLabel`, `deriveActionStrategicLinkage` (explicit-vs-inferred honesty) |
| `lib/people-strategy/action-quality.ts` | Dependency-free `deriveActionQualityWarnings` + `isVagueTitle` (client-safe; the creation form imports it directly) |
| `lib/people-strategy/action-intel.ts` | `deriveActionUrgency`, `deriveActionQualityLabels`, `deriveActionNextMove`, `rankActionAttention`, `deriveActionInboxGroups`, `deriveActionFastestWins`, `deriveActionStaleGroup`, `deriveActionSourceGroups`, `actionToQualityInput` — reusing the canonical attention/stale/overdue primitives |
| `lib/people-strategy/action-operations-intel.ts` | `deriveMeetingFollowUpPack`, `deriveMeetingDecisionsWithoutActions`, `deriveWeeklyActionReview`, `deriveCommandCenterActionQueue`, `deriveActionAccountabilitySummary`, `deriveEntityActionPanel` |

Extended: `action-prefill.ts` (honest context params + `actionPrefillFromQuery` +
`buildActionPrefillFromFollowUp`); `command-center-selectors.ts` (export
`lastActivityAt`).

---

## 3. New components

| Component | Surface |
| --- | --- |
| `components/people-strategy/action-intel-panel.tsx` | Action detail "mini command center" — what-matters-now + quality labels + honest source provenance + explicit strategic link |
| `components/people-strategy/action-inbox-groups.tsx` | Operational inbox — ranked triage lenses on `/actions/all` |

Extended: `action-item-form.tsx` (definition-of-done field, live quality
warnings, smart context-aware CTA, source/strategic context chips, suggested
owner).

---

## 4. Routes / server actions touched

- `app/(app)/actions/new/page.tsx` — parses + validates honest context, renders a
  context-aware header, passes source/strategic/owner/success to the form.
- `app/(app)/actions/[id]/page.tsx` — renders `ActionIntelPanel`.
- `app/(app)/actions/all/page.tsx` — renders `ActionInboxGroups`.
- `lib/people-strategy/action-items-actions.ts` — create/update persist the
  contract; `createActionItem` guards the follow-up parent FK.
- `lib/people-strategy/meetings-actions.ts` — `convertDecisionToAction` records
  `MEETING_DECISION` provenance + decision id + seeded definition of done +
  meeting-chosen owner.
- `strategic-recommendations.ts` / `strategic-project-summary.ts` — initiative /
  project "Create action" CTAs now store an **explicit** registry link.

---

## 5. Tests added (pure-lib + component)

- `tests/lib/people-strategy-action-source.test.ts` (28)
- `tests/lib/people-strategy-action-intel.test.ts` (27)
- `tests/lib/people-strategy-action-operations-intel.test.ts` (9)
- `tests/lib/people-strategy-action-prefill-4.test.ts` (8)
- `tests/components/action-item-form.test.tsx` (3)
- `tests/components/action-intel-panel.test.tsx` (2)
- `tests/components/action-inbox-groups.test.tsx` (2)
- extended `tests/lib/people-strategy-meetings-actions.test.ts` (provenance assertion)

All new derivation logic is pure and tested; legacy-action compatibility is
covered (inferred source, no-link normalization, graceful unknown-id decay).

---

## 6. Validation

- `npm run typecheck` — clean (exit 0) after every commit.
- New + adjacent suites green; existing People-Strategy suites unchanged.
- See the final report for full counts + commands.

---

## 7. Known limitations / next recommended pass

The honest contract + pure derivations for these surfaces are **delivered and
tested**; wiring their UI is the natural next increment:

1. **Entity Action Operating Panel** (`deriveEntityActionPanel`) — wire into
   Person / Partner / Class / Instructor / Mentorship detail pages.
2. **Weekly Review** (`deriveWeeklyActionReview`) + **Command Center**
   (`deriveCommandCenterActionQueue`, `deriveActionAccountabilitySummary`) —
   render the action-aware sections.
3. **Meeting Follow-Up Pack** (`deriveMeetingFollowUpPack`) — render on the
   meeting detail page; add a "Create follow-up" CTA from action detail using
   `buildActionPrefillFromFollowUp`.
4. **Structured completion/blocker capture** in the detail card (the columns +
   server-action support exist; the form fields can be surfaced inline).
5. **Backfill** legacy `officerMeetingId` rows to an explicit `sourceType` if a
   one-time normalization is desired (not required — inference covers reads).
