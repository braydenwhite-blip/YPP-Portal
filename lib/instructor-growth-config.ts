export type InstructorGrowthTierKey =
  | "SPARK"
  | "PRACTITIONER"
  | "CATALYST"
  | "PATHMAKER"
  | "LEADER"
  | "LUMINARY"
  | "FELLOW";

export type InstructorGrowthCategoryKey =
  | "TEACHING"
  | "GROWTH"
  | "COMMUNITY"
  | "IMPACT";

export type InstructorGrowthClaimKey =
  | "WORKSHOP_ATTENDED"
  | "FEEDBACK_APPLIED"
  | "REFLECTION_SUBMITTED"
  | "INSTRUCTOR_COLLABORATION"
  | "COMMUNITY_EVENT_ATTENDED"
  | "NEWER_INSTRUCTOR_SUPPORT"
  | "PATHWAYS_CONTRIBUTION"
  | "STUDENT_OUTCOME_MILESTONE"
  | "ROLL_CALL_ROYALTY"
  | "LEADERSHIP_CONTRIBUTION";

export type InstructorGrowthStatusKey =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "REVOKED";

export type InstructorGrowthSourceMethodKey = "AUTO" | "CLAIM" | "MANUAL";

export interface InstructorGrowthTierDef {
  key: InstructorGrowthTierKey;
  name: string;
  shortName: string;
  minXp: number;
  icon: string;
  dotBackground: string;
  dotColor: string;
  accentColor: string;
  badgeBackground: string;
  title: string;
  benefits: string[];
}

export interface InstructorGrowthRuleDef {
  eventKey: string;
  title: string;
  xpAmount: number;
  category: InstructorGrowthCategoryKey;
  trackingLabel: string;
  description: string;
}

export interface InstructorGrowthClaimTemplate {
  eventKey: InstructorGrowthClaimKey;
  title: string;
  xpAmount: number;
  category: InstructorGrowthCategoryKey;
  prompt: string;
  placeholder: string;
  needsCounterparty?: boolean;
  badgeOnly?: boolean;
}

export interface InstructorGrowthBadgeSeed {
  slug: string;
  name: string;
  description: string;
  flavorText: string;
  icon: string;
  accentColor: string;
  perkText: string;
  criteria: Record<string, unknown>;
  order: number;
}

