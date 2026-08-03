/**
 * Parse `YYYY-MM-DDTHH:mm` as America/New_York wall time → UTC Date.
 * YPP’s operational timezone is Eastern (EST/EDT).
 */
export function easternLocalToUtc(local: string): Date {
  const match = local.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error("Use a date and time in Eastern Time (YYYY-MM-DDTHH:mm).");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  // Iterate: guess UTC, read New York wall clock, correct the delta.
  let guessMs = Date.UTC(year, month - 1, day, hour + 5, minute);
  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guessMs));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN);
    const asNy = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") === 24 ? 0 : get("hour"),
      get("minute"),
    );
    const wanted = Date.UTC(year, month - 1, day, hour, minute);
    guessMs += wanted - asNy;
  }
  return new Date(guessMs);
}

export function formatEasternDateTime(isoOrDate: string | Date | null | undefined) {
  if (!isoOrDate) return null;
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
