import type { ChapterPresidentApplicationStatus } from "@prisma/client";

export type CPStatus = ChapterPresidentApplicationStatus | string;

export type CPApplicantLifecycleInput = {
  status: CPStatus;
  reviewerId?: string | null;
  interviewScheduledAt?: Date | string | null;
  interviewNotes?: string | null;
  interviewSummary?: string | null;
  decisionAt?: Date | string | null;
  decisionMakerId?: string | null;
  acceptanceEmailSentAt?: Date | string | null;
  linkedPersonId?: string | null;
  roleAssignedAt?: Date | string | null;
  starterActionsCreatedAt?: Date | string | null;
  onboardingCompletedAt?: Date | string | null;
};

export const CP_RUBRIC_FIELDS = [
  { key: "scoreFit", label: "Mission fit" },
  { key: "scoreLeadership", label: "Leadership maturity" },
  { key: "scoreCommunication", label: "Communication clarity" },
  { key: "scoreCommitment", label: "Reliability / follow-through" },
  { key: "scoreRecruiting", label: "Ability to recruit students" },
  { key: "scoreOrganization", label: "First chapter meeting plan" },
  { key: "scoreVision", label: "Local opportunity / school fit" },
  { key: "scoreOverallConfidence", label: "Overall confidence" },
] as const;

export const CP_SCORE_OPTIONS = [
  { value: "4", label: "Strong" },
  { value: "3", label: "Good" },
  { value: "2", label: "Concern" },
  { value: "", label: "Not enough information" },
] as const;

export const CP_INTERVIEW_QUESTION_GROUPS = [
  "Why YPP?",
  "What community would you lead?",
  "How would you recruit your first team?",
  "What would your first meeting look like?",
  "How would you handle unreliable volunteers?",
  "What support do you need from national YPP?",
] as const;

export const CP_STARTER_ACTIONS = [
  "Schedule first chapter planning call",
  "Submit chapter launch plan",
  "Identify 2-3 founding team members",
  "Choose first class/program idea",
  "Confirm school/community location",
  "Attend CP orientation/training",
] as const;

export const CP_PIPELINE_LANES = [
  {
    id: "new_application",
    title: "New application",
    statuses: ["SUBMITTED"],
  },
  {
    id: "initial_review",
    title: "Initial review",
    statuses: ["INITIAL_REVIEW", "UNDER_REVIEW", "NEEDS_MORE_INFO", "INFO_REQUESTED"],
  },
  {
    id: "interview",
    title: "Interview",
    statuses: ["INTERVIEW_NEEDED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETE", "INTERVIEW_COMPLETED"],
  },
  {
    id: "final_decision",
    title: "Final decision",
    statuses: ["DECISION_NEEDED", "RECOMMENDATION_SUBMITTED"],
  },
  {
    id: "accepted_onboarding",
    title: "Accepted / onboarding",
    statuses: ["ACCEPTED", "APPROVED", "ONBOARDING", "ACTIVE_CP"],
  },
  {
    id: "declined_archived",
    title: "Declined / archived",
    statuses: ["WAITLISTED", "DECLINED", "REJECTED"],
  },
] as const;

export function cpStatusLabel(status: CPStatus): string {
  switch (status) {
    case "SUBMITTED":
      return "Submitted";
    case "INITIAL_REVIEW":
    case "UNDER_REVIEW":
      return "Initial review";
    case "NEEDS_MORE_INFO":
    case "INFO_REQUESTED":
      return "Needs more info";
    case "INTERVIEW_NEEDED":
      return "Needs interview";
    case "INTERVIEW_SCHEDULED":
      return "Interview scheduled";
    case "INTERVIEW_COMPLETE":
    case "INTERVIEW_COMPLETED":
      return "Interview complete";
    case "DECISION_NEEDED":
    case "RECOMMENDATION_SUBMITTED":
      return "Ready for decision";
    case "ACCEPTED":
    case "APPROVED":
      return "Accepted";
    case "WAITLISTED":
      return "Waitlisted";
    case "DECLINED":
    case "REJECTED":
      return "Declined";
    case "ONBOARDING":
      return "Accepted, needs onboarding";
    case "ACTIVE_CP":
      return "Active Chapter President";
    default:
      return String(status).replace(/_/g, " ").toLowerCase();
  }
}

export function cpApplicantFacingStatusLabel(status: CPStatus): string {
  switch (status) {
    case "DECISION_NEEDED":
    case "RECOMMENDATION_SUBMITTED":
      return "Under Final Review";
    case "ACCEPTED":
    case "APPROVED":
    case "ONBOARDING":
      return "Approved";
    case "ACTIVE_CP":
      return "Active Chapter President";
    case "DECLINED":
    case "REJECTED":
      return "Not Accepted";
    case "WAITLISTED":
      return "Waitlisted";
    case "NEEDS_MORE_INFO":
    case "INFO_REQUESTED":
      return "More Info Requested";
    case "INTERVIEW_NEEDED":
      return "Interview Next";
    case "INITIAL_REVIEW":
    case "UNDER_REVIEW":
      return "Under Review";
    default:
      return cpStatusLabel(status);
  }
}

