# YPP-Portal Security Audit Report

**Date:** 2026-02-05
**Auditor:** Automated Security Review (Claude)
**Scope:** Full codebase — server actions, API routes, auth, middleware, client pages, dependencies
**Codebase:** Next.js 14.2.5 / Prisma 5.18.0 / NextAuth 4.24.7 / PostgreSQL

---

## Executive Summary

**26 vulnerabilities found across 7 categories.**

| Severity | Count |
|----------|-------|
| CRITICAL | 5     |
| HIGH     | 7     |
| MEDIUM   | 8     |
| LOW      | 6     |

The most urgent issues are **unauthenticated API routes leaking user data**, **IDOR (Insecure Direct Object Reference) vulnerabilities across 6+ server actions**, and **8 known CVEs in dependencies including a critical Next.js authorization bypass**.

---

## CRITICAL Findings

### C1. Unauthenticated Calendar API Leaks User Activity
**File:** `app/api/calendar/route.ts:4-33`
**CVSS Estimate:** 7.5 (High)

The `/api/calendar` endpoint accepts an arbitrary `userId` query parameter with **zero authentication**. An attacker can enumerate any user's RSVP'd events by iterating user IDs:

```
GET /api/calendar?userId=<victim-id>
```

This leaks which events each user is attending, their schedule, and meeting URLs (if present). The middleware explicitly excludes `/api` routes from auth checks (`middleware.ts:26`).

**Fix:** Add `getServerSession()` auth check. Restrict `userId` to the caller's own ID or require admin role.

---

### C2. 6 Server Actions Callable Without Authentication
**Files:** `lib/certificate-actions.ts`, `lib/notification-actions.ts`, `lib/goals-actions.ts`, `lib/analytics-actions.ts`

These exported `"use server"` functions are callable from any client with no auth:

| Function | File | Impact |
|----------|------|--------|
| `getUserGoalsWithProgress(userId)` | `goals-actions.ts:330` | Read any user's goals and progress |
| `getMenteeGoalsForFeedback(menteeId)` | `goals-actions.ts:361` | Read any user's goals |
| `getCertificateById(id)` | `certificate-actions.ts:283` | Read any certificate including recipient PII |
| `verifyCertificate(number)` | `certificate-actions.ts:297` | Enumerate certificate holders |
| `renderCertificateHtml(id)` | `certificate-actions.ts:460` | Render any certificate (potential XSS vector) |
| `trackEvent(type, data)` | `analytics-actions.ts:21` | Spam analytics with fake events |
| `trackPageView(path)` | `analytics-actions.ts:36` | Spam analytics |

**Fix:** Add `requireAuth()` to every exported server action. Non-public functions should not be exported.

---

### C3. Exported Server Actions Allow Any User to Issue Certificates
**File:** `lib/certificate-actions.ts:112-258`

Three certificate issuance functions have **no authorization checks**:
- `issueCourseCompletionCertificate(userId, courseId)` — line 112
- `issuePathwayCompletionCertificate(userId, pathwayId)` — line 167
- `issueTrainingCompletionCertificate(userId)` — line 220

Because these are exported `"use server"` functions, any authenticated user can call them to issue certificates to themselves or anyone else. A student could grant themselves a "Training Completion" certificate.

**Fix:** Add `requireAdmin()` checks, or make these private helper functions (not exported).

---

### C4. Exported Server Actions Allow Any User to Send Notifications to Anyone
**File:** `lib/notification-actions.ts:100-149`

Two functions are exported without auth:
- `createNotification(userId, type, title, body, link)` — line 100
- `createBulkNotifications(userIds, type, title, body, link)` — line 126

Any authenticated user can call these to send spoofed notifications to any user, including phishing links via the `link` parameter.

**Fix:** Add `requireAdmin()` or make these internal-only (not exported).

---

### C5. 8 Known CVEs in Dependencies — Including Critical Next.js Auth Bypass
**File:** `package.json`

