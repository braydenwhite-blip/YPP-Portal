/**
 * Date helpers for the Leadership Action Center. The "operating week" runs
 * Monday → Sunday so the weekly digest matches how the leadership team
 * actually plans (most weekly emails go out Sunday/Monday morning).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Monday 00:00 of the week containing `date` (local time). */
export function startOfOperatingWeek(date: Date): Date {
  const d = startOfDay(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday … 6 = Saturday
  const offsetToMonday = (dayOfWeek + 6) % 7; // Mon=0, Sun=6
  d.setDate(d.getDate() - offsetToMonday);
  return d;
}

/** Sunday 23:59:59.999 of the week containing `date`. */
export function endOfOperatingWeek(date: Date): Date {
  const start = startOfOperatingWeek(date);
  return endOfDay(addDays(start, 6));
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isOverdue(dueDate: Date | null | undefined, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  return dueDate.getTime() < startOfDay(now).getTime();
}

export function isDueToday(dueDate: Date | null | undefined, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  return isSameDay(dueDate, now);
}

export function isDueThisWeek(
  dueDate: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!dueDate) return false;
  const start = startOfOperatingWeek(now).getTime();
  const end = endOfOperatingWeek(now).getTime();
  const due = dueDate.getTime();
  return due >= start && due <= end;
}

export function daysUntil(dueDate: Date | null | undefined, now: Date = new Date()): number | null {
  if (!dueDate) return null;
  const start = startOfDay(now).getTime();
  const due = startOfDay(dueDate).getTime();
  return Math.round((due - start) / MS_PER_DAY);
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const WEEKDAY_SHORT_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const MONTH_DAY_YEAR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatWeekday(date: Date): string {
  return WEEKDAY_FORMATTER.format(date);
}

export function formatWeekdayShort(date: Date): string {
  return WEEKDAY_SHORT_FORMATTER.format(date);
}

export function formatMonthDay(date: Date): string {
  return MONTH_DAY_FORMATTER.format(date);
}

export function formatMonthDayYear(date: Date): string {
  return MONTH_DAY_YEAR_FORMATTER.format(date);
}

export function formatDueDate(date: Date | null | undefined): string {
  if (!date) return "No deadline";
  return MONTH_DAY_FORMATTER.format(date);
}

export function formatDueDateLong(date: Date | null | undefined): string {
  if (!date) return "No deadline";
  return `${WEEKDAY_FORMATTER.format(date)}, ${MONTH_DAY_YEAR_FORMATTER.format(date)}`;
}

/** Inclusive list of dates from `start` to `end`. */
export function eachDayBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor.getTime() <= last.getTime()) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * Parses a YYYY-MM-DD style string into a local Date at midnight. Returns
 * null if the input doesn't match. Used by the `<input type="date">` form
 * fields so the Date in the DB matches what the admin typed.
 */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return startOfDay(parsed);
  }
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10) - 1;
  const day = Number.parseInt(dayStr, 10);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Format a Date for use as the `value` of an `<input type="date">`. */
export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
