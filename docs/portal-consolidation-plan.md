# Portal Consolidation Plan

> Author: Staff Engineering / Product Architecture
> Date: 2026-06-02
> Status: Proposal (no code changed yet)
> Scope: YPP Pathways Portal (`ypp-pathways-portal`), Next.js 16 App Router

**How to read the evidence labels in this document**

- **[FACT]** — verified directly in the repo, with file paths/line numbers.
- **[ASSUMPTION]** — reasoned inference from the code; should be confirmed.
- **[UNKNOWN]** — open question that needs a human/product answer.

Counts below were measured against the working tree on branch
`claude/gifted-euler-frUiY` and may drift as the repo changes.

---

## Executive Summary

The YPP Pathways Portal is a **large, production-scale, multi-role Next.js 16
App Router application** — roughly **436–449 `page.tsx` files, ~94 top-level
route segments under `app/(app)`, 116 API route handlers, 133 `lib/*-actions.ts`
server-action files, 415 `lib` modules, 322 components, and 141 Prisma
migrations** [FACT]. It is feature-rich and, at a *high* level, well-structured:
a single central navigation catalog, a consistent server-page/client-component
split, and shared loading/error/empty primitives all exist.

The problem is not absence of structure — it is **organic-growth sprawl and
parallel implementations** that have accreted faster than they have been
retired. The most important finding for this initiative:

> **There are two complete, parallel "Action Tracker" products in the codebase.**
> The older **Leadership Action Center** (`LeadershipActionItem`,
> `/admin/action-center`) is a spreadsheet/weekly-email replacement. The newer
> **People Strategy Action Tracker** (`ActionItem` family, `/my-actions`,
> `/all-actions`, `/officer-meetings`, behind `ENABLE_ACTION_TRACKER`) is a
> genuinely sophisticated, RBAC-aware, automation-driven system. **The newer
> one is the flagship. The older one should be migrated into it and retired.**
> [FACT — both exist; opinion — which wins]

Beyond the Action Tracker, the portal carries the classic markers of a system
that grew through many "redesign plans" (there are at least 9 root-level
`*_PLAN.md` / `*_AUDIT.md` documents): **three authentication systems**, **8+
distinct permission-check patterns**, **dual data-fetching paths** (server
actions *and* API routes for the same domains), **four overlapping
feature-gating systems**, **four request-cache implementations**, and a
**~25-file mentorship layer** spread across four route namespaces [FACT].

This document maps the current state with evidence, recommends what to keep /
merge / deprecate / remove, defines a target architecture, and lays out a
**phased roadmap that promotes the Action Tracker to a first-class portal
capability** while paying down the highest-leverage consolidation debt. The
sequencing prioritizes **low-effort/high-impact wins** (delete dead auth,
stale docs, redirect duplicate routes) before structurally riskier merges
(unifying mentorship, collapsing the two trackers).

---

## Current-State Architecture

### Platform & stack [FACT]

| Concern | Reality | Evidence |
| --- | --- | --- |
| Framework | **Next.js ^16.2.4**, App Router only. **No `pages/` directory.** | `package.json`; `ls pages` → none |
| React | 18.2.0 | `package.json` |
| Language | TypeScript 5.5; **`typescript.ignoreBuildErrors` is ON for Vercel builds** | `next.config.mjs` (`isVercelBuild`) |
| DB / ORM | PostgreSQL + Prisma 5.22; single 12,530-line `prisma/schema.prisma`; 141 migrations | `prisma/schema.prisma`, `prisma/migrations/` |
| Styling | **Plain CSS, no Tailwind.** One ~14,531-line `app/globals.css` with CSS variables/tokens | `app/globals.css`; no `tailwind.config.*` |
| Edge middleware | `proxy.ts` (Next 16 renamed `middleware` → `proxy`); builds CSP nonce | `proxy.ts`, `next.config.mjs` headers comment |
| Realtime | Pusher | `lib/pusher*.ts`, `pusher` dep |
| Email/SMS | Resend / nodemailer / Twilio | `lib/email.ts`, `lib/sms.ts` |
| Background jobs | Vercel Cron (7 jobs incl. 4 Action Tracker crons) | `vercel.json` `crons[]` |
| Feature delivery | Env flags + DB gates + preview cookie (see below) | `lib/feature-*.ts` |

### Route groups & layouts [FACT]

```
app/
  layout.tsx            # root: fonts (DM Sans, Playfair, Nunito, Lora), metadata
  (app)/   layout.tsx   # authenticated shell; force-dynamic; loads session,
                        #   badges, feature flags, unlocks, instructor context,
                        #   then renders <AppShell>
  (public)/ layout.tsx  # login, signup, reset, magic-link, verify-email, preview, qa
  (onboarding)/ layout.tsx
  api/                  # 116 route.ts handlers across ~60 namespaces
  auth/callback         # auth callback handler
```

- **App shell**: `components/app-shell.tsx` (client) receives `roles`,
  `primaryRole`, `enabledFeatureKeys`, `unlockedSections`,
  `actionTrackerEnabled`, `publicGateActive`, `previewModeActive` and renders
  the sidebar + `<Nav>`.
- **Navigation**: `lib/navigation/catalog.ts` is a **1,176-line single source
  of truth** (~150 links across 9 groups), resolved by
  `lib/navigation/resolve-nav.ts` with per-role overrides
  (`student-v1-nav-layout.ts`, `instructor-v1-nav-layout.ts`,
  `chapter-president-v1-nav-layout.ts`, `admin-primary-nav-filter.ts`).
  `components/nav.tsx` (client, 400+ lines) renders it with search + localStorage
  collapse state.

### Server/client boundary [FACT — sampled]

Pages are **almost always async server components** that fetch and pass data to
client components (`app/(app)/page.tsx`, `goals/page.tsx`, `messages/page.tsx`,
`my-classes/page.tsx` are all server). Interactive shell pieces
(`app-shell.tsx`, `nav.tsx`) are client. **233 of 322 component files declare
`use client` (~72%)** — high, but mostly at the leaf/interactive layer, so the
boundary is *structurally* clean even if client-heavy.

### Backend integration patterns [FACT]

Two parallel server architectures coexist for the **same** domains:

- **Server Actions**: `lib/*-actions.ts` (133 files, `"use server"`).
- **API Route Handlers**: `app/api/**/route.ts` (116 files).

`TECH_STACK.md` documents both as legitimate, but in practice many domains have
*both*, doing overlapping work with different conventions (one
`revalidatePath()`s, the other `redirect()`s) — see Duplication Findings.

