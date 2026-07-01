// ============================================================================
// Universal Workflow Engine — blueprint catalog: Operations & Fundraising
// ============================================================================
//
// Grounded in docs/EXECUTION_OS.md (the Weekly Review's Triage -> Meetings ->
// Entity health -> Decisions -> Wrap-up rhythm, and "decision -> action
// follow-through") and docs/STRATEGIC_INITIATIVES.md (health/momentum/risk
// language for initiative-level review). These wrap the existing Command
// Center / Weekly Review / Action Tracker — they don't replace them.

import { actionOnEnter, autoAdvanceWhenReady, escalateOverdue, notifyOnEnter, typedActionOnEnter } from "./helpers";
import type { WorkflowBlueprint } from "./types";

export const OPERATIONS_BLUEPRINTS: WorkflowBlueprint[] = [
  // --------------------------------------------------------------------------
  // 1. Grant Application (deepened)
  // --------------------------------------------------------------------------
  {
    key: "grant-application",
    name: "Grant Application",
    description:
      "Identify, draft, submit, and report on a single grant — from spotting a real funding fit " +
      "through filing the post-award report that keeps the relationship open for next cycle.\n\n" +
      "Typical duration: 3-5 weeks end to end (identify ~4 days, draft ~9-10 days including internal " +
      "review, submit ~1 day, then a long tail to the outcome and any required report).\n\n" +
      "Primary owner: the Leadership officer driving the application. Secondary owners: whoever owns " +
      "the program budget the grant would fund (their numbers feed the budget narrative) and an " +
      "internal reviewer who is not the drafter.\n\n" +
      "Success definition: the application is submitted before the funder's deadline with a narrative " +
      "and budget that were both independently reviewed, and — win or lose — the outcome and any " +
      "required report are filed on time so the relationship stays open for future cycles.\n\n" +
      "KPIs: days from identify to submit against the funder's stated deadline, percent of " +
      "applications that get an internal review before submission (not skipped under deadline " +
      "pressure), and percent of awarded grants with their report filed on time.\n\n" +
      "Common failure modes: eligibility gets confirmed late, after real drafting time has already " +
      "gone in, because nobody checked the funder's restrictions up front; the budget narrative is " +
      "written by the same person who wrote the program narrative with no independent sanity check, " +
      "so math errors or unrealistic asks make it to submission; and the post-award report quietly " +
      "slips because there's no automation tying it to the award date the way the submission deadline " +
      "had one.\n\n" +
      "Hard-won notes: confirm eligibility and restrictions before writing a single sentence of " +
      "narrative — it's the cheapest possible point to walk away from a bad fit. Treat the report as " +
      "part of the same workflow as the application, not a separate future to-do; funders remember " +
      "who reports on time.",
    domain: "FUNDRAISING",
    defaultOwnerSubtype: "LEADERSHIP",
    escalateAfterHours: 96,
    stages: [
      {
        key: "identify",
        name: "Identify",
        description:
          "Find a grant that's a genuine fit and decide to apply before spending any drafting time. " +
          "Exits once eligibility is confirmed and the decision to apply is made. Owner: Leadership.",
        isInitial: true,
        slaHours: 96,
        steps: [
          {
            key: "find",
            name: "Identify grant & eligibility",
            dueOffsetHours: 96,
            description:
              "Confirm the funder's eligibility rules, restrictions (geography, program type, " +
              "indirect-cost caps), and deadline before anything else. The common mistake is starting " +
              "to draft against a grant that turns out to exclude YPP's program type or region, " +
              "wasting the time spent. Tip: read the restrictions section first, not last.",
          },
          {
            key: "fit",
            name: "Confirm fit & decision to apply",
            kind: "DECISION",
            dueOffsetHours: 120,
            description:
              "Make an explicit go/no-go call: does this grant's size and restrictions justify the " +
              "drafting effort, and does YPP have a real story to tell this funder. The common mistake " +
              "is treating every eligible grant as worth applying to regardless of size — a $500 grant " +
              "with a 10-page application isn't worth the opportunity cost. Tip: weigh award size " +
              "against narrative effort before committing.",
          },
        ],
      },
      {
        key: "draft",
        name: "Draft",
        description:
          "Write the narrative and budget, then get an independent internal review before submission. " +
          "Exits when both narrative and budget have passed review. Owner: the drafting officer, " +
          "reviewed by someone else.",
        slaHours: 240,
        steps: [
          {
            key: "narrative",
            name: "Write narrative",
            kind: "DOCUMENT",
            dueOffsetHours: 168,
            description:
              "Write the program narrative against the funder's actual prompt, not a generic YPP " +
              "boilerplate pitch. The common mistake is reusing last cycle's narrative wholesale; " +
              "funders notice when the answer doesn't address their specific questions. Tip: outline " +
              "answers to the funder's exact prompts before writing prose.",
          },
          {
            key: "budget",
            name: "Prepare budget",
            kind: "DOCUMENT",
            dueOffsetHours: 168,
            description:
              "Build the budget against real program costs, not round-number estimates. The common " +
              "mistake is a budget narrative that doesn't match the program narrative's stated scope " +
              "(e.g. claiming to serve 50 students while budgeting for 20 seats). Tip: cross-check the " +
              "budget against the narrative's numbers line by line before review.",
          },
          {
            key: "review",
            name: "Internal review",
            kind: "APPROVAL",
            dueOffsetHours: 216,
            description:
              "Have someone who did NOT write the narrative or budget review both for accuracy, tone, " +
              "and whether they actually answer the funder's prompts. The common mistake is skipping " +
              "this under deadline pressure — it's exactly when review catches the most errors. Tip: " +
              "review with the funder's actual application questions open side by side.",
          },
        ],
      },
      {
        key: "submit",
        name: "Submit",
        description: "File the application before the funder's deadline. Exits once submitted. Owner: drafting officer.",
        steps: [
          {
            key: "send",
            name: "Submit application",
            dueOffsetHours: 24,
            description:
              "Submit through the funder's required channel (portal, email, mail) well before the " +
              "deadline — not at the literal last minute, since portals fail under last-day load. The " +
              "common mistake is treating the deadline as the submit time instead of a hard ceiling. " +
              "Tip: submit at least a day early when the channel allows it.",
          },
        ],
      },
      {
        key: "report",
        name: "Outcome & Report",
        description:
          "Record the outcome and, if awarded, file the funder's required report on time. Owner: " +
          "drafting officer, with Leadership notified either way.",
        isTerminal: true,
        steps: [
          { key: "outcome", name: "Record outcome", dueOffsetHours: 24, description: "Log whether the grant was awarded, declined, or pending, and notify the program owner either way — a decline still needs a record so the same funder isn't blindly reapplied to with an identical pitch next cycle. The common mistake is only recording wins. Tip: a one-line reason for a decline (if the funder gives one) is worth capturing." },
          { key: "report", name: "File grant report", isRequired: false, dueOffsetHours: 2160, description: "If awarded, file the funder's required report by their stated deadline — this is what keeps the relationship open for the next cycle. The common mistake is treating the report as optional follow-up that drifts indefinitely once the award money is spent. Tip: set the report deadline the moment the award is confirmed, not when it's due." },
        ],
      },
    ],
    automations: [
      actionOnEnter("draft", "Draft the grant application", 168),
      notifyOnEnter("submit", "Submit the grant application"),
      typedActionOnEnter("report", "File the grant report if awarded", "ADMIN_TASK", 2160),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 2. Fundraising Campaign (deepened)
  // --------------------------------------------------------------------------
  {
    key: "fundraising-campaign",
    name: "Fundraising Campaign",
    description:
      "Plan, launch, run, and close a fundraising campaign — a bounded push toward a stated goal, " +
      "not the org's ongoing grant pipeline.\n\n" +
      "Typical duration: 4-6 weeks (plan ~1.5 weeks, launch ~1 day, run ~3 weeks of active pushes, " +
      "close ~1 week of thanking donors and reporting results).\n\n" +
      "Primary owner: the Leadership officer running the campaign. Secondary owners: whoever maintains " +
      "donor contact info and assets/comms support for pushes.\n\n" +
      "Success definition: the campaign reaches (or has an honest, explained gap to) its stated goal, " +
      "every donor is thanked individually within a few days of giving, and a results report is filed " +
      "so the next campaign starts from real data instead of guesswork.\n\n" +
      "KPIs: percent of goal reached, days from launch to first gift, donor count vs. repeat-donor " +
      "count, and time from campaign close to thank-you sent.\n\n" +
      "Common failure modes: a vague goal/theme that nobody can repeat back in one sentence, which " +
      "makes every push feel improvised; donor thank-yous that batch-queue and slip past the moment " +
      "that actually matters to the donor; and a campaign that just ends with no results report, so " +
      "the org relearns the same lessons next time.\n\n" +
      "Hard-won notes: a specific, nameable goal (\"$10k to fund 40 new student seats\") outperforms a " +
      "vague one every time — donors give to something concrete. Thank donors fast and personally; a " +
      "same-week handwritten or personal note converts more repeat gifts than a templated receipt ever " +
      "will.",
    domain: "FUNDRAISING",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 168,
    stages: [
      {
        key: "plan",
        name: "Plan",
        description: "Set a specific, nameable goal and theme, then prepare the assets a push needs. Exits when goal, theme, and assets all exist. Owner: Leadership.",
        isInitial: true,
        slaHours: 240,
        steps: [
          { key: "goal", name: "Set goal & theme", dueOffsetHours: 96, description: "Write a goal specific enough to repeat back in one sentence (a dollar amount tied to a concrete outcome, not just a round number). The common mistake is a vague theme like \"support YPP\" that gives donors nothing concrete to picture. Tip: name what the money literally funds — seats, supplies, a chapter launch." },
          { key: "assets", name: "Prepare assets", kind: "DOCUMENT", dueOffsetHours: 168, description: "Build the email/social copy, donation page, and any visuals before launch day, not during it. The common mistake is launching with a generic donation link and writing copy on the fly mid-campaign. Tip: draft at least 3 distinct push messages up front so the campaign doesn't run dry by week two." },
        ],
      },
      {
        key: "launch",
        name: "Launch",
        description: "Go live with the campaign. Exits once launched. Owner: Leadership.",
        steps: [
          { key: "go-live", name: "Launch the campaign", dueOffsetHours: 24, description: "Send the launch push across every planned channel on the same day rather than staggering it loosely — a coordinated launch creates visible early momentum that itself drives more giving. The common mistake is a soft, uncoordinated start. Tip: have the first thank-you template ready before launch so early donors get a fast response." },
        ],
      },
      {
        key: "run",
        name: "Run",
        slaHours: 480,
        description: "Push toward the goal and track progress publicly. Exits when the goal is reached or the campaign's planned window closes. Owner: Leadership.",
        steps: [
          { key: "push", name: "Run donor pushes", isRequired: false, dueOffsetHours: 168, description: "Send follow-up pushes on a real cadence (weekly is typical) rather than one launch email and silence. The common mistake is going quiet after launch and hoping the page does the work. Tip: vary the angle each push — urgency, a specific story, a matching-gift moment — rather than repeating the same ask." },
          { key: "track", name: "Track toward goal", dueOffsetHours: 168, description: "Check progress against goal regularly and share it — a visible progress bar or update is itself a prompt that drives more giving. The common mistake is only checking at the very end. Tip: a \"halfway there\" update is a natural push moment." },
        ],
      },
      {
        key: "close",
        name: "Close",
        description: "Thank every donor and report results. Owner: Leadership.",
        isTerminal: true,
        steps: [
          { key: "thank", name: "Thank donors", dueOffsetHours: 72, description: "Thank every donor individually within a few days of the campaign closing — personal, not just a templated receipt. The common mistake is batching thank-yous so long after the gift that the personal moment is lost. Tip: a short personal line referencing what they specifically funded outperforms a generic thank-you." },
          { key: "report", name: "Report results", dueOffsetHours: 96, description: "File a short results report — amount raised vs. goal, donor count, what worked — so the next campaign starts from data instead of memory. The common mistake is skipping this once the money is in hand. Tip: note which specific push got the best response; it's the most reusable lesson." },
        ],
      },
    ],
    automations: [
      actionOnEnter("plan", "Plan the fundraising campaign", 96),
      notifyOnEnter("launch", "Launch the campaign"),
      {
        name: "Schedule progress follow-up",
        trigger: "ON_STAGE_ENTER",
        action: "SCHEDULE_FOLLOW_UP",
        stageKey: "run",
        config: { offsetHours: 168 },
      },
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 3. Weekly Operations Planning
  // --------------------------------------------------------------------------
  {
    key: "weekly-operations-planning",
    name: "Weekly Operations Planning",
    description:
      "Run the weekly leadership review rhythm documented in the Execution OS: Triage -> Meetings -> " +
      "Entity health -> Decisions -> Wrap-up. This wraps the existing Command Center / Weekly Review " +
      "pages (/operations/command-center, /operations/weekly-review) — it doesn't replace them, it's " +
      "the checklist that makes sure someone actually runs that rhythm every week instead of the pages " +
      "going unvisited.\n\n" +
      "Typical duration: under a week, ideally completed in a single sitting of 60-90 minutes plus a " +
      "short follow-up window for items that need more than a glance.\n\n" +
      "Primary owner: whichever Leadership officer owns the weekly review this cycle (should rotate or " +
      "be explicitly assigned, not default to whoever remembers). Secondary owners: officer-tier staff " +
      "whose areas show up in the digest.\n\n" +
      "Success definition: every urgent item in the recommended-review ranking gets an explicit " +
      "decision (acted on, delegated, or consciously deferred with a reason) — not silently skipped — " +
      "and every decision logged this week either becomes a tracked action or has a documented reason " +
      "it doesn't need one.\n\n" +
      "KPIs: percent of weeks with a completed review (no skipped weeks), percent of flagged " +
      "needs-attention items resolved or explicitly deferred within the week, and percent of logged " +
      "decisions converted to a tracked ActionItem via convertDecisionToAction.\n\n" +
      "Common failure modes: the review becomes a passive scroll through the Command Center with no " +
      "explicit decisions logged, so next week's digest looks identical; entity-health red flags get " +
      "seen but not acted on because no action gets created from them; and decisions get discussed " +
      "live in a meeting but never converted to a tracked action, so they quietly die per the doc's " +
      "own \"decisions die if they never become execution\" warning.\n\n" +
      "Hard-won notes: the recommended-review ranking exists specifically so leadership doesn't have to " +
      "guess what to look at first — work it in order rather than jumping to whatever feels most " +
      "urgent personally. Convert every real decision to an action in the same sitting; the longer it " +
      "waits, the less likely it ever happens.",
    domain: "GENERAL",
    defaultOwnerSubtype: "LEADERSHIP",
    escalateAfterHours: 120,
    stages: [
      {
        key: "triage",
        name: "Triage",
        description: "Pull the weekly digest and work the recommended-review ranking in order. Exits once every urgent/overdue item has an explicit owner decision. Owner: the assigned reviewer.",
        isInitial: true,
        slaHours: 24,
        steps: [
          { key: "pull-digest", name: "Pull the weekly operational digest", dueOffsetHours: 24, description: "Open the Command Center / Weekly Review and read the recommended-review ranking start to finish rather than scanning for what looks interesting. The common mistake is cherry-picking familiar items and missing what the ranking surfaced as actually most urgent. Tip: the ranking is deterministic and explainable — trust it over instinct.", kind: "TASK" },
          { key: "triage-actions", name: "Triage due/overdue actions", dueOffsetHours: 24, description: "Work through the urgency-bucketed actions and give each an explicit disposition — extend, reassign, escalate, or close — rather than leaving them to silently roll into next week's overdue bucket. The common mistake is reviewing the list without changing anything. Tip: an explicit \"deferred until X\" note is far better than silence." },
        ],
      },
      {
        key: "meetings-review",
        name: "Meetings",
        description: "Review meetings needing follow-through and grade outcome quality. Exits once every flagged meeting has a follow-up plan. Owner: the assigned reviewer.",
        slaHours: 24,
        steps: [
          { key: "follow-through", name: "Review meetings needing follow-through", dueOffsetHours: 24, description: "Check every meeting graded needs_follow_through or stale and either close the loop or explicitly schedule the follow-through. The common mistake is treating a 'stale' badge as informational rather than actionable. Tip: a meeting with no logged decisions or follow-ups almost always needed one — go back and add it rather than letting the grade stand uncorrected." },
        ],
      },
      {
        key: "entity-health",
        name: "Entity Health",
        description: "Scan operational health by area and the critical/drifting entity rollup. Exits once every critical entity has a named next step. Owner: the assigned reviewer.",
        slaHours: 24,
        steps: [
          { key: "area-health", name: "Review operational health by area", dueOffsetHours: 24, description: "Read the area health rollup and the explanation behind each non-healthy area — the explanation tells you WHY, not just that something's red. The common mistake is noting an area is unhealthy without reading why, which means the next action taken doesn't address the real cause. Tip: open explainOperationalHealth's reasoning before deciding what to do." },
          { key: "critical-entities", name: "Review critical/drifting entities", dueOffsetHours: 24, description: "Walk the critical/drifting entity rollup and assign or confirm a next step for each one — a chapter, class, or partner flagged critical needs a named owner and action, not just acknowledgment. The common mistake is noting the list without creating any action against it. Tip: each entity's operational timeline shows exactly what's been tried already — check it before repeating a failed approach." },
        ],
      },
      {
        key: "decisions",
        name: "Decisions",
        description: "Convert every real decision from the week into a tracked action. Exits once no undecided decisions remain unconverted. Owner: the assigned reviewer.",
        slaHours: 24,
        steps: [
          { key: "convert-decisions", name: "Convert decisions to actions", kind: "DECISION", dueOffsetHours: 24, description: "Use convertDecisionToAction on every logged decision that implies real work — it's idempotent and prefills from the decision, so there's no excuse to skip it. The common mistake is discussing a decision in the review and never actually creating the tracked action, exactly the failure mode the doc warns produces dead decisions. Tip: check the duplicate-action hint before creating a new one — someone may have already converted it." },
        ],
      },
      {
        key: "wrap-up",
        name: "Wrap-up",
        description: "Confirm the week's review is genuinely complete and note anything carried forward. Owner: the assigned reviewer.",
        isTerminal: true,
        steps: [
          { key: "recap", name: "Confirm wrap-up & carry-forward notes", dueOffsetHours: 24, description: "Note explicitly what's being carried into next week and why, rather than letting unfinished items silently disappear into next week's digest with no context. The common mistake is ending the review without this note, which makes next week's reviewer re-derive context from scratch. Tip: a one-line carry-forward note per item saves real time next cycle." },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("triage", "Run this week's operations triage", "OPERATIONS", 24),
      notifyOnEnter("decisions", "Convert this week's decisions to tracked actions"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 4. Action Review Cycle
  // --------------------------------------------------------------------------
  {
    key: "action-review-cycle",
    name: "Action Review Cycle",
    description:
      "A periodic sweep of stale and overdue ActionItems, grounded in the Execution OS's " +
      "\"decision -> action follow-through\" model: an action that sits stale long enough is, in " +
      "practice, a decision nobody is executing on.\n\n" +
      "Typical duration: 2-3 days for a full sweep across the org's open actions.\n\n" +
      "Primary owner: an officer-tier reviewer (rotates or is assigned). Secondary owners: each " +
      "action's individual lead, who must respond to the check-in.\n\n" +
      "Success definition: every action flagged stale or overdue gets an explicit, logged response " +
      "from its owner — re-committed with a real new date, reassigned, or closed — not silently left " +
      "to age further.\n\n" +
      "KPIs: percent of flagged actions with a logged owner response within the cycle, average days an " +
      "action sits stale before review catches it, and recurring-offender rate (the same action flagged " +
      "stale two cycles running).\n\n" +
      "Common failure modes: a stale action gets re-dated without ever asking the owner why it slipped, " +
      "so the same action shows up stale again next cycle with the identical root cause unaddressed; " +
      "and actions tied to a critical entity get treated the same as routine admin tasks instead of " +
      "being escalated faster.\n\n" +
      "Hard-won notes: ask why an action slipped before re-dating it — a pattern of slips on the same " +
      "action usually means the action itself is wrong-sized or blocked on something upstream that " +
      "needs its own fix, not just a later date.",
    domain: "GENERAL",
    defaultOwnerSubtype: "LEADERSHIP",
    escalateAfterHours: 96,
    stages: [
      {
        key: "pull",
        name: "Pull Overdue & Stale Actions",
        description: "Pull every action that's overdue or has had no movement in a meaningful window. Exits once the full list is assembled. Owner: the assigned reviewer.",
        isInitial: true,
        slaHours: 24,
        steps: [
          { key: "pull-list", name: "Pull overdue & stale actions", dueOffsetHours: 24, description: "Pull the full list of overdue actions plus anything stale (no update in a while) regardless of due date — a stale action with a far-future due date is just as much a signal as an overdue one. The common mistake is only looking at overdue, missing actions that are quietly drifting toward a deadline with zero progress. Tip: sort by related entity criticality first, not just by date." },
        ],
      },
      {
        key: "checkin",
        name: "Owner Check-in",
        description: "Get an explicit response from each action's owner. Exits when every flagged action has a logged response. Owner: the assigned reviewer, response from each action lead.",
        slaHours: 48,
        steps: [
          { key: "checkin-owner", name: "Check in with each owner", dueOffsetHours: 48, description: "Ask each owner directly why the action slipped and what they need to actually finish it — don't just ask for a new date. The common mistake is accepting a new date with no understanding of why the last one was missed, which guarantees the same slip next cycle. Tip: a one-line 'why' captured now saves a repeat conversation later." },
        ],
      },
      {
        key: "resolve",
        name: "Escalated or Closed",
        description: "Every flagged action lands in a real disposition. Owner: the assigned reviewer.",
        isTerminal: true,
        steps: [
          { key: "disposition", name: "Record disposition", kind: "DECISION", dueOffsetHours: 24, description: "Record the real outcome for each flagged action: re-committed with a credible new date, reassigned to someone with actual capacity, or closed because it's no longer needed. The common mistake is leaving an action open and overdue with no decision at all, the exact silent-drift this cycle exists to prevent. Tip: a closed action with a one-line reason is more useful to future reviewers than a deleted one." },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("pull", "Pull this cycle's overdue & stale actions", "OPERATIONS", 24),
      notifyOnEnter("checkin", "Check in on flagged actions"),
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 5. Risk Review Cycle
  // --------------------------------------------------------------------------
  {
    key: "risk-review-cycle",
    name: "Risk Review Cycle",
    description:
      "A periodic scan of strategic-initiative and operational risk, grounded in the Strategic " +
      "Initiatives layer's health/momentum/risk derivation (healthy/drifting/at_risk/critical, " +
      "accelerating/steady/slowing/stalled) — this is the human-in-the-loop pass that turns those " +
      "derived signals into mitigation plans instead of just dashboard color.\n\n" +
      "Typical duration: about a week (identify risks ~2 days, build mitigation plans ~3 days, then an " +
      "ongoing tracked-and-reviewed tail until the next cycle).\n\n" +
      "Primary owner: a Leadership officer. Secondary owners: each at-risk initiative's named owner.\n\n" +
      "Success definition: every initiative or program flagged at_risk or critical has a written " +
      "mitigation plan with a named owner, and the next risk review is already scheduled before this " +
      "one closes — risk review that doesn't recur isn't a system, it's a one-time event.\n\n" +
      "KPIs: percent of at_risk/critical initiatives with a documented mitigation plan, average time " +
      "an initiative spends in at_risk before either recovering or being formally accepted as ongoing " +
      "risk, and recurrence rate of the same risk reappearing cycle over cycle.\n\n" +
      "Common failure modes: a risk gets identified and discussed but never gets an owner, so it " +
      "resurfaces identically next cycle with no progress; and momentum signals (slowing/stalled) get " +
      "ignored until health flips all the way to critical, when a much smaller intervention earlier " +
      "would have worked.\n\n" +
      "Hard-won notes: slowing momentum is the earlier, cheaper signal to act on — waiting for health " +
      "to flip to at_risk or critical means the fix is bigger than it needed to be. Treat a momentum " +
      "dip as the actual trigger to start this workflow, not just a scheduled calendar date.",
    domain: "GENERAL",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 720,
    stages: [
      {
        key: "identify",
        name: "Identify & Score Risks",
        description: "Pull the at_risk/critical/slowing/stalled signals across initiatives and programs and score severity. Exits once every flagged item is scored. Owner: the assigned reviewer.",
        isInitial: true,
        slaHours: 48,
        steps: [
          { key: "pull-signals", name: "Pull risk & momentum signals", dueOffsetHours: 48, description: "Pull every initiative/program currently at_risk, critical, slowing, or stalled, not just the ones that feel top-of-mind. The common mistake is only reviewing initiatives leadership already happens to be worried about, missing a quietly slowing one nobody's watching. Tip: momentum dips are the cheaper, earlier signal — don't wait for health to flip to act." },
          { key: "score", name: "Score severity", kind: "DECISION", dueOffsetHours: 48, description: "Rank the flagged items by real organizational impact, not just by how loud the signal is. The common mistake is treating every red flag as equally urgent, which spreads mitigation effort too thin. Tip: an initiative tied to this quarter's board commitments outranks a slower-moving one with no near-term deadline." },
        ],
      },
      {
        key: "mitigate",
        name: "Mitigation Plan",
        description: "Build a named-owner mitigation plan for every scored risk. Exits once every item has a plan and owner. Owner: the assigned reviewer, with each initiative's owner.",
        slaHours: 72,
        steps: [
          { key: "plan", name: "Build mitigation plan", kind: "DOCUMENT", dueOffsetHours: 72, description: "Write a specific mitigation plan per risk with a named owner and a real next step, not a vague 'keep an eye on it.' The common mistake is a plan that's really just an acknowledgment with no concrete action attached. Tip: convert the plan's first step into a tracked ActionItem immediately so it doesn't evaporate after the meeting." },
        ],
      },
      {
        key: "tracked",
        name: "Tracked & Reviewed",
        description: "Confirm the next review is scheduled before closing this cycle. Owner: the assigned reviewer.",
        isTerminal: true,
        steps: [
          { key: "schedule-next", name: "Schedule next review", dueOffsetHours: 24, description: "Schedule the next risk review before closing this one out — an unscheduled 'someday' review never actually happens. The common mistake is treating this cycle as done once mitigation plans exist, without locking in the follow-up check. Tip: tie the next review date to the shortest mitigation plan's timeline, not a generic quarterly default." },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("mitigate", "Build mitigation plans for flagged risks", "OPERATIONS", 72),
      notifyOnEnter("tracked", "Confirm next risk review is scheduled"),
      {
        name: "Schedule next risk review",
        trigger: "ON_STAGE_ENTER",
        action: "SCHEDULE_FOLLOW_UP",
        stageKey: "tracked",
        config: { offsetHours: 720 },
      },
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },

  // --------------------------------------------------------------------------
  // 6. Impact Reporting Cycle
  // --------------------------------------------------------------------------
  {
    key: "impact-reporting-cycle",
    name: "Impact Reporting Cycle",
    description:
      "Org-wide impact reporting: pull, compile, and distribute the metrics that tell YPP's real " +
      "story across chapters — generalized from the same kind of impact-metrics pull a single chapter " +
      "does for its Chapter Impact Meeting, run at the org level for board/funder/leadership " +
      "consumption.\n\n" +
      "Typical duration: about a week (pull ~2 days, compile & review ~3 days, distribute ~1 day).\n\n" +
      "Primary owner: a Leadership officer. Secondary owners: each chapter's leadership, who must " +
      "confirm their chapter's numbers are accurate before org-wide compilation.\n\n" +
      "Success definition: every active chapter's real numbers (not estimates) are represented, the " +
      "compiled report tells a coherent story rather than a flat table of metrics, and it reaches " +
      "every stakeholder who needs it (board, funders cited in active grant reports, internal " +
      "leadership) on a predictable cadence.\n\n" +
      "KPIs: percent of active chapters with confirmed (not estimated) numbers in the report, time " +
      "from pull to distribution, and stakeholder reach (board/funder/leadership all covered each " +
      "cycle).\n\n" +
      "Common failure modes: a chapter's numbers get estimated or copied from last cycle because " +
      "nobody followed up to confirm them, which quietly erodes trust the first time someone notices; " +
      "and the report becomes a wall of numbers with no narrative, so it gets skimmed rather than " +
      "actually read and acted on.\n\n" +
      "Hard-won notes: confirm every chapter's numbers directly with that chapter's leadership rather " +
      "than pulling from a dashboard and assuming it's current — dashboards lag real-world events more " +
      "often than people expect. Lead the report with two or three concrete stories, not just the " +
      "metrics table; stories are what stakeholders actually remember.",
    domain: "GENERAL",
    defaultOwnerSubtype: "LEADERSHIP",
    followUpCadenceHours: 2160,
    stages: [
      {
        key: "pull",
        name: "Pull Impact Metrics",
        description: "Pull and confirm real metrics across every active chapter. Exits once every chapter's numbers are confirmed, not estimated. Owner: the assigned reviewer.",
        isInitial: true,
        slaHours: 48,
        steps: [
          { key: "pull-metrics", name: "Pull metrics across chapters", dueOffsetHours: 48, description: "Pull enrollment, attendance, partner, and instructor metrics for every active chapter from the live data, not last cycle's report. The common mistake is reusing a prior cycle's numbers for a chapter that hasn't responded yet. Tip: flag any chapter whose numbers haven't moved since last cycle for a direct follow-up — that's usually a sign of stale data, not stalled programming." },
          { key: "confirm-with-chapters", name: "Confirm numbers with chapter leadership", dueOffsetHours: 48, description: "Send each chapter's pulled numbers back to its leadership for a quick confirm before compiling org-wide — they'll catch dashboard lag a central reviewer can't see. The common mistake is skipping this confirmation step to save time, which is exactly how a stale number ends up in a board report. Tip: a same-day reply request with the specific numbers attached gets faster responses than an open-ended ask." },
        ],
      },
      {
        key: "compile",
        name: "Compile & Review",
        description: "Turn confirmed metrics into a coherent report with real stories, then get it reviewed. Exits once reviewed. Owner: the assigned reviewer.",
        slaHours: 72,
        steps: [
          { key: "compile", name: "Compile the report", kind: "DOCUMENT", dueOffsetHours: 72, description: "Lead with two or three concrete stories pulled from the cycle's real activity, then back them with the metrics table — not the reverse. The common mistake is a metrics-only report that reads as a spreadsheet, which stakeholders skim instead of read. Tip: ask each chapter for one specific story when confirming their numbers; it's the easiest way to source real material." },
          { key: "review", name: "Leadership review", kind: "APPROVAL", dueOffsetHours: 96, description: "Have a second leadership reviewer sanity-check the numbers and narrative before distribution. The common mistake is sending the compiler's first draft straight out. Tip: review with last cycle's report open side by side to catch any unexplained swing in the numbers." },
        ],
      },
      {
        key: "distribute",
        name: "Published & Distributed",
        description: "Get the report to every stakeholder who needs it. Owner: the assigned reviewer.",
        isTerminal: true,
        steps: [
          { key: "distribute", name: "Distribute to stakeholders", dueOffsetHours: 24, description: "Send the finished report to the board, leadership, and any funder whose active grant requires periodic reporting — confirm the full stakeholder list rather than defaulting to whoever got last cycle's email. The common mistake is missing a funder who specifically asked for this cadence of update. Tip: keep a standing distribution list and review it each cycle for changes, not just reuse it blindly." },
        ],
      },
    ],
    automations: [
      typedActionOnEnter("pull", "Pull this cycle's impact metrics", "OPERATIONS", 48),
      notifyOnEnter("compile", "Compile the impact report"),
      {
        name: "Schedule next impact reporting cycle",
        trigger: "ON_STAGE_ENTER",
        action: "SCHEDULE_FOLLOW_UP",
        stageKey: "distribute",
        config: { offsetHours: 2160 },
      },
      escalateOverdue(),
      autoAdvanceWhenReady(),
    ],
  },
];
