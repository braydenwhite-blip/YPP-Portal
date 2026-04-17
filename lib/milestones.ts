"use server";

import { prisma } from "@/lib/prisma";

export type MilestoneKind =
  | "ABOVE_AND_BEYOND_FIRST"
  | "GOAL_COMPLETED"
  | "TENURE_6_MONTHS"
  | "TENURE_12_MONTHS";

/** Insert a milestone event only if the same kind hasn't been recorded for this user yet. */
export async function insertMilestoneOnce(
  userId: string,
  kind: MilestoneKind,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const existing = await prisma.milestoneEvent.findFirst({
    where: { userId, kind },
    select: { id: true },
  });
  if (existing) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.milestoneEvent.create({ data: { userId, kind, payload: payload as any } });
}

/** Return all unseen milestones for a user and mark them as seen. */
export async function consumeUnseenMilestones(userId: string) {
  const milestones = await prisma.milestoneEvent.findMany({
    where: { userId, seenAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (milestones.length > 0) {
    await prisma.milestoneEvent.updateMany({
      where: { id: { in: milestones.map((m) => m.id) } },
      data: { seenAt: new Date() },
    });
  }
  return milestones;
}

/** Check tenure milestones for a user and insert if applicable. */
export async function checkTenureMilestones(userId: string, mentorshipId: string): Promise<void> {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: { startDate: true },
  });
  if (!mentorship) return;

  const monthsElapsed = Math.floor(
    (Date.now() - mentorship.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  if (monthsElapsed >= 6) {
    await insertMilestoneOnce(userId, "TENURE_6_MONTHS", { months: 6 });
  }
  if (monthsElapsed >= 12) {
    await insertMilestoneOnce(userId, "TENURE_12_MONTHS", { months: 12 });
  }
}
