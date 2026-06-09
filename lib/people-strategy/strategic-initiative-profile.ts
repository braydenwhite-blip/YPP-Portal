import type { OperationalArea } from "./operational-context";

/**
 * YPP Execution OS — Strategic Initiative PROFILE (Phases A, D, F, G config).
 *
 * The matcher core ({@link StrategicInitiativeDef}) decides what work belongs to
 * an initiative; this module is the initiative's STRATEGIC NARRATIVE — the
 * curated, version-controlled charter, knowledge base, scenarios, and declared
 * dependencies that turn a dashboard into a living organizational program. Like
 * the rest of the layer it is PURE config (no DB, no migration): the institutional
 * memory of an initiative lives in a reviewable file, so leadership turnover never
 * destroys it.
 *
 * Every field is optional. {@link getInitiativeProfile} always returns a fully
 * defaulted profile (nulls + empty arrays), so a surface can render any section
 * for any initiative without a guard, and an initiative with no authored profile
 * simply shows clean empty states.
 *
 *   - Phase A — the CHARTER: mission, purpose, success definition, strategic
 *     importance, target outcomes, key metrics, assumptions, constraints, risks,
 *     operating areas, leadership owners, stakeholders, historical context,
 *     lessons learned, future opportunities. An initiative should feel like a
 *     mini-organization, not a project.
 *   - Phase D — the KNOWLEDGE BASE: overview, background, strategy, playbooks,
 *     resources, documents, templates, FAQs, historical notes, retrospectives,
 *     future ideas. The portal preserves institutional memory.
 *   - Phase F — the SCENARIOS: best / expected / risk / stretch cases, each with
 *     what must happen, what is blocking, and what decisions unlock it.
 *   - Phase G — the declared DEPENDENCIES: the strategic edges between
 *     initiatives (and to external prerequisites) the dependency engine reads.
 */

// --- Phase A: the charter ----------------------------------------------------

export type KeyMetricDef = {
  /** "Camps run", "Student NPS", "Instructors onboarded". */
  label: string;
  /** The target value for this initiative ("4 camps", "> 50"). */
  target?: string;
  /** How often it is measured ("weekly", "per session", "end of summer"). */
  cadence?: string;
  /** Where the number comes from ("registration export", "post-camp survey"). */
  source?: string;
};

export type StakeholderDef = {
  name: string;
  /** Their role, interest, or relationship to the initiative. */
  role?: string;
};

export type InitiativeCharter = {
  mission: string | null;
  purpose: string | null;
  successDefinition: string | null;
  strategicImportance: string | null;
  targetOutcomes: string[];
  keyMetrics: KeyMetricDef[];
  assumptions: string[];
  constraints: string[];
  /** Narrative, leadership-named risks (distinct from the DERIVED risk factors). */
  risks: string[];
  operatingAreas: OperationalArea[];
  leadershipOwners: StakeholderDef[];
  stakeholders: StakeholderDef[];
  historicalContext: string | null;
  lessonsLearned: string[];
  futureOpportunities: string[];
};

// --- Phase D: the knowledge base ---------------------------------------------

export type KnowledgeLink = {
  label: string;
  /** Optional in-portal or external href. */
  href?: string;
  /** Optional one-line note about what this is / when to use it. */
  note?: string;
};

export type FaqEntry = { question: string; answer: string };

export type RetrospectiveEntry = {
  title: string;
  dateISO?: string;
  whatWorked: string[];
  whatDidnt: string[];
  nextTime: string[];
};

export type InitiativeKnowledgeBase = {
  overview: string | null;
  background: string | null;
  strategy: string | null;
  playbooks: KnowledgeLink[];
  resources: KnowledgeLink[];
  documents: KnowledgeLink[];
  templates: KnowledgeLink[];
  faqs: FaqEntry[];
  historicalNotes: string[];
  retrospectives: RetrospectiveEntry[];
  futureIdeas: string[];
};

// --- Phase F: scenarios ------------------------------------------------------

export const SCENARIO_KINDS = ["best", "expected", "risk", "stretch"] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

export const SCENARIO_META: Record<
  ScenarioKind,
  { label: string; tone: "success" | "info" | "warning" | "purple"; order: number }
