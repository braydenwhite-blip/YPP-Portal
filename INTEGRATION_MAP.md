# INTEGRATION_MAP.md — People Strategy Layer, through Phase 06A

Audit of the existing YPP Pathways Portal for the **People Strategy** layer
(Action Items, My Actions / All Actions, Officer Meetings, deadline emails,
Monthly Check-In + Quarterly Review, CPO People Dashboard). Items after
Officer Meetings are future-phase context, not implemented through Phase 06A.

The original Phase 1 produced **two** things:

1. This document (PART A — audit).
2. The new **CPO** role wired into the auth/role system (PART B).

Later completed phases added the Action Tracker runtime, dashboards, emails,
Feedback Requests, and Officer Meetings foundation. This map has been amended
to call out those concrete files and to keep future phases clearly separated.

Every identifier below is quoted as it actually appears in the code, with the
real file path and line. Where the kickoff description differs from the code,
it is called out with **⚠ DIFFERENCE**.

---

## ⚠ TOP-LEVEL FINDING — the "Action Items" layer already partly exists

The kickoff describes Action Items, a My Actions dashboard, an All Actions
leadership view, Officer Meetings with agenda generation, and a weekly digest
as **new**. A large part of this already exists in the repo as the
**Leadership Action Center**:

| Concept (kickoff) | Already in repo |
| --- | --- |
| Action Item | `model LeadershipActionItem` — `prisma/schema.prisma:11532` |
| Officer Meeting + agenda | `model LeadershipMeeting` — `prisma/schema.prisma:11507` (`needsOfficerDiscussion` / `officerDiscussionDate` drive the agenda) |
| "Input from" people | `model LeadershipActionItemInput` — `prisma/schema.prisma:11602` |
| Activity log / comments | `model LeadershipActionItemUpdate` — `prisma/schema.prisma:11617` |
| Enums | `LeadershipActionCategory/Status/Priority/Source`, `LeadershipMeetingKind`, `LeadershipActionUpdateKind` — `prisma/schema.prisma:11458-11502` |
| Server actions | `lib/leadership-action-center/actions.ts` (`"use server"`) |
| Queries / digest / import | `lib/leadership-action-center/{queries,digest,import,dates,constants}.ts` |
| Access guard | `lib/leadership-action-center/authorization.ts` |
| UI | `components/leadership-action-center/*` (task-table, meetings, weekly-digest, task-form, …) |
| Routes | `app/(app)/admin/action-center/{tasks,weekly,meetings}` (paths revalidated in `actions.ts`) |
| Seed data | `prisma/seed.ts` seeds meetings + action items owned by Brayden (lines ~1021-1191) |

**⚠ DIFFERENCE — role model on an action item.** The kickoff wants
**Lead / Executing / Input** roles. The existing model has:

- **Lead** → `primaryOwner` (single accountable user, `prisma/schema.prisma:11564`) +
  `ownerNames String[]` free-text fallback (`:11566`).
- **Input** → `inputNeededFrom LeadershipActionItemInput[]` (`:11584`) +
  `inputNeededNames String[]` free-text fallback (`:11570`).
- **Executing** → **does not exist.** There is no distinct "executing"
  assignment. A later phase must add it (e.g. a `LeadershipActionItemAssignee`
  join with a role enum, or an `executingOwnerId`).

**Recommendation:** extend the Leadership Action Center rather than build a
parallel system. The "My Actions" view = filter `LeadershipActionItem` by the
viewer across `primaryOwnerId` + `inputNeededFrom` (+ a new executing link);
"All Actions" = the unfiltered table already rendered by
`components/leadership-action-center/task-table-client.tsx`.

---

## PART A — AUDIT

### 1. User model — roles, admin subtypes, mentor relations

- **Model:** `model User` — `prisma/schema.prisma:783`.
- **Top-level role field:** `primaryRole RoleType` (`:789`), plus a multi-role
  join `roles UserRole[]` (`:794`). Join model `model UserRole` (`:1320`) keyed
  `@@id([userId, role])`.
- **Role enum:** `enum RoleType` (`:20`), values:
  `ADMIN`, `INSTRUCTOR`, `STUDENT`, `MENTOR`, `CHAPTER_PRESIDENT`, `STAFF`,
  `PARENT`, `APPLICANT`, `HIRING_CHAIR`.
