# Phase M2 — Mentorship Matching Engine + Dashboards

> Action Tracker 3.0 · Mentorship workstream · Design + build doc
> Status: **in progress** · Flag: `ENABLE_MENTORSHIP_2` · Additive only

M1 made mentorship intake and taxonomy real (mentees apply, mentors declare
expertise, COMPLETE → Alumni). **M2 makes mentorship operational**: a
deterministic, explainable matching engine; an admin matching queue with
reasoning; a mentor workload dashboard; and a mentee command center that knows
exactly which lifecycle state the student is in.

Everything new is gated behind `ENABLE_MENTORSHIP_2`. Nothing legacy is removed
or renamed. The matching engine is pure, deterministic, and unit-tested — no
randomness, no opaque "AI match" labels.

---

## 1. Current M1 foundation summary

M1 (`docs/action-tracker-3.0/`, commits `2c41786`, `7a752d3`, `1de1390`) shipped:

| Piece | Where |
| --- | --- |
| `ExpertiseArea` taxonomy (14 seeded areas) | `prisma/schema.prisma`, migration `20260608170000_add_mentorship_2_foundation` |
| `MentorExpertise` join (userId × area, optional `proficiency`) | same |
| `MentorshipApplication` (mentee intake) | same |
| `UserProfile.careerGoal` / `UserProfile.leadershipGoal` | same |
| Shared vocabularies + proficiency weights | `lib/mentorship-2/constants.ts` |
| Read helpers | `lib/mentorship-2/queries.ts` |
| Application intake + officer review actions | `lib/mentorship-2/application-actions.ts` |
| Expertise editor actions | `lib/mentorship-2/expertise-actions.ts` |
| COMPLETE → Alumni transition | `lib/mentorship-2/completion-actions.ts` |
| Mentee apply UI | `app/(app)/my-mentor/apply/page.tsx` + `components/mentorship-2/apply-form.tsx` |
| Mentor expertise editor UI | `app/(app)/mentorship/expertise/page.tsx` + `components/mentorship-2/expertise-editor.tsx` |
| Admin applications queue (basic) | `app/(app)/admin/mentorship/applications/page.tsx` + `components/mentorship-2/applications-queue.tsx` |
| `/my-mentor` canonical mentee home; `/my-program` top-level redirect | `app/(app)/my-mentor/`, `app/(app)/my-program/page.tsx` |

Vocabularies are **TEXT validated in app code** (not Postgres enums), matching
the repo's `actionType` / `partner.stage` convention. M2 follows the same rule.

### M1 application status vocabulary (`lib/mentorship-2/constants.ts`)

`SUBMITTED → UNDER_REVIEW → {MATCHED | DECLINED | WITHDRAWN}`. `MATCHED` /
`DECLINED` / `WITHDRAWN` are terminal. `MentorshipApplication.matchedMentorshipId`
records the resulting `Mentorship` pair when an application is matched (soft id,
no FK — repo convention).

### M1 proficiency weights (consumed by M2)

`FAMILIAR = 1`, `PROFICIENT = 2`, `EXPERT = 3` (`EXPERTISE_PROFICIENCY_WEIGHT`).
An unscored-but-claimed expertise still counts as a baseline `1`.

---

## 2. Existing mentorship routes

**Mentee (canonical home `/my-mentor`):**

- `/my-mentor` — canonical mentee home (mentor card / apply CTA / `MenteeDashboard`).
- `/my-mentor/apply` — application form (flag-gated; `notFound()` when off).
- `/my-mentor/{goals,reflection,progress,awards,schedule,resources,help}` — mentee subroutes.
- `/my-program` (top level) — **redirects to `/my-mentor`** (keep).
- `/my-program/{gr,reflect,awards,schedule}` — redirect to the `/my-mentor/*` equivalents.
- `/my-program/certificate`, `/my-program/achievement-journey` — **unique subroutes, NOT redirected** (certificate + achievement journey live here).

**Mentor (workspace `/mentorship`):**

- `/mentorship` — mentor workspace home (mentee kanban, engagement snapshot, alerts).
- `/mentorship/expertise` — expertise editor (flag-gated).
- `/mentorship/mentees`, `/mentorship/mentees/[id]`, `/mentorship/mentees/[id]/gr` — mentee roster + detail.
- `/mentorship/{reviews,chair,quarterly,feedback,ask,resources,calendar,awards,schedule,unlock-sections}` — program surfaces.
- `/mentorship-program/*` — legacy, redirects into `/mentorship/*`.
- `/mentor/*` — legacy, redirects into `/mentorship/*` (plus `/mentor/incubator`).