### Auth & permissions [FACT]

- **Current**: Supabase Auth (`lib/auth-supabase.ts` → `getSession()`,
  `lib/supabase/server.ts`).
- **Retired but present**: NextAuth — the handler at
  `app/api/auth/[...nextauth]/route.ts` returns HTTP **410 "NextAuth endpoint
  retired"**, yet `next-auth@4.24.13` is still a dependency and `app/auth/callback`
  exists.
- **Legacy fallback (still wired in)**: `lib/legacy-auth*.ts` (6 files) — HMAC
  JWT cookie (`ypp_legacy_session`), hardcoded bypass-email allowlist, bcrypt
  local-password fallback. `lib/auth-supabase.ts` imports
  `getLegacySessionFromCookies` as a fallback.
- **Permission checks are fragmented across 8+ patterns**: raw
  `roles.includes("ADMIN")`; `lib/authorization.ts` (`hasRole`/`hasAnyRole`);
  `lib/authorization-helpers.ts` (`requireMentorOrAdmin`, …); page-level
  `lib/page-guards.ts` (`redirect()`-based); Prisma `lib/user-role-where.ts`;
  domain-specific `lib/mentorship-access.ts` (with its **own** local `hasRole`);
  `lib/unlock-manager.ts` role sets; and inline guards in `@deprecated`
  `lib/goals-actions.ts`. The People Strategy tracker has its own clean,
  pure-predicate policy in `lib/people-strategy/action-permissions.ts` — a
  model worth generalizing.

### Documentation drift [FACT]

`TECH_STACK.md` ("Read This First") states the app is **Next.js 14**, that auth
is **NextAuth in `lib/auth.ts`**, and that route protection lives in
**`middleware.ts`**. In reality it is Next 16, auth is Supabase, **`lib/auth.ts`
does not exist**, and **`middleware.ts` does not exist** (it is `proxy.ts`). The
onboarding doc actively misdirects new contributors.

---

## Parallel Implementations and Duplication Findings

Grouped by domain, highest-leverage first.

### 1. Action Tracker — TWO full systems (the headline) [FACT]

| | **Leadership Action Center (older)** | **People Strategy Action Tracker (newer, flagship)** |
| --- | --- | --- |
| Models | `LeadershipActionItem`, `LeadershipMeeting`, `LeadershipActionItemInput`, `LeadershipActionItemUpdate` (`schema.prisma:11536–11660`) | `ActionItem`, `ActionAssignment`, `ActionComment`, `ActionFileLink`, `ActionEmailLog`, `OfficerMeeting`, `MeetingNote`, `Department`, `FeedbackRequest` (`schema.prisma:12115–12414`) |
| Ownership model | `primaryOwner` + free-text `ownerNames[]`; input via join; **no "executing" role** | First-class `ActionAssignmentRole` = LEAD / EXECUTING / INPUT join rows |
| Lib | `lib/leadership-action-center/` (actions, queries, digest, import, dates, constants, authorization) | `lib/people-strategy/` (action-items-actions, action-queries, action-filters, action-analytics, action-cron, action-emails, action-csv, action-permissions, escalation, officer-meetings, board-rollup, people-dashboard, …) |
| Components | `components/leadership-action-center/` (task-table, meetings, weekly-digest, import) | `components/people-strategy/` (action-tracker-tabs, action-detail-card, action-item-form, filters-bar, analytics-cards, my-actions-card, escalation-queue, board-rollup-list, officer-meetings-client, …) |
| Routes | `/admin/action-center` (+ tasks, meetings, weekly, import) | `/my-actions`, `/all-actions` (+ `/classes`), `/actions/[id]`, `/officer-meetings`, `/people` (CPO dashboard), `/people/board-rollup`, `/admin/actions` |
| Automation | Weekly digest generated on demand | **4 Vercel crons**: weekly digest, 24h warning, deadline-reached + overdue sweep, CPO escalation; plus board roll-up; all **idempotent** via `ActionEmailLog.dedupeKey` |
| Permissions | `ADMIN`/`STAFF` only | Tiered: member / officer / CPO / Board, pure-predicate policy, per-record `OFFICERS_ONLY` vs `ALL_LEADERSHIP` visibility |
| Gating | Always-on for admin/staff | `ENABLE_ACTION_TRACKER` (default OFF) + `ENABLE_ACTION_TRACKER_EMAILS` |
| Nav | `/admin/action-center` aliased "Action Items", "Weekly Action Tracker", "Leadership Action Center" | `/my-actions` & `/all-actions` aliased "Action Tracker", "Action Items" |

**Both ship "Action Tracker" / "Action Items" nav entries** (`catalog.ts:399–439`
and `:1161–1169`). This is the single most confusing duplication in the portal.
The newer system is a strict **superset** of the older one (it has departments,
assignment roles, comments+audit, file links, escalation, officer meetings,
idempotent email automation, CSV export, and a CPO dashboard). The historical
`INTEGRATION_MAP.md` even recommended *extending* the Leadership Action Center
rather than building a parallel system — that recommendation was not followed,
which is *why* there are now two. [FACT for existence; opinion that newer is superset]

### 2. "Action / task" model sprawl beyond the two trackers [FACT]

At least **eight other** action/task-shaped models exist, each with bespoke
logic: `WorkflowActionItem` (`:1422`), `MentorshipActionItem` (`:2846`, enum
`MentorshipActionItemStatus :635`), `QuickAction` (`:6769`), `LaunchTask`
(`:7288`), `GRPlanOfAction` (`:10294`), `CollegeRoadmapTask` (`:10650`),
`InstructorTask` (`:12039`), `ManualEmailTask` (`:11351`). These are not all
candidates for merging (some are genuinely different domains), but the term
"action item" is overloaded at least 10 ways in the schema.

### 3. Authentication — three systems [FACT]

Supabase (current) + retired-but-present NextAuth (410 handler, still a
dependency) + a live legacy HMAC-cookie/bcrypt fallback with a hardcoded
bypass-email allowlist. The legacy path is imported into the main session
resolver, so it is not dead — it is load-bearing for a handful of accounts.

### 4. Data fetching — dual paths per domain [FACT]

Same domain, two backends:

- **Goals**: `lib/goals-actions.ts` (`@deprecated`) **and**
  `app/api/goals/custom/create/route.ts` **and** new `lib/goal-review-actions.ts`.
- **Feedback**: `lib/feedback-actions.ts` **and**
  `app/api/feedback/submit-anonymous/route.ts` (+ `curriculum-feedback`).
