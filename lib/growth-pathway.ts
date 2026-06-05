/**
 * Growth Pathway — unified configuration powering the redesigned
 * Leadership Pathway dashboard. It models BOTH YPP growth tracks in one
 * normalized shape so a single dashboard component can render either:
 *
 *   1. Instructor Pathway  — Instructor → Senior Instructor → Lead Instructor
 *   2. Leadership Pathway   — Manager → Director → Chapter President → Officer
 *
 * The instructor competency copy is reused verbatim from the existing
 * G&R source of truth in `leadership-pathway.ts` so the two never drift.
 * The leadership competency copy is transcribed verbatim from the official
 * Leadership Goals & Rubric.
 */

import {
  LEADERSHIP_GOALS,
  LeadershipGoal,
} from "@/lib/leadership-pathway";

/* ------------------------------------------------------------------ *
 * Status levels (shared across both tracks)
 * ------------------------------------------------------------------ */

export type StatusLevelId =
  | "ABOVE_AND_BEYOND"
  | "ON_TRACK"
  | "NEEDS_ATTENTION"
  | "AT_RISK";

export interface StatusLevel {
  id: StatusLevelId;
  label: string;
  description: string;
  /** A token used to drive the pill / accent color in the UI. */
  tone: "above" | "ontrack" | "attention" | "risk";
  /** 0–1 fill used by the competency progress meter. */
  fill: number;
}

export const STATUS_LEVELS: Record<StatusLevelId, StatusLevel> = {
  ABOVE_AND_BEYOND: {
    id: "ABOVE_AND_BEYOND",
    label: "Above & Beyond",
    description: "Dramatically exceeds all bullets at this level.",
    tone: "above",
    fill: 1,
  },
  ON_TRACK: {
    id: "ON_TRACK",
    label: "On Track",
    description: "All bullets met.",
    tone: "ontrack",
    fill: 0.82,
  },
  NEEDS_ATTENTION: {
    id: "NEEDS_ATTENTION",
    label: "Needs Attention",
    description: "Some bullets met; no major deficiencies.",
    tone: "attention",
    fill: 0.5,
  },
  AT_RISK: {
    id: "AT_RISK",
    label: "At Risk",
    description: "Major deficiencies present.",
    tone: "risk",
    fill: 0.22,
  },
};

export const STATUS_LEVEL_ORDER: StatusLevelId[] = [
  "ABOVE_AND_BEYOND",
  "ON_TRACK",
  "NEEDS_ATTENTION",
  "AT_RISK",
];

/* ------------------------------------------------------------------ *
 * Normalized track shape
 * ------------------------------------------------------------------ */

export type TrackId = "INSTRUCTOR" | "LEADERSHIP";

export interface PathwayRole {
  id: string;
  /** Short, prestigious label used on badges and the ladder. */
  label: string;
  /** Optional grouping subtitle (e.g. "Director / Senior Director / Executive Director"). */
  subtitle?: string;
  /** One-line role framing used on the role cards. */
  tagline: string;
  /** Mission framing used in the current-role card. */
  mission: string;
  /** Promotion framing toward the next rung (null for the top rung). */
  promotionWindow: string | null;
  /** Ordering in the ladder, starting at 0. */
  order: number;
  /** Which competency expectation band this role reads from. */
  bandKey: string;
  /**
   * Set on roles that sit *beside* the main ladder rather than on it
   * (e.g. Chapter President / Regional Director runs parallel to Director).
   * Value is the `order` of the ladder rung it runs alongside.
   */
  parallelToOrder?: number;
}

export interface PathwayCompetency {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  oneLiner: string;
  /** Per-band expectation bullets, mirroring the official rubric. */
  expectations: Record<string, string[]>;
}

export interface TrackConfig {
  id: TrackId;
  label: string;
  tagline: string;
  /** Short word used in toggles / chips ("Teaching", "Leadership"). */
  chip: string;
  /** The main, sequential ladder rungs. */
  roles: PathwayRole[];
  /** Roles that run alongside the ladder rather than on it. */
  parallelRoles: PathwayRole[];
  competencies: PathwayCompetency[];
}

/* ------------------------------------------------------------------ *
 * Instructor track — reuses the existing G&R instructor content
 * ------------------------------------------------------------------ */

