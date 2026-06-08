# Action Tracker 3.0 — The Central Nervous System

This folder is the **audit-first** response to the "Action Tracker 3.0" kickoff: evolve the
Action Tracker from a productivity tool into the operating system that connects mentorship,
chapters, leadership, projects, and student growth — by making mentorship and chapters the
primary retention, leadership, and community engines of YPP.

Per the kickoff's mandate, **no implementation has begun.** This is the mandatory audit plus
the evolution design and phasing.

## Read in order

1. **[`00-ECOSYSTEM-AUDIT.md`](./00-ECOSYSTEM-AUDIT.md)** — the mandatory, code-grounded audit.
   Current architecture, data model, role/permission model, all three action systems,
   mentorship, chapters, leadership/instructor pipelines, points/recognition/engagement,
   projects, dashboards, analytics, automation, the connectivity map, the 10 audit questions,
   and retention leaks / dead ends / missing transitions.

2. **[`01-ARCHITECTURE-AND-ROADMAP.md`](./01-ARCHITECTURE-AND-ROADMAP.md)** — the evolution
   design: the Mission→Goal→Milestone→Action hierarchy, typed links, the event-driven
   Generation Engine, Parts A–L (journey map, Mentorship 2.0, matching, dashboards, Chapter OS,
   leadership hierarchy, projects, chapter health, leadership pipeline, network effects,
   analytics, implementation strategy), and the **M1 / M2 / C1 / C2 / N1** phasing — each phase
   independently deployable behind its own flag.

## The one-sentence finding

The platform already has exactly **one** tightly FK-integrated nervous system
(`Mentorship → Goals → Reviews → Points`); the Action Tracker is the right spine but is
relationally an **island** wired to everything else by loose strings — so "Action Tracker 3.0"
is fundamentally a **connectivity + automation** problem, solved by evolution, not a rebuild.

## Relationship to prior planning

This roadmap consolidates and supersedes the scattered prior plans rather than restarting them:
`../people-strategy-operating-system-plan.md`, `../ypp-operating-system-maximum-pass-plan.md`,
`../action-experience-overhaul-plan.md`, `../portal-consolidation-plan.md`,
`../../MENTORSHIP_REDESIGN_PLAN.md`, `../../PEOPLE_STRATEGY_COMMAND_CENTER_PLAN.md`,
`../../INTEGRATION_MAP.md`.
