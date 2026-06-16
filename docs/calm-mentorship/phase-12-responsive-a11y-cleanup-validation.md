# Phase 12 — Responsive, accessibility, cleanup & validation

**Risk:** low · **Depends on:** all prior phases

## Objective
Final polish (mobile + a11y), removal of dead/legacy spots, and the full validation sweep before the work
(and the M2 flag flip) ships.

## Routes affected
All in-scope mentorship surfaces.

## Files likely to change
- Responsive/a11y tweaks across the Phase 03–11 components.
- Remove orphan `app/(app)/admin/instructor-mentor-matching/mentor-matching-board.tsx`.
- Reconcile legacy API routes `app/api/mentor/ask`, `app/api/mentor/feedback/request` (route to server
  actions or remove), keeping redirect tests green.

## Files likely to add
- A11y/responsive component tests; e2e additions.

## Data-model changes
None.

## UI changes
Single-column focus-first mobile; ARIA on queue runner, mode toggle, rows; supportive error cards.

## Functionality changes
Remove inert/duplicate controls (see README dead-control audit). No behavior change to live flows.

## Tests
Mobile single-column; ARIA/keyboard; error states; keep `tests/app/mentorship-redirects.test.ts` +
`admin-mentorship-gates.test.ts` green; extend `tests/e2e/smoke/mentorship-homes.spec.ts`.

## Validation sequence
1. `vitest run tests/lib/mentorship tests/lib/mentorship-2`
2. `vitest run tests/lib/queue tests/components/queue-runner.test.tsx`
3. `vitest run tests/components/command-mode.test.tsx tests/lib/command-center`
4. `npm run typecheck`
5. `npm run lint`
6. `vitest run tests/integration tests/app`
7. `npm run build`
8. `npm run nav:check`
9. route + permission verification (per-role login)
10. server/client boundary + hydration review
11. responsive + a11y review
12. dead-control review
13. `npm run test:e2e:smoke`

## Completion criteria
All steps green; no dead controls; mobile + a11y pass; M2 flag flip verified safe; ready to ship.
