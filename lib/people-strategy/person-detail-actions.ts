"use server";

import type { GoalRatingColor } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireLeadership } from "@/lib/authorization";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { z } from "zod";

import { monthKeyUTC, monthLabelUTC } from "./people-performance-selectors";

/**
 * People & Performance — the Person Detail drawer's lazy read.
 *
 * The performance table rows already carry workload, dots, and quarterly facts;
 * this fetches only the extra detail the drawer's Check-in section needs (the
 * latest compiled check-in's aggregate notes) so the table payload stays small.
 *
 * Leadership/Board only (`requireLeadership()`), gated by ENABLE_PEOPLE_DASHBOARD.
 * The notes returned are the AGGREGATE compiled notes — they never contain raw
 * collaborator feedback bodies (those live only in the feedback review surface).
 */

export type PersonCheckInDetail = {
  monthKey: string;
  /** "May 2026" */
  monthLabel: string;
  performanceRating: GoalRatingColor | null;
  /** Aggregate compiled notes — safe to show; no confidential bodies. */
  compiledNotes: string | null;
  compiledAtISO: string;
} | null;

const Schema = z.object({ subjectUserId: z.string().min(1) });

export async function loadLatestCheckInDetail(
  input: z.input<typeof Schema>
): Promise<PersonCheckInDetail> {
  if (!isPeopleDashboardEnabled()) {
    throw new Error("The People dashboard is not enabled");
  }
  await requireLeadership();

  const { subjectUserId } = Schema.parse(input);

  const checkIn = await prisma.checkIn.findFirst({
    where: { userId: subjectUserId },
    orderBy: { month: "desc" },
    select: {
      month: true,
      performanceRating: true,
      compiledNotes: true,
      createdAt: true,
    },
  });
  if (!checkIn) return null;

  return {
    monthKey: monthKeyUTC(checkIn.month),
    monthLabel: monthLabelUTC(checkIn.month),
    performanceRating: checkIn.performanceRating,
    compiledNotes: checkIn.compiledNotes,
    compiledAtISO: checkIn.createdAt.toISOString(),
  };
}