> = {
  best: { label: "Best case", tone: "success", order: 0 },
  expected: { label: "Expected case", tone: "info", order: 1 },
  stretch: { label: "Stretch case", tone: "purple", order: 2 },
  risk: { label: "Risk case", tone: "warning", order: 3 },
};

export type InitiativeScenarioDef = {
  kind: ScenarioKind;
  /** The headline outcome — "4 camps", "12 camps", "2 camps". */
  headline: string;
  description?: string;
  /** What must happen to land this scenario. */
  requirements: string[];
  /** What is currently blocking this scenario. */
  blockers: string[];
  /** The decisions that would unlock this scenario. */
  unlockingDecisions: string[];
};

// --- Phase G: declared dependencies ------------------------------------------

export const DEPENDENCY_TYPES = ["depends_on", "blocks", "relates_to"] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export type InitiativeDependencyDef = {
  /** How THIS initiative relates to the target. */
  type: DependencyType;
  /** The depended-on / blocked initiative (when it is another initiative). */
  targetInitiativeId?: string;
  /** A free-text prerequisite when the target is not a tracked initiative. */
  targetLabel?: string;
  /** Why the dependency exists ("camps need host sites first"). */
  reason?: string;
  /** Optionally scope the dependency to one of this initiative's workstreams. */
  workstreamId?: string;
};

// --- the profile -------------------------------------------------------------

export type InitiativeProfile = {
  charter: InitiativeCharter;
  knowledge: InitiativeKnowledgeBase;
  scenarios: InitiativeScenarioDef[];
  dependencies: InitiativeDependencyDef[];
};

type PartialProfile = {
  charter?: Partial<InitiativeCharter>;
  knowledge?: Partial<InitiativeKnowledgeBase>;
  scenarios?: InitiativeScenarioDef[];
  dependencies?: InitiativeDependencyDef[];
};

function emptyCharter(): InitiativeCharter {
  return {
    mission: null,
    purpose: null,
    successDefinition: null,
    strategicImportance: null,
    targetOutcomes: [],
    keyMetrics: [],
    assumptions: [],
    constraints: [],
    risks: [],
    operatingAreas: [],
    leadershipOwners: [],
    stakeholders: [],
    historicalContext: null,
    lessonsLearned: [],
    futureOpportunities: [],
  };
}

function emptyKnowledge(): InitiativeKnowledgeBase {
  return {
    overview: null,
    background: null,
    strategy: null,
    playbooks: [],
    resources: [],
    documents: [],
    templates: [],
    faqs: [],
    historicalNotes: [],
    retrospectives: [],
    futureIdeas: [],
  };
}

/**
 * The curated strategic narrative per initiative. Authored where it adds real
 * value (the flagship + the active programs); unauthored initiatives fall back to
 * clean empty states. Adding to this is a one-file, no-migration PR.
 */
