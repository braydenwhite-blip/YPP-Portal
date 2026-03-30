"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";

// ============================================
// CHAPTER GOAL MANAGEMENT
// ============================================

async function requireChapterLead() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Only Chapter Presidents and Admins can manage goals");
  }

  if (!user?.chapterId) throw new Error("User is not assigned to a chapter");
  return { userId: user.id, chapterId: user.chapterId };
}

export async function createGoal(formData: FormData) {
  const { userId, chapterId } = await requireChapterLead();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;
  const targetValue = parseInt(formData.get("targetValue") as string, 10);
  const unit = formData.get("unit") as string;
  const deadline = formData.get("deadline") as string | null;

  if (!title || !targetValue || !unit) {
    throw new Error("Title, target value, and unit are required");
  }

  await prisma.chapterGoal.create({
    data: {
      chapterId,
      createdById: userId,
      title,
      description: description || null,
      targetValue,
      unit,
      deadline: deadline ? new Date(deadline) : null,
    },
  });

  revalidatePath("/chapter");
  return { success: true };
}

export async function updateGoalProgress(goalId: string, currentValue: number) {
  const { chapterId } = await requireChapterLead();

  const goal = await prisma.chapterGoal.findUnique({ where: { id: goalId } });
  if (!goal || goal.chapterId !== chapterId) throw new Error("Goal not found");

  const isComplete = currentValue >= goal.targetValue;

  await prisma.chapterGoal.update({
    where: { id: goalId },
    data: {
      currentValue,
      ...(isComplete ? { status: "COMPLETED" } : {}),
    },
  });

  revalidatePath("/chapter");
  return { success: true };
}

export async function completeGoal(goalId: string) {
  const { chapterId } = await requireChapterLead();

  const goal = await prisma.chapterGoal.findUnique({ where: { id: goalId } });
  if (!goal || goal.chapterId !== chapterId) throw new Error("Goal not found");

  await prisma.chapterGoal.update({
    where: { id: goalId },
    data: { status: "COMPLETED", currentValue: goal.targetValue },
  });

  revalidatePath("/chapter");
  return { success: true };
}

export async function cancelGoal(goalId: string) {
  const { chapterId } = await requireChapterLead();

  const goal = await prisma.chapterGoal.findUnique({ where: { id: goalId } });
  if (!goal || goal.chapterId !== chapterId) throw new Error("Goal not found");

  await prisma.chapterGoal.update({
    where: { id: goalId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/chapter");
  return { success: true };
}
