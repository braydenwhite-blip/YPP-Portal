# Phase 09 — Matching, support & enable Mentorship 2

**Risk:** HIGH (production exposure) · **Depends on:** 01, 02, 04

## Objective
Calm the admin matching/assignment + support-request surfaces, verify the M2 intake→match→pair flow
end-to-end, then enable `ENABLE_MENTORSHIP_2` (Decision D6: only after verification).

## Routes affected
- `/admin/mentorship` (assignments triage), `/admin/mentorship/applications`,
  `/admin/mentorship/applications/[id]`, `/my-mentor/apply`, support-request surfaces.

## Files likely to change
- `app/(app)/admin/mentorship/page.tsx` (calm triage for needs-attention/assignments),
  `_panels/matching-panel.tsx`, `mentee-matching-board.tsx`.
- `app/(app)/admin/mentorship/applications/page.tsx` + `[id]/page.tsx`,
  `components/mentorship-2/{matching-recommendations,application-decision,mentee-command-center}.tsx`.
- `app/(app)/my-mentor/apply/*`.
- `.env.example` / deployment config note for `ENABLE_MENTORSHIP_2`.

## Files likely to add
- Calm wrappers for application queue + decision surfaces.

## Data-model changes
None (M2 migrations already exist: `20260608170000_*`, `20260608180000_*`). Enabling is a config flip.

## Reuse
`lib/mentorship-2/recommendations/actions.ts` (`generateRecommendationsForApplication`,
`approveRecommendation`→creates `Mentorship`), `application-actions.ts`, `matching/score.ts`+`rank.ts`,
legacy `lib/mentor-match-actions.ts`, `lib/feature-flags.ts` (`isMentorship2Enabled`).

## UI changes
Calm: one application at a time (top recommendation + approve); support requests as assigned focus.
Executive: full scored board + legacy matching panel.

## Functionality changes
Flip `ENABLE_MENTORSHIP_2=true` after verifying intake→recommend→approve→pair. Approval creates the
canonical `Mentorship` (idempotent). Rollback = unset env var.

## Tests
M2 enabled-path tests (`tests/lib/mentorship-2/*`): generate, shortlist/hold/reject, approve→pair;
application status transitions; admin-only/applicant-only reads; calm vs executive; gate tests
(`tests/app/admin-mentorship-gates.test.ts`).

## Completion criteria
M2 works end-to-end with flag ON; no half-built screen reachable; matching + support calm; privacy
enforced; full validation (Phase 12) green before the flag flip ships.
