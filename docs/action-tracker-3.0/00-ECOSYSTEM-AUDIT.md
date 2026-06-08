# Action Tracker 3.0 — Ecosystem Audit (Mandatory Pre-Work)

> **Status:** Audit complete. No implementation has begun.
> **Scope:** Mentorship, Chapters, Leadership/Instructor pipelines, Student growth,
> Action systems, Points/Recognition, Projects, Dashboards, Analytics, Automation.
> **Method:** Seven parallel, code-grounded sweeps of the live repo (not the planning
> docs) — every claim below is anchored to a real model, file, or route. Line numbers
> reference `prisma/schema.prisma` unless another file is named.
> **Companion:** `01-ARCHITECTURE-AND-ROADMAP.md` (the evolution design + M1/M2/C1/C2/N1 phasing).

---

## 0. Executive Summary

The platform is **much larger and more mature than "a task list with a few features."**
It is a Next.js 16 / Prisma / Postgres app with **432 models, 237 enums, ~100 route
groups, ~300 `lib/` modules, and 10 scheduled cron jobs.** Whole subsystems
(mentorship monthly-review loop, instructor applicant workflow, chapter command center,
people-strategy CRM) are genuinely production-grade.

But the platform is **not yet a system** — it is a **federation of parallel subsystems**,
each independently wired to the `User` table (and, for chapter-scoped rows, to `Chapter`),
and only loosely wired *to each other*. The single most important structural finding:

> **There is exactly ONE tightly FK-integrated "nervous system" in the codebase today:**
> **`Mentorship → G&R Goals → Monthly Review → Achievement Points`.**
> Everything else — Actions, Chapters-as-membership, student Projects, the gamification
> economy, Recognition — connects to the rest of the platform only through `User`, or
> through **loose, app-validated string seams** (`ActionItem.relatedEntityType/relatedEntityId`,
> `passionId`, `WorkflowItem.sourceType/sourceId`) that carry no referential integrity.

The kickoff's ambition — *"transform the Action Tracker from a productivity tool into the
operating system powering the entire YPP ecosystem"* — is therefore **fundamentally a
connectivity problem, not a greenfield build.** The Action Tracker (`ActionItem`) is the
right spine, but today it is **relationally an island**: it has no `goalId`, no `chapterId`,
no real FK to mentorship, no parent hierarchy, and **zero automated generation** — every
action is hand-typed by an officer, and the whole subsystem is **dark by default** (its
feature flags ship `false`).

The work is to **evolve** (the kickoff is explicit: *"The goal is NOT to rebuild"*): turn
the string seams into real relations, add the Mission→Goal→Milestone→Action hierarchy as
data, build the event-driven generation engine, consolidate the duplicate systems, and
flip the dashboards on — so that mentorship, chapters, leadership, and student growth all
**flow through actions** and roll up into shared visibility.

### The 12 headline findings

1. **Three parallel "Action" systems** — `ActionItem` (People-Strategy, canonical),
   `LeadershipActionItem` (Leadership Action Center, legacy), `MentorshipActionItem`
   (inside mentorship). No FK between them.
2. **The canonical Action Tracker has no hierarchy and no automation.** `goalCategory`
   is free text; there is no Mission/Goal/Milestone ladder, no parent action, and **no
   rule that ever creates an action from a domain event.** 100% manual.
3. **The Action Tracker is dark by default** — `ENABLE_ACTION_TRACKER`,
   `ENABLE_PEOPLE_DASHBOARD`, `ENABLE_ACTION_TRACKER_EMAILS` all default `"false"`.
4. **Mentorship is the crown jewel** — a fully wired monthly loop (reflection → mentor
   goal review → chair approval → auto points/awards, with RED-rating auto-escalation)
   and a real algorithmic matching engine. But it has **three domains** (Program /
   College Advisor / Alumni), **five overlapping goal models**, **no expertise taxonomy**,
   **no application or completion/alumni lifecycle**, and residual debt (orphaned
   `/admin/mentorship-program`, dual mentee homes `/my-mentor` + `/my-program`).
5. **Chapters are a single-tenant pilot on multi-tenant rails.** One live chapter
   ("Scarsdale"); membership is a scalar `User.chapterId` (one chapter per person);
   **no `ChapterMembership`/`ChapterOfficer` model**; `CHAPTER_PRESIDENT` is the only
   chapter role (no VP/officer/coordinator ladder).
6. **The Leadership Pathway is a localStorage mock** — statuses, evidence, promotion
   gates and "admin review tools" persist only in the browser; `seedState` fabricates a
   "plausible, varied" picture so it "reads as live." `PromotionRecommendation` is a
   fully-modeled but **completely dead** table (zero references).
7. **No regional/national structure exists** — only a free-text `Chapter.region` string.
   The pathway *copy* promises Regional/National tiers that no role, model, or data backs.
8. **5+ overlapping role vocabularies** — `RoleType`, `AdminSubtype`, `LeadershipStageId`
   (TS-only, inferred), `MenteeRoleType`, `InstructorGrowthTier`, `PositionType` — with no
   unifying map. The same human ("Senior Instructor") is expressed three independent ways.
9. **The single biggest product gap: there is NO student engagement/retention/at-risk
   scoring.** All "at-risk" logic targets *staff task follow-through* (`momentum.ts`, fed
   only by `ActionItem`s) or is a *manual* officer tag (`AT_RISK_OF_DISENGAGING`). Despite
   `lastActiveAt`, streaks, and `AnalyticsSnapshot` existing, nothing computes student churn.
