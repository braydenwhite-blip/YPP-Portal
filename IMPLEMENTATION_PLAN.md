# YPP Portal Implementation Plan

This document outlines the comprehensive plan to implement all features for the Youth Passion Project Portal.

---

## Current State Summary

**Tech Stack:** Next.js 14 (App Router), PostgreSQL, Prisma ORM, NextAuth.js, Vercel Hosting

**Existing Roles:** ADMIN, INSTRUCTOR, STUDENT, MENTOR, CHAPTER_LEAD, STAFF

**Existing Features:**
- Basic dashboard with role-based views
- Curriculum browsing & enrollment requests
- Pathways visualization
- Instructor training modules
- Mentorship pairings
- Events calendar
- Chapters network
- Admin dashboard (create users, courses, pathways, events, assign mentors)

---

## Phase 1: Schema & Data Model Extensions

### 1.1 New Enums

```
PositionType: INSTRUCTOR, CHAPTER_PRESIDENT, MENTOR, STAFF, GLOBAL_ADMIN
ApplicationStatus: SUBMITTED, UNDER_REVIEW, INTERVIEW_SCHEDULED, INTERVIEW_COMPLETED, ACCEPTED, REJECTED, WITHDRAWN
ProgressStatus: BEHIND_SCHEDULE, GETTING_STARTED, ON_TRACK, ABOVE_AND_BEYOND
QuestionType: TEXT, TEXTAREA, RATING_1_5, MULTIPLE_CHOICE
ProgramType: PASSION_LAB, COMPETITION_PREP, EXPERIENCE, SEQUENCE
AwardType: BRONZE_INSTRUCTOR, SILVER_INSTRUCTOR, GOLD_INSTRUCTOR, BRONZE_ACHIEVEMENT, SILVER_ACHIEVEMENT, GOLD_ACHIEVEMENT
```

### 1.2 New Models

| Model | Purpose |
|-------|---------|
| Position | Job/role openings for applicants |
| Application | Applicant submissions |
| InterviewSlot | Scheduled interview times |
| InterviewNote | Interviewer notes and ratings |
| Decision | Accept/reject decisions |
| Announcement | Global and chapter announcements |
| GoalTemplate | Reusable goal definitions by role |
| Goal | User-assigned goals |
| ProgressUpdate | Mentor feedback on goals (with progress bar status) |
| ReflectionForm | Monthly reflection form templates |
| ReflectionQuestion | Questions within reflection forms |
| ReflectionSubmission | User's submitted reflections |
| ReflectionResponse | Individual question responses |
| SpecialProgram | Passion labs, competition prep, sequences |
| ProgramSession | Sessions within a program |
| SpecialProgramEnrollment | User enrollment in programs |
| AlumniProfile | Extended profile for alumni |
| CollegeAdvisor | Advisor profiles |
| CollegeAdvisorship | Advisor-advisee pairings |
| UserProfile | Extended biographical info |
| MarketingStats | Chapter marketing metrics |
| MarketingGoal | Chapter marketing targets |

### 1.3 Extended Existing Models

- **User**: Add relations for applications, goals, reflections, programs, alumni/advisor features
- **Chapter**: Add partnerSchool, programNotes, positions, announcements, marketing relations
- **Award**: Add `type` field with AwardType enum

---

## Phase 2: Application & Recruitment System

### 2.1 New Pages

| Page | Path | Access | Purpose |
|------|------|--------|---------|
| Open Positions | `/positions` | Public | View all open positions |
| Position Detail | `/positions/[id]` | Public | View position details, apply |
| My Applications | `/applications` | Logged in | View own applications |
| Application Detail | `/applications/[id]` | Applicant | View application status, schedule interview |
| Applications Management | `/admin/applications` | Admin/CP | View all applications |
| Application Review | `/admin/applications/[id]` | Admin/CP | Review, add notes, make decision |
| Position Management | `/admin/positions` | Admin | Create/close positions |

