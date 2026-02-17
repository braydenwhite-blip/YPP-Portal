import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PassionCategory } from "@prisma/client";

function normalizeCategoryToken(value: string): string {
  return value.trim().toUpperCase();
}

function parseScores(payload: unknown): Record<string, number> {
  if (!payload || typeof payload !== "object") return {};
  const entries = Object.entries(payload as Record<string, unknown>)
    .map(([key, value]) => [normalizeCategoryToken(key), Number(value)] as const)
    .filter(([, value]) => Number.isFinite(value) && value > 0);
  return Object.fromEntries(entries);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  let body: { scores?: unknown; quizType?: string };
  try {
    body = (await request.json()) as { scores?: unknown; quizType?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const scores = parseScores(body.scores);
  if (Object.keys(scores).length === 0) {
    return NextResponse.json({ error: "Scores are required" }, { status: 400 });
  }
  const quizType = typeof body.quizType === "string" && body.quizType.trim()
    ? body.quizType.trim()
    : "DISCOVERY";

  // Get top passions based on scores (sorted highest first)
  const topPassionCategories = Object.entries(scores)
    .sort(([, a]: [string, unknown], [, b]: [string, unknown]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([passion]) => normalizeCategoryToken(passion));

  const validCategories = new Set(Object.values(PassionCategory));
  const rankedCategories = topPassionCategories.filter((category) =>
    validCategories.has(category as PassionCategory)
  ) as PassionCategory[];

  const areasByCategory = rankedCategories.length === 0
    ? []
    : await prisma.passionArea.findMany({
      where: {
        isActive: true,
        category: { in: rankedCategories },
      },
      select: { id: true, category: true, order: true, name: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }).catch(() => []);

  const firstAreaIdByCategory = new Map<PassionCategory, string>();
  for (const area of areasByCategory) {
    if (!firstAreaIdByCategory.has(area.category)) {
      firstAreaIdByCategory.set(area.category, area.id);
    }
  }

  const topPassionIds = rankedCategories
    .map((category) => firstAreaIdByCategory.get(category))
    .filter((value): value is string => Boolean(value));

  // Save quiz result
  await prisma.passionQuizResult.create({
    data: {
      studentId: userId,
      quizType,
      results: scores,
      topPassionIds: topPassionIds.length > 0 ? topPassionIds : topPassionCategories,
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
  // Create StudentInterest records for top 3 canonical passions.
  let islandsCreated = 0;
  const topThreePassionIds = topPassionIds.slice(0, 3);

  for (let i = 0; i < topThreePassionIds.length; i++) {
    const passionId = topThreePassionIds[i];
    const existing = await prisma.studentInterest.findUnique({
      where: {
        studentId_passionId: {
          studentId: userId,
          passionId,
        },
      },
    });

    if (!existing) {
      await prisma.studentInterest.create({
        data: {
          studentId: userId,
          passionId,
          level: "EXPLORING",
          xpPoints: 0,
          currentLevel: 1,
          isPrimary: i === 0,
        },
      });
      islandsCreated++;
    }
  }

  if (topThreePassionIds.length === 0) {
    // PassionArea table may be empty or quiz categories may not map yet.
    console.error("[QuizSave] No active passion areas matched quiz categories:", rankedCategories);
  }

  return NextResponse.json({
    success: true,
    xpEarned: xpAmount,
    islandsCreated,
  });
}
