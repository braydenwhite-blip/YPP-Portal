import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isProvisionalClockEnabled } from "@/lib/feature-flags";

/**
 * People Strategy — provisional 3-month confirmation clock
 * (ENABLE_PROVISIONAL_CLOCK).
 *
 * A newly confirmed hire enters a 3-month (90-day) provisional period. At
 * Month 3 a confirmation decision is surfaced via the existing Quarterly Review
 * workflow; confirming clears the provisional state. This module holds the
 * pure clock math (shared by UI + tests), the small tx helpers that the
 * existing applicant→hire flow calls to start/clear the clock, and a read-only
 * loader. No new hire/onboarding framework is introduced — these helpers hook
 * into the existing `chairDecide` / `approveInstructorApplication` flow.
 */

/** Length of the provisional period before the Month-3 confirmation review. */
export const PROVISIONAL_WINDOW_DAYS = 90;

const DAY_MS = 86_400_000;

export interface ProvisionalStatus {
  /** True while a hire is within (or past) the provisional window, unconfirmed. */
  isProvisional: boolean;
  /** True once senior leadership / Board has confirmed the hire. */
  confirmed: boolean;
  startDate: Date | null;
  confirmedAt: Date | null;
  /** Date the Month-3 confirmation review is due (start + 90 days). */
  monthThreeDate: Date | null;
  /** Whole days remaining until the Month-3 review (negative once overdue). */
  daysRemaining: number | null;
  /** True once the provisional window has elapsed (Month-3 review is due). */
  atMonthThree: boolean;
  /** 0–100 progress through the provisional window, for a progress bar. */
  percentElapsed: number;
}

/** Pure clock math from the two stored timestamps. */
export function computeProvisionalStatus(
  provisionalStart: Date | null,
  provisionalConfirmedAt: Date | null,
  now: Date = new Date()
): ProvisionalStatus {
  if (provisionalConfirmedAt) {
    return {
      isProvisional: false,
      confirmed: true,
      startDate: provisionalStart,
      confirmedAt: provisionalConfirmedAt,
      monthThreeDate: null,
      daysRemaining: null,
      atMonthThree: false,
      percentElapsed: 100,
    };
  }

  if (!provisionalStart) {
    return {
      isProvisional: false,
      confirmed: false,
      startDate: null,
      confirmedAt: null,
      monthThreeDate: null,
      daysRemaining: null,
      atMonthThree: false,
      percentElapsed: 0,
    };
  }

  const monthThreeDate = new Date(
    provisionalStart.getTime() + PROVISIONAL_WINDOW_DAYS * DAY_MS
  );
  const msRemaining = monthThreeDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / DAY_MS);
  const elapsedMs = now.getTime() - provisionalStart.getTime();
  const percentElapsed = Math.max(
    0,
    Math.min(100, Math.round((elapsedMs / (PROVISIONAL_WINDOW_DAYS * DAY_MS)) * 100))
  );

  return {
    isProvisional: true,
    confirmed: false,
    startDate: provisionalStart,
    confirmedAt: null,
    monthThreeDate,
    daysRemaining,
    atMonthThree: msRemaining <= 0,
    percentElapsed,
  };
}

/**
 * Start the provisional clock when a hire is confirmed. Called inside the
 * existing approval transaction. No-op when the flag is off. Sets a FRESH clock
 * (clearing any prior confirmation) so a re-hire restarts the window.
 */
export async function startProvisionalClock(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date
): Promise<void> {
  if (!isProvisionalClockEnabled()) return;
  await tx.user.update({
    where: { id: userId },
    data: { provisionalStart: now, provisionalConfirmedAt: null },
  });
}

/**
 * Clear the provisional clock when a hire is rescinded/rolled back. Called
 * inside the existing compensating transaction. Runs regardless of the flag so
 * state is always cleaned up on rescind.
 */
export async function clearProvisionalClock(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: { provisionalStart: null, provisionalConfirmedAt: null },
  });
}

/**
 * Read-only provisional status for a user. Returns a "not provisional" status
 * when the flag is off so callers can render uniformly.
 */
export async function loadProvisionalStatus(
  userId: string,
  now: Date = new Date()
): Promise<ProvisionalStatus> {
  if (!isProvisionalClockEnabled()) {
    return computeProvisionalStatus(null, null, now);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { provisionalStart: true, provisionalConfirmedAt: true },
  });
  return computeProvisionalStatus(
    user?.provisionalStart ?? null,
    user?.provisionalConfirmedAt ?? null,
    now
  );
}
