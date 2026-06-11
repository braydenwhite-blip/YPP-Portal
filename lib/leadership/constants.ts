// Leadership Roles & Contributions — role catalog + vocabularies.
//
// Role *definitions* live here as a code catalog (same convention as
// lib/growth/constants.ts and lib/partners-constants.ts): each
// LeadershipRoleCategory gets a label, description, default weight, default
// expected level, and an ownership flag. New roles can be added by extending
// the Prisma enum + this catalog; anything ad-hoc fits under OTHER with a
// custom title. TEXT vocabularies for activity kinds, advising note kinds,
// and recommendation kinds/statuses are validated here rather than as
// Postgres enums so they stay editable without a migration.

import type {
  AdvisingStatus,
  LeadershipContributionStatus,
  LeadershipExpectedLevel,
  LeadershipRoleCategory,
} from "@prisma/client";

export type LeadershipRoleDefinition = {
  category: LeadershipRoleCategory;
  label: string;
  description: string;
  /// 1 = light support, 2 = meaningful contribution, 3 = major ownership.
  defaultWeight: 1 | 2 | 3;
  defaultLevel: LeadershipExpectedLevel;
  /// True when the role involves real ownership (counts toward the Lead
  /// Instructor "at least one ownership role" expectation).
  isOwnership: boolean;
};

export const LEADERSHIP_ROLE_CATALOG: Record<
  LeadershipRoleCategory,
  LeadershipRoleDefinition
