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
  const showcaseId = formData.get("showcaseId") as string;
  const title = formData.get("title") as string;
  const passionId = formData.get("passionId") as string;
  const description = formData.get("description") as string;

  // Check if already registered
  const existing = await prisma.showcasePresentation.findFirst({
    where: {
      showcaseId,
      studentId: session.user.id
    }
  });

  if (existing) {
    return NextResponse.json({ error: "Already registered for this showcase" }, { status: 400 });
  }

  // Create presentation registration
  const presentation = await prisma.showcasePresentation.create({
    data: {
      showcaseId,
      studentId: session.user.id,
      passionId,
      title,
      description,
      votes: 0,
      presentationUrl: null,
      thumbnailUrl: null
    }
  });

  // Award registration XP
  await prisma.studentXP.upsert({
    where: { studentId: session.user.id },
    create: {
      studentId: session.user.id,
      totalXP: 50,
      currentLevel: 1,
      xpToNextLevel: 100
    },
    update: {
      totalXP: { increment: 50 }
    }
  });

  await prisma.xPTransaction.create({
    data: {
      studentId: session.user.id,
      amount: 50,
      reason: `Registered for showcase: ${title}`,
      sourceType: "SHOWCASE",
      sourceId: showcaseId,
      passionId
    }
  });

  // Add to timeline
  await prisma.timelineEntry.create({
    data: {
      studentId: session.user.id,
      passionId,
      entryType: "SHOWCASE",
      title: `Registered: ${title}`,
      description: `Signed up to present at upcoming showcase`,
      date: new Date(),
      milestoneLevel: "MAJOR",
      tags: ["showcase", "presentation"],
      metadata: { presentationId: presentation.id },
      mediaUrls: [],
      xpAwarded: 50,
      isPublic: true
    }
  });

  redirect("/showcases");
}
