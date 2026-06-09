# Strategic Initiatives 3.5 — UX Audit & Polish Plan

> Companion to `STRATEGIC_INITIATIVES_3.0.md`. This pass does **not** add new
> backend concepts. It turns the 3.0 operating layer into a polished,
> executive-grade experience: clear navigation, an honest attention-first
> project board, a focused project command room, and strategic context wired
> into the entity pages leadership already lives in.

## 1. How the system is built today (the facts)

- **Pure derivation layer** (`lib/people-strategy/strategic-*`) produces every
  signal a leader needs and it is already explainable:
  `ProjectSummary` carries `health`, `momentum`, `risk`, `confidence`,
  `blockers` (declared vs observed), `followThrough`, `reviewNeed`,
  `statusExplanation`, `nextMoves`, `recentTouchpoints`, and full `counts`.
- **Portfolio queries already group projects** — `getStrategicProjectPortfolio`
  returns `needingAttention`, `blocked`, `stale`, `unowned`, `fastest`, and
  `byInitiative`. `getStrategicCommandData` returns a `snapshot`, attention
  queues, `upcomingMilestones`, `decisionsNeedingFollowThrough`, and
  `recommendedMoves` (a ready-made leadership agenda).
- **Touchpoint timeline** is already grouped (`overdue / upcoming / current /
  recent / past`) with rich, honest events and counts.
- **Components** are comprehensive: project cards + intelligence panels,
  `TouchpointTimelineView`, `EntityTouchpoints`, `StrategicCommandSection`,
  `StrategicContextSection`.
- **Entity operational context** is solved: `getOperationalContextForEntity`
  already feeds the partner/class/instructor/mentorship/person pages.
- **Design system** is tokenized CSS: `.ps-page`, `.card`, `.pill`,
  `.ps-action-card`, `.ps-stat-card`, `.ps-command-bar`, `.ps-section-title`,
  and a segmented `.ps-tabs` / `.ps-tab` control with an `aria-current="page"`
  gradient active state.

## 2. What feels strong

- The data is honest. Empty states already explain *why* something is empty.
- Health / confidence / blockers / next-move are derived, never invented.
- Detail pages are deep — execution spine, action/decision/meeting intelligence,
  dependencies, and a review card.

## 3. What feels cluttered, confusing, or weak

1. **Navigation is the #1 problem.** Every operations page hand-rolls its own
   inline `<nav>` pill row, and each one has a **different set and order** of
   links, all `color: var(--muted)` with **no active indicator**. There are
   **no breadcrumbs** — the Portfolio → Initiative → Project hierarchy is
   invisible, and on a detail page you cannot tell where you are in the stack.
2. **The project index is a stack of sections, not an operating board.** It
   renders `needingAttention / blocked / unowned / byInitiative` but **drops the
   already-derived `stale` and `fastest` groups**, leads with an 8-tile stat
   strip (stat overload), has **no priority attention queue** answering
   *why / who / blocker / next move* up top, and uses generic CTAs
   ("Open initiative →").
3. **The project detail has no single "what matters now" focal point.** The
   issue + "what happens if nothing changes" is spread across the header hint,
   next moves, blockers, and confidence. A leader scanning needs one panel.
4. **The Command Center buries strategic command** between the digest stats and
   the operational two-column grid, and never frames `recommendedMoves` as the
   week's leadership agenda.
5. **Weekly Review has no strategic agenda** — it is purely operational triage;
   projects/initiatives needing review never surface there.
6. **Entity pages show operational context but no strategic laddering.**
   `EntityTouchpoints` and `StrategicContextSection` exist but are **unused** on
   partner/class/instructor/mentorship/person. On a partner page you cannot see
   which strategic projects/initiatives that partner serves.
7. **Meeting detail** shows related-entity context but not the initiative /
   project it ladders into.
8. **Repeated one-off inline styling.** Every page hand-rolls `marginTop: 26`,
   the nav row, and the two-column grid — exactly the page-specific styling the
   brief warns against.

## 4. Information architecture (the hierarchy we make obvious)

```
Portfolio    executive overview        "Are we focused on the right things?"
  Initiative strategic program         "Is this program healthy?"
    Project  concrete body of work     "Is this moving? what's the next move?"
      Workstream  internal lane
      Milestone   checkpoint
      Action      task / follow-through
      Meeting     source of decisions & actions
      Decision    commitment needing follow-through
      Touchpoint  timeline event / contact / update
```

Every strategic page should answer, in order: **Where am I? · What level is
this? · What matters here? · What needs attention? · What do I do next? · How do
I go deeper?**

## 5. What this pass changes

- **B — Navigation system.** A single reusable `StrategicWorkspaceNav`
  (segmented `.ps-tabs`, real active state, accessible) replaces all ad-hoc nav
  rows. `StrategicBreadcrumbs` makes Portfolio → Initiative → Project explicit.
- **C — Project index.** A `StrategicAttentionQueue` up top (why / owner /
  blocker / next move / specific CTA), the `stale` and `fastest` groups
  rendered, a compact executive summary, and specific per-project CTAs.
- **D — Project detail.** A "What matters now" panel right after the header
  (purpose · current issue · next move · who acts · what happens if nothing
  changes), plus breadcrumbs and the workspace nav.
- **E/F/I — Command Center, Portfolio, Weekly Review.** Elevate strategic
  command and frame `recommendedMoves` as the week's leadership agenda; add a
  Strategic Review Agenda to the weekly review.