const INSTRUCTOR_ROLES: PathwayRole[] = [
  {
    id: "INSTRUCTOR",
    label: "Instructor",
    tagline: "Developing teaching consistency and classroom leadership.",
    mission:
      "Deliver strong classroom experiences, build positive student relationships, and contribute reliably to the YPP community.",
    promotionWindow:
      "Promotion to Senior Instructor typically happens after 2–4 strong months as an Instructor.",
    order: 0,
    bandKey: "INSTRUCTOR",
  },
  {
    id: "SENIOR_INSTRUCTOR",
    label: "Senior Instructor",
    tagline: "Helping shape instructor culture and mentoring others.",
    mission:
      "Demonstrate exceptional teaching and mentorship, contribute beyond the classroom, and help support and develop other instructors.",
    promotionWindow:
      "Promotion to Lead Instructor typically happens after 2–4 strong months as a Senior Instructor.",
    order: 1,
    bandKey: "SENIOR_INSTRUCTOR",
  },
  {
    id: "LEAD_INSTRUCTOR",
    label: "Lead Instructor",
    tagline: "Driving organization-wide instructional excellence.",
    mission:
      "Provide organization-wide leadership through training, curriculum development, mentorship, program quality oversight, and community-building.",
    promotionWindow:
      "Lead Instructors who shape culture and outcomes are invited toward the leadership pathway.",
    order: 2,
    bandKey: "LEAD_INSTRUCTOR",
  },
];

const INSTRUCTOR_COMPETENCIES: PathwayCompetency[] = LEADERSHIP_GOALS.map(
  (goal: LeadershipGoal): PathwayCompetency => ({
    id: goal.id,
    number: goal.number,
    title: goal.title,
    shortTitle: goal.shortTitle,
    oneLiner: goal.oneLiner,
    expectations: {
      INSTRUCTOR: goal.expectations.INSTRUCTOR,
      SENIOR_INSTRUCTOR: goal.expectations.SENIOR_INSTRUCTOR,
      LEAD_INSTRUCTOR: goal.expectations.LEAD_INSTRUCTOR,
    },
  })
);

/* ------------------------------------------------------------------ *
 * Leadership track — transcribed verbatim from the Leadership G&R
 * ------------------------------------------------------------------ */

const LEADERSHIP_ROLES: PathwayRole[] = [
  {
    id: "MANAGER",
    label: "Manager",
    subtitle: "Manager / Senior Manager",
    tagline: "Owning your area and delivering reliable, high-quality work.",
    mission:
      "Deliver high-quality work consistently, take ownership of your area, and proactively improve the systems and people around you.",
    promotionWindow:
      "Strong Managers who own outcomes across a program advance toward Director.",
    order: 0,
    bandKey: "MANAGER",
  },
  {
    id: "DIRECTOR",
    label: "Director",
    subtitle: "Director / Senior Director / Executive Director",
    tagline: "Owning outcomes and sustained impact across a function.",
    mission:
      "Own outcomes across an entire program or functional area, develop the staff around you, and lift the performance of every team you touch.",
    promotionWindow:
      "Directors who steward people and build lasting systems grow toward officer-level leadership.",
    order: 1,
    bandKey: "DIRECTOR",
  },
  {
    id: "OFFICER",
    label: "Officer",
    subtitle: "Officer",
    tagline: "Setting organization-wide direction and sustainability.",
    mission:
      "Define and drive organization-wide priorities, build structures that outlast any role, and steward the long-term direction of YPP.",
    promotionWindow: null,
    order: 2,
    bandKey: "OFFICER",
  },
];

const LEADERSHIP_PARALLEL_ROLES: PathwayRole[] = [
  {
    id: "CHAPTER_PRESIDENT",
    label: "Chapter President",
    subtitle: "Chapter President / Regional Director / Senior Regional Director",
    tagline: "Leading a chapter or region and the people within it.",
    mission:
      "Lead a chapter or region end to end — driving outcomes, developing leaders, and cultivating the relationships that sustain YPP locally.",
    promotionWindow:
      "Regional leaders who shape strategy beyond their territory step into officer-level stewardship.",
    order: 1,
    bandKey: "DIRECTOR",
    parallelToOrder: 1,
  },
];

