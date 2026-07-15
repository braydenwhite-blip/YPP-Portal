// Student-facing plain-language labels for enums used across the student and
// parent portals. Keep this the single source of truth so raw enum values
// never leak into UI copy.

export const CLASS_ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  ENROLLED: "Enrolled",
  WAITLISTED: "On the waitlist",
  DROPPED: "Not currently enrolled",
  COMPLETED: "Completed",
};

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
};

export const FAMILY_WAITLIST_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "On the waitlist",
  LEFT: "Left the waitlist",
  OFFERED: "Offer to enroll — action needed",
  ACCEPTED: "Offer accepted",
  DECLINED: "Offer declined",
  EXPIRED: "Offer expired",
  REMOVED: "Removed from waitlist",
};

export const FAMILY_SUPPORT_STATUS_LABELS: Record<string, string> = {
  SENT: "Sent — awaiting review",
  REVIEWING: "Being reviewed",
  NEED_MORE_INFORMATION: "More information needed",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const FAMILY_FORM_REQUIREMENT_STATUS_LABELS: Record<string, string> = {
  REQUIRED: "Needs to be completed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  SUPERSEDED: "Replaced by a newer form",
  WAIVED: "Waived",
};

export const GUARDIAN_APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "Waiting on a parent or guardian",
  APPROVED: "Approved",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
};

function labelFrom(map: Record<string, string>, value?: string | null, fallback = "Status pending") {
  if (!value) return fallback;
  return map[value] ?? value
    .toString()
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ACTION_ITEM_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETE: "Complete",
  OVERDUE: "Overdue",
  BLOCKED: "Blocked",
  DROPPED: "Dropped",
};

export const CLASS_ANNOUNCEMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Sent for approval",
  PUBLISHED: "Published",
  REJECTED: "Not approved",
};

export const classEnrollmentStatusLabel = (v?: string | null) => labelFrom(CLASS_ENROLLMENT_STATUS_LABELS, v);
export const actionItemStatusLabel = (v?: string | null) => labelFrom(ACTION_ITEM_STATUS_LABELS, v);
export const classAnnouncementStatusLabel = (v?: string | null) => labelFrom(CLASS_ANNOUNCEMENT_STATUS_LABELS, v);
export const attendanceStatusLabel = (v?: string | null) => labelFrom(ATTENDANCE_STATUS_LABELS, v);
export const familyWaitlistStatusLabel = (v?: string | null) => labelFrom(FAMILY_WAITLIST_STATUS_LABELS, v);
export const familySupportStatusLabel = (v?: string | null) => labelFrom(FAMILY_SUPPORT_STATUS_LABELS, v);
export const familyFormRequirementStatusLabel = (v?: string | null) => labelFrom(FAMILY_FORM_REQUIREMENT_STATUS_LABELS, v);
export const guardianApprovalStatusLabel = (v?: string | null) => labelFrom(GUARDIAN_APPROVAL_STATUS_LABELS, v);
