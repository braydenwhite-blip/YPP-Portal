"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireChapterManager, getChapterViewerContext } from "@/lib/chapters/access";
import { analyticsDiscussedSourceId } from "@/lib/chapters/analytics-pace";
import { prisma } from "@/lib/prisma";

const MetricKeySchema = z.enum([
  "partners",
  "instructors",
  "students",
  "classes",
  "retention",
  "quality",
]);

const MarkDiscussedSchema = z.object({
  chapterId: z.string().min(1),
  metric: MetricKeySchema,
  periodKey: z.string().regex(/^\d{4}-\d{2}$/),
  discussed: z.boolean(),
});

const AddMetricActionSchema = z.object({
  chapterId: z.string().min(1),
  metric: MetricKeySchema,
  title: z.string().min(1).max(300),
  deadlineStart: z.string().min(1),
});

const ToggleMetricActionSchema = z.object({
  chapterId: z.string().min(1),
  actionId: z.string().min(1),
  complete: z.boolean(),
});

export type AnalyticsActionResult = { ok: true } | { ok: false; error: string };

export async function markAnalyticsMetricDiscussed(input: unknown): Promise<AnalyticsActionResult> {
  const parsed = MarkDiscussedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  let viewer;
  try {
    viewer = await requireChapterManager(data.chapterId);
  } catch {
    // Leadership may mark any chapter; CPs only their own. Also allow leadership via ctx.
    const ctx = await getChapterViewerContext();
    if (!ctx.isLeadership) return { ok: false, error: "Unauthorized" };
    viewer = { user: ctx.user, isLeadership: true };
  }

  const sourceId = analyticsDiscussedSourceId(data.chapterId, data.metric, data.periodKey);

  if (!data.discussed) {
    await prisma.actionItem.deleteMany({
      where: { chapterId: data.chapterId, sourceId },
    });
    revalidatePath("/chapter/impact");
    return { ok: true };
  }

  const existing = await prisma.actionItem.findFirst({
    where: { chapterId: data.chapterId, sourceId },
    select: { id: true },
  });
  if (existing) {
    await prisma.actionItem.update({
      where: { id: existing.id },
      data: { status: "COMPLETE", completedAt: new Date() },
    });
  } else {
    const chapter = await prisma.chapter.findUnique({
      where: { id: data.chapterId },
      select: { presidentId: true, name: true },
    });
    const leadId = chapter?.presidentId ?? viewer.user.id;
    await prisma.actionItem.create({
      data: {
        title: `Discussed ${data.metric} · ${chapter?.name ?? "Chapter"}`,
        description: `Marked discussed in Chapter Analytics for ${data.periodKey}.`,
        goalCategory: "Chapter analytics",
        leadId,
        createdById: viewer.user.id,
        status: "COMPLETE",
        completedAt: new Date(),
        priority: "LOW",
        visibility: "ALL_LEADERSHIP",
        deadlineStart: new Date(),
        chapterId: data.chapterId,
        sourceType: "COMMAND_CENTER",
        sourceId,
      },
    });
  }

  revalidatePath("/chapter/impact");
  return { ok: true };
}

export async function addAnalyticsMetricAction(input: unknown): Promise<AnalyticsActionResult> {
  const parsed = AddMetricActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  let viewer;
  try {
    viewer = await requireChapterManager(data.chapterId);
  } catch {
    const ctx = await getChapterViewerContext();
    if (!ctx.isLeadership) return { ok: false, error: "Unauthorized" };
    viewer = { user: ctx.user, isLeadership: true };
  }

  const chapter = await prisma.chapter.findUnique({
    where: { id: data.chapterId },
    select: { presidentId: true },
  });
  // CPs own what they create on their chapter. Leadership assigns the sitting CP
  // when one exists so the tracker always has a named lead.
  const leadId = viewer.isLeadership
    ? chapter?.presidentId ?? viewer.user.id
    : viewer.user.id;
  const deadline = new Date(data.deadlineStart);
  if (Number.isNaN(deadline.getTime())) return { ok: false, error: "Invalid deadline" };

  await prisma.actionItem.create({
    data: {
      title: data.title.slice(0, 300),
      goalCategory: "Chapter analytics",
      leadId,
      createdById: viewer.user.id,
      status: "NOT_STARTED",
      priority: "MEDIUM",
      visibility: "ALL_LEADERSHIP",
      deadlineStart: deadline,
      chapterId: data.chapterId,
      sourceType: "COMMAND_CENTER",
      sourceId: `chapter-analytics:action:${data.metric}:${Date.now()}`,
      relatedEntityId: `${data.chapterId}:${data.metric}`,
      assignments: {
        create: [
          { userId: leadId, role: "LEAD" },
          { userId: leadId, role: "EXECUTING" },
        ],
      },
    },
  });

  revalidatePath("/chapter/impact");
  revalidatePath("/actions");
  return { ok: true };
}

export async function toggleAnalyticsMetricAction(input: unknown): Promise<AnalyticsActionResult> {
  const parsed = ToggleMetricActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  try {
    await requireChapterManager(data.chapterId);
  } catch {
    const ctx = await getChapterViewerContext();
    if (!ctx.isLeadership) return { ok: false, error: "Unauthorized" };
  }

  const row = await prisma.actionItem.findFirst({
    where: { id: data.actionId, chapterId: data.chapterId },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "Action not found" };

  await prisma.actionItem.update({
    where: { id: row.id },
    data: data.complete
      ? { status: "COMPLETE", completedAt: new Date() }
      : { status: "NOT_STARTED", completedAt: null },
  });

  revalidatePath("/chapter/impact");
  return { ok: true };
}
