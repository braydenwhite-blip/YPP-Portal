# Mentorship Unification Plan

> Critical review + redesign of the entire mentorship experience: one connected
> system built around **relationships, check-ins, and next steps**, with the
> Meetings (mentorship-owned) and Action Tracker (canonical) as the execution
> backbone. Status: **plan for approval** — no implementation has begun.

## A. Decisions locked

| # | Decision | Consequence |
|---|---|---|
| D1 | **Meetings stay mentorship-owned** (`MentorshipSession`), *not* folded into officer `OfficerMeeting` | Validated by permissions: the officer Meetings Tracker is `requireOfficer()`-gated, so mentees couldn't see their own check-ins there. |
| D2 | **Commitments/next-steps fold into the canonical `ActionItem`** (Action Tracker), one portal-wide record, with a mentee carve-out | `MentorshipActionItem` retired & migrated; the duplicate side-by-side action panels collapse to one. |
| D3 | **Advising = out of scope** (College Advisor, `/my-advisees`, `/operations/advising`) | Only terminology alignment + cross-links; no data-model absorption. |

## B. Complete audit (what exists today)

**B1 — Surfaces.** Route consolidation already shipped: canonical hubs are
`/mentorship/*` (mentor/chair), `/my-mentor/*` (mentee), `/admin/mentorship/*`
(admin). Legacy redirects: all of `/mentorship-program/*`,
`/admin/mentorship-program/*`, `/mentor/{ask,feedback,resources}`,
`/admin/mentor-match`, `/admin/instructor-mentor-matching`. Real surfaces
remaining: 20 mentor/mentee pages, 7 admin pages, plus M2 application/matching
pages (flag ON), plus the queue/Person-360 integrations.

**B2 — Duplication & fragmentation (the real targets):**
1. **Two action systems on one page** — `/mentorship/mentees/[id]` shows a "Action
   Tracker items (cross-team)" panel *and* a separate mentorship "Action Plan"
   (`MentorshipActionItem`). (D2 fixes this.)
2. **Three execution stores** — `MentorshipSession`, `MentorshipActionItem`,
   `MentorshipCheckIn` all log "what happened."
3. **Two mentor homes** — `/mentorship` (Mentor Workspace) and
   `/mentorship/dashboard` (M2 capacity dashboard).
4. **Two relationship-workspace routes, two keys** — mentor
   `/mentorship/mentees/[menteeId]` vs admin
   `/admin/mentorship/relationships/[mentorshipId]` render *different* code for
   the *same* relationship.
5. **Needs-Attention computed 4–5×** with 3 thresholds (45/21/14 days) — incl. a
   byte-identical duplicate in `admin-mentorship-command-center.ts` and
   `mentorship-hub.ts`; `mentorship-health.ts` is a parallel engine not wired to
   the canonical `attention.ts`.
6. **`/mentorship/chair` is an alias of `/mentorship/reviews`**;
   `/mentorship/feedback/[menteeId]` redirects to `/mentorship/reviews/[menteeId]`.
7. **~8 mentor + ~8 mentee top-level nav links** for concepts that belong inside
   the relationship.

**B3 — Terminology (map to fix):**

| Concept | Today (inconsistent) | Canonical going forward |
|---|---|---|
| The pairing | Mentorship / pairing / circle / match / assignment | **Relationship** (a "Mentorship"); "Pairing" only in matching |
| Scheduled conversation | session / check-in / touchpoint / sync / meeting | **Check-in** (a `MentorshipSession`) |
| Follow-up | action item / commitment / follow-up / next step / task | **Next step** (an `ActionItem`) |
| Goal | goal / objective / G&R / growth goal | **Goal** (`GRDocumentGoal`) |
| Mentor workspace | "Mentorship" (nav) vs "Mentorship Program" (titles) | **Mentorship** everywhere |
| Mentee group | mentees / Your mentees / Circle / Support Circle | **Mentees** (people) / **Support circle** (multi-supporter only) |
| Risk phrasing | "quiet Nd" / "rhythm reset" / "Nd since check-in" / "Reach out" | one phrasing from one derivation |

**B4 — Important info currently hidden:** next-check-in date, last check-in, and
open next-steps live only deep inside the workspace; mentorship is **absent from
global search** (only person/applicant/partner/class/meeting/action are indexed —
so folding next-steps into `ActionItem` makes them searchable for free, and we'll
add relationship indexing); the mentee's own commitments are shown read-only and
"never copied into the tracker."