export const INSTRUCTOR_GROWTH_TIERS: InstructorGrowthTierDef[] = [
  {
    key: "SPARK",
    name: "Spark",
    shortName: "Spark",
    minXp: 0,
    icon: "✦",
    dotBackground: "#d7d3c9",
    dotColor: "#5c5952",
    accentColor: "#8a877f",
    badgeBackground: "#f2efe8",
    title: "Your growth record starts here",
    benefits: [
      "Private instructor growth profile with visible progress markers",
      "Assigned mentor visibility and coaching context from day one",
      "Badge gallery and semester snapshots unlocked immediately",
      "Recognition path is visible even before the first major milestone",
    ],
  },
  {
    key: "PRACTITIONER",
    name: "Practitioner",
    shortName: "Practitioner",
    minXp: 300,
    icon: "◈",
    dotBackground: "#c8e2d8",
    dotColor: "#0f4d41",
    accentColor: "#198467",
    badgeBackground: "#e6f5ef",
    title: "Strong foundations, clearly underway",
    benefits: [
      "Practitioner tier marker on internal profile surfaces",
      "Mentor and chapter leads see you as a consistent contributor in motion",
      "Eligible for chapter-level recognition callouts and curated shoutouts",
      "Progress history becomes a stronger signal for future teaching opportunities",
    ],
  },
  {
    key: "CATALYST",
    name: "Catalyst",
    shortName: "Catalyst",
    minXp: 800,
    icon: "⬡",
    dotBackground: "#d3e3f7",
    dotColor: "#0d477f",
    accentColor: "#347fce",
    badgeBackground: "#eaf2fb",
    title: "Impact is becoming visible",
    benefits: [
      "Catalyst profile highlight in mentor and chapter review views",
      "Priority pool for chapter spotlights and recognition roundups",
      "Signals that your practice is moving beyond early ramp-up",
      "Supports stronger consideration for collaborative build work inside YPP",
    ],
  },
  {
    key: "PATHMAKER",
    name: "Pathmaker",
    shortName: "Pathmaker",
    minXp: 1600,
    icon: "◉",
    dotBackground: "#ddd8f8",
    dotColor: "#3a347f",
    accentColor: "#7469ce",
    badgeBackground: "#f0edfd",
    title: "You are helping shape how YPP grows",
    benefits: [
      "Pathmaker status marker on internal instructor views",
      "Eligible for Pathways/resource contribution invitations and pilot work",
      "Profile carries stronger trust signals for chapter-level leadership opportunities",
      "Mentors and leaders can quickly identify you as a builder, not just a participant",
    ],
  },
  {
    key: "LEADER",
    name: "Leader",
    shortName: "Leader",
    minXp: 2800,
    icon: "▲",
    dotBackground: "#e7dccd",
    dotColor: "#6b5331",
    accentColor: "#9c6c2e",
    badgeBackground: "#f8f1e8",
    title: "Trusted enough to guide others",
    benefits: [
      "Leader internal prestige marker across growth and review surfaces",
      "Mentor-candidate and chapter spotlight priority status",
      "Eligible for deeper collaboration requests and launch-critical roles",
      "Your record starts to carry clear leadership-readiness weight inside YPP",
    ],
  },
  {
    key: "LUMINARY",
    name: "Luminary",
    shortName: "Luminary",
    minXp: 4500,
    icon: "★",
    dotBackground: "#f8d592",
    dotColor: "#654212",
    accentColor: "#d08b17",
    badgeBackground: "#fcf3df",
    title: "A standout instructor record with real gravity",
    benefits: [
      "Featured instructor eligibility in chapter and national recognition pools",
      "Luminary prestige marker on internal profile and review surfaces",
      "Trusted signal for top-tier pilot, advisory, and culture-shaping opportunities",
      "Your growth history becomes one of YPP's clearest examples of sustained excellence",
    ],
  },
  {
    key: "FELLOW",
    name: "Fellow",
    shortName: "Fellow",
    minXp: 7000,
    icon: "✺",
    dotBackground: "#dfe6f4",
    dotColor: "#243553",
    accentColor: "#445d88",
    badgeBackground: "#eef3fb",
    title: "Rare, long-horizon prestige",
    benefits: [
      "Fellow designation marks rare, sustained contribution across semesters",
      "Advisory-track and leadership-track eligibility marker for YPP leadership",
      "Highest internal recognition signal in the instructor growth system",
      "Used as a credibility shorthand for trust, staying power, and influence",
    ],
  },
];

