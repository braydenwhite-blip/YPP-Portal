# Phase 04 — Relationship detail (mentor + admin)

**Risk:** med · **Depends on:** 01, 02, 03

## Objective
Rebuild the per-pair detail surfaces so the dominant purpose is "act on this relationship": status +
current cycle + next focus + active goals + open commitments, with one clear next step. Fix the
placeholder operational-context links.

## Routes affected
- `/mentorship/mentees/[id]` (mentor view).
- `/admin/mentorship/relationships/[mentorshipId]` (admin view).

## Files likely to change
- `app/(app)/mentorship/mentees/[id]/page.tsx`.
- `app/(app)/admin/mentorship/relationships/[mentorshipId]/page.tsx` (reassign / status forms preserved).

## Files likely to add
- `_components/relationship-detail-calm.tsx` + `relationship-detail-executive.tsx` (shared between mentor
  and admin where possible).

## Data-model changes
None (decisions D2/D3 may add nullable fields later; default reuse `MentorshipSession.notes`).

## Reuse
Phase-01 VM, `reassignProgramMentor`/`setProgramMentorshipStatus`, `getOperationalContextForEntity`
(only when `isOperationsHubEnabled()`), `MentorshipActionItem` queries.

## UI changes
Calm: status + cycle + next-focus card + active goals + open commitments; CTA = the single next step.
Executive: full session history, point ledger, ops context, audit inline.

## Functionality changes
Operational-context links rendered **only** when ops hub enabled; otherwise hidden (no placeholder).
All existing reassign/status actions preserved.

## Tests
Calm vs Executive render; ops links hidden when flag off; reassign/status still persist; mentee-invisible
data excluded from any mentee-facing view.

## Completion criteria
Both views render both densities; no placeholder links; existing mutations intact; tests + `typecheck` +
`lint` green.
