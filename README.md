# YPP Pathways Portal

Dedicated portal for YPP Pathways (curriculum structure, instructor training, mentorship, and events). Built as a standalone app that can live at `portal.youthpassionproject.org` while the Wix site stays public-facing.

## Features Included

### Core Features
- Pathways overview with 101/201/301 progression, Labs, Commons
- Curriculum dashboard with class formats and levels
- Instructor training dashboard with approval-by-level
- Mentorship dashboard for instructors and students
- Events & competition prep tracking
- Chapter view with local program stats
- Role-based dashboards (student, instructor, mentor, admin, chapter lead)

### Goals & Progress System (New)
- Goal templates by role (Instructor, Chapter Lead, etc.)
- Progress tracking with 4-level progress bars:
  - Behind Schedule (Red)
  - Getting Started (Yellow)
  - On Track (Green)
  - Above and Beyond (Blue)
- Mentor feedback submission with visual progress indicators
- Monthly reflection forms for happiness tracking

### Admin Features
- Create users, courses, pathways, modules, events, and mentorships
- Goal template management and assignment
- View all staff reflections and progress updates

### Instructor Applicant Workflow (V1)
- End-to-end pipeline: intake → reviewer evaluation → interviewer assignment → structured interview → chair decision → onboarding sync
- New `HIRING_CHAIR` role with a dedicated Chair Queue page at `/admin/instructor-applicants/chair-queue`
- Calm decision cockpit (Chair Comparison Slideout) with readiness checklist, per-interviewer rubric dots, and rationale capture
- Shared Command Center at `/admin/instructor-applicants` and `/chapter-lead/instructor-applicants`
- Auto-advance `INTERVIEW_COMPLETED → CHAIR_REVIEW` on last interviewer review (race-safe transaction)
- Behind `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1` feature flag; schema is additive / safe to roll back by flipping the flag

### Native Instructor Readiness (Training + Interview Gate)
- Training academy completion is enforced by module requirements (video/checkpoints/quiz/evidence)
- Instructors can schedule interviews from training progress via:
  - posted reviewer slots, or
  - preferred-time availability requests
- Admin + Chapter Lead readiness command centers:
  - `/admin/instructor-readiness`
  - `/chapter-lead/instructor-readiness`
- Class offering publish flow now enforces readiness before first publish
- Existing live offerings are protected with `grandfatheredTrainingExemption`

### People Strategy
- Action Items with Lead, Executing, and Input roles, plus My Actions, All Actions, Officer Meetings, file links, comments, and CPO escalation flagging
- Monthly Check-Ins compile existing monthly reflections and mentor goal reviews instead of creating a duplicate monthly review system
- Quarterly Reviews reuse the existing 4-level goal rating enum for Performance x Potential succession placement
- CPO People Dashboard at `/people` for CPO/Board people-health, succession, workload, and confidential feedback workflows
- All People Strategy surfaces are feature-flagged and reuse existing auth, users, classes, mentorship, uploads, email, Twilio, and cron patterns

### Unified Primary-Role Dashboard (All Tools)
- `/` is a unified command center for the user's primary role only.
- Includes live role queues, KPIs, next actions, and a searchable "All Tools Explorer".
- Chapter recruiting dashboard links support deep tabs:
  - `/chapter/recruiting?tab=positions`
  - `/chapter/recruiting?tab=candidates`
  - `/chapter/recruiting?tab=interviews`
  - `/chapter/recruiting?tab=decisions`

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js with credentials provider
- **Hosting:** Vercel (recommended)

## Quick Start (Local Development)

1. Copy `.env.example` to `.env` and update values:
   ```bash
   cp .env.example .env
   ```