/** Progress stepper index for applicant-facing CP status page. */
export function cpApplicantStageIndex(status: CPStatus): number {
  switch (String(status)) {
    case "SUBMITTED":
      return 0;
    case "INITIAL_REVIEW":
    case "UNDER_REVIEW":
    case "NEEDS_MORE_INFO":
    case "INFO_REQUESTED":
      return 1;
    case "INTERVIEW_NEEDED":
    case "INTERVIEW_SCHEDULED":
    case "INTERVIEW_COMPLETE":
    case "INTERVIEW_COMPLETED":
      return 2;
    default:
      return 3;
  }
}

export function cpPipelineLaneId(status: CPStatus): (typeof CP_PIPELINE_LANES)[number]["id"] {
  const match = CP_PIPELINE_LANES.find((lane) =>
    (lane.statuses as readonly string[]).includes(String(status))
  );
  return match?.id ?? "initial_review";
}

export function isFinalCPStatus(status: CPStatus): boolean {
  return ["WAITLISTED", "DECLINED", "REJECTED", "ACTIVE_CP"].includes(String(status));
}

export function isAcceptedCPStatus(status: CPStatus): boolean {
  return ["ACCEPTED", "APPROVED", "ONBOARDING", "ACTIVE_CP"].includes(String(status));
}

export function cpMissingRequirements(app: CPApplicantLifecycleInput): string[] {
  const status = String(app.status);
  const missing: string[] = [];

  if (!app.reviewerId && !["SUBMITTED", "WAITLISTED", "DECLINED", "REJECTED", "ACTIVE_CP"].includes(status)) {
    missing.push("Needs reviewer");
  }

  if (["INTERVIEW_COMPLETE", "INTERVIEW_COMPLETED", "DECISION_NEEDED", "RECOMMENDATION_SUBMITTED"].includes(status)) {
    if (!app.interviewNotes && !app.interviewSummary) missing.push("Needs interview notes");
  }

  if (["DECISION_NEEDED", "RECOMMENDATION_SUBMITTED"].includes(status)) {
    if (!app.decisionAt || !app.decisionMakerId) missing.push("Needs final decision");
  }

  if (["ACCEPTED", "APPROVED", "ONBOARDING"].includes(status)) {
    missing.push("Needs onboarding");
    if (!app.linkedPersonId) missing.push("Needs linked person record");
    if (!app.starterActionsCreatedAt) missing.push("Needs first chapter launch actions");
  }

  return missing;
}

export function cpNextAction(app: CPApplicantLifecycleInput): string {
  const status = String(app.status);
  const missing = cpMissingRequirements(app);
  if (missing.length > 0) return missing[0];

  switch (status) {
    case "SUBMITTED":
      return "Begin initial review";
    case "INITIAL_REVIEW":
    case "UNDER_REVIEW":
      return "Complete review";
    case "NEEDS_MORE_INFO":
    case "INFO_REQUESTED":
      return "Wait for applicant response";
    case "INTERVIEW_NEEDED":
      return "Schedule interview";
    case "INTERVIEW_SCHEDULED":
      return app.interviewScheduledAt ? "Complete interview notes" : "Collect interview availability";
    case "INTERVIEW_COMPLETE":
    case "INTERVIEW_COMPLETED":
      return "Send to decision";
    case "DECISION_NEEDED":
    case "RECOMMENDATION_SUBMITTED":
      return "Make final decision";
    case "ACCEPTED":
    case "APPROVED":
    case "ONBOARDING":
      return "Finish onboarding";
    case "WAITLISTED":
      return "Waitlisted";
    case "DECLINED":
    case "REJECTED":
      return "Archived";
    case "ACTIVE_CP":
      return "Active Chapter President";
    default:
      return "Review applicant";
  }
}

export function cpStrongestSignal(app: {
  whyChapterPresident?: string | null;
  leadershipExperience?: string | null;
  communityServiceExperience?: string | null;
  recruitmentPlan?: string | null;
  launchPlan?: string | null;
  chapterVision?: string | null;
}): string {
  const signal =
    app.whyChapterPresident ||
    app.leadershipExperience ||
    app.communityServiceExperience ||
    app.recruitmentPlan ||
    app.launchPlan ||
    app.chapterVision ||
    "Application submitted";

  const compact = signal.replace(/\s+/g, " ").trim();
  return compact.length > 150 ? `${compact.slice(0, 147)}...` : compact;
}
