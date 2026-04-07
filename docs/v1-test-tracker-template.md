# V1 master test tracker (Google Sheets template)

Copy these tabs into a spreadsheet for QA. Link rows to [`portal-reliability-matrix.md`](portal-reliability-matrix.md) and [`FEATURE_REFERENCE_TECHNICAL.md`](FEATURE_REFERENCE_TECHNICAL.md).

## Tab: Runs

| Run ID | Date | Branch / commit | Tester | Notes |
|--------|------|-----------------|--------|-------|

## Tab: Cases

| § | Flow | Step | Role(s) | Data setup (seed / chapter) | Expected | Actual | Evidence URL | Bug ID | Blocker? | Matrix ref | Notes |
|---|------|------|---------|----------------------------|----------|--------|--------------|--------|----------|------------|-------|

Short checklist rows (minimum):

1. Login (email/password, lockout, reset, verify)
2. Dashboard (per role)
3. Onboarding
4. Course enroll / browse
5. Pathway unlock
6. Mentorship + goals + chair review
7. Event RSVP (chapter calendar)
8. Upload (training evidence / assignments as applicable)
9. Announcements (global + chapter, dismiss)

## Tab: Role × route

For each **sidebar href** from [`lib/navigation/catalog.ts`](../lib/navigation/catalog.ts): Student / Instructor / Mentor / Admin / Chapter President → **allow** | **deny** | **conditional** (+ note). Sync with feature flags from app layout.

## Tab: Edge cases

| Case | Steps | Expected |
|------|-------|----------|
| Multi-role user | | |
| Instructor publish without approval | | |
| Incomplete training / no LDS submit | | |
| Rejected application | | |
| Paused mentorship | | |
| Full course → waitlist | | |
| User missing chapter | | |
| Feature gates on / off | | |
| Duplicate submissions | | |
| Parent link pending | | |

## Tab: UX friction (post-pass)

| Screen | Role | What confused users | Severity | Suggested fix |

See [`v1-ux-friction-log.md`](v1-ux-friction-log.md).
