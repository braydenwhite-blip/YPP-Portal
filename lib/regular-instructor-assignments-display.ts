/**
 * Display helpers for regular instructor assignments. Lives outside the
 * "use server" module so it can be imported from client components and
 * used as a sync formatter.
 */

export const ASSIGNMENT_ROLES = [
  "LEAD",
  "CO_INSTRUCTOR",
  "ASSISTANT",
  "BACKUP",
] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

export const ASSIGNMENT_STATUSES = [
  "SUGGESTED",
  "PENDING_REVIEW",
  "OFFERED",
  "INSTRUCTOR_CONFIRMED",
  "CHAPTER_CONFIRMED",
  "FULLY_CONFIRMED",
  "NEEDS_TRAINING",
  "NEEDS_CURRICULUM",
  "DECLINED",
  "REMOVED",
  "COMPLETED",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

const ROLE_LABELS: Record<string, string> = {
  LEAD: "Lead instructor",
  CO_INSTRUCTOR: "Co-instructor",
  ASSISTANT: "Assistant",
  BACKUP: "Backup",
};

const STATUS_LABELS: Record<string, string> = {
  SUGGESTED: "Suggested",
  PENDING_REVIEW: "Pending review",
  OFFERED: "Offered to instructor",
  INSTRUCTOR_CONFIRMED: "Instructor confirmed",
  CHAPTER_CONFIRMED: "Chapter confirmed",
  FULLY_CONFIRMED: "Fully confirmed",
  NEEDS_TRAINING: "Blocked: training",
  NEEDS_CURRICULUM: "Blocked: curriculum",
  DECLINED: "Declined",
  REMOVED: "Removed",
  COMPLETED: "Completed",
};

const STATUS_TONES: Record<string, "neutral" | "good" | "warn" | "bad"> = {
  SUGGESTED: "neutral",
  PENDING_REVIEW: "neutral",
  OFFERED: "warn",
  INSTRUCTOR_CONFIRMED: "warn",
  CHAPTER_CONFIRMED: "warn",
  FULLY_CONFIRMED: "good",
  NEEDS_TRAINING: "warn",
  NEEDS_CURRICULUM: "warn",
  DECLINED: "bad",
  REMOVED: "bad",
  COMPLETED: "good",
};

export function formatAssignmentRole(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function formatAssignmentStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function assignmentStatusTone(
  status: string
): "neutral" | "good" | "warn" | "bad" {
  return STATUS_TONES[status] ?? "neutral";
}
