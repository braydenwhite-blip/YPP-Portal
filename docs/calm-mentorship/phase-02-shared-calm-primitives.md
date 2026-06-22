# Phase 02 — Shared Calm mentorship primitives

**Risk:** low · **Depends on:** Phase 01 · **Unblocks:** 03–11

## Objective
Thin mentorship-specific presentational components built on existing Calm primitives, so every mentorship
surface renders consistently in Calm and Executive without bespoke markup.

## Routes affected
None (components only).

## Files likely to add
- `components/mentorship/calm/mentorship-focus-card.tsx` — wraps `PrimaryFocusCard` for
  `NextMentorshipFocus` (kickoff/reflection/review/session/etc.).
- `components/mentorship/calm/mentorship-row.tsx` — wraps `SimpleRow`/`TrackerRow` with color-status chip.
- `components/mentorship/calm/color-status-chip.tsx` — `GoalRatingColor` → label/color from
  `lib/mentorship-canonical.ts` (Purple/Green/Yellow/Red, supportive copy).
- `components/mentorship/calm/index.ts`.
- `tests/components/mentorship/calm-primitives.test.tsx`.

## Files likely to change
- None (pure additions). May add exports to a mentorship component barrel if present.

## Data-model changes
None.

## Reuse
`components/command-center/simple.tsx`, `components/ui-v2/*`, `lib/mentorship-canonical.ts` (rubric
labels/colors/copy — already centralized), `components/command-center/command-mode.tsx`
(`CalmOnly`/`ExecutiveOnly`/`CalmCollapse`).

## UI changes
New shared building blocks only; not yet wired into pages.

## Functionality changes
None.

## Tests
Snapshot/role render of focus card + row + chip; supportive copy for RED status; chip color mapping.

## Completion criteria
Components render for each focus kind and color; reuse existing primitives (no new CSS system);
`typecheck`/`lint`/tests green.
