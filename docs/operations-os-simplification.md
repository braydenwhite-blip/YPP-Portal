# Operations OS Simplification

## What This Pass Did

The portal had grown many powerful operational pieces — actions, meetings,
follow-ups, decisions, weekly execution, strategic initiatives, command center,
operational inboxes, recaps, communication-needed ideas — but they were starting
to feel like many trackers instead of one product. This pass unified them into
one leadership operating system:

```txt
YPP Leadership OS
├── Command Center   = What matters right now
├── Weekly Execution = Run the weekly officer meeting
├── Initiatives      = The big strategic goals
├── Actions          = The concrete work
├── Meetings         = Where decisions and loose ends come from
└── Communications   = What needs to be sent (a layer, not a page)
```

The whole system in one sentence:

```txt
Initiatives are the big goals. Meetings create decisions. Decisions create
actions. Actions move initiatives forward. Weekly Execution keeps everything
from getting lost.
```

## Final Information Architecture

### Primary routes

| Route | Job |
| --- | --- |
| `/operations` | Simple entry point. For officers it only explains where to go; it is deliberately not another dashboard. Non-officer roles keep their personal views (my actions, my mentees, my classes). |
| `/operations/command-center` | The main 360 view: top snapshot, Needs Attention, This Week, Recently Decided, top strategic initiatives, area health, recent timeline. |
| `/operations/weekly-execution` | The officer meeting workflow in four stages: 1. Build agenda, 2. Capture meeting, 3. Resolve loose ends, 4. Draft recap. |
| `/operations/initiatives` | The big goals and whether they are moving. Links to the deeper analytical views. |
| `/actions/all` | The detailed action board/database. |
| `/actions/new` | Create or convert an action (prefilled from meetings, decisions, loose ends, initiatives, entities). |
| `/actions/meetings` | Meeting history and meeting outputs (decisions, loose ends, created actions). |

### Secondary routes (kept, but out of the primary nav)