**Active-pair model:** `Mentorship` (`mentorId`, `menteeId`, `type`,
`programGroup`, `status` = `ACTIVE | PAUSED | COMPLETE`, `chairId`,
`cycleStage`). This is the canonical active relationship — M2 connects approved
matches to it, never duplicating it.

## 3. Existing admin mentorship routes

- `/admin/mentorship` — admin command center (tabbed: overview, needs-attention, assignments, capacity, approvals, G&R, committees, analytics). ADMIN-only.
- `/admin/mentorship/applications` — M1 applications queue (flag-gated). **M2 upgrades this into the matching queue.**
- `/admin/mentorship/relationships/[mentorshipId]` — relationship detail (reassign / pause / complete).
- `/admin/mentorship/gr/*` — Goals & Resources admin.
- `/admin/mentorship-program`, `/admin/mentor-match`, `/admin/instructor-mentor-matching` — redirect into `/admin/mentorship?tab=…`.

## 4. Existing user/profile fields related to mentorship

From `UserProfile` (all nullable / additive):

| Field | Type | M2 use |
| --- | --- | --- |
| `mentorCapacity` | `Int?` | mentor's target max active mentees → **capacity** + **loadPenalty** |
| `mentorAvailability` | `String?` | free-text availability → **availabilityFit** |
| `careerGoal` | `String?` (M1) | mentee career goal → **goalAlignment** |
| `leadershipGoal` | `String?` (M1) | mentee leadership goal → **goalAlignment** |
| `grade` | `Int?` | mentee grade → reserved **gradeFit** slot |
| `interests` | `String[]` | secondary interest signal |

From `MentorExpertise`: `expertiseAreaId` + `proficiency` (`FAMILIAR/PROFICIENT/EXPERT`).
From `MentorshipApplication`: `goals`, `interests[]`, `preferredExpertise[]`
(ExpertiseArea **slugs**), `availability`, `motivation`, `programGroup`.

**Current mentor load** = count of `Mentorship` rows where `mentorId = mentor`
and `status = ACTIVE`.

---

## 5. Proposed matching score formula

Pure, deterministic, integer-valued. Lives in `lib/mentorship-2/matching/`.
Inputs are plain typed objects (no Prisma) so the scorer is unit-testable
without a DB. The data layer (Slice 3) maps Prisma rows → these inputs.

```
finalScore = clamp(
    expertiseOverlap      // 0 … 40
  + confidence            // 0 … 15
  + capacity              // 0 … 20
  + goalAlignment         // 0 … 15
  + availabilityFit       // 0 … 10
  + loadPenalty           // -20 … 0
  + completenessPenalty   // -15 … 0
  , 0, 100)
```

Max positive contribution sums to exactly **100**; penalties pull it down;
the result is clamped to `[0, 100]` so a score reads like a confidence percent.

| Component | Range | Definition |
| --- | --- | --- |
| **expertiseOverlap** | 0–40 | Fraction of the application's *requested* areas (`preferredExpertise` slugs ∪ interest-mapped slugs) that the mentor claims, × 40. No requested areas → 0 (no fit signal — stated explicitly in the explanation). |
| **confidence** | 0–15 | Mean proficiency weight (1–3) of the mentor's *matched* areas, normalized (`(mean-1)/2`) × 15. No overlap → 0. |
| **capacity** | 0–20 | Open slots `= mentorCapacity − activeLoad`. `min(openSlots, 4) / 4 × 20`. `mentorCapacity` null → 0 (and a completeness penalty applies). |
| **goalAlignment** | 0–15 | Keyword-token overlap between the application's goal text (`goals` + applicant `careerGoal` + `leadershipGoal`) and the mentor's matched area names/categories. Normalized × 15. |
| **availabilityFit** | 0–10 | Token overlap between `application.availability` and `mentor.mentorAvailability` (shared day/part-of-day keywords). Either side missing → 0 (neutral; structured to grow into real availability windows later). |
| **loadPenalty** | −20–0 | `0` when `activeLoad < capacity`. At/over capacity: `−5 per mentee at-or-over`, floored at `−20`. With no capacity declared, every active mentee counts as overload. |
| **completenessPenalty** | −15–0 | `−5` for each missing mentor signal: no expertise claimed, no `mentorCapacity`, no `mentorAvailability`. Floored at `−15`. |

**Reserved `gradeFit` slot:** the scorer's input type carries optional
`menteeGrade` / mentor grade-band fields so grade/age appropriateness can be
added later without changing the public shape. It is **not** in the breakdown
today (no mentor grade-band data exists), keeping the breakdown identical to the
agreed example.

### Score breakdown (returned with every recommendation)

