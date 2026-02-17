# YPP-Portal Production Checklist

Use this checklist to ensure a smooth production deployment.

---

## Pre-Deployment Checklist

### Code Quality

- [ ] All Phase 1 tasks completed
  - [ ] Cloud storage migration (Vercel Blob)
  - [ ] Production rate limiting (Redis)
  - [ ] Security audit fixes applied
  - [ ] Environment validation configured

- [ ] **Code Review**
  - [ ] All changes reviewed by team
  - [ ] No `console.log` statements in production code
  - [ ] No hardcoded credentials or API keys
  - [ ] No TODO/FIXME for critical items

- [ ] **Testing**
  - [ ] Local build succeeds (`npm run build`)
  - [ ] No TypeScript errors (`npm run type-check` if available)
  - [ ] Linting passes (`npm run lint`)
  - [ ] Critical paths manually tested

### Security

- [ ] **Authentication & Authorization**
  - [ ] `NEXTAUTH_SECRET` generated (32+ characters)
  - [ ] Password hashing uses bcrypt (10+ rounds)
  - [ ] Session timeout configured (24 hours)
  - [ ] JWT role refresh enabled (5-minute intervals)

- [ ] **Authorization Checks**
  - [ ] Attendance actions verify instructor/admin access
  - [ ] Messaging validates role-based recipient rules
  - [ ] Parent-student links require approval
  - [ ] Video URLs validated against allowlist

- [ ] **Rate Limiting**
  - [ ] Redis/Upstash configured for production
  - [ ] Login rate limiting active (10 attempts/15 min)
  - [ ] Upload rate limiting active (20 uploads/10 min)
  - [ ] API rate limiting configured

- [ ] **Input Validation**
  - [ ] File upload types restricted
  - [ ] File size limits enforced (10MB)
  - [ ] Form inputs validated server-side
  - [ ] SQL injection prevented (using Prisma)

- [ ] **Dependencies**
  - [ ] `npm audit` shows no high/critical vulnerabilities
  - [ ] Next.js >= 14.2.28 (patched CVEs)
  - [ ] NextAuth >= 4.24.13 (patched CVEs)

### Infrastructure

- [ ] **Database**
  - [ ] PostgreSQL database created (Supabase/Neon)
  - [ ] `DATABASE_URL` configured (pooled connection, port 6543)
  - [ ] `DIRECT_URL` configured (direct connection, port 5432)
  - [ ] Migrations ready to deploy
  - [ ] Backup strategy in place

- [ ] **File Storage**
  - [ ] Vercel Blob integration added
  - [ ] `BLOB_READ_WRITE_TOKEN` configured
  - [ ] Existing files migrated (run `/scripts/migrate-files-to-cloud.mjs`)
  - [ ] Local uploads cleared from git

- [ ] **Email Service**
  - [ ] Email provider configured (Resend or SMTP)
  - [ ] `RESEND_API_KEY` or `SMTP_*` variables set
  - [ ] `EMAIL_FROM` uses verified domain
  - [ ] Password reset emails tested

- [ ] **Monitoring**
  - [ ] Error tracking configured (Sentry recommended)
  - [ ] Vercel Analytics enabled
  - [ ] Uptime monitoring set up (UptimeRobot/Pingdom)
  - [ ] Alert channels configured (email/Slack)

### Configuration

- [ ] **Environment Variables** (Vercel Dashboard → Settings → Environment Variables)
  - [ ] `DATABASE_URL` ✓
  - [ ] `DIRECT_URL` ✓
  - [ ] `NEXTAUTH_SECRET` ✓
  - [ ] `NEXTAUTH_URL` (or auto-detected) ✓
  - [ ] `BLOB_READ_WRITE_TOKEN` ✓
  - [ ] `KV_REST_API_URL` & `KV_REST_API_TOKEN` ✓
  - [ ] `RESEND_API_KEY` or `SMTP_*` ✓
  - [ ] `EMAIL_FROM` ✓

- [ ] **Vercel Project Settings**
  - [ ] Framework preset: Next.js
  - [ ] Node version: 20.x
  - [ ] Build command: `npm run build`
  - [ ] Output directory: `.next`
  - [ ] Install command: `npm install`

- [ ] **Integrations Added**
  - [ ] Vercel Blob (for file storage)
  - [ ] Upstash Redis (for rate limiting)

### Documentation

- [ ] `.env.example` up to date
- [ ] `README.md` includes deployment instructions
- [ ] Runbooks exist for common operations
- [ ] Troubleshooting guide available

---

## Deployment Steps

### 1. Database Setup

- [ ] Create production database (Supabase/Neon)
- [ ] Copy connection strings to Vercel environment variables
- [ ] Test connection locally:
  ```bash
  npx prisma db pull
  ```

### 2. Deploy Application

- [ ] Push code to `main` branch (or deploy via Vercel CLI)
- [ ] Wait for build to complete (5-10 minutes)
- [ ] Check build logs for errors

### 3. Run Database Migrations

- [ ] Connect to production database
- [ ] Run migrations:
  ```bash
  npx prisma migrate deploy
  ```
- [ ] Verify migration status:
  ```bash
  npx prisma migrate status
  ```

### 4. Seed Initial Data (Optional)

- [ ] Review seed script (`prisma/seed.ts`)
- [ ] Run seed:
  ```bash
  npx prisma db seed
  ```

### 5. Migrate Existing Files (If Applicable)

