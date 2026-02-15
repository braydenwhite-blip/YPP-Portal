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
| `brayden.white@youthpassionproject.org` | Admin + Instructor |
| `carlygelles@gmail.com` | Mentor + Staff |
| `avery.lin@youthpassionproject.org` | Instructor |
| `jordan.patel@youthpassionproject.org` | Student |

**Password for all seeded users:** Set via the `SEED_PASSWORD` environment variable before running `npm run db:seed`.

## Database Deployment

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Pooled connection (e.g. port 6543 via PgBouncer). Used at runtime by the app. |
| `DIRECT_URL` | Direct connection (e.g. port 5432). Used by Prisma for migrations. |
| `PRISMA_RUNTIME_DATABASE_URL` | Optional override for app runtime queries. If set, this is used instead of `DATABASE_URL`. |
| `ENABLE_NATIVE_INSTRUCTOR_GATE` | Enable native readiness gate (`true`/`false`, defaults to enabled). |
| `ENFORCE_PRE_OFFERING_INTERVIEW` | Enforce interview requirement before first publish (`true`/`false`, defaults to enabled). |

Both are required for production. If you are not using connection pooling, they can be the same URL.

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
   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
   DIRECT_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require
   NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
   SEED_PASSWORD=a_strong_password_for_seeded_accounts
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
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require"
```

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
- Native training + interview workflow: [`docs/brayden/instructor-training-interview-native-runbook.md`](./docs/brayden/instructor-training-interview-native-runbook.md)

## Instructor Training Academy
- Canonical instructor training route: `/instructor-training`
- Legacy compatibility route: `/instructor/training-progress` (redirects to canonical page)
- Seed default academy content (idempotent): `npm run training:seed-content`

## Notes
- To align with the Wix site, keep branding consistent (colors, fonts, logo).
- Add a "Portal" button on Wix that links to the portal URL.
- The schema supports 101/201/301/401 levels, Labs, Commons, mentorship, and training approvals by level.
- See the YPP purple color scheme in globals.css for branding guidelines.
