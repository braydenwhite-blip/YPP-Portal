# Partner Automation — Phase 1 (Chapter Partner CRM)

Turns the Chapter President partner workflow into a real CRM + automation engine,
built **on top of the existing partner infrastructure** (no second Partner model,
no parallel timeline, no fake-AI hubs). A CP can now research partners, send
outreach, track follow-ups, schedule meetings, log outcomes, confirm partners,
manage logistics, raise/resolve issues, run weekly check-ins, and bring concrete
numbers to Chapter Impact Meetings.

## What already existed (reused, not rebuilt)

- **`Partner` model** already had nearly every field needed: `stage`, `priority`,
  `partnerType`, `contactName/Title/Email/Phone`, `location`, `lastContactedAt`,
  `nextFollowUpAt`, `meetingDate`, `notes`, `chapterId`, `relationshipLeadId`,
  timestamps. Field mapping used as-is: **address → `location`**, **main contact →
  `contactName/Title/Email/Phone`**, **status → `stage`**.
- **`PartnerNote`** is the operating timeline (append-only, FK-less `authorId`).
- **12-value `stage` vocabulary** + labels/hints/groupings in `lib/partners-constants.ts`
  (kept stable — see "Stage strategy").
- **Chapter access conventions** — `getChapterViewerContext()` / `requireChapterManager()`
  / `isChapterLeadership()` in `lib/chapters/access.ts`.
- **Search indexing** (`syncPartnerSearchDocument`), **ui-v2 design system**, the
  admin pipeline board at `/admin/partners`, and the operations consumers in
  `lib/operations/*`.

The core gap: **all partner mutations were `requireAdmin()`** — Chapter Presidents
couldn't operate their own partners — and `/partners` was a plain table.

## Stage strategy (no risky vocabulary migration)

The DB `stage` vocabulary is **unchanged**. A pure presentation layer
(`lib/partners/pipeline.ts`) maps the 12 stages onto calmer CP "lanes"
(Research / Contacted / Follow-Up Due / Interested / Meeting / Proposal /
Confirmed / Closed) and derives the single **next action** per partner. The
admin board and `lib/operations/*` consumers are untouched.

## What was built/extended

### Data model (additive only — one migration)
`prisma/migrations/20260630150000_partner_automation_crm/migration.sql`
- `Partner.logistics JSONB?` — logistics readiness checklist state.
- `PartnerNote.metadata JSONB?` — structured timeline metadata (meeting outcome,
  issue severity/escalation/resolution, scheduled follow-up date, close reason).
- `PARTNER_NOTE_KINDS` extended with CRM timeline kinds (`OUTREACH_SENT`,
  `FOLLOW_UP_SENT`, `RESPONSE_RECEIVED`, `MEETING_SCHEDULED`, `MEETING_OUTCOME`,
  `PROPOSAL_SENT`, `LOGISTICS_CONFIRMED`, `ISSUE`, `ISSUE_RESOLVED`, `CHECK_IN`,
  `CLOSED`) — additive, label-based, one importer.

### Pure logic (deterministic, fully unit-tested)
- `lib/partners/follow-up.ts` — business-day math (`addBusinessDays`, skip weekends),
  `isFollowUpDue`, 5-business-day outreach / 1-day meeting cadences.
- `lib/partners/pipeline.ts` — CP lanes, `partnerCpLane`, `partnerNextAction`.
- `lib/partners/transitions.ts` — deterministic stage-transition engine
  (email sent → REACHED_OUT + 5-day follow-up; meeting outcomes → stage + 24h
  follow-up; confirm; close; etc.).
- `lib/partners/outreach-email.ts` — 7 deterministic email templates (initial,
  follow-up, meeting confirmation, post-meeting, closing, logistics, check-in). No AI, no sending.
- `lib/partners/meeting-brief.ts` — deterministic meeting brief (ask, fallbacks,
  objections, prior timeline, next step, what to log).
- `lib/partners/logistics.ts` — 9-item readiness checklist + "confirmed but incomplete".
- `lib/partners/duplicate-detection.ts` — name/website/email/phone scoring (ignores
  generic email domains).
- `lib/partners/metrics.ts` — Chapter Impact Meeting metrics (Weeks 1–10) from data.
- `lib/partners/import-parse.ts` — CSV/TSV paste parser (header aliases or positional).
- `lib/partners/research/*` — Phase-2 research scaffolding: `PartnerResearchCandidate`,
  scoring, candidate→partner conversion, dedupe.

