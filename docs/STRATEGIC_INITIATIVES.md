# YPP Execution OS — Strategic Initiatives, Program Intelligence & the Organizational Timeline (Phase II)

The **Strategic Initiatives** layer sits *above* the Execution OS (Command
Center + Weekly Review), which itself sits above the Action Tracker and Meetings
Tracker. The previous pass made the portal **alive** at the operational level
(what's urgent / stuck / due this week). This layer makes it **strategic**: a
YPP leader opens it and instantly understands *what the organization is trying
to accomplish*, *how every major initiative is progressing*, *where execution is
breaking down*, *what happened across an initiative*, and *what should happen
next* — across goals, programs, campaigns, and expansions, not just tasks.

```
Goal → Initiative → Milestone → Meeting → Decision → Action → Outcome → Timeline → Learning
```

It introduces **no new task system, no new meeting system, and no new database
table**. Initiatives are *config*; everything else is *derived* from the
existing `ActionItem` / `OfficerMeeting` / `Decision` data via the operational
context layer. Gated behind `ENABLE_STRATEGIC_INITIATIVES` **and**
`ENABLE_OPERATIONS_HUB` **and** `ENABLE_ACTION_TRACKER`, officer-tier and above
(`requireOfficer()`).

## The core design decision: config + derivation, never a migration

A strategic initiative (Summer Camps 2026, Instructor Growth, …) is a **curated,
version-controlled config entry** in
[`lib/people-strategy/strategic-initiatives.ts`](../lib/people-strategy/strategic-initiatives.ts),
exactly like the `MeetingCategory` and `ActionType` controlled vocabularies. It
carries **no copy of its work**. Instead it declares a deterministic
`InitiativeMatch` — a set of signals — and the derivation layer **classifies**
the already-loaded actions / meetings / decisions into the initiatives they
match.

This is a direct application of the non-negotiable rules:

- **Prefer derivation over persistence / avoid migrations.** No schema change, no
  `StrategicInitiative` table, no backfill. Adding an initiative is a one-file PR.
- **Prefer deterministic aggregation / avoid duplicate manual entry.** Health,
  momentum, progress, risk, milestones, timeline, and recommendations are all
  computed from real system state — nobody re-enters work against an initiative.
- **No fake analytics, no AI guesses.** Every number is a pure function of signal
  counts; every match, score, timeline event, and recommendation is explainable.
- **No duplicate command systems.** The query layer **reuses** the exact Command
  Center batched read (`loadDigestInputs`) — one source of truth, no N+1.

## Routes

| Route | What it is |
| --- | --- |
| `/operations/initiatives` | **Strategic Initiatives index** — the portfolio: stats, "needs attention", and a card per initiative with derived health, momentum, progress, and the next move. |
| `/operations/initiatives/[initiativeId]` | **Initiative command center** (the 10× detail page) — executive summary, milestones, the strategic timeline, recommended next moves, risk, ownership, and related entities. |
| `/operations/strategic-map` | **Strategic Map** — YPP → areas → initiatives → milestones, each node with rolled-up health/progress, click-through to any command center. |

The Command Center (`/operations/command-center`) also grows a **Strategic
Initiatives** section (initiatives needing attention, fastest moving, recently
completed + upcoming milestones, strategic risks, leadership priorities), shown
only when the flag is on.

## How it connects

```
actions ──┐
meetings ─┼─▶ loadDigestInputs (the SAME batched read the Command Center uses)
decisions ┘        │
                   ▼
        classifyInitiativeWork  (matchesInitiative — deterministic, explainable)
                   │   per initiative
                   ▼
        deriveInitiativeSummary  (the brain)
            ├─ computeInitiativeWorkSignals        (raw counts)
            ├─ deriveInitiativeMilestones          (Phase D)
            ├─ deriveInitiative{Progress,Momentum,Risk,Ownership,Health}  (Phase E)
            ├─ deriveStrategicTimeline             (Phase C)
            └─ deriveInitiativeRecommendations     (Phase I)
                   │
        ┌──────────┼───────────────┬───────────────┐
        ▼          ▼               ▼               ▼
   Index page  Detail page   Strategic Map   Command Center section
                            (deriveStrategicMap, Phase G)
```

## The matcher (Phase A)

`InitiativeMatch` declares any of: `areas`, `actionTypes`, `entityTypes`,
`entityRefs`, `goalCategories`, `keywords`. An item matches when it fires **at
least one** signal (OR semantics), and the matcher records **which** signals
fired so membership is always explainable. Signal strength:

| Strength | Signals | Weight | Why |
| --- | --- | --- | --- |
| STRONG | `goalCategories`, `entityRefs` | 3 | explicit author intent (the action's own `goalCategory`, or a directly linked entity) |
| MEDIUM | `keywords`, `actionTypes` | 2 | strong textual / kind signal |
| CONTEXT | `entityTypes`, `areas` | 1 | the broad neighbourhood |

`matchesInitiative` adds a **dilution guard**: a contextual-only hit (e.g. "this
is a CLASSES action") does **not** pull an item into an initiative that declares
stronger signals — so a keyword-driven initiative is never swamped by every
action that merely shares its area. An item *can* belong to several initiatives
(work genuinely serving two goals counts in both) — honest, not noise.

`ActionItem.goalCategory` ("the goal this action ladders up to") is the strongest
signal, and the "+ New action" CTAs prefill it (`buildInitiativeActionPrefill`)
so newly created work automatically rejoins its initiative.

## Program intelligence (Phase E)

All in [`strategic-initiative-health.ts`](../lib/people-strategy/strategic-initiative-health.ts),
pure and unit-tested:

- **Health** — `healthy · drifting · at_risk · critical · completed · archived`.
  Terminal statuses short-circuit to a calm read; otherwise derived from the same
  overdue/blocked/stale signals the Command Center uses, sharpened by risk,
  momentum, and ownership. `explainInitiativeHealth` gives a one-line headline +
  reasons + next steps.
- **Momentum** — `accelerating · steady · slowing · stalled`, from recent
  completions (wins), intake, and meetings in a 14-day window.
- **Progress** — the share of tracked (completed + open, dropped excluded) work
  that is done, plus milestone completion.
- **Risk** — an additive, fully itemized score (overdue, blocked, unowned, stale,
  unconverted decisions, schedule slippage, critical entities, stalled momentum).
- **Ownership** — `clear · shared · unclear · unowned`, from the declared owner or
  the dominant action lead.

## Milestones (Phase D)

[`strategic-milestones.ts`](../lib/people-strategy/strategic-milestones.ts) —
each milestone declares its own match and aggregates the subset of the
initiative's work that matches it, deriving completion %, status
(`not_started · in_progress · blocked · at_risk · complete`), health, open /
blocked counts, ownership, and a behind-schedule flag.

## The strategic timeline (Phase C)

[`strategic-timeline.ts`](../lib/people-strategy/strategic-timeline.ts) unifies
meetings, decisions, actions (created + completed), milestones reached, and
configured target dates into one chronological stream answering "how did we get
here?". Exports `deriveStrategicTimeline`, `deriveTimelineEvents`,
`rankTimelineImportance`, `explainTimelineEvent`, `timelineEventToHref`.

**Honesty note:** every event has a *real* timestamp from real state. We do **not**
fabricate "health changed" / "ownership changed" history — that requires a
persisted event log this layer deliberately does not add. The event-type union
reserves those kinds for when such a log exists; the deriver only emits events it
can prove.

## Recommendations (Phase I)

[`strategic-recommendations.ts`](../lib/people-strategy/strategic-recommendations.ts)
— for each initiative, the next moves leadership should make (clear stuck work,
assign an owner, convert decisions, close follow-ups, re-plan a slipped
milestone, start the next one, schedule a session, restart stalled momentum, seed
the first action). Every recommendation is deterministic, carries a one-line
"why", and links somewhere useful (a prefilled new action, the overdue queue, the
meetings tracker, or the relevant milestone).

## Adding or editing an initiative

Edit `STRATEGIC_INITIATIVES` in
[`lib/people-strategy/strategic-initiatives.ts`](../lib/people-strategy/strategic-initiatives.ts):

```ts
{
  id: "new-initiative",
  title: "New Initiative",
  description: "One sentence on what it is and why it exists.",
  area: "CLASSES",              // rolls up to this operating area on the map
  status: "active",            // planning · active · paused · completed · archived
  priority: "high",            // flagship · high · medium · low
  targetDateISO: "2026-09-01T00:00:00.000Z",   // optional
  match: { goalCategories: ["New Initiative"], keywords: ["…"] },
  milestones: [
    { id: "m1", title: "First checkpoint", order: 1, match: { keywords: ["…"] } },
  ],
}
```

No migration, no backfill, no UI data entry. The initiative aggregates its work
automatically. Tune the `match` keywords so it captures the real work without
over-matching (prefer a `goalCategory` your team already uses).

## Permissions & feature flags

- Same officer gate as the rest of the Execution OS (`requireOfficer()`), and
  actions are visibility-filtered per viewer via `loadDigestInputs`, so a scoped
  officer only ever sees the work they may see.
- `ENABLE_STRATEGIC_INITIATIVES=true` exposes the three routes and the Command
  Center section; with it off they `notFound()` and the section is hidden, so the
  existing Execution OS is byte-for-byte unchanged.

## Testing

Pure-derivation suites cover the matcher + registry, health / momentum / progress
/ risk / ownership, milestone aggregation, timeline derivation + ranking +
explanation + href, recommendations, summary assembly + cross-initiative
selectors, and the strategic map. Component tests cover the cards, summary panel,
milestone list, timeline view, recommendations, executive dashboard section, and
map. All existing Execution OS / people-strategy / leadership-action-center
suites remain green.

```
tests/lib/people-strategy-strategic-initiatives.test.ts
tests/lib/people-strategy-strategic-initiative-health.test.ts
tests/lib/people-strategy-strategic-milestones.test.ts
tests/lib/people-strategy-strategic-timeline.test.ts
tests/lib/people-strategy-strategic-recommendations.test.ts
tests/lib/people-strategy-strategic-summary-map.test.ts
tests/components/strategic-initiatives.test.tsx
```

---

# Strategic Initiatives 2.0 — the Program Operating System

Phase II made initiatives *dashboards*. **2.0 makes them living organizational
programs**: every major YPP effort can be run *entirely* inside an initiative.
Actions feel like atoms; initiatives feel like planets. The same non-negotiable
rules still hold — **config + derivation, never a migration; no fake analytics;
everything explainable** — and the whole expansion is pure + unit-tested behind
the existing `ENABLE_STRATEGIC_INITIATIVES` flag.

The new composition point is the **dossier**
([`strategic-initiative-dossier.ts`](../lib/people-strategy/strategic-initiative-dossier.ts)):
it wraps the Phase-II `InitiativeSummary` and adds every 2.0 layer below. The
detail page renders the dossier; the new `/operations/portfolio` page renders the
executive read.

| Phase | What it adds | Module |
| --- | --- | --- |
| **A — Architecture** | A full charter: mission, purpose, success definition, strategic importance, target outcomes, key metrics, assumptions, constraints, risks, operating areas, leadership owners, stakeholders, historical context, lessons learned, future opportunities. Pure config. | [`strategic-initiative-profile.ts`](../lib/people-strategy/strategic-initiative-profile.ts) |
| **B — Workstreams** | The primary management unit *inside* an initiative (`Initiative → Workstream → Milestone → Action`). Each workstream declares a matcher and reuses the exact health/momentum/progress/risk/ownership engines on its slice. | [`strategic-workstreams.ts`](../lib/people-strategy/strategic-workstreams.ts) |
| **C — Decision Center** | Decisions organized by *provable* follow-through (needs follow-through · in motion · followed through · critical) + follow-through rate + history. Reversed/outcome kinds are **reserved, never fabricated**. | [`strategic-decision-center.ts`](../lib/people-strategy/strategic-decision-center.ts) |
| **D — Knowledge Base** | Institutional memory: overview, background, strategy, playbooks, resources, documents, templates, FAQs, historical notes, retrospectives, future ideas. Config, so leadership turnover never destroys it. | profile module |
| **E — Roadmaps** | True roadmap views — milestones + targets laid out by **phase** (completed · current · upcoming · at risk · blocked) and **horizon** (overdue · quarter · semester · year · beyond). | [`strategic-roadmap.ts`](../lib/people-strategy/strategic-roadmap.ts) |
| **F — Scenarios** | Best / expected / risk / stretch cases, each enriched with a deterministic *readiness* read from current health, momentum, and risk. | [`strategic-scenarios.ts`](../lib/people-strategy/strategic-scenarios.ts) |
| **G — Dependency Engine** | The cross-initiative graph: blocked-by, unlocks, **critical path**, and which dependencies are a *live* bottleneck because the upstream prerequisite is itself unhealthy. Answers "what is actually holding us back?". | [`strategic-dependencies.ts`](../lib/people-strategy/strategic-dependencies.ts) |
| **H — Operating Reviews** | Weekly / monthly / quarterly reviews — wins, losses, risks, decisions, open questions, milestone progress, capacity, dependency review, recommended priorities — so an initiative is reviewable like a business unit. | [`strategic-operating-reviews.ts`](../lib/people-strategy/strategic-operating-reviews.ts) |
| **I — Portfolio Management** | The executive layer: most important, highest impact, fastest growing, highest risk, most resource intensive, understaffed, blocked, strategic opportunities, portfolio balance, leadership focus areas. | [`strategic-portfolio.ts`](../lib/people-strategy/strategic-portfolio.ts) |
| **J — Execution Graph** | The crown jewel: `Initiative → Workstream → Milestone → Decision → Meeting → Action → Outcome`, built **only from real links** (structural containment + provable flow). | [`strategic-execution-graph.ts`](../lib/people-strategy/strategic-execution-graph.ts) |

## New routes

| Route | What it is |
| --- | --- |
| `/operations/initiatives/[initiativeId]` | Now the full **living-program command center** — executive summary, architecture, workstreams, roadmap, milestones, timeline, decision center, scenarios, dependencies, operating reviews, knowledge base, and the execution graph. |
| `/operations/portfolio` | **Initiative Portfolio** (Phase I) — the whole organization from one page, plus the cross-initiative dependency engine (Phase G). |

## Adding the 2.0 narrative to an initiative

The matcher core (workstreams, milestones, `relatedInitiatives`) lives in
[`strategic-initiatives.ts`](../lib/people-strategy/strategic-initiatives.ts); the
charter / knowledge base / scenarios / dependencies live in
[`strategic-initiative-profile.ts`](../lib/people-strategy/strategic-initiative-profile.ts),
keyed by initiative id. Every profile field is optional and
`getInitiativeProfile(id)` always returns a fully-defaulted object, so an
un-authored initiative simply shows clean empty states. Both are one-file,
no-migration PRs.

## Honesty notes (unchanged rules, applied to 2.0)

- The **Decision Center** only categorizes from real state (`createdAt`,
  `hasLinkedAction`); it never fabricates "reversed" or measured-outcome history.
- The **Execution Graph** draws only real links — structural containment and
  provable flow (a decision recorded at a meeting; a completed action's outcome).
- **Workstream** health/momentum/risk reuse the *exact* initiative engines on the
  workstream's slice, so "at risk" means the same thing at every level.

## Testing (2.0)

```
tests/lib/people-strategy-strategic-profile.test.ts
tests/lib/people-strategy-strategic-workstreams.test.ts
tests/lib/people-strategy-strategic-decision-center.test.ts
tests/lib/people-strategy-strategic-roadmap.test.ts
tests/lib/people-strategy-strategic-scenarios.test.ts
tests/lib/people-strategy-strategic-dependencies.test.ts
tests/lib/people-strategy-strategic-operating-reviews.test.ts
tests/lib/people-strategy-strategic-portfolio.test.ts
tests/lib/people-strategy-strategic-execution-graph.test.ts
tests/components/strategic-initiatives-os.test.tsx
```
