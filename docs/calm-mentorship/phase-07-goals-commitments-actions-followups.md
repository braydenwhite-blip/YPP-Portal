# Phase 07 — Goals, commitments, Actions & Follow-Ups

**Risk:** med · **Depends on:** 01, 02, 04

## Objective
Calm goal and commitment surfaces, with a one-click bridge from a mentorship commitment to an org Action
(no duplicate tracking).

## Routes affected
- `/my-mentor/goals`, `/my-mentor/progress`, commitment surfaces on relationship detail.

## Files likely to change
- `app/(app)/my-mentor/goals/page.tsx`, `app/(app)/my-mentor/progress/page.tsx`.
- Relationship detail commitment section (Phase 04 components).

## Files likely to add
- `_components/goals-calm.tsx`, `commitments-calm.tsx`.

## Data-model changes
**Decision D1.** Default: reuse `ActionItem.relatedEntityType:"MENTORSHIP"` for the bridge (no schema).
If a back-link is needed, add nullable `MentorshipActionItem.linkedActionId` (additive, backfill-free).

## Reuse
`GRDocumentGoal` + `mentorship-gr-binding`, `MentorshipActionItem` CRUD, `createActionItem`
(`lib/people-strategy/action-items-actions.ts`) with `relatedEntityType:"MENTORSHIP"`,
`captureActionCompletion`. Rubric color from `lib/mentorship-canonical.ts`.

## UI changes
Calm: active goals with color status + "update progress"; open commitments as rows with due labels + CTA
(complete / convert to Action). Executive: full G&R doc, KPIs, history.

## Functionality changes
"Create Action" bridge is manual + idempotent (guard against double-create). Mentee goal edits are
proposals where permissions require.

## Tests
Goal render/update; commitment complete; bridge creates exactly one linked Action; idempotency; calm vs
executive.

## Completion criteria
Goals + commitments work both densities; bridge non-duplicating; permissions enforced; tests/`typecheck`/
`lint` green.
