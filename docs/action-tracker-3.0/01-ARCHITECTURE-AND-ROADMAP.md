# Action Tracker 3.0 — Architecture & Roadmap (Evolution Design)

> **Read `00-ECOSYSTEM-AUDIT.md` first.** This document is the design that the audit
> mandated. It is an **evolution**, not a rebuild: every new construct extends an existing,
> proven model rather than replacing it. Nothing here is implemented yet — this is the spec
> and the phased plan (M1, M2, C1, C2, N1), each phase independently deployable behind flags.

---

## 0. Thesis & Design Principles

**Thesis.** The Action Tracker becomes the **operating system** of YPP by becoming the
**connective tissue** between the subsystems that already exist. Today actions are a flat,
manual, officer-only list bolted to `User` by string seams. We make actions **hierarchical**
(Mission→Goal→Milestone→Action), **relationally wired** (real FKs to Goal, Chapter, Mentorship,
Project, Role-Pathway, Event), **generated** (an event-driven engine creates actions from
domain signals), **owned & accountable** (already strong — preserve), and **visible** (role
dashboards for student/mentor/chapter/officer/regional/national/admin, built on the existing
command-center, turned on).

**Eight principles:**

1. **Evolve the canonical, retire the duplicates.** `ActionItem` (People-Strategy) is the one
   action spine. `LeadershipActionItem` and `MentorshipActionItem` migrate into it.
2. **Wire the seams.** Replace `relatedEntityType/relatedEntityId` (string) with a typed
   `ActionLink` join carrying real FKs; add first-class `goalId`, `chapterId`, `parentActionId`.
3. **Generate, don't just track.** Add an `ActionRule`/`ActionGenerationLog` engine driven by
   the events the platform already emits (missed meetings, new assignments, launches, alerts).
4. **One nervous system, many lenses.** Reuse the FK-integrated Mentorship+Goals+Review+Points
   triad as the model for *all* cross-cluster integrity; everything rolls up through it.
5. **Make work earn.** Completing meaningful actions/milestones writes to **one** unified
   points/recognition spine — closing the incentive gap.
6. **Surface what's computed.** Chapter health, momentum, and (new) student-engagement risk
   already have most inputs; compute composite scores and put them in front of the right people.
7. **Flag-gated, independently deployable, reversible.** Every phase ships behind an `ENABLE_*`
   flag; schema is additive; legacy removal happens only after a verified backfill.
8. **Preserve the house style.** `"use server"` → `requireX()` guard → zod → prisma →
   `revalidatePath`; cron via `Bearer ${CRON_SECRET}`; notifications via `deliverNotification`.

