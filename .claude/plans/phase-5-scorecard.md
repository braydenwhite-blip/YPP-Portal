# Phase 5 — Scorecard / Recommendation flow

## Goal

The bottom half of the editor — overall rating, per-category rating,
recommendation, summary — is where the interviewer's signal becomes
permanent. Make it fast and unambiguous to fill in correctly.

## Files touched

| File | Change |
|---|---|
| `components/instructor-review/interview-review-editor.tsx` | Replace recommendation `<select>` with a 4-up button group; add `RECOMMENDATION_TONES` map; insert "Coverage" recap row above the per-category section |
| `app/globals.css` | Append `.iv-recommendation-*` and `.iv-category-recap-*` classes |

## UX deltas

### Recommendation
Before: a `<select>` with four options — easy to misclick, no visual
weight, no semantic color.

After: a button-group of four cards (Accept = green, Accept with Support
= blue, Hold = amber, Reject = red). Each card shows label + the
existing description copy. Active state borders + tints in the tone's
color. Hidden input still posts `name="recommendation"` so the action
contract is unchanged.

### Coverage recap
A horizontal chip row above the per-category list. Each chip is a
category name + a colored dot (or dashed dot if not yet rated). The dot
color matches the rating's `color`/`bg` from
`PROGRESS_RATING_OPTIONS`. Hover shows the rating's short label.
Lets the interviewer scan "have I covered everything" in 1 second.

## What stays the same

- Required-field validation (revisionRequirements, applicantMessage,
  per-category notes/ratings).
- The per-category cards themselves and the overall rating grid (those
  already use the `.review-rating-*` classes which look fine).
- All hidden inputs and FormData posted to the server action.

## Acceptance criteria

- `npm run typecheck` passes.
- Selecting a recommendation card surfaces in the dock (because the
  validation re-runs against `recommendation`).
- The recap chips light up as each category gets a rating.
- The form still posts a valid `recommendation` value through the
  hidden input.

## Commit

```
feat(interviews): polish scorecard + recommendation flow

Replace the recommendation <select> with a tone-coded 4-up button
group; hidden input preserves the FormData contract. Add a "Coverage"
recap above the per-category section with a chip per category that
lights up in the rating's color (or shows a dashed placeholder if not
yet rated).
```
