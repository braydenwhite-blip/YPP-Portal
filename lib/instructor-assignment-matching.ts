/**
 * Pure helpers for the instructor-to-workshop assignment system.
 *
 * No `"use server"` here — these are deterministic scoring + derivation helpers
 * imported by server actions and admin pages. Keeping them pure makes the
 * matching logic easy to unit-test and easy to reason about ("why was X
 * suggested?" is a function of inputs, not a black box).
 */

import type {
  AssignmentStatus,
  OpportunityStatus,
  WorkshopOpportunity,
  InstructorAssignment,
  CourseLevel,
} from "@prisma/client";

// ----------------------------------------------------------------------------
// Coverage derivation
// ----------------------------------------------------------------------------

/**
 * Statuses that count as a slot being held — confirmed, pending, or both-sides
 * partial. Suggested/Waitlisted/Declined/Cancelled don't consume a slot.
 */
export const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  "PENDING",
  "CONFIRMED",
];

export type OpportunityCoverage = {
  needed: number;
  active: number;
  confirmed: number;
  /** active < needed */
  uncovered: boolean;
  /** active >= needed */
  fullyCovered: boolean;
  /** active > needed */
  overstaffed: boolean;
};

export function deriveCoverage(
  slotsNeeded: number,
  assignments: Pick<InstructorAssignment, "status">[],
): OpportunityCoverage {
  const active = assignments.filter((a) =>
    ACTIVE_ASSIGNMENT_STATUSES.includes(a.status),
  ).length;
  const confirmed = assignments.filter((a) => a.status === "CONFIRMED").length;
  return {
    needed: slotsNeeded,
    active,
    confirmed,
    uncovered: active < slotsNeeded,
    fullyCovered: active >= slotsNeeded,
    overstaffed: active > slotsNeeded,
  };
}

// ----------------------------------------------------------------------------
// Urgency helpers
// ----------------------------------------------------------------------------

/**
 * "Needs attention" surface used by the admin dashboard. An opportunity is
 * surfaced as needing action when it's still in an active lifecycle stage
 * AND either uncovered, urgency-tagged, or past its fill-by deadline.
 */
export function needsAttention(input: {
  status: OpportunityStatus;
  urgency: WorkshopOpportunity["urgency"];
  fillByDate: Date | null;
  coverage: OpportunityCoverage;
  now?: Date;
}): boolean {
  const { status, urgency, fillByDate, coverage, now = new Date() } = input;
  if (status === "COMPLETED" || status === "CANCELLED" || status === "ARCHIVED") {
    return false;
  }
  if (coverage.uncovered) return true;
  if (urgency === "HIGH" || urgency === "URGENT") return true;
  if (fillByDate && fillByDate.getTime() < now.getTime()) return true;
  return false;
}

// ----------------------------------------------------------------------------
// Instructor match scoring
//
// A deterministic, fully-explainable score in the range [-5, 10]. We surface
// the contributing reasons so the admin UI can show *why* an instructor was
// suggested or downranked. No ML, no heuristics — just transparent rules.
// ----------------------------------------------------------------------------

export type MatchReason = {
  label: string;
  delta: number;
};

export type MatchScore = {
  total: number;
  reasons: MatchReason[];
};

export type CandidateInstructor = {
  id: string;
  /** Lower-cased city the instructor is based in (from profile or application). */
  city: string | null;
  state: string | null;
  /** Free-text subjects/interests the applicant listed. */
  subjects: string | null;
  /**
   * Most recent instructor application status. APPROVED is treated as
   * "fully cleared", anything else as "in-progress".
   */
  applicationStatus: string | null;
  /** STANDARD_INSTRUCTOR | SUMMER_WORKSHOP_INSTRUCTOR */
  applicationTrack: string | null;
  /** Number of currently active (PENDING/CONFIRMED) assignments. */
  activeAssignmentCount: number;
  /**
   * Whether the instructor has at least one approved workshop proposal —
   * lets admins prefer instructors with a sign-off curriculum.
   */
  hasApprovedProposal: boolean;
  /** Teaching permission levels granted on the instructor. */
  teachingLevels: CourseLevel[];
};

