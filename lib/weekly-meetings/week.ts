/**
 * Reporting-week helpers for Weekly Meetings.
 *
 * A "week" is keyed by its Monday at 00:00:00.000 UTC. The Weekly Impact form,
 * the meeting's reporting `weekStart`, and the Impact Presentations join all use
 * this same key so a submitted form lines up with the meeting that reads it.
 */

const MS_PER_DAY = 86_400_000;

/** Monday 00:00:00.000 UTC of the week containing `date` (default: now). */
export function weekStartFor(date: Date = new Date()): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // getUTCDay: 0=Sun..6=Sat. Shift so Monday is the first day.
  const dow = d.getUTCDay();
  const deltaToMonday = (dow + 6) % 7;
  return new Date(d.getTime() - deltaToMonday * MS_PER_DAY);
}

/** End of the reporting week (Sunday 23:59:59.999 UTC) for a given weekStart. */
export function weekEndFor(weekStart: Date): Date {
  return new Date(weekStart.getTime() + 7 * MS_PER_DAY - 1);
}

/** Parse a `YYYY-MM-DD` week key into a normalized weekStart, or null. */
export function parseWeekKey(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return weekStartFor(parsed);
}

/** `YYYY-MM-DD` key for a weekStart (stable URL/query key). */
export function weekKey(weekStart: Date): string {
  return weekStart.toISOString().slice(0, 10);
}

/** Human label, e.g. "Week of Jun 23, 2026". */
export function weekLabel(weekStart: Date): string {
  return `Week of ${weekStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}
