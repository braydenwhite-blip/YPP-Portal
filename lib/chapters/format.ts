// Pure, deterministic formatting helpers for the Chapter Operating System's
// "Deliberable" evidence tables. Kept free of locale/timezone surprises (fixed
// UTC month names, `now` passed in) so they are fully unit-testable and render
// identically on the server and the client.

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Human "time ago" for an evidence row's last-contact / applied column. */
export function relativeAgo(date: Date | null | undefined, now: Date): string {
  if (!date) return "—";
  const ms = now.getTime() - date.getTime();
  if (ms < 0) return "Just now";
  const days = Math.floor(ms / DAY_MS);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/** Stable "Jun 15, 2025" date for a launch-date column (UTC, no locale drift). */
export function shortDate(date: Date | null | undefined): string {
  if (!date) return "TBD";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}