**B5 — Current Meetings connections:** none. Scheduling a session creates only
`MentorshipSession`; no `OfficerMeeting`; no query unions the two; a session is
invisible outside mentorship.

**B6 — Current Action connections:** a single manual, officer-only,
calm-surface-only bridge (`convertMentorshipCommitmentToAction` → `linkedActionId`);
no source-session provenance; no Action→commitment status sync.

## C. Target architecture

**C1 — Single source of truth:**

| Concept | Canonical record | Legacy retired/deprecated |
|---|---|---|
| Relationship | **`Mentorship`** | — |
| Check-in (scheduled conversation) | **`MentorshipSession`** (mentorship-owned, mentee-visible) | `MentorshipCheckIn` (migrate → timeline) |
| Next step / follow-up | **`ActionItem`** (`relatedEntityType="MENTORSHIP"`, `mentorshipSessionId` source) | `MentorshipActionItem` (migrate → `ActionItem`) |
| Goal | **`GRDocumentGoal`** | `Goal`/`GoalTemplate` (deprecated), `MentorshipProgramGoal` (interim) |
| Monthly review | **`MentorGoalReview`** | `MonthlyGoalReview`/`MonthlyGoalRating` |
| Self-reflection | **`MonthlySelfReflection`** | `ReflectionForm*` |
| Matching | **`MentorshipApplication` + `MentorshipMatchRecommendation`** (M2) | `MentorshipCircleMember` legacy matching |
| Needs-Attention | **one `deriveMentorshipAttention()`** + one threshold const | the 3 duplicate cadence calcs |

**C2 — Meetings vs Actions ownership (the locked split):** mentorship **meetings**
are canonical in mentorship and never become officer meetings; mentorship
**next-steps** are canonical `ActionItem`s and therefore appear in the officer
Action Tracker (for officers) *and* in-context for the mentee. (Deviation from the
brief's literal "put meetings in the Meetings Tracker," per the D1 steer + the
officer-gating reality — documented intentionally.)

**C3 — Navigation model** (honoring `validate-nav.mjs`: no dup hrefs, ≤8 core/role,
no dup labels):
- **One entry point: "Mentorship"** (role-aware).
- Mentor core nav → **Mentorship** (overview) + **Review inbox**. (`schedule,
  feedback, ask, resources, awards, expertise, unlock-sections` leave top-level
  nav; reachable inside the workspace / a "More" submenu.)
- Mentee core nav → **My Mentor** (one hub). The 8 `/my-mentor/*` links become
  in-page sections.
- Admin → **Mentorship** cockpit with tabs **Overview · Relationships · Matching ·
  Review** (G&R lives under Relationships).
- Fix "Mentorship" vs "Mentorship Program" title mismatch.

**C4 — Page hierarchy:**
- `/mentorship` — **Mentor Overview**: needs-attention, upcoming check-ins,
  relationships list, one primary action. (Retire `/mentorship/dashboard`; fold
  capacity/expertise into Matching/Overview.)
- `/mentorship/mentees/[id]` — **Relationship Workspace** (primary unit; one
  shared component).
- `/mentorship/reviews` (+ `/chair/[reviewId]`) — **Review**.
- `/my-mentor` — **Mentee hub** (sectioned single page).
- `/admin/mentorship` — **Admin cockpit** (tabs above) +
  `/admin/mentorship/relationships/[id]` reusing the *same* workspace component.

**C5 — Relationship Workspace** (answers the product-principle questions in ≤5s):

| Question | Where it's answered |
|---|---|
| Who am I mentoring / who mentors this person | Header: mentor + mentee names, status, next check-in |
| What needs to happen next | **Next step** (derived, see H) — single primary action |
| Last / next check-in | Header + Check-ins section |
| Overdue / blocked | Next step + open next-steps list (live `ActionItem` status) |
| Goals being worked on | Goals section (`GRDocumentGoal`) |
| Recommendations | Recommendations section |
| Follow-up required | Open next-steps (canonical `ActionItem`s) |
| Where to record an update | Inline check-in flow (schedule/run/complete) |
| Where leadership reviews it | Admin cockpit reuses the same workspace |

Structure: **Header** (people, status, next check-in, one primary action) ·
**Main** (next step, goals, recent check-ins, open next-steps, recommendations) ·
**Context** (progressive-disclosure: profile, history, related actions). Replaces
today's ~15-card collapse.

