# V1 manual QA script (high level)

Run with seeded users (see `prisma/seed.ts`) and at least two chapters where applicable.

1. **Auth** — Sign up, verify email (if enforced), login, wrong password → lockout/rate limit, forgot password → reset token expiry, logout.
2. **Dashboard** — Admin, Instructor, Student, Mentor, Chapter President: KPIs load; next actions plausible.
3. **Training** — Three required modules progress; Lesson Design Studio capstone: draft → submit → readiness unblocks when draft `SUBMITTED`/`APPROVED`; interview gate still enforced when enabled.
4. **Classes** — Browse, enroll, attendance recap, assignment submit, grade visible.
5. **Mentorship** — Pairing, goal update, monthly review / chair path smoke test.
6. **Recruiting** — Apply, pipeline transition, interview slot, decision blocker paths per [portal-reliability-matrix.md](portal-reliability-matrix.md).
7. **Chapter** — Members, join request, announcement, calendar RSVP.
8. **Parent** — Link request, read-only student views; no instructor messaging.
9. **Analytics** — Admin metrics match rough counts in DB for sample chapter/date window.
10. **Edge cases** — Use [v1-test-tracker-template.md](v1-test-tracker-template.md) edge-case tab.

Record results in the Google Sheet derived from the tracker template.
