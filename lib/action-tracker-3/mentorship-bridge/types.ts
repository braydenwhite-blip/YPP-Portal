/**
 * Action Tracker 3.0 — mentorship bridge types.
 *
 * Lightweight, typed shapes that let Mentorship 2.0 (M2) hand off into the coming
 * N1 Mission → Goal → Milestone → Action system WITHOUT building N1 yet. Nothing
 * here is persisted; these are derived suggestions only. Inputs are decoupled
 * from Prisma so the bridge is pure and unit-testable.
 */

export type MentorshipGoalSource =
  | "application-goal"
  | "career-goal"
  | "leadership-goal"
  | "interest"
  | "default";

export interface MentorshipGoalSeed {
  title: string;
  description: string;
  source: MentorshipGoalSource;
}

export interface MentorshipMilestoneSeed {
  title: string;
  detail: string;
  /** Set when the milestone was shaped by a specific mentor expertise area. */
  expertiseSlug?: string;
}

/** A typed bundle an approved match could seed N1 with (not persisted today). */
export interface MentorshipActionSeed {
  goals: MentorshipGoalSeed[];
  milestones: MentorshipMilestoneSeed[];
  firstSteps: string[];
}

export interface BridgeApplicationInput {
  goals?: string | null;
  interests?: string[];
  careerGoal?: string | null;
  leadershipGoal?: string | null;
}

export interface BridgeMentorExpertise {
  slug: string;
  name: string;
}

export interface BridgeMatch {
  application: BridgeApplicationInput;
  mentorExpertise: BridgeMentorExpertise[];
  mentorName?: string | null;
}
