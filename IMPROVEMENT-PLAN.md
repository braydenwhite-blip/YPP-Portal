# YPP Portal — Full Improvement Plan

## Current State Summary

| Area | Completeness | Notes |
|------|-------------|-------|
| Instructor-Led Classes | 95% | Curriculum builder, scheduling, assignments, attendance all work |
| Class Assignments | 90% | Multiple feedback styles, group projects, submissions |
| Pathways & Progression | 80% | Display + progress tracking work |
| Attendance Tracking | 100% | Staff creates sessions, students view records |
| Self-Paced Learning | 20% | `/learn/modules` is hardcoded mock, `/learn/practice` form-only |
| Video Integration | 0% | Models exist (VideoProvider enum), no player |
| Quiz System | 5% | `QuizQuestion` model exists, no UI |
| Gamification (XP/Badges) | 20% | Schema rich, pages are skeletons |
| Mentorship UI | 10% | Models exist, no matching/feedback pages working |
| Parent Portal | 10% | Models exist, minimal pages |
| Admin Tools | 70% | Core ops work, many pages are table-only |
| Dashboard (just improved) | 80% | Collapsible nav, quick actions, role-specific cards |

The database schema is MASSIVE (300+ models, 5000+ lines). Most features are "schema-complete"
but only ~30% have real working UI pages.

---

## PHASE A — Navigation & Dashboard Polish (DONE)

Already shipped in the last commit:
- Collapsible nav sections with distinct icons
- Role-specific quick action cards on dashboard
- Cleaned up sidebar footer
- Removed redundant section labels

### Remaining Dashboard Polish (small commits)

#### A1. Persist nav collapsed state in localStorage
**Files:** `components/nav.tsx`
**What:** Save `openSections` to localStorage on toggle, restore on mount.
**Why:** Currently resets on every page navigation.
**Risk:** Zero — purely additive client-side.

#### A2. Add nav search/filter for power users
**Files:** `components/nav.tsx`, `app/globals.css`
**What:** Add a search input at top of sidebar nav. Filter items across all sections as user types.
**Why:** Admins have 90+ items. Search lets them jump instantly.
**Risk:** Zero — additive only.

#### A3. Sub-group the Admin section
**Files:** `components/nav.tsx`
**What:** Split the 27-item Admin section into sub-groups:
  - **People:** Students, Instructors, Bulk Users, Parent Approvals, Instructor Readiness
  - **Content:** Announcements, Programs, Training Modules, Goals, Reflections, Forms
  - **Reports:** Analytics, Chapter Reports, Pathway Tracking, Audit Log, Volunteer Hours, Export, Data Export
  - **Operations:** Waitlist, Reminders, Emergency Broadcast, Mentor Match, Incubator Mgmt, Staff
**Risk:** Zero — same items, better grouped.

#### A4. Notification badges on nav items
**Files:** `components/nav.tsx`, `app/(app)/layout.tsx`
**What:** Fetch unread counts for messages, notifications, pending approvals.
Pass them into Nav component. Show red dot or count badge.
**Why:** Users currently have no idea if they have unread messages without clicking.
**Data needed:** None new — query existing `Notification` and `Message` models.

---

## PHASE B — Self-Paced Learning System (THE BIG GAP)

This is the #1 missing piece. The instructor-led system is 95% done, but self-paced is 20%.

### What Already Exists in the Database

```
LearningModule (id, title, description, passionCategory, skillLevel,
  videoUrl, videoProvider, durationMinutes, thumbnailUrl, objectives[],
  skills[], prerequisites[], transcript, isPublished, sortOrder)

ModuleWatchProgress (userId, moduleId, watchedSeconds, totalSeconds,
  completedAt, lastPosition)

PracticeLog (userId, passionArea, activityName, durationMinutes,
  mood, notes, xpEarned)

VideoProgress (userId, moduleId, totalSeconds, watchedSeconds,
  lastPosition, completed)
```

All these models exist. The pages just don't use them.

#### B1. Wire `/learn/modules` to real data
**Files:** `app/(app)/learn/modules/page.tsx`, `lib/module-actions.ts` (new)
**What:**
1. Create `getPublishedModules()` server action that queries `LearningModule` table
2. Replace hardcoded array with real database query
3. Add filters: passion category, skill level, completion status
4. Show watch progress per module (from `ModuleWatchProgress`)
**Data needed:** YES — you need to seed `LearningModule` rows. See DATA section below.

#### B2. Build module viewer page `/learn/modules/[id]`
**Files:** `app/(app)/learn/modules/[id]/page.tsx` (new), `components/video-player.tsx` (exists!)
**What:**
1. Full module detail page with video embed
2. Use existing `video-player.tsx` component (416 lines, already built!)
3. Track watch progress via `ModuleWatchProgress` model
4. Show objectives, skills, prerequisites
5. Mark-as-complete button that creates `ModuleWatchProgress.completedAt`
6. XP award on completion (via `XpTransaction` model)
**Data needed:** Same as B1 — `LearningModule` rows with `videoUrl` filled in.

