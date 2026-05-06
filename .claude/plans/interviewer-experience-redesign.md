# Interviewer Experience Redesign — Master Plan

Branch: `claude/design-interviewer-experience-5hX27`

This is the architect's plan for transforming the interviewer-side product
from "functional" to "premium." It does **not** change backend logic.

## North Star

The interviewer should react with: *"This is elite. I evaluate faster.
Nothing is in my way. The product helps me make better decisions."*

Reference quality bar: Linear, Stripe, Ashby, Notion, Vercel.

## Authority

We may freely change frontend architecture, file layout, component
structure, styling, IA, microinteractions, accessibility, and shared UI
systems.

We may **not** change:

- Database schema
- API behavior or route handlers
- Server actions' FormData/Input contracts
- Permissions
- Status transitions
- Scoring/rubric value sets
- Existing happy-path workflows

## Surfaces

See `interviewer-ux-audit.md` for the full surface map and pain-point
catalogue. In brief:

1. Interview Command Center (`/interviews`)
2. Applicant Cockpit (`/applications/instructor/[id]`)
3. **Live Interview Workspace** — centerpiece (`/applications/instructor/[id]/interview`)
4. Pre-Interview Brief (rendered inside the workspace)
5. Schedule client — light pass only

## Design system additions

A new `.iv-*` ("Interviewer View") layer extends the existing `--ypp-*`,
`--cockpit-*`, `--progress-*` tokens. We don't replace them — we compose.

### Tokens to add (semantic, resolve to existing hex)

```
--iv-surface
--iv-surface-raised
--iv-border
--iv-border-strong
--iv-line-faint

--iv-success-surface     /* was #f0fdf4 */
--iv-success-border      /* was #bbf7d0 */
--iv-success-ink         /* was #166534 */

--iv-warning-surface     /* was #fffbeb */
--iv-warning-border      /* was #fde68a */
--iv-warning-ink         /* was #b45309 */

--iv-info-surface
--iv-info-border
--iv-info-ink

--iv-danger-surface
--iv-danger-border
--iv-danger-ink

--iv-accent              /* var(--ypp-purple-600) */
--iv-accent-soft         /* var(--ypp-purple-100) */
--iv-accent-ink          /* var(--ypp-purple-700) */

--iv-shadow-card         /* premium soft shadow */
--iv-shadow-dock         /* sticky dock shadow with purple tint */
--iv-shadow-toast
```

### Class library to add

| Class | Purpose |
|---|---|
| `.iv-page` | Page wrapper with consistent gutters |
| `.iv-toolbar` | Header row: title + filters + actions |
| `.iv-kpi-strip` | Horizontal scroll of metric tiles |
| `.iv-kpi-tile` | Single metric tile (label, value, delta) |
| `.iv-filter-chip-group` | Pill group of filters |
| `.iv-filter-chip` | Single chip with hover, selected, focus-visible |
| `.iv-segmented` | Mac-style segmented control |
| `.iv-card` / `.iv-card-raised` / `.iv-card-accent` | Premium card variants |
| `.iv-task-card` | Task list item polished |
| `.iv-status-badge` (variants: `.is-needs-action`, `.is-scheduled`, `.is-blocked`, `.is-completed`) | Premium status badge with dot icon |
| `.iv-meta-list` | Compact dt/dd grid with consistent type scale |
| `.iv-empty-state` | Centered illustration + headline + helper |
| `.iv-kbd` | Inline keyboard shortcut hint |
| `.iv-section-header` | Kicker + title + helper text + actions |
| `.iv-sticky-dock` | Sticky bottom dock |
| `.iv-submit-dock` | Submit dock variant with validation summary slot |
| `.iv-save-chip` | Premium autosave chip with state |
| `.iv-timer-chip` | Live timer chip |
| `.iv-focus-mode-button` | Toggle focus mode |
| `.iv-question-nav` | Vertical / horizontal question list |
| `.iv-question-nav-item` (`.is-asked`, `.is-skipped`, `.is-untouched`, `.is-active`) | Item |
| `.iv-tag-chip` (variants: tone-success/warning/danger/info) | Tag toggle |
| `.iv-rating-grid` / `.iv-rating-option` | Rating selector with 4-color tokens |

### Shared primitives (`components/interviews/ui/`)