10. **The gamification economy is quadruply fragmented and partly dead** — 4 XP stores
    showing different numbers, 3 badge models, 2 peer-recognition systems, 3 award models;
    **leaderboards are dead code** (`updateLeaderboards()` has zero callers) and the badge
    auto-engine has **no seeded definitions**, so it never awards on a fresh DB.
11. **4 unrelated "Project" systems** (`ProjectTracker`, `IncubatorProject`,
    `ServiceProject`, `GroupProject`) with no shared base and **no FK to a chapter**.
12. **A fully-built unified dashboard framework (`lib/dashboard/`) is dead code** (zero
    production importers); live dashboards are bespoke per-role branches. `deliverNotification`
    is a genuinely good unified primitive, but sits under 3 notification tables + 2 policy
    systems, and **two reminder crons (events, classes) are never scheduled** in `vercel.json`.

---

## 1. Current Architecture

| Layer | Reality | Notes |
|---|---|---|
| Framework | **Next.js 16 App Router**, React 18, TypeScript | `package.json` `next@^16.2.4`. (README/TECH_STACK say "14" — **stale**.) |
| Routing | Route groups `(app)`, `(public)`, `(onboarding)` | Authed shell `app/(app)/layout.tsx`; nav in `lib/navigation/*` + `components/nav.tsx`. |
| Auth | **Supabase auth** (`supabaseAuthId`) + legacy password (bcrypt) | Session via `lib/auth-supabase.ts` (`SessionUser = { id, roles, primaryRole, adminSubtypes }`). NextAuth dependency lingers but the active path is Supabase. (TECH_STACK says "NextAuth + `lib/auth.ts`" — **stale; neither is the live path**.) |
| Edge gating | **`proxy.ts`** at repo root (Next 16 renamed `middleware`→`proxy`) | Coarse only: auth/session refresh, `/locked` gate, redirects. **No per-role page gating in the edge layer.** |
| DB / ORM | **PostgreSQL + Prisma 5** | `prisma/schema.prisma` (~12,930 lines, 432 models, 237 enums). 160 migrations. |
| Server logic | **Server Actions** (`lib/*-actions.ts`, `"use server"`) + thin **API routes** (`app/api/**/route.ts`) | House pattern: `"use server"` → `requireX()` guard (throws) → zod → prisma → `revalidatePath`. |
| Authz | `lib/authorization.ts` (throw-style, for actions) + `lib/page-guards.ts` (redirect-style, for pages) + `lib/admin-capabilities.ts` (admin route↔subtype map) | Good helpers, **inconsistently applied** (many inline `roles.includes("ADMIN")` checks, a duplicate local `requireAdmin` in `lib/governance/actions.ts`). |
| Feature flags | `lib/feature-flags.ts`, `ENABLE_*` env vars | Two idioms: default-ON kill switch (`!== "false"`) and default-OFF opt-in (`=== "true"`). The whole People-Strategy layer is default-OFF. |
| Notifications | **`lib/notification-delivery.ts` `deliverNotification()`** — one unified primitive fanning to in-app + email + SMS, gated by per-type prefs + policy map | The delivery primitive is solid; the policy/table layer around it is fragmented (see §9). |
| Realtime | Pusher (`lib/pusher*.ts`) | Used by messaging. |
| Automation | 10 cron routes in `vercel.json`, all `Bearer ${CRON_SECRET}` | **No central engine** — independent route handlers (see §9). |
| Hosting | Vercel; `scripts/maybe-db-sync.mjs` runs `prisma migrate deploy` on build | Production fails build on migration failure (anti-drift). |

**Documentation drift is itself a finding.** `TECH_STACK.md` and `README.md` describe
Next 14 / NextAuth / `middleware.ts` / `lib/auth.ts` — none of which is the live stack
(Next 16 / Supabase / `proxy.ts` / `lib/auth-supabase.ts`). Onboarding contributors are
being pointed at files that do not exist.

---

## 2. Role & Permission Model

### 2.1 The role surface (≥6 parallel vocabularies, no unifying map)

| Vocabulary | Where | Values / shape | Backed by data? |
|---|---|---|---|
| **`RoleType`** (canonical RBAC) | enum L20; `User.primaryRole` (scalar L801) **and** `UserRole[]` join (L1367) | `ADMIN, INSTRUCTOR, STUDENT, MENTOR, CHAPTER_PRESIDENT, STAFF, PARENT, APPLICANT, HIRING_CHAIR` | Yes |
| **`AdminSubtype`** (admin refinement) | enum L32; `UserAdminSubtype` join (L1375) | `SUPER_ADMIN, HIRING_ADMIN, MENTORSHIP_ADMIN, INTAKE_ADMIN, CONTENT_ADMIN, COMMUNICATIONS_ADMIN, LEADERSHIP` (+ deprecated `CPO`→`LEADERSHIP`) | Yes — the de-facto permission layer |
| **`LeadershipStageId`** | `lib/leadership-pathway.ts` **TS type only** | `WORKSHOP_INSTRUCTOR → INSTRUCTOR → SENIOR_INSTRUCTOR → LEAD_INSTRUCTOR → ORGANIZATIONAL_LEADERSHIP` | **No** — inferred at request time from role+mentor+chair signals |
| **`MenteeRoleType`** | enum L587 | `INSTRUCTOR, CHAPTER_PRESIDENT, GLOBAL_LEADERSHIP` | Yes — drives the G&R program |
| **`InstructorGrowthTier`** | enum L504 | `SPARK, PRACTITIONER, CATALYST, PATHMAKER, LEADER, LUMINARY, FELLOW` | Yes — a real XP ladder on `InstructorGrowthProfile` |
| **`PositionType`** | enum L307 | `INSTRUCTOR, MENTOR, STAFF, CHAPTER_PRESIDENT, GLOBAL_ADMIN` | Yes — hiring/careers |