export type ScoreOpportunityInput = {
  topicTags: string[];
  deliveryMode: WorkshopOpportunity["deliveryMode"];
  locationCity: string | null;
  locationState: string | null;
  requiredCourseLevel: CourseLevel | null;
};

const MAX_RECOMMENDED_ACTIVE_ASSIGNMENTS = 3;

/**
 * Score a single instructor's fit against an opportunity. Higher is better.
 * Negative deltas (overload, missing approval) are surfaced explicitly so
 * admins can decide whether to override.
 */
export function scoreInstructorMatch(
  instructor: CandidateInstructor,
  opportunity: ScoreOpportunityInput,
): MatchScore {
  const reasons: MatchReason[] = [];

  // Topic / subject overlap
  const subjects = (instructor.subjects ?? "").toLowerCase();
  const matchedTags = opportunity.topicTags.filter((tag) =>
    subjects.includes(tag.toLowerCase()),
  );
  if (matchedTags.length > 0) {
    reasons.push({
      label: `Topic match: ${matchedTags.slice(0, 3).join(", ")}`,
      delta: Math.min(matchedTags.length, 3) * 2,
    });
  }

  // Region match (only meaningful for in-person/hybrid placements)
  if (opportunity.deliveryMode !== "VIRTUAL") {
    if (
      opportunity.locationCity &&
      instructor.city &&
      opportunity.locationCity.toLowerCase() === instructor.city.toLowerCase()
    ) {
      reasons.push({ label: "Same city as program", delta: 3 });
    } else if (
      opportunity.locationState &&
      instructor.state &&
      opportunity.locationState.toLowerCase() === instructor.state.toLowerCase()
    ) {
      reasons.push({ label: "Same state/region", delta: 2 });
    }
  } else {
    // Virtual program — region is irrelevant; reward instructors who've
    // signalled comfort with online delivery via their application track.
    reasons.push({ label: "Online program (no region needed)", delta: 1 });
  }

  // Application / approval status
  if (instructor.applicationStatus === "APPROVED") {
    reasons.push({ label: "Application approved", delta: 2 });
  } else if (instructor.applicationStatus) {
    reasons.push({
      label: `Application not yet approved (${instructor.applicationStatus})`,
      delta: -2,
    });
  }

  // Teaching permission level
  if (
    opportunity.requiredCourseLevel &&
    instructor.teachingLevels.includes(opportunity.requiredCourseLevel)
  ) {
    reasons.push({
      label: `Cleared for ${opportunity.requiredCourseLevel}`,
      delta: 2,
    });
  } else if (
    opportunity.requiredCourseLevel &&
    instructor.teachingLevels.length === 0
  ) {
    reasons.push({ label: "No teaching permissions yet", delta: -1 });
  }

  // Curriculum readiness
  if (instructor.hasApprovedProposal) {
    reasons.push({ label: "Has approved workshop proposal", delta: 1 });
  }

  // Workload
  if (instructor.activeAssignmentCount === 0) {
    reasons.push({ label: "No current assignments", delta: 1 });
  } else if (
    instructor.activeAssignmentCount >= MAX_RECOMMENDED_ACTIVE_ASSIGNMENTS
  ) {
    reasons.push({
      label: `Overloaded (${instructor.activeAssignmentCount} active)`,
      delta: -3,
    });
  } else {
    reasons.push({
      label: `${instructor.activeAssignmentCount} active assignment(s)`,
      delta: 0,
    });
  }

  // Summer-workshop track instructor on a summer camp — slight nudge so
  // qualified summer instructors aren't buried under standard instructors.
  if (
    instructor.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR" &&
    opportunity.topicTags.length > 0
  ) {
    reasons.push({ label: "Summer workshop track instructor", delta: 1 });
  }

  const total = reasons.reduce((sum, r) => sum + r.delta, 0);
  return { total, reasons };
}

/** Sort a list of candidates by descending score, ties broken alphabetically. */
export function rankCandidates<T extends { name: string; score: MatchScore }>(
  candidates: T[],
): T[] {
  return [...candidates].sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    return a.name.localeCompare(b.name);
  });
}
