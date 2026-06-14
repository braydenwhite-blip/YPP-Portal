# YPP Global Intuitiveness Design System

**Status:** Source of truth for product/design decisions across the YPP Portal.
**Supersedes scattered guidance** in: master plan §18–§22, the Tailwind v2 addendum,
`docs/tracker-ux-simplification-notes.md`, and the per-phase notes (2A–3F). Those
remain valid history; this is the consolidated, enforceable doctrine going forward.
**Companion engineering doc:** `docs/ypp-tailwind-design-system-v2-plan.md` (tokens,
lint guards, migration mechanics). **Date:** June 2026.

> One line: **a user should understand any page in five seconds — where they are,
> what it's for, what matters now, and the one thing to do next — without
> understanding how YPP is built internally.**

---

## 1. Executive Summary

The portal is technically powerful. After many Knowledge OS phases it has master
databases (`/people`, `/partners`), a unified `/work` hub, interview and application
workspaces, full-360 records, and a deterministic Help Agent. The remaining problem
is **not capability — it is legibility.** Pages still open with too many equal-weight
choices, internal vocabulary ("command center", "data 360", "pulse", "readiness"),
and dashboards that show everything at once without saying what to do.

This doctrine fixes that with a small number of binding rules and a shared set of
`ui-v2` primitives that make the right layout the easy layout. It does **not** add
features. Every page moves toward the same shape: **title → one-line purpose → one
primary action → one recommended next step → 3–5 summary cards → one view switcher →
clean list → preview on click → full detail only when needed → Help Agent everywhere.**

The five-second test (the bar every major page must pass):

1. Where am I? 2. What is this page for? 3. What matters right now?
4. What's the recommended next action? 5. What can I ignore?
6. Where do I click for detail? 7. How does this connect to people / work /
   meetings / classes / partners / applications?

---

## 2. The Current UX Problem (named honestly)

Observed on the live portal, the recurring failure modes are:

- **Too many equal-weight choices.** Pages render 6+ stat cards, two rows of
  filters, a view switcher, and a header action bar of same-colored buttons. Nothing
  is louder than anything else, so nothing reads as "do this."
- **Internal vocabulary leaks to users.** "Command Center", "Data 360", "Operational
  inbox", "Weekly digest", "Pipeline", "Health", "Pulse", "Momentum", "Readiness",
  "Fit", "Engagement". These describe how the system works, not what the user does.
- **Dashboards without a verb.** A wall of honest numbers with no "start here" and no
  recommended next move. Powerful, but the user has to do the triage the page should
  have done.
- **Trackers that read like admin databases.** Full tables, presets, saved views, and
  status pickers all visible before the page says what to look at first.
- **Vague metrics over concrete states.** A level chip ("at risk", "high engagement")
  where the engine already computed the real reason (overdue by 9 days; no advisor).
- **Inconsistent page anatomy.** Two surfaces doing the same job look and behave
  differently — different headers, different filter placement, different empty states.
- **Duplicate entry points.** The same work reachable from `/work`, `/actions/all`,
  `/operations/command-center`, and an admin action center, each framed differently.

The cause is structural: for years there were no primitives and no rules, so every
page solved layout from scratch and complexity only accreted. This doctrine + the
`ui-v2` primitives remove the option to re-create the mess.

---

## 3. New Design Principles (the nine rules)

1. **One job per page.** If you can't say the page's job in one sentence, the page is
   doing too much — split it or demote half of it.
2. **One primary action.** Exactly one visually-primary CTA per page (and per major
   section). Everything else is secondary, quiet, or a link.
3. **Recommend the next step.** Operational pages compute and show the single best
   next move ("Review the work that needs attention first"), not just data.
4. **Progressive disclosure.** Show the 1–2 controls behind the reason someone opened
   the page; everything sharper lives one disclosure or one click deeper.
5. **Preview before full page.** A row opens a preview (drawer/panel); the full 360 is
   a deliberate second step, never the default.
6. **Concrete over vague.** Name the state and the reason ("Overdue · 9 days",
   "No advisor"), never a mood ("at risk", "low momentum"). See §11.
7. **Plain English.** User-facing labels say what the user does, not what the table is
   called. Internal names may survive as code, routes, or search aliases — not as
   chrome.
