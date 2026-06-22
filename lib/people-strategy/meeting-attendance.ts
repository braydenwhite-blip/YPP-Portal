/**
 * Meetings Tracker - attendance vocabulary.
 *
 * Stored as strings on MeetingAttendee instead of a Prisma enum because this is
 * meeting-specific attendance, not class attendance. Keeping it here gives the
 * UI, server actions, and tests one source of truth.
 */

export const MEETING_ATTENDANCE_ROLE_VALUES = ["REQUIRED", "OPTIONAL"] as const;

export type MeetingAttendanceRole = (typeof MEETING_ATTENDANCE_ROLE_VALUES)[number];

export const MEETING_ATTENDANCE_STATUS_VALUES = [
  "REQUIRED",
  "OPTIONAL",
  "PRESENT",
  "ABSENT",
  "EXCUSED",
  "LATE",
  "DID_NOT_RESPOND",
  "RESCHEDULED",
  "FOLLOW_UP_NEEDED",
] as const;

export type MeetingAttendanceStatus = (typeof MEETING_ATTENDANCE_STATUS_VALUES)[number];

export const MEETING_ATTENDANCE_STATUS_LABELS: Record<MeetingAttendanceStatus, string> = {
  REQUIRED: "Required",
  OPTIONAL: "Optional",
  PRESENT: "Present",
  ABSENT: "Absent",
  EXCUSED: "Excused",
  LATE: "Late",
  DID_NOT_RESPOND: "Did not respond",
  RESCHEDULED: "Rescheduled",
  FOLLOW_UP_NEEDED: "Follow-up needed",
};

export function isMeetingAttendanceStatus(value: unknown): value is MeetingAttendanceStatus {
  return (
    typeof value === "string" &&
    (MEETING_ATTENDANCE_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export function normalizeMeetingAttendanceStatus(
  value: string | null | undefined
): MeetingAttendanceStatus {
  const normalized = value?.trim().toUpperCase();
  return isMeetingAttendanceStatus(normalized) ? normalized : "REQUIRED";
}

export function meetingAttendanceStatusLabel(value: string | null | undefined): string {
  const status = normalizeMeetingAttendanceStatus(value);
  return MEETING_ATTENDANCE_STATUS_LABELS[status];
}