const LEADERSHIP_COMPETENCIES: PathwayCompetency[] = [
  {
    id: "IMPACT_AND_RESULTS",
    number: 1,
    title: "Impact & Results",
    shortTitle: "Impact",
    oneLiner:
      "Producing clear, measurable results that move the whole program forward.",
    expectations: {
      MANAGER: [
        "Delivers high-quality work consistently and reliably; work shows clear, demonstrable impact every week.",
        "Achieves goals, solves problems, and produces measurable results within area of responsibility.",
        "Impact extends beyond the specific task to benefit the broader team or program.",
      ],
      DIRECTOR: [
        "Owns outcomes and delivers sustained impact across the entire program, team, or functional area — beyond individual project level.",
        "Identifies obstacles and breaks down complex problems into actionable strategies.",
        "Achieves ambitious goals and lifts the performance of those around them.",
      ],
      OFFICER: [
        "Defines and drives organization-wide priorities that produce transformational results every week.",
        "Ambitious and resourceful — does not let obstacles stand in the way of achieving goals; creates repeatable resources and systems enabling long-term, sustained impact.",
        "Impact extends beyond any specific project to shape the organization's trajectory.",
      ],
    },
  },
  {
    id: "IDEAS_AND_INITIATIVE",
    number: 2,
    title: "Ideas & Initiative",
    shortTitle: "Initiative",
    oneLiner:
      "Bringing forward ideas and taking ownership without being asked.",
    expectations: {
      MANAGER: [
        "Does not simply complete assigned work; proactively proposes new systems, programs, and improvements without being asked.",
        "Takes ownership of challenges and opportunities within their area of responsibility.",
        "Brings forward ideas that improve efficiency, quality, or mission alignment.",
      ],
      DIRECTOR: [
        "Identifies gaps and opportunities at the program or team level and develops concrete initiatives to address them.",
        "Drives cross-functional improvements; champions ideas that elevate the work of multiple teams.",
        "Creates space for others' ideas while ensuring the strongest proposals move forward.",
      ],
      OFFICER: [
        "Has a strategic vision; generates new high-impact ideas that drive progress across the organization.",
        "Translates broad challenges into actionable priorities; takes initiative to implement ideas beyond a particular role.",
        "Removes systemic barriers to good ideas and builds structures that make initiative the norm.",
      ],
    },
  },
  {
    id: "TIMELINESS_RELIABILITY_COMMUNICATION",
    number: 3,
    title: "Timeliness, Reliability & Communication",
    shortTitle: "Reliability",
    oneLiner:
      "Following through on time and communicating proactively at every level.",
    expectations: {
      MANAGER: [
        "Consistently produces on-time output and follows through with minimal oversight or reminders.",
        "Responds promptly to messages (never more than 24 hours) and attends 100% of meetings.",
        "Communicates proactively when timelines or expectations shift.",
      ],
      DIRECTOR: [
        "Ensures both personal work and team deliverables are completed reliably and on time; moves progress forward without day-long delays.",
        "Establishes systems, expectations, and accountability mechanisms that improve team performance.",
        "Communicates proactively with stakeholders and team members; responds within 24 hours and attends 100% of meetings.",
      ],
      OFFICER: [
        "Creates a culture of accountability, reliability, and responsiveness across the organization; moves progress forward the same day rather than delaying.",
        "Designs scalable processes and structures that enable consistent, high-quality execution.",
        "Ensures strong communication and alignment across teams and organizational levels; responds within 24 hours and attends 100% of meetings.",
      ],
    },
  },
  {
    id: "LEADERSHIP_COMMUNITY_COLLABORATION",
    number: 4,
    title: "Leadership, Community & Collaboration",
    shortTitle: "Leadership",
    oneLiner:
      "Developing people, modeling YPP values, and strengthening the community.",
    expectations: {
      MANAGER: [
        "Leads major community-building initiatives, mentorship efforts, or instructor engagement.",
        "Helps shape YPP culture, morale, and organizational community standards.",
        "Motivates and manages team members to fulfill their responsibilities with care and excellence.",
      ],
      DIRECTOR: [
        "Develops and manages staff to reach their potential; actively mentors junior team members and creates opportunities for them to take on greater responsibility.",
        "Fosters collaboration across departments, models YPP values, and holds the team to high standards of conduct.",
      ],
      OFFICER: [
        "Leads others to successful output; successfully manages, develops, and mentors others, creating opportunities for them to take on greater responsibility.",
        "Contributes positively to the YPP community, boosting collaboration and morale; collaborates effectively across the entire organization.",
      ],
    },
  },
  {
    id: "CONTINUITY_LONG_TERM_POTENTIAL",
    number: 5,
    title: "Continuity and Long-Term Potential",
    shortTitle: "Continuity",
    oneLiner:
      "Building what outlasts your role and caring about YPP's long-term success.",
    expectations: {
      MANAGER: [
        "Leads major organizational initiatives with high impact beyond their specific role.",
        "Eager to take on more responsibility; genuinely cares about the organization's long-term success.",
        "Has a vision for YPP and the practical leadership, judgment, and discipline to carry it out.",
      ],
      DIRECTOR: [
        "Demonstrates readiness for broader responsibility; proactively develops the skills needed for the next level of leadership.",
        "Mentors and sponsors high-potential junior staff and builds systems that will outlast their current role.",
        "Cultivates long-term relationships with key external stakeholders — community leaders, parent networks, and partner organizations — that serve YPP's mission well beyond any single program cycle.",
      ],
      OFFICER: [
        "Actively shapes the long-term strategic direction and sustainability of the organization; builds sustainable structures and plans for organizational continuity.",
        "Develops and stewards a broad ecosystem of long-term relationships — communities, parents, funders, and partners — that YPP can reliably activate for programs, support, and growth.",
      ],
    },
  },
];

