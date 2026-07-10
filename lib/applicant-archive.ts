/**
 * Shared archive reason codes for instructor + CP applicant boards.
 * Stored on the application row; shown in the Archive tab.
 */

export const APPLICANT_ARCHIVE_REASONS = {
  INACTIVE_14D: "INACTIVE_14D",
  REJECTED: "REJECTED",
  APPROVED: "APPROVED",
  WITHDRAWN: "WITHDRAWN",
  WAITLISTED: "WAITLISTED",
  ON_HOLD: "ON_HOLD",
  MANUAL: "MANUAL",
  TERMINAL_30D: "TERMINAL_30D",
} as const;

export type ApplicantArchiveReason =
  (typeof APPLICANT_ARCHIVE_REASONS)[keyof typeof APPLICANT_ARCHIVE_REASONS];

export const APPLICANT_ARCHIVE_REASON_LABELS: Record<string, string> = {
  INACTIVE_14D: "Inactive (no activity for 14 days)",
  REJECTED: "Rejected",
  APPROVED: "Approved",
  WITHDRAWN: "Withdrawn",
  WAITLISTED: "Waitlisted",
  ON_HOLD: "On hold",
  MANUAL: "Manually archived",
  TERMINAL_30D: "Auto-archived after final decision",
};

/** Open statuses where applicant silence should trigger inactivity nudges + archive. */
export const INSTRUCTOR_INACTIVITY_STATUSES = [
  "SUBMITTED",
  "INFO_REQUESTED",
  "PRE_APPROVED",
  "INTERVIEW_SCHEDULED",
] as const;

export const CP_INACTIVITY_STATUSES = [
  "SUBMITTED",
  "NEEDS_MORE_INFO",
  "INFO_REQUESTED",
  "INTERVIEW_NEEDED",
  "INTERVIEW_SCHEDULED",
] as const;

export const INACTIVITY_ARCHIVE_DAYS = 14;
/** Reminder cadence before archive (emails stubbed for now). */
export const INACTIVITY_NUDGE_DAYS = [3, 7, 14] as const;

export function archiveReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Archived";
  return APPLICANT_ARCHIVE_REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}

/** Infer a display reason when older rows have no archiveReason stored. */
export function deriveArchiveReason(input: {
  archiveReason?: string | null;
  status: string;
  chairAction?: string | null;
}): string {
  if (input.archiveReason) return input.archiveReason;
  if (input.status === "REJECTED" || input.chairAction === "REJECT") {
    return APPLICANT_ARCHIVE_REASONS.REJECTED;
  }
  if (input.status === "APPROVED" || input.chairAction === "APPROVE" || input.chairAction === "APPROVE_WITH_CONDITIONS") {
    return APPLICANT_ARCHIVE_REASONS.APPROVED;
  }
  if (input.status === "WITHDRAWN") return APPLICANT_ARCHIVE_REASONS.WITHDRAWN;
  if (input.status === "WAITLISTED" || input.chairAction === "WAITLIST") {
    return APPLICANT_ARCHIVE_REASONS.WAITLISTED;
  }
  if (input.status === "ON_HOLD" || input.chairAction === "HOLD") {
    return APPLICANT_ARCHIVE_REASONS.ON_HOLD;
  }
  return APPLICANT_ARCHIVE_REASONS.MANUAL;
}

export function terminalArchiveReasonForStatus(status: string): ApplicantArchiveReason {
  switch (status) {
    case "REJECTED":
    case "DECLINED":
      return APPLICANT_ARCHIVE_REASONS.REJECTED;
    case "APPROVED":
    case "ACCEPTED":
    case "ONBOARDING":
    case "ACTIVE_CP":
      return APPLICANT_ARCHIVE_REASONS.APPROVED;
    case "WITHDRAWN":
      return APPLICANT_ARCHIVE_REASONS.WITHDRAWN;
    case "WAITLISTED":
      return APPLICANT_ARCHIVE_REASONS.WAITLISTED;
    default:
      return APPLICANT_ARCHIVE_REASONS.TERMINAL_30D;
  }
}

/**
 * Stub for inactivity warning emails (day 3 / 7 / last day).
 * Wire real templates here later — cron still advances nudge stage.
 */
export async function sendInactivityNudgeEmailStub(_input: {
  kind: "instructor" | "cp";
  applicationId: string;
  email: string;
  displayName: string;
  nudgeDay: number;
  daysUntilArchive: number;
}): Promise<void> {
  // Emails intentionally not sent yet — see product note on day 3 / 7 / 14 cadence.
}
