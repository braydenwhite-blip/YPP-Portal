# Interviewer-Side UX Audit

Audit of every screen and component the interviewer touches. This is the
evidence base for the redesign plan in
`./interviewer-experience-redesign.md` and the per-phase plans in this
directory.

Out of scope: chair / final review cockpit (already redesigned in
`FINAL_REVIEW_REDESIGN_PLAN.md`).

## Surfaces audited

| # | Surface | Route | Primary file |
|---|---------|-------|--------------|
| 1 | Interview Command Center | `/interviews` | `app/(app)/interviews/page.tsx` + `components/interviews/*` |
| 2 | Interview Scheduling | `/interviews/schedule` | `app/(app)/interviews/schedule/interview-schedule-client.tsx` (2,040 lines, mostly inline-styled) |
| 3 | Applicant Cockpit | `/applications/instructor/[id]` | `app/(app)/applications/instructor/[id]/page.tsx` |
| 4 | Live Interview Workspace | `/applications/instructor/[id]/interview` | `app/(app)/applications/instructor/[id]/interview/page.tsx` + `components/instructor-review/interview-review-editor.tsx` (1,152 lines) |
| 5 | Pre-Interview Brief | (rendered inside #4) | `components/instructor-applicants/InterviewerBriefCard.tsx` |
| 6 | Next-Action footer | (rendered inside #3) | `components/instructor-applicants/ApplicantNextActionBar.tsx` |

## What already works well (preserve)

- **Autosave model** in `interview-review-editor.tsx:407–442` — debounced
  1.5s, clear `idle/dirty/saving/saved/error` states, monotonic seq guard.
- **Question runner concept** — bank items + custom follow-ups, per-question
  status, tags, notes, ratings. Conceptually right; just needs UX polish.
- **Validation summary** in `collectMissingFields()` (lines 529–569) —
  field-by-field list shown above the form on submit attempt.
- **Cockpit shell tokens** — the `--cockpit-*` and `--ypp-*` token system,
  `.cockpit-panel`, `.cockpit-section-kicker`, `.cockpit-detail-grid`,
  `.cockpit-stack` are clean primitives we can extend.
- **Sticky next-action bar** at the bottom of the cockpit — strong pattern.
- **Filter URL contract** in `interview-filters.tsx` (server-rendered, share-
  able links).
- **Backend layering** is clean: `lib/interviews/{types,workflow,command-
  center-data}.ts` already abstract task-shape from page rendering.

## Pain points (per surface)

### 1. Interview Command Center (`/interviews`)
- Filter pills are pure inline-style links, no visual feedback beyond color
  swap (`interview-filters.tsx:42–57`).
- "Next Best Action" callout duplicates the first task verbatim; users see the
  same card twice.
- No KPI strip — interviewer can't see at a glance: *3 needs action, 1
  scheduled today, 2 awaiting recommendation*.
- Inline-form task cards: `complete_hiring_interview_and_note` renders a 4-
  field form *inside* the card (`interview-task-card.tsx:61–96`). Card
  becomes bloated; preview vs. edit is unclear.
- Stage pill colors are okay but lack iconography or count.
- "More" disclosure hides blockers and secondary links — discoverability tax.
- No empty-state illustration; just `<p className="empty">…</p>` (the `.empty`
  class isn't even defined in globals.css → falls back to default styling).

### 2. Interview Scheduling (`/interviews/schedule`)
- 2,040 lines, mostly inline styled. `STATUS_STYLES` and `DOMAIN_STYLES`
  const objects (lines 25–82) — should be CSS classes.
- Calendar grid is cramped; no slot hover affordance.
- No timezone hint when posting slots.
- Workflow status groups blend together visually.

This is a lower-frequency interviewer surface; rebuild deferred. Phase 7
will move status colors to CSS classes only.

### 3. Applicant Cockpit (`/applications/instructor/[id]`)
- The interviewer-relevant callout (lines 483–500) is a generic
  `cockpit-panel-compact cockpit-workspace-callout`; doesn't visually
  distinguish itself from other panels for the interviewer audience.
- Interview Reviews list (lines 433–481) is text-heavy; would benefit from
  the rubric chips we already render on the overall review.
- Reviewer note appearance is buried inside the review section.

### 4. Live Interview Workspace (the centerpiece)
- 1,152-line single component → hard to maintain; mixes layout, state,
  payload construction, validation, save logic.
- **No keyboard shortcuts.** Live interviews demand them: jump-to-next-
  unanswered, save now, mark-asked, mark-skipped, focus mode.
- **Save chip** is small, top-right; easy to miss when the cursor is in the
  notes textarea.
- **No timer** — interviewers must check OS clock.
- **No focus mode** — chrome and rails are always visible, distracting.
- **No sticky submit dock** — submit buttons are at the very bottom of a long
  form; if validation fails, the alert is at the top, requiring big scrolls.
- **Status buttons** (Mark Asked / Mark Skipped) lack obvious selected
  affordance; `is-selected` class exists but visual diff is minimal.
- **Tag chips** lack `aria-pressed` and visual feedback parity.
- **Question nav** in the rail uses index + competency text; no asked / skipped
  iconography next to the number — interviewers eye-scan slower than they
  could.
- **Pre-interview brief** is inside a `<details>` collapsed by default at the
  bottom of the page; many interviewers will never open it.
- **Validation summary** scrolls out of view; no inline jump links to fix
  fields.

### 5. Pre-Interview Brief (`InterviewerBriefCard.tsx`)
- 100% inline-styled. No reusable classes. Hardcoded hex colors (`#6b21c8`,
  `#f0fdf4`, `#fffbeb`, `#bbf7d0`, …) instead of tokens.
- Section labels are uppercase muted text; visual rhythm is okay but not
  premium.
- Document list mixes "uploaded" and "missing" states with very similar
  styling.

### 6. Next-Action Footer
- Logic is good. Tighter visual hierarchy + a kbd hint would lift it.

## Design system gaps

- No `.iv-*` (interviewer-view) namespace yet. We need:
  - KPI strip / metric tiles
  - Polished filter chip group + segmented control
  - Premium task card variants
  - Sticky toolbar
  - Sticky submit dock with validation summary
  - Kbd hint pill
  - Focus-mode chip
  - Timer chip
  - Status badge variants (ASKED / SKIPPED / UNANSWERED with iconography)
- Several callouts use raw hex colors that should be tokens; we'll add
  semantic surface tokens (`--iv-success-surface`, etc.) that resolve to the
  same hex but become editable in one place.

## Top 8 wins (prioritized)

1. Rebuild Live Interview Workspace into modular components + add keyboard
   shortcuts, sticky submit dock, focus mode, timer, jump-to-next.
2. Replace inline styles in `InterviewerBriefCard.tsx` with class-based
   premium hierarchy.
3. Extract Interview Schedule status colors to CSS classes (low-risk, high-
   maintainability).
4. Add KPI strip + polished filter chips to `/interviews` hub.
5. Refactor `interview-task-card.tsx` to separate preview from edit
   (move inline forms into a disclosure / drawer).
6. Add focus rings, ARIA semantics across all interviewer interactive
   elements (`aria-pressed` on toggle chips, `role="tablist"` on question
   nav, `aria-live="polite"` on save chip).
7. Promote rubric chips into the cockpit Interview Reviews list for fast
   scanning.
8. Make pre-interview brief a sibling, not a hidden `<details>` — open by
   default in a collapsible card, plus a "during interview" condensed mode.

## Components: refactor vs. rebuild

| Component | Verdict |
|---|---|
| `InterviewHub` | Refactor — keep structure, polish |
| `InterviewTaskCard` | Rebuild — separate preview from inline forms |
| `InterviewFilters` | Refactor — chip group + segmented control |
| `InterviewerBriefCard` | Rebuild — class-based |
| `InterviewReviewEditor` | Rebuild as modular set under `live/` |
| `ApplicantCockpitHeader` | Keep — minor polish |
| `ApplicantNextActionBar` | Keep — add kbd hint |
| `InterviewScheduleClient` | Defer rebuild; CSS-class status colors only |

## Constraints / non-negotiables

- Form action signatures (`saveInstructorInterviewReviewAction`,
  `saveInstructorInterviewLiveDraftAction`, server actions in
  `interview-task-card.tsx`) must keep the same FormData/Input contracts.
- `INSTRUCTOR_REVIEW_CATEGORIES`, `PROGRESS_RATING_OPTIONS`,
  `INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS` value sets unchanged.
- Existing test in `tests/components/interview-review-editor.test.tsx`
  (asked-progress, custom follow-up add, autosave) must still pass.
- Status transitions in `lib/interviews/workflow.ts` unchanged.
- All routes, permissions, schema unchanged.
