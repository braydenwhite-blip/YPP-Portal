/**
 * Shared board helpers for unioning instructor + chapter-president + staff
 * applicants onto one kanban (same columns as the instructor pipeline).
 */

import { TECHNOLOGY_MANAGER_POSITION_TITLE } from "@/lib/technology-manager-application";

/** Legacy staff opening — never shown on the unified applicants board. */
export const HIDDEN_STAFF_POSITION_TITLES = new Set(["social media manager"]);

export function isHiddenStaffPositionTitle(title: string | null | undefined): boolean {
  return HIDDEN_STAFF_POSITION_TITLES.has((title ?? "").trim().toLowerCase());
}

/** Staff openings that appear on the Application board (Technology Manager). */
export function isBoardStaffPositionTitle(title: string | null | undefined): boolean {
  return (title ?? "").trim().toLowerCase() === TECHNOLOGY_MANAGER_POSITION_TITLE.toLowerCase();
}

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

/** Map a generic Application (staff) status onto board columns. */
export function mapStaffStatusToBoardStatus(status: string): string {
  switch (status) {
    case "SUBMITTED":
      return "SUBMITTED";
    case "UNDER_REVIEW":
      return "UNDER_REVIEW";
    case "INTERVIEW_SCHEDULED":
      return "INTERVIEW_SCHEDULED";
    case "INTERVIEW_COMPLETED":
      return "INTERVIEW_COMPLETED";
    case "ACCEPTED":
      return "APPROVED";
    case "WAITLISTED":
      return "WAITLISTED";
    case "REJECTED":
    case "WITHDRAWN":
      return "REJECTED";
    default:
      return "SUBMITTED";
  }
}

/**
 * Applicants board = people already pulled off the hire waitlist into
 * interviews / chair / decided. Waitlist-pool statuses stay on Waitlist.
 */
const ACTIVE_BOARD_STATUSES = new Set([
  "PRE_APPROVED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_SCHEDULED_READY",
  "INTERVIEW_COMPLETED",
  "CHAIR_REVIEW",
  "APPROVED",
  "REJECTED",
]);

export function isActiveHiringBoardStatus(status: string | null | undefined): boolean {
  return ACTIVE_BOARD_STATUSES.has((status ?? "").trim());
}

export type ApplicantBoardKind = "instructor" | "cp" | "staff";

export type ApplicantKindFilter = "all" | ApplicantBoardKind;

export function applicantDetailHref(kind: ApplicantBoardKind, id: string): string {
  if (kind === "cp") return `/admin/chapter-president-applicants/${id}`;
  if (kind === "staff") return `/applications/${id}`;
  return `/admin/instructor-applicants/${id}`;
}

export function parseApplicantKindFilter(
  raw: string | string[] | undefined
): ApplicantKindFilter {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
  if (value === "cp" || value === "chapter_president" || value === "chapter-president") {
    return "cp";
  }
  if (value === "instructor" || value === "instructors") {
    return "instructor";
  }
  if (
    value === "staff" ||
    value === "technology_manager" ||
    value === "technology-manager" ||
    value === "tech_manager" ||
    value === "social_media_manager" ||
    value === "social-media-manager" ||
    value === "smm"
  ) {
    return "staff";
  }
  return "all";
}
