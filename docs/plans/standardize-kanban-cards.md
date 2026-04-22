# Standardize Kanban Cards + Restructure Instructor Review Layout

## Context

The instructor hiring flow has three rough UX problems right now:

1. **Inconsistent kanban cards.** The in-use card (`ApplicantPipelineCard`) mixes horizontal and stacked sections, and the legacy `ApplicantCard` still shows numeric "5-dot" scores that were replaced elsewhere by the Red/Yellow/Green/Purple rating system. The cards don't read cleanly.
2. **Initial Review categories don't match Interview Review categories.** Initial Review uses 3 signals ("Rough Class Idea", "Teaching & Communication Promise", "Reliability & Fit") while Interview Review uses 7 categories with different labels. The rubric should be the same language so signals stack naturally across stages.
3. **Detail page is visually cut off** (see attached screenshot). The right "Assigned Reviewer / Interviewers" sidebar overlaps or truncates at narrower widths, the rating buttons are only outlined (hard to read at a glance), and the reviewer widget is always expanded even when the user doesn't need it.

Intended outcome:
- One clean horizontal kanban card style used everywhere, with R/Y/G/P chip instead of score dots.
- Initial Review uses the 4-category rubric (omits Community Fit); Interview Review uses the same 5 + the two extras (Interview Readiness & Professionalism, Subject Matter Fit).
- Rating buttons always show a soft tint; selected = fully saturated fill.
- Reviewer assignment UI moves inline under the Initial Review section, Interviewer assignment UI moves inline under the Interview/Scheduling section, both collapsed by default. The right sidebar shrinks to Documents + Recent Activity only.

---

## Changes

### 1. Update review category config

**File:** `lib/instructor-review-config.ts`

