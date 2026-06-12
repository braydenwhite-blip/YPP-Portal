# Knowledge OS V2 — Phase 3E Implementation Notes

**Scope shipped:** Actions + Meetings operating-system hardening — the
**action search group cut over to SearchDocument** (with live fallback),
**meeting index rows gaining structured `eventAt` date metadata + write-path
upserts**, the **Work Hub meeting lens** (`/work?entity=meeting:<id>` now
answers "what did this meeting create?"), **inline Complete/Block capture in
the Work Hub preview rail**, **one-click decision→action conversion on the
Meeting Follow-Up Pack**, meetings in **My queue**, Entity Action Panel
count badges + view-all link, an action-detail **Create follow-up** chain
CTA, Home blocked/unowned work links, new Help Agent suggestions, and a
small CSS freeze reduction (**10,761 → 10,746**). Companion to the master
plan (§8, §15, §19, §24) and the Phase 3A–3D notes.

## Routes audited

`/work` · `/actions` · `/actions/all` (+`/classes`, `/classes/[id]`) ·
`/actions/new` · `/actions/[id]` (+`/edit`) · `/actions/meetings` ·
`/actions/meetings/[id]` · `/actions/people` (+`/board-rollup`) ·
`/actions/responsibility` · `/actions/completion-report` ·
`/actions/reporting` (redirect → `/actions/all`) ·
`/actions/command-center` (redirect → `/work`) · `/officer-meetings`
(redirect → `/actions/meetings`) · `/admin/action-center` (bannered legacy
data model) · `/operations/command-center` · `/operations/weekly-review`
(redirect) · `/operations/data-360` · `/operations/initiatives` ·
Leadership Home · Help Agent suggestions · Entity Action Panel mounts
(partner / instructor-360 / student-360 / class / Application 360).

**Audit findings (state going in):** every `/actions/*` surface is still
legacy CSS (`.ps-page` wrapper; meeting clients are inline-styled);
`/actions/all` + `/actions/meetings` carry `LegacySurfaceBanner`s pointing
at `/work`; redirects for the absorbed routes already exist and are
correct; conversion server actions (`convertDecisionToAction`,
`convertFollowUpToAction`, `convertAgendaItemToAction`, `addFollowUp` with
its create-action toggle) are complete and idempotent — the gap was
discoverability, not capability; `ActionStatusCapture` existed on the
action detail card and Entity Action Panel rows but not in the Work Hub;
the action SearchDocument rows were title+status only; meeting rows had no
date; the `/actions/command-center` page-helper entry described the dead
pre-redirect page.

## Work Hub (`/work`)

- **URL contract:** `view=my` / `view=my-queue` → `mine`, and
  `view=needs-attention` → `attention` now alias to the canonical views, so
  natural spellings of the documented contract land correctly. Canonical
  set unchanged: `view=all|actions|meetings|initiatives|mine|attention`,
  `flag=overdue|due-soon|blocked|unowned`, `entity=<type>:<id>`, `q=`.
- **Meeting lens:** `WorkItem` and `WorkHubRow` now carry the source
  `meetingId` (action `sourceMeetingId` / follow-up `meetingId`; a meeting
  row carries its own id), and `filterWorkHubRowsByEntity` matches it for
  `entity=meeting:<id>` — the lens now returns the meeting **plus every
  action and unconverted follow-up it created**, answering "which meetings
  created which actions" inside `/work`. When any entity lens is active on
  the All view, meeting rows are unioned in (disjoint sets), so partner /
  class / person lenses also show the meetings about that entity.
- **My queue:** meeting rows now compute `mine` from the meeting's
  `participantIds` (facilitator + attendees), and the `mine` view includes
  the viewer's meetings beside their actions/follow-ups.
- **Inline capture in the preview rail:** the loader computes
  `canEditAction` per visible action and attaches a serializable
  `WorkHubRowCapture` payload to editable action rows; selecting such a row
  docks its preview with **Complete / Block** quick actions — the same
  shared `ActionStatusCapture` (same server actions, permissions re-checked
  server-side). On save the table calls `router.refresh()` and remounts the
  rail fetch so both the row and the preview update.

## Action tracker

- **Action detail:** new **Create follow-up** header CTA on the detail card
  — a prefilled `/actions/new` link via `buildActionPrefillFromFollowUp`
  (honest `FOLLOW_UP` provenance, parent action id, inherited entity +
  strategic context). This was the last unwired item from the Action System
  4.0 delivery doc §7.
- **Entity Action Panel:** the counts line is now a row of `StatusBadge`
  chips (open / overdue / blocked / due-soon / unowned — concrete counts,
  never a composite); the "+N more" overflow is now a real link into the
  entity's Work Hub lens.
- Creation flow checked end-to-end: every entry point (`/actions` button,
  `/actions/all` button, Entity Action Panel "New linked action", meeting
  converters, Work Hub follow-up "Convert to action") goes through the one
  prefill contract (`actionPrefillFromQuery`) and `createActionItem`.

## Meeting tracker

- **Follow-Up Pack** (meeting detail page) upgraded:
  - decisions-without-actions rows now carry a one-click **Create action**
    button (`components/work/decision-convert-button.tsx`, a thin client
    wrapper over the existing idempotent `convertDecisionToAction` server
    action — provenance, related entity, and the decider-as-suggested-owner
    all preserved by the existing converter);
  - open and overdue action rows show **owner · due date**
    (`effectiveDeadline`), not just the owner;
  - a header CTA opens **`/work?entity=meeting:<id>`** — the new lens;
  - open-action overflow links into the same lens.