- `StatusBadge.tsx` — `<StatusBadge tone="needs-action">Needs Action</StatusBadge>`
- `Kbd.tsx` — `<Kbd>⌘</Kbd><Kbd>S</Kbd>`
- `EmptyState.tsx` — `<EmptyState title helper action />`
- `MetaList.tsx` — `<MetaList items={[...]} />` for label/value rows
- `SectionHeader.tsx` — kicker + title + helper, with optional right-aligned slot
- `IvCard.tsx` — semantic Card primitive with `tone` and `accent` props (or just classes; primitive optional)

## Phase ordering

1. **Foundation** — tokens + classes + primitives (additive only; nothing breaks)
2. **Dashboard / Queue** — visible improvement to every interviewer
3. **Applicant Cockpit (interviewer view)** — pre-interview surface polish
4. **Live Interview Workspace** — centerpiece rebuild + shortcuts
5. **Scorecard / Recommendation** — rubric, missing-fields, submit dock
6. **History / Audit** — past reviews + timeline polish
7. **Responsive / A11y / Polish** — focus rings, ARIA, narrow-viewport
8. **Final QA** — typecheck, vitest, build, manual sanity

Each phase ends in a clean commit. Implementation proceeds only after the
plans for all phases are committed.

## Risk register

| Risk | Mitigation |
|---|---|
| Splitting 1,152-line editor breaks autosave timing | Keep state ownership in parent component; subcomponents are presentational |
| FormData field names drift | Hidden inputs preserved verbatim; covered by review at code time |
| Vitest test for editor breaks | Run after every editor change; component query selectors should remain valid |
| Schedule client regressed by CSS-class refactor | Phase 7 only — class names map 1:1 to existing inline styles |
| Visual regressions on chair side | Strictly avoid touching `.cockpit-*` selectors used by chair; new classes are `.iv-*` namespaced |
| Keyboard shortcuts collide with browser/OS | Use J/K + Cmd+S (save) + Cmd+Enter (submit); skip when focus is in a typing element for global keys other than save/submit |

## Acceptance signals (what "done" looks like)

- All eight phases committed with conventional-commit messages.
- `npm run typecheck` clean.
- `npm run lint` clean (or only pre-existing warnings).
- `npm run test` (vitest) — all tests pass, including
  `interview-review-editor.test.tsx`.
- `npm run build` succeeds.
- Manual smoke:
  - `/interviews` loads, filters work, task action forms still submit.
  - Cockpit page loads, brief card renders, interviewer workspace link works.
  - Live workspace: type a note → autosave fires; mark asked/skipped works;
    add custom follow-up; submit with missing fields shows validation;
    submit with all fields submits successfully; keyboard shortcuts work.
  - All chair-side routes still look identical.

## Files we expect to touch

| Phase | Files |
|---|---|
| 1 | `app/globals.css` (append section), new files in `components/interviews/ui/` |
| 2 | `components/interviews/{interview-hub,interview-task-card,interview-filters,interview-next-action}.tsx` |
| 3 | `components/instructor-applicants/InterviewerBriefCard.tsx`, `app/(app)/applications/instructor/[id]/page.tsx` (interviewer callout block + interview reviews list) |
| 4 | `components/instructor-review/interview-review-editor.tsx` → split into `components/instructor-review/live/*`; `app/(app)/applications/instructor/[id]/interview/page.tsx` |
| 5 | (within Phase 4 modules) `RecommendationDock`, `OverallEvaluation`, `CategoriesPanel`, `SubmitDock`, validation banner |
| 6 | Cockpit `Interview Reviews` block; `ApplicantTimelineFeed` rows |
| 7 | `app/(app)/interviews/schedule/interview-schedule-client.tsx` (status → CSS), `app/globals.css` responsive + a11y rules |
| 8 | No code; checks + minor fixes |

## Files we will not touch

- `lib/interviews/*.ts`
- `lib/instructor-review-actions.ts`
- `lib/instructor-interview-live.ts`
- `lib/instructor-review-config.ts`
- `prisma/**`
- All API route handlers under `app/api/`
- All chair / final-review / cockpit-sidebar files
- `lib/auth-supabase.ts`, `lib/feature-gates.ts`, `lib/feature-flags.ts`
- All other modules outside the interviewer surfaces
