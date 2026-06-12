# Knowledge OS V2 — Phase 3C Implementation Notes

**Scope shipped:** the **live interview workspace rebuilt on ui-v2/Tailwind**
(`/applications/instructor/[id]/interview` + the 1.6k-line live question
runner), the **review editors rebuilt** on a shared editor vocabulary, the
**chair cockpit inner panels** converted to ui-v2 tokens, **CSS deletion
milestone 4** (2,106 lines removed; freeze baseline lowered to **11,598**),
and the **first SearchDocument cutover** (the person group, with a live
fallback). Companion to the master plan (§16, §22.6, §24) and the Phase
3A/3B notes.

## Interview workspace — rebuilt on ui-v2

All live-runner behavior preserved unchanged: question navigation and
grouping, asked/skipped status capture, answer tags, suggested + custom
follow-ups, guidance callouts and the don't-read-aloud cheatsheet, the
scratch/follow-up notepad (localStorage), the 1.5s-debounced autosave
(`saveInstructorInterviewLiveDraftAction`), the interview timer, focus
mode, keyboard shortcuts + help overlay, submit validation
(`collectMissingFields`), the locked read-only state, and the submit flow
(`saveInstructorInterviewReviewAction`).

- **Page** (`[id]/interview/page.tsx`): sticky top bar (back to applicant,
  **Application 360** link for admins, View brief), Tailwind content
  shell, pre-interview brief as a calm disclosure.
- **`interview-review-editor.tsx`** fully converted: hero with jump/timer/
  focus/help controls, notepad, legend, the sticky progress rail (counts,
  alerts, section breakdown, question navigator with status bubbles and
  must-ask stars), the question card (prompt, guidance labels with colored
  dots, learn/note callouts, strong-answer/red-flag cheatsheet, follow-up
  suggestions, notes, tag chips), overall evaluation, per-category rubric,
  recommendation options, coverage recap chips, validation summary, and
  the locked notice — every `.live-*`/`.iv-*` modifier family replaced
  with explicit Tailwind tone maps.
- **`SaveChip`** (status tones incl. pulsing save), **`SubmitDockShell`**
  (sticky dock), **`KeyboardHelp`** (overlay) rebuilt.
- **`InterviewerBriefCard`** rebuilt (slot confirmed/warning states, plan
  fields, reviewer quote, documents, motivation video).
- Concrete labels only: Asked/Skipped, n required fields left, "Ready to
  submit", per-category ratings with visible inputs.

## Review editors — shared vocabulary

`components/instructor-review/editor-classes.ts` holds the Tailwind
vocabulary both editors share (panel, notice, callout, warning, category
card, rating grid/option, checkbox row, actions, field label/input) —
replacing the `.review-editor-*`/`.review-rating-*`/`.review-category-*`
globals families. `application-review-editor.tsx` (signals, next step,
applicant message, leadership flag, save/submit intents) and the interview
editor both compose it; rating/recommendation colors stay data-driven from
`instructor-review-config` via inline color/background on the selected
option (the legacy CSS-variable hook pattern, minus the CSS).

## Chair cockpit inner panels

Converted to ui-v2 tokens with the decision lifecycle untouched:
**ScoreMatrix** (reviewer focus highlight + divergence dots intact),
**RisksPanel** (severity groups + HIGH_RISK acknowledgements intact),
**ActivityFeed** (pin/quote/focus dimming intact), **PinnedSignalsRail**,
and the **ReviewSignalFeed** / **DecisionSummaryCard** card chrome.
Modals, banners, and toasts (transient chrome) deliberately keep their
existing inline styles over the kept `:root` tokens — visually identical,
next on the conversion list.

## CSS deletion milestone 4 — EXECUTED (2,106 lines)

`globals.css`: **13,704 → 11,598** (freeze baseline lowered). 317+ blocks.

**Deleted families** (each class token grep-verified at zero real
consumers — import-path and comment matches excluded): all `.live-*`
interview-runner families (workspace/hero/save-chip/grid/progress/
question-nav/question-card/status/guidance/followup/tag/notepad/legend/
field-hint/custom-grid/add-question), `.review-editor-*`,
`.review-rating-*`, `.review-category-*`, `.review-checkbox-row`,
`.required-star`, `.application-review-editor`, `.iv-brief*`,
`.iv-live-*` (shell/topbar/content/jump/help/submit-dock),
`.iv-save-chip*`, `.iv-timer-chip`, `.iv-focus-mode-button`,
`.iv-recommendation-*`, `.iv-category-recap*`, `.iv-locked-notice*`,
`.iv-validation-summary`, and the consumer-free `.iv-card-interactive`.