- **Meeting → action conversion after this pass:** four existing flows
  (follow-up drawer create-with-action toggle, follow-up convert button,
  decision convert, agenda-item convert) remain the engine; the pack now
  surfaces the decision conversion at the point where the debt is named,
  and the new action is visible back on the meeting page (linked-actions
  list + pack), on the related entity's Action Panel, in `/work` (with
  meeting provenance and under the meeting lens), and in Help Agent search
  (the action index keywords now include the source meeting title).
- **Meeting search metadata:** `SearchDocument` gained a nullable
  **`eventAt`** column (additive idempotent migration
  `20260612120000_add_search_document_event_at`); `buildMeetingDocument`
  stores the meeting's start there and renders the live query's
  `category · date` subtitle; a new `syncMeetingSearchDocument` write-path
  helper (never throws) is wired into `createMeeting` / `updateMeeting`
  (which `setMeetingStatus` funnels through), and the reconcile passes the
  date. **Meetings stay live-query** — the remaining cutover step is to
  read the meeting group from the index ordered by `eventAt desc` with the
  standard fallback, exactly like `searchActionsFromIndex`.

## Search / Help Agent

- **Action group cut over to SearchDocument** (`searchActionsFromIndex` in
  `lib/help-agent/search.ts`): officer-tier index read with the standard
  three-way fallback (empty group / zero hits / index error → live query).
  Access semantics unchanged from the live query (officer-tier group;
  `/actions/[id]` re-checks `canViewAction` on open).
- **Action rows enriched:** `buildActionDocument` now writes a
  status · owner · due subtitle (humanized status, lead name,
  `deadlineEnd ?? deadlineStart`) and owner-name/email + source-meeting
  title keywords — "camp planning" now finds the actions that meeting
  created. The write path (5 mutation hooks from Phase 3D) re-reads the
  new fields.
- **New suggestions** (all backed by real filters): "Work due soon" →
  `/work?flag=due-soon`, "Meetings with overdue follow-ups" →
  `/work?view=meetings&flag=overdue`, "Decisions without actions" →
  `/work?view=meetings` (the section renders there).

## Home cockpit

Stat-strip hrefs verified correct (`/work?flag=overdue`,
`/work?view=meetings`, `/work?view=attention`). The Overdue-actions section
gained compact **"N blocked → /work?flag=blocked"** and **"N need an owner →
/work?flag=unowned"** links fed by the real digest counts
(`blockedActions` / `unassignedActions` added to the Home loader stats) —
no new tiles, no vague labels.

## Route consolidation

- `/actions/command-center` page-helper entry rewritten as a
  "moved → Work Hub" entry (matching the `/operations/weekly-review`
  convention) — it described a page that has redirected since Phase 3A.
- Kept as-is, deliberately: `/actions/all` + `/actions/meetings` banners
  (unique tooling: filters/CSV/capture/editing), `/admin/action-center`
  banner (separate legacy data model), `/actions/reporting` and
  `/officer-meetings` redirects, the action-tracker tab bar (Work Hub is
  its first tab).

## ui-v2 / components

- New: `components/work/decision-convert-button.tsx`.
- Improved: `meeting-follow-up-pack.tsx` (owner/due rows, convert CTA, Work
  Hub lens links), `entity-action-panel.tsx` (badge counts, view-all link),
  `entity-action-row-capture.tsx` (optional `onCaptured` callback),
  `work-hub-table.tsx` (rail quick-capture + refresh), Home cockpit links.
- No new globals.css; all touched UI is Tailwind/ui-v2.

## CSS freeze

`globals.css` **10,761 → 10,746**: the dead `.ps-main-grid` block (rule +
media query; grep-verified zero consumers across app/components/lib/tests/
scripts/e2e). A scripted full-class audit found no other safely deletable
action/meeting selectors — the `.ps-*` family, the meeting responsive
hooks (`.dash-cols`/`.metrics-grid`/`.detail-*`), and `.ps-stat-*`
(dynamically composed) are all live. **Milestone 6 proper** is unlocked by
rebuilding `/actions/*` + the weekly command center on ui-v2 (the `.ps-*`
family, ~2,000 lines).

## Validation (this environment)

- Green: `typecheck`, production build, `css:freeze-check` (10,746), lint
  on touched files, `nav:check`, and targeted vitest:
  work-hub-rows (18), search-indexing (14), help-agent-search (19),
  help-agent-suggestions, meetings-actions, action-capture,
  action-operations-intel, operations suite (105 in the adjacent run).
- No `DATABASE_URL` → no browser/DB smoke; static/build validation per the
  Phase 3E directive (no Playwright).

## Known limitations / next pass

- `/actions/*` pages and the meeting clients
  (`weekly-command-center-client`, `meeting-detail-client`,
  `new-meeting-drawer`, `meeting-followup-drawer`) are still legacy
  CSS/inline styles — rebuilding them on ui-v2 is the next big milestone
  and unlocks CSS deletion milestone 6.
- Meeting search group stays live-query; with `eventAt` now indexed and
  write-path synced, the cutover is a contained follow-up.
- Inline capture is not on the narrow-screen drawer path (the rail capture
  requires the xl docked preview) nor on `/actions` / `/actions/all` cards.
- Bulk decision/follow-up conversion ("convert all") not built — one-click
  per row only.
- No meeting edit drawer on the detail page (title/date edits go through
  `updateMeeting` callers elsewhere).
- `SearchIndexHealthCard` / admin reindex button still not built (cron +
  `npm run search:reconcile` remain the levers).

**Recommended next phase:** rebuild `/actions` (My Actions), `/actions/all`,
and the Weekly Command Center + meeting detail on ui-v2 — same loaders and
server actions, new presentation — then execute CSS milestone 6 (`.ps-*`,
meeting responsive hooks) and cut the meeting search group to the index
using `eventAt`.
