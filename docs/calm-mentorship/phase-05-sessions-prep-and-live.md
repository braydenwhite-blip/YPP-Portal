# Phase 05 — Sessions: scheduling, prep & live

**Risk:** med · **Depends on:** 01, 02, 04

## Objective
Make the next session the calm focus: schedule → prepare → run. One "next session" focus card, a prep
checklist linked to the upcoming review, and a lightweight live capture surface.

## Routes affected
- `/mentorship/schedule`, `/my-mentor/schedule`, session detail/prep views, `/mentorship/chair/prep-packet`.

## Files likely to change
- `app/(app)/mentorship/schedule/page.tsx`, `app/(app)/my-mentor/schedule/page.tsx`.
- Chair prep-packet page.

## Files likely to add
- `_components/session-focus-card.tsx`, `session-prep-checklist.tsx`, `session-live-capture.tsx`.

## Data-model changes
None required. (D3: optional nullable `MentorshipSession.summary` deferred to Phase 06 if approved.)

## Reuse
`lib/mentorship-scheduling-actions.ts`, `MentorshipSession`/`MentorshipScheduleRequest`/
`MentorAvailabilityRule`/`Override`, Phase-01 VM (`SessionSummary`, `NextMentorshipFocus` kind `session`).

## UI changes
Calm: "next session" focus + request/confirm; prep checklist; live capture (agenda, notes, attendance).
Executive: full calendar + all sessions + availability management.

## Functionality changes
No new persistence beyond existing scheduling actions; live capture writes to existing
`MentorshipSession` fields (`notes`, `attendedIds`).

## Tests
Schedule request → confirm → session; prep checklist derives from upcoming review; live capture writes
attendance/notes; calm/executive variants.

## Completion criteria
Scheduling and capture work end-to-end in both densities; existing actions intact; tests/`typecheck`/
`lint` green.