```ts
{
  expertiseOverlap: 35,
  confidence: 15,
  capacity: 20,
  loadPenalty: -10,
  goalAlignment: 12,
  availabilityFit: 5,
  completenessPenalty: -5,
  finalScore: 72,
}
```

This object is persisted as `MentorshipMatchRecommendation.scoreBreakdownJson`
and rendered as **human-readable prose** by `explain.ts` (never raw JSON as the
primary UI). Example:

> *"Strong match (72): covers Sports Business and Leadership Development with
> expert confidence and open capacity. Minor penalty — already mentoring two
> mentees."*

### Ranking & determinism

`rank.ts` sorts candidates by `finalScore` **descending**, then by a stable,
deterministic tiebreak chain: more open capacity first, then `mentorUserId`
ascending. Identical inputs always produce identical ordering regardless of
input order ("ties are stable"). Empty mentor pool → `[]`. Incomplete
application → safe defaults, never a throw.

---

## 6. Matching states

New model `MentorshipMatchRecommendation` (Slice 1). Status vocabulary
(TEXT, app-validated in `lib/mentorship-2/constants.ts`):

```
SUGGESTED → SHORTLISTED → APPROVED
         ↘ HELD ↗
         ↘ REJECTED
APPROVED  ⇒ all sibling recommendations for the application → SUPERSEDED
```

| Status | Meaning |
| --- | --- |
| `SUGGESTED` | Engine output; default on generate. |
| `SHORTLISTED` | Admin flagged as a finalist. |
| `HELD` | Parked — revisit later, not rejected. |
| `REJECTED` | Admin ruled out (note preserved). |
| `APPROVED` | The active match. Drives the canonical `Mentorship` pair; exactly one per application. |
| `SUPERSEDED` | Auto-set on the losing siblings when one is `APPROVED`. |

**Invariant:** at most one `APPROVED` recommendation per application. Approving
one supersedes the rest and moves the `MentorshipApplication` to `MATCHED`.

---

## 7. Admin workflow

Upgrade `/admin/mentorship/applications` into a matching queue:

1. Applications grouped by stage: **New** · **Needs recommendations** · **Has recommendations** · **Shortlisted** · **Approved / matched** · **Held**.
2. Open an application → see submitted goals/interests/expertise + a **Generate recommendations** action.
3. Each recommendation card: mentor name, (email if officer), expertise areas, capacity, current load, score, **why** (prose), **risks/weaknesses**, and actions: *Shortlist · Hold · Reject · Approve* + admin note.
4. Clear warning when no mentor scores above a usable threshold ("no strong mentor available").
5. Approve → supersede siblings, create/connect the `Mentorship` pair, set the application `MATCHED`.

All write actions are authorized to officer-tier (`OFFICER_TIER_ROLES`) and
preserve the admin note.

## 8. Mentor dashboard workflow

New surface `/mentorship/dashboard` (linked from `/mentorship`), flag-gated.
Answers: *Who am I mentoring? What do they need? What's my next move? Am I at
capacity? Is my profile complete?*

Shows, per assigned mentee: goals, application summary, current status, a
**suggested next action**, last activity, completion/graduation status, link to
the mentee detail + the COMPLETE → Alumni flow. Plus a **capacity summary**
(active load vs `mentorCapacity`), an **expertise summary**, and a CTA to update
expertise. Read-only aggregation — no messaging (none exists; not building it).

## 9. Mentee dashboard workflow

Upgrade `/my-mentor` to render distinct lifecycle states (deriving state from
the user's `Mentorship` pairing + open `MentorshipApplication`):

- **A — Not applied:** what mentorship is, Apply CTA, what-happens-next, links to G&R / achievement journey / certificate.
- **B — Applied, no match:** "application received", what they submitted, a status timeline, "we're reviewing mentor fit" (no fake promises).
- **C — Recommendations generated, not approved:** "being reviewed", next expected step. Internal mentor rankings are **not** exposed to the mentee.
- **D — Matched:** mentor name + expertise, goals, first steps, G&R / achievement-journey / certificate links, a progress/status card, "before your first meeting".
- **E — Completed / Alumni:** completed status, certificate, Alumni transition card, reflection prompt, next leadership step.

State C/D detection uses recommendation status without leaking rankings: the
mentee sees *that* review is underway, never *who* is ranked where.

---

## 10. Action Tracker 3.0 bridge (no N1 yet)

`lib/action-tracker-3/mentorship-bridge/` exposes **typed, non-persisted**
adapters so M2 isn't isolated from the coming N1 (Mission → Goal → Milestone →
Action) system:

- `deriveInitialMentorshipGoals(application)` → starter goal objects from the application's goals/interests.
- `suggestFirstMilestones(application, mentorExpertise)` → milestone suggestions shaped by mentor expertise.
- `createMentorshipActionSeed(match)` → a typed seed bundle for an approved match.

These return typed objects only (no DB writes). A "Suggested first steps" card
may surface them in the matched mentee view. Tests prove: goals produce starter
goals, expertise shapes milestones, empty data returns safe defaults.

---

## 11. Known risks

- **Capacity data sparsity.** Few mentors have `mentorCapacity` set. Mitigation: completeness penalty + an explicit "capacity unknown" explanation rather than a silent default; admins still see and can override.
- **Free-text matching limits.** `goalAlignment` / `availabilityFit` use token overlap, not NLP. Deliberately simple, deterministic, explainable. Structured so richer signals slot in later.
- **Soft id for `matchedMentorshipId`.** Follows repo convention (no FK). The data layer keeps it consistent on approve.
- **Two "mentee" notions.** `MentorshipApplication.applicantId` and the denormalized `MentorshipMatchRecommendation.menteeUserId` must agree; the generator sets both from the application.
- **Flag-off safety.** Every M2 page `notFound()`s and every M2 action throws when `ENABLE_MENTORSHIP_2` is off, so the new model can ship dark.
- **No live DB in CI/build.** Migration is hand-written + idempotent (repo convention); verification relies on `prisma generate` + pure unit tests, not a live DB.

## 12. Migration plan

- One additive migration `20260608180000_add_mentorship_2_match_recommendations`.
- `CREATE TABLE IF NOT EXISTS "MentorshipMatchRecommendation"` with guarded FKs (`DO $$ … pg_constraint` blocks) and `CREATE INDEX IF NOT EXISTS` for application / mentee / mentor / status / score, plus a unique `(mentorshipApplicationId, mentorUserId)` for idempotent regeneration.
- No `ALTER`/`DROP` on existing tables except adding back-relation fields on `User` / `MentorshipApplication` (Prisma-only; no SQL column changes — relations are virtual).
- Idempotent and safe to re-run; existing rows unaffected.
- Run `prisma generate`; scoped `tsc` on touched files.

## 13. Test plan

Pure unit tests (Vitest) under `tests/` — the repo's vitest `include` is
`tests/**`, and there are **zero** co-located `__tests__` dirs in `lib/`, so
tests live in `tests/lib/mentorship-2/matching/` and
`tests/lib/action-tracker-3/` rather than the slice's *suggested* co-located
path (documented deviation; keeps the runner green with no config change).

- `score.test.ts` — perfect match scores high; overloaded mentor penalized; no-expertise mentor low; confidence affects score; capacity affects score; goal alignment affects score; completeness penalty; clamping.
- `rank.test.ts` — perfect match ranks first; overloaded ranks lower; ties are stable; empty pool → `[]`; incomplete application doesn't crash.
- `explain.test.ts` — explanation mentions matched expertise + load; safe on empty breakdown.
- `mentorship-bridge` tests — starter goals from goals; expertise shapes milestones; empty → safe defaults.
- Data-layer functions kept thin and mostly pure (status transitions, supersede logic) so the decision rules are testable without a live DB.

## 14. Rollout plan (`ENABLE_MENTORSHIP_2`)

1. Ship schema + migration (dark; flag off).
2. Ship pure engine + bridge (importable; no runtime surface).
3. Ship data layer (actions throw when flag off).
4. Ship admin queue / mentor dashboard / mentee states (pages `notFound()` when flag off).
5. Enable `ENABLE_MENTORSHIP_2=true` in a preview env, dogfood the queue, then production.

Flag **off** ⇒ identical behavior to today. Harmless redirects/links (e.g. a
dashboard link from `/mentorship`) may be unconditional, but anything that
reads/writes M2 data stays gated.

---

## 15. Slice map

| Slice | Deliverable |
| --- | --- |
| 0 | This design doc |
| 1 | `MentorshipMatchRecommendation` model + migration |
| 2 | Pure matching engine `lib/mentorship-2/matching/` + tests |
| 3 | Recommendation data layer `lib/mentorship-2/recommendations/` |
| 4 | Admin matching queue (`/admin/mentorship/applications`) |
| 5 | Mentor dashboard (`/mentorship/dashboard`) |
| 6 | Mentee dashboard states (`/my-mentor`) |
| 7 | Action Tracker 3.0 bridge `lib/action-tracker-3/mentorship-bridge/` |
| 8 | Navigation + UX integration; `nav:check` |
| 9 | Verification + final report |
