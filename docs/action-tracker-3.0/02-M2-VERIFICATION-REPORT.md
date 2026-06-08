# Phase M2 — Verification & Final Report

> Mentorship Matching Engine + Dashboards · Action Tracker 3.0
> Branch: `claude/happy-mendel-sXxpQ` · Flag: `ENABLE_MENTORSHIP_2` (default OFF)

Companion to `02-M2-MENTORSHIP-MATCHING-ENGINE.md` (the design doc). M2 turns
mentorship from a passive application system into an operating system: a
deterministic, explainable matching engine; an admin matching queue with
reasoning; a mentor workload dashboard; and a mentee command center.

---

## 1. Commits made

Nine commits, one per slice (additive, flag-gated):

| Commit | Slice |
| --- | --- |
| `ad536a5` | 0 — design doc |
| `6a80ebf` | 1 — `MentorshipMatchRecommendation` model + migration |
| `5da4840` | 2 — pure matching engine + tests |
| `4f28dd2` | 3 — recommendation data layer |
| `530323c` | 4 — admin matching queue |
| `b481194` | 5 — mentor dashboard |
| `7b6e1ae` | 6 — mentee dashboard states |
| `8ece137` | 7 — Action Tracker 3.0 bridge |
| `5425c7d` | 8 — navigation + UX integration |

(Slice 9 — this report.)

## 2. Files changed

30 files, +4407 / −253. Highlights:

**Schema/migration:** `prisma/schema.prisma`,
`prisma/migrations/20260608180000_add_mentorship_2_match_recommendations/migration.sql`.

**Pure engine (`lib/mentorship-2/matching/`):** `types.ts`, `score.ts`,
`rank.ts`, `explain.ts`.

**Data layer (`lib/mentorship-2/recommendations/`):** `inputs.ts` (pure),
`queries.ts`, `actions.ts`.

**Dashboards:** `lib/mentorship-2/mentor-dashboard.ts`,
`lib/mentorship-2/mentee-dashboard.ts`.

**Bridge (`lib/action-tracker-3/mentorship-bridge/`):** `types.ts`, `index.ts`.

**Routes/UI:** `app/(app)/admin/mentorship/applications/page.tsx` (rewritten
queue) + `applications/[id]/page.tsx` (new detail);
`app/(app)/mentorship/dashboard/page.tsx` (new); `app/(app)/mentorship/page.tsx`
(dashboard link); `app/(app)/my-mentor/page.tsx` +
`_components/mentee-command-center.tsx`; `components/mentorship-2/`
`matching-recommendations.tsx` + `application-decision.tsx` (and removed the
superseded `applications-queue.tsx`).

**Constants/nav:** `lib/mentorship-2/constants.ts` (recommendation statuses),
`lib/page-helper/registry.ts` (+3 entries).

**Tests:** `tests/lib/mentorship-2/matching/{score,rank,explain}.test.ts`,
`tests/lib/mentorship-2/recommendations/inputs.test.ts`,
`tests/lib/action-tracker-3/mentorship-bridge.test.ts`.

## 3. Schema additions

One new model, purely additive (one new table; the `User` /
`MentorshipApplication` back-relations are virtual Prisma relations, no SQL
column changes):

```prisma
model MentorshipMatchRecommendation {
  id                      String   @id @default(cuid())
  mentorshipApplicationId String   // FK → MentorshipApplication (cascade)
  menteeUserId            String   // FK → User (cascade)
  mentorUserId            String   // FK → User (cascade)
  score                   Int      @default(0)
  scoreBreakdownJson      Json     @default("{}")
  status                  String   @default("SUGGESTED") // app-validated
  adminNote               String?
  decidedAt               DateTime?
  decidedByUserId         String?  // FK → User (set null)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  @@unique([mentorshipApplicationId, mentorUserId]) // idempotent regeneration
  @@index([mentorshipApplicationId]); @@index([menteeUserId])
  @@index([mentorUserId]); @@index([status]); @@index([score])
}
```

Statuses (TEXT, validated in `constants.ts`): `SUGGESTED`, `SHORTLISTED`,
`APPROVED`, `REJECTED`, `HELD`, `SUPERSEDED`. Migration is idempotent
(`CREATE TABLE/INDEX IF NOT EXISTS`, guarded FKs) and safe to re-run. No existing
model/column was renamed or dropped.

## 4. Routes added / changed

| Route | Change | Gate |
| --- | --- | --- |
| `/admin/mentorship/applications` | rewritten: flat list → staged matching queue | flag + officer |
| `/admin/mentorship/applications/[id]` | **new**: application detail + recommendations | flag + officer |
| `/mentorship/dashboard` | **new**: mentor workload dashboard | flag + mentor |
| `/mentorship` | added a flag-gated "Dashboard →" link | — |
| `/my-mentor` | command-center states (A–E) when flag on; **flag-off unchanged** | flag |

No route was renamed or removed. `/my-mentor` stays canonical; `/my-program`
keeps redirecting. No competing nav entry added.

## 5. Matching formula

Deterministic, integer, clamped to `[0,100]` (`lib/mentorship-2/matching/score.ts`):

