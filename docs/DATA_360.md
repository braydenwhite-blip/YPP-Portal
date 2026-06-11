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
| `attention.ts` | The **needs-attention engine**: wraps the digest's ranked review queue and adds cross-domain signals — partners with no/overdue next step, applicants stuck in review, mentorships gone quiet, classes starting without setup. Every item carries a plain-language "why it matters". |
| `metrics.ts` | The **executive snapshot**: one ordered strip of org-wide numbers (work, meetings, initiatives, classes, applicants, partners, mentorships) with calm-by-default tones. |
| `entity-360.ts` | The universal **Entity 360** payload type (one shape for all six entity types) plus pure helpers: initials, tenure, footnotes, person-story timeline, next-step selection. |
| `entity-360-queries.ts` | Per-type 360 loaders (person, class, partner, initiative, meeting, action) composing the existing query helpers. Authorization lives here (see below). |
| `data-360-queries.ts` | The Data 360 page loader: one digest pool read + four cheap cross-domain queries → snapshot, attention queue, work board, timeline, connected-data explorer. |

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

## Extending to a new entity type

1. Add the type to `ENTITY_360_TYPES` in `lib/operations/entity-360.ts`.
2. Write a loader in `entity-360-queries.ts` returning the `Entity360` shape
   (only fill the sections that make sense — empty sections don't render).
3. Add its page fallback in `entity-link.tsx`'s `DEFAULT_HREF`.

No drawer, API, or body changes needed — that is the point of the pattern.
