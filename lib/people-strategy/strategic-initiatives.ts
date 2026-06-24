import {
  isActionType,
  type ActionType,
} from "./action-types";
import {
  isRelatedEntityType,
  type RelatedEntityType,
} from "./constants";
import {
  isMeetingCategory,
  type MeetingCategory,
} from "./meeting-categories";
import {
  areaForRelatedEntityType,
  operationalAreaLabel,
  type OperationalArea,
} from "./operational-context";

/**
 * YPP Execution OS — Strategic Initiative MODEL (Phase II).
 *
 * The new layer ABOVE actions, meetings, decisions, and entities. A strategic
 * initiative is a major organizational goal / long-running program / project /
 * campaign / expansion (Summer Camps 2026, Instructor Growth, Mentorship 3.0,
 * …). Leadership should stop seeing hundreds of disconnected actions and start
 * seeing initiatives → milestones → progress → momentum → risk → ownership.
 *
 * This module is the canonical, PURE (no DB, no session, no React) vocabulary
 * for that layer — exactly the pattern the rest of the People Strategy OS uses
 * for its controlled vocabularies ({@link MeetingCategory}, {@link ActionType},
 * the polymorphic related-entity types). Like those, an initiative is config,
 * not a Postgres row: adding one never needs a migration.
 *
 * CRUCIALLY, an initiative carries no copy of the work it contains. It declares
 * a deterministic {@link InitiativeMatch} — a set of signals (operating area,
 * action type, related entity, the action's own `goalCategory`, and keyword
 * sets) — and the derivation layer CLASSIFIES the already-loaded actions /
 * meetings / decisions into the initiatives they match. There is no duplicate
 * manual entry and no second source of truth: an initiative's health, momentum,
 * progress, risk, milestones, and timeline are all derived from real system
 * state, and every match is explainable ("matched on goal category 'Summer
 * Camps' and the keyword 'camp'").
 */

// --- status ------------------------------------------------------------------

/**
 * The lifecycle state of an initiative. `planning` / `active` / `paused` are the
 * in-flight states the health engine scores from live work; `completed` /
 * `archived` are terminal states that short-circuit health to a calm terminal
 * read (you do not "fail" an archived initiative). String-typed config, never a
 * Postgres enum.
 */
export const INITIATIVE_STATUS_VALUES = [
  "planning",
  "active",
  "paused",
  "completed",
  "archived",
] as const;
export type InitiativeStatus = (typeof INITIATIVE_STATUS_VALUES)[number];

export const INITIATIVE_STATUS_LABELS: Record<InitiativeStatus, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

/** Terminal states get a calm read and are excluded from "needs attention". */
export function isTerminalStatus(status: InitiativeStatus): boolean {
  return status === "completed" || status === "archived";
}

// --- priority ----------------------------------------------------------------

/**
 * How much leadership focus an initiative deserves. Mirrors the numeric-weight
 * pattern of {@link ACTION_PRIORITY_WEIGHT} so the executive dashboard can rank
 * "leadership priorities" deterministically.
 */
export const INITIATIVE_PRIORITY_VALUES = [
  "flagship",
  "high",
  "medium",
  "low",
] as const;
export type InitiativePriority = (typeof INITIATIVE_PRIORITY_VALUES)[number];

