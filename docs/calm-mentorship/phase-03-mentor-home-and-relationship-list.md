# Phase 03 — Mentor home & relationship list (+ mentee home)

**Risk:** med · **Depends on:** 01, 02

## Objective
Rebuild the mentor home (`/mentorship`), the mentee roster (`/mentorship/mentees`), and the mentee home
(`/my-mentor`) as Calm/Executive surfaces using the shared VM — Calm shows one focus + a short list;
Executive keeps full kanban/engagement density.

## Routes affected
- `/mentorship`, `/mentorship/mentees`, `/my-mentor`.

## Files likely to change
- `app/(app)/mentorship/page.tsx` (build VM server-side, render split client component).
- `app/(app)/mentorship/_components/mentor-command-center.tsx`, `mentor-priority-list.tsx`,
  `mentor-command-strip.tsx`, `mentor-engagement-panels.tsx`, `mentee-dashboard.tsx`.
- `app/(app)/mentorship/mentees/page.tsx` (+ `mentor-roster`).
- `app/(app)/my-mentor/page.tsx`.

## Files likely to add
- `app/(app)/mentorship/_components/mentor-home-calm.tsx` + `mentor-home-executive.tsx`.
- `app/(app)/my-mentor/_components/mentee-home-calm.tsx` + `mentee-home-executive.tsx`.
- Render tests under `tests/` for calm/executive variants.

## Data-model changes
None.

## Reuse
Phase-01 VM, Phase-02 primitives, `components/home/leadership-home.tsx` split pattern,
`getSimplifiedMentorKanban`/`getMentorEngagementSnapshot`, `getLeadershipContext`.

## UI changes
Calm: `MentorshipFocusCard` + small "your mentees" list (status colors), supportive empty state.
Executive: existing kanban + command strip + engagement panels (preserved).

## Functionality changes
No action changes — only composition/density. All existing links/CTAs preserved.

## Tests
Calm renders one focus + short list; Executive renders full density; mentee home shows mentor card +
supportive next step; dual-role banner cross-links `/mentorship` ↔ `/my-mentor`.

## Completion criteria
Three surfaces render both densities, all existing actions intact, no flash, `typecheck`/`lint`/tests
green, `nav:check` passes.
