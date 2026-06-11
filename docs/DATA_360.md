# Data 360 — the connected-data operating system

Data 360 turns the portal's separate trackers (actions, meetings, initiatives,
classes, partners, instructors, applicants, mentorship) into one connected
360-degree system: every person, class, partner, meeting, and action opens the
same slide-in panel, every piece of work lands on one board, and one queue
explains what needs attention and why.

## The two leadership surfaces

| Surface | Question it answers |
| --- | --- |
| `/operations/command-center` | **What matters this week?** (urgency, triage, the weekly rhythm) |
| `/operations/data-360` | **How does everything connect?** (entities, relationships, the unified work board, the org-wide story) |

Both render from the same shared derivations (`operational-digest.ts` and the
`lib/operations/` brain below), so they can never disagree about what
"overdue", "blocked", or "at risk" means.

## The operations brain (`lib/operations/`)

Every module is **pure** (no DB, no session — callers inject `now`) and
unit-tested under `tests/lib/operations/`. The two `*-queries.ts` files are the
only ones that touch Prisma.

| File | Responsibility |
| --- | --- |
| `work-items.ts` | The unified **Work Item**: folds tracker actions and unconverted meeting follow-ups into one shape, and groups them into mutually-exclusive board lanes (overdue → blocked → needs owner → due soon → in progress → not started → done recently). |
| `timeline.ts` | The unified **timeline**: meetings, decisions, actions created/completed (plus person-story kinds: joined, mentorship, class, role, note) as one filterable, day-groupable event stream. |
| `signals.ts` | The derived **judgment calls**, made exactly once: class readiness (ready / almost / needs setup / at risk, with the missing-setup list), partner health (healthy / needs follow-up / stalled / at risk, with reasons), person profile completeness, recency labels, and **Today's Brief** (the org's state as plain sentences, worst first). The attention engine and the 360 drawers both read from here, so they can never disagree. |
| `attention.ts` | The **needs-attention engine**: wraps the digest's ranked review queue and adds cross-domain signals — partners with no/overdue next step, applicants stuck in review, mentorships gone quiet, classes failing the shared readiness rule. Every item carries a plain-language "why it matters", a **suggested next step**, an age label, a related-entity chip, and a **category** (urgent / missing owner / missing next step / stalled / upcoming risk / data incomplete) the queue groups by. |
| `metrics.ts` | The **executive snapshot**: org-wide numbers grouped by theme (Work · Meetings & decisions · Programs & people) with calm-by-default tones. |
| `quick-find.ts` | **Quick Find** ranking: pure client-side filtering over the page's loaded index (prefix > word-start > substring). |
| `entity-360.ts` | The universal **Entity 360** payload type — now including the derived `signal` (readiness / health / momentum chip) and the `glance` stat row — plus pure helpers: initials, tenure, footnotes, person-story timeline, next-step selection. |
| `entity-360-queries.ts` | Per-type 360 loaders (person, class, partner, initiative, meeting, action) composing the existing query helpers and the `signals.ts` judgments. Initiative momentum comes straight from the strategic-initiative engine — never re-derived. Authorization lives here (see below). |
| `data-360-queries.ts` | The Data 360 page loader: one digest pool read + four cheap cross-domain queries → Today's Brief, snapshot, attention queue, work board, timeline, the enriched explorer (owner, last activity, next step per entity), and the Quick Find index. |

### Entity-specific panel emphasis

All six panels render through ONE body component; emphasis comes from what
each loader fills in:

- **Person** — identity facts (+ profile completeness when incomplete), glance
  (open/overdue work, classes, meetings, mentees, last activity), mentor /
  mentee clusters plus advisor / advisee links (officer view), story timeline,
  visibility footer.
- **Class** — readiness signal with the missing-setup list, glance (sessions,
  students, open work, meetings), instructor, schedule facts.
- **Partner** — relationship-health signal with reasons, glance (open work,
  meetings, classes, last contact), contact facts, pipeline-note timeline.
- **Initiative** — momentum signal (from the initiative engine), glance
  (progress, open work, meetings, milestones), risk factors, matched work.
- **Meeting** — glance (decisions, open follow-ups, actions created,
  attendees), unconverted follow-ups as work items with "Track as action".
- **Action** — owner/executing/input people, source, blockers, comment
  timeline.
