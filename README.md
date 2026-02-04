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

## Demo Logins (seeded)
| Email | Role |
|-------|------|
| `brayden.white@youthpassionproject.org` | Admin + Instructor |
| `carlygelles@gmail.com` | Mentor + Staff |
| `avery.lin@youthpassionproject.org` | Instructor |
| `jordan.patel@youthpassionproject.org` | Student |

**Password for all demo users:** `ypp-demo-2026`

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
   DATABASE_URL=your_database_connection_string
   DIRECT_URL=your_direct_database_url (for migrations)
   NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
   ```

3. **Run Database Migrations**
   After first deployment, run migrations:
   ```bash
   npx prisma migrate deploy
   ```
   Or use Vercel's build command override:
   ```
   prisma migrate deploy && next build
   ```

4. **Seed Initial Data (Optional)**
   ```bash
   npm run db:seed
   ```

### Database Connection Pooling

For serverless environments, use connection pooling:
- **DATABASE_URL**: Points to pooler (e.g., port 6543)
- **DIRECT_URL**: Points to direct connection (e.g., port 5432)

Example with Neon:
```
DATABASE_URL="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
DIRECT_URL="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
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
├── nav.tsx             # Navigation
└── ...

lib/
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

## Notes
- To align with the Wix site, keep branding consistent (colors, fonts, logo).
- Add a "Portal" button on Wix that links to the portal URL.
- The schema supports 101/201/301 levels, Labs, Commons, mentorship, and training approvals by level.
- See the YPP purple color scheme in globals.css for branding guidelines.
