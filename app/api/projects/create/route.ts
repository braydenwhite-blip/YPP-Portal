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
  const title = formData.get("title") as string;
  const passionId = formData.get("passionId") as string;
  const description = formData.get("description") as string;
  const startDate = formData.get("startDate") as string;
  const targetEndDate = formData.get("targetEndDate") as string;
  const visibility = formData.get("visibility") as string;

  // Create project
  const project = await prisma.projectTracker.create({
    data: {
      studentId: session.user.id,
      passionId,
      title,
      description: description || null,
      startDate: startDate ? new Date(startDate) : new Date(),
      targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
      status: "PLANNING",
      visibility: visibility || "PRIVATE",
      tags: [],
      collaborators: []
    }
  });

  // Award project start XP
  await prisma.studentXP.upsert({
    where: { studentId: session.user.id },
    create: {
      studentId: session.user.id,
      totalXP: 25,
      currentLevel: 1,
      xpToNextLevel: 100
    },
    update: {
      totalXP: { increment: 25 }
    }
  });

  await prisma.xPTransaction.create({
    data: {
      studentId: session.user.id,
      amount: 25,
      reason: `Started project: ${title}`,
      sourceType: "PROJECT",
      sourceId: project.id,
      passionId
    }
  });

  // Create timeline entry
  await prisma.timelineEntry.create({
    data: {
      studentId: session.user.id,
      passionId,
      entryType: "CUSTOM",
      title: `Started: ${title}`,
      description: description || null,
      date: new Date(),
      milestoneLevel: "MAJOR",
      tags: ["project"],
      metadata: { projectId: project.id },
      mediaUrls: [],
      xpAwarded: 25,
      isPublic: false
    }
  });

  redirect(`/projects/${project.id}`);
}
