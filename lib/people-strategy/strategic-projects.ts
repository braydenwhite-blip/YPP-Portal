import {
  type InitiativeMatch,
  type InitiativePriority,
  type InitiativeStatus,
} from "./strategic-initiatives";

/**
 * YPP Execution OS — STRATEGIC PROJECT MODEL (Strategic Initiatives 3.0).
 *
 * A Strategic Project is the concrete body of work leadership actually runs week
 * to week — deeper than a milestone, narrower than a workstream. "Summer Camps
 * 2026" (an initiative) really runs as projects: the "Beth El Pilot", the
 * "Mohawk Expansion". A project carries a charter (intentional strategic
 * definition — allowed config), a parent initiative, related workstreams, an
 * owner when named, and a deterministic {@link InitiativeMatch}.
 *
 * Like an initiative, a project carries NO copy of its work. The derivation layer
 * classifies the parent initiative's ALREADY-matched pool down into the project
 * and runs the SAME 2.0 health / momentum / risk / ownership / progress engines on
 * that subset. There is no second source of truth and no migration: a project's
 * state is derived from real actions / meetings / decisions / milestones, and when
 * nothing matches it shows honest, graceful empty states (never a fake "healthy").
 *
 * Projects reuse the initiative {@link InitiativeStatus} and {@link
 * InitiativePriority} vocabularies so the whole layer ranks and renders
 * consistently.
 */

/**
 * A project's charter — the intentional, version-controlled strategic definition
 * (reviewable in a PR). This is declared config, NOT derived; it answers "what is
 * this", "why it matters", "what does success look like", and the scope /
 * assumptions / what-could-kill-it that frame the brief. Empty arrays render as
 * graceful "not yet defined" states.
 */
export type ProjectCharter = {
  /** What this project IS, in one or two sentences. */
  purpose: string;
  /** Why it matters to YPP right now. */
  whyItMatters: string;
  /** The single target outcome that defines "done well". */
  targetOutcome: string;
  /** Concrete, checkable signals of success. */
  successCriteria: string[];
  /** What is explicitly IN scope. */
  inScope: string[];
  /** What is explicitly OUT of scope (so the project stays bounded). */
  outOfScope: string[];
  /** Assumptions the plan depends on. */
  assumptions: string[];
  /** What could kill it — the existential risks. */
  risks: string[];
};

export type StrategicProjectDef = {
  id: string;
  title: string;
  /** Parent initiative id — MUST exist in STRATEGIC_INITIATIVES. */
  initiativeId: string;
  /** Related workstream ids within the parent initiative (for the spine + rollup). */
  workstreamIds?: string[];
  /** The accountable owner, when named. Ownership clarity is derived when absent. */
  owner?: string;
  /** Supporting people (names), when named. */
  supporting?: string[];
  status: InitiativeStatus;
  priority: InitiativePriority;
  startDateISO?: string;
  targetDateISO?: string;
  /** One-line card summary. */
  summary: string;
  /** The full strategic brief. */
  charter: ProjectCharter;
  /** Deterministic membership rule within the parent initiative's matched pool. */
  match: InitiativeMatch;
  /** Declared upstream dependencies (free-text labels) — what this project waits on. */
  dependsOn?: string[];
  /** Declared downstream unlocks (free-text labels) — what this project enables. */
  unlocks?: string[];
};

// --- the seeded registry -----------------------------------------------------

/**
 * The curated set of YPP strategic projects. Each is intentional config tied to a
 * real initiative and its workstreams, with a `match` that reuses the existing
 * operating-signal vocabulary (keywords / action types / areas) so it aggregates
 * real work with no manual upkeep. New projects are added here — reviewable in a
 * PR, never a migration. A project whose `match` finds no real work degrades to a
 * graceful empty state; it never fabricates execution.
 */
