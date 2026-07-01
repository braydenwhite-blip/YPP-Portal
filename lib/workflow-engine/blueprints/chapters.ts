// ============================================================================
// Universal Workflow Engine — blueprint catalog: Chapters
// ============================================================================
//
// Chapter lifecycle playbooks. Grounded in the real CP 12-week playbook
// (docs/AUTOMATION_BRAIN.md + lib/automation/playbook.ts), the chapter health
// rubric (lib/chapters/health.ts), and the chapter hiring runbook
// (docs/brayden/chapter-os-runbook.md). `ChapterLifecycleStatus` stage names
// (lib/chapters/lifecycle.ts) are used verbatim — never invented synonyms.

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

export const CHAPTER_BLUEPRINTS: WorkflowBlueprint[] = [
  // ==========================================================================
  // 1. Chapter Launch — APPROVED → ACTIVE, the 12-week CP playbook
  // ==========================================================================
  {
    key: "chapter-launch",
    name: "Chapter Launch",
    description:
      "Purpose: take a chapter from a confirmed, approved Chapter President through the CP guide's 12-week playbook to a live, running first class. This is the canonical operating sequence behind everything the Automation Brain surfaces on the chapter home and chapter-operating pages (lib/automation/playbook.ts) — the stages below group the playbook's six two-week windows into four operating phases so a CP and their regional lead can see real momentum, not just a checklist. " +
      "Typical duration: 10-12 weeks (roughly 1,700-1,900 hours end to end across all stages, matching the playbook's own week numbering) from APPROVED to a first class actually running. " +
      "Primary owner: the Chapter President (defaultOwnerSubtype LEADERSHIP, since the instance starts before a CP user record may even be linked); secondary owners: the regional/national staff lead who reviews launch plans and curriculum, plus founding instructors once recruited. " +
      "Success definition: at least one confirmed partner with logistics locked in writing, founding instructors hired and curriculum approved, classes published and meeting the enrollment target, and a first class actually held with attendance recorded. " +
      "KPIs: partners contacted (target 5+ by week 2) and confirmed (1+ by week 6), instructor applicants (5+ by week 2, ~25 by week 4) and hires (~3 by week 6), public classes with enrollment (10+ students by week 8), and attendance captured for the first live session. " +
      "Common failure modes: chapters stall in buildout because partner outreach never reaches the 5-contact threshold in weeks 1-2 (AUTOMATION_BRAIN.md's playbook interpreter flags this immediately as overdue, but if nobody is watching the chapter operating page it goes unnoticed for weeks); a confirmed partner exists but logistics (room, times, supervision) were never locked in writing, which blows up days before launch; curriculum sits in CP review past the 48-hour SLA because the CP is juggling recruiting and grading review backlogs up; and classes go public without enough advertising lead time, so they hit week 8 under-enrolled. " +
      "Hard-won notes: front-load partner and instructor outreach in weeks 1-2 even though it feels early — every chapter that hits the week-6 confirmed-partner gate without already having had 2-3 partner conversations ends up slipping the whole timeline by a month; and treat the week-6 curriculum and logistics gates as hard stops, not soft targets, because everything in launch readiness (classes, enrollment, advertising) depends on them being real.",
    domain: "CHAPTERS",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 168,
    escalateAfterHours: 336,
    initialStatus: "PUBLISHED",
    triggers: [
      { event: "ENTITY_STATUS_CHANGED", subjectType: "CHAPTER", matchStatus: "APPROVED" },
      { event: "ENTITY_STATUS_CHANGED", subjectType: "CHAPTER", matchStatus: "LAUNCHING" },
    ],
    stages: [
      {
        key: "approved-staffed",
        name: "Approved & Staffed",
        description:
          "Weeks 1-2 of the playbook: lock in the founding team and kick off partner + instructor outreach in parallel. Done when the chapter president is confirmed in the portal, a launch plan is on file, and outreach has actually started (not just been planned).",
        slaHours: 336,
        isInitial: true,
        steps: [
          {
            key: "confirm-president",
            name: "Confirm chapter president in the portal",
            kind: "TASK",
            dueOffsetHours: 72,
            description:
              "Verify the approved Chapter President's account is linked to this chapter (presidentId set) and that they can see the chapter operating page. The most common mistake here is approving the chapter in the leadership command center but never actually linking the user record, which silently breaks every owner-assigned automation downstream. Confirm by having the CP load /chapter and see their own chapter, not a blank state.",
          },
          {
            key: "launch-plan",
            name: "Submit launch plan",
            kind: "DOCUMENT",
            dueOffsetHours: 168,
            description:
              "Have the CP fill in launchPlanText plus launchTargetDate and expectedFirstMeetingAt on the Chapter record. A vague plan ('we'll figure it out') is the single biggest predictor of a chapter that drifts past its launch target — push for specific partner and instructor names even if tentative, and a real date, not a placeholder.",
          },
          {
            key: "partner-research",
            name: "Start partner research",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "Add at least one prospective partner organization to the pipeline this week. The playbook expects research to begin immediately in week 1 — chapters that wait until week 3 to even start a list are the ones still hunting for a partner at week 8. List schools, community centers, and after-school programs the CP already has relationships with first.",
          },
          {
            key: "partner-outreach",
            name: "Reach out to 5+ partner organizations",
            kind: "TASK",
            dueOffsetHours: 336,
            description:
              "Contact at least five prospective partner organizations by the end of week 2 (the playbook's explicit target). A single warm lead is not enough — outreach volume in weeks 1-2 is what produces a confirmed, fully-staffed partner by week 6. Track each contact so the automation brain can see real progress, not just intent.",
          },
          {
            key: "instructor-recruiting-start",
            name: "Begin instructor recruiting (5+ applicants)",
            kind: "TASK",
            dueOffsetHours: 336,
            description:
              "Post the founding instructor openings and push for 5-8 applicants by week 2. Use the chapter recruiting flow (see docs/brayden/chapter-os-runbook.md) so every applicant lands in the standard pipeline with interview slots and structured notes — recruiting outside the portal (e.g. a side spreadsheet) is the most common reason instructor hiring stalls later.",
          },
        ],
      },
      {
        key: "buildout",
        name: "Buildout",
        description:
          "Weeks 3-6: convert outreach into commitments — partner meetings and a confirmed partner with written logistics, instructor interviews and hires, and curriculum submitted and reviewed. Owned jointly by the CP and the regional staff lead who signs off on curriculum. Done when there is one confirmed partner with logistics locked, instructors hired, and curriculum approved.",
        slaHours: 672,
        steps: [
          {
            key: "partner-meetings",
            name: "Get partner meetings on the calendar",
            kind: "MEETING",
            dueOffsetHours: 168,
            description:
              "Convert contacted organizations into scheduled or completed meetings by week 4. A common mistake is letting outreach go cold after the first email — follow up within a week, and bring a one-page summary of what YPP needs from a partner (room, day/time, point of contact) so the meeting can actually produce a decision.",
          },
          {
            key: "applicant-pool",
            name: "Grow the instructor applicant pool toward 25",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "Keep recruiting through week 4 toward roughly 25 applicants in the pipeline, even after the first wave looks promising — early enthusiasm often doesn't convert to confirmed interviews. Use /chapter/recruiting to track volume against the playbook target, not gut feel.",
          },
          {
            key: "interviews",
            name: "Start interviewing applicants",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "Begin interviews by week 4 per the recruiting runbook: post a slot (POSTED), get candidate confirmation (CONFIRMED), and mark it COMPLETED with a structured recommendation note before any decision. The decision button stays blocked without a completed interview and a recommendation note — don't wait until week 6 to discover that.",
          },
          {
            key: "confirm-partner",
            name: "Confirm at least one partner",
            kind: "DECISION",
            dueOffsetHours: 336,
            description:
              "Close at least one confirmed partner by week 6 — a chapter cannot launch without one, and this is the highest-weight gate in the entire playbook. If outreach in weeks 1-2 was thin, this is where it shows: a chapter with zero partner meetings by week 4 almost never confirms one by week 6. Escalate to regional staff for a warm introduction rather than letting this slip further.",
          },
          {
            key: "logistics-writing",
            name: "Lock partner logistics in writing",
            kind: "DOCUMENT",
            dueOffsetHours: 336,
            description:
              "For the confirmed partner, get room, meeting times, and adult supervision confirmed in writing (an email confirmation is enough — it doesn't need to be a formal contract). A verbal 'yes, that room should work' from a partner contact is not logistics-in-writing, and this is exactly the gap that blows up the week before launch when the room turns out to be double-booked.",
          },
          {
            key: "hire-instructors",
            name: "Hire founding instructors (target ~3)",
            kind: "DECISION",
            dueOffsetHours: 336,
            description:
              "Make offers and confirm acceptances for roughly three founding instructors by week 6. Record the decision through the standard hiring decision flow so the candidate is notified automatically and the instructor-hiring workflow (chained on completion of this whole blueprint) has a clean handoff for the next cohort.",
          },
          {
            key: "curriculum-submitted",
            name: "Collect curriculum submissions",
            kind: "DOCUMENT",
            dueOffsetHours: 336,
            description:
              "Get each hired instructor to submit their curriculum draft so review can finish before launch readiness begins. Don't wait for a 'perfect' draft — submitting something rough by week 5 leaves room for the two-stage curriculum review; submitting nothing until week 7 guarantees a launch delay.",
          },
          {
            key: "curriculum-review",
            name: "Review curriculum within 48 hours",
            kind: "APPROVAL",
            dueOffsetHours: 360,
            description:
              "As CP, review submitted curriculum within the 48-hour SLA the playbook expects. This is the step that quietly backs up when a CP is heads-down on recruiting — set a standing reminder, because a stack of unreviewed curriculum at week 6 cascades directly into a late class launch.",
          },
        ],
      },
      {
        key: "launch-readiness",
        name: "Launch Readiness",
        description:
          "Weeks 7-9: turn confirmed partners and approved curriculum into public, enrollable classes and drive enrollment to target. Owned by the CP with instructors handling advertising in their own networks. Done when classes are public, enrollment is at or near target, and no class is under-enrolled heading into launch.",
        slaHours: 336,
        steps: [
          {
            key: "publish-classes",
            name: "Publish public class listings with launch dates",
            kind: "TASK",
            dueOffsetHours: 96,
            description:
              "Move classes from draft to public with a real launch date by week 8. Students cannot enroll in a class that exists only as an internal draft — the most common readiness gap is curriculum and partner logistics both being done, but nobody actually flipping the class to public.",
          },
          {
            key: "drive-enrollment",
            name: "Drive enrollment toward 10+ students",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "Push advertising through partner channels, instructor networks, and direct outreach to reach roughly 10 enrolled students by week 8. Advertising that starts the same week classes go public is too late — coordinate with the partner so flyers/announcements go out as soon as the launch date is locked, not after.",
          },
          {
            key: "fix-under-enrolled",
            name: "Fix under-enrolled classes before launch",
            kind: "TASK",
            dueOffsetHours: 336,
            description:
              "Identify any class that is under-enrolled for its launch window and intensify advertising or consider combining sections before the first session. Letting an under-enrolled class launch anyway is how chapters end up with a half-empty first session that tanks early momentum and instructor morale.",
          },
        ],
      },
      {
        key: "active",
        name: "Active",
        description:
          "Week 10+: the first class is live. Done when at least one session has actually run with attendance recorded — this is the literal definition of a chapter moving from LAUNCHING to ACTIVE. Owned by the CP, who keeps running operating cadence (impact meetings, attendance, feedback) from here on.",
        isTerminal: true,
        steps: [
          {
            key: "run-first-class",
            name: "Run first class",
            kind: "TASK",
            description:
              "Hold the first live session and confirm it actually happened — instructor present, students present, room as planned. This is the moment the chapter becomes real; flag immediately to regional staff if the first session has to be cancelled or rescheduled, since that's an early warning sign worth tracking, not just rescheduling quietly.",
          },
          {
            key: "monitor-attendance",
            name: "Monitor attendance every session",
            kind: "TASK",
            description:
              "Record attendance for every session from the first one onward. A chapter with no attendance data by week 10 is flying blind on retention risk — this is one of the readiness signals the Automation Brain surfaces on the chapter home page, so an empty attendance log shows up as a real gap to leadership, not a minor omission.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("approved-staffed", "Chapter approved — confirm the president and kick off outreach"),
      typedActionOnEnter("approved-staffed", "Confirm chapter president and submit launch plan", "ADMIN_TASK", 168),
      typedActionOnEnter("approved-staffed", "Start partner and instructor outreach", "OUTREACH", 336),
      notifyOnEnter("buildout", "Buildout phase — close a partner, hire instructors, review curriculum"),
      typedActionOnEnter("buildout", "Confirm a partner and lock logistics in writing", "PARTNERSHIP", 336),
      typedActionOnEnter("buildout", "Hire founding instructors", "INSTRUCTOR_RECRUITING", 336),
      typedActionOnEnter("buildout", "Review submitted curriculum within 48 hours", "CURRICULUM", 360),
      notifyOnEnter("launch-readiness", "Verify launch readiness — publish classes and drive enrollment"),
      typedActionOnEnter("launch-readiness", "Publish classes and push enrollment", "CLASS_PLANNING", 168),
      notifyOnEnter("active", "Chapter is live — track attendance from session one"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
      startWorkflowOnComplete("instructor-hiring", "Start hiring instructors for the newly-launched chapter"),
    ],
  },

  // ==========================================================================
  // 2. Chapter Approval — PROSPECT → APPROVED
  // ==========================================================================
  {
    key: "chapter-approval",
    name: "Chapter Approval",
    description:
      "Purpose: vet a prospective chapter (a school/community with interest but no approved president yet) and turn it into an APPROVED chapter ready to start the 12-week launch playbook. This is the gate that precedes chapter-launch — its terminal stage is the literal status transition (lifecycleStatus → APPROVED) that auto-starts chapter-launch. " +
      "Typical duration: 2-4 weeks (roughly 250-450 hours) from a prospect being logged to a leadership go/no-go decision. " +
      "Primary owner: national/regional leadership reviewing the prospect; secondary owner: the prospective Chapter President applicant and, where relevant, a faculty advisor at the partner school. " +
      "Success definition: a vetted prospect with a credible founding president, a real school/community fit, and a documented leadership decision — approved prospects move cleanly into chapter-launch with no missing setup fields. " +
      "KPIs: time from prospect intake to decision, percentage of approved chapters that have facultyAdvisorName/Email and schoolType filled in before approval (gaps here become launch-week scrambles), recruitment goal realism (recruitmentGoal vs. comparable chapters), and decision turnaround against SLA. " +
      "Common failure modes: a prospect is approved on enthusiasm alone without confirming a faculty advisor or school authorization, which surfaces as a blocked partner conversation weeks into launch; recruitmentGoal is left blank or copy-pasted from another chapter rather than scoped to the actual community size; and the decision drags past a month with no documented reason, which the prospective president reads as disinterest and walks away from. " +
      "Hard-won notes: the faculty advisor relationship (or equivalent community sponsor) is the single best leading indicator of whether a chapter survives its first semester — verify it directly, don't take a secondhand assurance, and write the leadership decision down even when it's a clear yes so there's a paper trail for the inevitable 'why was this chapter approved' question six months later.",
    domain: "CHAPTERS",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 96,
    escalateAfterHours: 240,
    stages: [
      {
        key: "intake-vetting",
        name: "Prospect Intake & Vetting",
        description:
          "Log the prospect and gather the facts leadership needs to decide: school/community fit, a credible founding president, and a faculty advisor or community sponsor. Done when the prospect record is complete enough for a real go/no-go review.",
        slaHours: 168,
        isInitial: true,
        steps: [
          {
            key: "log-prospect",
            name: "Log the prospect chapter",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Create the Chapter record with name, city, region, and partnerSchool filled in, lifecycleStatus PROSPECT. Don't wait for every field to be perfect before logging it — an incomplete prospect in the system beats a promising lead tracked only in someone's inbox.",
          },
          {
            key: "verify-school-type",
            name: "Confirm school/community type and fit",
            kind: "TASK",
            dueOffsetHours: 96,
            description:
              "Set schoolType and confirm the community actually fits YPP's model (age range, program format, accessibility). The common mistake is assuming fit from a single enthusiastic conversation with one teacher — check that the school or organization as a whole, not just one contact, is on board.",
          },
          {
            key: "verify-faculty-advisor",
            name: "Confirm a faculty advisor or community sponsor",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "Get a named, confirmed faculty advisor with facultyAdvisorName and facultyAdvisorEmail on file (or the equivalent community sponsor for non-school partners). This is the step most often skipped under time pressure, and it's the one that most reliably predicts whether the chapter has real institutional backing once the founding president inevitably needs help.",
          },
          {
            key: "vet-founding-president",
            name: "Vet the prospective founding president",
            kind: "APPROVAL",
            dueOffsetHours: 168,
            description:
              "Review the prospective president's application/background and set a realistic recruitmentGoal with them based on the actual community size, not an aspirational number. A recruitmentGoal that's pure guesswork undermines every downstream readiness signal in the launch playbook.",
          },
        ],
      },
      {
        key: "leadership-review",
        name: "Leadership Review & Decision",
        description:
          "Leadership reviews the vetted prospect and makes a documented go/no-go call. Done when a decision is recorded, whether approve, hold, or decline.",
        slaHours: 120,
        steps: [
          {
            key: "review-meeting",
            name: "Hold leadership review",
            kind: "MEETING",
            dueOffsetHours: 72,
            description:
              "Walk through the vetting findings — school fit, faculty advisor, founding president, recruitment goal — with whoever holds approval authority. Keep this meeting focused on the documented facts from intake, not a re-litigation of the whole prospect from scratch.",
          },
          {
            key: "record-decision",
            name: "Record the approval decision",
            kind: "DECISION",
            dueOffsetHours: 120,
            description:
              "Document the decision and reasoning, even for a clear-cut yes. A 'no' or 'hold' needs an actionable reason (e.g. 'no confirmed faculty advisor yet') so the prospective president knows exactly what to fix and can re-enter intake rather than the prospect just going cold.",
          },
        ],
      },
      {
        key: "approved",
        name: "Approved",
        description:
          "The chapter is approved and lifecycleStatus is set to APPROVED — this is the literal trigger condition that auto-starts the Chapter Launch workflow. Terminal: from here the chapter's operating story continues in chapter-launch, not in this blueprint.",
        isTerminal: true,
        steps: [
          {
            key: "set-approved-status",
            name: "Set chapter lifecycle status to Approved",
            kind: "TASK",
            description:
              "Use setChapterLifecycleStatus to move the chapter to APPROVED. This single action fires the entity-status trigger that auto-starts Chapter Launch — don't manually create a separate launch workflow instance, the system handles the handoff.",
          },
          {
            key: "notify-president",
            name: "Notify the founding president of approval",
            kind: "TASK",
            description:
              "Let the founding president know they're approved and that the 12-week launch playbook starts now. Pair this with a concrete next step (confirm their portal account, submit a launch plan) rather than just a congratulatory note — momentum lost in the handoff between approval and launch is hard to recover.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("intake-vetting", "New chapter prospect logged — begin vetting"),
      typedActionOnEnter("intake-vetting", "Verify faculty advisor and school fit", "PARTNERSHIP", 168),
      typedActionOnEnter("leadership-review", "Review prospect and record approval decision", "APPLICATION_REVIEW", 120),
      notifyOnEnter("approved", "Chapter approved — launch playbook starts"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 3. Chapter Recovery — NEEDS_SUPPORT/AT_RISK → ACTIVE
  // ==========================================================================
  {
    key: "chapter-recovery",
    name: "Chapter Recovery",
    description:
      "Purpose: bring a chapter that has drifted into NEEDS_SUPPORT or AT_RISK back to healthy ACTIVE operation, grounded directly in the concrete risk signals lib/chapters/health.ts computes (stale meetings, inactive CP, overdue action backlog, small membership, open support requests). Unlike chapter-intervention, this is the steady, non-emergency remediation path for a chapter that's slipping but not yet in a leadership-escalation crisis. " +
      "Typical duration: 3-6 weeks (roughly 400-650 hours) from diagnosis to confirmed recovery, since trust and cadence rebuild slowly. " +
      "Primary owner: the regional/national staff lead assigned to support the chapter; secondary owner: the Chapter President, who has to be an active participant for recovery to stick. " +
      "Success definition: the chapter's computed health label returns to ON_TRACK — a meeting held in the last 21 days, a meeting scheduled in the future, overdue actions cleared, and CP activity recent — sustained for at least one full reporting cycle, not just a single good week. " +
      "KPIs: days since last meeting (target under 21), overdue action count (target 0-1), days since CP activity (target under 14), member count trend, and open support request count. " +
      "Common failure modes: recovery plans treat the symptom (e.g. 'schedule a meeting') without diagnosing the actual root cause (e.g. the CP is overwhelmed by a course-load change and needs delegated support, not just a calendar nudge); a single good meeting gets read as 'fixed' and support is withdrawn immediately, only for the chapter to relapse within two weeks; and overdue actions get bulk-closed without being actually done, which clears the health signal but not the underlying problem. " +
      "Hard-won notes: always start recovery with a real conversation with the CP before touching the checklist — the health signals tell you *that* something's wrong, not *why*, and the same signal pattern (stale meetings + inactive CP) can mean burnout, a personal emergency, or simple deprioritization, each needing a completely different response.",
    domain: "CHAPTERS",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 120,
    escalateAfterHours: 240,
    stages: [
      {
        key: "diagnose",
        name: "Diagnose Root Cause",
        description:
          "Pull the chapter's exact health signals and talk to the CP to understand why, not just what. Done when there's a specific, named root cause (not just a restated symptom) and the CP has been part of the conversation.",
        slaHours: 96,
        isInitial: true,
        steps: [
          {
            key: "pull-signals",
            name: "Pull current health signals",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Read the chapter's computeChapterHealth reasons directly — days since last meeting, overdue action count, days since CP activity, member count, open support requests. Don't eyeball the dashboard color; pull the actual reasons array so the recovery plan targets the real driver(s), since a chapter can land in AT_RISK for very different combinations of signals.",
          },
          {
            key: "cp-conversation",
            name: "Have a direct conversation with the chapter president",
            kind: "MEETING",
            dueOffsetHours: 72,
            description:
              "Talk to the CP before assuming the cause. Inactive-CP signals especially can mean burnout, a personal situation, or just a busy school season — the response (delegate support vs. a check-in vs. considering a CP transition) is completely different depending on which it is, so don't skip straight to remediation.",
          },
          {
            key: "name-root-cause",
            name: "Document the specific root cause",
            kind: "TASK",
            dueOffsetHours: 96,
            description:
              "Write down the actual cause in concrete terms ('CP took on a second job and has 30 fewer minutes/week' beats 'CP is busy'). A vague root cause produces a vague stabilize stage that doesn't actually move the signals.",
          },
        ],
      },
      {
        key: "stabilize",
        name: "Stabilize",
        description:
          "Directly address the specific risk signal(s) found in diagnosis — get a meeting on the calendar, re-engage the CP, or clear the overdue action backlog. Done when the immediate signal that triggered NEEDS_SUPPORT/AT_RISK is no longer true.",
        slaHours: 168,
        steps: [
          {
            key: "schedule-meeting",
            name: "Get a meeting back on the calendar",
            kind: "MEETING",
            dueOffsetHours: 72,
            description:
              "If lastMeetingAt is stale or nextMeetingAt is null/past, schedule the next chapter meeting now — this single signal alone (no upcoming meeting) adds risk points regardless of everything else. A meeting on the calendar, even a short one, immediately starts moving the health signal in the right direction.",
          },
          {
            key: "clear-overdue-actions",
            name: "Clear the overdue action backlog",
            kind: "TASK",
            dueOffsetHours: 120,
            description:
              "Work through overdue actions with the CP — actually completing them, not just marking them done. More than two overdue actions is what pushes a chapter from NEEDS_SUPPORT toward AT_RISK in the health scoring, so prioritize the oldest/highest-impact ones first rather than cherry-picking easy closes.",
          },
          {
            key: "reengage-cp",
            name: "Re-engage chapter president activity",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "If CP inactivity was a driver, set up a lightweight recurring touchpoint (even a short weekly text check-in) until portal activity resumes naturally. Eighteen-plus days of silence from a CP is a real risk signal — don't let the recovery plan rely on the CP self-initiating contact again.",
          },
        ],
      },
      {
        key: "rebuild-momentum",
        name: "Rebuild Momentum",
        description:
          "Sustain the stabilized state across at least one more reporting cycle and rebuild the operating cadence (regular meetings, fresh action items, member growth) rather than just hitting the minimum bar once. Done when the chapter is operating on its own cadence again, not propped up by extra support-team attention.",
        slaHours: 240,
        steps: [
          {
            key: "second-meeting",
            name: "Confirm a second consecutive on-time meeting",
            kind: "MEETING",
            dueOffsetHours: 168,
            description:
              "One recovered meeting can be a fluke; a second one on a normal cadence is a real signal. Track whether the CP scheduled it proactively or needed another nudge — that tells you how durable the recovery is.",
          },
          {
            key: "membership-check",
            name: "Check membership count and recruiting",
            kind: "TASK",
            dueOffsetHours: 240,
            description:
              "If memberCount was a contributing risk signal (under 3-5 members), confirm there's an active plan to recruit, not just hope that members reappear. A chapter that recovers its meeting cadence but stays under 3 members is still fragile.",
          },
        ],
      },
      {
        key: "confirmed-recovered",
        name: "Confirmed Recovered",
        description:
          "Health label has returned to ON_TRACK and held for a full cycle. Terminal stage — leadership formally closes the recovery effort and returns the chapter to normal operating cadence (no special support-team attention beyond the standard chapter-health-review check-ins).",
        isTerminal: true,
        steps: [
          {
            key: "confirm-on-track",
            name: "Confirm health label is ON_TRACK",
            kind: "DECISION",
            description:
              "Re-run computeChapterHealth and confirm the label has actually returned to ON_TRACK with no lingering reasons, not just 'better than before'. Set lifecycleStatus back to ACTIVE if it was changed during the at-risk period.",
          },
          {
            key: "close-out-notes",
            name: "Record what worked for next time",
            kind: "TASK",
            description:
              "Write a short note on what the root cause was and what specifically fixed it. This is the single highest-leverage artifact for the next chapter that hits a similar pattern — recovery playbooks improve fastest when every case leaves a trace.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("diagnose", "Chapter needs support — diagnose root cause"),
      typedActionOnEnter("diagnose", "Pull health signals and talk to the chapter president", "RELATIONSHIP", 96),
      typedActionOnEnter("stabilize", "Address the chapter's specific risk signals", "OPERATIONS", 168),
      notifyOnEnter("rebuild-momentum", "Sustain recovery — confirm a second healthy cycle"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 4. Chapter Health Review — recurring checklist walkthrough
  // ==========================================================================
  {
    key: "chapter-health-review",
    name: "Chapter Health Review",
    description:
      "Purpose: a recurring, non-urgent walkthrough of a chapter's exact health signals (lib/chapters/health.ts) so problems get caught while they're still NEEDS_SUPPORT-sized, not after they've become an AT_RISK escalation. This is a checklist, not a crisis response — it's meant to run on a steady cadence for every operating chapter. " +
      "Typical duration: under a week (roughly 80-120 hours) per cycle — this should be a quick, routine pass, not a deep investigation. " +
      "Primary owner: the regional/national staff lead assigned to the chapter; secondary owner: the Chapter President, who should be part of the 'review with leadership' conversation. " +
      "Success definition: every signal in the health rubric has been pulled and reviewed with chapter leadership, and a documented outcome (healthy, watch, or escalate to chapter-recovery/chapter-intervention) is recorded with a next check-in date set. " +
      "KPIs: percentage of operating chapters reviewed on cadence (no chapter should go more than ~4-6 weeks without a review), number of issues caught at NEEDS_SUPPORT before they reach AT_RISK, and time-to-next-check-in consistency. " +
      "Common failure modes: health reviews get skipped for chapters that 'seem fine,' which is exactly how a slow drift (CP activity tapering off, meetings getting less frequent) goes unnoticed until it's a full AT_RISK escalation; reviews turn into a one-way status report instead of a real conversation with the CP, missing context the raw signals can't show; and the 'next check-in' step gets skipped, so the review doesn't actually recur. " +
      "Hard-won notes: the five signals (meeting cadence, CP activity, action backlog, launch-target pacing, membership count) are cheap to pull and genuinely predictive — running this review lightly but consistently catches more problems than any amount of reactive firefighting after a chapter is already AT_RISK.",
    domain: "CHAPTERS",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 720,
    escalateAfterHours: 168,
    stages: [
      {
        key: "pull-signals",
        name: "Pull Health Signals",
        description:
          "Walk the exact health.ts checklist for this chapter: meeting cadence, CP activity, action backlog, launch-target pacing (if still launching), and membership count. Done when every signal has a concrete current value, not an impression.",
        slaHours: 24,
        isInitial: true,
        steps: [
          {
            key: "meeting-cadence-check",
            name: "Check meeting cadence",
            kind: "TASK",
            dueOffsetHours: 8,
            description:
              "Pull lastMeetingAt and nextMeetingAt. Flag if the last meeting was more than 21 days ago (1 risk point) or more than 45 days ago (3 risk points), or if there's no upcoming meeting scheduled at all. This is usually the fastest signal to check and the earliest one to catch drift.",
          },
          {
            key: "cp-activity-check",
            name: "Check chapter president activity",
            kind: "TASK",
            dueOffsetHours: 8,
            description:
              "Pull daysSinceCpActivity. For an operating chapter, more than 21 days of CP inactivity is a risk signal; for a launching chapter the threshold is tighter (14 days), since launch momentum depends on the CP actively pushing the playbook forward.",
          },
          {
            key: "action-backlog-check",
            name: "Check overdue action item backlog",
            kind: "TASK",
            dueOffsetHours: 8,
            description:
              "Pull overdueActions. More than 2 overdue actions is a meaningful risk signal (2 points); 1-2 is a smaller flag (1 point). Look at what the overdue actions actually are, not just the count — a stack of trivial admin tasks reads differently than three overdue partner commitments.",
          },
          {
            key: "launch-pacing-check",
            name: "Check launch-target pacing (if launching)",
            kind: "TASK",
            dueOffsetHours: 8,
            description:
              "For chapters still in APPROVED/LAUNCHING, compare launchChecklistDone/Total against launchTargetDate. A passed launch target with an unfinished checklist is the single highest-weight launching-stage risk signal — if this is true, this review should escalate directly rather than wait for the next cycle.",
          },
          {
            key: "membership-count-check",
            name: "Check membership count",
            kind: "TASK",
            dueOffsetHours: 8,
            description:
              "Pull memberCount. Under 3 members is a meaningful risk signal (2 points), under 5 is a smaller flag (1 point). A chapter can look healthy on meetings and activity but still be fragile if it never grew past a handful of founding members.",
          },
        ],
      },
      {
        key: "review-with-leadership",
        name: "Review With Chapter Leadership",
        description:
          "Walk the pulled signals with the Chapter President in a real conversation — what's behind any flagged signal, and what (if anything) needs to change. Done when the CP has seen and responded to the findings, not just received a report.",
        slaHours: 72,
        steps: [
          {
            key: "share-findings",
            name: "Share findings with the chapter president",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Send the CP the concrete signal values, not a vague 'things look a little off' message. Specific numbers (e.g. 'last meeting was 28 days ago') give the CP something actionable to respond to instead of something to feel defensive about.",
          },
          {
            key: "discuss-flags",
            name: "Discuss any flagged signals",
            kind: "MEETING",
            dueOffsetHours: 72,
            description:
              "If any signal is flagged, have a short conversation about why and whether it needs more than a routine nudge. This is the moment to decide whether this stays a routine review or needs to escalate into chapter-recovery (steady remediation) or chapter-intervention (urgent, AT_RISK).",
          },
        ],
      },
      {
        key: "record-outcome",
        name: "Record Outcome & Next Check-in",
        description:
          "Log the review outcome and schedule the next one. Terminal stage — this blueprint instance closes here and a fresh instance starts at the next cadence (or chapter-recovery/chapter-intervention is started separately if the outcome warrants it).",
        isTerminal: true,
        steps: [
          {
            key: "record-outcome-step",
            name: "Record the review outcome",
            kind: "DECISION",
            description:
              "Classify the outcome plainly: healthy (no action), watch (minor flags, no formal recovery needed), or escalate (start chapter-recovery or, if genuinely urgent, chapter-intervention). Don't leave this implicit — a written outcome is what makes the review trail useful later.",
          },
          {
            key: "schedule-next-checkin",
            name: "Schedule the next check-in",
            kind: "TASK",
            description:
              "Set a concrete next review date — sooner if anything was flagged (2-3 weeks), standard cadence if the chapter is fully healthy (4-6 weeks). A review that doesn't schedule its own follow-up tends not to recur.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("pull-signals", "Chapter health review due — pull current signals"),
      typedActionOnEnter("pull-signals", "Pull chapter health signals", "OPERATIONS", 24),
      meetingOnEnter("review-with-leadership", "Review chapter health with the chapter president", "OFFICER", 72),
      notifyOnEnter("record-outcome", "Record health review outcome and next check-in"),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 5. Chapter Intervention — AT_RISK escalation, urgent
  // ==========================================================================
  {
    key: "chapter-intervention",
    name: "Chapter Intervention",
    description:
      "Purpose: an urgent, leadership-driven remediation when a chapter is formally AT_RISK — at risk of stalling out and needing intervention now, per the lifecycle definition. Unlike chapter-recovery's steady remediation pace, this blueprint assumes the chapter is in a genuine crisis state and moves fast: tight SLAs, low escalation threshold, and a board-visible outcome. " +
      "Typical duration: 1-2 weeks (roughly 120-200 hours) from trigger to a stabilized-or-escalated outcome — this should move quickly by design; if it's dragging past two weeks, that's itself a signal to escalate further. " +
      "Primary owner: national/regional leadership (defaultOwnerSubtype LEADERSHIP); secondary owners: the Chapter President (if still engaged) and, if the chapter doesn't stabilize, the board. " +
      "Success definition: either the chapter is stabilized (health signals trending back toward ON_TRACK with a credible plan in motion) or, if it can't be stabilized, the situation is formally escalated to the board with a clear recommendation (continued support, pause, or close) rather than left to drift. " +
      "KPIs: time from AT_RISK trigger to first leadership huddle (target under 48 hours), time to a documented root cause, time to an intervention plan with an owner, and final disposition (stabilized vs. escalated) recorded within the SLA window. " +
      "Common failure modes: the AT_RISK status gets set but nobody actually convenes the huddle because it's assumed someone else is handling it — this is exactly why the entity trigger auto-starts this workflow rather than relying on someone noticing the status change; the intervention plan is written but has no single named owner, so nothing actually executes; and leadership treats stabilization as binary ('the CP responded to one message, we're fine now') instead of confirming the underlying signals actually moved. " +
      "Hard-won notes: a chapter doesn't reach AT_RISK from one bad week — by the time the trigger fires, the underlying problem has usually been building for a month or more, so don't expect a single conversation to fix it; the highest-value first move is almost always a direct, human conversation with the CP within 48 hours, before any plan gets written.",
    domain: "CHAPTERS",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 48,
    escalateAfterHours: 72,
    initialStatus: "PUBLISHED",
    triggers: [{ event: "ENTITY_STATUS_CHANGED", subjectType: "CHAPTER", matchStatus: "AT_RISK" }],
    stages: [
      {
        key: "leadership-huddle",
        name: "Immediate Leadership Huddle",
        description:
          "Convene leadership within 48 hours of the AT_RISK trigger to acknowledge the situation and assign an owner. Done when a named leader owns this intervention and has reviewed the current health signals.",
        slaHours: 48,
        isInitial: true,
        steps: [
          {
            key: "convene-huddle",
            name: "Convene leadership huddle",
            kind: "MEETING",
            dueOffsetHours: 24,
            description:
              "Get the relevant leadership (regional lead at minimum, national staff if the chapter is high-profile or this is a repeat AT_RISK) together within 24 hours of the trigger firing. Don't wait for a 'normal' meeting slot — this is the entire reason the entity trigger exists, to force same-day attention rather than waiting for the next scheduled check-in.",
          },
          {
            key: "assign-owner",
            name: "Assign a single intervention owner",
            kind: "DECISION",
            dueOffsetHours: 24,
            description:
              "Name one person accountable for driving this intervention to a conclusion. Shared ownership across the huddle attendees is how interventions stall — someone needs to be the one chasing the plan day to day.",
          },
          {
            key: "pull-current-signals",
            name: "Pull current health signals",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Get the exact computeChapterHealth reasons before the huddle so the conversation starts from facts, not impressions. This mirrors chapter-health-review's signal pull but under time pressure — don't skip it just because the situation feels urgent.",
          },
        ],
      },
      {
        key: "root-cause-diagnosis",
        name: "Root-Cause Diagnosis",
        description:
          "Talk directly to the CP (and other chapter leadership if reachable) to understand the real cause, not just the symptom pattern. Done when there's a specific, named cause and an honest read on whether the CP is still engaged and able to drive recovery.",
        slaHours: 48,
        steps: [
          {
            key: "cp-direct-conversation",
            name: "Have a direct conversation with the chapter president",
            kind: "MEETING",
            dueOffsetHours: 48,
            description:
              "Reach the CP directly — phone or video, not just a portal message — within 48 hours. If the CP is unreachable, that itself is critical information about the chapter's state and should shape the intervention plan (e.g. toward a CP transition conversation rather than a support plan).",
          },
          {
            key: "assess-cp-capacity",
            name: "Assess whether the CP can still drive recovery",
            kind: "DECISION",
            dueOffsetHours: 48,
            description:
              "Be honest about whether the current CP has the time/capacity to lead the chapter back to health, versus needing interim support or a leadership change. This is an uncomfortable but necessary call — propping up a CP who is fundamentally overextended just delays the same crisis.",
          },
        ],
      },
      {
        key: "execute-intervention",
        name: "Intervention Plan Execution",
        description:
          "Execute a concrete, owned plan addressing the diagnosed root cause. Done when the plan's actions are actually complete, not just written down.",
        slaHours: 72,
        steps: [
          {
            key: "write-intervention-plan",
            name: "Write the intervention plan",
            kind: "DOCUMENT",
            dueOffsetHours: 24,
            description:
              "Write specific, owned actions tied to the diagnosed cause — not a generic 'increase support' plan. If the cause is an inactive CP, the plan might be temporary co-leadership; if it's a partner relationship collapse, the plan might be emergency partner outreach. Match the plan to the actual diagnosis from the previous stage.",
          },
          {
            key: "execute-actions",
            name: "Execute the plan's actions",
            kind: "TASK",
            dueOffsetHours: 72,
            description:
              "Drive the plan's specific actions to completion within the week — this is intervention, not a long-term recovery cadence. If an action can't realistically complete this fast, that's a sign the situation may need the slower chapter-recovery process instead, or board escalation.",
          },
        ],
      },
      {
        key: "stabilized-or-escalated",
        name: "Stabilized or Escalated to Board",
        description:
          "Final disposition: either the chapter is genuinely stabilizing and can move to the normal chapter-recovery cadence, or it isn't and the situation goes to the board with a clear recommendation. Terminal stage either way.",
        isTerminal: true,
        steps: [
          {
            key: "assess-stabilization",
            name: "Assess whether the chapter has stabilized",
            kind: "DECISION",
            description:
              "Check the health signals again, not just whether the plan's tasks got checked off. Stabilization means the signals are genuinely trending back (a meeting held, CP responsive, action backlog shrinking) — not just that the intervention week is over.",
          },
          {
            key: "board-escalation-or-handoff",
            name: "Escalate to board or hand off to chapter-recovery",
            kind: "DECISION",
            description:
              "If stabilized, hand off to the standard chapter-recovery cadence to confirm it sticks. If not stabilized, escalate to the board with a clear recommendation (continued intensive support, pause, or close) — don't let an unresolved AT_RISK chapter simply fall off everyone's radar once this workflow instance completes.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("leadership-huddle", "Chapter is AT RISK — convene leadership within 48 hours"),
      typedActionOnEnter("leadership-huddle", "Convene huddle and assign an intervention owner", "OPERATIONS", 24),
      typedActionOnEnter("root-cause-diagnosis", "Have a direct conversation with the chapter president", "RELATIONSHIP", 48),
      notifyOnEnter("execute-intervention", "Execute the intervention plan this week"),
      typedActionOnEnter("execute-intervention", "Execute intervention plan actions", "OPERATIONS", 72),
      notifyOnEnter("stabilized-or-escalated", "Record intervention outcome — stabilized or escalate to board"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 6. Chapter Expansion — new cohort/partner on an ACTIVE chapter
  // ==========================================================================
  {
    key: "chapter-expansion",
    name: "Chapter Expansion",
    description:
      "Purpose: add a second program, class cohort, or partner relationship to an already-ACTIVE, stable chapter — distinct from chapter-launch, which stands up the very first cohort. Expansion assumes existing operating infrastructure (a CP, a meeting cadence, at least one running class) and focuses narrowly on what's net-new. " +
      "Typical duration: 4-6 weeks (roughly 500-650 hours) from scoping to the new cohort going live, faster than a full launch since the chapter's foundational infrastructure already exists. " +
      "Primary owner: the Chapter President; secondary owners: the new cohort's instructor(s) and, if a new partner is involved, that partner's point of contact. " +
      "Success definition: the new cohort/partner is live with its own enrollment and at least one session held, without disrupting the existing cohort's operations. " +
      "KPIs: new-cohort enrollment vs. target, time from scoping decision to live class, and whether the existing (first) cohort's health signals stayed stable through the expansion (a common failure mode is the CP's attention shifting entirely to the new cohort at the existing one's expense). " +
      "Common failure modes: expansion gets scoped as 'just like the first launch' without checking whether the chapter actually has the bandwidth (CP time, instructor capacity, partner relationship) to support two cohorts at once; a new partner relationship gets verbally agreed but never gets the same written-logistics rigor the original launch required, because it feels lower-stakes the second time; and the existing cohort's health quietly degrades during expansion because nobody is watching it while attention is on the new one. " +
      "Hard-won notes: expansion succeeds or fails on capacity honesty — ask explicitly whether the CP and existing instructors can actually absorb a second cohort before scoping it, since the instinct to expand on momentum alone (without capacity to match) is what turns a healthy chapter into a NEEDS_SUPPORT one within a semester.",
    domain: "CHAPTERS",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 168,
    escalateAfterHours: 336,
    stages: [
      {
        key: "scope-expansion",
        name: "Scope the Expansion",
        description:
          "Decide what's actually expanding (new cohort, new partner, both) and confirm the chapter has real capacity to support it without degrading existing operations. Done when there's a written scope and an honest capacity check.",
        slaHours: 168,
        isInitial: true,
        steps: [
          {
            key: "define-scope",
            name: "Define what's expanding",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Write down specifically what's being added — a second class cohort with the existing partner, a brand-new partner relationship, or both. A vague 'let's grow' goal without a specific scope makes the buildout stage impossible to plan against.",
          },
          {
            key: "capacity-check",
            name: "Check chapter capacity honestly",
            kind: "DECISION",
            dueOffsetHours: 96,
            description:
              "Confirm the CP, existing instructors, and the existing partner relationship can absorb the added load — be explicit about hours, not just enthusiasm. The most common reason expansion backfires is skipping this check because the chapter is riding high on existing success.",
          },
          {
            key: "check-existing-health",
            name: "Confirm the existing cohort's health is stable",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "Pull the chapter's current health signals before committing to expansion — don't add a second cohort onto a chapter that's already showing NEEDS_SUPPORT signals on the first one. If the existing cohort isn't stable, fix that first.",
          },
        ],
      },
      {
        key: "build-out",
        name: "Build Out",
        description:
          "Staff, partner, and curriculum work for the new cohort — the same rigor as the original launch's buildout stage, scoped to just what's new. Done when the new cohort has an instructor, a partner/logistics arrangement, and approved curriculum.",
        slaHours: 504,
        steps: [
          {
            key: "staff-new-cohort",
            name: "Staff the new cohort",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "Recruit or reassign an instructor for the new cohort through the standard recruiting flow. Don't assume an existing instructor can simply absorb a second cohort on top of their current one without checking their actual availability first.",
          },
          {
            key: "confirm-partner-logistics",
            name: "Confirm partner/logistics for the new cohort",
            kind: "DOCUMENT",
            dueOffsetHours: 336,
            description:
              "If this is a new partner, get logistics locked in writing with the same rigor as a first launch (room, times, supervision) — don't treat it as lower-stakes just because the chapter already has one successful partner relationship. If it's the same partner hosting a second cohort, confirm in writing that the existing arrangement actually has room for it (same room/time conflicts are the most common surprise).",
          },
          {
            key: "approve-curriculum",
            name: "Approve curriculum for the new cohort",
            kind: "APPROVAL",
            dueOffsetHours: 504,
            description:
              "Run the new cohort's curriculum through the standard CP review. A new cohort with a different instructor often means genuinely new curriculum, not a copy of the first — review it on its own merits.",
          },
        ],
      },
      {
        key: "live",
        name: "Live",
        description:
          "The new cohort/partner is live and running. Terminal stage — done when the new cohort has held its first session and the original cohort's health is confirmed unaffected.",
        isTerminal: true,
        steps: [
          {
            key: "first-session-new-cohort",
            name: "Run first session of the new cohort",
            kind: "TASK",
            description:
              "Hold the first session and confirm it actually happened as planned. Treat this with the same attention as a first-ever chapter launch — a rocky first session for cohort two can sour a new partner relationship just as easily as it could during the original launch.",
          },
          {
            key: "confirm-no-regression",
            name: "Confirm the original cohort is unaffected",
            kind: "TASK",
            description:
              "Re-check the existing cohort's health signals after expansion goes live. If attention on the new cohort caused the original one's meeting cadence or attendance tracking to slip, address it immediately rather than letting two cohorts' problems compound.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("scope-expansion", "Chapter expansion proposed — scope and check capacity"),
      typedActionOnEnter("scope-expansion", "Define expansion scope and confirm chapter capacity", "OPERATIONS", 168),
      typedActionOnEnter("build-out", "Staff and confirm logistics for the new cohort", "CLASS_PLANNING", 336),
      notifyOnEnter("live", "New cohort live — confirm first session and original cohort health"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 7. Chapter Closeout — PAUSED/ALUMNI transition
  // ==========================================================================
  {
    key: "chapter-closeout",
    name: "Chapter Closeout",
    description:
      "Purpose: handle a chapter's transition to PAUSED (temporarily inactive, e.g. summer break, by agreement) or ALUMNI (closed/graduated, kept for history and impact totals) cleanly — archiving data, notifying every affected stakeholder, and preserving the chapter's impact history rather than letting it just go quiet. " +
      "Typical duration: 1-3 weeks (roughly 150-250 hours), mostly notification lead time and a clean handoff rather than heavy operational work. " +
      "Primary owner: the regional/national staff lead handling the closeout; secondary owners: the outgoing Chapter President (if still active) and the partner organization's point of contact. " +
      "Success definition: every affected stakeholder (students, instructors, partner) is notified with enough lead time to plan around it, the chapter's historical data and impact totals are preserved and accessible, and the lifecycleStatus accurately reflects PAUSED vs. ALUMNI (these are not interchangeable — PAUSED implies a return is expected). " +
      "KPIs: stakeholder notification lead time (target 2+ weeks before the effective date where possible), completeness of archived records (attendance, impact totals, curriculum), and — for PAUSED chapters specifically — whether a return/reactivation plan with a target date exists. " +
      "Common failure modes: a chapter quietly stops operating with no formal status change, so it sits in ACTIVE/AT_RISK showing as a problem chapter indefinitely instead of being correctly marked PAUSED or ALUMNI; students and instructors find out a chapter is closing informally/last-minute rather than through a planned notification, damaging trust; and impact history (sessions run, students served) isn't preserved before data access changes, losing the chapter's track record for alumni/impact reporting. " +
      "Hard-won notes: closeout is not a failure to be hidden — a chapter that closes cleanly with good notice and preserved history is a far better outcome than one that limps along AT_RISK for two years, so don't let the team's reluctance to 'give up' on a chapter delay a closeout decision that's already obviously right.",
    domain: "CHAPTERS",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 96,
    escalateAfterHours: 336,
    stages: [
      {
        key: "decision-notification",
        name: "Decision & Notification",
        description:
          "Confirm the closeout decision (PAUSED vs. ALUMNI) and notify every affected stakeholder with real lead time. Done when the decision is documented and notifications are sent, not just planned.",
        slaHours: 168,
        isInitial: true,
        steps: [
          {
            key: "confirm-pause-vs-alumni",
            name: "Confirm PAUSED vs. ALUMNI",
            kind: "DECISION",
            dueOffsetHours: 24,
            description:
              "Decide explicitly which status applies — PAUSED means a planned return (e.g. summer break, a gap semester with intent to relaunch); ALUMNI means closed/graduated permanently. Setting the wrong one misleads anyone reading the chapter's status later, including future leadership deciding whether to invest in reactivation outreach.",
          },
          {
            key: "notify-students",
            name: "Notify students and families",
            kind: "TASK",
            dueOffsetHours: 96,
            description:
              "Give students and families clear, early notice of the closure or pause, including what (if anything) happens to in-progress classes. Last-minute notification is the single biggest source of complaints in a closeout — aim for at least two weeks of lead time wherever the timeline allows it.",
          },
          {
            key: "notify-instructors",
            name: "Notify instructors",
            kind: "TASK",
            dueOffsetHours: 96,
            description:
              "Tell instructors directly, not just through a general announcement — they need to know whether this affects their compensation, their ability to be reassigned to another chapter, and any final-session logistics.",
          },
          {
            key: "notify-partner",
            name: "Notify the partner organization",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "Notify the partner school/organization formally, ideally from the CP or a regional lead rather than left implicit. Preserving this relationship matters even on closeout — a partner that's treated well on the way out is far more likely to welcome a relaunch later.",
          },
        ],
      },
      {
        key: "archive-handoff",
        name: "Archive & Handoff",
        description:
          "Preserve the chapter's operating history and impact totals, and hand off any loose threads (open actions, pending decisions) before access patterns change. Done when the historical record is complete and nothing is left dangling.",
        slaHours: 168,
        steps: [
          {
            key: "archive-impact-data",
            name: "Archive impact totals and session history",
            kind: "DOCUMENT",
            dueOffsetHours: 96,
            description:
              "Confirm attendance records, sessions run, and students served are preserved and will remain visible in impact reporting after closeout. This data is what lets the chapter's contribution count toward YPP's overall impact totals even after it stops actively operating — don't let it become inaccessible.",
          },
          {
            key: "close-open-actions",
            name: "Resolve or reassign open action items",
            kind: "TASK",
            dueOffsetHours: 120,
            description:
              "Go through the chapter's open action items and either close them out or reassign anything that genuinely needs to continue (e.g. a partner relationship that should transfer to a regional lead). Don't let a closeout leave a trail of orphaned, permanently-overdue actions.",
          },
          {
            key: "transition-cp",
            name: "Confirm chapter president's transition",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "Confirm what happens to the outgoing CP — alumni recognition, a reference for their work, or (for a PAUSED chapter expecting to relaunch) their intended role if and when it reopens. This is also the moment to thank them; closeouts that skip this tend to lose a chapter's best advocate for any future relaunch.",
          },
        ],
      },
      {
        key: "closed",
        name: "Closed",
        description:
          "The chapter's lifecycleStatus is set and the closeout is complete. Terminal stage.",
        isTerminal: true,
        steps: [
          {
            key: "set-final-status",
            name: "Set final lifecycle status",
            kind: "TASK",
            description:
              "Set lifecycleStatus to PAUSED or ALUMNI per the earlier decision, with lifecycleNote capturing the reason and (for PAUSED) any target return date. This is the field leadership's chapter command center filters on, so accuracy here matters for anyone scanning chapter status later.",
          },
          {
            key: "final-confirmation",
            name: "Confirm all notifications and archiving complete",
            kind: "DECISION",
            description:
              "Do a final check that every stakeholder was notified and all records archived before marking this closeout complete. This is the last checkpoint before the chapter effectively goes quiet — don't skip it because the hard decisions already feel resolved.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("decision-notification", "Chapter closeout started — confirm status and notify stakeholders"),
      typedActionOnEnter("decision-notification", "Notify students, instructors, and partner of closeout", "EMAIL", 168),
      typedActionOnEnter("archive-handoff", "Archive impact data and resolve open actions", "ADMIN_TASK", 168),
      notifyOnEnter("closed", "Chapter closeout complete"),
      escalateOverdue(),
    ],
  },

  // ==========================================================================
  // 8. Semester Reset — between-semester operational reset
  // ==========================================================================
  {
    key: "semester-reset",
    name: "Semester Reset",
    description:
      "Purpose: the between-semester operational reset for an already-ACTIVE chapter — wrap up the finishing semester's classes, re-enroll/refresh students, and re-publish classes for the new semester. Conceptually mirrors the ClassOfferingStatus lifecycle (DRAFT → PUBLISHED → IN_PROGRESS → COMPLETED → CANCELLED): completed classes get properly closed out and a fresh round gets drafted and republished rather than silently carried over. " +
      "Typical duration: 2-3 weeks (roughly 200-300 hours), timed to the gap between semesters/sessions so the new semester is ready to go on day one rather than scrambling in week one like a fresh launch would. " +
      "Primary owner: the Chapter President; secondary owners: returning instructors and the partner point of contact, both of whom need to reconfirm for the new semester. " +
      "Success definition: the prior semester's classes are formally marked COMPLETED with attendance/feedback captured, and the new semester's classes are drafted, approved, and PUBLISHED with instructors and partner logistics reconfirmed before the new semester's first session. " +
      "KPIs: percentage of prior-semester classes properly closed out (COMPLETED, not left dangling IN_PROGRESS), instructor return-confirmation rate, days between old semester wrap and new semester publish (minimize the gap), and new-semester enrollment vs. prior semester (a meaningful drop is worth investigating, not just accepting). " +
      "Common failure modes: a class lingers in IN_PROGRESS status long after the semester actually ended because nobody marked it COMPLETED, which corrupts readiness/attendance reporting for the next cycle; the chapter assumes all instructors are returning without actually reconfirming, then discovers a gap the week before the new semester starts; and partner logistics from last semester get carried over unchecked, missing a schedule or room change the partner already made for the new term. " +
      "Hard-won notes: treat semester reset with almost as much rigor as a first launch, just compressed — the chapters that skip the reconfirmation steps because 'we did this last semester' are the ones that get blindsided by an instructor who quietly didn't plan to return or a partner room that's no longer available.",
    domain: "CHAPTERS",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 96,
    escalateAfterHours: 240,
    stages: [
      {
        key: "wrap-prior-semester",
        name: "Wrap Prior Semester",
        description:
          "Close out the finishing semester's classes properly — mark them COMPLETED, capture final attendance and feedback, and run a session review. Done when nothing from the prior semester is left in an ambiguous IN_PROGRESS state.",
        slaHours: 96,
        isInitial: true,
        steps: [
          {
            key: "mark-classes-completed",
            name: "Mark finishing classes COMPLETED",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Move every class that actually finished from IN_PROGRESS to COMPLETED. A class left sitting in IN_PROGRESS after its last session has run quietly breaks readiness and reporting views for the next semester's planning — don't let this slide.",
          },
          {
            key: "capture-final-attendance",
            name: "Capture final attendance and feedback",
            kind: "TASK",
            dueOffsetHours: 72,
            description:
              "Make sure the last sessions' attendance is recorded and a feedback pass goes out to students/parents before the semester is fully closed. Feedback collected right at the end of a semester response-rates far better than feedback solicited weeks later after the new semester has already started.",
          },
          {
            key: "session-review",
            name: "Run a session review",
            kind: "MEETING",
            dueOffsetHours: 96,
            description:
              "Hold a short review with the CP and instructors: what went well, what didn't, what changes for next semester. This is the same review step the original launch playbook expects in weeks 11-12 — reuse it every semester, not just the first one.",
          },
        ],
      },
      {
        key: "reset-republish",
        name: "Reset & Re-publish",
        description:
          "Reconfirm instructors and partner logistics, draft the new semester's classes, and publish them. Done when new-semester classes are PUBLISHED with instructors and partner arrangements confirmed in writing.",
        slaHours: 240,
        steps: [
          {
            key: "confirm-returning-instructors",
            name: "Confirm returning instructors",
            kind: "TASK",
            dueOffsetHours: 96,
            description:
              "Get an explicit yes/no from each instructor about returning for the new semester — don't assume based on last semester's enthusiasm. Anyone not returning needs to be replaced through the standard recruiting flow with enough lead time before the new semester starts.",
          },
          {
            key: "reconfirm-partner-logistics",
            name: "Reconfirm partner logistics for the new semester",
            kind: "DOCUMENT",
            dueOffsetHours: 168,
            description:
              "Re-verify room, times, and supervision with the partner in writing rather than assuming last semester's arrangement carries forward unchanged. Partners' own schedules shift between semesters (new school-year room assignments, staffing changes) more often than chapters expect.",
          },
          {
            key: "draft-new-classes",
            name: "Draft new-semester classes",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "Create the new semester's classes in DRAFT status with updated curriculum, schedule, and instructor assignments. Starting from a clean draft (even if heavily copied from last semester) keeps the class record accurate rather than just relabeling the old one.",
          },
          {
            key: "publish-new-classes",
            name: "Publish new-semester classes",
            kind: "TASK",
            dueOffsetHours: 240,
            description:
              "Move the new semester's classes from DRAFT to PUBLISHED with enough lead time for students to re-enroll or new students to find them. Publishing the week the semester starts is too late — aim for at least two weeks of enrollment lead time.",
          },
        ],
      },
      {
        key: "new-semester-live",
        name: "New Semester Live",
        description:
          "The new semester's classes are running. Terminal stage — done when the first session of the new semester has actually been held.",
        isTerminal: true,
        steps: [
          {
            key: "first-session-new-semester",
            name: "Run first session of the new semester",
            kind: "TASK",
            description:
              "Confirm the new semester's first session actually happened as scheduled, with the reconfirmed instructor and partner logistics holding up in practice. Treat any first-session hiccup as an early signal worth addressing immediately, the same way a first-ever launch would.",
          },
          {
            key: "compare-enrollment",
            name: "Compare enrollment to prior semester",
            kind: "TASK",
            description:
              "Check new-semester enrollment against the prior semester's numbers. A meaningful drop is worth investigating (advertising lead time, returning-student retention) rather than just accepted as normal seasonal variation.",
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("wrap-prior-semester", "Semester ending — wrap up classes and capture feedback"),
      typedActionOnEnter("wrap-prior-semester", "Mark finishing classes complete and capture feedback", "OPERATIONS", 96),
      notifyOnEnter("reset-republish", "Reconfirm instructors and partner, then re-publish classes"),
      typedActionOnEnter("reset-republish", "Reconfirm instructors and partner logistics for new semester", "CLASS_PLANNING", 168),
      notifyOnEnter("new-semester-live", "New semester live — confirm first session and enrollment"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },
];
