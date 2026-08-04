/**
 * Leadership Goals & Rubric — single source of truth.
 *
 * Used by the Growth Pathway (mentorship G&R tab / progress updates) and the
 * Global Leadership review template seed so the four-column sheet and the
 * live docs cannot drift.
 *
 * Columns:
 *   Manager / Senior Manager
 *   Director / Senior Director / Executive Director
 *   Chapter President / Regional Director / Senior Regional Director
 *   Officer
 *
 * Rating scale:
 *   Above & Beyond — Dramatically exceeds all bullets at this level
 *   On Track — All bullets met
 *   Needs Attention — Some bullets met; no major deficiencies
 *   At Risk — Major deficiencies present
 */

export const LEADERSHIP_RUBRIC_TITLE = "Leadership Goals & Rubric";

export const LEADERSHIP_RATING_SCALE = [
  {
    id: "ABOVE_AND_BEYOND" as const,
    label: "Above & Beyond",
    description: "Dramatically exceeds all bullets at this level",
  },
  {
    id: "ON_TRACK" as const,
    label: "On Track",
    description: "All bullets met",
  },
  {
    id: "NEEDS_ATTENTION" as const,
    label: "Needs Attention",
    description: "Some bullets met; no major deficiencies",
  },
  {
    id: "AT_RISK" as const,
    label: "At Risk",
    description: "Major deficiencies present",
  },
] as const;

export const LEADERSHIP_RUBRIC_COLUMNS = [
  "Manager / Senior Manager",
  "Director / Senior Director / Executive Director",
  "Chapter President / Regional Director / Senior Regional Director",
  "Officer",
] as const;

export type LeadershipRubricColumn = (typeof LEADERSHIP_RUBRIC_COLUMNS)[number];

/** Band keys used by Growth Pathway roles. */
export type LeadershipBandKey =
  | "MANAGER"
  | "DIRECTOR"
  | "CHAPTER_PRESIDENT"
  | "OFFICER";

export const LEADERSHIP_BAND_TO_COLUMN: Record<
  LeadershipBandKey,
  LeadershipRubricColumn
> = {
  MANAGER: "Manager / Senior Manager",
  DIRECTOR: "Director / Senior Director / Executive Director",
  CHAPTER_PRESIDENT:
    "Chapter President / Regional Director / Senior Regional Director",
  OFFICER: "Officer",
};

export type LeadershipRubricCompetency = {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  oneLiner: string;
  expectations: Record<LeadershipBandKey, string[]>;
};

/** Officer-level bars; CP column uses the same expectations on the official sheet. */
const OFFICER_LEVEL = {
  IMPACT: [
    "Defines and drives organization-wide priorities that produce transformational results every week.",
    "Ambitious and resourceful — does not let obstacles stand in the way of achieving goals.",
    "Creates repeatable resources and systems enabling long-term, sustained impact.",
    "Impact extends beyond any specific project to shape the organization's trajectory.",
  ],
  IDEAS: [
    "Has a strategic vision; generates new high-impact ideas that drive progress across the organization.",
    "Translates broad challenges into actionable priorities; takes initiative to implement ideas beyond particular role.",
    "Removes systemic barriers to good ideas and builds structures that make initiative the norm.",
  ],
  TIMELINESS: [
    "Creates a culture of accountability, reliability, and responsiveness across the organization; moves progress forward on the same day as receiving input rather than delaying.",
    "Designs scalable processes and structures that enable consistent, high-quality execution.",
    "Ensures strong communication and alignment across teams and organizational levels; responds within 24 hours and attends 100% of meetings.",
  ],
  LEADERSHIP: [
    "Leads others to successful output; successfully manages, develops, and mentors others, creating opportunities for them to take on greater responsibility.",
    "Contributes positively to the YPP community, boosting collaboration and morale. Collaborates effectively across the entire organization.",
  ],
  CONTINUITY: [
    "Actively shapes the long-term strategic direction and sustainability of the organization; eager to take on more responsibility and genuinely cares about success.",
    "Builds sustainable structures and plans for organizational continuity.",
    "Develops and stewards a broad ecosystem of long-term relationships — with communities, parents, funders, and partners — that YPP can reliably activate for programs, support, and growth.",
  ],
} as const;

