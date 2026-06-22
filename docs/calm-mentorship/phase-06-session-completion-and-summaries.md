# Phase 06 — Session completion & summaries

**Risk:** med · **Depends on:** 05

## Objective
Turn session completion into a calm, two-field close (what happened + one commitment), and surface a
short shared summary to the mentee while keeping private notes private.

## Routes affected
- Session detail/completion under `/mentorship/schedule` and `/mentorship/mentees/[id]`.

## Files likely to change
- Session completion component(s); relationship detail (to show latest summary).

## Files likely to add
- `_components/session-complete-form.tsx`.

## Data-model changes
**Decision D3.** Default: reuse `MentorshipSession.notes` (private) + a short shared summary derived from
the review/commitment. If approved, add nullable `MentorshipSession.summary` (additive, backfill-free) to
separate shared summary from private notes. Migration only if D3 = Option B.

## Reuse
Existing `MentorshipSession` completion fields (`completedAt`, `attendedIds`, `notes`); Phase-07 commitment
creation; `buildUnifiedTimeline` for activity.

## UI changes
Calm: complete = "what happened" + optional "one commitment" → done. Mentee sees a short summary only.
Executive: full session record incl. private notes (permission-gated).

## Functionality changes
Completion may create a `MentorshipActionItem` commitment (idempotent). Private notes never shown to mentee.

## Tests
Completion persists; summary visible to mentee, private notes not; optional commitment created once;
timeline event recorded.

## Completion criteria
Completion flow works both densities; privacy enforced in fetcher; (if D3=B) migration is nullable +
reversible; tests/`typecheck`/`lint` green.
