# YPP Tech Team — Weekly Tasks: June 16–20, 2026

**Focus: People Strategy OS — Action Tracker, Meetings Tracker, Command Center, Data**

> Expected vs. Actual template — copy into the weekly tracking sheet:
>
> | Task | Owner | Expected by | Actual | Notes |
> |------|-------|-------------|--------|-------|

---

## Context: Where We Are

The People Strategy OS is substantially built. Here is the honest current state:

**Delivered and live:**
- Action System 4.0 data contract (sourceType, strategicInitiativeId, blockedReason, completionNote, successDefinition, etc.)
- Pure derivation layer (action-intel, action-quality, action-source, action-operations-intel)
- Operations Hub phases 1–4 (entity panels, department rollups, officer-meeting rollups, /operations)
- Meetings Tracker (Weekly Command Center, meeting workspace, decisions → actions conversion)
- Command Center OS — Today / Decide / Meet / Review / Follow Up / Delegate workspaces
- Queue Engine + actionable My Queue
- Unified Needs Attention engine
- Shared OperationsSummary brain + shared operations card
- Weekly Execution OS (agenda → capture → loose ends → recap)
- Global Calm/Executive mode
- /actions and /actions/all rebuilt on ui-v2 (ActionListCard, ActionTrackerTabsV2)
- Meeting Follow-Up Pack with one-click decision → action conversion
- Work Hub meeting lens + inline Complete/Block capture
- Action + meeting search indexed via SearchDocument

**What is still left — this is what we are building this week:**

---

## BRAYDEN — Data, Backend, Critical Logic

> Own the things that touch data contracts, server actions, derivations, and the truth layer. Do not let others touch these.

### 1. Structured Completion & Blocker Capture — Wire the Form Fields

**What:** The Action System 4.0 migration already added `completionNote`, `completionOutcome` (DELIVERED/PARTIAL/SUPERSEDED/ABANDONED), `blockedReason`, and `nextFollowUpAt` to the `ActionItem` table. The server actions already persist them. The form fields do **not yet exist** in the action detail card UI.

**Build:**
- [ ] On `/actions/[id]` (the action detail card / `ActionDetailCard`), when `status = BLOCKED`: surface a `blockedReason` inline text input. Save via the existing `updateActionItem` server action. Show the saved reason as a read-only line when not editing.
- [ ] When marking an action COMPLETE: open a small inline capture panel — `completionOutcome` (dropdown: Delivered / Partial / Superseded / Abandoned) + `completionNote` (short textarea). Both optional but encouraged. Wire through `updateActionItem`.
- [ ] `nextFollowUpAt` date picker on the detail card — "Schedule a follow-up check-in." Inline, optional, saves via `updateActionItem`.
- [ ] Surface these fields in the `ActionIntelPanel` ("what matters now" section) once saved: show blocker reason on BLOCKED actions, show completion note + outcome on COMPLETE actions.
- [ ] Run `npm run typecheck` clean after every meaningful chunk.

**Why this matters:** These fields exist in the data model and are the last unwired piece of the Action System 4.0 contract. They make BLOCKED and COMPLETE states actually useful.

---

### 2. Class Search Group — Cut Over to SearchDocument Index

**What:** Actions and meetings already read from the SearchDocument index. Classes are the last major group still running a live query in the Help Agent search (`lib/help-agent/search.ts`).

**Build:**
- [ ] Add a write-path `syncClassSearchDocument` helper — wire it into `createClassOffering`, `updateClassOffering`, and `setOfferingStatus` (same pattern as `syncMeetingSearchDocument`).
- [ ] Wire the class search group in `lib/help-agent/search.ts` to read from the index with the standard three-way fallback (empty group / no text hit / index error → live query).
- [ ] Run the existing `search-indexing` and `help-agent-search` vitest suites. Add 2–3 tests for: index path, live fallback, access control (officer-tier).
- [ ] `css:freeze-check` still passes. `npm run typecheck` clean.

---

### 3. QA — Full People Strategy Flow End-to-End

Run this personally on staging. Do not delegate. These are the flows that can break silently:

- [ ] Create a meeting → add agenda item → add follow-up → convert follow-up to Action Item → confirm sourceType = MEETING_DECISION, source meeting link shows on action detail, action appears in Work Hub meeting lens.
- [ ] Open an action → mark BLOCKED + enter blockedReason → confirm it saves and displays.
- [ ] Complete an action → enter completionNote + completionOutcome → confirm it saves and shows on the ActionIntelPanel.
- [ ] Open `/operations/command-center` — confirm Needs Attention, This Week, Recently Decided all populate from real data. No empty states on a populated environment.
- [ ] Open Command Center OS workspaces (Today / Decide / Meet / Review / Follow Up / Delegate) — confirm each loads correctly and shows relevant data for a Leadership-role user.
- [ ] Open `/operations/weekly-execution` → build agenda → capture meeting notes → resolve loose ends → draft recap. Confirm the recap generates without errors.
- [ ] Test Calm mode toggle — confirm it persists across pages.
- [ ] Run `npm run test` (or the targeted vitest suites: `people-strategy-*`, `action-*`, `meetings-*`, `operations-*`, `work-hub-*`). Log any failures.

---

### 4. Backfill Legacy `officerMeetingId` Rows to `sourceType`

**What:** Older actions created from meetings have `officerMeetingId` set but `sourceType = null`. The normalization layer handles reads gracefully (infers source), but making the data honest improves queries and reporting.

- [ ] Write a one-time idempotent migration script: for all `ActionItem` rows where `officerMeetingId IS NOT NULL AND sourceType IS NULL`, set `sourceType = 'MEETING'`.
- [ ] Run it as a Prisma migration (not a script) so it runs on all environments. Name it `20260617120000_backfill_action_source_type`.
- [ ] Confirm `deriveActionSource` still returns `derived: false` (explicit) for these rows after backfill.

---

## ANTHEA — Visual QA, UI Direction, People Suite Review

> Own visual quality and design decisions. Review all UI before it is called done. Flag anything that looks off — do not fix code yourself unless it is copy or a class name.

### 1. QA the Command Center OS Workspaces (Just Shipped)

The Today / Decide / Meet / Review / Follow Up / Delegate workspaces and Calm mode were just merged. Walk through all of them and flag issues.

- [ ] Open `/operations/command-center` as a Leadership user. Navigate every workspace tab. Screenshot or note anything that: overflows, truncates unexpectedly, looks visually unfinished, or differs from the calm/executive design intent.
- [ ] Toggle Calm mode on and off. Confirm the visual shift is clean — calmer, less color, executive feel.
- [ ] Open My Queue. Confirm action items render with the right context (status, due date, owner, source meeting badge). Flag any that look like raw data instead of a clean card.
- [ ] Open `/operations/weekly-execution`. Walk through all four stages. Note any copy that sounds robotic, any section that looks empty when it shouldn't be, any button label that is unclear.
- [ ] Open `/actions/meetings/[id]` (a real meeting). Confirm the Follow-Up Pack shows decisions-without-actions with a clear "Create action" CTA. Confirm linked actions show owner + due date.
- [ ] Compile findings into a short list (Notion or Slack). Give each issue: screen, what's wrong, severity (visual polish vs. broken).

---

### 2. Review the People Suite — Identify What's Still Legacy CSS

The People Suite pages (`/admin/classes`, `/admin/students`, `/admin/instructors/*`, `/chapter/*`, `/operations/*`) are still on the `.ps-*` CSS chassis. Wesley will be migrating them. Your job is to review the current visual state and provide direction before Wesley starts, so he's not guessing.

- [ ] Open each People Suite section as an Admin user. Note: which pages still look dated/legacy vs. which already feel like ui-v2.
- [ ] Flag any pages where the visual gap is large enough to justify rethinking the layout (not just reskinning).
- [ ] Note any pages where copy is unclear or uses old terminology (e.g., "CPO" instead of "Leadership," old action tracker language).
- [ ] Deliver: a short priority list — which People Suite pages to migrate first this week.

---

### 3. /actions/all — Review the Sub-Components Still in Legacy Style

`ActionFiltersBar`, `SavedViewsBar`, `ActionPresetChips`, and the analytics cards on `/actions/all` are still inline-styled / legacy. The main page shell was rebuilt to ui-v2, but these interactive components are still old.

- [ ] Open `/actions/all` and compare it to `/work` (the ui-v2 Work Hub). Note the visual inconsistencies.
- [ ] Identify which of these components would be most impactful to migrate first (the ones most visible to officers using the Action Tracker daily).
- [ ] Flag any components where the existing layout pattern should change in the migration (vs. a straight reskin).

---

## WESLEY — ui-v2 Migrations, Frontend Work

> Own the implementation of the ui-v2 migrations. Anthea reviews before marking anything done. Run typecheck and the CSS freeze check after every migration.