Plus local roles: `InstructorRole`, `AssignmentRole`, `RegularInstructorAssignmentRole`,
`StudyGroupRole`, `SupportRole`, `MentorCommitteeMemberRole`, `JourneyAudienceRole`, and
free-text `role String?` fields on teams/sessions.

**There is no `Role` table, no `Permission` table, and no permission strings.** Authorization
is role-name checks, not a permission model. **Dual role storage drifts**: `User.primaryRole`
(scalar) vs `UserRole[]` (join) are only kept in sync by application-approval code; the
session resolver explicitly compensates for known staleness
(`lib/auth-supabase.ts:176-185`).

### 2.2 Enforcement

- **Canonical (reuse these):** `lib/authorization.ts` — `requireSessionUser`,
  `requireAnyRole`, `requireAnyAdminSubtype`, tier guards `requireOfficer` (L209),
  `requireLeadership` (L173), `requireBoard` (L192). `lib/page-guards.ts` —
  `requirePageRoles` / `requireAdminPage` (redirect-style).
  `lib/admin-capabilities.ts` — `canAccessAdminRoute()` maps `/admin/<seg>`→owning
  subtype, consumed by both nav and the route guard so "sidebar and route access can no
  longer drift apart."
- **Inconsistency:** a meaningful fraction of pages/actions reimplement the gate inline
  (`app/(app)/instructor-growth/page.tsx`, `student-training/page.tsx`, `positions/page.tsx`,
  `admin/pathway-tracking/page.tsx`) and `lib/governance/actions.ts:9` defines its own local
  `requireAdmin`. No edge middleware means a forgotten inline check has **no defense-in-depth**.

**"Board" is a stand-in.** There is no `BOARD` role; `AdminSubtype.SUPER_ADMIN` proxies for
it across escalation/roll-up. "Leadership" = `LEADERSHIP`/`SUPER_ADMIN` subtypes. If those
subtypes aren't assigned, escalations re-fire forever and Board roll-up emails silently no-op.

---

## 3. The Action Systems (the centerpiece)

### 3.1 Three parallel action concepts

| System | Model (line) | Surfaces | Ownership model | Status |
|---|---|---|---|---|
| **People-Strategy Action Tracker** (canonical) | `ActionItem` (L12427) + `ActionAssignment` (L12527) | `/actions`, `/actions/all`, `/actions/command-center`, `/actions/responsibility`, `/actions/people`, `/actions/meetings`, `/actions/[id]` | `leadId` (required) + `ActionAssignment` role `LEAD`/`EXECUTING`/`INPUT` + escalation chain | Live but **flag-OFF by default** |
| **Leadership Action Center** (legacy) | `LeadershipActionItem` (L11809) | `/admin/action-center/{tasks,weekly,meetings,import}` | `primaryOwnerId` + `ownerNames[]` (free text) + `inputNeededFrom` | De-linked from nav, **reachable by URL**; one-shot migration script is dry-run by default |
| **Mentorship action items** | `MentorshipActionItem` (L2876) | mentee detail; read-only on `/my-actions` | `owner`, `dueAt`, status `OPEN/IN_PROGRESS/BLOCKED/COMPLETE` | Live (inside mentorship) |

### 3.2 Canonical `ActionItem` — data model (L12427)

- Core: `title`, `description`, `goalCategory String?` (**free text, NO FK to any Goal**),
  `actionType String?`, `status ActionItemStatus` (`NOT_STARTED/IN_PROGRESS/COMPLETE/OVERDUE/BLOCKED/DROPPED`),
  `priority ActionPriority`, `visibility ActionItemVisibility` (`OFFICERS_ONLY/ALL_LEADERSHIP`).
- Ownership: `leadId` (required, single accountable lead) → `lead User`; `createdById`.
- Routing: `departmentId?` → `Department` (functional: Instruction/Marketing/Tech — **NOT
  geographic**); `officerMeetingId?` → `OfficerMeeting`.
- Dates/escalation: `deadlineStart` (required), `deadlineEnd?`, `completedAt?`, `flaggedAt?`,
  `escalatedToLeadershipAt?`, `resolvedAt?`, `boardRolledUpAt?`.
- **The only cross-domain link:** polymorphic `relatedEntityType?` + `relatedEntityId?`
  (string pair, validated in app code to `CLASS_OFFERING | MENTORSHIP | USER |
  INSTRUCTOR_APPLICATION | PARTNER`; `lib/people-strategy/constants.ts:174`). **No FK, no
  cascade, can dangle.**
- Children: `ActionAssignment`, `ActionComment` (`NOTE`/`INPUT_REQUESTED`, `authorId`
  nullable for system audit), `ActionFileLink`, `ActionEmailLog` (idempotency ledger),
  `ActionPulseSnapshot` (weekly), `MeetingNote`. Supporting: `Department`, `OfficerMeeting`,
  `ActionTemplate` (seeded playbook), `SavedActionView`, `FeedbackRequest` (360),
  `MemberGrowthTag` (`GrowthTag`).

