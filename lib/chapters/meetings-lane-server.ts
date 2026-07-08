"use server";

// Meetings lane mutation: convert a meeting follow-up into a real, chapter-
// scoped ActionItem. Thin "use server" wrapper around the existing
// `createChapterActionFromMeetingFollowUp` bridge (lib/chapters/action-bridge.ts),
// which isn't itself a server action since it also runs inside the CP-approval
// transaction elsewhere.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireChapterManager } from "@/lib/chapters/access";
import { createChapterActionFromMeetingFollowUp } from "@/lib/chapters/action-bridge";

const Schema = z.object({
  chapterId: z.string().min(1),
  meetingId: z.string().min(1),
  followUpId: z.string().min(1),
});

export type TrackFollowUpResult = { ok: true; id: string } | { ok: false; error: string };

export async function trackMeetingFollowUpAsAction(input: unknown): Promise<TrackFollowUpResult> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const { chapterId, meetingId, followUpId } = parsed.data;

  let viewer;
  try {
    viewer = await requireChapterManager(chapterId);
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const followUp = await prisma.meetingFollowUp.findUnique({
    where: { id: followUpId },
    select: { id: true, title: true, detail: true, dueDate: true, ownerId: true, meetingId: true },
  });
  if (!followUp || followUp.meetingId !== meetingId) return { ok: false, error: "Follow-up not found" };

  // Idempotent: reuse the tracked action if this follow-up already has one
  // (same source-provenance convention `getMeetingActionLinks` reads).
  const existing = await prisma.actionItem.findFirst({
    where: { sourceType: "MEETING_FOLLOW_UP", sourceId: followUpId },
    select: { id: true },
  });
  if (existing) {
    revalidatePath("/chapter");
    return { ok: true, id: existing.id };
  }

  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { presidentId: true } });
  const leadId = followUp.ownerId ?? chapter?.presidentId ?? viewer.user.id;

  const created = await createChapterActionFromMeetingFollowUp(prisma, {
    chapterId,
    meetingId,
    followUpId,
    title: followUp.title,
    description: followUp.detail ?? null,
    leadId,
    createdById: viewer.user.id,
    deadlineStart: followUp.dueDate ?? new Date(),
  });

  revalidatePath("/chapter");
  revalidatePath("/actions");
  return { ok: true, id: created.id };
}
