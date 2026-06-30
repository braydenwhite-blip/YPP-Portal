// ============================================================================
// Universal Workflow Engine — blueprint catalog: Leadership
// ============================================================================
//
// Chapter President onboarding, officer/VP onboarding, leadership transitions,
// and the recurring + periodic leadership review cadences. All new in this
// pass — there was no prior "leadership" domain blueprint. Grounded in
// docs/brayden/chapter-os-runbook.md (chapter hiring/decision flow),
// docs/EXECUTION_OS.md (the Triage -> Meetings -> Entity health -> Decisions
// -> Wrap-up weekly rhythm), docs/STRATEGIC_INITIATIVES.md (KPI/health
// language), docs/LEADERSHIP_ACTION_CENTER.md, and
// docs/people-strategy-operating-system-plan.md.
//
// chapter-president-onboarding is the deliberate exception that ships with a
// real ENTITY_STATUS_CHANGED trigger (CHAPTER_PRESIDENT_APPLICATION ->
// ONBOARDING). Per the authoring brief, every blueprint here omits
// `initialStatus` — the seed call publishes the catalog, so the trigger is
// live without any blueprint-level override.

import {
  actionOnEnter,
  autoAdvanceWhenReady,
  escalateOverdue,
  meetingOnEnter,
  notifyOnEnter,
  typedActionOnEnter,
} from "./helpers";
import type { WorkflowBlueprint } from "./types";

