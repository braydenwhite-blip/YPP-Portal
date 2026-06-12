# Knowledge OS V2 — Phase 3F Implementation Notes

**Scope shipped:** the **meeting Help Agent search group cut over to
SearchDocument** (the last live time-anchored group), and the **`/actions`
(My Actions) and `/actions/all` (Action Tracker) pages rebuilt on
ui-v2/Tailwind** — reusing every loader, selector, and server action,
changing only presentation. New ui-v2 primitives `ActionListCard` and
`ActionTrackerTabsV2`. **CSS deletion: 15 lines** (the `.my-actions-*`
phone-width rules orphaned by the My Actions rebuild); freeze baseline
**10,746 → 10,731**. Companion to the master plan (§15, §22.6, §24) and the
Phase 3A–3E notes.

## Scope decision (important context)

The Phase 3E "recommended next prompt" assumed CSS deletion milestone 6 =
deleting the `.ps-*` family. **That premise does not hold**, established by
direct audit this pass:

- **`.ps-page` / `.ps-tabs` / `.ps-stat-*` are portal-wide**, not
  `/actions/*`-scoped: the People Suite (`/admin/classes`,
  `/admin/students`, `/admin/instructors/*`), `/chapter/*`, and
  `/operations/*` all consume them. Rebuilding the action/meeting surfaces
  does **not** unlock the chassis' deletion.
- **`ActionCommandBar`, `StatCard`, `ActionCard` are shared by ~30 pages**
  across the portal — they cannot be reskinned blind without touching
  surfaces with no browser validation here.
- **The two meeting clients** (`weekly-command-center-client`,
  `meeting-detail-client`, ~1,400 lines) are **inline-styled** and use only
  4 globals.css classes total (the `.dash-cols`/`.metrics-grid`/`.detail-*`
  responsive hooks) — reskinning them would delete ~14 lines of CSS for
  ~1,400 lines of interactive churn at real regression risk.

So this pass took the **safe path** (confirmed with the requester): rebuild
the two `/actions` server pages onto ui-v2 by composing ui-v2 primitives +
**new** ui-v2 components, **without** modifying the portal-wide shared
components — the legacy `ActionCard` / `ActionCommandBar` / `StatCard` /
`ActionTrackerTabs` stay intact for their other consumers. No blind reskin
of 30 pages; no blind rebuild of the interactive meeting clients.

## Meeting search cutover (the last live time-anchored group)

`lib/help-agent/search.ts`: the meeting group now reads the SearchDocument
index via `searchMeetingsFromIndex`, ordered **newest-first off the indexed
`eventAt`** (Phase 3E added the column + the `category · date` subtitle +
the `syncMeetingSearchDocument` write path) to match the live `date desc`
ordering, with the identical three-way fallback (empty group / no text hit
/ index error → live query). `searchIndexGroup` gained an optional
`eventAtDesc` ordering for time-anchored groups; everything else still
sorts by title. Officer-tier, unchanged from the live path. 3 new tests in
`tests/lib/help-agent-search.test.ts` (index path with eventAt ordering,
live fallback, member denial). **Person, partner, applicant, action, and
meeting now all read the index;** classes stay live (no write-path sync
yet), initiatives are config-defined.

## `/actions` (My Actions) — rebuilt on ui-v2

`app/(app)/actions/page.tsx`: same loaders (`getMyActionItems`,
`getMyTeachingClasses`, `getMyMentorshipActionItems`) and the same
`my-actions-selectors` math (`summarizeMyActions`, `selectExecuting`,
`selectNeedsInput`, `bucketByUrgency`, …) — only the presentation changed.

- `ActionCommandBar` → `PageHeaderV2` (the "name · title · last updated"
  line folded into the eyebrow); `+ New Action` → ui-v2 `ButtonLink`.
- The five informational stats (Overdue / In progress / Executing / Needs
  input / Next deadline) render as a page-local non-link `StatTile` strip —
  `StatCardV2` is link-only by design and these are not filters.
- `ActionTrackerTabs` → `ActionTrackerTabsV2` (officer-only, as before).
- `Panel` / `.ps-section-title` → `RecordSection`; the empty state →
  `EmptyStateV2`; `ActionCard` rows → `ActionListCard`; the "By deadline"
  urgency rows and the dot legend → Tailwind.
- Teaching classes keep the shared read-only `ClassTrackerRow` under a
  `RecordSection`; mentorship items reskinned to a ui-v2 row.