const INITIATIVE_PROFILES: Record<string, PartialProfile> = {
  "summer-camps-2026": {
    charter: {
      mission:
        "Give every YPP student a transformative summer through high-quality, accessible camp programming.",
      purpose:
        "Convert YPP's school-year momentum into a flagship summer offering that deepens student engagement, opens new partnerships, and proves YPP can deliver at scale.",
      successDefinition:
        "At least four camps run to completion with strong student outcomes, healthy enrollment, and partners who want to host again next year.",
      strategicImportance:
        "Camps are YPP's highest-visibility delivery of the year — they convert partnerships into programming, give instructors real teaching reps, and are the single biggest driver of summer student growth.",
      targetOutcomes: [
        "4+ camps delivered end-to-end",
        "Every camp fully staffed with trained instructors",
        "Positive post-camp feedback from students and parents",
        "At least 2 partners committed to returning next year",
      ],
      keyMetrics: [
        { label: "Camps run", target: "4 (expected) / 8 (stretch)", cadence: "end of summer", source: "operations roster" },
        { label: "Students enrolled", target: "120+", cadence: "weekly", source: "registration export" },
        { label: "Instructor fill rate", target: "100% of sessions staffed", cadence: "weekly", source: "instructor roster" },
        { label: "Student satisfaction", target: "> 4.3 / 5", cadence: "per camp", source: "post-camp survey" },
      ],
      assumptions: [
        "Partner sites confirm space by late spring",
        "Enough instructors complete training before sessions start",
        "Curriculum can be reused across camp sites with light tailoring",
      ],
      constraints: [
        "Limited summer instructor availability",
        "Fixed budget for materials and venue costs",
        "Hard calendar — sessions must run within the summer window",
      ],
      risks: [
        "Partner site falls through close to launch",
        "Instructor recruiting lags and leaves a session understaffed",
        "Low enrollment at a new site",
      ],
      operatingAreas: ["CLASSES", "PARTNERSHIPS", "INSTRUCTORS"],
      leadershipOwners: [
        { name: "Programs Lead", role: "Accountable owner" },
        { name: "Partnerships Lead", role: "Owns host-site agreements" },
      ],
      stakeholders: [
        { name: "Host partners / schools", role: "Provide venues and reach families" },
        { name: "Parents & families", role: "Enroll students, expect clear communication" },
        { name: "Camp instructors", role: "Deliver the programming" },
        { name: "YPP board", role: "Tracks the flagship summer outcome" },
      ],
      historicalContext:
        "YPP has run one-off summer sessions before, but never a coordinated multi-camp slate. The 2026 push is the first attempt to treat camps as a single program with shared curriculum, staffing, and measurement.",
      lessonsLearned: [
        "Confirming venues early is the single biggest predictor of a smooth launch",
        "Parent communication can't be an afterthought — it drives enrollment and retention",
      ],
      futureOpportunities: [
        "Year-round camp model (spring break, winter)",
        "Camp-to-class pipeline that re-enrolls campers into the school year",
        "Partner-funded scholarships to widen access",
      ],
    },
    knowledge: {
      overview:
        "Summer Camps 2026 is YPP's flagship summer program — a coordinated slate of camps delivered across partner sites, organized into seven workstreams from partnership development through measurement.",
      background:
        "Born out of repeated requests from partner schools for summer programming and YPP's need for a high-visibility, high-impact summer offering.",
      strategy:
        "Run a small, well-supported pilot first to de-risk the model, then expand to additional sites once the curriculum, staffing, and operations playbooks are proven.",
      playbooks: [
        { label: "Camp launch checklist", note: "Everything from venue confirmation to first-day logistics" },
        { label: "Instructor training pathway", note: "What every camp instructor completes before teaching" },
      ],
      resources: [
        { label: "Partner site directory", href: "/admin/partners" },
        { label: "Action Tracker — camp work", href: "/actions/all" },
      ],
      documents: [
        { label: "Camp curriculum outline" },
        { label: "Parent welcome packet" },
      ],
      templates: [
        { label: "Camp session plan template" },
        { label: "Post-camp feedback survey template" },
      ],
      faqs: [
        {
          question: "How many camps are we targeting?",
          answer: "Four in the expected case, with a stretch goal of eight if partnerships and staffing come together early.",
        },
        {
          question: "What makes or breaks a camp launch?",
          answer: "Confirming the venue early and having trained instructors ready before sessions start.",
        },
      ],
      historicalNotes: [
        "Earlier one-off summer sessions were run ad hoc with no shared curriculum.",
      ],
      retrospectives: [],
      futureIdeas: [
        "A camp alumni community that feeds back into the school year",
        "Regional camp leads to run multiple sites in parallel",
      ],
    },
    scenarios: [
      {
        kind: "expected",
        headline: "4 camps",
        description: "The base plan: four well-run camps at confirmed partner sites.",
        requirements: ["4 partner sites confirmed", "Full instructor roster", "Curriculum finalized"],
        blockers: [],
        unlockingDecisions: ["Lock the four host sites by spring"],
      },
      {
        kind: "stretch",
        headline: "8 camps",
        description: "Double the slate if partnerships and staffing come together early.",
        requirements: ["8 partner sites", "2x instructor pipeline", "Operations playbook proven at 4"],
        blockers: ["Instructor pipeline not yet deep enough"],
        unlockingDecisions: ["Commit to a second recruiting wave", "Approve additional materials budget"],
      },
      {
        kind: "best",
        headline: "12 camps",
        description: "Everything breaks right — strong demand, deep staffing, repeat partners.",
        requirements: ["Repeat + new partners", "Regional camp leads", "Scholarship funding"],
        blockers: ["No regional lead structure yet", "Funding not secured"],
        unlockingDecisions: ["Stand up regional camp leads", "Secure partner-funded scholarships"],
      },
      {
        kind: "risk",
        headline: "2 camps",
        description: "The downside: partnerships or staffing slip and the slate shrinks.",
        requirements: ["At least 2 sites confirmed", "Minimum viable staffing"],
        blockers: ["Venue confirmations slipping", "Instructor recruiting behind"],
        unlockingDecisions: ["Decide a go/no-go date per site"],
      },
    ],
    dependencies: [
      { type: "depends_on", targetInitiativeId: "partnership-growth", reason: "Camps need confirmed host sites and sponsors before they can run.", workstreamId: "partnership-development" },
      { type: "depends_on", targetInitiativeId: "instructor-growth", reason: "Camps need trained instructors recruited and onboarded.", workstreamId: "instructor-recruitment" },
      { type: "relates_to", targetInitiativeId: "class-quality", reason: "Camp curriculum shares standards with the broader class-quality work." },
    ],
  },

  "instructor-growth": {
    charter: {
      mission: "Build a deep, well-prepared bench of instructors who can teach YPP programming with confidence.",
      purpose: "Instructor capacity is the constraint on everything YPP delivers — more trained instructors means more classes, camps, and chapters.",
      successDefinition: "A reliable pipeline that recruits, screens, onboards, and develops enough instructors to fully staff every program.",
      strategicImportance: "Every other delivery initiative depends on instructor capacity; this is the upstream enabler.",
      targetOutcomes: ["Full instructor coverage for all active programs", "Short time-to-ready for new instructors"],
      keyMetrics: [
        { label: "Instructors onboarded", cadence: "monthly", source: "application workflow" },
        { label: "Time to ready-to-teach", cadence: "per cohort", source: "onboarding tracker" },
      ],
      assumptions: ["Application volume stays healthy", "Training content is current"],
      constraints: ["Reviewer bandwidth for screening", "Volunteer instructor availability"],
      risks: ["Pipeline dries up before a key program launch", "Onboarding bottleneck delays readiness"],
      operatingAreas: ["INSTRUCTORS", "APPLICATIONS"],
      leadershipOwners: [{ name: "Hiring Chair", role: "Owns the screening + onboarding funnel" }],
      stakeholders: [{ name: "Applicants", role: "Move through the funnel" }, { name: "Program leads", role: "Consume instructor capacity" }],
      historicalContext: "Instructor recruiting has historically been reactive — ramping only when a class needed staffing.",
      lessonsLearned: ["A standing pipeline beats just-in-time scrambling"],
      futureOpportunities: ["Instructor alumni who return each season", "Peer-led onboarding"],
    },
    knowledge: {
      overview: "Instructor Growth is the upstream people pipeline: recruiting → screening → onboarding → development.",
      strategy: "Keep a standing pipeline warm so program launches never wait on staffing.",
    },
    dependencies: [
      { type: "blocks", targetInitiativeId: "summer-camps-2026", reason: "Camps can't run without enough trained instructors." },
      { type: "relates_to", targetInitiativeId: "mentorship-3", reason: "Instructor development overlaps with mentorship." },
    ],
  },

  "mentorship-3": {
    charter: {
      mission: "Make sure every mentee has a mentor who shows up, and every pairing produces real growth.",
      purpose: "Mentorship is YPP's retention and development engine — strong pairs keep students and instructors engaged.",
      successDefinition: "Every active pair has a check-in rhythm and tracked outcomes, with few at-risk pairings.",
      strategicImportance: "Mentorship quality drives retention across the whole org.",
      targetOutcomes: ["Reliable check-in cadence for all pairs", "Visible mentee progress"],
      keyMetrics: [{ label: "Pairs with a recent check-in", cadence: "weekly", source: "mentorship tracker" }],
      assumptions: ["Enough mentors with capacity"],
      constraints: ["Mentor availability"],
      risks: ["Pairs go quiet and drift", "Unmatched mentees pile up"],
      operatingAreas: ["MENTORSHIP"],
      leadershipOwners: [{ name: "Mentorship Lead", role: "Owns matching + rhythm" }],
      stakeholders: [{ name: "Mentors" }, { name: "Mentees" }],
    },
    knowledge: {
      overview: "Mentorship 3.0 levels up matching, the check-in rhythm, and outcome tracking for every pair.",
    },
    dependencies: [
      { type: "relates_to", targetInitiativeId: "instructor-growth", reason: "Mentorship supports instructor development." },
    ],
  },

  "partnership-growth": {
    charter: {
      mission: "Grow the network of partners and schools that host YPP programming.",
      purpose: "Partnerships are the channel through which YPP reaches students and delivers programming.",
      successDefinition: "A growing, active partner network with signed agreements and live delivery.",
      strategicImportance: "Partnerships unlock camps, chapters, and class reach.",
      targetOutcomes: ["More active partners", "Faster outreach-to-agreement cycle"],
      keyMetrics: [{ label: "Active partners", cadence: "monthly", source: "partner pipeline" }],
      assumptions: ["Outreach capacity is available"],
      constraints: ["Relationship-building takes time"],
      risks: ["Pipeline stalls at the agreement stage"],
      operatingAreas: ["PARTNERSHIPS"],
      leadershipOwners: [{ name: "Partnerships Lead" }],
      stakeholders: [{ name: "Partner schools / orgs" }],
    },
    knowledge: {
      overview: "Partnership Growth runs the outreach → agreements → activation pipeline.",
    },
    dependencies: [
      { type: "blocks", targetInitiativeId: "summer-camps-2026", reason: "Camps need host-site agreements." },
      { type: "relates_to", targetInitiativeId: "chapter-expansion", reason: "New chapters often start from a partner relationship." },
    ],
  },

  "chapter-expansion": {
    charter: {
      mission: "Launch and stabilize new YPP chapters so the organization grows beyond its current footprint.",
      purpose: "Chapters are how YPP scales geographically and reaches new student communities.",
      successDefinition: "New chapters reach their first programming with stable leadership.",
      strategicImportance: "Chapter growth is YPP's long-term expansion engine.",
      targetOutcomes: ["New chapters launched", "Stable chapter leadership in place"],
      keyMetrics: [{ label: "Chapters reaching first programming", cadence: "per cohort" }],
      assumptions: ["Local leadership can be recruited"],
      constraints: ["Founding-leader bandwidth"],
      risks: ["A new chapter launches then stalls without support"],
      operatingAreas: ["CHAPTERS"],
      leadershipOwners: [{ name: "Expansion Lead" }],
      stakeholders: [{ name: "Prospective chapter leaders" }],
    },
    dependencies: [
      { type: "relates_to", targetInitiativeId: "partnership-growth", reason: "Chapters often begin with a local partner." },
    ],
  },
};

