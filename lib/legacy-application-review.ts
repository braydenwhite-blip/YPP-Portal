export type LegacyApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INFO_REQUESTED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_COMPLETED"
  | "APPROVED"
  | "REJECTED";

export type LegacyApplicationReviewAction =
  | "mark_under_review"
  | "request_info"
  | "schedule_interview"
  | "mark_interview_complete"
  | "approve"
  | "reject";

function isFinalStatus(status: LegacyApplicationStatus) {
  return status === "APPROVED" || status === "REJECTED";
}

export function getLegacyApplicationTransitionError(input: {
  status: LegacyApplicationStatus;
  action: LegacyApplicationReviewAction;
}) {
  const { status, action } = input;

  if (isFinalStatus(status)) {
    return "This application is already finalized.";
  }

  switch (action) {
    case "mark_under_review":
      return status === "SUBMITTED"
        ? null
        : "Only newly submitted applications can move into review.";
    case "request_info":
      return null;
    case "schedule_interview":
      return status === "INTERVIEW_COMPLETED"
        ? "Completed interviews cannot be rescheduled from this legacy flow."
        : null;
    case "mark_interview_complete":
      return status === "INTERVIEW_SCHEDULED"
        ? null
        : "Only scheduled interviews can be marked complete.";
    case "approve":
      return status === "INTERVIEW_COMPLETED"
        ? null
        : "Complete the interview before approving this application.";
    case "reject":
      return null;
    default:
      return "Unknown review action.";
  }
}
