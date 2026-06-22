# Phase 01 — Canonical model & selectors

**Risk:** low · **Depends on:** nothing · **Unblocks:** all UI phases (02–11)

## Objective
Add a single pure, serializable, server-built mentorship view-model + selectors that every Calm and
Executive surface consumes, so no surface re-derives mentorship state. No UI change in this phase.

## Routes affected
None (library only).

## Files likely to add
- `lib/mentorship/view-model.ts` — types (see README "Shared view-model").
- `lib/mentorship/selectors.ts` — `buildMentorshipViewModel(viewer, data, now)`, role resolution,
  `selectNextFocus`, privacy filtering.
- `tests/lib/mentorship/view-model.test.ts`.

## Files likely to change
- None functional. Optionally re-export from an existing `lib/mentorship` index if one exists.

## Data-model changes
None. Reads canonical models only (`Mentorship`, `MentorshipSession`, `MentorGoalReview`,
`MonthlySelfReflection`, `GRDocumentGoal`, `MentorshipActionItem`, `MentorshipRequest`).

## Reuse (do not re-implement)
`getSimplifiedMentorKanban`, `getMentorEngagementSnapshot`, `getInstructorMentorshipMembership`
(`lib/mentorship-access.ts`), `getLeadershipContext`/`getMenteeMentorshipView`,
`getAdminMentorshipCommandCenterData`, `goal-review-actions`, `self-reflection-actions`,
`mentorship-gr-binding`, rubric copy + thresholds from `lib/mentorship-canonical.ts`,
`operationalState`/`dueLabel` from `lib/command-center/shared.ts`.

## UI changes
None.

## Functionality changes
None (additive library). Selector must treat `MonthlySelfReflection.cycleNumber` as authoritative over
`Mentorship.cycleStage`, and must drop mentee-invisible fields (unreleased reviews, private notes).

## Tests
- Role resolution: mentor / mentee / chair / admin / dual-role.
- `selectNextFocus` priority ordering (kickoff > reflection/review due > chair approval > session >
  commitment > feedback > support).
- Privacy: mentee VM excludes drafts/private notes/confidential feedback.

## Completion criteria
Selectors return a correct `MentorshipViewModel` for fixture data across all roles; unit tests green;
`typecheck` + `lint` pass; no other files changed.
