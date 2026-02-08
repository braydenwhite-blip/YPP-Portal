# Tech Stack (Read This First)

This repo is the **YPP Pathways Portal**.

If you are new here, think of the app like a building:

1. **Pages (what you see)** live in `app/**/page.tsx`.
2. **Server code (what the app does)** lives in:
   - API routes in `app/api/**/route.ts`
   - Server Actions in `lib/*-actions.ts` (these files usually start with `"use server"`).
3. **Database (where data is saved)** is PostgreSQL, accessed through Prisma in `prisma/schema.prisma`.
4. **Login + permissions** is NextAuth in `lib/auth.ts` plus route protection in `middleware.ts`.
5. **Styling** is plain CSS in `app/globals.css` (no Tailwind).

The sections below tell you exactly **what tech is used** and **which file(s) to edit** for common changes.

---

## 1) Framework + Language

### What we use
- **Next.js 14 (App Router)** for the full app (frontend + backend in one codebase).
- **React 18** for UI components.
- **TypeScript** for type safety.

### Where it lives
- Pages and layouts: `app/`
- Reusable components: `components/`
- TypeScript config and path alias (`@/*`): `tsconfig.json`

### What to edit
- Add or edit a page:
  - Protected pages: `app/(app)/**/page.tsx`
  - Public pages (login/signup): `app/(public)/**/page.tsx`
  - Onboarding pages: `app/(onboarding)/**/page.tsx`
- Change global HTML metadata / font:
  - `app/layout.tsx`

---

## 2) Routing (App Router)

### What we use
- Next.js **route groups** to separate areas of the app:
  - `(public)` for unauthenticated pages
  - `(app)` for authenticated pages
  - `(onboarding)` for onboarding flow

### Where it lives
- Root layout: `app/layout.tsx`
- Authenticated "shell" layout (sidebar + onboarding redirect): `app/(app)/layout.tsx`

### What to edit
- Change the sidebar layout or signed-in layout:
  - `app/(app)/layout.tsx`
  - `components/app-shell.tsx`
- Change navigation links / role-based visibility:
  - `components/nav.tsx`

---

## 3) Auth (NextAuth) + Route Protection

### What we use
- **NextAuth.js v4** with a **Credentials provider** (email + password).
- Password hashing/checking: **bcryptjs**.
- Session strategy: **JWT** (roles are stored on the token and refreshed from DB periodically).

### Where it lives
- NextAuth config: `lib/auth.ts`
- NextAuth route handler: `app/api/auth/[...nextauth]/route.ts`
- Middleware that blocks protected routes when not logged in: `middleware.ts`
- Public paths list (allowed without login): `middleware.ts` (`PUBLIC_PATHS`)

### What to edit
- Change how login works (validation, rate limit, password rules, token fields):
  - `lib/auth.ts`
- Change which routes are public/private:
  - `middleware.ts`
- Change the login page UI:
  - `app/(public)/login/page.tsx`

---

## 4) Database (PostgreSQL) + ORM (Prisma)

### What we use
- **PostgreSQL** database.
- **Prisma** as the ORM (generates a typed client and runs migrations).

### Where it lives
- Prisma schema (all DB tables/models/enums): `prisma/schema.prisma`
- Migrations SQL: `prisma/migrations/**/migration.sql`
- Seed script: `prisma/seed.ts`
- Prisma client setup (connection + pooling tweaks): `lib/prisma.ts`
- Local database (Docker): `docker-compose.yml`

### What to edit
- Add a new table/column/enum:
  1. Edit `prisma/schema.prisma`
  2. Run a migration (`npm run db:migrate`)
  3. Update code that reads/writes the new field (usually in `lib/*-actions.ts` and pages)

---

## 5) Server Code (API Routes + Server Actions)

### What we use
- Next.js **Route Handlers** for API endpoints: `app/api/**/route.ts`
- Next.js **Server Actions** for form submissions and server-side mutations: `lib/*-actions.ts`

### Where it lives
- API examples:
  - Auth: `app/api/auth/[...nextauth]/route.ts`
  - Uploads: `app/api/upload/route.ts`
  - Calendar: `app/api/calendar/route.ts`
  - Events: `app/api/events/route.ts`
  - Chapters: `app/api/chapters/route.ts`
- Server action examples:
  - Password reset: `lib/password-reset-actions.ts`
  - Upload helpers: `lib/upload-actions.ts`

### What to edit
- If you want a URL like `/api/something`:
  - Create or edit `app/api/something/route.ts`
- If you want to submit a form and save data:
  - Create or edit a `"use server"` file in `lib/*-actions.ts`

---

## 6) Emails (Resend or SMTP)

