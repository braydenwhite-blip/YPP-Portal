# YPP Portal Automation Brain

A reusable **automation-intelligence layer** that turns raw portal data into a
living operating guide for Chapter Presidents and global leadership. It does not
replace the existing Chapter Operating System — it is a thin, additive layer that
**normalizes** the engine the portal already has and adds the genuinely-missing
intelligence on top.

> Built reuse-first. A full Phase-1 audit confirmed the portal already has a
> mature deterministic engine (`lib/chapters/*`): a blocker/needs-attention
> generator, per-class launch readiness, two-stage curriculum review, partner +
> instructor pipeline rules, week-keyed impact-meeting prep, and a
> student-community attendance/retention model. The brain **reuses all of it**
> and adds: a 12-week playbook interpreter, a multi-stage chapter stage detector,
> a canonical automation-item contract, a chapter-wide readiness aggregate, a
> workflow recipe registry, and a leadership escalation read model.

## What it answers

- What stage is this chapter in? → `stage-detector.ts`
- What is supposed to happen this week, and what hasn't? → `playbook.ts`
- What's overdue / blocked / next? → the ranked `AutomationItem[]`
- What should leadership notice? → `escalation.ts`
- What to bring to the next impact meeting? → `impact-meeting-prep.ts`

## Architecture (layered)

| Layer | Where | Reuse vs new |
|------|-------|--------------|
| **1 Facts** | `ChapterFacts` (built from `loadChapterOS`) | REUSE — zero new DB reads |
| **2 Signals** | `lib/chapters/{pipeline,curriculum-review,launch-readiness,student-community}.ts` | REUSE verbatim |
| **3 Items** | `AutomationItem` (`types.ts`) via `normalize/*` + `rules/cadence.ts` | normalize existing + new cadence/playbook items |
| **4 Workflows** | `workflows.ts` recipe registry | new (declarative reference) |
| **5 Surfaces** | `components/automation/*` | new (embeddable, reuse `ui-v2`) |
| **6 Resolution** | stable ids + dismissal overlay (`assemble.ts`) | new (read-model; persistence deferred) |

### Canonical contract — `AutomationItem`

Pure, serializable (ISO dates), with full explainability: `type`, `workflow`,
`severity`, `urgency`, `why` (evidence + playbook rule), `resolvesWhen`,
`escalation`, `impactMeetingRelevance`, `playbookWeekRelevance`, deterministic
`id` (`lib/automation/item-identity.ts`). 40 item types across 11 workflows.

### Key modules (`lib/automation/`)

- `types.ts` — `AutomationItem`, `ChapterFacts`, type/severity/workflow registries
- `date-helpers.ts` — pure date math (re-exports `businessDaysBetween`)
- `item-identity.ts` — deterministic, stable ids (for dedup + future dismissal)
- `rank.ts` — urgency scoring + ordering
- `playbook.ts` — **12-week interpreter** (expected/done/missing/overdue, reuses `getPlaybookTargetsForWeek`)
- `stage-detector.ts` — **multi-stage** chapter stage detection
- `readiness.ts` — chapter-wide launch readiness checklist (5 areas)
- `impact-meeting-prep.ts` — wraps `buildImpactMeetingPrep`, adds structured evidence + items
- `escalation.ts` — leadership escalation read model
- `workflows.ts` — 15 workflow recipes
- `normalize/{from-blockers,from-student-needs}.ts` — project existing engine → `AutomationItem`
- `rules/cadence.ts` — net-new signals (weekly check-ins, observations, Session 2, advertising heuristic, playbook pacing)
- `assemble.ts` — **pure** aggregator (unit-tested)
- `build-chapter-automation.ts` — `server-only` loader (`loadChapterAutomations`, one `loadChapterOS` call)
- `partner-automation.ts` / `leadership-escalations.ts` — reusable exports for the partner pass + leadership dashboard

## Where it's wired

1. **Chapter home** (`app/(app)/chapter/page.tsx`) — `ChapterAutomationSection`
2. **Chapter operating system** (`app/(app)/chapter/operating/page.tsx`) — same section, pure-assemble path (no extra DB read)

Reusable exports for other passes: `loadChapterPartnerAutomation` +
`WorkflowAutomationCard` (partner pass), `loadLeadershipEscalations` +
`EscalationPanel` (leadership dashboard).

## Persistence (deferred, by design)

Automation is a **pure read model** today. Dismiss/snooze is contract-ready
(`canDismiss`/`canSnooze` + stable ids + an overlay parameter on `assemble`),
but no DB table was added this pass because the Prisma engine download is
network-blocked in this environment (a migration could not be verified). When a
future pass adds it, the minimal additive table is:

```prisma
model AutomationDismissal {
  id                String   @id @default(cuid())
  chapterId         String
  automationItemKey String   // the deterministic AutomationItem.id
  userId            String
  action            String   // "DISMISSED" | "SNOOZED"
  snoozedUntil      DateTime?
  createdAt         DateTime @default(now())
  @@unique([chapterId, automationItemKey, userId])
  @@index([chapterId])
}
```

Pass the rows to `loadChapterAutomations(chapterId, { dismissals })` — no other
change needed. Tracking a real task already uses the existing `ActionItem` bridge
(`lib/chapters/operating-actions.ts`), not this table.

## Tests

`tests/lib/automation/*` — 40 unit tests (playbook by week, stage detector,
readiness, date helpers, item identity, rank, normalizers, impact-meeting prep,
escalation rules, end-to-end assemble). All pass under vitest.
