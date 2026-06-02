# QA Instructor Onboarding Flow

Use this flow when an internal teammate needs to experience the portal like a brand-new instructor.

## Setup

1. In the staging or local environment, set:
   - `ENABLE_QA_INSTRUCTOR_ONBOARDING=true`
   - `SEED_PASSWORD=<shared internal seed password>`
2. Run:
   - `npm run db:seed`
3. The seed creates and resets this account:
   - Email: `qa.instructor.onboarding@youthpassionproject.org`
   - Password: the shared `SEED_PASSWORD`

Do not enable this flow in production unless leadership explicitly wants the QA fixture available there.

## What Gets Seeded

The reset creates a realistic first-time instructor state:

- Instructor role account
- Incomplete onboarding state
- Incomplete profile state
- Assigned Creative Coding course
- Published class offering
- Draft class offering
- Upcoming sessions
- Two demo enrolled students
- One submitted student assignment waiting for feedback
- Training assignments reset to not started
- Readiness interview reset to required
- A profile-completion action item for environments with Action Tracker enabled

## Test As A Brand-New Instructor

1. Go to `/login`.
2. Sign in with the QA instructor email and shared seed password.
3. You should land on `/onboarding`.
4. Walk through onboarding.
5. After onboarding, go to `/`.
6. Confirm the dashboard shows:
   - Active class count
   - Student enrollment count
   - Upcoming sessions
   - Readiness/training action items
   - Assigned class rows
7. Go to `/instructor-onboarding`.
8. Confirm the instructor onboarding guide still opens.

## Reset And Retest

1. While signed in as the QA instructor, go to `/qa/instructor-onboarding`.
2. Click **Reset and start onboarding**.
3. You should be sent back to `/onboarding`.
4. Repeat the test flow.

Admins can also visit `/qa/instructor-onboarding` and reset the fixture.

## Guardrails

- The fixture is skipped unless `ENABLE_QA_INSTRUCTOR_ONBOARDING=true`.
- The reset page only works for:
  - the QA instructor account, or
  - an admin account.
- The fixture uses fixed QA/demo emails and deterministic IDs.
- Real users are not selected or reset.
- The public portal gate allows only the QA reset route, not broad QA access.