### What we use
- **Resend** (API-based) OR **SMTP** via **nodemailer**.
- The code auto-picks SMTP if configured, otherwise tries Resend (unless `EMAIL_PROVIDER` forces one).

### Where it lives
- Email sending + templates: `lib/email.ts`
- Password reset flow that sends an email: `lib/password-reset-actions.ts`

### What to edit
- Change email HTML/branding:
  - `lib/email.ts`
- Change password reset behavior:
  - `lib/password-reset-actions.ts`
- Set env vars:
  - `.env` (local) and your hosting provider's env settings (prod)

---

## 7) File Uploads

### What we use
- UI component uploads files to `POST /api/upload`.
- The server writes files to `public/uploads` and saves metadata in the DB (`FileUpload` model).

### Where it lives
- Upload API route: `app/api/upload/route.ts`
- Upload UI component: `components/file-upload.tsx`
- Upload-related server actions: `lib/upload-actions.ts`
- Upload DB model: `prisma/schema.prisma` (`FileUpload`, `UploadCategory`)

### Important hosting note
Writing files to disk (`public/uploads`) works on many local servers, but **serverless hosting may not keep files permanently**.
If you move to Vercel Blob or S3, the main file to change is:
- `app/api/upload/route.ts`

---

## 8) Styling / Design System

### What we use
- Plain **CSS** (a custom design system) in one big file.
- Font: **Inter** loaded via `next/font/google`.

### Where it lives
- Global CSS: `app/globals.css`
- Font + metadata setup: `app/layout.tsx`

### What to edit
- Colors, spacing, buttons, cards, layout, responsive behavior:
  - `app/globals.css`
- Sidebar layout styles:
  - `app/globals.css` (classes like `.app-shell`, `.sidebar`, `.nav`, etc.)

---

## 9) Tooling / Commands

### What we use
- Package manager: **npm**
- Linting: **ESLint** (`next lint`)
- Prisma CLI for DB work
- `tsx` to run the seed script

### Key commands (from `package.json`)
- Start dev server: `npm run dev`
- Production build: `npm run build`
- Run migrations locally: `npm run db:migrate`
- Seed local DB: `npm run db:seed`

---

## 10) Environment Variables (Secrets/Config)

The "settings" for the app are mostly environment variables.

### Where it lives
- Example list: `.env.example`
- Your local values: `.env`

### The important ones
- `DATABASE_URL` and `DIRECT_URL` (Postgres)
- `NEXTAUTH_SECRET` and `NEXTAUTH_URL` (auth)
- Email:
  - `RESEND_API_KEY` and `EMAIL_FROM` (Resend)
  - OR `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (SMTP)

---

## "What Do I Edit?" Cheat Sheet

If you only read one part, read this.

- Change a page's UI:
  - Find the matching `page.tsx` under `app/` (example: `app/(app)/profile/page.tsx`)
- Change the sidebar links:
  - `components/nav.tsx`
- Change the signed-in layout (sidebar/header):
  - `components/app-shell.tsx`
  - `app/(app)/layout.tsx`
- Change login rules / roles in session:
  - `lib/auth.ts`
- Change which routes require login:
  - `middleware.ts`
- Change the database schema:
  - `prisma/schema.prisma` (then run `npm run db:migrate`)
- Change password reset:
  - `app/(public)/forgot-password/page.tsx`
  - `app/(public)/reset-password/page.tsx`
  - `lib/password-reset-actions.ts`
- Change email templates:
  - `lib/email.ts`
- Change file upload behavior:
  - `components/file-upload.tsx`
  - `app/api/upload/route.ts`

---

## Example Prompts (Copy/Paste)

These are written so a person (or an AI coding assistant) knows exactly where to work.

1. **Navigation change**
   - Prompt: "Add a new nav link to `/reports` visible only to `ADMIN`. Update `components/nav.tsx`. If the page doesn't exist, create `app/(app)/reports/page.tsx` with a basic placeholder."

2. **Make a route public**
   - Prompt: "Allow unauthenticated users to access `/events`. Update the allow-list in `middleware.ts` so `/events` is treated like a public path."

3. **Add a database field**
   - Prompt: "Add a `preferredPronouns` field to user profiles. Update `prisma/schema.prisma` (UserProfile model), run a migration, then update the profile page UI in `app/(app)/profile/page.tsx` to edit it."

4. **Change login validation**
   - Prompt: "Allow passwords with 6+ characters (instead of 8) for development only. Update the credentials schema in `lib/auth.ts` and keep production strict."

5. **Swap uploads to cloud storage**
   - Prompt: "Replace local-disk uploads with Vercel Blob. Update `app/api/upload/route.ts` to upload to Blob and store the returned URL in the `FileUpload` table."