- **G — Entity embeds.** A compact `StrategicEntityPanel` wires related
  projects/initiatives + recent touchpoints + next follow-up into the
  partner/class/instructor/mentorship/person pages, reusing
  `getOperationalContextForEntity` + `deriveTouchpointTimeline`.
- **H — Meeting detail.** Surface the initiative/project a meeting ladders into.
- **K/L/M — Polish.** Timeline variants, consistent spacing via shared section
  primitives, and specific microcopy everywhere.

## 6. Empty-state philosophy

Empty is a state, not a void. Every empty state says **what would appear here**
and **what it means that it is empty** — and never implies a problem that the
data does not support. Example: "No observed blocker detected. This doesn't mean
the project is risk-free; it means no overdue actions, missing owners, or
blocked dependencies were found."

## 7. How to add future strategic UI without dashboard bloat

1. **Derive, never invent.** If a number isn't in the derivation layer, add it
   there (pure + tested) — not in a component.
2. **Reuse the primitives.** `StrategicWorkspaceNav`, `StrategicSection`,
   `StrategicAttentionQueue`, `ProjectCard`, `TouchpointTimelineView`, `Pill`,
   `StatCard`. Add a new component only when a pattern repeats.
3. **Every section earns its place** by helping a decision or an action. If it
   doesn't, it's noise — cut it.
4. **One CTA per surface that is specific** ("Clear blocker", "Assign owner"),
   never a generic "View".
5. **Empty states ship with the component**, not bolted on per page.

## 8. What shipped (reference)

### Navigation (Phase B)
`components/people-strategy/strategic-workspace-nav.tsx`
- `StrategicWorkspaceNav({ current?, showStrategic? })` — the segmented
  `.ps-tabs` switcher (Command Center · Portfolio · Initiatives · Projects ·
  Weekly Review · Actions · Meetings). `showStrategic={false}` drops the
  flag-gated destinations so non-strategic surfaces never link to a 404.
- `StrategicBreadcrumbs({ trail })` — Portfolio → Initiative → Project.
- `StrategicWorkspaceHeader({ current, breadcrumbs, ...commandBar })` — one
  header per page (breadcrumbs + command bar + switcher).
- `StrategicStack` — consistent section rhythm (`.ps-stack`), replacing per-page
  `marginTop`.
- Detail pages keep a clearly-secondary `.ps-anchor-nav` in-page jump bar.
- Applied to all eight operations surfaces (command-center, portfolio,
  initiatives, initiative detail, projects, project detail, weekly-review,
  strategic-map).

### Project workspace (Phases C–D)
`lib/people-strategy/strategic-project-attention.ts` (pure)
- `deriveProjectCta(project)` → one specific labeled CTA (Clear blocker / Assign
  owner / Review decisions / Create next action / Review project).
- `selectProjectAttentionQueue(projects, limit?)` → the ranked "look here first"
  queue (deduped union of needs-attention / blocked / unowned / stale).
- `deriveProjectStakes(project)` → the honest "if nothing changes" line.

`components/people-strategy/strategic-projects.tsx`
- `StrategicAttentionQueue({ items })` — numbered rows (why / owner / blocker /
  next move / CTA). Used on the project index and inside the portfolio board.
- `ProjectWhatMattersPanel({ project })` — the focal panel under the project
  hero (purpose · status · next move + CTA · who acts · stakes · success).
- The project index now also renders the previously-unused `stale` (Losing
  momentum) and `fastest` (Accelerating) groups.

### Leadership agenda (Phases E / F / I)
`components/people-strategy/strategic-command.tsx`
- `StrategicLeadershipAgenda({ moves })` — the numbered "this week's agenda" from
  the derived `recommendedMoves`. The Command Center cockpit now leads with it;
  the Weekly Review shows it (+ a "Projects to review" attention queue) above the
  operational triage stepper. The Portfolio project board leads with the queue.

### Entity & meeting embeds (Phases G / H)
`lib/people-strategy/strategic-entity-context.ts` (pure)
- `deriveStrategicEntityContext({ actions, meetings })` — ladders an entity up to
  the strategic system from data the page already fetched
  (`getOperationalContextForEntity`); no new query.

`components/people-strategy/strategic-entity-panel.tsx`
- `StrategicEntityPanel({ context })` — compact embed (related projects /
  initiatives / recent activity). Renders nothing when not strategic. Wired into
  partner, class, instructor, mentorship, and person pages (flag-gated).

`components/people-strategy/strategic-context.tsx`
- `StrategicContextSection` gains `showEmptyState` and honest "likely relates to"
  framing for inferred meeting links; surfaced on the meeting detail page.

### Timeline (Phase K)
`components/people-strategy/touchpoint-timeline.tsx` — one underlying component,
two variants: `TouchpointTimelineView` (grouped, full — project detail) and
`EntityTouchpoints` (compact — entity panel). Empty states name the activity that
would appear.

### Tests (Phase P)
`tests/components/strategic-workspace-nav.test.tsx`,
`tests/components/strategic-entity-panel.test.tsx`,
`tests/components/strategic-context.test.tsx`,
`tests/lib/people-strategy-strategic-project-attention.test.ts`,
`tests/lib/people-strategy-strategic-entity-context.test.ts`, plus new cases in
`tests/components/strategic-projects.test.tsx`.
