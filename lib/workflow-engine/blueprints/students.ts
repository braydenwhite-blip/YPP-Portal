// ============================================================================
// Universal Workflow Engine — blueprint catalog: Students
// ============================================================================
//
// Student-facing operational playbooks. There is no dedicated `Student` table
// in the schema — a "student" is a User with primaryRole STUDENT, plus the
// supporting models referenced throughout this file: StudentIntakeCase (the
// parent-submitted intake pipeline), ClassEnrollment (a User's enrollment in a
// ClassOffering), and AttendanceRecord (per-session attendance, keyed off
// AttendanceStatus). Every blueprint below is grounded in those real fields
// and enums so the generated ActionItems, notifications, and meetings line up
// with what staff/mentors/instructors actually see elsewhere in the portal.

import {
  actionOnEnter,
  autoAdvanceWhenReady,
  escalateOverdue,
  meetingOnEnter,
  notifyOnEnter,
  typedActionOnEnter,
} from "./helpers";
import type { WorkflowBlueprint } from "./types";

export const STUDENT_BLUEPRINTS: WorkflowBlueprint[] = [
  // --------------------------------------------------------------------
  // 1. Student Advising (deepened in place — key + 3-stage shape preserved)
  // --------------------------------------------------------------------
  {
    key: "student-advising",
    name: "Student Advising",
    description:
      "Intake, plan, and follow up on a single student's advising case — the recurring cycle a mentor runs to keep one student's goals, support needs, and progress visible and current. Purpose: turn a one-time intake conversation into a living plan that survives staff turnover and mentor handoffs, instead of living only in one mentor's head or inbox.\n\n" +
      "Typical duration: 7-10 days from intake to a reviewed plan, then an open-ended recurring cycle of check-ins (weekly to monthly cadence depending on the student's support needs) until the case is closed or the student moves on. Primary owner: the assigned mentor. Secondary owners: the chapter's staff lead (escalation point for support needs the mentor can't meet alone) and, where the student has an active StudentIntakeCase, whoever is listed as reviewOwnerId on that case.\n\n" +
      "Success definition: the student has a written plan that names specific goals and a specific support need, the plan was reviewed with the student (not just written about them), and at least one check-in has actually happened on the agreed cadence. KPIs: time from intake to a reviewed plan (target under 10 days), percentage of advising cases with a documented support need (a blank supportNeeds field is a leading indicator of a plan that will drift), check-in adherence rate against the agreed cadence, and percentage of cases with a real next check-in scheduled at any given time (an advising case with no future check-in is, in practice, closed whether or not anyone marked it that way).\n\n" +
      "Common failure modes: advising plans built without a documented support need tend to drift into generic encouragement rather than addressing what's actually getting in the student's way; intake notes that capture interests but skip goals produce plans the student can't actually evaluate progress against; check-ins that get scheduled once and never recur quietly die after the first meeting; and plans written without the student in the room read as mentor wish-lists rather than something the student will act on.\n\n" +
      "Hard-won notes: the single best predictor of whether an advising case stays alive past 60 days is whether the first check-in is scheduled before the kickoff meeting ends — if it's left as a follow-up task for later, it often never gets booked. Treat the plan as a draft to revise with the student, not a deliverable to hand them.",
    domain: "STUDENTS",
    defaultOwnerRole: "MENTOR",
    followUpCadenceHours: 168,
    escalateAfterHours: 240,
    stages: [
      {
        key: "intake",
        name: "Intake",
        description:
          "Capture the student's goals, interests, and support needs directly from the student (and parent, if the case originated from a StudentIntakeCase) before writing anything. Exit when interests, goals, and a support need are all documented — not just a name and a grade level. Owner: assigned mentor.",
        slaHours: 72,
        isInitial: true,
        steps: [
          {
            key: "gather",
            name: "Gather student goals & context",
            kind: "TASK",
            description:
              "Run an intake conversation that covers the same ground a StudentIntakeCase captures: interests (what the student is curious about or already doing), goals (what they want to be true in 3-6 months, stated specifically enough to check later), and supportNeeds (the concrete thing getting in the way — time, confidence, a specific skill gap, family circumstances). The most common mistake is recording only interests and skipping goals and support needs, which produces a plan with nothing to advise against. Tip: ask 'what would make this advising relationship a waste of your time?' — it surfaces the real support need faster than asking for it directly.",
            dueOffsetHours: 72,
          },
          {
            key: "review-prior-context",
            name: "Review prior intake case & enrollment history",
            kind: "TASK",
            isRequired: false,
            description:
              "If this student has a StudentIntakeCase on file, read studentSchool, interests, goals, and supportNeeds before the intake conversation so you're not asking the student to repeat themselves, and check active ClassEnrollment rows for context on what they're already taking. The common mistake is treating advising as disconnected from enrollment — a student struggling in a class is an advising case whether or not anyone files it as one. Tip: a quick scan of instructorNotes on any current enrollment often surfaces the support need before you even ask.",
            dueOffsetHours: 48,
          },
        ],
      },
      {
        key: "plan",
        name: "Plan",
        description:
          "Turn the intake notes into a short written plan with specific goals and a named support need, then review it with the student before treating it as final. Exit when the plan has been reviewed in a real conversation with the student, not just drafted. Owner: assigned mentor.",
        slaHours: 96,
        steps: [
          {
            key: "build-plan",
            name: "Build advising plan",
            kind: "DOCUMENT",
            description:
              "Write a short plan with three parts: the goals from intake restated in checkable terms, the support need and what the mentor will actually do about it, and a proposed check-in cadence. The common mistake is writing a plan that lists goals but never states what the mentor is going to do differently because of the support need. Tip: keep it to one page — a plan too long to re-read at the start of each check-in won't get re-read.",
            dueOffsetHours: 96,
          },
          {
            key: "review",
            name: "Review plan with student",
            kind: "MEETING",
            description:
              "Walk through the draft plan with the student and revise it live based on their reaction — a plan presented as finished rather than draft tends to get a polite nod and no real buy-in. The common mistake is treating this as a formality after the plan is 'done'; instead treat the draft as a starting point for the conversation. Tip: ask the student to restate the goals in their own words before the meeting ends — if they can't, the plan isn't specific enough yet.",
            dueOffsetHours: 120,
          },
        ],
      },
      {
        key: "follow-up",
        name: "Follow-up",
        description:
          "Establish a recurring check-in rhythm and keep the case open until it's genuinely resolved, paused, or the student has moved on. Exit (terminal) when the case is explicitly closed or handed off — not when it simply goes quiet. Owner: assigned mentor, with the chapter staff lead as the escalation backstop.",
        isTerminal: true,
        steps: [
          {
            key: "checkin",
            name: "Schedule first check-in",
            kind: "MEETING",
            isRequired: false,
            description:
              "Book the first check-in before this stage goes cold — cases where the first check-in isn't scheduled within a few days of the plan review tend to stall indefinitely. A good check-in is short (15-20 minutes), starts by reviewing progress against the specific goals from the plan, and ends by confirming the next check-in date on the spot. The common mistake is leaving 'schedule next time' as an open action item instead of booking it before the meeting ends.",
          },
          {
            key: "log-checkin-notes",
            name: "Log check-in notes & adjust plan",
            kind: "TASK",
            isRequired: false,
            description:
              "After each check-in, write down what changed — progress on goals, any new support need, anything that should update the plan — so the case has a real history instead of relying on the mentor's memory. The common mistake is only logging check-ins when something goes wrong, which makes the case look fine right up until it isn't. Tip: a one-line note per check-in is enough as long as it's honest about what didn't happen, not just what did.",
          },
          {
            key: "close",
            name: "Close or recur the case",
            kind: "DECISION",
            description:
              "Make an explicit call: close the case (goals met, support need resolved, or student no longer active), keep it recurring (still working the plan), or hand it off (mentor capacity change, better-fit mentor available). The common mistake is letting a case go silent without a decision, which leaves it looking 'active' in reporting while nothing is actually happening. Tip: if you're not sure whether to close or recur, recur with a shorter check-in interval rather than closing — closing prematurely loses the plan history.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("intake", "New student advising case opened"),
      typedActionOnEnter("plan", "Build the advising plan", "RELATIONSHIP", 96),
      meetingOnEnter("plan", "Review advising plan with student", "GENERIC", 120),
      {
        name: "Schedule follow-up check-in",
        trigger: "ON_STAGE_ENTER",
        action: "SCHEDULE_FOLLOW_UP",
        stageKey: "follow-up",
        config: { offsetHours: 168 },
      },
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------
  // 2. Student Registration & Intake
  // --------------------------------------------------------------------
  {
    key: "student-registration",
    name: "Student Registration & Intake",
    description:
      "Move a parent-submitted StudentIntakeCase from a draft through review to an approved, mentor-ready student record. Purpose: make sure every new student enters the program through a consistent, reviewed pipeline rather than being added ad hoc, so chapter staff have a documented baseline (interests, goals, support needs) before any mentor or instructor engagement begins.\n\n" +
      "Typical duration: 5-7 days from submission to a decision, assuming the reviewer isn't waiting on missing information from the parent. Primary owner: chapter staff (the reviewOwnerId on the StudentIntakeCase). Secondary owners: the chapter president (visibility into chapter capacity before approving) and, once approved, the mentor who picks up the resulting case.\n\n" +
      "Success definition: every submitted case receives a documented decision (approved or rejected) within the review SLA, and an approved case has a clear, named next owner before this workflow closes. KPIs: median time from SUBMITTED to a decision, percentage of cases rejected for missing information that could have been caught at submission (a proxy for a confusing intake form), percentage of approved cases that actually reach MENTOR_PLAN_LAUNCHED within 14 days, and backlog size in UNDER_REVIEW at any point in time.\n\n" +
      "Common failure modes: cases sit in UNDER_REVIEW with no owner because reviewOwnerId was never set, which makes the backlog invisible until a parent asks for an update; reviewers approve a case without checking chapter capacity, producing an approved student with no mentor available; and rejected cases are closed with no reviewerNote, leaving the parent (and the next staff member who looks at the case) with no idea what to fix and resubmit.\n\n" +
      "Hard-won notes: treat REJECTED as a recoverable state, not a dead end — most rejections are incomplete information, not unsuitability, so a clear reviewerNote turns a rejection into a faster resubmission rather than a lost family. The real pipeline has two states this linear workflow can't fork into as separate stages — REJECTED and the post-approval MENTOR_PLAN_LAUNCHED state — both are called out explicitly in this workflow's terminal stage guidance below rather than modeled as parallel branches.",
    domain: "STUDENTS",
    defaultOwnerRole: "STAFF",
    followUpCadenceHours: 48,
    escalateAfterHours: 120,
    stages: [
      {
        key: "draft",
        name: "Draft",
        description:
          "The intake case exists but the parent hasn't submitted it yet (StudentIntakeCaseStatus.DRAFT). Exit when the parent submits — this stage is mostly a placeholder for cases started but abandoned mid-form. Owner: the parent (no portal owner action needed unless following up on an abandoned draft).",
        slaHours: 168,
        isInitial: true,
        steps: [
          {
            key: "nudge-incomplete",
            name: "Follow up on an abandoned draft",
            kind: "TASK",
            isRequired: false,
            description:
              "If a draft sits unsubmitted for more than a week, send a light-touch nudge — a draft that never gets submitted usually means the parent hit a confusing field, not that they lost interest. The common mistake is assuming silence means disinterest and never following up. Tip: ask specifically whether the supportNeeds or goals fields were unclear; those are the two fields parents most often abandon the form on.",
            dueOffsetHours: 168,
          },
        ],
      },
      {
        key: "submitted",
        name: "Submitted",
        description:
          "The parent has submitted the case (StudentIntakeCaseStatus.SUBMITTED) with studentName, studentEmail, interests, goals, and supportNeeds populated. Exit when a reviewOwnerId is assigned and the case moves to under review. Owner: chapter staff intake coordinator.",
        slaHours: 24,
        steps: [
          {
            key: "assign-reviewer",
            name: "Assign a review owner",
            kind: "TASK",
            description:
              "Set reviewOwnerId to a specific staff member within 24 hours of submission — an unassigned submitted case is the single most common reason intake stalls. The common mistake is leaving cases in a shared queue with no individual owner, which means everyone assumes someone else has it. Tip: assign by chapter, not by availability, so the reviewer already has context on local capacity and partner classes.",
            dueOffsetHours: 24,
          },
        ],
      },
      {
        key: "under-review",
        name: "Under Review",
        description:
          "The assigned reviewer is evaluating the case (StudentIntakeCaseStatus.UNDER_REVIEW) — checking that studentGrade, studentSchool, interests, goals, and supportNeeds are complete and that the chapter has capacity to support the student. Exit when the reviewer records a decision. Owner: reviewOwnerId.",
        slaHours: 72,
        steps: [
          {
            key: "verify-completeness",
            name: "Verify intake completeness",
            kind: "TASK",
            description:
              "Check that every field needed to actually advise this student is filled in — especially supportNeeds, which is the field most often left blank. An incomplete case shouldn't be approved on the assumption details will surface later; that's how students end up with no documented support need and a plan that drifts. Tip: if supportNeeds is blank, follow up with the parent directly rather than guessing or leaving it empty.",
            dueOffsetHours: 48,
          },
          {
            key: "decision",
            name: "Record review decision",
            kind: "APPROVAL",
            description:
              "Record an explicit approve/reject decision with a reviewerNote either way — set reviewedById and approvedAt on approval. The common mistake is approving without checking whether the chapter actually has mentor capacity right now, which produces an approved student who then waits weeks for a mentor plan. Tip: if capacity is the blocker rather than the application itself, use blockerNote to say so explicitly rather than rejecting the case outright.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "approved",
        name: "Approved",
        description:
          "The case has been approved (StudentIntakeCaseStatus.APPROVED). This is this workflow's terminal stage. In the real data model, an approved case branches further to MENTOR_PLAN_LAUNCHED once a mentor plan is created, and a case can instead branch to REJECTED back in the review stage with a reviewerNote explaining why — both of those branches live outside this linear workflow and are called out here rather than modeled as parallel stages. Exit: this workflow instance completes; mentor follow-on work continues as a separate student-advising case. Owner: chapter staff, handing off to the assigned mentor.",
        isTerminal: true,
        steps: [
          {
            key: "notify-parent",
            name: "Notify parent of approval",
            kind: "TASK",
            description:
              "Send the parent a clear approval notice that explains what happens next (mentor assignment timing, first contact expectations) — an approval that goes unnotified leaves the parent checking a portal that doesn't tell them anything changed. The common mistake is treating the status change itself as sufficient communication. Tip: give a specific timeframe for mentor assignment rather than 'soon' — vague timelines generate more follow-up emails than they prevent.",
            dueOffsetHours: 24,
          },
          {
            key: "handoff-to-mentor-plan",
            name: "Hand off for mentor plan launch",
            kind: "TASK",
            description:
              "Identify and notify the mentor (or mentor-matching owner) who will launch the mentor plan, which moves the real StudentIntakeCase to MENTOR_PLAN_LAUNCHED (mentorPlanCreatedAt set) and is tracked from there as a separate student-advising case — this workflow does not model that stage directly. The common mistake is treating 'approved' as done and letting the handoff drop, which is exactly how an approved student ends up with no mentor for weeks. Tip: start the student-advising workflow for this student as part of this step rather than as a separate, easy-to-forget follow-up.",
            dueOffsetHours: 48,
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("submitted", "New student intake case submitted"),
      typedActionOnEnter("under-review", "Review student intake case", "APPLICATION_REVIEW", 72),
      notifyOnEnter("approved", "Student intake case approved"),
      typedActionOnEnter("approved", "Launch mentor plan for approved student", "RELATIONSHIP", 48),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------
  // 3. Student Class Enrollment
  // --------------------------------------------------------------------
  {
    key: "student-enrollment",
    name: "Student Class Enrollment",
    description:
      "Track a student from initial class signup through confirmed first attendance to being a settled, active member of a class roster. Purpose: catch the two points where enrollments silently fail — signup without confirmed attendance, and early attendance without instructor follow-through — before they show up as a quiet drop weeks later.\n\n" +
      "Typical duration: 1-2 weeks from enrollment to confirmed active status, bounded by the class's first one or two sessions. Primary owner: the class's lead instructor. Secondary owners: chapter staff (waitlist management and capacity decisions) and the student's mentor, if assigned, for support-need context.\n\n" +
      "Success definition: the student attends their first session (AttendanceStatus PRESENT or LATE, not a no-show) and the instructor has logged a usable note about fit. KPIs: enrolled-to-first-attendance conversion rate, average waitlistPosition movement time, percentage of enrollments with instructorNotes populated after the first session, and early-drop rate (DROPPED within the first two sessions).\n\n" +
      "Common failure modes: a student enrolls and is never followed up with before the first session, so a no-show goes unnoticed until the instructor mentions it weeks later; signupGoal and signupNote are captured at signup but never read by the instructor, wasting the one piece of context that explains why the student signed up; and waitlisted students are left without any communication about their position, so they assume they were rejected and don't follow up.\n\n" +
      "Hard-won notes: the single highest-leverage moment in this workflow is a short pre-first-session check that the student actually plans to show up — it catches schedule conflicts early enough to either resolve them or free the seat for a waitlisted student. Treat WAITLISTED as an active status that needs its own communication, not a holding pen that quietly resolves itself.",
    domain: "STUDENTS",
    defaultOwnerRole: "INSTRUCTOR",
    followUpCadenceHours: 72,
    stages: [
      {
        key: "enrolled",
        name: "Enrolled",
        description:
          "The student has signed up (ClassEnrollmentStatus.ENROLLED, or WAITLISTED if the class is full) with signupGoal and signupNote captured. Exit when the first session has happened and attendance is recorded. Owner: lead instructor, with chapter staff handling waitlist movement.",
        slaHours: 72,
        isInitial: true,
        steps: [
          {
            key: "review-signup-context",
            name: "Review signup goal & note",
            kind: "TASK",
            description:
              "Read signupGoal and signupNote before the first session — they're the student's own words for why they signed up, and the most common mistake is an instructor never opening them, which means the first session treats every student identically regardless of what they came for. Tip: if a signup goal mentions a specific outcome (e.g., 'want to build a real app'), reference it directly in the first session — students notice when the goal they wrote down was actually read.",
            dueOffsetHours: 48,
          },
          {
            key: "manage-waitlist",
            name: "Manage waitlist position",
            kind: "TASK",
            isRequired: false,
            description:
              "If the student is WAITLISTED, communicate their waitlistPosition and what would move them up (a drop, a capacity increase) rather than leaving them with no information. The common mistake is silence — a waitlisted student who hears nothing assumes rejection and stops checking. Tip: a short proactive note ('you're #2, we'll reach out the moment a seat opens') prevents most waitlist-related complaints.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "confirmed",
        name: "Confirmed",
        description:
          "The student's first session has occurred and attendance has been recorded against a real AttendanceStatus (PRESENT, LATE, EXCUSED, or ABSENT). Exit when the instructor has logged a usable first-session note and any no-show has been followed up on. Owner: lead instructor.",
        slaHours: 48,
        steps: [
          {
            key: "record-first-attendance",
            name: "Confirm first-session attendance",
            kind: "TASK",
            description:
              "Record the AttendanceStatus for the student's first session promptly — same-day if possible. The common mistake is batching attendance entry for an entire roster days later, by which point an ABSENT first session (often the strongest early warning sign of a drop) has already gone stale and unaddressed. Tip: if the status is ABSENT or LATE on the first session specifically, treat it as worth a direct check-in, not just a data point.",
            dueOffsetHours: 24,
          },
          {
            key: "log-fit-note",
            name: "Log instructor fit note",
            kind: "TASK",
            description:
              "Write a short instructorNotes entry on how the first session went for this student relative to their signupGoal — engaged, struggling, mismatched level, or a good fit. The common mistake is leaving instructorNotes blank until something goes wrong, which means there's no baseline to compare against later. Tip: one honest sentence is enough — 'session was too advanced for stated goal, flag for support' is more useful than a paragraph of pleasantries.",
            dueOffsetHours: 48,
          },
        ],
      },
      {
        key: "active",
        name: "Active in Class",
        description:
          "The student is a settled member of the class roster, attending and progressing. This is the terminal stage for this workflow; ongoing attendance issues are handled by the separate student-attendance-intervention workflow, and end-of-program outcomes by student-completion-alumni. Exit: this workflow instance completes once the student is confirmed settled. Owner: lead instructor.",
        isTerminal: true,
        steps: [
          {
            key: "track-progress",
            name: "Begin tracking sessionsAttended & outcomes",
            kind: "TASK",
            description:
              "Make sure sessionsAttended and outcomesAchieved are being updated as the class progresses rather than left at zero until a final report is due. The common mistake is treating progress tracking as an end-of-term task, which means mid-course problems (a student stalling on outcomes, falling attendance) aren't visible until it's too late to intervene. Tip: a quick update after each session takes under a minute and is the only thing that makes the attendance-intervention workflow's pattern detection actually work.",
            dueOffsetHours: 168,
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("enrolled", "New student enrollment"),
      actionOnEnter("confirmed", "Confirm first-session attendance", 48),
      typedActionOnEnter("active", "Begin progress tracking for enrolled student", "OPERATIONS", 168),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------
  // 4. Student Attendance Intervention
  // --------------------------------------------------------------------
  {
    key: "student-attendance-intervention",
    name: "Student Attendance Intervention",
    description:
      "Respond to a repeated-absence pattern (multiple AttendanceStatus.ABSENT records for one student within a short window) with a structured outreach and support plan before the student silently drops. Purpose: turn a pattern that's easy to individually excuse session-by-session into a single, owned case the moment it becomes a trend.\n\n" +
      "Typical duration: 5-10 days from pattern flagged to a support plan agreed, with resolution tracked over the following 2-3 weeks of subsequent sessions. Primary owner: the lead instructor who flagged the pattern. Secondary owners: the student's mentor (if assigned, for support-need context) and chapter staff (escalation point if outreach to the family doesn't land).\n\n" +
      "Success definition: the student's attendance measurably improves over the next 2-3 sessions after the support plan is agreed, or the case is honestly closed as a drop with a documented reason rather than left open indefinitely. KPIs: time from pattern detection to first outreach attempt (target under 48 hours), outreach response rate, percentage of cases that reach an agreed support plan versus going straight to drop, and post-intervention attendance rate compared to the pre-intervention baseline.\n\n" +
      "Common failure modes: instructors individually excuse each absence ('they were probably just sick') without ever stepping back to see the pattern, so three absences become five before anyone flags it; outreach goes to the student only when the actual blocker is a parent-side logistics issue (transportation, conflicting commitments) that only a parent conversation can surface; and a support plan gets agreed verbally in a hallway conversation and is never written down, so there's nothing to check progress against at the next review.\n\n" +
      "Hard-won notes: the trigger threshold matters more than the response quality — waiting for a fourth or fifth absence before flagging a pattern means the student has often already mentally checked out of the class. Flag and reach out after the second consecutive or third non-consecutive absence, even though that feels early; a false alarm costs one conversation, a missed pattern costs a student.",
    domain: "STUDENTS",
    defaultOwnerRole: "INSTRUCTOR",
    followUpCadenceHours: 48,
    escalateAfterHours: 96,
    stages: [
      {
        key: "flag-pattern",
        name: "Flag Pattern",
        description:
          "An instructor or attendance reviewer has noticed a repeated ABSENT pattern (two consecutive or three non-consecutive sessions within a few weeks) and opened a case. Exit when the pattern is documented with specific dates so outreach can reference it concretely. Owner: lead instructor.",
        slaHours: 24,
        isInitial: true,
        steps: [
          {
            key: "document-pattern",
            name: "Document the absence pattern",
            kind: "TASK",
            description:
              "Write down the specific session dates the student was ABSENT (not LATE or EXCUSED — those are different signals) and any context already known, such as an EXCUSED absence with a stated reason versus an unexplained no-show. The common mistake is flagging 'poor attendance' vaguely instead of citing dates, which makes the outreach conversation easy to deflect. Tip: pull the actual AttendanceRecord history rather than relying on memory — instructors often misremember which absences were excused.",
            dueOffsetHours: 24,
          },
        ],
      },
      {
        key: "outreach",
        name: "Outreach to Student/Parent",
        description:
          "Reach out directly to the student and, for younger students or where logistics are likely the cause, the parent — to understand the real blocker before assuming disengagement. Exit when there's been an actual response, not just an attempt. Owner: lead instructor, with the student's mentor looped in if one is assigned.",
        slaHours: 48,
        steps: [
          {
            key: "contact-student",
            name: "Contact the student directly",
            kind: "TASK",
            description:
              "Reach out to the student first, in a tone that's curious rather than disciplinary — 'noticed you've missed a few sessions, everything okay?' surfaces more honest answers than 'you need to attend.' The common mistake is leading with the policy consequence instead of the concern, which shuts down an honest conversation about what's actually wrong. Tip: if the student doesn't respond within 48 hours, escalate to the parent rather than waiting indefinitely — this stage has a real SLA for a reason.",
            dueOffsetHours: 48,
          },
          {
            key: "contact-parent",
            name: "Contact parent if needed",
            kind: "TASK",
            isRequired: false,
            description:
              "If the student doesn't respond, or the likely cause looks logistical (transportation, family schedule, a support need from the original intake case), reach out to the parent directly. The common mistake is skipping this because it feels like escalation — for younger students it's often the fastest path to the real answer, not an escalation at all. Tip: reference the original StudentIntakeCase supportNeeds field if one exists; the blocker is sometimes something the family already told the program about at intake.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "support-plan",
        name: "Support Plan Agreed",
        description:
          "A concrete, written plan has been agreed with the student (and parent, if involved) addressing the actual blocker identified in outreach. Exit when the plan is documented and a re-check date is set. Owner: lead instructor, coordinating with the mentor if one is assigned.",
        slaHours: 72,
        steps: [
          {
            key: "agree-plan",
            name: "Agree & document support plan",
            kind: "DECISION",
            description:
              "Write down the specific plan — a schedule adjustment, a transportation fix, a connection to the student's mentor for a deeper support-need conversation, or simply a clear expectation reset — and the date attendance will be re-checked. The common mistake is agreeing to a plan verbally and never writing it down, leaving nothing to measure against later. Tip: keep the plan to one or two concrete actions; a long list of changes is a sign the conversation didn't actually land on the real blocker.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "resolved-or-escalated",
        name: "Resolved or Escalated",
        description:
          "Attendance over the following sessions is reviewed against the support plan. The case closes as resolved (attendance improved), as an honest drop (the student is no longer attending and the enrollment should reflect DROPPED), or escalates further if the support plan isn't enough on its own. This is the terminal stage for this workflow. Owner: lead instructor, escalating to chapter staff/leadership if unresolved.",
        isTerminal: true,
        steps: [
          {
            key: "review-outcome",
            name: "Review attendance after support plan",
            kind: "DECISION",
            description:
              "At the agreed re-check date, look at actual attendance over the following sessions, not just whether the conversation felt productive. The common mistake is closing the case as 'resolved' because the conversation went well, without confirming attendance actually changed. Tip: give it at least two to three sessions before judging — a single good session after a hard conversation isn't yet a trend.",
            dueOffsetHours: 96,
          },
          {
            key: "escalate-if-unresolved",
            name: "Escalate to chapter staff if unresolved",
            kind: "TASK",
            isRequired: false,
            description:
              "If attendance hasn't improved and the support plan wasn't enough, escalate to chapter staff or leadership rather than letting the case quietly fade — this is exactly what the workflow's overdue escalation automation exists to catch. The common mistake is an instructor absorbing this alone for weeks past the point a staff conversation with the family was needed. Tip: bring the documented pattern and the agreed plan to the escalation — it turns a vague 'this student isn't coming anymore' into an actionable handoff.",
            dueOffsetHours: 48,
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("flag-pattern", "Attendance pattern flagged for student"),
      typedActionOnEnter("outreach", "Reach out about attendance pattern", "OUTREACH", 48),
      typedActionOnEnter("support-plan", "Agree attendance support plan", "RELATIONSHIP", 72),
      notifyOnEnter("resolved-or-escalated", "Review attendance after support plan"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------
  // 5. Student Recognition
  // --------------------------------------------------------------------
  {
    key: "student-recognition",
    name: "Student Recognition",
    description:
      "Run a lightweight nomination-to-announcement cycle for recognizing a student's achievement, growth, or contribution. Purpose: make sure a nomination someone took the time to write doesn't quietly die in an inbox, and that recognition actually reaches the student and their class/chapter rather than staying internal.\n\n" +
      "Typical duration: 1-2 weeks from nomination to announcement, intentionally short so recognition stays timely and connected to the achievement. Primary owner: chapter staff coordinating recognition. Secondary owners: the nominating instructor or mentor, and whoever runs the chapter's recognition moment (a class shoutout, a chapter meeting mention, a portal announcement).\n\n" +
      "Success definition: every nomination receives a reviewed decision, and an approved nomination results in an actual recognition moment the student is aware of — not just a status flip in the portal. KPIs: nomination-to-decision time, percentage of nominations approved versus held for more context, percentage of approved recognitions with a confirmed announcement/event date, and nomination volume by chapter (a chapter with zero nominations over a long stretch is itself a signal worth checking).\n\n" +
      "Common failure modes: a nomination is approved but never actually announced because no one owns turning 'approved' into an actual moment; recognition is reserved only for academic or competition wins, which sends an implicit message that effort, growth, or character don't count — narrowing who ever gets nominated; and nominations pile up unreviewed because there's no deadline pressure the way there is on, say, an intake decision.\n\n" +
      "Hard-won notes: recognition loses most of its value if it's delayed — a recognition that lands a month after the achievement reads as an afterthought. Keep this workflow short on purpose, and don't let 'we'll do a bigger combined recognition later' become an excuse to delay an individual student's moment.",
    domain: "STUDENTS",
    defaultOwnerRole: "STAFF",
    followUpCadenceHours: 72,
    stages: [
      {
        key: "nomination",
        name: "Nomination",
        description:
          "An instructor, mentor, or staff member submits a nomination naming the specific achievement or growth being recognized. Exit when the nomination has enough specific detail to be reviewed without follow-up questions. Owner: the nominator.",
        slaHours: 48,
        isInitial: true,
        steps: [
          {
            key: "submit-nomination",
            name: "Submit nomination with specifics",
            kind: "TASK",
            description:
              "Write the nomination with a specific, concrete description of what the student did — not just 'great student' but the actual achievement, growth, or moment worth recognizing. The common mistake is a vague nomination that the reviewer then has to chase the nominator to clarify, which is the single biggest cause of nominations stalling. Tip: include one specific example or quote if possible — it's what makes the eventual announcement feel genuine rather than generic.",
            dueOffsetHours: 48,
          },
        ],
      },
      {
        key: "review",
        name: "Review",
        description:
          "Chapter staff reviews the nomination for fit and decides whether to approve it for recognition. Exit when a decision is recorded. Owner: chapter staff.",
        slaHours: 48,
        steps: [
          {
            key: "review-nomination",
            name: "Review & approve nomination",
            kind: "APPROVAL",
            description:
              "Review the nomination against a deliberately broad bar — academic wins, competition results, but also effort, growth, attendance turnarounds, or peer support all count. The common mistake is reserving recognition only for the most visible achievements, which quietly excludes most students from ever being recognized. Tip: if the nomination is vague rather than not-deserving, go back to the nominator for specifics instead of declining outright.",
            dueOffsetHours: 48,
          },
        ],
      },
      {
        key: "recognition-event",
        name: "Recognition Event/Announcement",
        description:
          "The approved recognition is actually delivered — a class shoutout, a chapter meeting mention, a portal/newsletter announcement — promptly and visibly. This is the terminal stage. Exit: this workflow instance completes once the recognition has actually happened, not when it's merely scheduled. Owner: chapter staff, coordinating with whoever runs the relevant moment (instructor for a class shoutout, chapter president for a chapter meeting).",
        isTerminal: true,
        steps: [
          {
            key: "schedule-announcement",
            name: "Schedule recognition moment",
            kind: "TASK",
            description:
              "Pick a specific, near-term moment to deliver the recognition — the next class session, the next chapter meeting, the next newsletter — rather than leaving it as an unscheduled 'we'll get to it.' The common mistake is approving a nomination and then letting weeks pass with no concrete plan for when it's actually delivered. Tip: default to the nearest available moment; recognition value decays fast with delay.",
            dueOffsetHours: 72,
          },
          {
            key: "confirm-delivered",
            name: "Confirm recognition delivered",
            kind: "TASK",
            description:
              "Confirm the recognition actually happened and the student is aware of it — close the loop rather than assuming the scheduled moment went as planned. The common mistake is treating 'scheduled' as equivalent to 'done.' Tip: a quick note back to the original nominator that it happened closes the loop for them too and makes them more likely to nominate again.",
            dueOffsetHours: 24,
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("review", "New student recognition nomination submitted"),
      typedActionOnEnter("review", "Review student recognition nomination", "APPLICATION_REVIEW", 48),
      notifyOnEnter("recognition-event", "Student recognition approved — schedule announcement"),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------
  // 6. Student Issue Escalation
  // --------------------------------------------------------------------
  {
    key: "student-issue-escalation",
    name: "Student Issue Escalation",
    description:
      "Escalate a behavioral or wellbeing concern about a student through a tight, accountable review-and-resolution path, generalized from the chapter-level recruiting escalation pattern (docs/brayden/chapter-os-runbook.md §7) down to the level of an individual student. Purpose: make sure a concern that's serious enough to log never just sits with the one person who noticed it — there is always a named reviewer and a real deadline.\n\n" +
      "Typical duration: this workflow runs on a deliberately tight clock — initial review within 24 hours of a concern being logged, and a resolution or further escalation within 72 hours of that. Primary owner: the mentor or instructor who logs the concern. Secondary owners: chapter leadership/staff (the review and resolution authority) and, for concerns serious enough to require it, an admin and the student's parent.\n\n" +
      "Success definition: every logged concern receives a leadership review within SLA, and the case ends in either a documented resolution with a clear next step or an explicit further escalation to parents/admin — never in silence. KPIs: time from concern logged to leadership review (hard target under 24 hours), percentage of concerns resolved at the mentor/leadership level versus requiring parent/admin escalation, percentage of cases with a follow-up check completed after resolution, and zero tolerance for concerns that age past SLA with no review — that number should always be checked, not just trended.\n\n" +
      "Common failure modes: a concern gets logged and the person who logged it assumes someone else is handling it, when in fact no one has been assigned; the review happens but produces no documented decision, so there's no record of what was decided if the same pattern recurs later; and escalation to parents is delayed because it feels uncomfortable, even after the situation has clearly outgrown what a mentor or instructor can resolve alone.\n\n" +
      "Hard-won notes: mirroring the chapter hiring escalation matrix's logic directly — name a specific escalation target for every branch instead of a generic 'leadership will handle it.' If the concern involves another adult in the program, escalate to admin immediately rather than routing through the normal chain, exactly as the chapter runbook escalates GLOBAL_ADMIN-tier issues straight to an admin reviewer. Treat this workflow as something that should feel appropriately serious to use — it is not the place for routine attendance or academic concerns, which belong in student-attendance-intervention or student-advising instead.",
    domain: "STUDENTS",
    defaultOwnerRole: "STAFF",
    followUpCadenceHours: 24,
    escalateAfterHours: 24,
    stages: [
      {
        key: "concern-logged",
        name: "Concern Logged",
        description:
          "A mentor, instructor, or staff member logs a behavioral or wellbeing concern with specific, factual detail. Exit immediately on logging — this stage exists only to capture the concern accurately before it's handed to a reviewer. Owner: whoever observed or was told about the concern.",
        slaHours: 4,
        isInitial: true,
        steps: [
          {
            key: "log-concern",
            name: "Log concern with factual detail",
            kind: "TASK",
            description:
              "Write down exactly what was observed or reported — specific behavior, what was said, who was involved, when — separated clearly from interpretation or assumption. The common mistake is logging a conclusion ('the student seems troubled') instead of the underlying observation, which gives the reviewer nothing concrete to act on. Tip: if the concern came from a third party (another student, a parent), note that explicitly rather than presenting it as a first-hand observation.",
            dueOffsetHours: 4,
          },
          {
            key: "notify-leadership-immediately",
            name: "Notify leadership immediately",
            kind: "TASK",
            description:
              "Don't sit on a logged concern — notify a named leadership or staff contact the same day, even outside normal response-time norms for other workflows. The common mistake is treating this like a routine action item that can wait for the next check of the queue. Tip: if you're unsure whether something rises to the level of this workflow versus a normal advising note, log it here anyway — the review stage is where that judgment call belongs, not the point of observation.",
            dueOffsetHours: 4,
          },
        ],
      },
      {
        key: "leadership-review",
        name: "Leadership/Mentor Review",
        description:
          "Chapter leadership or staff reviews the logged concern and decides on a path: handle directly, loop in the student's mentor, or escalate further. Exit when a documented decision is made — within 24 hours of the concern being logged, matching the chapter runbook's escalation urgency. Owner: chapter leadership/staff reviewer.",
        slaHours: 24,
        steps: [
          {
            key: "review-concern",
            name: "Review concern & determine path",
            kind: "DECISION",
            description:
              "Assess the logged concern and decide explicitly: resolve at this level with a direct conversation/plan, involve the student's mentor for ongoing support, or escalate to parents/admin because it exceeds what chapter-level staff can or should handle alone. The common mistake is defaulting to 'monitor and see' as an implicit fourth option, which is really just a decision not to decide. Tip: when genuinely unsure which path fits, escalate — the cost of an unnecessary parent conversation is far lower than the cost of under-responding to a real concern.",
            dueOffsetHours: 24,
          },
        ],
      },
      {
        key: "resolution-path",
        name: "Resolution or Further Escalation",
        description:
          "Execute the decided path: a documented resolution with a clear next step, or formal escalation to the parent and/or an admin. Exit when there is a concrete outcome on record — not when the immediate conversation ends. This is the terminal stage for this workflow. Owner: chapter leadership/staff, with admin pulled in for any escalation branch.",
        slaHours: 72,
        isTerminal: true,
        steps: [
          {
            key: "escalate-to-parent-admin",
            name: "Escalate to parent and/or admin",
            kind: "TASK",
            isRequired: false,
            description:
              "If the review decided this exceeds chapter-level handling, contact the parent and/or a portal admin directly and promptly — mirroring the chapter runbook's rule of escalating GLOBAL_ADMIN-tier issues straight to an admin reviewer rather than working it through the normal chain. The common mistake is softening or delaying this step because the conversation is uncomfortable. Tip: bring the factual log from the first stage to this conversation — specifics build trust with a parent far better than a vague summary.",
            dueOffsetHours: 24,
          },
          {
            key: "document-resolution",
            name: "Document resolution & next step",
            kind: "DECISION",
            description:
              "Record exactly what was decided and what happens next — a support plan, a referral, a parent agreement, or simply a documented decision that no further action is needed and why. The common mistake is closing the case with only an informal verbal understanding, leaving no record if a similar concern arises again later. Tip: write the resolution as if a different staff member will need to understand the full picture from it alone — because eventually, one will.",
            dueOffsetHours: 48,
          },
          {
            key: "follow-up-check",
            name: "Complete follow-up check",
            kind: "TASK",
            description:
              "Check back in after the agreed timeframe to confirm the resolution actually held — a concern that's 'resolved' on paper but recurs within weeks needs to be treated as a new, related case, not ignored as already handled. The common mistake is treating documentation of a resolution as the end of the workflow rather than the start of a follow-up window. Tip: loop the student's mentor into this follow-up if one is assigned — they're often the first to notice if the underlying issue resurfaces.",
            dueOffsetHours: 168,
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("concern-logged", "Student concern logged — leadership review required"),
      typedActionOnEnter("leadership-review", "Review logged student concern", "RELATIONSHIP", 24),
      notifyOnEnter("resolution-path", "Determine resolution or escalation for student concern"),
      typedActionOnEnter("resolution-path", "Document resolution and complete follow-up", "FOLLOW_UP", 72),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------
  // 7. Student Program Completion & Alumni Transition
  // --------------------------------------------------------------------
  {
    key: "student-completion-alumni",
    name: "Student Program Completion & Alumni Transition",
    description:
      "Close out a student's program participation properly — capture real outcomes, recognize the completion, and formally transition them to alumni status — instead of letting a student's record just go quiet when their last class ends. Purpose: make program completion a deliberate, archived, celebrated milestone rather than an absence of activity that someone eventually notices.\n\n" +
      "Typical duration: 1-2 weeks from final class session to alumni transition being recorded. Primary owner: chapter staff. Secondary owners: the student's lead instructor(s) (outcome capture) and the student's mentor, if assigned (the relationship most likely to continue informally past program completion).\n\n" +
      "Success definition: outcomesAchieved is populated with real, specific outcomes (not left at whatever it was mid-course), the student received a recognition moment tied to completion, and the transition to alumni status is explicitly recorded rather than inferred from inactivity. KPIs: percentage of completed enrollments (ClassEnrollmentStatus.COMPLETED) with outcomesAchieved actually updated at completion, time from final session to recognition, percentage of completions that get an explicit alumni-transition record, and — as a longer-horizon signal worth tracking even though it's outside this workflow — re-engagement rate of alumni in any continued program touchpoints.\n\n" +
      "Common failure modes: outcomesAchieved is left exactly as it was mid-course because no one revisits it at the actual completion moment, undercounting what the student really accomplished; completion is treated as purely administrative (a status flip) with no recognition moment, which wastes a natural, earned celebration opportunity; and the 'alumni' label gets applied automatically by inactivity rather than by a real transition conversation, so students don't know that's what happened to them.\n\n" +
      "Hard-won notes: this workflow intentionally stops at the alumni transition — ongoing alumni engagement (newsletters, alumni events, return-as-mentor pathways) is a real and valuable concern but a separate one, not modeled here; treat the terminal stage as a clean handoff point, not a place to bolt on long-running alumni-relationship steps that belong in their own process once that program exists.",
    domain: "STUDENTS",
    defaultOwnerRole: "STAFF",
    followUpCadenceHours: 72,
    stages: [
      {
        key: "mark-complete",
        name: "Mark Complete & Capture Outcomes",
        description:
          "The student's enrollment reaches ClassEnrollmentStatus.COMPLETED at program end. Exit when outcomesAchieved and a final instructorNotes entry genuinely reflect the full course, not a stale mid-course snapshot. Owner: lead instructor, with chapter staff confirming.",
        slaHours: 72,
        isInitial: true,
        steps: [
          {
            key: "capture-outcomes",
            name: "Capture final outcomes achieved",
            kind: "TASK",
            description:
              "Update outcomesAchieved to reflect everything the student accomplished across the full course, not just whatever was logged at the last mid-course check. The common mistake is leaving this field stale because updating it feels redundant with session-by-session notes — but this is the field that becomes the permanent record once the class closes. Tip: review sessionsAttended alongside outcomes; a high attendance count with thin outcomes is worth a final instructorNotes comment explaining the gap.",
            dueOffsetHours: 72,
          },
          {
            key: "final-instructor-note",
            name: "Write final instructor note",
            kind: "TASK",
            description:
              "Write a closing instructorNotes entry summarizing the student's trajectory across the course — where they started, where they ended, anything worth flagging for whoever works with this student next (a future instructor, a mentor). The common mistake is skipping this because the course is already over and it feels like extra work after the fact. Tip: write it for an audience who never met the student — that's usually who actually reads it later.",
            dueOffsetHours: 48,
          },
        ],
      },
      {
        key: "recognition",
        name: "Recognition",
        description:
          "The student's completion is acknowledged with a real recognition moment — a certificate, a shoutout, an end-of-program event mention. Exit when the recognition has actually happened. Owner: chapter staff, coordinating with the lead instructor.",
        slaHours: 96,
        steps: [
          {
            key: "issue-recognition",
            name: "Issue completion recognition",
            kind: "TASK",
            description:
              "Deliver a concrete recognition tied to this specific completion — a certificate, a mention at a chapter event, a note home to the family — rather than letting completion pass unmarked. The common mistake is assuming the COMPLETED status itself is sufficient acknowledgment; for the student, a status change in a portal they may never check isn't a celebration. Tip: where the program has a CertificateTemplate set up for the relevant program, use it — a generic thank-you note reads as much less significant than a formal certificate.",
            dueOffsetHours: 96,
          },
        ],
      },
      {
        key: "alumni-transition",
        name: "Alumni Transition",
        description:
          "The student is explicitly transitioned to alumni status with a real conversation or communication marking the shift, not an inferred status from going quiet. This is the terminal stage for this workflow — ongoing alumni engagement (newsletters, alumni events, a return-as-mentor pathway) is a genuinely separate, longer-running concern that this workflow deliberately does not model; it ends at a clean, documented handoff. Owner: chapter staff.",
        isTerminal: true,
        steps: [
          {
            key: "confirm-transition",
            name: "Confirm & record alumni transition",
            kind: "DECISION",
            description:
              "Record the explicit transition to alumni status and communicate it to the student/family — this is a deliberate milestone, not something that should be inferred later from the absence of any active enrollment. The common mistake is letting 'alumni' be a label applied retroactively by whoever notices the student stopped showing up in active rosters. Tip: if there's a known path back in (returning as a junior mentor, a teen-leadership track), mention it here — it's the natural moment to plant that seed.",
            dueOffsetHours: 72,
          },
          {
            key: "note-ongoing-engagement-deferred",
            name: "Note ongoing alumni engagement as a separate concern",
            kind: "TASK",
            isRequired: false,
            description:
              "Leave an explicit note that any further alumni engagement (event invitations, periodic check-ins, a future mentor pathway) is intentionally out of scope for this workflow and should be tracked through whatever the program's alumni-engagement process is, rather than left as an ambiguous loose end here. The common mistake is trying to keep this workflow instance open indefinitely as a stand-in for long-term alumni relationship tracking, which it isn't built for. Tip: if no formal alumni-engagement process exists yet, flag that gap to chapter staff explicitly rather than letting this step quietly paper over it.",
            dueOffsetHours: 24,
          },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("mark-complete", "Capture final outcomes for completed student", "OPERATIONS", 72),
      notifyOnEnter("recognition", "Student completed program — issue recognition"),
      typedActionOnEnter("recognition", "Issue program completion recognition", "RELATIONSHIP", 96),
      notifyOnEnter("alumni-transition", "Confirm student alumni transition"),
      autoAdvanceWhenReady(),
    ],
  },
];