`npm audit` reports **8 vulnerabilities**:

| Package | Severity | CVE / Advisory | Impact |
|---------|----------|---------------|--------|
| `next@14.2.5` | **CRITICAL** | GHSA-f82v-jwr5-mffw | **Authorization Bypass in Middleware** — attackers can bypass auth middleware entirely |
| `next@14.2.5` | HIGH | GHSA-gp8f-8m3g-qvj9 | Cache Poisoning |
| `next@14.2.5` | HIGH | GHSA-7m27-7ghc-44w9 | DoS via Server Actions |
| `next@14.2.5` | HIGH | GHSA-4342-x723-ch2f | SSRF via Middleware Redirects |
| `next@14.2.5` | MODERATE | GHSA-3h52-269p-cp9r | Dev server info exposure |
| `next@14.2.5` | MODERATE | Multiple | Image optimizer DoS, content injection, race conditions |
| `cookie@<0.7.0` | LOW | GHSA-pxg6-pf52-xh8x | Out-of-bounds characters |
| `esbuild@<=0.24.2` | MODERATE | GHSA-67mh-4wv8-2f99 | Dev server request interception |

**The critical Next.js middleware auth bypass (GHSA-f82v-jwr5-mffw) means your entire middleware-based auth can be bypassed with a crafted request.**

**Fix:** `npm audit fix --force` or pin `next@14.2.35+`, `next-auth@4.24.13+`.

---

## HIGH Findings

### H1. Stored XSS via Certificate HTML Rendering
**File:** `lib/certificate-actions.ts:460-492`

`renderCertificateHtml` replaces template placeholders with **unescaped** user data:

```typescript
html = html
  .replace(/{{recipientName}}/g, certificate.recipient.name)  // XSS
  .replace(/{{title}}/g, certificate.title)                    // XSS
  .replace(/{{description}}/g, certificate.description || "")  // XSS
```

If a user sets their name to `<img src=x onerror=alert(document.cookie)>`, it renders directly into HTML. Combined with C2 (no auth on `renderCertificateHtml`), this is exploitable by any visitor.

**Fix:** HTML-escape all interpolated values before replacement.

---

### H2. IDOR — Any User Can View Any Student's Attendance
**File:** `lib/attendance-actions.ts`

Three functions have insufficient authorization:

| Function | Line | Issue |
|----------|------|-------|
| `getSessionWithRecords(sessionId)` | 169 | Any authed user → any session's records (names, emails, status) |
| `getStudentAttendanceSummary(userId)` | 315 | Any authed user → any student's attendance summary |
| `getCourseAttendanceReport(courseId)` | 357 | Any authed user → full course roster with emails |

**Fix:** Verify caller is the student themselves, their instructor, chapter lead, or admin.

---

### H3. IDOR — Messaging Bypass
**File:** `lib/messaging-actions.ts:247-323`

`startConversation` accepts any `recipientId` and only validates the recipient isn't the sender. The `getMessageableUsers` function enforces role-based restrictions on the **UI only** — the actual server action doesn't enforce them.

A student can message any user (other students, admin staff, parents) by directly calling:
```typescript
startConversation({ recipientId: "<admin-id>", message: "..." })
```

**Fix:** Validate `recipientId` against the caller's messageable users list inside `startConversation`.

---

### H4. Parent Portal — Unauthorized Student Linking
**File:** `lib/parent-actions.ts:228-271`

`linkStudent` allows any user with the PARENT role to link to **any student by email** with no verification. There is no approval flow — the parent immediately gains access to the student's:
- Enrollment records
- Attendance history
- Goal progress
- Certificate list
- Training status

An attacker with a PARENT account can surveil any student.

**Fix:** Require student or admin approval before the link is active. Or use an invite-code system.

---

### H5. JWT Role Cache — Stale Privileges
**File:** `lib/auth.ts:51-67`

Roles are embedded in the JWT at login and **never refreshed from the database**:

