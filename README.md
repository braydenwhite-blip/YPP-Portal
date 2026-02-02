# YPP Pathways Portal

Dedicated portal for YPP Pathways (curriculum structure, instructor training, mentorship, and events). Built as a standalone app that can live at `portal.youthpassionproject.org` while the Wix site stays public-facing.

## Features Included
- Pathways overview with 101/201/301 progression, Labs, Commons
- Curriculum dashboard with class formats and levels
- Instructor training dashboard with approval-by-level
- Mentorship dashboard for instructors and students
- Events & competition prep tracking
- Chapter view with local program stats
- Admin UI for creating users, courses, pathways, modules, events, and mentorships
- Role-based dashboards (student, instructor, mentor, admin, chapter lead)
- Real database schema (Postgres + Prisma)
- Credential login (NextAuth + Prisma)

## Quick Start
1. Copy `.env.example` to `.env` and update values.
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
- `brayden.white@youthpassionproject.org`
- `carlygelles@gmail.com`
- `avery.lin@youthpassionproject.org`
- `jordan.patel@youthpassionproject.org`

Password for all demo users: `ypp-demo-2026`

## Notes
- To align with the Wix site, keep branding consistent (colors, fonts, logo).
- Add a “Portal” button on Wix that links to the portal URL.
- The schema already supports 101/201/301 levels, Labs, Commons, mentorship, and training approvals by level.
