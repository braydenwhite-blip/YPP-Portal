# Calm Mentorship — extend Calm Mode across every mentorship surface

> Master plan + index. Per-phase detail lives in the `phase-NN-*.md` files in this directory.

## Context

PR #441 (commit `32a8c8d`, "Global Calm mode + actionable My Queue", merged at HEAD `7738c08`) built the
**global Calm/Executive mode** infrastructure and an **actionable My Queue**, but **touched zero
mentorship files**. A grep confirms **no mentorship surface imports any Calm primitive today** (the only
"calm" token in the mentorship tree is a code comment in `mentor-command-center.tsx`). The route
consolidation in `MENTORSHIP_REDESIGN_PLAN.md` already shipped as redirects with passing tests.

This effort makes the already-consolidated mentorship surfaces first-class Calm citizens, wires mentorship
work into My Queue + People 360, and (per the approved decisions) **rebuilds their information
architecture**, **enables Mentorship 2**, and **allows additive schema** where justified.

**Outcome:** every role lands on one calm, purposeful surface (mentor / mentee / admin / chair); each
surface has an Executive Mode for full density; mentorship work shows up as resolvable My Queue loops and
on People 360; the application→match intake (M2) is live.

## Approved scope decisions (AskUserQuestion, 2026-06-16)

1. **Surface scope:** Mentorship core only — advising verticals (college advising, `/operations/advising`,
   `/my-advisees`) are **out of scope**.
2. **Depth:** **Full IA rebuild** per surface (not just a density overlay).
3. **Schema:** **Additive schema allowed** where justified (nullable, backfill-free, no destructive changes).
4. **Mentorship 2:** **Calm-ify AND enable** `ENABLE_MENTORSHIP_2` (a real production exposure change),
   only after Phase 09 verification.

## Repository baseline