export const LEADERSHIP_RUBRIC_COMPETENCIES: LeadershipRubricCompetency[] = [
  {
    id: "IMPACT_AND_RESULTS",
    number: 1,
    title: "Impact & Results",
    shortTitle: "Impact & Results",
    oneLiner: "Delivers high-quality work consistently and reliably.",
    expectations: {
      MANAGER: [
        "Delivers high-quality work consistently and reliably.",
        "Work shows clear, demonstrable impact every week.",
        "Achieves goals, solves problems, and produces measurable results within area of responsibility.",
        "Impact extends beyond the specific task to benefit the broader team or program.",
      ],
      DIRECTOR: [
        "Owns outcomes and delivers sustained impact across the entire program, team, or functional area.",
        "Work shows significant progress and impact every week, beyond individual project level.",
        "Identifies obstacles, breaks down complex problems into actionable strategies.",
        "Achieves ambitious goals and lifts the performance of those around them.",
      ],
      CHAPTER_PRESIDENT: [...OFFICER_LEVEL.IMPACT],
      OFFICER: [...OFFICER_LEVEL.IMPACT],
    },
  },
  {
    id: "IDEAS_AND_INITIATIVE",
    number: 2,
    title: "Ideas & Initiative",
    shortTitle: "Ideas & Initiative",
    oneLiner:
      "Proactively proposes new systems, programs, and improvements without being asked.",
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
      CHAPTER_PRESIDENT: [...OFFICER_LEVEL.IDEAS],
      OFFICER: [...OFFICER_LEVEL.IDEAS],
    },
  },
  {
    id: "TIMELINESS_RELIABILITY_COMMUNICATION",
    number: 3,
    title: "Timeliness, Reliability & Communication",
    shortTitle: "Timeliness, Reliability & Comm.",
    oneLiner:
      "On-time output, responsiveness within 24 hours, and proactive communication.",
    expectations: {
      MANAGER: [
        "Consistently produces on-time output and follows through with minimal oversight or reminders.",
        "Responds promptly to messages (never more than 24 hours) and attends 100% of meetings.",
        "Communicates proactively when timelines or expectations shift.",
      ],
      DIRECTOR: [
        "Ensures both personal work and team deliverables are completed reliably and on time; moves progress forward without day-long delays.",
        "Establishes systems, expectations, and accountability mechanisms that improve team performance.",
        "Communicates proactively and effectively with stakeholders and team members; responds within 24 hours and attends 100% of meetings.",
      ],
      CHAPTER_PRESIDENT: [...OFFICER_LEVEL.TIMELINESS],
      OFFICER: [...OFFICER_LEVEL.TIMELINESS],
    },
  },
  {
    id: "LEADERSHIP_COMMUNITY_COLLABORATION",
    number: 4,
    title: "Leadership, Community & Collaboration",
    shortTitle: "Leadership, Community & Collab.",
    oneLiner:
      "Leading community-building, mentoring others, and modeling YPP values.",
    expectations: {
      MANAGER: [
        "Leads major community-building initiatives, mentorship efforts, or instructor engagement.",
        "Helps shape YPP culture, morale, and organizational community standards.",
        "Motivates and manages team members to fulfill their responsibilities with care and excellence.",
      ],
      DIRECTOR: [
        "Develops and manages staff to reach their potential; actively mentors junior team members, helps them improve, and creates opportunities for them to take on greater responsibility.",
        "Fosters collaboration across departments, models YPP values, and holds the team to high standards of conduct.",
      ],
      CHAPTER_PRESIDENT: [...OFFICER_LEVEL.LEADERSHIP],
      OFFICER: [...OFFICER_LEVEL.LEADERSHIP],
    },
  },
  {
    id: "CONTINUITY_LONG_TERM_POTENTIAL",
    number: 5,
    title: "Continuity and Long-Term Potential",
    shortTitle: "Continuity and Long-Term Potential",
    oneLiner:
      "Building sustainable structures, relationships, and readiness for broader responsibility.",
    expectations: {
      MANAGER: [
        "Leads major organizational initiatives with high impact beyond their specific role.",
        "Eager to take on more responsibility; genuinely cares about the organization's long-term success.",
        "Has a vision for YPP and the practical leadership, judgment, and discipline to carry it out.",
      ],
      DIRECTOR: [
        "Demonstrates readiness for broader responsibility; proactively develops the skills needed for the next level of leadership.",
        "Mentors and sponsors high-potential junior staff and builds systems that will outlast their current role.",
        "Cultivates long-term relationships with key external stakeholders — community leaders, parent networks, and partner organizations — that will serve YPP's mission well beyond any single program cycle.",
      ],
      CHAPTER_PRESIDENT: [...OFFICER_LEVEL.CONTINUITY],
      OFFICER: [...OFFICER_LEVEL.CONTINUITY],
    },
  },
];

export const LEADERSHIP_RUBRIC_ROLE_MISSION =
  "Global Leadership drives YPP's programs, culture, and long-term growth across the organization — delivering measurable impact, proposing and driving new ideas, operating with reliability and clear communication, developing and elevating the people around them, and building the systems and relationships that sustain YPP well beyond any single program cycle.";

/** Format bullets for GRTemplateGoal.levelGuidance (newline + •). */
export function formatLeadershipLevelGuidance(
  bullets: string[],
): string {
  return bullets.map((b) => `• ${b}`).join("\n");
}

/** Shape used by `scripts/seed-review-templates.ts`. */
export function leadershipCompetenciesForTemplateSeed(): Array<{
  title: string;
  description: string;
  levelGuidance: Record<string, string>;
}> {
  return LEADERSHIP_RUBRIC_COMPETENCIES.map((c) => ({
    title: c.title,
    description: c.oneLiner,
    levelGuidance: {
      [LEADERSHIP_BAND_TO_COLUMN.MANAGER]: formatLeadershipLevelGuidance(
        c.expectations.MANAGER,
      ),
      [LEADERSHIP_BAND_TO_COLUMN.DIRECTOR]: formatLeadershipLevelGuidance(
        c.expectations.DIRECTOR,
      ),
      [LEADERSHIP_BAND_TO_COLUMN.CHAPTER_PRESIDENT]:
        formatLeadershipLevelGuidance(c.expectations.CHAPTER_PRESIDENT),
      [LEADERSHIP_BAND_TO_COLUMN.OFFICER]: formatLeadershipLevelGuidance(
        c.expectations.OFFICER,
      ),
    },
  }));
}
