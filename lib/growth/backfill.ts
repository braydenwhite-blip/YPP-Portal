/**
 * Student Operating System / Growth Engine (Phase N1) — backfill.
 *
 * Replays existing historical signals into Growth events so an initial
 * population isn't empty when the flag flips on. Idempotent + flag-gated: every
 * emit dedupes on (userId, dedupeKey), so re-running is safe. Covers the clearest
 * signals (mentorships, certificates); class/chapter events flow in going forward
 * via the emit hooks in integrations.ts. Invoked by scripts/backfill-growth-os.ts.
 */

import { prisma } from "@/lib/prisma";
import { isGrowthOsEnabled } from "@/lib/feature-flags";
import {
  onCertificateEarned,
  onMentorMatched,
  onMentorshipCompleted,
} from "./integrations";

export interface BackfillUserResult {
  userId: string;
  mentorships: number;
  completedMentorships: number;
  certificates: number;
}

/** Replay one user's historical signals into Growth events (idempotent). */
export async function backfillGrowthForUser(
  userId: string
): Promise<BackfillUserResult> {
  const result: BackfillUserResult = {
    userId,
    mentorships: 0,
    completedMentorships: 0,
    certificates: 0,
  };
  if (!isGrowthOsEnabled()) return result;

  const [mentorships, certificates] = await Promise.all([
    prisma.mentorship.findMany({
      where: { menteeId: userId },
      select: { id: true, status: true },
    }),
    prisma.certificate.findMany({
      where: { recipientId: userId },
      select: { id: true, title: true },
    }),
  ]);

  for (const m of mentorships) {
    await onMentorMatched(userId, m.id);
    result.mentorships += 1;
    if (m.status === "COMPLETE") {
      await onMentorshipCompleted(userId, m.id);
      result.completedMentorships += 1;
    }
  }

  for (const c of certificates) {
    await onCertificateEarned(userId, c.id, c.title);
    result.certificates += 1;
  }

  return result;
}

/** Backfill every user who has any replayable signal. */
export async function backfillGrowthForAllUsers(): Promise<{
  users: number;
  results: BackfillUserResult[];
}> {
  if (!isGrowthOsEnabled()) return { users: 0, results: [] };

  const [menteeIds, recipientIds] = await Promise.all([
    prisma.mentorship.findMany({ distinct: ["menteeId"], select: { menteeId: true } }),
    prisma.certificate.findMany({
      distinct: ["recipientId"],
      select: { recipientId: true },
    }),
  ]);

  const userIds = Array.from(
    new Set([
      ...menteeIds.map((m) => m.menteeId),
      ...recipientIds.map((c) => c.recipientId),
    ])
  );

  const results: BackfillUserResult[] = [];
  for (const userId of userIds) {
    results.push(await backfillGrowthForUser(userId));
  }
  return { users: userIds.length, results };
}
