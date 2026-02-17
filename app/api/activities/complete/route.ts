import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CompletionBody = {
  sourceType?: string;
  activityId?: string;
  title?: string;
  passionId?: string | null;
  notes?: string | null;
  minutesSpent?: number | null;
};

const XP_BY_SOURCE: Record<string, number> = {
  TRY_IT_SESSION: 10,
  TALENT_CHALLENGE: 20,
  PORTAL_CHALLENGE: 25,
  INCUBATOR_PROJECT: 25,
  PROJECT_TRACKER: 20,
};

async function awardActivityXp(
  userId: string,
  amount: number,
  reason: string,
  sourceType: string,
  sourceId: string,
  passionId: string | null
) {
  if (amount <= 0) return;

  await prisma.studentXP.upsert({
    where: { studentId: userId },
    create: {
      studentId: userId,
      totalXP: amount,
      currentLevel: 1,
      xpToNextLevel: 100,
    },
    update: {
      totalXP: { increment: amount },
    },
  });

  await prisma.xPTransaction.create({
    data: {
      studentId: userId,
      amount,
      reason,
      sourceType,
      sourceId,
      passionId: passionId ?? undefined,
    },
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CompletionBody;
  try {
    body = (await request.json()) as CompletionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sourceType = String(body.sourceType || "").trim();
  const activityId = String(body.activityId || "").trim();
  const title = String(body.title || "").trim() || "Activity";
  const passionId = body.passionId ? String(body.passionId) : null;
  const notes = body.notes ? String(body.notes) : null;
  const minutesSpent = Number.isFinite(Number(body.minutesSpent))
    ? Number(body.minutesSpent)
    : null;

  if (!sourceType || !activityId) {
    return NextResponse.json({ error: "sourceType and activityId are required" }, { status: 400 });
  }

  const userId = session.user.id;
  let timelineTitle = `Completed activity: ${title}`;
  let timelineType: "CHALLENGE_COMPLETED" | "PROJECT_COMPLETED" | "CUSTOM" = "CUSTOM";
  let timelinePassionId = passionId;
  let awardedXp = XP_BY_SOURCE[sourceType] ?? 0;

  try {
    if (sourceType === "TRY_IT_SESSION") {
      const sessionRecord = await prisma.tryItSession.findUnique({ where: { id: activityId } });
      if (!sessionRecord) {
        return NextResponse.json({ error: "Try-It session not found" }, { status: 404 });
      }

      await prisma.tryItSession.update({
        where: { id: activityId },
        data: { views: { increment: 1 } },
      });

      await prisma.sessionWatchHistory.upsert({
        where: { studentId_sessionId: { studentId: userId, sessionId: activityId } },
        create: {
          studentId: userId,
          sessionId: activityId,
          completed: true,
          watchTime: Math.max(0, Math.round((minutesSpent ?? sessionRecord.duration) * 60)),
        },
        update: {
          completed: true,
          watchTime: Math.max(0, Math.round((minutesSpent ?? sessionRecord.duration) * 60)),
          watchedAt: new Date(),
        },
      });

      timelineTitle = `Completed Try-It: ${sessionRecord.title}`;
      timelinePassionId = sessionRecord.passionId;
      await awardActivityXp(
        userId,
        awardedXp,
        timelineTitle,
        sourceType,
        activityId,
        sessionRecord.passionId
      );
    } else if (sourceType === "TALENT_CHALLENGE") {
      const challenge = await prisma.talentChallenge.findUnique({ where: { id: activityId } });
      if (!challenge) {
        return NextResponse.json({ error: "Talent challenge not found" }, { status: 404 });
      }

      const completion = await prisma.challengeCompletion.findUnique({
        where: {
          studentId_challengeId: {
            studentId: userId,
            challengeId: activityId,
          },
        },
      });

      if (!completion) {
        await prisma.challengeCompletion.create({
          data: {
            studentId: userId,
            challengeId: activityId,
            reflectionText: notes,
            discoveredPassions: challenge.passionIds,
          },
        });

        await prisma.talentChallenge.update({
          where: { id: activityId },
          data: { completions: { increment: 1 } },
        });
      }

      timelineType = "CHALLENGE_COMPLETED";
      timelineTitle = `Completed Talent Challenge: ${challenge.title}`;
      timelinePassionId = challenge.passionIds[0] ?? passionId;
      if (completion) {
        awardedXp = 0;
      }
      await awardActivityXp(
        userId,
        awardedXp,
        timelineTitle,
        sourceType,
        activityId,
        timelinePassionId
      );
    } else if (sourceType === "PROJECT_TRACKER") {
      const project = await prisma.projectTracker.findUnique({
        where: { id: activityId },
        select: { id: true, title: true, studentId: true, passionId: true },
      });
      if (!project || project.studentId !== userId) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      timelineType = "PROJECT_COMPLETED";
      timelineTitle = `Project progress logged: ${project.title}`;
      timelinePassionId = project.passionId;
      await awardActivityXp(
        userId,
        awardedXp,
        timelineTitle,
        sourceType,
        activityId,
        project.passionId
      );
    } else if (sourceType === "INCUBATOR_PROJECT") {
      const project = await prisma.incubatorProject.findUnique({
        where: { id: activityId },
        select: { id: true, title: true, studentId: true, passionArea: true },
      });
      if (!project || project.studentId !== userId) {
        return NextResponse.json({ error: "Incubator project not found" }, { status: 404 });
      }

      timelineType = "PROJECT_COMPLETED";
      timelineTitle = `Incubator progress logged: ${project.title}`;
      timelinePassionId = project.passionArea;
      await awardActivityXp(
        userId,
        awardedXp,
        timelineTitle,
        sourceType,
        activityId,
        project.passionArea
      );
    } else if (sourceType === "PORTAL_CHALLENGE") {
      const challenge = await prisma.challenge.findUnique({
        where: { id: activityId },
        select: { id: true, title: true, passionArea: true },
      });
      if (!challenge) {
        return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
      }

      timelineType = "CHALLENGE_COMPLETED";
      timelineTitle = `Completed challenge work: ${challenge.title}`;
      timelinePassionId = challenge.passionArea;
      await awardActivityXp(
        userId,
        awardedXp,
        timelineTitle,
        sourceType,
        activityId,
        challenge.passionArea
      );
    } else {
      await awardActivityXp(
        userId,
        awardedXp,
        timelineTitle,
        sourceType,
        activityId,
        passionId
      );
    }

    await prisma.timelineEntry.create({
      data: {
        studentId: userId,
        passionId: timelinePassionId ?? "general",
        entryType: timelineType,
        title: timelineTitle,
        description: notes,
        tags: [sourceType, "activity-hub"],
        mediaUrls: [],
        metadata: { activityId, sourceType, minutesSpent: minutesSpent ?? null },
        xpAwarded: awardedXp,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to record activity completion" },
      { status: 500 }
    );
  }
}
