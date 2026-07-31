import { formatMeetingTimeRange } from "@/lib/class-meeting-time";

/**
 * Shared helper for offering schedule lines.
 *   Friday · 16:00-17:00 → Friday · 4–5 pm EST
 */
export function formatClassScheduleLabel(input: {
  meetingDays: string[];
  meetingTime: string | null | undefined;
  timezone?: string | null;
  emptyDaysLabel?: string;
  emptyScheduleLabel?: string;
}): string {
  const days =
    input.meetingDays.length > 0
      ? input.meetingDays.join(", ")
      : (input.emptyDaysLabel ?? "Schedule not set");
  const time = formatMeetingTimeRange(input.meetingTime, input.timezone);
  if (!time) {
    return input.meetingDays.length === 0
      ? (input.emptyScheduleLabel ?? days)
      : days;
  }
  return `${days} · ${time}`;
}