### 3.3 Creation flow & the automation gap

- Manual entry only: `/actions/new` (officer-tier) → `createActionItem()`
  (`lib/people-strategy/action-items-actions.ts`). Template prefill (`?template=`) and
  related-entity prefill (`?relatedType=&relatedId=`) exist.
- **No automated generation anywhere.** Exhaustive grep of `actionItem.create` /
  `createActionItem(` returns only the server action, tests, and seed. The "Follow-Up
  Generator" only drafts copyable text (persists nothing). `class-tracker.ts` /
  `mentorship-my-actions.ts` only **read** existing rows into "My Actions." The crons only
  **update** status / set escalation flags. **No rule ever creates an action from a domain
  event** — the single largest missing-automation gap, and the crux of "Action Sources."
  (Contrast `InstructorTask` (L12287), which *is* auto-generated nightly but is a separate
  system not wired to the Action Tracker.)

### 3.4 Ownership, accountability & escalation

Three-role model (`LEAD` single accountable, `EXECUTING` ≥1 required, `INPUT` consult-only).
Escalation chain (in `lib/people-strategy/action-cron.ts`): `flaggedAt` or `OVERDUE` →
**48h** unresolved → Leadership notified once (`escalatedToLeadershipAt`) → **+7 days** →
Board roll-up (`boardRolledUpAt` + authorless audit comment). All sends idempotent via
`ActionEmailLog.dedupeKey`.

### 3.5 Hierarchy: **none**

No Mission→Goal→Milestone→Action ladder. `goalCategory` is a free-text label with no FK;
no `parentId`/`goalId`/`milestoneId`/`missionId`. Actions are a **flat list with sideways
string links.** The `Goal`/`GoalTemplate`/`MilestoneEvent` models that exist belong to the
mentorship goal-review subsystem and are disconnected from actions.

### 3.6 Reporting & dashboards (what already exists to build on)

`/actions` (My Actions, despite the name — `/my-actions` redirects here), `/actions/all`
(officer, with **strategic preset chips** + status donut + dept bars + saved views),
`/actions/command-center` (leadership "OS" landing: pulse, attention queue, momentum, wins,
contributors), `/actions/responsibility` (who-owns-what, overload, capacity, growth tags),
`/actions/people` (People Dashboard, Performance×Potential), `/actions/completion-report`.
This is a strong dashboard foundation — but it is officer/leadership-facing only and dark
by default.

### 3.7 Concrete bugs / debt found

- **`unassigned` preset can never match** — `matchesActionPreset` checks `leadId == null`
  but `leadId` is required/non-null (`action-filters.ts`). Dead lens, always 0.
- **Residual coupling:** the new People-Strategy code imports date helpers and the generic
  `components/kanban/` from the legacy `lib/leadership-action-center/*`, so the legacy folder
  can't simply be deleted.
- **Two CSV export endpoints** for the two systems; **`action-cpo-escalation`** is a stale
  back-compat shim post CPO→Leadership rename.

---

## 4. Mentorship (the most mature subsystem)

### 4.1 Three distinct domains

1. **Instructor/Officer Mentorship Program** (the core loop): `Mentorship` (L2711) +
   monthly self-reflection → mentor goal review → chair approval → points/awards. Surfaces:
   `/mentorship`, `/my-mentor`, `/my-program`, `/admin/mentorship`.
2. **College Advisor** (entirely separate engine): `CollegeAdvisor`/`CollegeAdvisorship`/
   `CollegeAdvisorMeeting` + availability slots. Surfaces: `/college-advisor/*`,
   `/advisor-dashboard`.
3. **Alumni Q&A / "Ask Alum"**: `AlumniQuestion` (`/ask-alum`) + legacy `MentorQuestion`/
   `MentorAnswer`.

### 4.2 The core loop is genuinely wired

`Mentorship` carries `mentorId/menteeId/chairId`, `status` (ACTIVE/PAUSED/COMPLETE),
denormalized `cycleStage MentorshipCycleStage` (Kanban), `reflectionStreak`/`reviewStreak`,
kickoff fields. The monthly loop: `MonthlySelfReflection` (5-section, `@@unique([mentorshipId,
cycleNumber])`) → `MentorGoalReview` (`overallRating GoalRatingColor`, chair approval chain
`DRAFT→PENDING_CHAIR_APPROVAL→CHANGES_REQUESTED→APPROVED`, `pointsAwarded`) →
`AchievementPointSummary`/`AchievementPointLog`/`AwardNomination` (Bronze→Lifetime).
**RED-rating auto-flag** creates an `ESCALATION` `MentorshipRequest`. Cron-driven:
`mentorship-cycle-rollover` (opens windows), `gr-monthly-reminders` (day-gated reminders +
auto-archive), `mentor-weekly-digest`.

### 4.3 Matching engine (real, algorithmic)

`computeMentorMatches()` (`lib/mentor-match-actions.ts`) → `scoreSupportMatch()`
(`lib/mentorship-hub.ts`). Signals: shared `interests` (free-text), same chapter, capacity
headroom, availability noted, complete profile, and a real **mentor-effectiveness score**
(`lib/mentor-effectiveness.ts`: menteeProgress + reviewTimeliness + engagement + retention +
satisfaction). Output: `compatibilityPercent` + human `matchReasons[]`, top-3 per mentee,
**admin-approved** (not auto-assigned). **Age is not used.** No expertise taxonomy.

