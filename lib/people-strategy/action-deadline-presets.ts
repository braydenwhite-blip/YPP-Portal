import {
  addDays,
  endOfOperatingWeek,
  formatMonthDay,
  formatWeekdayShort,
  startOfDay,
  toDateInputValue,
} from "@/lib/leadership-action-center/dates";

export type ActionDeadlinePresetId = "today" | "tomorrow" | "this-week";

export const ACTION_DEADLINE_PRESETS: Array<{ id: ActionDeadlinePresetId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this-week", label: "This week" },
];

/** Map a quick-pick label to the canonical due date for that timeframe. */
export function resolveActionDeadlinePreset(
  id: ActionDeadlinePresetId,
  now: Date = new Date()
): Date {
  const today = startOfDay(now);
  switch (id) {
    case "today":
      return today;
    case "tomorrow":
      return addDays(today, 1);
    case "this-week":
      // Operating week is Mon–Sun; "this week" means due by Sunday, not +7 days.
      return startOfDay(endOfOperatingWeek(now));
  }
}

export function actionDeadlinePresetValue(
  id: ActionDeadlinePresetId,
  now: Date = new Date()
): string {
  return toDateInputValue(resolveActionDeadlinePreset(id, now));
}

/** Which preset (if any) matches the current date input value. */
export function matchActionDeadlinePreset(
  deadlineValue: string,
  now: Date = new Date()
): ActionDeadlinePresetId | null {
  if (!deadlineValue) return null;
  for (const preset of ACTION_DEADLINE_PRESETS) {
    if (actionDeadlinePresetValue(preset.id, now) === deadlineValue) {
      return preset.id;
    }
  }
  return null;
}

/** Human hint shown under the due field when a timeframe preset is active. */
export function actionDeadlinePresetHint(
  id: ActionDeadlinePresetId,
  now: Date = new Date()
): string | null {
  if (id === "this-week") {
    const end = resolveActionDeadlinePreset("this-week", now);
    return `Due anytime this week — by ${formatWeekdayShort(end)}, ${formatMonthDay(end)}`;
  }
  if (id === "today") return "Due today";
  if (id === "tomorrow") return "Due tomorrow";
  return null;
}
