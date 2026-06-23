# CLAUDE.md

Guidance for AI agents and contributors working in this repository. Read this
before making changes; it captures the conventions that keep the build, types,
navigation, and styling gates green.

## What this is

The **YPP Pathways Portal** (`ypp-pathways-portal`) — the Youth Passion Project's
internal portal for instructors, mentors, chapter presidents, staff, and admins.
It covers hiring/recruiting, onboarding & training, class operations, mentorship,
a People-Strategy action tracker, and weekly meetings.

## Stack

- **Next.js 14 App Router** (React server components + server actions). App code
  lives under `app/`, most authenticated surfaces under `app/(app)/`.
- **TypeScript** throughout. Path alias `@/*` → repo root.
- **Prisma + PostgreSQL** — single schema at `prisma/schema.prisma`
  (~14k lines). The client is imported as `import { prisma } from "@/lib/prisma"`.
- **Supabase-backed auth**. Get the current user server-side with
  `getSessionUser()` (`lib/auth-supabase.ts`) or, more commonly, the guards in
  `lib/authorization.ts`.
- **Tailwind CSS v4** with the design-system primitives in `components/ui-v2/`.
- **Vitest** (unit) + **Playwright** (e2e).

## Golden rules

1. **`app/globals.css` is FROZEN.** `scripts/check-globals-css-freeze.mjs`
   enforces a line-count baseline — the file may only shrink. Do **not** add
   styles there. Style new surfaces with Tailwind utilities + `components/ui-v2/`
   primitives. You may reuse existing frozen utility classes (e.g.
   `.seg-tabs` / `.seg-tab` for tab strips).
2. **Mutations are Server Actions**, not API routes. Pattern (see
   `lib/weekly-meetings/*-actions.ts` for live examples):
   ```ts
   "use server";
   export async function doThing(input: unknown) {
     const viewer = await requireSessionUser();   // or requireOfficer(), etc.
     const data = SomeZodSchema.parse(input);      // validate first
     await prisma.model.update({ ... });
     revalidatePath("/route");
     return { ok: true };
   }
   ```
   Always validate input with **zod**, authorize with a `lib/authorization`
   guard, then `revalidatePath` the affected route(s).
3. **Navigation is declarative.** Every nav link lives in
   `lib/navigation/catalog.ts`. `npm run nav:check` (`scripts/validate-nav.mjs`)
   asserts every catalog `href` resolves to a real `page.tsx`, with no duplicate
   hrefs or duplicate visible labels per role. Add a route ⇒ add/own its catalog
   entry; remove a route ⇒ remove its entry. Keep the core map within bounds.
4. **Prisma migrations are hand-written and idempotent.** Each change to
   `schema.prisma` needs a timestamped folder in `prisma/migrations/` with a
   `migration.sql` using `CREATE TABLE IF NOT EXISTS`,
   `DO $$ BEGIN CREATE TYPE … EXCEPTION WHEN duplicate_object THEN null; END $$;`
   for enums, and guarded `ADD CONSTRAINT` blocks for FKs. The build runs
   `prisma migrate deploy` (via `scripts/maybe-db-sync.mjs`), so the SQL must
   match the schema diff exactly.

## Roles & authorization

`RoleType`: `ADMIN, STAFF, CHAPTER_PRESIDENT, HIRING_CHAIR, INSTRUCTOR, MENTOR,
STUDENT, PARENT, APPLICANT`. Admin sub-types (e.g. `SUPER_ADMIN`, `LEADERSHIP`)
live on the user. Guards in `lib/authorization.ts`:
`requireSessionUser()`, `requireOfficer()` (ADMIN/STAFF/CHAPTER_PRESIDENT/
HIRING_CHAIR), `requireLeadership()`, `requireBoard()`, `requireAnyRole()`.
Pure role helpers (client-safe) are in `lib/authorization-roles.ts`.

## Commands

```bash
npm run dev            # local dev (vercel preview wrapper); dev:local for plain next dev
npm run build          # prisma migrate deploy + next build
npm run typecheck      # tsc --noEmit   (the long pole — keep it clean)
npm run lint           # eslint
npm run nav:check      # validate the navigation catalog
npm test               # vitest run
npm run db:migrate     # prisma migrate dev
npm run db:seed        # prisma db seed
node_modules/.bin/prisma generate   # regenerate the client after schema edits
```
Local Prisma/DB commands need `DATABASE_URL` and `DIRECT_URL` set. Use the
project-local Prisma (`node_modules/.bin/prisma`), not a global `npx prisma`.

## Weekly Meetings module (`lib/weekly-meetings/`, `components/weekly-meetings/`)

The portal's teams + weekly-impact + meeting-runner system.

- **Data model** (`prisma/schema.prisma`): `Team` + `TeamMembership` (admin-
  configurable, many-to-many), `Meeting` (one generic entity; `MeetingType` =
  `OFFICER | WEEKLY_TEAM_IMPACT | CHAPTER_IMPACT | GENERIC`), `MeetingAttendee`,
  `WeeklyImpactEntry` (per person · week · team-or-chapter) + `WeeklyImpactRow`
  (the flexible Type/What·Goal/Evidence·Next/Due/Status row, with curation flags
  `presentToMeeting` / `decisionNeeded` / `sendToBoard`), `OfficerTopic` +
  `OfficerTopicOwner`, plus `MeetingDecision` and `MeetingFollowUp`.
- **Reporting week** is keyed by Monday 00:00 UTC — see `lib/weekly-meetings/week.ts`.
  A submitted Weekly Impact row surfaces in a meeting's **Impact Presentations**
  table when `presentToMeeting` is set and the entry's `weekStart` + scope match
  the meeting. The **Board roll-up** is just a filtered read of `sendToBoard`
  rows/topics — there is no board table.
- **Routes**: `/meetings` (hub), `/meetings/new`, `/meetings/[id]` (the single
  runner that adapts by type), `/my-weekly-impact` (the form), `/admin/teams`
  (admin config).
- **Server actions/loaders** live in `lib/weekly-meetings/` (`teams`,
  `weekly-impact`, `meetings` loaders; `*-actions.ts` mutations; `schemas.ts`
  zod; `permissions.ts` guards). UI is in `components/weekly-meetings/`.

## House style

- Match the surrounding code's naming, comment density, and idioms.
- Prefer reusing `components/ui-v2/` primitives (`Button`, `CardV2`, `ModalV2`,
  `ToastV2`, `StatusBadge`, `PageHeaderV2`, `DataTableShell`) over bespoke markup.
- Brand color is `brand-600` (`#6b21c8`); the scale is `brand-50…950`
  (`app/ui-v2.css`).
- Keep server/client boundaries clean: server `page.tsx` loads data and renders a
  `"use client"` component for interactivity.