### 4.4 Gaps

- **No `MentorProfile` model / no expertise taxonomy** — mentor attributes live on shared
  `UserProfile` (`interests[]`, `mentorCapacity`, `mentorAvailability`); the only "expertise"
  signal is `InstructorPathwaySpec` (and its table may be absent in some envs — `as any`/
  `.catch(()=>[])` compat shim).
- **No application/intake stage** (mentees never apply; admin assigns) and **no completion/
  exit/alumni flow** (`COMPLETE` status has no UI transition).
- **Five overlapping goal models**: `Goal`, `GoalTemplate`, `MentorshipProgramGoal`,
  `GRDocumentGoal` (the preferred one), `CustomGoal` — plus `GoalReviewRating` carrying
  *both* `goalId` (legacy) and `grDocumentGoalId` (preferred).
- **Deprecated `MonthlyGoalReview` still actively written** by `lib/mentorship-program-
  actions.ts` (marked `@deprecated`), imported by 10+ live files → can't be retired.
- **Orphaned-but-live `/admin/mentorship-program`** (1164 lines, no redirect) whose panels
  the canonical `/admin/mentorship` *imports* → old tree can't be deleted.
- **Two live mentee homes**: `/my-mentor` and `/my-program` substantially duplicate
  goals/reflection/schedule.

---

## 5. Chapters (single-tenant pilot on multi-tenant rails)

### 5.1 Structure

- `Chapter` (L703) is the only tenant root: identity (`name/slug/city/region/partnerSchool`),
  public profile, `joinPolicy ChapterJoinPolicy` (`OPEN/APPROVAL/INVITE_ONLY`), soft-delete.
  **Membership = scalar `User.chapterId`** (one chapter per user). **No `ChapterMembership`/
  `ChapterRole`/`ChapterOfficer`/`ChapterEvent`/`ChapterApplication` join models** — events/
  applications/positions are *global* models with an optional `chapterId`.
- **Operated as a single live tenant ("Scarsdale")**: `app/api/chapters/route.ts` allowlists
  Scarsdale for applicant signup and self-heals it; `scripts/cleanup-non-scarsdale-chapters.ts`
  collapses all `chapterId` columns to Scarsdale and deletes the rest.

### 5.2 Leadership structure: flat

`CHAPTER_PRESIDENT` is the **only** chapter role. "VP/Officer/Coordinator" exist only as
free-text job `title` strings. President is granted by approving a `ChapterPresidentApplication`
(sets `primaryRole=CHAPTER_PRESIDENT` + `chapterId`, upserts `UserRole`, creates
`ChapterPresidentOnboarding`). Gating idiom everywhere: `isAdmin || isChapterLead`. **No
officer hierarchy, no succession, no term/handoff model.** `OfficerMeeting` has **no
`chapterId`** (global cadence — confirms the single-chapter assumption).

### 5.3 Features present vs absent

Present: roster, events/calendar (real `Event.chapterId` relation + iCal feed), recruitment
(robust: `Position`/`Application`, invites, recruiting tabs), goals (`ChapterGoal`),
communications (`ChapterChannel`/`ChapterUpdate`), KPIs (`ChapterKpiSnapshot`), member &
president onboarding, gamification (XP leaderboard, `ChapterAchievementMilestone`), health
data (`isAtRisk`/`riskFlags`, `OpsRule`/`OpsRuleViolation`).
**Absent:** budget/finance, succession/term/handoff, chapter-level documentation/resource
storage. Retention is only an *inactivity heuristic*, not a workflow.

### 5.4 Health is computed but hidden from operators

`ChapterKpiSnapshot.isAtRisk`/`riskFlags[]` are computed (`lib/governance/compute-snapshots.ts`:
flags `no_active_instructors`, `overdue_queues_high`, `pending_applications_backlog`,
`no_running_classes`, `low_enrollment`, `no_mentorship_pairs`) but there is **no composite
numeric health score**, and the chapter Command Center **does not display risk** — it only
charts raw KPI series. Risk surfaces only on the **admin-only** governance page. The snapshot
job (`computeAllChapterSnapshots`) has **no cron wiring** found.

### 5.5 No regional/national

`grep` for `model Region|National|District|Network|Zone` → nothing. `region` is a free-text
`String?` on `Chapter`. Supra-chapter scope = admin querying all chapters. Pathway copy
promises Chapter President → Regional Director → Senior Regional Director → Officer, but
**no role/entity/data backs it.**

---

## 6. Leadership Pipeline & Instructor Pipeline

### 6.1 The Leadership Pathway is aspirational, not a system of record

`/leadership-pathway` renders a client `GrowthDashboard` modeling two tracks (Instructor:
Instructor→Senior→Lead; Leadership: Manager→Director→Officer with Chapter President parallel).
**All state — competency status, evidence, notes, promotion gates, "admin review tools" — is
`localStorage`-only** (`components/leadership-pathway/growth-dashboard.tsx`; `seedState`
fabricates a "plausible, varied" picture "so the dashboard reads as live"). **No server
action, no Prisma write exists** anywhere under the pathway. Promotion gates are computed
client-side and **change no role.**

### 6.2 Stage is inferred, not stored