export const INSTRUCTOR_GROWTH_RULES: InstructorGrowthRuleDef[] = [
  {
    eventKey: "TRAINING_COMPLETE",
    title: "Required training complete",
    xpAmount: 80,
    category: "TEACHING",
    trackingLabel: "Auto-tracked",
    description: "Awarded once all required instructor training is complete.",
  },
  {
    eventKey: "CURRICULUM_SUBMITTED",
    title: "Curriculum submitted for review",
    xpAmount: 40,
    category: "TEACHING",
    trackingLabel: "Auto-tracked",
    description: "Awarded per curriculum submitted through the portal review flow.",
  },
  {
    eventKey: "CURRICULUM_APPROVED",
    title: "Curriculum approved",
    xpAmount: 90,
    category: "TEACHING",
    trackingLabel: "Auto-tracked",
    description: "Awarded per approved curriculum template.",
  },
  {
    eventKey: "OFFERING_PUBLISHED",
    title: "Live class offering launched",
    xpAmount: 35,
    category: "TEACHING",
    trackingLabel: "Auto-tracked",
    description: "Awarded when an offering moves into a live teaching state.",
  },
  {
    eventKey: "CLASS_SESSION_TAUGHT",
    title: "Verified class session taught",
    xpAmount: 12,
    category: "TEACHING",
    trackingLabel: "Auto-tracked",
    description: "Awarded once a class session records attendance in the portal.",
  },
  {
    eventKey: "LESSON_PLAN_LINKED",
    title: "Lesson plan tied to a scheduled class",
    xpAmount: 6,
    category: "TEACHING",
    trackingLabel: "Auto-tracked",
    description: "Awarded for lesson plans linked to live teaching work, capped at 16 per semester.",
  },
  {
    eventKey: "WORKSHOP_ATTENDED",
    title: "Workshop or check-in attended",
    xpAmount: 20,
    category: "GROWTH",
    trackingLabel: "Claim + review",
    description: "Used for chapter workshops, coach check-ins, and other structured growth touchpoints.",
  },
  {
    eventKey: "FEEDBACK_APPLIED",
    title: "Mentor feedback applied",
    xpAmount: 25,
    category: "GROWTH",
    trackingLabel: "Claim + review",
    description: "Recognizes specific improvement work after mentor or leader feedback.",
  },
  {
    eventKey: "REFLECTION_SUBMITTED",
    title: "Reflection submitted",
    xpAmount: 12,
    category: "GROWTH",
    trackingLabel: "Claim + review",
    description: "Recognizes substantive reflection work, capped at 2 per month.",
  },
  {
    eventKey: "RETURNING_SEMESTER",
    title: "Return for a new teaching semester",
    xpAmount: 50,
    category: "GROWTH",
    trackingLabel: "Auto-tracked",
    description: "Awarded for each distinct semester after the first.",
  },
  {
    eventKey: "TEACHING_PERMISSION_GRANTED",
    title: "New teaching permission or readiness milestone",
    xpAmount: 45,
    category: "GROWTH",
    trackingLabel: "Auto-tracked",
    description: "Awarded when a new instructor teaching permission is granted.",
  },
  {
    eventKey: "INSTRUCTOR_COLLABORATION",
    title: "Instructor collaboration",
    xpAmount: 20,
    category: "COMMUNITY",
    trackingLabel: "Claim + review",
    description: "Used for co-planning, co-teaching, or meaningful collaboration with another instructor.",
  },
  {
    eventKey: "COMMUNITY_EVENT_ATTENDED",
    title: "Chapter or community event attended",
    xpAmount: 15,
    category: "COMMUNITY",
    trackingLabel: "Claim + review",
    description: "Recognizes participation in chapter-facing community moments.",
  },
  {
    eventKey: "NEWER_INSTRUCTOR_SUPPORT",
    title: "Support a newer instructor",
    xpAmount: 35,
    category: "COMMUNITY",
    trackingLabel: "Claim + review",
    description: "Recognizes direct support for a newer instructor's growth.",
  },
  {
    eventKey: "PATHWAYS_CONTRIBUTION",
    title: "YPP Pathways contribution",
    xpAmount: 40,
    category: "COMMUNITY",
    trackingLabel: "Claim + review",
    description: "Recognizes approved pathway, resource, or platform contribution work.",
  },
  {
    eventKey: "STRONG_PARENT_FEEDBACK",
    title: "Strong parent feedback",
    xpAmount: 10,
    category: "IMPACT",
    trackingLabel: "Auto-tracked",
    description: "Awarded for strong instructor-targeted parent feedback, capped at 5 per semester.",
  },
  {
    eventKey: "HIGH_RETENTION_OFFERING",
    title: "High-retention offering",
    xpAmount: 60,
    category: "IMPACT",
    trackingLabel: "Auto-tracked",
    description: "Awarded when a completed offering sustains strong retention.",
  },
  {
    eventKey: "RETURN_TICKET",
    title: "Students return to YPP classes",
    xpAmount: 30,
    category: "IMPACT",
    trackingLabel: "Auto-tracked",
    description: "Awarded when 3 or more students from one offering continue into other YPP classes.",
  },
  {
    eventKey: "STUDENT_OUTCOME_MILESTONE",
    title: "Student outcome milestone",
    xpAmount: 40,
    category: "IMPACT",
    trackingLabel: "Claim + review",
    description: "Used for meaningful student outcomes that are real but not fully auto-trackable yet.",
  },
];

