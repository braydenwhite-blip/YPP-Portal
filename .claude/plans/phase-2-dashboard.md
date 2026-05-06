# Phase 2 — Dashboard / Queue (`/interviews`)

## Goal

Make `/interviews` feel like Linear's Inbox or Ashby's Pipeline:
glanceable counts, premium chips, scannable cards, obvious next action,
zero clutter. Behavior is unchanged — the URL contract, server actions,
and task-derivation logic in `lib/interviews/` are preserved.

## Why second

It's the highest-frequency interviewer surface — every interviewer hits
this page first. A great hub sets expectations for everything downstream.

## Files touched

| File | Change |
|---|---|
| `app/(app)/interviews/page.tsx` | Light: pass KPI data through; tighten topbar |
| `components/interviews/interview-hub.tsx` | Rebuild layout: KPI strip + grouped sections + better empty states |
| `components/interviews/interview-filters.tsx` | Replace inline-styled pills with `.iv-filter-chip` group + segmented control |
| `components/interviews/interview-next-action.tsx` | Premium "Next best action" hero with kbd hint and concrete CTA |
| `components/interviews/interview-task-card.tsx` | Rebuild — preview header always visible, inline forms move into a disclosure (`Open action ↘`) so the card stays compact |
| `lib/interviews/command-center-data.ts` | Optional: derive KPI counts (`needsActionCount`, `scheduledTodayCount`, `awaitingRecommendationCount`) into the returned shape. Pure addition. |
| `lib/interviews/types.ts` | Add `kpis` field to `InterviewCommandCenterData` (additive) |

No backend, no DB, no permission, no route changes.

## UX deltas

### Hero / topbar
- Remove redundant "Next Best Action" duplicate of the first task. Replace
  with a one-line summary: *"3 actions waiting. Next: confirm Sam's slot
  for Thu 3pm."* with a kbd hint (`G` to go).
- The existing "Scheduling" link stays; restyle to `.button.outline.small`
  + add a `+ Post Slots` icon affordance.

### KPI strip (new)
- 4 tiles, derived in `getInterviewCommandCenterData`:
  - **Needs my action** (count, purple accent)
  - **Scheduled today** (count, info)
  - **Awaiting recommendation** (count, warning)
  - **Completed this week** (count, success)
- Each tile is a button — click filters the list.

### Filters
- "Scope" (All / Hiring / Readiness) — segmented control.
- "View" (Mine / Team) — segmented control, only when `canTeamView`.
- "State" (All / Needs Action / Scheduled / Completed / Blocked) — chip group.
- All tied to URL params via `next/link`, exactly as today.

### Sections
- Three sections (Needs Action, Upcoming, Completed) — same as today.
- Section header uses `.iv-section-header` with kicker + count chip.
- Empty state: `EmptyState` primitive instead of `<p className="empty">`.
- Each task card uses the new `.iv-task-card` shell.

### Task card
- **Compact mode** (default):
  - Left: identity row — applicant + position/chapter, then status badge.
  - Middle: detail string (single line, ellipsized at 2 lines).
  - Right: primary action button.
- **Disclosure**: "Show form ↘" reveals the inline form for the few task
  types that have one (`complete_hiring_interview_and_note` etc.). On
  expand, the textareas/selects appear *inside the card body*, not
  spilling over.
- Blockers and secondary links live in a thin "details" footer that's
  always visible when there's content (no more `<details>`).

### Microinteractions
- Card hover: subtle lift + accent border on the left edge.
- Action button focus: 2px purple ring.
- Status badge dot color matches the tone.

## State / data

`InterviewCommandCenterData` gains an optional `kpis` field:

```ts
kpis: {
  needsAction: number;
  scheduledToday: number;
  awaitingRecommendation: number;
  completedThisWeek: number;
};
```

Computed inside `getInterviewCommandCenterData` after `filtered` is built,
from the same arrays already loaded — no extra DB queries.

## Risks

- Inline forms moving into a disclosure changes default visibility for two
  task types. Mitigation: keep the disclosure auto-open when a task is in
  the "Needs My Action" section, so behavior matches today's "form is
  visible by default" feel for the high-priority cases.
- KPI computation must be cheap. We compute from arrays already in memory.

## Acceptance criteria

- All filter combinations still produce the same tasks as before.
- All server-action submissions (confirm slot, complete + note, etc.)
  still go through correctly.
- KPI tiles reflect counts that match the rendered sections.
- `npm run typecheck`, `lint`, `test`, `build` all green.
- Manual smoke: confirm a slot, post slots (link out), submit a
  recommendation note — all behave as today.

## Commit

```
feat(interviews): upgrade interviewer dashboard experience

Rebuild /interviews with a KPI strip, premium filter chips and segmented
controls, polished section headers, and compact task cards that disclose
inline forms cleanly.

Server-action contracts and task derivation in lib/interviews are
unchanged. Adds an optional `kpis` field to InterviewCommandCenterData
computed from the in-memory task arrays.
```
