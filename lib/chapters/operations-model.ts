const DAY = 86_400_000;

export function reportingPeriod(now: Date, type: "WEEKLY" | "MONTHLY") {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  if (type === "WEEKLY") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  else start.setUTCDate(1);
  const end = new Date(type === "WEEKLY" ? start.getTime() + 7 * DAY : Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end };
}

export function eightWeekBuckets(now: Date) {
  const current = reportingPeriod(now, "WEEKLY").start;
  return Array.from({ length: 8 }, (_, index) => {
    const start = new Date(current.getTime() - (7 - index) * 7 * DAY);
    return { start, end: new Date(start.getTime() + 7 * DAY), label: start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) };
  });
}

export function attainmentPercent(actual: number, target: number) {
  return target > 0 ? Math.round((actual / target) * 100) : 0;
}

export function formatReportingPeriod(start: Date, exclusiveEnd: Date) {
  const inclusiveEnd = new Date(exclusiveEnd.getTime() - DAY);
  const sameYear = start.getUTCFullYear() === inclusiveEnd.getUTCFullYear();
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" as const }),
    timeZone: "UTC",
  });
  const endLabel = inclusiveEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${startLabel} – ${endLabel}`;
}
