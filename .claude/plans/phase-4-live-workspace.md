# Phase 4 — Live Interview Workspace (centerpiece)

## Goal

Make the live interview feel like an editor that *helps* the
interviewer instead of one they have to fight. Add the keyboard
shortcuts, focus mode, sticky submit dock, jump-to-next-unanswered, and
live timer that the audit identified as the highest-value missing
features. Preserve every label, FormData field, autosave timing, and
test-asserted behavior.

## Why now

Most interviewer time is spent here. Improvements compound across every
hire.

## Strategy

Layer the new UX over the existing editor instead of fully splitting the
1,152-line component. Splitting risks regressions in the autosave
sequence and the test contract. The features are achievable additively:

- A new `live/` subfolder houses small focused helpers (hooks,
  presentational chips, sticky dock layout).
- The orchestrator gains state for `focusMode`, `helpOpen`, and `timer`,
  plus a memoized `Shortcut[]` consumed by `useKeyboardShortcuts`.
- The hero region gains buttons for jump-to-next, timer, focus mode, and
  help — the existing save chip is replaced by the new `<SaveChip>`.
- The bottom action buttons move into a sticky `SubmitDockShell` (still
  inside the form so native FormData submit works unchanged).
- The page chrome (`/applications/instructor/[id]/interview/page.tsx`)
  is reskinned with a slim sticky topbar, removing the redundant outer
  card.

A future Phase 4b can complete the full module split (ProgressRail,
QuestionRunner, etc.); the API surface won't change.

## Files touched

| File | Change |
|---|---|
| `components/instructor-review/live/use-interview-timer.ts` | New hook: HH:MM:SS timer with start/pause/toggle/reset |
| `components/instructor-review/live/use-keyboard-shortcuts.ts` | New hook: declarative shortcut registration with typing-target guard |
| `components/instructor-review/live/SaveChip.tsx` | New component: a11y-friendly autosave status chip |
| `components/instructor-review/live/SubmitDock.tsx` | New layout shell for the sticky submit dock |
| `components/instructor-review/live/KeyboardHelp.tsx` | New modal panel listing shortcuts |
| `components/instructor-review/interview-review-editor.tsx` | Wire focusMode + timer + jump-to-next + shortcuts + dock; replace hero save chip + bottom actions; preserve labels |
| `app/(app)/applications/instructor/[id]/interview/page.tsx` | Slim sticky topbar; brief moves to a sibling collapsible (still hidden by default but not buried) |
| `app/globals.css` | Append `.iv-live-*` chrome (topbar, content wrapper, sticky dock, jump button, help overlay/panel, brief grid, focus-mode rules that compose with `.live-*`) |

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `?` | Toggle keyboard shortcut help |
| `J` | Next question |
| `K` | Previous question |
| `N` | Jump to next unanswered |
| `A` | Mark current asked |
| `S` | Mark current skipped |
| `F` | Toggle focus mode |
| `T` | Toggle timer |
| `⌘ S` / `Ctrl S` | Save draft now (works in textarea too) |
| `⌘ ↵` / `Ctrl ↵` | Submit review (works in textarea too) |

Letter shortcuts are disabled while focus is in an `<input>`,
`<textarea>`, `<select>`, or contenteditable, so typing isn't
interrupted.

## Focus mode

Toggling on hides the progress rail, widens the question card, and
expands the notes textarea. The shell adds `.is-focus-mode`; existing
`.live-*` rules continue to render the inside.

## Sticky submit dock

Always visible at the bottom of the viewport while editing. Shows the
save state, "N required fields left" or "Ready to submit", and the two
submit buttons. Buttons are real `<button type="submit" name="intent">`
elements inside the form so the existing handler logic and FormData
contract are untouched.

## What does NOT change

- `INSTRUCTOR_REVIEW_CATEGORIES`, `PROGRESS_RATING_OPTIONS`,
  `INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS` — same value sets.
- `liveDraftAction` payload shape and 1.5s debounce.
- All hidden inputs:
  `applicationId`, `returnTo`, `categoriesJson`, `questionResponsesJson`,
  per-category notes/ratings, recommendation, summary, etc.
- Test labels (`Mark Asked`, `Add Follow-Up Question`,
  `Notes on candidate answer`, `Custom follow-up`, `1 incomplete`).
- Validation summary copy and trigger conditions.

## Risks

- The keyboard shortcut hook captures the latest `activeQuestion` and
  `setQuestionStatus` via the memo's deps array; verified by reading the
  call sites.
- Focus mode and sticky dock are CSS-only on top of the existing
  `.live-*` styles, so visual diffs are minimal.

## Acceptance criteria

- `npm run typecheck` passes (only pre-existing baseUrl deprecation).
- Existing vitest cases still pass (verified by label-grep — actual
  vitest run blocked in sandbox without node_modules).
- Manual smoke: open workspace → press `?` → see help → press `N` → jump
  to next unanswered → press `A` → mark asked → type a note → see
  autosave chip transition idle → dirty → saving → saved → press `⌘S`
  → save fires immediately → press `⌘↵` → submit fires (with
  validation if required fields missing).

## Commit

```
feat(interviews): rebuild live interview workspace UI

Layer the major UX upgrades over the existing live workspace:

- Keyboard shortcuts (?, J, K, N, A, S, F, T, ⌘S, ⌘↵) via
  useKeyboardShortcuts; letter keys disabled while typing.
- Live HH:MM:SS interview timer (start/pause via T key or chip).
- Focus mode (F) hides the progress rail and widens the question card.
- "Jump to next unanswered" button with a live count.
- Premium SaveChip with state-tinted backgrounds.
- Sticky SubmitDockShell at the bottom — Save Draft and Submit are
  still real form buttons inside the form, so the FormData contract is
  preserved.
- KeyboardHelp modal (?) lists every shortcut.
- Workspace page gets a slim sticky topbar; the brief lives as a
  sibling section.

No backend, no FormData, no autosave timing, no test-asserted labels
changed.
```
