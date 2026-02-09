import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scores, quizType } = await request.json();

  // Get top 5 passions based on scores
  const topPassionIds = Object.entries(scores)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 5)
    .map(([passion]) => passion);

  // Save quiz result
  await prisma.passionQuizResult.create({
    data: {
      studentId: session.user.id,
      quizType: quizType || 'DISCOVERY',
      results: scores,
      topPassionIds,
      scores
    }
  });

  // Award XP for completing quiz
  const xpAmount = 50;
  
  // Update or create XP profile
  await prisma.studentXP.upsert({
    where: { studentId: session.user.id },
    create: {
      studentId: session.user.id,
      totalXP: xpAmount,
      currentLevel: 1,
      xpToNextLevel: 100
    },
    update: {
      totalXP: { increment: xpAmount }
    }
  });

  // Log XP transaction
  await prisma.xPTransaction.create({
    data: {
      studentId: session.user.id,
      amount: xpAmount,
      reason: "Completed Passion Discovery Quiz",
      sourceType: "QUIZ"
    }
  });

  return NextResponse.json({ success: true, xpEarned: xpAmount });
}
