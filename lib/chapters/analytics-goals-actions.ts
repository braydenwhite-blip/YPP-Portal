"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireChapterLeadership, requireChapterManager } from "@/lib/chapters/access";
import { ANALYTICS_CATEGORY_KEYS, ANALYTICS_METRIC_KEYS } from "@/lib/chapters/analytics-pace";
import { prisma } from "@/lib/prisma";

const MetricKeySchema = z.enum(ANALYTICS_METRIC_KEYS);
const CategoryKeySchema = z.enum(ANALYTICS_CATEGORY_KEYS);
const MonthKeySchema = z.string().regex(/^\d{4}-\d{2}$/);

const SetGoalDefaultSchema = z.object({
  metric: MetricKeySchema,
  monthKey: MonthKeySchema,
  targetValue: z.number().finite(),
});

const DeleteGoalDefaultSchema = z.object({
  metric: MetricKeySchema,
  monthKey: MonthKeySchema,
});

const SetGoalExceptionSchema = z.object({
  chapterId: z.string().min(1),
  metric: MetricKeySchema,
  monthKey: MonthKeySchema,
  targetValue: z.number().finite(),
});

const DeleteGoalExceptionSchema = z.object({
  chapterId: z.string().min(1),
  metric: MetricKeySchema,
  monthKey: MonthKeySchema,
});

const SetCategoryNoteSchema = z.object({
  chapterId: z.string().min(1),
  category: CategoryKeySchema,
  monthKey: MonthKeySchema,
  body: z.string().max(4000),
});

export type AnalyticsGoalActionResult = { ok: true } | { ok: false; error: string };

function revalidateAll() {
  revalidatePath("/chapter/impact");
  revalidatePath("/chapter/impact/goals");
}

export async function setAnalyticsGoalDefault(input: unknown): Promise<AnalyticsGoalActionResult> {
  const parsed = SetGoalDefaultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  const viewer = await requireChapterLeadership();

  await prisma.chapterAnalyticsGoal.upsert({
    where: { metric_monthKey: { metric: data.metric, monthKey: data.monthKey } },
    update: { targetValue: data.targetValue, updatedById: viewer.id },
    create: {
      metric: data.metric,
      monthKey: data.monthKey,
      targetValue: data.targetValue,
      updatedById: viewer.id,
    },
  });

  revalidateAll();
  return { ok: true };
}

export async function deleteAnalyticsGoalDefault(input: unknown): Promise<AnalyticsGoalActionResult> {
  const parsed = DeleteGoalDefaultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  await requireChapterLeadership();

  await prisma.chapterAnalyticsGoal.deleteMany({
    where: { metric: data.metric, monthKey: data.monthKey },
  });

  revalidateAll();
  return { ok: true };
}

export async function setAnalyticsGoalException(input: unknown): Promise<AnalyticsGoalActionResult> {
  const parsed = SetGoalExceptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  const viewer = await requireChapterLeadership();

  await prisma.chapterAnalyticsGoalException.upsert({
    where: {
      chapterId_metric_monthKey: {
        chapterId: data.chapterId,
        metric: data.metric,
        monthKey: data.monthKey,
      },
    },
    update: { targetValue: data.targetValue, updatedById: viewer.id },
    create: {
      chapterId: data.chapterId,
      metric: data.metric,
      monthKey: data.monthKey,
      targetValue: data.targetValue,
      updatedById: viewer.id,
    },
  });

  revalidateAll();
  return { ok: true };
}

export async function deleteAnalyticsGoalException(input: unknown): Promise<AnalyticsGoalActionResult> {
  const parsed = DeleteGoalExceptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  await requireChapterLeadership();

  await prisma.chapterAnalyticsGoalException.deleteMany({
    where: { chapterId: data.chapterId, metric: data.metric, monthKey: data.monthKey },
  });

  revalidateAll();
  return { ok: true };
}

export async function setAnalyticsCategoryNote(input: unknown): Promise<AnalyticsGoalActionResult> {
  const parsed = SetCategoryNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  let viewerId: string;
  try {
    const viewer = await requireChapterManager(data.chapterId);
    viewerId = viewer.user.id;
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const body = data.body.trim();

  if (!body) {
    await prisma.chapterAnalyticsNote.deleteMany({
      where: { chapterId: data.chapterId, category: data.category, monthKey: data.monthKey },
    });
    revalidatePath("/chapter/impact");
    return { ok: true };
  }

  await prisma.chapterAnalyticsNote.upsert({
    where: {
      chapterId_category_monthKey: {
        chapterId: data.chapterId,
        category: data.category,
        monthKey: data.monthKey,
      },
    },
    update: { body, updatedById: viewerId },
    create: {
      chapterId: data.chapterId,
      category: data.category,
      monthKey: data.monthKey,
      body,
      updatedById: viewerId,
    },
  });

  revalidatePath("/chapter/impact");
  return { ok: true };
}