`LeadershipStageId` is a TS type; `inferLeadershipStage()` derives it at request time from
`primaryRole` + instructor subtype + mentor status + committee-chair status. The "surface
stage on profiles" work added **read-only context** only; a `User` stage column was
"intentionally deferred." **`PromotionRecommendation` (L3564) is fully modeled but DEAD**
(zero references) — `targetRole`/`status`/`approvedBy` that nothing creates, reads, or approves.

### 6.3 Transitions are manual

Role changes happen only via application approval (`lib/instructor-application-actions.ts`,
`lib/chapter-president-application-actions.ts`, signup) or manual admin tools
(`/api/admin/bulk-users/update-roles`). **No automated promotion, no criteria evaluation,
no promotion accountability record** (who promoted whom, when, against which criteria).

### 6.4 The instructor pipeline IS real (and disconnected from the pathway)

`/instructor-onboarding` → `/instructor-training` (gated by readiness) → `/instructor-training/
readiness` (interview gate) → `/instructor-growth` (the real `InstructorGrowthTier` XP system:
`InstructorGrowthProfile`/`InstructorGrowthEvent` with AUTO/CLAIM/MANUAL + review states,
review board). **Critical disconnect:** `InstructorGrowthTier` (real, DB-tracked) and the
leadership-pathway `LeadershipStageId` (inferred, localStorage) **never cross-reference**.
Two unrelated "instructor progression" models run side by side.

---

## 7. People, Profiles, Points, Recognition, Engagement

### 7.1 Two separate worlds

- **World A — student gamification** (earlier "passion discovery" phase): XP, badges, awards,
  challenges, leaderboards, recognition, passion world.
- **World B — staff/leadership People-Strategy CRM** (`lib/people-strategy/**`, `/actions/*`,
  `/people`): the Action Tracker, Command Center, People Dashboard, momentum, growth signals.

They share almost no models and **do not connect**: a student's badges/XP/streaks never feed
momentum, growth signals, or the People Dashboard, and vice-versa.

### 7.2 Profile is thin and split

`UserProfile` (L1512): `bio`, `avatarUrl`, `interests[]` (free text), `learningStyle`,
`primaryGoal` (single string), `grade`, `school`, `mentorCapacity/Availability`. **No
career-goal field.** Identity + `xp/level` on `User`. Career/interest depth lives in passion
tables (`StudentInterest`, `PassionArea`). **No unified profile aggregate** — `/profile`
(self, `getProfilePageData`) and `/people/[id]` (public, `loadPublicProfile`) assemble
overlapping data via different loaders.

### 7.3 Points/XP — quadruple fragmentation

| Store | Model | Written by | Read by |
|---|---|---|---|
| `User.xp`/`User.level` | `XpTransaction` (L4253), `awardXp()` | onboarding, content, challenges, incubator, enrollment, pathway-complete — **wired** | leaderboards, rewards |
| `StudentXP.totalXP` | `StudentXP` (L5393), `XPTransaction` (L5408) | passion API routes only — **wired but isolated** | `/profile/xp` |
| `StudentInterest.xpPoints` | L5364 | per-passion | passion world UI |
| `AchievementPointSummary` | L9391 | mentorship review approvals | mentorship award ladder |

**Critical inconsistency:** `User.level` (from `User.xp`) and `/profile/xp`'s
`StudentXP.currentLevel` are **different numbers**; XP earned one way never appears in the other.

### 7.4 Badges (3 models, 1 real engine, 0 seeded definitions)

`Badge`/`StudentBadge` (auto-awarded by a real engine in `lib/progress-events.ts` firing from
6+ call sites), `SkillBadge` (separate), `InstructorGrowthBadge*` (instructor side). Rarity is
real but cron-only (`/api/badge-rarity`, **unscheduled**). **`prisma/seed.ts` creates zero
`Badge` rows** → the auto-engine has nothing to match → gallery is empty and nothing is ever
awarded on a fresh DB.

### 7.5 Recognition (duplicated, mostly empty)

Two peer-recognition systems: `PeerKudos` (categorized, `/peer-recognition`, wired) vs
`PeerRecognition` (uncategorized, `/api/recognition/create`→`/community/feed`). Three+ award
models: `Award`, `StudentAward`/`RecognitionAward`, `AwardNomination` (+ `TeamAchievement`,
`MentorshipAwardRecommendation`, `BreakthroughMoment`). `/wall-of-fame`, `/student-of-month`,
`/awards` read real DB but are **admin-populated and empty by default**.
**`/leaderboards` is dead** — `updateLeaderboards()` has zero callers; the page renders "--".

### 7.6 Engagement/Risk — the single biggest product gap

**There is no student engagement/retention/at-risk scoring at all.**
- `lib/people-strategy/momentum.ts` `scoreMomentum()` (`STRONG/STEADY/NEEDS_SUPPORT/AT_RISK/
  NO_SIGNAL`) is the only per-person at-risk scorer, and its input is **exclusively `ActionItem`
  ownership/completion** — it measures officers' task follow-through, not student engagement.
- `growth-signals.ts` `hasDisengagementRisk()` just checks a **manual** `GrowthTag.
  AT_RISK_OF_DISENGAGING` tag.
- `lastActiveAt` (on `StudentInterest`, `InstructorProfile`), `AnalyticsSnapshot.currentStreak/
  longestStreak`, and per-challenge streaks all exist — but **nothing computes a student
  disengagement signal from them.** No `RiskAlert`, no `EngagementScore`, no churn job.

---

## 8. Projects & Events

