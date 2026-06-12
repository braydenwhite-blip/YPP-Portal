# Knowledge OS V2 — Phase 3A Implementation Notes

**Scope shipped:** the unified **Work Hub** at `/work` (plan §15), the first
wave of **Action System 4.0 UI wiring**, legacy work/action entry-point
consolidation, the **Application Review Board ui-v2 reskin** (plan §16,
board + chair queue + archive + quick drawer), and **CSS deletion
milestone 2** (1,548 lines removed from `globals.css`; freeze baseline
lowered to **14,955**). Companion to the master plan (§15, §16, §20, §22.6)
and the Phase 2A/2B/2C notes.

## Work Hub — `/work`

- **`app/(app)/work/page.tsx`** (officer-tier, mirrors `/people`):
  PageHeaderV2 + Help Agent entry (`HomeSearchButton`), six click-to-filter
  stat cards (Overdue / Due soon / Blocked / Needs an owner / Needs
  attention / Upcoming meetings), view chips (**All work · Actions ·
  Meetings · Initiatives · My queue · Needs attention**) + flag chips +
  URL-synced search, the unified work table with a docked Entity 360
  preview rail (drawer below xl), and per-view sections.
- **Data sources (no second source of truth):**
  - `lib/work/work-hub-rows.ts` — the PURE row fold (tested, 13 cases):
    `WorkItem` (tracker actions + unconverted meeting follow-ups from the
    existing `lib/operations/work-items.ts` fold), `MeetingLite` (upcoming,
    plus past meetings still carrying open follow-ups), open
    `PartnerRequest`s, partners past `nextFollowUpAt`, advisor check-ins
    past `nextCheckInDueAt` (`StudentAdvisorAssignment`), applications on a
    leadership next step (SUBMITTED / UNDER_REVIEW / INTERVIEW_COMPLETED /
    CHAIR_REVIEW with the concrete step named), and quiet mentorships
    (explicit day count). No invented work; every row maps 1:1 to a real
    record with a real reason.
  - `lib/work/work-hub.ts` — the loader: `loadDigestInputs` (the same pool
    the Command Center / Data 360 read), the cross-domain attention inputs
    (now **exported** from `lib/operations/data-360-queries.ts`),
    `buildNeedsAttention`, `getStrategicInitiativesOverview` (health with
    `healthExplanation.reasons` — never a bare label, §19).
- **Rows show:** title, type badge, owner (or “Unowned”), due/next step,
  status with tone, priority (when real), provenance (“From meeting: …”),
  the related **EntityChip** (person/partner/class/applicant/mentorship)
  into its 360 preview, and one quick action (“Convert to action”, “Log
  check-in”, “Open application”…). Clicking the row previews the row's own
  entity (action/meeting/partner/applicant/person/mentorship).
- **“Mine” (My queue):** action lead or EXECUTING assignment, follow-up /
  request owner id, advisor id, reviewer id — computed where the owner id
  is stored, not by name matching.

## Action System 4.0 UI wiring (first wave)

- **Who owns what** — `deriveActionAccountabilitySummary` rendered on the
  `/work` Actions view (open / overdue / blocked / oldest-late per owner).
- **This week** — `deriveWeeklyActionReview` counts (completed, created,
  from meetings, overdue, unowned) + the blocked-needing-escalation list.
- **Decisions without actions** — `deriveMeetingDecisionsWithoutActions`
  on the `/work` Meetings view, each linking to its meeting.
- **Meeting Follow-Up Pack** — `deriveMeetingFollowUpPack` now renders on
  the meeting detail page (`/actions/meetings/[id]`) via
  `components/work/meeting-follow-up-pack.tsx`: decisions not yet tracked,
  open/overdue actions from the meeting, recently completed, clean-meeting
  state.
- Row provenance (meeting-sourced work labeled as such) runs through the
  whole Work Hub.
- **Not yet wired** (next pass): `deriveEntityActionPanel` on
  person/partner/class records, inline structured completion/blocker
  capture on the action detail card.

## Consolidation of legacy work/action entry points

- **Redirected:** `/actions/command-center` → `/work` (read-only browsing
  surface, fully absorbed: attention queue, accountability, weekly counts).
  Inbound links retargeted: action-tracker tab bar (“Work Hub”), the
  meetings page CTA, and the leadership-briefing email URL.
- **Bannered (kept for their unique tooling)** via the new
  `LegacySurfaceBanner` ui-v2 primitive: `/actions/all` (filters,
  analytics, CSV), `/actions/meetings` (capture/editing),
  `/operations/initiatives` (dossiers/planning), `/operations/data-360`
  (explorer/quick-find), `/operations/command-center` (ops summary),
  `/admin/action-center` (legacy record browser — separate data model, so
  no redirect).
