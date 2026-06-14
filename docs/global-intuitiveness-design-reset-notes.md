# Global Intuitiveness + Design System Reset — Phase Notes

**Branch:** `claude/global-intuitiveness-design-reset`
**Date:** June 2026
**Intent:** Make the whole portal feel simple, obvious, premium, and coherent —
*without* adding features or new complexity. This pass set the global design/
intuitiveness doctrine, promoted three proven layout patterns into shared `ui-v2`
primitives, adopted them on the highest-traffic surfaces, and cleaned up the worst
user-facing jargon.

This is a continuation of `docs/tracker-ux-simplification-notes.md` and the Knowledge
OS phases (2A–3F). Those passes already rebuilt `/work`, `/people`, `/partners`,
`/interviews`, leadership Home, action/meeting trackers, and classes on `ui-v2`. The
remaining problem was **legibility, not capability** — so this pass is mostly doctrine
+ shared primitives + copy, not page rebuilds.

## The new source of truth

**`docs/ypp-global-intuitiveness-design-system.md`** is now the binding product/design
doctrine: page anatomy, tracker/record/cockpit anatomy, table/filter rules, CTA
hierarchy, status language, empty/loading/error rules, search-first rules, drawer/
preview rules, copywriting, route consolidation, the density budget, `ui-v2` usage
rules, the "never again" anti-patterns, and a per-page ship checklist. Every future
page must pass its five-second test and its checklist.

`docs/ypp-tailwind-design-system-v2-plan.md` was updated to point at the doctrine and
to register the new primitives (Tranche 2b).

## Primitives added (generic, adopted, not one-offs)

All in `components/ui-v2/` (Tailwind-only, no `globals.css`), exported from
`components/ui-v2/index.ts`:

- **`ViewSwitcher`** (`view-switcher.tsx`) — the one segmented "which view am I on?"
  control, deliberately distinct from filters. Views are links (URL state).
- **`AdvancedFilters`** (`advanced-filters.tsx`) — the one "More filters" disclosure
  (native `<details>`, server-renderable, auto-opens when a deep filter is active).
- **`MetricStrip`** (`metric-strip.tsx`) — data-driven, **hard-capped** (`max=5`)
  click-to-filter `StatCardV2` strip. Enforces the density budget so no page quietly
  grows a seventh headline tile.
- **`lib/ui/status-language.ts`** — not a component: the single status vocabulary
  (`STATUS_LANGUAGE`, `humanStatus()`, `BANNED_STATUS_WORDS`, `isVagueStatusWord()`).
  One approved label + tone per concrete state; the banned vague-mood words in one
  reviewable place. Unit-tested in `tests/lib/status-language.test.ts`.

Existing primitives already cover the rest of the doctrine's named patterns, so they
were **not** rebuilt: `TrackerStartCard` (= Start here / recommended next step),
`EmptyStateV2` + action, `ActionButtonGroup` / `PageHeaderV2 actions` (= primary action
bar), `RecordSection` / `SectionHeaderV2` (= section summary).

## Pages simplified (adoption + density)

- **`/work`** — replaced the hand-rolled view-chip loop with `ViewSwitcher`, and the
  raw `<details>` status block with `AdvancedFilters`. View-switching and filtering now
  read as two different things.
- **Leadership Home** (`components/home/leadership-home.tsx`) — moved the stat strip to
  `MetricStrip` and **dropped the redundant 6th "Upcoming meetings" tile** (it
  duplicated the Upcoming meetings section directly below), leaving a coherent,
  attention-first 5-card strip that matches the page's subtitle.
- **`/partners`** — moved the 5 stat cards to `MetricStrip`, the views to
  `ViewSwitcher`, and folded the always-visible flag chips **and** the type filter into
  a single collapsed `AdvancedFilters` disclosure. Default visible controls dropped
  from "5 views + 2 flags + N type chips" to "5 views + search".
- **`components/interviews/interview-filters.tsx`** — deleted the duplicated local
  `Segmented` component and adopted the shared `ViewSwitcher` for Scope/View.

## Navigation & labeling changes (user-facing only; hrefs untouched)

`nav:check` only validates hrefs/uniqueness, so labels were free to improve:

- `/chapter` label **"Command Center" → "Chapter Home"** (catalog + the CP nav layout +
  the page eyebrow + all six `← Command Center` sub-page back-links, for coherence).
  "Command Center" kept as a search alias.
- `/operations/data-360` label **"Data 360" → "Connected data"** ("Data 360" kept as a
  search alias).
- `/scheduling` label **"Scheduling Hub" → "Scheduling"** (dropped the "Hub" suffix).
- Dashboard descriptions de-jargoned: Home, `/interviews`, `/actions/meetings` no
  longer say "command center"; `/chapter` description dropped the vague "health".
- `lib/page-helper/registry.ts`: the Home help entries (default + ADMIN/INSTRUCTOR/
  STUDENT overrides) changed **"command center" → "home base"**.
- `app/(app)/admin/applications/page.tsx`: **"Application Pipeline" → "Applications"**;
  **"Interview Command Center" → "Interviews"** on its banner/CTA.
