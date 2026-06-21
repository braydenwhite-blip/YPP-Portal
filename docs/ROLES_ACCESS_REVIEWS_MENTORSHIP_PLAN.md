# Roles, Mentorship, Reviews & Access — Implementation Plan

Status: **Phases 0–8 delivered** · Owner: Brayden · Last updated: 2026-06-18

**Delivered:** Phase 0 (authority foundation), Phase 1 (review approval + exceptions,
flag-gated), Phase 2 ("Why This Person Has Access" + Access Problems detector),
Phase 3 (person spine: `internalLevel`/`ladder`/`canonicalTitle`/cohort + committees,
migration `20260618120000_org_person_spine`, backfill `scripts/backfill-org-authority.ts`),
Phase 4 (mentorship transferability: `focusArea`/`isTemporary`,
`MentorshipAssignmentHistory`, non-destructive `reassignPrimaryMentor`, migration
`20260618130000_mentorship_transferability`), Phase 5 (flag-gated action-Lead
eligibility on assignment + Owner Needed queue), Phase 6 (Missing Chapter:
`MissingChapterFlag`, owner auto-action, resolution queue, migration
`20260618140000_missing_chapter_flag`), and Phase 7 (operational queues —
Reviews to Draft/Approve, Curriculum to Review, Interviews Assigned, Missing
Chapter, at `/queues`). Mentor history + a non-destructive reassign form are now
on the person profile, and the legacy support-circle assign path also records
mentor history.

Phase 8 (promotions + profile history + audit): preview-then-apply promotions on
the person profile (`previewPromotion` / `applyPromotion`), the `PromotionRecord`
history (migration `20260618150000_promotion_record`), the now-live Promotion
Setup queue, and a `ROLE_CHANGED` AuditLog entry on every promotion. Changing a
person's internal level is Board-only.

Optional follow-ups (not blocking): auto-wire `flagMissingChapter` into
record-create flows so Missing Chapter is detected automatically, and aggregate
the broader "complete history" (classes/reviews/actions already live on the
profile via existing panels).
After deploying Phases 3-4, 6 & 8, run `npm run backfill:org-authority` (dry run) then `--apply`.

**Consolidation (Phase 9 — spine is now canonical):** the legacy role-string
groupings that used to be copy-pasted across server, client, and edge modules are
unified in `lib/org/role-sets.ts` (the single owner of `OFFICER_TIER_ROLES`,
`APPLICATION_REVIEWER_ROLES`, `INSTRUCTOR_SURFACE_ROLES`, … plus spine-derived tier
predicates `isOfficerTierAuthority`/`isBoardAuthority`/…). `lib/authorization.ts`,
`lib/page-guards.ts`, `lib/public-gate.ts`, `components/app-shell.tsx`, and the nav
catalog now re-export/import from there instead of redefining. Duplicate helpers
were collapsed: `hasAdminSubtype`/`hasAnyAdminSubtype` live only in
`lib/admin-subtypes.ts` (authorization re-exports), and `lib/mentorship-access.ts`
uses the shared `hasRole`. Internal-level thresholds (`OFFICER_MIN_LEVEL`,
`LEAD_MIN_LEVEL`, `TOP_INTERNAL_LEVEL`) are named in `lib/org/levels.ts` and consumed
by the access-explainer. The "Officers can't click into interview reviews" bug is
fixed: the interview workspace now gates on `assertCanViewApplicant` (Admins/Officers,
Hiring Chairs, same-chapter Chapter Presidents, assigned reviewers/interviewers), and
global Hiring Chairs are no longer chapter-locked in `assertCanManageHiringInterviews`.
Follow-up (mechanical, non-blocking): ~50 remaining inline
`roles.includes("INSTRUCTOR")||…("ADMIN")||…("CHAPTER_PRESIDENT")` triples can be
swept onto `isInstructorSurface(roles)` (8 of the regular shapes already converted).

**Enforcement is now ON by default** (canonical model) with kill-switches:
`ORG_REVIEW_AUTHORITY_ENFORCED=false` / `ORG_ACTION_LEAD_ELIGIBILITY_ENFORCED=false`
disable them. Both guards **fail open** when a participant or internal level can't be
resolved, so enabling them before the backfill never locks anyone out. Deploy order:
run `npm run backfill:org-authority --apply` so `User.internalLevel` is populated, then
the level-based rules apply in full. Missing Chapter owner: `MISSING_CHAPTER_OWNER_EMAIL`.

