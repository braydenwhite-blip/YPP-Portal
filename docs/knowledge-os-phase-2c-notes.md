# Knowledge OS V2 — Phase 2C Implementation Notes

**Scope shipped:** Leadership Home cockpit (the executive front door),
decision-first Application 360 record page with a chair decision dock,
Help Agent application search + new suggestions, and **CSS deletion
milestone 1** (940 lines of dead nav/sidebar skin removed from
`globals.css`, validated statically — no Playwright dependency).
Companion to the master plan (§7, §16, §27.6) and the Phase 2A/2B notes.

## Leadership Home cockpit

- `app/(app)/page.tsx` officer/reviewer branch (ADMIN, and
  HIRING_CHAIR/CHAPTER_PRESIDENT who aren't instructors) now renders
  `components/home/leadership-home.tsx`, fed by
  `lib/home/leadership-home.ts`. Student/instructor/applicant homes are
  untouched; the old one-card ReviewerHome is kept as a try/catch fallback
  so a loader failure can never blank the leadership home.
- **Data sources:** the existing `loadData360` engine (Today's Brief
  sentences, the cross-domain attention queue with reasons/suggested steps,
  the weekly digest's overdue actions and upcoming meetings, the unified
  timeline) plus targeted counts: chair decision queue
  (`InstructorApplication` CHAIR_REVIEW), students without advisors,
  advisor check-ins overdue, partners past `nextFollowUpAt`, open
  `PartnerRequest`s.
- Layout (ui-v2): greeting header + Help Agent entry (opens the ⌘K palette
  via `useHelpAgent`; falls back to `/help-agent`), six click-to-filter
  stat cards (Overdue actions / Decisions needed / Students without
  advisors / Check-ins overdue / Partner follow-ups / Upcoming meetings),
  Today's Brief, Needs Attention (with why + next move + EntityChips into
  360 previews), Applicants waiting for a decision (chips into the new
  Application 360), Recent activity, Overdue actions, Upcoming meetings,
  Quick actions. **No pulse, no health %, no charts** (§19) — every tile is
  a real count with a real destination.

## Decision-first application review

- **Application 360 — `/admin/instructor-applicants/[id]`** (was a blind
  redirect stub): a real record page for ANY pipeline status, loaded by
  `lib/applications/application-record.ts`. Shows identity (display-name
  rules via `formatApplicantDisplayName`), track/source/reapplication,
  stage badge, key facts (stage, track, reviewer, interview state,
  readiness n/4, applied date), a status-specific concrete next-step card
  (assign reviewer → review pending → info requested → schedule interview →
  submit interview reviews → decision needed), the **decision-readiness
  checklist** (the real 4 inputs from `lib/readiness-signals`, counting
  SUBMITTED reviews only), review/interview summaries, materials +
  documents presence, connected records (member profile chip, reapplication
  chain, decision history), and the application timeline.
- **Chair Decision Dock** (`ui-v2/decision-dock.tsx`): names the decision
  state ("Decision needed" / the committed decision with decider, date,
  conditions, rationale), lists the real decision vocabulary mapped 1:1 to
  the `ChairDecisionAction` enum (Approve / Approve with conditions /
  Request info / Request second interview / Hold / Waitlist / Decline), and
  routes the commit through the proven decision cockpit
  (`[id]/review`) — deliberately NOT a duplicate decision form, because the
  cockpit owns idempotency keys, condition validation, rejection-reason
  enforcement, and notifications (`chairDecide`).
- **Role awareness:** the page is read-gated by
  `requireApplicationReviewerPage` (same as the board); the cockpit CTA
  renders only for `canSeeChairQueue` actors (admin/hiring chair); "Open
  full application" goes to the role-scoped `/applications/instructor/[id]`
  where reviewer/interviewer tools live.
- **The board was not rebuilt** in this pass: the existing command center
  (kanban, filters, archive, chair queue) is functionally the §16 board and
  carries heavy workflow tooling; its ui-v2 reskin is the next
  application-review milestone. The decision experience improved where it
  was thinnest — the connected record altitude.

## Connections (People / Help Agent / 360)

- The `applicant` Entity 360 type already existed; its `pageHref`
  (`/admin/instructor-applicants/[id]`) now lands on a real Application 360
  instead of a redirect.
- Help Agent live search gained an **Applications group** (officer-tier,
  non-archived; matches preferred/legal/last name + account name/email;
  results show the stage and land on the Application 360).
- New suggestions: **Overdue actions** (`/actions`) and **Upcoming
  meetings** (`/actions/meetings`); existing applicant/advisor/partner
  suggestions verified. Reviews-pending / interviews-incomplete remain
  answered by the board's stage columns (one suggestion away via
  "Applicants waiting for decision").