2. Start Postgres:
   ```bash
   docker compose up -d
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run migrations + seed data:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Start the app:
   ```bash
   npm run dev
   ```

## Login Accounts (seeded)
| Email | Role |
|-------|------|
| `brayden.white@youthpassionproject.org` | Admin + Instructor (The Frisch School) |
| `anthea.zamir@youthpassionproject.org` | Admin—full access (Super Admin + all admin subtypes; Seattle Chapter) |
| `carlygelles@gmail.com` | Mentor + Staff (Boston Chapter) |
| `avery.lin@youthpassionproject.org` | Instructor (The Frisch School) |
| `jordan.patel@youthpassionproject.org` | Student (The Frisch School) |
| `hiring.chair@youthpassionproject.org` | **HIRING_CHAIR** (Morgan Ellison) — seeded for Instructor Applicant Workflow V1 demo |

**Password for all seeded users:** Set via the `SEED_PASSWORD` environment variable before running `npm run db:seed`.

**Local sign-in:** These emails use legacy password login against the database (see `lib/legacy-auth-config.ts`). Production setups may sync the same users to Supabase Auth instead.

## Database Deployment

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Pooled connection (e.g. port 6543 via PgBouncer). Used at runtime by the app. |
| `DIRECT_URL` | Direct connection (e.g. port 5432). Used by Prisma for migrations. |
| `PRISMA_RUNTIME_DATABASE_URL` | Optional override for app runtime queries. If set, this is used instead of `DATABASE_URL`. |
| `ENABLE_NATIVE_INSTRUCTOR_GATE` | Enable native readiness gate (`true`/`false`, defaults to enabled). |
| `ENFORCE_PRE_OFFERING_INTERVIEW` | Enforce interview requirement before first publish (`true`/`false`, defaults to enabled). |
| `ENABLE_UNIFIED_ALL_TOOLS_DASHBOARD` | Enable unified primary-role dashboard at `/` (`true`/`false`, defaults to enabled). |
| `ENABLE_INSTRUCTOR_APPLICANT_WORKFLOW_V1` | Enable the Instructor Applicant Workflow V1 pipeline (`true`/`false`, defaults to `true`). |
| `ENABLE_ACTION_TRACKER` | Enable People Strategy Action Items, My Actions, All Actions, admin action forms, action detail, classes tracker, and Officer Meetings (`true`/`false`, defaults to off). |
| `ENABLE_ACTION_TRACKER_EMAILS` | Enable Action Tracker automated emails, monthly feedback request emails, feedback response links, and People Strategy action cron jobs (`true`/`false`, defaults to off). |
| `ENABLE_QUARTERLY_REVIEWS` | Enable Monthly Check-In compilation and Quarterly Review submission/read surfaces (`true`/`false`, defaults to off). |
| `ENABLE_PEOPLE_DASHBOARD` | Enable the CPO/Board People Dashboard and People Strategy member-detail section (`true`/`false`, defaults to off). |
| `ENABLE_PROVISIONAL_CLOCK` | Enable the provisional 3-month confirmation clock UI when the data field is ready (`true`/`false`, defaults to off). |
| `ENABLE_MENTORSHIP_2` | Enable Mentorship 2.0 (Action Tracker 3.0, Phase M1): mentor expertise taxonomy, mentee application intake, and the COMPLETE→Alumni transition (`true`/`false`, defaults to off). |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI-generated mentor review draft assistance (`lib/ai/generate-review-draft.ts`). |
| `CRON_SECRET` | Shared secret for cron-protected API routes, including People Strategy routes listed below. Must match `vercel.json`. |
| `TWILIO_ACCOUNT_SID` | Twilio account SID for SMS delivery. |
| `TWILIO_AUTH_TOKEN` | Twilio auth token for SMS delivery and webhook validation. |
| `TWILIO_MESSAGING_SERVICE_SID` | Preferred Twilio Messaging Service SID for outbound SMS. |
| `TWILIO_FROM_NUMBER` | Optional fallback sender number if no messaging service SID is used. |

`DATABASE_URL` and `DIRECT_URL` are required for production. If you are not using connection pooling, they can be the same URL.

### Running Migrations

**Locally:**
```bash
npx prisma migrate dev          # create + apply migrations during development
npx prisma migrate deploy       # apply pending migrations (CI/production)
```

**On Vercel (automatic):**
The build script (`scripts/maybe-db-sync.mjs`) runs `prisma migrate deploy` automatically during each Vercel build. This safely applies any pending migrations without dropping data.

| Env var | Effect |
|---------|--------|
| `SKIP_DB_SYNC=1` or `DISABLE_DB_SYNC=1` | Skip migration during build |
| `REQUIRE_DB_SYNC=1` | Fail preview builds if migration fails |

Production deploys (`VERCEL_ENV=production`) now fail automatically when migration fails, to prevent schema drift.

**Manual deployment (if not using the build hook):**
```bash
DATABASE_URL="..." DIRECT_URL="..." npx prisma migrate deploy
```

### Important Notes
- Never use `prisma db push` in production — it can drop columns/data.
- Always use `prisma migrate deploy` which only applies committed migration files.
- `DIRECT_URL` must point to a non-pooled connection for migrations to work.

### Backfill Native Instructor Readiness
After deploying migrations, run:

```bash
node scripts/backfill-native-instructor-readiness.mjs
```

This script is idempotent and safe to rerun.

## Vercel Deployment

### Prerequisites
1. A Vercel account
2. A PostgreSQL database (recommended providers):
   - [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
   - [Neon](https://neon.tech)
   - [Supabase](https://supabase.com)

### Deployment Steps

1. **Connect Repository to Vercel**
   - Import your GitHub repository in Vercel dashboard
   - Vercel will auto-detect Next.js

2. **Set Environment Variables**
   In Vercel project settings, add:
   ```
   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&sslmode=require
   DIRECT_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require
   NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
   SEED_PASSWORD=a_strong_password_for_seeded_accounts
   ENABLE_UNIFIED_ALL_TOOLS_DASHBOARD=true
   ENABLE_ACTION_TRACKER=true
   ENABLE_ACTION_TRACKER_EMAILS=true
   ENABLE_QUARTERLY_REVIEWS=true
   ENABLE_PEOPLE_DASHBOARD=true
   ENABLE_PROVISIONAL_CLOCK=false
   ANTHROPIC_API_KEY=sk-ant-...
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_MESSAGING_SERVICE_SID=MG...
   ```
   Optional emergency fallback:
   ```
   PRISMA_RUNTIME_DATABASE_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require
   ```
   Generate `NEXTAUTH_SECRET` with: `openssl rand -base64 32`

3. **Deploy**
   The build command runs `prisma migrate deploy` + `prisma generate` + `next build` automatically.
   Production deploys fail automatically if migrations can't be applied.
   Set `REQUIRE_DB_SYNC=1` if you also want preview builds to fail on migration errors.

4. **Seed Initial Data (Optional)**
   After your first deployment, seed the database from a machine with network access to your DB:
   ```bash
   SEED_PASSWORD="your-strong-password" npx prisma db seed
   ```

### Database Connection Pooling

For serverless environments, use connection pooling:
- **DATABASE_URL**: Points to pooler (e.g., port 6543)
- **DIRECT_URL**: Points to direct connection (e.g., port 5432)
- Include `sslmode=require` in both URLs.

Example with Neon:
```
DATABASE_URL="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
DIRECT_URL="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