```typescript
async jwt({ token, user }) {
  if (user) {
    token.roles = (user as any).roles;  // Only set on initial login
  }
  return token;
}
```

If an admin revokes a user's ADMIN role, the user retains admin access until their JWT expires. NextAuth's default JWT expiration is 30 days.

**Fix:** Re-query roles from the database periodically in the JWT callback (e.g., every 5 minutes using a timestamp check), or reduce JWT maxAge significantly.

---

### H6. No Rate Limiting
**Files:** All API routes and server actions

There is no rate limiting anywhere in the application:
- **Login:** Unlimited brute-force attempts on `/api/auth/callback/credentials`
- **Signup:** Unlimited account creation (bot spam)
- **Server Actions:** Unlimited calls (DoS potential)

**Fix:** Add rate limiting middleware (e.g., `@upstash/ratelimit`, `express-rate-limit`, or Vercel's built-in edge rate limiting).

---

### H7. Unauthenticated Chapter List API
**File:** `app/api/chapters/route.ts:1-12`

`/api/chapters` returns all chapter IDs and names without authentication. While used by the signup page, it exposes organizational structure to unauthenticated users.

**Fix:** Acceptable risk if chapter names are public. If not, consider embedding chapter data in the signup page server-side.

---

## MEDIUM Findings

### M1. Weak Password Policy
**File:** `lib/auth.ts:9` and `lib/signup-actions.ts:28`

Password minimum is **6 characters** with no complexity requirements. A 6-character lowercase password can be cracked in seconds.

**Fix:** Require 8+ characters minimum. Consider requiring mixed case + numbers, or use zxcvbn scoring.

---

### M2. User Enumeration on Signup
**File:** `lib/signup-actions.ts:34`

```typescript
if (existing) {
  return { status: "error", message: "An account with this email already exists." };
}
```

This confirms whether an email is registered. Attackers can enumerate valid emails.

**Fix:** Return a generic message like "If this email is not already registered, your account has been created."

---

### M3. Missing Security Headers
**File:** `next.config.mjs`

No security headers are configured:
- No `Content-Security-Policy` → XSS amplification
- No `Strict-Transport-Security` → downgrade attacks
- No `X-Frame-Options` → clickjacking
- No `X-Content-Type-Options` → MIME sniffing
- No `Referrer-Policy` → referrer leakage

**Fix:** Add headers in `next.config.mjs`:
```javascript
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    ],
  }]
}
```

---

### M4. Hardcoded Demo Credentials in Source
**Files:** `prisma/seed.ts:7`, `README.md`

Password `ypp-demo-2026` is hardcoded and documented. If the database is seeded in production with these credentials, all 4 demo accounts (including admin) are compromised.

**Fix:** Use environment variable for seed password. Remove credentials from README.

---

### M5. Enum Casting Without Validation
**Files:** Multiple server actions

Several server actions cast string values to Prisma enums without validating:
```typescript
const type = getString(formData, "type") as MentorshipType;      // No validation
const format = getString(formData, "format") as CourseFormat;     // No validation
const primaryRole = getString(formData, "primaryRole") as RoleType; // No validation
```

While Prisma will reject invalid enum values at the database level (preventing injection), the errors are unhelpful. In some ORMs this could be exploitable.

**Fix:** Validate against `Object.values(EnumType)` before use, as done in `attendance-actions.ts:214`.

---

### M6. `deleteChapter` Non-Atomic Cascade
**File:** `lib/chapter-actions.ts:645-671`

The cascade deletion runs multiple separate queries without a transaction:
```typescript
await prisma.announcement.deleteMany({ where: { chapterId: id } });
await prisma.position.deleteMany({ where: { chapterId: id } });
// ... 6 more deletes
await prisma.chapter.delete({ where: { id } });
```

If any delete fails mid-way, the chapter is left in a partially deleted state.

**Fix:** Wrap in `prisma.$transaction([...])`.

---

### M7. Admin Can Elevate to GLOBAL_ADMIN via Application Pipeline
**File:** `lib/application-actions.ts:277-283`

```typescript
const roleMap: Record<PositionType, RoleType> = {
  GLOBAL_ADMIN: "ADMIN",
  // ...
};
```

If a `GLOBAL_ADMIN` position is created and an application is accepted, the applicant automatically gets ADMIN role. Any current admin can weaponize this to give admin access to arbitrary users without audit trail beyond the decision record.

**Fix:** Require multi-admin approval for ADMIN role grants. Add audit logging.

---

### M8. Video Player — Unchecked Embed URLs
**File:** `components/video-player.tsx:37-57`

The fallback case in `getEmbedUrl()` returns the raw `videoUrl` directly into an `<iframe src>`:
```typescript
default:
  return videoUrl;  // Arbitrary URL injected into iframe
```

If an admin sets a malicious URL as a video URL (or the database is compromised), this renders an arbitrary page in an iframe. For `CUSTOM` provider, the URL goes directly into `<video src>`.

**Fix:** Validate URLs against an allowlist of domains (youtube.com, vimeo.com, loom.com). Reject unknown providers.

---

## LOW Findings

### L1. No Audit Logging
No actions (user creation, role changes, deletions, certificate issuance) are logged beyond what the database timestamps provide. If an account is compromised, there's no way to trace what happened.

### L2. Phone Numbers Stored Without Normalization
Phone numbers are stored as raw strings with no validation. Inconsistent formatting makes searches unreliable and could cause issues with future SMS integrations.

### L3. `console.error` in API Route
`app/api/calendar/route.ts:27` logs errors to console which may leak stack traces in production server logs.

### L4. `VideoCard` Sends Progress to Non-Existent Endpoint
`components/video-player.tsx:263` sends a POST to `/api/video-progress` which doesn't exist as an API route. Progress saving from the client component silently fails.

### L5. Missing `SameSite` Cookie Configuration
NextAuth cookies don't explicitly set `SameSite=Strict`. The default `Lax` is reasonable but `Strict` would be more secure for a portal handling minors' data.

### L6. Docker Compose Default Credentials
`docker-compose.yml` uses `ypp`/`ypp` as PostgreSQL credentials. If Docker is exposed on a network, the database is accessible with default credentials.

---

## Priority Fix Order

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 | **C5** — Update Next.js (critical CVE) | Low |
| 2 | **C1** — Auth on `/api/calendar` | Low |
| 3 | **C2** — Auth on 7 server actions | Low |
| 4 | **C3** — Auth on certificate issuance | Low |
| 5 | **C4** — Auth on notification creation | Low |
| 6 | **H1** — HTML-escape certificate rendering | Low |
| 7 | **H2** — IDOR in attendance actions | Medium |
| 8 | **H3** — Validate messaging recipients | Medium |
| 9 | **H4** — Parent-student link approval | Medium |
| 10 | **H5** — JWT role refresh | Medium |
| 11 | **H6** — Rate limiting | Medium |
| 12 | **M3** — Security headers | Low |
| 13 | **M1** — Stronger password policy | Low |
| 14 | **M2** — Generic signup error | Low |
| 15 | All remaining Medium/Low items | Varies |

---

## What's Done Right

- Password hashing with bcrypt (10 rounds) -- solid
- Prisma ORM prevents SQL injection (the one raw query uses parameterized `$queryRaw`)
- Server-side session checks on most admin actions
- No secrets committed to git (`.env` properly gitignored)
- Zod validation on login credentials
- Owner checks on notifications (mark read / delete)
- Conversation participation checks on message read/send
- Mentorship ownership verification on check-ins
- Parent ownership verification on unlink
- React's built-in XSS protection for JSX rendering
- CSRF protection on server actions via NextAuth (for POST actions)

---

*End of report. All findings are based on static code analysis of the repository at commit `542d013`.*
