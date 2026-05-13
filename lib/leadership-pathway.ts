/**
 * Leadership Pathway — single source of truth for the YPP instructor
 * progression. Used by the role-identity card, leadership-pathway page,
 * G&R expectations matrix, mentor card, profile, and admin tooling.
 *
 * All copy lives here so the experience stays consistent across surfaces.
 * No DB enum change is required: stages are inferred from existing signals
 * (instructor subtype, mentorship roles, growth tier) and surfaced as a
 * cohesive narrative.
 */

export type LeadershipStageId =
  | "WORKSHOP_INSTRUCTOR"
  | "INSTRUCTOR"
  | "SENIOR_INSTRUCTOR"
  | "LEAD_INSTRUCTOR"
  | "ORGANIZATIONAL_LEADERSHIP";

export type LeadershipGoalId =
  | "CURRICULUM_AND_CLASS_DELIVERY"
  | "STUDENT_AND_FAMILY_RELATIONSHIPS"
  | "ORGANIZATION_COMMITMENT_RELIABILITY"
  | "YPP_COMMUNITY_INVOLVEMENT"
  | "LONG_TERM_GROWTH";

export interface LeadershipGoal {
  id: LeadershipGoalId;
  number: number;
  title: string;
  shortTitle: string;
  oneLiner: string;
  /** Per-stage expectations, mirroring the official G&R rubric. */
  expectations: Record<
    Exclude<
      LeadershipStageId,
      "WORKSHOP_INSTRUCTOR" | "ORGANIZATIONAL_LEADERSHIP"
    >,
    string[]
  >;
}

export interface LeadershipStage {
  id: LeadershipStageId;
  /** Short, prestigious label used everywhere. */
  label: string;
  /** Used in headlines and signature lines. */
  tagline: string;
  /** One-sentence mission framing used on cards. */
  mission: string;
  /** Promotion expectation framing for the stage above (if applicable). */
  promotionWindow: string | null;
  /** Who mentors this stage. */
  mentoredBy: string;
  /** What this stage focuses on, in their own words. */
  focusAreas: string[];
  /** Color tokens used for badges/cards. */
  color: {
    bg: string;
    border: string;
    text: string;
    accent: string;
  };
  /** Ordering in the progression (Workshop = 0, Org Leadership = 4). */
  order: number;
}

export const LEADERSHIP_STAGES: Record<LeadershipStageId, LeadershipStage> = {
  WORKSHOP_INSTRUCTOR: {
    id: "WORKSHOP_INSTRUCTOR",
    label: "Workshop Instructor",
    tagline: "Entering the YPP instructor ecosystem",
    mission:
      "Lead short-form workshop experiences that introduce you to YPP teaching, families, and culture — with a clear path into the full instructor program.",
    promotionWindow:
      "Exceptional workshop instructors are invited to transition into the full Instructor role.",
    mentoredBy:
      "Workshop leads and mentor instructors who help you get oriented and supported.",
    focusAreas: [
      "Deliver an engaging workshop experience",
      "Build positive student and family rapport",
      "Get to know the YPP instructor team and culture",
      "Identify whether the full instructor program is the right next step",
    ],
    color: {
      bg: "#f5f3ff",
      border: "#c4b5fd",
      text: "#5b21b6",
      accent: "#7c3aed",
    },
    order: 0,
  },
  INSTRUCTOR: {
    id: "INSTRUCTOR",
    label: "Instructor",
    tagline: "Developing teaching consistency and classroom leadership",
    mission:
      "Deliver strong classroom experiences, build positive student relationships, and contribute reliably to the YPP community.",
    promotionWindow:
      "Promotion to Senior Instructor typically happens after 2–4 months as an Instructor, based on consistency and growth.",
    mentoredBy: "Senior Instructors, Lead Instructors, or Chapter Presidents.",
    focusAreas: [
      "Run engaging, organized classes with strong attendance and participation",
      "Build supportive relationships with students and families",
      "Stay responsive, reliable, and prepared",
      "Show up for trainings, events, and the broader YPP community",
      "Stay open to feedback and look for ways to grow",
    ],
    color: {
      bg: "#eff6ff",
      border: "#93c5fd",
      text: "#1d4ed8",
      accent: "#2563eb",
    },
    order: 1,
  },
  SENIOR_INSTRUCTOR: {
    id: "SENIOR_INSTRUCTOR",
    label: "Senior Instructor",
    tagline: "Helping shape instructor culture and mentoring others",
    mission:
      "Demonstrate exceptional teaching and mentorship, contribute beyond the classroom, and help support and develop other instructors.",
    promotionWindow:
      "Promotion to Lead Instructor typically happens after 2–4 months as a Senior Instructor, based on leadership impact.",
    mentoredBy: "Lead Instructors or Chapter Presidents.",
    focusAreas: [
      "Maintain among the strongest student and family feedback",
      "Coach and mentor other instructors",
      "Create reusable curriculum, templates, or enrichment content",
      "Organize or meaningfully contribute to events and initiatives",
      "Take on expanded responsibilities — interviewing, onboarding, special programming",
    ],
    color: {
      bg: "#ecfeff",
      border: "#67e8f9",
      text: "#0e7490",
      accent: "#0891b2",
    },
    order: 2,
  },
  LEAD_INSTRUCTOR: {
    id: "LEAD_INSTRUCTOR",
    label: "Lead Instructor",
    tagline: "Driving organization-wide excellence and leadership",
    mission:
      "Provide organization-wide leadership through training, curriculum development, mentorship, program quality oversight, and community-building initiatives.",
    promotionWindow:
      "Lead Instructors who consistently shape culture and outcomes are invited into the global leadership team.",
    mentoredBy: "The global leadership team.",
    focusAreas: [
      "Help oversee and elevate instructional quality across programs",
      "Lead curriculum improvement, instructor training, and teaching workshops",
      "Develop scalable teaching standards and best practices",
      "Help oversee logistics, scheduling, and instructor coordination",
      "Lead major organizational initiatives — recruiting, mentorship, curriculum strategy",
    ],
    color: {
      bg: "#fef3c7",
      border: "#fcd34d",
      text: "#92400e",
      accent: "#d97706",
    },
    order: 3,
  },
  ORGANIZATIONAL_LEADERSHIP: {
    id: "ORGANIZATIONAL_LEADERSHIP",
    label: "Organizational Leadership",
    tagline: "Shaping YPP at the global scale",
    mission:
      "Set the direction for YPP — programs, culture, growth, and the next generation of instructor leaders.",
    promotionWindow: null,
    mentoredBy: "Peers across the global leadership team.",
    focusAreas: [
      "Set program strategy and instructor-development direction",
      "Steward YPP's mission, values, and culture",
      "Develop the next generation of Lead Instructors",
    ],
    color: {
      bg: "#fdf2f8",
      border: "#f9a8d4",
      text: "#9d174d",
      accent: "#db2777",
    },
    order: 4,
  },
};