### 1. /actions/all — Migrate Sub-Components to ui-v2

Priority order (do in this order; stop if time runs out):

- [ ] **`ActionFiltersBar`** (`components/people-strategy/action-filters-bar.tsx`) — migrate to Tailwind/ui-v2. Keep all existing filter logic and state. Only the visual presentation changes. Use `FilterChip`, `FilterBar`, and existing ui-v2 form primitives.
- [ ] **`ActionPresetChips`** — migrate to ui-v2 `FilterChip` rows. Same filter contract, same active state logic.
- [ ] **`SavedViewsBar`** — migrate to ui-v2. Keep the save/delete/rename server actions intact.
- [ ] After each component: run `npm run typecheck` (zero new errors) and `css:freeze-check`.
- [ ] After all three: check that the `/actions/all` page looks visually consistent with the `/work` Work Hub.

---

### 2. /actions/new — Migrate to ui-v2

`/actions/new` (`app/(app)/actions/new/page.tsx`) and the `ActionItemForm` component still use legacy `.ps-*` CSS.

- [ ] Migrate the page shell and form layout to ui-v2. Keep all existing server-action wiring, prefill param handling, quality-warning panel, source/strategic context chips, and smart CTA logic **completely intact**. Only the visual chrome changes.
- [ ] Use ui-v2 form primitives (`FormField`, `InputV2`, `SelectV2`, `TextareaV2`, `ButtonV2`). Match the visual density and layout of other ui-v2 forms in the codebase.
- [ ] Run `npm run typecheck`, `css:freeze-check`, and vitest on `people-strategy-action-prefill-4` and `action-item-form` suites.

---

### 3. /actions/[id] — Migrate Shell to ui-v2

The action detail page (`app/(app)/actions/[id]/page.tsx` + `ActionDetailCard`) is still legacy. This is lower priority than #1 and #2 — only start if #1 and #2 are done.

- [ ] Migrate the page shell and card chrome to ui-v2. **Do not touch** `ActionIntelPanel` layout or the server-action wiring — those are working correctly and Brayden will be adding the completion/blocker capture fields this week. Coordinate with him to avoid conflicts.
- [ ] Keep `ActionIntelPanel` rendering position the same — just update the surrounding card shell.

---

### 4. Meeting Clients — Assess (Do Not Migrate Yet)

The two meeting client components (`weekly-command-center-client.tsx`, `meeting-detail-client.tsx`) are large (~1,400 lines, inline-styled). Do not migrate them this week — the risk of regression is too high without browser validation.

- [ ] Read both files. Estimate: how many globals.css class references do they use? (The audit found it was ~4 total, mostly `.dash-cols` / `.metrics-grid` / `.detail-*` responsive hooks.)
- [ ] Write up a one-paragraph assessment: what would a safe migration look like? What are the risks? What browser validation would be needed?
- [ ] Share the assessment with Brayden and Anthea for next-week planning.

---

## SHARED — All Three

### Mid-week check-in (Wednesday June 18):
- Brayden: Structured completion/blocker capture wired on `/actions/[id]` and visible on staging.
- Anthea: Command Center OS QA findings delivered as a list.
- Wesley: `ActionFiltersBar` and `ActionPresetChips` migrated on staging.

### End of week (Friday June 20):
- Brayden: Class search cutover done. QA flow complete. Backfill migration in. All targeted tests green.
- Anthea: People Suite priority list delivered. `/actions/all` sub-component review done.
- Wesley: All `/actions/all` sub-components migrated. `/actions/new` migrated. CSS freeze check passing.

---

## Testing Checklist (end-of-week gate)

Before calling the week done, confirm:

- [ ] Create meeting → follow-up → convert to action → see action in Work Hub with meeting provenance
- [ ] Mark an action BLOCKED + enter blockedReason → confirm it saves and shows
- [ ] Complete an action → enter completion note + outcome → confirm on detail page
- [ ] `/operations/command-center` all workspaces load for a Leadership user
- [ ] `/operations/weekly-execution` four-stage flow completes without errors
- [ ] `/actions/all` filter bar works — presets, saved views, group-by toggle
- [ ] Help Agent search finds actions and meetings by keyword (including source meeting title)
- [ ] `npm run typecheck` exits 0
- [ ] `css:freeze-check` passes (10,731 or lower)
- [ ] Targeted vitest suites green: `people-strategy-*`, `action-*`, `meetings-*`, `operations-*`, `work-hub-*`, `help-agent-*`