**Why safe without Playwright (validation run):**

1. Scripted audit: every class with the candidate prefixes extracted from
   `globals.css` and grep-verified per token across app/components/lib/
   tests, with import-path matches filtered out; the deletion predicate
   removed a rule only when every comma-part contained a dead token, and
   mixed groups (e.g. the reduced-motion list shared with the live
   `/interviews` hub) were split with live members kept.
2. Brace-balance + leftover-selector scans on the final file.
3. Typecheck, production build, `css:freeze-check` (11,598), lint on
   touched files, the interview-editor component tests (10), and the full
   suite (identical to the pre-existing baseline) all green.

**Intentionally kept (live consumers):** the `/interviews` hub families —
`.iv-card*`, `.iv-task-card*`, `.iv-hub-*`, `.iv-filter-*`, `.iv-kpi-*`,
`.iv-section*`, `.iv-segmented`, `.iv-toolbar*`, `.iv-page`, `.iv-kbd*`,
`.iv-empty-state*`, `.iv-meta-list`, `.iv-status-badge*`,
`.iv-hint-cluster` — plus `.form-row`/`.form-grid`/`.input`/`.button`,
`.slideout-*`, and the `:root` cockpit/score/ink tokens.

**Next deletion milestone (5):** the `/interviews` hub families above once
that surface is rebuilt; then the generic `.card`/`.stat-card`/`.topbar`
families as the remaining leadership/admin pages migrate (plan §22.6
phases 4–5).

## Inline action capture from entity panels

`EntityActionPanel` now accepts an optional `viewer`; rows the viewer can
edit (per `canEditAction` — officers, leads, executors) get compact
**Complete** / **Block** buttons that open the same `ActionStatusCapture`
form inline (`components/work/entity-action-row-capture.tsx`) — the same
`captureActionCompletion` / `captureActionBlocker` mutations, which
re-check permissions server-side. No navigation, no duplicated logic.
Record pages opt in by passing their viewer.

## SearchDocument cutover — person group (started)

- `lib/help-agent/search.ts`: the **person** group now reads the
  `SearchDocument` index (title + keywords, `visibilityTier: "MEMBER"`,
  same ranking and per-group limits) **when the index has person rows**,
  and falls back to the live Prisma query when the index is empty or the
  read throws — the index has no write path yet, so the fallback keeps
  search correct on environments where
  `scripts/backfill-search-documents.ts` has never run.
- Everything else stays live by design: meetings need date context the
  index lacks, initiatives are config-defined (no DB rows), and
  partner/applicant/action subtitles would go stale without write-path
  upserts.
- **New tests** (`tests/lib/help-agent-search.test.ts`, 8): member vs
  officer group tiers, short-query behavior, index-hit path (live query
  skipped, tier filter asserted), empty-index and index-error fallbacks,
  prefix-over-substring ranking, and tier-filtered recents.
- **Remaining cutover work (documented, not started):** write-path
  upserts on User/Partner/InstructorApplication/ActionItem mutations, a
  nightly reconcile run of the backfill, then cutting the
  partner → applicant → action groups in that order; meetings need a
  `dateISO` column and classes a `status` column first; pg_trgm is a
  later optimization.

## Connections

- Interview workspace → applicant workspace (back bar) and → Application
  360 (admin link); the chair cockpit snapshot bar → Application 360
  (Phase 3B); Application 360 → cockpit/full workspace; review editors
  live inside the applicant workspace which links both ways. Help Agent
  application results land on Application 360 where the role-aware CTAs
  branch.

## Validation status (this environment)

- Green: typecheck, lint (touched files), `css:freeze-check` (11,598),
  production build, interview-editor tests (10), live-draft tests, new
  search tests (8), nav contract suite.
- Pre-existing and unchanged: the 4 `nav:check` core-map findings and the
  13 baseline vitest failures in 6 unrelated suites.
- No `DATABASE_URL` → browser smoke not runnable; CSS deletion proceeded
  on static/build validation per the Phase 3C directive.

## Known limitations / next pass

- The `/interviews` hub (scheduling/task surfaces) is still legacy CSS —
  the next rebuild + deletion milestone.
- Chair cockpit modals/banners/toasts still inline-styled over kept
  tokens.
- SearchDocument write-path upserts + nightly reconcile outstanding; only
  the person group reads the index.
