# People Strategy Command Center — Implementation Plan

> **Status:** Proposal — no application code changed. This document is the deliverable.
> **Date:** 2026-06-04
> **Scope:** Turn the YPP Portal "Action Tracker" (`/actions/*`, the People Strategy
> layer) into a best-in-class People Strategy Command Center.
> **Stack:** Next.js 14/16 App Router, React 18, TypeScript, Prisma + PostgreSQL,
> NextAuth, plain CSS (`app/globals.css`). No Tailwind.

**Evidence labels** — `[FACT]` verified in repo with `file:line`; `[INFER]` reasoned
from code; `[OPEN]` needs a product decision.

---

## 0. Source-of-truth: stakeholder comments → where addressed

| # | Stakeholder comment | Phase | Section |
|---|---|---|---|
| 1 | Replace all "CPO" with "Leadership" | 1 (UI), 5 (internal) | §1.4, §3.1, §3.5 |
| 2 | Action Tracker top section clunky / portal more professional | 2 | §1.1, §3.2 |
| 3 | Light-purple background hurting professionalism; better style/font/bg | 2 | §1.5, §3.2 |
| 4 | Clean up the sidebar | 2 | §1.6, §3.2 |
| 5 | Users clickable anywhere → useful public profile | 4 | §1.7, §2.2, §3.4 |
| 6 | Clean up test accounts; label Test 1/2/3 with realistic titles | 1 | §1.8, §3.1 |
| 7 | Fix the bug preventing creation of actions | 1 | §1.2, §3.1 |
| 8 | Treat applicants separately from portal people/users | 1 | §1.9, §2.3, §3.1 |
| 9 | Classes editable/clickable; show Partner, Relationship Lead, Lead Instructor | 4 | §1.10, §2.4/2.5, §3.4 |
| 10 | 7-day board escalation too long; configurable default | 1 | §1.3, §2.7, §3.1 |
| 11 | People Dashboard should not trap the user | 1/2 | §1.1, §3.1 |
| 12 | One clear "Deadline" instead of start/end | 3 | §1.2, §3.3 |
| 13 | Departments appear incorrect; audit/fix | 1 | §1.11, §3.1 |
| 14 | Instructor onboarding not a normal action item unless configured | 1 | §1.12, §3.1 |
| 15 | Review + profile pages: too much scroll, bad order; collapsible/intuitive | 4 | §1.13, §3.4 |
| 16 | Filter bars ("All departments") narrower/less clunky | 2 | §1.11, §3.2 |
| 17 | All Action Tracker tabs visible from every subview | 1/3 | §1.1, §3.1/3.3 |
| 18 | Action card/detail redesign: titles not account types; officer-meeting section collapsible & default-collapsed | 3 | §1.1, §3.3 |

---

## 1. Current-State Audit

### 1.0 Two parallel Action Trackers exist `[FACT]`

The portal ships **two complete action systems**. This is the single biggest piece
of context for the redesign (confirmed independently in `docs/portal-consolidation-plan.md`).

| System | Models | Routes | Deadline model | Status |
|---|---|---|---|---|
| **Leadership Action Center** (older) | `LeadershipActionItem`, `LeadershipMeeting` | `/admin/action-center/*`, `/admin/actions/*` | single `dueDate` / `weekStart` | spreadsheet/email replacement; nav-gated behind `legacyActionCenterNavEnabled` |
| **People Strategy Action Tracker** (newer — **the flagship**) | `ActionItem`, `ActionAssignment`, `Department`, `OfficerMeeting`, `FeedbackRequest`, `MemberGrowthTag`, `ActionTemplate`, `SavedActionView` | `/actions/*` (behind `ENABLE_ACTION_TRACKER`) | `deadlineStart` + `deadlineEnd` | RBAC-aware, automation/cron-driven |

The stakeholder's "Action Tracker" is the **newer `/actions/*` system**. Notably,
its create/edit forms still live on the **legacy** `/admin/actions/*` pages — a key
source of friction (§1.2).

### 1.1 Action Tracker — structure, tabs, top section, detail card

- **Tabs** are defined in `components/people-strategy/action-tracker-tabs.tsx:21-29`
  (7: Command Center, All Actions, My Actions, Classes, Officer Meetings,
  Responsibility Map, People Dashboard). `[FACT]`
