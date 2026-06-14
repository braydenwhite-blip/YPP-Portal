# Vercel Readiness — YPP Pathways Portal

A concise, deploy-time reference for shipping the portal to Vercel. It complements
the deeper `docs/DEPLOYMENT.md` and `docs/DEPLOYMENT_VERCEL_SUPABASE.md` with the
**Preview vs Production** split, the env vars the app actually reads, and a manual
verification checklist. It focuses on the Organizational Memory / Chief of Staff,
Initiatives, and People-memory surfaces.

> The app is designed to run **without AI**. `ANTHROPIC_API_KEY` is strictly
> optional and additive — every Chief of Staff answer is computed
> deterministically from portal data, and the "Add an AI summary" toggle only
> appears when the key is configured.

---

## 1. Project / build configuration

| Setting | Value |
| --- | --- |
| Framework preset | **Next.js** (auto-detected; `next@16`) |
| Package manager | **npm** (`package-lock.json` committed) |
| Install command | default (`npm install`; `postinstall` runs `prisma generate`) |
| Build command | default `npm run build` → Vercel runs `vercel-build` → `npm run build` |
| Output directory | default (`.next`) — do **not** override |
| Node.js version | 20.x or newer (uses `--max-old-space-size=6144`) |
| Cron jobs | defined in `vercel.json` (`/api/cron/*`, digests, reconcile) |

`npm run build` runs `scripts/maybe-db-sync.mjs` → `prisma generate` → `next build`.
On Vercel (`VERCEL=1`) `next.config.mjs` sets `typescript.ignoreBuildErrors: true`
so an unrelated type error never halts a release — **but** `npm run typecheck`
must still pass in CI/locally (it does; see Validation).

---

## 2. Environment variables

### Required in every environment (Preview **and** Production)

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection (pooled / pgBouncer for runtime). |
| `DIRECT_URL` | Direct Postgres connection for Prisma migrations. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (auth). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client auth). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase admin (server only — never `NEXT_PUBLIC`). |
| `NEXTAUTH_SECRET` | Session/JWT signing secret. |
| `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` | Canonical app URL for the environment. |
| `CRON_SECRET` | Shared secret guarding `/api/cron/*` routes. |

### Optional / additive (safe to omit)

| Var | Effect when unset |
| --- | --- |
| `ANTHROPIC_API_KEY` | **Optional AI.** Unset → app fully works; AI summary toggle hidden. |
| `RESEND_API_KEY` / `SMTP_*` | Email send disabled (no-op); core flows still work. |
| `TWILIO_*` | SMS disabled. |
| `NEXT_PUBLIC_PUSHER_KEY` / `PUSHER_*` | Realtime updates fall back to refresh. |
| `BLOB_READ_WRITE_TOKEN` / `STORAGE_PROVIDER` | File uploads degrade gracefully. |
| `UPSTASH_REDIS_REST_*` / `KV_REST_API_*` | Rate limiting falls back to in-memory. |
| `PORTAL_PREVIEW_PASSCODE` / `PORTAL_PUBLIC_GATE` | Gate a Preview behind a passcode. |
| `TWO_FACTOR_ENCRYPTION_KEY` | 2FA enrollment disabled. |
| `LOG_LEVEL`, `TELEMETRY_ENABLED` | Observability tuning only. |

### Feature flags (read via `lib/feature-flags.ts`)

Most default **ON** unless explicitly set to `false`; growth/dark-launch flags
default **OFF**. Set these per environment to control which surfaces render.

