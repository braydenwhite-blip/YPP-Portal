# Data 360 — Technical Roadmap

> YPP's organizational intelligence layer. Where leadership understands the
> organization, not where anyone completes daily work.
>
> **Home answers:** "What do I need to do today?"
> **Data 360 answers:** "What is happening across YPP?"

This document is the engineering plan for Data 360, Phases 1–5. Phase 1 is
implemented in this pass (`/data-360`, `lib/data-360/`); Phases 2–5 are
specified here so the foundation is built to expand into them without rework.

---

## 0. Principles (binding constraints)

These are hard rules, enforced in review:

1. **No arbitrary scores.** Data 360 never invents a "Chapter Health Score",
   "Impact Score", "Readiness Score", 0–100 rating, or weighted formula. Every
   number on the surface is a **direct, traceable count, sum, average, or date**
   pulled from real records. Instead of "Health: 82/100" we show
   *students · active students · classes running · overdue actions · last
   activity date*. If a leader asks "where does this number come from?", the
   answer is always a concrete query against a named model + field.
2. **Every metric is traceable.** Each Phase-1 metric has a registry entry
   (`lib/data-360/registry.ts`) naming its source model/field, update cadence,
   permission visibility, and drill-down destination. The registry *is* the
   Data Dictionary.
3. **Nothing is a dead end.** Every KPI and chart links to the existing portal
   page that holds the underlying records (drill-down). Data 360 reads and
   routes; it does not duplicate the directories, trackers, or admin tools that
   already own that data.
4. **Read-only, deterministic, pure where possible.** The read layer is pure
   aggregation over existing data. Same inputs → same output. No mutations, no
   side effects, no business logic that already lives elsewhere (we import the
   canonical helpers — e.g. `partnerIsActive`, class-readiness — rather than
   re-deriving them).
5. **Honest about gaps.** A metric with no data source is **marked
   unavailable**, never faked. (Phase 1: fundraising has no model — it is shown
   as explicitly unavailable, with a note on what a source would require.)
6. **Distinct from `/operations/data-360`.** The portal already has an
   *operational* "Connected data" surface under `/operations/data-360`
   (`lib/operations/`) — a work board + timeline + needs-attention queue for
   officers getting work done. That is intentionally a *work* surface and uses
   health levels. Data 360 (`/data-360`) is the *intelligence* surface for
   leadership: quantitative, score-free, drill-down-first. The two share data
   loaders where sensible but are separate products. We reuse, we don't merge.

---

## 1. Architecture

```
app/(app)/data-360/
  page.tsx                 server: requireLeadership guard, resolve ?range=,
                           load overview + attention, render shell
  data-360-shell.tsx       "use client": tabs, date-range, role/view lens,
                           search; renders the active section
  sections/                Overview (deep) + People/Programs/Chapters/
                           Fundraising/Performance/Geography/Dictionary
  charts/                  zero-dependency SVG primitives (line, bar, ...)

lib/data-360/
  types.ts                 DateRangeKey, Kpi, KpiGroup, TimeSeries,
                           CategoryDatum, AttentionFact, Data360Overview, ...
  range.ts                 resolve a DateRangeKey → {start,end,prev,label}
  timeseries.ts            cumulative monthly series from createdAt[] (real)
  registry.ts              METRIC REGISTRY / data dictionary (source of truth)
  views.ts                 role → default lens; lens → section ordering
  metrics.ts               PURE shaping: counts → Kpi[] via the registry
  overview.ts              the loader: parallel Prisma reads → Data360Overview
  needs-attention.ts       factual, score-free alerts (label-only)
  index.ts                 barrel
```

**Server/client split.** The page (server component) runs the guard, resolves
the date range from the URL (`?range=month`), and does all data loading. The
shell (`"use client"`) is presentation + light interaction only (tab state,
lens state, client-side search filter). Date range is **URL-driven** so the
server recomputes — the filter is real, not cosmetic, and matches the portal's
server-driven-URL convention.

**Why no chart library.** None is installed, and the brief says don't add a
heavy dependency. SVG primitives (~150 lines total) give crisp, dense,
fully-controllable charts that fit the terminal aesthetic and add zero bundle
weight.

**Historical data.** Real growth curves are reconstructed from `createdAt`
timestamps (cumulative counts over trailing months) — this is genuine history,
not a fabricated layer. Point-in-time metrics that *cannot* be reconstructed
from `createdAt` (e.g. how many students were *active* on a past date, or
fundraising totals) are a Phase-2 concern; the roadmap specifies a
`MetricSnapshot` model for them (see §6). We do **not** build that table in
Phase 1 — `timeseries.ts` is the clean seam it will plug into.