- **Tabs are NOT shown on every subview** (violates comment #17): `[FACT]`
  - **My Actions** `app/(app)/actions/page.tsx:169-224` builds its **own** inline nav
    (only My Actions + Command Center + All Actions).
  - **People Dashboard** `app/(app)/actions/people/page.tsx` renders **no tab bar and
    no back-link** → navigation trap (comment #11).
  - **Action Detail** `components/people-strategy/action-detail-card.tsx:384` has only a
    "×" close link.
  - **Reporting** `app/(app)/actions/reporting/page.tsx:12` is a bare `redirect()`.
  - **Board roll-up** `app/(app)/actions/people/board-rollup/page.tsx` (has a back-link, no tabs).
- **Top section is clunky** (comment #2): the All Actions header
  (`app/(app)/actions/all/page.tsx:194-255`) stacks badge → title → subtitle →
  buttons → tab nav → `ActionFiltersBar` → `SavedViewsBar` → 5 `StatCard`s →
  analytics donut/bars — many wrapping horizontal strips with inline styles. `[FACT]`
- **Detail card uses account type, not title** (comment #18):
  `action-detail-card.tsx:198-210` `roleTitle(person.primaryRole)` title-cases the
  **role enum** (e.g. `CHAPTER_PRESIDENT` → "Chapter President"); admin subtype/title
  is ignored. `[FACT]`
- **Officer Meeting section not collapsible** (comment #18):
  `action-detail-card.tsx:455-480` renders an always-open `<section>` only when a
  meeting is linked; `Section` (`:225-251`) has no toggle. `[FACT]`

### 1.2 BUG — creation of actions (comment #7) `[FACT]`

Root causes, in order of likelihood:

1. **Mandatory separate "Executing" assignee.** The lead is *not* auto-counted as an
   executor, yet at least one Executing assignee is required at **both** layers:
   - client `components/people-strategy/action-item-form.tsx:322-324`
   - server `lib/people-strategy/action-items-actions.ts:257-259`
     (`throw new Error("At least one Executing assignee is required")`).
   A user who enters Title + Lead + Deadline is blocked with no obvious remedy.
2. **Create form lives on the legacy page and redirects away.** Every "+ New Action"
   button in the new tracker links to `/admin/actions/new`
   (`actions/command-center/page.tsx:116`, `actions/page.tsx:202`, `actions/all/page.tsx:218`).
   `ActionItemForm` is mounted only there (`app/(app)/admin/actions/new/page.tsx:113`,
   **no `onSaved`**), so on success it `router.push("/admin/actions")`
   (`action-item-form.tsx:396-400`) — dumping the user on the *legacy* list, not back
   in the Command Center. Creation appears to "do nothing / go nowhere."
3. **Required `deadlineStart`** (`action-item-form.tsx:325`) — see §1.2/§3.3 (single
   Deadline) — adds friction.
4. **Unsafe assignee picker** (§1.9) returns applicants and can surprise users.

> **Note for QA:** reproduce by creating an action with only a Lead + Deadline. The
> create path itself (`createActionItem`, schema at `action-items-actions.ts:216-243`)
> is internally consistent — the blocker is the mandatory Executing rule + the
> legacy-page redirect, not a missing column.

### 1.3 Escalation thresholds (comment #10) `[FACT]`

In `lib/people-strategy/escalation.ts`:
- `ESCALATION_THRESHOLD_MS = 48 * 60 * 60 * 1000` (`:18`) — first-stage escalation to CPO/Leadership.
- `BOARD_ROLLUP_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000` (`:84`) — the **7-day** board roll-up; used by `isBoardRollupEligible` (`:97-102`), driven by `runBoardRollups` (`action-cron.ts:689-765`).

Both are **hard-coded module constants — not configurable** (no env var / DB setting).

### 1.4 "CPO" terminology (comment #1) `[FACT]` — four categories

~283 occurrences across 50 files. **"Replace all uses" cannot be a blind find/replace.**

| Cat | What | Examples | Migration cost |
|---|---|---|---|
| (a) Stored enum/DB value | `AdminSubtype.CPO` `schema.prisma:42`; `ActionEmailType.CPO_ESCALATION` `:12362`; column `ActionItem.escalatedToCpoAt` `:12274`; seed rows `seed.ts:92,113,118` | migration `20260531120000_add_cpo_admin_subtype` | **High** (Postgres enum rename + backfill) |
| (b) User-facing label/string | `ADMIN_SUBTYPE_LABELS.CPO="Chief People Officer"` `admin-subtypes.ts:22`; UI copy `action-detail-card.tsx:314,572,589,593`; `board-rollup-list.tsx:116`; emails `lib/email.ts:757,801,845,885,990,1009,1043`; page copy `actions/people/board-rollup/page.tsx:43` | ~25 string sites | **Low — safe** |
| (c) Route/cron paths | `app/api/cron/action-cpo-escalation/route.ts`; `vercel.json:40` | needs redirect + cron reschedule | **Moderate** |
| (d) Code identifiers | `requireCPO()` `authorization.ts:173`; `isCpoOrBoard()` `action-permissions.ts:56`, `feedback-requests.ts:368`; `cpoAgeLabel`, `cpoEscalatedLabel` | internal | **Moderate** (no behavior change) |

**Plan:** do **(b)** in Phase 1 (display says "Leadership" everywhere, zero data risk).
Defer (a)/(c)/(d) to Phase 5 as an optional, carefully-migrated refactor — or keep
them internal forever (the user never sees `escalatedToCpoAt`).
> `[OPEN]` "Leadership" vs "Co-President / People Lead" as the exact replacement label.

### 1.5 Styling / professionalism (comments #2, #3) `[FACT]`

- **Light-purple background source:** `--ypp-blush: #f3ecff` (`globals.css:12`) bound to
  `--bg` (`:80`), painted on **both** `body` (`:182-191`, plus lavender radial-gradient
  glows) and `main` (`:536-541`), and the `.sidebar-marble-panel` (`:334-388`, ~15
  layered lavender gradients).
- **Fonts:** DM Sans (body, `:183`), Lora (headings, `:574`), Nunito (labels, `:583`),
  Playfair loaded; `themeColor: "#6b21c8"` (`app/layout.tsx:45`). Four display families
  is a lot for a "professional" tool.
- **Brand accent:** `--ypp-primary-brand / --primary: #6b21c8` (`:8`, `:106-107`).
- Neutral tokens already exist to pivot to: `--gray-50:#fafaf9`, `--surface-warm:#fbfaf7`.

### 1.6 Sidebar (comment #4) `[FACT]`

- Master catalog `lib/navigation/catalog.ts` ≈ **150+ links across 20 `NavGroup`s**
  (`lib/navigation/types.ts`). Heavy concentrations in Learning (~30), People & Support
  (~35, mentorship-duplicated), Chapters (~30), Admin groups (~50).
- Suppression machinery already signals known clutter: `ALWAYS_HIDDEN_HREFS`
  (`resolve-nav.ts:45-80`, ~30 hidden), per-role allowlists (`*-v1-allowlist.ts`),
  inline "Removed from nav" comments. Rendering layer (`components/nav.tsx`,
  `components/app-shell.tsx`) is capable; **the catalog is the cleanup target.**
- Action Tracker entries are in the People & Support group (`catalog.ts:397-486`,
  `requiresActionTracker`). Legacy `/my-actions`, `/all-actions`, `/officer-meetings`
  route dirs still exist alongside `/actions/*` and are mapped to canonical hrefs in
  `resolve-nav.ts:399-433`.

### 1.7 Clickable users / public profile (comment #5) `[FACT]`

- **No public per-user profile route exists** (`/u/[id]`, `/users/[id]`,
  `/people/[id]`, `/profile/[id]` — none found).
- `/profile` (`app/(app)/profile/page.tsx`) is **self-only**, an editable form, cannot
  show others.
- Users are clickable in only a few admin-gated places (e.g. People Dashboard rows →
  `/admin/instructors/{id}` via a separate button; the **name itself is plain text**,
  `people-dashboard-table.tsx:489`). Almost everywhere else (chapter members
  `chapter/members/page.tsx:120`, board roll-up `board-rollup-list.tsx:141-146`, action
  assignees) names are inert text.

### 1.8 Test accounts (comment #6) `[FACT]`

`prisma/seed.ts`, shared `SEED_PASSWORD`. Today: realistic personas + role-coded emails,
**not** "Test N", and there is **no title field** to populate (§1.14):
- Milo Wald `milo.wald@…` (CHAPTER_PRESIDENT), Brayden White `brayden.white@…` (ADMIN +
  `AdminSubtype.CPO`), Anthea Zamir (ADMIN, all 6 non-CPO subtypes), **Carly Gelles
  `carlygelles@gmail.com`** (MENTOR+STAFF — personal gmail, off-pattern), Avery Lin
  (INSTRUCTOR), Jordan Patel (STUDENT).
- Workflow seed: `demo.applicant.*@example.com`, `hiring.chair@…`, `demo.reviewer@…`.

### 1.9 Applicants vs portal users (comment #8) — **CRITICAL** `[FACT]`

- **Applicants are `User` rows**, distinguished only by `primaryRole = APPLICANT`
  (`RoleType` `schema.prisma:20-30`). No `Applicant` table; no `status`/`isActive`
  field on `User`. Application models (`InstructorApplication:1761`,
  `Application:3132`, `ChapterPresidentApplication:9394`) all `applicantId → User`.
- A `User` is created **immediately** on apply: `signup-actions.ts`,
  `external-applicant-intake.ts:193-204` (and `:553-562`), `csv-import-actions.ts:84-90`
  (`primaryRole: APPLICANT, passwordHash:"IMPORTED"`). **External/CSV intake even sets
  `chapterId` on applicants** (`external-applicant-intake.ts:200-202`), so they show up
  as chapter members.
- A shared helper exists but is inconsistently used: `lib/user-role-where.ts`
  (`whereUserHasRole` / `whereUserHasAnyRole`).

**Selectors audit:**
| Selector | File | Applicant leak? |
|---|---|---|
| Action Lead/Executing/Input picker | `lib/people-strategy/action-queries.ts:193-202` (`listActionAssignableUsers`, `where:{archivedAt:null}` only) → `action-item-form.tsx:574-599` | **YES — highest risk** |
| Chapter member directory | `lib/chapter-member-actions.ts:50-71,148-153` (chapterId only) | **YES** |
| Admin messaging recipients | `lib/messaging-actions.ts:417-426` | YES (low severity) |
| Bulk users | `app/(app)/admin/bulk-users/page.tsx:50-60` | YES (admin surface) |
| Instructor assignment pool | `lib/regular-instructor-assignments.ts:472-473` (role=INSTRUCTOR) | No (safe) |
| Mentor matching | `lib/mentor-matching.ts:47-70` (`whereUserHasRole`) | No (safe) |
| Leadership AC owner picker | `lib/leadership-action-center/queries.ts:349-361` (ADMIN/STAFF) | No (safe) |

**Root cause:** no single "active member" predicate; each selector decides independently.

### 1.10 Classes (comment #9) `[FACT]`

- Classes = **`ClassOffering`** (`schema.prisma:7035-7104`). Fields: `instructor`/
  `instructorId` (the de-facto lead), `chapterId`, `template`, schedule, status;
  co-instructors via `RegularInstructorAssignment` (role enum
  LEAD/CO_INSTRUCTOR/ASSISTANT/BACKUP, `:11872-11877`).
- **No `Partner` field. No `Relationship Lead` field.** "Lead Instructor" exists only as
  the `instructor` relation (UI label).
- Two lists with opposite behavior:
  - Admin `app/(app)/admin/classes/class-operations-list.tsx:194-251` — **clickable &
    editable** (`/admin/classes/[id]`, roster, review; reassign/logistics/capacity forms).
  - Action-Tracker `components/people-strategy/class-tracker-row.tsx` — **intentionally
    read-only** (header comment `:9-14`; no link). Shows Lead Instructor + Chapter, **not**
    Partner / Relationship Lead.

### 1.11 Departments (comments #13, #16) `[FACT]`

- `Department` is a **Prisma model** (`schema.prisma:12204-12217`, `name @unique`),
  **not an enum/constant**. `ActionItem.departmentId` is optional.
- **Bug — seed/migration drift produces overlapping departments:** `seed.ts:1532-1559`
  creates **5** ("Instruction", "Marketing" + "Instructional Affairs", "Community &
  Partnerships", "Platform & Operations"); migration
  `20260602120000_optional_action_department_and_seed` seeds only the **3** standing
  ones. Seeded action items attach to the *old* set. → cluttered, "incorrect" picker.
- **Second, conflicting concept:** the People Dashboard derives "departments" as
  free-text strings from action items (`people-dashboard.ts:231-234`,
  `people-dashboard-table.tsx:317`), never reconciled with the `Department` table.
- **Filter-bar clunk:** `action-filters-bar.tsx` selects use `.input` (`globals.css:3122-3134`:
  `width:100%; padding:10px 14px; margin-top:6px`) only partly reined in by
  `minWidth:150` (`:60`). The People Dashboard already uses a slimmer pattern
  (`people-dashboard-table.tsx:310-322`, `padding:"6px 8px"`) — copy that.

### 1.12 Instructor onboarding as an action item (comment #14) `[FACT]`

- **No production auto-creation.** No `ActionTemplate` or `createActionItem` path for
  instructor onboarding; the real onboarding workflow is separate
  (`lib/instructor-journey-actions.ts`).
- The only leak is **seed/demo data**: `seed.ts:1570-1608` creates an action titled
  "Launch fall instructor onboarding" (also a form placeholder
  `action-item-form.tsx:423`). If seeds run near a real env, it surfaces as a normal item.

### 1.13 Review & profile pages — scrolling/order/collapsibility (comment #15) `[FACT]`

None of the review surfaces collapse their **top-level** sections:
- Instructor applicant slideout `app/(app)/admin/instructor-applicants/applicant-detail-panel.tsx`
  — 12 always-rendered `slideout-section` divs (read-only data interleaved with editable controls).
- Generic application slideout `app/(app)/admin/applications/application-detail-panel.tsx`
  — 7 flat sections.
- Chair cockpit `components/instructor-applicants/final-review/FinalReviewCockpit.tsx`
  (1160 lines) — no collapse.
- Canonical detail `app/(app)/applications/instructor/[id]/page.tsx` — 7 sections;
  `CollapsibleAssignmentPanel` used only for **nested** assignment sub-panels.
- Instructor profile `app/(app)/admin/instructors/[id]/page.tsx` — 8–12 full cards;
  anchor "tabs" (`:202-211`) jump but **don't collapse**.
- **Reusable asset:** `components/instructor-applicants/CollapsibleAssignmentPanel.tsx`
  — native `<details>`, collapsed-by-default; generalize it.

### 1.14 Account type vs title — data reality (comments #6, #18) `[FACT]`

- **No `title`/`jobTitle`/`accountType` scalar on `User` or `UserProfile`.** Identity =
  `primaryRole` (enum) + `roles` + `adminSubtypes`.
- "Account type shown where a title belongs": raw `primaryRole.replace(/_/g," ")` at
  `app-shell.tsx:161`, `chapter-dashboard-actions.ts:645`, `chapters/[slug]/page.tsx:268`,
  `messages/page.tsx:173`, etc.; and `roleTitle()` in `action-detail-card.tsx:198-210`.
- Better helpers already exist: `ADMIN_SUBTYPE_LABELS` (`admin-subtypes.ts:15`),
  `roleLabelFor(stage, primaryRole)` (`lib/leadership-context.ts:88`, produces "Lead
  Instructor" etc.), `roleLabel()` (`lib/dashboard/data.ts:62`).

### 1.15 Data models involved (consolidated)

`ActionItem`, `ActionAssignment` (LEAD/EXECUTING/INPUT), `ActionComment`,
`ActionFileLink`, `ActionEmailLog`, `Department`, `OfficerMeeting`, `MeetingNote`,
`MiscUpdate`, `FeedbackRequest`, `MemberGrowthTag`, `ActionTemplate`, `SavedActionView`,
`CheckIn`/`QuarterlyReview`; `User`, `UserRole`, `UserProfile`, `UserAdminSubtype`,
`AdminSubtype`, `RoleType`; `InstructorApplication`/`Application`/`ChapterPresidentApplication`;
`ClassOffering`, `RegularInstructorAssignment`, `ClassTemplate`, `Chapter`; legacy
`LeadershipActionItem`/`LeadershipMeeting`.

---

## 2. Proposed Product Architecture

Guiding principle: **one canonical People Strategy Command Center at `/actions/*`**,
backed by the `ActionItem` family. Legacy `LeadershipActionItem` / `/admin/action-center`
and `/admin/actions/*` create-edit are folded in and redirected.

### 2.1 Actions
- Single create/edit experience **inside** `/actions` (modal or `/actions/new`), not the
  legacy `/admin/actions/*` page. On save → return to the originating tracker view.
- **One Deadline** (`deadline: DateTime`) replacing `deadlineStart`/`deadlineEnd`.
- **Lead is implicitly an executor** — Executing becomes optional; "who's doing it"
  defaults to the Lead.
- Persistent `ActionTrackerTabs` on **every** subview (incl. My Actions, People
  Dashboard, Detail).
- Detail card shows **human titles** (subtype label / pathway title / fallback role),
  collapsible sections, officer-meeting block **collapsed by default**.

### 2.2 People
- People Dashboard is a first-class, **non-trapping** tab (tabs + back-link always present).
- "People" = **active portal members** only (role ≠ APPLICANT), via a shared predicate.
- Every person name is a **link to a public profile** (§2.2/§3.4).

### 2.3 Applicants
- Applicants stay `User` rows but become a **separate audience**. Introduce one
  authoritative predicate, `isActiveMember(user)` / `whereActiveMember()` (extends
  `lib/user-role-where.ts`), excluding `primaryRole=APPLICANT` (and users whose only role
  is APPLICANT). Apply it to **all** member/people/action/chapter pickers.
- Stop writing `chapterId` onto applicants at intake (or treat chapter membership as
  role-scoped), so applicants never appear in chapter member lists.
- Applicant pipelines remain in `/admin/*applicants*`; they are never selectable as
  action Lead/Executing/Input, chapter members, class instructors, or meeting attendees.

### 2.4 Classes
- Action-Tracker Classes rows become **clickable** (deep-link to `/admin/classes/[id]`)
  while staying read-only-in-place; the admin detail page remains the edit surface.
- Surface **Partner**, **Relationship Lead**, **Lead Instructor** on both the row and
  the class detail.

### 2.5 Partners (new concept)
- New `Partner` model (org/school) with `relationshipLeadId → User` (the Relationship
  Lead). `ClassOffering.partnerId → Partner` (optional). This is what lets Classes "show
  Partner & Relationship Lead". A lightweight Partners directory can live under
  `/admin/partners` (or as an Action Tracker tab later).
- `[OPEN]` reuse existing partner-ish fields (`partnerSchool`, `WorkshopOpportunity.partnerName`)
  vs. a clean `Partner` table — recommend the clean table to avoid the department-style sprawl.

### 2.6 Meetings
- Officer Meetings consolidated at `/actions/meetings` (`OfficerMeeting`/`MeetingNote`/
  `MiscUpdate`). The action detail's officer-meeting block is collapsible/default-collapsed.
- `[OPEN]` migrate legacy `LeadershipMeeting` into `OfficerMeeting` (Phase 5).

### 2.7 Escalations
- Two-stage, **configurable**: stage-1 "Leadership escalation" (default 48h) and
  "Board roll-up" (new default **3 business days**, down from 7). Centralize in
  `lib/people-strategy/escalation.ts` reading env (`ACTION_ESCALATION_HOURS`,
  `ACTION_BOARD_ROLLUP_DAYS`) and/or a DB `AppSetting` so leadership can tune without a deploy.
- All "CPO" labels here → "Leadership".

---

## 3. Phased Implementation Plan

### Phase 1 — Critical fixes (correctness, safety, trust) `[FACT-driven]`
1. **Fix action creation (comment #7):** make Executing optional with Lead as implicit
   executor — remove the hard requirement in `action-item-form.tsx:322-324` and
   `action-items-actions.ts:257-259`; auto-add a LEAD-as-EXECUTING assignment if none
   given. Wire create as an in-`/actions` flow; on success return to `/actions/all`
   (not `/admin/actions`).
2. **Applicant separation (comment #8):** add `whereActiveMember()` to
   `lib/user-role-where.ts`; apply to `listActionAssignableUsers`
   (`action-queries.ts:193-202`), chapter member queries
   (`chapter-member-actions.ts:50-71,148-153`), and messaging. Stop setting `chapterId`
   on applicants at intake. Add a test asserting an APPLICANT cannot be assigned.
3. **CPO → Leadership, user-facing only (comment #1, category b):** change
   `admin-subtypes.ts:22` and the ~25 string sites; leave enum/column/identifiers.
4. **Departments audit (comment #13):** converge seed + migration on the 3 standing
   departments; reattach seeded action items; archive duplicates; make People Dashboard
   read the `Department` table instead of free-text strings.
5. **Escalation default (comment #10):** make thresholds env/DB-configurable; default
   Board roll-up to 3 business days.
6. **Instructor onboarding (comment #14):** remove/relabel the seeded "Launch fall
   instructor onboarding" action; document that onboarding is intentionally not a tracker item.
7. **Test accounts (comment #6):** rename seed personas to clearly-labeled
   `Test 1 … Test N` with realistic role/subtype "titles", move `carlygelles@gmail.com`
   to the org domain. (Depends on the title concept in Phase 4 for the "title" text;
   interim uses subtype/role label.)
8. **People Dashboard de-trap (comment #11):** add `<ActionTrackerTabs active="people"/>`
   + a `← Actions` back-link to `actions/people/page.tsx`.

### Phase 2 — UI / navigation cleanup (professionalism)
1. **Background/theme (comments #2, #3):** repoint `--bg`/`--ypp-blush` (`globals.css:12,80`)
   to a neutral off-white (`--surface-warm`/`--gray-50`); soften/remove body lavender
   radials (`:182-191`) and the `.sidebar-marble-panel` gradients (`:334-388`); keep
   `#6b21c8` as accent only. Consider consolidating display fonts (e.g. keep DM Sans +
   one serif). Ship behind a quick visual-regression pass.
2. **Action Tracker top section (comment #2):** consolidate the All Actions header into
   one compact toolbar (title + primary action) + a single filter row; move StatCards/
   analytics into a tighter strip.
3. **Filter bars (comment #16):** give the Action Tracker selects explicit narrow widths
   + `6px 8px` padding (mirror `people-dashboard-table.tsx:310-322`); override `.input`
   `width:100%`/`margin-top` for inline filters.
4. **Sidebar (comment #4):** prune `lib/navigation/catalog.ts` (collapse duplicate
   mentorship/chapter links, reduce `NavGroup` count), promote a single "People Strategy"
   entry, retire dead legacy links once routes are redirected.

### Phase 3 — Core Action Tracker redesign
1. **Persistent tabs everywhere (comment #17):** replace the My Actions inline nav with
   `ActionTrackerTabs`; render it on the Detail view and Reporting.
2. **Single Deadline (comment #12):** migration to add `deadline`, backfill from
   `deadlineStart`, drop `deadlineEnd` (keep a transition window); update form
   (`:547-571`), schema (`:12238-12239`), DTOs, cron `effectiveDeadline`, escalation,
   detail rendering (`:138-150`).
3. **Action card/detail redesign (comment #18):** title-resolver instead of
   `roleTitle(primaryRole)` (`:198-210`); make all detail sections collapsible; officer-
   meeting section collapsed by default (`:455-480`).
4. Inline create/edit modal within `/actions`; retire `/admin/actions/new|edit` (redirect).

### Phase 4 — Profiles & Classes integration
1. **Public profile (comment #5):** add a read-only `/people/[id]` (or `/u/[id]`) profile
   showing name, title, chapter, current ownership (actions led/executing), growth
   signals, public bio — RBAC-scoped. Make user names link to it across the portal
   (people dashboard, board roll-up, chapter members, action assignees).
2. **Title concept (comments #6, #18):** add a `title` field (on `User` or `UserProfile`)
   **or** a single `getUserTitle(user)` resolver (subtype label → pathway title →
   formatted role). Replace `primaryRole.replace(...)` sites.
3. **Classes editable/clickable + fields (comment #9):** add `Partner` + Relationship
   Lead (§2.5); deep-link Action-Tracker class rows; show Partner / Relationship Lead /
   Lead Instructor on row + detail.
4. **Collapsible review/profile sections (comment #15):** generalize
   `CollapsibleAssignmentPanel` to wrap top-level sections (collapsed by default) and
   reorder logically (identity → status → decision controls → history) across the
   applicant slideouts, Final Review cockpit, canonical detail, and instructor profile.

### Phase 5 — Best-in-class intelligence (and deep cleanup)
1. **Command Center insights:** unified "what needs attention" feed (overdue, escalated,
   unowned high-priority, at-risk people from Growth Signals + Risk Radar), per-person
   workload balancing, momentum/win-log trends.
2. **Templates & saved views** surfaced in the new create flow (`ActionTemplate`,
   `SavedActionView` already exist).
3. **Consolidate trackers:** migrate `LeadershipActionItem` + `LeadershipMeeting` into the
   `ActionItem`/`OfficerMeeting` family; retire `/admin/action-center`.
4. **Optional internal CPO rename (comment #1, categories a/c/d):** enum value, column
   `escalatedToCpoAt`, cron path, `requireCPO`/`isCpoOrBoard` — with migrations + route
   redirects + `vercel.json` cron update.

---

## 4. Risk Assessment

### 4.1 Data-migration risks
- **Single Deadline (Phase 3):** `deadlineStart` is `NOT NULL` and indexed
  (`schema.prisma:12238,12286-12288`). Migrate additively: add `deadline`, backfill =
  `deadlineEnd ?? deadlineStart`, dual-write through a transition, then drop. Update all
  indexes/cron queries that reference `deadlineStart`.
- **CPO enum rename (Phase 5):** Postgres can't easily rename an enum value in use;
  requires add-new-value + backfill `UserAdminSubtype.subtype` + `ActionEmailType` +
  column rename of `escalatedToCpoAt`. High risk → keep optional/last.
- **Departments convergence (Phase 1):** archiving/merging departments must reassign
  `ActionItem.departmentId` first to avoid orphaning items.
- **Partner model (Phase 4):** additive, low risk (nullable FK on `ClassOffering`).
- **Applicant chapterId change (Phase 1):** decide whether to **null out** existing
  applicant `chapterId`s via backfill or only role-scope the queries — backfill is
  cleaner but must not touch approved members. `[OPEN]`

### 4.2 Permission risks
- Many surfaces gate on `requireCPO`/`isCpoOrBoard`/`requireOfficer`
  (`authorization.ts:173`, `action-permissions.ts`). Relabeling must **not** change these
  guards. Keep label and authorization changes in separate commits.
- The `whereActiveMember()` predicate must not accidentally exclude legitimately
  multi-role members (e.g. someone who is INSTRUCTOR **and** historically APPLICANT) —
  base it on "has any active member role", not "lacks APPLICANT".
- `requireOfficer` (admits CHAPTER_PRESIDENT/HIRING_CHAIR) is broader than the legacy
  `LEADERSHIP_ROLES=[ADMIN,STAFF]`; reconcile when consolidating (Phase 5).

### 4.3 UI regression risks
- The lavender `--bg` is referenced widely; changing it touches every page, not just the
  Action Tracker. Snapshot key pages before/after; verify contrast for badges/pills built
  on the old purple canvas.
- Sidebar pruning can hide a route some role depends on — drive from `resolve-nav.ts`
  filters + `npm run nav:check` / `nav:ux-check` (`scripts/validate-nav.mjs`).
- Persistent tabs on My Actions / Detail must preserve the existing `showPeople` gating
  (`action-tracker-tabs.tsx:38`).

### 4.4 Testing needs
- **Unit:** `whereActiveMember` (applicant exclusion), `getUserTitle` resolver,
  escalation threshold config parsing, single-Deadline backfill logic. Extend existing
  `tests/lib/people-strategy-*`.
- **Server-action:** `createActionItem` with Lead-only (must succeed), applicant assignee
  (must reject), department reassignment on archive.
- **E2E (Playwright, `tests/e2e`):** create an action end-to-end from `/actions`; confirm
  tabs present on every subview; People Dashboard back-link; class row → detail; collapsed
  sections on review/profile; applicant never appears in pickers.
- **Migration tests:** run `prisma migrate` + seed on a clean DB and assert exactly 3
  departments, no "Launch fall instructor onboarding" action, Test N accounts present.
- **Release gates:** `npm run typecheck`, `npm run lint`, `npm run nav:check`,
  `npm run build`.

---

## 5. Open Product Decisions `[OPEN]`
1. Exact replacement label for "CPO" ("Leadership" vs "People Lead" vs "Co-President").
2. New Board roll-up default — 3 business days proposed; confirm value & business-day vs calendar.
3. Public profile visibility model — who can view whom (officers-only vs all members).
4. `title` as a stored field vs a derived resolver.
5. Partner as a new model vs reusing existing partner-ish fields.
6. Whether to backfill applicant `chapterId` to null or only role-scope queries.
7. Sidebar: target group/link count and which legacy routes to hard-redirect now.