- **Chapters**: 14 `chapter-*.ts` action files **and** `app/api/chapters/`.
- **Mentorship**: 7+ action files **and** `app/api/mentor/`.

Conventions diverge (server action `revalidatePath` vs route-handler
`redirect`), so behavior depends on which entry point a page happened to use.

### 5. Feature gating — four overlapping systems [FACT]

`lib/feature-flags.ts` (env kill-switches) · `lib/feature-gates.ts` (DB
`FeatureGateRule` with USER/CHAPTER/ROLE/GLOBAL scope) · `lib/public-gate.ts`
(preview cookie + allow-listed public prefixes) · `lib/instructor-gate.ts`
(env + DB subtype bypass). Terminology "flags" vs "gates" is used
interchangeably; `feature-flags.ts` reads `feature-gates` results in at least
one place (`canBypassInstructorGate`).

### 6. Caching — four request-cache implementations [FACT]

`lib/request-cache.ts`, `lib/server-request-cache.ts`,
`lib/feature-gates-request-cache.ts`, `lib/unlock-request-cache.ts` all wrap
React `cache()`. Two of them (`request-cache`, `server-request-cache`) both
cache the unread-notification count with slightly different error handling.

### 7. Mentorship — ~25 lib files, 4 route namespaces [FACT]

`lib/mentorship-*.ts` (25+) plus `lib/mentorship/`, with routes `/mentor`,
`/mentorship`, `/mentorship-program` (redirects to `/mentorship`), `/my-mentor`,
`/admin/mentorship`, `/admin/mentor-match`, `/admin/instructor-mentor-matching`.
`mentorship-program-actions.ts` is `@deprecated` but still imported by the new
`goal-review-actions.ts`; cycle logic is split across `mentorship-cycle.ts` and
`mentorship-cycle-cta.ts`; several files re-implement role checks locally.

### 8. Route-name clusters that read as duplicates [FACT — names; ASSUMPTION — overlap]

| Cluster | Routes | Verdict |
| --- | --- | --- |
| Recognition | `/awards`, `/badges`, `/achievements`, `/wall-of-fame`, `/student-of-month`, `/peer-recognition`, `/rewards`, plus `/my-mentor/awards`, `/mentorship/awards`, `/my-program/awards` | Genuine sprawl; one domain, many surfaces |
| Reflection | `/reflection` (instructor self-reflection), `/reflections` (student streaks) | Different scopes; singular/plural collision is a footgun |
| Showcase | `/showcase` (student projects), `/showcases` (seasonal events) | Different scopes; confusing names |
| Chapter | `/chapter`, `/chapters`, `/my-chapter`, `/chapter-lead` | Role/context variants; `/chapter-lead` reads legacy |
| Learning | `/courses`, `/my-courses`, `/curriculum`, `/learn`, `/my-classes` | Different semantics; terminology not standardized |
| Stubs | `/locked`, `/not-rolled-out` | Intentional gate placeholders |

### 9. Design system & forms [FACT]

- **No component library** (`components/ui/` does not exist; `components/shared/`
  has 3 files). Cards/buttons/modals are re-implemented per feature.
- **Good shared primitives do exist** and should be the seed of a real DS:
  `components/data-table.tsx`, `empty-state.tsx`, `loading-states.tsx`,
  `error-boundaries.tsx`, `kanban/`.
- **Forms are hand-rolled** (`useState` + Zod `safeParse`, no react-hook-form/
  Formik). Zod is used but **not universally** (~274 schema references, mostly
  in applications/workshops/journey-editor).
- **Loading/error coverage is thin**: 19 `loading.tsx` + 14–15 `error.tsx`
  against ~94 route segments (~25%).

---

## Consolidation Recommendations

Legend: **KEEP** · **MERGE** · **REPLACE** · **DEPRECATE** · **REMOVE**

### Action Tracker
- **KEEP & PROMOTE** the People Strategy `ActionItem` system as *the* portal
  Action Tracker.
- **DEPRECATE → MIGRATE → REMOVE** the Leadership Action Center: backfill
  `LeadershipActionItem` rows into `ActionItem` (map `primaryOwner`→LEAD,
  `inputNeededFrom`→INPUT, `LeadershipActionItemUpdate`→`ActionComment`,
  `LeadershipMeeting`→`OfficerMeeting`), preserve the weekly-digest *email
  format* as a render mode of the new digest, then **301-redirect
  `/admin/action-center*` → `/all-actions`** and delete
  `lib/leadership-action-center/` + `components/leadership-action-center/`.
- **AUDIT** the other 8 task models; fold any that are thin (e.g. `QuickAction`,
  `ManualEmailTask`) into the unified tracker or notification system where they
  clearly overlap; leave genuinely distinct domains (`CollegeRoadmapTask`,
  `MentorshipActionItem`) alone but document the boundary.

### Auth & permissions
- **REMOVE** the `next-auth` dependency and `app/auth/callback` /
  `app/api/auth/[...nextauth]` once confirmed unused (the handler already 410s).
- **KEEP** Supabase as the one auth system; **time-box** the legacy fallback:
  migrate the bypass-allowlist accounts to Supabase, then **REMOVE**
  `lib/legacy-auth*.ts`.
- **REPLACE** the 8+ permission patterns with **one canonical authorization
  module**, generalized from the clean pure-predicate design already in
  `lib/people-strategy/action-permissions.ts`. Layer it: pure predicates →
  `requireX()` action guards → `requirePageRoles()` page guards →
  `whereUserHasRole()` query filters. Delete local `hasRole` copies.

### Data fetching
- **Pick one path per domain.** Default rule: **mutations + page data =
  Server Actions in `lib/<domain>/`**; **API routes reserved for** webhooks,
  cron, third-party callbacks, file/CSV streaming, and non-React clients.
- **REMOVE** redundant API routes that merely wrap an existing server action
  (e.g. `app/api/goals/custom/create`), and finish the `goals` →
  `goal-review` migration.

### Feature gating & caching
- **MERGE** `feature-flags.ts` + `feature-gates.ts` into one `lib/features/`
  module with explicit semantics (env = kill-switch; DB = per-scope rollout);
  keep `public-gate` and `instructor-gate` as thin consumers.
- **MERGE** the four request caches into one `lib/cache/` with named keys; this
  is low-risk and removes the duplicate notification-count caches.