> = {
  STUDENT_ADVISOR: {
    category: "STUDENT_ADVISOR",
    label: "Student Advisor",
    description:
      "Advises assigned students: tracks interests and activity, logs check-ins, recommends next steps, and helps students move from classes into projects, mentorship, leadership, or the instructor pathway.",
    defaultWeight: 2,
    defaultLevel: "EITHER",
    isOwnership: false,
  },
  INSTRUCTOR_MENTOR: {
    category: "INSTRUCTOR_MENTOR",
    label: "Instructor Mentor",
    description:
      "Mentors a newer instructor through onboarding and their first classes — regular check-ins, observation debriefs, and practical guidance.",
    defaultWeight: 2,
    defaultLevel: "SENIOR_INSTRUCTOR",
    isOwnership: false,
  },
  CURRICULUM_REVIEWER: {
    category: "CURRICULUM_REVIEWER",
    label: "Curriculum Reviewer",
    description:
      "Reviews a curriculum or class proposal and provides structured feedback before it ships to students.",
    defaultWeight: 2,
    defaultLevel: "SENIOR_INSTRUCTOR",
    isOwnership: false,
  },
  INTERVIEWER: {
    category: "INTERVIEWER",
    label: "Interviewer",
    description:
      "Interviews instructor candidates/applicants and records notes and a recommendation for the hiring decision.",
    defaultWeight: 2,
    defaultLevel: "SENIOR_INSTRUCTOR",
    isOwnership: false,
  },
  ONBOARDING_HELPER: {
    category: "ONBOARDING_HELPER",
    label: "Onboarding & Training Helper",
    description:
      "Helps onboard and train incoming instructors — walkthroughs, shadow sessions, and training support.",
    defaultWeight: 2,
    defaultLevel: "SENIOR_INSTRUCTOR",
    isOwnership: false,
  },
  CLASS_QUALITY_REVIEWER: {
    category: "CLASS_QUALITY_REVIEWER",
    label: "Class Quality Reviewer",
    description:
      "Observes classes and reviews instructional quality, giving instructors concrete feedback.",
    defaultWeight: 2,
    defaultLevel: "SENIOR_INSTRUCTOR",
    isOwnership: false,
  },
  STUDENT_PROJECT_MENTOR: {
    category: "STUDENT_PROJECT_MENTOR",
    label: "Student Project Mentor",
    description:
      "Mentors a student project from idea to showcase — scoping, feedback cycles, and unblocking.",
    defaultWeight: 2,
    defaultLevel: "SENIOR_INSTRUCTOR",
    isOwnership: false,
  },
  INSTRUCTION_COMMITTEE: {
    category: "INSTRUCTION_COMMITTEE",
    label: "Instruction Committee Member",
    description:
      "Serves on the Instruction Committee: class assignments, task delegation, partner/class matching, feedback collection, review writing, promotion recommendations, and instructional quality improvement.",
    defaultWeight: 3,
    defaultLevel: "LEAD_INSTRUCTOR",
    isOwnership: true,
  },
  LEAD_INSTRUCTOR: {
    category: "LEAD_INSTRUCTOR",
    label: "Lead Instructor (class/program/subject)",
    description:
      "Owns a class, program, or subject area — responsible for its quality, instructors, and outcomes.",
    defaultWeight: 3,
    defaultLevel: "LEAD_INSTRUCTOR",
    isOwnership: true,
  },
  PARTNER_RELATIONSHIP_LEAD: {
    category: "PARTNER_RELATIONSHIP_LEAD",
    label: "Partner Relationship Lead",
    description:
      "Owns the relationship with a partner organization — responsibilities, follow-ups, feedback, and outcomes.",
    defaultWeight: 3,
    defaultLevel: "LEAD_INSTRUCTOR",
    isOwnership: true,
  },
  RECRUITMENT_LEAD: {
    category: "RECRUITMENT_LEAD",
    label: "Recruitment Lead",
    description:
      "Owns instructor/student recruitment for a chapter, program, or season.",
    defaultWeight: 3,
    defaultLevel: "LEAD_INSTRUCTOR",
    isOwnership: true,
  },
  TRAINING_DEVELOPMENT_LEAD: {
    category: "TRAINING_DEVELOPMENT_LEAD",
    label: "Training & Development Lead",
    description:
      "Owns instructor training and development — content, sessions, and progress tracking.",
    defaultWeight: 3,
    defaultLevel: "LEAD_INSTRUCTOR",
    isOwnership: true,
  },
  STUDENT_SUCCESS_LEAD: {
    category: "STUDENT_SUCCESS_LEAD",
    label: "Student Success Lead",
    description:
      "Owns student success outcomes — advising coverage, engagement, and progression into next opportunities.",
    defaultWeight: 3,
    defaultLevel: "LEAD_INSTRUCTOR",
    isOwnership: true,
  },
  MENTORSHIP_PROGRAM_LEAD: {
    category: "MENTORSHIP_PROGRAM_LEAD",
    label: "Mentorship Program Lead",
    description:
      "Owns a mentorship program — matching, mentor support, and program health.",
    defaultWeight: 3,
    defaultLevel: "LEAD_INSTRUCTOR",
    isOwnership: true,
  },
  CURRICULUM_LEAD: {
    category: "CURRICULUM_LEAD",
    label: "Curriculum Lead",
    description:
      "Owns curriculum quality for a subject or program — standards, reviews, and improvements.",
    defaultWeight: 3,
    defaultLevel: "LEAD_INSTRUCTOR",
    isOwnership: true,
  },
  INITIATIVE_OWNER: {
    category: "INITIATIVE_OWNER",
    label: "Initiative / Project Owner",
    description:
      "Owns a major initiative, project, or system end-to-end — scoping, delivery, and results.",
    defaultWeight: 3,
    defaultLevel: "LEAD_INSTRUCTOR",
    isOwnership: true,
  },
  OTHER: {
    category: "OTHER",
    label: "Other Leadership Responsibility",
    description:
      "Any other leadership-team responsibility — describe it in the title and notes.",
    defaultWeight: 2,
    defaultLevel: "EITHER",
    isOwnership: false,
  },
};

export const LEADERSHIP_ROLE_CATEGORIES = Object.keys(
  LEADERSHIP_ROLE_CATALOG,
) as LeadershipRoleCategory[];

/** Example contributions that satisfy the Senior Instructor expectation. */
export const SENIOR_EXAMPLE_CATEGORIES: LeadershipRoleCategory[] = [
  "STUDENT_ADVISOR",
  "INSTRUCTOR_MENTOR",
  "CURRICULUM_REVIEWER",
  "INTERVIEWER",
  "ONBOARDING_HELPER",
  "CLASS_QUALITY_REVIEWER",
  "STUDENT_PROJECT_MENTOR",
];

/** Example ownership contributions that satisfy the Lead Instructor expectation. */
export const LEAD_EXAMPLE_CATEGORIES: LeadershipRoleCategory[] = [
  "INSTRUCTION_COMMITTEE",
  "LEAD_INSTRUCTOR",
  "PARTNER_RELATIONSHIP_LEAD",
  "RECRUITMENT_LEAD",
  "TRAINING_DEVELOPMENT_LEAD",
  "STUDENT_SUCCESS_LEAD",
  "MENTORSHIP_PROGRAM_LEAD",
  "CURRICULUM_LEAD",
  "INITIATIVE_OWNER",
];

