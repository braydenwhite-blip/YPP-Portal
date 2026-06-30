/**
 * Business-day follow-up scheduling for the Chapter Partner CRM.
 *
 * Pure + dependency-free (no prisma, no `server-only`) so it can be shared by
 * server actions, server components, client components, and unit tests.
 *
 * The Chapter President guide drives the cadence:
 *  - initial outreach   → follow up in 5 business days
 *  - after a meeting     → follow up within ~24h (1 business day)
 *  - a partner is "follow-up due" once `nextFollowUpAt` is in the past.
 *
 * All arithmetic uses UTC day-of-week so the result is independent of the
 * machine timezone (the rest of the portal keys reporting weeks off UTC too —
 * see lib/weekly-meetings/week.ts).
 */

/** Default business-day gap for an initial / standard outreach follow-up. */
export const INITIAL_FOLLOW_UP_BUSINESS_DAYS = 5;

/** Default business-day gap for a post-meeting follow-up ("within 24 hours"). */
export const MEETING_FOLLOW_UP_BUSINESS_DAYS = 1;

/** Default business-day gap when chasing a partner who has gone quiet. */
export const FINAL_DECISION_FOLLOW_UP_BUSINESS_DAYS = 3;

/** Saturday (6) or Sunday (0) in UTC. */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Add `businessDays` weekdays to `from`, skipping Saturdays and Sundays.
 * Counting starts from the day *after* `from`, so:
 *   - Monday  + 5 → the next Monday
 *   - Friday  + 5 → the next Friday
 *   - Friday  + 1 → the following Monday
 * The time-of-day is preserved. A non-positive count returns a copy of `from`.
 */
export function addBusinessDays(from: Date, businessDays: number): Date {
  const result = new Date(from.getTime());
  if (!Number.isFinite(businessDays) || businessDays <= 0) return result;

  let added = 0;
  while (added < businessDays) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!isWeekend(result)) added += 1;
  }
  return result;
}

/** Count of business days strictly between `start` and `end` (end exclusive). */
export function businessDaysBetween(start: Date, end: Date): number {
  if (end.getTime() <= start.getTime()) return 0;
  const cursor = new Date(start.getTime());
  let count = 0;
  while (true) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getTime() > end.getTime()) break;
    if (!isWeekend(cursor)) count += 1;
  }
  return count;
}

/** The next follow-up date for a fresh outreach (5 business days out). */
export function nextOutreachFollowUp(now: Date): Date {
  return addBusinessDays(now, INITIAL_FOLLOW_UP_BUSINESS_DAYS);
}

/** The next follow-up date after a meeting (1 business day — "within 24h"). */
export function nextMeetingFollowUp(now: Date): Date {
  return addBusinessDays(now, MEETING_FOLLOW_UP_BUSINESS_DAYS);
}

/**
 * A partner is "follow-up due" when a follow-up was scheduled and that moment
 * has arrived or passed. Null `nextFollowUpAt` means nothing is scheduled, so
 * it is never "due" (the surface that needs a next step flags that separately).
 */
export function isFollowUpDue(
  nextFollowUpAt: Date | null | undefined,
  now: Date
): boolean {
  return !!nextFollowUpAt && nextFollowUpAt.getTime() <= now.getTime();
}

/** Whole days a follow-up is overdue (0 if not yet due / not scheduled). */
export function daysOverdue(
  nextFollowUpAt: Date | null | undefined,
  now: Date
): number {
  if (!isFollowUpDue(nextFollowUpAt, now)) return 0;
  const ms = now.getTime() - (nextFollowUpAt as Date).getTime();
  return Math.floor(ms / 86_400_000);
}