This plan maps the *"YPP Portal Roles, Mentorship, Reviews, and Access Proposal"* onto
the existing codebase. It is a sequencing + impact document, not code. No code lands
until the phasing and the open decisions in [§9](#9-open-decisions-need-your-call) are
confirmed.

The driving principle from the proposal is the **Final Structural Rule**:

> Titles explain who a person is. Relationships explain who they are responsible for.
> Assignments explain what they need to do. Permissions explain what they can access.
> Internal levels determine what they can lead or approve.

Today access is computed from **role + admin-subtype + free-text title** plus scattered
relationship checks. The work below introduces an explicit **internal level + ladder**
spine, makes approval/lead/visibility a function of that spine, and moves the named
exceptions (Sam, Zach, Brayden) into **config**, not hardcoded `if (name === …)`.

---

## 1. Current state (grounded)

| Concern | What exists today | Where |
| --- | --- | --- |
| Roles | `RoleType` enum (`ADMIN, INSTRUCTOR, STUDENT, MENTOR, CHAPTER_PRESIDENT, STAFF, PARENT, APPLICANT, HIRING_CHAIR`) + `AdminSubtype` (`SUPER_ADMIN, …, LEADERSHIP`) | `prisma/schema.prisma:20-51`, `lib/authorization.ts:10-20` |
| Title | Free-text `User.title` with a fallback resolver (stored → subtype label → formatted role) | `prisma/schema.prisma:802-805`, `lib/user-title.ts:58-69` |
| Permission calc | Mixed: role guards, subtype→route domains, relationship guards, feature gates. **No central function, no level math.** | `lib/authorization.ts`, `lib/authorization-helpers.ts`, `lib/admin-capabilities.ts`, `lib/feature-gates.ts` |
| Actions | `ActionItem` with single accountable `leadId` **and** the exact `LEAD / EXECUTING / INPUT` model via `ActionAssignment` | `prisma/schema.prisma:12648-12854` |
| My Actions | Personal view at `/actions` (legacy `/my-actions` redirects); buckets by urgency | `app/(app)/actions/page.tsx`, `lib/people-strategy/my-actions-selectors.ts` |
| Queues | 11-queue engine (`My queue`, `Owner accountability`, `Leadership`, `Unblock`, `Weekly review`, …) | `lib/queue/types.ts:275-288`, `lib/queue/` |
| Mentorship | `Mentorship` (primary mentor + `startDate`/`endDate`/`status`/`notes`) + `MentorshipCircleMember` (advisors via `SupportRole`, `isPrimary`, `isActive`) | `prisma/schema.prisma:2755-2838`, `626-633` |
| Reviews | Lane-based chair approval: `DRAFT → PENDING_CHAIR_APPROVAL → APPROVED / CHANGES_REQUESTED`; approver = `MentorCommitteeChair` for the mentee's lane | `prisma/schema.prisma:603-608,9711-9723`, `lib/goal-review-actions.ts`, `lib/mentorship-chair-access.ts` |
| Promotions | `PromotionRecommendation` model exists but is **unused / dead** | `prisma/schema.prisma:3719` |
| Audit | `AuditLog` model (records actions, not access reasons) | `prisma/schema.prisma:4657-4715` |

### What is genuinely missing

1. **No internal level (1–7), no ladder, no spec title taxonomy.** Titles are free text.
2. **No central approval-authority rule** ("approver's level must be strictly greater
   than the author's").
3. **Review-routing exceptions** (Sam → Aveena/Brayden/Sanvi; Zach → Ian/Anthea) are
   not modeled. Current routing is lane-based only and has no self-finalize concept.
4. **No "Why This Person Has Access"** explainer.
5. **No person-level cohort or general committee membership.** Cohorts exist only as
   `TrainingCohort` / `ApplicationCohort` / `IncubatorCohort`; "committee" exists only
   as `MentorCommittee*` (mentorship-specific).
6. **Actions have no chapter link** → no "Missing Chapter" concept, no auto-action to
   Brayden, no Lead-eligibility (Level 3+) gate.
7. **Mentorship** has no assignment-history table, no temporary flag, and no
   instruction-vs-leadership split (one `mentorId` serves both).
8. **Missing queues:** Reviews to Draft, Reviews to Approve, Curriculum to Review,
   Interviews Assigned, Missing Chapter, Access Problems, Promotion Setup.

---

## 2. Design spine (introduced in Phase 0)

A single typed module establishes the vocabulary every later phase consumes.

- **Ladder:** `INSTRUCTION | LEADERSHIP`.
- **Title taxonomy** (canonical, ladder-scoped):
  - Instruction: Instructor, Senior Instructor, Lead Instructor, Chapter President
  - Leadership: Manager, Senior Manager, Director, Senior Director, Officer,
    Senior Officer, Board Member
- **Internal level:** a single org-wide integer (1–7) used for *comparison* (approval,
  lead eligibility, visibility, escalation). The proposal pins Officer = 5,
  Senior Officer = 6, Board Member = 7. The Instruction-ladder ↔ org-level mapping is an
  **open decision** ([§9](#9-open-decisions-need-your-call)); the plan ships with a
  recommended default table that the org can edit in config without a migration.
- **Numbers stay internal.** UI renders titles only; `internalLevel` drives logic.
  This matches the proposal's "numerical levels are purely internal."

The taxonomy lives in code/config first (pure functions + tests), then is *backed* by
DB columns in Phase 3 so it survives promotions and history. Doing config first means
Phases 1–2 deliver value with **zero migration risk**.

---

## 3. Phased plan

Each phase is independently shippable and ordered by dependency. "Migration" = a Prisma
schema change requiring `prisma migrate` against the database.

### Phase 0 — Authority foundation (no migration)
**Goal:** the level/ladder/title spine + pure authority math, mapped onto *existing*
roles so nothing breaks.

- New `lib/org/levels.ts`: ladder enum, title taxonomy, `internalLevel(title)`,
  `ladderOf(title)`, and a `resolvePersonAuthority(user)` that derives level/ladder from
  today's `primaryRole` + `title` + `adminSubtypes` (e.g. `SUPER_ADMIN` → Board/7,
  `LEADERSHIP` → Senior Officer/6, `CHAPTER_PRESIDENT` → Chapter President).
- Pure predicates: `canApproveReview(approver, author)` (strictly higher level),
  `canLeadAction(person)` (level ≥ 3, with the Manager/Sr-Manager carve-out "within
  assigned role or when authorized by an Officer/Board Member").
- Extend `lib/user-title.ts` to recognize the taxonomy without changing its fallback.
- Tests in `tests/lib/org-levels.test.ts` (repo uses vitest).

**Touches:** `lib/org/*` (new), `lib/user-title.ts`. **Migration:** none.
**Risk:** low — additive, no behavior change until consumed.

### Phase 1 — Review approval authority + routing exceptions (no migration)
**Goal:** approval is level-driven; named exceptions are config.

- `lib/org/review-routing.ts`: given an author + subject, return the **required
  approver set** by rule (level strictly greater than author; Instruction Committee for
  instructor reviews; Board for Officer/Senior-Officer reviews).
- `lib/org/review-exceptions.ts`: a **data table** of self-finalize exceptions —
  `Sam → {Aveena, Brayden, Sanvi}`, `Zach → {Ian, Anthea}` — keyed by stable user ids,
  with an effective date. Explicitly *not* hardcoded into general permission code, per
  the proposal.
- Wire both into `lib/goal-review-actions.ts` submit/approve paths and
  `lib/mentorship-chair-access.ts` so the existing lane routing is *augmented* (not
  replaced) by level checks + exceptions. Add the conflict-of-interest guard ("mentor
  cannot give final approval to a review they drafted unless an exception applies").

**Touches:** `lib/org/*` (new), `lib/goal-review-actions.ts`,
`lib/mentorship-chair-access.ts`, review state helpers. **Migration:** none (exceptions
seeded from config; a DB-backed table is a Phase 8 nicety).
**Risk:** medium — changes who can approve. Mitigate with feature flag
(`lib/feature-gates.ts`) + tests for each proposal example.

### Phase 2 — "Why This Person Has Access" + Access Problems queue (no migration)
**Goal:** plain-language access explanation and the queue that surfaces broken access.

- `lib/org/access-explainer.ts`: `explainAccess(viewer, resource)` returning structured
  reasons ("Can view Jackson because Jackson is their mentee", "Cannot approve — author's
  level ≥ theirs"). Reuses existing relationship guards in `lib/authorization-helpers.ts`.
- Profile section component "Why This Person Has Access" (admin-only), reading the
  explainer. Add to the profile under `components/profile/`.
- **Access Problems** queue: a derived selector listing records a viewer *should* be able
  to open (by role/relationship) but a guard currently denies — directly targets the
  proposal's "Officers cannot click into interview reviews" bug.

**Touches:** `lib/org/*` (new), `components/profile/*`, `lib/queue/*`.
**Migration:** none. **Risk:** low — read-only surfaces.

### Phase 3 — Person spine in the DB (migration)
**Goal:** persist level/ladder/cohort/committee so they survive promotions & history.

- `User` migration: add `internalLevel Int?`, `ladder` enum (`INSTRUCTION|LEADERSHIP`),
  `cohortId String?` (person cohort, distinct from the training/application cohorts),
  keep free-text `title` but add `canonicalTitle` enum-ish string validated in app code
  (mirrors the existing loosely-typed pattern, e.g. `actionType`).
- New `Committee` + `CommitteeMembership` models (general; the proposal's Instruction
  Committee, Interview Committee, Review Committee, Outreach Team, Board, Temporary
  Working Group). Membership grants scoped permissions **without** changing title; leaving
  removes permission without deleting history.
- New `Cohort` model for people (name + dates), `User.cohortId → Cohort`.
- Backfill script mapping current users onto the taxonomy (uses Phase 0 resolver).

**Touches:** `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.ts`,
`scripts/` backfill, plus the Phase 0 resolver now reads columns first.
**Migration:** **yes** (additive columns + 3 new models — non-destructive).
**Risk:** medium — migration coordination on Vercel/Supabase (pooled vs direct URL,
`prisma/schema.prisma:5-9`). Additive-only, reversible.

### Phase 4 — Mentorship transferability (migration)
**Goal:** transferable, dated, dual-track mentorship with full history.

- Add `MentorshipAssignmentHistory` (mentor, mentee, track, start, end, reason, actor) —
  an explicit audit trail rather than reconstructing from `endDate`/`isActive`.
- Add a **track** dimension so a person can have different mentors for *instruction
  development* vs *organizational leadership* (extend `MentorshipType` or add
  `track INSTRUCTION|LEADERSHIP`).
- Add `isTemporary Boolean` (+ optional auto-expiry) to `Mentorship` /
  `MentorshipCircleMember`.
- A **non-destructive reassign action**: end-date the old, create the new, write history,
  preserve all notes/check-ins/reviews (the data already survives; this makes it a
  first-class, audited operation with one call).
- Seed the current assignments (Aveena/Brayden/Sanvi → Sam; Ian/Anthea → Zach;
  Jackson/Jennifer/Alina/Wesley → Aveena; Milo → Ian; best instructors → Brayden).

**Touches:** `prisma/schema.prisma`, migrations, `lib/mentorship-hub-actions.ts`,
`lib/mentorship-actions.ts`, admin mentorship UI. **Migration:** **yes** (additive).
**Risk:** medium — touches the busy mentorship surface; gate the reassign UI behind a flag.

### Phase 5 — Action Lead eligibility + Owner Needed (small migration or none)
**Goal:** enforce "every active action has exactly one eligible Lead."

- `canLeadAction` (Phase 0) enforced on assign/activate in
  `lib/people-strategy/action-items-actions.ts`. Manager/Sr-Manager carve-out honored.
- Rename/refine the existing **Owner accountability** queue to the proposal's
  **Owner Needed** semantics (no eligible Lead → Officers/Board queue). Mostly a
  selector + label change in `lib/queue/`.

**Touches:** `lib/people-strategy/*`, `lib/queue/*`. **Migration:** none.
**Risk:** low–medium — adds a gate to action activation; cover with tests.

### Phase 6 — Missing Chapter (migration)
**Goal:** every instructor/class/partner/record is `Chapter | Global | Missing Chapter`,
and Missing Chapter auto-creates work for Brayden.

- Add a chapter classification to action-bearing records (e.g. `ActionItem.chapterId` +
  a `Global`/`MissingChapter` sentinel, or a small enum alongside the existing
  `chapterId` FKs). Decide the sentinel representation in [§9](#9-open-decisions-need-your-call).
- On entering Missing Chapter: auto-create an `ActionItem` led by Brayden, surface it in
  his **My Actions**, add a **Missing Chapter** queue with age-since-unresolved, and block
  "fully set up" until resolved.

**Touches:** `prisma/schema.prisma`, migrations, `lib/people-strategy/*`, `lib/queue/*`,
chapter actions. **Migration:** **yes** (additive). **Risk:** medium — defines a new
required-setup invariant; roll out read-only (flag the record) before enforcing.

### Phase 7 — Remaining operational queues (no migration)
**Goal:** the proposal's queue list, built on the existing engine.

- **Reviews to Draft** (mentor's pending review actions), **Reviews to Approve**
  (level/exception-aware, from Phase 1), **Curriculum to Review**
  (`lib/curriculum-review-actions.ts`), **Interviews Assigned**
  (`lib/interviews/*`, `lib/instructor-interview-actions.ts`), **Promotion Setup**
  (depends on Phase 8). Each is a new selector + `work-hub-rows` integration.

**Touches:** `lib/queue/*`, domain action libs. **Migration:** none. **Risk:** low.

### Phase 8 — Promotions, profile history & admin authority (migration)
**Goal:** promote from the profile with a non-destructive, audited diff.

- Revive/replace `PromotionRecommendation` into a real promotion flow: select new
  title/level/ladder/cohort/chapter/committees/mentor, **preview** access added/removed +
  actions/reviews/mentorships transferred, then apply — deleting nothing.
- Profile "complete history" section (roles, titles, cohorts, chapters, mentors, mentees,
  committees, reviews, actions, promotions) backed by the history tables.
- **Promotion Setup** queue for promotions with unresolved mentor/chapter/committee items.
- Sensitive changes write `AuditLog` entries with reason + effective date + actor.

**Touches:** `prisma/schema.prisma`, migrations, profile + admin surfaces,
`lib/audit-log-actions.ts`. **Migration:** **yes** (history tables; additive).
**Risk:** medium — high-value admin flow; build behind a flag with thorough tests.

---

## 4. Migration impact summary

| Phase | Migration? | Nature |
| --- | --- | --- |
| 0 Authority foundation | No | pure TS/config |
| 1 Approval + exceptions | No | config-seeded |
| 2 Access explainer + Access Problems | No | read-only surfaces |
| 3 Person spine (level/ladder/cohort/committee) | **Yes** | additive columns + 3 models |
| 4 Mentorship transferability | **Yes** | additive (history, track, temporary) |
| 5 Action Lead eligibility | No | logic + selectors |
| 6 Missing Chapter | **Yes** | additive (chapter classification) |
| 7 Remaining queues | No | selectors |
| 8 Promotions + history + audit | **Yes** | additive (history tables) |

All migrations are **additive and non-destructive** — no column/table drops, no data
deletion (aligns with "no account, profile, review, action, or historical record should
be deleted"). Deploy note: Supabase uses pooled `DATABASE_URL` + direct `DIRECT_URL`
(`prisma/schema.prisma:5-9`); run migrations against the direct URL.

---

## 5. Sequencing & dependencies

```
Phase 0  ──┬─> Phase 1 ──┐
           ├─> Phase 2   ├─> Phase 7 (queues)
           └─> Phase 5   │
Phase 3 ───┴─> Phase 4   │
Phase 3 ──────> Phase 6  │
Phase 3 ──────> Phase 8 ─┘
```

- **0 → 1, 2, 5:** all consume the level/ladder math.
- **3 → 4, 6, 8:** these need persisted level/ladder/cohort/committee.
- **1 + 8 → 7:** Reviews-to-Approve and Promotion-Setup queues depend on those phases.

Recommended delivery order: **0 → 1 → 2 → 3 → 5 → 4 → 6 → 7 → 8** (front-load the
zero-migration value; batch migrations after the spine lands).

---

## 6. How named people map today (for seeding)

Configured as **data**, not code (Phase 1 exceptions + Phase 4 mentor seeds):

- **Mentors:** Sam ← Aveena, Brayden, Sanvi (self-finalize). Zach ← Ian, Anthea
  (self-finalize). Aveena ← Jackson, Jennifer, Alina, Wesley (→ Board approval).
  Ian ← Milo (→ Board approval). Brayden ← best 2–3 instructors (→ Board approval).
- **Levels (proposal-pinned):** Officers Anthea, Sanvi = 5; Senior Officers Ian, Aveena,
  Brayden = 6; Board = 7.
- **Missing Chapter owner:** Brayden (Phase 6 auto-actions).

These seeds are editable and transferable without code changes once Phases 1/4 land.

---

## 7. Reused vs. new (avoid duplication)

- **Reuse:** `ActionAssignment` LEAD/EXECUTING/INPUT (no new action-role model needed);
  the queue engine in `lib/queue/`; the `Mentorship` + `MentorshipCircleMember`
  non-destructive pattern; `AuditLog`; `lib/user-title.ts` resolver;
  `lib/feature-gates.ts` for staged rollout.
- **New:** `lib/org/*` (levels, routing, exceptions, access-explainer); person
  `internalLevel`/`ladder`/`cohort`; general `Committee`/`CommitteeMembership`;
  `MentorshipAssignmentHistory`; chapter classification on action-bearing records;
  promotion flow.

---

## 8. Risks & mitigations (global)

| Risk | Mitigation |
| --- | --- |
| Tightening approval/lead rules locks people out | Every behavior-changing phase ships behind a `lib/feature-gates.ts` flag; enable per-chapter/per-role first. |
| Cross-ladder level comparison is ambiguous | Ship the mapping as editable config + flag as an open decision (below); default table reviewed before enabling Phase 1. |
| Migration on Vercel/Supabase | Additive-only, run against `DIRECT_URL`, backfill scripts are idempotent and dry-runnable. |
| "Missing Chapter" becomes a noisy blocker | Roll out as a *flag* (surface + age) before it *blocks* setup. |
| Scattered guards drift from the new spine | Phase 2 access-explainer doubles as a test oracle; add a guard-coverage test that the explainer agrees with the actual guard result. |

---

## 9. Open decisions (need your call)

1. **Cross-ladder internal-level mapping.** The proposal pins Officer=5, Sr Officer=6,
   Board=7 and "Lead = level ≥ 3 on either ladder." How do Instruction-ladder titles map
   onto the org-wide 1–7 scale used for cross-ladder comparison? Recommended default:
   Instructor=1, Sr Instructor=2, Lead Instructor=3, Chapter President=4; Manager=1,
   Sr Manager=2, Director=3, Sr Director=4, Officer=5, Sr Officer=6, Board=7 — with the
   understanding that comparisons are primarily *within* a ladder and the table is
   editable. Confirm or adjust.
2. **Missing Chapter representation.** Sentinel value on `chapterId` vs. a dedicated
   `chapterStatus` enum (`ASSIGNED|GLOBAL|MISSING`). Recommend the enum (clearer queues).
3. **Exceptions storage.** Start as config file (Phase 1) and promote to a DB-backed
   table in Phase 8, or go DB-backed from the start? Recommend config-first.
4. **Scope of first build.** Once approved, recommend implementing **Phase 0 + Phase 1**
   together as the first PR (foundation + the headline review-routing/exceptions value,
   zero migrations).

---

*Appendix — key source anchors:* `prisma/schema.prisma` (User `795`, ActionItem `12683`,
ActionAssignmentRole `12648`, Mentorship `2755`, MentorshipCircleMember `2816`,
SupportRole `626`, MentorCommitteeChair `9711`, GoalReviewStatus `603`,
PromotionRecommendation `3719`, AuditLog `4699`); `lib/authorization.ts`,
`lib/authorization-helpers.ts`, `lib/user-title.ts`, `lib/goal-review-actions.ts`,
`lib/mentorship-chair-access.ts`, `lib/queue/types.ts`,
`lib/people-strategy/my-actions-selectors.ts`.