Example with Supabase (pooling + direct):
```
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&sslmode=require"
DIRECT_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require"
```

> ⚠️ Do not set `connection_limit=1` — it deadlocks any page that issues more
> than one parallel Prisma query (Prisma P2024). Use `5` or higher; set
> `PRISMA_CONNECTION_LIMIT` to override. `lib/prisma.ts` will automatically
> bump any sub-3 value to the safe default and log a warning.

## Project Structure

```
app/
├── (app)/              # Protected routes
│   ├── admin/          # Admin dashboard & management
│   ├── goals/          # User goals view
│   ├── mentorship/     # Mentorship & feedback
│   └── ...
├── (public)/           # Public routes (login, signup)
└── api/                # API routes

components/
├── progress-bar.tsx    # Progress bar components
├── empty-state.tsx     # Reusable empty/coming-soon state
├── nav.tsx             # Navigation
└── ...

lib/
├── prisma.ts           # Prisma client singleton
├── goals-actions.ts    # Goals server actions
├── admin-actions.ts    # Admin server actions
└── ...

prisma/
├── schema.prisma       # Database schema
└── seed.ts             # Seed data
```

## Implementation Plan

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the full feature roadmap including:
- Application & Recruitment System
- User Profiles & Biographical Information
- Monthly Reflection Forms
- Special Programming (Passion Labs, etc.)
- Alumni & Awards System
- And more...

## Operator Runbook
- **Instructor Applicant Workflow V1**: [`docs/brayden/instructor-applicant-workflow-runbook.md`](./docs/brayden/instructor-applicant-workflow-runbook.md)
- Native training + interview workflow: [`docs/brayden/instructor-training-interview-native-runbook.md`](./docs/brayden/instructor-training-interview-native-runbook.md)
- Chapter operating system + hiring workflow: [`docs/brayden/chapter-os-runbook.md`](./docs/brayden/chapter-os-runbook.md)
- Primary-role command center + 45-day expansion roadmap: [`docs/brayden/dashboard-45-day-expansion-plan.md`](./docs/brayden/dashboard-45-day-expansion-plan.md)

## Instructor Applicant Workflow — Key Routes
- Command Center (Admin): `/admin/instructor-applicants`
- Command Center (Chapter Lead): `/chapter-lead/instructor-applicants`
- Chair Queue: `/admin/instructor-applicants/chair-queue`
- Applicant detail cockpit: `/applications/instructor/[id]`
- Interviewer workspace: `/applications/instructor/[id]/interview`
- Archive tab: `/admin/instructor-applicants?tab=archive`

