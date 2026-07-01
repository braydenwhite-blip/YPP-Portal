// ============================================================================
// Universal Workflow Engine — blueprint catalog: Instructors & Mentorship
// ============================================================================
//
// Eight blueprints covering the full instructor lifecycle (recruiting →
// hiring → training/readiness gate → active teaching → performance support →
// recognition → bench/pause → reactivation) plus the 8-stage mentorship
// cycle. `instructor-hiring` and `instructor-training-readiness` are
// deliberately grounded in two real operator runbooks — see the inline
// citations below — rather than invented process shapes:
//   - docs/brayden/instructor-applicant-workflow-runbook.md
//   - docs/brayden/instructor-training-interview-native-runbook.md
// `mentorship`'s stage keys map 1:1 onto the real `MentorshipCycleStage`
// Prisma enum. All eight ship with `initialStatus` omitted (DRAFT by
// default) pending human review before publishing.

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

export const INSTRUCTOR_BLUEPRINTS: WorkflowBlueprint[] = [
  // ==========================================================================
  // 1. instructor-hiring — the real 7-stage InstructorApplicationStatus
  //    pipeline (SUBMITTED → UNDER_REVIEW → INTERVIEW_SCHEDULED →
  //    INTERVIEW_COMPLETED → CHAIR_REVIEW → APPROVED), per the applicant
  //    workflow runbook.
  // ==========================================================================
  {
    key: "instructor-hiring",
    name: "Instructor Hiring",
    description:
      "Purpose: take one instructor application from public submission through reviewer evaluation, structured interviews, chair decision, and onboarding sync — the live Instructor Applicant Workflow V1 pipeline (status field: InstructorApplicationStatus). This blueprint is the operational shadow of that system: it exists so every assignment, SLA, and decision has an owner, a due date, and an escalation path, not just a status column on a kanban.\n\n" +
      "Typical duration: 10–14 days end to end for a clean pass — 5 days reviewer SLA (120h) + 2–3 days to schedule + interview + a few days for interviewer rubrics to land + 1–2 days in the chair queue. Add 30 days if the application is REJECTED/WITHDRAWN/APPROVED and sits in its terminal state before the nightly auto-archive cron sweeps it.\n\n" +
      "Primary owner: the assigned reviewer (Stage 2) and lead interviewer (Stage 3–4), escalating to the HIRING_CHAIR (Stage 5) and back to whichever ADMIN/CHAPTER_PRESIDENT opened the application (Stage 1, Stage 6). Secondary owner: ADMIN, who retains full chair authority as a fallback whenever no HIRING_CHAIR is assigned (Risk 13).\n\n" +
      "Success definition: the application reaches APPROVED with a recorded InstructorApplicationChairDecision, the applicant's User.primaryRole flips to INSTRUCTOR, an InstructorApproval row is created with TRAINING_IN_PROGRESS, and syncInstructorApplicationWorkflow() completes so the native training/interview gate is wired up — at which point this blueprint chains into instructor-training-readiness.\n\n" +
      "KPIs: % of applications with a reviewer assigned within 24h of SUBMITTED; reviewer Overdue-chip rate (reviews not submitted within 5 days / 120h); % of INTERVIEW_COMPLETED applications hitting the 7-day Stuck chip before reaching CHAIR_REVIEW; median days SUBMITTED → APPROVED/REJECTED.\n\n" +
      "Common failure modes: (1) Risk 1 — a chair acts on a stale slideout because another admin changed the application's status (e.g. added a second interview) while it was open; the fix is always close-and-reopen, never push through the stale state. (2) Risk 3 — a second interviewer never submits, the application sits in INTERVIEW_COMPLETED past 7 days and shows the Stuck chip; an admin must use Force to Chair with a required override reason. (3) Risk 10 — onboarding sync fails after APPROVE and the decision is rolled back to CHAIR_REVIEW with a SYNC_ROLLBACK timeline event; don't re-click Approve blindly, check server logs for `[chairDecide] onboarding sync failed` first. (4) Risk 13 — no HIRING_CHAIR is assigned yet, so the Chair Queue looks empty to chair-role users (ADMINs still see it).\n\n" +
      "Hard-won notes: the auto-advance from INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED → CHAIR_REVIEW only counts ACTIVE (non-removed) interviewer assignments (Risk 2) — removing an interviewer who already submitted will not block advancement, so don't assign a backup interviewer 'just in case' unless you intend their review to count. PRE_APPROVED applications still go through the full interview pipeline and are intentionally excluded from the Chair Queue until interviews complete (Risk 12).",
    domain: "INSTRUCTORS",
    defaultOwnerSubtype: "HIRING_ADMIN",
    followUpCadenceHours: 120,
    escalateAfterHours: 168,
    stages: [
      {
        key: "intake",
        name: "Intake & Reviewer Assignment",
        description:
          "Maps to status SUBMITTED → UNDER_REVIEW. Purpose: confirm the application is real and route it to a reviewer without delay. Exit criteria: a reviewer is assigned via the Reviewer Assign Picker. Owner: ADMIN or CHAPTER_PRESIDENT for the applicant's chapter.",
        isInitial: true,
        slaHours: 24,
        steps: [
          {
            key: "triage",
            name: "Confirm the application landed in the New column",
            kind: "TASK",
            description:
              "Open the Command Center kanban and verify the new InstructorApplication card appears in the New column with the expected chapter and subject tags. The sendNewApplicationNotification email already fired to chapter leads and admins on submission — this step is a human sanity check, not the first notice. The common mistake is assuming the notification email guarantees someone will act; treat the kanban card as the source of truth and assign a reviewer the same day.",
            dueOffsetHours: 24,
          },
          {
            key: "assign-reviewer",
            name: "Assign a reviewer via the Reviewer Assign Picker",
            kind: "TASK",
            description:
              "Use the Reviewer Assign Picker from the Quick Drawer — it shows each candidate reviewer's active load badge, chapter match, and last-assigned date, so spread load deliberately rather than always picking the first name. Assigning a reviewer is what moves status from SUBMITTED to UNDER_REVIEW automatically; there is no separate 'start review' action. The assignment email is debounced to one per reviewer per 5-minute window (Risk 7) — don't re-trigger assignment repeatedly expecting a fresh email each time.",
            assigneeRole: "CHAPTER_PRESIDENT",
            dueOffsetHours: 24,
          },
        ],
      },
      {
        key: "review",
        name: "Reviewer Evaluation",
        description:
          "Maps to status UNDER_REVIEW / INFO_REQUESTED. Purpose: the assigned reviewer completes the 7-category rubric and recommends a next step. Exit criteria: reviewer submits MOVE_TO_INTERVIEW (the only path that advances this blueprint); REQUEST_INFO, HOLD, or REJECT divert the real application off this happy path. Owner: the assigned reviewer.",
        slaHours: 120,
        steps: [
          {
            key: "rubric",
            name: "Complete the 7-category rubric",
            kind: "APPROVAL",
            description:
              "Score all seven categories at /applications/instructor/[id]: curriculum strength, relationship building, organization & commitment, community fit, long-term potential, professionalism & follow-through (interview readiness), and subject matter fit. Complete this within 5 days (120h) of assignment — the pipeline shows an Overdue chip after that threshold. The most common mistake is rushing the long-term potential category; reviewers who skip it tend to over-index on interview polish later in the chair queue and miss candidates who are a slow-build but durable fit. Treat curriculum strength and subject matter fit as distinct categories even when they feel related — they catch different failure patterns (a strong subject expert with weak lesson design vs. a strong lesson designer who is shaky on content).",
            assigneeRole: "STAFF",
            dueOffsetHours: 120,
          },
          {
            key: "next-step",
            name: "Select the next-step recommendation",
            kind: "DECISION",
            description:
              "Choose one of MOVE_TO_INTERVIEW, REQUEST_INFO, HOLD, or REJECT. MOVE_TO_INTERVIEW is the only outcome that should be selected once the rubric genuinely supports moving forward — selecting it prematurely just to clear your queue pushes a weak candidate into the interviewer's lap, where it is much more expensive to catch. REQUEST_INFO parks the application as INFO_REQUESTED until the applicant responds, re-entering UNDER_REVIEW afterward; use it for genuine gaps, not as a stalling tactic. REJECT is terminal for this application.",
            assigneeRole: "STAFF",
            dueOffsetHours: 24,
          },
        ],
      },
      {
        key: "interview-setup",
        name: "Interview Assignment & Scheduling",
        description:
          "Maps to status INTERVIEW_SCHEDULED. Purpose: assign interviewer(s) and get materials in before the interview happens. Exit criteria: a LEAD interviewer is assigned, the applicant has confirmed a slot, and ideally the materials-ready gate has cleared. Owner: ADMIN or CHAPTER_PRESIDENT.",
        slaHours: 72,
        steps: [
          {
            key: "assign-interviewers",
            name: "Assign LEAD (required) and SECOND (optional) interviewers",
            kind: "TASK",
            description:
              "A LEAD interviewer is required; a SECOND is optional but recommended for borderline rubric scores. Both receive assignment emails, debounced per the same 5-minute-per-assignee window as reviewer assignment (Risk 7) — if you reassign quickly in a bulk operation, don't expect a fresh email each time. Note Risk 2 up front: if a SECOND interviewer is later removed, their already-submitted review still counts for audit, but the auto-advance count only looks at active (non-removed) assignments — so removing an interviewer who has not yet reviewed is the correct way to stop waiting on them.",
            assigneeRole: "CHAPTER_PRESIDENT",
            dueOffsetHours: 48,
          },
          {
            key: "schedule",
            name: "Confirm the applicant's interview slot",
            kind: "MEETING",
            description:
              "The applicant confirms a posted slot or submits preferred times; lock the calendar invite once confirmed. The common mistake is treating 'interviewers assigned' as equivalent to 'interview scheduled' — chase the applicant's confirmation explicitly rather than assuming silence means agreement.",
            dueOffsetHours: 72,
          },
          {
            key: "materials-gate",
            name: "Track the materials-ready gate (Course Outline + First Class Plan)",
            kind: "DOCUMENT",
            isRequired: false,
            description:
              "This is a soft gate, not a hard block: the application shows a Materials Missing chip until the applicant uploads both the Course Outline (COURSE_OUTLINE) and First Class Plan (FIRST_CLASS_PLAN) document types. Once both land, materialsReadyAt is stamped and the card moves from Interview Prep to Ready for Interview. Nudge applicants who are within 48 hours of their interview slot and still missing materials — interviewers can technically proceed without them, but rubric quality drops noticeably when they do.",
            dueOffsetHours: 96,
          },
        ],
      },
      {
        key: "post-interview",
        name: "Post-Interview Evaluation",
        description:
          "Maps to status INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED → CHAIR_REVIEW. Purpose: each assigned interviewer submits their 7-category interview rubric; the system auto-advances the application once all active interviewers have submitted. Exit criteria is automatic — do not hand-advance this stage. Owner: each assigned interviewer (LEAD + SECOND).",
        slaHours: 168,
        steps: [
          {
            key: "conduct",
            name: "Conduct the interview",
            kind: "MEETING",
            description:
              "Run the interview at the confirmed slot using the candidate's uploaded materials as a reference point when available. If materials never arrived, note that explicitly in the rubric rather than silently lowering the professionalism score — the gap belongs to the process step, not necessarily the candidate.",
            dueOffsetHours: 24,
          },
          {
            key: "submit-rubric",
            name: "Submit the 7-category interview rubric and recommendation",
            kind: "APPROVAL",
            description:
              "Open /applications/instructor/[id]/interview and submit the rubric plus one of ACCEPT, ACCEPT_WITH_SUPPORT, HOLD, or REJECT. The system auto-advances INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED → CHAIR_REVIEW the moment all active (non-removed) interviewers have submitted — this is the one auto-advance in this blueprint with real documented behavior (auto-advance count uses only active assignments, Risk 2), running inside a transaction with a row-level status re-read so two simultaneous submissions never double-advance or duplicate a STATUS_CHANGE timeline row (Risk 8). The common mistake is a SECOND interviewer sitting on their rubric: if the application is still in INTERVIEW_COMPLETED after 7 days it shows the Stuck chip (Risk 3), and an admin has to use Force to Chair from the Quick Drawer with a required override reason to push it forward manually.",
            assigneeRole: "STAFF",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "chair-review",
        name: "Chair Queue / Decision Readiness",
        description:
          "Maps to status CHAIR_REVIEW. Purpose: a HIRING_CHAIR (or ADMIN fallback) makes the hire/reject/hold call using the Chair Comparison Slideout. Exit criteria: chair records one of Approve / Reject / Hold / Request Info / 2nd Interview. Owner: HIRING_CHAIR, or ADMIN when no chair is assigned (Risk 13).",
        slaHours: 72,
        steps: [
          {
            key: "compare",
            name: "Review the Chair Comparison Slideout",
            kind: "APPROVAL",
            description:
              "Open the application from /admin/instructor-applicants/chair-queue (organized by chapter tab with a YPP-wide toggle) and review the slideout: applicant summary, the Decision Readiness Checklist (informational only — it does not hard-block), reviewer note, per-interviewer rubric dots + recommendation + summary, the materials viewer, and the rationale + internal comparison notes fields. Always write the rationale before deciding, even for an obvious approve — it is the only durable record of why, and it is what the next chair reads if this candidate ever reapplies.",
            assigneeRole: "STAFF",
            assigneeSubtype: "HIRING_CHAIR",
            dueOffsetHours: 48,
          },
          {
            key: "decide",
            name: "Record the chair decision",
            kind: "DECISION",
            description:
              "Choose Approve (→ APPROVED, triggers onboarding sync), Reject (→ REJECTED, terminal, archived at T+30d), Hold (→ ON_HOLD, resumable to review or interview), Request Info (→ INFO_REQUESTED), or 2nd Interview (→ INTERVIEW_SCHEDULED, prior reviews preserved with an audit note). The single most important operational guard here is Risk 1: if the application's status changed while the slideout was open (e.g. someone added a second interview), the chair sees an amber stale-state toast and the decision is blocked until they close and reopen — never try to force a decision through that toast.",
            assigneeRole: "STAFF",
            assigneeSubtype: "HIRING_CHAIR",
            dueOffsetHours: 24,
          },
        ],
      },
      {
        key: "approval-onboarding",
        name: "Approval & Onboarding Sync",
        description:
          "Maps to status APPROVED. Purpose: persist the chair's approval and atomically promote the applicant into an instructor account, then sync the native training/interview gate. Exit criteria: InstructorApproval exists with TRAINING_IN_PROGRESS and syncInstructorApplicationWorkflow() has completed without rollback. Terminal stage — archive lifecycle (30-day TTL, nightly cron) applies from here. Owner: ADMIN.",
        isTerminal: true,
        slaHours: 24,
        steps: [
          {
            key: "verify-sync",
            name: "Verify the onboarding sync completed",
            kind: "TASK",
            description:
              "On Approve, the platform atomically records the InstructorApplicationChairDecision, flips status to APPROVED, sets User.primaryRole to INSTRUCTOR, upserts the INSTRUCTOR UserRole, and creates an InstructorApproval (TRAINING_IN_PROGRESS) if one doesn't exist — then runs syncInstructorApplicationWorkflow() in a separate post-transaction call to wire up the native interview gate and training assignment. Risk 10 is the thing to watch: if that sync call throws, the whole decision is rolled back (status reverts to CHAIR_REVIEW, the decision is superseded, a SYNC_ROLLBACK timeline event is written) and the chair sees 'Onboarding sync failed — decision was reversed.' Don't just retry blindly — check server logs for `[chairDecide] onboarding sync failed`, confirm the CHAIR_REVIEW reversion and SYNC_ROLLBACK event, resolve the usual cause (a DB connectivity blip), then retry the decision.",
            assigneeRole: "ADMIN",
            dueOffsetHours: 24,
          },
          {
            key: "handoff",
            name: "Confirm the new instructor account and chapter assignment",
            kind: "TASK",
            description:
              "Confirm the new INSTRUCTOR user shows up in the right chapter roster before treating onboarding as handed off. This is also the moment to note that terminal applications (APPROVED, REJECTED, WITHDRAWN) get swept into the Archive tab automatically 30 days after they stop changing — no manual cleanup is needed unless you want it archived sooner via the application cockpit's manual archive action.",
            dueOffsetHours: 24,
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("intake", "New instructor application needs a reviewer"),
      typedActionOnEnter("review", "Complete the 7-category reviewer rubric", "APPLICATION_REVIEW", 120),
      notifyOnEnter("interview-setup", "Assign interviewer(s) and confirm a slot"),
      meetingOnEnter("interview-setup", "Instructor candidate interview", "GENERIC", 72),
      typedActionOnEnter("post-interview", "Submit interview rubric and recommendation", "APPLICATION_REVIEW", 72),
      notifyOnEnter("chair-review", "Application ready for chair decision"),
      typedActionOnEnter("chair-review", "Review and decide in the Chair Queue", "APPLICATION_REVIEW", 48),
      notifyOnEnter("approval-onboarding", "Instructor approved — verify onboarding sync"),
      typedActionOnEnter("approval-onboarding", "Confirm chapter assignment and roster placement", "INSTRUCTOR_ONBOARDING", 24),
      escalateOverdue(),
      autoAdvanceWhenReady(),
      startWorkflowOnComplete(
        "instructor-training-readiness",
        "Begin training & readiness gate for the newly-hired instructor"
      ),
    ],
  },

  // ==========================================================================
  // 2. volunteer-onboarding — deepened in place, kept lightweight by design.
  // ==========================================================================
  {
    key: "volunteer-onboarding",
    name: "Volunteer Onboarding",
    description:
      "Purpose: welcome a new (non-instructor) volunteer, get baseline paperwork and orientation done, and confirm their first real assignment — the lightweight cousin of instructor-hiring for people who support chapters without holding the full instructor role.\n\n" +
      "Typical duration: 7–10 days from welcome to first assignment for a responsive volunteer; the shadow-a-session step is optional and can stretch this if scheduling is slow.\n\n" +
      "Primary owner: the chapter STAFF contact who recruited the volunteer. Secondary owner: the chapter president for local placement decisions.\n\n" +
      "Success definition: the volunteer has completed orientation, returned their paperwork, and has a confirmed first assignment on the calendar — not just a 'welcome' email sent into the void.\n\n" +
      "KPIs: % of volunteers who complete paperwork within 72h of the welcome message; % who reach orientation within 96h; time from welcome to first confirmed assignment; volunteer drop-off rate between welcome and active.\n\n" +
      "Common failure modes: paperwork sent but never chased (the most common silent failure — nobody owns the follow-up once the welcome email goes out); orientation scheduled but the volunteer never gets a calendar invite, only a 'sign up here' link they don't act on; a volunteer reaches active status with no concrete first assignment, so they quietly disengage in the first two weeks because nobody gave them something specific to do.\n\n" +
      "Hard-won notes: volunteers are far more likely to follow through when the first assignment is named and dated during the welcome conversation, not left for the active stage to figure out. Treat 'shadow a session' as a real onboarding tool, not busywork — it is the single best predictor of a volunteer's first solo session going well.",
    domain: "VOLUNTEERS",
    defaultOwnerRole: "STAFF",
    followUpCadenceHours: 96,
    escalateAfterHours: 168,
    stages: [
      {
        key: "welcome",
        name: "Welcome",
        description:
          "Purpose: greet the volunteer, set expectations, and collect baseline paperwork. Exit criteria: welcome message sent and paperwork collected. Owner: the recruiting STAFF contact.",
        isInitial: true,
        slaHours: 72,
        steps: [
          {
            key: "intro",
            name: "Send welcome & expectations",
            kind: "TASK",
            description:
              "Send a personal welcome that names the chapter, the rough time commitment, and — ideally — a specific first task or session date, not a generic 'glad to have you' template. Volunteers who get a concrete next step in this first message are far more likely to show up for orientation; a vague welcome is the single biggest reason volunteers go quiet in week one.",
            dueOffsetHours: 24,
          },
          {
            key: "paperwork",
            name: "Collect paperwork",
            kind: "DOCUMENT",
            description:
              "Collect whatever baseline paperwork the chapter requires (background check consent, contact info, availability). Don't let this step sit unowned after the welcome email goes out — set a personal reminder to chase it at 48 hours if nothing has come back, since 'paperwork sent' is not the same as 'paperwork received.'",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "training",
        name: "Training",
        description:
          "Purpose: get the volunteer comfortable with what they'll actually be doing before they're on their own. Exit criteria: orientation complete; shadow session is encouraged but optional. Owner: the recruiting STAFF contact or a designated chapter mentor.",
        slaHours: 96,
        steps: [
          {
            key: "orientation",
            name: "Complete orientation",
            kind: "TASK",
            description:
              "Walk the volunteer through the chapter's norms, the tools they'll use, and who to ask when something is unclear. Keep this conversational rather than a document dump — volunteers retain almost none of a long written orientation packet if it isn't paired with a real conversation.",
            dueOffsetHours: 96,
          },
          {
            key: "shadow",
            name: "Shadow a session",
            kind: "TASK",
            isRequired: false,
            description:
              "Pair the volunteer with an experienced instructor or volunteer for one real session before they run anything solo. This is optional in the system but strongly recommended in practice — it is the cheapest insurance against a rough first solo assignment, and skipping it is the most common reason a new volunteer's first week goes poorly.",
            dueOffsetHours: 168,
          },
        ],
      },
      {
        key: "active",
        name: "Active",
        description:
          "Purpose: confirm the volunteer has a real, dated first assignment so onboarding converts into actual contribution. Exit criteria: first assignment confirmed. Terminal stage. Owner: the recruiting STAFF contact, handing off to whoever leads that assignment.",
        isTerminal: true,
        steps: [
          {
            key: "first-assignment",
            name: "Confirm first assignment",
            kind: "TASK",
            description:
              "Name the specific session, date, and point of contact for the volunteer's first real assignment — not a generic 'you're active now' status flip. A volunteer who reaches this stage without a concrete next date on the calendar is the most common silent drop-off pattern in this whole process; don't close this step until there's something on the calendar.",
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("welcome", "Welcome the new volunteer and collect paperwork", 24),
      notifyOnEnter("training", "Volunteer ready for orientation"),
      notifyOnEnter("active", "Confirm the volunteer's first assignment"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 3. mentorship — deepened in place; stage keys now map onto the real
  //    MentorshipCycleStage enum (KICKOFF_PENDING, REFLECTION_DUE,
  //    REFLECTION_SUBMITTED, REVIEW_SUBMITTED, CHANGES_REQUESTED, APPROVED,
  //    PAUSED, COMPLETE).
  // ==========================================================================
  {
    key: "mentorship",
    name: "Mentorship Cycle",
    description:
      "Purpose: run one mentor/mentee pairing through the real People Strategy mentorship cycle — kickoff, recurring reflection + review rounds, and closeout — mirroring the MentorshipCycleStage enum exactly so this blueprint's stages read the same as the data the mentee/mentor actually see in the product.\n\n" +
      "Typical duration: kickoff within a week of matching; thereafter the cycle repeats roughly monthly (REFLECTION_DUE → REFLECTION_SUBMITTED → REVIEW_SUBMITTED → APPROVED, or back through CHANGES_REQUESTED) for as long as the mentorship runs, closing only at COMPLETE.\n\n" +
      "Primary owner: the mentor (drives kickoff, gives the review, decides APPROVED vs CHANGES_REQUESTED). Secondary owner: the mentee (owns reflection submission) and the MENTORSHIP_ADMIN who matches pairs and watches for stalled cycles.\n\n" +
      "Success definition: every cycle reaches APPROVED (not silently abandoned at REFLECTION_DUE), check-ins happen on cadence, and the mentorship either renews into another cycle or closes cleanly at COMPLETE with a real wrap-up rather than just going quiet.\n\n" +
      "KPIs: % of cycles where REFLECTION_DUE is met without nudging; average days REFLECTION_SUBMITTED → REVIEW_SUBMITTED (mentor responsiveness); % of cycles needing CHANGES_REQUESTED more than once; PAUSED mentorships that never resume (the silent-attrition signal).\n\n" +
      "Common failure modes: a mentee misses REFLECTION_DUE and the cycle just stalls with nobody chasing it (the most common failure — reflection is the mentee's responsibility but the mentor is the one positioned to notice the silence); a mentor sits on a submitted reflection for weeks before reviewing it, which reads to the mentee as disengagement even when it isn't; PAUSED is used as an informal 'we forgot about this' state instead of an intentional pause with a resume date, so paired people quietly drift apart.\n\n" +
      "Hard-won notes: CHANGES_REQUESTED is a healthy, expected part of the loop, not a failure state — mentors who never use it are usually rubber-stamping reflections rather than actually engaging with them. Closing a mentorship at COMPLETE with a real wrap-up conversation (not just a status flip) measurably increases the odds the mentee re-engages in a future cycle or as a mentor themselves later.",
    domain: "MENTORSHIP",
    defaultOwnerSubtype: "MENTORSHIP_ADMIN",
    followUpCadenceHours: 336,
    escalateAfterHours: 504,
    stages: [
      {
        key: "kickoff-pending",
        name: "Kickoff Pending",
        description:
          "Maps to MentorshipCycleStage.KICKOFF_PENDING. Purpose: convert a fresh match into an active working relationship with shared goals. Exit criteria: kickoff meeting held and goals documented. Owner: MENTORSHIP_ADMIN to match, then the mentor to drive kickoff.",
        isInitial: true,
        slaHours: 168,
        steps: [
          {
            key: "pair",
            name: "Confirm mentor & mentee match",
            kind: "TASK",
            description:
              "Confirm the pairing makes sense on substance (subject area, schedule overlap, chapter) before treating the match as final — a rushed pairing that ignores schedule mismatch is the most common reason a mentorship never gets past kickoff. Log the match promptly so the cycle clock starts on an accurate date.",
            assigneeSubtype: "MENTORSHIP_ADMIN",
            dueOffsetHours: 72,
          },
          {
            key: "goals",
            name: "Set initial goals",
            kind: "FORM",
            description:
              "Capture 2-3 concrete goals for the mentee in their own words before the kickoff meeting, not generic categories invented by the admin. Vague goals ('get better at teaching') produce vague reflections every cycle after — push for something specific and checkable.",
            dueOffsetHours: 96,
          },
          {
            key: "kickoff-meeting",
            name: "Hold the kickoff meeting",
            kind: "MEETING",
            description:
              "Hold a real synchronous kickoff (call or in person), not an async goals doc exchange — the relationship's tone gets set here. The common mistake is treating kickoff as administrative paperwork instead of the first real conversation; mentors who skip a live kickoff see noticeably weaker first-cycle reflections.",
            dueOffsetHours: 120,
          },
        ],
      },
      {
        key: "reflection-due",
        name: "Reflection Due",
        description:
          "Maps to MentorshipCycleStage.REFLECTION_DUE. Purpose: the mentee reflects on progress against their goals for this cycle. Exit criteria: reflection submitted. Owner: the mentee.",
        slaHours: 168,
        steps: [
          {
            key: "submit-reflection",
            name: "Submit the cycle reflection",
            kind: "FORM",
            description:
              "The mentee writes a short reflection against their stated goals — what moved, what didn't, what they need from their mentor next. This is the step that most commonly stalls silently; if a mentee goes quiet here, the mentor (not just the admin) should reach out directly rather than waiting for an automated nudge to do the relationship work.",
            dueOffsetHours: 168,
          },
        ],
      },
      {
        key: "cycle-review",
        name: "Review Cycle",
        description:
          "Maps to MentorshipCycleStage.REFLECTION_SUBMITTED + REVIEW_SUBMITTED, grouped into one operational stage since the mentor's review immediately follows the mentee's submitted reflection. Purpose: the mentor reads the reflection and gives real feedback. Exit criteria: mentor review submitted. Owner: the mentor.",
        slaHours: 120,
        steps: [
          {
            key: "ack-reflection",
            name: "Acknowledge the submitted reflection",
            kind: "TASK",
            description:
              "Confirm receipt of the mentee's reflection quickly, even if the full written review takes a few more days — a fast acknowledgment keeps the mentee engaged while the mentor prepares real feedback. Letting a submitted reflection sit unacknowledged for a week is the most common way mentees read a mentor as disengaged.",
            dueOffsetHours: 24,
          },
          {
            key: "mentor-review",
            name: "Submit mentor review",
            kind: "APPROVAL",
            description:
              "Write specific, actionable feedback tied to the mentee's stated goals, then choose to approve the cycle or request changes. Generic praise with no specifics is the most common failure here — it feels supportive but gives the mentee nothing to act on for the next cycle.",
            dueOffsetHours: 120,
          },
        ],
      },
      {
        key: "changes-requested",
        name: "Changes Requested",
        description:
          "Maps to MentorshipCycleStage.CHANGES_REQUESTED. Purpose: give the mentee a clear, bounded path back to an approvable reflection when the mentor's review surfaces gaps. Exit criteria: mentee resubmits and mentor approves. Owner: the mentee, supported by the mentor.",
        slaHours: 96,
        steps: [
          {
            key: "address-changes",
            name: "Address requested changes and resubmit",
            kind: "FORM",
            description:
              "Resubmit the reflection addressing the mentor's specific notes, not a wholesale rewrite of unrelated material. Treat this as a normal, healthy loop rather than a setback — mentorships where CHANGES_REQUESTED never happens are usually getting rubber-stamped reviews, not genuinely strong cycles.",
            dueOffsetHours: 96,
          },
        ],
      },
      {
        key: "approved",
        name: "Cycle Approved",
        description:
          "Maps to MentorshipCycleStage.APPROVED. Purpose: close out a completed, approved cycle and decide whether the mentorship continues into another one. Exit criteria: cycle marked approved and next-cycle decision made (continue, pause, or complete). Owner: MENTORSHIP_ADMIN with the mentor.",
        slaHours: 24,
        steps: [
          {
            key: "log-approved",
            name: "Log the approved cycle",
            kind: "TASK",
            description:
              "Record the approved cycle and roll straight into the next REFLECTION_DUE window if the mentorship is continuing — don't let an approved cycle become a dead end with no next cycle scheduled. The cadence is what makes mentorship feel ongoing rather than a one-off check-in.",
            dueOffsetHours: 24,
          },
        ],
      },
      {
        key: "paused",
        name: "Paused",
        description:
          "Maps to MentorshipCycleStage.PAUSED. Purpose: an intentional, time-bounded pause (school break, leave, scheduling conflict) rather than silent drift. Exit criteria: a resume date is set or the mentorship is moved to COMPLETE. Owner: MENTORSHIP_ADMIN.",
        slaHours: 720,
        steps: [
          {
            key: "set-resume-plan",
            name: "Document the pause reason and resume plan",
            kind: "TASK",
            description:
              "Record why the mentorship paused and when it's expected to resume — an undocumented pause is functionally indistinguishable from a mentorship that quietly died, and is the single biggest source of mentorships that never come back. If there's no real resume date, this should probably be COMPLETE instead of PAUSED.",
            dueOffsetHours: 168,
          },
        ],
      },
      {
        key: "complete",
        name: "Complete",
        description:
          "Maps to MentorshipCycleStage.COMPLETE. Purpose: close the mentorship out with a real wrap-up. Exit criteria: wrap-up conversation held and outcome logged. Terminal stage. Owner: the mentor and MENTORSHIP_ADMIN.",
        isTerminal: true,
        steps: [
          {
            key: "wrap",
            name: "Hold final review & wrap-up",
            kind: "MEETING",
            description:
              "Close with a real conversation about what the mentee accomplished and what's next for them (another cycle with a new mentor, stepping up as a mentor themselves, or simply graduating the relationship) — not a silent status flip to COMPLETE. A genuine wrap-up measurably improves whether the mentee re-engages with mentorship again later.",
            dueOffsetHours: 72,
          },
        ],
      },
    ],
    transitions: [
      { fromStageKey: "kickoff-pending", toStageKey: "reflection-due" },
      { fromStageKey: "reflection-due", toStageKey: "cycle-review" },
      { fromStageKey: "cycle-review", toStageKey: "changes-requested", label: "Changes requested" },
      { fromStageKey: "cycle-review", toStageKey: "approved", label: "Approved" },
      { fromStageKey: "changes-requested", toStageKey: "cycle-review", label: "Resubmitted" },
      { fromStageKey: "approved", toStageKey: "reflection-due", label: "Next cycle" },
      { fromStageKey: "approved", toStageKey: "paused", label: "Pause" },
      { fromStageKey: "approved", toStageKey: "complete", label: "Close mentorship" },
      { fromStageKey: "paused", toStageKey: "reflection-due", label: "Resume" },
      { fromStageKey: "paused", toStageKey: "complete", label: "Close mentorship" },
    ],
    automations: [
      notifyOnEnter("kickoff-pending", "New mentorship match — schedule kickoff"),
      meetingOnEnter("kickoff-pending", "Mentorship kickoff", "GENERIC", 120),
      notifyOnEnter("reflection-due", "Reflection due for this mentorship cycle"),
      {
        name: "Schedule next reflection cycle",
        trigger: "ON_STAGE_ENTER",
        action: "SCHEDULE_FOLLOW_UP",
        stageKey: "reflection-due",
        config: { offsetHours: 168 },
      },
      notifyOnEnter("cycle-review", "Mentee reflection ready for mentor review"),
      notifyOnEnter("changes-requested", "Mentor requested changes to the reflection"),
      notifyOnEnter("paused", "Mentorship paused — confirm resume plan"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 4. instructor-training-readiness [NEW] — grounded in the training +
  //    interview native runbook.
  // ==========================================================================
  {
    key: "instructor-training-readiness",
    name: "Instructor Training & Readiness Gate",
    description:
      "Purpose: run a newly-hired (or manually-added) instructor through the native readiness flow — required academy modules, the interview gate, and the offering-approval blocker — before they're allowed to publish their first live class. This is the operational shadow of the ENABLE_NATIVE_INSTRUCTOR_GATE / ENFORCE_PRE_OFFERING_INTERVIEW feature flags described in the training + interview native runbook.\n\n" +
      "Typical duration: 1–3 weeks depending on module load and interview-slot availability; instructors who already interviewed during the application flow can clear the interview leg same-day via auto-sync.\n\n" +
      "Primary owner: the instructor themselves (completes modules, schedules interview). Secondary owner: the admin or chapter president running /admin/instructor-readiness or /chapter-lead/instructor-readiness, who reviews evidence and sets the final interview outcome.\n\n" +
      "Success definition: required training is complete, the interview gate is PASS or WAIVE, and the instructor successfully publishes their first ClassOffering without hitting the publish blocker.\n\n" +
      "KPIs: % of instructors completing required modules within 14 days of hire; % of interview gates resolved without a HOLD bounce; time from APPROVED (hiring) to first successful publish; % of instructors blocked at publish time who shouldn't have been (gate misconfiguration signal).\n\n" +
      "Common failure modes: a module is marked requiresQuiz but has no quiz questions attached, so the instructor cannot complete it and the readiness dashboard shows a confusing dead end — keep required modules actionable with at least one real path (video, required checkpoints, quiz, or evidence). An interview outcome is attempted before the slot is marked completed, which the system blocks by design — reviewers sometimes assume they can pre-record PASS/HOLD/FAIL ahead of the actual interview and hit this wall. Duplicate confirmed interview slots for the same gate are blocked by design; don't try to route around a scheduling conflict by booking a second slot. Chapter presidents sometimes try to act outside their own chapter and hit a scope wall — escalate cross-chapter or GLOBAL_ADMIN cases to an admin rather than working around the scope rule.\n\n" +
      "Hard-won notes: if the instructor was already interviewed during the application pipeline (instructor-hiring's post-interview stage), the gate auto-syncs to passed when interview evidence exists — don't manually re-run an interview that's already covered, check the readiness dashboard first. Existing live offerings from before rollout are grandfathered (grandfatheredTrainingExemption=true) precisely so this gate never retroactively blocks a class that was already running; never strip that flag without understanding why it was set.",
    domain: "INSTRUCTORS",
    defaultOwnerSubtype: "HIRING_ADMIN",
    followUpCadenceHours: 96,
    escalateAfterHours: 168,
    stages: [
      {
        key: "academy-modules",
        name: "Academy Modules",
        description:
          "Purpose: the instructor completes all required academy training modules. Exit criteria: every required module is complete (video watched past the 90% threshold where applicable, checkpoints/quiz/evidence submitted). Owner: the instructor.",
        isInitial: true,
        slaHours: 168,
        steps: [
          {
            key: "complete-modules",
            name: "Complete required academy modules",
            kind: "TASK",
            description:
              "Work through each required module at /training/[id], submitting quiz answers or evidence as required. Video-tracked modules only support YOUTUBE, VIMEO, and CUSTOM providers with a 90% watch threshold and autosave on interval and page-hide — if an instructor reports stuck progress, the fix is almost always checking that the module's videoProvider and videoDuration are set correctly, not a bug in the instructor's account.",
            dueOffsetHours: 168,
          },
          {
            key: "evidence-review",
            name: "Reviewer evidence check",
            kind: "APPROVAL",
            description:
              "The reviewer (admin or chapter president) opens the Training Evidence Queue at /admin/instructor-readiness, opens the submitted file, and chooses APPROVED, REVISION_REQUESTED, or REJECTED with notes. Don't approve evidence you haven't actually opened — the queue exists specifically because module completion alone isn't a reliable signal of quality.",
            assigneeRole: "ADMIN",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "interview-gate",
        name: "Interview Gate",
        description:
          "Purpose: schedule and resolve the native interview gate (separate from any interview already conducted during the hiring pipeline). Exit criteria: outcome recorded. Owner: the instructor (scheduling) and admin/chapter president (outcome).",
        slaHours: 168,
        steps: [
          {
            key: "schedule-interview",
            name: "Schedule the interview slot",
            kind: "MEETING",
            description:
              "The instructor confirms a posted slot or submits preferred times from /instructor-training. Check the readiness dashboard first — if interview evidence already exists from the application flow, the gate may already auto-sync to passed and this step is unnecessary; scheduling a redundant interview wastes everyone's time. The system blocks multiple confirmed slots for the same gate by design, so don't try to book a second slot to work around a conflict — reschedule the existing one instead.",
            dueOffsetHours: 96,
          },
          {
            key: "mark-completed",
            name: "Mark the interview slot completed",
            kind: "TASK",
            description:
              "After the interview happens, the reviewer marks the slot completed in the Interview Queue. This step has to happen before any outcome can be recorded — the system blocks PASS/HOLD/FAIL/WAIVE on an interview that isn't marked completed yet, which is a common point of confusion for reviewers who try to record the outcome immediately after the conversation ends without this intermediate click.",
            assigneeRole: "ADMIN",
            dueOffsetHours: 24,
          },
          {
            key: "record-outcome",
            name: "Record the final interview outcome",
            kind: "DECISION",
            description:
              "Set the outcome to PASS, HOLD, FAIL, or WAIVE. WAIVE is admin-only — chapter presidents can act on instructors in their own chapter for PASS/HOLD/FAIL but cannot waive. Scope rule: chapter presidents are restricted to their own chapter's instructors; escalate to an admin for any cross-chapter case, a GLOBAL_ADMIN role type, or a missing/incorrect chapter mapping rather than guessing at scope.",
            assigneeRole: "ADMIN",
            dueOffsetHours: 48,
          },
        ],
      },
      {
        key: "publish-unblock",
        name: "First-Offering Publish Unblock",
        description:
          "Purpose: confirm every readiness blocker is cleared so the instructor can publish their first ClassOffering. Exit criteria: training complete + interview passed/waived (or the offering is grandfathered). Terminal stage — this explicitly clears the instructor to publish their first ClassOffering.",
        isTerminal: true,
        slaHours: 24,
        steps: [
          {
            key: "readiness-check",
            name: "Confirm publish readiness on the Per-Instructor Readiness card",
            kind: "TASK",
            description:
              "Use the Per-Instructor Readiness card on /admin/instructor-readiness to confirm training, interview, and offering-approval blockers are all clear, then route the instructor to class settings to submit an offering approval request if they haven't already. Publish is blocked only when the native gate is enabled, this is the instructor's first live offering, and training or interview readiness is incomplete — an offering with grandfatheredTrainingExemption=true bypasses the block entirely, which is expected behavior for pre-rollout classes, not a bug.",
            assigneeRole: "ADMIN",
            dueOffsetHours: 24,
          },
          {
            key: "confirm-publish",
            name: "Confirm the instructor published their first offering",
            kind: "TASK",
            description:
              "Verify the instructor's first ClassOffering actually went to PUBLISHED status — readiness clearing is necessary but not sufficient; the instructor still has to take the publish action themselves. This is the natural close-out point for this blueprint; the instructor is now a fully active teaching instructor.",
            dueOffsetHours: 48,
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("academy-modules", "Complete required academy training modules", 168),
      notifyOnEnter("interview-gate", "Instructor ready to schedule the readiness interview"),
      meetingOnEnter("interview-gate", "Instructor readiness interview", "GENERIC", 96),
      typedActionOnEnter("interview-gate", "Record the interview gate outcome", "INSTRUCTOR_ONBOARDING", 48),
      notifyOnEnter("publish-unblock", "Confirm readiness and unblock first class publish"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 5. instructor-recruiting-campaign [NEW] — the sourcing-drive half of
  //    hiring, run standalone for a dedicated recruiting push.
  // ==========================================================================
  {
    key: "instructor-recruiting-campaign",
    name: "Instructor Recruiting Campaign",
    description:
      "Purpose: run a dedicated instructor sourcing drive — a target headcount across specific channels over a defined window — as its own tracked effort, separate from any single applicant's instructor-hiring pipeline. Use this when a chapter or region needs to actively go find candidates rather than just process whoever applies organically.\n\n" +
      "Typical duration: 3–6 weeks: roughly a week to define targets and channels, 2–4 weeks actively running outreach, and a final week to hand qualified leads into the real hiring pipeline.\n\n" +
      "Primary owner: the chapter president or staff member leading the campaign. Secondary owner: HIRING_ADMIN, who receives the handoff and ensures every sourced lead actually gets an instructor-hiring instance started rather than sitting in a spreadsheet.\n\n" +
      "Success definition: the campaign meets (or has an honest documented shortfall against) its target candidate count, and every qualified lead is hung off a real instructor-hiring workflow instance — a campaign that 'completes' without that handoff has produced nothing durable.\n\n" +
      "KPIs: leads sourced vs. target by channel; cost/time per qualified lead if channels have real cost; conversion rate from sourced lead to SUBMITTED application; time from campaign close to last lead's handoff.\n\n" +
      "Common failure modes: a target headcount is set with no channel-level breakdown, so nobody knows which channel underperformed when the total comes up short; leads are sourced and contacted but never actually pushed to submit a real application, so the campaign looks successful in outreach metrics while producing zero real candidates; the campaign 'ends' on a calendar date but qualified leads still in conversation get dropped because nobody owns the handoff step.\n\n" +
      "Hard-won notes: campaigns that name a specific channel-by-channel target (not just a single total) consistently outperform vague ones, because it's much easier to notice and react to one underperforming channel mid-campaign than to a single aggregate number that only looks bad in hindsight.",
    domain: "INSTRUCTORS",
    defaultOwnerSubtype: "HIRING_ADMIN",
    followUpCadenceHours: 168,
    escalateAfterHours: 240,
    stages: [
      {
        key: "define-target",
        name: "Define Target & Channels",
        description:
          "Purpose: set a concrete headcount target broken out by sourcing channel before any outreach begins. Exit criteria: target count and channel list documented and approved. Owner: chapter president or staff lead.",
        isInitial: true,
        slaHours: 72,
        steps: [
          {
            key: "set-target",
            name: "Set the target candidate count",
            kind: "FORM",
            description:
              "Set a specific number, not a vague 'as many as we can get' — and break it down per channel (referrals, social, partner orgs, campus outreach, alumni network) so progress is trackable mid-campaign. A single aggregate target with no channel breakdown is the most common reason campaigns can't diagnose underperformance until it's too late to fix.",
            dueOffsetHours: 48,
          },
          {
            key: "select-channels",
            name: "Select and staff sourcing channels",
            kind: "TASK",
            description:
              "Pick the channels that actually match where this chapter's best past instructors came from, not a generic list. Assign a named owner per channel — an unowned channel reliably underperforms even when it's nominally 'in scope' for the campaign.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "run-campaign",
        name: "Run the Campaign",
        description:
          "Purpose: actively source and engage candidates across the chosen channels. Exit criteria: campaign window closes with leads tracked against the target. Owner: each channel owner, rolled up by the campaign lead.",
        slaHours: 504,
        steps: [
          {
            key: "outreach",
            name: "Run outreach across channels",
            kind: "TASK",
            description:
              "Execute outreach per channel and log every real lead, not just ones that convert — undercounting outreach activity makes it impossible to tell a low-conversion channel from a low-effort one. Check in against the channel-level targets at least weekly so a stalled channel gets noticed while there's still time to react.",
            dueOffsetHours: 336,
          },
          {
            key: "track-progress",
            name: "Track candidate count against target",
            kind: "TASK",
            description:
              "Maintain a running count of qualified leads per channel against the target set in the first stage. The common mistake is only checking this at the very end of the campaign window — by then it's too late to redirect effort toward an underperforming channel.",
            isRequired: false,
            dueOffsetHours: 168,
          },
        ],
      },
      {
        key: "handoff",
        name: "Handoff to Hiring",
        description:
          "Purpose: make sure every qualified lead actually becomes a real application in the instructor-hiring pipeline, not just a name on a list. Exit criteria: every qualified lead has either submitted an application or been explicitly marked as not converting. Terminal stage. Owner: HIRING_ADMIN.",
        isTerminal: true,
        slaHours: 72,
        steps: [
          {
            key: "qualify-leads",
            name: "Qualify leads for handoff",
            kind: "APPROVAL",
            description:
              "Review the sourced leads and confirm which are genuinely ready to be pushed toward applying versus which need more nurturing. Don't hand off a lead who hasn't actually expressed real interest just to inflate the handoff count — it produces noisy, low-conversion entries in the real hiring pipeline.",
            assigneeSubtype: "HIRING_ADMIN",
            dueOffsetHours: 48,
          },
          {
            key: "confirm-handoff",
            name: "Confirm each qualified lead has a real application started",
            kind: "TASK",
            description:
              "Follow each qualified lead through to an actual SUBMITTED InstructorApplication, not just a 'we reached out' note. A campaign that closes with leads still 'in conversation' and no owner for the follow-through is the single most common way a recruiting push produces outreach metrics but no actual new instructors.",
            dueOffsetHours: 72,
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("define-target", "Define recruiting campaign target and channels", 48),
      typedActionOnEnter("run-campaign", "Run channel outreach for the recruiting campaign", "INSTRUCTOR_RECRUITING", 336),
      notifyOnEnter("handoff", "Qualify and hand off recruiting campaign leads"),
      typedActionOnEnter("handoff", "Confirm each lead has a started application", "INSTRUCTOR_RECRUITING", 72),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 6. instructor-performance-improvement [NEW] — grounded in
  //    InstructorLifecycleStage + a readiness/reliability score concept.
  // ==========================================================================
  {
    key: "instructor-performance-improvement",
    name: "Instructor Performance Improvement Plan",
    description:
      "Purpose: respond to a documented performance or reliability concern with an active instructor (InstructorLifecycleStage ACTIVE, BENCH, or PAUSED) through a structured, time-bounded improvement plan rather than an informal conversation that leaves no record. This is the formal escalation path between 'a mentor noticed something' and 'this instructor is moved to PAUSED/ALUMNI.'\n\n" +
      "Typical duration: 4–8 weeks: about a week to document the concern, a week to agree the plan, 2–6 weeks of monitoring depending on severity, and a final review week.\n\n" +
      "Primary owner: the instructor's mentor or chapter president, who is closest to the day-to-day signal. Secondary owner: HIRING_ADMIN or leadership for the resolved/escalated decision, since that decision can affect the instructor's lifecycle stage.\n\n" +
      "Success definition: either the instructor's readiness/reliability signal genuinely improves and they return to good standing with no plan hanging over them, or the concern is real and unresolved and the case is escalated deliberately (to BENCH/PAUSED or further) with a clear paper trail — never a plan that just quietly expires with no recorded outcome.\n\n" +
      "KPIs: % of plans reaching a recorded resolution (not silently abandoned); average days from concern documented to plan agreed; % of resolved-in-good-standing outcomes that later recur within 6 months (signal the first plan wasn't actually addressing the root cause); monitoring check-in completion rate.\n\n" +
      "Common failure modes: the initial concern is documented vaguely ('communication issues') instead of with specific, checkable incidents, which makes both the improvement plan and any later escalation hard to defend; the monitoring period has no real check-in cadence, so 'monitoring' becomes a synonym for 'wait and see what happens'; a plan reaches its end date with no one actually reviewing it, so it neither resolves nor escalates — it just evaporates, which is worse for the instructor than either outcome because the concern resurfaces later with no documented response in between.\n\n" +
      "Hard-won notes: plans that name 2-3 specific, observable success criteria up front (not 'improve performance') are dramatically easier to resolve cleanly — both the instructor and the reviewer know exactly what 'done' looks like. Always close the loop explicitly, even on a good outcome; an instructor who completed a plan successfully but never heard a formal 'you're back in good standing' often assumes the concern is still hanging over them.",
    domain: "INSTRUCTORS",
    defaultOwnerSubtype: "HIRING_ADMIN",
    followUpCadenceHours: 168,
    escalateAfterHours: 336,
    stages: [
      {
        key: "identify-concern",
        name: "Identify Concern & Document",
        description:
          "Purpose: capture the specific, observable performance or reliability concern before any plan is built. Exit criteria: concern documented with specifics, not generalities. Owner: the mentor or chapter president raising the concern.",
        isInitial: true,
        slaHours: 72,
        steps: [
          {
            key: "document-concern",
            name: "Document the specific concern",
            kind: "FORM",
            description:
              "Write down concrete, dated incidents (missed sessions, late lesson plans, specific feedback from students/parents) rather than a general impression. A vague concern statement is the single biggest reason performance improvement plans fail to resolve cleanly — both the instructor and reviewer need something checkable to refer back to later.",
            dueOffsetHours: 72,
          },
          {
            key: "notify-instructor",
            name: "Notify the instructor of the concern",
            kind: "TASK",
            description:
              "Tell the instructor directly and promptly — never let them learn about a documented concern secondhand or find out only when the plan is already built. This conversation should be honest but not punitive in tone; the goal at this stage is shared understanding, not a verdict.",
            dueOffsetHours: 48,
          },
        ],
      },
      {
        key: "plan-agreed",
        name: "Improvement Plan Agreed",
        description:
          "Purpose: build a plan with the instructor that names specific, observable success criteria and a monitoring window. Exit criteria: plan agreed and signed off by both the instructor and the reviewing owner. Owner: the mentor/chapter president with the instructor.",
        slaHours: 96,
        steps: [
          {
            key: "draft-plan",
            name: "Draft the improvement plan with success criteria",
            kind: "FORM",
            description:
              "Name 2-3 specific, observable success criteria and a concrete monitoring window (not 'improve performance' with no end date). Build the plan with the instructor, not just for them — a plan handed down without their input is far less likely to actually change behavior.",
            dueOffsetHours: 72,
          },
          {
            key: "agree-plan",
            name: "Confirm instructor agreement",
            kind: "APPROVAL",
            description:
              "Get explicit confirmation from the instructor that they understand and accept the plan and its criteria. Don't start the monitoring clock on a plan the instructor hasn't actually acknowledged — that gap is where good-faith disputes later come from.",
            dueOffsetHours: 24,
          },
        ],
      },
      {
        key: "monitoring",
        name: "Monitoring Period",
        description:
          "Purpose: actively track progress against the agreed criteria on a real cadence, not a single check at the end. Exit criteria: monitoring window completes with evidence gathered against each success criterion. Owner: the mentor or chapter president.",
        slaHours: 504,
        steps: [
          {
            key: "checkins",
            name: "Run periodic check-ins",
            kind: "TASK",
            description:
              "Check in on a real cadence (weekly or biweekly depending on plan length) rather than waiting silently until the end date. 'Monitoring' with no actual check-ins is the most common way these plans drift into a wait-and-see limbo that helps no one — log a brief note at each check-in even when there's nothing alarming to report.",
            dueOffsetHours: 168,
          },
          {
            key: "gather-evidence",
            name: "Gather evidence against each success criterion",
            kind: "DOCUMENT",
            description:
              "Collect concrete evidence (session logs, feedback, attendance) against each named criterion as the window progresses, not reconstructed from memory at the final review. Evidence gathered in real time is dramatically more credible — to the instructor and to any later escalation reviewer — than a retrospective summary.",
            dueOffsetHours: 480,
          },
        ],
      },
      {
        key: "resolution",
        name: "Resolved or Escalated",
        description:
          "Purpose: make and record the explicit final call — return to good standing or escalate. Exit criteria: a decision is recorded; this case never just expires with no outcome. Terminal stage. Owner: HIRING_ADMIN or leadership, with the mentor/chapter president's input.",
        isTerminal: true,
        slaHours: 48,
        steps: [
          {
            key: "final-review",
            name: "Review evidence against success criteria",
            kind: "APPROVAL",
            description:
              "Compare the gathered evidence honestly against the criteria set at plan-agreement time — not against how the conversation feels in the moment. The most damaging failure mode in this whole blueprint is a plan reaching its end date with no one actually reviewing it; treat this step as mandatory even when the informal read is 'things seem fine now.'",
            assigneeRole: "ADMIN",
            dueOffsetHours: 24,
          },
          {
            key: "record-outcome",
            name: "Record resolution: good standing or escalation",
            kind: "DECISION",
            description:
              "Record one of two explicit outcomes: returned to good standing (close the loop with the instructor directly and formally — silence here is read as the concern still being unresolved) or escalated (which may move the instructor's InstructorLifecycleStage toward BENCH or PAUSED, with the reasoning documented for whoever picks this up next, e.g. via returning-instructor-reactivation if they later come back).",
            assigneeRole: "ADMIN",
            dueOffsetHours: 24,
          },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("identify-concern", "Document the performance concern with specifics", "RELATIONSHIP", 72),
      notifyOnEnter("plan-agreed", "Draft and agree the improvement plan"),
      typedActionOnEnter("monitoring", "Run periodic check-ins against the improvement plan", "RELATIONSHIP", 168),
      notifyOnEnter("resolution", "Improvement plan monitoring period complete — record outcome"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 7. instructor-recognition [NEW] — lightweight nomination → review →
  //    recognition.
  // ==========================================================================
  {
    key: "instructor-recognition",
    name: "Instructor Recognition",
    description:
      "Purpose: give chapters and staff a lightweight, repeatable way to nominate and formally recognize an instructor who's doing great work, instead of recognition staying informal and inconsistent across chapters.\n\n" +
      "Typical duration: 1–2 weeks — a few days to nominate, a few days to review, a few days to deliver the recognition.\n\n" +
      "Primary owner: whoever nominates (mentor, chapter president, fellow instructor, staff). Secondary owner: HIRING_ADMIN or leadership, who reviews and approves the recognition.\n\n" +
      "Success definition: the instructor actually receives the recognition (not just an internal approval that never gets communicated to them), and it's specific enough that they understand exactly what they did well.\n\n" +
      "KPIs: nominations per chapter per quarter (a near-zero count signals the process isn't being used, not that there's nothing to recognize); time from nomination to delivered recognition; % of nominations that are specific and evidence-backed vs. generic.\n\n" +
      "Common failure modes: a nomination is vague ('great instructor') with no specific example, which makes the review step feel arbitrary and the eventual recognition land as generic; the recognition is approved internally but never actually communicated to the instructor, so the entire process produces an internal record but zero felt impact; recognition becomes lopsided toward the same few visible instructors because nobody actively solicits nominations from quieter chapters.\n\n" +
      "Hard-won notes: recognition that cites a specific moment or outcome lands far better than a generic congratulations — prompt nominators for one concrete example up front rather than accepting a one-line nomination.",
    domain: "INSTRUCTORS",
    defaultOwnerSubtype: "HIRING_ADMIN",
    followUpCadenceHours: 72,
    escalateAfterHours: 168,
    stages: [
      {
        key: "nomination",
        name: "Nomination",
        description:
          "Purpose: capture a specific, evidence-backed nomination. Exit criteria: nomination submitted with a concrete example. Owner: the nominator.",
        isInitial: true,
        slaHours: 72,
        steps: [
          {
            key: "submit-nomination",
            name: "Submit the nomination with a specific example",
            kind: "FORM",
            description:
              "Require at least one concrete example of what the instructor did, not just a general endorsement — 'great instructor' nominations are the most common reason recognition ends up feeling generic later. Name the chapter and rough timeframe of the example so the reviewer can sanity-check it quickly.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "review",
        name: "Review",
        description:
          "Purpose: confirm the nomination is genuine and decide the form of recognition. Exit criteria: reviewer approves and selects a recognition type. Owner: HIRING_ADMIN or leadership.",
        slaHours: 96,
        steps: [
          {
            key: "review-nomination",
            name: "Review and approve the nomination",
            kind: "APPROVAL",
            description:
              "Confirm the cited example is accurate and genuinely recognition-worthy, then decide the form (shoutout, certificate, spotlight feature, stipend, etc. per chapter norms). Watch for nominations clustering around the same few visible instructors — if quieter chapters never produce nominations, that's a sourcing gap to fix, not evidence those instructors aren't doing good work.",
            assigneeRole: "ADMIN",
            dueOffsetHours: 96,
          },
        ],
      },
      {
        key: "recognition",
        name: "Recognition Delivered",
        description:
          "Purpose: make sure the recognition actually reaches the instructor, not just an internal approval record. Exit criteria: recognition delivered and instructor notified. Terminal stage. Owner: the nominator or HIRING_ADMIN.",
        isTerminal: true,
        slaHours: 48,
        steps: [
          {
            key: "deliver",
            name: "Deliver the recognition to the instructor",
            kind: "TASK",
            description:
              "Actually communicate the recognition to the instructor directly, citing the specific example from the nomination — an approval that never gets delivered is the single most common way this process fails to have any real impact. A short personal note referencing the specific moment lands far better than a generic templated congratulations.",
            dueOffsetHours: 48,
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("nomination", "New instructor recognition nomination"),
      actionOnEnter("review", "Review the instructor recognition nomination", 96),
      notifyOnEnter("recognition", "Deliver the instructor's recognition"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 8. returning-instructor-reactivation [NEW] — an instructor coming back
  //    from BENCH/PAUSED/ALUMNI (InstructorLifecycleStage), abbreviated vs.
  //    full instructor-hiring.
  // ==========================================================================
  {
    key: "returning-instructor-reactivation",
    name: "Returning Instructor Reactivation",
    description:
      "Purpose: bring an instructor back from InstructorLifecycleStage BENCH, PAUSED, or ALUMNI into active teaching without re-running the full instructor-hiring pipeline — they've already been vetted once; this is a confirmation-and-currency-check process, not a re-application.\n\n" +
      "Typical duration: 1–2 weeks for a recent BENCH/PAUSED return with no training gaps; longer for an ALUMNI instructor returning after a long absence whose training currency has lapsed.\n\n" +
      "Primary owner: the chapter president or HIRING_ADMIN re-engaging the instructor. Secondary owner: whoever owns instructor-training-readiness content, if a training refresh is needed.\n\n" +
      "Success definition: the instructor is reassigned to a real class with confirmed availability and current training/credentials — not just flipped back to ACTIVE in the data model with nothing actually lined up.\n\n" +
      "KPIs: time from re-engagement to confirmed reassignment; % of returning instructors whose training was still current (no refresh needed) vs. needed a refresh; reactivation completion rate (how many re-engaged instructors actually make it back to ACTIVE vs. stall out).\n\n" +
      "Common failure modes: assuming a BENCH instructor's training is automatically still current without checking — academy content and policies change, and an instructor who's been off rotation for months may be teaching against an outdated rubric; re-engaging an instructor, confirming interest, and then never actually assigning them to a class, so the reactivation stalls indefinitely in a 'we talked to them' limbo; treating an ALUMNI return identically to a BENCH return when the lapsed time is actually long enough to warrant a real training refresh, not just a currency check.\n\n" +
      "Hard-won notes: always re-verify training currency explicitly rather than assuming it, even for a short BENCH stint — it's a cheap check relative to the cost of an instructor teaching against stale material. A returning instructor with a concrete class and date in hand reactivates far more reliably than one who's just told 'welcome back, we'll find you something.'",
    domain: "INSTRUCTORS",
    defaultOwnerSubtype: "HIRING_ADMIN",
    followUpCadenceHours: 96,
    escalateAfterHours: 192,
    stages: [
      {
        key: "re-engage",
        name: "Re-engage & Confirm Availability",
        description:
          "Purpose: confirm the instructor (currently BENCH, PAUSED, or ALUMNI) is actually interested in and available for returning to active teaching. Exit criteria: instructor confirms interest and availability window. Owner: the chapter president or HIRING_ADMIN.",
        isInitial: true,
        slaHours: 72,
        steps: [
          {
            key: "outreach",
            name: "Reach out to the instructor",
            kind: "TASK",
            description:
              "Reach out personally rather than an automated 'are you still interested' email — a returning instructor (especially ALUMNI after a long gap) responds far better to a real conversation than a form. Use this conversation to gauge how long they've actually been away, since that materially changes how much currency-checking the next stage needs.",
            dueOffsetHours: 48,
          },
          {
            key: "confirm-availability",
            name: "Confirm availability window",
            kind: "TASK",
            description:
              "Get a concrete availability window (days, subjects, chapter) before moving on — vague 'sometime this semester' availability is the most common reason a reactivation stalls at the reassignment stage later. Note their InstructorLifecycleStage explicitly (BENCH/PAUSED/ALUMNI) since it affects how much re-verification the next stage needs.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "reverify-training",
        name: "Re-verify Training & Credentials",
        description:
          "Purpose: confirm training currency without re-running the full instructor-hiring pipeline — this is the key difference from a fresh hire. Exit criteria: training currency confirmed, or a refresh is completed if it has lapsed. Owner: HIRING_ADMIN, with the instructor-training-readiness content owner if a refresh is needed.",
        slaHours: 96,
        steps: [
          {
            key: "currency-check",
            name: "Check training/credential currency",
            kind: "APPROVAL",
            description:
              "Explicitly check whether the instructor's academy modules and any time-bound credentials are still current — never assume a short BENCH stint means everything is fine, since academy content changes independent of how long the instructor's been away. This is the step that most often gets skipped because the instructor is a known quantity; skipping it is exactly how an instructor ends up teaching against outdated material.",
            assigneeRole: "ADMIN",
            dueOffsetHours: 48,
          },
          {
            key: "refresh-if-needed",
            name: "Complete a training refresh if currency has lapsed",
            kind: "TASK",
            isRequired: false,
            description:
              "If the currency check finds lapsed modules (most common for ALUMNI returns after a long absence), route the instructor through the specific lapsed modules rather than the full instructor-training-readiness gate from scratch — this stays abbreviated by design. Don't skip this step under time pressure just because the instructor was previously fully trained; that's precisely the gap this stage exists to catch.",
            dueOffsetHours: 96,
          },
        ],
      },
      {
        key: "reassigned",
        name: "Reassigned & Active",
        description:
          "Purpose: get the instructor onto a real class, not just back to an ACTIVE lifecycle flag. Exit criteria: class assignment confirmed with a date. Terminal stage. Owner: the chapter president or HIRING_ADMIN.",
        isTerminal: true,
        slaHours: 72,
        steps: [
          {
            key: "assign-class",
            name: "Confirm class reassignment",
            kind: "TASK",
            description:
              "Name the specific class and start date the instructor is returning to, then confirm their InstructorLifecycleStage updates to ACTIVE alongside it — not before. The most common failure mode for this whole blueprint is stopping after a good re-engagement conversation with nothing concrete actually scheduled; don't close this case until there's a real class and date attached to it.",
            dueOffsetHours: 72,
          },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("re-engage", "Reach out to the returning instructor", "RELATIONSHIP", 48),
      notifyOnEnter("reverify-training", "Re-verify training currency before reassignment"),
      typedActionOnEnter("reverify-training", "Check training/credential currency", "INSTRUCTOR_ONBOARDING", 48),
      notifyOnEnter("reassigned", "Confirm the returning instructor's class reassignment"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },
];