### Mentorship
- **CONSOLIDATE** `lib/mentorship-*.ts` into a layered `lib/mentorship/`
  (access → read-fragments/queries → actions → integrations); make
  `mentorship-cycle` the single source of cycle state; archive
  `mentorship-program-actions.ts`. **REMOVE** the `/mentorship-program` redirect
  route; collapse `/my-mentor` and `/mentor` sub-trees into `/mentorship` with
  role-based views.

### Routing & naming
- **MERGE** recognition surfaces under one `/recognition` hub with role-aware
  tabs (awards, badges, peer recognition, wall of fame).
- **RENAME/REDIRECT** the singular/plural collisions (`/reflection` vs
  `/reflections`, `/showcase` vs `/showcases`) to unambiguous names.
- **COLLAPSE** `/chapter-lead` into `/chapter`; standardize learning
  terminology (classes vs courses vs curriculum) and redirect the losers.

### Docs & build hygiene
- **REPLACE** `TECH_STACK.md` with an accurate version (Next 16, Supabase,
  `proxy.ts`, no `lib/auth.ts`).
- **TIGHTEN** the build: `typescript.ignoreBuildErrors` is ON for Vercel —
  drive type errors to zero, then turn it off so prod builds fail loudly.

---

## Action Tracker Vision

**The Action Tracker is the portal's operational backbone — the single place
where every commitment across YPP (instruction, hiring, mentorship, chapters,
marketing, technology) is captured, owned, tracked to a deadline, escalated when
at risk, and reported on.** It already has the bones of this: role-based
ownership, departments, comments with an audit trail, officer meetings,
idempotent reminder automation, CPO escalation, and a board roll-up.

The vision is to take it from a **strong, flag-gated internal tool** to the
**flagship first-class surface of the portal**:

1. **One tracker, everywhere.** Retire the parallel Leadership Action Center so
   there is exactly one "actions" concept, reachable from a top-level nav entry
   and surfaced contextually on every related record (a mentorship, a class, an
   applicant, a chapter).