#### B3. Wire `/learn/practice` to real data
**Files:** `app/(app)/learn/practice/page.tsx`, `lib/practice-actions.ts` (new)
**What:**
1. Create `logPractice()` and `getMyPracticeLogs()` server actions
2. Replace hardcoded stats with real `PracticeLog` queries
3. Show actual streak calculation, total minutes, session count
4. Award XP on practice log submission
**Data needed:** None — users create their own practice logs.

#### B4. Self-paced course progress dashboard
**Files:** `app/(app)/learn/progress/page.tsx` (new)
**What:** A single page showing:
- Modules completed vs total
- Watch hours logged
- Practice sessions logged
- Skills unlocked
- Next recommended module
**Data needed:** None — computed from existing models.

### DATA NEEDED FOR SELF-PACED MODULES

**Where to add it:** Supabase SQL editor (or Prisma seed script)

You need to create `LearningModule` rows. Here's how:

**Option 1: Supabase SQL Editor**
Go to your Supabase project → SQL Editor → Run:

```sql
INSERT INTO "LearningModule" (id, title, description, "passionCategory", "skillLevel",
  "videoUrl", "videoProvider", "durationMinutes", "thumbnailUrl", objectives, skills,
  prerequisites, "isPublished", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Introduction to Digital Art',
   'Learn the fundamentals of digital illustration using free tools.',
   'VISUAL_ARTS', 'BEGINNER',
   'https://www.youtube.com/watch?v=YOUR_VIDEO_ID', 'YOUTUBE', 15,
   NULL, ARRAY['Understand digital art basics', 'Set up free tools'],
   ARRAY['Digital illustration', 'Color theory basics'],
   ARRAY[]::text[], true, 1, NOW(), NOW()),
  -- Add more rows for each module you want
;
```

**Option 2: Prisma Seed Script** (better for reproducibility)
Create `prisma/seed-modules.ts`:
```ts
import { prisma } from '../lib/prisma';
// Insert modules programmatically
```

**Option 3: Admin UI** (build an admin page for it — see B5)

#### B5. Admin module management page
**Files:** `app/(app)/admin/modules/page.tsx` (new)
**What:** Admin page to create/edit/publish LearningModules.
- Title, description, video URL, duration
- Passion category & skill level selectors
- Objectives & skills as tag inputs
- Publish/unpublish toggle
- Sort order drag-and-drop
**Why:** So you don't have to use SQL every time you add a module.
**Data needed:** None — this page creates the data.

---

## PHASE C — Gamification & Engagement (Make It Sticky)

### What Already Exists in the Database

```
Challenge, ChallengeParticipant, ChallengeSubmission
PassionPassport, PassportStamp
BadgeRarity, Badge, StudentBadge
LeaderboardEntry
SeasonalCompetition, CompetitionEntry
StudentXP, XPTransaction
MysteryBox, RandomReward
```

All these models exist but the UI pages are skeletons.

#### C1. Wire `/challenges` hub to real data
**Files:** `app/(app)/challenges/page.tsx`
**What:** Query `Challenge` model. Show active/upcoming/completed challenges.
Filter by type (DAILY, WEEKLY, SPECIAL, COMMUNITY).
**Data needed:** YES — seed `Challenge` rows in Supabase.

#### C2. Wire `/challenges/daily` and `/challenges/weekly`
**Files:** `app/(app)/challenges/daily/client.tsx`, `app/(app)/challenges/weekly/client.tsx`
**What:** Query today's/this week's challenges. Show submission form. Track completion.
Award XP via `XPTransaction`.
**Data needed:** Challenge rows with `type: DAILY` or `type: WEEKLY`.

#### C3. Wire `/leaderboards` to real data
**Files:** `app/(app)/leaderboards/client.tsx`
**What:** Query `LeaderboardEntry` model. Show XP rankings.
Filter by period (WEEKLY, MONTHLY, ALL_TIME), chapter, pathway.
**Data needed:** Leaderboard entries auto-populate from XP transactions.
You need a cron job or trigger to aggregate — OR compute on-the-fly from `XPTransaction`.

#### C4. Wire `/rewards` and `/achievements/badges`
**Files:** `app/(app)/rewards/client.tsx`, `app/(app)/achievements/badges/client.tsx`
**What:** Show earned badges, available rewards. Badge detail with rarity.
**Data needed:** YES — seed `Badge` and `BadgeRarity` rows.

