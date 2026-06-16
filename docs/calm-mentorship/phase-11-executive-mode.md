# Phase 11 — Executive Mode parity

**Risk:** med · **Depends on:** 03–10

## Objective
Guarantee every rebuilt mentorship surface has a full-density Executive variant so no leadership workflow
regresses when a user switches to Executive mode.

## Routes affected
All in-scope mentorship surfaces (mentor home, mentees, relationship detail, sessions, goals, commitments,
feedback, admin hub, applications, matching).

## Files likely to change
- The `*-executive.tsx` components introduced in Phases 03–10 (fill in full density where stubbed).
- `app/(app)/admin/mentorship/page.tsx` — Executive retains the existing 8-tab cockpit; Calm shows triage.

## Files likely to add
- Any missing `*-executive.tsx` variants.

## Data-model changes
None.

## Reuse
`ExecutiveOnly`/`CalmOnly`/`useIsExecutive`, ui-v2 (`TrackerShell`, `MetricStrip`, `KeyFactsGrid`),
existing dense panels (`_panels/*`, kanban, analytics) as the Executive content.

## UI changes
Executive = today's full density (tables, every lane, analytics, ledgers); Calm = focus + short lists.

## Functionality changes
None (composition only). Executive must expose every action available before the rebuild.

## Tests
For each surface: Executive renders full density and all controls; Calm hides advanced detail behind
progressive disclosure; toggle switches without losing state.

## Completion criteria
No leadership action is missing in Executive; parity tests green; `typecheck`/`lint` pass.
