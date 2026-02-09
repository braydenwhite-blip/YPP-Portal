import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const passionId = formData.get("passionId") as string;
  const activity = formData.get("activity") as string;
  const duration = parseInt(formData.get("duration") as string);
  const mood = formData.get("mood") as string;
  const notes = formData.get("notes") as string;

  // Log practice session
  await prisma.practiceLog.create({
    data: {
      studentId: session.user.id,
      passionId,
      activity,
      duration,
      mood,
      notes: notes || null,
      skillsFocused: []
    }
  });

  // Award XP based on duration
  const xpAmount = Math.min(duration, 60); // Max 60 XP per session

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

  await prisma.xPTransaction.create({
    data: {
      studentId: session.user.id,
      amount: xpAmount,
      reason: `Practiced ${activity}`,
      sourceType: "PRACTICE",
      passionId
    }
  });

  redirect("/learn/practice?logged=true");
}