#### C5. Wire `/challenges/passport` (Passion Passport)
**Files:** `app/(app)/challenges/passport/client.tsx`
**What:** Show user's passport with collected stamps. Visual passport card UI.
**Data needed:** Stamps auto-populate from challenge completions.

### DATA NEEDED FOR GAMIFICATION

**In Supabase SQL Editor:**

```sql
-- Create some badges
INSERT INTO "Badge" (id, name, description, "iconUrl", criteria, "xpReward",
  "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'First Steps', 'Complete your first module', NULL,
   'Complete 1 learning module', 10, true, NOW(), NOW()),
  (gen_random_uuid(), 'Week Warrior', 'Log practice 7 days in a row', NULL,
   '7-day practice streak', 50, true, NOW(), NOW()),
  (gen_random_uuid(), 'Class Champion', 'Complete all assignments in a class', NULL,
   'Submit all assignments for one class', 100, true, NOW(), NOW());

-- Create some challenges
INSERT INTO "Challenge" (id, title, description, type, status, "xpReward",
  "startDate", "endDate", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Draw Something New', 'Create a digital artwork using a new technique',
   'DAILY', 'ACTIVE', 15, NOW(), NOW() + interval '1 day', NOW(), NOW()),
  (gen_random_uuid(), 'Teach Someone', 'Explain a concept you learned to a friend or family member',
   'WEEKLY', 'ACTIVE', 30, NOW(), NOW() + interval '7 days', NOW(), NOW());
```

---

## PHASE D — Mentorship System (Connect People)

### What Already Exists

```
Mentorship (mentorId, menteeId, type, status)
MentorshipCheckIn (mentorshipId, notes, mood, attendedSession)
MentorFeedbackRequest, MentorResponse
MentorQuestion, MentorAnswer
```

Pages exist but are mostly placeholder.

#### D1. Wire `/mentorship` dashboard
**Files:** `app/(app)/mentorship/page.tsx`
**What:** For mentors: show mentees with last check-in date, upcoming check-ins.
For students: show mentor info, request feedback button.
**Data needed:** Mentorship pairings. Created via `/admin/mentor-match` or manually.

#### D2. Wire `/mentorship/mentees/[id]` detail page
**Files:** `app/(app)/mentorship/mentees/[id]/page.tsx`
**What:** Mentor sees mentee's progress, check-in history, goals, courses.
Can log check-in notes.
**Data needed:** None — reads from existing enrollment + check-in data.

#### D3. Wire `/mentor/feedback` request system
**Files:** `app/(app)/mentor/feedback/page.tsx`
**What:** Student requests feedback on specific work. Mentor sees pending requests.
**Data needed:** None — `MentorFeedbackRequest` model handles it.

---

## PHASE E — Parent Portal (Complete the Loop)

### What Already Exists

```
ParentStudent (parentId, studentId, status, relationship)
ParentNotification
ProgressReport
ParentMessage
ParentSettings
ParentResource
```

#### E1. Wire `/parent/dashboard` to show real student data
**Files:** `app/(app)/parent/dashboard/page.tsx`
**What:** Show linked student's: courses, attendance, practice logs, XP, badges.
**Data needed:** Parent-student links. Created when parent signs up and connects.

#### E2. Wire `/parent/reports` with progress reports
**Files:** `app/(app)/parent/reports/page.tsx`
**What:** Show `ProgressReport` entries. Generate weekly/monthly summaries.
**Data needed:** Auto-generated from student activity. Need a report generation action.

#### E3. Wire `/parent/connect` properly
**Files:** `app/(app)/parent/connect/page.tsx`
**What:** Parent enters student email/code to link accounts.
**Data needed:** None — creates `ParentStudent` row.

---

## PHASE F — Admin Completeness

#### F1. Admin module management (see B5 above)
#### F2. Admin challenge management
**Files:** `app/(app)/admin/challenges/page.tsx` (new)
**What:** Create/edit/schedule challenges. Set XP rewards. View participation.

#### F3. Admin badge management
**Files:** `app/(app)/admin/badges/page.tsx` (new)
**What:** Create badges with criteria. View badge distribution stats.

#### F4. Admin enrollment approval workflow
**Files:** `app/(app)/admin/enrollments/page.tsx` (new)
**What:** Approve/decline pending enrollments. Waitlist management.
**Note:** The admin page currently has enrollment approval inline. This would extract it to a dedicated page.

---

## PHASE G — Quality of Life

#### G1. Keyboard shortcut to toggle sidebar (Cmd+B / Ctrl+B)
**Files:** `components/app-shell.tsx`

#### G2. Animate nav section expand/collapse
**Files:** `app/globals.css`, `components/nav.tsx`

#### G3. Dark mode support
**Files:** `app/globals.css` (add `@media (prefers-color-scheme: dark)` overrides)