export const INSTRUCTOR_GROWTH_CLAIM_TEMPLATES: InstructorGrowthClaimTemplate[] = [
  {
    eventKey: "WORKSHOP_ATTENDED",
    title: "Workshop or check-in attendance",
    xpAmount: 20,
    category: "GROWTH",
    prompt: "What did you attend and what made it meaningful?",
    placeholder: "Name the workshop, who led it, when it happened, and one thing you took back into your teaching.",
  },
  {
    eventKey: "FEEDBACK_APPLIED",
    title: "Applied mentor or leader feedback",
    xpAmount: 25,
    category: "GROWTH",
    prompt: "What feedback did you apply, and what changed because of it?",
    placeholder: "Describe the feedback, the action you took, and the concrete change in your planning or teaching.",
  },
  {
    eventKey: "REFLECTION_SUBMITTED",
    title: "Reflection submitted",
    xpAmount: 12,
    category: "GROWTH",
    prompt: "What reflection did you complete?",
    placeholder: "Summarize the reflection prompt, the date, and the main insight or decision that came from it.",
  },
  {
    eventKey: "INSTRUCTOR_COLLABORATION",
    title: "Instructor collaboration",
    xpAmount: 20,
    category: "COMMUNITY",
    prompt: "What did you build or improve with another instructor?",
    placeholder: "Explain the collaboration, what each person contributed, and what changed because of it.",
    needsCounterparty: true,
  },
  {
    eventKey: "COMMUNITY_EVENT_ATTENDED",
    title: "Chapter or community event attended",
    xpAmount: 15,
    category: "COMMUNITY",
    prompt: "What event did you attend, and how did you contribute or show up?",
    placeholder: "Name the event, the date, and what your participation added.",
  },
  {
    eventKey: "NEWER_INSTRUCTOR_SUPPORT",
    title: "Support a newer instructor",
    xpAmount: 35,
    category: "COMMUNITY",
    prompt: "How did you support a newer instructor?",
    placeholder: "Describe the support, how often you showed up, and what moved forward because of it.",
    needsCounterparty: true,
  },
  {
    eventKey: "PATHWAYS_CONTRIBUTION",
    title: "YPP Pathways contribution",
    xpAmount: 40,
    category: "COMMUNITY",
    prompt: "What did you contribute to Pathways or shared YPP resources?",
    placeholder: "Describe the contribution, where it lives, and who it helps.",
  },
  {
    eventKey: "STUDENT_OUTCOME_MILESTONE",
    title: "Student outcome milestone",
    xpAmount: 40,
    category: "IMPACT",
    prompt: "What meaningful student outcome did you help produce?",
    placeholder: "Describe the student outcome, your role in it, and why it matters.",
  },
  {
    eventKey: "ROLL_CALL_ROYALTY",
    title: "Roll Call Royalty badge review",
    xpAmount: 0,
    category: "GROWTH",
    prompt: "How did you learn every student's name by session two?",
    placeholder: "Describe the class context and how you made names stick early.",
    badgeOnly: true,
  },
  {
    eventKey: "LEADERSHIP_CONTRIBUTION",
    title: "Leadership, pilot, or advisory contribution",
    xpAmount: 0,
    category: "COMMUNITY",
    prompt: "What leadership-level contribution were you selected for?",
    placeholder: "Describe the opportunity, why you were selected, and what you contributed.",
    badgeOnly: true,
  },
];