8. **Calm by default.** Whitespace, one shadow level, attention-tone reserved for
   things that actually need action. Color and density are information, not decoration.
9. **Consistency is a feature.** Same job → same anatomy → same primitives. A user who
   learns one master database has learned them all.

---

## 4. Global Page Anatomy (every major page picks this shape)

```
PageHeaderV2
  eyebrow (where am I)         e.g. "Work", "Knowledge OS"
  title (plain noun)          e.g. "Partners"
  subtitle (one sentence)     what this page is for, in human words
  actions  → ONE primary CTA (+ at most one secondary)
  children → MetricStrip (3–5 cards) OR a HomeSearchButton

[ TrackerStartCard ]          "Start here / Needs attention" — operational pages only
ViewSwitcher                  one row of plain-English views
[ search ]                    UrlSyncedSearchInput, right-aligned
AdvancedFilters               collapsed; deep filters live here
main content                  clean list / table / cards
  → row click opens PreviewPanel; "Open 360" → full page
EmptyStateV2                  useful, with an action, when the list is empty
```

Required: clear title, one-sentence subtitle, one primary CTA, 3–5 summary cards max,
one view switcher, preview-first rows, a useful empty state, Help Agent reachable.

Forbidden by default: more than 5 summary cards (6 only on the executive Home),
multiple rows of always-visible filters, two equally-weighted primary CTAs, dense top
bars, internal jargon in chrome, huge tables with no preview, dashboards with no
recommended action.

Reference implementations to copy: **`/work`** (operational tracker), **`/partners`**
(master database), **leadership Home** (cockpit).

---

## 5. Tracker Page Anatomy

Trackers are the highest-pain surface, so they get the strictest shape (proven on
`/work`):

```
title + one-sentence purpose
ONE primary CTA (Create action) + at most one secondary (Log meeting)
TrackerStartCard  → recommends the next queue + 3–4 concrete facts
ViewSwitcher      → Needs attention · My work · Actions · Meetings · … (default =
                    "Needs attention", never the full "All" database view)
AdvancedFilters   → status / owner / date filters, collapsed (auto-open if active)
clean rows        → essentials only: item · owner/due · status · next step · 1 action
row click         → preview; full detail only when needed
```

Rules: the default view is the **attention** view, not the database. Rows name the
next step when one exists. Prefer concrete states (Overdue, Blocked, Missing owner,
Follow-up open, Decision needs an action) over broad metrics. Never more than one
primary action in the header. Advanced filters stay collapsed unless they are a top-2
reason the page was opened.

Apply to: `/work`, `/actions/all`, `/actions/meetings`, `/interviews`,
Application board, partner requests, the CPO feedback/performance table, mentorship /
advisor queues.

The `ui-v2` **tracker family** implements this shape so pages don't re-derive it:
`TrackerShell` (the chassis: header → metrics → start-here → views → filters → list),
`TrackerRow` (one scannable row: title · status · meta · next step · one action), and
`TrackerPreview` (the standard item-preview body for `PreviewPanel`/`DrawerShell`).
`TrackerStartCard` is the start-here card; `ViewSwitcher`/`AdvancedFilters`/`MetricStrip`
are the views/filters/metrics. Compose these — don't hand-roll a tracker.

---

## 6. Record / 360 Page Anatomy

Records are powerful but must read **calm** (master plan §18). Fixed order:

```
1. ProfileHeader        identity, status, ≤4 quick actions
2. KeyFactsGrid         ≤6 concrete facts (omit empty facts — no "—" rows)
3. Recommended next step   the single most useful move (TrackerStartCard / DecisionDock)
4. Linked work          open actions / follow-ups for this record
5. Relationships        EntityChips, clustered by type, "+N more" when long
6. Recent activity      3–5 events at preview altitude
7. Deeper detail        timeline / notes / files — grouped or collapsed, full-360 only
```

Rules: not everything at the same visual weight — header and next-step dominate; deep
history recedes. Tabs ship because a user **acts** there, not because data exists;
empty tabs hide. Every entity reference is an `EntityChip` that opens the preview.
"View all" links replace long inline lists.

Apply to: person / instructor / student / partner / application / class records.

---

## 7. Dashboard / Home Anatomy (cockpit)

