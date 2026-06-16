# Phase 10 — Queue & People 360 integration

**Risk:** med · **Depends on:** 01, 04–09

## Objective
Surface mentorship work as resolvable My-Queue loops and add a mentorship panel to People 360.

## Routes affected
- `/work/queue` (My Queue), People-360 drawer (cross-surface).

## Files likely to add
- `lib/queue/from-mentorship.ts` (the 10 sources below).
- `tests/lib/queue/from-mentorship.test.ts`.

## Files likely to change
- `lib/queue/engine.ts` (fold mentorship items into `rankQueueItems`).
- `lib/queue/types.ts` (extend `QueueInline` union: `mentorship_review`, `mentorship_session`,
  `mentorship_commitment`).
- `components/queue/queue-inline-panels.tsx` (render new inline kinds).
- `lib/queue/queue-actions.ts` (mutations + `revalidatePath`).
- `lib/operations/entity-360-queries.ts` (`loadPerson360` → mentorship panel data),
  `lib/operations/entity-360.ts` (`Entity360` type), `components/operations/entity-360-body.tsx` (Section).
- `lib/queue/from-work-hub.ts` (give quiet-mentorship an inline capability).

## Queue sources (each with a real completion condition — no generic "Resolve")
kickoff pending · reflection due · review due · chair approval · changes requested · overdue commitment ·
open support request · pending feedback · quiet mentorship (add inline) · M2 needs-recommendations /
recs-ready. (Full table in README + main plan.)

## Data-model changes
None (resolve from source state; no dismissal field).

## Reuse
`QueueItem`/`QueueInline` (`lib/queue/types.ts`), `buildQueueEngine`, `operationalState`, existing inline
panel pattern, `loadPerson360` pairings, `hasMentorshipMenteeAccess` for panel access.

## UI changes
Queue runner shows mentorship loops with why + recommendedMove + inline panel; 360 drawer gains a
Mentorship section (role, partner, cycle, next focus, last/next session, open commitments).

## Functionality changes
Inline resolution updates the source record then revalidates every queue surface; items disappear when the
underlying condition clears.

## Tests
Per-source generation + completion + permission; inline panels; 360 panel render + access control; extend
`tests/lib/queue/{engine,selectors,runner-logic}.test.ts`, `tests/components/queue-runner.test.tsx`.

## Completion criteria
All mentorship loops generate and resolve inline; 360 panel renders with correct permissions; tests/
`typecheck`/`lint` green.