## `/actions/all` (Action Tracker) — rebuilt on ui-v2

`app/(app)/actions/all/page.tsx`: same grouping, filter, preset, saved-view,
analytics, and CSV-export logic — only the chrome and list reskinned.

- `ActionCommandBar` → `PageHeaderV2` (Export CSV + New Action as ui-v2
  `ButtonLink`s); the `LegacySurfaceBanner` stays (already ui-v2).
- `ActionTrackerTabs` → `ActionTrackerTabsV2`; `StatCard` overview strip →
  the page-local `StatTile` (these ones drill into filters, so they link);
  `.ps-section-title` group headings → Tailwind; `ActionCard` rows →
  `ActionListCard`; the Group-by toggle → Tailwind segmented links.
- **Kept as-is** (`/actions/all`-scoped, functional interactive tooling, not
  reskinned this pass): `ActionFiltersBar`, `ActionPresetChips`,
  `SavedViewsBar`, `ActionInboxGroups`, `ActionStatusDonut`/`DepartmentBars`,
  and the generic `CollapsibleSection`.

## New ui-v2 components

- **`components/people-strategy/action-list-card.tsx`** — the Tailwind
  Action Tracker list card. Same `ActionItemWithRelations` contract and the
  same interactive behaviors as legacy `ActionCard`: title opens the Action
  360 in place via `EntityLink` (modifier-click → `/actions/[id]`), lead via
  `PersonLink`, linked entity via `RelatedEntityBadge`; status / priority /
  type / source / visibility as ui-v2 `StatusBadge`s (pill→badge tones
  re-derived: overdue→danger, purple→brand). Left rail keyed to
  overdue/priority. The legacy `ActionCard` is untouched (~10 other
  consumers).
- **`components/people-strategy/action-tracker-tabs-v2.tsx`** — the tab bar
  on `FilterBar`/`FilterChipLink`. Same routes + `active` contract. Legacy
  `ActionTrackerTabs` (`.ps-tabs`) stays for the still-legacy action
  surfaces (People Dashboard, Responsibility Map, classes, completion
  report).

## CSS deletion (milestone 6 — partial, honest)

`globals.css` **10,746 → 10,731**: deleted the three `.my-actions-*`
phone-width rules (`-dashboard-grid` / `-deadline-row` / `-deadline-date`),
grep-verified at zero TS/TSX consumers after the My Actions rebuild; the
`command-center-grid` rule in the same media block was preserved (5 live
consumers). **The `.ps-*` chassis stays** — it is portal-wide. The two
`/actions` pages now use ui-v2, but their former scoped selectors
(`.ps-section-title`, `.ps-action-card*`) remain live via the other
`/actions/*` pages and the legacy `ActionCard`, so they are not yet
deletable.

## Validation (this environment)

- Green: `typecheck`, production build (exit 0), `css:freeze-check`
  (10,731), lint on touched files, `nav:check` (203 routes / 9 roles),
  targeted vitest: help-agent-search (22, +3 meeting cutover),
  search-indexing (14), work-hub-rows (18), action-card (legacy, 3),
  app-shell-nav-contract.
- `page-helper-coverage` fails identically to the documented pre-existing
  7-failure baseline (no routes/registry changed this pass).
- No `DATABASE_URL` → static/build validation only; no Playwright.

## Known limitations / next pass

- The interactive sub-components on `/actions/all` (`ActionFiltersBar`,
  `SavedViewsBar`, `ActionPresetChips`, analytics cards) are still legacy /
  inline-styled.
- The two meeting clients + `/actions/new`, `/actions/[id]`,
  `/actions/people`, `/actions/responsibility`, `/actions/completion-report`,
  `/actions/all/classes` are still legacy `.ps-*` — and the chassis can only
  be deleted once the **portal-wide** consumers (People Suite, admin
  records, chapter, operations) also migrate, which is a much larger,
  separate effort.
- The class search group is still live (no write-path sync).

**Recommended next phase:** migrate the People Suite + admin record pages
off `.ps-page`/`.ps-tabs`/`.ps-stat-*` (the portal-wide chassis) onto ui-v2
in a dedicated pass with browser/visual-regression validation — that is what
actually unlocks the `.ps-*` CSS deletion milestone. Reskinning the two
interactive meeting clients is low CSS payoff and should be bundled with
browser validation, not done blind.
