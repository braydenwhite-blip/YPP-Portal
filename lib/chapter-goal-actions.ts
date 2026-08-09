"use server";

import { prisma } from "@/lib/prisma";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { revalidatePath } from "next/cache";

export async function createChapterGoal(formData: FormData) {
  const ctx = await getChapterViewerContext();
  if (!ctx.ledChapterId) {
    throw new Error("Not a chapter president");
  }

  const title = String(formData.get("title") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const targetValue = Number(formData.get("targetValue"));
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();

  if (!title || !unit || !Number.isFinite(targetValue) || targetValue <= 0) {
    throw new Error("Missing or invalid goal fields");
  }

  await prisma.chapterGoal.create({
    data: {
      chapterId: ctx.ledChapterId,
      createdById: ctx.user.id,
      title,
      unit,
      targetValue,
      deadline: deadlineRaw ? new Date(deadlineRaw) : null,
    },
  });

  revalidatePath("/chapter/resources");
}