export const INITIATIVE_PRIORITY_LABELS: Record<InitiativePriority, string> = {
  flagship: "Flagship",
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

/** Higher = more important. Used to rank Leadership Priorities + tie-break. */
export const INITIATIVE_PRIORITY_WEIGHT: Record<InitiativePriority, number> = {
  flagship: 3,
  high: 2,
  medium: 1,
  low: 0,
};

// --- the match spec ----------------------------------------------------------

/**
 * The deterministic rule that decides which already-loaded work belongs to an
 * initiative or a milestone. Every field is optional; an item matches when it
 * satisfies AT LEAST ONE configured signal (OR semantics), and the matcher
 * records WHICH signals fired so the membership is always explainable.
 *
 * Signal strength (documented so ranking can never silently drift):
 *   - STRONG  (weight 3): `goalCategories`, `entityRefs` — an explicit, author-
 *     intended ladder ("this action ladders up to goal X" / "this is partner Y").
 *   - MEDIUM  (weight 2): `keywords`, `actionTypes` — strong textual / kind signal.
 *   - CONTEXT (weight 1): `entityTypes`, `areas` — the broad neighbourhood.
 *
 * Keeping `areas`/`entityTypes` weak stops every CLASSES action from being
 * swept into every CLASSES initiative; an item only lands in an initiative on a
 * contextual-only signal when the initiative declares no stronger signal.
 */
export type InitiativeMatch = {
  /** Operating areas this initiative lives in (an action's entity area / a meeting's category). */
  areas?: OperationalArea[];
  /** Action kinds that belong here (e.g. INSTRUCTOR_RECRUITING for Instructor Growth). */
  actionTypes?: ActionType[];
  /** Related-entity types whose work rolls up here (e.g. PARTNER for Partnership Growth). */
  entityTypes?: RelatedEntityType[];
  /** Specific entities (a known class id, a known partner id) — the strongest contextual link. */
  entityRefs?: Array<{ type: RelatedEntityType; id: string }>;
  /** `ActionItem.goalCategory` values that ladder up here (case-insensitive). */
  goalCategories?: string[];
  /** Keywords matched against an item's title + description / purpose (case-insensitive, word-ish). */
  keywords?: string[];
};

export const MATCH_SIGNAL_WEIGHT = {
  goalCategory: 3,
  entityRef: 3,
  keyword: 2,
  actionType: 2,
  entityType: 1,
  area: 1,
} as const;

// --- milestone + initiative definitions --------------------------------------

/**
 * A milestone is a major checkpoint INSIDE an initiative ("Secure Camp
 * Partners", "Run Pilot"). It aggregates the subset of the initiative's work
 * that also matches its own (usually keyword) {@link InitiativeMatch}; its
 * completion %, status, and health are derived from that work, never entered by
 * hand. Order is explicit so a roadmap reads top-to-bottom.
 */
export type InitiativeMilestoneDef = {
  id: string;
  title: string;
  description?: string;
  /** Display + sort order within the initiative (ascending). */
  order: number;
  /** Optional target date (ISO) for the strategic timeline + "behind schedule" risk. */
  targetDateISO?: string;
  /** Optional named owner; falls back to the initiative owner / derived owner. */
  owner?: string;
  /**
   * The workstream this milestone belongs to (Phase B). When set, the milestone
   * rolls up under that workstream in the Initiative → Workstream → Milestone →
   * Action hierarchy; when absent it stays a top-level initiative milestone.
   */
  workstreamId?: string;
  /** How this milestone's work is recognised within the initiative's matched set. */
  match: InitiativeMatch;
};

/**
 * A WORKSTREAM (Phase B) — the primary management unit INSIDE an initiative. An
 * initiative the size of "Summer Camps 2026" is really many parallel programs
 * (Partnership Development, Curriculum Development, Instructor Recruitment,
 * Marketing, Operations, Parent Communication, Measurement); a workstream is one
 * of them. Like the initiative itself it carries no copy of its work — it
 * declares a deterministic {@link InitiativeMatch} and the derivation layer
 * classifies the initiative's already-matched work into the workstream, then runs
 * the SAME health / momentum / progress / risk / ownership engines on that
 * subset. Workstreams sit between the initiative and its milestones:
 * Initiative → Workstream → Milestone → Action.
 */
export type WorkstreamDef = {
  id: string;
  title: string;
  description?: string;
  /** The accountable owner of this workstream, when named. Derived when absent. */
  owner?: string;
  /** User id of the team/workstream lead when the owner is linked to a portal user. */
  leadUserId?: string;
  /** Additional user ids who can lead this team/workstream. */
  leadUserIds?: string[];
  /** Optional target date (ISO) for the workstream's own timeline + schedule risk. */
  targetDateISO?: string;
  /** Display order within the initiative (ascending). */
  order: number;
  /** How this workstream's work is recognised within the initiative's matched set. */
  match: InitiativeMatch;
};

export type StrategicInitiativeDef = {
  id: string;
  title: string;
  description: string;
  /** The accountable leader, when named. Ownership clarity is derived when absent. */
  owner?: string;
  /** Named co-leads for display/back-compat with initiatives that do not map to users. */
  leads?: string[];
  /** User ids of initiative leads when leadership is linked to portal users. */
  leadUserIds?: string[];
  /** The operating area this initiative rolls up to (drives the strategic map grouping). */
  area: OperationalArea;
  status: InitiativeStatus;
  priority: InitiativePriority;
  /** Optional start / target dates (ISO) for the timeline + schedule risk. */
  startDateISO?: string;
  targetDateISO?: string;
  /** The deterministic membership rule for the initiative's work. */
  match: InitiativeMatch;
  /**
   * The workstreams that organise this initiative's work (Phase B). Optional — an
   * initiative with none degrades to the flat milestone view it always had.
   */
  workstreams?: WorkstreamDef[];
  /** Major checkpoints, in roadmap order. Tag each with `workstreamId` to nest it. */
  milestones: InitiativeMilestoneDef[];
  /** Sibling initiatives this one is strategically linked to (ids), for the map + graph. */
  relatedInitiatives?: string[];
};

// --- the seeded registry -----------------------------------------------------

/**
 * The curated set of YPP strategic initiatives. These are the major
 * organizational goals leadership tracks; they are version-controlled config
 * (reviewable in a PR) rather than ad-hoc rows, so the "what is YPP trying to
 * accomplish" picture is intentional and stable. Each declares a matcher tuned
 * to the existing operating signals so it aggregates real work with no manual
 * upkeep. Areas use the existing operating-area vocabulary (there is no separate
 * "Camps" area — Summer Camps rolls up to CLASSES as a program of delivery).
 */
export const STRATEGIC_INITIATIVES: StrategicInitiativeDef[] = [
  {
    id: "global-operations-impact",
    title: "Global Operations Impact",
    description:
      "Run the weekly global-team accountability loop: Tech, Fundraising, Expansion, and Socials submit updates with proof, blockers, decisions, and next commitments.",
    owner: "Senior leadership",
    leads: ["Senior leadership"],
    area: "OPERATIONS",
    status: "active",
    priority: "flagship",
    relatedInitiatives: [
      "chapter-expansion",
      "partnership-growth",
      "portal-modernization",
      "action-tracker-4",
    ],
    match: {
      areas: ["OPERATIONS", "TECHNOLOGY", "FINANCE", "CHAPTERS", "MARKETING", "PARTNERSHIPS"],
      goalCategories: [
        "Global Operations Impact",
        "Impact Meeting",
        "Team Impact Update",
        "Fundraising",
        "Expansion",
        "Socials",
        "Tech",
      ],
      keywords: [
        "impact update",
        "impact meeting",
        "team update",
        "global operations",
        "fundraising",
        "donor",
        "sponsor",
        "expansion",
        "chapter expansion",
        "social media",
        "socials",
        "instagram",
        "content calendar",
        "portal",
        "bug",
        "automation",
        "rollout",
      ],
    },
    workstreams: [
      {
        id: "tech",
        title: "Tech",
        order: 1,
        description:
          "Portal updates, bugs fixed, features shipped, data or automation work, testing, and rollout blockers.",
        match: {
          areas: ["TECHNOLOGY"],
          actionTypes: ["ADMIN_TASK", "OPERATIONS"],
          goalCategories: ["Tech", "Technology", "Portal", "Portal Modernization"],
          keywords: [
            "tech",
            "technology",
            "portal",
            "bug",
            "feature",
            "automation",
            "data",
            "rollout",
            "testing",
            "qa",
            "build",
          ],
        },
      },
      {
        id: "fundraising",
        title: "Fundraising",
        order: 2,
        description:
          "Outreach completed, donor or sponsor progress, materials created, responses received, and funding decisions needed.",
        match: {
          areas: ["FINANCE", "PARTNERSHIPS"],
          actionTypes: ["OUTREACH", "PARTNERSHIP", "EMAIL", "CALL"],
          goalCategories: ["Fundraising", "Finance", "Sponsors", "Donors"],
          keywords: [
            "fundraising",
            "fundraiser",
            "donor",
            "sponsor",
            "donation",
            "grant",
            "pitch deck",
            "pitch",
            "outreach list",
            "sponsor tracker",
          ],
        },
      },
      {
        id: "expansion",
        title: "Expansion",
        order: 3,
        description:
          "New areas contacted, parent or alumni outreach, chapter leads, partner conversations, and launch blockers.",
        match: {
          areas: ["CHAPTERS", "PARTNERSHIPS", "OPERATIONS"],
          actionTypes: ["OUTREACH", "PARTNERSHIP", "RELATIONSHIP"],
          goalCategories: ["Expansion", "Chapter Expansion", "Parent Outreach", "Alumni Outreach"],
          keywords: [
            "expansion",
            "new area",
            "chapter lead",
            "chapter president",
            "parent outreach",
            "alumni outreach",
            "expansion tracker",
            "chapter list",
            "outreach script",
          ],
        },
      },
      {
        id: "socials",
        title: "Socials",
        order: 4,
        description:
          "Posts created, posts scheduled, campaign results, needed approvals, upcoming content, and analytics.",
        match: {
          areas: ["MARKETING"],
          actionTypes: ["OUTREACH", "EMAIL", "OPERATIONS"],
          goalCategories: ["Socials", "Social Media", "Marketing", "Content"],
          keywords: [
            "socials",
            "social media",
            "instagram",
            "facebook",
            "tiktok",
            "post",
            "posts",
            "content",
            "campaign",
            "graphic",
            "canva",
            "content calendar",
            "analytics",
          ],
        },
      },
      {
        id: "chapters",
        title: "Chapter Updates",
        order: 5,
        description:
          "Chapter health, new chapter launches, chapter lead check-ins, demo days, and cross-chapter coordination.",
        match: {
          areas: ["CHAPTERS", "OPERATIONS"],
          actionTypes: ["OUTREACH", "RELATIONSHIP", "OPERATIONS"],
          goalCategories: ["Chapters", "Chapter Updates", "Chapter Health", "Chapter Launch"],
          keywords: [
            "chapter",
            "chapters",
            "chapter update",
            "chapter health",
            "chapter lead",
            "demo day",
            "newark",
            "edison",
            "roundtable",
          ],
        },
      },
    ],
    milestones: [
      {
        id: "weekly-team-updates",
        title: "Collect weekly team updates",
        order: 1,
        match: { keywords: ["impact update", "team update", "weekly update"] },
      },
      {
        id: "review-deliverables",
        title: "Review deliverables",
        order: 2,
        match: { keywords: ["deliverable", "proof", "tracker", "draft", "calendar", "screenshot"] },
      },
      {
        id: "resolve-blockers",
        title: "Resolve blockers and decisions",
        order: 3,
        match: { keywords: ["blocker", "blocked", "decision", "approval", "stuck"] },
      },
      {
        id: "create-follow-ups",
        title: "Create follow-up actions",
        order: 4,
        match: { keywords: ["follow-up", "next commitment", "next action", "commitment"] },
      },
    ],
  },
  {
    id: "summer-camps-2026",
    title: "Summer Camps 2026",
    description:
      "Stand up YPP's 2026 summer camp slate end-to-end — partners, curriculum, instructors, a pilot, feedback, and expansion.",
    area: "CLASSES",
    status: "active",
    priority: "flagship",
    relatedInitiatives: ["partnership-growth", "instructor-growth", "class-quality"],
    match: {
      areas: ["CLASSES", "PARTNERSHIPS"],
      goalCategories: ["Summer Camps", "Summer Camps 2026", "Camps"],
      keywords: ["summer camp", "camp", "camps"],
    },
    workstreams: [
      { id: "partnership-development", title: "Partnership Development", order: 1, description: "Secure the host sites, venues, and sponsors that make camps possible.", match: { keywords: ["partner", "host", "venue", "site", "sponsor", "agreement"] } },
      { id: "curriculum-development", title: "Curriculum Development", order: 2, description: "Design the camp curriculum, lesson plans, and content.", match: { keywords: ["curriculum", "lesson", "syllabus", "content", "activity"] } },
      { id: "instructor-recruitment", title: "Instructor Recruitment", order: 3, description: "Recruit, screen, and train the camp instructors and counselors.", match: { keywords: ["instructor", "recruit", "staff", "counselor", "teacher"] } },
      { id: "marketing", title: "Marketing", order: 4, description: "Promote the camps and drive student enrollment.", match: { keywords: ["marketing", "promote", "flyer", "enroll", "registration", "advertise", "social"] } },
      { id: "operations", title: "Operations", order: 5, description: "Logistics, scheduling, supplies, and running the pilot + sessions.", match: { keywords: ["logistics", "schedule", "operations", "supplies", "pilot", "run", "trial", "dry run", "first session"] } },
      { id: "parent-communication", title: "Parent Communication", order: 6, description: "Keep families informed before, during, and after camp.", match: { keywords: ["parent", "family", "communication", "newsletter", "update", "guardian"] } },
      { id: "measurement", title: "Measurement", order: 7, description: "Collect feedback and measure outcomes to drive the next round.", match: { keywords: ["feedback", "survey", "measure", "data", "outcome", "evaluation", "reflection"] } },
    ],
    milestones: [
      { id: "secure-camp-partners", title: "Secure camp partners", order: 1, workstreamId: "partnership-development", match: { keywords: ["partner", "host", "venue", "site", "secure"] } },
      { id: "develop-curriculum", title: "Develop curriculum", order: 2, workstreamId: "curriculum-development", match: { keywords: ["curriculum", "lesson", "syllabus", "content"] } },
      { id: "recruit-instructors", title: "Recruit instructors", order: 3, workstreamId: "instructor-recruitment", match: { keywords: ["instructor", "recruit", "staff", "counselor"] } },
      { id: "run-pilot", title: "Run pilot", order: 4, workstreamId: "operations", match: { keywords: ["pilot", "trial", "dry run", "first session"] } },
      { id: "collect-feedback", title: "Collect feedback", order: 5, workstreamId: "measurement", match: { keywords: ["feedback", "survey", "review", "reflection"] } },
      { id: "expand-program", title: "Expand program", order: 6, workstreamId: "operations", match: { keywords: ["expand", "scale", "roll out", "rollout", "grow"] } },
    ],
  },
  {
    id: "instructor-growth",
    title: "Instructor Growth",
    description:
      "Grow the instructor base — recruit, screen, onboard, and develop the people who teach YPP classes.",
    area: "INSTRUCTORS",
    status: "active",
    priority: "high",
    relatedInitiatives: ["summer-camps-2026", "class-quality", "mentorship-3"],
    match: {
      areas: ["INSTRUCTORS", "APPLICATIONS"],
      actionTypes: ["INSTRUCTOR_RECRUITING", "INSTRUCTOR_ONBOARDING", "APPLICATION_REVIEW"],
      entityTypes: ["INSTRUCTOR_APPLICATION"],
      goalCategories: ["Instructor Growth"],
      keywords: ["instructor", "applicant", "recruit", "onboard"],
    },
    workstreams: [
      { id: "recruiting", title: "Recruiting", order: 1, description: "Source and attract instructor candidates.", match: { actionTypes: ["INSTRUCTOR_RECRUITING"], keywords: ["recruit", "source", "outreach", "pipeline"] } },
      { id: "screening", title: "Screening", order: 2, description: "Review applications and interview candidates.", match: { actionTypes: ["APPLICATION_REVIEW"], keywords: ["review", "interview", "screen", "applicant"] } },
      { id: "onboarding", title: "Onboarding", order: 3, description: "Train and ready new instructors to teach.", match: { actionTypes: ["INSTRUCTOR_ONBOARDING"], keywords: ["onboard", "training", "ready to teach"] } },
      { id: "development", title: "Development", order: 4, description: "Coach and grow active instructors.", match: { keywords: ["develop", "mentor", "feedback", "growth", "coaching"] } },
    ],
    milestones: [
      { id: "build-pipeline", title: "Build recruiting pipeline", order: 1, workstreamId: "recruiting", match: { keywords: ["recruit", "source", "outreach", "pipeline"] } },
      { id: "screen-applicants", title: "Screen applicants", order: 2, workstreamId: "screening", match: { actionTypes: ["APPLICATION_REVIEW"], keywords: ["review", "interview", "screen", "applicant"] } },
      { id: "onboard-instructors", title: "Onboard instructors", order: 3, workstreamId: "onboarding", match: { actionTypes: ["INSTRUCTOR_ONBOARDING"], keywords: ["onboard", "training", "ready to teach"] } },
      { id: "develop-instructors", title: "Develop instructors", order: 4, workstreamId: "development", match: { keywords: ["develop", "mentor", "feedback", "growth"] } },
    ],
  },
  {
    id: "mentorship-3",
    title: "Mentorship 3.0",
    description:
      "Level up the mentorship program — matching, check-in rhythm, and outcomes for every mentor/mentee pair.",
    area: "MENTORSHIP",
    status: "active",
    priority: "high",
    relatedInitiatives: ["instructor-growth", "leadership-development"],
    match: {
      areas: ["MENTORSHIP"],
      entityTypes: ["MENTORSHIP"],
      goalCategories: ["Mentorship 3.0", "Mentorship"],
      keywords: ["mentor", "mentee", "mentorship", "match"],
    },
    workstreams: [
      { id: "matching-ws", title: "Matching", order: 1, description: "Pair mentors and mentees well.", match: { keywords: ["match", "matching", "pair", "assign"] } },
      { id: "rhythm-ws", title: "Check-in Rhythm", order: 2, description: "Establish a reliable check-in cadence.", match: { keywords: ["check-in", "checkin", "cadence", "rhythm", "meeting", "session"] } },
      { id: "outcomes-ws", title: "Outcomes", order: 3, description: "Track mentee goals and progress.", match: { keywords: ["outcome", "goal", "progress", "completion", "growth"] } },
    ],
    milestones: [
      { id: "matching", title: "Improve matching", order: 1, workstreamId: "matching-ws", match: { keywords: ["match", "matching", "pair", "assign"] } },
      { id: "checkin-rhythm", title: "Establish check-in rhythm", order: 2, workstreamId: "rhythm-ws", match: { keywords: ["check-in", "checkin", "cadence", "rhythm", "meeting"] } },
      { id: "outcomes", title: "Track outcomes", order: 3, workstreamId: "outcomes-ws", match: { keywords: ["outcome", "goal", "progress", "completion"] } },
    ],
  },
  {
    id: "chapter-expansion",
    title: "Chapter Expansion",
    description:
      "Launch and stabilize new YPP chapters — recruit chapter leadership, onboard, and reach first programming.",
    area: "CHAPTERS",
    status: "active",
    priority: "high",
    match: {
      areas: ["CHAPTERS"],
      goalCategories: ["Chapter Expansion"],
      keywords: ["chapter", "expansion", "launch", "new chapter"],
    },
    milestones: [
      { id: "identify-regions", title: "Identify target regions", order: 1, match: { keywords: ["region", "target", "scout", "identify"] } },
      { id: "recruit-leadership", title: "Recruit chapter leadership", order: 2, match: { keywords: ["president", "leadership", "recruit", "officer"] } },
      { id: "onboard-chapter", title: "Onboard chapter", order: 3, match: { keywords: ["onboard", "charter", "setup", "set up"] } },
      { id: "first-programming", title: "Reach first programming", order: 4, match: { keywords: ["first class", "first event", "programming", "launch"] } },
    ],
  },
  {
    id: "partnership-growth",
    title: "Partnership Growth",
    description:
      "Grow the partner / school network that hosts YPP programming — outreach, agreements, and active delivery.",
    area: "PARTNERSHIPS",
    status: "active",
    priority: "high",
    relatedInitiatives: ["summer-camps-2026", "chapter-expansion"],
    match: {
      areas: ["PARTNERSHIPS"],
      actionTypes: ["PARTNERSHIP"],
      entityTypes: ["PARTNER"],
      goalCategories: ["Partnership Growth", "Partnerships"],
      keywords: ["partner", "partnership", "school", "sponsor"],
    },
    workstreams: [
      { id: "outreach-ws", title: "Outreach", order: 1, description: "Find and reach prospective partners.", match: { keywords: ["outreach", "reach out", "contact", "intro", "prospect"] } },
      { id: "agreements-ws", title: "Agreements", order: 2, description: "Negotiate and close partnership agreements.", match: { keywords: ["agreement", "contract", "mou", "sign", "close", "terms"] } },
      { id: "activation-ws", title: "Activation", order: 3, description: "Launch and run active delivery with partners.", match: { keywords: ["launch", "deliver", "kickoff", "kick off", "active", "onboard"] } },
    ],
    milestones: [
      { id: "outreach", title: "Run partner outreach", order: 1, workstreamId: "outreach-ws", match: { keywords: ["outreach", "reach out", "contact", "intro"] } },
      { id: "agreements", title: "Close agreements", order: 2, workstreamId: "agreements-ws", match: { keywords: ["agreement", "contract", "mou", "sign", "close"] } },
      { id: "activate", title: "Activate delivery", order: 3, workstreamId: "activation-ws", match: { keywords: ["launch", "deliver", "kickoff", "kick off", "active"] } },
    ],
  },
  {
    id: "student-retention",
    title: "Student Retention",
    description:
      "Keep students engaged and re-enrolling — attendance, follow-up, and reducing drop-off across classes.",
    area: "CLASSES",
    status: "active",
    priority: "medium",
    match: {
      areas: ["CLASSES"],
      goalCategories: ["Student Retention", "Retention"],
      keywords: ["retention", "attendance", "re-enroll", "reenroll", "dropout", "drop-off", "engagement", "churn"],
    },
    milestones: [
      { id: "measure", title: "Measure attendance & drop-off", order: 1, match: { keywords: ["attendance", "measure", "track", "data"] } },
      { id: "intervene", title: "Run interventions", order: 2, match: { keywords: ["follow up", "follow-up", "outreach", "intervention", "re-engage"] } },
      { id: "reenroll", title: "Drive re-enrollment", order: 3, match: { keywords: ["re-enroll", "reenroll", "renew", "return"] } },
    ],
  },
  {
    id: "class-quality",
    title: "Class Quality",
    description:
      "Raise the quality bar of every YPP class — curriculum, lesson planning, and instructor feedback loops.",
    area: "CLASSES",
    status: "active",
    priority: "medium",
    match: {
      areas: ["CLASSES"],
      actionTypes: ["CURRICULUM", "CLASS_PLANNING"],
      entityTypes: ["CLASS_OFFERING"],
      goalCategories: ["Class Quality"],
      keywords: ["curriculum", "lesson plan", "class quality", "quality", "rubric"],
    },
    milestones: [
      { id: "standards", title: "Set quality standards", order: 1, match: { keywords: ["standard", "rubric", "bar", "define"] } },
      { id: "curriculum", title: "Strengthen curriculum", order: 2, match: { actionTypes: ["CURRICULUM"], keywords: ["curriculum", "lesson", "content"] } },
      { id: "feedback-loop", title: "Close feedback loops", order: 3, match: { keywords: ["feedback", "observe", "review", "coaching"] } },
    ],
  },
  {
    id: "action-tracker-4",
    title: "Action Tracker 4.0",
    description:
      "Evolve the Action Tracker into the YPP Execution OS — initiatives, the strategic timeline, and program intelligence.",
    area: "TECHNOLOGY",
    status: "active",
    priority: "medium",
    match: {
      areas: ["TECHNOLOGY"],
      goalCategories: ["Action Tracker 4.0", "Action Tracker"],
      keywords: ["action tracker", "execution os", "tracker", "command center", "initiative"],
    },
    milestones: [
      { id: "initiatives", title: "Ship initiative layer", order: 1, match: { keywords: ["initiative", "milestone", "program"] } },
      { id: "timeline", title: "Ship strategic timeline", order: 2, match: { keywords: ["timeline", "history", "event"] } },
      { id: "intelligence", title: "Ship program intelligence", order: 3, match: { keywords: ["health", "momentum", "risk", "recommendation"] } },
    ],
  },
  {
    id: "portal-modernization",
    title: "Portal Modernization",
    description:
      "Modernize the YPP portal — performance, accessibility, mobile, and a consistent premium experience.",
    area: "TECHNOLOGY",
    status: "active",
    priority: "medium",
    match: {
      areas: ["TECHNOLOGY"],
      goalCategories: ["Portal Modernization"],
      keywords: ["portal", "modernization", "redesign", "performance", "accessibility", "mobile", "ui", "ux"],
    },
    milestones: [
      { id: "audit", title: "Audit current state", order: 1, match: { keywords: ["audit", "assess", "review"] } },
      { id: "rebuild", title: "Rebuild core surfaces", order: 2, match: { keywords: ["rebuild", "redesign", "refactor", "migrate"] } },
      { id: "polish", title: "Polish & ship", order: 3, match: { keywords: ["polish", "ship", "launch", "release"] } },
    ],
  },
  {
    id: "leadership-development",
    title: "Leadership Development",
    description:
      "Develop the next generation of YPP leaders — officer onboarding, training, and a healthy leadership pipeline.",
    area: "LEADERSHIP",
    status: "active",
    priority: "medium",
    match: {
      areas: ["LEADERSHIP"],
      goalCategories: ["Leadership Development"],
      keywords: ["leadership", "officer", "succession", "training", "development", "pipeline"],
    },
    milestones: [
      { id: "onboard-officers", title: "Onboard officers", order: 1, match: { keywords: ["onboard", "officer", "role"] } },
      { id: "training", title: "Run leadership training", order: 2, match: { keywords: ["training", "develop", "workshop", "coaching"] } },
      { id: "succession", title: "Build succession pipeline", order: 3, match: { keywords: ["succession", "pipeline", "next", "backfill"] } },
    ],
  },
];

// --- registry accessors ------------------------------------------------------

const INITIATIVE_BY_ID = new Map<string, StrategicInitiativeDef>(
  STRATEGIC_INITIATIVES.map((i) => [i.id, i])
);

/** Every initiative definition, in registry (curated) order. */
export function listInitiativeDefs(): StrategicInitiativeDef[] {
  return STRATEGIC_INITIATIVES;
}

/** One initiative definition by id, or null when unknown. */
export function getInitiativeDef(id: string): StrategicInitiativeDef | null {
  return INITIATIVE_BY_ID.get(id) ?? null;
}

/** A milestone definition within an initiative, or null. */
export function getMilestoneDef(
  initiativeId: string,
  milestoneId: string
): InitiativeMilestoneDef | null {
  const init = getInitiativeDef(initiativeId);
  if (!init) return null;
  return init.milestones.find((m) => m.id === milestoneId) ?? null;
}

/** The workstreams of an initiative in display order, or an empty list. */
export function listWorkstreamDefs(initiativeId: string): WorkstreamDef[] {
  const init = getInitiativeDef(initiativeId);
  if (!init || !init.workstreams) return [];
  return [...init.workstreams].sort((a, b) => a.order - b.order);
}

/** A workstream definition within an initiative, or null. */
export function getWorkstreamDef(
  initiativeId: string,
  workstreamId: string
): WorkstreamDef | null {
  const init = getInitiativeDef(initiativeId);
  if (!init || !init.workstreams) return null;
  return init.workstreams.find((w) => w.id === workstreamId) ?? null;
}

export function initiativeStatusLabel(status: InitiativeStatus): string {
  return INITIATIVE_STATUS_LABELS[status];
}

export function initiativePriorityLabel(priority: InitiativePriority): string {
  return INITIATIVE_PRIORITY_LABELS[priority];
}

export function initiativeAreaLabel(area: OperationalArea): string {
  return operationalAreaLabel(area);
}

// --- matchable work ----------------------------------------------------------

/**
 * The DB-free projection of one work item (an action / meeting / decision) the
 * matcher reads. Adapters below build it from the loaded shapes so the matcher
 * never imports Prisma and unit-tests with plain objects.
 */
export type MatchableWork = {
  /** Lower-cased title + description / purpose / decision text, for keyword hits. */
  text: string;
  /** Operating area, when known (action entity area / meeting category). */
  area: OperationalArea | null;
  actionType: ActionType | null;
  entityType: RelatedEntityType | null;
  entityId: string | null;
  /** `ActionItem.goalCategory`, when present. */
  goalCategory: string | null;
};

function lc(value: string | null | undefined): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

/** Normalize the action's loosely-typed string fields to the matcher vocab. */
export function actionToMatchable(action: {
  title: string;
  description?: string | null;
  goalCategory?: string | null;
  actionType?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): MatchableWork {
  const entityType =
    action.relatedEntityType && isRelatedEntityType(action.relatedEntityType)
      ? action.relatedEntityType
      : null;
  return {
    text: `${lc(action.title)} ${lc(action.description)} ${lc(action.goalCategory)}`,
    area: entityType ? areaForRelatedEntityType(entityType) : null,
    actionType:
      action.actionType && isActionType(action.actionType) ? action.actionType : null,
    entityType,
    entityId: entityType ? action.relatedEntityId ?? null : null,
    goalCategory: action.goalCategory ?? null,
  };
}

export function meetingToMatchable(meeting: {
  title: string;
  purpose?: string | null;
  category?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): MatchableWork {
  const entityType =
    meeting.relatedEntityType && isRelatedEntityType(meeting.relatedEntityType)
      ? meeting.relatedEntityType
      : null;
  const area: OperationalArea | null =
    meeting.category && isMeetingCategory(meeting.category)
      ? meeting.category
      : entityType
      ? areaForRelatedEntityType(entityType)
      : null;
  return {
    text: `${lc(meeting.title)} ${lc(meeting.purpose)}`,
    area,
    actionType: null,
    entityType,
    entityId: entityType ? meeting.relatedEntityId ?? null : null,
    goalCategory: null,
  };
}

export function decisionToMatchable(decision: {
  decision: string;
  meetingCategory?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}): MatchableWork {
  const entityType =
    decision.relatedEntityType && isRelatedEntityType(decision.relatedEntityType)
      ? decision.relatedEntityType
      : null;
  const area: OperationalArea | null =
    decision.meetingCategory && isMeetingCategory(decision.meetingCategory)
      ? decision.meetingCategory
      : entityType
      ? areaForRelatedEntityType(entityType)
      : null;
  return {
    text: lc(decision.decision),
    area,
    actionType: null,
    entityType,
    entityId: entityType ? decision.relatedEntityId ?? null : null,
    goalCategory: null,
  };
}

// --- the matcher -------------------------------------------------------------

export type MatchSignal =
  | "goalCategory"
  | "entityRef"
  | "keyword"
  | "actionType"
  | "entityType"
  | "area";

export type MatchResult = {
  matched: boolean;
  /** Sum of fired-signal weights — higher = a more confident match. */
  score: number;
  /** The signals that fired (strongest first), for explainability. */
  signals: MatchSignal[];
  /** Human-readable reasons ("goal category 'Summer Camps'", "keyword 'camp'"). */
  reasons: string[];
};

/** Does a keyword appear in the work's text as a word-ish substring? */
function keywordHit(text: string, keyword: string): boolean {
  const needle = keyword.toLowerCase().trim();
  if (!needle) return false;
  return text.includes(needle);
}

/**
 * Score one work item against one match spec. OR semantics: any fired signal
 * makes it a match. Records each fired signal + a reason so the membership is
 * fully explainable. STRONG signals (goalCategory / entityRef) are listed first.
 * Pure + unit-tested.
 */
export function matchWork(work: MatchableWork, match: InitiativeMatch): MatchResult {
  const signals: MatchSignal[] = [];
  const reasons: string[] = [];
  let score = 0;

  // STRONG — explicit author intent.
  if (match.goalCategories && work.goalCategory) {
    const wc = work.goalCategory.toLowerCase().trim();
    const hit = match.goalCategories.find((g) => g.toLowerCase().trim() === wc);
    if (hit) {
      signals.push("goalCategory");
      reasons.push(`goal category “${hit}”`);
      score += MATCH_SIGNAL_WEIGHT.goalCategory;
    }
  }
  if (match.entityRefs && work.entityType && work.entityId) {
    const hit = match.entityRefs.find(
      (r) => r.type === work.entityType && r.id === work.entityId
    );
    if (hit) {
      signals.push("entityRef");
      reasons.push("a directly linked entity");
      score += MATCH_SIGNAL_WEIGHT.entityRef;
    }
  }

  // MEDIUM — strong textual / kind signal.
  if (match.keywords) {
    const hit = match.keywords.find((k) => keywordHit(work.text, k));
    if (hit) {
      signals.push("keyword");
      reasons.push(`keyword “${hit}”`);
      score += MATCH_SIGNAL_WEIGHT.keyword;
    }
  }
  if (match.actionTypes && work.actionType) {
    if (match.actionTypes.includes(work.actionType)) {
      signals.push("actionType");
      reasons.push(`action type ${work.actionType}`);
      score += MATCH_SIGNAL_WEIGHT.actionType;
    }
  }

  // CONTEXT — broad neighbourhood.
  if (match.entityTypes && work.entityType) {
    if (match.entityTypes.includes(work.entityType)) {
      signals.push("entityType");
      reasons.push(`linked ${work.entityType}`);
      score += MATCH_SIGNAL_WEIGHT.entityType;
    }
  }
  if (match.areas && work.area) {
    if (match.areas.includes(work.area)) {
      signals.push("area");
      reasons.push(`${operationalAreaLabel(work.area)} area`);
      score += MATCH_SIGNAL_WEIGHT.area;
    }
  }

  return { matched: score > 0, score, signals, reasons };
}

/**
 * Does this work belong to the initiative? An item is included when it fires a
 * STRONG/MEDIUM signal, OR fires a contextual signal AND the initiative declares
 * no stronger signal (so a keyword-driven initiative is not diluted by every
 * action that merely shares its area). Returns the underlying {@link MatchResult}
 * for the caller to surface the reasons.
 */
export function matchesInitiative(
  work: MatchableWork,
  def: StrategicInitiativeDef
): MatchResult {
  const result = matchWork(work, def.match);
  if (!result.matched) return result;

  const declaresStrong =
    (def.match.goalCategories?.length ?? 0) > 0 ||
    (def.match.entityRefs?.length ?? 0) > 0 ||
    (def.match.keywords?.length ?? 0) > 0 ||
    (def.match.actionTypes?.length ?? 0) > 0;
  const firedStrong = result.signals.some(
    (s) => s === "goalCategory" || s === "entityRef" || s === "keyword" || s === "actionType"
  );

  // Contextual-only hit on an initiative that has stronger signals → not a member.
  if (declaresStrong && !firedStrong) {
    return { matched: false, score: result.score, signals: result.signals, reasons: result.reasons };
  }
  return result;
}