- **Deleted orphans:** `app/(app)/legacy-overview-page.tsx` (imported
  nowhere), the pre-command-center
  `admin/instructor-applicants/kanban-board.tsx` +
  `applicant-detail-panel.tsx` pair (only referenced each other),
  `components/instructor-applicants/PipelineFunnelChart.tsx` (never
  rendered; its `FunnelCounts` type moved to `ApplicantPipelineOverview`).
- **Nav:** catalog entry `/actions/command-center` replaced by `/work`
  (“Work”, officer tier, aliases keep “Command Center” searchable); ADMIN
  core pins now `/, /admin, /people, /work, /partners, /messages,
  /admin/mentorship, /attendance` (`/positions` moved to More Tools —
  8-pin cap). `/operations` hub gained a Work Hub entry card.
- **Home:** overdue-actions card → `/work?flag=overdue`, upcoming-meetings
  card → `/work?view=meetings`, “Needs attention” full-queue link →
  `/work?view=attention`, quick actions gained “Work Hub”.

## Application Review Board reskin (ui-v2)

Workflow depth untouched — all server actions
(`lib/instructor-application-actions.ts`), loaders
(`getApplicantPipeline` / `getArchivedApplications` / `getChairQueue`),
role guards, feature flags, demo mode, filters, archive, and the shared
`components/kanban/kanban-board.tsx` internals are unchanged.

- **Board page** (`/admin/instructor-applicants`): PageHeaderV2 + concrete
  click-to-filter flags (§16 — no scores): In pipeline · Needs review ·
  **Missing materials** (`?materialsMissing=1`) · **Overdue**
  (`?overdueOnly=1`) · **Decision needed** (chair queue) · Archived
  (`?tab=archive`). Pipeline summary strip reskinned (filtered + overall
  per-status counts).
- **Command center shell:** Tailwind tabs (Pipeline / Chair Queue /
  Archive), reskinned type filter (Standard / Summer Workshop), reskinned
  `ApplicantCommandFilters` (chapter/reviewer/interviewer/source selects +
  Overdue / My-cases chips — same URL params).
- **`ApplicantPipelineCard`:** full Tailwind rebuild (avatar, stage pill
  with per-status tones, SW/source/interview/materials pills, hold
  rationale, workshop line, alert pills, reviewer/lead/second footer) —
  same props, same drawer behavior.
- **`ApplicantQuickDrawer`:** applicant-specific skin replaced with
  Tailwind (kept the shared `.slideout-*` chassis); CTAs now **Open
  Application 360** (primary, → `/admin/instructor-applicants/[id]`) +
  Full workspace (→ `/applications/instructor/[id]`) — the board now feeds
  the Phase 2C record page directly.
- **`ArchiveTable`:** ui-v2 `DataTableShell`/`TableV2`/`StatusBadge` with
  the same search/status-filter/sorting logic.
- **Chair queue** (`/admin/instructor-applicants/chair-queue` +
  `ChairQueueBoard`): PageHeaderV2, Tailwind chapter tabs, evidence chips
  (days queued / reviewer next step / missing recs), recommendation dots,
  recently-decided cards — same queue logic and review-cockpit links.
- **`/chapter-lead/instructor-applicants`** uses the same shared
  components, so it inherits the reskin; its header moved to PageHeaderV2.
- **Remaining legacy (documented, deliberate):** the applicant cockpit
  (`/applications/instructor/[id]`, `.applicant-cockpit-*`/`.cockpit-*`),
  the chair review cockpit (`[id]/review`, `.chair-review-*`), the shared
  kanban chassis (`components/kanban/kanban-board.css`), and `.slideout-*`
  / `.status-pill` / `.pill*` shared skins — all still live, all kept.

## CSS deletion milestone 2 — EXECUTED (1,548 lines)

`globals.css`: **16,503 → 14,955 lines** (freeze baseline lowered in
`scripts/check-globals-css-freeze.mjs`). 228+ rule blocks deleted.

**Deleted (confirmed dead before this pass):** the entire legacy
"OVERVIEW PAGE ENHANCEMENTS" section (`.overview-*`, ~790 lines, zero
usage), `.workflow-home-card`, `.instructor-focus-metric*`, and — after
deleting the orphan `legacy-overview-page.tsx` — `.portal-goal-*`,
`.portal-role-focus*`, `.compact-list*`, `.instructor-dashboard*`,
`.instructor-metric-card*`, `.dashboard-action-card`.