#### G4. Better mobile experience
**Files:** `app/globals.css`
**What:** Touch-optimized nav, bottom tab bar for mobile, swipe to open sidebar.

---

## DATA SETUP GUIDE

### Where Your Database Lives

Your app uses **Supabase** (PostgreSQL). The connection is configured via:
- `DATABASE_URL` — points to the pooler (port 6543)
- `DIRECT_URL` — points to the direct connection (port 5432)

### How to Add Data

#### Method 1: Supabase Dashboard (Easiest for one-off data)
1. Go to your Supabase project dashboard
2. Click **Table Editor** in the left sidebar
3. Find the table you want (e.g., `LearningModule`, `Badge`, `Challenge`)
4. Click **Insert Row** and fill in the fields
5. Save

#### Method 2: Supabase SQL Editor (Best for bulk data)
1. Go to your Supabase project → **SQL Editor**
2. Paste the SQL INSERT statements from the sections above
3. Click **Run**

#### Method 3: Prisma Seed Script (Best for reproducible data)
1. Create a file `prisma/seed.ts`
2. Add your seed data using Prisma client
3. Add to `package.json`: `"prisma": { "seed": "npx tsx prisma/seed.ts" }`
4. Run: `npx prisma db seed`

#### Method 4: Build Admin Pages (Best long-term)
Phases B5, F2, F3 above create admin UI for managing this data.
Once built, you never need to touch SQL again.

### What Tables Need Data (and What's Auto-Generated)

| Table | Need to Seed? | How |
|-------|--------------|-----|
| `LearningModule` | YES | Supabase Table Editor or SQL |
| `Badge` | YES | Supabase Table Editor or SQL |
| `BadgeRarity` | YES | Supabase Table Editor or SQL |
| `Challenge` | YES | Supabase Table Editor or SQL — create daily/weekly challenges |
| `ClassTemplate` | NO | Instructors create via Curriculum Builder page |
| `ClassOffering` | NO | Instructors create via Class Settings page |
| `Course` | Probably already seeded | Check if you have data |
| `Pathway` | Probably already seeded | Check if you have data |
| `PathwayStep` | Probably already seeded | Check if you have data |
| `TrainingModule` | YES if using instructor training | Supabase Table Editor |
| `GoalTemplate` | YES for predefined goals | Supabase Table Editor |
| `ParentResource` | YES for parent portal | Supabase Table Editor |
| `CuratedResource` | YES for mentor resources | Supabase Table Editor |
| `DailyInspiration` | YES for motivation page | Supabase Table Editor |
| `PortfolioTemplate` | YES for portfolio templates | Supabase Table Editor |
| `Enrollment` | NO | Students enroll via UI |
| `Mentorship` | Manually or via admin | Admin creates pairings |
| `XpTransaction` | NO | Auto-generated by actions |
| `LeaderboardEntry` | NO | Computed from XP data |
| `ModuleWatchProgress` | NO | Auto-generated when students watch modules |
| `PracticeLog` | NO | Students log via UI |
| `AttendanceRecord` | NO | Instructors mark via UI |

### Checking What Data Exists

In Supabase SQL Editor, run:
```sql
SELECT COUNT(*) FROM "LearningModule";
SELECT COUNT(*) FROM "Badge";
SELECT COUNT(*) FROM "Challenge";
SELECT COUNT(*) FROM "Course";
SELECT COUNT(*) FROM "Pathway";
```

If these return 0 for the things you need, that's what you need to seed.

### Running Migrations

If you add new columns or models to `schema.prisma`:
```bash
npx prisma migrate dev --name describe_your_change
npx prisma generate
```

For the current plan, NO schema changes are needed. Everything uses existing models.

---

## PRIORITY ORDER (What to Build First)

### Tier 1 — High Impact, Foundation (Do First)
1. **B1** Wire `/learn/modules` to real data + **B2** Module viewer page
2. **B5** Admin module management (so you can add content)
3. **B3** Wire `/learn/practice` to real data
4. **A1** Persist nav collapsed state

### Tier 2 — Engagement & Stickiness
5. **C1-C2** Wire challenges hub + daily/weekly
6. **C3** Wire leaderboards
7. **C4** Wire badges/rewards
8. **A4** Notification badges on nav

### Tier 3 — Community & Connection
9. **D1-D2** Mentorship dashboard + mentee detail
10. **E1-E3** Parent portal wiring
11. **D3** Mentor feedback system

### Tier 4 — Polish & Admin
12. **A2** Nav search
13. **A3** Admin section sub-groups
14. **F2-F3** Admin challenge/badge management
15. **B4** Self-paced progress dashboard

### Tier 5 — Quality of Life
16. **G1** Keyboard shortcuts
17. **G2** Nav animations
18. **G3** Dark mode
19. **G4** Mobile improvements
