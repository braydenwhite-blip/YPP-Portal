"use server";

// Bridge a chapter "needs attention" blocker into the EXISTING Action Tracker as
// a real, chapter-scoped ActionItem — owned by the Chapter President, linked to
// the underlying entity (so it shows on Partner / Applicant / Class 360), and
// idempotent so the same blocker never spawns a duplicate. No parallel task
// system: this is the one accountability system the rest of the portal uses.

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireChapterManager } from "@/lib/chapters/access";

const TrackBlockerSchema = z.object({
  chapterId: z.string().min(1),
  blockerKey: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  detail: z.string().max(2000).optional(),
  severity: z.enum(["critical", "warning", "info"]),
  entityType: z.enum(["PARTNER", "INSTRUCTOR_APPLICATION", "CLASS_OFFERING"]).optional(),
  entityId: z.string().min(1).max(200).optional(),
});

const SEVERITY_TO_PRIORITY: Record<"critical" | "warning" | "info", "HIGH" | "MEDIUM" | "LOW"> = {
  critical: "HIGH",
  warning: "MEDIUM",
  info: "LOW",
};

export type TrackBlockerResult =
  | { ok: true; id: string; existing: boolean }
  | { ok: false; error: string };

/**
 * Create (or reuse) a chapter ActionItem for a blocker. Dedup key is the
 * blocker's stable key, namespaced into `sourceId` so re-running it is a no-op.
 */
export async function trackChapterBlocker(input: unknown): Promise<TrackBlockerResult> {
  const parsed = TrackBlockerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  let viewer;
  try {
    viewer = await requireChapterManager(data.chapterId);
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const sourceId = `blocker:${data.blockerKey}`;

  // Idempotency: one open action per blocker.
  const existing = await prisma.actionItem.findFirst({
    where: { chapterId: data.chapterId, sourceId, status: { not: "COMPLETE" } },
    select: { id: true },
  });
  if (existing) {
    revalidatePath("/chapter");
    return { ok: true, id: existing.id, existing: true };
  }

  // Owner is the Chapter President; fall back to the actor for leadership.
  const chapter = await prisma.chapter.findUnique({
    where: { id: data.chapterId },
    select: { presidentId: true },
  });
  const leadId = chapter?.presidentId ?? viewer.user.id;

  const created = await prisma.actionItem.create({
    data: {
      title: data.title.slice(0, 300),
      description: data.detail ?? null,
      goalCategory: "Chapter pipeline",
      leadId,
      createdById: viewer.user.id,
      status: "NOT_STARTED",
      priority: SEVERITY_TO_PRIORITY[data.severity],
      visibility: "ALL_LEADERSHIP",
      deadlineStart: new Date(),
      chapterId: data.chapterId,
      sourceType: "ENTITY",
      sourceId,
      relatedEntityType: data.entityType ?? null,
      relatedEntityId: data.entityId ?? null,
      assignments: {
        create: [
          { userId: leadId, role: "LEAD" },
          { userId: leadId, role: "EXECUTING" },
        ],
      },
    },
    select: { id: true },
  });

  revalidatePath("/chapter");
  revalidatePath("/actions");
  return { ok: true, id: created.id, existing: false };
}
