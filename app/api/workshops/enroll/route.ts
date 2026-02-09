import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { seriesId } = body;

  // Check if already enrolled
  const existing = await prisma.workshopEnrollment.findUnique({
    where: {
      studentId_seriesId: {
        studentId: session.user.id,
        seriesId
      }
    }
  });

  if (existing) {
    return NextResponse.json({ error: "Already enrolled" }, { status: 400 });
  }

  // Create enrollment
  const enrollment = await prisma.workshopEnrollment.create({
    data: {
      studentId: session.user.id,
      seriesId,
      progress: {},
      completedSessions: 0,
      isCompleted: false,
      certificateEarned: false
    }
  });

  // Award enrollment XP
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
      reason: "Enrolled in workshop series",
      sourceType: "WORKSHOP",
      sourceId: seriesId
    }
  });

  return NextResponse.json({ success: true, enrollment });
}