- **4 unrelated project systems, no shared base:** `ProjectTracker` (personal/passion, thin),
  `IncubatorProject` (cohort, 6-phase, by far the most mature), `ServiceProject` (volunteer;
  `chapterId` is a **bare string, no FK**), `GroupProject` (class assignment teams). Each
  redefines its own milestones. **No project is linked to a chapter by a relation.**
- **Events are solid:** `Event` (real `Chapter` relation, `scope GLOBAL/CHAPTER`, recurrence
  via `EventSeries`, `EventRsvp`, `EventReminder`), merged with `ChapterMilestone` into the
  chapter calendar + iCal feed. **But `/api/event-reminders` is not in `vercel.json`** —
  reminder rows are created and never dispatched.

---

## 9. Dashboards, Analytics, Notifications, Automation

- **Dead unified dashboard framework:** `lib/dashboard/{data,catalog,resolve-dashboard,types}.ts`
  (incl. a large `data.ts` assembling KPIs/queues/nextActions/checklist/nudges per role) has
  **zero production importers** — live home (`app/(app)/page.tsx`) is bespoke role branches.
- **Analytics = 6+ disconnected modules** (`admin-portal-analytics`, `analytics-actions`,
  `ai-personalization-actions`, `cockpit-analytics`, `people-strategy/action-analytics`,
  class/chapter reports) with three storage strategies (DB `AnalyticsEvent`, console telemetry,
  on-the-fly aggregation).
- **Notifications:** `deliverNotification()` is a solid unified primitive (in-app + email +
  SMS, pref- and policy-gated). But it sits under **3 notification tables** (`Notification`,
  `Nudge`, `ParentNotification`) and **2 policy systems** (`NotificationPolicyKey` map +
  legacy `POLICY_BY_TYPE`). Nudges are generated **lazily on dashboard render** (no cron;
  cleanup never runs on a schedule).
- **Automation: 10 crons in `vercel.json`, no central engine.** Mentorship (cycle-rollover,
  gr-monthly-reminders, mentor-weekly-digest), applicants (chair-digest, auto-archive),
  scheduling-reminders, and the 4 Action Tracker crons (weekly-digest, deadline-warning,
  deadline-reached, leadership-escalation). **Unscheduled-but-coded:** `event-reminders`,
  `class-reminders`, `badge-rarity` (reminder/rarity automation effectively never fires).