- **Admin subtypes:** `enum AdminSubtype` (`:32`). **Before this phase:**
  `SUPER_ADMIN`, `HIRING_ADMIN`, `MENTORSHIP_ADMIN`, `INTAKE_ADMIN`,
  `CONTENT_ADMIN`, `COMMUNICATIONS_ADMIN`. **Added this phase:** `CPO`.
  Assigned via join model `model UserAdminSubtype` (`:1328`),
  `@@id([userId, subtype])`, with an `isDefaultOwner Boolean`.
  Mirror list in `lib/admin-subtypes.ts` (`ADMIN_SUBTYPE_VALUES`,
  `ADMIN_SUBTYPE_LABELS`).
- **Mentor relation fields on `User`:**
  - `mentorPairs Mentorship[] @relation("MentorLinks")` (`:823`) — mentorships where this user is the mentor.
  - `menteePairs Mentorship[] @relation("MenteeLinks")` (`:826`) — mentorships where this user is the mentee.
  - `chairedMentorships Mentorship[] @relation("MentorshipChairs")` (`:827`) — mentorships this user chairs.

**⚠ DIFFERENCE.** The kickoff says "a Prisma User model with admin subtypes" —
correct — but note roles are **two layered systems**: a top-level `RoleType`
(single `primaryRole` + many `UserRole`) **and** `AdminSubtype` (only meaningful
for `ADMIN`-role users). There is **no `BOARD` role** anywhere in the codebase
(`BOARD` only appears in award-tier comments). See Role tiers (Part B).

### 2. Goal model — the progress-rating enum (→ Performance axis)

- **Legacy model:** `model Goal` — `prisma/schema.prisma:3219`, explicitly
  marked `/// DEPRECATED: migrate to MentorshipProgramGoal + GoalReviewRating`.
- **Modern goal model:** `model MentorshipProgramGoal` (`:8938`); a mentee's
  per-person goals also live in `GRDocumentGoal` (G&R documents).
- **The rating enum actually used today:** `enum GoalRatingColor` —
  `prisma/schema.prisma:583`. Exact values **and** the in-code color comments:
  - `BEHIND_SCHEDULE` // Red — 0 pts
  - `GETTING_STARTED` // Yellow
  - `ACHIEVED` // Green
  - `ABOVE_AND_BEYOND` // Purple

  Consumed by `model GoalReviewRating { rating GoalRatingColor }`
  (`:9092`, field at `:9104`) — the rating a mentor gives per goal in a review.

- **There is a SECOND, legacy 4-level enum:** `enum ProgressStatus` (`:541`):
  `BEHIND_SCHEDULE`, `GETTING_STARTED`, `ON_TRACK`, `ABOVE_AND_BEYOND`. It is
  used only by the **deprecated** `model ProgressUpdate` (`:3234`).

**⚠ DIFFERENCE — this matters for the review matrix.** The kickoff names the
four levels "Behind / Getting Started / **On Track** / Above & Beyond". That
matches the **legacy** `ProgressStatus`. The **live** enum
(`GoalRatingColor`, used by `GoalReviewRating`) names the third level
**`ACHIEVED` (Green)**, not `ON_TRACK`. Build the Performance axis on
`GoalRatingColor`, not `ProgressStatus`.

**Mapping requested (At Risk / Needs Attention / On Track / Above & Beyond) →
the live `GoalRatingColor`:**

| Kickoff label | `GoalRatingColor` value | Color / points |
| --- | --- | --- |
| **At Risk** | `BEHIND_SCHEDULE` | Red — 0 pts |
| **Needs Attention** | `GETTING_STARTED` | Yellow |
| **On Track** | `ACHIEVED` *(legacy: `ON_TRACK`)* | Green |
| **Above & Beyond** | `ABOVE_AND_BEYOND` | Purple |

Do **not** create a second progress-rating concept — reuse `GoalRatingColor`
as the Performance axis, exactly as the kickoff intends.

### 3. Reflection model(s) — monthly reflection storage + admin view

- **Legacy (DEPRECATED):** `model ReflectionForm` (`:3256`),
  `model ReflectionQuestion` (`:3270`), `model ReflectionSubmission` (`:3287`,
  stored per `month DateTime`), `model ReflectionResponse` (`:3300`). All four
  carry `/// DEPRECATED: migrate to MonthlySelfReflection`.