export const INSTRUCTOR_GROWTH_BADGES: InstructorGrowthBadgeSeed[] = [
  {
    slug: "first-whistle",
    name: "First Whistle",
    description: "Teach your first verified class session.",
    flavorText: "The first session is on the books. The record has started.",
    icon: "▷",
    accentColor: "#198467",
    perkText: "Starter badge on your internal profile.",
    criteria: { type: "event_key_count", eventKey: "CLASS_SESSION_TAUGHT", minCount: 1 },
    order: 1,
  },
  {
    slug: "blueprint-builder",
    name: "Blueprint Builder",
    description: "Submit your first curriculum for review.",
    flavorText: "Ideas turned into a real instructional blueprint.",
    icon: "≡",
    accentColor: "#9c6c2e",
    perkText: "Signals a build-minded instructor record.",
    criteria: { type: "event_key_count", eventKey: "CURRICULUM_SUBMITTED", minCount: 1 },
    order: 2,
  },
  {
    slug: "launch-code",
    name: "Launch Code",
    description: "Get an approved curriculum into a live offering.",
    flavorText: "Not just designed. Actually launched.",
    icon: "◉",
    accentColor: "#347fce",
    perkText: "Marks launch-readiness in mentor and admin views.",
    criteria: { type: "curriculum_launch" },
    order: 3,
  },
  {
    slug: "roll-call-royalty",
    name: "Roll Call Royalty",
    description: "Learn every active student's name by session two.",
    flavorText: "You remembered the room before the room forgot you.",
    icon: "♢",
    accentColor: "#7469ce",
    perkText: "Culture badge with no XP bonus.",
    criteria: { type: "approved_claim", eventKey: "ROLL_CALL_ROYALTY", minCount: 1 },
    order: 4,
  },
  {
    slug: "proof-of-prep",
    name: "Proof of Prep",
    description: "Log 6 verified lesson plans in a single semester.",
    flavorText: "Preparation stopped being occasional and became your standard.",
    icon: "⟡",
    accentColor: "#198467",
    perkText: "Reliability marker in mentor and admin views.",
    criteria: { type: "semester_event_count", eventKey: "LESSON_PLAN_LINKED", minCount: 6 },
    order: 5,
  },
  {
    slug: "full-season",
    name: "Full Season",
    description: "Teach through a full semester arc with 8 or more verified sessions.",
    flavorText: "You stayed with the work long enough to shape a season, not just a moment.",
    icon: "⌒",
    accentColor: "#9c6c2e",
    perkText: "Semester ribbon on your growth page.",
    criteria: { type: "completed_offering_min_sessions", minSessions: 8 },
    order: 6,
  },
  {
    slug: "feedback-flipper",
    name: "Feedback Flipper",
    description: "Apply mentor feedback and show the change.",
    flavorText: "Feedback didn't sit on the shelf. It moved the work.",
    icon: "↺",
    accentColor: "#347fce",
    perkText: "Coachability signal in review surfaces.",
    criteria: { type: "approved_claim", eventKey: "FEEDBACK_APPLIED", minCount: 1 },
    order: 7,
  },
  {
    slug: "comeback-season",
    name: "Comeback Season",
    description: "Return to teach in a new semester.",
    flavorText: "You came back, and that matters.",
    icon: "↻",
    accentColor: "#445d88",
    perkText: "Returning-instructor marker.",
    criteria: { type: "event_key_count", eventKey: "RETURNING_SEMESTER", minCount: 1 },
    order: 8,
  },
  {
    slug: "double-take",
    name: "Double Take",
    description: "Collaborate meaningfully with another instructor.",
    flavorText: "Two instructors, one stronger result.",
    icon: "⟷",
    accentColor: "#7469ce",
    perkText: "Collaboration marker on your record.",
    criteria: { type: "approved_claim", eventKey: "INSTRUCTOR_COLLABORATION", minCount: 1 },
    order: 9,
  },
  {
    slug: "glue-person",
    name: "Glue Person",
    description: "Show up as the connective tissue for the community.",
    flavorText: "Things held together because you were in the middle of them.",
    icon: "✶",
    accentColor: "#198467",
    perkText: "Community support tag.",
    criteria: { type: "semester_event_count", eventKey: "COMMUNITY_EVENT_ATTENDED", minCount: 3 },
    order: 10,
  },
  {
    slug: "torchbearer",
    name: "Torchbearer",
    description: "Support a newer instructor with real follow-through.",
    flavorText: "You lit the path and stayed beside it.",
    icon: "⚑",
    accentColor: "#d08b17",
    perkText: "Mentor-eligible marker.",
    criteria: { type: "approved_claim", eventKey: "NEWER_INSTRUCTOR_SUPPORT", minCount: 1 },
    order: 11,
  },
  {
    slug: "pathways-pen",
    name: "Pathways Pen",
    description: "Contribute something durable to YPP Pathways.",
    flavorText: "You left behind something others can now build on.",
    icon: "✎",
    accentColor: "#445d88",
    perkText: "Contributor eligibility marker.",
    criteria: { type: "approved_claim", eventKey: "PATHWAYS_CONTRIBUTION", minCount: 1 },
    order: 12,
  },
  {
    slug: "crowd-favorite",
    name: "Crowd Favorite",
    description: "Earn standout parent sentiment across a semester.",
    flavorText: "The families noticed the standard you set.",
    icon: "◎",
    accentColor: "#347fce",
    perkText: "Chapter spotlight eligibility marker.",
    criteria: { type: "strong_parent_feedback_semester", minCount: 5, minAverage: 4.8 },
    order: 13,
  },
  {
    slug: "full-house",
    name: "Full House",
    description: "Sustain 85%+ attendance across a completed offering.",
    flavorText: "Students kept showing up because the room was worth returning to.",
    icon: "▣",
    accentColor: "#198467",
    perkText: "Delivery-strength marker.",
    criteria: { type: "attendance_rate_threshold", minRate: 0.85 },
    order: 14,
  },
  {
    slug: "return-ticket",
    name: "Return Ticket",
    description: "Send 3 or more students onward into other YPP classes.",
    flavorText: "Your classroom didn't end the journey. It extended it.",
    icon: "→",
    accentColor: "#9c6c2e",
    perkText: "Long-term impact ribbon.",
    criteria: { type: "event_key_count", eventKey: "RETURN_TICKET", minCount: 1 },
    order: 15,
  },
  {
    slug: "seat-at-the-table",
    name: "Seat at the Table",
    description: "Be selected for leadership, pilot, or advisory contribution work.",
    flavorText: "The circle got smaller, and you were still invited in.",
    icon: "⬢",
    accentColor: "#445d88",
    perkText: "Leadership-path marker.",
    criteria: { type: "approved_claim", eventKey: "LEADERSHIP_CONTRIBUTION", minCount: 1 },
    order: 16,
  },
];

