# YPP Pathways Portal — Complete Feature Reference

> **Intended audience:** Tech team reviewers, QA testers, product reviewers.
> **Last updated:** 2026-03-16
> **Branch:** `claude/document-features-testing-et3iJ`

This document lists every feature in the portal — what it does, how it works technically, and exactly how to test it.

---

## Table of Contents

1. [Authentication & Security](#1-authentication--security)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Unified Dashboard (Home Page)](#3-unified-dashboard-home-page)
4. [Onboarding](#4-onboarding)
5. [Instructor Training Academy](#5-instructor-training-academy)
6. [Goals & Progress Tracking](#6-goals--progress-tracking)
7. [Mentorship System](#7-mentorship-system)
8. [Mentorship Program & Awards](#8-mentorship-program--awards)
9. [Courses & Curriculum](#9-courses--curriculum)
10. [Pathways](#10-pathways)
11. [Job Applications & Hiring](#11-job-applications--hiring)
12. [Chapter Management](#12-chapter-management)
13. [Incubator (Project-Based Learning)](#13-incubator-project-based-learning)
14. [Activity Hub & Challenges](#14-activity-hub--challenges)
15. [Reflection System](#15-reflection-system)
16. [Events & Calendar](#16-events--calendar)
17. [Community & Messaging](#17-community--messaging)
18. [Parent Portal](#18-parent-portal)
19. [Awards & Achievements](#19-awards--achievements)
20. [Showcase & Portfolio](#20-showcase--portfolio)
21. [Admin Tools](#21-admin-tools)
22. [Passion World (3D Gamification)](#22-passion-world-3d-gamification)
23. [Notifications & Announcements](#23-notifications--announcements)
24. [Feature Gates](#24-feature-gates)
25. [File Uploads & Storage](#25-file-uploads--storage)
26. [Analytics & Reporting](#26-analytics--reporting)

---

## Test Accounts (Seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin + Instructor | `brayden.white@youthpassionproject.org` | `$SEED_PASSWORD` |
| Mentor + Staff | `carlygelles@gmail.com` | `$SEED_PASSWORD` |
| Instructor | `avery.lin@youthpassionproject.org` | `$SEED_PASSWORD` |
| Student | `jordan.patel@youthpassionproject.org` | `$SEED_PASSWORD` |

> `$SEED_PASSWORD` is set in your `.env` file. All accounts belong to either "The Frisch School" or "Boston" chapter.

---

## 1. Authentication & Security

### 1.1 Email/Password Login

**What it does:** Standard credential-based login with email and password.

**How it works:**
- Handled by NextAuth.js `CredentialsProvider` in `lib/auth.ts`
- Passwords are hashed with `bcryptjs`
- Email must be verified before login is allowed
- Returns JWT session with user ID, roles, and primary role

**How to test:**
1. Go to `/login`
2. Enter valid credentials → should redirect to `/` (dashboard)
3. Enter wrong password 5 times → account should lock for 30 minutes
4. Attempt login with unverified email → should show "verify your email" error
5. Attempt 10+ logins from same IP/email in 15 minutes → should receive rate limit error

---

### 1.2 Google OAuth Login

**What it does:** "Sign in with Google" button as an alternative to password.

**How it works:**
- Uses NextAuth.js `GoogleProvider`
- Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars
- Creates or links user account via `OAuthAccount` model
- If no matching email exists, creates new account

**How to test:**
1. Go to `/login`
2. Click "Sign in with Google"
3. Complete Google consent screen
4. Should be redirected to `/` on success
5. Verify `OAuthAccount` record created in database

---

### 1.3 Magic Link Authentication

**What it does:** Passwordless email sign-in — user receives a one-time login link.

**How it works:**
- User submits email at `/magic-link`
- System generates a signed token stored in `PasswordResetToken` table
- Email is sent with a link containing the token
- Clicking the link logs the user in without a password

**How to test:**
1. Go to `/magic-link`
2. Submit a valid email
3. Check email for login link
4. Click the link → should be logged in
5. Click the link again → should fail (token consumed)

---

### 1.4 Two-Factor Authentication (2FA)

**What it does:** TOTP-based second factor using an authenticator app.

**How it works:**
- Enabled from `/settings/security`
- Uses TOTP standard (Google Authenticator, Authy compatible)
- Secret encrypted with `TWO_FACTOR_ENCRYPTION_KEY`
- Recovery codes generated and stored in `TwoFactorRecovery` table
- After correct password, user is challenged for TOTP code

**How to test:**
1. Log in as any user
2. Go to `/settings/security` → Enable 2FA
3. Scan QR code with authenticator app
4. Enter TOTP code to confirm setup
5. Log out, log back in → should see 2FA challenge screen
6. Enter correct TOTP → logged in
7. Use a recovery code instead → should also work

---

### 1.5 Email Verification

**What it does:** Prevents login until user confirms their email address.

**How it works:**
- On signup, a token is saved to `EmailVerificationToken`
- Verification email sent with a link to `/verify-email?token=...`
- Clicking verifies the email and marks `User.emailVerified`
- Login is blocked until `emailVerified` is set

**How to test:**
1. Sign up with a new email at `/signup`
2. Attempt login immediately → should be blocked
3. Check email for verification link
4. Click link → email verified
5. Log in again → succeeds

---

### 1.6 Password Reset

**What it does:** Sends a time-limited reset link via email.

**How it works:**
- `/forgot-password` form submits email
- Token stored in `PasswordResetToken`, expires in 1 hour
- Link sent to email: `/reset-password?token=...`
- User sets new password, old token invalidated

**How to test:**
1. Go to `/forgot-password`, enter registered email
2. Check email for reset link
3. Click link → `/reset-password` form
4. Set new password, confirm
5. Log in with new password → success
6. Try the same reset link again → should fail (expired/used)

---

### 1.7 Rate Limiting & Account Lockout

**What it does:** Prevents brute-force attacks.

**How it works:**
- `lib/rate-limit.ts` / `lib/rate-limit-redis.ts` (Redis when available)
- 10 login attempts per email/IP per 15-minute window → HTTP 429
- 5 wrong passwords → account locked for 30 minutes
- Lockout stored on `User` model

**How to test:**
1. Attempt login with wrong password 5 times → account lock message
2. Wait 30 minutes or manually reset in DB → login works again
3. Make 10+ requests in 15 minutes from same IP → rate limit response

---

## 2. User Roles & Permissions

**What it does:** Controls what each user can see and do.

**Roles available:**

| Role | Description |
|------|-------------|
| `ADMIN` | Full system access |
| `INSTRUCTOR` | Teach classes, manage curriculum |
| `STUDENT` | Enroll in courses, track progress |
| `MENTOR` | Mentor students and instructors |
| `CHAPTER_PRESIDENT` | Oversee a chapter |
| `STAFF` | Internal YPP staff operations |
| `PARENT` | View child's progress |
| `APPLICANT` | Job applicant (pre-hire) |

**How it works:**
- Users can have multiple roles via `UserRole` join table
- `primaryRole` determines dashboard layout
- Route middleware (`middleware.ts`) enforces auth for protected pages
- Server actions call `requireAdmin()`, `requireAnyRole()`, etc.
- Navigation is filtered by role via `lib/navigation/resolve-nav.ts`

**How to test:**
1. Log in as each seeded test user and observe the different dashboard layouts
2. Try accessing `/admin` as a student → should be denied/redirected
3. Try accessing `/instructor-training` as a student → should be denied
4. Confirm each role sees only their relevant nav items

---

## 3. Unified Dashboard (Home Page)

**What it does:** A single command center tailored to the user's primary role, surfacing the most important tasks, metrics, and tools.

**How it works:**
- Route: `/` → `app/(app)/page.tsx`
- `lib/dashboard/data.ts` generates role-specific data server-side
- `lib/dashboard/resolve-dashboard.ts` formats it for display
- Feature flag: `ENABLE_UNIFIED_ALL_TOOLS_DASHBOARD` (env var) — falls back to legacy if false

**Dashboard sections:**

| Section | What it shows |
|---------|---------------|
| Role Hero | Welcome card with focus areas for the user's role |
| Daily Checklist | Today's tasks: check-in, recap, feedback, etc. |
| Queue Board | Prioritized work queues relevant to the role |
| Next Actions | Top 3 most urgent items to complete now |
| KPI Strip | Key metrics (enrolled students, completion %, etc.) |
| Tool Explorer | Searchable list of all tools available for the role |
| Pathway Widget | Active learning pathways with progress |
| Nudge Strip | Contextual prompts and helpful suggestions |
| Journey Roadmap | Milestone timeline showing overall progress |
| Instructor Readiness Widget | Training completion and interview status (instructors) |
| Launch Banners | Feature rollout announcements |

**How to test:**
1. Log in as Admin → verify admin-specific KPIs and queues appear
2. Log in as Instructor → verify training widget, course queues visible
3. Log in as Student → verify pathway widget, daily checklist visible
4. Log in as Mentor → verify mentee list and feedback queues visible
5. Complete a checklist item → verify it disappears or is checked off
6. Use the search in Tool Explorer (Cmd/Ctrl+K) → verify tools filter

---

## 4. Onboarding

**What it does:** Guides new users through account setup on first login.

**How it works:**
- Route: `/onboarding`
- Multi-step wizard in `components/onboarding/onboarding-wizard.tsx`
- Different steps per role: `student-steps.tsx`, `instructor-steps.tsx`
- `lib/onboarding-actions.ts` saves progress
- `POST /api/onboarding/complete` marks onboarding done on user record
- Redirect to `/onboarding` enforced in middleware for users with `onboardingComplete: false`

**How to test:**
1. Create a new user account
2. Log in → should automatically redirect to `/onboarding`
3. Complete each step
4. Final step → redirects to dashboard
5. Log out and back in → onboarding not shown again
6. Test both student and instructor onboarding flows with respective accounts

---

## 5. Instructor Training Academy

**What it does:** A structured training program that instructors must complete before they are approved to teach.

**How it works:**
- Route: `/instructor-training`
- Content defined in `data/training-academy/content.v1.json`, imported to database
- `TrainingModule` → `TrainingCheckpoint` → Completion tracked per user
- Four checkpoint types: `video`, `checkpoint`, `quiz`, `evidence`
- `lib/instructor-readiness.ts` computes readiness for training + interview completion
- `ClassOfferingApproval` tracks per-offering publish approval requests and reviewer decisions
- `InstructorInterviewGate` enforces interview before first class offering

**Training checkpoint types:**

| Type | Description |
|------|-------------|
| Video | Must watch a video (progress tracked via `VideoProgress`) |
| Checkpoint | Read/acknowledge a milestone |
| Quiz | Pass a quiz above a minimum score threshold |
| Evidence | Upload a file or photo as proof of completion |

**Interview gate:**
1. Instructor completes required modules
2. Instructor requests interview slots from admin (`InstructorInterviewSlot`)
3. Admin reviews availability, schedules interview
4. After passing interview, `InstructorInterviewGate.passed = true`
5. Instructor can now offer their first class

**How to test:**
1. Log in as Instructor (`avery.lin@...`)
2. Go to `/instructor-training`
3. Open a training module → complete each checkpoint type
4. Complete a quiz → verify pass/fail score handling
5. Upload evidence → verify file saved and checkpoint marked done
6. Complete all required modules → verify readiness % updates
7. Request an interview slot
8. Log in as Admin, approve the interview
9. Mark interview as passed → instructor can now create a class offering
10. Verify a `ClassOfferingApproval` record exists before the offering is published

---

## 6. Goals & Progress Tracking

**What it does:** Allows admins/mentors to assign role-specific goals to users and track progress with 4-level feedback.

**How it works:**
- `GoalTemplate` model: admin-created reusable goal templates by role
- `Goal` model: assigned instance of a template for a specific user
- `ProgressUpdate` model: mentor submits a progress rating
- Progress levels: `BEHIND_SCHEDULE`, `GETTING_STARTED`, `ON_TRACK`, `ABOVE_AND_BEYOND`
- Displayed as a color-coded progress bar (red → yellow → green → blue)

**Routes:**
- `/goals` — user views assigned goals
- `/goals/custom` — user views custom goals
- `/goals/custom/new` — create a custom goal
- `/mentorship/feedback/[menteeId]` — mentor submits goal progress

**How to test:**
1. Log in as Admin → go to `/admin/goals`
2. Create a new goal template for the `INSTRUCTOR` role
3. Assign the goal to `avery.lin@...`
4. Log in as Avery → go to `/goals` → verify goal appears
5. Log in as Mentor (`carlygelles@...`)
6. Go to `/mentorship/mentees` → select Avery
7. Submit a progress update → select "On Track"
8. Log back in as Avery → verify progress bar shows green

---

## 7. Mentorship System

**What it does:** Pairs mentors with students and instructors for guidance, feedback, and check-ins.

**How it works:**
- `Mentorship` model: pairing between mentor and mentee
- `MentorshipType`: `INSTRUCTOR` or `STUDENT`
- `MentorshipStatus`: `ACTIVE`, `PAUSED`, `COMPLETE`
- `MentorshipCheckIn`: tracks periodic check-in meetings
- AI-assisted matching: `lib/mentor-match-actions.ts`
- `lib/mentorship-actions.ts` handles all create/update operations

**Mentor routes:**
- `/mentorship` — hub overview
- `/mentorship/mentees` — list of mentees
- `/mentorship/mentees/[id]` — individual mentee with goals, progress, check-ins
- `/mentorship/feedback/[menteeId]` — submit feedback
- `/mentorship/reviews` — review submissions

**Mentee routes:**
- `/my-mentor` — view mentor contact info
- `/mentor/ask` — ask mentor a question
- `/mentor/feedback` — request feedback

**Admin routes:**
- `/admin/mentor-match` — AI-powered matching dashboard

**How to test:**
1. Log in as Admin → go to `/admin/mentor-match`
2. Create a mentorship pairing (mentor: Carly, mentee: Jordan)
3. Log in as Jordan (student) → go to `/my-mentor` → verify Carly's info shown
4. Go to `/mentor/ask` → ask a question
5. Log in as Carly (mentor) → go to `/mentorship/mentees` → verify Jordan listed
6. Open Jordan's profile → view goals, progress
7. Submit a progress update and check-in note
8. Log back in as Jordan → verify progress bar updated
9. Pause the mentorship in DB → verify status reflects as paused

---

## 8. Mentorship Program & Awards

**What it does:** Formal award program recognizing outstanding mentors with Bronze, Silver, Gold, and Lifetime tiers.

**How it works:**
- `MentorshipReviewStatus`: `DRAFT` → `PENDING_CHAIR_APPROVAL` → `APPROVED`/`RETURNED`
- `MentorCommitteeMemberRole`: `CHAIR`, `MEMBER`, `MANAGER`
- Awards trigger benefit unlocks (e.g., Bronze → alumni access, Silver → college advisor)
- Review workflow: mentor submits → committee reviews → chair approves

**Routes:**
- `/mentorship-program` — overview
- `/mentorship-program/awards` — award recipients
- `/mentorship-program/reviews` — pending reviews
- `/mentorship-program/chair` — chair dashboard
- `/mentorship-program/chair/[reviewId]` — review detail for chair

**How to test:**
1. Log in as Mentor → go to `/mentorship-program`
2. Initiate a review for Bronze tier
3. Submit the review → status changes to `PENDING_CHAIR_APPROVAL`
4. Log in as Admin (with Chair role) → go to `/mentorship-program/chair`
5. Approve the review
6. Verify `Award` record created for mentor at Bronze level
7. Verify mentor now has access to alumni features at `/alumni`

---

## 9. Courses & Curriculum

**What it does:** A full course catalog where instructors create classes and students enroll.

**Course formats:**

| Format | Description |
|--------|-------------|
| `ONE_OFF` | Single standalone class |
| `LEVELED` | Multi-step progression series with plain-language learner fit |
| `LAB` | Project-based hands-on session |
| `COMMONS` | Mentored open practice |
| `COMPETITION_PREP` | Timed competition preparation |
| `EVENT` | Special event course |

**How it works:**
- `Course` model with format, level, instructor, chapter, enrollment list
- `Enrollment` model: student ↔ course join
- `lib/enrollment-actions.ts`: enroll, drop, waitlist
- `lib/class-management-actions.ts`: create, edit, duplicate, schedule
- Waitlist: `lib/waitlist-actions.ts` — if course full, student goes on waitlist
- Co-instructors: `app/api/courses/add-co-instructor`
- Curriculum review workflow: instructors submit curriculum for admin approval
- Duplicate course: `POST /api/course/duplicate`

**Routes:**
- `/curriculum` — full course catalog
- `/curriculum/[id]` — course detail
- `/curriculum/schedule` — class schedule calendar
- `/my-courses` — student's enrolled courses
- `/my-courses/[id]` — course progress (student view)
- `/my-courses/[id]/feedback` — post-class feedback
- `/instructor/workspace` — instructor teaching dashboard
- `/instructor/class-settings` — manage class details
- `/instructor/curriculum-builder` — build a new curriculum
- `/instructor/duplicate-course/[courseId]` — clone an existing course

**How to test:**
1. Log in as Instructor (Avery) → go to `/instructor/curriculum-builder`
2. Create a new beginner-friendly course
3. Submit curriculum for review
4. Log in as Admin → go to `/admin/curricula` → approve it
5. Log in as Student (Jordan) → go to `/curriculum` → find the course
6. Enroll in the course
7. Verify enrollment appears in `/my-courses`
8. Fill the course to capacity → enroll another user → verify waitlist
9. Process waitlist from `/admin/waitlist`
10. Instructor adds a co-instructor → verify both see the course in their workspace
11. Instructor duplicates the course → verify copy created

---

## 10. Pathways

**What it does:** Structured multi-course learning sequences that unlock progressively.

**How it works:**
- `Pathway` model: a named sequence with ordered steps
- `PathwayStep` model: individual course/activity within the pathway, with unlock conditions
- Steps unlock automatically when prerequisites are completed
- Completion certificate generated at `/pathways/[id]/certificate`
- `lib/chapter-pathway-actions.ts` handles chapter-specific pathways

**Routes:**
- `/pathways` — browse all pathways
- `/pathways/[id]` — visual progress map
- `/pathways/[id]/certificate` — completion certificate
- `/pathways/[id]/events` — pathway-related events
- `/pathways/[id]/journal` — reflection journal for pathway
- `/pathways/[id]/leaderboard` — pathway leaderboard
- `/pathways/[id]/mentors` — assigned mentors
- `/pathways/progress` — overall progress across all pathways
- `/admin/pathways` — admin pathway management

**How to test:**
1. Log in as Admin → go to `/admin/pathways`
2. Open the seeded "Psychology" pathway
3. Log in as Student (Jordan) → go to `/pathways`
4. Find the Psychology pathway → begin first step
5. Complete step 1 → verify step 2 unlocks
6. Complete all steps → go to `/pathways/[id]/certificate`
7. Verify certificate PDF renders correctly
8. Check `/pathways/[id]/leaderboard` → verify student's rank appears

---

## 11. Job Applications & Hiring

**What it does:** End-to-end workflow from posting a position to accepting a hire.

**Application statuses:**
`SUBMITTED` → `UNDER_REVIEW` → `INTERVIEW_SCHEDULED` → `INTERVIEW_COMPLETED` → `ACCEPTED` / `REJECTED` / `WITHDRAWN`

**Interview outcomes:** `PASS`, `HOLD`, `FAIL`, `WAIVE`

**Position types:** `INSTRUCTOR`, `CHAPTER_PRESIDENT`, `MENTOR`, `STAFF`, `GLOBAL_ADMIN`

**How it works:**
- Admin creates position at `/admin/positions/new` or `/admin/recruiting/positions/new`
- Position appears publicly at `/positions`
- Applicant submits form → `Application` record created
- Admin reviews at `/admin/applications`
- Interview slots posted → applicant selects slot
- Reviewer records notes (`InterviewNote`) and outcome (`Decision`)
- On acceptance: `lib/application-actions.ts` converts applicant to full role

**Specialized applications:**
- Instructor: `/instructor-training` completion is part of the flow
- Chapter President: separate form at `/chapter/apply` with `ChapterPresidentApplication`

**Routes:**
- `/positions` — public job board
- `/position/[id]` — position detail / apply
- `/applications` — my applications (applicant view)
- `/applications/[id]` — application status and interview scheduling
- `/application-status` — simple public status tracker
- `/admin/applications` — all applications (admin)
- `/admin/instructor-applicants` — instructor applications specifically
- `/admin/chapter-president-applicants` — chapter president applications
- `/interviews` — interview scheduling hub
- `/chapter/recruiting` — chapter-level hiring hub
- `/chapter/applicants` — chapter applicant review

**How to test:**
1. Log in as Admin → create a new Instructor position at `/admin/recruiting/positions/new`
2. Log out → go to `/positions` → find the position
3. Click "Apply" → complete the application form
4. Log in as Admin → go to `/admin/instructor-applicants`
5. Move application to `UNDER_REVIEW`
6. Create an interview slot → assign to applicant
7. Log in as applicant → go to `/applications/[id]` → accept the slot
8. Log in as Admin → add interview notes, select outcome `PASS`
9. Submit decision → applicant status changes to `ACCEPTED`
10. Verify applicant is now assigned the `INSTRUCTOR` role in DB

---

## 12. Chapter Management

**What it does:** Local chapter coordinators and presidents manage instructors, students, and chapter operations.

**How it works:**
- `Chapter` model linked to users, courses, events
- `lib/chapter-actions.ts` handles chapter CRUD operations
- Chapter President role unlocks additional management routes
- Chapter President role (`CHAPTER_PRESIDENT`) can access `chapter-lead/` routes
- `ChapterPresidentApplication` for applying to lead a chapter

**Routes:**
- `/chapter` — chapter dashboard
- `/chapter/president` — president-specific tools
- `/chapter/instructors` — chapter instructor roster
- `/chapter/students` — chapter student roster
- `/chapter/recruiting` — hiring hub
- `/chapter/updates` — send updates to chapter members
- `/chapter/marketing` — marketing dashboard
- `/chapter/page` — public-facing chapter page
- `/chapter/apply` — apply to a chapter
- `/chapters` — all chapters directory
- `/chapters/propose` — propose a new chapter
- `/chapter-lead/dashboard` — chapter president tools
- `/admin/chapters` — admin chapter management

**How to test:**
1. Log in as Admin → go to `/admin/chapters` → view The Frisch School chapter
2. Log in as Instructor (Avery, member of Frisch) → go to `/chapter`
3. Verify Frisch chapter dashboard loads with correct data
4. Check `/chapter/students` → verify Jordan listed
5. Check `/chapter/instructors` → verify Avery listed
6. Go to `/chapter/recruiting` → create a new position
7. Go to `/chapter/updates` → send an update message
8. Go to `/chapters` → verify all chapters listed
9. Go to `/chapters/propose` → submit a chapter proposal

---

## 13. Incubator (Project-Based Learning)

**What it does:** Students take ideas through a structured 6-phase project pipeline, earning XP at each stage.

**Phases and XP:**

| Phase | XP |
|-------|----|
| Ideation | 25 |
| Planning | 30 |
| Building | 50 |
| Feedback | 20 |
| Polishing | 30 |
| Showcase | 75 |

**How it works:**
- `lib/incubator-actions.ts` + `lib/incubator-workflow.ts`
- Projects can be applied to at `/incubator/apply`
- Admin selects and manages projects at `/admin/incubator`
- Each phase has requirements; advancing requires admin/mentor approval
- Mentors assigned via `Mentorship` pairing
- Launches are publicly viewable at `/incubator/launches` (no auth required)

**Routes:**
- `/incubator` — browse active projects
- `/incubator/[id]` — project detail and phase tracker
- `/incubator/apply` — apply for a project
- `/incubator/launches` — public launch profiles
- `/admin/incubator` — admin project management
- `/admin/incubator/[id]` — project admin detail
- `/mentor/incubator` — mentor view of assigned projects

**How to test:**
1. Log in as Student (Jordan) → go to `/incubator/apply`
2. Submit an application
3. Log in as Admin → go to `/admin/incubator` → approve Jordan's application
4. Log in as Jordan → go to `/incubator/[id]`
5. Verify project is in "Ideation" phase, 25 XP available
6. Complete phase requirements → advance to "Planning"
7. Continue through phases until "Showcase"
8. Verify total XP accumulated (max 230 XP)
9. Go to `/incubator/launches` without logging in → verify project appears
10. Assign a mentor → verify mentor sees project in `/mentor/incubator`

---

## 14. Activity Hub & Challenges

**What it does:** Centralized discovery for all challenges, activities, and gamified learning.

**Activity types:**
- Portal Challenges (daily, weekly, seasonal)
- Talent Challenges (external platform)
- Try-it Sessions (quick exploration)
- Incubator Projects
- Project Tracker tasks

**Difficulty levels:** Easy, Medium, Hard, Advanced

**Gamification elements:**
- XP rewards (configured in `lib/xp-config.ts`)
- Streaks (`/challenges/streaks`)
- Passport — track completed challenges (`/challenges/passport`)
- Badges (`/badges`)
- Leaderboards (`/leaderboards`)

**How it works:**
- `lib/activity-hub/actions.ts` generates the activity feed
- `lib/challenge-gamification-actions.ts` handles completions and scoring
- `lib/xp.ts` awards XP after activity completion
- `POST /api/activities/complete` marks an activity done

**Routes:**
- `/activities` — activity hub
- `/activities/complete` — completion handler
- `/challenges` — challenge library
- `/challenges/[id]` — challenge detail
- `/challenges/daily` — today's challenge
- `/challenges/weekly` — this week's challenge
- `/challenges/passport` — passport tracker
- `/challenges/streaks` — streak tracker
- `/challenges/nominate` — nominate for achievement
- `/leaderboards` — competition leaderboards
- `/badges` — badge collection
- `/badges/[id]` — badge detail
- `/admin/challenges` — admin challenge management

**How to test:**
1. Log in as Student (Jordan) → go to `/activities`
2. Find a challenge → open it at `/challenges/[id]`
3. Complete it via `POST /api/activities/complete`
4. Verify XP awarded (check `/badges` or dashboard KPIs)
5. Go to `/challenges/daily` → complete daily challenge
6. Go to `/challenges/daily` again → verify can't complete twice same day
7. Go to `/challenges/streaks` → verify streak incremented
8. Go to `/challenges/passport` → verify completion stamped
9. Log in as Admin → go to `/admin/challenges` → create a new challenge
10. Verify it appears in `/challenges` for students

---

## 15. Reflection System

**What it does:** Monthly self-reflection forms for users to track happiness, challenges, and goals.

**Standard questions:**
- Happiness level (1–5 rating)
- What's working well
- Where support is needed
- Future goals
- Action items

**How it works:**
- `ReflectionForm` model: form templates (admin-customizable)
- `ReflectionQuestion` model: individual questions
- `ReflectionSubmission` model: user's answers
- `lib/reflection-actions.ts` handles submit/history
- Admin can edit form templates at `/admin/reflection-forms`
- Staff reflections viewable at `/admin/reflections`

**Routes:**
- `/reflection` — submit monthly reflection
- `/reflection/history` — past reflections
- `/my-program/reflect` — student program reflection
- `/my-program/reflect/[reflectionId]` — reflection detail
- `/admin/reflections` — admin view of all reflections
- `/admin/reflection-forms` — manage form templates
- `/feedback/anonymous` — anonymous feedback (no login required)

**How to test:**
1. Log in as Student (Jordan) → go to `/reflection`
2. Complete each question, submit
3. Go to `/reflection/history` → verify submission appears
4. Log in as Admin → go to `/admin/reflections` → find Jordan's submission
5. Go to `/admin/reflection-forms` → edit a question on the form
6. Log in as Jordan again → go to `/reflection` → verify updated question shows
7. Without logging in, go to `/feedback/anonymous` → submit anonymous feedback
8. Log in as Admin → verify anonymous feedback received

---

## 16. Events & Calendar

**What it does:** Manages YPP events (showcases, festivals, competitions, workshops) and personal calendars.

**Event types:** `SHOWCASE`, `FESTIVAL`, `COMPETITION`, `WORKSHOP`, `ALUMNI_EVENT`

**How it works:**
- `Event` model with type, date, location, RSVP count
- `EventRsvp` model: user RSVPs
- `lib/event-actions.ts`, `lib/calendar-actions.ts`
- `GET /api/calendar` returns calendar data for the logged-in user
- Office hours: instructors post availability slots; students book

**Routes:**
- `/events` — event calendar
- `/events/map` — geographic event map
- `/calendar` — personal calendar
- `/office-hours` — book office hours
- `/office-hours/manage` — manage availability (instructor)
- `/admin/events` — admin event management
- `/admin/events/create` — create event

**How to test:**
1. Log in as Admin → go to `/admin/events/create`
2. Create a Workshop event
3. Log in as Student (Jordan) → go to `/events`
4. Find the event → RSVP
5. Go to `/calendar` → verify event appears
6. Use "Add to Calendar" button → verify `.ics` file downloads
7. Log in as Instructor → go to `/office-hours/manage`
8. Create an availability slot
9. Log in as Student → go to `/office-hours` → book the slot
10. Verify booking appears on both instructor and student calendars

---

## 17. Community & Messaging

**What it does:** Direct messaging, community feed, peer recognition, and announcement broadcasting.

**How it works:**
- `lib/messaging-actions.ts` for DM threads
- Optional Pusher integration (`lib/pusher-server.ts`) for real-time delivery
- Community feed: activity stream of user actions
- Recognition: celebrate peers at `/community/recognize`
- Moments: capture and share special moments at `/moments`

**Routes:**
- `/messages` — messaging hub
- `/messages/[conversationId]` — conversation thread
- `/community/feed` — activity feed
- `/community/chat` — community chat room
- `/community/recognize` — recognize a peer
- `/moments` — moments gallery
- `/announcements` — announcements list

**How to test:**
1. Log in as Instructor (Avery) → go to `/messages`
2. Start a new conversation with Jordan
3. Send a message
4. Log in as Jordan → verify message received
5. Reply to the message
6. (With Pusher configured) verify real-time delivery without page refresh
7. Log in as Admin → go to `/announcements`
8. Create a role-specific announcement (e.g., for `INSTRUCTOR` role only)
9. Log in as Instructor → verify announcement banner appears
10. Log in as Student → verify announcement NOT shown
11. Go to `/community/recognize` → recognize a peer → verify it appears in community feed

---

## 18. Parent Portal

**What it does:** Gives parents visibility into their child's learning progress and communication with instructors.

**How it works:**
- `lib/parent-actions.ts`, `lib/parent-approval-actions.ts`
- Parents linked to students via `UserRole` + parent profile
- Parent signup at `/signup/parent`
- `ParentApproval` workflow: parent access must be approved by admin

**Routes:**
- `/parent/dashboard` — parent overview
- `/parent/[studentId]` — individual student detail
- `/parent/connect` — connect with an instructor
- `/parent/reports` — student progress reports
- `/parent/resources` — parent guides and resources
- `/signup/parent` — parent account creation
- `/admin/parent-approvals` — admin approval queue

**How to test:**
1. Go to `/signup/parent` → create a parent account
2. Log in as Admin → go to `/admin/parent-approvals`
3. Approve the parent account
4. Link parent to Jordan's account
5. Log in as parent → go to `/parent/dashboard`
6. Verify Jordan's courses, progress, and goals are visible
7. Go to `/parent/[studentId]` → verify detailed progress view
8. Use `/parent/connect` to message Jordan's instructor
9. Verify instructor receives the message

---

## 19. Awards & Achievements

**What it does:** Recognizes users with tiered awards and badges for accomplishments.

**Award types:**
- Instructor awards: `BRONZE_INSTRUCTOR`, `SILVER_INSTRUCTOR`, `GOLD_INSTRUCTOR`
- Achievement awards: `BRONZE_ACHIEVEMENT`, `SILVER_ACHIEVEMENT`, `GOLD_ACHIEVEMENT`
- Mentorship awards: `BRONZE`, `SILVER`, `GOLD`, `LIFETIME`

**Tier benefits:**

| Tier | Unlocks |
|------|---------|
| Bronze | Alumni directory access (`/alumni`) |
| Silver | College advisor assignment (`/college-advisor`) |
| Gold | Additional privileges |
| Lifetime | Full program legacy access |

**How it works:**
- `lib/award-nomination-actions.ts` handles nominations
- `lib/award-tier-config.ts` defines tier requirements and benefits
- `lib/feature-gates.ts` unlocks features when award tier is reached
- Students nominate at `/challenges/nominate`
- Admin approves nominations at `/admin`

**Routes:**
- `/awards` — awards overview
- `/student-of-month` — student of the month showcase
- `/wall-of-fame` — hall of fame
- `/challenges/nominate` — nominate for achievement
- `/challenges/nominate/submit` — submit nomination
- `/instructor/student-spotlight` — instructor nominates student
- `/instructor/student-spotlight/nominate` — nomination form
- `/alumni` — alumni directory (Bronze+ only)
- `/college-advisor` — college advisor (Silver+ only)

**How to test:**
1. Log in as Instructor → go to `/instructor/student-spotlight/nominate`
2. Nominate Jordan for Student of the Month
3. Log in as Admin → approve the nomination
4. Verify Jordan appears on `/student-of-month`
5. Verify Jordan receives a badge/award
6. Elevate Jordan to Bronze tier in DB → verify `/alumni` route is now accessible to them
7. Elevate to Silver → verify `/college-advisor` route unlocks

---

## 20. Showcase & Portfolio

**What it does:** Students publicly display completed projects and build a personal portfolio.

**How it works:**
- `Showcase` model: submitted project presentations
- `lib/showcase-actions.ts` handles submissions
- Portfolio: collection of work items at `/portfolio`
- `lib/portfolio-actions.ts` manages portfolio items

**Routes:**
- `/showcase` — public showcase gallery
- `/showcase/[id]` — individual showcase detail
- `/showcase/submit` — submit a project
- `/portfolio` — personal portfolio
- `/portfolio/templates` — portfolio templates
- `/stories` — student stories

**How to test:**
1. Log in as Student (Jordan) → go to `/showcase/submit`
2. Fill out project title, description, media links → submit
3. Go to `/showcase` → verify submission appears
4. Click through to `/showcase/[id]` → verify full detail view
5. Go to `/portfolio` → add a portfolio item
6. Choose a template at `/portfolio/templates`
7. Verify portfolio renders correctly

---

## 21. Admin Tools

**What it does:** Complete system administration — user management, content approval, data export, analytics, and configuration.

### 21.1 User Management
- `/admin/students` — view, edit, deactivate students
- `/admin/instructors` — instructor roster
- `/admin/staff` — staff accounts
- `/admin/bulk-users` — CSV import/export (`POST /api/admin/bulk-users/import`)

**Test:** Import a CSV of 5 users → verify accounts created with correct roles.

### 21.2 Instructor Management
- `/admin/instructor-applicants` — review instructor applications
- `/admin/instructor-approvals` — grant teaching approvals per level
- `/admin/instructor-readiness` — readiness command center (all instructors at a glance)
- `/chapter-lead/instructor-readiness` — chapter-scoped view

**Test:** Open readiness command center → verify all instructors' completion % and approval statuses display.

### 21.3 Chapter Management
- `/admin/chapters` — create, edit, deactivate chapters

**Test:** Create a new chapter → verify it appears in `/chapters` directory.

### 21.4 Curriculum & Content
- `/admin/curricula` — review and approve instructor-submitted curricula
- `/admin/courses` — manage all courses
- `/admin/pathways` — manage pathways
- `/admin/activities` — manage activity hub content
- `/admin/challenges` — challenge management

**Test:** Submit curriculum as instructor → approve as admin → verify instructor can now offer classes.

### 21.5 Events
- `/admin/events` — event list
- `/admin/events/create` — create event

**Test:** Create event → verify appears in `/events`.

### 21.6 Recruiting
- `/admin/applications` — all job applications
- `/admin/recruiting` — recruiting hub
- `/admin/recruiting/positions/new` — create position

**Test:** Full hiring workflow (see Section 11).

### 21.7 Mentorship Program
- `/admin/mentorship-program` — program settings
- `/admin/mentor-match` — AI mentor matching dashboard

**Test:** Use mentor match to pair users → verify `Mentorship` record created.

### 21.8 Data Management
- `/admin/export` — export user/course data
- `/admin/data-export` — comprehensive data export
- `/admin/bulk-users` — bulk CSV operations
- `/admin/audit-log` — full audit log of sensitive actions

**Test:** Export users as CSV → verify file downloads with correct columns. Check audit log after performing admin actions.

### 21.9 Announcements & Communications
- `/admin/announcements` — manage announcements
- `/admin/reminders` — automated email reminders
- `/admin/rollout-comms` — rollout campaign manager
- `/admin/emergency-broadcast` — send emergency broadcast to all users

**Test:** Send emergency broadcast → verify all active users receive notification.

### 21.10 Scholarships
- `/admin/scholarships` — scholarship management
- `/admin/scholarships/create` — create scholarship

**Test:** Create scholarship → verify it appears in list.

### 21.11 Form Templates
- `/admin/form-templates` — dynamic form builder
- `/admin/reflection-forms` — reflection form templates

**Test:** Build a form with text, rating, and select fields → assign to a user role → verify users see the form.

### 21.12 Analytics
- `/admin/analytics` — system-wide analytics
- `/admin/chapter-reports` — per-chapter performance reports

**Test:** Open analytics → verify charts load with enrollment, completion, and engagement data.

### 21.13 Portal Rollout
- `/admin/portal-rollout` — manage feature rollout to users/chapters
- `/chapter-lead/portal-rollout` — chapter-scoped rollout view

**Test:** Enable a feature for one chapter only → verify users in that chapter see it; others don't.

---

## 22. Passion World (3D Gamification)

**What it does:** An immersive Three.js 3D island world that visualizes the student's journey through YPP.

**How it works:**
- Built with Three.js + React Three Fiber
- Route: `/world`
- `components/world/passion-world.tsx` — main container
- Islands represent different domains/pathways and unlock as user progresses
- Landmarks:
  - **Achievement Shrine** — displays earned awards
  - **Chapter Town** — shows chapter activity
  - **Mentor Tower** — mentor connection point
  - **Quest Board** — active challenges
- Seasonal themes and weather change based on real-world date
- `lib/world-actions.ts` fetches user's island state
- Personal quests generated by `lib/quest/generate-personal-quests.ts`

**World features:**

| Feature | Component |
|---------|-----------|
| Cinematic intro | `world/scene/cinematic-intro.tsx` |
| Camera control (WASD/drag) | `world/scene/camera-controller.tsx` |
| Minimap overlay | `world/overlay/minimap.tsx` |
| Island detail panel | `world/overlay/island-detail.tsx` |
| Quest panel | `world/overlay/quest-panel.tsx` |
| Search/filter | `world/overlay/search-filter.tsx` |
| Weather effects | `world/scene/weather.tsx` |
| Seasonal themes | `world/scene/seasonal-theme.tsx` |
| Post-processing (bloom, etc.) | `world/effects/post-processing.tsx` |

**How to test:**
1. Log in as Student (Jordan) → go to `/world`
2. Wait for cinematic intro to finish
3. Use WASD or click-drag to move camera across islands
4. Click an island → verify detail panel opens with correct pathway info
5. Click a landmark → verify appropriate overlay (shrine shows awards, quest board shows challenges)
6. Complete a challenge outside the world → return to `/world` → verify XP/progress reflected
7. Open minimap → navigate to a specific island via minimap click
8. Use search/filter overlay → search for a pathway → verify island highlighted
9. Change system date to winter → verify seasonal theme updates

---

## 23. Notifications & Announcements

**What it does:** Alerts users to important events, deadlines, and messages.

**How it works:**
- `lib/notifications.ts` + `lib/notification-actions.ts`
- In-app notification center at `/notifications`
- Announcement model: targeted by role, chapter, or global
- Announcement banner shown at top of layout
- Nudge engine (`lib/nudge-engine.ts`) generates contextual prompts

**Routes:**
- `/notifications` — notification center
- `/announcements` — announcement list

**How to test:**
1. Log in as Admin → create an announcement for `STUDENT` role
2. Log in as Student → verify announcement banner appears
3. Dismiss the announcement → verify it stays dismissed on next visit
4. Check `/notifications` → verify unread count and list

---

## 24. Feature Gates

**What it does:** Controls which features are visible/active per user, chapter, role, or globally.

**How it works:**
- `FeatureGateRule` model: rules by scope (user, chapter, role, global)
- `lib/feature-gates.ts` evaluates gates at runtime
- `lib/feature-gate-constants.ts` defines all gate names
- Used throughout the app: `if (await isFeatureEnabled('some-gate', userId)) { ... }`
- Admin portal rollout UI: `/admin/portal-rollout`

**Gate scopes:**

| Scope | Target |
|-------|--------|
| User | One specific user |
| Chapter | All users in a chapter |
| Role | All users with a role |
| Global | All users |

**How to test:**
1. Log in as Admin → go to `/admin/portal-rollout`
2. Enable a feature gate for "The Frisch School" chapter only
3. Log in as Avery (Frisch member) → verify feature is visible
4. Log in as a Boston chapter user → verify feature is NOT visible
5. Enable the same gate globally → verify all users see it
6. Disable the gate → verify feature disappears for all

---

## 25. File Uploads & Storage

**What it does:** Handles file uploads for evidence submissions, profile photos, resources, and more.

**How it works:**
- `lib/storage.ts` — abstract storage layer
- `STORAGE_PROVIDER` env var: `"auto"`, `"blob"`, or `"local"`
  - `local`: saves to `/public/uploads/` (development)
  - `blob`: uses Vercel Blob (production)
- `FileUpload` model: tracks all uploaded files
- `POST /api/upload` — universal upload endpoint
- `lib/upload-actions.ts` — server action wrappers

**How to test:**
1. Set `STORAGE_PROVIDER=local` in `.env`
2. Log in as Instructor → go to a training module with evidence requirement
3. Upload a file → verify it saves to `/public/uploads/`
4. Verify `FileUpload` record created in DB
5. With `STORAGE_PROVIDER=blob` (requires `BLOB_READ_WRITE_TOKEN`):
6. Upload a file → verify it saves to Vercel Blob
7. Verify uploaded file URL is accessible in browser

---

## 26. Analytics & Reporting

**What it does:** Tracks engagement, completion, and performance metrics across the portal.

**How it works:**
- `lib/analytics-actions.ts` collects events
- `POST /api/analytics/dashboard` returns aggregated data
- Per-chapter reports at `/admin/chapter-reports`
- AI-powered predictions at `/analytics/predictions`

**Routes:**
- `/analytics` — personal analytics
- `/analytics/predictions` — AI predictions
- `/admin/analytics` — system analytics
- `/admin/chapter-reports` — chapter performance

**How to test:**
1. Log in as Student and complete several activities
2. Go to `/analytics` → verify activity chart reflects completions
3. Log in as Admin → go to `/admin/analytics`
4. Verify enrollment counts, completion rates, and engagement metrics
5. Go to `/admin/chapter-reports` → select The Frisch School chapter
6. Verify chapter-specific metrics are accurate and scoped to that chapter only

---

## Quick Regression Checklist

Use this list when reviewing a PR or preparing for a release:

- [ ] Login (email/password, Google OAuth, magic link)
- [ ] 2FA challenge flow
- [ ] Email verification blocks login
- [ ] Rate limiting triggers at correct threshold
- [ ] Dashboard loads with correct role content
- [ ] Instructor training module completion works
- [ ] Goal assignment and progress update visible to both parties
- [ ] Mentorship pairing created and accessible
- [ ] Course created → enrolled → reflected in `/my-courses`
- [ ] Pathway step unlocks after prerequisite completed
- [ ] Job application submitted → moves through statuses → hire completes
- [ ] Chapter dashboard scoped to correct chapter
- [ ] Incubator project advances through all 6 phases
- [ ] Daily challenge completable once per day
- [ ] Reflection form submits and appears in history
- [ ] Event created → RSVP'd → shows on calendar
- [ ] Message sent and received (real-time if Pusher configured)
- [ ] Parent can view student progress
- [ ] Award nomination flows through to approval
- [ ] Admin bulk CSV import creates users correctly
- [ ] Feature gate enables/disables feature by chapter scope
- [ ] File upload saves and retrieves correctly
- [ ] `/world` loads and island state reflects user progress
- [ ] Anonymous feedback submits without auth

---

## Environment Setup for Testing

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Fill in required variables:
#    DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, SEED_PASSWORD

# 3. Run database migrations and seed
npm run db:migrate
npm run db:seed

# 4. Import training content
npm run training:sync

# 5. Start dev server
npm run dev
```

**Minimum required env vars for local testing:**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (pooled) |
| `DIRECT_URL` | PostgreSQL direct connection |
| `NEXTAUTH_SECRET` | JWT signing (any random string) |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `SEED_PASSWORD` | Password for all seeded test accounts |
| `EMAIL_FROM` | Sender email for auth emails |
| `RESEND_API_KEY` or SMTP vars | Email delivery |

**Optional for full feature coverage:**

| Variable | Feature |
|----------|---------|
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob file storage |
| `PUSHER_*` vars | Real-time messaging |
| `TWO_FACTOR_ENCRYPTION_KEY` | 2FA setup |

---

*Document generated from codebase analysis. To regenerate, re-run the exploration agent against the latest codebase.*
