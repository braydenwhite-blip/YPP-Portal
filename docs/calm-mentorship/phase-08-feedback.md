# Phase 08 — Feedback

**Risk:** low-med · **Depends on:** 01, 02

## Objective
Calm feedback surfaces (request + respond), with confidentiality preserved exactly as today.

## Routes affected
- `/mentorship/feedback`, `/mentorship/ask`, mentee "request help".

## Files likely to change
- `app/(app)/mentorship/feedback/page.tsx`, `app/(app)/mentorship/ask/page.tsx`.

## Files likely to add
- `_components/feedback-calm.tsx`.

## Data-model changes
None (Decision D4 = keep current visibility model).

## Reuse
`lib/feedback-actions.ts` (`createFeedbackRequest`, `respondToFeedback`, `markResponseHelpful`),
`lib/mentor-ask-actions.ts`, `requestMonthlyFeedback`/`submitFeedbackResponse`
(`lib/people-strategy/feedback-request-actions.ts`), `lib/people-strategy/feedback-permissions.ts`
(`canReadFeedbackResponses`, `redactFeedbackResponseBody`).

## UI changes
Calm: pending requests as the focus + respond inline; supportive empty states.
Executive: all threads + request controls + history.

## Functionality changes
None to persistence. Confidential responses remain leadership/board-only; subject cannot read own
confidential peer feedback.

## Tests
Request/respond persist; confidentiality (subject redacted); mark-helpful; calm vs executive; extend
`tests/lib/mentor-feedback-copy.test.ts`.

## Completion criteria
Feedback flows work both densities; confidentiality verified by test; tests/`typecheck`/`lint` green.