- **Mentorship** — mentor / mentee / chair (each clickable), quiet-pairing
  signal (same rule as the attention engine), glance (check-ins, sessions,
  open work, last activity), linked work and meetings.
- **Applicant** — pipeline status, stage-milestone timeline (submitted →
  interview → decision), waiting signal, reviewer. Deliberately conservative:
  review scores and notes never leave the hiring surfaces.

With these, **every shipped related-entity link type opens a panel** — a
"Linked to" chip on any action or meeting is always clickable.

## The universal 360 drawer

- `components/operations/entity-360-drawer.tsx` — `Entity360Provider` mounts
  once in the app shell. It exposes `openEntity(type, id)` AND provides the
  legacy `ProfileDrawerContext`, so **every existing `PersonLink` opens the new
  person panel with zero changes**. Panels stack (mentor → mentee → their
  class …) with a Back button; Escape pops; route changes close; modifier
  clicks still navigate.
- `components/operations/entity-link.tsx` — `EntityLink` is the universal
  sibling of `PersonLink` for classes, partners, initiatives, meetings, and
  actions. Progressive enhancement: plain text without an id, normal
  navigation without a provider.
- `components/operations/entity-360-body.tsx` — ONE body renders every entity
  type: header identity (avatar/initials, status, tenure), facts grid,
  relationship clusters, connected work, classes, meetings, story timeline,
  risks, next step, and a data-visibility footer.
- `app/api/entity-360/[type]/[id]/route.ts` — one JSON route backs every panel.

### Access model (stricter reading wins)

- **person** — any signed-in member; reuses `loadPublicProfile` gating. Work is
  viewer-filtered via `getMyActionItems`; meetings + leadership roles are
  officer-only sections. Footer states what the viewer is seeing.
- **action** — `getActionItemById` enforces `canViewAction`.
- **class / partner / initiative / meeting** — officer-tier only; loaders
  return null (the route 404s) so existence never leaks.

## Where the drawer is wired into existing trackers

- **Action tracker** — `ActionCard` (My Actions + All Actions): the title opens
  the Action 360 panel, the Lead opens their person panel, the related-entity
  badge opens the linked class/partner/person panel; "Open →" keeps the full
  page one click away. The card is a container, never one big link, so nothing
  nests anchors.
- **Meetings tracker** — `MeetingCard`: the title opens the Meeting 360 panel
  for a quick peek (decisions, follow-ups, "Track as action"); the footer
  "Open →" goes to the full meeting workspace where capture happens.
- **Initiatives** — `InitiativeMiniRow` (Command Center / dashboard surfaces)
  opens the Initiative 360 panel; the full `InitiativeCard` on
  `/operations/initiatives` still navigates to the initiative command center.
- **Command Center** — entity-health cards open their panels.
- **Admin lists** — partner names (`/admin/partners`) and class titles
  (`/admin/classes`) open their panels.
- Everywhere a person's name renders through `PersonLink`, the person panel
  opens — no per-page wiring.

In every case a plain left-click peeks, and modifier/middle clicks (and
no-provider contexts) navigate to the full page. The drawer enhances
navigation; it never replaces a route.

## Extending to a new entity type

1. Add the type to `ENTITY_360_TYPES` in `lib/operations/entity-360.ts`.
2. Write a loader in `entity-360-queries.ts` returning the `Entity360` shape
   (only fill the sections that make sense — empty sections don't render).
3. Add its page fallback in `entity-link.tsx`'s `DEFAULT_HREF`.

No drawer, API, or body changes needed — that is the point of the pattern.

## Known limitations / recommended next pass

- **Quick Find is page-local.** It filters what the Data 360 page loaded — it
  is not a portal-wide search. A global command palette (⌘K) backed by a
  search endpoint is the natural next step.
- **Class readiness can't see curriculum yet.** The signal reads instructor /
  sessions / publication / enrollment; wiring in curriculum-draft state would
  complete the "missing: curriculum" story.
- **Quick actions in the drawer are read-only links.** Inline mutations
  (reassign owner, complete follow-up) would need the existing server actions
  threaded into the panel — doable, deliberately out of scope so far.
- The work board lanes cap at 5 visible items with an overflow link; a
  "show all" expansion per lane is a small follow-up.
