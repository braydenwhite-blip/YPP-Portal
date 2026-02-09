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
  const question = formData.get("question") as string;
  const isAnonymous = formData.get("isAnonymous") === "on";

  // Create mentor question
  const mentorQuestion = await prisma.mentorQuestion.create({
    data: {
      studentId: session.user.id,
      passionId: passionId || null,
      question,
      isAnonymous,
      status: "PENDING",
      views: 0
    }
  });

  // Award XP for asking question
  await prisma.studentXP.upsert({
    where: { studentId: session.user.id },
    create: {
      studentId: session.user.id,
      totalXP: 10,
      currentLevel: 1,
      xpToNextLevel: 100
    },
    update: {
      totalXP: { increment: 10 }
    }
  });

  await prisma.xPTransaction.create({
    data: {
      studentId: session.user.id,
      amount: 10,
      reason: "Asked a mentor question",
      sourceType: "QUESTION",
      sourceId: mentorQuestion.id,
      passionId: passionId || null
    }
  });

  redirect("/mentor/ask");
}
