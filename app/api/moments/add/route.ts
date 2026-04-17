import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const passionId = formData.get("passionId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const isPublic = formData.get("isPublic") === "on";

  // Create breakthrough moment
  const moment = await prisma.breakthroughMoment.create({
    data: {
      studentId: session.user.id,
      passionId,
      title,
      description,
      isPublic,
      isRecognized: false,
      celebrationCount: 0,
      mediaUrls: [] // In production, handle file uploads
    }
  });

  // Award XP for sharing breakthrough
  await prisma.studentXP.upsert({
    where: { studentId: session.user.id },
    create: {
      studentId: session.user.id,
      totalXP: 75,
      currentLevel: 1,
      xpToNextLevel: 100
    },
    update: {
      totalXP: { increment: 75 }
    }
  });

  await prisma.xPTransaction.create({
    data: {
      studentId: session.user.id,
      amount: 75,
      reason: `Breakthrough moment: ${title}`,
      sourceType: "BREAKTHROUGH",
      sourceId: moment.id,
      passionId
    }
  });

  // Add to timeline
  await prisma.timelineEntry.create({
    data: {
      studentId: session.user.id,
      passionId,
      entryType: "BREAKTHROUGH_MOMENT",
      title: `Breakthrough: ${title}`,
      description,
      date: new Date(),
      milestoneLevel: "MAJOR",
      tags: ["breakthrough"],
      metadata: { momentId: moment.id },
      mediaUrls: [],
      xpAwarded: 75,
      isPublic
    }
  });

  redirect("/moments");
}
