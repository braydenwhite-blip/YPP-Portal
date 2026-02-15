import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { scores, quizType } = await request.json();

  // Get top passions based on scores (sorted highest first)
  const topPassionCategories = Object.entries(scores)
    .sort(([, a]: [string, unknown], [, b]: [string, unknown]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([passion]) => passion);

  // Save quiz result
  await prisma.passionQuizResult.create({
    data: {
      studentId: userId,
      quizType: quizType || "DISCOVERY",
      results: scores,
      topPassionIds: topPassionCategories,
      scores,
    },
  });

  // Award XP for completing quiz
  const xpAmount = 50;

  // Update or create XP profile
  await prisma.studentXP.upsert({
    where: { studentId: userId },
    create: {
      studentId: userId,
      totalXP: xpAmount,
      currentLevel: 1,
      xpToNextLevel: 100,
    },
    update: {
      totalXP: { increment: xpAmount },
    },
  });

  // Log XP transaction
  await prisma.xPTransaction.create({
    data: {
      studentId: userId,
      amount: xpAmount,
      reason: "Completed Passion Discovery Quiz",
      sourceType: "QUIZ",
    },
  });

  // ── Create islands from quiz results ──
  // Find PassionArea records matching the top 3 categories
  let islandsCreated = 0;
  try {
    const top3 = topPassionCategories.slice(0, 3);
    const passionAreas = await prisma.passionArea.findMany({
      where: { category: { in: top3 }, isActive: true },
      select: { id: true, category: true },
    });

    // Create StudentInterest for each matched passion (skip if already exists)
    for (let i = 0; i < passionAreas.length; i++) {
      const area = passionAreas[i];
      const existing = await prisma.studentInterest.findUnique({
        where: {
          studentId_passionId: {
            studentId: userId,
            passionId: area.id,
          },
        },
      });

      if (!existing) {
        await prisma.studentInterest.create({
          data: {
            studentId: userId,
            passionId: area.id,
            level: "EXPLORING",
            xpPoints: 0,
            currentLevel: 1,
            isPrimary: i === 0, // First match is primary
          },
        });
        islandsCreated++;
      }
    }
  } catch (err) {
    // PassionArea table may not exist or be empty — continue gracefully
    console.error("[QuizSave] Error creating islands:", err);
  }

  return NextResponse.json({
    success: true,
    xpEarned: xpAmount,
    islandsCreated,
  });
}