## People Strategy Runbook

### Feature Flags
| Flag | Default | Surfaces |
|------|---------|----------|
| `ENABLE_ACTION_TRACKER` | Off | `/my-actions`, `/actions/[id]`, `/all-actions`, `/all-actions/classes`, `/officer-meetings`, `/admin/actions`, `/admin/actions/new`, `/admin/actions/[id]/edit`, `/api/admin/actions/export.csv` |
| `ENABLE_ACTION_TRACKER_EMAILS` | Off | Assignment/deadline emails, `/people-strategy/feedback/[id]`, Request Monthly Feedback button, action email cron routes |
| `ENABLE_QUARTERLY_REVIEWS` | Off | Monthly Check-In compile actions and Quarterly Review submit/read sections |
| `ENABLE_PEOPLE_DASHBOARD` | Off | `/people`, People Strategy section on `/admin/instructors/[id]`, confidential feedback response visibility |
| `ENABLE_PROVISIONAL_CLOCK` | Off | Provisional 3-month confirmation block only; when off, no provisional UI is shown |

### Role Access Matrix
| Surface | Server-side guard | Allowed access |
|---------|-------------------|----------------|
| My Actions | Signed-in session plus `getMyActionItems`/`canViewAction` per-record filtering | Any assigned user can see their own Lead, Executing, or Input actions. Non-officers cannot see `OFFICERS_ONLY` actions, even if assigned. |
| Action detail | `getActionItemById` plus `canViewAction`; mutation actions re-check `canEditAction`/`canFlagAction` | Assigned users can view allowed items. Leads and Executing owners can edit their own allowed items. Input-only users can comment/flag but not edit core fields. |
| All Actions, Classes, CSV export | `requireOfficer()` | Officer-tier and above: `ADMIN`, `STAFF`, `CHAPTER_PRESIDENT`, `HIRING_CHAIR` |
| Admin create/edit actions | `requirePageRoles(OFFICER_TIER_ROLES)` and server action permission checks | Officer-tier and above |
| Officer Meetings | `requireOfficer()` | Officer-tier and above |
| People Dashboard | `requireCPO()` | CPO (`ADMIN` + `CPO` subtype) and Board stand-in (`ADMIN` + `SUPER_ADMIN` subtype) |
| CPO escalation queue | `flagActionToCPO` uses `canFlagAction`; flagged items remain visible through normal action visibility rules | Anyone who can view an action can flag it. CPO/Board can see every flagged action because `canViewAction` grants them full action visibility. |
| Board roll-up / succession view | `requireCPO()` on `/people`; quarterly review writes use `requireCPO()` | Board is represented by `SUPER_ADMIN`. The current roll-up is the People Dashboard succession view; add a separate Board-only route only with a `SUPER_ADMIN` subtype guard. |
| Confidential monthly feedback responses | `getFeedbackResponsesForSubject` and `requestMonthlyFeedback` call `requireCPO()` | CPO/Board only. Subjects never read raw response bodies. Collaborators can access only their own emailed feedback form. |

### People Strategy Cron Routes
All routes require `Authorization: Bearer $CRON_SECRET` and no-op unless `ENABLE_ACTION_TRACKER_EMAILS=true`.

| Route | Schedule in `vercel.json` | Purpose |
|-------|---------------------------|---------|
| `/api/cron/action-weekly-digest` | `0 8 * * 1` | Monday 8:00 UTC weekly digest of open action items per recipient |
| `/api/cron/action-deadline-warning` | `0 8 * * *` | Daily 8:00 UTC 24-hour deadline warning for assignees and leads |
| `/api/cron/action-deadline-reached` | `0 23 * * *` | Daily 23:00 UTC due-today notices plus overdue lead notification/sweep |

### Migration And Seed Notes
- People Strategy migrations are additive and committed:
  - `20260531120000_add_cpo_admin_subtype`
  - `20260531130000_add_action_tracker_schema`
  - `20260601120000_add_action_email_log`
  - `20260601130000_add_feedback_request`
  - `20260601140000_add_officer_meetings`
  - `20260601150000_add_people_strategy_check_in`
  - `20260601160000_add_quarterly_review`
  - `20260601170000_add_quarterly_review_notes`