### Permissions (the core fix)
`lib/partners/permissions.ts` — chapter-aware guards built on `requireChapterManager`:
- `canManagePartnerForChapter(user, chapterId, ledChapterId)` — pure predicate.
- `requireChapterPartnerAccess(chapterId)` — guard create/import.
- `requirePartnerAccess(partnerId)` — guard mutations on an existing partner.
- `partnerScopeWhere(scope)` — list scoping (leadership = all, CP = own chapter).

### Server actions
`lib/partners/crm-actions.ts` (+ `crm-schemas.ts` zod) — all chapter-guarded:
`createChapterPartner`, `updatePartner`, `markEmailSent`, `logResponse`,
`scheduleMeeting`, `logMeetingOutcome`, `sendProposal`, `confirmPartner`,
`closePartner`, `updatePartnerStageCrm`, `scheduleFollowUp`, `toggleLogisticsItem`,
`raisePartnerIssue`, `resolvePartnerIssue`, `logPartnerCheckIn`,
`addPartnerTimelineNote`, `importChapterPartners`.

### UI
- `/partners` — **Partner Command Workspace** (`components/partners/crm/partner-workspace.tsx`):
  today's work, impact metric strip (all-time / this-week), pipeline board (board/list),
  operating queues (follow-ups due / meetings / waiting / logistics incomplete).
- `/partners/[id]` — **operating room** (`partner-operating-room.tsx`): next-action
  banner, all workflow actions, outreach composer (copy + mark sent), meeting brief,
  logistics checklist, timeline, open issues, contact info.
- `/partners/new` — add-partner form with live duplicate detection.
- `/partners/import` — paste-a-spreadsheet bulk import with dup preview.
- Chapter home: "partner follow-ups due" chip (`lib/chapters/attention.ts`).
- Demo seed: `seedPartners()` in `prisma/seed.ts` (partners across every lane,
  timeline notes, an escalated issue, complete/incomplete logistics).

## What Chapter Presidents can now do
Research and add leads (manual or spreadsheet import), generate & copy outreach,
mark sent (auto-schedules the 5-business-day follow-up), see what's due, log
responses, schedule meetings (with a generated brief), log structured meeting
outcomes (sets the 24h follow-up), send proposals, confirm partners, work a
logistics checklist, raise/escalate/resolve issues, run weekly check-ins, and read
live Chapter Impact metrics — all scoped to **their** chapter.

## What admin / national leadership can still do
Everything, across all chapters. The admin pipeline board at `/admin/partners`
(behind `ENABLE_PARTNER_PIPELINE`) and `lib/partners-actions.ts` are untouched.
Leadership sees all partners in the new workspace; the leadership home's existing
"Partner follow-ups due" stat is unchanged.

## Tests added (11 new suites, 110 partner tests — `npm test`)
follow-up date logic; stage + meeting-outcome transitions; outreach email
generation; pipeline lanes + next action; logistics readiness; duplicate
detection; impact metrics aggregation; research scoring/conversion; meeting
brief; CSV/TSV import parser; permission helper — plus regression guards from
the review pass. All green.

## Adversarial review pass
A multi-agent review (authorization isolation, logic correctness,
Next/data-integrity, contract consistency) was run and every finding
independently verified. Authorization isolation found nothing. Six confirmed
issues were fixed: stage-vs-lane metric counting (a replied-but-overdue partner
was mis-counted as "no reply"); a single `isPartnerFollowUpDue` definition so
the board column, metric, and queue agree; chronological meeting-queue sorting;
`planEmailSent` no longer demoting an advanced partner; resilient bulk import
(skip a row on a unique-name race instead of aborting); and timezone-correct
meeting-time capture.

## Migrations needed
One additive migration (above). Run `prisma migrate deploy` (the build already
does). No enum changes, no renames, no data backfill; existing rows unaffected.

## Verification status
- `npm test` — partner suite green (110 tests across 11 new suites).
- `tsc --noEmit` — **0 errors in any file changed by this work.** (9 pre-existing
  type errors remain in untouched files — `app/(app)/admin/programs/page.tsx`,
  `lib/chapters/chapter-os.ts`, `lib/classes/{attendance-actions,instructor-cockpit,reflection-actions}.ts`
  — they concern unrelated Prisma enum-array typings and exist independently of
  this change.)
- `npm run nav:check` — passes. `eslint` — clean on all new code.

## What remains for Phase 2
**Automated Partner Research Assistant** — find & score schools, libraries, and
community centers by chapter location, emitting `PartnerResearchCandidate`s into
the existing import/dedup/convert pipeline (the data contract and scoring already
exist in `lib/partners/research/`). Only after this CP-facing CRM is solid.
Other follow-ups: surface escalated partner issues on the leadership home,
optional gated email-send integration, and per-partner class linking.
