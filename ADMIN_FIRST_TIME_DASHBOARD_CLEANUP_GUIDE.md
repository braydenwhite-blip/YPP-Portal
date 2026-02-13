Title: First-Time Admin Guide - Dashboard Cleanup Project

Audience:
- YPP admins and team leads reviewing dashboard cleanup work for the first time.

Goal:
- Make the dashboard cleaner and easier.
- Keep all current functionality exactly the same.

Plain-language summary:
- We are not rebuilding the portal.
- We are reorganizing and simplifying what users already have.
- If a feature exists today, it must still exist after cleanup.

Step 1: Before you start

1. Pick one person as project owner.
2. Pick one person as tester.
3. Confirm the project path:
   - `/Users/braydenwhite/Documents/New project`
4. Confirm the Claude prompt file exists:
   - `/Users/braydenwhite/Documents/New project/CLAUDE_DASHBOARD_CLEANUP_PROMPT.md`
5. Decide your review window (for example: 2 days for audit, 3 days for implementation review).

Step 2: Team alignment (very important)

1. Agree on the rule: "Cleaner UI, same functionality."
2. Agree on what cannot change:
   - Login/signup behavior
   - Role permissions
   - Existing page routes/URLs
   - Enrollment, classes, admin operations
3. Agree that no feature can be removed without explicit team approval.

Step 3: Ask Claude for phase-based work

1. First request only audit and plan (no coding yet).
2. Review the plan with your team.
3. Approve only if all features are still represented.
4. Then request implementation in small phases, not one giant rewrite.

Step 4: Admin review checklist after each phase

1. Can admins still do core tasks?
   - Manage users
   - Approve enrollments
   - Manage training modules
   - Access reports and admin tools
2. Can instructors still do core tasks?
   - Build curriculum
   - Create class offerings
   - Manage class settings
3. Can students still do core tasks?
   - Sign up/login
   - Browse classes
   - Enroll/waitlist
   - View schedule
4. Do all critical pages still load from existing URLs?
5. Is navigation easier to understand than before?

Step 5: What counts as a successful result

1. Fewer confusing menu sections.
2. Clearer page hierarchy and labels.
3. Faster path to common admin actions.
4. No missing features.
5. No broken routes.
6. No role-based access regressions.

Step 6: Red flags (stop and review immediately)

1. A feature is removed or hidden with no replacement.
2. A route no longer works.
3. Role access changes unexpectedly.
4. User flows require more clicks than before for key actions.
5. Important admin actions are harder to find.

Step 7: Final sign-off process

1. Run final team walkthrough (admin, instructor, student views).
2. Validate top 10 high-frequency tasks.
3. Capture screenshots before and after for team records.
4. Approve only after all critical checks pass.
5. Publish release notes to your team:
   - What changed visually
   - What stayed the same functionally
   - Known follow-up items

Quick note for the team:
- This is a UX cleanup project, not a functionality project.
- If you ever must choose between "looks cleaner" and "keeps behavior stable," always keep behavior stable.