- **Activity Hub** (`lib/activity-hub/`) is a read-only **discovery feed** ("what can I work
  on"), merging challenges/incubator/tracker sources — **not** an event-sourced timeline. The
  "timeline" is itself fragmented across `TimelineEntry`, `AnalyticsEvent`, `InstructorGrowthEvent`,
  `MilestoneEvent`, `PathwayEvent`.

---

## 10. The Connectivity Map (the crux)

```
                         ┌─────────────────────────────────────────────┐
                         │  THE ONE INTEGRATED NERVOUS SYSTEM (real FKs) │
                         │                                               │
   Mentorship ──FK──▶ GRDocument ──FK──▶ GRDocumentGoal ◀──FK── MentorGoalReview
        │                                      ▲                    │
        └──FK──▶ MonthlySelfReflection         │ sourceReviewId     ├─FK─▶ AchievementPointLog
                         │                      └────────────────────┘            │
                         └──referenced by──▶ CheckIn / QuarterlyReview     AchievementPointSummary ─▶ AwardNomination
                         └─────────────────────────────────────────────┘

   USER  ◀── every cluster wires here individually ──▶  CHAPTER (chapter-scoped rows)

   ╴╴╴╴╴╴╴╴╴╴╴╴╴ ISLANDS / STRING SEAMS (no FK integrity) ╴╴╴╴╴╴╴╴╴╴╴╴╴
   ActionItem ··relatedEntityType/Id (string)·· {Mentorship, ClassOffering, User, ...}
   ActionItem  — has NO chapterId, NO goalId, NO parentId
   ActionItem  ⟂  LeadershipActionItem        (two action systems, no relation)
   XPTransaction(5408) ⟂ XpTransaction(4253)  (two XP ledgers)
   MentorGoalReview ⟂ MonthlyGoalReview       (two review chains; legacy still written)
   Chapter membership = scalar User.chapterId (no membership/officer join model)
   ServiceProject.chapterId / ProjectTracker.passionId = bare strings (no FK)
   StudentXP/Badge/PassionArea/ProjectTracker/Incubator = island vs Mentorship/Actions
   6 recognition models with no shared parent
   WorkflowItem.sourceType/Id = the only generic polymorphic queue, also string-seamed
```

**Bottom line for the architect:** the only place with real cross-cluster FK integrity is
the Mentorship+Goals+Review+Points triad. **Actions, Chapters-as-membership, Projects,
Gamification, and Recognition are joined to the rest of the platform — if at all — through
loose string fields.** Those string seams are *exactly* where the "central nervous system"
wiring must be added.

---

## 11. The 10 Audit Questions, Answered

| # | Question | Answer |
|---|---|---|
| 1 | **What already exists** | A mature mentorship monthly-loop + matching engine; a full People-Strategy Action Tracker + Command Center (flag-off); a chapter command center + KPI/health data; instructor applicant + training + growth pipelines; a rich (if fragmented) gamification economy; solid events + notification delivery primitives. |
| 2 | **What is working well (preserve)** | Mentorship review/points loop; matching engine + effectiveness score; `deliverNotification`; `ActionItem` 3-role model + escalation + command-center/pulse; instructor growth tier engine; chapter KPI snapshots; event/calendar/iCal; the auth guard helpers; `ActionTemplate` playbook. |
| 3 | **What is partially implemented** | Leadership Pathway (UI only, no persistence); chapter health (computed, not surfaced, no score, no cron); People-Strategy dashboards (built, flag-off); badge engine (real, no seed data); mentorship lifecycle (loop done, ends missing); multi-tenant chapters (rails done, one tenant). |
| 4 | **What is duplicated** | Action systems (×3); XP ledgers (×2 `User.xp`/`StudentXP`, +interest/achievement); review chains (×2); peer recognition (×2); award models (×3+); badge models (×3); mentee homes (×2); dashboard-data builders (×2 chapter); notification policy systems (×2); profile loaders (×2). |
| 5 | **What is unused / dead** | `PromotionRecommendation` (0 refs); `updateLeaderboards()`/`LeaderboardEntry` (0 callers); `lib/dashboard/*` unified framework (0 importers); `unassigned` action preset (never matches); seeded badges (none); `event-reminders`/`class-reminders`/`badge-rarity` crons (unscheduled). |
| 6 | **What is confusing** | `/actions` *is* "My Actions" while `/my-actions` redirects to it; 6 role vocabularies; "propose a chapter" lands on the President *application*; stale `TECH_STACK.md`/`README.md`; `goalCategory` looks like a Goal link but is free text; `CPO` vs `LEADERSHIP` subtype alias. |
| 7 | **What should be preserved** | The entire Mentorship+Goals+Review+Points triad; `ActionItem` as the canonical action spine; `deliverNotification`; the command-center/pulse/momentum machinery; the instructor pipeline; events/calendar. |
| 8 | **What should be upgraded** | `ActionItem` → add hierarchy + real FKs + generation engine + chapter scope; Leadership Pathway → persist to DB + wire promotions; chapter health → composite score + operator surfacing + cron; matching → expertise taxonomy + richer scores; engagement → add real student risk scoring. |
| 9 | **What should be merged** | The 3 action systems → one; the 2 XP ledgers → one; the 2 review chains → one (finish the migration); recognition models → one recognition spine; the dual mentee homes → one; the 4 project systems → one base. |
| 10 | **What should be removed (after migration)** | Legacy `LeadershipActionItem` tree, `MonthlyGoalReview` + legacy goal models, orphaned `/admin/mentorship-program`, dead `lib/dashboard/*`, dead leaderboard writer, `action-cpo-escalation` shim, stale docs. |

---

## 12. Retention Leaks, Dead Ends & Missing Transitions

**Retention leaks (where a student silently falls out):**
- **No churn detection** — a student who stops logging in is invisible until a human notices
  (§7.6). The data to detect it exists; the scorer does not.
- **Empty reward surfaces** — leaderboards ("--"), wall-of-fame, student-of-month, badges all
  render empty by default, so the gamification "hook" never fires for new students.
- **XP that doesn't add up** — effort logged in one system doesn't move the number the student
  sees elsewhere (§7.3), undermining the progress feedback loop.
- **Mentorship has no completion/alumni transition** — a finished mentee hits a dead `COMPLETE`
  status with nowhere to go (§4.4).

**Leadership dead ends:**
- The Leadership Pathway shows a ladder but **cannot move anyone up it** (localStorage gates,
  no role change, dead `PromotionRecommendation`). A motivated student sees "what's next" and
  "exactly how to get there" — but the system never acts on it.
- Regional/National tiers are promised in copy with **no path to reach them** (no role/entity).

**Chapter dead ends:**
- One chapter role (`CHAPTER_PRESIDENT`) — an engaged member has **no officer rung** to climb
  to between "member" and "president," and no succession path when a president graduates.
- Chapter health/risk is computed but **invisible to the people who run the chapter.**

**Mentorship dead ends:**
- No mentee **application** (you're assigned or you're not), no **expertise-based discovery**
  of mentors, and the College-Advisor and Alumni domains are unconnected to the program loop.

**Broken progression systems:**
- `InstructorGrowthTier` (real XP) and `LeadershipStageId` (inferred) never reconcile, so
  "how senior am I" has multiple, divergent answers.

**Missing visibility:**
- Student/Mentor/Chapter/Regional/National dashboards in the kickoff **mostly don't exist as
  student- or chapter-facing surfaces** — the rich command-center work is officer/leadership-only
  and flag-off.

**Missing incentives:**
- Actions, mentorship, chapters, and leadership carry **no points/recognition payload** — doing
  the work that matters most to the org earns nothing in the (disconnected) gamification economy.

---

## 13. Prior Planning Already in the Repo (don't duplicate — supersede/align)

The repo already contains substantial planning that this effort should *consolidate*, not
restart: `docs/people-strategy-operating-system-plan.md`,
`docs/ypp-operating-system-maximum-pass-plan.md`, `docs/action-experience-overhaul-plan.md`,
`docs/portal-consolidation-plan.md`, `MENTORSHIP_REDESIGN_PLAN.md`,
`PEOPLE_STRATEGY_COMMAND_CENTER_PLAN.md`, `INTEGRATION_MAP.md`,
`docs/leadership-pathway-rollout.md`, `docs/admin-mentorship-audit*.md`. The Action Tracker
3.0 architecture (companion doc) is positioned as the **unifying roadmap** that absorbs these.

— End of audit. Proceed to `01-ARCHITECTURE-AND-ROADMAP.md`.