```
greeting + date                 "Good morning, Sam." · today's date as eyebrow
subtitle                        one line naming the page's job ("What needs attention…")
MetricStrip                     3–5 attention-first cards (Home is the only sanctioned 6)
Today's brief                   2–4 plain sentences, optional
Needs attention                 worst-first, each with the reason AND the next move
secondary queues                decisions waiting · overdue work · upcoming meetings
recent activity                 what changed
Quick actions                   a few small secondary buttons — never the loudest thing
```

Rules: a cockpit must **recommend**, not just display. Every number links to its
filtered list (`StatCardV2` requires `href`). No pulse %, no donuts, no composite
score. The summary strip is attention-first; calm metrics that have their own section
below (e.g. upcoming meetings) don't also need a headline tile.

Reference: `components/home/leadership-home.tsx`.

---

## 8. Table / List Rules

- **Rows are scannable:** 44–48px, the essentials only. Move secondary metadata into
  the preview, not the row.
- **Row click opens the preview** (PreviewPanel), predictably, everywhere. Modifier-
  click navigates to the full page.
- **Columns earn their place.** Priority-3 columns hide first on narrow widths. No
  "health"/"score" columns — ever (master plan §19).
- **Always show a count** ("12 items · matching 'camp'") so the list's scope is legible.
- **Long chip clusters collapse** to "+N more" rather than wrapping into a wall.
- Build on `DataTableShell` / `TableV2`; don't hand-roll table chrome.

## 9. Filter & View Rules

- **View ≠ filter.** "Which slice am I looking at?" is a `ViewSwitcher` (segmented
  control). "Narrow this slice" is the `FilterBar` / `AdvancedFilters`. Don't blend
  them into one undifferentiated chip soup.
- **One view switcher**, a handful of plain-English views, sensible default (the
  attention view on trackers).
- **One or two filters visible**, max. Everything else lives in `AdvancedFilters`,
  collapsed, auto-opening only when a deep filter is already active (so the user can
  see and clear it).
- **Filters are links** (URL state), so views are shareable, back-button friendly, and
  reachable from StatCard click-to-filter.
- Human filter labels: "Needs follow-up", not "flag=overdue"; "No advisor", not
  "checkin_missing".

## 10. CTA Hierarchy

One vocabulary, one weight order, everywhere:

| Weight | Use | `ui-v2` |
|---|---|---|
| **Primary** (solid brand) | the one main action of the page/section | `Button variant="primary"` |
| **Secondary** (outline) | a common-but-not-main action | `variant="secondary"` |
| **Tertiary / ghost** | quiet, optional ("Report", "Advanced tools →") | `variant="ghost"` / link |
| **Destructive** | distinct, not loud unless the moment demands it | `variant="danger"` |

Rules: **one primary per page**, one per major section. Never two purple buttons
competing. Header action bars hold at most 2 buttons (1 primary + 1 secondary); a row
holds at most 1–2 actions. Use real verbs — **Create action, Log meeting, Request
feedback, Open review, Assign owner, Convert to action, Complete, Open Application
360** — not a wall of "View". `ActionButtonGroup` caps quick actions at 4.

## 11. Status Language & Badge Rules

There is **one** status vocabulary, in `lib/ui/status-language.ts`, and **one** badge,
`StatusBadge`. A status label names a concrete, actionable state and carries an
approved tone:

> Overdue · Due soon · Blocked · Missing owner · Needs follow-up · Needs review ·
> Decision needed · Interview incomplete · Feedback pending · Check-in overdue ·
> No advisor · Ready to submit

Banned as standalone labels (a level may summarize, but the **reason must render at the
same altitude** — master plan §19): **Health, Pulse, Momentum, Quality, Engagement,
Risk, Readiness, Fit, Score, Grade.** If a chip shows only one of these, it is lying
about being concrete — show the reason instead, or pass it via `StatusBadge`'s `title`.

Tone discipline: `danger` = needs action now (overdue, blocked); `warning` = needs
attention soon; `success` = done / ready / on track; `info` = scheduled / in progress;
`neutral` = state, no urgency; `brand` = identity, not status. Don't paint a calm state
red for emphasis.

## 12. Empty / Loading / Error Rules