export const LEADERSHIP_STAGE_ORDER: LeadershipStageId[] = [
  "WORKSHOP_INSTRUCTOR",
  "INSTRUCTOR",
  "SENIOR_INSTRUCTOR",
  "LEAD_INSTRUCTOR",
  "ORGANIZATIONAL_LEADERSHIP",
];

/**
 * Five G&R goal categories. Each carries per-stage expectations drawn
 * verbatim from the official YPP G&R rubric so the portal and the rubric
 * never drift.
 */
export const LEADERSHIP_GOALS: LeadershipGoal[] = [
  {
    id: "CURRICULUM_AND_CLASS_DELIVERY",
    number: 1,
    title: "Curriculum & Class Delivery",
    shortTitle: "Teaching",
    oneLiner:
      "Designing and leading classes that captivate students and produce real learning.",
    expectations: {
      INSTRUCTOR: [
        "Delivers organized, engaging classes using an approved curriculum that captivate students and maintain strong attendance and participation",
        "Receives positive parent and student feedback regarding class quality and engagement",
        "Comes prepared and adapts instruction based on student needs and classroom dynamics",
      ],
      SENIOR_INSTRUCTOR: [
        "Maintains among the strongest student and parent feedback metrics within YPP",
        "Creates reusable curriculum resources, lesson templates, or enrichment programming",
        "Coaches or mentors instructors on teaching, engagement, and classroom delivery",
      ],
      LEAD_INSTRUCTOR: [
        "Oversees and helps elevate instructional quality across programs",
        "Leads curriculum improvement, instructor training, and teaching workshops",
        "Develops scalable teaching standards, systems, and best practices across YPP",
      ],
    },
  },
  {
    id: "STUDENT_AND_FAMILY_RELATIONSHIPS",
    number: 2,
    title: "Student & Family Relationships",
    shortTitle: "Families",
    oneLiner:
      "Building trust with students and families that turns a class into a community.",
    expectations: {
      INSTRUCTOR: [
        "Builds strong, supportive relationships with students and families through professional and responsive communication",
        "Advises and encourages students toward continued involvement in YPP opportunities and programs",
        "Creates an inclusive and welcoming classroom environment where students feel supported and engaged",
      ],
      SENIOR_INSTRUCTOR: [
        "Builds lasting trust and rapport with students and families across programs",
        "Serves as a mentor or trusted point of contact for students and families navigating YPP opportunities",
        "Helps strengthen long-term student engagement and family retention within YPP",
      ],
      LEAD_INSTRUCTOR: [
        "Develops relationships with schools, families, and community partners that strengthen YPP's reach and reputation",
        "Helps guide instructors through difficult student or family situations and communication challenges",
        "Contributes to systems and strategies that improve family and partner engagement, communication, and retention",
      ],
    },
  },
  {
    id: "ORGANIZATION_COMMITMENT_RELIABILITY",
    number: 3,
    title: "Organization, Commitment & Reliability",
    shortTitle: "Reliability",
    oneLiner:
      "Showing up prepared, professional, and on time — every single week.",
    expectations: {
      INSTRUCTOR: [
        "Responds promptly and professionally to communication from staff, students, and families",
        "Arrives consistently prepared, on time, and ready for classes, meetings, and events",
        "Completes responsibilities and administrative tasks reliably and on schedule",
      ],
      SENIOR_INSTRUCTOR: [
        "Demonstrates exceptional reliability, responsiveness, and professionalism across responsibilities",
        "Handles scheduling, operational issues, or classroom challenges proactively",
        "Helps improve communication, coordination, and operational efficiency within programs",
      ],
      LEAD_INSTRUCTOR: [
        "Models professionalism, accountability, and responsiveness for the broader instructor team",
        "Helps oversee logistics, scheduling, and instructor coordination and staffing across programs",
        "Develops or improves systems that strengthen organizational efficiency and execution",
      ],
    },
  },
  {
    id: "YPP_COMMUNITY_INVOLVEMENT",
    number: 4,
    title: "YPP Community Involvement",
    shortTitle: "Community",
    oneLiner:
      "Helping shape the culture that makes being part of YPP feel like home.",
    expectations: {
      INSTRUCTOR: [
        "Actively contributes to a positive, collaborative, and supportive YPP culture",
        "Builds meaningful relationships with instructors, mentors, and staff beyond minimum expectations",
        "Participates enthusiastically in events, trainings, and broader community activities",
      ],
      SENIOR_INSTRUCTOR: [
        "Helps strengthen instructor culture through mentorship, collaboration, and community-building",
        "Organizes or contributes meaningfully to events, workshops, showcases, or special initiatives",
        "Serves as a positive role model and active contributor within the YPP community",
      ],
      LEAD_INSTRUCTOR: [
        "Leads major community-building initiatives, mentorship efforts, or instructor engagement programs",
        "Helps shape YPP culture, morale, and organizational community standards",
        "Serves as a visible leader and ambassador for the YPP mission and community",
      ],
    },
  },
  {
    id: "LONG_TERM_GROWTH",
    number: 5,
    title: "Long-Term Growth & Increased Involvement",
    shortTitle: "Growth",
    oneLiner:
      "Reaching beyond the classroom to grow with YPP over the long term.",
    expectations: {
      INSTRUCTOR: [
        "Demonstrates openness to feedback, growth, and continuous improvement",
        "Shows willingness to contribute beyond core teaching responsibilities when needed",
        "Demonstrates interest in expanding involvement and growing within YPP over time",
      ],
      SENIOR_INSTRUCTOR: [
        "Takes on expanded responsibilities such as event planning, one-off programming, mentoring, or interviewing",
        "Contributes to curriculum development, onboarding, training, or operational improvements",
        "Demonstrates initiative and ownership in helping YPP grow and improve",
      ],
      LEAD_INSTRUCTOR: [
        "Leads major organizational initiatives such as training, recruiting, curriculum strategy, or mentorship programs",
        "Helps identify, develop, and support future instructors and leaders within YPP",
        "Consistently takes on high-impact responsibilities that contribute to YPP's long-term growth and success",
      ],
    },
  },
];

