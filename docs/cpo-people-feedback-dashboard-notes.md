# CPO People & Performance Dashboard — Implementation Notes

**Scope shipped:** the **People & Performance** view (`/people/performance`)
on ui-v2 — the Leadership/Board people table (active work split Lead vs
Executing, quarterly review placement, calendar-anchored monthly check-in
dots, concrete signal chips) — and, the centerpiece, the **reviewable Request
Monthly Feedback workflow**: suggested collaborators with visible reasons and
shared work, an editable recipient list, an email preview built by the same
code that sends, and honest send results. Companion to the master plan
(§9, §19, §22) and the People Strategy phase notes.

## What already existed (audit result — reused, not rebuilt)

The People Strategy engine was already in the schema and `lib/people-strategy/`:

- `FeedbackRequest` — one row per (subject, collaborator, month); response
  bodies readable ONLY via `getFeedbackResponsesForSubject()` →
  `requireLeadership()`.
- `CheckIn` (monthly, compiled; `performanceRating` derived from live goal
  data) and `QuarterlyReview` (performance × potential on `GoalRatingColor`,
  `successionFlag`, decision).
- `loadPeopleDashboard()` + pure `people-dashboard-selectors.ts` (trend,
  workload warning, lead/executing split) feeding the legacy
  `/actions/people` dashboard.
- The legacy "Request Monthly Feedback" was a **blind bulk send**
  (`requestMonthlyFeedback` → `sendFeedbackRequest`): no review step, no
  reasons, no preview. That UX gap is what this pass replaces.
- Recipient form at `/people-strategy/feedback/[id]` (collaborator-only read,
  404 for everyone else including the subject).
- `requireLeadership()` = ADMIN + (LEADERSHIP | SUPER_ADMIN subtype) — the
  codebase's CPO/Board tier; `requireBoard()` = SUPER_ADMIN only.

No second profile system, no new rating concepts, no new metrics were added.

## Route built

