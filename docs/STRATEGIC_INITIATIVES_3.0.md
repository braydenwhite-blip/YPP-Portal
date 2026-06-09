# Strategic Initiatives 3.0 — Project Operating Layer + Touchpoint Timeline + Command Center

> Extends Strategic Initiatives 2.0 (`docs/STRATEGIC_INITIATIVES.md`). **Pure derivation, no
> schema migration.** Everything below is derived from real actions, meetings, decisions,
> milestones, ownership, and target dates — or declared as intentional strategic config.

## Why 3.0

2.0 gave leadership a strong *strategic dossier*: initiatives → workstreams → milestones,
with derived health, momentum, risk, a decision center, roadmaps, scenarios, dependencies,
operating reviews, and a portfolio. 3.0 makes it an *operating system* by adding the unit
leadership actually runs week to week — the **Strategic Project** — and a real
**Touchpoint Timeline** that stitches meetings, actions, decisions, and partner touchpoints
into one explainable history, wired into the Command Center and entity pages.

The new spine: **Initiative → Strategic Project → Workstream → Milestone → Decision → Meeting → Action → Touchpoint → Outcome.**

## Terminology decision: "Touchpoint", not "CT"

The repo's only use of `CT` is the timezone label *Central Time*. It has **no** strategic
meaning, so 3.0 uses the generic product language **Touchpoint**. This aligns with the
existing Partner pipeline, which already records *touchpoints* (`PartnerNote` kinds
`FOLLOW_UP` / `MEETING` / `OUTCOME` / `STAGE_CHANGE`). The timeline engine normalizes those
existing sources rather than inventing new ones.

## Architecture (how it stays pure)

A **Strategic Project** is *config* — like an initiative or a workstream — that declares a
parent initiative, related workstreams, a charter (purpose / outcome / scope / assumptions /
what-could-kill-it), an owner when known, a priority, and a deterministic `InitiativeMatch`.
The derivation layer classifies the parent initiative's already-matched pool down into the
project and runs the **same** 2.0 health / momentum / risk / ownership / progress engines on
that subset. No second source of truth, no duplicate entry, no migration. When no real work
matches, the project shows graceful, honest empty states.

### New pure modules (`lib/people-strategy/`)
- `strategic-projects.ts` — `StrategicProjectDef`, `ProjectCharter`, the seeded registry.
- `strategic-project-registry.ts` — accessors (by id, by initiative, by workstream).
- `strategic-project-health.ts` — confidence, blocker severity (declared vs observed),
  action / decision / meeting follow-through, review-need, status explanation.
- `strategic-project-summary.ts` — `ProjectSummary` + `classifyProjectWork` +
  `deriveProjectSummary` + `deriveProjectDossier` + portfolio selectors/stats.
- `strategic-touchpoint-timeline.ts` — the normalization engine (Phase E): one
  `TouchpointEvent` shape + grouping (past / recent / current / upcoming / overdue-blocked) +
  follow-up / stale / overdue status + importance, from meetings, actions, decisions,
  partner touchpoints, milestones, follow-ups.
- `strategic-project-timeline.ts` — project-scoped grouped timeline (built on the engine).
- `strategic-project-queries.ts` — batched reads (reuse `loadDigestInputs`), the Command
  Center "Strategic Command" read, and entity/initiative project lookups.

### New components (`components/people-strategy/`)
- `strategic-projects.tsx` — project cards, brief, execution spine, action/decision/meeting
  intelligence, review card, dependency panel, stat strip, badges.
- `touchpoint-timeline.tsx` — grouped timeline view + embeddable entity timeline.
- `strategic-command.tsx` — the leadership cockpit section for the Command Center.

### New routes
- `/operations/projects` — project portfolio / index.
- `/operations/projects/[projectId]` — project command center.

### Integrations
- **Command Center** — adds a "Strategic Command" cockpit.
- **Portfolio** — adds a project board.
- **Initiative detail** — adds a "Strategic projects" section.
- **Weekly Review** — adds a strategic review step (initiative + project + decision queues).
- **Entity pages** — small "Related strategic projects" sections via the project matcher.
- **Action creation** — `buildProjectActionPrefill` (goalCategory + keyword, no migration).

## Data honesty rules (Phase L)
- A project with no matched work says so (`dataState: "no_work"`), it is not "healthy".
- A blocker is labelled **declared** (config dependency) vs **observed** (overdue/blocked work).
- A decision with no linked action is shown as needing follow-through, not hidden.
- "Not started", "unknown", and "healthy" are distinct reads.

## How to add a project
Add a `StrategicProjectDef` to `STRATEGIC_PROJECTS` in `lib/people-strategy/strategic-projects.ts`:
its `initiativeId` must reference a real initiative; `relatedWorkstreamIds` must reference that
initiative's workstreams; `match` reuses the keyword/area/actionType vocabulary so it classifies
real work. Fill the charter for the brief. No DB change, reviewable in a PR.

## Testing
Pure unit tests for the registry, health, summary/portfolio, project timeline, touchpoint
normalization, and the command queue; component tests for the index, detail panels, command
section, portfolio board, and timeline rendering. All 2.0 tests stay green.
