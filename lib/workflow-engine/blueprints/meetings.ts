// ============================================================================
// Universal Workflow Engine — blueprint catalog: Meetings & Events
// ============================================================================
//
// Every recurring meeting blueprint in this file follows the same four-part
// shape: Agenda & prep -> Pre-meeting checklist confirmed -> Meeting held
// (a real Meeting row, via meetingOnEnter) -> Follow-ups captured & next-cycle
// prep created. These workflows are the "prepare for and run this meeting"
// checklist that WRAPS a Meeting row produced by lib/weekly-meetings/ — they do
// not replace that module's agenda/attendance/decision/follow-up UI.

import {
  actionOnEnter,
  autoAdvanceWhenReady,
  escalateOverdue,
  meetingOnEnter,
  notifyOnEnter,
  typedActionOnEnter,
} from "./helpers";
import type { WorkflowBlueprint } from "./types";

export const MEETING_BLUEPRINTS: WorkflowBlueprint[] = [
  {
    key: "board-preparation",
    name: "Board Preparation",
    description:
      "Assemble, review, and distribute a board meeting packet, then hold the meeting and record its decisions. " +
      "Purpose: give the board a packet that lets them govern in the room instead of getting oriented in the room — " +
      "every agenda item should arrive with the metric or roll-up that motivates it, a clear ask, and a named owner. " +
      "Typical duration: 5-7 days end to end (assembly is the long pole; review and distribution are short, fixed " +
      "windows so the board reliably gets the packet with enough lead time to read it). Primary owner: the staff " +
      "member assembling the packet (defaultOwnerSubtype SUPER_ADMIN covers the org's top admin tier, who is " +
      "accountable even when assembly is delegated); secondary owner: leadership, who reviews before distribution. " +
      "Success definition: the board receives the packet at least 24 hours before the meeting, every agenda item has " +
      "a decision or a clear next step recorded afterward, and minutes are filed the same day. KPIs: packet " +
      "lead time in hours before the meeting, percent of agenda items with a recorded decision or next step, " +
      "leadership-review turnaround time, and time-to-minutes after the meeting ends. Common failure modes: a packet " +
      "assembled the night before with stale metrics nobody had time to sanity-check; an agenda that mixes " +
      "informational updates with real decisions so the board runs out of time before the decisions; and minutes " +
      "that never get written because no one stage explicitly owns them. Hard-won note: the leadership pre-review is " +
      "the highest-leverage 30 minutes in this whole workflow — it is where stale numbers, missing owners, and " +
      "agenda items that are really staff-level decisions in disguise get caught before the board ever sees them.",
    domain: "GOVERNANCE",
    defaultOwnerSubtype: "SUPER_ADMIN",
    escalateAfterHours: 96,
    stages: [
      {
        key: "assemble",
        name: "Assemble",
        description:
          "Draft the agenda and pull the metrics/roll-ups that back it. Exit when both the agenda and the " +
          "metrics packet exist in a single draft document. Owner: the staff member assembling the packet.",
        slaHours: 96,
        isInitial: true,
        steps: [
          {
            key: "agenda",
            name: "Draft agenda",
            kind: "DOCUMENT",
            dueOffsetHours: 96,
            description:
              "Write the agenda as a sequence of named decisions and updates, not a list of topics — each line " +
              "should say what the board needs to do (approve, decide, note) not just what will be discussed. A good " +
              "board agenda separates consent items (routine approvals bundled together) from discussion items " +
              "(real decisions that need debate time) so the limited meeting time goes to what actually needs the " +
              "room. The most common mistake is padding the agenda with status updates that could have been a memo; " +
              "if an item doesn't need a decision or a discussion, put it in the packet as a read-ahead instead. Tip: " +
              "timebox each discussion item right on the agenda (e.g. \"15 min\") — it forces prioritization before " +
              "the meeting instead of during it.",
          },
          {
            key: "metrics",
            name: "Collect metrics & roll-ups",
            kind: "TASK",
            dueOffsetHours: 96,
            description:
              "Pull the real numbers that motivate each agenda item: enrollment and chapter health roll-ups, " +
              "fundraising progress against goal, instructor/mentor pipeline counts, and any People-Strategy action " +
              "items flagged sendToBoard. Cross-check every number against its source view the same week it's pulled — " +
              "the most common mistake is reusing last month's roll-up because it's faster, which quietly erodes board " +
              "trust the first time someone notices a stale figure. Tip: pull straight from the Weekly Impact / Action " +
              "Tracker roll-ups rather than hand-compiling from memory or old slides, since those are the live source " +
              "of truth this portal already maintains.",
          },
        ],
      },
      {
        key: "review",
        name: "Review",
        description:
          "Leadership reviews the assembled packet for stale data, missing owners, and disguised staff-level " +
          "decisions before the board ever sees it. Exit when leadership approves or returns it with named fixes. " +
          "Owner: leadership (reviewer, not the assembler).",
        slaHours: 48,
        steps: [
          {
            key: "leadership-review",
            name: "Leadership review of packet",
            kind: "APPROVAL",
            dueOffsetHours: 48,
            description:
              "Read the packet as a board member would: does every number look current, does every discussion item " +
              "have a named owner and a clear ask, and is anything in here actually a staff-level call that doesn't " +
              "need the board's time at all? The most common mistake is a rubber-stamp review that only checks " +
              "formatting — a thorough review catches at least one stale metric or missing owner more often than not. " +
              "Tip: review with the prior meeting's minutes open side by side and confirm every open item from last " +
              "time is either resolved or explicitly carried forward on this agenda.",
          },
        ],
      },
      {
        key: "distribute",
        name: "Distribute",
        description:
          "Send the approved packet to the full board with enough lead time to read it. Exit once the packet has " +
          "gone out. Owner: the staff member assembling the packet.",
        slaHours: 24,
        steps: [
          {
            key: "send",
            name: "Distribute packet to board",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Send the final packet to every board member through the agreed channel, with the meeting link and " +
              "any pre-read flagged explicitly. The most common mistake is distributing it so close to the meeting " +
              "that board members arrive having skimmed instead of read it, which pushes orientation time into the " +
              "meeting itself. Tip: include a one-line \"what we need from you\" summary at the top of the email so " +
              "skimmers still know which items need their judgment.",
          },
        ],
      },
      {
        key: "meeting",
        name: "Meeting",
        description:
          "Hold the board meeting and capture every decision and next step as it happens. Terminal stage — exit " +
          "when minutes are filed. Owner: the facilitator, with the packet assembler recording minutes.",
        isTerminal: true,
        steps: [
          { key: "hold", name: "Hold board meeting", kind: "MEETING" },
          {
            key: "minutes",
            name: "Record decisions & minutes",
            kind: "DOCUMENT",
            description:
              "Capture each decision verbatim as it's made, who owns the resulting action, and the due date, rather " +
              "than reconstructing it from memory afterward. The most common mistake is writing vague minutes (\"discussed " +
              "X\") that don't actually record what was decided, which makes the next meeting re-litigate the same " +
              "item. Tip: file minutes the same day while the discussion is fresh, and convert every decision with a " +
              "named owner into a tracked action immediately rather than batching it for later.",
          },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("assemble", "Assemble the board packet", "MEETING_PREP", 96),
      actionOnEnter("review", "Review the board packet before distribution", 48),
      notifyOnEnter("distribute", "Distribute the board packet"),
      meetingOnEnter("meeting", "Board meeting", "GENERIC", 48),
      typedActionOnEnter("meeting", "Record board meeting minutes & decisions", "MEETING_RECAP", 24),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "event-planning",
    name: "Event Planning",
    description:
      "Plan, promote, run, and debrief an event end to end. Purpose: turn an event concept into a well-attended, " +
      "well-run gathering and capture what worked so the next event starts from a higher baseline instead of " +
      "relearning the same lessons. Typical duration: 2-4 weeks depending on venue lead time — planning and " +
      "promotion are the long stages, the event itself is a single day, and debrief should close within a few days " +
      "while memories are fresh. Primary owner: the staff member running the event (defaultOwnerRole STAFF); " +
      "secondary owner: whoever owns the venue/budget relationship if different. Success definition: the event runs " +
      "on the planned budget and date, attendance meets or beats the RSVP forecast, and the debrief produces at " +
      "least one concrete change for next time. KPIs: RSVP-to-attendance conversion rate, budget variance, percent " +
      "of promotion tasks completed before the publicize deadline, and debrief completion rate (was a retro " +
      "actually held and written down). Common failure modes: venue booked before the budget and concept are firm, " +
      "leading to a mismatched space; promotion starting too late to build real RSVP momentum; and skipping the " +
      "debrief entirely once the event is over, so the same logistics mistakes repeat next time. Hard-won note: the " +
      "gap between \"RSVP'd\" and \"showed up\" is real and usually 20-30% — plan room/material capacity off realistic " +
      "attendance, not the RSVP count.",
    domain: "EVENTS",
    defaultOwnerRole: "STAFF",
    escalateAfterHours: 168,
    stages: [
      {
        key: "plan",
        name: "Plan",
        description:
          "Lock the event concept, budget, and venue/date. Exit once a venue is secured for a confirmed date and " +
          "the budget is signed off. Owner: the event lead.",
        slaHours: 96,
        isInitial: true,
        steps: [
          {
            key: "concept",
            name: "Define event concept & budget",
            kind: "DOCUMENT",
            dueOffsetHours: 96,
            description:
              "Write down the event's purpose, target audience, expected headcount, and a line-item budget before " +
              "touching venue options — the concept should drive the venue search, not the other way around. The " +
              "most common mistake is booking a venue first because it's available, then retrofitting the concept " +
              "and budget to fit it. Tip: set the budget with a 10-15% contingency line for the inevitable last-minute " +
              "logistics spend.",
          },
          {
            key: "venue",
            name: "Secure venue & date",
            kind: "TASK",
            dueOffsetHours: 168,
            description:
              "Confirm a venue that fits the expected headcount and budget, and lock a date that doesn't collide " +
              "with other chapter or org commitments. The most common mistake is treating a verbal hold as a " +
              "booking — get it in writing with a deposit or confirmation before announcing the date publicly. Tip: " +
              "check the portal's existing meeting/event calendar for conflicts before locking the date.",
          },
        ],
      },
      {
        key: "promote",
        name: "Promote",
        description:
          "Publicize the event and track RSVPs against the attendance target. Exit once promotion materials are " +
          "out and RSVP tracking is live. Owner: the event lead, often with a socials/communications partner.",
        slaHours: 240,
        steps: [
          {
            key: "publicize",
            name: "Publicize the event",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Push the event out through every channel that reaches the target audience — email, socials, chapter " +
              "channels — with a clear date, location, and RSVP link in the first line. The most common mistake is " +
              "promoting too close to the date, which doesn't give people enough lead time to plan around it; start " +
              "promotion as soon as the venue and date are locked, not the week before. Tip: re-promote at least once " +
              "roughly a week out as a reminder — first announcements get lost in the feed.",
          },
          {
            key: "rsvp",
            name: "Track RSVPs",
            kind: "TASK",
            isRequired: false,
            description:
              "Keep a running RSVP count against the attendance target so capacity decisions (room size, food, " +
              "materials) are based on real signal, not guesswork. The most common mistake is not checking RSVPs " +
              "again until the day before, missing the window to course-correct promotion if turnout looks low. Tip: " +
              "discount RSVP counts by 20-30% when planning physical capacity — that's the typical no-show rate.",
          },
        ],
      },
      {
        key: "run",
        name: "Run",
        description:
          "Execute the event as planned. Exit once the event has concluded. Owner: the event lead, on-site.",
        steps: [
          {
            key: "execute",
            name: "Run the event",
            kind: "MEETING",
            description:
              "Run the event against the plan: arrive early enough to set up and troubleshoot, have one person " +
              "explicitly own check-in/attendance, and keep a lightweight running note of anything that goes wrong " +
              "for the debrief. The most common mistake is having no single owner during the event itself, so small " +
              "fires (room setup, AV, late catering) have no one accountable to fix them. Tip: assign a day-of point " +
              "person who isn't also facilitating, so logistics issues don't compete with running the program.",
          },
        ],
      },
      {
        key: "debrief",
        name: "Debrief",
        description:
          "Capture attendance, budget actuals, and what should change next time. Terminal stage — exit once the " +
          "retro is written down, not just discussed verbally. Owner: the event lead.",
        isTerminal: true,
        steps: [
          {
            key: "retro",
            name: "Debrief & capture learnings",
            kind: "DOCUMENT",
            description:
              "Record actual attendance versus the RSVP forecast, actual spend versus budget, and at least one " +
              "concrete change to make next time — not a vague \"went well\" note. The most common mistake is " +
              "letting the debrief happen only as a hallway conversation that nobody writes down, so the lesson " +
              "evaporates before the next event. Tip: hold the debrief within 2-3 days of the event while details are " +
              "still fresh, and file it somewhere the next event planner will actually find it.",
          },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("plan", "Plan the event", "LOGISTICS", 96),
      notifyOnEnter("promote", "Begin event promotion"),
      meetingOnEnter("run", "Event", "GENERIC", 24),
      typedActionOnEnter("debrief", "Write the event debrief", "MEETING_RECAP", 72),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "officer-meeting-cycle",
    name: "Officer Meeting Cycle",
    description:
      "Run one cycle of the weekly Officer Meeting: build the agenda, confirm prep is done, hold the meeting, and " +
      "capture follow-ups for next cycle. Purpose: give leadership (Aveena, Ian, Sanvi, Brayden, Anthea per the " +
      "operating model) a tight, decision-focused forum for strategy, applicant review, staff performance, " +
      "escalations, and role gaps, instead of a status-update meeting that produces no decisions. Typical duration: " +
      "this is a weekly recurring ritual, so the full cycle should close within about 4-5 days — agenda & prep " +
      "happen in the 1-2 days before the meeting, the meeting itself is one hour, and follow-ups should be captured " +
      "and next-cycle prep queued within 24-48 hours after. Primary owner: the meeting facilitator (typically the " +
      "executive lead); secondary owners: each officer who owns an escalation or decision item on the agenda. " +
      "Success definition: every agenda item leaves the meeting with either a recorded decision or a named owner and " +
      "due date — nothing is just \"discussed\" and dropped. KPIs: percent of agenda items with a documented decision " +
      "or explicit next step, follow-up completion rate by the next cycle, number of overdue strategic actions " +
      "carried week over week (should trend down, not up), and meeting start-on-time rate. Common failure modes: an " +
      "agenda assembled minutes before the call so escalations get missed; a meeting that turns into status reporting " +
      "instead of decisions because no one pre-flagged what actually needs a call; and follow-ups that get verbally " +
      "agreed in the room but never converted into tracked actions, so they quietly die. Hard-won note: the single " +
      "highest-leverage habit is pulling last week's open commitments into this week's agenda before adding anything " +
      "new — unresolved items that don't get explicitly re-surfaced are the ones that go stale.",
    domain: "GENERAL",
    defaultOwnerSubtype: "SUPER_ADMIN",
    escalateAfterHours: 48,
    stages: [
      {
        key: "agenda-prep",
        name: "Agenda & prep",
        description:
          "Build the agenda from this week's decisions-needed, escalations, applicant reviews, staff-performance " +
          "concerns, overdue strategic actions, and any commitments still open from last cycle. Exit once a draft " +
          "agenda exists with an owner named for each item. Owner: the meeting facilitator.",
        slaHours: 48,
        isInitial: true,
        steps: [
          {
            key: "draft-agenda",
            name: "Draft agenda",
            kind: "DOCUMENT",
            dueOffsetHours: 48,
            description:
              "Pull the standing agenda sections — decisions needed, escalations from Impact Presentations, " +
              "applicants needing review, staff performance concerns, overdue strategic actions, role ownership " +
              "gaps, and last week's open commitments — and assign each a presenting officer. The most common " +
              "mistake is letting the agenda default to whatever's top of mind that morning instead of systematically " +
              "checking each standing section, which is how escalations get quietly dropped. Tip: literally start by " +
              "reopening last cycle's minutes and copying forward anything still unresolved before adding new items.",
          },
          {
            key: "pull-escalations",
            name: "Pull escalations & overdue items",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Gather anything escalated from Chapter Impact or Global Operations Impact Presentations this week, " +
              "plus any People-Strategy action overdue past its due date, so the officer meeting is where blocked " +
              "work actually gets unblocked. The most common mistake is relying on someone remembering to raise it " +
              "verbally rather than checking the Action Tracker's overdue filter directly. Tip: a clean officer " +
              "agenda has zero surprises in it — everything on it should already be visible somewhere in the portal " +
              "before the meeting starts.",
          },
        ],
      },
      {
        key: "prep-confirmed",
        name: "Pre-meeting checklist confirmed",
        description:
          "Confirm every agenda item has a presenting owner, required attendees are confirmed, and decision items " +
          "are flagged so the meeting doesn't spend room time on discovery. Exit once the facilitator signs off the " +
          "checklist. Owner: the meeting facilitator.",
        slaHours: 24,
        steps: [
          {
            key: "confirm-attendees",
            name: "Confirm required attendees",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Confirm the core leadership group can attend and that anyone presenting an escalation or applicant " +
              "review knows their slot. The most common mistake is assuming standing attendees will show without " +
              "an explicit confirmation, then losing meeting time to absence and re-litigating the item next week. " +
              "Tip: send the confirmed agenda out at least a few hours ahead so attendees arrive ready to decide, " +
              "not to get oriented.",
          },
          {
            key: "flag-decisions",
            name: "Flag items that need a decision",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Mark each agenda item explicitly as a decision, an FYI, or a discussion, so the facilitator can " +
              "timebox the meeting around the items that actually need the room's judgment. The most common mistake " +
              "is leaving every item unmarked, which lets status updates eat the time budgeted for real decisions. " +
              "Tip: cap discussion-only items at two or three per cycle — anything else should be a memo, not a " +
              "meeting slot.",
          },
        ],
      },
      {
        key: "meeting-held",
        name: "Meeting held",
        description:
          "Hold the officer meeting: make decisions, assign owners and due dates, and record people concerns for " +
          "leadership-only visibility. Exit once the meeting has concluded. Owner: the facilitator.",
        slaHours: 24,
        steps: [
          { key: "hold", name: "Hold officer meeting", kind: "MEETING" },
        ],
      },
      {
        key: "followups-captured",
        name: "Follow-ups captured & next-meeting prep created",
        description:
          "Convert every decision and commitment made in the meeting into tracked Action Tracker items with owners " +
          "and due dates, send the summary, and queue prep for next cycle. Terminal stage — exit once follow-ups " +
          "are linked and next cycle's prep action exists. Owner: the facilitator.",
        isTerminal: true,
        steps: [
          {
            key: "capture-followups",
            name: "Capture decisions & follow-up actions",
            kind: "DOCUMENT",
            dueOffsetHours: 24,
            description:
              "Convert every decision and commitment made in the room into a tracked action with a named owner and " +
              "due date, and send or post the meeting summary. The most common mistake is treating a verbal \"yes, " +
              "let's do that\" as sufficient — if it isn't a tracked action, it effectively didn't happen. Tip: do " +
              "this within hours of the meeting ending, not days later, while the context is still fresh and the " +
              "owner still remembers agreeing to it.",
          },
          {
            key: "carry-forward",
            name: "Carry unresolved items to next cycle",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "The engine has no native carry-forward primitive for unresolved agenda items, so this is a manual " +
              "practice: explicitly list anything that didn't reach a decision this cycle and note it as the first " +
              "thing the next cycle's agenda-prep step should pull in. The most common mistake is assuming an " +
              "unresolved item will naturally resurface — it won't unless someone writes it down as carried forward. " +
              "Tip: keep a single running \"open items\" note that this step appends to and that next cycle's " +
              "draft-agenda step starts from, so nothing silently falls off.",
          },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("agenda-prep", "Draft this week's officer meeting agenda", "MEETING_PREP", 48),
      notifyOnEnter("prep-confirmed", "Confirm officer meeting prep checklist"),
      meetingOnEnter("meeting-held", "Officer meeting", "OFFICER", 24),
      typedActionOnEnter("followups-captured", "Capture officer meeting follow-ups", "MEETING_RECAP", 24),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "chapter-impact-presentation-cycle",
    name: "Chapter Impact Presentation Cycle",
    description:
      "Run one cycle of the weekly Chapter Impact Presentation: build the agenda, confirm chapter presidents are " +
      "ready to present, hold the meeting, and capture follow-ups. Purpose: give chapter presidents a recurring, " +
      "accountable forum to show outreach progress, new partners/applicants, blockers, and commitments — and give " +
      "leadership (Ian and Brayden per the operating model) a reliable read on chapter health. Typical duration: a " +
      "weekly ritual closing within about 4-5 days — agenda & prep over 1-2 days, the meeting itself under an hour, " +
      "follow-ups captured within 24-48 hours after. Primary owner: the meeting facilitator (Ian/Brayden); secondary " +
      "owners: each presenting chapter president, accountable for their own chapter's update. Success definition: " +
      "every chapter either presents real progress with evidence or has its missing update explicitly flagged and " +
      "escalated — silence is never treated as fine. KPIs: percent of chapters presenting on a given cycle (vs. " +
      "missing), percent of raised blockers with a named owner and next step, follow-up completion rate by next " +
      "cycle, and repeat-blocker rate (the same blocker appearing two cycles in a row signals it needs officer-level " +
      "escalation). Common failure modes: chapters showing up without prepared updates so the meeting turns into " +
      "live status-gathering instead of accountability; blockers raised verbally but never logged, so they resurface " +
      "unresolved next week; and missing chapters going unnoticed because no one is explicitly checking attendance " +
      "against the full chapter roster. Hard-won note: a chapter president skipping two cycles in a row is a much " +
      "stronger signal than any single metric — escalate attendance gaps to the Officer Meeting promptly rather than " +
      "waiting for a third miss.",
    domain: "GENERAL",
    defaultOwnerRole: "STAFF",
    escalateAfterHours: 48,
    stages: [
      {
        key: "agenda-prep",
        name: "Agenda & prep",
        description:
          "Build the agenda from each chapter's progress, new partners/outreach, new applicants/students, current " +
          "blockers, and decisions needed, pulling from chapter action items and prior cycle's commitments. Exit " +
          "once every chapter has an assigned presentation slot. Owner: the meeting facilitator.",
        slaHours: 48,
        isInitial: true,
        steps: [
          {
            key: "draft-agenda",
            name: "Draft agenda",
            kind: "DOCUMENT",
            dueOffsetHours: 48,
            description:
              "List every active chapter with a slot for progress, new partners or outreach, new applicants or " +
              "students, current blockers, and decisions needed, plus a line for each chapter's commitments from " +
              "last cycle. The most common mistake is building a generic agenda and letting presidents free-form " +
              "their update, which produces inconsistent, hard-to-compare reports. Tip: reuse the same section " +
              "headers every cycle (progress, partners, applicants, blockers, decisions, commitments) so presidents " +
              "know exactly what to prepare and leadership can compare chapters week over week.",
          },
          {
            key: "review-chapter-actions",
            name: "Review chapter actions & prior commitments",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Check each chapter's open Action Tracker items and last cycle's recorded commitments before the " +
              "meeting, so the facilitator can ask directly about anything that's gone quiet. The most common " +
              "mistake is only reviewing the chapters that proactively send updates, which lets the quiet ones " +
              "avoid scrutiny. Tip: check in on every chapter on the roster, not just the ones that show activity — " +
              "silence is itself a signal worth raising.",
          },
        ],
      },
      {
        key: "prep-confirmed",
        name: "Pre-meeting checklist confirmed",
        description:
          "Confirm chapter president attendance, that each has prepared their update, and that blocker/decision " +
          "questions are ready to ask. Exit once the facilitator signs off the checklist. Owner: the meeting " +
          "facilitator.",
        slaHours: 24,
        steps: [
          {
            key: "confirm-presidents",
            name: "Confirm chapter president attendance",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Reach out to every chapter president on the agenda to confirm they can attend and have their update " +
              "ready, not just the ones who reliably show up. The most common mistake is assuming no-response means " +
              "they'll be there; treat non-response as a flag to follow up directly before the meeting, not after. " +
              "Tip: a short reminder message with the agenda sections attached doubles as both a confirmation ask " +
              "and prep nudge.",
          },
          {
            key: "prepare-questions",
            name: "Prepare blocker & decision questions",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Draft specific follow-up questions for any blocker or decision flagged in agenda-prep, so the " +
              "meeting moves straight to resolving it instead of re-explaining the situation from scratch. The most " +
              "common mistake is showing up to hear the blocker fresh in the room, which wastes the limited meeting " +
              "time on context-setting. Tip: where possible, pre-circulate the specific question to the relevant " +
              "chapter president so they can bring an answer, not just a problem.",
          },
        ],
      },
      {
        key: "meeting-held",
        name: "Meeting held",
        description:
          "Hold the Chapter Impact Presentation: record progress and proof, name blockers and support needed, and " +
          "set next steps with each chapter president. Exit once the meeting has concluded. Owner: the facilitator.",
        slaHours: 24,
        steps: [
          { key: "hold", name: "Hold chapter impact presentation", kind: "MEETING" },
        ],
      },
      {
        key: "followups-captured",
        name: "Follow-ups captured & next-meeting prep created",
        description:
          "Convert blockers and commitments into tracked actions with owners and dates, send the chapter summary, " +
          "and queue next cycle's prep. Terminal stage — exit once follow-ups are linked and missing-update chapters " +
          "are escalated if needed. Owner: the facilitator.",
        isTerminal: true,
        steps: [
          {
            key: "capture-followups",
            name: "Capture decisions & follow-up actions",
            kind: "DOCUMENT",
            dueOffsetHours: 24,
            description:
              "Turn each chapter's blockers and next-week commitments into tracked actions with an explicit owner " +
              "(usually the chapter president) and due date, then send the chapter summary. The most common mistake " +
              "is logging the update but not the commitment as a trackable item, so there's nothing to check against " +
              "next cycle. Tip: link each follow-up action back to the chapter entity so it surfaces on that " +
              "chapter's own operational-context panel, not just in a meeting note.",
          },
          {
            key: "escalate-gaps",
            name: "Escalate missing updates or repeated blockers",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Flag any chapter that missed this cycle's update entirely, and any blocker that has now appeared two " +
              "cycles in a row, for the Officer Meeting. The engine has no native carry-forward primitive, so " +
              "treating repeated/missing items as an explicit escalation step (rather than assuming they'll surface " +
              "again naturally) is the recommended human practice. The most common mistake is letting a quiet " +
              "chapter stay quiet for several cycles before anyone raises it. Tip: a chapter missing two cycles in a " +
              "row should be an automatic agenda item for the next Officer Meeting, not a judgment call made fresh " +
              "each time.",
          },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("agenda-prep", "Draft this week's chapter impact agenda", "MEETING_PREP", 48),
      notifyOnEnter("prep-confirmed", "Confirm chapter impact presentation prep checklist"),
      meetingOnEnter("meeting-held", "Chapter Impact Presentation", "CHAPTER_IMPACT", 24),
      typedActionOnEnter("followups-captured", "Capture chapter impact follow-ups", "MEETING_RECAP", 24),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  {
    key: "global-operations-impact-cycle",
    name: "Global Operations Impact Cycle",
    description:
      "Run one cycle of the weekly Global Operations Impact Presentation: build the agenda, confirm each team is " +
      "ready to present, hold the meeting, and capture follow-ups. Purpose: give Communications, Expansion, and " +
      "Tech (per the operating model) a recurring forum to show real progress, proof of work, blockers, and next " +
      "commitments — and give leadership (Aveena and Brayden) a weekly read on operational health across global " +
      "teams. Typical duration: a weekly ritual closing within about 4-5 days — agenda & prep over 1-2 days, the " +
      "meeting itself around 90 minutes across all teams, follow-ups captured within 24-48 hours after. Primary " +
      "owner: the meeting facilitator; secondary owners: each team's presenter, accountable for their own slot's " +
      "content. Success definition: every team presents proof of work (not just a status claim) and leaves with " +
      "either a resolved blocker or a named next step and owner. KPIs: percent of teams presenting concrete " +
      "deliverables/proof of work (vs. vague status), percent of raised blockers with a named owner, follow-up " +
      "completion rate by next cycle, and number of blockers escalated to the Officer Meeting unresolved. Common " +
      "failure modes: a presentation that lists activity without proof (\"we worked on outreach\" instead of a " +
      "specific count or artifact), teams running over their slot because slots weren't timeboxed going in, and " +
      "blockers that get acknowledged in the room but never tracked, so they quietly recur. Hard-won note: insist on " +
      "proof of work, not narrative — a single screenshot, link, or number is worth more than two minutes of " +
      "describing effort, and it's what makes this presentation an actual accountability forum instead of a status " +
      "meeting.",
    domain: "GENERAL",
    defaultOwnerRole: "STAFF",
    escalateAfterHours: 48,
    stages: [
      {
        key: "agenda-prep",
        name: "Agenda & prep",
        description:
          "Build the agenda with a timeboxed slot per team (Communications, Expansion, Tech, and any other " +
          "presenting team) covering progress, deliverables, metrics/proof of work, blockers, and decisions needed. " +
          "Exit once every team has a confirmed slot and prompt. Owner: the meeting facilitator.",
        slaHours: 48,
        isInitial: true,
        steps: [
          {
            key: "draft-agenda",
            name: "Draft agenda",
            kind: "DOCUMENT",
            dueOffsetHours: 48,
            description:
              "Give each presenting team (Tech: portal updates, bugs fixed, features shipped, data/automation, " +
              "testing blockers; Communications/Socials: posts created or scheduled, campaign results, approvals " +
              "needed; Expansion: new areas contacted, parent/alumni outreach, chapter leads, partner conversations) " +
              "a fixed slot with the same prompt structure every cycle: progress, deliverables shown, metrics or " +
              "proof of work, blockers, decisions needed, next week's commitments. The most common mistake is " +
              "letting slots run open-ended, which lets the most talkative team eat time from the others. Tip: write " +
              "the time budget for each team directly onto the agenda (e.g. \"Tech — 20 min\") before the meeting, " +
              "not during it.",
          },
          {
            key: "check-linked-deliverables",
            name: "Check linked actions & deliverables",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Review each team's open Action Tracker items and recent activity before the meeting to spot missing " +
              "weekly progress ahead of time, rather than discovering it live. The most common mistake is taking a " +
              "team's self-report at face value without a quick cross-check against what's actually tracked in the " +
              "portal. Tip: if a team has no visible activity this week, raise it as a direct pre-meeting question " +
              "rather than letting it surface as a surprise in the room.",
          },
        ],
      },
      {
        key: "prep-confirmed",
        name: "Pre-meeting checklist confirmed",
        description:
          "Confirm each team has a presenter lined up with prepared proof of work, and that blockers/decisions " +
          "are pre-flagged. Exit once the facilitator signs off the checklist. Owner: the meeting facilitator.",
        slaHours: 24,
        steps: [
          {
            key: "confirm-presenters",
            name: "Confirm team presenters",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Confirm a specific presenter (not just \"someone from the team\") for each slot, and that they know " +
              "they need to bring proof of work, not just a verbal summary. The most common mistake is leaving the " +
              "presenter unconfirmed until the meeting starts, which produces a scramble and a thinner update. Tip: " +
              "ask presenters to drop their proof of work (link, screenshot, number) into the agenda doc ahead of " +
              "time so the meeting can move straight to discussion.",
          },
          {
            key: "flag-blockers",
            name: "Flag blockers & decisions needed",
            kind: "TASK",
            dueOffsetHours: 24,
            description:
              "Pre-flag any blocker that needs a leadership decision so it's positioned early in that team's slot, " +
              "not discovered with two minutes left. The most common mistake is burying the actual blocker behind a " +
              "wall of status updates, so it never gets real airtime. Tip: ask each presenter to lead with their " +
              "single biggest blocker, then back fill with progress — front-load the thing that needs the room's " +
              "help.",
          },
        ],
      },
      {
        key: "meeting-held",
        name: "Meeting held",
        description:
          "Hold the Global Operations Impact Presentation: record whether each team presented real progress, " +
          "capture proof of work and blockers, and decide next steps with the relevant officer. Exit once the " +
          "meeting has concluded. Owner: the facilitator.",
        slaHours: 24,
        steps: [
          { key: "hold", name: "Hold global operations impact presentation", kind: "MEETING" },
        ],
      },
      {
        key: "followups-captured",
        name: "Follow-ups captured & next-meeting prep created",
        description:
          "Convert next-week commitments and blockers into tracked actions with owners and dates, flag teams " +
          "missing updates, send the impact summary, and queue next cycle's prep. Terminal stage — exit once " +
          "follow-ups are linked. Owner: the facilitator.",
        isTerminal: true,
        steps: [
          {
            key: "capture-followups",
            name: "Capture decisions & follow-up actions",
            kind: "DOCUMENT",
            dueOffsetHours: 24,
            description:
              "Turn each team's next-week commitments and any unresolved blocker into a tracked action with a " +
              "named owner and due date, then send the impact summary. The most common mistake is recording the " +
              "commitment in meeting notes only, with nothing tracked to check against next cycle. Tip: link each " +
              "follow-up action to the relevant team/area so it shows up on that team's own operational context, not " +
              "just buried in a meeting recap.",
          },
          {
            key: "escalate-unresolved",
            name: "Escalate unresolved blockers to Officer Meeting",
            kind: "TASK",
            dueOffsetHours: 48,
            description:
              "Carry any blocker that didn't get resolved in this meeting forward to the Officer Meeting agenda, " +
              "and flag any team that missed presenting real progress. The engine has no native carry-forward " +
              "primitive, so explicitly escalating unresolved items — rather than assuming they'll be remembered — " +
              "is the recommended human practice. The most common mistake is letting an unresolved blocker simply " +
              "wait for next cycle's impact presentation instead of routing it to the officers who can actually " +
              "unblock it sooner. Tip: a blocker unresolved for two cycles in a row should always become an Officer " +
              "Meeting agenda item, not an optional one.",
          },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("agenda-prep", "Draft this week's global operations impact agenda", "MEETING_PREP", 48),
      notifyOnEnter("prep-confirmed", "Confirm global operations impact prep checklist"),
      meetingOnEnter("meeting-held", "Global Operations Impact Presentation", "WEEKLY_TEAM_IMPACT", 24),
      typedActionOnEnter("followups-captured", "Capture global operations impact follow-ups", "MEETING_RECAP", 24),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },
];
