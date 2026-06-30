// ============================================================================
// Universal Workflow Engine — blueprint catalog: Programs & Curriculum
// ============================================================================

import {
  actionOnEnter,
  autoAdvanceWhenReady,
  escalateOverdue,
  meetingOnEnter,
  notifyOnEnter,
  startWorkflowOnComplete,
  typedActionOnEnter,
} from "./helpers";
import type { WorkflowBlueprint } from "./types";

export const PROGRAM_BLUEPRINTS: WorkflowBlueprint[] = [
  // --------------------------------------------------------------------------
  // 1. Program Launch
  // --------------------------------------------------------------------------
  {
    key: "program-launch",
    name: "Program Launch",
    description: `Take a new program from a bare idea to a published, enrolling ClassOffering — \
the full path from "we want to run a robotics class" to enrollOpen on a real listing.

Typical duration: 7-12 days end to end (proposal 2-3 days, setup 3-4 days, recruitment running \
in parallel with the back half of setup and continuing roughly 10 days after publish until the \
class starts or its lead-time window closes).

Primary owner: the Chapter President sponsoring the offering. Secondary owners: the instructor \
once assigned (staffing + content), and Staff/Leadership for any program that needs a budget or \
new-partner sign-off before it can be scoped.

Success definition: a ClassOffering record that has moved DRAFT -> PUBLISHED with a confirmed \
instructor, a real schedule (meetingDays, meetingTime, deliveryMode all set, not placeholders), \
and enrollment open against a stated capacity — not just a listing that exists on paper.

KPIs: days from proposal to PUBLISHED; % of launched offerings that reach at least 60% of \
capacity before their start date; % of proposals that have a named instructor before they reach \
the setup stage (late staffing is the single biggest predictor of a slipped start date); % of \
offerings published with a complete schedule (no "TBD" meeting time at publish).

Common failure modes: scope gets defined in someone's head and never written down, so the person \
recruiting instructors can't describe the class to candidates; an instructor is "tentatively" \
assigned and that tentative status quietly becomes the plan, with no one confirming availability \
against the actual proposed schedule; the listing gets published before delivery mode and \
capacity are real numbers, which then have to be walked back with already-enrolled families.

Hard-won notes: write the scope (age group, subject, delivery mode, target capacity) down before \
you start instructor outreach — recruiting against a vague scope wastes both the recruiter's time \
and the candidate's. Don't publish until the schedule fields are the real schedule, not a draft \
you're "pretty sure" about; PUBLISHED is a promise to families.`,
    domain: "PROGRAMS",
    defaultOwnerRole: "CHAPTER_PRESIDENT",
    escalateAfterHours: 168,
    stages: [
      {
        key: "proposal",
        name: "Proposal",
        description:
          "Define what the program actually is and get sign-off to proceed. Exit when scope is written down and approved by the chapter president (or leadership, for budget-impacting proposals). Owner: proposing chapter president or staff member.",
        isInitial: true,
        steps: [
          {
            key: "define",
            name: "Define program scope",
            kind: "TASK",
            dueOffsetHours: 72,
            description:
              "Write down the target age group, subject area, delivery mode (VIRTUAL/IN_PERSON/HYBRID), and target capacity before anything else happens. The most common mistake is leaving this in someone's head — a scope that exists only as a verbal understanding can't be handed to a recruiter or used to draft the listing. Put it in the proposal doc even if it feels obvious; you'll reread it in two weeks when the original conversation is fuzzy.",
          },
          {
            key: "approve",
            name: "Get program approval",
            kind: "APPROVAL",
            dueOffsetHours: 120,
            description:
              "Chapter president (or leadership, if the program needs new budget or a new partner relationship) signs off that this program should be built out. Don't let this become a rubber stamp on an undefined scope — the approver should be able to point to the actual age group, subject, and capacity numbers, not just a program name. A common mistake is approving 'robotics for kids' with no further detail, which just pushes the scoping problem downstream.",
          },
        ],
      },
      {
        key: "setup",
        name: "Setup",
        description:
          "Turn the approved proposal into a real ClassOffering: a staffed instructor, a confirmed schedule, and a DRAFT listing ready to flip to PUBLISHED. Exit when all three are locked in, not tentative. Owner: chapter president, working with the assigned instructor.",
        steps: [
          {
            key: "staff",
            name: "Assign instructor",
            kind: "TASK",
            dueOffsetHours: 96,
            description:
              "Match an instructor against the scope from the proposal stage: do they teach this subject, are they available for the proposed meetingDays/meetingTime, and can they commit through the full semester (not just the first few sessions). The recurring mistake here is locking in an instructor who is 'probably available' without confirming against the actual proposed schedule — that mismatch surfaces three weeks later as a scramble to reschedule or re-staff. Confirm availability in writing before moving on.",
          },
          {
            key: "schedule",
            name: "Set schedule & location",
            kind: "TASK",
            dueOffsetHours: 96,
            description:
              "Lock in meetingDays, meetingTime, deliveryMode, and (for IN_PERSON/HYBRID) the physical location. This needs to be the real, final schedule before the listing is drafted — changing the time after families start enrolling causes drop-off. Tip: confirm room/venue availability for IN_PERSON before publishing, not after; a published listing with no confirmed room is a liability.",
          },
          {
            key: "publish",
            name: "Publish listing",
            kind: "TASK",
            dueOffsetHours: 120,
            description:
              "Flip the ClassOffering from DRAFT to PUBLISHED and set enrollmentOpen once instructor, schedule, and capacity are all real. This is the literal DRAFT -> PUBLISHED status transition, not a metaphor — double-check the record fields (title, startDate, endDate, capacity, semester) are filled in correctly before flipping the switch, since a half-filled listing going live is a worse look than a slightly later launch.",
          },
        ],
      },
      {
        key: "recruit",
        name: "Recruit",
        slaHours: 240,
        description:
          "Drive enrollment against the published listing's capacity. Exit when the offering reaches a healthy enrollment threshold relative to capacity, or its lead-time window for the term closes. Owner: chapter president, with help from instructor and outreach volunteers.",
        steps: [
          {
            key: "advertise",
            name: "Advertise the program",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Push the published listing out through the chapter's normal channels (newsletter, partner orgs, social, word of mouth) as soon as it's live — momentum in the first week matters more than total volume spread evenly. A common mistake is publishing and then waiting for organic discovery; published does not mean discovered, someone has to actively push it.",
          },
          {
            key: "enroll",
            name: "Reach enrollment target",
            kind: "TASK",
            isRequired: false,
            description:
              "Track enrollment-vs-capacity weekly and flag early if the program is tracking well under target — that's the moment to do a second advertising push or reconsider the start date, not the week before it starts. Optional because some programs intentionally run below capacity (small-cohort models), but track it regardless.",
          },
        ],
      },
      {
        key: "live",
        name: "Live",
        isTerminal: true,
        description:
          "The program has moved to IN_PROGRESS with its first session run. Terminal stage for this blueprint — ongoing operation is handled by the Class Weekly Operations blueprint. Owner: instructor, chapter president oversight.",
        steps: [
          {
            key: "kickoff",
            name: "Run first session",
            kind: "TASK",
            description:
              "Confirm the first session actually happened as scheduled and capture attendance from day one — a clean attendance baseline makes the recurring weekly-operations workflow much easier to run from week two onward. Tip: have the instructor send a one-line recap to the chapter president after session one; it's the cheapest early warning signal for a program that's off to a rocky start.",
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("setup", "Set up the program", 96),
      typedActionOnEnter("setup", "Assign and confirm instructor for new program", "INSTRUCTOR_RECRUITING", 96),
      notifyOnEnter("recruit", "Begin recruitment & advertising"),
      typedActionOnEnter("recruit", "Advertise the published program listing", "OUTREACH", 48),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 2. Curriculum Approval
  // --------------------------------------------------------------------------
  {
    key: "curriculum-approval",
    name: "Curriculum Approval",
    description: `Move a piece of curriculum from a drafting instructor's hands through chapter \
review and, where required, global leadership review, to FULLY_APPROVED — the status that \
satisfies launch readiness for a program. This blueprint mirrors the real \
CurriculumApprovalStage enum exactly, including both revision loops (chapter-level and \
global-level), because curriculum is the one approval chain in the portal where "send it back" \
is the normal path, not the exception.

Typical duration: 4-10 days for a clean pass (48h CP review SLA + 72h global review SLA + \
drafting/submission time); revision loops routinely add 3-7 days each and a curriculum that \
bounces twice can take 3+ weeks door to door.

Primary owner: the submitting instructor (drafting and revising). Secondary owners: the Chapter \
President (CP_REVIEW / CP_REVISION_REQUESTED gate) and global content leadership / \
CONTENT_ADMIN (GLOBAL_REVIEW / GLOBAL_REVISION_REQUESTED gate).

Success definition: curriculum reaches FULLY_APPROVED with both a CP and a global sign-off on \
record, not just "good enough, ship it" — FULLY_APPROVED is the literal status that downstream \
program-launch readiness checks key off of.

KPIs: % of submissions that reach FULLY_APPROVED without a single revision request (a clean-pass \
rate that's too low for too long signals the submission template needs work, not that instructors \
need more scolding); median time-in-CP_REVIEW against the 48h SLA; median time-in-GLOBAL_REVIEW \
against the 72h SLA; revision-loop count per submission (more than one full loop at either gate is \
a red flag worth a process conversation, not just a content one).

Common failure modes: curriculum submitted without a clear weekly-topics breakdown gets bounced \
back at CP_REVIEW more often than not — reviewers can approve a session-by-session plan in \
minutes but won't sign off on a vague overview; instructors treat CP_REVISION_REQUESTED as \
optional polish rather than a hard gate and resubmit near-unchanged content, which just burns \
another 48h SLA cycle; global review gets skipped or rubber-stamped under deadline pressure \
because the program's start date is close, which is exactly when a thin curriculum needs the \
most scrutiny, not the least.

Hard-won notes: the two revision-requested stages are not failures of the process — they are the \
process. Treat CP_REVISION_REQUESTED and GLOBAL_REVISION_REQUESTED as first-class stages with \
their own owner (the instructor) and their own due date, not a side-channel email exchange that \
the workflow doesn't see. A reviewer's job at either revision stage is to leave specific, \
actionable feedback — "needs work" with no detail just produces another vague resubmission.`,
    domain: "CURRICULUM",
    defaultOwnerSubtype: "CONTENT_ADMIN",
    escalateAfterHours: 96,
    stages: [
      {
        key: "not-submitted",
        name: "Drafting",
        description:
          "Mirrors NOT_SUBMITTED — the instructor is still drafting; nothing is waiting on a reviewer yet. Exit when the instructor submits a complete draft. Owner: the instructor authoring the curriculum.",
        isInitial: true,
        steps: [
          {
            key: "draft",
            name: "Draft curriculum",
            kind: "DOCUMENT",
            dueOffsetHours: 96,
            description:
              "Write the curriculum with an explicit week-by-week topics breakdown, not just a one-paragraph overview of the subject. The single most common reason curriculum bounces at CP_REVIEW is a missing or vague weekly structure — reviewers need to see what happens in session 1 versus session 6 to approve it. Tip: borrow the weekly-topics table format from a previously FULLY_APPROVED curriculum in the same subject area if one exists.",
          },
          {
            key: "submit",
            name: "Submit curriculum",
            kind: "DOCUMENT",
            dueOffsetHours: 24,
            description:
              "Formally submit the draft, which moves it into CP_REVIEW and starts the 48h chapter-review SLA clock. Don't submit a placeholder to 'hold a spot in the queue' — a thin submission just gets bounced and costs a full revision cycle; it's faster to take one more day in drafting than to submit early and loop back.",
          },
        ],
      },
      {
        key: "cp-review",
        name: "Chapter Review",
        slaHours: 48,
        description:
          "Mirrors CP_REVIEW (and folds in CP_REVISION_REQUESTED as the send-back edge from this stage) — the Chapter President owes a review within 48 hours of submission. Exit either forward to CP_APPROVED on approval, or back to revision on a send-back; a human decision drives both. Owner: the Chapter President.",
        steps: [
          {
            key: "cp-approve",
            name: "Chapter president review",
            kind: "APPROVAL",
            dueOffsetHours: 48,
            description:
              "Review against the weekly-topics breakdown, age-appropriateness, and whether the chapter has the materials/space to actually run it as written. The 48h SLA is real and tight — don't let curriculum sit in an inbox; if you can't get to a full review in time, do a partial pass and flag what's outstanding rather than missing the SLA silently. Approving moves it to CP_APPROVED; sending it back moves it to the chapter revision stage with specific notes attached.",
          },
        ],
      },
      {
        key: "cp-revision",
        name: "Chapter Revision Requested",
        description:
          "Mirrors CP_REVISION_REQUESTED — the CP sent it back to the instructor to revise. Exit when the instructor resubmits, which routes back into CP_REVIEW for a fresh look (not a silent auto-approval). Owner: the instructor.",
        steps: [
          {
            key: "cp-revise",
            name: "Revise per chapter feedback",
            kind: "DOCUMENT",
            dueOffsetHours: 72,
            description:
              "Address the CP's specific feedback point by point, not a generic pass over the whole document. The common mistake is resubmitting near-unchanged content hoping it clears on a second look — reviewers notice, and it just burns another 48h cycle. If the feedback was unclear, ask the CP for clarification before resubmitting rather than guessing.",
          },
        ],
      },
      {
        key: "cp-approved",
        name: "Chapter Approved",
        description:
          "Mirrors CP_APPROVED — the CP has signed off and it's ready to escalate to global leadership. This is a brief pass-through stage, not a place curriculum should linger. Exit automatically once escalation fires. Owner: system/CONTENT_ADMIN (escalation is automatic, not a manual gate).",
        steps: [
          {
            key: "escalate",
            name: "Escalate to global review",
            kind: "AUTOMATED",
            dueOffsetHours: 12,
            description:
              "Hand the CP-approved curriculum to global leadership for the second review pass. This step should be near-instant — there's no human decision required here, just routing. If curriculum is sitting in CP_APPROVED for more than a day, something's broken in the handoff and it's worth checking manually rather than assuming the automation will catch up.",
          },
        ],
      },
      {
        key: "global-review",
        name: "Global Review",
        slaHours: 72,
        description:
          "Mirrors GLOBAL_REVIEW (and folds in GLOBAL_REVISION_REQUESTED as the send-back edge) — escalated; global leadership owes a review within 72 hours. Exit either forward to FULLY_APPROVED, or back to a revision stage; again, a human decision drives both, and the revision can route either to the global revision stage or, for substantial issues, back to the instructor via chapter revision. Owner: global content leadership / CONTENT_ADMIN.",
        steps: [
          {
            key: "global-approve",
            name: "Global content review",
            kind: "APPROVAL",
            dueOffsetHours: 72,
            description:
              "Check for cross-chapter consistency, brand/safety standards, and whether the curriculum is reusable as a catalog entry beyond the one chapter that proposed it — this is a different lens than the CP's local-fit review, not a duplicate of it. The common failure mode is treating this as a rubber stamp because the CP already approved it; global review exists precisely to catch things a single chapter's perspective misses. Don't skip or rush this under launch-date pressure — that's when a thin curriculum most needs scrutiny.",
          },
        ],
      },
      {
        key: "global-revision",
        name: "Global Revision Requested",
        description:
          "Mirrors GLOBAL_REVISION_REQUESTED — global leadership sent it back for revision. Exit when the instructor resubmits, which routes back into GLOBAL_REVIEW for a fresh look. Owner: the instructor.",
        steps: [
          {
            key: "global-revise",
            name: "Revise per global feedback",
            kind: "DOCUMENT",
            dueOffsetHours: 72,
            description:
              "Address global leadership's specific notes — these are often about cross-chapter consistency or standards rather than local content quality, so don't assume the same fix that would satisfy a CP applies here. Tip: loop the original CP in on the revision if the feedback touches something they specifically approved, so the second CP look (if needed) isn't a surprise.",
          },
        ],
      },
      {
        key: "fully-approved",
        name: "Fully Approved",
        isTerminal: true,
        description:
          "Mirrors FULLY_APPROVED — global leadership has signed off, and this status satisfies launch readiness for a program. Terminal stage. Owner: CONTENT_ADMIN for catalog publication.",
        steps: [
          {
            key: "publish",
            name: "Publish to catalog",
            kind: "TASK",
            description:
              "Add the now-FULLY_APPROVED curriculum to the shared catalog so other chapters can find and reuse it — a curriculum that only lives in the original instructor's files didn't get the full value out of the review it just went through. Tag it clearly with subject and age group so it's actually discoverable later.",
          },
        ],
      },
    ],
    transitions: [
      { fromStageKey: "not-submitted", toStageKey: "cp-review", isAutomatic: true },
      { fromStageKey: "cp-review", toStageKey: "cp-approved", label: "Approved", isAutomatic: false },
      { fromStageKey: "cp-review", toStageKey: "cp-revision", label: "Send back for revision", isAutomatic: false },
      { fromStageKey: "cp-revision", toStageKey: "cp-review", label: "Resubmitted", isAutomatic: true },
      { fromStageKey: "cp-approved", toStageKey: "global-review", isAutomatic: true },
      { fromStageKey: "global-review", toStageKey: "fully-approved", label: "Approved", isAutomatic: false },
      {
        fromStageKey: "global-review",
        toStageKey: "global-revision",
        label: "Send back for revision",
        isAutomatic: false,
      },
      { fromStageKey: "global-revision", toStageKey: "global-review", label: "Resubmitted", isAutomatic: true },
    ],
    automations: [
      typedActionOnEnter("not-submitted", "Draft and submit curriculum", "CURRICULUM", 96),
      typedActionOnEnter("cp-review", "Chapter review of curriculum", "CURRICULUM", 48),
      notifyOnEnter("cp-review", "Curriculum awaiting chapter review (48h SLA)"),
      typedActionOnEnter("cp-revision", "Revise curriculum per chapter feedback", "CURRICULUM", 72),
      notifyOnEnter("cp-revision", "Curriculum sent back for chapter-level revision"),
      typedActionOnEnter("global-review", "Global review of curriculum", "CURRICULUM", 72),
      notifyOnEnter("global-review", "Curriculum awaiting global review (72h SLA)"),
      typedActionOnEnter("global-revision", "Revise curriculum per global feedback", "CURRICULUM", 72),
      notifyOnEnter("global-revision", "Curriculum sent back for global-level revision"),
      notifyOnEnter("fully-approved", "Curriculum fully approved — launch-ready"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 3. Class Weekly Operations
  // --------------------------------------------------------------------------
  {
    key: "class-weekly-operations",
    name: "Class Weekly Operations",
    description: `The recurring operating rhythm for a single IN_PROGRESS ClassOffering — \
the lightweight weekly loop of prepping the session, running it, and closing the loop on \
attendance and notes. This is deliberately a ritual, not a project: short SLAs measured in \
hours, not days, and a tight, repeatable step list.

Typical duration: under 48 hours per cycle — session prep the day or two before class, \
attendance + instructor notes logged same-day or next-day after the session runs.

Primary owner: the instructor running the class. Secondary owner: the chapter president, who \
spot-checks attendance trends and materials issues rather than running the loop themselves.

Success definition: every session for an IN_PROGRESS offering has materials confirmed ahead of \
time, attendance logged the same day, and instructor notes captured before the next session — no \
gaps in the weekly record.

KPIs: % of sessions with same-day attendance logging; % of sessions with a materials check \
completed before session start (versus discovered missing mid-session); average instructor-notes \
completion lag (hours after session end); attendance trend (week-over-week retention) as an early \
signal for program health, feeding into the mid-program review.

Common failure modes: attendance logging slips by a few days "because it's easy to remember," \
then becomes a backfill guess that's wrong; materials checks get skipped for a class that's been \
running fine for weeks, until the one week supplies didn't arrive and nobody noticed until \
session start; instructor notes turn into a single word ("good") that's useless for the \
mid-program review three weeks later.

Hard-won notes: this workflow only earns its keep if it stays lightweight — if any one step \
starts taking more than 15-20 minutes, that's a sign the step needs a better template, not that \
the instructor needs to spend more time on it. Same-day attendance logging is the highest-value \
habit in this loop; everything else can tolerate a little lag, that can't.`,
    domain: "PROGRAMS",
    defaultOwnerRole: "INSTRUCTOR",
    escalateAfterHours: 48,
    stages: [
      {
        key: "session-prep",
        name: "Session Prep",
        slaHours: 24,
        description:
          "Confirm the upcoming session is ready to run: materials on hand, topic plan pulled from the approved curriculum. Exit when the instructor confirms readiness, ideally the day before the session. Owner: the instructor.",
        isInitial: true,
        steps: [
          {
            key: "materials-check",
            name: "Check materials",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Confirm supplies and any session-specific materials (handouts, kits, tech) are actually on hand, not just ordered. The recurring mistake is assuming a recurring supply order will arrive on time and skipping the physical check — do the check even for a class that's been running smoothly for weeks, since that's exactly when it gets skipped and then bites.",
          },
          {
            key: "pull-topic",
            name: "Pull session topic from curriculum",
            kind: "TASK",
            dueOffsetHours: 12,
            description:
              "Confirm which week of the approved curriculum this session covers and have the plan in hand before walking in. Tip: keep a running note of any deviations from the original curriculum plan — small in-session adjustments add up and are useful context for the mid-program review.",
          },
        ],
      },
      {
        key: "session-run",
        name: "Session Run",
        slaHours: 12,
        description:
          "The session happens. Exit immediately once it's run — this stage exists mainly as a marker between prep and the close-out logging. Owner: the instructor.",
        steps: [
          {
            key: "run-session",
            name: "Run the session",
            kind: "TASK",
            dueOffsetHours: 12,
            description:
              "Run the planned session. If something goes off-plan (low attendance, a materials gap discovered mid-session, a behavioral issue), make a mental or quick written note now — it's much easier to capture accurately in the moment than to reconstruct during the close-out step later.",
          },
        ],
      },
      {
        key: "close-out",
        name: "Close-Out",
        slaHours: 24,
        isTerminal: true,
        description:
          "Log attendance and instructor notes the same day or next day. This is the terminal stage for a single weekly cycle; the next session starts a fresh instance. Owner: the instructor, spot-checked by the chapter president.",
        steps: [
          {
            key: "attendance",
            name: "Log attendance",
            kind: "FORM",
            dueOffsetHours: 24,
            description:
              "Log attendance the same day the session ran, while it's still accurate. Waiting even two or three days turns this into a guess, and guessed attendance quietly poisons the enrollment/retention numbers the mid-program review relies on. This is the single highest-value habit in the whole weekly loop — don't let it slip.",
          },
          {
            key: "instructor-notes",
            name: "Record instructor notes",
            kind: "FORM",
            dueOffsetHours: 24,
            description:
              "Write a few real sentences on how the session went — what worked, what didn't, any materials or pacing issues — not just a one-word status. These notes are the raw material the mid-program and final-evaluation reviews draw on; a string of empty notes makes both of those reviews much harder to do well.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("session-prep", "Prep for the upcoming class session"),
      typedActionOnEnter("session-prep", "Confirm materials and pull session topic", "CLASS_PLANNING", 24),
      typedActionOnEnter("close-out", "Log attendance and instructor notes", "OPERATIONS", 24),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 4. Program Mid-Program Review
  // --------------------------------------------------------------------------
  {
    key: "program-mid-program-review",
    name: "Program Mid-Program Review",
    description: `A checkpoint review roughly halfway through an IN_PROGRESS program's run, \
checking whether enrollment, attendance, and outcomes are tracking toward a healthy finish — \
and giving the instructor and chapter leadership a chance to course-correct while there's still \
time to matter.

Typical duration: 3-5 days (1-2 days to pull metrics from the weekly-operations record, 1 day to \
hold the review meeting, 1-2 days to record and act on adjustments).

Primary owner: the chapter president. Secondary owners: the instructor (brings ground-level \
context) and chapter leadership (for adjustments that need budget or scheduling changes).

Success definition: a documented go/no-change/adjust decision backed by real metrics pulled from \
the class's actual attendance and enrollment record, not a gut-check conversation with no data \
behind it.

KPIs: % of IN_PROGRESS programs that get a mid-program review at all (skipped reviews are the \
most common failure, not bad reviews); enrollment-vs-capacity ratio at the checkpoint; \
attendance retention trend (week 1 vs. checkpoint week); % of reviews that result in a recorded \
adjustment versus "no change needed" (a near-100% no-change rate across all programs usually means \
the review isn't looking hard enough, not that everything is fine).

Common failure modes: the review happens but skips pulling real metrics, turning into a vague \
"how's it going" chat that produces no actionable record; attendance data is incomplete because \
the weekly-operations logging slipped, so the review is working from guesses; adjustments get \
discussed verbally in the meeting but never written down, so nothing actually changes afterward.

Hard-won notes: this review is only as good as the weekly attendance/notes record it pulls from — \
if that's been spotty, fix the logging habit first rather than trying to compensate with a more \
thorough review meeting. A checkpoint that finds nothing wrong is a fine outcome as long as it \
actually looked.`,
    domain: "PROGRAMS",
    defaultOwnerRole: "CHAPTER_PRESIDENT",
    escalateAfterHours: 120,
    stages: [
      {
        key: "pull-metrics",
        name: "Pull Progress Metrics",
        slaHours: 48,
        description:
          "Gather real enrollment, attendance, and outcome data from the program's weekly-operations record. Exit when a metrics summary exists, not just an impression. Owner: chapter president, or a delegate pulling the numbers.",
        isInitial: true,
        steps: [
          {
            key: "enrollment-attendance",
            name: "Pull enrollment & attendance data",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Pull actual enrollment-vs-capacity and session-by-session attendance from the class's record, not an estimate from memory. If attendance logging has gaps (a known risk from the weekly-operations loop), flag that explicitly rather than quietly filling gaps with assumptions — an honest 'data is incomplete for weeks 3-4' is more useful than a falsely confident chart.",
          },
          {
            key: "outcomes-snapshot",
            name: "Pull early outcomes snapshot",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Pull together whatever outcome signal exists at the midpoint — instructor notes themes, any informal student/parent feedback, visible skill progress. This won't be as complete as the final evaluation's outcomes capture, and that's fine; the goal here is an early-warning read, not a final verdict.",
          },
        ],
      },
      {
        key: "leadership-review",
        name: "Review with Instructor & Leadership",
        slaHours: 48,
        description:
          "Hold the actual review conversation, grounded in the pulled metrics, with the instructor and chapter leadership. Exit when a clear track/at-risk assessment is reached. Owner: chapter president, facilitating.",
        steps: [
          {
            key: "review-meeting",
            name: "Hold mid-program review meeting",
            kind: "MEETING",
            dueOffsetHours: 48,
            description:
              "Walk through the pulled metrics with the instructor and relevant chapter leadership, and reach an explicit on-track / at-risk call. The common mistake is letting this slide into a generic check-in that never references the actual numbers pulled in the prior stage — bring the metrics summary into the room and discuss it directly.",
          },
        ],
      },
      {
        key: "adjustments-recorded",
        name: "Adjustments Recorded",
        isTerminal: true,
        description:
          "Document whatever came out of the review — concrete adjustments or an explicit 'on track, no change' call. Terminal stage; this is a one-time checkpoint, not an ongoing thread. Owner: chapter president.",
        steps: [
          {
            key: "record-adjustments",
            name: "Record adjustments or confirm on-track",
            kind: "DECISION",
            dueOffsetHours: 24,
            description:
              "Write down the outcome of the review meeting as a real record — either the specific adjustments agreed to (and who owns making them) or an explicit confirmation that the program is on track with no changes needed. Don't let this live only in meeting notes nobody revisits; it's the artifact the final evaluation will want to compare against.",
          },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("pull-metrics", "Pull mid-program enrollment and attendance metrics", "OPERATIONS", 48),
      meetingOnEnter("leadership-review", "Mid-program review meeting", "GENERIC", 48),
      notifyOnEnter("leadership-review", "Mid-program review meeting scheduled"),
      notifyOnEnter("adjustments-recorded", "Mid-program review complete"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 5. Program Final Evaluation
  // --------------------------------------------------------------------------
  {
    key: "program-final-evaluation",
    name: "Program Final Evaluation",
    description: `The wrap-up review once a program reaches COMPLETED: capture outcomes, gather \
instructor feedback, and document what to repeat or change — the institutional memory that makes \
the next semester's renewal decision an informed one instead of a guess.

Typical duration: 5-8 days (2-3 days to capture outcomes and feedback once the program ends, \
2-3 days for leadership review, 1-2 days to finalize recommendations).

Primary owner: the chapter president. Secondary owners: the instructor (the richest source of \
ground-level feedback) and chapter/global leadership (review and sign-off on recommendations).

Success definition: a written outcomes-and-recommendations record exists for the completed \
program before the renewal decision has to be made — not a renewal conversation that starts from \
a blank page.

KPIs: % of COMPLETED programs that get a final evaluation at all within 2 weeks of completion \
(the most common failure is simply not doing this once the program is over and attention has \
moved on); instructor feedback response rate; % of evaluations with a clear repeat/change \
recommendation versus an inconclusive one; time from COMPLETED status to evaluation completion.

Common failure modes: by the time anyone gets to this, the instructor has moved on to other \
things and gives a thin, rushed recollection instead of real feedback — capture it within days of \
the last session, not weeks; the evaluation captures what happened but skips the "what would we \
change" question, so the renewal decision has data but no actual recommendation; outcomes get \
captured only in qualitative impressions with nothing tying back to the attendance/enrollment \
numbers from the weekly-operations and mid-program records.

Hard-won notes: do this promptly — final evaluations done within a week of COMPLETED status are \
noticeably more detailed and useful than ones done a month later. This blueprint exists \
specifically to feed the renewal decision, so write recommendations as if the renewal reviewer \
has never seen the program run, because often they haven't.`,
    domain: "PROGRAMS",
    defaultOwnerRole: "CHAPTER_PRESIDENT",
    escalateAfterHours: 96,
    stages: [
      {
        key: "capture-outcomes",
        name: "Capture Outcomes & Feedback",
        slaHours: 72,
        description:
          "Gather final outcomes data and instructor feedback while the program is still fresh. Exit when both the data and the instructor's qualitative input are on record. Owner: chapter president, pulling from the instructor.",
        isInitial: true,
        steps: [
          {
            key: "outcomes",
            name: "Capture final outcomes",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Pull final enrollment, attendance retention, and any measurable skill/outcome data for the full run, building on the mid-program review's numbers rather than starting over. Tie this back to the original capacity and goals from program-launch — 'we hit 80% of capacity and held 90% attendance retention' is a useful sentence; 'it went well' is not.",
          },
          {
            key: "instructor-feedback",
            name: "Gather instructor feedback",
            kind: "FORM",
            dueOffsetHours: 72,
            description:
              "Get the instructor's feedback while it's fresh — within days of the last session, not weeks. Ask specifically what worked, what didn't, and what they'd change about the curriculum or logistics next time. The common mistake is sending a generic survey with no specific prompts, which gets a generic one-line answer back; ask pointed questions tied to the actual curriculum and schedule.",
          },
        ],
      },
      {
        key: "leadership-review",
        name: "Leadership Review",
        slaHours: 72,
        description:
          "Chapter (and, for programs with cross-chapter relevance, global) leadership reviews the captured outcomes and feedback. Exit when leadership has weighed in on what it means for the program's future. Owner: chapter president, with leadership input.",
        steps: [
          {
            key: "review-outcomes",
            name: "Review outcomes with leadership",
            kind: "APPROVAL",
            dueOffsetHours: 72,
            description:
              "Walk leadership through the captured outcomes and instructor feedback together, not as two disconnected documents. The goal is a shared read on whether the program met its goals, not just a leadership sign-off that someone looked at it — push for an actual opinion on repeat-as-is vs. repeat-with-changes vs. don't-repeat.",
          },
        ],
      },
      {
        key: "recommendations-recorded",
        name: "Recommendations Recorded",
        isTerminal: true,
        description:
          "Document the final what-to-repeat / what-to-change recommendations. Terminal stage for this blueprint; completion hands off to the renewal decision. Owner: chapter president.",
        steps: [
          {
            key: "record-recommendations",
            name: "Record repeat/change recommendations",
            kind: "DECISION",
            dueOffsetHours: 24,
            description:
              "Write specific, actionable recommendations — not 'consider changes' but the actual changes (e.g., 'move to Tuesday evenings,' 'cap capacity at 12 instead of 18,' 'swap unit 3 for a shorter unit'). This record is the direct input to the renewal decision, so write it for someone who wasn't in the room for any of the prior reviews.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("capture-outcomes", "Program completed — begin final evaluation"),
      typedActionOnEnter("capture-outcomes", "Capture final outcomes and instructor feedback", "OPERATIONS", 72),
      typedActionOnEnter("leadership-review", "Review program outcomes with leadership", "MEETING_PREP", 72),
      notifyOnEnter("recommendations-recorded", "Final evaluation complete — recommendations on record"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
      startWorkflowOnComplete(
        "program-renewal",
        "Decide whether to re-offer this program next semester"
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // 6. Program Renewal Decision
  // --------------------------------------------------------------------------
  {
    key: "program-renewal",
    name: "Program Renewal Decision",
    description: `Decide whether, and how, to re-offer a program next semester, using the final \
evaluation's recommendations as the starting point. This is the natural sequel to \
program-final-evaluation (it's auto-started from that blueprint's completion) and, conceptually, \
feeds into the chapter's broader semester-reset planning cycle the same way every other \
per-program renewal decision does — this blueprint doesn't chain to that process programmatically, \
but a "yes, renew" outcome here is exactly the kind of input a chapter's semester reset planning \
should be collecting from every active program.

Typical duration: 4-6 days (1-2 days to review prior performance against recommendations, 1-2 \
days to reach and record the renewal decision, 1-2 days to either kick off the next program-launch \
or formally close out a non-renewal).

Primary owner: the chapter president. Secondary owners: leadership (for programs with budget or \
cross-chapter implications) and the prior instructor (often the best candidate to re-staff if \
renewing).

Success definition: an explicit, recorded renew/change/discontinue decision exists before the next \
semester's planning cycle needs it — not a default-by-inertia "we'll probably run it again" with \
nothing written down.

KPIs: % of completed programs with a recorded renewal decision before the next semester's \
proposal window opens; % of "renew with changes" decisions that actually reference specific \
final-evaluation recommendations (versus a generic yes); time from program-final-evaluation \
completion to renewal decision; renewal rate trend by subject area (a subject with a falling \
renewal rate across chapters is worth a portfolio-level look, not just a program-level one).

Common failure modes: renewal gets decided by default — nobody actively says no, so it just \
happens again unchanged, recommendations from the final evaluation included; the decision happens \
but doesn't get linked back to the specific recommendations it's supposed to act on, so 'renew \
with changes' renewals end up identical to the prior run; a non-renewal decision is made verbally \
and never formally closed out, leaving a stale program record that confuses the next person who \
looks at it.

Hard-won notes: always re-read the final evaluation's recommendations before deciding, not just \
the topline outcome numbers — the recommendations are the whole point of having done that review. \
A "renew" decision should explicitly say whether it's renew-as-is or renew-with-changes, because \
those route very differently into the next program-launch.`,
    domain: "PROGRAMS",
    defaultOwnerRole: "CHAPTER_PRESIDENT",
    escalateAfterHours: 96,
    stages: [
      {
        key: "review-performance",
        name: "Review Prior Performance",
        slaHours: 48,
        description:
          "Pull the final evaluation's outcomes and recommendations as the basis for the renewal call. Exit once that record has actually been reviewed, not skimmed. Owner: chapter president.",
        isInitial: true,
        steps: [
          {
            key: "pull-evaluation",
            name: "Review final evaluation recommendations",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Re-read the program-final-evaluation's recorded recommendations in full, not just its outcomes summary — the recommendations are what this decision is supposed to act on. A common mistake is deciding renewal based only on whether enrollment looked fine, while ignoring specific change recommendations the instructor and leadership already agreed on.",
          },
          {
            key: "check-instructor-availability",
            name: "Check instructor availability for next semester",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Find out early whether the prior instructor (often the strongest candidate to re-staff, given they already know the material and the students) is available next semester — this materially changes how easy a 'renew' decision is to execute. Don't wait until after the renewal decision is made to ask; an unavailable instructor can flip a renew into a re-staff-from-scratch situation.",
          },
        ],
      },
      {
        key: "renewal-decision",
        name: "Renewal Decision",
        slaHours: 48,
        description:
          "Make and record the explicit renew / renew-with-changes / discontinue call. Exit once the decision is recorded with its rationale. Owner: chapter president, with leadership input for budget-impacting calls.",
        steps: [
          {
            key: "decide",
            name: "Record renewal decision",
            kind: "DECISION",
            dueOffsetHours: 48,
            description:
              "Record one of: renew as-is, renew with specific changes (list them, referencing the final evaluation's recommendations directly), or discontinue (with the reason). The common mistake is recording a vague 'yes, let's do it again' with no reference to whether changes were supposed to happen — be explicit, since this record is what the next program-launch (if any) will be built from.",
          },
        ],
      },
      {
        key: "next-step",
        name: "Re-Launched or Closed",
        isTerminal: true,
        description:
          "Either hand off into a fresh program-launch for next semester, or formally close out the program record if not renewing. Terminal stage. Owner: chapter president.",
        steps: [
          {
            key: "next-step-action",
            name: "Kick off relaunch or close out program",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "If renewing, start a new program-launch blueprint instance for next semester, carrying forward the scope and any agreed changes from the renewal decision so the new proposal stage isn't starting from zero. If discontinuing, formally close out the program record so it doesn't linger as an ambiguous open item the next time someone looks at the chapter's program list.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("review-performance", "Renewal decision needed — review prior program performance"),
      typedActionOnEnter("review-performance", "Review final evaluation and instructor availability", "CLASS_PLANNING", 48),
      notifyOnEnter("renewal-decision", "Renewal decision due"),
      notifyOnEnter("next-step", "Renewal decision recorded"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },
];