/**
 * The overarching mission statement for every instructor — used at the
 * top of role identity cards and the leadership pathway page.
 */
export const OVERALL_ROLE_MISSION =
  "YPP Instructors are responsible for creating engaging, meaningful, and high-quality learning experiences that help students explore and develop their passions. Instructors play a central role in shaping the YPP experience through excellent teaching and family relationships, professionalism, and active contribution to the broader YPP community. Beyond the classroom, instructors are expected to grow as leaders, collaborators, and ambassadors for YPP's mission and culture.";

export interface InstructorStageSignals {
  primaryRole: string | null | undefined;
  /** From `Instructor.instructorSubtype` — STANDARD vs. SUMMER_WORKSHOP. */
  instructorSubtype?: "STANDARD" | "SUMMER_WORKSHOP" | null;
  /** Whether the user mentors at least one active instructor. */
  isMentor?: boolean;
  /** Whether the user chairs a mentor committee. */
  isCommitteeChair?: boolean;
  /** Whether the user holds an admin role / org leadership. */
  isOrgLeader?: boolean;
}

/**
 * Infer the user's leadership stage from existing signals. This is
 * intentionally permissive — we surface the stage as a *narrative*, not
 * a gate. Admins will eventually be able to assign an explicit stage.
 */
export function inferLeadershipStage(
  signals: InstructorStageSignals
): LeadershipStageId | null {
  const { primaryRole, instructorSubtype, isMentor, isCommitteeChair, isOrgLeader } =
    signals;

  if (isOrgLeader) return "ORGANIZATIONAL_LEADERSHIP";
  if (primaryRole === "CHAPTER_PRESIDENT") return "LEAD_INSTRUCTOR";
  if (primaryRole === "ADMIN" || primaryRole === "STAFF")
    return "ORGANIZATIONAL_LEADERSHIP";

  if (primaryRole !== "INSTRUCTOR" && primaryRole !== "MENTOR") return null;

  if (instructorSubtype === "SUMMER_WORKSHOP") return "WORKSHOP_INSTRUCTOR";
  if (isCommitteeChair) return "LEAD_INSTRUCTOR";
  if (isMentor) return "SENIOR_INSTRUCTOR";
  return "INSTRUCTOR";
}