**C6 — Component consolidation:** one `RelationshipWorkspace`; one **Next steps**
panel (canonical actions only — delete the side-by-side `LinkedActionsPanel` +
"Action Plan"); one check-in flow (delete `CheckInPanel`); one needs-attention
derivation.

**C7 — Person 360:** already summarize-and-linked — keep. Add mentor/mentee role +
next check-in + open next-steps (now real `ActionItem` counts) + deep link; no
rebuilt UI.

## D. Merge / delete / retire
- **Merge:** the two relationship-workspace pages → one component;
  `/mentorship/dashboard` → Overview/Matching; `chair` alias → keep `reviews`
  only; the 4–5 needs-attention calcs → one.
- **Retire (already redirects, verify + drop dead code):** `/mentorship-program/*`,
  `/admin/mentorship-program/*`, `/mentor/{ask,feedback,resources}`,
  `/admin/mentor-match`, `/admin/instructor-mentor-matching`.
- **Delete after migration:** `MentorshipActionItem` CRUD/UI, `MentorshipCheckIn`
  panel, the manual `convertMentorshipCommitmentToAction` bridge, duplicate
  `cadenceRisks`, `mentorship-health.ts` parallel engine.

## E. Schema changes (additive, nullable, backfill-free)
1. `ActionItem.mentorshipSessionId` (nullable FK → `MentorshipSession`,
   `ON DELETE SET NULL`) + index — the "source check-in" link (mirror of
   `officerMeetingId`).
2. Reuse existing `ActionItem.relatedEntityType="MENTORSHIP"`/`relatedEntityId`,
   `visibility`, `sourceType` — no new enums.
3. No drops in this pass: `MentorshipActionItem` and `MentorshipCheckIn` kept until
   data is migrated and reads cut over, then removed in a later migration.

## F. Server-action / API changes
- New `createMentorshipNextStep` (replaces `createMentorshipActionItem`):
  authorizes via **relationship membership** (mentor/chair/admin of *that*
  `Mentorship`), creates a canonical `ActionItem` (`relatedEntityType="MENTORSHIP"`,
  `mentorshipSessionId`, member-safe `visibility`, lead = owner).
- `completeMentorshipSession`: keep session as canonical meeting; on complete →
  append outcome to timeline, create follow-up `ActionItem`s inline, set next
  check-in (next scheduled session), recompute attention.
- Repoint reads: `getSupportWorkspaceData`, `getMyMentorshipActionItems`, queue
  `mentorship_commitment` loop, Person-360 → read `ActionItem` (via
  `getActionsForEntity("MENTORSHIP", id)`) instead of `MentorshipActionItem`.
- Collapse `cadenceRisks` callers onto `deriveMentorshipAttention`.

## G. Permission changes
- **Creation carve-out:** mentorship next-steps created via the
  relationship-membership path above (not the global officer gate), so a plain
  `MENTOR` can create them.
- **Visibility:** mentorship `ActionItem`s created with a member-safe visibility
  (never `OFFICERS_ONLY`) + mentee as LEAD/EXECUTING → existing
  `canViewAction`/`canEditAction` already let the mentee see and complete them. No
  officer Action Tracker page is exposed to mentees; they act in-context
  (workspace, `/my-mentor`, `/my-actions`).

## H. Sync & recalculation
- **No status copying** — single source of truth: completing the `ActionItem` *is*
  completion; the workspace reads it live; leadership/Person-360/queue update
  automatically.
- **Next-step derivation (deterministic):** overdue action → blocked action →
  action due soon → missing next check-in → upcoming check-in → review/cycle due →
  none. Lives in the canonical mentorship selectors, reading `ActionItem`s +
  sessions + cycle stage. Replaces the manual cycle-only heuristic.

## I. Migration strategy (non-breaking, preserve history)
Phased behind existing flags; legacy redirects stay. Additive schema first →
backfill script migrates each `MentorshipActionItem` → `ActionItem` (idempotent;
reuse existing `linkedActionId` to skip already-bridged) → cut reads over → verify
→ later migration drops the old table. `MentorshipCheckIn` → timeline notes (P2,
separate script). Sessions/reviews/reflections untouched.

## J. Files likely to change (high-level)
- **Schema/migration:** `prisma/schema.prisma`, new
  `prisma/migrations/*_add_action_mentorship_session_link`,
  `scripts/backfill-mentorship-actions.ts`.