- **Modern (use this):** `model MonthlySelfReflection` — `prisma/schema.prisma:8959`.
  Keyed by `menteeId`, `mentorshipId`, `cycleMonth DateTime` (first of month),
  `cycleNumber Int` (multiples of 3 are quarterly cycles —
  `@@unique([mentorshipId, cycleNumber])`). Holds 5 sections (overall,
  engagement, collaboration, goal progress, additional). Per-goal answers in
  `model SelfReflectionGoalResponse` (`:9001`). User back-relation:
  `selfReflectionsSubmitted MonthlySelfReflection[] @relation("SelfReflectionsSubmitted")`
  (`User:1147`).
- **How admins view them today:** through the mentorship program admin surface
  (`lib/admin-mentorship-command-center.ts`, route
  `app/(app)/admin/mentorship-program/`) and the mentor/chair review flow —
  a `MonthlySelfReflection` is linked 1:1 to a `MentorGoalReview`
  (`goalReview MentorGoalReview?`, `:8993`), which moves through
  `GoalReviewStatus` (`DRAFT → PENDING_CHAIR_APPROVAL → APPROVED`, `:591`) and
  is released to the mentee. Reminder cadence is the cron in §6.

**⚠ DIFFERENCE.** The kickoff's "Monthly Check-In + Quarterly Review cadence"
should reuse `MonthlySelfReflection.cycleNumber` (quarter = cycle % 3 == 0),
**not** the deprecated `ReflectionSubmission.month`. A lighter
`model MentorshipCheckIn` (`:2702`) also exists (notes + optional `rating Int`)
and may serve the "Monthly Check-In" if a full self-reflection is too heavy.

### 4. Mentorship model — pairing, sessions, feedback

- **Pairing:** `model Mentorship` — `prisma/schema.prisma:2654`. A pairing is a
  single row with `mentorId` (`:2656`) and `menteeId` (`:2657`); optional
  `chairId` (`:2666`). Relations `mentor`/`mentee`/`chair` at `:2678-2680`.
  Also carries `type MentorshipType`, `programGroup MentorshipProgramGroup`,
  `status MentorshipStatus` (`:2661`), and a denormalized
  `cycleStage MentorshipCycleStage` (`:2677`) for Kanban.
- **Sessions:** `model MentorshipSession` — `prisma/schema.prisma:2739`
  (relation `sessions` on `Mentorship:2689`). Lighter touchpoints:
  `model MentorshipCheckIn` (`:2702`).
- **Feedback:** two mechanisms —
  - General: `model Feedback` (`:3030`) via `enum FeedbackSource` (`:263`);
    User relations `feedbackGiven` / `feedbackFor` (`:852-853`).
  - Mentorship-specific quarterly: `QuarterlyFeedbackRequest`
    (relation `feedbackRequests` on `Mentorship:2693`).
- **Action items inside a mentorship** already exist:
  `model MentorshipActionItem` (`:2819`) — **note the name collision** with the
  new People-Strategy "Action Items" (`LeadershipActionItem`). These are
  different concepts; keep them distinct.

### 5. lib/email.ts — send signature + a real call

- **File:** `lib/email.ts`.
- **Signature** (`:101`):
  ```ts
  export async function sendEmail({
    to,
    subject,
    html,
    text,
    attachments
  }: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    attachments?: EmailAttachment[];
  }): Promise<EmailResult>
  ```
  Provider resolution is internal (SMTP if configured, else Resend);
  `getDefaultFrom()` supplies the From. `isEmailConfigured()` (`:1360`) gates.
- **One real example call** — inside `sendPasswordResetEmail` (`:229`):
  ```ts
  return sendEmail({ to, subject, html });
  ```
  The four People-Strategy emails should each be a thin
  `sendXxx({...}): Promise<EmailResult>` wrapper that builds `subject`/`html`
  and delegates to `sendEmail`, exactly like the ~30 existing `sendXxxEmail`
  helpers in this file.

### 6. Cron pattern — CRON_SECRET auth + schedule declaration

