# N1 — Student Operating System (the Growth Engine)

> **Phase N1** of the Action Tracker 3.0 / YPP operating-system roadmap. M1 built the
> mentorship foundation; M2 built matching, dashboards, recommendations, mentor/mentee
> command centers, and the **Action Tracker bridge** (`lib/action-tracker-3/mentorship-bridge`)
> that deliberately left N1 unbuilt. This document is the design N1 implements: the unified
> **Growth Engine** that turns "many disconnected features" into "one journey where every
> action contributes toward meaningful growth."
>
> Everything here is **additive, flag-gated (`ENABLE_GROWTH_OS`), deterministic, typed, and
> unit-tested.** Nothing replaces an existing system; the engine *consumes* events the rest of
> the platform emits and *feeds* a single progression hierarchy.

---

## 0. Thesis

Current portals track **activity**. N1 tracks **growth**. The system is built to answer one
question — *"Who is this student becoming?"* — and five operational follow-ups the
`/my-growth` command center renders:

1. **Who am I?** — the Growth Profile (development, not demographics).
2. **What am I working toward?** — the Vision → Goal → Milestone → Action hierarchy.
3. **What have I achieved?** — the Achievement Engine.
4. **What should I do next?** — the Opportunity Engine (deterministic, explainable).
5. **What is blocked / what did I recently accomplish?** — the ProgressEvent timeline + rollup.

The feel we are after is **Duolingo progression / LinkedIn career growth / Scout advancement /
RPG character development** — not an LMS.

### Non-negotiable constraints (carried from the Action Tracker 3.0 doc)

- **Additive-only schema.** New `Growth*` models; no edits to existing tables' semantics. The
  one touch to `User` is new back-relations (Prisma requires them; zero data change).
- **No duplicate systems.** The mentorship lifecycle stays in M1/M2; N1 *links into* it through
  the existing bridge. Goals/milestones/actions that originate in mentorship are seeded, not
  forked.
- **Deterministic & explainable.** No "AI growth paths." Every achievement and every
  recommendation is a pure function of typed inputs and is **reproducible** and **unit-tested**.
- **House style.** `"use server"` → `requireX()`/session guard → zod-ish validation → prisma →
  `revalidatePath`; TEXT vocabularies validated in app code (no new Postgres enums except the
  two stable `Growth*` enums); idempotency via `dedupeKey`/unique constraints, mirroring
  `InstructorGrowthEvent`.
- **Flag-gated & reversible.** Schema/migration ship regardless; `ENABLE_GROWTH_OS` gates every
  page, server action, and emit hook. Off ⇒ `/my-growth` is `notFound()`, emits are no-ops,
  existing behavior is byte-for-byte unchanged.

---

## 1. The hierarchy: Vision → Goal → Milestone → Action

The kickoff ladder becomes real data, namespaced `Growth*` to avoid colliding with the
deprecated `Goal` (schema L3392) and the various `*Milestone`/`*ActionItem` tables.

```
Vision     "Become a leader in STEM education."        GrowthVision
  └ Goal      "Launch first STEM course."              GrowthGoal
      └ Milestone  "Create curriculum."                GrowthMilestone
          └ Action  "Draft syllabus"                   GrowthAction
                    "Build lesson 1"
                    "Build lesson 2"
                    "Submit for approval"
```

- A **Vision** is optional and top-level ("who I'm becoming"). A Goal can stand alone under no
  vision (skip-level), matching how M2's bridge emits standalone goals.
- A **Goal** can hold Milestones *and/or* direct Actions (skip-level).
- A **Milestone** holds Actions.
- An **Action** is the leaf; it may attach to a Milestone, directly to a Goal, or float (inbox).

**Rollup math** (`lib/growth/hierarchy.ts`, pure):
- Milestone progress = `done / (total non-DROPPED actions)`.
- Goal progress = weighted blend of its milestones' progress + its direct actions' progress
  (milestones and direct actions are pooled by their action counts so a goal with 1 milestone
  of 4 actions and 0 direct actions reads identically whether modeled flat or nested).
- Vision progress = mean of its active goals' progress.
- A Goal/Vision is **ACHIEVED** when progress = 1; **blocked** items are surfaced (an Action
  marked `BLOCKED`, or a Goal with a past `targetDate` and progress < 1).