- **Server:** `lib/mentorship-hub-actions.ts`, `lib/mentorship-hub.ts`,
  `lib/people-strategy/{action-items-actions,action-permissions,action-queries,mentorship-my-actions}.ts`,
  `lib/admin-mentorship-command-center.ts`, `lib/operations/attention.ts`,
  `lib/queue/{from-mentorship,mentorship-load}.ts`, `lib/mentorship/selectors.ts`
  + `view-model.ts`, `lib/help-agent/search-indexing.ts`.
- **UI:** `app/(app)/mentorship/mentees/[id]/page.tsx`,
  `app/(app)/admin/mentorship/relationships/[id]/page.tsx`,
  `app/(app)/mentorship/page.tsx`, `app/(app)/my-mentor/**`,
  `components/mentorship/**` (workspace, next-steps, check-in flow),
  `lib/navigation/catalog.ts`,
  `components/people-strategy/{linked-actions-panel,operational-context-panel}.tsx`.
- **Delete (post-migration):** `lib/mentorship-checkin-actions.ts`,
  `components/mentorship/check-in-panel.tsx`, `MentorshipActionItem` CRUD paths.

## K. Tests
- **Workflows:** mentor (find mentees → open relationship → next step → record
  check-in → add next step → see goals/notes); mentee (find mentor, next check-in,
  goals, recommendations, next steps); program-lead (review, overdue, reassign,
  intervene); leadership (whole program, why, action).
- **Cross-system integration:** (1) schedule a check-in → appears in workspace +
  both Person 360s; (2) complete a check-in → relationship updates, next-step
  `ActionItem`s created in the Action Tracker, attention recalculates; (3) create a
  next-step → relationship context attached, shows in owner's Action queue +
  workspace + Person 360; (4) complete/block a next-step from the Action Tracker →
  workspace next-step changes, leadership updates, timeline records it; (5)
  leadership intervention → find overdue/blocked → assign/complete → item clears.
- **Unit:** mentee-visibility predicate, mentorship creation authorization,
  next-step derivation order, single needs-attention threshold. Update existing
  `tests/lib/mentorship-*.test.ts`.

## L. Phased rollout
1. Schema + backfill (additive). 2. Server cutover to canonical `ActionItem` +
   creation carve-out. 3. Unified Relationship Workspace + collapse duplicate
   panels. 4. Overview + nav simplification + terminology. 5. One needs-attention
   derivation + search indexing. 6. Retire dead code + `MentorshipCheckIn`
   migration. Each phase is independently shippable, tests green, redirects intact.

## M. Requirement coverage
Base plan items 1–12 → §B1/B2/B3/B4/D/D/C1/C3/C4/(C6+E)/I/J. Integration additions
1–12 → §B5/B6/D/C1-C2/E/F/G/H(UI in C5-C6)/I/H/K/D. The brief's "appears in the
Meetings Tracker" is intentionally **not** implemented as officer-meeting
membership (per D1); mentorship meeting visibility is delivered via the workspace,
Person 360, leadership review, and search.

---

## Audit appendix — canonical data model reference

- **Relationship:** `Mentorship` (status ACTIVE/PAUSED/COMPLETE, `cycleStage`,
  `kickoff*`, `chairId`). Distinct adjacent pairings (out of scope):
  `MentorshipCircleMember`, `StudentAdvisorAssignment`, `CollegeAdvisorship`.
- **Meeting/check-in:** `MentorshipSession` (+ `MentorshipScheduleRequest`,
  `MentorAvailabilityRule`/`Override`). No FK to `OfficerMeeting` (kept separate by
  D1).
- **Next step:** canonical `ActionItem` (`relatedEntityType="MENTORSHIP"`,
  `leadId`, `visibility`, `sourceType`, new `mentorshipSessionId`).
  `MentorshipActionItem` retired.
- **Goals:** `GRDocumentGoal` on `GRDocument`; `MentorshipProgramGoal` interim.
- **Reviews:** `MentorGoalReview` + `GoalReviewRating`; `MonthlySelfReflection`.
- **Matching (M2, flag ON):** `MentorshipApplication` +
  `MentorshipMatchRecommendation` (+ `ExpertiseArea`/`MentorExpertise`).
- **Cross-portal layer (reuse):** `getOperationalContextForEntity("MENTORSHIP",
  id)`, `OperationalContextPanel`, `getActionsForEntity`,
  `deriveMentorshipAttention`.