`app/(app)/people/performance/page.tsx` — **People & Performance**
("Review workload, check-ins, feedback requests, and leadership signals
across YPP.")

- Stat strip (click-to-filter `StatCardV2`): Needs check-in · Feedback
  pending · Reviews due · Workload flags · Succession. Every count states its
  concrete definition ("no June 2026 check-in", "no 2026-Q2 review").
- `FilterBar` chips mirror the stats; `UrlSyncedSearchInput` searches
  name/role/department/expertise. Filtering is server-side via searchParams
  (same pattern as `/people`).
- Table columns: Member (name opens the person 360 preview via `PersonLink`
  — preview-first, §18) · Department/Expertise · Active work (top 2 Lead +
  top 2 Executing with deadlines, "View all N →" to the member workspace) ·
  Quarterly review (`Perf`/`Pot` badges + matrix label + "No review for
  2026-Q2" flag) · Monthly check-ins (dots + trend) · Signals · Actions
  (Request feedback / Open review & check-in →
  `/admin/instructors/[id]/manage#people-strategy`, the existing deep
  workspace with the quarterly review form, check-in compile, and
  confidential feedback responses).
- Board members additionally see the Board escalation roll-up link
  (affordance only; the destination enforces `requireBoard()`).

## Permission model

- Route: 404 unless `isPeopleDashboardEnabled()` (ENABLE_PEOPLE_DASHBOARD)
  AND `requireLeadership()` passes — identical gating to the legacy
  `/actions/people`, so the surface is invisible to instructors, students,
  applicants, parents, and non-leadership officers/admins.
- Server actions (`prepareMonthlyFeedbackPlan`, `sendPlannedFeedbackRequests`)
  re-check `requireLeadership()` AND both flags
  (ENABLE_PEOPLE_DASHBOARD + ENABLE_ACTION_TRACKER_EMAILS) on every call —
  client-side hiding is never the boundary.
- The send action only accepts collaborator **ids**; reasons/context are
  recomputed server-side from live data, and ids not backed by current shared
  work are refused (`notSuggested` in the result).
- Recipients see only their own request (`getFeedbackRequestForCollaborator`
  is unchanged in its viewer check); no admin links appear in the email
  (the only link is the recipient's own form).
- Response bodies remain Leadership/Board-only; this pass reads **counts**
  only on the dashboard.

## The feedback request workflow

`components/people-strategy/feedback-request-drawer.tsx` (ModalV2):

1. "Request feedback" on a row opens the drawer for that member.
2. `prepareMonthlyFeedbackPlan` loads: member, selectable target months
   (current + two previous, validated again at send time), reply-by date
   (now + 7 days), suggested collaborators with reasons + shared work, and
   who was already asked per month.
3. Leadership reviews: each recipient shows name, role/title, email status,
   reasons ("Worked with Brayden on 2 action items in the last 120 days ·
   Brayden's mentor"), and context chips (Action/Class/Mentorship/Meeting).
   Direct-work collaborators with an email are pre-checked; meetings-only
   overlaps and people without an email start unchecked; "Already asked"
   rows are disabled for that month.
4. Collapsible email preview, rendered from `buildFeedbackRequestEmailContent`
   — the exact builder `sendMonthlyFeedbackRequestEmail` uses, so preview ≡
   sent email (greeting, month, work-item list, due date, 3–5 minute
   estimate, confidentiality note).
5. Send → `sendPlannedFeedbackRequests` creates one `FeedbackRequest` per
   approved recipient (DB-unique on subject+collaborator+month makes it
   idempotent; P2002 → "already requested") and emails each new one.
6. Honest result summary: created / already-requested / not-suggested /
   emails sent / emails NOT sent (no address or provider failure) are
   reported as separate numbers — a failed email is never claimed as sent.

### Feedback review → check-in (the loop closes)

Rows with any feedback request show **Review feedback (N in)**, opening
`FeedbackReviewDrawer`:

- `loadFeedbackReviewForSubject` (server action, `requireLeadership()` +
  ENABLE_PEOPLE_DASHBOARD; the body read goes through the already-gated
  `getFeedbackResponsesForSubject`) returns responses grouped by month,
  newest first: confidential bodies with collaborator + date, who is still
  pending, and whether the month already has a compiled `CheckIn`.
- Each month has a one-click **Compile monthly check-in** (or *Recompile*)
  button that calls the EXISTING `compileCheckIn` upsert unchanged — the
  unique (userId, month) key means recompiling refreshes the same row; the
  derived rating (or its absence) is reported honestly after the click and
  the table's dots/stats refresh.
- Compile is hidden with an explanatory note when ENABLE_QUARTERLY_REVIEWS
  is off (`canCompile` from the loader); the existing action also enforces
  that flag + `requireOfficer()` server-side. `compileCheckIn` now also
  revalidates `/people/performance`.

### Collaborator suggestion logic (`lib/people-strategy/feedback-plan.ts`)

Evidence sources (all real records, window = 120 days):

1. Action items the subject leads or is assigned to → co-leads/co-assignees,
   with item titles + deadlines and whether the subject leads.
2. Active mentorships → the other parties, worded by THEIR role relative to
   the subject (mentor / mentee / chairs the mentorship).
3. Class offerings where both are on the instructional team (lead instructor
   + active `RegularInstructorAssignment`s).
4. Officer meetings both attended in the window (max 40 most recent;
   counted as weaker evidence).

Ranking: `evidenceScore` = actions×2 + classes×2 + mentorship×3 +
min(meetings, 3); top 12 suggestions are shown. Archived users and the
subject are excluded. Composition (`composeSuggestedCollaborator`) is pure
and unit-tested.

## Email / notification behavior

- New `sendMonthlyFeedbackRequestEmail` in `lib/email.ts` renders the shared
  content object into the standard `emailShell`; delivery goes through the
  existing `sendEmail` (Resend/SMTP with env guards — no provider configured
  → graceful `{success:false}`, which the workflow reports as "not sent").
- The legacy `sendFeedbackRequestEmail` and the legacy bulk
  `requestMonthlyFeedback` action are untouched (the legacy page still
  works); the legacy page's banner now points to People & Performance.
- No new queue; the email send is synchronous per recipient at request time,
  matching every other transactional email in the codebase.

## Data model changes (additive only)

`FeedbackRequest` gained four nullable columns (legacy rows/flows
unaffected), migration
`prisma/migrations/20260612210000_feedback_request_review_context/`:

- `requestedById` (+ `requestedBy` relation, SetNull) — who asked.
- `reason TEXT` — the human-readable why, shown on the recipient form.
- `contextItems JSONB` — display snapshot `[{type,id,title,detail}]` of the
  shared work at request time (never re-read as live data).
- `dueAt` — the reply-by date stated in the email.

Idempotent SQL (ADD COLUMN IF NOT EXISTS, guarded FK) per repo convention.
The proposed MonthlyFeedbackRequest/Recipient/ContextItem models from the
brief were NOT added — the existing `FeedbackRequest` row already IS the
per-recipient record, so extending it was the minimal, convention-consistent
change.

## Feedback response form

Existing `/people-strategy/feedback/[id]` upgraded in place (no second
form system): it now shows **why the recipient was asked** (the persisted
reason + shared-work list), the reply-by date, and four guiding prompts
(did well / could improve / followed through / anything the CPO should
know). Submission stays a single confidential free-text body — adding
structured response fields would be a schema change deferred deliberately
(see next steps). Tokenized external (signed-out) feedback was NOT built
this pass; the form remains authenticated, which also keeps the
collaborator-only read check trivial.

## Monthly check-in dots / review / flag logic

- Dots (`buildCheckInCalendarDots` + `MonthlyCheckInDots`): the last three
  **calendar** months anchored to today — a month with no compiled `CheckIn`
  renders an explicit hollow "missing" dot (the legacy strip skipped absent
  months). States: the four `GoalRatingColor` levels (At Risk / Needs
  Attention / On Track / Above & Beyond), gray "completed, no rating",
  hollow "missing"; every dot carries month + state in `title`/`aria-label`.
- Trend reuses `computeTrend` (earliest vs latest rated check-in points);
  "improving"/"declining" render as signals, never a score.
- Review logic: latest `QuarterlyReview` badges reuse `RATING_LABELS` and
  `getMatrixLabel`; "Reviews due" = no review whose `quarter` equals the
  current `"YYYY-Qn"`.
- Workload reuses `workloadWarning` (overdue count, or ≥5 active items);
  tone is danger only when an action is actually overdue.
- Succession = the stored `successionFlag` from the latest review (a formal
  decision, not a recomputed heuristic).
- "Needs check-in" = no `CheckIn` row for the current month;
  "feedback pending" = outstanding `FeedbackRequest`s (counts only).

## Help Agent / search

**Deliberately not added this pass.** Help Agent suggestions support
`tier: OFFICER` + `adminOnly`, but not a Leadership-subtype gate — an entry
would advertise the route to every admin (who would then 404). Plumbing a
`leadershipOnly` tier through the app shell → HelpAgentProvider is a small
but shared-chrome change that belongs in its own pass. FeedbackRequests were
not added to SearchDocument: they are confidential rows that must never
surface in shared search; the dashboard's "Feedback pending" filter is the
finding path.

## ui-v2 components added

- `components/people-strategy/people-performance-table.tsx` — the table.
- `components/people-strategy/feedback-request-drawer.tsx` — the workflow.
- `components/people-strategy/feedback-review-drawer.tsx` — responses +
  one-click check-in compile.
- `components/people-strategy/monthly-check-in-dots.tsx` — reusable dots.

All compose existing primitives (PageHeaderV2, StatCardV2, FilterBar,
DataTableShell/TableV2, StatusBadge, ModalV2, BannerV2, Button/ButtonLink);
no new globals.css, no new tokens.

## CSS

No deletions: the legacy `/actions/people` page (and its `.ps-*` chassis,
which is portal-wide per the Phase 3F audit) stays live, so none of its CSS
went dead this pass. Freeze baseline unchanged at **10,731** and the check
passes.

## Validation (this environment)

- `typecheck` — green.
- Production build — green (exit 0).
- `css:freeze-check` — green (10,731, unchanged).
- `nav:check` — green (no nav changes; route is reached from `/people`).
- ESLint on all touched files — clean.
- `prisma validate`/`generate` — schema valid, client generated (the only
  validate complaint is the missing `DIRECT_URL` env var — no DB here).
- Targeted vitest: `people-strategy-feedback-plan` (19),
  `people-performance-selectors` (13), plus regression runs of
  `people-strategy-feedback` (legacy flow), `people-dashboard-selectors`,
  `page-helper-resolve`, `authorization*` — all green.
- `page-helper-coverage` fails identically to its documented pre-existing
  baseline; `/people/performance` is registered and NOT in the failure list.
- No `DATABASE_URL` → no migration apply or browser smoke here; no
  Playwright (per scope).

## Known limitations

1. Recipients can only be removed from / re-added to the suggested list —
   adding an arbitrary person is intentionally unsupported (every request
   must be backed by visible shared work).
2. The response stays one free-text field; the structured questions are
   prompts, not stored fields.
3. No reminder/expiry handling for outstanding requests (`dueAt` is stated
   in the email but nothing nudges at the deadline).
4. Email sending is synchronous per recipient; with ≤30 recipients per send
   this is fine, but a queue would be better under provider flakiness.
5. The legacy `/actions/people` blind bulk-send still exists (banner now
   routes people to the new flow); retiring it is a follow-up decision.
6. Dashboard rows are capped at 500 (inherited from `loadPeopleDashboard`).

## Recommended next steps

1. ~~Feedback review surface~~ — **shipped in this pass** (see "Feedback
   review → check-in" above).
2. Structured response fields (went well / improve / follow-through /
   concerns / optional rating) as nullable columns, with the form upgraded
   to match.
3. Reminder cron for outstanding requests past `dueAt` (reuse the
   `ActionEmailLog` dedupe convention).
4. `leadershipOnly` Help Agent suggestion tier, then add "People needing
   monthly feedback" / "Feedback requests pending" entries.
5. Retire the legacy `/actions/people` bulk send once the new flow has been
   used in anger for a cycle.
6. Fold a feedback summary line into `compileCheckIn`'s compiled notes
   ("3 collaborator responses on file for June") — deliberately not done
   yet to keep the existing action's documented contract (reflection +
   goal review only) unchanged.