`source`/`sourceRef` on every node records provenance ("manual", "mentorship", "class", …) and
a back-link id, so the engine can dedupe seeded nodes and the UI can say *"from your mentorship
with Dana."*

---

## 2. Growth Profile evolution

`GrowthProfile` (1:1 `User`) captures **development**, not demographics or permissions:

- `careerInterests`, `leadershipInterests`, `impactInterests` — direction.
- `skills`, `confidenceAreas`, `growthAreas` — current state.
- cached `achievementCount`, `completedExperiences`, `lastEventAt`, `lastRecomputedAt` — fast
  dashboards without a fan-out query on every page load.

The profile **evolves**: `lib/growth/profile.ts` (pure) derives interests/skills from existing
signals (the mentorship application's interests/goals, `UserProfile.careerGoal/leadershipGoal`,
earned achievements' categories) and produces a deterministic *"becoming"* summary line. The
recompute step writes the cached counters; the interest/skill arrays are user-editable and
additively merged (never silently overwritten).

---

## 3. Achievement Engine

Achievements are **first-class and meaningful**, never random badges. Every definition declares
a `category` tying it to a growth dimension:

`LEADERSHIP | IMPACT | TEACHING | MENTORSHIP | PROJECT | CHAPTER | COMMUNITY`

Definitions live in a code registry (`lib/growth/achievements.ts`) — deterministic, versioned in
git, diffable — and are **snapshotted** onto the earned `GrowthAchievement` row (title/category)
so history is stable even if a definition's copy later changes. Evaluation is a pure function
over an `AchievementInput` (event-type counts + a few derived signals):

```
evaluateAchievements(input)  → EarnedAchievement[]   // every definition whose criteria are met
nextAchievements(input)      → LockedAchievement[]   // not-yet-earned, with progress 0..1 + "what unlocks it"
```

This answers both *"What did I accomplish?"* and *"What can I unlock next?"* Awards are
**idempotent** (`@@unique([userId, key])`); re-running the engine never double-awards.

Representative definitions (each connects to leadership / impact / teaching / mentorship /
project / chapter / community):

| key | category | unlocked by |
|---|---|---|
| `first_class_taught` | TEACHING | ≥1 `CLASS_PUBLISHED` |
| `reached_25_students` | IMPACT | `CLASS_REACHED_25_STUDENTS` |
| `reached_100_students` | IMPACT | `CLASS_REACHED_100_STUDENTS` |
| `highly_rated_instructor` | TEACHING | `CLASS_HIGH_RATING` |
| `instructor_trained` | TEACHING | `INSTRUCTOR_TRAINING_COMPLETED` |
| `mentor_matched` | MENTORSHIP | ≥1 `MENTOR_MATCHED` |
| `mentorship_graduate` | MENTORSHIP | ≥1 `MENTORSHIP_COMPLETED` |
| `chapter_member` | CHAPTER | ≥1 `CHAPTER_JOINED` |
| `chapter_recruiter` | CHAPTER | ≥5 `CHAPTER_MEMBER_RECRUITED` |
| `event_host` | CHAPTER | ≥1 `CHAPTER_EVENT_HOSTED` |
| `partnership_builder` | CHAPTER | ≥1 `CHAPTER_PARTNERSHIP_LAUNCHED` |
| `community_servant` | COMMUNITY | ≥3 `SERVICE_HOURS_LOGGED` |
| `certified` | IMPACT | ≥1 `CERTIFICATE_EARNED` |
| `project_launcher` | PROJECT | ≥1 `PROJECT_LAUNCHED` |
| `project_finisher` | PROJECT | ≥1 `PROJECT_COMPLETED` |
| `emerging_leader` | LEADERSHIP | ≥1 `LEADERSHIP_ROLE_EARNED` |

---

## 4. Opportunity Engine (deterministic recommendations)

> *"Do not use AI hand-waving. Build deterministic recommendation logic. Every recommendation
> must explain WHY."*

`lib/growth/opportunities.ts` (pure) maps an `OpportunityInput` (profile interests, earned
achievement keys, event counts, hierarchy state, current tracks/roles) → a ranked list of
`Opportunity` objects. Each carries a `kind`, a `score` (capped, explainable), and a **`reason`
string that is literally the WHY** — the same text shown to the student.

`kind`: `CLASS | LEADERSHIP_ROLE | PROJECT | MENTORSHIP_ACTION | INSTRUCTOR_MILESTONE |
CHAPTER_RESPONSIBILITY`.

The engine is a set of declarative **rules**; each rule is a pure predicate + a builder:

| rule | fires when | recommends (reason) |
|---|---|---|
| `apply_for_mentor` | has career/leadership interests, no active mentorship | "You've set career interests (…) but don't have a mentor yet." |
| `complete_instructor_training` | taught ≥1 class, not `instructor_trained` | "You've taught a class but haven't completed instructor training." |
| `next_class_in_interest` | completed ≥1 class, has interests | "You finished a class and are interested in …; here's the next one." |
| `run_for_chapter_role` | chapter member, hosted ≥1 event, no leadership role | "You're active in your chapter (hosted N events) — you're ready to lead." |
| `near_achievement` | a locked achievement is ≥60% to unlock | "You're 1 step from earning '…'." (points at the unlocking action) |
| `start_a_project` | has impact interests, no project launched | "You care about impact (…) but haven't launched a project." |
| `advance_mentorship_action` | active mentorship with an open seeded action | "Your mentorship has an open next step: …." |
| `finish_stalled_goal` | a goal past `targetDate`, progress < 1 | "'…' is past its target date and only N% done." |

Rules are **ordered, scored, and tie-broken by key** → fully reproducible. Results are persisted
to `GrowthOpportunity` (idempotent `@@unique([userId, key])`) so a student can **dismiss** one
(status `DISMISSED`) and it won't be re-suggested, and so analytics can see what was offered.

---

## 5. Event-driven design (the ProgressEvent layer)

Future systems should not know about the Growth Engine's internals — they just **emit events**.
N1 adds a persisted `GrowthProgressEvent` log and a single ingress:

```
emitGrowthEvent({ userId, type, sourceType, sourceId, ... })   // lib/growth/emit.ts (server)
```

`emitGrowthEvent`:
1. is a **no-op unless `ENABLE_GROWTH_OS`** (so wiring it everywhere is safe to ship dark);
2. **persists** the event idempotently (`@@unique([userId, dedupeKey])`, `dedupeKey =
   "<type>:<sourceId>"` by default);
3. triggers `recomputeGrowthForUser(userId)` — re-evaluates achievements + opportunities + the
   profile counters — all **best-effort** (`try/catch`, like the existing `onProgressEvent`).

Canonical event types (TEXT vocabulary, validated in `lib/growth/constants.ts`):

```
CLASS_PUBLISHED  CLASS_COMPLETED  CLASS_REACHED_25_STUDENTS  CLASS_REACHED_100_STUDENTS
CLASS_HIGH_RATING  INSTRUCTOR_TRAINING_COMPLETED
MENTOR_MATCHED  MENTORSHIP_GOAL_SET  MENTORSHIP_MILESTONE_REACHED  MENTORSHIP_COMPLETED
CHAPTER_JOINED  CHAPTER_MEMBER_RECRUITED  CHAPTER_EVENT_HOSTED  CHAPTER_PARTNERSHIP_LAUNCHED
CHAPTER_MEETING_ATTENDED  SERVICE_HOURS_LOGGED
LEADERSHIP_ROLE_EARNED  CERTIFICATE_EARNED  PROJECT_LAUNCHED  PROJECT_COMPLETED
```

Each type maps (in `lib/growth/events.ts`, pure) to a `track`, a `category`, and a default
human title, so the timeline and the achievement counts derive from one registry.

---

## 6. Integrations (one engine, many tracks)

Different tracks, **same engine**. N1 unifies instructor / mentorship / chapter / hiring /
leadership progression behind the `GrowthTrack` dimension and the single hierarchy.

- **Mentorship (reuse the M2 bridge).** `lib/growth/mentorship-integration.ts` consumes the
  existing `createMentorshipActionSeed(match)` from `lib/action-tracker-3/mentorship-bridge` and
  maps its `goals/milestones/firstSteps` into **GrowthGoal / GrowthMilestone / GrowthAction**
  rows (provenance `source="mentorship"`, `sourceRef=mentorshipId`, idempotent). Mentorship
  goals *become* Goals; mentorship milestones *become* Milestones; mentorship actions *become*
  Actions. **No duplicate system.** The pure mapping is unit-tested.
- **Classes.** `CLASS_PUBLISHED` / `CLASS_COMPLETED` / `CLASS_REACHED_*` / `CLASS_HIGH_RATING` /
  `INSTRUCTOR_TRAINING_COMPLETED` events feed teaching/impact achievements and the instructor
  track automatically.
- **Chapters.** `CHAPTER_JOINED` / `CHAPTER_MEMBER_RECRUITED` / `CHAPTER_EVENT_HOSTED` /
  `CHAPTER_PARTNERSHIP_LAUNCHED` / `CHAPTER_MEETING_ATTENDED` become evidence of growth.
- **Leadership / Instructor / Hiring tracks.** `lib/growth/tracks.ts` reuses the existing
  `lib/growth-pathway.ts` (`TRACKS`) and `lib/leadership-pathway.ts` so the Growth Engine reads
  the *same* role ladder copy already in the app — different tracks, one progression model.

**Wiring policy for V1.** The engine and the bridge integration are fully built and tested. Emit
hooks are added at a small, **safe, clearly-additive** set of call sites (each `if
(isGrowthOsEnabled()) try { await emitGrowthEvent(...) } catch {}`), and the remaining domain
sites are enumerated here for follow-up — consistent with the repo's flag-gated, incremental
rollout philosophy. A backfill (`lib/growth/backfill.ts`, invocable from a script) can replay
historical signals into events for an initial population.

---

## 7. Dashboards

- **Student command center** — `/my-growth` (`app/(app)/my-growth`). Renders the five answers:
  identity (profile + becoming line), the hierarchy with rollup, achievements (earned + next),
  opportunities (with WHY), the recent ProgressEvent timeline, and what's blocked. This is the
  future centerpiece that will absorb scattered progression surfaces.
- **Admin growth dashboard** — `/admin/growth` (foundation): population counters, achievement
  distribution by category, opportunity demand, event volume by track. *Infrastructure, not
  giant analytics* — the queries are simple aggregates with room to grow.
- **Leadership dashboard** — a leadership lens on the same data (track coverage, who's advancing,
  who's stalled), guarded by `requireLeadership()`.

---

## 8. Data model (additive)

New enums: `GrowthTrack`, `GrowthObjectiveStatus`.
New models: `GrowthProfile`, `GrowthVision`, `GrowthGoal`, `GrowthMilestone`, `GrowthAction`,
`GrowthAchievement`, `GrowthOpportunity`, `GrowthProgressEvent`.
New `User` back-relations only (no column/semantic changes to `User`).
Migration is hand-written, idempotent (`CREATE TABLE/INDEX IF NOT EXISTS`, guarded FKs), every
column nullable/defaulted — mirroring `20260608170000_add_mentorship_2_foundation`.

---

## 9. Slice plan (this phase)

1. **Architecture** — this document.
2. **Schema** — `Growth*` models + migration + `ENABLE_GROWTH_OS` flag.
3. **Engine** — pure `lib/growth/{constants,events,hierarchy,achievements,opportunities,profile,
   tracks}.ts` + exhaustive unit tests.
4. **Events** — `lib/growth/{emit,recompute}.ts` (server ingress + idempotent recompute).
5. **Dashboards** — `lib/growth/{dashboard,admin-dashboard}.ts` data-layers + `/my-growth` and
   `/admin/growth` routes.
6. **Integrations** — `lib/growth/mentorship-integration.ts` (bridge → hierarchy) + a safe set of
   emit hooks + backfill.
7. **Verification** — full `vitest` suite green, `tsc --noEmit` clean, and a verification report.

---

## 10. Testing philosophy

> *Everything deterministic. Everything typed. Everything explainable. Everything unit tested.
> No magic scoring. No black boxes. No AI-generated growth paths. Every recommendation
> reproducible.*

The pure engine modules import **no** Prisma and **no** server-only code; they take plain typed
inputs and return plain typed outputs, so every achievement award, every recommendation (and its
WHY), every rollup number, and every event mapping is covered by a fast unit test with fixed
inputs and fixed expected outputs. The server layer (emit/recompute/data-layers/actions) is a
thin, flag-gated shell over that tested core.

— End of N1 architecture.