---

## 2. Phase 1 — Foundation (this pass)

**Route:** `/data-360`, gated by `requireLeadership()` (Officer-tier+ on the org
ladder, or ADMIN + Leadership/Super-Admin). Registered in
`lib/navigation/catalog.ts` with the visible label **"Data 360"** (distinct
from the existing "Connected data" entry — no nav-check collision).

**Shell:** title "Data 360"; subtitle "Organizational intelligence for YPP";
search bar ("Search students, instructors, chapters, programs, partners…");
date-range selector (Today / This Week / This Month / This Quarter / This Year /
All Time); role/view lens selector (Executive / Operations / Expansion /
Programs / Chapters); section tabs — **Overview, People, Programs, Chapters,
Fundraising, Performance, Geography, Data Dictionary**.

**Executive Overview (deep):**

- **KPI cards** grouped by domain, each a real count with a drill-down and a
  "+N added in range" delta where `createdAt` supports it:
  - People — total students, active students, total instructors, active
    instructors, active mentorships.
  - Programs — active classes, classes completed, active programs, total
    enrollments.
  - Chapters — active chapters, total chapters.
  - Pipeline — applications in pipeline, awaiting review.
  - Work — open actions, overdue actions, meetings completed (range).
  - Partners — active partners, partners needing follow-up.
  - Fundraising — **unavailable** (no data source; shown explicitly).
- **Charts (SVG):** students over time, chapters over time (cumulative,
  trailing 12 months); classes by category (`ClassTemplate.interestArea`);
  people by role; chapters by lifecycle status; actions completed vs overdue;
  partners by pipeline stage.
- **Needs Attention panel** — factual, label-only (no severity scores):
  chapters with no active classes, classes under enrollment minimum, overdue
  actions, applications awaiting review, partners with no recent activity,
  active mentorships gone quiet, completed meetings with no follow-up. Labels:
  *Overdue · No recent activity · Low enrollment · Awaiting review · No
  follow-up · No active classes*.
- **Recent activity** — newest records across chapters/partners/classes/
  applications, each linking to its source.

**Other tabs** are populated with real data slices already loaded (not empty
shells): People → people KPIs + role chart; Programs → program/class KPIs +
category chart; Chapters → chapter KPIs + growth + status + per-state list;
Fundraising → explicit unavailable state + what a source needs; Geography →
chapters-by-state list (map is Phase 3); Performance → actions/meetings
throughput; Data Dictionary → the registry rendered as a table.

**Definitions (explainable, traceable):**

| Metric | Definition | Source |
|---|---|---|
| Total students | `User.primaryRole = STUDENT`, not archived | `User` |
| Active students | distinct students with an `ENROLLED` enrollment | `ClassEnrollment` |
| Total instructors | `User.primaryRole = INSTRUCTOR`, not archived | `User` |
| Active instructors | distinct instructors teaching a `PUBLISHED`/`IN_PROGRESS` offering | `ClassOffering` |
| Active chapters | `lifecycleStatus = ACTIVE`, not archived | `Chapter` |
| Active classes | `status ∈ {PUBLISHED, IN_PROGRESS}` | `ClassOffering` |
| Active programs | `isActive = true` | `SpecialProgram` |
| Active partners | `stage` set and ∉ {NOT_STARTED, CLOSED, DECLINED, ARCHIVED} | `Partner` |
| Applications in pipeline | status ∈ waiting set (SUBMITTED…CHAIR_REVIEW) | `InstructorApplication` |
| Open actions | `status ∈ {NOT_STARTED, IN_PROGRESS}` | `ActionItem` |
| Overdue actions | `status = OVERDUE` or (open and `deadlineEnd < now`) | `ActionItem` |
| Active mentorships | `status = ACTIVE` | `Mentorship` |
| Meetings completed | `status = COMPLETED` (in range by `scheduledAt`) | `Meeting` |

---

## 3. Phase 2 — Entity 360

A comprehensive intelligence page per major entity, consolidating everything
known about it into one location with a timeline and cross-links.

- **Student 360, Instructor 360, Chapter 360, Partner 360, Program/Class 360**
  (plus Volunteer/Fundraiser 360 when those data sources exist).
- **Per-entity timeline** — unified, chronological record events (enrolled,
  taught, attended, reviewed, met, decided) from the entity's relations.