- The instructor-readiness banners (admin + chapter-lead) now say **"Open Interviews"**
  instead of "Open Interview Command Center".

Internal route names, loaders (`getInterviewCommandCenterData`), comments, and search
aliases were intentionally left alone — they are not user-facing chrome.

## Status / copy language

- One concrete vocabulary now lives in `lib/ui/status-language.ts` and is documented in
  doctrine §11. Banned standalone words (Health/Pulse/Momentum/Readiness/Risk/Fit/…)
  are enumerated and tested.
- The doctrine's copywriting section (§15) makes "plain noun titles + one-sentence
  subtitles + verbs in buttons + no jargon in chrome" the rule for every future page.

## Help Agent

The suggestions in `lib/help-agent/suggestions.ts` were reviewed and already follow the
doctrine (practical questions in the user's words, routing to supported simple views):
*What needs attention? · Overdue actions · Students without advisors · Partner
follow-ups · …*. No changes were needed; the doctrine (§13) now codifies the rule that
suggestions must route to supported views and be updated in lockstep with route renames.

## CSS

- **No `globals.css` selectors were added or removed.** All new styling is Tailwind in
  `ui-v2`. The MetricStrip/ViewSwitcher/AdvancedFilters adoptions replaced ui-v2-internal
  rendering, so no legacy selector became newly dead.
- Freeze baseline **remains 10,731** (`scripts/check-globals-css-freeze.mjs`).

## Validation results

- `npm run typecheck` — **pass** (all touched files type-clean).
- `npm run css:freeze-check` — **pass** (10,731 lines, baseline 10,731).
- `npm run nav:check` — **pass** (204 catalog routes, 9 roles; label renames kept
  per-role uniqueness).
- ESLint on all touched `.ts/.tsx` — **pass** (`--max-warnings=0`).
- Targeted tests — **pass**: `tests/lib/status-language.test.ts` (new),
  `work-hub-table`, `work-hub-rows`, `partners-directory`, `page-helper-fab`,
  `page-helper-resolve` (assertion updated to the new Home copy), plus the interview/
  help-agent suites.
- `npm run build` — **fails on a PRE-EXISTING break unrelated to this pass.** The only
  4 Turbopack errors are dangling imports in mentorship files this pass never touched:
  `app/(app)/admin/mentorship/gr/[documentId]/page.tsx` (`getGRDocumentForUser`,
  `getGRTimelineData`) and `components/mentorship/goal-review-form.tsx`
  (`sendReflectionNudge`). Those three symbols are defined nowhere in the repo and the
  files predate this branch (main's "Mentorship Page Revamp" left them dangling).
  Verified by stash-baseline runs and repo-wide grep. **No build error originates in a
  file this pass changed.** Fixing the mentorship server actions is out of scope for a
  design/intuitiveness pass and would mean guessing real domain logic — it is flagged
  here for a mentorship-focused follow-up.
- No Playwright, screenshots, browser/DB/auth smoke were run (per instructions).

Other known pre-existing baseline failures (unchanged by this pass, confirmed via stash):
`tests/lib/page-helper-coverage.test.ts` (registry/route drift) and
`tests/lib/growth/nav-gating.test.ts` (`ENABLE_GROWTH_OS` env gating).

## Remaining unintuitive areas (for the next pass)

- **Mentorship GR build break** — fix the three missing `gr-actions` server actions so
  the production build is green again (highest priority; blocks deploy).
- **Legacy-styled high-traffic surfaces** still on `globals.css` / inline styles:
  applicant Application Status & workspace, the admin Application board, the Meetings
  weekly center, My Classes. Rebuild on `ui-v2` (and on `ViewSwitcher` / `MetricStrip`
  / `AdvancedFilters`) in a later pass, then delete the dead CSS.
- **`/actions/all`** is still dense by design; a `TrackerShell` / `TrackerRow` /
  `TrackerPreview` family would let it (and the meeting tracker) adopt the doctrine
  fully.
- **Page-helper registry coverage** is out of sync with routes (pre-existing test
  failure); reconcile patterns to routes.
- More jargon remains in deeper admin/ops page titles ("Enrollment health", "Program
  health", "Decision readiness", "Weekly digest") — demote per doctrine §11/§15 as those
  surfaces are touched.

## Recommended next prompt

> Fix the mentorship Goal-Review build break (`getGRDocumentForUser`,
> `getGRTimelineData`, `sendReflectionNudge` in `lib/gr-actions.ts`) to get the
> production build green, then rebuild the remaining legacy-styled high-traffic surfaces
> (applicant Application Status + workspace, admin Application board, Meetings weekly
> center, My Classes) on `ui-v2` using the new doctrine and the `ViewSwitcher` /
> `MetricStrip` / `AdvancedFilters` primitives. Build a `TrackerShell` / `TrackerRow` /
> `TrackerPreview` family for `/actions/all` and the meeting tracker, then delete the
> now-dead tracker CSS and lower the freeze baseline.