- **Representative route:** `app/api/cron/gr-monthly-reminders/route.ts`
  (mirrors the kickoff's "chair-digest / auto-archive").
- **Auth** (`route.ts:30-39`):
  ```ts
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  ```
  Route also sets `export const runtime = "nodejs"`, `dynamic = "force-dynamic"`,
  `maxDuration = 60`.
- **Schedule declaration:** `vercel.json` → `crons[]` (`path` + cron `schedule`).
  Existing entries include the kickoff's two:
  - `/api/admin/applicants/chair-digest` — `"0 14 * * 1-5"`
  - `/api/admin/applicants/auto-archive` — `"0 3 * * *"`
  - plus `/api/cron/gr-monthly-reminders` — `"0 9 * * *"`.
  The `gr-monthly-reminders` route also auto-archives completed
  `GRDocumentGoal`s > 60 days old (`route.ts:184-196`) — the auto-archive
  pattern to copy.

New People-Strategy deadline/assignment crons: add a route under
`app/api/cron/<name>/route.ts` using the auth block above, then register the
path + schedule in `vercel.json`.

### 7. Server-action convention (`lib/*-actions.ts`)

Top of every actions file is `"use server"`, then prisma + a guard + zod +
`revalidatePath`. Real example — `lib/leadership-action-center/actions.ts:1`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireLeadershipManager } from "./authorization";
// ...
const CreateActionItemSchema = z.object({ title: NonEmptyString, /* ... */ });
```

**One-line note:** each mutating action calls a `requireX()` guard first
(throws `Unauthorized`), validates input with a zod schema, writes via
`prisma`, then calls `revalidatePath(...)` for affected routes.

### 8. Route protection — middleware + role guards

**⚠ DIFFERENCE — file names.** The kickoff says "`middleware.ts` and
`lib/auth.ts`". Neither exists. The real files:

- **Edge middleware:** `proxy.ts` at the repo root (Next.js 16 renamed
  `middleware` → **`proxy`**). Exports `async function proxy(request)`
  (`proxy.ts:138`) and `export const config = { matcher: [...] }`
  (`:236`). It does **coarse** gating only: auth/session refresh, the public
  "/locked" gate, and redirects — it does **not** do per-role page gating.
  (Note: `next.config.mjs` and `proxy.ts` comments still say "middleware.ts" —
  stale text; the active file is `proxy.ts`.)
- **No `lib/auth.ts`.** Session + auth live in `lib/auth-supabase.ts`
  (`getSession()`, `getSessionUser()`, `type SessionUser` with
  `{ id, roles, primaryRole, adminSubtypes }`).

**The actual role guards (reuse these):**

- **Server-component / page gate (redirects on failure)** —
  `lib/page-guards.ts`: `requirePageRoles(allowedRoles, { redirectTo })`
  (`:16`), plus `requireAdminPage()` (`:37`), `requireChairPage()` (`:47`),
  `requireApplicationReviewerPage()` (`:42`).
- **Server-action gate (throws `Unauthorized`)** — `lib/authorization.ts`:
  `requireSessionUser()` (`:121`), `requireAnyRole(roles)` (`:135`),
  `requireAnyAdminSubtype(subtypes)` (`:143`); plus helpers `hasAnyRole`,
  `hasAnyAdminSubtype`, `normalizeRoleSet`. Pattern exemplar:
  `requireJourneyEditor()` (`:160`).
- **Feature-local guard** — `lib/leadership-action-center/authorization.ts`:
  `getLeadershipSession()`, `requireLeadershipManager()`,
  `requireLeadershipReader()`, with `LEADERSHIP_ROLES = ["ADMIN", "STAFF"]`.

The two new guards added this phase (`requireCPO`, `requireOfficer`) live in
`lib/authorization.ts` and follow the throw-style convention — see Part B.

### 9. Feature-flag convention

- **File:** `lib/feature-flags.ts` (header: "All flags default to enabled
  (`"true"`) unless explicitly set to `"false"`").
- **Naming:** `ENABLE_*` environment variables. Two idioms exist:
  - **Default-ON kill-switch:** `process.env.ENABLE_X !== "false"`
    — e.g. `isInstructorApplicantWorkflowV1Enabled()` (`:8`).
  - **Default-OFF opt-in:** `process.env.ENABLE_X === "true"`
    — e.g. `isRegularInstructorEnabled()` (`:26`,
    `ENABLE_REGULAR_INSTRUCTOR`), and `lib/dashboard/flags.ts`
    (`ENABLE_UNIFIED_ALL_TOOLS_DASHBOARD`).
- **How a page checks it:** import the helper and branch, e.g.
  `app/(app)/training/[id]/page.tsx:24` reads
  `process.env.ENABLE_INTERACTIVE_TRAINING_JOURNEY`. Client-exposed flags use
  the `NEXT_PUBLIC_` prefix (`app/(public)/signup/instructor/page.tsx:64`).

**Recommendation:** gate the whole People-Strategy layer behind one
default-OFF flag, e.g. `isPeopleStrategyEnabled() => process.env.ENABLE_PEOPLE_STRATEGY === "true"`,
added to `lib/feature-flags.ts`.

### 10. Department / Chapter — what an Action Item attaches to

- **Org unit:** `model Chapter` — `prisma/schema.prisma:691` (name, slug, city,
  region, …; `users User[]`). This is the closest existing "org unit".
- **There is NO `Department` model.**
- **What the existing Action Item uses instead of a department:**
  `LeadershipActionItem.category` of type `enum LeadershipActionCategory`
  (`:11458`) = `INSTRUCTION | TECHNOLOGY | COMMUNICATION | STAFF_MANAGEMENT`.
  This is a **functional area**, not an org unit, and the action item has **no
  `chapterId`**.

**Recommendation (minimal, no new model needed for v1):**
- For **functional "department"**, reuse `LeadershipActionCategory`
  (extend the enum if the four values are insufficient).
- For **org-unit attachment**, add an optional
  `chapterId String?` + `chapter Chapter? @relation(...)` to
  `LeadershipActionItem` rather than introducing a `Department` model. A
  dedicated `Department` model is **not** recommended — it would duplicate
  `Chapter` + `LeadershipActionCategory`.

### 11. Classes / offerings — model + instructor relations

- **Primary "Classes" model:** `model ClassOffering` —
  `prisma/schema.prisma:6965`. This is the chapter class series students enroll
  in (`enrollments ClassEnrollment[]`, `sessions ClassSession[]`); built from a
  `ClassTemplate`. The future "Classes" view should read from `ClassOffering`.
- **Lead instructor:** `instructorId String` + `instructor User`
  (relation `"ClassOfferingsInstructed"`) — `:6969-6970`.
- **Other instructors:** `regularInstructorAssignments RegularInstructorAssignment[]`
  (relation `"RegularInstructorAssignmentsForOffering"`, `:7023`).
  `model RegularInstructorAssignment` (`:11825`) carries
  `role RegularInstructorAssignmentRole` where the enum (`:11803`) =
  `LEAD | CO_INSTRUCTOR | ASSISTANT | BACKUP`, and a lifecycle
  `status RegularInstructorAssignmentStatus`.
- **Separately**, the older `model Course` (`:1495`) has its own
  `leadInstructorId` / `leadInstructor` (relation `"InstructorCourses"`,
  `:1506-1507`) and `coInstructors CourseInstructor[]` (`:1522`). `Course` is
  the training/curriculum container; `ClassOffering` is the scheduled class.
  Use `ClassOffering` for the People-Strategy "Classes" view.

---

## PART B — CPO ROLE

### Mapping chosen, and why

**CPO is added as a new `AdminSubtype` (`AdminSubtype.CPO`), not a top-level
`RoleType`.** Reasoning, from the actual code:

- The codebase already expresses "specialized senior leadership" via
  `AdminSubtype` (Hiring/Mentorship/Intake/Content/Communications admins), all
  layered on the `ADMIN` `RoleType`. The CPO — a senior people-strategy officer
  who reports to the Board and owns reviews/people-health — is the same shape.
- The session pipeline already carries subtypes end-to-end:
  `lib/auth-supabase.ts` selects `adminSubtypes` (`:29`) into
  `SessionUser.adminSubtypes`, and `lib/authorization.ts` already has
  `requireAnyAdminSubtype()`. Adding a `RoleType` would have meant touching the
  `RoleTypeSchema` zod enum, every role normalizer, and `UserRole` seeding —
  larger and riskier for no benefit.
- This is the "smallest correct way" the kickoff asked for.

**⚠ Board has no representation.** There is no `BOARD` role or subtype in the
codebase. `SUPER_ADMIN` is the org-owner tier and stands in for "Board". So
`requireCPO()` passes for **ADMIN users with `CPO` OR `SUPER_ADMIN`**.

### Changes made

1. **Schema** — `prisma/schema.prisma:32` `enum AdminSubtype` gains `CPO`
   (with a comment explaining the Board/SUPER_ADMIN stand-in).
2. **Subtype mirror** — `lib/admin-subtypes.ts`: `CPO` added to
   `ADMIN_SUBTYPE_VALUES` and `ADMIN_SUBTYPE_LABELS["CPO"] = "Chief People Officer"`.
3. **Guards** — `lib/authorization.ts` (throw-style, reusing existing helpers):
   ```ts
   export const OFFICER_TIER_ROLES = ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"] as const;

   export async function requireCPO(): Promise<SessionUser> {
     const sessionUser = await requireSessionUser();
     const isAdmin = hasRole(sessionUser.roles, "ADMIN", sessionUser.primaryRole);
     if (!isAdmin || !hasAnyAdminSubtype(sessionUser.adminSubtypes, ["CPO", "SUPER_ADMIN"])) throw new Error("Unauthorized");
     return sessionUser;
   }

   export async function requireOfficer(): Promise<SessionUser> {
     const sessionUser = await requireSessionUser();
     if (!hasAnyRole(sessionUser.roles, [...OFFICER_TIER_ROLES])) throw new Error("Unauthorized");
     return sessionUser;
   }
   ```
   - `requireCPO()` → People Dashboard + succession flags (ADMIN users with CPO
     or Board/SUPER_ADMIN subtype only).
   - `requireOfficer()` → Action Items / Officer Meetings / My Actions /
     All Actions (Officer-tier and above). ADMIN-tier users — including the CPO
     and the Board/SUPER_ADMIN, who all carry the `ADMIN` role — pass.
4. **Migration** —
   `prisma/migrations/20260531120000_add_cpo_admin_subtype/migration.sql`:
   ```sql
   ALTER TYPE "AdminSubtype" ADD VALUE IF NOT EXISTS 'CPO';
   ```
   Follows the existing enum-add convention
   (`20260323090000_add_chapter_president_role_enum`): `ADD VALUE` in its own
   statement to avoid PostgreSQL 55P04 ("unsafe use of new enum value").
5. **Seed** — `prisma/seed.ts`: the `brayden.white@youthpassionproject.org`
   upsert creates the row with `AdminSubtype.CPO` when missing, then separately
   upserts `UserAdminSubtype(userId, CPO)` for existing rows so Brayden is
   upgraded to CPO without deleting any other existing admin subtypes. He keeps
   `primaryRole: ADMIN` + roles `[ADMIN, INSTRUCTOR]`.
   - Incidental fix required to run the seed at all: a **pre-existing** TDZ bug
     (`const verifiedAt` was declared *after* the `milo.wald` upsert that
     used it) was resolved by hoisting the declaration. Unrelated to CPO, but
     the seed could not execute without it.

### Verification performed (against a real Postgres 16 instance)

- Migration applied cleanly; `pg_enum` for `"AdminSubtype"` now lists all 7
  values ending in `CPO`.
- Seed ran past the Brayden block; DB confirms:
  `brayden.white@youthpassionproject.org | primaryRole=ADMIN | subtype=CPO | isDefaultOwner=t`.
- `next build` (production, `VERCEL=1`) — **exit 0**, all routes compiled,
  `ƒ Proxy (Middleware)` present.
- `vitest` — `tests/lib/authorization.test.ts`, `authorization-helpers.test.ts`,
  `admin-subtypes.test.ts` all pass (31 tests).

**⚠ Pre-existing issues observed (NOT introduced here, NOT fixed beyond the
seed TDZ):** `npx tsc --noEmit` reports many type errors in unrelated WIP files
(`app/(app)/admin/mentorship-program/page.tsx`, journey-editor types, a
`summary` field in `seedInstructorApplicantWorkflow` at `seed.ts:1005`). These
do not block the build because `next.config.mjs` sets
`typescript.ignoreBuildErrors` for Vercel builds. The full `prisma db seed`
also fails later at `seed.ts:1005` on that same pre-existing `summary`
mismatch — after the Brayden/CPO designation has already been written.

---

## Role tiers — People Strategy → real roles/subtypes

| People Strategy tier | Real role / subtype in this codebase | Guard a later view uses |
| --- | --- | --- |
| **Member** | `RoleType.STUDENT` (also `PARENT` / `APPLICANT` sit outside the staff hierarchy) | `requirePageRoles([...])` per surface |
| **Instructor** | `RoleType.INSTRUCTOR` | `requirePageRoles(["INSTRUCTOR", ...])` |
| **Officer** | `RoleType.STAFF`, `RoleType.CHAPTER_PRESIDENT`, `RoleType.HIRING_CHAIR` | **`requireOfficer()`** (Action Items, Officer Meetings, My/All Actions) |
| **Sr. Leadership** | `RoleType.ADMIN` + an `AdminSubtype` (HIRING/MENTORSHIP/INTAKE/CONTENT/COMMUNICATIONS) | `requireAnyAdminSubtype([...])` / `requireAdminPage()` |
| **CPO** | `RoleType.ADMIN` + **`AdminSubtype.CPO`** | **`requireCPO()`** (People Dashboard, succession flags) |
| **Board** | *No dedicated role* — stand-in is `AdminSubtype.SUPER_ADMIN` | **`requireCPO()`** (SUPER_ADMIN passes alongside CPO) |

Notes:
- `requireOfficer()` is intentionally a superset: every ADMIN-tier user (Sr.
  Leadership, CPO, Board/SUPER_ADMIN carry `ADMIN`) passes the officer gate, so
  leadership can always see the officer surfaces.
- The existing Leadership Action Center guard
  (`LEADERSHIP_ROLES = ["ADMIN", "STAFF"]`) is narrower than `requireOfficer()`
  (which also admits `CHAPTER_PRESIDENT` and `HIRING_CHAIR`). A later phase
  should reconcile the two — prefer `requireOfficer()` as the single officer
  gate.

---

## ADDENDUM — Action Tracker schema (Phase 1, schema only)

Adds the role-based Action Tracker the kickoff described (Lead / Executing /
Input), **separate from** the older `LeadershipActionItem` (which models the
weekly operating spreadsheet and has no distinct "Executing" role — see the
TOP-LEVEL FINDING above). At the time this addendum was written, this phase
added **schema + migration + seed only**. Later phase files are mapped in the
runtime addendum below.

**New models** (`prisma/schema.prisma`, end of file):

| Model | Purpose |
| --- | --- |
| `Department` | Minimal **functional** department (Instruction, Marketing, …). A geographic `Chapter` does not represent a functional area, so a small dedicated model is used — permitted by the task's "otherwise minimal Department model" fallback. `name`/`slug` unique. |
| `ActionItem` | `title`, `description`, `goalCategory` (string), `departmentId → Department`, `status`, `deadlineStart`, `deadlineEnd?`, `visibility`, `leadId → User`, `officerMeetingId String?` (bare column, no FK — Officer Meetings are a later phase), `createdById → User`, `flaggedAt?`, `createdAt`, `updatedAt`. |
| `ActionAssignment` | `actionItemId`, `userId`, `role`; `@@unique([actionItemId, userId, role])` so one user can hold LEAD + EXECUTING on the same item. |
| `ActionComment` | `actionItemId`, `authorId`, `body`, `type`, `createdAt`. |
| `ActionFileLink` | `actionItemId`, `label`, `url`, `addedById`, `addedAt` (reuses upload URLs; no new storage model). |

**New enums:** `ActionItemStatus` (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`,
`OVERDUE`), `ActionItemVisibility` (`OFFICERS_ONLY`, `ALL_LEADERSHIP`),
`ActionAssignmentRole` (`LEAD`, `EXECUTING`, `INPUT`), `ActionCommentType`
(`NOTE`, `INPUT_REQUESTED`).