export const STRATEGIC_PROJECTS: StrategicProjectDef[] = [
  {
    id: "beth-el-pilot",
    title: "Beth El Pilot",
    initiativeId: "summer-camps-2026",
    workstreamIds: ["partnership-development", "operations", "measurement"],
    status: "active",
    priority: "flagship",
    summary: "Run the first 2026 camp pilot at Beth El end-to-end and prove the model.",
    charter: {
      purpose:
        "Stand up and run the inaugural Summer Camps 2026 pilot at the Beth El site — the proof point the rest of the slate is sequenced behind.",
      whyItMatters:
        "A clean pilot de-risks every other camp: it validates the curriculum, staffing ratio, parent comms, and the operating playbook before we scale.",
      targetOutcome:
        "A completed Beth El pilot week with measured student outcomes and a documented playbook ready to replicate.",
      successCriteria: [
        "Site agreement signed and dates locked",
        "Curriculum + instructors ready before week one",
        "Pilot week runs with no critical operational failure",
        "Post-pilot feedback collected from families and staff",
      ],
      inScope: ["The Beth El site", "Pilot curriculum + staffing", "Parent communication for the pilot", "Pilot measurement"],
      outOfScope: ["Other 2026 camp sites", "Full-season marketing spend", "Permanent staffing contracts"],
      assumptions: ["Beth El confirms the dates", "We can recruit enough instructors in time"],
      risks: ["Site falls through", "Instructor shortfall", "Curriculum not ready in time"],
    },
    match: { keywords: ["beth el", "pilot"] },
    dependsOn: ["Camp partner agreements", "Instructor recruitment"],
    unlocks: ["Mohawk Expansion", "Full 2026 camp slate"],
  },
  {
    id: "mohawk-expansion",
    title: "Mohawk Expansion",
    initiativeId: "summer-camps-2026",
    workstreamIds: ["partnership-development", "operations"],
    status: "planning",
    priority: "high",
    summary: "Extend the proven camp model to the Mohawk region for 2026.",
    charter: {
      purpose: "Expand the 2026 camp slate into the Mohawk region once the pilot model is proven.",
      whyItMatters: "Mohawk is the first scale test — it turns one working camp into a repeatable program.",
      targetOutcome: "A confirmed Mohawk camp for summer 2026 built on the pilot playbook.",
      successCriteria: ["Mohawk site secured", "Local instructors recruited", "Enrollment target met"],
      inScope: ["Mohawk site + logistics", "Local instructor recruitment", "Mohawk enrollment"],
      outOfScope: ["Beth El pilot delivery", "Sites beyond Mohawk"],
      assumptions: ["The pilot validates the model", "There is regional demand"],
      risks: ["Pilot slips and blocks expansion", "No viable Mohawk site"],
    },
    match: { keywords: ["mohawk", "expansion", "scale", "roll out", "rollout"] },
    dependsOn: ["Beth El Pilot"],
  },
  {
    id: "camp-outreach-pipeline",
    title: "Camp Outreach Pipeline",
    initiativeId: "partnership-growth",
    workstreamIds: ["outreach-ws"],
    status: "active",
    priority: "high",
    summary: "Build a healthy pipeline of prospective host sites and sponsors for camps.",
    charter: {
      purpose: "Run a deliberate outreach pipeline that keeps a steady flow of prospective camp partners moving toward agreement.",
      whyItMatters: "Camps live or die on host sites — a pipeline turns ad-hoc asks into a predictable supply of partners.",
      targetOutcome: "A qualified, moving pipeline with enough late-stage partners to cover the 2026 slate.",
      successCriteria: ["Defined target list", "Consistent outreach cadence", "Qualified partners advancing each week"],
      inScope: ["Prospect identification", "Initial outreach", "Qualification + handoff to agreements"],
      outOfScope: ["Closing agreements (Agreements workstream)", "Active delivery"],
      assumptions: ["We have a target list to work", "Outreach gets responses"],
      risks: ["Pipeline goes stale", "No owner driving cadence"],
    },
    match: { keywords: ["outreach", "pipeline", "prospect", "reach out", "intro", "contact"] },
    unlocks: ["Camp partner agreements"],
  },
  {
    id: "instructor-accountability-engine",
    title: "Instructor Accountability Engine",
    initiativeId: "instructor-growth",
    workstreamIds: ["development"],
    status: "active",
    priority: "high",
    summary: "A reliable cadence of check-ins and follow-through that keeps active instructors growing.",
    charter: {
      purpose: "Build the accountability loop — check-ins, feedback, and follow-through — that keeps active instructors developing instead of drifting.",
      whyItMatters: "Recruiting instructors is wasted if they stall after onboarding; accountability is what compounds quality.",
      targetOutcome: "Every active instructor has a recurring check-in and visible follow-through on growth actions.",
      successCriteria: ["Check-in cadence established", "Growth actions tracked to completion", "Stalled instructors surfaced early"],
      inScope: ["Instructor check-ins", "Development follow-through", "Coaching actions"],
      outOfScope: ["Recruiting", "Screening", "Initial onboarding"],
      assumptions: ["Mentors/leads have capacity for check-ins"],
      risks: ["Check-ins skipped under load", "Follow-through never tracked"],
    },
    match: { keywords: ["accountability", "check-in", "checkin", "follow-up", "follow up", "develop", "coaching", "growth"] },
  },
  {
    id: "mentor-mentee-journey-redesign",
    title: "Mentor–Mentee Journey Redesign",
    initiativeId: "mentorship-3",
    workstreamIds: ["matching-ws", "outcomes-ws"],
    status: "active",
    priority: "high",
    summary: "Redesign the end-to-end mentor/mentee experience from match to outcome.",
    charter: {
      purpose: "Redesign the mentor–mentee journey end to end — match quality, the first 30 days, and the path to a measured outcome.",
      whyItMatters: "A great match with a weak journey still fails; the journey is where mentorship outcomes are actually made.",
      targetOutcome: "A documented, repeatable journey every pair follows, with measured progress at each stage.",
      successCriteria: ["Journey stages defined", "Strong first-30-day experience", "Outcomes measured per pair"],
      inScope: ["Matching quality", "Onboarding the pair", "Outcome tracking"],
      outOfScope: ["Check-in scheduling mechanics (Rhythm workstream)"],
      assumptions: ["Pairs will follow a defined journey", "We can measure outcomes"],
      risks: ["Redesign stays theoretical", "No outcome data to learn from"],
    },
    match: { keywords: ["journey", "redesign", "experience", "match", "matching", "outcome"] },
  },
  {
    id: "weekly-review-system",
    title: "Weekly Review System",
    initiativeId: "action-tracker-4",
    status: "active",
    priority: "medium",
    summary: "Make the weekly leadership review a reliable, repeatable operating rhythm.",
    charter: {
      purpose: "Operationalize the weekly leadership review so the org reviews the right things, in order, every week.",
      whyItMatters: "Strategy only moves if leadership has a dependable rhythm to surface what's stuck and decide the next move.",
      targetOutcome: "A weekly review that consistently triages work, closes decisions, and sets next moves.",
      successCriteria: ["Review run every week", "Decisions closed in-session", "Next moves assigned each week"],
      inScope: ["The weekly review flow", "Review agenda + queues"],
      outOfScope: ["Day-to-day action triage outside the review"],
      assumptions: ["Leadership commits to the cadence"],
      risks: ["Review skipped when busy", "Becomes a status read, not a decision forum"],
    },
    match: { keywords: ["weekly review", "review system", "operating review", "review cadence", "review"] },
  },
  {
    id: "follow-through-engine",
    title: "Follow-through Engine",
    initiativeId: "action-tracker-4",
    status: "active",
    priority: "medium",
    summary: "Turn decisions and meetings into tracked, completed action — reliably.",
    charter: {
      purpose: "Close the gap between deciding and doing — every decision and meeting reliably produces tracked, completed action.",
      whyItMatters: "Decisions that never become action are the single biggest leak in execution.",
      targetOutcome: "A high decision→action follow-through rate with overdue work surfaced fast.",
      successCriteria: ["Decisions converted to actions", "Meeting follow-ups tracked", "Overdue work surfaced quickly"],
      inScope: ["Decision→action conversion", "Meeting follow-through", "Overdue surfacing"],
      outOfScope: ["Initiative-level strategy"],
      assumptions: ["People use the tracker"],
      risks: ["Follow-through measured but not improved"],
    },
    match: { keywords: ["follow-through", "follow through", "follow-up", "follow up", "convert", "overdue"] },
  },
  {
    id: "curriculum-standards-rollout",
    title: "Curriculum Standards Rollout",
    initiativeId: "class-quality",
    status: "planning",
    priority: "medium",
    summary: "Define and roll out a curriculum quality bar across every class.",
    charter: {
      purpose: "Set a clear curriculum quality standard and roll it out so every class meets the bar.",
      whyItMatters: "Consistent quality is what makes YPP classes trusted and repeatable.",
      targetOutcome: "A published standard adopted across active classes, with feedback loops closing the gaps.",
      successCriteria: ["Standard / rubric published", "Classes assessed against it", "Gaps closed via feedback"],
      inScope: ["Quality standard / rubric", "Curriculum strengthening", "Feedback loops"],
      outOfScope: ["Instructor recruiting", "Class scheduling"],
      assumptions: ["Instructors adopt the standard"],
      risks: ["Standard ignored in practice"],
    },
    match: { keywords: ["standard", "rubric", "quality bar", "curriculum", "lesson plan"] },
  },
  {
    id: "chapter-launch-playbook",
    title: "Chapter Launch Playbook",
    initiativeId: "chapter-expansion",
    status: "planning",
    priority: "medium",
    summary: "A repeatable playbook to launch and stabilize a new chapter to first programming.",
    charter: {
      purpose: "Codify a repeatable chapter-launch playbook — from leadership recruitment to first programming.",
      whyItMatters: "A playbook turns each new chapter from a bespoke effort into a fast, reliable launch.",
      targetOutcome: "A documented launch playbook proven on at least one new chapter.",
      successCriteria: ["Playbook documented", "Leadership onboarded via it", "First programming reached"],
      inScope: ["Launch sequence", "Leadership onboarding", "Path to first programming"],
      outOfScope: ["Ongoing chapter operations after launch"],
      assumptions: ["There is a chapter to launch"],
      risks: ["No leadership recruited", "Launch stalls before first event"],
    },
    match: { keywords: ["launch", "playbook", "charter", "onboard", "first programming", "first event"] },
  },
  {
    id: "strategic-school-partnerships",
    title: "Strategic School Partnerships",
    initiativeId: "partnership-growth",
    workstreamIds: ["agreements-ws", "activation-ws"],
    status: "active",
    priority: "medium",
    summary: "Close and activate priority school/district partnerships.",
    charter: {
      purpose: "Move priority schools and districts from conversation to signed, active partnerships.",
      whyItMatters: "Schools are the highest-leverage partners — each one unlocks programming and students at scale.",
      targetOutcome: "A set of signed school partnerships with active programming underway.",
      successCriteria: ["Agreements signed", "Programming launched", "Relationship leads assigned"],
      inScope: ["Negotiating agreements", "Activating delivery"],
      outOfScope: ["Top-of-funnel outreach (Outreach project)"],
      assumptions: ["Schools have budget / interest"],
      risks: ["Agreements stall", "Signed partners never activate"],
    },
    match: { keywords: ["school", "district", "agreement", "contract", "mou", "sign", "activate", "launch"] },
  },
];
