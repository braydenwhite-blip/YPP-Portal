/**
 * Action Tracker 3.0 — mentorship bridge.
 *
 * Conceptual adapters that turn a mentorship application / approved match into
 * starter Goals, Milestones, and first steps for the future N1 Action Tracker.
 * Pure and deterministic; returns typed objects only — N1 persistence is NOT
 * built here. The purpose is to keep M2 connected to the roadmap without
 * prematurely building N1.
 */

import type {
  BridgeApplicationInput,
  BridgeMatch,
  BridgeMentorExpertise,
  MentorshipActionSeed,
  MentorshipGoalSeed,
  MentorshipMilestoneSeed,
} from "./types";

export * from "./types";

const MAX_GOALS = 4;
const MAX_EXPERTISE_MILESTONES = 3;
const MAX_INTEREST_GOALS = 2;

/** Shorten free text into a goal title (first sentence/clause, capped). */
function toTitle(text: string, maxLen = 60): string {
  const firstClause = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/[.!?\n]/)[0]
    .trim();
  if (firstClause.length <= maxLen) return firstClause;
  return `${firstClause.slice(0, maxLen - 1).trimEnd()}…`;
}

function nonEmpty(value: string | null | undefined): value is string {
  return Boolean(value && value.trim());
}

/**
 * Derive starter mentorship goals from the application's stated goals + the
 * applicant's career/leadership goals + interests. Always returns at least one
 * goal (a safe default when the application is empty).
 */
export function deriveInitialMentorshipGoals(
  application: BridgeApplicationInput
): MentorshipGoalSeed[] {
  const goals: MentorshipGoalSeed[] = [];

  if (nonEmpty(application.goals)) {
    goals.push({
      title: toTitle(application.goals),
      description: application.goals.trim(),
      source: "application-goal",
    });
  }
  if (nonEmpty(application.careerGoal)) {
    goals.push({
      title: `Work toward: ${toTitle(application.careerGoal, 48)}`,
      description: application.careerGoal.trim(),
      source: "career-goal",
    });
  }
  if (nonEmpty(application.leadershipGoal)) {
    goals.push({
      title: `Grow as a leader: ${toTitle(application.leadershipGoal, 44)}`,
      description: application.leadershipGoal.trim(),
      source: "leadership-goal",
    });
  }
  for (const interest of (application.interests ?? []).filter(nonEmpty).slice(0, MAX_INTEREST_GOALS)) {
    goals.push({
      title: `Explore ${interest.trim()}`,
      description: `Build skills and confidence in ${interest.trim()} with your mentor.`,
      source: "interest",
    });
  }

  if (goals.length === 0) {
    goals.push({
      title: "Define your mentorship goals",
      description:
        "Work with your mentor in your first session to set 1–2 concrete goals.",
      source: "default",
    });
  }

  return goals.slice(0, MAX_GOALS);
}

/**
 * Suggest first milestones, shaped by the mentor's expertise areas. With no
 * expertise the result is a safe generic set (kickoff + set a first goal); each
 * mentor area adds an orientation milestone tagged with its slug.
 */
export function suggestFirstMilestones(
  application: BridgeApplicationInput,
  mentorExpertise: BridgeMentorExpertise[]
): MentorshipMilestoneSeed[] {
  const milestones: MentorshipMilestoneSeed[] = [
    {
      title: "Complete your kickoff meeting",
      detail: "Meet your mentor, share context, and align on goals.",
    },
  ];

  const areas = (mentorExpertise ?? []).filter((a) => nonEmpty(a?.slug) && nonEmpty(a?.name));
  if (areas.length === 0) {
    milestones.push({
      title: "Set your first goal",
      detail: "Pick one concrete, achievable goal to start with.",
    });
    return milestones;
  }

  for (const area of areas.slice(0, MAX_EXPERTISE_MILESTONES)) {
    milestones.push({
      title: `Get oriented in ${area.name}`,
      detail: `Ask your mentor how they apply ${area.name}, and pick a first step.`,
      expertiseSlug: area.slug,
    });
  }
  return milestones;
}

/**
 * Build a typed action seed for an approved match. NOT persisted — a forward
 * interface for N1. firstSteps are human-readable prompts for the mentee.
 */
export function createMentorshipActionSeed(match: BridgeMatch): MentorshipActionSeed {
  const goals = deriveInitialMentorshipGoals(match.application);
  const milestones = suggestFirstMilestones(match.application, match.mentorExpertise);

  const mentor = nonEmpty(match.mentorName) ? match.mentorName.trim() : "your mentor";
  const firstSteps = [
    `Schedule your kickoff with ${mentor}.`,
    "Review your goals so you can talk them through.",
    "Note 1–2 questions you want help with.",
  ];

  return { goals, milestones, firstSteps };
}