```
finalScore = clamp(
    expertiseOverlap     // 0..40  fraction of requested areas the mentor covers
  + confidence           // 0..15  mean proficiency (1–3) of matched areas
  + capacity             // 0..20  open slots (capacity − load), capped at 4
  + goalAlignment        // 0..15  goal/interest ↔ expertise token overlap
  + availabilityFit      // 0..10  shared day/part-of-day availability words
  + loadPenalty          // -20..0 −5 per mentee at/over capacity
  + completenessPenalty  // -15..0 −5 per missing signal (expertise/capacity/availability)
  , 0, 100)
```

Ranking (`rank.ts`) is a total order — score desc → open capacity desc →
`mentorUserId` asc — so ties are stable regardless of input order. Empty pool →
`[]`. `explain.ts` renders the breakdown as prose + strength/risk bullets (never
raw JSON). A reserved `gradeFit` slot exists in the input types for future
grade/age weighting.

## 6. Tests added

46 new pure unit tests, all green:

- **score** (13): perfect match saturates positives; no-expertise / overloaded / incomplete-profile penalized; confidence, capacity, and goal alignment each move the score; clamping; incomplete application never throws; determinism; tokenizer.
- **rank** (8): strongest first; overloaded ranks lower; ties stable & input-order independent; empty pool → `[]`; incomplete app no-crash; `topRecommendations` cap; `hasUsableMatch` threshold.
- **explain** (5): tier bucketing; names matched expertise; flags load + incomplete profile; prose mentions expertise + load; safe on empty breakdown.
- **recommendations/inputs** (5): interest→slug mapping; goal-text concat; safe empty defaults; unknown slug kept; mentor-candidate mapping (proficiency weights, inactive filtered, missing profile).
- **action-tracker bridge** (8): starter goals from application/profile/interests; safe default goal; long-title truncation; expertise-shaped milestones vs generic; malformed expertise ignored; action seed bundle + mentor naming; safe empty defaults.

## 7. Verification results

| Gate | Result |
| --- | --- |
| `prisma generate` | ✓ Prisma Client v5.22.0 (new model present) |
| M2 unit tests | ✓ **46/46** |
| `tsc --noEmit` (full project) | ✓ **0 errors** |
| Full vitest suite | 1710 passed / 13 failed — **all 13 pre-existing**, in files unrelated to M2 (instructor-review, journey-editor, summer-workshop, onboarding, training-journey, page-helper-coverage); none import M2 code; the relevant files are byte-identical to the branch base |
| `nav:check` | same **4 inherited** core-map count failures (INSTRUCTOR 9>8, HIRING_CHAIR 3<5, CHAPTER_PRESIDENT 2<5, MENTOR 4<5); `core-map.ts` untouched by M2 → no new failures |
| page-helper coverage | improved (missing **64 → 61**): the 3 new/upgraded M2 routes now have help entries; remains red only for ~61 inherited routes |
| broken-route scan | no dead refs to the removed component; every route M2 links to exists |

## 8. Known caveats

- **Capacity data is sparse.** Few mentors have `mentorCapacity` set; the scorer applies a completeness penalty and the explanation says "capacity not set" rather than guessing. Admins still see and can override.
- **Free-text matching is token-overlap, not NLP** for `goalAlignment` / `availabilityFit` — deliberately deterministic and explainable; structured to accept richer signals later.
- **Score is computed at generation time** and persisted; the breakdown the admin sees matches the stored score. Display names/load in the explanation reflect current data.
- **Inherited nav failures** (4 core-map counts) and the **page-helper coverage** red are pre-existing and out of M2 scope; left as-is per the phase's "not nav-system surgery" guidance.
- **No live DB in this environment**: verification relied on `prisma generate` + pure unit tests + `tsc`; the hand-written migration follows the repo's idempotent convention but was not applied against a database here.
- **Approve uses the existing `Mentorship` model** (no duplicate active-pair model); `matchedMentorshipId` stays a soft id per repo convention.

## 9. What remains for C1 / C2 / N1

- **N1 (Action Tracker core):** build the real Mission → Goal → Milestone → Action persistence. The `lib/action-tracker-3/mentorship-bridge/` adapters already produce typed Goal/Milestone/Action seeds from a match — N1 wires those into persisted entities and surfaces them on both dashboards.
- **C1/C2 (connective tissue):** link approved matches into the broader Action Tracker (assignments, check-ins, reviews) and the People dashboards; turn the mentee "Suggested first steps" card into tracked actions; feed mentor-dashboard "next action" from real Action items rather than derived heuristics.
- **Matching depth:** real availability windows (reuse `MentorAvailabilityRule`) instead of free-text overlap; activate the reserved `gradeFit` factor once mentor grade-bands exist; optional admin-tunable factor weights.
- **Capacity UX:** a first-class editor for `mentorCapacity` / `mentorAvailability` (today they're profile fields) so the matching inputs get populated.
- **Notifications:** email/notify a mentor + mentee on approval (no messaging system exists yet; intentionally not built here).
- **Rollout:** enable `ENABLE_MENTORSHIP_2=true` in preview, dogfood the queue end-to-end (apply → generate → approve → mentee/mentor dashboards), then production.
