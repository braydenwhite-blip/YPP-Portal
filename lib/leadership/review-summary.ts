// Review-evidence generation — turns an instructor's leadership contributions
// (plus optional advising caseload stats) into the concise summary lines and
// suggested review language that surface on instructor profiles and in the
// Quarterly Review section. Pure functions; tested in
// tests/lib/leadership/review-summary.test.ts.

import type { LeadershipRoleCategory } from "@prisma/client";
import { LEADERSHIP_ROLE_CATALOG } from "./constants";
import {
  computeExpectationProgress,
  isMeaningful,
  type ContributionLike,
} from "./expectations";

export type ReviewContribution = ContributionLike & {
  title: string;
};

export type AdvisorEvidenceStats = {
  activeAdvisees: number;
  checkInsLogged: number;
  recommendationsMade: number;
};

export type ReviewEvidence = {
  /** One-line statements suitable for pasting into a review. */
  suggestedLanguage: string[];
  /** Current + completed role titles for the evidence list. */
  currentRoles: string[];
  completedRoles: string[];
  promotionReadiness: {
    seniorReady: boolean;
    leadReady: boolean;
    label: string;
  };
};

const QUALITY_CATEGORIES: LeadershipRoleCategory[] = [
  "CURRICULUM_REVIEWER",
  "CLASS_QUALITY_REVIEWER",
  "CURRICULUM_LEAD",
];

const HIRING_CATEGORIES: LeadershipRoleCategory[] = [
  "INTERVIEWER",
  "ONBOARDING_HELPER",
  "RECRUITMENT_LEAD",
];

export function generateReviewEvidence(
  contributions: ReviewContribution[],
  advisorStats?: AdvisorEvidenceStats | null,
): ReviewEvidence {
  const visible = contributions.filter((c) => c.reviewVisible);
  const progress = computeExpectationProgress(visible);
  const meaningful = visible.filter(isMeaningful);
  const categories = new Set(meaningful.map((c) => c.category));

  const lines: string[] = [];

  if (meaningful.length > 0) {
    lines.push("Contributes beyond own classroom.");
  }

  if (categories.has("STUDENT_ADVISOR")) {
    if (advisorStats && advisorStats.activeAdvisees > 0) {
      lines.push(
        `Supports ${advisorStats.activeAdvisees} student${
          advisorStats.activeAdvisees === 1 ? "" : "s"
        } through advising (${advisorStats.checkInsLogged} check-ins, ${
          advisorStats.recommendationsMade
        } next-step recommendations).`,
      );
    } else {
      lines.push("Supports students through advising.");
    }
  }

  if (categories.has("INSTRUCTOR_MENTOR")) {
    lines.push("Mentors newer instructors.");
  }

  if (categories.has("STUDENT_PROJECT_MENTOR")) {
    lines.push("Mentors student projects beyond the classroom.");
  }

  if (QUALITY_CATEGORIES.some((c) => categories.has(c))) {
    lines.push("Takes ownership of curriculum/program quality.");
  }

  if (HIRING_CATEGORIES.some((c) => categories.has(c))) {
    lines.push("Strengthens the instructor team through interviewing, onboarding, or recruitment.");
  }

  if (categories.has("INSTRUCTION_COMMITTEE")) {
    lines.push("Serves on the Instruction Committee.");
  }

  const ownership = meaningful.filter((c) => c.isOwnership);
  if (ownership.length > 0) {
    const named = ownership
      .slice(0, 2)
      .map((c) => c.title || LEADERSHIP_ROLE_CATALOG[c.category].label)
      .join("; ");
    lines.push(`Owns a meaningful partner/program/system (${named}).`);
  }

  if (meaningful.length === 0) {
    lines.push("Needs more initiative beyond teaching.");
  }

  const currentRoles = visible
    .filter((c) => c.status === "ACTIVE" || c.status === "ASSIGNED" || c.status === "NEEDS_ATTENTION")
    .map((c) => c.title || LEADERSHIP_ROLE_CATALOG[c.category].label);
  const completedRoles = visible
    .filter((c) => c.status === "COMPLETED")
    .map((c) => c.title || LEADERSHIP_ROLE_CATALOG[c.category].label);

  const promotionReadiness = {
    seniorReady: progress.senior.met,
    leadReady: progress.lead.met,
    label: progress.lead.met
      ? "Meets Lead Instructor leadership expectations"
      : progress.senior.met
        ? "Meets Senior Instructor leadership expectations"
        : "Not yet meeting Senior Instructor leadership expectations",
  };

  return {
    suggestedLanguage: lines,
    currentRoles,
    completedRoles,
    promotionReadiness,
  };
}
