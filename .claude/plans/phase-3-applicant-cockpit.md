# Phase 3 — Applicant Cockpit (interviewer view)

## Goal

The cockpit page (`/applications/instructor/[id]`) is shared with the
chair workflow but the **interviewer** has two specific touchpoints
that need polish:

1. The "Open Interviewer Workspace" callout (the entry point to the live
   workspace).
2. The read-only "Interview Reviews" list (showing other interviewers'
   submitted scorecards while writing their own).
3. The pre-interview brief surface that's actually rendered inside the
   live workspace page (`InterviewerBriefCard.tsx`) — this is the heart of
   Phase 3 because it's the most inline-styled file in the codebase
   touched by the interviewer.

## Files touched

| File | Change |
|---|---|
| `components/instructor-applicants/InterviewerBriefCard.tsx` | Full rewrite — class-based premium hierarchy using the `.iv-brief-*` classes |
| `app/(app)/applications/instructor/[id]/page.tsx` | Reskin the interviewer callout (`.iv-cockpit-callout`); polish the Interview Reviews list (`.iv-cockpit-review-card`) |
| `app/globals.css` | Append `.iv-brief-*` and `.iv-cockpit-*` classes |

No backend, no schema, no permissions, no routing changes.

## UX deltas

- Brief becomes a single elevated card with a clear eyebrow ("Pre-
  interview brief"), bold name, subject pills, confidentiality reminder,
  and a colored slot-status banner (success when confirmed, warning when
  not).
- Rough course plan moves into a tinted sub-panel with consistent label
  + value rows.
- Reviewer note gets a real blockquote with the brand purple left rule.
- Documents become a compact two-row list, with green tint for uploaded
  and dim "Not uploaded" badge for missing.
- Motivation video becomes a single-tap card with play icon.
- Cockpit interviewer callout uses the same purple gradient style as the
  next-action banner, with a clear CTA arrow.
- Interview Reviews list uses the new card class with the existing
  rubric chip + a polished `iv-status-badge` for the recommendation.

## Risks

- The Brief is rendered inside a `<details>` on the live workspace page
  today. We're not changing that disclosure here — Phase 4 will move
  the brief to a sibling card and possibly add a "during interview"
  condensed mode. Phase 3 only re-skins it.
- The cockpit page is also opened by chairs and admins. The callout is
  guarded by `actorIsInterviewer`, so chairs won't see the new look.

## Acceptance criteria

- `npm run typecheck` passes (only pre-existing baseUrl deprecation).
- Visual: brief renders cleanly with subject pills, slot banner, plan
  panel, optional reviewer quote, document rows, video card.
- No data is missing — every field from the previous brief is rendered.
- Cockpit interviewer callout link still routes to `/interview`.
- Existing `Interview Reviews` rows still render the rubric chip and
  link "Edit my review" for the active interviewer.

## Commit

```
feat(interviews): redesign applicant review cockpit (interviewer view)

Rebuild InterviewerBriefCard from inline styles to the new .iv-brief-*
class system: confidentiality eyebrow, slot banner with success/warning
states, tinted plan panel with consistent fields, reviewer quote,
compact document list, motivation video card.

Polish the cockpit interviewer callout (gradient + clear CTA) and the
read-only Interview Reviews list (premium card + status badge for the
recommendation). All preserves existing data, routing, and permissions.
```