// ─────────────────────────────────────────────────────────────────────────────
// Status display metadata
// ─────────────────────────────────────────────────────────────────────────────

export const CONTRIBUTION_STATUS_META: Record<
  LeadershipContributionStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  SUGGESTED: { label: "Suggested", tone: "neutral" },
  ASSIGNED: { label: "Assigned", tone: "info" },
  ACTIVE: { label: "Active", tone: "success" },
  COMPLETED: { label: "Completed", tone: "info" },
  PAUSED: { label: "Paused", tone: "neutral" },
  NEEDS_ATTENTION: { label: "Needs attention", tone: "danger" },
};

export const EXPECTED_LEVEL_META: Record<
  LeadershipExpectedLevel,
  { label: string; short: string }
> = {
  SENIOR_INSTRUCTOR: { label: "Senior Instructor", short: "Senior" },
  LEAD_INSTRUCTOR: { label: "Lead Instructor", short: "Lead" },
  EITHER: { label: "Senior or Lead", short: "Either" },
};

export const ADVISING_STATUS_META: Record<
  AdvisingStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  ENGAGED: { label: "Engaged", tone: "success" },
  NEEDS_ATTENTION: { label: "Needs attention", tone: "danger" },
  INACTIVE: { label: "Inactive", tone: "neutral" },
  READY_FOR_NEXT: { label: "Ready for next opportunity", tone: "info" },
};

export const ADVISING_STATUSES = Object.keys(
  ADVISING_STATUS_META,
) as AdvisingStatus[];

// ─────────────────────────────────────────────────────────────────────────────
// TEXT vocabularies (validated app-side, no Postgres enums)
// ─────────────────────────────────────────────────────────────────────────────

export const CONTRIBUTION_ACTIVITY_KINDS = [
  "NOTE",
  "CHECK_IN",
  "FEEDBACK",
  "INTERVIEW_COMPLETED",
  "REVIEW_COMPLETED",
  "RECOMMENDATION",
  "STATUS_CHANGE",
  "FOLLOW_UP",
] as const;
export type ContributionActivityKind =
  (typeof CONTRIBUTION_ACTIVITY_KINDS)[number];

export const CONTRIBUTION_ACTIVITY_KIND_LABELS: Record<
  ContributionActivityKind,
  string
> = {
  NOTE: "Note",
  CHECK_IN: "Check-in",
  FEEDBACK: "Feedback",
  INTERVIEW_COMPLETED: "Interview completed",
  REVIEW_COMPLETED: "Review completed",
  RECOMMENDATION: "Recommendation",
  STATUS_CHANGE: "Status change",
  FOLLOW_UP: "Follow-up",
};

export const ADVISING_NOTE_KINDS = ["NOTE", "CHECK_IN"] as const;
export type AdvisingNoteKind = (typeof ADVISING_NOTE_KINDS)[number];

export const RECOMMENDATION_KINDS = [
  "CLASS",
  "PROJECT",
  "MENTOR",
  "OPPORTUNITY",
  "PATHWAY",
] as const;
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];

export const RECOMMENDATION_KIND_LABELS: Record<RecommendationKind, string> = {
  CLASS: "Class",
  PROJECT: "Project",
  MENTOR: "Mentor",
  OPPORTUNITY: "Opportunity",
  PATHWAY: "Pathway",
};

export const RECOMMENDATION_STATUSES = [
  "SUGGESTED",
  "IN_PROGRESS",
  "DONE",
  "DISMISSED",
] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Caseload + activity-health thresholds (Student Advisor)
// ─────────────────────────────────────────────────────────────────────────────

/** Advisors with this many or more active advisees count as high caseload. */
export const CASELOAD_HIGH_THRESHOLD = 8;
/** Advisors with this many or fewer active advisees count as low caseload. */
export const CASELOAD_LOW_THRESHOLD = 2;
/** A check-in within this many days counts the advisor as actively advising. */
export const ADVISOR_ACTIVE_WINDOW_DAYS = 30;
/** No check-in for this many days marks the advisor's caseload inactive. */
export const ADVISOR_INACTIVE_AFTER_DAYS = 60;
