# Leadership Pathway Rollout — Instructor G&R + Mentorship Redesign

**Branch:** `claude/setup-ypp-architect-env-fT7QX`
**Scope:** Make the YPP instructor leadership pipeline explicit, visible,
prestigious, and operationally consistent across every surface that touches
G&R or mentorship.

## Why

Audit findings (see commit history for full reports):

- Roles were enum names only — no descriptions, no progression narrative,
  no aspirational framing.
- Mentor relationships were stored in the DB but invisible on the user's
  profile.
- Workshop instructors appeared as a flagged subtype rather than members
  of the same leadership pipeline.
- G&R surfaced template goals but never showed the rubric a mentor
  actually uses for promotion decisions.
- `Senior Instructor` and `Lead Instructor` existed only as concepts; no
  surface in the portal taught users what they meant or how to grow into
  them.

## What shipped

### 1. Single source of truth — `lib/leadership-pathway.ts`

Centralized content module containing the official YPP role progression:

- Five stages: **Workshop Instructor → Instructor → Senior Instructor →
  Lead Instructor → Organizational Leadership**.
- For each stage: label, tagline, mission, focus areas, promotion window,
  mentorship pattern, color palette.
- Five G&R goals × three role columns, copy lifted verbatim from the
  official rubric so the portal and the rubric never drift.
- Helper functions: `inferLeadershipStage()`, `getNextStage()`,
  `expectationsForStage()`, `toMenteeRoleTypeFromStage()`.
- Promotion philosophy taglines, mentorship pattern by stage, overall
  role mission statement.

### 2. Per-user resolver — `lib/leadership-context.ts`

`getLeadershipContext(userId)` returns one object containing:

- User identity + chapter + instructor subtype
- Mentorship signals (isMentee, isMentor, mentee count, committee
  chair, org leader)
- Inferred stage + full stage record + next stage + mentorship pattern
- Primary mentor — with the mentor's own inferred stage so we can show
  "Sarah Lin — Senior Instructor"
- Mentees with their stages so a mentor's "instructors I mentor" panel
  is always labeled correctly

Pure read-side. No migration required.

### 3. Reusable visual primitives — `components/leadership-pathway/`

- `stage-ribbon.tsx` — Workshop → Org Leadership ribbon with
  "You are here" callout. Compact mode for tight headers.
- `role-identity-card.tsx` — Warm headline card with mission, focus
  areas, and "what's next" framing.
- `expectations-matrix.tsx` — Five-goal × three-stage rubric with the
  user's stage column highlighted. Single-column mode for tight
  surfaces.
- `mentor-card.tsx` — Prestige-forward "this is your mentor" card
  with avatar, role/stage badge, contact, last-connected warmth
  indicator, and mentorship-pattern blurb tuned to the mentee's stage.
- `mentees-overview.tsx` — Dignified panel listing the instructors a
  mentor develops, with stage chips and distribution mini-bar.
- `workshop-pathway-callout.tsx` — Explicit "workshop instructors are
  part of the same pipeline" framing.

All components are pure presentational. They render the same way
whether they sit on `/my-mentor`, `/leadership-pathway`, `/profile`,
`/my-program/gr`, or the mentee dashboard.

### 4. New canonical page — `/leadership-pathway`

A single, prestigious page that anyone in the portal can land on to
learn the full pipeline:

- The mission (overall role mission verbatim from the rubric)
- The pathway at a glance (stage ribbon with "you are here")
- Each role, in their own words (full stage detail cards)
- Workshop pathway framing for workshop instructors and viewers
- How mentorship flows at each level
- The full five-goal × three-stage rubric (highlighted current stage)
- The user's mentor card (if they have one)
- The user's mentees overview (if they mentor anyone)
- The promotion philosophy (2-4 month windows, mentor-recommended,
  committee-reviewed, tenure alone doesn't promote)
- The five growth areas with one-liners

### 5. Page-by-page wiring

| Page | What changed |
|---|---|
| `/my-mentor` | Was a stub that redirected to `/mentorship`. Now: stage ribbon + role identity + mentor card + mentees + workshop callout + mentorship flow explainer. |
| `/my-program/gr` (active doc) | New: stage ribbon + role identity card + topbar links to mentor/pathway. After the existing document view: the full expectations matrix with current stage highlighted. |
| `/my-program/gr` (no doc yet) | New: role identity card so instructors waiting on a doc still see what they're growing toward + single-column expectations matrix. |
| `/profile` | New: stage ribbon + role identity + mentor card + mentees overview above ProfileMain. |
| `/settings/personalization` (where instructors land) | New: "Role & growth" section with stage ribbon, role identity, mentor card, mentees overview above the account section. |
| `/mentorship` (mentee dashboard) | New: slim role-identity strip above the next-action card, with "next: …" inline and links to /my-mentor + /leadership-pathway. |
| `/mentorship` (empty state) | Calmer copy + pathway/mentor links. |
| `/instructor-growth` | Added "Leadership pathway →" link in topbar so the XP/tier system points at the canonical role definitions. |
| `/admin/mentorship` (oversight) | Added "Leadership pathway →" link in topbar so admins reference the same pathway. |
| `/admin/mentorship/relationships/[id]` | Added "Leadership pathway →" link so admins can re-orient on stage definitions while reviewing a specific pair. |
| `/instructor/workshop-design-studio` | Added the workshop-pathway callout and a "View leadership pathway" link. |
| Navigation catalog + instructor v1 sidebar | Two new entries — Leadership Pathway and My Mentor — in the People & Support group, with search aliases for "Role", "Senior Instructor", "Lead Instructor", "Promotion", "Career". Allowlist bumped to v4. |

### 6. Tests — `tests/lib/leadership-pathway.test.ts`

17 unit tests covering:

- Stage catalog completeness (every id has copy + colors)
- Mentorship-pattern coverage
- Rubric structure (5 goals × 3 stage tiers, all required fields)
- `expectationsForStage` workshop → Instructor fallback and
  org-leadership → Lead Instructor fallback
- `inferLeadershipStage` for every meaningful signal combination
  (STUDENT/PARENT → null, workshop subtype → WORKSHOP_INSTRUCTOR,
  mentor → SENIOR, chair → LEAD, CHAPTER_PRESIDENT → LEAD,
  ADMIN/STAFF → ORG_LEADERSHIP, isOrgLeader overrides)
- `getNextStage` progression and ORG_LEADERSHIP terminus
- `toMenteeRoleTypeFromStage` mapping to existing G&R enum

All green.

## How the system feels now

- Every instructor surface explicitly answers: **what's my role, what
  does it mean, who's mentoring me, what's next, what does growth
  look like at my level?**
- Workshop instructors no longer feel "temporary" — the workshop
  pathway callout positions them as members of the same leadership
  pipeline with a clear transition to full Instructor.
- Senior Instructor and Lead Instructor are now real, prestigious
  destinations on the portal, with the same rubric language an admin
  uses for promotion.
- Mentor cards are warm, named, contactable, and show how long since
  the last session — not a faceless ID.
- Admins, chairs, and mentors all see the same pathway page their
  instructors do, keeping promotion conversations grounded in shared
  language.

## Architecture decisions

1. **No schema migration.** Leadership stage is inferred from existing
   signals (`primaryRole`, `InstructorApplication.instructorSubtype`,
   active mentorships, committee chair status). This keeps the rollout
   low-risk and immediately reversible.
2. **Single content module** drives every surface. Copy lifted
   verbatim from the official rubric, so the portal and the rubric
   never drift.
3. **Single per-user resolver** so each page does at most one
   `getLeadershipContext()` call. Mentor + mentees come back fully
   labeled with their own stage so each surface doesn't re-fan-out.
4. **Pure presentational components**. The same `MentorCard` renders
   on `/my-mentor`, `/profile`, `/settings/personalization`, and
   `/leadership-pathway` without modification.

## Future work (Phase 2 candidates)

1. **Explicit stage field on User** so admins can override the
   inferred stage (rare cases: instructors who mentor but aren't yet
   "Senior", or Senior Instructors before they pick up a mentee).
2. **Promotion recommendation workflow surfaced on `/leadership-pathway`**
   so mentors can recommend mentees for promotion directly from the
   pathway page using the existing `PromotionRecommendation` model.
3. **Stage distribution analytics** on the admin command center — how
   many Workshop / Instructor / Senior / Lead at each chapter, with
   trend lines.
4. **Stage-aware mentor matching** — prefer Senior Instructors mentoring
   Instructors, Lead Instructors mentoring Seniors, when the matcher
   has multiple candidates.
5. **Personalized expectations matrix** — instead of generic per-stage
   bullets, surface the goals the user actually has assigned in their
   G&R doc against the rubric column.

## Touched files

```
lib/leadership-pathway.ts                                 (new)
lib/leadership-context.ts                                 (new)
components/leadership-pathway/stage-ribbon.tsx            (new)
components/leadership-pathway/role-identity-card.tsx      (new)
components/leadership-pathway/expectations-matrix.tsx     (new)
components/leadership-pathway/mentor-card.tsx             (new)
components/leadership-pathway/mentees-overview.tsx        (new)
components/leadership-pathway/workshop-pathway-callout.tsx (new)
app/(app)/leadership-pathway/page.tsx                     (new)
app/(app)/my-mentor/page.tsx                              (rewrote)
app/(app)/my-program/gr/page.tsx                          (modified)
app/(app)/profile/page.tsx                                (modified)
app/(app)/settings/personalization/page.tsx               (modified)
app/(app)/mentorship/page.tsx                             (modified empty state)
app/(app)/mentorship/_components/mentee-dashboard.tsx     (modified)
app/(app)/admin/mentorship/page.tsx                       (modified)
app/(app)/admin/mentorship/relationships/[id]/page.tsx    (modified)
app/(app)/instructor-growth/page.tsx                      (modified)
app/(app)/instructor/workshop-design-studio/page.tsx      (modified)
lib/navigation/catalog.ts                                 (modified)
lib/navigation/instructor-v1-allowlist.ts                 (modified)
lib/navigation/instructor-v1-nav-layout.ts                (modified)
tests/lib/leadership-pathway.test.ts                      (new)
docs/leadership-pathway-rollout.md                        (this file)
```

## Unresolved concerns

- The G&R page has pre-existing implicit-any warnings on serializer
  callbacks (`g`, `gr`, `sc`); out of scope for this redesign but
  should be cleaned up.
- `@prisma/client` doesn't re-export `GoalRatingColor` in this
  workspace's Prisma version; the cast at `app/(app)/my-program/gr/page.tsx`
  is pre-existing and unrelated.
- The instructor-growth tier system (Spark → Fellow) is a separate
  conceptual layer from the leadership pathway. They're now linked
  via topbar buttons but still feel like two different systems
  conceptually — worth a Phase 2 conversation about whether to merge
  them or keep them distinct.