- Application 360 renders EntityChips for the applicant (when a member),
  interviewers, and the previous application; the Home decision queue uses
  applicant-type chips (preview-first).

## ui-v2 additions

- `Checklist` / `ChecklistItem` — named concrete checks with done/gap
  detail lines and a resolve link; the §19-compliant replacement for bare
  readiness percentages.
- `DecisionDock` / `DecisionOption` — generic decision-state surface:
  status, one primary route into the real workflow, and the decision
  vocabulary list.
- `sidebarHeaderClass`/`sidebarFooterClass` now carry `border-b`/`border-t`
  (width+style), making the sidebar separators fully ui-v2-owned (see CSS
  milestone below).

## CSS deletion milestone 1 — EXECUTED (940 lines)

`globals.css`: **17,443 → 16,503 lines** (freeze baseline lowered in
`scripts/check-globals-css-freeze.mjs`).

**Deleted:**

- The entire legacy `NAVIGATION` section (old ~620–1366): `.nav`,
  `.nav-main-tools`, `.nav-more*`, `.nav-block-title`, `.nav-main-items`,
  `.nav-student-*`, `.nav-lock-icon`, the full `.nav.nav--minimal` skin
  (pill links, icon tiles, training subgroup, student flat groups, More
  Tools accordion), `.nav-badge`, `.nav-new-badge` (+ its keyframes),
  `.nav-section-label`, `.nav-*-chevron`, `.nav a`/`.nav-item`,
  `.nav-icon`, `.nav-divider`, `.nav-search*`, `.nav-empty`,
  `.nav-item-label`, and the section's reduced-motion block.
- The old sidebar user-card/skin blocks: `.sidebar-card*`,
  `.sidebar-card-row`, `.sidebar-marble-panel*` (+ both keyframes + its
  reduced-motion block), `.sidebar-footer-card*` (incl. the
  `.logout-button-sidebar.button.small` override further down),
  `.sidebar-user-row`, `.sidebar-user-avatar`, `.sidebar-actions`.
- Skin properties (not the blocks) of the structural chassis:
  `.sidebar` background/border-right/backdrop-filter/box-shadow,
  `.sidebar-header` border-bottom, `.sidebar-footer` border-top — the dark
  premium skin lives in `ui-v2/sidebar.tsx` (`sidebarSurfaceClass` already
  carried border+background+shadow; header/footer classes gained
  `border-b`/`border-t` in this pass so the 1px separators don't depend on
  legacy CSS).

**Why it is safe without Playwright (validation run):**

1. **Selector usage audit:** every deleted selector grep-audited across
   `app/`, `components/`, `lib/`, `tests/` (string literals, template
   literals, `cn()` composition) — zero live usages. `components/nav.tsx`
   has been pure Tailwind since Phase 2A; the only remaining `nav-`/
   `sidebar-` class consumers are different selectors
   (`lds-comment-sidebar-*`, `cockpit-sidebar-card`,
   `chair-review-sidebar-*`) which were kept.
2. **Chassis preserved:** `.app-shell`, `.sidebar`
   (position/size/flex/z-index/overflow), `.sidebar-header/nav/footer`
   structure + scrollbars, `.sidebar-toggle`, `.sidebar-backdrop`,
   `.sidebar-brand`, `.portal-brand*`, `.brand-lockup`, the ≤960px
   off-canvas media query, and the print rules are all untouched.
3. **Structural tests:** `tests/components/app-shell-nav-contract.test.tsx`
   (full-chrome + role-minimal nav contract) green after deletion.
4. **Build pipeline:** typecheck, production build, `css:freeze-check`
   (now 16,503) all green.

**Intentionally kept (not dead):** the structural chassis above, and the
`--nav-purple-*` token variables (consumed by the kept `.portal-brand*`
rules and other live styles).

**Next deletion milestone (2):** legacy `.card`/`.button`/`.topbar`/
`.stat-card`/table/badge/drawer blocks, after the Work Hub/Programs
rebuilds absorb their consumers (plan §22.6 phase 3).

## Validation status (this environment)

- Green: typecheck, lint (touched files), `css:freeze-check` (16,503),
  production build, nav structural contract tests, targeted vitest suites.
- Pre-existing and unchanged: 4 `nav:check` core-map count findings;
  the known unrelated vitest failures (compared against the pre-change
  baseline).
- No `DATABASE_URL` in this environment → browser smoke/screenshots not
  runnable; CSS deletion proceeded on the static/build validation above per
  the Phase 2C directive.

## Known limitations / next pass

- The application board (kanban command center) is still legacy CSS.
- `/api/search` still runs live Prisma queries (SearchDocument cutover
  outstanding).
- Work Hub consolidation (§15) not started.
- The Home cockpit reuses `loadData360`, which loads more than the Home
  renders — fine at current scale, worth a slimmer loader if Home latency
  matters later.
