/**
 * YPP role framework — the single source of truth for the Instructor Academy's
 * vocabulary. Every training surface (roadmap, cards, completion panel, admin
 * evidence) should label sections from here so the wording never drifts from
 * the official Goals & Resources (G&R) framework or the promotion ladder.
 *
 * Standardize on this vocabulary. Do NOT introduce the whimsical
 * `InstructorGrowthTier` names (SPARK/PRACTITIONER/…) into training UI — the
 * official ladder below is the motivation.
 *
 * Server-safe and React-free: importable from both server components and the
 * `.mjs` content pipeline.
 */

export type GoalKey =
  | "WELCOME"
  | "GOAL_1"
  | "GOAL_2"
  | "GOAL_3"
  | "GOAL_4"
  | "GOAL_5"
  | "CAPSTONE";

export const GOAL_KEYS: readonly GoalKey[] = [
  "WELCOME",
  "GOAL_1",
  "GOAL_2",
  "GOAL_3",
  "GOAL_4",
  "GOAL_5",
  "CAPSTONE",
] as const;

/** The instructor role mission, verbatim, for hero + completion microcopy. */
export const ROLE_MISSION =
  "Create engaging, meaningful, high-quality learning experiences that help students explore and develop their passions.";

/** The official promotion ladder. Training teaches to the Instructor column
 *  and previews where it goes. Each step lists the typical promotion window. */
export const INSTRUCTOR_LADDER = [
  {
    key: "INSTRUCTOR",
    title: "Instructor",
    promotionWindow: null,
    summary:
      "Delivers strong classroom experiences, builds positive student relationships, and contributes reliably to the YPP community.",
  },
  {
    key: "SENIOR_INSTRUCTOR",
    title: "Senior Instructor",
    promotionWindow: "after 2–4 strong months as Instructor",
    summary:
      "Demonstrates exceptional teaching and mentorship, contributes beyond the classroom through initiatives, events, and leadership, and helps support and develop other instructors.",
  },
  {
    key: "LEAD_INSTRUCTOR",
    title: "Lead Instructor",
    promotionWindow: "after 2–4 strong months as Senior Instructor",
    summary:
      "Provides organization-wide leadership through training, curriculum development, mentorship, program quality oversight, and community-building initiatives.",
  },
] as const;

export type GoalMeta = {
  key: GoalKey;
  /** Roadmap label, e.g. "GOAL 1". Empty for WELCOME / CAPSTONE. */
  badge: string;
  /** Section name shown as the card / module title. */
  title: string;
  /** One-line Instructor-column outcome shown on the roadmap card. */
  outcome: string;
  /** Sequence position in the Academy roadmap. */
  order: number;
};

/**
 * Canonical metadata per section. `title` and `outcome` here are the source of
 * truth for `TrainingModule.title` / `TrainingModule.outcomeStatement`; the
 * curriculum files set the same values so an import keeps the DB in sync.
 */
export const GOAL_META: Record<GoalKey, GoalMeta> = {
  WELCOME: {
    key: "WELCOME",
    badge: "",
    title: "Welcome to YPP",
    outcome: "Know the YPP mission, your role, and where it leads.",
    order: 0,
  },
  GOAL_1: {
    key: "GOAL_1",
    badge: "GOAL 1",
    title: "Curriculum & Class Delivery",
    outcome: "Deliver organized, engaging classes that captivate students.",
    order: 1,
  },
  GOAL_2: {
    key: "GOAL_2",
    badge: "GOAL 2",
    title: "Student & Family Relationships",
    outcome: "Build supportive, trusting relationships with students and families.",
    order: 2,
  },
  GOAL_3: {
    key: "GOAL_3",
    badge: "GOAL 3",
    title: "Organization, Commitment & Reliability",
    outcome: "Be the instructor everyone can count on.",
    order: 3,
  },
  GOAL_4: {
    key: "GOAL_4",
    badge: "GOAL 4",
    title: "YPP Community Involvement",
    outcome: "Strengthen the YPP community you're joining.",
    order: 4,
  },
  GOAL_5: {
    key: "GOAL_5",
    badge: "GOAL 5",
    title: "Long-Term Growth & Increased Involvement",
    outcome: "Grow toward Senior Instructor and Lead Instructor.",
    order: 5,
  },
  CAPSTONE: {
    key: "CAPSTONE",
    badge: "",
    title: "Readiness Check",
    outcome: "Prove you're ready to teach your first YPP class.",
    order: 6,
  },
};

/** Roadmap label for a module's goalKey, e.g. "GOAL 2". Empty when not a
 *  numbered goal (Welcome, Capstone) or when the module predates the
 *  framework. */
export function goalBadge(goalKey: string | null | undefined): string {
  if (!goalKey) return "";
  return GOAL_META[goalKey as GoalKey]?.badge ?? "";
}

/** Ordered list of the framework sections for roadmap rendering. */
export function listGoalMeta(): GoalMeta[] {
  return GOAL_KEYS.map((k) => GOAL_META[k]).sort((a, b) => a.order - b.order);
}
