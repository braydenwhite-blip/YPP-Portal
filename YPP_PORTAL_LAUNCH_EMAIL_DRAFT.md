Subject: YPP Portal Status + Data Needed + Launch Timeline (Classes First, Video Next)

Hi team,

I reviewed the current YPP portal project and mapped what is already working, what still needs data, and the best step-by-step launch sequence.

1. What is already up and running now

- Account system is live: login, signup, parent signup, role-based access.
- Core portal structure is live: dashboard, navigation, admin pages, and role views.
- Regular class system is live in code:
  - Instructors can create curriculum templates.
  - Instructors can create class offerings (dates, days, time, capacity, Zoom/location).
  - Instructors/admin can publish classes.
  - Students can enroll or join waitlist.
  - Students can view their schedule.
- Admin training module management is live:
  - Admin can create/edit modules.
  - Admin can assign modules to instructors.
  - Module records support video URLs.

2. What still needs data before we can launch confidently

- Environment data:
  - Production `DATABASE_URL` and `DIRECT_URL`
  - `NEXTAUTH_SECRET`
  - `RESEND_API_KEY` + verified sender email
- Organization data:
  - Final chapters list
  - Real instructor/student/mentor accounts and role assignments
- Regular class data (this is the key for first launch):
  - At least 1-3 published class templates per focus area
  - At least 1 active offering per template with real schedule and capacity
  - Class Zoom links / location details
- Video content data:
  - Instructor training videos (real URLs, duration, provider)
  - Student video catalog items (modules/workshops/try-it content, thumbnails, descriptions)

3. Important gap to be aware of (video phase)

- Student video pages currently use sample/mock content.
- Several video links point to routes that are not built yet.
- This means we should launch in two stages:
  - Stage A: regular class signup first
  - Stage B: student video experiences after final wiring + content load

4. Recommended launch timeline (with concrete dates)

Step 1: Foundations and data setup (Thu Feb 12 - Sun Feb 15, 2026)
- Confirm production env vars.
- Run migrations.
- Load real chapters and user accounts.

Step 2: Regular class launch prep (Week of Mon Feb 16, 2026)
- Create and publish class templates and offerings.
- QA full student flow: signup -> browse classes -> enroll/waitlist -> schedule view.
- Soft launch regular class signup to a pilot group.

Step 3: Full regular class signup launch (Week of Mon Feb 23, 2026)
- Open class signup to all intended students.
- Track enrollment, waitlist, and attendance workflows daily.

Step 4: Video phase 1 (Instructor training videos) (Week of Mon Mar 2, 2026)
- Upload real training video links into modules.
- Assign modules to instructors.
- Run instructor pilot and verify progress tracking/reporting expectations.

Step 5: Video phase 2 (Student videos: modules/workshops/try-it) (Weeks of Mon Mar 9 and Mon Mar 16, 2026)
- Replace sample content with real DB-driven content.
- Complete missing student video routes/pages.
- QA end-to-end student video flow.
- Launch student video experiences after QA sign-off.

5. Simple go/no-go rule

- Go now for regular classes once Step 2 QA is complete.
- Hold student video launch until Step 5 is complete.

If helpful, I can also send a one-page “Day 1 to Day 14 operator checklist” for the team running the launch.
