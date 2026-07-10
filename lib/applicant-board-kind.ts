/**
 * Shared board helpers for unioning instructor + chapter-president applicants
 * onto one kanban (same columns as the instructor pipeline).
 */

/** Map a CP application status onto an instructor-board column status. */
export function mapCpStatusToBoardStatus(status: string): string {
  switch (status) {
    case "SUBMITTED":
      return "SUBMITTED";
    case "INITIAL_REVIEW":
    case "UNDER_REVIEW":
      return "UNDER_REVIEW";
    case "NEEDS_MORE_INFO":
    case "INFO_REQUESTED":
      return "INFO_REQUESTED";
    case "INTERVIEW_NEEDED":
      return "PRE_APPROVED";
    case "INTERVIEW_SCHEDULED":
      return "INTERVIEW_SCHEDULED";
    case "INTERVIEW_COMPLETE":
    case "INTERVIEW_COMPLETED":
      return "INTERVIEW_COMPLETED";
    case "DECISION_NEEDED":
    case "RECOMMENDATION_SUBMITTED":
      return "CHAIR_REVIEW";
    case "ACCEPTED":
    case "APPROVED":
    case "ONBOARDING":
    case "ACTIVE_CP":
      return "APPROVED";
    case "WAITLISTED":
      return "WAITLISTED";
    case "DECLINED":
    case "REJECTED":
      return "REJECTED";
    case "ON_HOLD":
      return "ON_HOLD";
    default:
      return "SUBMITTED";
  }
}

export type ApplicantBoardKind = "instructor" | "cp";

export function applicantDetailHref(kind: ApplicantBoardKind, id: string): string {
  return kind === "cp"
    ? `/admin/chapter-president-applicants/${id}`
    : `/admin/instructor-applicants/${id}`;
}

export function parseApplicantKindFilter(
  raw: string | string[] | undefined
): "both" | ApplicantBoardKind {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
  if (value === "cp" || value === "chapter_president" || value === "chapter-president") {
    return "cp";
  }
  if (value === "instructor" || value === "instructors") {
    return "instructor";
  }
  return "both";
}