export function getInstructorGrowthTierForXp(xp: number): InstructorGrowthTierDef {
  let current = INSTRUCTOR_GROWTH_TIERS[0];
  for (const tier of INSTRUCTOR_GROWTH_TIERS) {
    if (xp >= tier.minXp) {
      current = tier;
      continue;
    }
    break;
  }
  return current;
}

export function getInstructorGrowthTier(key: string | null | undefined): InstructorGrowthTierDef {
  return (
    INSTRUCTOR_GROWTH_TIERS.find((tier) => tier.key === key) ??
    INSTRUCTOR_GROWTH_TIERS[0]
  );
}

export function getNextInstructorGrowthTier(
  xp: number
): InstructorGrowthTierDef | null {
  return INSTRUCTOR_GROWTH_TIERS.find((tier) => tier.minXp > xp) ?? null;
}

export function deriveSemesterLabel(date: Date) {
  const month = date.getMonth();
  const year = date.getFullYear();

  if (month <= 4) {
    return `Spring ${year}`;
  }
  if (month <= 7) {
    return `Summer ${year}`;
  }
  return `Fall ${year}`;
}

export function getCurrentSemesterLabel() {
  return deriveSemesterLabel(new Date());
}

export function isStrongParentFeedback(input: {
  rating: number;
  wouldRecommend: boolean | null | undefined;
}) {
  return input.rating >= 5 || (input.rating >= 4 && input.wouldRecommend === true);
}

export function getInstructorGrowthRule(eventKey: string) {
  return INSTRUCTOR_GROWTH_RULES.find((rule) => rule.eventKey === eventKey) ?? null;
}

export function getInstructorGrowthClaimTemplate(eventKey: string) {
  return (
    INSTRUCTOR_GROWTH_CLAIM_TEMPLATES.find((template) => template.eventKey === eventKey) ??
    null
  );
}