### 2.2 Server Actions

- `createPosition(formData)` - Admin only
- `closePosition(positionId)` - Admin only
- `submitApplication(formData)` - Any logged-in user
- `scheduleInterview(applicationId, slotId)` - Admin/CP
- `addInterviewNote(applicationId, formData)` - Admin/CP
- `makeDecision(applicationId, formData)` - Admin
- `convertApplicantToRole(applicationId)` - Admin (auto-called on accept)

### 2.3 Email Notifications

Integrate with email service (Resend recommended for Vercel):
- Application received confirmation
- Interview invitation
- Interview reminder (24h before)
- Decision notification (accept/reject)
- Welcome email on role conversion

---

## Phase 3: User Profiles & Biographical Information

### 3.1 New Pages

| Page | Path | Access | Purpose |
|------|------|--------|---------|
| My Profile | `/profile` | Logged in | Edit own profile |
| Profile View | `/profile/[id]` | Role-based | View other's profile |
| Instructor Profile | `/instructors/[id]` | Logged in | View instructor details |
| Student Profile | `/students/[id]` | Admin/CP/Mentor | View student details |

### 3.2 Profile Components

- `ProfileCard` - Avatar, name, role badges, contact info
- `BiographySection` - Bio, interests, school info
- `CurriculumSection` - For instructors: curriculum link, feedback
- `CoursesSection` - Current/past courses
- `AchievementsSection` - Awards, milestones

---

## Phase 4: Training & Curriculum System

### 4.1 Enhanced Pages

- Add curriculum submission form to `/instructor-training`
- Display curriculum feedback
- Progress tracking with visual status

### 4.2 New Pages

| Page | Path | Access | Purpose |
|------|------|--------|---------|
| Submit Curriculum | `/instructor-training/curriculum` | Instructor | Submit curriculum for review |
| Curriculum Review | `/admin/curriculum-review` | Admin/CP | Review submitted curricula |

---

## Phase 5: Goals & Progress Update System (HIGH PRIORITY)

### 5.1 New Pages

| Page | Path | Access | Purpose |
|------|------|--------|---------|
| My Goals | `/goals` | Instructor/CP | View assigned goals |
| Goal Detail | `/goals/[id]` | Logged in | View goal progress |
| Submit Progress | `/mentorship/feedback/[menteeId]` | Mentor | Submit progress update |
| Manage Goals | `/admin/goals` | Admin | Create/edit goal templates |

### 5.2 Progress Bar Component

Build the 4-level progress bar visualization:
- **Behind schedule** (Red) - Incomplete/behind timetable schedule and no catch-up possible
- **Getting started** (Yellow) - Incomplete/behind timetable schedule but catch-up possible
- **On track** (Green) - Complete/in line with timetable schedule in both quantity & quality
- **Above and beyond** (Blue) - Exceeds goals in quantity & quality

### 5.3 Server Actions

- `createGoalTemplate(formData)` - Admin
- `assignGoalToUser(formData)` - Admin
- `submitProgressUpdate(formData)` - Mentor
- `updateGoalTemplate(formData)` - Admin

---

## Phase 6: Monthly Reflection Forms

### 6.1 New Pages

| Page | Path | Access | Purpose |
|------|------|--------|---------|
| Monthly Reflection | `/reflection` | Instructor/CP | Submit monthly reflection |
| Reflection History | `/reflection/history` | Logged in | View past submissions |
| View Reflections | `/admin/reflections` | Admin/Mentor | View mentee reflections |
| Manage Forms | `/admin/reflection-forms` | Admin | Edit reflection questions |

### 6.2 Default Questions (editable by Admin)

**"Your Happiness in YPP" Section:**
- How happy are you at YPP? (1-5 rating, bold selection)
- What's working well for you? (text)
- What support or changes would help you succeed in this role and beyond YPP? (text)

