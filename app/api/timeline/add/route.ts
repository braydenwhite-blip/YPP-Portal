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
  const { passionId, entryType, title, description, date, milestone, tags } = body;

  // Create timeline entry
  const entry = await prisma.timelineEntry.create({
    data: {
      studentId: session.user.id,
      passionId,
      entryType,
      title,
      description: description || null,
      date: date ? new Date(date) : new Date(),
      milestoneLevel: milestone || null,
      tags: tags || [],
      metadata: {},
      mediaUrls: [],
      xpAwarded: milestone === "BREAKTHROUGH" ? 100 : milestone === "MAJOR" ? 50 : 25,
      isPinned: false,
      isPublic: false
    }
  });

  // Award XP for milestone
  if (milestone) {
    const xpAmount = milestone === "BREAKTHROUGH" ? 100 : milestone === "MAJOR" ? 50 : 25;

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
        reason: `Timeline milestone: ${title}`,
        sourceType: "MILESTONE",
        sourceId: entry.id,
        passionId
      }
    });
  }

  return NextResponse.json({ success: true, entry });
}