**Non-negotiable constraints derived from the audit:**
- Keep `ActionItem` as the table (don't fork a 4th action system).
- Don't break the live mentorship loop or the instructor pipeline.
- Honor the single-tenant reality (Scarsdale) while making the chapter model genuinely
  multi-tenant-correct so a 2nd chapter is a data operation, not a code change.

---

## PART 1 — THE ACTION TRACKER 3.0 CORE MODEL

### 1.1 The hierarchy: Mission → Goal → Milestone → Action

The kickoff's ladder becomes real data. We **reuse the existing `ActionItem` table** as the
leaf and add three lightweight ancestors plus self-nesting.

New models (additive):

```prisma
model Mission {                       // org/chapter/role-level "why"
  id            String   @id @default(cuid())
  title         String
  description   String?
  scope         MissionScope          // ORG | CHAPTER | MENTORSHIP | ROLE_PATHWAY | PERSONAL
  chapterId     String?               // FK Chapter  (when scope=CHAPTER)
  ownerId       String                // FK User (accountable)
  status        ObjectiveStatus @default(ACTIVE)  // ACTIVE | ACHIEVED | ARCHIVED
  targetDate    DateTime?
  goals         Goal3[]
  createdAt     DateTime @default(now())
}

model Goal3 {                         // a measurable outcome under a Mission
  id            String   @id @default(cuid())
  missionId     String?               // FK Mission (nullable: a goal can stand alone)
  title         String
  metricUnit    String?               // "recruits", "events", "% retention"
  targetValue   Float?
  currentValue  Float?  @default(0)
  ownerId       String                // FK User
  chapterId     String?               // FK Chapter
  status        ObjectiveStatus @default(ACTIVE)
  dueDate       DateTime?
  milestones    Milestone[]
  actions       ActionItem[]          // direct actions allowed (skip-level)
}

model Milestone {                     // a checkpoint under a Goal
  id            String   @id @default(cuid())
  goalId        String                // FK Goal3
  title         String
  status        ObjectiveStatus @default(ACTIVE)
  dueDate       DateTime?
  order         Int     @default(0)
  actions       ActionItem[]
}
```

> **Naming note.** `Goal3`/the suffix avoids colliding with the deprecated `Goal` (L3276) and
> the mentorship `GRDocumentGoal`. During M-phase we evaluate aliasing to `StrategicGoal`. The
> existing `GRDocumentGoal` (mentorship) stays as-is and links *into* this hierarchy via the
> new `ActionItem.goalId`, so the one good triad is preserved, not duplicated.

Additive columns on `ActionItem` (the leaf):

```prisma
// on model ActionItem
goalId          String?   // FK Goal3       (replaces free-text goalCategory as the real link)
milestoneId     String?   // FK Milestone
parentActionId  String?   // self-FK: sub-actions (e.g. "Schedule interviews" under "Interview candidates")
chapterId       String?   // FK Chapter     (geographic scope, distinct from functional Department)
```

`goalCategory` (free text) is retained read-only for one phase, then backfilled into `goalId`
and dropped. This delivers the kickoff's examples directly:

```
Mission "Become Chapter President"
  └ Goal "Recruit leadership team"
      └ Milestone "Interview candidates"
          └ Action "Schedule interviews"  (parentActionId → "Interview candidates" action, optional)
```

Roll-up math (pure helpers in `lib/action-os/rollup.ts`): a Milestone's progress = % of its
non-DROPPED actions COMPLETE; a Goal's = weighted milestones + direct actions, or
`currentValue/targetValue` when metric-driven; a Mission's = avg of its goals. These power the
new strategic dashboards (Part K) and the "every action belongs to something larger" promise.

### 1.2 Typed links: replace the string seam

```prisma
model ActionLink {
  id            String   @id @default(cuid())
  actionId      String                 // FK ActionItem (cascade)
  linkType      ActionLinkType         // MENTORSHIP | CLASS_OFFERING | USER | INSTRUCTOR_APPLICATION |
                                       // PARTNER | CHAPTER | EVENT | PROJECT | ROLE_PATHWAY | GOAL
  // exactly one of these is set, enforced in app + a CHECK-style guard:
  mentorshipId  String?  // FK Mentorship
  classOfferingId String? // FK ClassOffering
  subjectUserId String?  // FK User
  applicationId String?  // FK InstructorApplication
  chapterId     String?  // FK Chapter
  eventId       String?  // FK Event
  projectId     String?  // FK ProjectBase (Part G)
  rolePathwayId String?  // FK RolePathwayEnrollment (Part I)
  @@index([actionId])
}
```

This preserves the *polymorphic ergonomics* officers already use (`getActionsForEntity(type,id)`)
while adding referential integrity, cascade-on-delete, and the ability to query "all actions
for this chapter/mentorship/goal" with a real join. `ActionItem.relatedEntityType/Id` is
backfilled into `ActionLink` and then dropped (Migration §L.6).

### 1.3 Action Sources & the Generation Engine (the biggest gap)

Every action gets a **source**, and most actions become **generated**, not typed.

```prisma
model ActionItem {
  // ... existing ...
  source        ActionSource @default(MANUAL)   // see enum below
  generatedByRuleId String?                     // FK ActionRule (when source=AUTOMATION)
}

enum ActionSource {
  MANUAL
  MENTORSHIP_MEETING  CHAPTER_MEETING  PROJECT  LEADERSHIP_PROGRAM  APPLICATION
  INSTRUCTOR_DEVELOPMENT  STUDENT_GOAL  EVENT  FEEDBACK  PERFORMANCE_REVIEW
  CHAPTER_HEALTH_ALERT  RISK_ALERT  AUTOMATION
}

model ActionRule {                    // declarative generator
  id            String   @id @default(cuid())
  key           String   @unique      // "missed_mentorship_meeting", "new_chapter_officer", ...
  trigger       ActionTrigger         // the domain event it listens to
  enabled       Boolean  @default(true)
  templateId    String?               // FK ActionTemplate (reuse existing playbook!)
  defaultPriority ActionPriority @default(MEDIUM)
  deadlineOffsetDays Int @default(3)
  dedupeWindowHours Int @default(168) // don't regenerate the same action within N hours
}

model ActionGenerationLog {           // idempotency + audit (mirrors ActionEmailLog pattern)
  id            String   @id @default(cuid())
  ruleId        String
  dedupeKey     String   @unique      // "<ruleKey>:<entityId>:<period>"
  actionId      String?               // the action created (null if suppressed)
  createdAt     DateTime @default(now())
}
```

**The engine** (`lib/action-os/generation.ts`, `runActionGeneration(now)`), invoked by a new
cron `/api/cron/action-generation` and by inline hooks at the relevant mutation sites. It maps
each kickoff source to an existing signal:

| Source / trigger | Existing signal to hook | Generated action (template) |
|---|---|---|
| **Missed mentorship meeting** | `MentorshipSession` past `scheduledAt`, no `completedAt` | "Re-schedule mentorship meeting" → Lead = mentor, link → Mentorship |
| **New mentor assignment** | `assignSupportCircleMember` / `approveMentorMatch` | "Run kickoff", "Set goals" → Lead = mentor |
| **New chapter officer** | role grant → `CHAPTER_PRESIDENT` / new `ChapterRole` (Part F) | "Officer onboarding", "Meet the team" |
| **Project launch** | `ProjectBase` status → active (Part G) | "Assign roles", "Hold kickoff" |
| **Upcoming event** | `Event.startDate` within N days, low RSVP | "Promote event", "Confirm logistics" → Lead = organizer |
| **Low engagement signal** | new **StudentEngagementScore** = AT_RISK (Part K) | "Check in with <student>" → Lead = mentor/officer |
| **Feedback outcome** | `FeedbackRequest` / class feedback flagged | "Address feedback" → Lead = subject's manager |
| **Leadership promotion** | `RolePathway` stage advance (Part I) | "Begin <next role> onboarding" |
| **Missed deadline / overdue** | existing overdue sweep | (already exists — keep) |
| **Chapter health / risk alert** | `ChapterKpiSnapshot.isAtRisk`, `OpsRuleViolation` | "Resolve <riskFlag>" → Lead = president |
| **Application stalled** | `WorkflowItem` stage age | "Advance applicant" → Lead = reviewer |

Reuse: the engine **creates `ActionItem`s through the existing `createActionItem` core**, sets
`source` + `generatedByRuleId`, links via `ActionLink`, and dedupes via `ActionGenerationLog`
exactly like `ActionEmailLog`. Notifications flow through the existing `notifyNewActionAssignments`
+ `deliverNotification`. **No new notification framework.**

### 1.4 Ownership/accountability (preserve + extend)

The 3-role model (`LEAD`/`EXECUTING`/`INPUT`) and the 48h→7d escalation chain are kept as-is
(they're good). Extensions: (a) generated actions get a sensible default Lead from the source
entity; (b) the `unassigned` preset bug is fixed by switching its predicate to "no EXECUTING
assignment" (since `leadId` is always set); (c) accountability roll-up — a Goal/Mission owner
sees every stuck descendant action in one place (Part K).

---

## PART A — The YPP Journey Map

Every journey is modeled as a sequence of **role/stage transitions**, each with entry criteria,
the actions that move you forward, and the next transition — so there are **no dead ends.**

```
Student ─▶ Class ─▶ Mentor ─▶ Leadership Program ─▶ Chapter ─▶ Project ─▶ Instructor
Student ─▶ Chapter ─▶ Coordinator ─▶ Officer ─▶ VP ─▶ President ─▶ Regional ─▶ National
Student ─▶ Mentor ─▶ Research/Incubator Project ─▶ Instructor
Student ─▶ Volunteer (ServiceProject) ─▶ Team Lead ─▶ Director
Instructor ─▶ Senior ─▶ Lead ─▶ Mentor ─▶ Org Leadership
```

**Dead ends the map closes (from audit §12):**
- Mentorship `COMPLETE` → **Alumni** transition (Part B lifecycle) instead of a void.
- Chapter "member" → **Coordinator/Officer/VP** rungs (Part F) instead of member-or-president.
- Leadership Pathway gates → **real promotions** (Part I) instead of localStorage.
- At-risk students → **generated check-in actions** (Part K + §1.3) instead of silence.
- Regional/National → **real roles + entities** (Part F) instead of aspirational copy.

Implementation: a `JourneyMap` config (`lib/journeys/map.ts`) + the `RolePathway` data (Part I)
render a per-user "You are here → next step → exact actions" widget on every dashboard. Each
transition's "exact actions" are templated and (where possible) auto-generated by the engine.

---

## PART B — Mentorship 2.0

The engine exists and is strong; we **complete the lifecycle** and **enrich the profile**, not
rebuild. New/changed:

- **Mentor Profile & expertise taxonomy** — new `MentorProfile` (1:1 `User`) consolidating the
  scattered `UserProfile.mentor*` fields + a real `ExpertiseArea` taxonomy
  (`MentorExpertise` join) so matching can score domain fit (Part C). Capacity/availability
  already modeled (`MentorAvailabilityRule/Override`, `mentorCapacity`, hard cap 3) — fold in.
- **Lifecycle endpoints** the audit found missing:
  - **Application** — `MentorshipApplication` (mentee-initiated interest + goals) feeding the
    matching queue (today mentees can't apply).
  - **Onboarding** — already partly modeled (`kickoffScheduledAt/CompletedAt`,
    `KICKOFF_PENDING`); generate kickoff/goal-setting actions on match (§1.3).
  - **Completion → Alumni** — a `COMPLETE` transition that creates an `AlumniProfile` link and
    an optional "give back" path (become a mentor / answer in `/ask-alum`). Closes the dead end.
- **Goal-model consolidation** — `GRDocumentGoal` becomes the single mentorship goal; the
  legacy `Goal`/`GoalTemplate`/`MentorshipProgramGoal`/`CustomGoal` writers are migrated and
  the legacy models deprecated (finishing the migration the redesign plan started).
- **Already present, surfaced as "2.0" features (no new build):** reflection journals
  (`MonthlySelfReflection`), meeting history (`MentorshipSession`), action items
  (`MentorshipActionItem` → migrate into `ActionItem`), progress tracking (cycleStage/streaks),
  success metrics (effectiveness score), accountability (streaks + escalation).
- **Domain unification** — College Advisor & Alumni remain distinct engines but plug into the
  same `MentorProfile`/`SupportRole`/dashboards so the mentee sees one "my support circle."

---

## PART C — Matching Engine 2.0

Extend the real scorer (`lib/mentorship-hub.ts scoreSupportMatch`), don't replace it. Add:

- **Expertise fit** (new) — overlap of mentee interest/career-goal with `MentorExpertise`
  (weighted highest). Closes the "no expertise taxonomy" gap.
- **Career-goal & leadership-goal fit** — add `UserProfile.careerGoal` + `leadershipGoal`
  (missing today) and score against mentor track/role.
- Keep existing signals: interests, chapter, capacity headroom, availability, profile
  completeness, **mentor-effectiveness**.
- **Four explicit scores** the kickoff asks for, as pure functions over existing data:
  - **Match Quality Score** = the composite `compatibilityPercent` (extended with expertise).
  - **Mentor Capacity Score** = `mentorCapacity − currentLoad` normalized (already computed).
  - **Engagement Score** = mentor's recent session/review completion (from effectiveness inputs).
  - **Relationship Health Score** = per-`Mentorship`: reflection/review streaks + meeting
    recency + last RED rating + days since contact → reuses streak counters + cycleStage.
- Output stays admin-approved (top-3 + `matchReasons[]`), now with a "why this match" expertise
  line and a relationship-health badge after pairing.

---

## PART D — Mentorship Dashboards

Build on `lib/admin-mentorship-command-center.ts` + `lib/mentor-overview.ts` (both exist):

- **Student/Mentee** (`/my-mentor`, consolidated — retire `/my-program`): goals, next meeting,
  reflection-due, support circle, action items, relationship-health.
- **Mentor** (`/mentorship`): priority list (pending reviews, unscheduled kickoffs, quiet
  mentees ≥21d — already computed), per-mentee health, generated action queue.
- **Admin** (`/admin/mentorship`): watchlist (overdue items, inactive relationships,
  over-capacity mentors — already in the command center); add relationship-health sort.
- **Regional/National** (new, Part F roles): chapter-rolled mentorship coverage, at-risk pairs,
  mentor supply/demand by expertise.
- Answers the kickoff questions directly: *who needs help* (health score < threshold),
  *inactive relationships* (cycleStage stale), *overloaded mentors* (capacity score),
  *thriving students* (momentum STRONG + green ratings), *reassign* (low health + low effectiveness).

---

## PART E — Chapter Operating System

Make `Chapter` a real mini-org by adding the membership/role layer the audit found missing and
linking the features that exist.

```prisma
model ChapterMembership {             // replaces "one chapter per User scalar"
  id          String  @id @default(cuid())
  userId      String                  // FK User
  chapterId   String                  // FK Chapter
  status      MembershipStatus @default(ACTIVE)   // ACTIVE | INACTIVE | ALUMNI
  joinedAt    DateTime @default(now())
  leftAt      DateTime?
  @@unique([userId, chapterId])
}

model ChapterRole {                   // the officer hierarchy (Part F)
  id          String  @id @default(cuid())
  membershipId String                 // FK ChapterMembership
  role        ChapterRoleType         // MEMBER..ADVISORY_BOARD (Part F enum)
  termStart   DateTime @default(now())
  termEnd     DateTime?
  appointedById String?
  @@index([membershipId])
}
```

> **Compatibility:** keep `User.chapterId` populated (as the user's *primary* chapter) for one
> phase so nothing breaks; new code reads `ChapterMembership`. Backfill: one membership row per
> existing `User.chapterId`, role inferred from `primaryRole`.

Chapter "mini-org" surface (each tied to existing or new models):
roster (`ChapterMembership`), leadership (`ChapterRole`), events (`Event.chapterId` ✓), projects
(Part G, new `ProjectBase.chapterId`), goals (`ChapterGoal` ✓ — now also `Goal3` scope=CHAPTER),
recruitment (`Position`/`Application` ✓), retention (engagement scores, Part K), communications
(`ChapterChannel`/`ChapterUpdate` ✓), budget (**new** `ChapterBudgetRequest`), impact (`ServiceProject`
hours + project impact), documentation (**new** `ChapterDocument`), succession (**new**
`SuccessionPlan` referencing `ChapterRole`), health (Part H), dashboard (existing command center
+ health surfacing).

All of it flows through actions: chapter meetings, recruitment drives, events, succession, and
projects each generate `ActionItem`s (`chapterId` set, `source` tagged) that roll up to chapter
`Goal3`/`Mission`.

---

## PART F — Chapter Leadership Hierarchy (and Regional/National)

The real ladder, as data, replacing the single `CHAPTER_PRESIDENT`:

```prisma
enum ChapterRoleType {
  MEMBER  COORDINATOR  OFFICER  VICE_PRESIDENT  PRESIDENT
  REGIONAL_LEAD  NATIONAL_LEAD  ADVISORY_BOARD
}

model Region {                        // closes the "regional/national is vapor" gap
  id     String @id @default(cuid())
  name   String @unique
  chapters Chapter[]
  leadId String?                      // FK User (Regional Lead)
}
// Chapter gains: regionId String?  (replaces the free-text region string, kept for one phase)
// A National layer = Region with a parent, or a singleton NationalTeam config + NATIONAL_LEAD roles.
```

Each role carries **responsibilities / requirements / privileges / promotion criteria /
training** as config in `lib/chapter/roles.ts` (rubric-style, like the existing leadership
pathway copy) **plus** real enforcement: privileges map to `requireChapterRole(roleType)` guards;
promotion criteria are evaluated by the Leadership Pipeline (Part I) and, when met, generate a
"Promotion ready" action for the appointing authority. This makes "what role am I / what's next
/ exactly how to get there" a live, data-backed answer.

---

## PART G — Projects System (unify the four)

Introduce a thin shared base; keep the rich subtype tables as detail.

```prisma
model ProjectBase {
  id          String @id @default(cuid())
  kind        ProjectKind   // PERSONAL | INCUBATOR | SERVICE | GROUP | CHAPTER
  title       String
  chapterId   String?       // FK Chapter  (finally a real link)
  ownerId     String        // FK User
  status      ProjectStatusUnified
  // subtype detail rows reference back:
  trackerId   String?  // FK ProjectTracker
  incubatorId String?  // FK IncubatorProject
  serviceId   String?  // FK ServiceProject
  groupId     String?  // FK GroupProject
}
model ProjectTeamMember { id String @id; projectId String; userId String; role String? }
```

Unify creation/teams/milestones/updates/deliverables/impact/recognition behind `ProjectBase`
while the existing `IncubatorProject` (best-in-class, 6-phase) remains the reference detail
implementation. Projects generate actions (`source=PROJECT`, `chapterId` set) and roll up to
chapter `Goal3`/`Mission`. Recognition on project completion writes to the unified spine
(Part 1.5 / Part K).

---

## PART H — Chapter Health Engine

The inputs exist (`ChapterKpiSnapshot`, `OpsRule`/`OpsRuleViolation`); we add the **composite
score**, **surface it to operators**, and **schedule the job**.

- `chapterHealthScore(snapshot)` (pure, `lib/chapter/health.ts`): weighted blend of recruitment,
  retention, attendance, event activity, project activity, leadership stability, mentorship
  participation, member satisfaction → 0–100 + band (THRIVING/HEALTHY/AT_RISK/CRITICAL).
- **Surface it** on the chapter Command Center (today it only charts raw KPIs) — a health header
  + risk banner + growth signals, for presidents/officers, not just admins.
- **Risk alerts → actions**: `isAtRisk`/`riskFlags`/`OpsRuleViolation` generate `ActionItem`s
  (`source=CHAPTER_HEALTH_ALERT`, Lead = president) via the engine.
- **Schedule** `computeAllChapterSnapshots` on a daily cron (it exists but is unscheduled).

---

## PART I — The Leadership Pipeline (the most important section)

Replace the localStorage mock with a real progression system, and **revive the dead
`PromotionRecommendation`** as its approval record.

```prisma
model RolePathway {                   // the ladder definition (config-backed, but stored)
  id        String @id @default(cuid())
  track     PathwayTrack             // STUDENT | INSTRUCTOR | CHAPTER_LEADERSHIP | MENTOR | ORG
  stages    RolePathwayStage[]
}
model RolePathwayStage {
  id        String @id; pathwayId String; order Int
  roleKey   String                   // maps to RoleType / ChapterRoleType / InstructorGrowthTier
  title     String
  criteria  Json                     // measurable gates (actions done, milestones, tenure, ratings)
}
model RolePathwayEnrollment {        // per-user progress (replaces localStorage)
  id        String @id; userId String; pathwayId String
  currentStageId String
  evidence  RolePathwayEvidence[]    // real, server-persisted (was localStorage)
}
// revive: PromotionRecommendation becomes the approval artifact when criteria are met.
```

Flow: the existing signals already feed stage inference (`inferLeadershipStage`); we **persist**
the stage on `RolePathwayEnrollment`, **evaluate criteria server-side**, and when met, create a
`PromotionRecommendation` (status PENDING) + a generated "Review promotion" action for the
approver. Approval performs the **actual role change** (the transaction pattern already used by
application approval) and records who/when/why. This unifies `InstructorGrowthTier` (XP) and the
leadership stages by mapping both to `RolePathwayStage.roleKey`, ending the "two divergent
seniority answers" problem (audit §6.4). Every student sees: current role, target role, required
milestones, required actions (generated), and progress — exactly the kickoff's Part I demand.

---

## PART J — Network Effects

Build on the existing `lib/people-strategy/connections.ts` + `public-profile.ts`:

- **Discovery surfaces:** find mentors by expertise (Part C taxonomy), chapter leaders, open
  projects (`ProjectBase` with `recruiting` team slots), collaborators (shared passions/goals),
  and "future instructors" (high InstructorGrowthTier / pipeline). Reuse the `Activity Hub`
  discovery feed pattern, extended with people/chapters/projects.
- **Connection graph:** a lightweight `Connection` model (follow/collaborated-with/mentored-by)
  feeding "people you should meet" and chapter/region network views. Makes YPP feel like a
  living network (LinkedIn/NHS analogy) rather than forms.

---

## PART K — Analytics (executive + the missing student-engagement layer)

Two thrusts:

1. **Close the #1 gap — student engagement/retention scoring** (audit §7.6). New
   `StudentEngagementScore` (per user, recomputed nightly) from inputs that already exist
   (`lastActiveAt`, streaks, enrollment activity, attendance, action/goal completion,
   mentorship participation) → band STRONG/STEADY/NEEDS_SUPPORT/AT_RISK. Feeds: the engine
   (generates check-in actions), mentor/officer dashboards, and retention analytics. This is
   what makes the platform *act* on disengagement instead of noticing it too late.

2. **Executive dashboards** (reuse the dead-but-built `lib/dashboard/*` framework + pulse
   machinery) answering the kickoff's questions with real queries:
   - *Which actions drive retention / create future leaders / future instructors* — correlate
     completed-action `source`/`goalId` against later role transitions + engagement deltas.
   - *Which chapters execute best* — chapter health score + action completion rate.
   - *Which mentors drive completion* — mentor-effectiveness + mentee outcome deltas.
   - *Where actions get stuck* — overdue/blocked by `source`/`goal`/`chapter` (pulse already
     computes movement).
   - *Who is overloaded / disengaging* — responsibility map (exists) + engagement scores (new).

Recognition/points unify here too: a single `RecognitionEvent` + `PointsLedger` spine (Part 1.5)
that *all* economies write to, so "doing the work that matters earns something" and analytics
can finally tie effort → outcome across the platform.

---

## PART L — Implementation Strategy

### L.1 Full architecture (where things live)

```
lib/action-os/            ← NEW: hierarchy rollup, generation engine, rules, journey map
  rollup.ts  generation.ts  rules.ts  links.ts
lib/people-strategy/*     ← EXISTING canonical action tracker (extended, not replaced)
lib/mentorship-*          ← EXISTING engine (lifecycle endpoints + expertise added)
lib/chapter/*             ← roles.ts, health.ts, membership-actions.ts (membership/officer/health)
lib/journeys/             ← map.ts (Part A) + role-pathway evaluation (Part I)
lib/engagement/           ← NEW: student engagement scoring (Part K)
lib/recognition/          ← NEW: unified RecognitionEvent + PointsLedger spine
app/(app)/actions/*       ← strategic dashboards gain Mission/Goal/Milestone views
app/(app)/{my-mentor,mentorship,chapter,leadership-pathway}  ← wired to real data + dashboards
app/api/cron/action-generation  ← NEW engine cron; reuse CRON_SECRET pattern
```

All server logic keeps the house pattern; all generation/notification reuses
`createActionItem`, `ActionEmailLog`/`ActionGenerationLog` dedupe, and `deliverNotification`.

### L.2 Database model (additive-first)

New models: `Mission`, `Goal3`, `Milestone`, `ActionLink`, `ActionRule`,
`ActionGenerationLog`, `MentorProfile`, `ExpertiseArea`/`MentorExpertise`,
`MentorshipApplication`, `ChapterMembership`, `ChapterRole`, `Region`, `ChapterBudgetRequest`,
`ChapterDocument`, `SuccessionPlan`, `ProjectBase`, `ProjectTeamMember`, `RolePathway`/`Stage`/
`Enrollment`/`Evidence`, `StudentEngagementScore`, `RecognitionEvent`, `PointsLedger`, `Connection`.
New columns: `ActionItem.{goalId, milestoneId, parentActionId, chapterId, source,
generatedByRuleId}`; `UserProfile.{careerGoal, leadershipGoal}`; `Chapter.regionId`.
**Revive:** `PromotionRecommendation` (wire it). **Deprecate-then-drop (post-backfill):**
`LeadershipActionItem*`, `MonthlyGoalReview`, legacy goal models, one XP ledger, `goalCategory`,
`relatedEntityType/Id`, `User.chapterId` (last).

### L.3 Permissions model

- Add `requireChapterRole(roleType)` + region/national guards to `lib/authorization.ts`
  (throw-style) and page mirrors in `lib/page-guards.ts`.
- Unify the role vocabularies behind a single `lib/roles/registry.ts` mapping `RoleType` ×
  `ChapterRoleType` × `RolePathwayStage.roleKey` × `InstructorGrowthTier` so seniority has one
  answer. Keep `RoleType`/`AdminSubtype` as the storage of record.
- Sweep inline `roles.includes("ADMIN")` checks onto the guards (defense-in-depth); add the
  missing edge-layer note (no middleware — guards are the only line).

### L.4 User journeys & L.5 UI map

Journeys: Part A. UI map (per role, what's new vs existing):

| Role | Home dashboard | New surfaces |
|---|---|---|
| Student | `/` student home | engagement nudges, "you are here → next" (Part A/I), my actions w/ goals |
| Mentee | `/my-mentor` (consolidated) | support circle, relationship health, generated actions |
| Mentor | `/mentorship` | health-sorted priority list, generated queue |
| Member/Officer | `/chapter` | role ladder, chapter health header, budget/docs/succession |
| President | `/chapter` | health score + risk→actions, recruitment/retention, succession plan |
| Regional/National | `/region` (new) | chapter rollups, at-risk chapters, mentor supply/demand |
| Admin/Leadership | `/actions/*` (flags on) | Mission/Goal/Milestone strategic views, exec analytics |

### L.6 Migration strategy

1. Ship all new models/columns additively (no removals), flags off.
2. Backfill: `goalCategory`→`goalId` (best-effort to a generated Goal per category);
   `relatedEntityType/Id`→`ActionLink`; `User.chapterId`→`ChapterMembership`(+role);
   `LeadershipActionItem`→`ActionItem` (the existing dry-run script, now run for real once
   verified); finish `MonthlyGoalReview`→`MentorGoalReview` + legacy-goal caller migration;
   dedupe the two XP ledgers into `PointsLedger`; seed `Badge` definitions (so the engine works).
3. Verify (counts, spot-checks, tests) → flip read paths to new models → deprecate writers →
   drop legacy after a full release of soak. Each removal is its own PR.

### L.7 Rollout strategy (flag order)

`ENABLE_ACTION_TRACKER`/`_EMAILS`/`ENABLE_PEOPLE_DASHBOARD` → **on** for the pilot chapter
first (they're already built, just dark). Then, per phase: `ENABLE_ACTION_HIERARCHY`,
`ENABLE_ACTION_GENERATION`, `ENABLE_MENTORSHIP_2`, `ENABLE_CHAPTER_OS`, `ENABLE_ROLE_PATHWAY`,
`ENABLE_ENGAGEMENT_SCORING`, `ENABLE_NETWORK_EFFECTS`. Default-OFF opt-in, enabled for Scarsdale,
then org-wide.

### L.8 Risk analysis

| Risk | Likelihood | Mitigation |
|---|---|---|
| Schema churn on a 432-model DB | High | Additive-only first; one concern per migration; idempotent SQL (repo convention) |
| Breaking the live mentorship loop | High impact | Don't touch the triad's tables; add alongside; keep legacy writers until verified |
| Generation engine spam | Med | `ActionGenerationLog` dedupe + per-rule windows + `enabled` switch + dry-run mode |
| Dual-write drift during migration | Med | Backfill + read-from-new/write-to-both window + reconciliation tests |
| Single-tenant assumptions leaking | Med | `ChapterMembership`/`OfficerMeeting.chapterId` make multi-tenant correct before a 2nd chapter |
| Flag sprawl | Low | One flag per phase, documented in README env table |
| Role-model unification regressions | Med | `lib/roles/registry.ts` is read-only mapping first; storage unchanged |

---

## PHASING (each phase independently deployable behind its own flag)

### Phase M1 — Mentorship Foundation  `ENABLE_MENTORSHIP_2`
- `MentorProfile` + `ExpertiseArea`/`MentorExpertise`; `UserProfile.{careerGoal,leadershipGoal}`.
- `MentorshipApplication` (intake) + `COMPLETE→Alumni` transition.
- Consolidate mentee home (`/my-mentor`; redirect `/my-program`); retire orphaned
  `/admin/mentorship-program` by relocating its imported panels.
- Migrate `MentorshipActionItem` reads onto `ActionItem` via `ActionLink(MENTORSHIP)`.
- **Deployable alone:** enriches mentorship without touching hierarchy/chapters.

### Phase M2 — Matching & Dashboards  `ENABLE_MATCHING_2`
- Extend `scoreSupportMatch` with expertise/career fit; expose Match Quality / Capacity /
  Engagement / Relationship-Health scores.
- Student/Mentor/Admin/Regional mentorship dashboards (Part D) on the existing command center.
- **Deployable alone:** builds on M1's profile/taxonomy; no schema beyond scores (computed).

### Phase C1 — Chapter Operating System  `ENABLE_CHAPTER_OS`
- `ChapterMembership` + `Region`; backfill from `User.chapterId`; surface chapter **health
  score** + risk on the Command Center; schedule `computeAllChapterSnapshots`.
- Budget/docs/succession models; chapter calendar/events/projects linked.
- **Deployable alone:** chapter-scoped; `User.chapterId` kept in sync for compatibility.

### Phase C2 — Leadership & Projects  `ENABLE_CHAPTER_ROLES` / `ENABLE_PROJECTS_UNIFIED`
- `ChapterRole` ladder (Part F) + `requireChapterRole` guards; `RolePathway*` + revived
  `PromotionRecommendation` (Part I) replacing the localStorage pathway.
- `ProjectBase` unification (Part G), chapter-linked, action-generating.
- **Deployable alone:** depends on C1's membership; pipeline can ship before projects or vice versa.

### Phase N1 — Network Effects, Generation Engine & Analytics  `ENABLE_ACTION_GENERATION` /
`ENABLE_ENGAGEMENT_SCORING` / `ENABLE_NETWORK_EFFECTS`
- The Action Hierarchy (`Mission/Goal/Milestone` + `ActionLink`) and the **Generation Engine**
  (`ActionRule`/`ActionGenerationLog` + `/api/cron/action-generation`) — the connective tissue
  that makes mentorship/chapters/projects/pipeline all *flow through actions*.
- `StudentEngagementScore` (closes the #1 gap) + executive analytics (reuse `lib/dashboard/*`).
- Network discovery + `Connection`; unified `RecognitionEvent`/`PointsLedger`.
- **Deployable alone:** the hierarchy/links/engine can be enabled after M/C phases provide the
  entities to link and generate against; engagement scoring + analytics are independent flags.

> **Why this order:** M1/M2 harden the strongest existing asset (mentorship) and are low-risk.
> C1/C2 build the chapter mini-org + real leadership ladder the journey map needs. N1 is the
> capstone that wires it all into the Action Tracker spine and turns on generation + the
> engagement/analytics layer — the actual "central nervous system." Each phase ships value on
> its own; none requires a big-bang cutover.

---

## Appendix — Mapping the kickoff's asks to existing assets (preserve-vs-build at a glance)

| Kickoff ask | Already exists (preserve/surface) | Net-new (build) |
|---|---|---|
| Action hierarchy | `ActionTemplate`, escalation, command center | `Mission/Goal3/Milestone`, `parentActionId`, rollup |
| Action sources / automation | overdue sweep, cron pattern, `ActionEmailLog` | `ActionRule`/`ActionGenerationLog` + engine |
| Mentorship + actions | full review loop, `MentorshipActionItem` | `ActionLink(MENTORSHIP)`, lifecycle ends |
| Matching engine | real scorer + effectiveness | expertise taxonomy, 4 named scores |
| Chapter OS | command center, KPIs, events, comms | `ChapterMembership/Role`, health score, budget/docs/succession |
| Leadership hierarchy | `CHAPTER_PRESIDENT`, pathway copy | `ChapterRoleType` ladder, `Region`, guards |
| Projects | 4 systems (Incubator best) | `ProjectBase` unification, chapter FK |
| Chapter health | `ChapterKpiSnapshot`, `OpsRule` | composite score, operator surfacing, cron |
| Leadership pipeline | inferred stages, dead `PromotionRecommendation` | `RolePathway*`, persisted progress, real promotions |
| Network effects | `connections.ts`, activity hub | discovery surfaces, `Connection` graph |
| Analytics | pulse, momentum, 6 analytics modules, dead `lib/dashboard` | student engagement scoring, exec dashboards (reuse framework) |
| Dashboards | officer/leadership command center (flag-off) | student/mentor/chapter/regional/national surfaces |

— End of architecture & roadmap.
