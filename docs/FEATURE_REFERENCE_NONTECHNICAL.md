# YPP Pathways Portal — Feature Overview (Non-Technical)

> **Intended for:** Product reviewers, stakeholders, chapter presidents, program staff, and anyone reviewing the portal without a technical background.
> **Last updated:** 2026-03-16

This document explains every feature in plain language — what it is, what problem it solves, who uses it, and how to verify it's working correctly.

---

## Table of Contents

1. [Signing In & Account Security](#1-signing-in--account-security)
2. [User Roles — Who Sees What](#2-user-roles--who-sees-what)
3. [The Dashboard (Home Page)](#3-the-dashboard-home-page)
4. [Getting Started (Onboarding)](#4-getting-started-onboarding)
5. [Instructor Training Academy](#5-instructor-training-academy)
6. [Goals & Progress Tracking](#6-goals--progress-tracking)
7. [Mentorship](#7-mentorship)
8. [Mentorship Awards Program](#8-mentorship-awards-program)
9. [Courses & Curriculum](#9-courses--curriculum)
10. [Pathways (Learning Journeys)](#10-pathways-learning-journeys)
11. [Job Applications & Hiring](#11-job-applications--hiring)
12. [Chapter Management](#12-chapter-management)
13. [The Incubator (Student Projects)](#13-the-incubator-student-projects)
14. [Challenges & Activities](#14-challenges--activities)
15. [Monthly Reflections](#15-monthly-reflections)
16. [Events & Calendar](#16-events--calendar)
17. [Messaging & Community](#17-messaging--community)
18. [Parent Portal](#18-parent-portal)
19. [Awards & Recognitions](#19-awards--recognitions)
20. [Showcase & Portfolio](#20-showcase--portfolio)
21. [Admin Tools](#21-admin-tools)
22. [Passion World (3D Explorer)](#22-passion-world-3d-explorer)
23. [Notifications & Announcements](#23-notifications--announcements)
24. [Analytics & Reports](#24-analytics--reports)

---

## Test Accounts (Pre-loaded for Review)

These accounts are already set up so you can explore the portal from every angle:

| Who | Email | Role |
|-----|-------|------|
| Brayden White | `brayden.white@youthpassionproject.org` | Admin + Instructor |
| Carly Gelles | `carlygelles@gmail.com` | Mentor + Staff |
| Avery Lin | `avery.lin@youthpassionproject.org` | Instructor |
| Jordan Patel | `jordan.patel@youthpassionproject.org` | Student |

> Ask your tech contact for the password (`SEED_PASSWORD` in the setup file).

---

## 1. Signing In & Account Security

### What it is
The portal supports multiple ways to sign in, and has built-in safety features to protect accounts.

### Sign-in options
- **Email & Password** — standard login
- **Google account** — one-click Google login ("Sign in with Google")
- **Magic link** — enter your email and get a one-time login link sent to your inbox (no password needed)

### Security features
- **Email verification** — new accounts can't log in until they confirm their email
- **Two-factor authentication (2FA)** — optional extra security using an authenticator app (e.g., Google Authenticator)
- **Account lockout** — after 5 wrong password attempts, the account locks for 30 minutes
- **Password reset** — "Forgot password" sends a reset link by email

### How to review it
1. Go to `/login` and sign in with the student test account
2. Try entering the wrong password 5 times — you should see a lockout message
3. Click "Forgot password" — verify you receive an email with a reset link
4. Try the magic link option — verify the email arrives and logs you in
5. Log in as any user → go to **Settings → Security** → enable 2FA and scan the QR code with an authenticator app → log out and back in → you should be asked for the code

---

## 2. User Roles — Who Sees What

### What it is
Every person in the portal has a role that determines what they can see and do. One person can have multiple roles.

### Roles in the portal

| Role | What they can do |
|------|-----------------|
| **Admin** | See and manage everything |
| **Instructor** | Teach classes, build curriculum, manage students |
| **Student** | Enroll in courses, track progress, submit projects |
| **Mentor** | Guide students and instructors, give feedback |
| **Chapter President** | Oversee a chapter's operations and instructors |
| **Staff** | Internal YPP operations |
| **Parent** | View their child's progress and communicate with the program |
| **Applicant** | Someone who has applied for a role but hasn't been hired yet |

### How to review it
1. Log in as the **student** test account — verify you only see student-relevant pages
2. Log in as the **admin** test account — verify you see the `/admin` section
3. While logged in as a student, try visiting `/admin` — you should be blocked
4. Log in as the **instructor** test account — verify you see instructor tools, not admin tools

---

## 3. The Dashboard (Home Page)

### What it is
The first thing users see after logging in. It's personalized based on their role and shows the most important tasks, progress, and tools — all in one place.

### What's on the dashboard

| Section | What it shows |
|---------|---------------|
| Welcome card | Who you are and what you should focus on today |
| Daily checklist | Today's quick tasks (check-in, submit recap, etc.) |
| Priority actions | The top 3 most urgent things to do right now |
| Key stats | Numbers that matter: students enrolled, completion %, etc. |
| Tools explorer | A searchable list of everything you can do in the portal |
| Active pathways | Learning journeys in progress |
| Helpful prompts | Suggestions and reminders based on what you've been doing |
| Milestone roadmap | A visual timeline of your overall journey |

### How to review it
1. Log in as each test account and note how the dashboard changes for each role
2. As a student, verify the pathway widget shows an active learning path
3. As an instructor, verify the training progress widget appears
4. As an admin, verify metrics/stats load correctly
5. Use the search bar (Cmd+K or Ctrl+K) in the tools section — it should filter results as you type
6. Check a daily checklist item — it should update immediately

---

## 4. Getting Started (Onboarding)

### What it is
A guided setup wizard that walks new users through the portal the first time they log in.

### What it does
- Collects basic profile information
- Explains what the user's role means in the portal
- Sets up preferences and notifications
- Walks through first key actions (e.g., finding a course, meeting a mentor)

### How to review it
1. Create a fresh account through `/signup`
2. Log in — you should be automatically taken to the onboarding wizard
3. Complete each step
4. At the end, verify you land on the main dashboard
5. Log out and back in — the onboarding should NOT reappear

---

## 5. Instructor Training Academy

### What it is
A mandatory training program that all instructors must complete before they're allowed to teach. It ensures every instructor meets YPP quality standards.

### How it works for instructors
1. Complete training modules (videos, readings, activities)
2. Pass quizzes for each module
3. Submit evidence (photos, files) where required
4. Once training is done, request an interview with the team
5. After passing the interview, the instructor is approved to offer classes

### Publish approval
Instructors finish training, pass the interview gate, and then request approval for each class offering they want to publish.

### How to review it
1. Log in as **Avery Lin** (Instructor)
2. Go to `/instructor-training`
3. Open a training module — click through a video, complete a checkpoint
4. Take a quiz — verify it grades correctly (try both passing and failing answers)
5. Upload a file as "evidence" — verify it saves
6. After completing all required modules, verify the readiness percentage updates
7. Request an interview slot
8. Log in as **Brayden White** (Admin)
9. Go to `/admin/instructor-readiness`
10. Find Avery — verify their completion status is shown
11. Approve Avery's interview — verify Avery can now create a class

---

## 6. Goals & Progress Tracking

### What it is
A way for mentors and admins to assign specific goals to users, then track progress together with color-coded feedback.

### Progress levels

| Color | Meaning |
|-------|---------|
| Red | Behind Schedule |
| Yellow | Getting Started |
| Green | On Track |
| Blue | Above and Beyond |

### How to review it
1. Log in as **Admin** → go to `/admin/goals`
2. Create a new goal for the Instructor role (e.g., "Complete first lesson plan")
3. Assign it to **Avery Lin**
4. Log in as **Avery** → go to `/goals` — verify the goal appears
5. Log in as **Carly Gelles** (Mentor)
6. Go to `/mentorship/mentees` → select Avery → submit feedback, choosing "On Track"
7. Log in as Avery → verify the progress bar is now green

---

## 7. Mentorship

### What it is
A system that pairs mentors with students and instructors for ongoing guidance, check-ins, and feedback.

### For mentors
- See a list of all mentees
- View each mentee's goals and progress
- Submit feedback and progress updates
- Schedule check-in meetings

### For mentees (students or instructors being mentored)
- See who their mentor is
- Ask questions directly
- Request feedback
- View their own progress updates

### How to review it
1. Log in as **Admin** → go to `/admin/mentor-match`
2. Create a pairing: Mentor = Carly, Mentee = Jordan
3. Log in as **Jordan** (Student) → go to `/my-mentor` — verify Carly's info is shown
4. Go to `/mentor/ask` — send Carly a question
5. Log in as **Carly** (Mentor) → go to `/mentorship/mentees`
6. Find Jordan — verify the question was received
7. View Jordan's goals and submit a progress update
8. Log in as Jordan again — verify the update is reflected

---

## 8. Mentorship Awards Program

### What it is
A formal recognition program for mentors who go above and beyond. Award tiers unlock real benefits in the portal.

### Award tiers and what they unlock

| Award | Unlocks |
|-------|---------|
| Bronze | Access to the alumni directory |
| Silver | College advisor connection |
| Gold | Additional program privileges |
| Lifetime | Full legacy program access |

### How to review it
1. Log in as **Carly** (Mentor) → go to `/mentorship-program`
2. Initiate a review for the Bronze award
3. Submit the review
4. Log in as **Admin** → go to `/mentorship-program/chair`
5. Approve Carly's review
6. Log in as Carly → verify she can now access `/alumni` (Bronze benefit)

---

## 9. Courses & Curriculum

### What it is
The core learning system — instructors create classes, students enroll, and progress is tracked.

### Course types

| Type | Description |
|------|-------------|
| One-Off | A single standalone class |
| Leveled | A multi-class progression series with plain-language learner fit |
| Lab | Hands-on project session |
| Commons | Open mentored practice |
| Competition Prep | Prep for a competition |
| Event | A special event class |

### Student experience
- Browse the full catalog at `/curriculum`
- Enroll in a class
- See enrolled classes at `/my-courses`
- Leave feedback after completing a class

### Instructor experience
- Build a curriculum at `/instructor/curriculum-builder`
- Submit for admin review and approval
- Manage class settings and co-instructors
- View attendance and engagement analytics
- Duplicate an existing course

### How to review it
1. Log in as **Avery** (Instructor) → go to `/instructor/curriculum-builder`
2. Create a new beginner-friendly course
3. Submit it for review
4. Log in as **Admin** → go to `/admin/curricula` → approve it
5. Log in as **Jordan** (Student) → go to `/curriculum` → find the course → enroll
6. Go to `/my-courses` — verify the course appears
7. Fill the course to capacity, then try enrolling a second student — verify they go on a waitlist
8. As Admin, go to `/admin/waitlist` → process the waitlist → verify the student is enrolled

---

## 10. Pathways (Learning Journeys)

### What it is
Curated sequences of courses and activities that guide a student through an entire subject area — from beginner to advanced.

### How it works
- Pathways have steps that unlock one by one
- Each step is a course, activity, or milestone
- Completing a pathway earns a certificate

### How to review it
1. Log in as **Jordan** (Student) → go to `/pathways`
2. Find the "Psychology" pathway → begin step 1
3. Complete the first step — verify step 2 unlocks
4. Continue through remaining steps
5. Upon completion, go to `/pathways/[id]/certificate` — verify the certificate renders
6. Go to `/pathways/[id]/leaderboard` — verify Jordan appears

---

## 11. Job Applications & Hiring

### What it is
The full pipeline from posting a job opening to making a hire — all within the portal.

### How it works
1. Admin (or Chapter President) posts a position
2. Applicants apply through the public job board
3. Admin reviews applications and schedules interviews
4. Interviewer records notes and selects an outcome
5. On acceptance, the applicant is automatically converted to their new role

### Positions available
- Instructor, Chapter President, Mentor, Staff, Global Admin

### How to review it
1. Log in as **Admin** → go to `/admin/recruiting/positions/new` → create an Instructor position
2. Log out → go to `/positions` → find the position → submit an application
3. Log in as **Admin** → go to `/admin/instructor-applicants`
4. Move the application to "Under Review"
5. Post an interview slot → assign it to the applicant
6. Log in as the applicant → go to `/applications/[id]` → accept the slot
7. Log in as Admin → record interview notes → submit decision: **Pass**
8. Verify the applicant is now listed as an Instructor

---

## 12. Chapter Management

### What it is
Tools for managing a local YPP chapter — its instructors, students, hiring, and communications.

### Who uses it
- **Chapter Presidents** manage day-to-day operations
- **Chapter Presidents** oversee chapter health across the program
- **Admins** can manage all chapters centrally

### How to review it
1. Log in as **Admin** → go to `/admin/chapters` → review The Frisch School chapter
2. Log in as **Avery** (Instructor, Frisch chapter) → go to `/chapter`
3. Verify the dashboard shows Frisch-specific data (not Boston's)
4. Go to `/chapter/students` — verify Jordan is listed
5. Go to `/chapter/recruiting` — create a new position for the chapter
6. Go to `/chapter/updates` — send an update to chapter members
7. Go to `/chapters` — verify both Frisch and Boston appear in the directory

---

## 13. The Incubator (Student Projects)

### What it is
A project pipeline where students take an idea from concept all the way to a public launch — earning points (XP) at each phase.

### The 6 phases

| Phase | What happens |
|-------|-------------|
| Ideation | Define the idea and goals |
| Planning | Create a roadmap and assign tasks |
| Building | Actually build the project |
| Feedback | Get feedback from mentors and peers |
| Polishing | Refine based on feedback |
| Showcase | Present the finished project publicly |

### How to review it
1. Log in as **Jordan** (Student) → go to `/incubator/apply` → submit a project idea
2. Log in as **Admin** → go to `/admin/incubator` → approve Jordan's application
3. Log in as Jordan → go to `/incubator/[id]` → verify it starts at "Ideation"
4. Complete the ideation phase → advance to Planning
5. Continue through all phases
6. After Showcase, go to `/incubator/launches` while **logged out** — verify the project is publicly visible

---

## 14. Challenges & Activities

### What it is
A gamified activity system where students and instructors complete challenges to earn points, badges, and maintain streaks.

### Types of challenges
- **Daily challenge** — new one every day, can only be completed once per day
- **Weekly challenge** — refreshes weekly
- **Talent challenges** — external competitions or activities
- **Try-it sessions** — quick exploration activities

### Gamification rewards
- **XP (Experience Points)** — earned on every activity
- **Badges** — unlocked for specific achievements
- **Streaks** — reward consecutive days of activity
- **Passport** — a tracker that stamps each completed challenge
- **Leaderboard** — shows top performers

### How to review it
1. Log in as **Jordan** → go to `/challenges/daily` → complete today's challenge
2. Refresh the page — verify it shows as already completed (can't do twice)
3. Tomorrow (or advance the date) — verify a new daily challenge appears
4. Go to `/challenges/streaks` — verify streak count increased
5. Go to `/challenges/passport` — verify today's completion is stamped
6. Go to `/badges` — verify any earned badges are visible
7. Go to `/leaderboards` — verify Jordan appears

---

## 15. Monthly Reflections

### What it is
A simple monthly check-in form where users reflect on their progress, happiness, and goals.

### What the form asks
- How happy are you this month? (1–5)
- What's going well?
- Where do you need more support?
- What are your goals for next month?
- What actions will you take?

### How to review it
1. Log in as **Jordan** → go to `/reflection`
2. Complete the form → submit
3. Go to `/reflection/history` — verify the submission is saved
4. Log in as **Admin** → go to `/admin/reflections` — verify Jordan's submission is visible
5. Go to `/admin/reflection-forms` → edit a question → save
6. Log in as Jordan → go to `/reflection` — verify the updated question appears
7. Without logging in, go to `/feedback/anonymous` → submit feedback → verify admin receives it

---

## 16. Events & Calendar

### What it is
A calendar system for all YPP events and a booking system for instructor office hours.

### Event types
- Showcases, Festivals, Competitions, Workshops, Alumni Events

### How to review it
1. Log in as **Admin** → go to `/admin/events/create` → create a Workshop event
2. Log in as **Jordan** → go to `/events` — find the event → RSVP
3. Go to `/calendar` — verify the event appears
4. Click "Add to Calendar" — verify a calendar file downloads
5. Log in as **Avery** (Instructor) → go to `/office-hours/manage` → create an available time slot
6. Log in as Jordan → go to `/office-hours` → book Avery's slot
7. Verify the booking appears on both Jordan's and Avery's calendars

---

## 17. Messaging & Community

### What it is
A messaging system for direct conversations between users, plus a community feed for sharing and celebrating.

### Features
- **Direct messages** — private 1-on-1 or group conversations
- **Community feed** — activity stream of what's happening in the program
- **Peer recognition** — celebrate a classmate or colleague
- **Moments** — capture and share memorable moments
- **Announcements** — targeted messages from staff/admin

### How to review it
1. Log in as **Avery** → go to `/messages` → start a conversation with Jordan
2. Send a message
3. Log in as **Jordan** → verify the message arrived → reply
4. Log in as **Admin** → go to `/announcements` → create an announcement for Instructors only
5. Log in as Avery → verify the announcement banner appears at the top of the page
6. Log in as Jordan (Student) → verify the announcement does NOT appear
7. Go to `/community/recognize` → recognize a peer → verify it appears in the community feed

---

## 18. Parent Portal

### What it is
A dedicated section for parents to follow their child's progress and stay connected with the program.

### What parents can see
- Their child's enrolled courses and progress
- Goal tracking and mentor feedback
- Upcoming events
- Progress reports

### How to review it
1. Go to `/signup/parent` → create a new parent account
2. Log in as **Admin** → go to `/admin/parent-approvals` → approve the parent account
3. Link the parent to **Jordan's** account
4. Log in as the parent → go to `/parent/dashboard` — verify Jordan's courses, progress, and goals are visible
5. Go to `/parent/reports` — verify a progress summary is shown
6. Use `/parent/connect` to send a message to Jordan's instructor → verify Avery receives it

---

## 19. Awards & Recognitions

### What it is
A recognition system that celebrates student and instructor achievements with tiered awards.

### Award tiers and benefits
- **Bronze** — Access to the alumni directory
- **Silver** — Matched with a college advisor
- **Gold** — Additional program privileges
- **Lifetime** — Full legacy program access

### How to review it
1. Log in as **Avery** (Instructor) → go to `/instructor/student-spotlight/nominate`
2. Nominate Jordan for Student of the Month
3. Log in as **Admin** → approve the nomination
4. Go to `/student-of-month` — verify Jordan appears
5. Elevate Jordan to Bronze tier (Admin → edit Jordan's profile)
6. Log in as Jordan → verify `/alumni` is now accessible
7. Elevate Jordan to Silver → verify `/college-advisor` becomes available

---

## 20. Showcase & Portfolio

### What it is
A public gallery where students show off completed projects, and a personal portfolio where they collect their best work.

### How to review it
1. Log in as **Jordan** → go to `/showcase/submit` → fill out a project showcase
2. Submit it
3. Go to `/showcase` (can be viewed without logging in) — verify the submission appears
4. Click through to the full showcase detail page
5. Go to `/portfolio` → add a portfolio item using a template from `/portfolio/templates`
6. Verify the portfolio renders cleanly

---

## 21. Admin Tools

### What it is
A comprehensive control panel for managing every aspect of the portal.

### Key tools by category

| Category | What you can do |
|----------|----------------|
| **Users** | Add, edit, deactivate, bulk import users |
| **Curriculum** | Approve or reject instructor-submitted curricula |
| **Chapters** | Create and manage chapters |
| **Hiring** | Review applications, schedule interviews, make hiring decisions |
| **Mentorship** | Set up mentor pairings, run the awards program |
| **Events** | Create and manage events |
| **Announcements** | Send messages to all users or specific roles |
| **Scholarships** | Create and manage scholarships |
| **Reflections** | View all submitted reflections |
| **Analytics** | See program-wide and chapter-level performance |
| **Data export** | Download user and course data as CSV |
| **Audit log** | See a full history of all admin actions |
| **Emergency broadcast** | Send an urgent message to all users |
| **Feature rollout** | Turn features on/off for specific users, chapters, or roles |

### How to review it
1. Log in as **Admin** → go to `/admin`
2. Go to `/admin/bulk-users` → download the CSV template → fill in 3–5 fake users → upload → verify they're created
3. Go to `/admin/audit-log` → verify your admin actions are logged
4. Go to `/admin/emergency-broadcast` → send a test broadcast → verify it's received
5. Go to `/admin/analytics` → verify charts load with real data
6. Go to `/admin/portal-rollout` → enable a feature for Frisch chapter only → verify it appears for Frisch users but not Boston users
7. Go to `/admin/scholarships/create` → create a scholarship

---

## 22. Passion World (3D Explorer)

### What it is
An interactive 3D world students can explore that visually represents their learning journey. Islands unlock as they complete pathways and earn achievements.

### Features
- Navigate around a 3D island map
- Islands represent different subject areas — they "light up" as you unlock them
- Landmarks: Achievement Shrine (your awards), Chapter Town (chapter activity), Mentor Tower, Quest Board
- Seasonal themes change with the time of year
- Dynamic weather effects
- A minimap for navigation
- Cinematic intro on first visit

### How to review it
1. Log in as **Jordan** → go to `/world`
2. Wait for the cinematic intro to play
3. Move around using WASD keys or click-drag
4. Click on an island — verify a detail panel opens showing the correct pathway info
5. Click on the Achievement Shrine landmark — verify Jordan's awards are displayed
6. Click on the Quest Board — verify active challenges are shown
7. Use the search overlay to find a specific pathway — verify the island highlights
8. Return to the main portal, complete an activity, then go back to `/world` — verify the progress is reflected

---

## 23. Notifications & Announcements

### What it is
Alerts and messages that keep users informed of important updates, deadlines, and activity.

### How to review it
1. Log in as **Admin** → create a new announcement targeted at Students
2. Log in as **Jordan** (Student) → verify a banner appears at the top of the page
3. Dismiss the banner → log out and back in → verify it stays dismissed
4. Go to `/notifications` — verify the full notification history is listed with unread indicators

---

## 24. Analytics & Reports

### What it is
Dashboards that show how the program is performing — for individual users, chapters, and the whole organization.

### Who uses it
- **Students/Instructors** see their personal activity charts at `/analytics`
- **Admins** see system-wide metrics at `/admin/analytics`
- **Chapter Presidents** see chapter-specific reports at `/admin/chapter-reports`

### How to review it
1. Log in as **Jordan** and complete 2–3 activities
2. Go to `/analytics` — verify the activity chart reflects what was done
3. Log in as **Admin** → go to `/admin/analytics`
4. Verify enrollment counts, completion rates, and engagement metrics load
5. Go to `/admin/chapter-reports` → select **The Frisch School**
6. Verify data is scoped only to Frisch (Boston data should not appear)

---

## Full Review Checklist

Use this to make sure everything is working before signing off on a portal release:

- [ ] Can log in with email/password, Google, and magic link
- [ ] Account locks after 5 wrong passwords
- [ ] Email verification prevents login for new accounts
- [ ] 2FA challenge appears after enabling it
- [ ] Dashboard shows the correct content for each role
- [ ] Onboarding only shows once per new account
- [ ] Instructor training tracks video, quiz, and evidence progress
- [ ] Instructor interview gate blocks teaching until approved
- [ ] Goals appear to the user after being assigned
- [ ] Mentor progress feedback updates the progress bar color
- [ ] Mentorship pairing visible to both mentor and mentee
- [ ] Mentorship award review progresses through approval stages
- [ ] Courses can be created, approved, and enrolled in
- [ ] Waitlist triggers when a course is full
- [ ] Pathway steps unlock one by one as prerequisites are completed
- [ ] Completion certificate generates on pathway finish
- [ ] Job application moves through all statuses correctly
- [ ] Accepted applicant gets their new role automatically
- [ ] Chapter dashboard shows only that chapter's data
- [ ] Incubator project advances through all 6 phases
- [ ] Daily challenge can only be completed once per day
- [ ] Streaks and passport update after challenge completion
- [ ] Monthly reflection form submits and appears in history
- [ ] Event RSVP shows on personal calendar
- [ ] Direct message is received by the other user
- [ ] Role-targeted announcement shows only to the correct role
- [ ] Parent can see child's progress after account approval
- [ ] Award nomination flows through to approval
- [ ] Showcase visible publicly without logging in
- [ ] Bulk user CSV import creates accounts correctly
- [ ] Feature gate enables/disables feature by chapter
- [ ] Admin audit log records sensitive actions
- [ ] Passion World loads and reflects progress correctly
- [ ] Analytics data is scoped correctly per chapter
