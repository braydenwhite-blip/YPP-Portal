/**
 * Shared board helpers for unioning instructor + chapter-president + staff
 * applicants onto one kanban (same columns as the instructor pipeline).
 */

import { SOCIAL_MEDIA_MANAGER_POSITION_TITLE } from "@/lib/social-media-manager-application";

/** Legacy staff opening — never shown on the unified applicants board. */
export const HIDDEN_STAFF_POSITION_TITLES = new Set(["technology manager"]);

export function isHiddenStaffPositionTitle(title: string | null | undefined): boolean {
  return HIDDEN_STAFF_POSITION_TITLES.has((title ?? "").trim().toLowerCase());
}

/** Staff openings that appear on the Application board (SMM only for now). */
export function isBoardStaffPositionTitle(title: string | null | undefined): boolean {
  return (title ?? "").trim() === SOCIAL_MEDIA_MANAGER_POSITION_TITLE;
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
    case "REJECTED":
    case "WITHDRAWN":
      return "REJECTED";
    default:
      return "SUBMITTED";
  }
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
    value === "social_media_manager" ||
    value === "social-media-manager" ||
    value === "smm"
  ) {
    return "staff";
  }
  return "all";
}