/**
 * Stage one step above the current one, if any. Used to render
 * "what's next" framing on role cards.
 */
export function getNextStage(
  stageId: LeadershipStageId | null
): LeadershipStage | null {
  if (!stageId) return null;
  const idx = LEADERSHIP_STAGE_ORDER.indexOf(stageId);
  if (idx < 0 || idx >= LEADERSHIP_STAGE_ORDER.length - 1) return null;
  return LEADERSHIP_STAGES[LEADERSHIP_STAGE_ORDER[idx + 1]];
}

export function getStage(stageId: LeadershipStageId): LeadershipStage {
  return LEADERSHIP_STAGES[stageId];
}

/**
 * Promotion philosophy tagline — one-liner for each stage transition,
 * keyed by the *destination* stage.
 */
export const PROMOTION_PHILOSOPHY: Record<LeadershipStageId, string | null> = {
  WORKSHOP_INSTRUCTOR:
    "You're stepping into the YPP instructor ecosystem through a focused, workshop-first pathway.",
  INSTRUCTOR:
    "You're delivering on the fundamentals of YPP teaching and showing up for students, families, and the team.",
  SENIOR_INSTRUCTOR:
    "Your teaching consistency, family relationships, and community contributions have started to set the pace for others.",
  LEAD_INSTRUCTOR:
    "You're shaping how YPP teaches, mentors, and grows — well beyond your own classroom.",
  ORGANIZATIONAL_LEADERSHIP:
    "You're stewarding YPP's mission at the organization level.",
};

/**
 * What the *system* says when describing how mentorship flows at this
 * level. Used in the mentor card and leadership pathway page.
 */
export const MENTORSHIP_PATTERN: Record<LeadershipStageId, string> = {
  WORKSHOP_INSTRUCTOR:
    "Workshop instructors are supported by experienced instructors and program leads while they get oriented.",
  INSTRUCTOR:
    "Instructors are mentored by Senior Instructors, Lead Instructors, or Chapter Presidents.",
  SENIOR_INSTRUCTOR:
    "Senior Instructors are mentored by Lead Instructors or Chapter Presidents.",
  LEAD_INSTRUCTOR: "Lead Instructors are mentored by the global leadership team.",
  ORGANIZATIONAL_LEADERSHIP:
    "Organizational leaders mentor and steward each other across the global team.",
};

/**
 * Map a {@link LeadershipStageId} to the existing `MenteeRoleType` used
 * by the G&R + mentorship machinery, so the role identity layer and
 * the cycle machinery agree on who someone is.
 */
export function toMenteeRoleTypeFromStage(
  stageId: LeadershipStageId | null
): "INSTRUCTOR" | "CHAPTER_PRESIDENT" | "GLOBAL_LEADERSHIP" | null {
  if (!stageId) return null;
  if (stageId === "ORGANIZATIONAL_LEADERSHIP") return "GLOBAL_LEADERSHIP";
  if (stageId === "LEAD_INSTRUCTOR") return "INSTRUCTOR";
  return "INSTRUCTOR";
}

/**
 * Helper for components — get the per-goal expectations for a stage.
 * Falls back to the Instructor expectations for the workshop tier,
 * because workshop instructors are early in the Instructor pathway.
 */
export function expectationsForStage(
  stageId: LeadershipStageId
): Array<{ goal: LeadershipGoal; expectations: string[] }> {
  return LEADERSHIP_GOALS.map((goal) => {
    let key: "INSTRUCTOR" | "SENIOR_INSTRUCTOR" | "LEAD_INSTRUCTOR" =
      "INSTRUCTOR";
    if (stageId === "SENIOR_INSTRUCTOR") key = "SENIOR_INSTRUCTOR";
    else if (
      stageId === "LEAD_INSTRUCTOR" ||
      stageId === "ORGANIZATIONAL_LEADERSHIP"
    )
      key = "LEAD_INSTRUCTOR";
    return { goal, expectations: goal.expectations[key] };
  });
}