- Apply locally with `npm run db:migrate`; apply in CI/production with `npm run db:migrate:deploy` or the existing Vercel build hook.
- `prisma/seed.ts` sets Brayden as CPO (`ADMIN` + `CPO`) and Anthea as the Board stand-in (`ADMIN` + `SUPER_ADMIN`).
- `prisma/seed.ts` also seeds two functional departments and three People Strategy `ActionItem` rows. It skips Action Tracker demo seeding when any `ActionItem` already exists, so reruns do not duplicate action items.
- No duplicate user, goal, reflection, mentorship, class/offering, upload, email, auth, cron, or dashboard frameworks were added.

### Manual Smoke Test Checklist
1. Flags off: set all five People Strategy flags to `false`, restart, and confirm People Strategy nav links are absent and these URLs return 404/not found: `/my-actions`, `/all-actions`, `/officer-meetings`, `/people`, `/admin/actions`, `/people-strategy/feedback/example`.
2. Action Tracker on: set `ENABLE_ACTION_TRACKER=true`. As an assigned non-officer, open `/my-actions` and an allowed `/actions/[id]`; confirm `/all-actions` and `/officer-meetings` are not reachable. As Officer+, confirm All Actions, Classes, CSV export, create/edit, and Officer Meetings work.
3. People Dashboard on: set `ENABLE_PEOPLE_DASHBOARD=true`. Confirm CPO/Board can open `/people`; a normal admin without `CPO`/`SUPER_ADMIN` gets not found. Confirm rating markers show text labels, not color-only dots.
4. Emails on: set `ENABLE_ACTION_TRACKER_EMAILS=true` and `CRON_SECRET`. Confirm cron routes reject missing/wrong secrets, return `ok` with the right secret, and skip when the email flag is off.
5. Quarterly Reviews on: set `ENABLE_QUARTERLY_REVIEWS=true`. Confirm CPO/Board can save a review and Officer/Staff without the CPO/Board subtype is rejected server-side.
6. Provisional clock off: with `ENABLE_PROVISIONAL_CLOCK=false`, confirm no provisional block appears on member detail. With it on, confirm the provisional block appears only in the People Strategy member section.
7. Responsive and keyboard check: test phone, tablet, and desktop widths; tab through filters, action forms, action detail controls, Officer Meeting controls, and feedback forms. Confirm focus is visible, controls wrap instead of overlapping, empty/loading/error states are readable, and no small text uses pale gray.
8. Automated checks: run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`. Run `npm run test:e2e:smoke` when the seeded database and Playwright browser dependencies are available.

## Chapter Recruiting (Native)
- Canonical chapter hiring route: `/chapter/recruiting`
- Admin recruiting route: `/admin/recruiting`
- Chapter proposal route (self-propose + self-nominate as chapter president): `/chapters/propose`
- Position composer routes:
  - `/chapter/recruiting/positions/new`
  - `/chapter/recruiting/positions/[id]/edit`
  - `/admin/recruiting/positions/new` (admin-first composer)
- Compatibility route: `/chapter/applicants` (still operational, with link to canonical recruiting page)
- Application workspace route: `/applications/[id]` now includes:
  - interview status timeline,
  - structured interview notes with recommendation,
  - decision blocker banner,
  - chapter-scoped final decision action.

## Instructor Training Academy
- Canonical instructor training route: `/instructor-training`
- Legacy compatibility route: `/instructor/training-progress` (redirects to canonical page)
- Seed default academy content (idempotent): `npm run training:seed-content`
- Source-of-truth content file: `data/training-academy/content.v1.json`
- Required module video providers that support watch tracking: `YOUTUBE`, `VIMEO`, `CUSTOM`

### Update Academy Content (Exact Workflow)
1. Edit `data/training-academy/content.v1.json`
2. Validate content before touching DB:
   - `npm run training:validate`
3. Preview DB changes safely:
   - `npm run training:import -- --file=data/training-academy/content.v1.json --dry-run`
4. Apply changes:
   - `npm run training:import -- --file=data/training-academy/content.v1.json`
5. Optional prune mode (remove DB rows not present in file):
   - `npm run training:import -- --file=data/training-academy/content.v1.json --prune=true`
6. Export current DB content back to JSON:
   - `npm run training:export -- --file=data/training-academy/content.v1.json`
7. One-command validate + import:
   - `npm run training:sync`

## Notes
- To align with the Wix site, keep branding consistent (colors, fonts, logo).
- Add a "Portal" button on Wix that links to the portal URL.
- The schema supports 101/201/301/401 levels, Labs, Commons, mentorship, and training approvals by level.
- See the YPP purple color scheme in globals.css for branding guidelines.
