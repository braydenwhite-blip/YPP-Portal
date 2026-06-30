// ============================================================================
// Universal Workflow Engine — blueprint catalog: Community Partners
// ============================================================================
//
// Encodes the real, already-built Chapter Partner CRM pipeline described in
// docs/PARTNER_AUTOMATION_PHASE_1.md as Universal Workflow Engine blueprints.
// These are operational playbooks layered on top of the existing Partner /
// PartnerNote data model (lib/partners-constants.ts) and CP-facing CRM actions
// (lib/partners/crm-actions.ts) — this file does not change either of those,
// it just gives chapter teams a guided, automation-backed runner for the
// process they already perform by hand.

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

export const PARTNER_BLUEPRINTS: WorkflowBlueprint[] = [
  // --------------------------------------------------------------------------
  // 1. Partner Acquisition (deepened)
  // --------------------------------------------------------------------------
  {
    key: "partner-acquisition",
    name: "Partner Acquisition",
    description:
      "Purpose: take a prospective community partner (a camp, school, community center, synagogue, " +
      "library, nonprofit, parent group, or other chapter partner) from a cold lead all the way to a " +
      "confirmed, logistics-ready Active Partnership, mirroring the real CP pipeline in " +
      "lib/partners/crm-actions.ts stage-for-stage: NOT_STARTED → RESEARCHING → REACHED_OUT → " +
      "RESPONDED → MEETING_SCHEDULED → NEEDS_PROPOSAL/PROPOSAL_SENT → NEGOTIATING → ACTIVE_PARTNERSHIP.\n\n" +
      "Typical duration: roughly 3-4 weeks end to end for a partner who responds on the standard cadence " +
      "(research ~1 week, outreach + the 5-business-day follow-up cadence ~1-2 weeks, meeting scheduling " +
      "and logistics confirmation ~1 week), longer if follow-ups stall or logistics need multiple rounds.\n\n" +
      "Primary owner: the Chapter President running the relationship end to end. Secondary owners: " +
      "chapter leadership/staff for escalations when a partner goes cold or a meeting can't be locked down, " +
      "and whoever holds the relationship-lead assignment on the Partner record once outreach begins.\n\n" +
      "Success definition: the partner reaches ACTIVE_PARTNERSHIP with a fully confirmed logistics " +
      "checklist (room/space, supervision plan, schedule, materials, access, on-site contact, safety " +
      "status, cancellation policy, communication channel all set) and a scheduled first quarterly review.\n\n" +
      "KPIs: time-to-first-response (days from REACHED_OUT to RESPONDED), percent of researched leads that " +
      "reach ACTIVE_PARTNERSHIP, days-to-meeting-scheduled after a response, and percent of partners with a " +
      "complete logistics checklist before their first session.\n\n" +
      "Common failure modes: outreach sent to a generic info@ inbox instead of a named decision-maker " +
      "stalls indefinitely — the doc specifically calls out qualifying the decision-maker before first " +
      "contact as part of Research; meetings get scheduled but logistics never get formally confirmed in " +
      "writing, which surfaces as a no-show or scrambling on day one; and follow-up silently slips past the " +
      "5-business-day cadence because nobody is watching the queue.\n\n" +
      "Hard-won notes: send the very first outreach email same-day once a decision-maker is identified — " +
      "research that goes stale loses the contextual reason for reaching out. Logistics confirmation in " +
      "writing (not a verbal yes) is what actually prevents day-one surprises; treat it as non-negotiable " +
      "even when the relationship feels warm.",
    domain: "PARTNERS",
    defaultOwnerRole: "CHAPTER_PRESIDENT",
    followUpCadenceHours: 120,
    escalateAfterHours: 168,
    stages: [
      {
        key: "research",
        name: "Research",
        description:
          "Build a short list of candidate organizations and identify the actual decision-maker for each " +
          "before any outreach goes out. Exits once at least one organization has a named, qualified " +
          "contact and a stage-RESEARCHING Partner record. Owner: Chapter President.",
        isInitial: true,
        slaHours: 168,
        steps: [
          {
            key: "identify",
            name: "Identify target organizations",
            description:
              "Pull together a short list of camps, schools, community centers, synagogues, libraries, " +
              "nonprofits, or parent groups in the chapter's area that fit YPP's program. Use the chapter's " +
              "existing network and local search rather than a generic directory dump — partners sourced " +
              "from a warm connection respond at a noticeably higher rate. The common mistake here is " +
              "listing organizations without ever checking whether they have any existing after-school or " +
              "enrichment programming; confirm fit before spending outreach time on a lead. Tip: capture " +
              "each candidate as a Partner record at stage NOT_STARTED so nothing gets lost between research " +
              "sessions.",
            dueOffsetHours: 48,
          },
          {
            key: "qualify",
            name: "Qualify fit & decision-maker",
            description:
              "For each candidate, confirm program fit and — critically — identify the specific person who " +
              "can say yes, not just a general contact line. The doc's pipeline depends on this: outreach " +
              "without a defined decision-maker target stalls, because nobody owns replying to a cold email " +
              "sent to a shared inbox. Record contactName/Title/Email/Phone on the Partner record and move " +
              "it to RESEARCHING. Tip: a phone call to the front desk asking \"who runs your after-school " +
              "partnerships\" often beats guessing from a website staff page.",
            dueOffsetHours: 96,
          },
        ],
      },
      {
        key: "outreach",
        name: "Outreach",
        description:
          "Send the first outreach message to the qualified decision-maker and hold the line on the " +
          "5-business-day follow-up cadence until they respond. Exits when the partner replies (RESPONDED) " +
          "or after a deliberate decision to keep following up. Owner: Chapter President.",
        slaHours: 168,
        steps: [
          {
            key: "first-contact",
            name: "Send first outreach",
            description:
              "Send the initial outreach email to the decision-maker using the standard outreach template " +
              "(one of the 7 deterministic templates in lib/partners/outreach-email.ts — initial outreach). " +
              "Mark it sent on the Partner record, which moves the partner to REACHED_OUT and auto-schedules " +
              "the next follow-up. The common mistake is sending a generic, copy-pasted pitch with no " +
              "specific reference to the organization; personalize at least the opening line. Tip: send " +
              "outreach the same day research qualifies the contact — momentum matters.",
            dueOffsetHours: 24,
          },
          {
            key: "follow-up",
            name: "Follow up after 5 business days",
            description:
              "If there's been no reply, send the follow-up template exactly on the 5-business-day cadence " +
              "(120 business hours) that lib/partners/follow-up.ts computes — not sooner, which can read as " +
              "pushy, and not later, which lets the lead go cold. This mirrors the doc's real " +
              "addBusinessDays/isFollowUpDue logic, which explicitly skips weekends. The common mistake is " +
              "letting the follow-up queue go unwatched so it silently slips past due; this stage's overdue " +
              "escalation exists specifically to catch that. Tip: keep the follow-up short — a one-line " +
              "bump, not a second full pitch.",
              dueOffsetHours: 120,
          },
        ],
      },
      {
        key: "response-and-meeting",
        name: "Response & Meeting Scheduling",
        description:
          "Log the partner's response, then get a conversation on the calendar with a generated meeting " +
          "brief in hand. Exits once a meeting is scheduled and its outcome logged. Owner: Chapter President.",
        slaHours: 120,
        steps: [
          {
            key: "log-response",
            name: "Log the response",
            description:
              "As soon as the partner replies, log the response on the Partner record (RESPONDED), " +
              "capturing their tone and any specifics they raised. The common mistake is treating a " +
              "lukewarm or noncommittal reply as a dead end instead of a RESPONDED partner who needs a " +
              "concrete next step; any reply, even a deferral, should move the stage forward and trigger " +
              "scheduling. Tip: respond to a positive reply within 24 hours to keep the energy from a " +
              "now-engaged contact from cooling off.",
            dueOffsetHours: 24,
          },
          {
            key: "schedule",
            name: "Schedule partner meeting",
            kind: "MEETING",
            description:
              "Schedule the actual conversation and generate the meeting brief (lib/partners/meeting-brief.ts) " +
              "— the deterministic ask, fallbacks, likely objections, prior timeline, next step, and what to " +
              "log afterward — so whoever runs the meeting walks in prepared rather than improvising. The " +
              "common mistake is scheduling without a clear ask in mind; the brief exists precisely so the " +
              "meeting has a defined outcome to aim for. Tip: propose two or three concrete time windows in " +
              "the scheduling email rather than an open-ended \"let me know when works.\"",
            dueOffsetHours: 72,
          },
          {
            key: "log-outcome",
            name: "Log meeting outcome",
            description:
              "Immediately after the meeting, log a structured outcome (interested → NEEDS_PROPOSAL, needs " +
              "more info → stays RESPONDED with a 24-hour follow-up, not a fit → NOT_A_FIT) using the " +
              "meeting-outcome note kind. The common mistake is letting days pass before writing anything " +
              "down, which loses the specifics the brief's \"what to log\" section was tracking. Tip: log " +
              "the outcome before leaving the parking lot if at all possible — memory of partner-specific " +
              "asks fades fast.",
            dueOffsetHours: 24,
          },
        ],
      },
      {
        key: "logistics",
        name: "Logistics Confirmation",
        description:
          "Work the 9-item logistics readiness checklist to a fully confirmed, in-writing state before " +
          "calling the partner Active. Exits once every checklist item is confirmed (or explicitly waived " +
          "with a documented reason). Owner: Chapter President, with chapter staff support as needed.",
        slaHours: 96,
        steps: [
          {
            key: "checklist",
            name: "Work the logistics checklist",
            description:
              "Confirm, in writing, the 9-item readiness checklist from lib/partners/logistics.ts: " +
              "room/space confirmed, supervision/chaperone plan, schedule confirmed, materials/equipment " +
              "needs, parking/access instructions, an on-site point of contact, safety/background-check " +
              "status, the cancellation policy, and an agreed communication channel. The doc explicitly " +
              "distinguishes \"confirmed but incomplete\" from fully ready — don't mark the stage done while " +
              "items are still open. The common mistake is treating a verbal yes from the partner as " +
              "confirmation; get each item in writing (email is enough) so there's a record if something " +
              "is disputed later. Tip: send one consolidated logistics-confirmation email covering all 9 " +
              "items rather than chasing them piecemeal — the template in outreach-email.ts is built for " +
              "exactly this.",
            kind: "FORM",
            dueOffsetHours: 96,
          },
        ],
      },
      {
        key: "active",
        name: "Active Partnership",
        description:
          "The partner is confirmed, logistics-ready, and live. Terminal stage — exit criteria is simply " +
          "reaching ACTIVE_PARTNERSHIP with a confirmed logistics checklist. Owner: Chapter President, " +
          "handed to ongoing relationship maintenance (the quarterly review blueprint) from here.",
        isTerminal: true,
        steps: [
          {
            key: "confirm-active",
            name: "Confirm partner as Active",
            description:
              "Move the Partner record to ACTIVE_PARTNERSHIP and log a CLOSED-the-acquisition-loop note " +
              "summarizing how the relationship was won — this becomes the first entry future check-ins " +
              "reference. The common mistake is letting the record sit at NEGOTIATING or PROPOSAL_SENT " +
              "after the partner has effectively said yes and logistics are done; the stage should reflect " +
              "reality promptly. Tip: this is also the right moment to assign or confirm the " +
              "relationshipLeadId so the partner isn't ownerless going into delivery.",
            dueOffsetHours: 24,
          },
          {
            key: "handoff",
            name: "Hand off to relationship maintenance",
            description:
              "Hand the now-active partner off to ongoing relationship maintenance — weekly/periodic " +
              "check-ins and the first quarterly review get scheduled automatically from here. The common " +
              "mistake is treating ACTIVE_PARTNERSHIP as \"done\" rather than the start of a maintenance " +
              "cadence; partners that go unchecked for a quarter are the ones that quietly lapse. Tip: this " +
              "step is optional precisely because the automation below starts the quarterly-review workflow " +
              "regardless — use it to flag anything the next owner should know.",
            isRequired: false,
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("research", "Begin partner research", 48),
      typedActionOnEnter("outreach", "Send first outreach to the partner", "OUTREACH", 24),
      notifyOnEnter("outreach", "Time to reach out to the partner"),
      typedActionOnEnter(
        "response-and-meeting",
        "Log the partner's response and schedule a meeting",
        "RELATIONSHIP",
        24
      ),
      meetingOnEnter("response-and-meeting", "Partner meeting", "GENERIC", 72),
      typedActionOnEnter(
        "logistics",
        "Confirm partner logistics checklist in writing",
        "LOGISTICS",
        96
      ),
      notifyOnEnter("active", "Partner is now active — handing off to relationship maintenance"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
      startWorkflowOnComplete(
        "partner-quarterly-review",
        "Schedule the first quarterly check-in for this new partner"
      ),
    ],
  },

  // --------------------------------------------------------------------------
  // 2. Partner Prospect Research
  // --------------------------------------------------------------------------
  {
    key: "partner-prospect-research",
    name: "Partner Prospect Research",
    description:
      "Purpose: run the Research sub-process of partner acquisition as a standalone, dedicated drive — " +
      "for example a chapter spending a focused sprint to build a qualified target list before any " +
      "outreach goes out, rather than researching one lead at a time inside an acquisition workflow. " +
      "Produces a batch of qualified, decision-maker-identified candidates ready to be handed off into " +
      "individual partner-acquisition instances.\n\n" +
      "Typical duration: about 1-2 weeks for a focused sprint (sourcing ~3-4 days, qualification/scoring " +
      "~3-4 days, handoff ~1-2 days), scaling with how many candidates the chapter wants in the batch.\n\n" +
      "Primary owner: Chapter President running the sprint. Secondary owners: chapter staff or volunteers " +
      "who can help source candidates, and leadership for escalation if the chapter can't find enough " +
      "qualified candidates in its area.\n\n" +
      "Success definition: a batch of candidates each scored for fit and each with a confirmed, named " +
      "decision-maker, with a partner-acquisition instance started for every candidate that clears the bar.\n\n" +
      "KPIs: number of qualified candidates produced per sprint, percent of sourced candidates that pass " +
      "qualification, percent of qualified candidates whose acquisition workflow later reaches " +
      "ACTIVE_PARTNERSHIP, and average research time per qualified candidate.\n\n" +
      "Common failure modes: sourcing a long list of organizations with no real fit check, which just " +
      "pushes the qualification problem downstream — the doc is explicit that outreach without a defined " +
      "decision-maker target stalls, so a research sprint that doesn't nail down a named contact for each " +
      "candidate hasn't actually finished its job, it's only deferred it. Another common failure is " +
      "candidates sitting qualified for weeks before being handed off, by which point the research (school " +
      "year calendar, current programming, staff turnover) has gone stale.\n\n" +
      "Hard-won notes: this reuses the same scoring and conversion contract as lib/partners/research/* " +
      "(PartnerResearchCandidate, scoring, candidate-to-partner conversion, dedupe) — treat this blueprint " +
      "as the human process wrapped around that existing data contract, not a new one. Hand candidates off " +
      "promptly; a qualified candidate sitting idle is a wasted research cycle.",
    domain: "PARTNERS",
    defaultOwnerRole: "CHAPTER_PRESIDENT",
    followUpCadenceHours: 96,
    escalateAfterHours: 168,
    stages: [
      {
        key: "source",
        name: "Source candidates",
        description:
          "Build the raw candidate list — camps, schools, community centers, synagogues, libraries, " +
          "nonprofits, parent groups — from the chapter's network and local search. Exits once a batch of " +
          "candidates exists as PartnerResearchCandidate-shaped entries (or NOT_STARTED Partner records). " +
          "Owner: Chapter President.",
        isInitial: true,
        slaHours: 96,
        steps: [
          {
            key: "list-candidates",
            name: "Build the candidate list",
            description:
              "Gather a batch of candidate organizations using warm connections first, then local search " +
              "and directories to fill gaps. The common mistake is over-indexing on directory search and " +
              "under-using the chapter's existing network — warm-sourced candidates qualify and respond at " +
              "a meaningfully higher rate than cold directory entries. Tip: aim for a batch (e.g. 10-15 " +
              "candidates) rather than a single lead, so qualification can be comparative and the strongest " +
              "candidates rise to the top.",
            dueOffsetHours: 72,
          },
          {
            key: "dedupe",
            name: "Check for duplicates",
            description:
              "Run the batch through duplicate detection (lib/partners/duplicate-detection.ts — name, " +
              "website, email, phone scoring, ignoring generic email domains) before investing qualification " +
              "time, so the chapter isn't re-researching an organization that's already a Partner record. " +
              "The common mistake is skipping this and rediscovering an existing PAUSED or NOT_A_FIT " +
              "partner as if it were new. Tip: a near-duplicate match is worth a quick look at that " +
              "partner's history before deciding whether to re-engage or treat it as genuinely new.",
            dueOffsetHours: 96,
          },
        ],
      },
      {
        key: "qualify-score",
        name: "Qualify & score fit",
        description:
          "Score each surviving candidate for program fit and identify a named decision-maker for the " +
          "ones worth pursuing. Exits once every candidate in the batch has either a fit score and " +
          "decision-maker contact, or is dropped with a reason. Owner: Chapter President.",
        slaHours: 96,
        steps: [
          {
            key: "score-fit",
            name: "Score candidate fit",
            kind: "APPROVAL",
            description:
              "Apply the research scoring logic (lib/partners/research/*) to rank candidates by fit — " +
              "program type match, proximity, existing enrichment programming, organization size. The common " +
              "mistake is scoring purely on \"do they have kids,\" without checking whether they already run " +
              "competing after-school programming that makes them a harder sell. Tip: treat the score as a " +
              "prioritization tool, not a hard gate — a mid-score candidate with an unusually strong warm " +
              "connection can outperform a high-score cold one.",
            dueOffsetHours: 48,
          },
          {
            key: "find-decision-maker",
            name: "Identify decision-maker per candidate",
            description:
              "For every candidate that scores well enough to pursue, find and record the specific person " +
              "who can say yes — not a general office line. This is the same qualification the doc " +
              "highlights as the make-or-break step for acquisition outreach later; doing it now, in a " +
              "batch, is the whole point of running research as its own drive. The common mistake is " +
              "marking a candidate \"qualified\" with only an info@ contact, which just pushes the same " +
              "stall downstream into acquisition. Tip: a quick phone call asking who runs partnerships " +
              "often resolves this faster than scouring a website staff directory.",
            dueOffsetHours: 96,
          },
        ],
      },
      {
        key: "handoff",
        name: "Handoff to acquisition",
        description:
          "Convert each qualified candidate into a live Partner record and start its own " +
          "partner-acquisition workflow instance. Terminal stage — exit criteria is every qualified " +
          "candidate in the batch handed off. Owner: Chapter President.",
        isTerminal: true,
        steps: [
          {
            key: "convert",
            name: "Convert qualified candidates to partner records",
            description:
              "For each candidate that cleared qualification, the qualified candidate becomes a Partner " +
              "record at stage RESEARCHING/REACHED_OUT and a partner-acquisition workflow instance is " +
              "started for it — this is the explicit handoff point between the two blueprints. The common " +
              "mistake is batching the conversion and then letting the new Partner records sit at " +
              "RESEARCHING without anyone actually starting outreach; conversion should immediately produce " +
              "an active acquisition instance, not just a database row. Tip: use the existing candidate→" +
              "partner conversion contract in lib/partners/research/* rather than re-keying candidate data " +
              "by hand.",
            dueOffsetHours: 48,
          },
          {
            key: "start-acquisition",
            name: "Start acquisition workflows",
            description:
              "Kick off a partner-acquisition instance for every converted candidate so the relationship " +
              "owner has a guided runner from REACHED_OUT onward instead of starting from a blank slate. " +
              "The common mistake is treating this research sprint's output as a static list to \"get to " +
              "later\" rather than immediately operationalizing it. Tip: assign a relationship lead at " +
              "conversion time, even informally, so each new acquisition instance has a clear owner from " +
              "the start.",
            dueOffsetHours: 48,
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("source", "Start sourcing partner research candidates", 72),
      notifyOnEnter("qualify-score", "Candidates ready to qualify and score"),
      typedActionOnEnter(
        "qualify-score",
        "Score candidates and identify decision-makers",
        "RELATIONSHIP",
        96
      ),
      typedActionOnEnter(
        "handoff",
        "Convert qualified candidates and start acquisition workflows",
        "PARTNERSHIP",
        48
      ),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 3. Partner Quarterly Review
  // --------------------------------------------------------------------------
  {
    key: "partner-quarterly-review",
    name: "Partner Quarterly Review",
    description:
      "Purpose: a recurring relationship-health check for an ACTIVE_PARTNERSHIP partner, grounded in the " +
      "doc's weekly check-in cadence and the real PartnerNote.kind = CHECK_IN concept — this is the " +
      "quarterly cousin of that same check-in pattern, pulled together into a deliberate review rather " +
      "than an ad hoc note.\n\n" +
      "Typical duration: about 3-5 days from kickoff to next-review-scheduled (history pull ~1 day, the " +
      "actual check-in conversation ~1-2 days to schedule and hold, recording the outcome same-day).\n\n" +
      "Primary owner: the partner's relationship lead (relationshipLeadId on the Partner record), usually " +
      "the Chapter President. Secondary owner: chapter leadership for partners flagged with unresolved " +
      "issues during the review.\n\n" +
      "Success definition: a fresh CHECK_IN note is on the partner's timeline, any open issues are " +
      "surfaced and either resolved or explicitly tracked, and the next quarterly review is scheduled " +
      "~90 days out.\n\n" +
      "KPIs: percent of active partners with a check-in in the last quarter, average days between " +
      "scheduled and actual review date, percent of reviews that surface a previously-unlogged issue, and " +
      "partner retention rate (active partners that remain active or complete vs. lapse to PAUSED).\n\n" +
      "Common failure modes: quarterly reviews get skipped for partners that \"seem fine,\" which is " +
      "exactly the doc's stuck-detection problem in reverse — a partner with no nextFollowUpAt or no " +
      "relationship lead is flagged stuck precisely because silence isn't the same as health. Another " +
      "failure mode is running the check-in conversation but never writing anything down, so the next " +
      "quarter's review has no history to build on.\n\n" +
      "Hard-won notes: pull the relationship history before the conversation, not during it — showing up " +
      "to a check-in already knowing the last contact date and any open issues makes the conversation feel " +
      "like genuine relationship management rather than a generic check-in script.",
    domain: "PARTNERS",
    defaultOwnerRole: "CHAPTER_PRESIDENT",
    followUpCadenceHours: 2160,
    escalateAfterHours: 240,
    stages: [
      {
        key: "pull-history",
        name: "Pull relationship history",
        description:
          "Gather the partner's recent notes, last contact date, and any issue history before the " +
          "conversation happens. Exits once the reviewer has a clear picture of where the relationship " +
          "stands. Owner: relationship lead.",
        isInitial: true,
        slaHours: 48,
        steps: [
          {
            key: "review-timeline",
            name: "Review recent notes and last contact date",
            description:
              "Pull the partner's PartnerNote timeline and lastContactedAt to see what's happened since the " +
              "last review — outreach, meetings, issues, prior check-ins. The common mistake is skimming " +
              "only the most recent note instead of the full quarter's timeline, which misses a pattern " +
              "(e.g. two unresolved minor issues that individually seemed small). Tip: specifically check " +
              "for any ISSUE notes without a matching ISSUE_RESOLVED — those need to be raised in the " +
              "conversation even if they seem to have quietly gone away.",
            dueOffsetHours: 24,
          },
          {
            key: "check-issue-history",
            name: "Check for unresolved issues",
            description:
              "Confirm whether any open issues exist on the partner record before the check-in, so the " +
              "conversation can address them directly rather than the partner having to bring them up " +
              "themselves. The common mistake is letting an issue the partner already raised get rediscovered " +
              "by them in the quarterly conversation, which reads as the chapter not paying attention. Tip: " +
              "if an issue is open, consider routing it through partner-recovery instead of waiting for this " +
              "quarterly cadence to surface it.",
            dueOffsetHours: 48,
          },
        ],
      },
      {
        key: "check-in",
        name: "Check-in conversation",
        description:
          "Hold the actual relationship-health conversation with the partner's point of contact. Exits " +
          "once the conversation has happened and initial impressions are captured. Owner: relationship " +
          "lead.",
        slaHours: 72,
        steps: [
          {
            key: "schedule-checkin",
            name: "Schedule the check-in conversation",
            kind: "MEETING",
            description:
              "Reach out using the check-in email template (one of the 7 deterministic templates in " +
              "lib/partners/outreach-email.ts) to set up a short call or in-person conversation. The common " +
              "mistake is letting this slide to an email-only check-in every quarter — a real conversation " +
              "surfaces concerns an email reply won't. Tip: keep it short and low-pressure; quarterly " +
              "check-ins work best when they don't feel like an audit.",
            dueOffsetHours: 48,
          },
          {
            key: "hold-conversation",
            name: "Hold the conversation",
            description:
              "Walk through how the partnership is going from their side, surface any issues pulled from " +
              "history, and ask directly whether anything needs to change. The common mistake is making the " +
              "check-in entirely about YPP's needs (scheduling, logistics) rather than genuinely asking how " +
              "it's working for the partner. Tip: end by confirming the partner's continued commitment in " +
              "their own words — that's the line you'll want to reference if a renewal or recovery " +
              "conversation comes up later.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "record-and-schedule",
        name: "Record outcome & schedule next review",
        description:
          "Log a CHECK_IN note capturing the outcome and schedule the next quarterly review ~90 days out. " +
          "Terminal stage — exit criteria is the note logged and the follow-up scheduled. Owner: " +
          "relationship lead.",
        isTerminal: true,
        steps: [
          {
            key: "log-checkin",
            name: "Log the check-in outcome",
            description:
              "Write a CHECK_IN note (PartnerNote.kind = CHECK_IN) summarizing the conversation — sentiment, " +
              "any new concerns, anything promised on either side. The common mistake is logging a one-word " +
              "\"good\" note that gives the next quarter's reviewer nothing to work from. Tip: note any " +
              "specific commitment made (by either side) explicitly, so it can be checked next quarter.",
            dueOffsetHours: 24,
          },
          {
            key: "schedule-next",
            name: "Schedule next quarterly review",
            description:
              "Set the next review date roughly 90 days out via the SCHEDULE_FOLLOW_UP automation, so the " +
              "partner doesn't silently fall off the relationship-maintenance cadence. The common mistake is " +
              "treating \"the partnership seems stable\" as a reason to skip scheduling the next review — " +
              "the doc's stuck-detection logic flags exactly this kind of unscheduled silence. Tip: if the " +
              "conversation surfaced a real concern, schedule sooner than 90 days rather than waiting for " +
              "the default cadence.",
            isRequired: false,
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("pull-history", "Pull partner relationship history for review", 24),
      notifyOnEnter("check-in", "Schedule the partner quarterly check-in"),
      meetingOnEnter("check-in", "Partner quarterly check-in", "GENERIC", 48),
      typedActionOnEnter(
        "record-and-schedule",
        "Log check-in outcome and schedule next review",
        "RELATIONSHIP",
        24
      ),
      {
        name: "Schedule next quarterly review",
        trigger: "ON_STAGE_ENTER",
        action: "SCHEDULE_FOLLOW_UP",
        stageKey: "record-and-schedule",
        config: { offsetHours: 2160 },
      },
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 4. Partner Renewal
  // --------------------------------------------------------------------------
  {
    key: "partner-renewal",
    name: "Partner Renewal",
    description:
      "Purpose: triggered by an approaching PartnerAgreement expiry (kinds MOU/CONTRACT/INFORMAL; " +
      "statuses DRAFT/SENT/SIGNED/EXPIRED/TERMINATED) to deliberately decide whether and how to renew a " +
      "partnership before the existing agreement lapses, rather than letting it expire by default.\n\n" +
      "Typical duration: about 2-3 weeks (impact review ~1 week, renegotiation ~1-2 weeks, new agreement " +
      "signature ~3-5 days), started early enough that it completes before the current agreement's " +
      "EXPIRED date.\n\n" +
      "Primary owner: the partner's relationship lead (typically Chapter President). Secondary owners: " +
      "chapter leadership for renegotiation decisions involving material changes (scope, cost, schedule), " +
      "and whoever holds agreement-drafting responsibility for producing the new MOU/contract.\n\n" +
      "Success definition: either a new PartnerAgreement reaches SIGNED status before the old one expires, " +
      "or a deliberate, documented decision not to renew is recorded — the failure mode this blueprint " +
      "exists to prevent is an agreement quietly lapsing to EXPIRED with nobody having made an active " +
      "choice.\n\n" +
      "KPIs: percent of agreements renewed before their expiry date (vs. lapsing to EXPIRED), average " +
      "days-to-renewal-decision from workflow start, percent of renewals that change terms vs. roll over " +
      "unchanged, and partner retention rate across a renewal cycle.\n\n" +
      "Common failure modes: starting the renewal conversation too close to the expiry date leaves no room " +
      "for renegotiation if the partner wants changes — the doc's broader lesson about outreach needing a " +
      "defined decision-maker applies here too, since renewal conversations stall the same way cold " +
      "outreach does when they aren't aimed at whoever actually signs. A second failure mode is an " +
      "agreement sliding to EXPIRED purely from inattention, with the relationship otherwise healthy.\n\n" +
      "Hard-won notes: ground the renewal conversation in concrete delivered impact (sessions held, " +
      "students served, the Chapter Impact Meeting metrics from lib/partners/metrics.ts) rather than just " +
      "asking \"want to continue?\" — a partner that sees the impact in numbers renews more readily than " +
      "one asked to renew on goodwill alone.",
    domain: "PARTNERS",
    defaultOwnerRole: "CHAPTER_PRESIDENT",
    followUpCadenceHours: 96,
    escalateAfterHours: 168,
    stages: [
      {
        key: "review-impact",
        name: "Review relationship & impact",
        description:
          "Pull together what the partnership has delivered since the last agreement was signed — " +
          "sessions held, students served, issues raised and resolved — to ground the renewal decision in " +
          "fact rather than impression. Exits once an impact summary exists. Owner: relationship lead.",
        isInitial: true,
        slaHours: 96,
        steps: [
          {
            key: "pull-metrics",
            name: "Pull delivered impact metrics",
            description:
              "Use the Chapter Impact Meeting metrics (lib/partners/metrics.ts) to summarize what this " +
              "partnership has actually delivered over the agreement period. The common mistake is going " +
              "into a renewal conversation with only anecdotal impressions of how it's gone; concrete " +
              "numbers make the case for renewal (or reveal that renewal isn't actually warranted) far more " +
              "clearly. Tip: include both YPP-side numbers (sessions delivered) and partner-side signals " +
              "(attendance, partner feedback) if available.",
            dueOffsetHours: 48,
          },
          {
            key: "review-relationship-notes",
            name: "Review relationship notes and open issues",
            description:
              "Read through the PartnerNote timeline for the agreement period, paying particular attention " +
              "to any ISSUE notes and how they were resolved. The common mistake is skipping this and being " +
              "surprised mid-renegotiation by a friction point the partner remembers vividly but the chapter " +
              "never formally tracked. Tip: if there's an unresolved issue, address it before renewal talks " +
              "start rather than letting it complicate the negotiation.",
            dueOffsetHours: 72,
          },
        ],
      },
      {
        key: "renegotiate",
        name: "Renegotiate terms or decide not to renew",
        description:
          "This is the workflow's key decision point: based on the impact review, either renegotiate terms " +
          "for a new agreement or make a deliberate call not to renew. Exits once a clear go/no-go decision " +
          "is recorded. Owner: relationship lead, with chapter leadership input on material changes.",
        slaHours: 168,
        steps: [
          {
            key: "renewal-decision",
            name: "Decide: renew, renegotiate, or close",
            kind: "DECISION",
            description:
              "Make and record the explicit decision: renew on the same terms, renew with changed terms " +
              "(scope, schedule, cost), or not renew. This is a genuine branch point — the linear engine " +
              "models one path forward (toward a new signed agreement), so if the decision is not to renew, " +
              "do not advance this workflow further; instead close the Partner record (PAUSED if it might " +
              "resume later, or COMPLETED/NOT_A_FIT if the relationship is ending for good) and log a CLOSED " +
              "note explaining why, outside this workflow's remaining stages. The common mistake is letting " +
              "a non-renewal decision drift without ever being formally recorded, leaving the agreement to " +
              "simply lapse to EXPIRED. Tip: make this decision with enough lead time before the current " +
              "agreement's expiry date to actually act on it either way.",
            dueOffsetHours: 96,
          },
          {
            key: "negotiate-terms",
            name: "Negotiate new terms",
            description:
              "If renewing, work out any changes to scope, schedule, or cost with the partner's " +
              "decision-maker directly — not a day-to-day contact who can't actually agree to changes. The " +
              "common mistake mirrors the doc's outreach lesson: negotiating with someone who isn't the " +
              "actual decision-maker stalls the renewal the same way cold outreach to a generic inbox " +
              "stalls acquisition. Tip: propose the rollover-with-no-changes option explicitly if that's " +
              "genuinely the simplest path — it's often what both sides actually want.",
            dueOffsetHours: 120,
          },
        ],
      },
      {
        key: "agreement-signed",
        name: "New agreement signed",
        description:
          "Get the renegotiated agreement drafted, sent, and signed before the old one expires. Exits once " +
          "the new PartnerAgreement reaches SIGNED status. Owner: relationship lead.",
        slaHours: 96,
        steps: [
          {
            key: "draft-agreement",
            name: "Draft the new agreement",
            kind: "DOCUMENT",
            description:
              "Draft the new MOU/contract/informal agreement reflecting whatever was negotiated, and move " +
              "it to SENT status with the partner. The common mistake is drafting from a blank template " +
              "instead of starting from the prior agreement and tracking changes, which both slows drafting " +
              "and makes it harder for the partner to see exactly what's different. Tip: highlight what " +
              "changed from the previous agreement in the send-along message so the partner isn't re-reading " +
              "the whole document looking for differences.",
            dueOffsetHours: 48,
          },
          {
            key: "get-signature",
            name: "Get the agreement signed",
            description:
              "Follow up until the new agreement reaches SIGNED status, treating a stalled signature the " +
              "same way the doc treats a stalled outreach follow-up — worth a deliberate nudge on a defined " +
              "cadence rather than an open-ended wait. The common mistake is letting a SENT agreement sit " +
              "unsigned past the old agreement's expiry date with no follow-up. Tip: send the signature " +
              "request to the same decision-maker who agreed to terms, not back to a general contact.",
            dueOffsetHours: 96,
          },
        ],
      },
      {
        key: "active",
        name: "Active",
        description:
          "The renewed partnership is under a signed agreement and active. Terminal stage — exit criteria " +
          "is SIGNED status on the new PartnerAgreement. Owner: relationship lead.",
        isTerminal: true,
        steps: [
          {
            key: "confirm-renewed",
            name: "Confirm renewed partnership is active",
            description:
              "Record the new agreement's signed date and confirm the partnership continues at " +
              "ACTIVE_PARTNERSHIP, then make sure the next quarterly review and the next renewal cycle (at " +
              "the new agreement's expiry) are both on track to be scheduled. The common mistake is treating " +
              "a signed renewal as the end of the process rather than the start of the next cycle — without " +
              "this step the chapter is right back to risking a quiet lapse at the next expiry. Tip: note " +
              "the new agreement's expiry date prominently so it surfaces again well before it's due.",
            dueOffsetHours: 24,
          },
        ],
      },
    ],
    automations: [
      actionOnEnter("review-impact", "Pull delivered impact ahead of renewal", 48),
      notifyOnEnter("renegotiate", "Renewal decision needed"),
      typedActionOnEnter(
        "renegotiate",
        "Decide whether to renew, renegotiate, or close the partnership",
        "PARTNERSHIP",
        96
      ),
      typedActionOnEnter("agreement-signed", "Draft and send the new agreement", "ADMIN_TASK", 48),
      notifyOnEnter("active", "Partnership renewed and active"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 5. Partner Relationship Recovery
  // --------------------------------------------------------------------------
  {
    key: "partner-recovery",
    name: "Partner Relationship Recovery",
    description:
      "Purpose: triggered when a partner has gone quiet or an issue is raised (the real " +
      "PartnerNote.kind = ISSUE concept) — gets a deliberate, time-bound recovery effort started instead " +
      "of letting the relationship drift toward an unplanned lapse.\n\n" +
      "Typical duration: about 1-2 weeks for a successful recovery (assessment ~1-2 days, direct outreach " +
      "and resolution ~5-7 days mirroring the standard follow-up cadence, closing the loop ~1-2 days); can " +
      "extend further if the partner needs to be paused rather than resolved.\n\n" +
      "Primary owner: the partner's relationship lead. Secondary owner: chapter leadership, who should be " +
      "looped in for any issue severe enough to risk the relationship outright (the doc's issue model " +
      "explicitly tracks severity and escalation).\n\n" +
      "Success definition: either the issue is resolved and the relationship returns to its prior active " +
      "stage (ISSUE_RESOLVED), or — if it can't be resolved — the relationship is deliberately paused or " +
      "closed with a documented reason, rather than silently going cold.\n\n" +
      "KPIs: time-to-acknowledgment (hours from issue raised to first response), percent of issues " +
      "resolved vs. ending in PAUSED/NOT_A_FIT, average days-to-resolution, and recurrence rate (issues " +
      "reopened within the same quarter).\n\n" +
      "Common failure modes: an issue gets raised but sits unacknowledged because nobody owns the recovery " +
      "step — this is precisely what escalateOverdue exists to catch in this blueprint. The doc's broader " +
      "lesson about decision-makers applies here too: recovery outreach aimed at a day-to-day contact " +
      "instead of the actual decision-maker often can't resolve the underlying issue even with a fast " +
      "response.\n\n" +
      "Hard-won notes: acknowledge fast even before a full resolution plan exists — a same-day \"we heard " +
      "you, here's what we're doing about it\" response preserves trust even when the actual fix takes " +
      "longer. Silence from the chapter while \"figuring it out\" is what turns a fixable issue into a " +
      "lost partner.",
    domain: "PARTNERS",
    defaultOwnerRole: "CHAPTER_PRESIDENT",
    followUpCadenceHours: 120,
    escalateAfterHours: 48,
    stages: [
      {
        key: "acknowledge-assess",
        name: "Acknowledge & assess severity",
        description:
          "Acknowledge the issue (or the partner's silence) immediately and assess how severe it is. " +
          "Exits once severity is recorded and a response owner is assigned. Owner: relationship lead.",
        isInitial: true,
        slaHours: 24,
        steps: [
          {
            key: "acknowledge",
            name: "Acknowledge the issue",
            description:
              "Send a same-day acknowledgment to the partner — even a short \"we heard you and are looking " +
              "into it\" — before a full resolution plan exists. The common mistake is waiting to respond " +
              "until there's a complete answer, which reads as silence to the partner in the meantime. Tip: " +
              "acknowledgment and resolution are separate steps for a reason; don't let the need for the " +
              "second delay the first.",
            dueOffsetHours: 12,
          },
          {
            key: "assess-severity",
            name: "Assess severity",
            kind: "DECISION",
            description:
              "Log the issue (PartnerNote.kind = ISSUE) with a severity assessment — minor friction, " +
              "moderate concern, or relationship-threatening — and flag it for escalation if severe. The " +
              "common mistake is under-rating severity to avoid involving leadership; the doc's issue model " +
              "specifically tracks escalation because some issues genuinely need a more senior voice. Tip: " +
              "when in doubt, escalate — a leadership check-in that turns out to be unnecessary costs far " +
              "less than a partner lost because an issue was under-rated.",
            dueOffsetHours: 24,
          },
        ],
      },
      {
        key: "direct-outreach",
        name: "Direct outreach to resolve",
        description:
          "Reach out directly to work the issue toward resolution, following up on the standard cadence if " +
          "it doesn't resolve immediately. Exits once a resolution conversation has happened. Owner: " +
          "relationship lead, with leadership involved for escalated issues.",
        slaHours: 120,
        steps: [
          {
            key: "resolve-outreach",
            name: "Reach out to resolve the issue",
            kind: "MEETING",
            description:
              "Have the actual conversation — call or meet rather than relying purely on email for anything " +
              "beyond minor severity — aimed at the partner's real decision-maker. The common mistake here " +
              "mirrors the doc's broader lesson: resolution outreach aimed at a day-to-day contact instead " +
              "of whoever can actually make a change often can't resolve the underlying issue even with a " +
              "prompt, well-intentioned response. Tip: come with at least one concrete proposed fix rather " +
              "than just asking the partner what they want — it shows the issue is being taken seriously.",
            dueOffsetHours: 72,
          },
          {
            key: "follow-up-resolution",
            name: "Follow up if unresolved",
            description:
              "If the first conversation doesn't fully resolve things, follow up on the standard cadence " +
              "(treat it like the doc's 5-business-day outreach follow-up rhythm) rather than letting it " +
              "drift. The common mistake is a single resolution attempt followed by silence if it doesn't " +
              "immediately work. Tip: each follow-up should reference the specific commitment made in the " +
              "prior conversation, not restart the issue from scratch.",
            isRequired: false,
            dueOffsetHours: 120,
          },
        ],
      },
      {
        key: "resolution-outcome",
        name: "Resolution confirmed or relationship paused",
        description:
          "Record the actual outcome: the issue is resolved and the relationship returns to normal, or it " +
          "can't be resolved and the partner is paused. Exits once the outcome is logged. Owner: " +
          "relationship lead.",
        slaHours: 48,
        steps: [
          {
            key: "confirm-outcome",
            name: "Confirm and log the outcome",
            kind: "DECISION",
            description:
              "Log the final outcome explicitly — ISSUE_RESOLVED with the relationship returning to its " +
              "prior active stage, or a decision that it can't be resolved right now. The common mistake is " +
              "letting an issue fade from attention without ever logging a clear outcome, leaving the " +
              "partner's status ambiguous. Tip: be honest in the note about whether this was a full " +
              "resolution or a temporary patch — that distinction matters for the next quarterly review.",
            dueOffsetHours: 24,
          },
        ],
      },
      {
        key: "closed",
        name: "Closed",
        description:
          "Recovery effort is complete. This blueprint models the more common path — successful resolution " +
          "back to an active relationship — as its terminal stage. The alternative path, where the issue " +
          "can't be resolved and the partner is instead moved to PAUSED (relationship on hold, may resume) " +
          "or NOT_A_FIT (relationship ending), is not a separate modeled stage since the linear engine " +
          "resolves one path per blueprint; when that's the real outcome, log a CLOSED note with the reason " +
          "and update the Partner record's stage directly rather than continuing through this workflow's " +
          "remaining steps. Owner: relationship lead, with leadership sign-off for a pause/close on an " +
          "escalated issue.",
        isTerminal: true,
        steps: [
          {
            key: "close-loop",
            name: "Close the loop with the partner",
            description:
              "Send a closing message to the partner confirming the resolution (or, on the alternative " +
              "path, communicating the pause/close decision respectfully) and log a CLOSED note " +
              "(PartnerNote.kind = CLOSED) summarizing what happened end to end. The common mistake is " +
              "resolving the issue internally — updating the stage, moving on — without ever closing the " +
              "loop with the partner directly, leaving them unsure whether it was actually addressed. Tip: " +
              "even a paused/not-a-fit outcome lands better when communicated proactively rather than the " +
              "partner noticing the silence themselves.",
            dueOffsetHours: 24,
          },
          {
            key: "schedule-recheck",
            name: "Schedule a recheck if resolved",
            description:
              "If the issue was resolved, schedule a short recheck (not a full quarterly review) a few " +
              "weeks out to confirm the fix held, rather than assuming a single good conversation settled " +
              "things permanently. The common mistake is treating ISSUE_RESOLVED as the end of the story " +
              "with no follow-through to confirm it stuck. Tip: this step is optional precisely because " +
              "the alternative pause/close path doesn't need a recheck — use judgment based on which path " +
              "actually happened.",
            isRequired: false,
            dueOffsetHours: 336,
          },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("acknowledge-assess", "Acknowledge the partner issue", "RELATIONSHIP", 12),
      notifyOnEnter("acknowledge-assess", "Partner issue raised — acknowledge and assess severity"),
      typedActionOnEnter("direct-outreach", "Reach out directly to resolve the issue", "RELATIONSHIP", 72),
      notifyOnEnter("resolution-outcome", "Confirm and log the recovery outcome"),
      notifyOnEnter("closed", "Partner recovery closed"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },
];