**"Future Plan of Action" Section:**
- Revisions to future goals (text)
- Action Items and Implementation Plan (text)

---

## Phase 7: Mentorship Enhancements

### 7.1 Enhanced Features

- View mentor contact info
- View mentee progress updates
- Submit feedback to mentees with progress bars

### 7.2 New Pages

| Page | Path | Access | Purpose |
|------|------|--------|---------|
| Mentee Dashboard | `/mentorship/mentees` | Mentor/CP | View all mentees |
| Mentee Detail | `/mentorship/mentees/[id]` | Mentor | Full mentee view with reflections |
| Submit Feedback | `/mentorship/feedback/[menteeId]` | Mentor | Submit progress bar feedback |

---

## Phase 8: Chapter President Features

### 8.1 New Pages

| Page | Path | Access | Purpose |
|------|------|--------|---------|
| Chapter Dashboard | `/chapter` | CP | Comprehensive chapter view |
| Chapter Instructors | `/chapter/instructors` | CP | List all chapter instructors |
| Instructor Detail | `/chapter/instructors/[id]` | CP | Review instructor progress |
| Chapter Students | `/chapter/students` | CP | Student enrollment records |
| Chapter Updates | `/chapter/updates` | CP | Send updates to instructors |
| Marketing Dashboard | `/chapter/marketing` | CP | Stats and goals |
| Chapter Applicants | `/chapter/applicants` | CP | View/manage chapter applicants |

---

## Phase 9: Student Features

### 9.1 New Pages

| Page | Path | Access | Purpose |
|------|------|--------|---------|
| My Courses | `/my-courses` | Student | All enrolled courses (past & present) |
| Course Feedback | `/courses/[id]/feedback` | Student | Submit course feedback |
| My Mentor | `/my-mentor` | Student | View student mentor contact |

### 9.2 Enhanced Features

- Course catalog filtering by chapter
- Contact instructor functionality
- Leave feedback forms

---

## Phase 10: Special Programming System

### 10.1 New Pages

| Page | Path | Access | Purpose |
|------|------|--------|---------|
| Special Programs | `/programs` | All | Browse special programs |
| Program Detail | `/programs/[id]` | All | View program details |
| My Programs | `/programs/my` | Enrolled | View enrolled programs |
| Manage Programs | `/admin/programs` | Admin | Create/manage programs |

### 10.2 Program Types

- **Passion Labs** - Deep-dive interest exploration
- **Competition Prep** - Contest preparation courses
- **Experiences** - Events and activities
- **Sequences** - Multi-course pathways

---

## Phase 11: Alumni & Awards System

### 11.1 Award Tiers

| Award | Unlocks |
|-------|---------|
| Bronze Instructor/Achievement | Alumni directory access, Alumni events |
| Silver Instructor/Achievement | College Advisor assignment |
| Gold Instructor/Achievement | Additional privileges TBD |

### 11.2 New Pages

| Page | Path | Access | Purpose |
|------|------|--------|---------|
| Alumni Directory | `/alumni` | Bronze+ | Browse alumni |
| Alumni Events | `/alumni/events` | Bronze+ | Alumni-only events |
| My College Advisor | `/college-advisor` | Silver+ | View advisor contact |
| Manage Alumni | `/admin/alumni` | Admin | Setup directory, assign advisors |

---

## Phase 12: Announcements System

### 12.1 Features

- Global announcements (all users)
- Role-targeted announcements
- Chapter-specific announcements
- Expiration dates

### 12.2 New Pages

| Page | Path | Access | Purpose |
|------|------|--------|---------|
| Announcements | `/announcements` | All | View all announcements |
| Create Announcement | `/admin/announcements` | Admin | Create announcements |

---

## Phase 13: Admin Dashboard Enhancements

### 13.1 New Admin Pages