**a. Rename the 5 overlapping categories in `INSTRUCTOR_REVIEW_CATEGORIES`** (keep keys, replace labels and descriptions with the user's exact wording):
- `CURRICULUM_STRENGTH` → label `"Teaching/Instruction"`, description `"Course idea shows promise and applicant shows promise to teach it."`
- `RELATIONSHIP_BUILDING` → label `"Relationships/Personability"`, description `"Applicant shows promise to build strong relationships with parents and students."`
- `ORGANIZATION_AND_COMMITMENT` → label `"Organization/Commitment"`, description `"Application shows applicant is organized and will make necessary commitment."`
- `COMMUNITY_FIT` → label `"Connection to YPP Community"`, description `"Applicant shows signs of connecting to and strengthening the YPP community."`
- `LONG_TERM_POTENTIAL` → label `"Long-Term Potential"`, description `"Application suggests applicant has long-term leadership potential within YPP."`
- Keep `PROFESSIONALISM_AND_FOLLOW_THROUGH` and `SUBJECT_MATTER_FIT` unchanged (interview-only).

**b. Replace `INSTRUCTOR_INITIAL_REVIEW_SIGNALS`** with the 4 keys (order matches interview, omit `COMMUNITY_FIT`):
```ts
export const INSTRUCTOR_INITIAL_REVIEW_SIGNALS = [
  { key: "CURRICULUM_STRENGTH",         label: "Teaching/Instruction", description: "..." },
  { key: "RELATIONSHIP_BUILDING",       label: "Relationships/Personability", description: "..." },
  { key: "ORGANIZATION_AND_COMMITMENT", label: "Organization/Commitment", description: "..." },
  { key: "LONG_TERM_POTENTIAL",         label: "Long-Term Potential", description: "..." },
]
```

**c. Update `PROGRESS_RATING_OPTIONS` helper labels** to match the user's definitions (colors already correct):
- Red: `helperLabel: "No"`, description `"Not ready / clear no."`
- Yellow: `helperLabel: "Maybe / with coaching"`, description `"Maybe — with appropriate coaching."`
- Green: `helperLabel: "Yes"`, description `"Ready / clear yes."`
- Purple: `helperLabel: "Exceptional"`, description `"Exceptionally strong in ways the rest of YPP should learn from."`

**d. `INITIAL_REVIEW_RATING_OPTIONS` (line 115)** — keep filtering out `ABOVE_AND_BEYOND` so Initial Review stays 3-button; Interview keeps all 4.

Verify no other consumer of these keys breaks: search for `CURRICULUM_STRENGTH`, `RELATIONSHIP_BUILDING`, etc. — they're referenced as keys only, so label renames are safe. Also check DB `InstructorApplicationReviewCategory` references in `lib/instructor-application-actions.ts` — keys unchanged so no migration needed.

### 2. Fill the rating buttons (soft tint default, saturated when selected)

**File:** `app/globals.css` (lines 7393–7427)

Replace the `.review-rating-option` base and `.is-selected` blocks:

```css
.review-rating-option {
  min-height: 104px;
  border: 2px solid var(--rating-color);
  border-radius: 8px;
  background: var(--rating-bg);           /* soft tint always */
  padding: 12px;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast),
              box-shadow var(--transition-fast), transform var(--transition-fast);
}

.review-rating-option:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(59, 15, 110, 0.1);
}

.review-rating-option.is-selected {
  background: var(--rating-color);        /* saturated fill */
  border-color: var(--rating-color);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--rating-color) 35%, transparent);
}

.review-rating-option.is-selected div,
.review-rating-option.is-selected span {
  color: #fff;
}
```

The `--rating-color` / `--rating-bg` CSS variables come from `PROGRESS_RATING_OPTIONS` (already set via inline style in both `application-review-editor.tsx` and `interview-review-editor.tsx`), so no TSX changes needed here.

### 3. Restructure the detail page: reviewer widgets move inline

**File:** `app/(app)/applications/instructor/[id]/page.tsx` (lines 259–446)

- Remove the `<ApplicantCockpitSidebar>` block (lines 437–445) and its data plumbing. Slim the sidebar to a new component that renders only Documents + Recent Activity.
- Create a new collapsible helper component `components/instructor-applicants/CollapsibleAssignmentPanel.tsx`:
  - `<details>`-based (native collapse, `open={false}` by default, no client state needed unless we want animation).
  - Summary row shows the title + current assignee chip (e.g., "Assigned Reviewer — Admin Test" or "Not assigned"). Clicking toggles the picker.
  - Body renders children (the `ReviewerAssignPicker` or `InterviewerAssignPicker`).
- In the Initial Review section (line 313–341), mount `<CollapsibleAssignmentPanel title="Assigned Reviewer">` with `<ReviewerAssignPicker …>` inside, shown only when `canAssignReviewer`.
- In the Scheduling/Interview section (line 343–349), mount two `<CollapsibleAssignmentPanel title="Lead Interviewer" / "Second Interviewer">` with `<InterviewerAssignPicker …>` inside, shown only when `canAssignInterviewers`.
- Refactor `components/instructor-applicants/ApplicantCockpitSidebar.tsx`: strip out the Reviewer and Interviewers sections (lines 101–158). Keep only Documents and Recent Activity. Rename props accordingly.
- Data plumbing: the reviewer/interviewer candidate lists currently flow through the sidebar. Pass them directly to the new inline panels from the page. Reuse the existing `getCandidateReviewers` / `getCandidateInterviewers` calls that already run in `page.tsx` (lines ~235–243).

**File:** `app/globals.css`

Add small styling for the new collapsible block (reuses existing `.cockpit-sidebar-card` look) and adjust `.applicant-cockpit-layout` grid so the sidebar column shrinks when the right column is lighter (e.g., change `grid-template-columns` minmax on the sidebar).

### 4. Standardize the kanban card (horizontal, R/Y/G/P chip)

The in-use card is `components/instructor-applicants/ApplicantPipelineCard.tsx` via `InstructorApplicantsCommandCenter.tsx`. It's already mostly horizontal — polish it and replace any legacy score visualization:

**File:** `components/instructor-applicants/ApplicantPipelineCard.tsx`

- Keep the `applicant-pipeline-card-top` row (avatar left, name/chapter right).
- Add a **small R/Y/G/P rating chip** to the card when `app.applicationReviews` has any review with an `overallRating`. Use the latest review's `overallRating` (already available in `pipelineApps` serializer at `page.tsx:194`). Map via `PROGRESS_RATING_OPTIONS` to color/short label. Place the chip in the top-right of `applicant-pipeline-card-top` (same row as the avatar).
- Extend the `PipelineCardApp` type with `applicationReviews?: Array<{ overallRating: string | null }>`.
- Keep subject tags, alerts row, and footer (reviewer/interviewer avatars) as-is.

**File:** `app/(app)/admin/instructor-applicants/kanban-board.tsx` (legacy `ApplicantCard`, lines 120–185)

- Remove the score-dots block (lines 159–180).
- Replace with a single R/Y/G/P chip in the footer, using the same helper/logic as above (read latest `applicationReviews[0].overallRating` if present). Keep `recommendationInfo` pill on the right.
- Migrate `ApplicantCard` to the same horizontal layout (avatar left, name/chapter right) so both cards read identically.

**File:** `components/instructor-applicants/InstructorApplicantsCommandCenter.tsx`

- When building `kanbanItems` (line ~167), pass `applicationReviews` through so the card can read the rating. Verify serializer at `admin/instructor-applicants/page.tsx:194` already includes `applicationReviews[].overallRating`.

**File:** `app/globals.css` / kanban CSS

- Add a `.kanban-card-rating-chip` style: 22px tall rounded pill, filled with `--rating-color`, white bold short label.
- Remove unused `.kanban-card-score`, `.kanban-card-score-dot.*` rules in `components/kanban/kanban-board.css` (lines 337–364).

### 5. Critical files to modify

- `lib/instructor-review-config.ts` — category renames, initial-signals list, rating option copy
- `app/globals.css` — rating-button fill, rating chip, layout tweak
- `app/(app)/applications/instructor/[id]/page.tsx` — inline the reviewer/interviewer widgets
- `components/instructor-applicants/ApplicantCockpitSidebar.tsx` — strip reviewer + interviewers sections
- `components/instructor-applicants/CollapsibleAssignmentPanel.tsx` — **new** wrapper, `<details>`-based
- `components/instructor-applicants/ApplicantPipelineCard.tsx` — add R/Y/G/P chip, tighten horizontal layout
- `app/(app)/admin/instructor-applicants/kanban-board.tsx` — legacy `ApplicantCard` → horizontal + R/Y/G/P chip
- `components/instructor-applicants/InstructorApplicantsCommandCenter.tsx` — pass `applicationReviews` into kanban items
- `components/kanban/kanban-board.css` — remove dead score-dot CSS

### 6. Existing utilities to reuse

- `PROGRESS_RATING_OPTIONS` (`lib/instructor-review-config.ts`) — for rating colors, bg, labels, and the chip color mapping.
- `INITIAL_REVIEW_RATING_OPTIONS` (same file) — keep using it in `application-review-editor.tsx`.
- `getCandidateReviewers`, `getCandidateInterviewers` (already called in `page.tsx`) — reuse for the new inline panels instead of piping through the sidebar.
- `ReviewerAssignPicker`, `InterviewerAssignPicker` — mount as-is inside the new collapsible wrapper.
- Native `<details>`/`<summary>` — avoids adding a new client component for collapse state.

---

## Verification

1. `npm run typecheck` and `npm run lint` — should pass cleanly.
2. `npm run dev`, then:
   - **Kanban** (`/admin/instructor-applicants`): confirm every card shows avatar-left / name-right, no score dots, and an R/Y/G/P chip for cards whose applicants have a submitted review. Drag a card across columns — still works.
   - **Detail page** (`/applications/instructor/[id]`): confirm the right sidebar now only shows Documents + Recent Activity. The Initial Review section has a collapsed "Assigned Reviewer" panel that expands to reveal the picker. The Interview/Scheduling section has collapsed "Lead Interviewer" / "Second Interviewer" panels. No visual overlap at narrow widths.
   - **Initial Review rubric**: shows 4 categories with the new labels (Teaching/Instruction, Relationships/Personability, Organization/Commitment, Long-Term Potential). Rating buttons show soft tint by default, fully saturated with white text when selected.
   - **Interview Review rubric**: shows 7 categories (5 renamed + Interview Readiness & Professionalism + Subject Matter Fit). 4-way rating (Red/Yellow/Green/Purple) fills same way.
3. Submit a draft Initial Review and an Interview Review end-to-end — confirm saved category keys in DB still resolve (keys unchanged, only labels changed).
4. Check `/admin/instructor-applicants/chair-queue` — uses `overallRating` typing too; ensure no regression.
