"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function submitChapterFeedback(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  // Verify user has PARENT role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user || user.primaryRole !== "PARENT") {
    throw new Error("Only parents can submit feedback");
  }

  const chapterId = formData.get("chapterId") as string;
  const type = formData.get("type") as string;
  const targetUserId = formData.get("targetUserId") as string | null;
  const studentId = formData.get("studentId") as string | null;
  const courseId = formData.get("courseId") as string | null;
  const rating = parseInt(formData.get("rating") as string, 10);
  const comments = formData.get("comments") as string;
  const wouldRecommend = formData.get("wouldRecommend") === "true";
  const isAnonymous = formData.get("isAnonymous") === "true";

  if (!chapterId || !type || !rating || rating < 1 || rating > 5) {
    throw new Error("Missing or invalid required fields");
  }

  await prisma.parentChapterFeedback.create({
    data: {
      parentId: session.user.id,
      chapterId,
      type: type as any,
      targetUserId: targetUserId || null,
      studentId: studentId || null,
      courseId: courseId || null,
      rating,
      comments: comments || "",
      wouldRecommend,
      isAnonymous,
    },
  });

  revalidatePath("/parent/feedback");
  revalidatePath("/admin/parent-feedback");
  revalidatePath("/instructor/parent-feedback");
}

export async function getChapterFeedbackSummary(chapterId: string) {
  const feedback = await prisma.parentChapterFeedback.findMany({
    where: { chapterId },
  });

  if (feedback.length === 0) {
    return {
      averageRating: 0,
      totalCount: 0,
      byType: {} as Record<string, { avg: number; count: number }>,
    };
  }

  const totalRating = feedback.reduce((sum, f) => sum + f.rating, 0);
  const averageRating = totalRating / feedback.length;

  const byType: Record<string, { avg: number; count: number }> = {};
  for (const f of feedback) {
    if (!byType[f.type]) {
      byType[f.type] = { avg: 0, count: 0 };
    }
    byType[f.type].count++;
    byType[f.type].avg += f.rating;
  }

  for (const type of Object.keys(byType)) {
    byType[type].avg = byType[type].avg / byType[type].count;
  }

  return {
    averageRating: Math.round(averageRating * 100) / 100,
    totalCount: feedback.length,
    byType,
  };
}
