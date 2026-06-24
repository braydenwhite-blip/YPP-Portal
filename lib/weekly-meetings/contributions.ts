/**
 * Server loader for the Weekly Impact "your week across the portal" feed.
 * Pulls the viewer's completed mentorship sessions and authored reviews for the
 * reporting week and hands them to the pure builder. Each source is queried
 * defensively so a hiccup in one domain degrades to fewer suggestions rather
 * than breaking the impact form.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { weekEndFor } from "./week";
import { buildContributions, type ContributionSuggestion } from "./contribution-types";

export type { ContributionSuggestion } from "./contribution-types";

export async function loadWeeklyContributions(
  viewerId: string,
  weekStart: Date,
): Promise<ContributionSuggestion[]> {
  const weekEnd = weekEndFor(weekStart);
  const window = { gte: weekStart, lte: weekEnd };

  const [sessions, mentorReviews, quarterlyReviews] = await Promise.all([
    prisma.mentorshipSession
      .findMany({
        where: {
          completedAt: window,
          OR: [{ ledById: viewerId }, { createdById: viewerId }],
        },
        select: { id: true, title: true, type: true, menteeId: true, completedAt: true },
        take: 25,
      })
      .catch(() => []),
    prisma.mentorGoalReview
      .findMany({
        where: { mentorId: viewerId, status: { not: "DRAFT" }, updatedAt: window },
        select: { id: true, menteeId: true, isQuarterly: true, updatedAt: true },
        take: 25,
      })
      .catch(() => []),
    prisma.quarterlyReview
      .findMany({
        where: { createdById: viewerId, createdAt: window },
        select: { id: true, userId: true, quarter: true, createdAt: true },
        take: 25,
      })
      .catch(() => []),
  ]);

  // One batch lookup resolves every referenced subject's display name.
  const userIds = new Set<string>();
  for (const s of sessions) userIds.add(s.menteeId);
  for (const r of mentorReviews) userIds.add(r.menteeId);
  for (const q of quarterlyReviews) userIds.add(q.userId);

  const names: Record<string, string> = {};
  if (userIds.size > 0) {
    const users = await prisma.user
      .findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } })
      .catch(() => [] as Array<{ id: string; name: string }>);
    for (const u of users) names[u.id] = u.name;
  }

  return buildContributions({
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      menteeId: s.menteeId,
      completedISO: (s.completedAt ?? weekStart).toISOString(),
    })),
    mentorReviews: mentorReviews.map((r) => ({
      id: r.id,
      menteeId: r.menteeId,
      isQuarterly: r.isQuarterly,
      updatedISO: r.updatedAt.toISOString(),
    })),
    quarterlyReviews: quarterlyReviews.map((q) => ({
      id: q.id,
      userId: q.userId,
      quarter: q.quarter,
      createdISO: q.createdAt.toISOString(),
    })),
    names,
  });
}