| Flag | Default | Controls |
| --- | --- | --- |
| `ENABLE_ACTION_TRACKER` | on (`!== "false"`) | Actions, meetings, **Chief of Staff "Ask"**. |
| `ENABLE_OPERATIONS_HUB` | on | Operations / Entity 360 surfaces. |
| `ENABLE_PEOPLE_DASHBOARD` | on | CPO People & Performance view. |
| `ENABLE_QUARTERLY_REVIEWS` | on | Quarterly review column + evidence. |
| `ENABLE_STRATEGIC_INITIATIVES` | on | Initiatives hub/detail. |
| `ENABLE_PARTNER_PIPELINE` | on | Partner pipeline + 360. |
| `ENABLE_LEADERSHIP_ROLES` | on | Leadership contributions. |
| `ENABLE_ACTION_TRACKER_EMAILS` | **off** | Action digest/escalation emails (kill-switch). |
| `ENABLE_GROWTH_OS` | **off** | `/my-growth` dark-launch. |

> The "Ask about this" entry points and the Chief of Staff per-record answers
> require `ENABLE_ACTION_TRACKER` and officer-tier access. With the flag off the
> buttons still render but the API returns 404 — keep it **on** in Production.

---

## 3. Preview vs Production

Vercel creates **Preview** deployments for every non-production branch/PR and
**Production** deployments from the configured production branch. Preview env
vars apply only to non-production deployments, and **env var changes require a
new deployment to take effect** (redeploy after editing).

| Concern | Preview | Production |
| --- | --- | --- |
| Database | Point at a **staging/seeded** Postgres — never production data. | Real managed Postgres (Supabase) with backups. |
| Auth | Staging Supabase project is fine; may gate with `PORTAL_PREVIEW_PASSCODE`. | Real Supabase project; no preview passcode. |
| AI | Leave `ANTHROPIC_API_KEY` **unset** to verify the no-AI path. | Optional; set only if AI summaries are wanted. |
| Email/SMS | Leave unset (no accidental sends) or use sandbox keys. | Real `RESEND_API_KEY` / `SMTP_*` / `TWILIO_*`. |
| Migrations | Apply to the staging DB before/with the deploy. | `prisma migrate deploy` against production before cutover. |
| Cron secret | Any value; crons may be disabled on Preview. | Strong `CRON_SECRET`; crons enabled. |

### Migrations / seed

- Migrations live in `prisma/migrations/` and are applied with
  `npm run db:migrate:deploy` (`prisma migrate deploy`).
- This pass adds `20260614220000_add_gr_template_deleted_audit_action` (a guarded,
  additive enum value) — apply it before relying on G&R template deletion.
- Preview DBs may be seeded with safe staging data (`npm run seed`). **Never**
  seed or reset a Production database.

---

## 4. Manual Vercel verification checklist

### Preview deployment

1. Push the final branch (`claude/ypp-portal-final-polish-djpbd2`).
2. Confirm the Vercel **Preview** deploy starts for the branch/PR.
3. If it fails, open the deployment **Build Logs** and read the first error.
4. Confirm required **Preview** env vars are set (section 2).
5. **Redeploy** after any env var change (changes are not retroactive).
6. Log in as an officer / leadership account.
7. Check **Leadership Home** — proactive Chief of Staff insights render.
8. Check the **Help Agent** (`/help-agent`, and ⌘K) — deterministic answers.
9. Open a **meeting** → notes → "Review suggested actions" produces suggestions.
10. Check **Work Hub** source context on actions.
11. Check **Initiatives** hub + a detail page (milestones, actions, meetings).
12. Check **People / CPO** view — filters + the new **Contributions** evidence column.
13. Open a **Person 360** drawer and a person page; click **"Ask about this"** →
    it routes to the Help Agent with the record prefilled.
14. Confirm the optional **AI toggle appears only when `ANTHROPIC_API_KEY` is set**.
15. Confirm the app works with **no AI configured** (toggle hidden, answers still work).

### Production deployment

1. Merge to the production branch **only after** Preview verification passes.
2. Confirm **Production** env vars are configured separately from Preview.
3. Run `prisma migrate deploy` (handle migrations) before/with cutover.
4. Confirm the Production deploy builds with Production env vars.
5. Smoke-test core officer flows: login → Leadership Home → Help Agent →
   meeting completion gate → initiative detail → People/CPO → Person 360.
