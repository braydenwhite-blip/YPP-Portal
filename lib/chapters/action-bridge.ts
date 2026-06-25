// Bridge between the chapter operating system and the existing Action Tracker.
// Chapter "next steps" (launch checklist items, support-request follow-ups) are
// created as real ActionItem rows scoped to the chapter (chapterId) and owned by
// a person (leadId), so they show up in /actions, on Person 360, and in chapter
// dashboards — one accountability system, no parallel checklist silo.
//
// We write ActionItem rows directly (rather than via createActionItem) so the
// chapter guards in lib/chapters/access.ts fully control authorization and so the
// call can run inside the CP-approval transaction.

import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type ChapterActionInput = {
  chapterId: string;
  title: string;
  description?: string | null;
  // The accountable owner (usually the Chapter President).
  leadId: string;
  // The actor creating the action.
  createdById: string;
  deadlineStart: Date;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  visibility?: "ALL_LEADERSHIP" | "OFFICERS_ONLY";
  goalCategory?: string;
  inputUserIds?: string[];
};

/** Create a chapter-scoped ActionItem with the owner assigned as LEAD + EXECUTING. */
export async function createChapterActionItem(
  db: Db,
  input: ChapterActionInput
): Promise<{ id: string }> {
  const inputUserIds = (input.inputUserIds ?? []).filter((id) => id && id !== input.leadId);
  const created = await db.actionItem.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      goalCategory: input.goalCategory ?? "Chapter launch",
      leadId: input.leadId,
      createdById: input.createdById,
      status: "NOT_STARTED",
      priority: input.priority ?? "MEDIUM",
      visibility: input.visibility ?? "ALL_LEADERSHIP",
      deadlineStart: input.deadlineStart,
      chapterId: input.chapterId,
      // Provenance: this action originated from the chapter entity.
      sourceType: "ENTITY",
      sourceId: input.chapterId,
      assignments: {
        create: [
          { userId: input.leadId, role: "LEAD" },
          { userId: input.leadId, role: "EXECUTING" },
          ...inputUserIds.map((userId) => ({ userId, role: "INPUT" as const })),
        ],
      },
    },
    select: { id: true },
  });
  return created;
}

export type ChapterFollowUpActionInput = {
  chapterId: string;
  meetingId: string;
  followUpId: string;
  title: string;
  description?: string | null;
  leadId: string;
  createdById: string;
  deadlineStart: Date;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
};

/**
 * Turn a meeting follow-up into a real, chapter-scoped ActionItem. Provenance is
 * set to MEETING_FOLLOW_UP + the follow-up id so the meeting runner's existing
 * `getMeetingActionLinks` recognises it and shows the follow-up as "tracked",
 * and `meetingId` links it back to the meeting on the action card. This is the
 * "create follow-up actions directly from the meeting" path — no new model.
 */
export async function createChapterActionFromMeetingFollowUp(
  db: Db,
  input: ChapterFollowUpActionInput
): Promise<{ id: string }> {
  return db.actionItem.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      goalCategory: "Chapter meeting follow-up",
      leadId: input.leadId,
      createdById: input.createdById,
      status: "NOT_STARTED",
      priority: input.priority ?? "MEDIUM",
      visibility: "ALL_LEADERSHIP",
      deadlineStart: input.deadlineStart,
      chapterId: input.chapterId,
      meetingId: input.meetingId,
      sourceType: "MEETING_FOLLOW_UP",
      sourceId: input.followUpId,
      assignments: {
        create: [
          { userId: input.leadId, role: "LEAD" },
          { userId: input.leadId, role: "EXECUTING" },
        ],
      },
    },
    select: { id: true },
  });
}

/** Mark a chapter action complete (e.g. when its launch checklist item is ticked). */
export async function completeChapterActionItem(db: Db, actionItemId: string): Promise<void> {
  await db.actionItem.updateMany({
    where: { id: actionItemId, status: { not: "COMPLETE" } },
    data: { status: "COMPLETE", completedAt: new Date() },
  });
}

/** Re-open a chapter action (e.g. when its launch checklist item is un-ticked). */
export async function reopenChapterActionItem(db: Db, actionItemId: string): Promise<void> {
  await db.actionItem.updateMany({
    where: { id: actionItemId, status: "COMPLETE" },
    data: { status: "IN_PROGRESS", completedAt: null },
  });
}