- [ ] Run migration script:
  ```bash
  node scripts/migrate-files-to-cloud.mjs --dry-run
  # Review output, then run without --dry-run
  node scripts/migrate-files-to-cloud.mjs
  ```

### 6. Create Admin Account

- [ ] Create first admin user via database or seed script
- [ ] Verify admin can log in
- [ ] Test admin dashboard access

---

## Post-Deployment Verification

### Smoke Tests

- [ ] **Login Flow**
  - [ ] Can access `/login`
  - [ ] Can log in with valid credentials
  - [ ] Invalid credentials are rejected
  - [ ] Rate limiting works (test 10+ failed attempts)

- [ ] **File Uploads**
  - [ ] Can upload files (test with image/PDF)
  - [ ] Files persist after page refresh
  - [ ] Files accessible via URL
  - [ ] Invalid file types are rejected

- [ ] **Email**
  - [ ] Password reset emails send
  - [ ] Notification emails send
  - [ ] Emails arrive in inbox (not spam)

- [ ] **Core Workflows**
  - [ ] Student can enroll in course
  - [ ] Instructor can view their courses
  - [ ] Admin can access admin dashboard
  - [ ] Parent can request student link

### Performance Tests

- [ ] **Page Load Times**
  - [ ] Homepage loads in <3s
  - [ ] Dashboard loads in <3s
  - [ ] All pages have <5s TTFB

- [ ] **Database Queries**
  - [ ] No N+1 queries in logs
  - [ ] Slow query warnings addressed

- [ ] **API Response Times**
  - [ ] Upload API responds in <2s
  - [ ] Auth API responds in <1s

### Security Verification

- [ ] **Authentication**
  - [ ] Cannot access `/admin` without login
  - [ ] Cannot access `/instructor-training` without INSTRUCTOR role
  - [ ] Session expires after 24 hours

- [ ] **Authorization**
  - [ ] Instructors cannot view other instructors' students
  - [ ] Parents cannot access unapproved student data
  - [ ] Students cannot access admin endpoints

- [ ] **Rate Limiting**
  - [ ] Login attempts rate limited
  - [ ] File uploads rate limited
  - [ ] Rate limits reset correctly

### Monitoring Setup

- [ ] **Vercel Dashboard**
  - [ ] Deployment shows as "Ready"
  - [ ] No errors in logs (first 30 minutes)
  - [ ] Analytics tracking pageviews

- [ ] **Sentry** (if configured)
  - [ ] Error tracking active
  - [ ] Source maps uploaded
  - [ ] Test error appears in dashboard

- [ ] **Uptime Monitoring**
  - [ ] Monitor pinging application
  - [ ] Alerts configured
  - [ ] Status page created (if applicable)

---

## First 24 Hours Monitoring

### Hour 1

- [ ] Monitor Vercel logs for errors
- [ ] Check Sentry for exceptions
- [ ] Verify file uploads working
- [ ] Test login as different user types

### Hour 4

- [ ] Review error rate (should be <0.5%)
- [ ] Check p95 response time (<500ms)
- [ ] Verify no memory leaks (stable memory usage)
- [ ] Test rate limiting effectiveness

### Hour 24

- [ ] Review full day of logs
- [ ] Check for security anomalies
- [ ] Verify backup ran successfully
- [ ] Review performance metrics
- [ ] Address any warning-level issues

---

## Rollback Plan

If critical issues arise:

### Immediate Rollback (Vercel)

1. Go to Vercel Dashboard → Project → Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"
4. Takes effect immediately (< 30 seconds)

### Database Rollback

**Warning**: Database migrations are forward-only!

If you must rollback:
1. Restore from backup:
   ```bash
   psql $DIRECT_URL < backup-20260217.sql
   ```
2. May lose data created since backup
3. Consider fixing forward instead

### File Storage Rollback

Files in Vercel Blob persist across deployments - no rollback needed.

---

## Success Criteria

Your deployment is successful when:

- [ ] ✅ Application accessible at production URL
- [ ] ✅ All smoke tests pass
- [ ] ✅ Error rate <0.5% for 24 hours
- [ ] ✅ P95 response time <500ms
- [ ] ✅ No critical security issues
- [ ] ✅ File uploads working
- [ ] ✅ Emails sending
- [ ] ✅ Rate limiting functional
- [ ] ✅ Monitoring and alerts active
- [ ] ✅ Team can log in and perform basic operations
- [ ] ✅ No production incidents in first 48 hours

---

## Post-Launch Tasks

### Week 1

- [ ] Daily log reviews
- [ ] Monitor user feedback
- [ ] Address any bugs reported
- [ ] Review performance metrics
- [ ] Update documentation as needed

### Week 2-4

- [ ] Weekly security audits
- [ ] Performance optimization
- [ ] User training sessions
- [ ] Feature usage analysis

### Ongoing

- [ ] Monthly dependency updates
- [ ] Quarterly security audits
- [ ] Regular backup testing
- [ ] Load testing before major releases

---

## Emergency Contacts

In case of production emergency:

- **On-Call Engineer**: [Contact info]
- **Database Admin**: [Contact info]
- **Vercel Support**: support@vercel.com
- **Supabase Support**: support@supabase.com

---

## Notes

Use this space for deployment-specific notes:

```
Deployment Date: _______
Deployed By: _______
Deployment Time: _______
Issues Encountered: _______
Resolution Steps: _______
```

---

**Remember**: It's better to delay deployment than to rush a broken release. If something doesn't feel right, investigate thoroughly before proceeding.

Good luck with your deployment! 🚀