**User back-relations added:** `actionItemsLed`, `actionItemsCreated`,
`actionAssignments`, `actionComments`, `actionFileLinksAdded`.

**Indexes:** `ActionItem` on `deadlineStart`, `(status, deadlineStart)`,
`(departmentId, status)`, `visibility`, `leadId`, `officerMeetingId`,
`flaggedAt`; `ActionAssignment` on `(userId, role)` (participant / "My Actions"
queries) + `actionItemId`; `ActionComment` on `(actionItemId, createdAt)` +
`authorId`; `ActionFileLink` on `actionItemId` + `addedById`.

**Feature flag:** `isActionTrackerEnabled()` in `lib/feature-flags.ts`
(`ENABLE_ACTION_TRACKER`, default-OFF opt-in). The schema/migration ship
unconditionally; the flag gates the later runtime surfaces.

**Migration:** `prisma/migrations/20260531130000_add_action_tracker_schema/`
— idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE TYPE` in `DO $$` guards,
FKs in `DO $$` guards), matching the repo convention.

**Seed:** `seedActionTracker()` in `prisma/seed.ts` (called from `main()` after
`seedLeadershipActionCenter()`; idempotent — skips when `ActionItem` rows
exist). Seeds 2 departments (Instruction, Marketing) and 3 action items: one
`IN_PROGRESS` item where Brayden is **both LEAD and EXECUTING** with an Anthea
`INPUT` assignment (+ one `INPUT_REQUESTED` comment and one file link), one
**OVERDUE** + flagged Marketing item, and one **OFFICERS_ONLY** succession-prep
item.

> Incidental pre-existing fix required to run the seed end-to-end: the
> `seedInstructorApplicantWorkflow` block still set `summary` on
> `instructorInterviewReview`, a column dropped in migration
> `20260514150000_drop_interview_review_summary`. That stale line (which threw
> *before* this phase's seed could run) was removed; the per-category review
> notes already carry the narrative. Unrelated to the Action Tracker, but the
> full seed could not complete without it.

---

## ADDENDUM — Runtime files through Phase 06A

**Feature flags:** `lib/feature-flags.ts` exposes
`isActionTrackerEnabled()` (`ENABLE_ACTION_TRACKER`) and
`isActionTrackerEmailsEnabled()` (`ENABLE_ACTION_TRACKER_EMAILS`).

**Action Item server actions:** `lib/people-strategy/action-items-actions.ts`
gates every mutation with `ENABLE_ACTION_TRACKER`, resolves the server session,
checks `action-permissions.ts`, validates with zod, writes through Prisma, and
revalidates Action Tracker paths.

**Action Item routes and UI:** detail route
`app/(app)/actions/[id]/page.tsx`, create/edit routes
`app/(app)/admin/actions/new/page.tsx` and
`app/(app)/admin/actions/[id]/edit/page.tsx`, form
`components/people-strategy/action-item-form.tsx`, detail card
`components/people-strategy/action-detail-card.tsx`.

**Dashboards:** `/my-actions` is `app/(app)/my-actions/page.tsx` and uses
`getMyActionItems()` plus `my-actions-selectors.ts`. `/all-actions` is
`app/(app)/all-actions/page.tsx`, officer-gated with `requireOfficer()`, and
shares filters/export logic with `action-filters.ts` and
`app/api/admin/actions/export.csv/route.ts`.

**Classes adapter:** `lib/people-strategy/class-tracker.ts` reads live
`ClassOffering` and `RegularInstructorAssignment` data; it does not copy class
data into Action Tracker tables. UI rows live in
`components/people-strategy/class-tracker-row.tsx`.

**Operational emails:** assignment emails are triggered from
`lib/people-strategy/action-emails.ts`; cron emails are implemented in
`lib/people-strategy/action-cron.ts` and routed through
`app/api/cron/action-weekly-digest/route.ts`,
`app/api/cron/action-deadline-warning/route.ts`, and
`app/api/cron/action-deadline-reached/route.ts`, all using the existing
`CRON_SECRET` bearer pattern and `lib/email.ts`.

**Feedback Requests:** schema is `FeedbackRequest`; creation/read helpers are
`lib/people-strategy/feedback-requests.ts`, response mutation is
`lib/people-strategy/feedback-request-actions.ts`, and the collaborator form is
`app/(app)/people-strategy/feedback/[id]/`.

**Officer Meetings 06A:** schema is `OfficerMeeting`, `MeetingNote`, and
`MiscUpdate`; actions are in
`lib/people-strategy/officer-meetings-actions.ts`, queries are in
`lib/people-strategy/officer-meetings-queries.ts`, and the UI foundation is
`app/(app)/officer-meetings/page.tsx` plus
`components/people-strategy/officer-meetings-client.tsx`. Agenda/summary
buttons are disabled placeholders; no Officer Meeting AI generation is wired.