- **Empty is a destination, not a dead end.** `EmptyStateV2` with a title, one helpful
  sentence, and an action ("Nothing is flagged — the queues are clear." / "Add the
  first partner"). Never a bare "No results."
- **Loading is calm.** Skeletons or a quiet "Loading…" via the shared route loaders;
  never a layout jump or spinner storm.
- **Errors are honest and recoverable.** Say what failed in plain words and offer the
  way back (retry, Home, Help Agent). Never a raw stack or a blank screen.
- All three reuse the same primitives; do not invent per-page variants.

## 13. Help Agent / Search-First Rules

The portal is **search-first**: when a page feels complex, ⌘K is the escape hatch and
it is reachable everywhere (sidebar trigger + global ⌘K + `/help-agent` + the
`HomeSearchButton` on cockpits).

- Suggested searches are **practical questions in the user's words**: *What needs
  attention? · My work · Overdue actions · Upcoming meetings · Meetings needing
  follow-up · Applications waiting for a decision · Interviews needing review · People
  needing feedback · Students without advisors · Partner follow-ups.*
- Suggestions route to **supported, simple views** (`/work?view=needs-attention`,
  `/people?flag=no-advisor`). Never suggest a query that lands on a confusing page or
  an unsupported filter.
- Results are preview-first: open the Entity 360 preview; modifier/⌘-enter navigates.
- Maintained in `lib/help-agent/suggestions.ts`. When a route or filter is renamed or
  retired, update the suggestions in the same change.

## 14. Drawer / Preview / Full-Page Rules

Three altitudes, one mental model (master plan §18):

1. **Preview** (`PreviewPanel` docked rail; `DrawerShell` overlay on narrow widths) —
   the default on row/chip click. Identity, status, next step, key facts,
   relationships, recent activity, ≤4 quick actions.
2. **Full 360 page** — the deliberate second step from "Open 360"; adds timeline,
   notes, files, and management tools.
3. **Focused task** (single column + sticky decision dock) — application review and
   similar; one decision, no distractions.

Rules: preview first, always. Stacked previews keep a back button. Esc and route change
close. Every entity is reachable as a chip → preview, from anywhere.

## 15. Copywriting Rules

- **Titles are plain nouns:** "Partners", "Work", "Interviews", "People". Not
  "Partner Relationship Operations Center".
- **Subtitles are one sentence about the user's job**, not the data model.
- **Verbs in buttons:** Create, Log, Open, Assign, Complete, Convert, Request.
- **No internal jargon in chrome.** Banned in user-facing text: *command center,
  operational, digest, pipeline, tracker (as a noun shown to users), hub (as a
  suffix), pulse, momentum, readiness, fit, health.* They may live in code, routes,
  comments, and search aliases.
- **Numbers carry their unit and reason:** "3 days in queue", "9 days overdue · unowned".
- **Sentence case** for everything except the small uppercase eyebrow/label caption.
- Write the empty state, the error, and the next-step copy with as much care as the
  happy path.

## 16. Route Consolidation Rules

- **One front door per job.** Work lives at `/work`; `/actions/all`,
  `/operations/command-center`, and admin action centers are advanced tools that
  **steer to `/work`** via `LegacySurfaceBanner`, not parallel front doors.
- **Rename-and-redirect, never break URLs.** Old routes `permanentRedirect()` to the
  canonical one; old names survive as search aliases.
- **Don't remove routes with unique tooling.** Demote and banner them instead.
- **`npm run nav:check` is law.** Every catalog href resolves to a real route; labels
  are unique per role; core lists stay ≤8 and stable. Renaming a label is safe; moving
  an href is a lockstep change across catalog + core-map + page-helper registry.
- User-facing nav language target: **Home · Help Agent · People · Work · Programs ·
  Partners · Interviews · Applications · Reports · Admin.**

## 17. When to Show Data vs. Hide It

Default to **hide, then reveal on intent**:

- **Show by default:** the page's job, the recommended next step, 3–5 headline numbers,
  the attention list, the one view switcher.
- **One disclosure deep (`AdvancedFilters`, "View all", "More tools"):** status/owner/
  date filters, saved views, secondary queues, advanced tools.
- **One click deep (preview):** per-record detail, secondary metadata, relationships.
- **Two clicks deep (full 360):** timeline, notes, files, history, management actions.

The test: if removing it from the default view would not stop a user from doing the
top-two things they came to do, it belongs deeper. Hidden ≠ deleted — important data
moves **down or behind preview**, never away.

## 18. How to Avoid Overwhelm (the density budget)

A major page's **default** view spends at most:

- **1** primary CTA (+1 secondary)
- **1** "start here" / recommended-next-step module (operational pages)
- **3–5** summary cards (`MetricStrip` enforces the cap; Home may use 6)
- **1** view switcher
- **1–2** visible filters (the rest in `AdvancedFilters`)
- **1** main content region
- **≤2** actions per row

Over budget? Collapse advanced filters, hide priority-3 columns, turn chip walls into
"+N more", move secondary metadata into the preview, merge or demote stat cards, add a
"Start here" module so the page makes the first decision for the user.

## 19. `ui-v2` Component Usage Rules

- **Compose primitives; don't hand-roll chrome.** Headers (`PageHeaderV2`), sections
  (`RecordSection` / `SectionHeaderV2`), cards (`CardV2`), metrics (`MetricStrip` /
  `StatCardV2`), views (`ViewSwitcher`), filters (`FilterBar` / `AdvancedFilters`),
  tables (`DataTableShell`), status (`StatusBadge`), entities (`EntityChip`), empties
  (`EmptyStateV2`), previews (`PreviewPanel`), next-step (`TrackerStartCard`).
- **No new global CSS.** `app/globals.css` is frozen and may only shrink. New styling
  is Tailwind utilities inside `ui-v2`, or tokens in `app/ui-v2.css`. No one-off CSS,
  no inline hardcoded colors/spacing on redesigned surfaces.
- **`cn()` + CVA for variants;** feature code passes variant props, not class soup.
- **`ui-v2/` never imports legacy domain components** and never uses `globals.css`
  classes.
- Need a pattern twice? Promote it to a `ui-v2` primitive (that's how `ViewSwitcher`,
  `MetricStrip`, and `AdvancedFilters` were born) rather than copy-pasting a local one.

## 20. "Never Again" Anti-Patterns

- ❌ A dashboard that shows numbers but recommends nothing.
- ❌ 6+ stat cards / two visible filter rows / 5+ equal header buttons.
- ❌ Two primary (purple) buttons competing in one view.
- ❌ A vague level chip ("at risk", "92% healthy") with the reason hidden.
- ❌ Internal jargon as user-facing chrome ("Command Center", "Data 360", "Digest").
- ❌ A giant table with no preview and no row next-step.
- ❌ Two pages doing the same job with different layouts.
- ❌ A second front door to work/people/partners instead of a banner to the canonical one.
- ❌ A new selector in `app/globals.css`.
- ❌ An empty state that just says "No results."
- ❌ "View" as the only verb when a better one exists.

## 21. Checklist for Every Future Page

Before a page ships, it must answer **yes** to all:

- [ ] Title is a plain noun; subtitle is one sentence about the user's job.
- [ ] Exactly one primary CTA (one per major section).
- [ ] Operational pages show a recommended next step ("start here").
- [ ] ≤5 summary cards (Home ≤6), each linking to its filtered list.
- [ ] One view switcher; ≤2 visible filters; the rest in `AdvancedFilters`.
- [ ] Rows are scannable and open a **preview** on click; full 360 is the second step.
- [ ] Status uses `lib/ui/status-language.ts` labels + `StatusBadge`; no banned words.
- [ ] No vague metric without its reason at the same altitude.
- [ ] Useful empty / loading / error states (with an action).
- [ ] Built from `ui-v2` primitives; **no `globals.css` additions**; no one-off CSS.
- [ ] Help Agent reachable; any suggested search lands on a supported view.
- [ ] `npm run typecheck`, `npm run build`, `npm run css:freeze-check`,
      `npm run nav:check`, and lint on touched files all pass.
- [ ] Passes the five-second test (§1).

---

*Future phases must prioritize fewer visible controls, clearer next steps, better
defaults, progressive disclosure, preview-first depth, and plain language — never
another vague dashboard, never feature-dumping. Simplify the portal; don't grow it.*