const PROFILE_BY_ID = new Map<string, PartialProfile>(Object.entries(INITIATIVE_PROFILES));

/**
 * The fully-defaulted strategic profile for an initiative. Always returns a
 * complete object (nulls + empty arrays) so any surface can render any section
 * without a guard. Pure.
 */
export function getInitiativeProfile(initiativeId: string): InitiativeProfile {
  const partial = PROFILE_BY_ID.get(initiativeId);
  return {
    charter: { ...emptyCharter(), ...(partial?.charter ?? {}) },
    knowledge: { ...emptyKnowledge(), ...(partial?.knowledge ?? {}) },
    scenarios: partial?.scenarios ?? [],
    dependencies: partial?.dependencies ?? [],
  };
}

/** True when the charter has any authored content (drives "show the section?"). */
export function charterHasContent(charter: InitiativeCharter): boolean {
  return Boolean(
    charter.mission ||
      charter.purpose ||
      charter.successDefinition ||
      charter.strategicImportance ||
      charter.historicalContext ||
      charter.targetOutcomes.length ||
      charter.keyMetrics.length ||
      charter.assumptions.length ||
      charter.constraints.length ||
      charter.risks.length ||
      charter.leadershipOwners.length ||
      charter.stakeholders.length ||
      charter.lessonsLearned.length ||
      charter.futureOpportunities.length
  );
}

/** True when the knowledge base has any authored content. */
export function knowledgeHasContent(kb: InitiativeKnowledgeBase): boolean {
  return Boolean(
    kb.overview ||
      kb.background ||
      kb.strategy ||
      kb.playbooks.length ||
      kb.resources.length ||
      kb.documents.length ||
      kb.templates.length ||
      kb.faqs.length ||
      kb.historicalNotes.length ||
      kb.retrospectives.length ||
      kb.futureIdeas.length
  );
}