/* ------------------------------------------------------------------ *
 * Track registry + helpers
 * ------------------------------------------------------------------ */

export const TRACKS: Record<TrackId, TrackConfig> = {
  INSTRUCTOR: {
    id: "INSTRUCTOR",
    label: "Instructor Pathway",
    tagline:
      "How instructors grow at YPP — from the classroom to organization-wide teaching leadership.",
    chip: "Teaching",
    roles: INSTRUCTOR_ROLES,
    parallelRoles: [],
    competencies: INSTRUCTOR_COMPETENCIES,
  },
  LEADERSHIP: {
    id: "LEADERSHIP",
    label: "Leadership Pathway",
    tagline:
      "How leaders grow at YPP — from owning your area to stewarding the whole organization.",
    chip: "Leadership",
    roles: LEADERSHIP_ROLES,
    parallelRoles: LEADERSHIP_PARALLEL_ROLES,
    competencies: LEADERSHIP_COMPETENCIES,
  },
};

export const TRACK_ORDER: TrackId[] = ["INSTRUCTOR", "LEADERSHIP"];

export function getRole(track: TrackConfig, roleId: string): PathwayRole | null {
  return (
    track.roles.find((r) => r.id === roleId) ??
    track.parallelRoles.find((r) => r.id === roleId) ??
    null
  );
}

export function isParallelRole(role: PathwayRole): boolean {
  return role.parallelToOrder !== undefined;
}

export function getNextRole(
  track: TrackConfig,
  roleId: string
): PathwayRole | null {
  const role = getRole(track, roleId);
  if (!role) return null;
  // Parallel roles promote to the rung above the one they sit beside.
  const fromOrder = role.parallelToOrder ?? role.order;
  return track.roles.find((r) => r.order === fromOrder + 1) ?? null;
}

/** Expectations for a single competency at a given role's band. */
export function expectationsFor(
  competency: PathwayCompetency,
  role: PathwayRole
): string[] {
  return competency.expectations[role.bandKey] ?? [];
}

/**
 * Resolve the user's default track + current role from their inferred
 * leadership stage and primary role. The dashboard lets the user explore
 * either track freely, but this picks the most relevant starting point.
 */
export function resolveStartingPosition(input: {
  stageId: string | null;
  primaryRole: string | null;
}): { trackId: TrackId; roleId: string } {
  const { stageId, primaryRole } = input;

  // Explicit org-leadership signals → Leadership track.
  if (primaryRole === "CHAPTER_PRESIDENT") {
    return { trackId: "LEADERSHIP", roleId: "CHAPTER_PRESIDENT" };
  }
  if (stageId === "ORGANIZATIONAL_LEADERSHIP" || primaryRole === "ADMIN") {
    return { trackId: "LEADERSHIP", roleId: "OFFICER" };
  }
  if (primaryRole === "STAFF") {
    return { trackId: "LEADERSHIP", roleId: "MANAGER" };
  }

  // Otherwise map the instructor stage onto the instructor ladder.
  if (stageId === "SENIOR_INSTRUCTOR") {
    return { trackId: "INSTRUCTOR", roleId: "SENIOR_INSTRUCTOR" };
  }
  if (stageId === "LEAD_INSTRUCTOR") {
    return { trackId: "INSTRUCTOR", roleId: "LEAD_INSTRUCTOR" };
  }
  // INSTRUCTOR, WORKSHOP_INSTRUCTOR, or unknown → Instructor rung.
  return { trackId: "INSTRUCTOR", roleId: "INSTRUCTOR" };
}