- **Cross-links** — every related entity is a chip that opens its own 360.
- **Reuse:** the operational layer already has an Entity-360 drawer
  (`lib/operations/entity-360.ts`) and `EntityChip`. Phase 2 generalizes the
  read into a leadership-facing full page and adds the quantitative profile
  header (counts + dates, no scores).
- **Data layer:** `lib/data-360/entities/{student,instructor,chapter,partner,
  program}.ts` — each a pure loader returning a typed profile + timeline.

---

## 4. Phase 3 — Views & Lenses + Geography

Each section tab becomes a full analytical view; the role/view lens becomes a
saved default per role.

- **People / Programs / Chapters / Fundraising / Performance / Geography /
  Historical** views, each with its own KPI set, breakdowns, and tables.
- **Geographic intelligence** — interactive map (chapters, partners, student
  density, instructor distribution) from `Chapter.city/state/region`. Needs a
  geocoding helper + a lightweight map (SVG US states first; tile map later).
- **Historical view** — "rewind" the org to any date, powered by snapshots
  (§6). Period-over-period comparison (this vs last month/quarter/year).
- **Role-based default dashboards** — `views.ts` already maps role → lens;
  Phase 3 persists a per-user default + lets leadership switch freely.

---

## 5. Phase 4 — Intelligence & Actions

Deterministic, fact-based intelligence — still no scores.

- **Deterministic recommendations** — rule-driven, each citing the facts that
  triggered it ("Chapter X has 0 active classes and 12 enrolled students →
  schedule a class"). Rules live in a registry, like metrics.
- **Forecasting where data supports it** — simple, explainable projections
  (e.g. linear run-rate of student growth from the real series), clearly
  labelled as projections with their basis. No black-box modeling.
- **Risk detection using facts** — "partner inactive 90+ days", "instructor
  shortage: N classes unstaffed", surfaced from concrete thresholds.
- **Create action from metric** — a KPI or attention fact spawns an `ActionItem`
  (reusing the existing action-tracker server actions) pre-filled with a link
  back to the source data. Insight → execution, without leaving the trail.

---

## 6. Phase 5 — SaaS-Ready Foundation

Generalize the proven internal layer into a configurable intelligence platform.

- **Metric registry** (started in Phase 1, `registry.ts`) → the typed contract
  every metric implements; new metrics are registry entries, not bespoke code.
- **Data dictionary** (Phase 1 tab) → public, versioned, exportable.
- **`MetricSnapshot` model** — the historical spine for non-reconstructable
  metrics. Sketch:

  ```prisma
  model MetricSnapshot {
    id         String   @id @default(cuid())
    metricKey  String   // registry key, e.g. "active_students"
    scope      String   // "org" | "chapter" | ...
    scopeId    String?  // chapter id when scoped
    value      Float
    capturedAt DateTime @default(now())
    @@index([metricKey, scope, scopeId, capturedAt])
  }
  ```

  Written by a daily cron (`scripts/`), read by `timeseries.ts`. Hand-written
  idempotent migration per the repo's golden rules.
- **Saved views** — persist a (lens + range + filters) tuple per user
  (`SavedQuery`/`SavedActionView` already exist as patterns to follow).
- **Configurable widgets** — the Overview grid becomes a reorderable set of
  registry-driven widgets.
- **Export / reporting** — CSV/PDF of any view; scheduled email digests.
- **Generalized people/programs/organizations model** — the registry +
  snapshot + view abstractions are org-agnostic, positioning Data 360 as a
  unified intelligence layer for other mission-driven organizations.

---

## 7. Risks & decisions

- **Dark surface in a light portal.** The portal is uniformly light;
  `globals.css` is frozen. Data 360 is rendered as a self-contained dark
  "terminal" surface scoped to the route (Tailwind arbitrary values in the
  components — no global CSS edits), which both honors the freeze and makes the
  intelligence surface feel intentionally distinct from Home, exactly as the
  proposal asks.
- **Query cost.** Phase 1 uses bounded reads: `count`/`groupBy` for totals and
  one windowed `findMany(select: createdAt)` per growth series (plus a baseline
  count). All reads run in parallel and fail soft (a failed slice degrades to
  empty/unavailable, never a page crash).
- **Naming collision with `/operations/data-360`.** Resolved: different route,
  different lib dir, different nav label, different product purpose (intelligence
  vs work). Documented in §0.6 so future contributors don't merge them.
- **"Active" definitions.** Chosen to be the most defensible *and* cheap to
  compute; each is in the registry and the table above. They can be retuned in
  one place.
