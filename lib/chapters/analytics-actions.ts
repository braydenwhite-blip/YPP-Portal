"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireChapterManager, getChapterViewerContext } from "@/lib/chapters/access";
import { analyticsDiscussedSourceId } from "@/lib/chapters/analytics-pace";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
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

function actionError(err: unknown, fallback: string): AnalyticsActionResult {
  const message = err instanceof Error ? err.message : fallback;
  if (/unauthorized/i.test(message)) {
    return { ok: false, error: "You don't have permission to update this chapter." };
  }
  return { ok: false, error: message || fallback };
}

/**
 * Chapter analytics mutations are available to the same people who can open
 * `/chapter/impact` for that chapter: national chapter leadership, or the
 * Chapter President of that chapter.
 */
async function requireAnalyticsChapterManager(chapterId: string) {
  try {
    return await requireChapterManager(chapterId);
  } catch (err) {
    // Only fall through for auth misses — don't swallow DB/runtime failures.
    if (!(err instanceof Error) || !/unauthorized/i.test(err.message)) {
      throw err;
    }
    const ctx = await getChapterViewerContext();
    if (!ctx.isLeadership) {
      throw new Error("Unauthorized");
    }
    return { user: ctx.user, isLeadership: true as const };
  }
}

function ensureTrackerEnabled(): AnalyticsActionResult | null {
  if (isActionTrackerEnabled()) return null;
  return {
    ok: false,
    error: "Action Tracker is turned off, so action items can't be created here.",
  };
}

function revalidateAnalytics() {
  revalidatePath("/chapter/impact");
  revalidatePath("/actions");
  revalidatePath("/my-actions");
}

export async function markAnalyticsMetricDiscussed(input: unknown): Promise<AnalyticsActionResult> {
  const parsed = MarkDiscussedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  const trackerOff = ensureTrackerEnabled();
  if (trackerOff) return trackerOff;

  try {
    const viewer = await requireAnalyticsChapterManager(data.chapterId);
    const sourceId = analyticsDiscussedSourceId(data.chapterId, data.metric, data.periodKey);

    if (!data.discussed) {
      await prisma.actionItem.deleteMany({
        where: { chapterId: data.chapterId, sourceId },
      });
      revalidateAnalytics();
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
          assignments: {
            create: [
              { userId: leadId, role: "LEAD" },
              { userId: leadId, role: "EXECUTING" },
            ],
          },
        },
      });
    }

    revalidateAnalytics();
    return { ok: true };
  } catch (err) {
    return actionError(err, "Couldn't update discussion status");
  }
}

export async function addAnalyticsMetricAction(input: unknown): Promise<AnalyticsActionResult> {
  const parsed = AddMetricActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  const trackerOff = ensureTrackerEnabled();
  if (trackerOff) return trackerOff;

  try {
    const viewer = await requireAnalyticsChapterManager(data.chapterId);

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
        comments: {
          create: {
            authorId: viewer.user.id,
            type: "NOTE",
            body: "Action created from Chapter Analytics",
          },
        },
      },
    });

    revalidateAnalytics();
    return { ok: true };
  } catch (err) {
    return actionError(err, "Couldn't create action item");
  }
}

export async function toggleAnalyticsMetricAction(input: unknown): Promise<AnalyticsActionResult> {
  const parsed = ToggleMetricActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  const trackerOff = ensureTrackerEnabled();
  if (trackerOff) return trackerOff;

  try {
    await requireAnalyticsChapterManager(data.chapterId);

    const row = await prisma.actionItem.findFirst({
      where: {
        id: data.actionId,
        chapterId: data.chapterId,
        // Never toggle discussion markers from the action list.
        NOT: { sourceId: { startsWith: "chapter-analytics:discussed:" } },
      },
      select: { id: true },
    });
    if (!row) return { ok: false, error: "Action not found" };

    await prisma.actionItem.update({
      where: { id: row.id },
      data: data.complete
        ? { status: "COMPLETE", completedAt: new Date() }
        : { status: "NOT_STARTED", completedAt: null },
    });

    revalidateAnalytics();
    return { ok: true };
  } catch (err) {
    return actionError(err, "Couldn't update action item");
  }
}
