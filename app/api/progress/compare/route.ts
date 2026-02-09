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
  const beforeDate = formData.get("beforeDate") as string;
  const afterDate = formData.get("afterDate") as string;
  const improvementsText = formData.get("improvements") as string;
  const skillsGainedText = formData.get("skillsGained") as string;
  const reflection = formData.get("reflection") as string;
  const isPublic = formData.get("isPublic") === "true";

  // Parse improvements and skills (assume newline-separated)
  const improvements = improvementsText
    ? improvementsText.split("\n").filter(i => i.trim())
    : [];
  const skillsGained = skillsGainedText
    ? skillsGainedText.split("\n").filter(s => s.trim())
    : [];

  // In production, handle actual file uploads for before/after media
  const beforeMediaUrl = "placeholder-before.jpg";
  const afterMediaUrl = "placeholder-after.jpg";

  // Create comparison
  const comparison = await prisma.progressComparison.create({
    data: {
      studentId: session.user.id,
      passionId,
      title,
      description: description || null,
      beforeDate: new Date(beforeDate),
      afterDate: new Date(afterDate),
      beforeMediaUrl,
      afterMediaUrl,
      improvements,
      skillsGained,
      reflectionText: reflection || null,
      xpAwarded: 60,
      isPublic,
      likes: 0
    }
  });

  // Award XP for documenting progress
  await prisma.studentXP.upsert({
    where: { studentId: session.user.id },
    create: {
      studentId: session.user.id,
      totalXP: 60,
      currentLevel: 1,
      xpToNextLevel: 100
    },
    update: {
      totalXP: { increment: 60 }
    }
  });

  await prisma.xPTransaction.create({
    data: {
      studentId: session.user.id,
      amount: 60,
      reason: `Progress comparison: ${title}`,
      sourceType: "PROGRESS_COMPARISON",
      sourceId: comparison.id,
      passionId
    }
  });

  // Create timeline entry
  await prisma.timelineEntry.create({
    data: {
      studentId: session.user.id,
      passionId,
      entryType: "BREAKTHROUGH_MOMENT",
      title: `Progress Achievement: ${title}`,
      description: `Documented significant improvement: ${improvements[0] || "Multiple improvements"}`,
      date: new Date(afterDate),
      milestoneLevel: "BREAKTHROUGH",
      tags: ["progress", "growth"],
      metadata: { comparisonId: comparison.id },
      mediaUrls: [beforeMediaUrl, afterMediaUrl],
      xpAwarded: 60,
      isPublic
    }
  });

  redirect("/profile/progress-gallery");
}
