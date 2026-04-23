# Deployment: Vercel + Supabase (v1)

## 1. Supabase

1. Create a Postgres project.
2. Enable **connection pooling** (PgBouncer / “Transaction” pooler URL for serverless).
3. Copy **DATABASE_URL** (pooled) and **DIRECT_URL** (migrations) into Vercel env and local `.env`.
4. Run migrations: `npx prisma migrate deploy` against production (use direct URL).
5. In **Supabase Dashboard -> Authentication -> URL Configuration**, add your app callback route:
   - `http://localhost:3000/auth/callback`
   - `https://yourdomain.com/auth/callback`
6. Auth is email + password plus magic link (no third-party OAuth providers). Make sure the Supabase auth email templates point at `${site_url}/auth/callback` for magic links, confirmations, and password reset.

## 2. Vercel

1. Import the Git repo; framework **Next.js**.
2. Set **all** variables from [`.env.example`](../.env.example) for production (secrets in Vercel only).
3. **Blob**: configure Vercel Blob (or compatible) for upload URLs used by training / assignments.
4. `NEXTAUTH_URL` must match the deployment URL exactly.

## 3. Production checklist (sign-off)

- [ ] Migrations applied; `prisma db seed` only if policy allows (usually staging).
- [ ] Smoke test: login, dashboard, one instructor training step, one chapter page.
- [ ] Email provider (SMTP / Resend) sending verification and password reset.
- [ ] CSP reports monitored (`/api/csp-report`) if enabled.
- [ ] Training content imported if using DB-driven academy: `npm run training:import -- --file=data/training-academy/content.v1.json` (review with `--dry-run` first).

See [MARKETING_PORTAL_LINK_PR.md](MARKETING_PORTAL_LINK_PR.md) for public website CTA updates.