**Deleted (made dead by this pass's reskin):** `.applicant-command*`
(shell/tabs/panel/filters/select/empty/page/header), the
`.applicant-command .kanban-*` scoped skin, `.applicant-pipeline-card*`,
`.applicant-card-*`, `.applicant-pipeline-overview*`, `.pipeline-funnel-*`,
`.applicant-quick-drawer*`, `.applicant-archive-*`, `.applicant-filter-chip`,
`.chair-queue-*`, `.chair-rec-dot*`, and their media/reduced-motion blocks.

**Mixed selector groups were split, not deleted** — live members kept:
`.applicant-cockpit-page .button/.input`, `.applicant-cockpit-chip-row`,
`.cockpit-person-avatar`, `.kanban-toolbar` (+ its responsive input rule),
`.instructor-list-item/.instructor-priority-item`.

**Why it is safe without Playwright (validation run):**

1. **Selector usage audit:** every deleted family grep-verified at zero
   consumers across `app/`, `components/`, `lib/`, `tests/` (after the
   reskins and orphan deletions in this same PR). The two non-obvious
   consumers found and handled: `instructor-ops-kanban` borrowed
   `.applicant-command` as a container (given its own styles) and the
   quick drawer used `.applicant-card-unassigned` / `.kanban-card-chapter`
   (replaced with Tailwind).
2. **Shared chassis preserved:** base `.kanban-*` + `.status-pill` live in
   `components/kanban/kanban-board.css` (not globals) and are untouched;
   `.slideout-*`, `.pill*`, `.applicant-cockpit-*`, `.cockpit-*`,
   `.chair-review-*`, `.instructor-ops-kanban .kanban-*` all kept.
3. **Structural tests:** the nav contract suite green; brace-balance and
   dead-selector scans on the final file.
4. **Build pipeline:** typecheck, production build, `css:freeze-check`
   (14,955), lint on touched files — all green.

**Next deletion milestone (3):** `.applicant-cockpit-*`/`.cockpit-*`
(~1,700 lines) once the applicant workspace is rebuilt; `.chair-review-*`
after the chair cockpit reskin; then the generic `.card`/`.stat-card`/
`.button`/`.topbar` families as the remaining leadership pages move to
ui-v2 (plan §22.6 phases 3–4).

## ui-v2 additions

- `LegacySurfaceBanner` — generic consolidation banner (title / body /
  CTA) for legacy pages that keep unique tooling.
- `TableCell` now accepts native `td` props (`onClick` etc. for row-level
  interaction patterns).
- Domain components on ui-v2: `components/work/work-hub-table.tsx`
  (unified table + preview rail), `components/work/meeting-follow-up-pack.tsx`.

## Help Agent / search

- Suggestions retargeted: **Overdue actions** → `/work?flag=overdue`,
  **Upcoming meetings** → `/work?view=meetings`, **At-risk initiatives** →
  `/work?view=initiatives`; new: **Blocked work**, **Work without an
  owner**, **My work queue**, and an **Open Work Hub** shortcut.
- Application search results already land on Application 360 (Phase 2C);
  the board's quick drawer now links there too.
- `/api/search` still runs live Prisma queries — SearchDocument cutover
  remains future work (unchanged).

## Validation status (this environment)

- Green: typecheck, lint (touched files), `css:freeze-check` (14,955),
  production build, `tests/lib/work-hub-rows.test.ts` (13),
  nav contract suite, targeted suites.
- Pre-existing and unchanged: the 4 `nav:check` core-map count findings
  (INSTRUCTOR 9 links; HIRING_CHAIR/CHAPTER_PRESIDENT/MENTOR below min)
  and the known unrelated vitest failures (compared against the
  pre-change baseline).
- No `DATABASE_URL` here → browser smoke/screenshots not runnable; CSS
  deletion proceeded on static/build validation per the Phase 3A
  directive.

## Known limitations / next pass

- The applicant cockpit (`/applications/instructor/[id]`) and chair review
  cockpit (`[id]/review`) are still legacy CSS (deliberately — heaviest
  workflow surfaces; reskin is the next application-review milestone).
- Work Hub mentorship rows come from the same quiet-mentorship derivation
  as attention (no standalone mentorship work query yet).
- The Entity Action Operating Panel and inline completion/blocker capture
  remain unwired (Action System 4.0 doc §7 items 1 and 4).
- `/admin/action-center` is bannered, not redirected — it browses a
  separate legacy data model.
- `/api/search` SearchDocument cutover still outstanding.