- Branch `claude/bold-gates-p2qoo7`; HEAD `7738c08` (merge of PR #441); clean tree.
- PR #441 = `32a8c8d` (24 files, +2132/−588): `lib/command-mode-cookie.ts`,
  `components/command-center/command-mode.tsx`, `components/home/leadership-home-calm.tsx`,
  `components/queue/{queue-inline-panels,queue-runner}.tsx`, queue sources, `lib/queue/types.ts`, tests.
- Discrepancy (do not guess-resolve): `MENTORSHIP_REDESIGN_PLAN.md` reads as if consolidation is future;
  the repo shows it shipped. Treat that doc as historical; target the consolidated routes as they exist.

## Calm architecture to reuse (the pattern to copy)

- `lib/command-mode-cookie.ts` — `CommandMode = "calm"|"executive"`, default `calm`.
- `components/command-center/command-mode.tsx` — `CommandModeProvider`, `useIsExecutive`, `CalmOnly`,
  `ExecutiveOnly`, `CalmCollapse`, `CommandModeToggle`.
- `app/(app)/layout.tsx` reads the cookie → `components/app-shell.tsx` wraps the provider (flash-free).
- Calm primitives: `components/command-center/simple.tsx` (`PrimaryFocusCard`, `SimpleRow`,
  `SimpleListCard`, `SimpleActionStrip`, `SimpleSurface`, `EmptySimpleState`), `primitives.tsx`,
  `lib/command-center/shared.ts` (`operationalState`, `dueLabel`, `whenLabel`, `initialsFromName`).
- ui-v2: `components/ui-v2/*` (`TrackerShell`, `TrackerRow`, `TrackerPreview`, `MetricStrip`,
  `StatCardV2`, `KeyFactsGrid`, `ViewSwitcher`).
- **Reference implementation:** `components/home/leadership-home.tsx` —
  `<CalmOnly><…Calm/></CalmOnly><ExecutiveOnly><…Executive/></ExecutiveOnly>` over a server-built pure VM.

## Canonical data model (confirmed in `prisma/schema.prisma`)

- Relationship: **`Mentorship`** (status ACTIVE/PAUSED/COMPLETE, `cycleStage`, `kickoff*`, `chairId`).
- Sessions: **`MentorshipSession`** (+ `MentorshipScheduleRequest`, `MentorAvailabilityRule`/`Override`).
- Monthly cycle: **`MonthlySelfReflection`** + **`MentorGoalReview`** + `GoalReviewRating`
  (`cycleNumber` is authoritative; `Mentorship.cycleStage` is denormalized).
- Goals: **`GRDocumentGoal`** (instance) on `GRDocument`; `MentorshipProgramGoal` = legacy template.
- Commitments / in-relationship actions: **`MentorshipActionItem`**; org-wide **`ActionItem`** links via
  `relatedEntityType:"MENTORSHIP"`.
- Support: **`MentorshipRequest`**; Feedback: `MentorGoalReview`, `QuarterlyFeedbackRequest`/`Response`
  (confidential), `MentorFeedbackRequest`/`MentorResponse`.
- Matching: legacy → `MentorshipCircleMember`; **M2** → `MentorshipApplication` +
  `MentorshipMatchRecommendation` (approve creates canonical `Mentorship`).
- Advising (`CollegeAdvisorship`, `StudentAdvisorAssignment`) is a separate domain — **out of scope**.
- Deprecated (do not read): `MonthlyGoalReview`, `ReflectionForm/Submission`, `Goal`, `ProgressUpdate`,
  `QuarterlyCommitteeReview`, `AchievementPointLedger`.

## Shared view-model (Phase 01)

New `lib/mentorship/view-model.ts` + `lib/mentorship/selectors.ts` (pure, serializable, server-built),
exposing: `MentorshipRelationshipSummary`, `CurrentUserRole`, `NextMentorshipFocus`, `SessionSummary`,
`ActiveGoal`, `UnresolvedCommitment`, `PendingFeedback`, `QueueCapability`, `MentorshipPermissions`.
Fed by existing loaders: `getSimplifiedMentorKanban`, `getMentorEngagementSnapshot`,
`getInstructorMentorshipMembership`, `getLeadershipContext`/`getMenteeMentorshipView`,
`getAdminMentorshipCommandCenterData`, `goal-review-actions`/`self-reflection-actions`,
`mentorship-gr-binding`, rubric copy from `lib/mentorship-canonical.ts`.

## Permissions & privacy (enforce in fetchers, not UI)

Use `lib/mentorship-access.ts`, `lib/mentorship-chair-access.ts`, `lib/admin-capabilities.ts`,
`lib/people-strategy/feedback-permissions.ts`, `lib/authorization.ts` (`requireOfficer`,
`requireLeadership`). Key rules: mentee sees only released reviews (`releasedToMenteeAt`), never drafts /
private notes / reassignment reasons / confidential feedback; People-360 mentorship panel respects
`hasMentorshipMenteeAccess`; enabling M2 must keep application reads applicant-only + admin-only.

## Schema posture (additive only, prefer reuse)

- Default: **no migrations.** Reuse `Mentorship`, `MentorshipSession`, `MentorGoalReview`,
  `GRDocumentGoal`, `MentorshipActionItem`, `MentorshipRequest`.
- Allowed if justified (nullable, backfill-free): `MentorshipSession.summary`,
  `MentorshipActionItem.linkedActionId`. Avoid a queue dismissal field (resolve from source state).
- Enabling `ENABLE_MENTORSHIP_2` is a config flip — the M2 migrations already exist.

## Queue integration (Phase 10 — `lib/queue/from-mentorship.ts`)

Ten concrete loops, each with a real completion condition (no generic "Resolve"): kickoff pending,
reflection due, review due, chair approval, changes requested, overdue commitment, open support request,
pending feedback, quiet mentorship (add inline), M2 needs-recommendations / recs-ready. Register in
`lib/queue/engine.ts`, extend `QueueInline` + `components/queue/queue-inline-panels.tsx`, add mutations to
`lib/queue/queue-actions.ts` with `revalidatePath`. Full table in `phase-10`.

## Validation sequence (Phase 12)

Focused mentorship/M2 tests → queue tests → command-mode tests → `typecheck` → `lint` → integration/app
tests → `build` → `nav:check` → route + permission verification → server/client boundary + hydration →
responsive → a11y → dead-control review → `test:e2e:smoke`.

## Risk register

Advising kept out of scope; selectors read only canonical models; privacy enforced in fetchers; M2 flag
flipped only after end-to-end verification (rollback = unset env); reuse `relatedEntityType` for Action
links (idempotent, no dup commitments); every queue item resolves from source state; UI-only rebuild keeps
server actions intact; additive nullable schema only; 12 reversible phased commits; Executive parity
preserves leadership workflows; document `ENABLE_MENTORSHIP_2` now ON.

## Decisions still open (recommendations)

- **D1 commitments→Actions:** one-click bridge (recommended) vs auto-create.
- **D2 private notes:** keep on session (recommended) vs relationship-level.
- **D3 session summary:** reuse `notes` first (recommended) vs add nullable `summary`.
- **D4 feedback visibility:** keep current confidentiality (recommended) vs all-shared.
- **D5 commit strategy:** staged commits per phase (recommended) vs one squash.
- **D6 M2 enablement:** flip flag only after Phase 09 verification (recommended) vs early.

## Phase index

| # | Phase | File | Risk |
|---|---|---|---|
| 01 | Canonical model & selectors | `phase-01-canonical-model-and-selectors.md` | low |
| 02 | Shared Calm mentorship primitives | `phase-02-shared-calm-primitives.md` | low |
| 03 | Mentor home & relationship list | `phase-03-mentor-home-and-relationship-list.md` | med |
| 04 | Relationship detail | `phase-04-relationship-detail.md` | med |
| 05 | Sessions: prep & live | `phase-05-sessions-prep-and-live.md` | med |
| 06 | Session completion & summaries | `phase-06-session-completion-and-summaries.md` | med |
| 07 | Goals, commitments, Actions, Follow-Ups | `phase-07-goals-commitments-actions-followups.md` | med |
| 08 | Feedback | `phase-08-feedback.md` | low-med |
| 09 | Matching, support & enable M2 | `phase-09-matching-support-and-enable-m2.md` | high |
| 10 | Queue & People 360 integration | `phase-10-queue-and-people-360.md` | med |
| 11 | Executive Mode | `phase-11-executive-mode.md` | med |
| 12 | Responsive, a11y, cleanup, validation | `phase-12-responsive-a11y-cleanup-validation.md` | low |

**Recommended first phase:** Phase 01 (pure, low-risk, unblocks all UI work).

## Definition of done

Every in-scope surface renders Calm + Executive variants via `CommandModeProvider`; each role has one
purposeful surface with a single clear next move; mentorship work appears as resolvable My-Queue loops and
on People 360; M2 intake→match→pair works end-to-end with the flag ON; all tests pass; `typecheck`,
`lint`, `build`, `nav:check`, e2e smoke green; no placeholder/dead controls; privacy enforced in fetchers.