export const LEADERSHIP_BLUEPRINTS: WorkflowBlueprint[] = [
  // ==========================================================================
  // 1. Chapter President Onboarding — the flagship example
  // ==========================================================================
  {
    key: "chapter-president-onboarding",
    name: "Chapter President Onboarding",
    description:
      "Ramps a newly accepted Chapter President from offer acceptance to a confirmed, " +
      "on-track chapter leader. Purpose: a CP who is left to self-orient after acceptance " +
      "is the single biggest predictor of a chapter stalling in its first quarter — this " +
      "blueprint exists so the org, not just the new CP, drives the first 30/60/90 days. " +
      "It runs the operational half of onboarding (portal access, the Week 1 meeting, the " +
      "action packet, the 30/60/90 check-ins); the CP's own self-serve checklist (met team, " +
      "set chapter goals, reviewed resources, sent intro message) is a separate, lightweight " +
      "system this blueprint complements rather than replaces. Typical duration is about 13 " +
      "weeks (roughly 2,200 hours) end to end: 2 days to confirm acceptance and assign an " +
      "owner, 3 days for welcome materials and portal access, a week to schedule and hold " +
      "the Week 1 kickoff meeting, 5 days to deliver and confirm the action packet, then a " +
      "ramp through the 30/60/90-day check-ins before the chapter is marked on track. Primary " +
      "owner is the assigned Leadership officer (defaultOwnerSubtype LEADERSHIP); secondary " +
      "owners are the Admin who provisions access and materials and the VP of Chapters who " +
      "co-leads the Week 1 meeting and signs off at each check-in. Success looks like: portal " +
      "access and the welcome packet delivered before the CP's first login attempt, the Week 1 " +
      "meeting held within 7 days of acceptance with notes and next steps captured the same " +
      "day, a written action packet the CP can restate in their own words, first 30-day goals " +
      "that are specific and chapter-scoped (not copy-pasted boilerplate), and three on-time " +
      "check-ins (30/60/90) each ending in an explicit on-track or at-risk call. KPIs: days " +
      "from acceptance to portal access granted, days from acceptance to Week 1 meeting held, " +
      "percentage of CPs with a completed action packet acknowledgment by day 10, and 90-day " +
      "on-track rate across the chapter network. The most common failure mode is the welcome " +
      "packet and portal access getting created as a task but never actually verified — the " +
      "admin checks the box without confirming the CP can log in, and the gap surfaces three " +
      "weeks later as a missed deadline that was never the CP's fault. The second most common " +
      "failure is treating the Week 1 meeting as a formality and skipping structured notes, " +
      "which means the 30-day check-in has nothing concrete to check in against. Hard-won " +
      "note for future leaders: a CP's first 7 days set the tone for their whole tenure — if " +
      "leadership is responsive and organized in week one, CPs mirror that discipline with " +
      "their own instructors and mentors all year; if week one is chaotic, that chaos becomes " +
      "the chapter's operating culture. Always hold the Week 1 meeting live (not async over " +
      "email) even when the agenda feels redundant with the welcome materials.",
    domain: "LEADERSHIP",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 168,
    escalateAfterHours: 120,
    triggers: [
      { event: "ENTITY_STATUS_CHANGED", subjectType: "CHAPTER_PRESIDENT_APPLICATION", matchStatus: "ONBOARDING" },
    ],
    stages: [
      {
        key: "accepted",
        name: "Accepted & Assigned",
        description:
          "The CP application has flipped to ONBOARDING; this stage confirms the acceptance is " +
          "real, assigns a leadership owner, and confirms the chapter record the CP will lead. " +
          "Done when an owner is assigned and the chapter assignment is verified correct.",
        slaHours: 48,
        isInitial: true,
        steps: [
          {
            key: "confirm-acceptance",
            name: "Confirm acceptance & chapter assignment",
            description:
              "Verify the application's chapter assignment matches the chapter the CP actually " +
              "interviewed for and that no other CP is currently active on that chapter record. " +
              "The most common mistake is assuming the system-recorded chapter is correct without " +
              "cross-checking the interview notes — chapter mapping errors caught here take five " +
              "minutes to fix; caught after Week 1 they require redoing the welcome packet. Tip: " +
              "open the chapter record side by side with the application before confirming.",
            kind: "APPROVAL",
            dueOffsetHours: 24,
          },
          {
            key: "assign-owner",
            name: "Assign leadership owner",
            description:
              "Name the specific Leadership-subtype officer who will own this CP's onboarding end " +
              "to end — not just 'someone on the team'. The common failure is leaving the owner as " +
              "a department-level default, which means no single person feels accountable when the " +
              "Week 1 meeting slips. Tip: assign the same owner who will run the 30/60/90 check-ins " +
              "so the CP has one consistent point of contact.",
            dueOffsetHours: 48,
          },
        ],
      },
      {
        key: "welcome-setup",
        name: "Welcome & Setup",
        description:
          "Admin provisions portal access, sends the welcome packet, and the CP completes initial " +
          "profile setup. Done when the CP has successfully logged in and their profile is complete.",
        slaHours: 72,
        steps: [
          {
            key: "portal-access",
            name: "Provision portal access",
            description:
              "Grant the CHAPTER_PRESIDENT role and confirm the account is linked to the correct " +
              "chapter before sending credentials. The most common mistake is sending the welcome " +
              "email before the role grant has actually propagated, so the CP's first login hits a " +
              "permissions wall and they assume the portal is broken. Tip: log in as a test or ask " +
              "the CP to confirm their first successful login in the same message thread.",
            kind: "TASK",
            dueOffsetHours: 24,
          },
          {
            key: "welcome-packet",
            name: "Create and send welcome packet",
            description:
              "Assemble the welcome packet (chapter overview, key contacts, portal walkthrough, " +
              "first-week expectations) and send it directly to the CP, not just drop it in a shared " +
              "drive. The common mistake is reusing a stale packet template from a prior cohort that " +
              "still references retired routes or contacts. Tip: skim the packet for any '/admin' or " +
              "contact-name reference older than two quarters before sending.",
            kind: "DOCUMENT",
            dueOffsetHours: 48,
          },
          {
            key: "profile-setup",
            name: "Confirm CP profile setup",
            description:
              "Have the CP complete their portal profile (photo, bio, contact preferences) so they " +
              "are visible and reachable to their chapter's instructors and mentors from day one. The " +
              "common mistake is treating this as optional polish; an incomplete profile is often the " +
              "first thing a new instructor notices and reads as disorganization. Tip: include a " +
              "direct profile-edit link in the welcome packet rather than expecting the CP to find it.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "week1-kickoff",
        name: "Week 1 Kickoff",
        description:
          "Schedule and hold the structured Week 1 meeting with the CP, capture notes and next " +
          "steps the same day. Done when the meeting has occurred and notes/actions are logged.",
        slaHours: 168,
        steps: [
          {
            key: "schedule-meeting",
            name: "Schedule Week 1 kickoff meeting",
            description:
              "Get a Week 1 meeting on the calendar with the CP and the VP of Chapters within the " +
              "first 7 days of acceptance — waiting for the CP to propose a time is the most common " +
              "reason this slips past day 10. Tip: send two or three concrete time options rather " +
              "than an open-ended 'when works for you'.",
            dueOffsetHours: 24,
          },
          {
            key: "pre-meeting-checklist",
            name: "Complete pre-meeting checklist",
            description:
              "Before the meeting, confirm the CP has received the welcome packet, has working " +
              "portal access, and has a draft list of chapter-specific questions. The common mistake " +
              "is walking into the Week 1 meeting having only confirmed logistics, not substance — " +
              "the meeting then becomes an access-troubleshooting session instead of a real kickoff. " +
              "Tip: send a short pre-read the day before so the meeting starts from shared context.",
            dueOffsetHours: 144,
          },
          {
            key: "hold-meeting",
            name: "Hold Week 1 kickoff meeting",
            description:
              "Run the meeting live, covering chapter context, expectations, and immediate priorities. " +
              "The most common mistake is letting this become a one-way briefing; the meeting should " +
              "surface the CP's own read on their chapter's strengths and risks, not just transmit " +
              "information at them. Tip: end the meeting by having the CP restate the top three " +
              "priorities in their own words.",
            kind: "MEETING",
            dueOffsetHours: 168,
          },
          {
            key: "capture-notes",
            name: "Capture meeting notes & next actions",
            description:
              "Log structured notes and concrete next actions from the meeting the same day, while " +
              "details are fresh. The common failure is letting notes wait until end of week, by " +
              "which point specifics blur into generic recollections that are useless for the 30-day " +
              "check-in. Tip: capture next actions as discrete, assignable items, not a paragraph of " +
              "prose.",
            dueOffsetHours: 168,
          },
        ],
      },
      {
        key: "action-packet",
        name: "Action Packet",
        description:
          "Share the action packet derived from the kickoff meeting, confirm the CP understands it, " +
          "and lock in first 30-day goals. Done when the CP has acknowledged the packet and goals are " +
          "recorded.",
        slaHours: 120,
        steps: [
          {
            key: "share-packet",
            name: "Share action packet with CP",
            description:
              "Turn the Week 1 meeting's next actions into a single action packet document and send " +
              "it to the CP directly. The common mistake is letting this packet drift from what was " +
              "actually discussed in the meeting — copy from the captured notes, don't reconstruct " +
              "from memory days later. Tip: send it within 48 hours of the meeting while the CP still " +
              "remembers the conversation that produced it.",
            kind: "DOCUMENT",
            dueOffsetHours: 48,
          },
          {
            key: "confirm-understanding",
            name: "Confirm CP understanding of packet",
            description:
              "Get an explicit acknowledgment from the CP — a reply, a checked box, a quick call — " +
              "that they understand every item in the packet, not just silence implying agreement. " +
              "The common mistake is treating a lack of questions as confirmation of understanding; " +
              "many new CPs won't ask clarifying questions unprompted. Tip: ask the CP to name the " +
              "single item in the packet they're least clear on.",
            kind: "APPROVAL",
            dueOffsetHours: 96,
          },
          {
            key: "set-30day-goals",
            name: "Set first 30-day goals",
            description:
              "Work with the CP to set two or three specific, chapter-scoped 30-day goals (not " +
              "generic 'build relationships with instructors' boilerplate). The common mistake is " +
              "letting the CP set goals alone without a sanity check against what's actually " +
              "achievable in their chapter's current state. Tip: anchor each goal to something " +
              "measurable the 30-day check-in can directly evaluate.",
            dueOffsetHours: 120,
          },
        ],
      },
      {
        key: "on-track",
        name: "On Track",
        description:
          "Run the 30/60/90-day check-ins and confirm the chapter is on a stable footing. Done — and " +
          "the workflow closes — once the 90-day check-in records an on-track status.",
        slaHours: 2160,
        isTerminal: true,
        steps: [
          {
            key: "checkin-30",
            name: "30-day check-in",
            description:
              "Review progress against the 30-day goals set in the action packet stage and record an " +
              "explicit on-track or at-risk call. The common mistake is letting this check-in become " +
              "purely conversational with no written outcome, which leaves nothing to compare against " +
              "at day 60. Tip: reuse the exact goal wording from the action packet so progress is " +
              "directly comparable, not reinterpreted.",
            kind: "APPROVAL",
            dueOffsetHours: 720,
          },
          {
            key: "checkin-60",
            name: "60-day check-in",
            description:
              "Check progress on any goals adjusted at day 30 and surface emerging risks before they " +
              "become entrenched chapter problems. The common mistake is skipping this check-in when " +
              "the 30-day call was positive — chapters that look fine at day 30 can still drift by " +
              "day 60 without anyone watching. Tip: ask specifically about instructor and mentor " +
              "relationships, which is where early strain usually shows first.",
            kind: "APPROVAL",
            dueOffsetHours: 1440,
          },
          {
            key: "checkin-90",
            name: "90-day check-in & on-track confirmation",
            description:
              "Make the final call on whether the chapter is on track, and if not, route to the " +
              "leadership-transition-offboarding or a renewed support plan rather than letting the " +
              "chapter drift unmanaged. The common mistake is treating day 90 as a formality once the " +
              "first two check-ins were positive; this is the gate that should catch slow-burning " +
              "issues the earlier check-ins missed. Tip: compare the chapter's current state directly " +
              "against the original action packet, not against general impressions.",
            kind: "DECISION",
            dueOffsetHours: 2160,
          },
        ],
      },
    ],
    automations: [
      notifyOnEnter("accepted", "Chapter President application accepted — onboarding started"),
      typedActionOnEnter("welcome-setup", "Provision portal access and send welcome packet", "OPERATIONS", 48),
      meetingOnEnter("week1-kickoff", "Chapter President Week 1 kickoff", "OFFICER", 168),
      typedActionOnEnter("week1-kickoff", "Schedule and prep the Week 1 kickoff meeting", "MEETING_PREP", 24),
      notifyOnEnter("action-packet", "Action packet ready for Chapter President review"),
      typedActionOnEnter("action-packet", "Confirm CP understanding and set 30-day goals", "FOLLOW_UP", 96),
      notifyOnEnter("on-track", "Chapter President onboarding entering 30/60/90-day check-ins"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 2. Leadership / Officer Onboarding — generalized for any other officer role
  // ==========================================================================
  {
    key: "leadership-onboarding",
    name: "Leadership / Officer Onboarding",
    description:
      "Onboards any officer-tier leader who is not a Chapter President — a VP, a department " +
      "lead, a new Admin subtype hire — through access, role briefing, a first deliverable, " +
      "and confirmed-active status. Purpose: officer roles vary widely (VP of Chapters, VP of " +
      "Instruction, a new HIRING_ADMIN or MENTORSHIP_ADMIN) but there is no separate database " +
      "entity per title, so this blueprint is intentionally role-parameterized — the actual " +
      "role and scope are carried by the instance's own owner (set defaultOwnerRole or " +
      "defaultOwnerSubtype at install time, or override per-instance) rather than forked into " +
      "one blueprint per officer title. Typical duration is about 3 weeks (roughly 480 hours): " +
      "2 days for access and welcome, 5 days for role briefing and shadowing, a week to " +
      "complete a first deliverable, then a short ramp to confirmed-active. Primary owner is " +
      "the hiring/assigning STAFF or ADMIN lead for that role; secondary owner is the outgoing " +
      "or adjacent officer who runs the shadowing sessions. Success looks like: the new officer " +
      "can name their department's top three open items unprompted by the end of the briefing " +
      "stage, the first deliverable is genuinely theirs (not ghost-written by the outgoing " +
      "officer), and confirmation happens on a specific date, not by default after a quiet " +
      "month. KPIs: days from offer acceptance to system access granted, percentage of new " +
      "officers who complete at least one shadowed session before their first deliverable, " +
      "days to first deliverable submitted, and 60-day retention in the role. The most common " +
      "failure mode is skipping the shadowing step for roles that look 'self-explanatory' from " +
      "the outside — title-only handoffs without a shadowed session are where institutional " +
      "knowledge (who actually makes which calls, which relationships matter) gets lost between " +
      "officer generations. The second common failure is letting the first deliverable stretch " +
      "indefinitely with no due date, which quietly signals to the new officer that deadlines " +
      "in this org are soft. Hard-won note: the briefing stage is worth more when it's a " +
      "conversation with the departing or adjacent officer than when it's a document — written " +
      "briefs answer 'what' but rarely 'why', and the why is what new officers actually need.",
    domain: "LEADERSHIP",
    defaultOwnerRole: "STAFF",
    followUpCadenceHours: 120,
    escalateAfterHours: 96,
    stages: [
      {
        key: "welcome-access",
        name: "Welcome & Access",
        description:
          "Grant the new officer system access scoped to their role and send a welcome briefing. " +
          "Done when access is confirmed working and the welcome message has been sent.",
        slaHours: 48,
        isInitial: true,
        steps: [
          {
            key: "grant-access",
            name: "Grant role-scoped system access",
            description:
              "Assign the correct RoleType/AdminSubtype for this officer's actual scope — don't " +
              "default to the broadest subtype just to avoid a follow-up request. The common mistake " +
              "is granting SUPER_ADMIN-level access for convenience, which both over-exposes the " +
              "system and skips the useful signal of what this role actually needs to touch. Tip: " +
              "start with the narrowest subtype that covers the role's stated scope and widen only " +
              "if a real gap surfaces.",
            dueOffsetHours: 24,
          },
          {
            key: "send-welcome",
            name: "Send welcome & role overview",
            description:
              "Send a short welcome covering the role's scope, who they report to, and what their " +
              "first two weeks will look like. The common mistake is sending a generic org-wide " +
              "welcome template with no role-specific detail, leaving the new officer to guess what " +
              "applies to them. Tip: name the specific person they should go to with questions in " +
              "week one.",
            dueOffsetHours: 48,
          },
        ],
      },
      {
        key: "briefing-shadowing",
        name: "Role Briefing & Shadowing",
        description:
          "Brief the officer on their department's current state and have them shadow at least one " +
          "real session in the role. Done when the briefing is complete and a shadowed session has " +
          "occurred.",
        slaHours: 120,
        steps: [
          {
            key: "role-briefing",
            name: "Hold role briefing session",
            description:
              "Walk the new officer through their department's open priorities, key relationships, " +
              "and recurring decisions — live, not just a shared document. The common mistake is " +
              "treating this as a one-way info dump; the new officer should leave able to explain " +
              "their department's current top priority back to you. Tip: end with 'what would you " +
              "tackle first?' and correct course if it's off base.",
            kind: "MEETING",
            dueOffsetHours: 72,
          },
          {
            key: "shadow-session",
            name: "Shadow a real session in the role",
            description:
              "Have the new officer sit in on a real meeting or decision in their new role before " +
              "running one solo. The common mistake is skipping this for roles that seem procedural " +
              "— shadowing is where unwritten norms (tone, who gets consulted, what's actually " +
              "negotiable) get transmitted. Tip: debrief immediately after the shadowed session while " +
              "it's fresh.",
            isRequired: false,
            dueOffsetHours: 120,
          },
        ],
      },
      {
        key: "first-deliverable",
        name: "First Deliverable",
        description:
          "The officer completes one real, owned deliverable in the role with support available but " +
          "not doing the work for them. Done when the deliverable is submitted and reviewed.",
        slaHours: 168,
        steps: [
          {
            key: "assign-deliverable",
            name: "Assign first deliverable",
            description:
              "Pick a real, bounded piece of work the role actually owns — not a manufactured test " +
              "task. The common mistake is assigning something too low-stakes to be a genuine signal " +
              "of readiness. Tip: choose something with a real deadline and real stakeholders so the " +
              "officer experiences the actual rhythm of the role.",
            dueOffsetHours: 24,
          },
          {
            key: "complete-deliverable",
            name: "Complete and submit deliverable",
            description:
              "The new officer completes the deliverable with their briefing contact available for " +
              "questions but not co-authoring it. The common mistake is the supporting officer " +
              "quietly taking over when the deliverable runs late, which erases the signal this stage " +
              "exists to produce. Tip: if it's genuinely stuck, extend the deadline rather than " +
              "finishing it for them.",
            dueOffsetHours: 168,
          },
          {
            key: "review-deliverable",
            name: "Review deliverable with officer",
            description:
              "Give direct feedback on the deliverable before moving to confirmed-active. The common " +
              "mistake is a purely congratulatory review that skips real feedback because the " +
              "deliverable was 'good enough' — early feedback is cheaper to give than feedback after " +
              "a pattern has set in. Tip: name one specific thing to keep doing and one to adjust.",
            kind: "APPROVAL",
            dueOffsetHours: 168,
          },
        ],
      },
      {
        key: "confirmed-active",
        name: "Confirmed Active",
        description:
          "Formally confirm the officer is active in the role. Done — and the workflow closes — once " +
          "confirmation is recorded.",
        slaHours: 48,
        isTerminal: true,
        steps: [
          {
            key: "confirm-active",
            name: "Confirm officer active in role",
            description:
              "Record an explicit confirmation date rather than letting the role become active by " +
              "default once things go quiet. The common mistake is skipping this step entirely for " +
              "roles that 'obviously' worked out, which leaves no clean record of when onboarding " +
              "actually closed. Tip: this is also the right moment to schedule a 60-day retention " +
              "check-in outside this workflow.",
            kind: "DECISION",
            dueOffsetHours: 48,
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("welcome-access", "Grant access and send welcome briefing", 48),
      notifyOnEnter("briefing-shadowing", "New officer ready for role briefing"),
      typedActionOnEnter("first-deliverable", "Assign and track first deliverable", "ADMIN_TASK", 168),
      notifyOnEnter("confirmed-active", "Officer onboarding ready for final confirmation"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 3. Leadership Transition & Offboarding
  // ==========================================================================
  {
    key: "leadership-transition-offboarding",
    name: "Leadership Transition & Offboarding",
    description:
      "Covers both a planned leadership transition (successor briefing, handoff docs, access " +
      "transfer) and a clean offboarding (access revocation, archiving open items, an exit " +
      "note) for any officer-tier role. Purpose: leadership turnover is where institutional " +
      "knowledge and in-flight accountability most commonly evaporate — open ActionItems sit " +
      "orphaned, WorkflowInstances lose an owner mid-run, and Partner relationships go quiet " +
      "because relationshipLeadId still points at someone who left. This blueprint exists to " +
      "make the handoff a checklist, not a memory exercise for whoever happens to still be " +
      "around. Typical duration is about 10 days (roughly 240 hours): 3 days for handoff " +
      "planning, 3 days for successor briefing, 3 days for access and records transfer, then a " +
      "short close-out. Primary owner is the outgoing officer's direct lead (typically STAFF or " +
      "ADMIN); secondary owner is the named successor, who must actively participate rather " +
      "than passively receive documents. Success looks like: every open ActionItem and " +
      "WorkflowInstance previously owned by the outgoing officer has an explicit new owner (not " +
      "left pointing at a departed account), every Partner record with that officer as " +
      "relationshipLeadId is reassigned, all admin subtypes tied to the departing access are " +
      "revoked on the actual last day (not weeks later), and the successor can answer 'what's in " +
      "flight right now' without asking the person who left. KPIs: number of orphaned " +
      "ActionItems/WorkflowInstances 30 days after transition (target zero), days between last " +
      "day and access revocation, percentage of Partner relationshipLeadId records reassigned " +
      "before close-out, and successor confidence rating at the 30-day mark. The most common " +
      "failure mode is access revocation lagging the actual departure by weeks because nobody " +
      "owns that specific step — it falls between the outgoing officer's manager and whoever " +
      "administers accounts. The second common failure is handoff docs that list responsibilities " +
      "but not the informal, undocumented judgment calls (which partner relationships are " +
      "fragile, which recurring decisions are more political than they look) — those are the " +
      "things that actually cause successor stumbles. Hard-won note: do the successor briefing " +
      "as a live working session over open items, not a static document handoff — watching the " +
      "outgoing officer triage their own open list teaches more than reading a summary of it.",
    domain: "LEADERSHIP",
    defaultOwnerRole: "STAFF",
    followUpCadenceHours: 72,
    escalateAfterHours: 96,
    stages: [
      {
        key: "handoff-planning",
        name: "Handoff Planning",
        description:
          "Confirm the transition or offboarding date, name a successor (or confirm there is none, " +
          "for a pure offboarding), and inventory everything this person currently owns. Done when " +
          "the inventory of open items and access is complete.",
        slaHours: 72,
        isInitial: true,
        steps: [
          {
            key: "confirm-date",
            name: "Confirm transition/offboarding date",
            description:
              "Lock in the exact last day in the role, not an approximate 'end of month'. The common " +
              "mistake is leaving this vague, which causes every downstream step (access revocation " +
              "especially) to drift. Tip: write the date into the workflow instance title so it's " +
              "visible everywhere this instance shows up.",
            kind: "DECISION",
            dueOffsetHours: 24,
          },
          {
            key: "name-successor",
            name: "Name successor (or confirm none)",
            description:
              "Explicitly record who, if anyone, is taking over this role — don't leave it implicit. " +
              "The common mistake is assuming 'someone will pick it up' without naming a person, " +
              "which guarantees open items get orphaned. Tip: if there is genuinely no successor yet, " +
              "name an interim owner for open items rather than leaving the field blank.",
            dueOffsetHours: 48,
          },
          {
            key: "inventory-open-items",
            name: "Inventory open ActionItems, WorkflowInstances & Partner relationships",
            description:
              "Pull a complete list of ActionItems and WorkflowInstances owned by the outgoing " +
              "officer and Partner records where they're the relationshipLeadId. The common mistake " +
              "is inventorying only the obviously 'official' responsibilities and missing the long " +
              "tail of small open items that quietly matter. Tip: query by owner/lead ID directly " +
              "rather than relying on the outgoing officer's self-reported list, which is reliably " +
              "incomplete.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "successor-briefing",
        name: "Successor Briefing",
        description:
          "Walk the successor through the open inventory and the undocumented judgment calls that " +
          "don't fit in a handoff doc. Skipped (but not removed) for a pure offboarding with no " +
          "successor. Done when the successor has reviewed every open item.",
        slaHours: 72,
        steps: [
          {
            key: "handoff-doc",
            name: "Draft handoff documentation",
            description:
              "Write up responsibilities, recurring decisions, and key relationships — but treat this " +
              "as a starting point for the live briefing, not the whole handoff. The common mistake " +
              "is over-investing in a polished document while under-investing in the conversation " +
              "that actually transfers judgment. Tip: structure it as a list of open questions the " +
              "successor will need to answer, not just a list of facts.",
            kind: "DOCUMENT",
            dueOffsetHours: 48,
          },
          {
            key: "briefing-session",
            name: "Hold live successor briefing session",
            description:
              "Walk through the open inventory together, live, with the outgoing officer narrating " +
              "their own triage logic. The common mistake is doing this asynchronously over email, " +
              "which loses exactly the informal context this step exists to capture. Tip: have the " +
              "successor drive — they ask about each open item, the outgoing officer answers.",
            kind: "MEETING",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "access-records-transfer",
        name: "Access & Records Transfer",
        description:
          "Reassign every open ActionItem, WorkflowInstance, and Partner relationshipLeadId, then " +
          "revoke the outgoing officer's access on their actual last day. Done when reassignment is " +
          "complete and access is revoked.",
        slaHours: 72,
        steps: [
          {
            key: "reassign-items",
            name: "Reassign open ActionItems and WorkflowInstances",
            description:
              "Move ownership of every open item from the inventory to the successor or interim " +
              "owner — don't leave any pointing at the departing account. The common mistake is " +
              "reassigning the high-visibility items and letting smaller ones sit, which is exactly " +
              "how things get quietly dropped. Tip: reassign in one batch pass against the inventory " +
              "list, checking each item off explicitly.",
            dueOffsetHours: 48,
          },
          {
            key: "transfer-partner-leads",
            name: "Transfer Partner relationshipLeadId records",
            description:
              "Update every Partner record where this officer is the relationshipLeadId to the new " +
              "lead, and proactively notify the partner contact of the change. The common mistake is " +
              "updating the database field but never telling the partner, who then keeps emailing a " +
              "departed account. Tip: send the partner notification before, not after, the access " +
              "revocation so there's a window to redirect replies.",
            dueOffsetHours: 48,
          },
          {
            key: "revoke-access",
            name: "Revoke admin subtypes & system access",
            description:
              "Revoke the outgoing officer's RoleType/AdminSubtype access on their actual last day — " +
              "not before (they may still need it) and not weeks after (the most common failure). " +
              "Tip: set a calendar reminder tied to the confirmed date from the handoff-planning " +
              "stage rather than relying on memory.",
            kind: "TASK",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "closed",
        name: "Closed",
        description:
          "Confirm the transition is complete and log an exit note for institutional memory. Done — " +
          "and the workflow closes — once the exit note is recorded.",
        slaHours: 24,
        isTerminal: true,
        steps: [
          {
            key: "exit-note",
            name: "Log exit note",
            description:
              "Capture a short written record of what this person owned, what changed in their " +
              "tenure, and anything the next person in this role should know — even for an amicable, " +
              "routine departure. The common mistake is skipping this for transitions that feel " +
              "uneventful; the quiet departures are exactly the ones whose context disappears " +
              "fastest. Tip: ask the outgoing officer to write the first draft themselves before they " +
              "leave.",
            kind: "DOCUMENT",
            dueOffsetHours: 24,
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("handoff-planning", "Inventory open items and access for transition", 72),
      notifyOnEnter("successor-briefing", "Successor briefing ready to schedule"),
      typedActionOnEnter("access-records-transfer", "Reassign open items and revoke access", "ADMIN_TASK", 72),
      notifyOnEnter("closed", "Leadership transition ready to close"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 4. Weekly Leadership Review — the Execution OS rhythm, almost verbatim
  // ==========================================================================
  {
    key: "weekly-leadership-review",
    name: "Weekly Leadership Review",
    description:
      "Operationalizes the Weekly Command Center's guided pass over the operational digest: " +
      "Triage, Meetings, Entity health, Decisions, Wrap-up — the same five-step rhythm " +
      "described in the Execution OS. Purpose: without a forced weekly pass, urgent items sit " +
      "in the digest unseen, meetings that produced no output go unnoticed, and decisions " +
      "logged in a meeting never convert into a tracked action. This blueprint exists to make " +
      "that weekly pass an accountable, repeatable instance rather than an optional habit. " +
      "Typical duration is well under a week (roughly 24-30 working hours spread across the " +
      "five steps, with an escalateAfterHours of 96-120 so a stalled review surfaces before the " +
      "next one is due) — this is a recurring ritual, not a project. Primary owner is the " +
      "Leadership officer running that week's review; secondary owners are whoever holds each " +
      "operating area (their entity-health items feed the Entity health stage). Success looks " +
      "like: the triage queue is empty or explicitly deferred by name, every meeting from the " +
      "past week has either a Strong/Adequate outcome or a logged follow-through action, every " +
      "critical or drifting entity has a named next step, every decision needing action has " +
      "either a linked ActionItem or an explicit reason it doesn't need one, and the wrap-up " +
      "leaves a clear note of what carries into next week. KPIs: percentage of weeks with a " +
      "completed review (no skipped weeks), average triage queue size at review start vs. " +
      "review end, percentage of meetings reaching at least Adequate outcome quality, and " +
      "decision-to-action conversion rate. The most common failure mode is the review " +
      "happening but stopping after triage and meetings — entity health and decisions get " +
      "silently dropped under time pressure, which is exactly the load-bearing part of the " +
      "review (triage and meetings are visible elsewhere in the portal; entity health and " +
      "decision follow-through are not). The second common failure is treating wrap-up as " +
      "optional once the substantive work is done, which means nothing carries forward and next " +
      "week's review starts from zero instead of from last week's open threads. Hard-won note: " +
      "block a fixed weekly calendar slot for this rather than fitting it in opportunistically " +
      "— reviews that get squeezed into 'whenever there's time' are the ones that get skipped " +
      "the week it matters most (a busy week is precisely when triage backs up).",
    domain: "LEADERSHIP",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 168,
    escalateAfterHours: 96,
    stages: [
      {
        key: "triage",
        name: "Triage",
        description:
          "Work the urgency-bucketed actions and meetings queue down to zero or explicitly deferred. " +
          "Owned by the reviewing officer. Done when every due/overdue item has a disposition.",
        slaHours: 6,
        isInitial: true,
        steps: [
          {
            key: "review-queue",
            name: "Review triage queue",
            description:
              "Work through the due-today, due-this-week, and overdue action/meeting buckets in " +
              "order of urgency. The common mistake is skimming the list without actually opening " +
              "items, which means stale items get re-deferred indefinitely instead of resolved. Tip: " +
              "for anything deferred a second week in a row, ask why out loud rather than deferring " +
              "silently again.",
            dueOffsetHours: 4,
          },
          {
            key: "clear-or-defer",
            name: "Clear or explicitly defer each item",
            description:
              "Every item in the queue needs an explicit disposition — done, reassigned, or deferred " +
              "with a stated reason — not a silent carry-forward. The common mistake is leaving items " +
              "untouched because they 'will get done eventually', which is indistinguishable from " +
              "forgetting them. Tip: a deferred item without a reason is a signal the item may not " +
              "actually matter — consider dropping it instead.",
            dueOffsetHours: 6,
          },
        ],
      },
      {
        key: "meetings",
        name: "Meetings",
        description:
          "Review the past week's meetings for outcome quality and ensure none ended with no output. " +
          "Done when every meeting has Strong/Adequate quality or a logged follow-through.",
        slaHours: 6,
        steps: [
          {
            key: "review-outcomes",
            name: "Review meeting outcome quality",
            description:
              "Check the outcome-quality badge (Strong, Adequate, Needs follow-through, Empty, Stale) " +
              "on every meeting held in the past week. The common mistake is only reviewing meetings " +
              "the reviewer personally attended, which leaves other officers' empty or stale meetings " +
              "unaddressed. Tip: sort by worst quality first so the items needing intervention surface " +
              "immediately.",
            dueOffsetHours: 4,
          },
          {
            key: "fix-empty-meetings",
            name: "Follow up on empty/stale meetings",
            description:
              "For any meeting graded Empty or Stale, either log the missing output now or schedule " +
              "the follow-up that should have happened. The common mistake is letting an empty " +
              "meeting simply age out of view instead of treating it as a signal the meeting itself " +
              "needs to change format or attendees. Tip: if the same meeting series is repeatedly " +
              "empty, that's a structural problem worth raising in wrap-up, not just a one-week fix.",
            dueOffsetHours: 6,
          },
        ],
      },
      {
        key: "entity-health",
        name: "Entity Health",
        description:
          "Walk the entity rollup and operational health by area, naming a next step for every " +
          "critical or drifting entity. Done when every critical/drifting entity has a named owner " +
          "and next step.",
        slaHours: 6,
        steps: [
          {
            key: "review-health",
            name: "Review operational health by area",
            description:
              "Walk the area health rollup and the entity rollup together, not in isolation — an " +
              "area can look healthy in aggregate while one entity inside it is critical. The common " +
              "mistake is reviewing only the area-level summary and missing the individual entity " +
              "that's dragging on a healthy-looking average. Tip: sort entities by health status " +
              "worst-first within each area.",
            dueOffsetHours: 4,
          },
          {
            key: "name-next-steps",
            name: "Name next steps for critical/drifting entities",
            description:
              "Every entity flagged critical or drifting needs a named owner and a concrete next " +
              "step, not just acknowledgment that it's flagged. The common mistake is noting 'we " +
              "know about this one' without assigning an actual next action, which means the same " +
              "entity is still critical next week with nothing new attempted. Tip: if an entity has " +
              "been critical for three or more consecutive weeks, escalate it explicitly rather than " +
              "renewing the same next step again.",
            kind: "DECISION",
            dueOffsetHours: 6,
          },
        ],
      },
      {
        key: "decisions",
        name: "Decisions",
        description:
          "Convert decisions needing action into tracked ActionItems and confirm none have gone " +
          "stale without follow-through. Done when every open decision has a linked action or an " +
          "explicit reason it needs none.",
        slaHours: 4,
        steps: [
          {
            key: "review-decisions",
            name: "Review decisions needing action",
            description:
              "Pull the decisions logged in the past week's meetings that haven't yet converted to " +
              "an action. The common mistake is reviewing only this week's new decisions and missing " +
              "older ones still sitting unconverted from prior weeks. Tip: sort by age, oldest first, " +
              "so nothing quietly ages out of attention.",
            dueOffsetHours: 2,
          },
          {
            key: "convert-decisions",
            name: "Convert decisions to tracked actions",
            description:
              "Use the decision-to-action conversion so each decision becomes a real, owned, dated " +
              "ActionItem rather than staying a line in meeting notes. The common mistake is treating " +
              "a decision as self-executing once it's been said out loud in a meeting — decisions " +
              "without a tracked action are the single biggest source of 'didn't we already decide " +
              "this?' repeat conversations. Tip: the conversion is idempotent — when in doubt, check " +
              "for an existing linked action before creating a duplicate.",
            dueOffsetHours: 4,
          },
        ],
      },
      {
        key: "wrap-up",
        name: "Wrap-up",
        description:
          "Summarize the week's review and carry forward anything unresolved into next week. Done " +
          "— and the review closes — once the summary is recorded.",
        slaHours: 2,
        isTerminal: true,
        steps: [
          {
            key: "summarize",
            name: "Summarize the week's review",
            description:
              "Write a short summary of what was triaged, which meetings needed follow-up, which " +
              "entities are critical, and what decisions converted — this becomes the starting point " +
              "for next week. The common mistake is skipping this when the review felt routine; the " +
              "summary's real value shows up weeks later when someone needs to trace why an entity " +
              "has been flagged for a month. Tip: keep it to the items that changed status this week, " +
              "not a full re-listing of everything reviewed.",
            dueOffsetHours: 2,
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("triage", "Work the weekly triage queue", 4),
      notifyOnEnter("meetings", "Weekly review: meeting outcomes ready to check"),
      typedActionOnEnter("entity-health", "Name next steps for critical/drifting entities", "OPERATIONS", 6),
      notifyOnEnter("decisions", "Weekly review: decisions ready for conversion"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // ==========================================================================
  // 5. Periodic Leadership Review — monthly/quarterly/annual, same motion
  // ==========================================================================
  {
    key: "periodic-leadership-review",
    name: "Periodic Leadership Review",
    description:
      "Runs the higher-altitude review of YPP's strategic initiatives and KPI health — the " +
      "same four-stage motion (assemble, review, decide, distribute) at whatever cadence the " +
      "instance represents. Purpose: the Weekly Leadership Review catches operational drift " +
      "week to week, but strategic-level questions (is an initiative actually on pace for its " +
      "target date, is the portfolio balanced, where is risk concentrating) need a slower, " +
      "deeper pass that the weekly rhythm has no room for. There is no schema distinction " +
      "between a monthly, quarterly, or annual review — the instance's own title and the date " +
      "it's started carry the cadence (e.g. 'Q1 2027 Leadership Review' vs. 'Annual 2026 " +
      "Leadership Review'); install one instance per actual review rather than forking this " +
      "into three blueprints. Typical duration is about 9-10 days (roughly 220 hours) " +
      "regardless of cadence — the difference between a monthly and an annual review is the " +
      "depth of content assembled, not the process duration: 3 days to assemble metrics and the " +
      "KPI roll-up, 3 days for leadership review and discussion, 2 days for decisions and " +
      "strategic adjustments, 2 days to distribute and archive. Primary owner is the assigned " +
      "Leadership/Admin reviewer; secondary owners are each initiative's declared owner, who " +
      "must contribute their slice of the roll-up rather than have it assembled on their " +
      "behalf. Success looks like: every active initiative's health, momentum, progress, and " +
      "risk are represented in the roll-up with no initiative silently omitted, the review " +
      "discussion produces explicit decisions (not just a status read-out), strategic " +
      "adjustments are logged against the specific initiative they affect, and the distributed " +
      "summary reaches stakeholders within two days of the review discussion. KPIs: percentage " +
      "of active initiatives represented in each roll-up, average time from review discussion to " +
      "distribution, number of strategic adjustments logged per review, and the trend in " +
      "initiatives at critical/at_risk health across consecutive reviews. The most common " +
      "failure mode is the roll-up becoming a copy-paste of the prior period's roll-up with " +
      "numbers lightly updated, which means at_risk initiatives quietly stay at_risk for " +
      "multiple cycles without anyone forcing a real strategic adjustment. The second common " +
      "failure is the review discussion happening but producing no logged decisions — a good " +
      "discussion that doesn't convert into recorded adjustments is functionally the same as no " +
      "review at all three months later. Hard-won note for future leaders: the annual review is " +
      "not just a bigger quarterly review — it's the one point in the year built for killing or " +
      "restarting initiatives, not just adjusting them, and reviewers who treat it as routine " +
      "status-checking miss that it's the org's one designated moment for that harder call.",
    domain: "LEADERSHIP",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 720,
    escalateAfterHours: 168,
    stages: [
      {
        key: "assemble",
        name: "Assemble Metrics & KPI Roll-up",
        description:
          "Pull each active initiative's health, momentum, progress, risk, and milestone status " +
          "into a single roll-up for this review period. Owned by the reviewing officer with each " +
          "initiative owner contributing. Done when the roll-up covers every active initiative.",
        slaHours: 72,
        isInitial: true,
        steps: [
          {
            key: "pull-initiative-health",
            name: "Pull initiative health & KPI roll-up",
            description:
              "Assemble health, momentum, progress, and risk for every active initiative, not just " +
              "the ones that happen to be top of mind. The common mistake is pulling numbers only for " +
              "initiatives that are visibly struggling or visibly succeeding, leaving the steady " +
              "middle unrepresented and creating a skewed picture. Tip: start from the full initiative " +
              "list, not from memory of what's been discussed recently.",
            dueOffsetHours: 48,
          },
          {
            key: "collect-owner-input",
            name: "Collect initiative owner input",
            description:
              "Ask each initiative owner for their own read on progress and risk before finalizing " +
              "the roll-up — the derived numbers tell you what happened, not always why. The common " +
              "mistake is assembling the roll-up entirely from system-derived data and skipping owner " +
              "input, which misses context the data can't capture (a slipped milestone that's " +
              "actually fine because the target date itself was wrong). Tip: give owners a firm " +
              "deadline; a roll-up waiting on one slow response blocks the whole review.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "review",
        name: "Leadership Review & Discussion",
        description:
          "Hold the live review discussion over the assembled roll-up. Done when the discussion has " +
          "occurred and findings are captured.",
        slaHours: 72,
        steps: [
          {
            key: "schedule-review",
            name: "Schedule leadership review session",
            description:
              "Get the review session on the calendar with enough notice that initiative owners can " +
              "prepare, not the day after the roll-up is assembled. The common mistake is scheduling " +
              "this too close to the assembly deadline, leaving no buffer if an owner's input comes in " +
              "late. Tip: send the assembled roll-up ahead of the session so the meeting is discussion, " +
              "not a first read.",
            dueOffsetHours: 24,
          },
          {
            key: "hold-review",
            name: "Hold leadership review discussion",
            description:
              "Run the discussion against the roll-up, pushing past status read-out into real " +
              "questions — is this initiative still worth the investment, is the target date still " +
              "realistic, where is risk concentrating across the portfolio. The common mistake is " +
              "letting this become a status meeting where each initiative gets a minute of summary " +
              "and no real scrutiny. Tip: spend disproportionate time on at_risk/critical initiatives " +
              "rather than splitting time evenly across all of them.",
            kind: "MEETING",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "decisions",
        name: "Decisions & Strategic Adjustments",
        description:
          "Log explicit decisions and strategic adjustments from the review discussion against the " +
          "specific initiatives they affect. Done when every adjustment is recorded.",
        slaHours: 48,
        steps: [
          {
            key: "log-decisions",
            name: "Log decisions from the review",
            description:
              "Record every real decision made in the review discussion — re-prioritize, re-plan a " +
              "milestone, reassign ownership, or close an initiative — against the specific " +
              "initiative it affects. The common mistake is letting decisions stay implicit in the " +
              "meeting notes without being logged as discrete, attributable decisions. Tip: if the " +
              "discussion didn't produce at least one explicit decision, that's worth noting itself " +
              "— it may mean the review was too shallow.",
            kind: "DECISION",
            dueOffsetHours: 24,
          },
          {
            key: "convert-to-actions",
            name: "Convert adjustments into tracked actions",
            description:
              "Turn each logged decision into a tracked ActionItem with a real owner and due date so " +
              "the strategic adjustment actually executes. The common mistake is treating the decision " +
              "log itself as sufficient follow-through, the same trap the Weekly Leadership Review " +
              "exists to avoid at the operational level. Tip: assign adjustments to the initiative " +
              "owner, not back to the reviewing officer, so accountability stays with the work.",
            dueOffsetHours: 48,
          },
        ],
      },
      {
        key: "distribute",
        name: "Distribute & Archive",
        description:
          "Send the review summary to stakeholders and archive the roll-up for the next cycle's " +
          "comparison. Done — and the review closes — once distributed and archived.",
        slaHours: 48,
        isTerminal: true,
        steps: [
          {
            key: "distribute-summary",
            name: "Distribute review summary",
            description:
              "Send the summary — roll-up highlights, decisions made, adjustments in motion — to the " +
              "relevant stakeholders within two days of the review discussion. The common mistake is " +
              "letting distribution slip while chasing a more polished writeup; a timely, plain " +
              "summary beats a polished one that arrives two weeks late and after the next cycle has " +
              "already started. Tip: lead with decisions and adjustments, not a re-statement of the " +
              "full roll-up — that's already been seen.",
            dueOffsetHours: 24,
          },
          {
            key: "archive-rollup",
            name: "Archive roll-up for next cycle comparison",
            description:
              "Archive this cycle's roll-up so the next periodic review can compare trend, not just " +
              "snapshot. The common mistake is skipping archival because the data is 'still in the " +
              "system somewhere' — without an explicit archive, reconstructing what a roll-up looked " +
              "like three cycles ago becomes guesswork. Tip: tag the archive with the cadence and " +
              "period in the instance title so it's searchable later.",
            dueOffsetHours: 48,
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("assemble", "Assemble initiative health & KPI roll-up", 48),
      notifyOnEnter("review", "Leadership review packet ready for discussion"),
      typedActionOnEnter("decisions", "Log decisions and convert adjustments to actions", "OPERATIONS", 24),
      notifyOnEnter("distribute", "Leadership review ready to distribute"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },
];