These remain functional but are linked from the Initiatives page ("Deeper
views") instead of crowding the workspace nav:

- `/operations/portfolio` — portfolio board + dependency engine
- `/operations/projects` and `/operations/projects/[projectId]` — strategic projects
- `/operations/strategic-map` — top-down portfolio map
- `/actions/command-center` — the Action Tracker execution dashboard (people momentum, attention queue, briefing)
- `/actions/completion-report`, `/actions/responsibility`, `/actions/people` — reporting and people views

### Legacy routes (redirects)

- `/operations/weekly-review` → `/operations/weekly-execution`. The guided
  stepper and the Weekly Execution OS both ran the same weekly loop from the
  same digest; the unified IA keeps one weekly workflow. The stepper component
  and its `getWeeklyReviewForViewer` query helper were removed.
- `/all-actions` → `/actions/all`, `/my-actions` → `/actions`,
  `/actions/reporting` → `/actions/all` (pre-existing).

## Shared Vocabulary

The interface teaches one language everywhere:

| Concept | Final term |
| --- | --- |
| Big goal | **Initiative** |
| Meeting result | **Decision** |
| Thing to do | **Action** |
| Meeting output not yet handled | **Loose end** |
| Message that needs to be sent | **Communication needed** |
| Weekly leadership meeting workflow | **Weekly Execution** |
| Current operational overview | **Command Center** |

"Follow-up" survives only inside meeting capture, where it names the literal
`MeetingFollowUp` database record; the moment one is unresolved it surfaces
everywhere else as a **loose end**.

## One Brain: the Shared Operations Summary

`lib/people-strategy/operations-summary.ts` is the single derivation layer
behind every operations view. It consumes the existing Weekly Operational
Digest (`operational-digest.ts`) plus the Strategic Initiative summaries and
produces one integrated shape:

```ts
type OperationsSummary = {
  snapshot: {
    openActions; overdueActions; blockedActions; dueThisWeek;
    meetingsThisWeek; looseEnds; communicationsNeeded; initiativesAtRisk;
  };
  needsAttention: OperationsItem[];
  thisWeek: OperationsItem[];
  recentlyDecided: OperationsItem[];
  looseEnds: OperationsItem[];
  communicationsNeeded: OperationsItem[];
  initiativesNeedingAttention: OperationsItem[];
  recentTimeline: OperationsTimelineItem[];
};
```

Crucially it does **not** recalculate meaning: loose ends, communications
needed, and initiative attention are derived by reusing the Weekly Execution
derivations (`deriveMeetingLooseEnds`, `deriveCommunicationNeeded`,
`deriveInitiativeAgendaItems`), so a "loose end" on the Command Center is the
exact same object a leader resolves in Weekly Execution. One brain, many views.

All derivations are pure (no DB, no React, no AI) and unit-tested with plain
fixtures in `tests/lib/people-strategy-operations-summary.test.ts`.

## One Card: the Shared Operations Card System

`components/people-strategy/operations-item-card.tsx` renders every operations
item — action, meeting, decision, loose end, communication, initiative — in one
visual language: kind pill, title, why it matters, owner, due date, source
meeting, related initiative, status/health, and a suggested next step.

It is used by:

- Command Center (Needs Attention, This Week, Recently Decided, Strategic Initiatives)
- Weekly Execution (Resolve Loose Ends, Communications Needed)

It also ships `OperationsEmptyState` (teaching empty states) and
`OperationsTimelineList` (the merged recent-history view). This replaced the
per-page card variants that each carried slightly different fields and copy.

## Command Center vs Weekly Execution

- **Command Center** answers *"what matters right now?"* — a leadership
  cockpit you scan, not a report you read.
- **Weekly Execution** answers *"how do we run this week's officer meeting?"* —
  a workflow you complete: build agenda → capture meeting → resolve loose ends
  → draft recap.

Both read the same digest and the same derivations; they differ only in
framing. The old guided Weekly Review overlapped Weekly Execution almost
entirely and was retired into it.

## What Was Removed or Merged

- The Command Center's duplicated strategic sections (the "Strategic command"
  block and a second initiative stat strip) merged into one "Strategic
  initiatives" section showing the top items via shared cards.
- The Command Center's separate "Action + Meetings 360 workboard", "Due &
  overdue actions", and "Recently resolved" panels — their content now lives in
  Needs Attention / This Week / Recently Decided.
- The `/operations` officer dashboard (a near-duplicate of the Command Center)
  became a five-card entry point.
- The Weekly Execution page's standalone "Initiatives Needing Attention"
  section (it duplicated the initiatives agenda section directly above it).
- The Weekly Review stepper page and component.
- Portfolio / Projects / Weekly Review left the primary workspace nav (8 tabs
  → 5 tabs).
- The Meetings page stopped calling itself a second "Weekly Command Center".

No data, query layer, or action/meeting functionality was removed.

## Empty States

Every unified section teaches the system instead of saying "nothing here":

- Loose ends: *"No loose ends. Every meeting output has either been resolved or converted into an action."*
- Communications: *"No communications are waiting to be sent."*
- Initiatives: *"No initiatives need leadership attention right now."*
- Agenda: *"No urgent agenda items. Review active initiatives or create a new discussion topic."*

## What Was Intentionally NOT Built

- Slack / Gmail integration or any real message sending
- AI extraction from notes
- Parent portal, applicant review redesign, full CRM
- Gantt charts, dependency maps beyond the existing secondary views
- Permissions overhaul or workflow automation engine
- Any new XP / gamification surface inside operations

This pass made the existing surface feel unified; it did not add product
surface.

## Related Docs

- [Action + Meetings 360 Operating System](./action-meetings-360-operating-system.md)
- [Weekly Execution OS](./weekly-execution-os.md)
- [Strategic Initiatives OS](./strategic-initiatives-os.md)