| Page | Path | Purpose |
|------|------|---------|
| All Instructors | `/admin/instructors` | Full instructor list with filters |
| All Students | `/admin/students` | Full student list |
| All Chapters | `/admin/chapters` | Chapter management with stats |
| All Staff | `/admin/staff` | View all staff reflections |
| Goal Management | `/admin/goals` | Set/edit position goals |

---

## Phase 14: Styling & Branding

### 14.1 YPP Color Scheme

```css
:root {
  --ypp-purple-dark: #4a1c7a;
  --ypp-purple: #7c3aed;
  --ypp-purple-light: #a78bfa;
  --ypp-pink: #ec4899;

  /* Progress bar colors */
  --progress-behind: #ef4444;
  --progress-getting-started: #eab308;
  --progress-on-track: #22c55e;
  --progress-above: #3b82f6;
}
```

### 14.2 Branding

- YPP logo integration
- Trebuchet MS font consideration
- Consistent with YPP Wix site

---

## Implementation Priority

### High Priority (Core Features)
1. Schema Extensions - Foundation for all features
2. User Profiles - Biographical info for all roles
3. Goals & Progress System - Central to mentorship workflow
4. Monthly Reflections - Required for happiness tracking
5. Progress Bar Component - Visual feedback system

### Medium Priority (Role-Specific)
6. Application System - Recruitment pipeline
7. Chapter President Dashboard - CP management tools
8. Mentorship Enhancements - Feedback workflow
9. Student Features - Course history, feedback

### Lower Priority (Advanced Features)
10. Special Programming - Passion labs, sequences
11. Alumni System - Award-gated features
12. Email Notifications - Automated communications
13. Marketing Stats - Chapter analytics
14. Branding Updates - Logo, colors, fonts

---

## Vercel Deployment Notes

### Environment Variables Required

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://your-domain.vercel.app
RESEND_API_KEY=... (for email notifications)
```

### Vercel-Specific Configurations

- Use Vercel Postgres or external PostgreSQL (e.g., Supabase, Neon)
- Configure build command: `prisma generate && next build`
- Set up preview deployments for PRs
- Configure custom domain when ready

### Database Considerations

- Use connection pooling (PgBouncer) for serverless
- Add `?pgbouncer=true` to DATABASE_URL if using pooling
- Consider Prisma Accelerate for edge caching

---

## File Structure for New Features

```
app/
├── (app)/
│   ├── positions/
│   ├── applications/
│   ├── profile/
│   ├── goals/
│   ├── reflection/
│   ├── programs/
│   ├── alumni/
│   ├── college-advisor/
│   ├── my-courses/
│   ├── my-mentor/
│   ├── chapter/
│   └── admin/
│       ├── positions/
│       ├── applications/
│       ├── goals/
│       ├── reflections/
│       ├── programs/
│       ├── alumni/
│       └── announcements/
components/
├── profiles/
├── progress/
├── forms/
├── programs/
└── announcements/
lib/
├── application-actions.ts
├── goals-actions.ts
├── reflection-actions.ts
├── chapter-actions.ts
├── program-actions.ts
├── alumni-actions.ts
└── email-service.ts
```

---

## Additional Ideas & Recommendations

### 1. Mobile Responsiveness
- Ensure all pages work well on mobile devices
- Consider PWA capabilities for offline access

### 2. Notifications System
- In-app notification bell
- Email digest options (daily/weekly)
- Push notifications (future)

### 3. Analytics Dashboard
- Track user engagement
- Course completion rates
- Pathway progression metrics

### 4. Calendar Integration
- Google Calendar sync for events
- iCal export for interviews/sessions

### 5. Document Management
- Curriculum file uploads
- Application materials storage
- Use Vercel Blob or S3 for file storage

### 6. Search Functionality
- Global search across courses, users, chapters
- Filter and sort capabilities

### 7. Accessibility
- WCAG 2.1 compliance
- Screen reader support
- Keyboard navigation

### 8. Internationalization (Future)
- Multi-language support if YPP expands globally

---

*Last Updated: February 2026*
*Version: 1.0*
