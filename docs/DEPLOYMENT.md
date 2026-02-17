# YPP-Portal Deployment Guide

This guide covers deploying the YPP-Portal to production (Vercel + Supabase/Neon).

---

## Prerequisites

- GitHub account with repository access
- Vercel account ([vercel.com](https://vercel.com))
- PostgreSQL database (Supabase or Neon recommended)
- Domain name (optional, Vercel provides `.vercel.app`)

---

## Quick Start (Vercel Deployment)

### 1. Database Setup

**Option A: Supabase (Recommended)**
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database
4. Copy connection strings:
   - `DATABASE_URL` (Transaction pooler, port 6543)
   - `DIRECT_URL` (Direct connection, port 5432)

**Option B: Neon**
1. Create account at [neon.tech](https://neon.tech)
2. Create new project
3. Copy connection strings from dashboard

### 2. Vercel Project Setup

1. **Import Repository**
   ```bash
   # Or import via Vercel dashboard: vercel.com/new
   ```

2. **Configure Build Settings**
   - Framework Preset: **Next.js**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Add Environment Variables**

   Go to Project Settings → Environment Variables and add:

   ```bash
   # Database (Required)
   DATABASE_URL="postgresql://..."
   DIRECT_URL="postgresql://..."

   # NextAuth (Required)
   NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
   NEXTAUTH_URL="https://your-domain.com"  # Or leave empty for Vercel auto-detection

   # Vercel Blob Storage (Required for file uploads)
   BLOB_READ_WRITE_TOKEN="vercel_blob_..."  # Auto-set when you add Vercel Blob integration

   # Email (Optional but recommended)
   RESEND_API_KEY="re_..."  # From resend.com
   EMAIL_FROM="YPP Portal <noreply@yourdomain.com>"
   ```

4. **Add Integrations** (via Vercel Dashboard → Integrations)
   - **Vercel Blob** - For file storage
   - **Upstash Redis** - For rate limiting (auto-configures KV_* variables)

### 3. Deploy

```bash
# First deployment
git push origin main

# Or deploy via Vercel CLI
npx vercel --prod
```

### 4. Run Database Migrations

After first deployment:

```bash
# Connect to production database
npx prisma migrate deploy

# Seed initial data (optional)
npx prisma db seed
```

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (pooled) | `postgresql://user:pass@host:6543/db?pgbouncer=true` |
| `DIRECT_URL` | PostgreSQL direct connection (for migrations) | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | Session encryption secret (32+ chars) | Generate with `openssl rand -base64 32` |

### Optional (But Recommended)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXTAUTH_URL` | Base URL of your application | Auto-detected on Vercel |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | Auto-set by Vercel Blob integration |
| `KV_REST_API_URL` | Upstash Redis URL | Auto-set by Upstash integration |
| `KV_REST_API_TOKEN` | Upstash Redis token | Auto-set by Upstash integration |
| `RESEND_API_KEY` | Resend email API key | None (emails won't send) |
| `EMAIL_FROM` | From address for emails | `noreply@youthpassionproject.org` |

### Optional (Advanced)

| Variable | Description | Values |
|----------|-------------|--------|
| `NODE_ENV` | Environment mode | `production`, `development` |
| `STORAGE_PROVIDER` | Force storage provider | `auto`, `blob`, `local` |
| `EMAIL_PROVIDER` | Force email provider | `auto`, `resend`, `smtp` |
| `SMTP_HOST` | SMTP server hostname | e.g., `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | e.g., `587`, `465` |
| `SMTP_USER` | SMTP username | Your email |
| `SMTP_PASS` | SMTP password | App-specific password |

---

## Post-Deployment Setup

### 1. Verify Deployment

Check these endpoints:
- `https://your-domain.com/login` - Should load login page
- `https://your-domain.com/api/health` - Should return 200 (if implemented)

### 2. Create Initial Admin Account

**Option A: Via Database**
```sql
-- Connect to your database
-- Create admin user with password "temporary-password"
INSERT INTO "User" (id, email, name, "passwordHash", "primaryRole")
VALUES (
  gen_random_uuid(),
  'admin@yourorg.com',
  'Admin User',
  '$2a$10$...',  -- Generate with: bcrypt-cli hash temporary-password 10
  'ADMIN'
);

-- Add ADMIN role
INSERT INTO "UserRole" ("userId", role)
SELECT id, 'ADMIN' FROM "User" WHERE email = 'admin@yourorg.com';
```

**Option B: Via Seed Script**
Edit `prisma/seed.ts` to add your admin email, then run:
```bash
npx prisma db seed
```

### 3. Configure Custom Domain (Optional)

1. Go to Vercel Project Settings → Domains
2. Add your domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` to your custom domain

### 4. Set Up Monitoring

- **Vercel Analytics**: Enable in Project Settings → Analytics
- **Sentry** (recommended): See separate Sentry setup guide
- **Uptime Monitoring**: Use UptimeRobot or similar

---

## Database Migrations

### Running Migrations in Production

**Never use `prisma db push` in production!** Always use migrations:

```bash
# Generate migration locally
npx prisma migrate dev --name your_migration_name

# Deploy to production (via Vercel or locally with prod DATABASE_URL)
npx prisma migrate deploy
```

### Migration Best Practices

1. **Test in staging first**
2. **Backup database** before migrations
3. **Use transactions** for complex migrations
4. **Never rollback schema** - write forward-only migrations
5. **Monitor during deployment** - watch for errors

### Rollback Strategy

If a deployment fails:
1. **Vercel**: Instant rollback via dashboard (Project → Deployments → Previous → Promote to Production)
2. **Database**: Migrations are forward-only. Fix issues with new migrations.
3. **Files**: Cloud storage persists across deployments

---

## Troubleshooting

### Build Fails: "Module not found"

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Ensure all dependencies in package.json
npm install <missing-package>
```

### Database Connection Errors

1. Check connection string format:
   - Pooler (DATABASE_URL): Port **6543**
   - Direct (DIRECT_URL): Port **5432**
   - Add `?pgbouncer=true` to DATABASE_URL for Supabase

2. Verify IP allowlist (Supabase):
   - Settings → Database → Connection pooling
   - Add `0.0.0.0/0` to allow Vercel (or use Vercel IP ranges)

3. Test connection locally:
   ```bash
   npx prisma db pull
   ```

### File Uploads Fail

1. **Check Blob Storage**:
   - Vercel Dashboard → Storage → Blob
   - Verify `BLOB_READ_WRITE_TOKEN` is set

2. **Check logs**:
   - Vercel Dashboard → Logs
   - Look for "BLOB_READ_WRITE_TOKEN not configured"

3. **Fallback**: Set `STORAGE_PROVIDER=local` (development only)

### Rate Limiting Not Working

1. **Check Redis**:
   - Vercel Dashboard → Integrations → Upstash Redis
   - Verify `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set

2. **Fallback**: In-memory rate limiting will work for single instance

### Emails Not Sending

1. **Check provider**:
   - Resend: Verify `RESEND_API_KEY`
   - SMTP: Verify all `SMTP_*` variables

2. **Check `EMAIL_FROM`**: Must be verified domain in Resend

3. **Check logs**: Look for email errors in Vercel logs

---

## Performance Optimization

### 1. Database Connection Pooling

Supabase/Neon handle this automatically. If using custom PostgreSQL:
- Use PgBouncer or similar
- Set `connection_limit=10` in DATABASE_URL

### 2. Caching

Next.js App Router caches automatically. Configure in:
- `next.config.mjs` - Static generation config
- Route handlers - Add `revalidate` option
- `unstable_cache` - For data fetching

### 3. Image Optimization

```tsx
import Image from "next/image";

<Image
  src="/uploads/image.jpg"
  alt="Description"
  width={800}
  height={600}
  quality={80}
/>
```

### 4. Vercel Edge Functions (Optional)

For global low-latency:
- Migrate API routes to Edge Runtime
- Use `export const runtime = "edge";`

---

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is 32+ characters
- [ ] Database credentials are not committed to git
- [ ] Admin accounts use strong passwords
- [ ] HTTPS enforced (Vercel does this automatically)
- [ ] Rate limiting configured (Redis)
- [ ] Security headers configured (`next.config.mjs`)
- [ ] File uploads validated server-side
- [ ] SQL injection prevented (using Prisma)
- [ ] XSS prevented (React's built-in escaping)
- [ ] Dependencies updated regularly (`npm audit`)

---

## Backup & Recovery

### Database Backups

**Supabase**: Automatic daily backups (Pro plan)
**Neon**: Automatic hourly backups

**Manual Backup**:
```bash
# Export database
pg_dump $DIRECT_URL > backup-$(date +%Y%m%d).sql

# Restore database
psql $DIRECT_URL < backup-20260217.sql
```

### File Backups

Vercel Blob provides durability. For extra safety:
- Enable versioning (if available)
- Periodic snapshots to separate storage

---

## Monitoring & Alerts

### Set Up Alerts For:
- Deployment failures
- Database connection errors
- High error rate (>1%)
- Slow response times (p95 >500ms)
- Storage quota warnings

### Tools:
- **Vercel**: Built-in monitoring
- **Sentry**: Error tracking
- **UptimeRobot**: Uptime monitoring
- **PagerDuty/OpsGenie**: On-call alerts

---

## Support

For deployment issues:
- Check Vercel logs: Dashboard → Project → Logs
- Check database logs: Supabase/Neon dashboard
- Review this guide: `/docs/TROUBLESHOOTING.md`
- Contact support: support@youthpassionproject.org

---

## Related Documentation

- [Production Checklist](./PRODUCTION_CHECKLIST.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Security Audit](../SECURITY_AUDIT.md)