2. **Personal by default, organizational on demand.** Every user lands on *My
   Actions* (what I owe and what I'm waiting on); leaders pivot to *All Actions*,
   the *People Dashboard*, and *Reporting* without leaving the product.
3. **Proactive, not passive.** Deadlines, reminders, escalations, and digests do
   the chasing. The system tells you what's slipping before a human has to ask.
4. **Connected.** Actions cross-link to the records they advance, so the tracker
   becomes the connective tissue of the portal rather than another silo.
5. **Trustworthy.** Strict per-record visibility, a complete audit trail, and
   idempotent automation make it safe to run the organization on.

Positioning: where the rest of the portal is about *learning and growth*, the
Action Tracker is about *execution and accountability* — and it is the feature
leadership will open every single day.

---

## Action Tracker Feature Recommendations

Organized by capability area, split into **Must-have (flagship baseline)** and
**Nice-to-have (differentiators)**. Items marked ✅ already exist (KEEP);
the rest are roadmap.

### Workflow / status modeling
- ✅ Statuses `NOT_STARTED / IN_PROGRESS / COMPLETE / OVERDUE`, with `effectiveStatus`
  computing OVERDUE from deadlines.
- **Must-have**: add `BLOCKED` and `CANCELLED`; configurable per-department
  workflows; explicit `StatusTransition` audit rows (today transitions are
  inferred from system comments).
- **Nice-to-have**: WIP limits per owner; SLA policies per priority.

### Ownership & assignment
- ✅ LEAD / EXECUTING / INPUT roles via `ActionAssignment`; denormalized `leadId`.
- **Must-have**: priority field (the schema has no explicit `priority` — Leadership
  Action Center had `LeadershipActionPriority`; port it); team/department-level
  assignment; reassign-with-handoff that notifies both parties.
- **Nice-to-have**: capacity/workload view (the People Dashboard already surfaces
  a "workload warning" — promote it to a planning tool).

### Due dates & reminders
- ✅ `deadlineStart`/`deadlineEnd`; 24h warning, deadline-reached, overdue sweep,
  weekly digest crons; idempotent via `ActionEmailLog`.
- **Must-have**: snooze/defer with reason; per-user reminder preferences;
  timezone-correct scheduling (verify the operating-week math is TZ-safe).
- **Nice-to-have**: smart reminders (nudge the LEAD before the INPUT provider is
  blocked).

### Comments & collaboration
- ✅ `ActionComment` (NOTE / INPUT_REQUESTED), system entries with null author.
- **Must-have**: @mentions that notify; resolve/unresolve on INPUT_REQUESTED;
  rich text (TipTap is already a dependency).
- **Nice-to-have**: reactions; email-reply-to-comment.

### History / audit trail
- ✅ Audit recorded as system `ActionComment` rows (created, status change,
  reassignment, flag, escalation, board roll-up).
- **Must-have**: a dedicated, queryable `ActionEvent` table (don't overload
  comments for audit); per-field diffs; "what changed since I last looked".
- **Nice-to-have**: exportable activity log for compliance.

### Filtering, sorting, saved views, search
- ✅ `parseActionFilters`/`applyActionFilters` (department, status, visibility,
  search, sort-by-deadline); status donut + department bars on `/all-actions`.
- **Must-have**: **saved views** (persisted filter sets per user/role);
  multi-field sort; full-text search across title/description/comments.
- **Nice-to-have**: shareable view URLs; "smart" system views (My overdue, Needs
  my input, Escalated).

### Dashboards & reporting
- ✅ CPO People Dashboard (`/people`), status/department analytics, CSV export
  honoring filters, board roll-up (`/people/board-rollup`).
- **Must-have**: department/owner throughput and cycle-time charts; trend over
  time (created vs completed vs overdue); a leadership "executive summary".
- **Nice-to-have**: scheduled report emails; embeddable widgets on role
  dashboards.

### Notifications
- ✅ Transactional assignment emails + cron reminders/escalations.
- **Must-have**: unify with the portal `Notification` system for **in-app**
  notifications (today the tracker emails but does not appear to push to the
  in-app feed by design); per-channel preferences; digest opt-in.
- **Nice-to-have**: Slack/Pusher real-time push; mobile-friendly notification center.

### Cross-linking with related portal records
- ✅ Reads Quarterly Reviews, Monthly Check-Ins, Mentorship pairs, and Classes
  into the People Dashboard / My Actions.
- **Must-have**: a **polymorphic link** (`ActionItem.relatedType/relatedId`) so
  an action can attach to an *application*, *mentorship*, *class*, *chapter*, or
  *member*; render an "Actions" panel on those records.
- **Nice-to-have**: auto-create actions from other records (e.g. "applicant
  awaiting decision" → action for the hiring chair).

### Automations / triggers
- ✅ Cron-driven status sweep + escalation pipeline (flag/overdue → 48h → CPO →
  7d → Board), all idempotent.
- **Must-have**: a small rules engine ("when status=BLOCKED for 3 days, notify
  LEAD's manager"); finish the **stubbed** officer-meeting agenda/summary
  generation (`OfficerMeeting.agendaText/summaryEmailText` are currently written
  by stubbed generators — wire the Anthropic SDK that's already a dependency).
- **Nice-to-have**: webhook/Zapier out; custom trigger builder for CPO.

### Templates / recurring actions
- **Must-have**: action templates (title/description/role placeholders/checklist)
  and **recurring actions** (weekly/monthly) — none exist today.
- **Nice-to-have**: department playbooks (a bundle of templated actions for, e.g.,
  onboarding a new instructor).

### Bulk operations
- **Must-have**: multi-select on `/all-actions` for bulk reassign / set deadline /
  change status / link to meeting / export. There is a general
  `lib/bulk-actions.ts` to build on; the tracker currently has none.
- **Nice-to-have**: bulk import (the Leadership Action Center's paste-from-
  spreadsheet importer is worth porting before deleting it).

### Role-based experiences
- ✅ Member / Officer / CPO / Board tiers with strict per-record visibility.
- **Must-have**: tailored landing per tier (member = My Actions; officer = All
  Actions; CPO = People Dashboard; Board = roll-up + exec summary).
- **Nice-to-have**: chapter-scoped tracker views for Chapter Presidents.

---

## Target Next.js Architecture

A pragmatic target — **evolve, don't rewrite**. The high-level structure is
already sound; the work is consolidation and convention-enforcement.

### Routing & route groups
```
app/
  (public)/         # unauth: login/signup/reset/preview
  (onboarding)/     # first-run
  (app)/            # authenticated shell (force-dynamic, AppShell)
    actions/        # ← FLAGSHIP: the one Action Tracker
      page.tsx           # My Actions (default landing for the tracker)
      all/                # All Actions (officer+) — folds /all-actions
      [id]/               # detail
      meetings/           # officer meetings — folds /officer-meetings
      people/             # CPO dashboard — folds /people
      reporting/          # dashboards & exports
    (recognition)/   # awards/badges/wall-of-fame/peer (merged)
    (mentorship)/    # one mentorship tree, role-based views
    (chapters)/      # chapter hub (CP/student/public views)
    (learning)/      # classes/curriculum/courses (standardized)
    admin/           # admin-only surfaces (action-center REMOVED)
  api/               # webhooks, cron, callbacks, file/CSV streaming ONLY
```
- Use **route groups for ownership boundaries** and **per-section `layout.tsx`**
  to scope nav/headers. Promote the Action Tracker to a **top-level nav entry**
  (not buried under `/admin` or behind two parallel entries).
- Add `loading.tsx`/`error.tsx`/`not-found.tsx` per section (raise coverage from
  ~25% toward ~100% on data-fetching routes), seeded from the existing
  `loading-states.tsx` / `error-boundaries.tsx`.

### Server/client boundaries
- **Server components fetch**; client components are interactive leaves. Keep
  data access in `lib/<domain>/queries.ts` (server-only) and never import Prisma
  into client components. Audit the ~72% `use client` rate to ensure it's
  leaf-level, not page-level.

### Backend integration (the rule)
- **Server Actions** (`lib/<domain>/actions.ts`, `"use server"`) for all
  mutations + form handling.
- **API Routes** strictly for: cron (`/api/cron/*`), webhooks/callbacks, file &
  CSV streaming (`/api/.../export.csv`), and non-React consumers.
- One domain → one `lib/<domain>/` folder: `actions.ts`, `queries.ts`,
  `permissions.ts` (pure predicates), `schemas.ts` (Zod), `constants.ts`.

### Cross-cutting platform modules (consolidated)
- `lib/auth/` — Supabase session + one canonical authorization layer (predicates
  → guards → page guards → query filters), modeled on
  `people-strategy/action-permissions.ts`.
- `lib/features/` — merged flags+gates (env kill-switch + DB rollout).
- `lib/cache/` — one request-cache with named keys.
- `lib/notifications/` — one notification spine (in-app + email + Pusher) that
  the Action Tracker emits into.

### Design system
- Promote `data-table`, `empty-state`, `loading-states`, `error-boundaries`,
  `kanban` and the `globals.css` tokens into a real, documented
  **`components/ui/`** kit. Adopt **react-hook-form + Zod** as the standard form
  stack and migrate forms incrementally. Do **not** introduce Tailwind in this
  initiative — keep the CSS-variable design system, just centralize it (the
  14.5k-line `globals.css` should be split into token + component layers).

### Data model
- The Action Tracker model is the template for "good": typed enums, explicit
  join rows, idempotency ledgers, strong indexing. Apply the same rigor when
  folding legacy models in. Add `ActionEvent` (audit), `priority`, polymorphic
  `relatedType/relatedId`, and `SavedView`/`ActionTemplate` tables.

---

## Delivery Roadmap

Phased for **value-early, risk-late**. Each phase is independently shippable.

### Phase 0 — Quick wins (days, low risk, high signal)
- Rewrite `TECH_STACK.md` to reality (Next 16, Supabase, `proxy.ts`). **[½ day]**
- Remove `next-auth` dep + dead NextAuth callback after confirming 410-only. **[1 day]**
- **Resolve the two-tracker nav confusion immediately**: hide the
  `/admin/action-center` nav entry behind a deprecation flag and point its
  aliases at the new tracker (no data migration yet). **[1 day]**
- Merge the four request caches into `lib/cache/`. **[1–2 days]**
- Add `loading.tsx`/`error.tsx` to the top 15 highest-traffic data routes using
  existing primitives. **[2 days]**

### Phase 1 — Promote the Action Tracker to flagship (1–2 sprints)
- Move routes to a top-level `app/(app)/actions/*` group; add a top-level nav
  entry; keep old paths as redirects. **[3–4 days]**
- Turn `ENABLE_ACTION_TRACKER` on for leadership in production (it's
  production-ready); keep emails behind their own switch until verified. **[1 day + QA]**
- Ship **saved views**, **priority**, and **in-app notifications** (wire tracker
  events into the portal `Notification` feed). **[1 sprint]**
- Finish the **stubbed officer-meeting agenda/summary generation** with the
  Anthropic SDK. **[3–4 days]**

### Phase 2 — Retire the Leadership Action Center (1 sprint, data-sensitive)
- Write + dry-run a backfill migrating `LeadershipActionItem` → `ActionItem`
  (owners→assignments, updates→comments, meetings→officer meetings). **[1 sprint]**
- Port the spreadsheet **importer** and the weekly-digest **email format** as a
  render mode of the new digest. **[3 days]**
- 301-redirect `/admin/action-center*` → `/actions/*`; delete
  `lib/leadership-action-center/` + components. **[1 day after soak]**

### Phase 3 — Authorization & data-fetching consolidation (1–2 sprints)
- Stand up `lib/auth/` canonical authorization; migrate call sites off the 8
  patterns incrementally (start with new code + Action Tracker). **[ongoing]**
- Migrate bypass-allowlist accounts to Supabase; delete `lib/legacy-auth*.ts`. **[1 sprint]**
- Enforce the "actions for mutations, API for cron/webhooks/files" rule; delete
  redundant API routes (goals, feedback) as their server actions take over. **[1 sprint]**

### Phase 4 — Mentorship & recognition consolidation (2 sprints)
- Layer `lib/mentorship/`; single cycle source; archive deprecated actions;
  collapse `/mentor` + `/my-mentor` + `/mentorship-program` into `/mentorship`. **[1–2 sprints]**
- Merge recognition surfaces into `/recognition`; redirect singular/plural
  collisions; collapse `/chapter-lead`. **[1 sprint]**

### Phase 5 — Action Tracker differentiators (ongoing)
- Templates + recurring actions; bulk operations; polymorphic cross-linking +
  per-record Actions panels; rules engine; reporting/trends; `ActionEvent`
  audit table. Sequence by leadership demand.

### Phase 6 — Platform hardening (ongoing, parallelizable)
- Merge `feature-flags` + `feature-gates` into `lib/features/`.
- Stand up `components/ui/` + react-hook-form migration.
- Drive type errors to zero; turn off `ignoreBuildErrors`.

---

## Implementation Log & Continued Roadmap (updated 2026-06-04)

> This section continues the plan above — it does not replace it. It records
> what has actually shipped since the proposal was written, then defines the
> next concrete phases that turn the Action Tracker into YPP's **People Strategy
> Operating System**: the daily command surface for who owns what, what is
> slipping, who is doing great work, and who needs support.

### Completed since the proposal [FACT — verified in working tree]

- **Phase 1 routing is done.** The flagship lives at `app/(app)/actions/*`
  (`page.tsx` = My Actions, `all/`, `[id]/`, `meetings/`, `people/`,
  `people/board-rollup/`, `reporting/`). The legacy entries `/my-actions`,
  `/all-actions`, `/officer-meetings`, `/people`, `/actions/reporting` are now
  thin `redirect()` shims into the new group. A shared `ActionTrackerTabs`
  component navigates between surfaces.
- **Design-token migration done.** People Strategy / Action Tracker UI runs on
  the YPP CSS-variable design system; statuses render through one shared
  `StatusPill`; restrained Motion polish is in place with a user motion
  preference override.
- **Departments + officer meetings + escalation + board roll-up** are live:
  optional `Department` on actions, standing departments seeded, CPO escalation
  queue, and a Board roll-up of unresolved escalations.
- **People Dashboard** (`/actions/people`) compiles live Quarterly Review,
  Monthly Check-In, mentorship, and action data into per-person rows with a
  workload warning and a performance/potential matrix label.

### Shipped in this iteration — the Command Center [FACT]

A new officer-tier surface, `app/(app)/actions/command-center/page.tsx`, gated by
`ENABLE_ACTION_TRACKER` and `requireOfficer()`. It is **read-only over existing
data** — no schema change — and composes a single visibility-checked read
(`listVisibleActionItems`) through new pure selectors:

- `lib/people-strategy/momentum.ts` — transparent momentum scoring
  (`scoreMomentum`, labels Strong / Steady / Needs Support / At Risk / No
  Recent Signal) + the **Follow-Up Generator** text drafting (`generateFollowUp`,
  four tones). Pure, no DB; unit-tested.
- `lib/people-strategy/command-center-selectors.ts` — `buildWeeklyPulse`,
  `buildAttentionQueue`, `buildPersonMomentum`, `buildTeamMomentum`,
  `buildWinLog`, `topContributors`. Pure; unit-tested.
- `lib/people-strategy/command-center.ts` — the one DB loader, mirroring the
  People Dashboard loader convention.
- `components/people-strategy/follow-up-generator.tsx` — client tool that drafts
  a copyable nudge per tone (nothing is sent).

The page delivers six of the requested capabilities at once: **Command Center
View**, **Weekly Leadership Pulse**, **Leadership Attention Queue**, **Momentum
Score**, **Team Risk Radar**, **Win Log**, and the **Follow-Up Generator**. A
new "Command Center" tab + top-level nav entry (`/actions/command-center`) wire
it into the tracker. Tests: `tests/lib/people-strategy-momentum.test.ts`,
`tests/lib/people-strategy-command-center-selectors.test.ts` (12 cases, green;
`tsc --noEmit` clean; eslint clean).

**Known approximation [ASSUMPTION]:** "completed this week" uses a COMPLETE
item's `updatedAt` as the completion time (the schema has no `completedAt`).
Exact in the common case; a dedicated `completedAt` column is in Phase 7 below.

### Phase 7 — Smart Status Buckets, Priority & My Commitments (next, mostly additive)

Turns the four-state status model into the richer buckets leadership actually
thinks in, and gives every leader a focused "what I owe" view.

- [ ] **Add `priority`** to `ActionItem` (`LOW | MEDIUM | HIGH | URGENT`, default
      `MEDIUM`) — port the concept from the retired `LeadershipActionPriority`.
      Additive enum + nullable-with-default column = safe migration.
- [ ] **Add `BLOCKED` and `DROPPED`** to `ActionItemStatus`, plus a derived
      **"Waiting on someone"** bucket (already computable from an open INPUT
      assignment + unresolved `INPUT_REQUESTED` comment) and a **"Needs
      Leadership Decision"** bucket (an explicit flag, e.g. reuse `flaggedAt`
      with a reason, or a small `needsDecision` boolean). Surface all buckets in
      `action-filters.ts` and the filter bar.
- [ ] **Add `completedAt`** so the Win Log / pulse / momentum stop approximating
      with `updatedAt`. Backfill from the latest "status → COMPLETE" system
      comment where present.
- [ ] **My Commitments view**: promote the existing My Actions page into a
      sharper personal command view — group by priority and bucket, show meeting
      source, and add a "needs my decision / my input" lane. (Most data already
      flows through `my-actions-selectors.ts`.)
- [ ] Feed `priority` + buckets into the Command Center pulse, attention queue,
      and momentum weighting.

### Phase 8 — Responsibility Map, Risk Radar & Growth Signals (people-centric)

Makes the human side first-class: who is overloaded, who has disappeared, who is
ready for more.

- [ ] **Responsibility Map** (`/actions/people` tab or new `/actions/responsibility`):
      one row per leader → current responsibilities, open/overdue items,
      teams/initiatives, and an **overloaded / underutilized** read. Build on
      `buildPersonMomentum` + the People Dashboard loader; surface the existing
      workload warning here as a planning tool.
- [ ] **People Risk Radar**: extend the Attention Queue with *person-level*
      signals — no login/activity in N days (needs `User.lastLoginAt`/session
      data — confirm availability), repeated missed deadlines, no assigned work,
      key role with no backup, team with many blocked items.
- [ ] **Succession / Growth Signals**: lightweight tags
      (`ready-for-more`, `needs-training`, `reliable-executor`,
      `strong-communicator`, `potential-team-lead`, `at-risk-of-disengaging`).
      The Quarterly Review already has a `successionFlag`; generalize it into a
      small `PersonTag`/`GrowthSignal` model rather than a parallel system.
- [ ] Connect growth tags ↔ momentum so "high-potential person with no current
      ownership" auto-surfaces in the Attention Queue.

### Phase 9 — Templates & Meeting-to-Action Workflow (operational backbone)

Closes the loop from a meeting to tracked follow-through, and removes the
blank-page tax for common YPP tasks.

- [ ] **Action Item Templates** (`ActionTemplate` model): seed YPP playbook
      templates — onboard new instructor, follow up with applicant, schedule
      officer meeting, review chapter president, confirm camp partnership, assign
      instructor to class, collect training completion, check inactive volunteer,
      prepare leadership meeting agenda. Pre-fill title/description/roles/checklist.
- [ ] **Meeting-to-Action workflow**: in the Officer Meetings surface, capture
      decisions → spin up action items inline (promised-by / due-by), then make
      the tracker the post-meeting follow-up system. Wire the **stubbed**
      `OfficerMeeting.agendaText`/`summaryEmailText` generators to the Anthropic
      SDK that is already a dependency.
- [ ] **Saved views** (`SavedView` model): persisted filter sets per user/role
      (My overdue, Needs my input, Escalated, By department), shareable by URL.
- [ ] **Polymorphic cross-linking** (`ActionItem.relatedType/relatedId`): attach
      an action to an application, mentorship, class, chapter, or member, and
      render an "Actions" panel on those records.

### New Action Tracker / People Strategy feature ideas (backlog)

- **Momentum trend over time** — snapshot weekly pulse + per-person momentum so
  the Command Center can show ▲/▼ vs last week (needs a small `PulseSnapshot`).
- **In-app notification spine** — emit tracker events into the portal
  `Notification` feed (today the tracker is email + cron only).
- **Recurring actions** — weekly/monthly auto-spawn from a template.
- **Bulk operations** on `/actions/all` — multi-select reassign / set deadline /
  link to meeting / export (build on `lib/bulk-actions.ts`).
- **Weekly executive briefing email** — render the Command Center pulse as the
  Monday digest (fold in the Leadership Action Center's weekly-email format
  before deleting it).
- **Chapter-scoped Command Center** for Chapter Presidents (chapter-filtered
  attention queue + momentum).

### Implementation checklist (running)

- [x] Command Center page + nav + tab (`/actions/command-center`).
- [x] Momentum scoring + labels (pure, tested).
- [x] Weekly Pulse, Attention Queue, Team Risk Radar, Win Log, Top Contributors.
- [x] Follow-Up Generator (copyable, 4 tones, editable; nothing sent).
- [x] Mobile-responsive Command Center grid; design-token styling.
- [x] Unit tests green; `tsc --noEmit` clean; eslint clean on new files.
- [x] **Phase 7** — `priority` (LOW/MEDIUM/HIGH/URGENT), `BLOCKED`/`DROPPED`
      statuses, exact `completedAt`, `smartBucket()` derived buckets, priority
      filter + priority-desc sort, priority surfaced across the tracker, CSV +
      status donut updated; Command Center attention/pulse/momentum priority-aware.
- [x] **Phase 8** — `MemberGrowthTag` model + growth-signal actions, the
      Responsibility Map (`/actions/responsibility`) with inline growth-tag
      editor, and the People Risk Radar.
- [x] **Phase 9** — `ActionTemplate` model + seeded YPP playbook + new-action
      gallery/prefill; `SavedActionView` model + saved-views bar on All Actions;
      officer-meeting agenda gains a "Commitments (promised by · due by)" section.
- [ ] **Phase 9 follow-up (deferred):** true polymorphic cross-linking
      (`ActionItem.relatedType/relatedId` + per-record "Actions" panels) — needs
      per-record-type UI wiring across applications/mentorship/classes/chapters,
      best done as its own change. Per-record file links already cover the
      lightweight case today.

### Schema changes shipped (Phases 7–9)

| Migration | Adds |
| --- | --- |
| `20260604130000_add_action_priority_status_buckets` | `ActionPriority` enum; `ActionItem.priority`, `ActionItem.completedAt` (+ indexes, backfill); `BLOCKED`/`DROPPED` on `ActionItemStatus` |
| `20260604140000_add_member_growth_tags` | `GrowthTag` enum; `MemberGrowthTag` table |
| `20260604150000_add_action_templates_and_saved_views` | `ActionTemplate` table (seeded) + `SavedActionView` table |

All migrations are idempotent (guarded enum/type/FK creation, `IF NOT EXISTS`)
and the Prisma client has been regenerated. **A new field is still needed for
one honestly-deferred item:** a `readyForReview` flag (or status) would let the
"Ready for Review" smart bucket be derived rather than omitted; and a
`User.lastLoginAt` would let the Risk Radar add a true "no recent login" signal
(today it uses action-activity signals only).

## Risks and Tradeoffs

- **Data migration risk (Leadership Action Center → ActionItem).** Real
  operational data lives in the older tracker (`prisma/seed.ts` seeds it for
  Brayden). *Mitigation*: dry-run on a snapshot, dual-write/soak period, keep
  read-only access during cutover, reversible migration. [FACT data exists]
- **Auth is load-bearing.** The legacy fallback serves specific accounts;
  removing it carelessly locks people out. *Mitigation*: migrate accounts first,
  feature-flag the removal, verify the bypass allowlist is empty before deleting.
- **Big-bang consolidation could stall the org.** *Mitigation*: every phase is
  independently shippable behind flags; never block feature work on a refactor.
- **Build currently hides type errors on Vercel** (`ignoreBuildErrors`). Turning
  it off may surface a backlog. *Mitigation*: fix incrementally, flip last.
- **Route renames break links/bookmarks.** *Mitigation*: 301 redirects for every
  moved/merged route; never hard-delete a user-facing path.
- **"Consolidate everything" is a trap.** Some look-alike routes are legitimately
  role-specific (`/my-actions` vs `/all-actions`, `/instructor-training` vs
  `/student-training`). *Mitigation*: merge by *evidence of true overlap*, not by
  name similarity.
- **Single giant `schema.prisma` (12.5k lines) and `globals.css` (14.5k lines)**
  are merge-conflict and review hotspots. *Mitigation*: consider Prisma schema
  folding and CSS layering as low-priority hygiene, not blockers.
- **Opportunity cost.** Engineers doing consolidation aren't shipping features.
  *Mitigation*: front-load the Action Tracker promotion (visible value) before
  the invisible plumbing.

---

## Open Questions

1. **[UNKNOWN]** Is the Leadership Action Center actively used in production
   today, and by whom? This sets the urgency and data-migration scope of Phase 2.
2. **[UNKNOWN]** Which accounts still rely on the legacy auth bypass/local-
   password fallback? Can they all move to Supabase?
3. **[UNKNOWN]** What is the intended go-live audience for the Action Tracker —
   national leadership only, or also Chapter Presidents (chapter-scoped views)?
4. **[UNKNOWN]** Is the in-app `Notification` feed intentionally *excluded* from
   the tracker (email-only by design), or is in-app integration desired?
5. **[UNKNOWN]** Are the 8 other task models (`WorkflowActionItem`,
   `MentorshipActionItem`, `QuickAction`, `LaunchTask`, `GRPlanOfAction`,
   `CollegeRoadmapTask`, `InstructorTask`, `ManualEmailTask`) owned by different
   teams? That affects whether any can be folded into the unified tracker.
6. **[UNKNOWN]** Is the team open to adopting react-hook-form, or should forms
   stay hand-rolled with a thin shared abstraction?
7. **[UNKNOWN]** Target timeline/headcount for this initiative — determines how
   aggressively phases can run in parallel.
8. **[ASSUMPTION → confirm]** The newer People Strategy tracker is a functional
   superset of the Leadership Action Center (verified by feature comparison, not
   by a line-by-line behavioral diff).

---

## Top 10 Recommended Actions

1. **Declare one Action Tracker.** Designate the People Strategy `ActionItem`
   system as canonical and the Leadership Action Center as deprecated — today,
   in writing and in nav. *(Quick win, unblocks everything else.)*
2. **Promote the tracker to a top-level nav entry** at `app/(app)/actions/*`,
   redirecting `/my-actions`, `/all-actions`, `/officer-meetings`, `/people`.
3. **Fix `TECH_STACK.md`** and remove the dead `next-auth` dependency / NextAuth
   callback. *(Hours of work, removes active misdirection.)*
4. **Turn the Action Tracker on for leadership** in production (it's
   production-ready), emails behind their own verified switch.
5. **Migrate & retire the Leadership Action Center** (backfill into `ActionItem`,
   port the importer + digest format, 301-redirect, delete the old lib/components).
6. **Ship the three highest-value tracker features**: saved views, priority,
   and in-app notifications wired into the portal `Notification` feed.
7. **Finish the stubbed officer-meeting agenda/summary generation** using the
   already-present Anthropic SDK.
8. **Stand up one canonical authorization layer** (generalized from
   `people-strategy/action-permissions.ts`) and migrate the legacy auth
   allowlist accounts to Supabase, then delete `lib/legacy-auth*.ts`.
9. **Enforce one backend pattern** (Server Actions for mutations; API routes for
   cron/webhooks/files) and delete the redundant goals/feedback API routes.
10. **Consolidate the plumbing**: merge the 4 request caches into `lib/cache/`,
    the 2 feature systems into `lib/features/`, and raise loading/error coverage
    on data routes from ~25% toward ~100%.

---

## North Star Vision

**A single, unified YPP Pathways Portal where execution and growth live in one
coherent system — and where the Action Tracker is the daily operating surface
for everyone who runs the organization.**

A member opens the portal and sees exactly what they owe and what they're
waiting on. An officer pivots to the full department board, links items to this
week's meeting, and lets the system generate the agenda. The CPO watches the
People Dashboard, where slipping work has already escalated itself. The Board
reads a roll-up that wrote itself. Every action is tied to the mentorship,
class, applicant, or chapter it advances, so the tracker is the connective
tissue of the portal rather than another silo. Underneath, there is **one** auth
system, **one** way to fetch data, **one** feature-flag system, **one** design
system — so the next feature ships in days, not weeks, and new contributors are
productive on day one because the docs are true and the patterns are singular.

The portal stops being "many overlapping tools that grew together" and becomes
"one product with a flagship."

---

## Leadership Pitch

YPP has already built something most organizations never get: a genuinely
sophisticated, automation-driven Action Tracker — role-based ownership,
deadline reminders, automatic escalation to the CPO and roll-up to the Board,
a full audit trail, and a people dashboard — **and it's production-ready but
hidden behind a feature flag, sitting next to an older duplicate that confuses
the navigation.**

This plan does two things at once. First, it **turns on and promotes the
Action Tracker as the portal's flagship** — the surface leadership opens every
day to see what's moving, what's stuck, and what needs them — and finishes the
last 10% (saved views, priorities, in-app notifications, AI-generated meeting
agendas). Second, it **pays down the sprawl** that's slowing the team:
collapsing two trackers into one, three auth systems into one, dual data paths
into one convention, and four caches/feature-flag systems into one each.

The sequencing is deliberately **value-first and low-risk**: the visible wins
(flagship tracker, accurate docs, cleaner nav) land in the first one or two
sprints; the structural cleanups happen behind feature flags and redirects, so
**no user-facing path ever breaks and feature work never stops**. The payoff is
compounding: an organization that runs on the tracker, and an engineering team
that ships the next thing in days instead of fighting four ways to do everything.

We're not asking to rebuild the portal. We're asking to **finish the flagship
and unify the foundation** — and we can show the first results within two weeks.
