# V1 security checklist

Track external findings (e.g. “26 issues”) in your issue tracker. Use this for release sign-off.

## Baseline in this repo

- **CSP**: nonce-based `Content-Security-Policy` on app routes via [`middleware.ts`](../middleware.ts); violations may POST to `/api/csp-report`.
- **Transport / sniffing**: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` on the same responses.
- **Auth on pages**: middleware redirects unauthenticated users away from non-public routes.

## Verify for v1

- [ ] All **state-changing API routes** require session + role checks; reject cross-tenant/chapter IDOR (see [`SECURITY_AUDIT.md`](../SECURITY_AUDIT.md) / internal list).
- [ ] **Zod** (or equivalent) on body/query for public-facing APIs.
- [ ] **Audit log** for sensitive actions (admin/chair/recruiting) per product spec.
- [ ] No secrets in client bundles; production env only on Vercel.

## Regression

When fixing a class of bug (e.g. missing `getServerSession` on a route), add a short test or script note so it is not reintroduced.
