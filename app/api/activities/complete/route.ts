import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

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

const ALLOWED_SOURCE_TYPES = new Set(Object.keys(XP_BY_SOURCE));

type DbClient = Prisma.TransactionClient | typeof prisma;

function toOptionalInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return null;
  return Math.round(parsed);
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveCanonicalPassionId(
  db: DbClient,
  value: string | null | undefined
): Promise<string | null> {
  const trimmed = toOptionalString(value);
  if (!trimmed) return null;

  const passion = await db.passionArea.findFirst({
    where: {
      isActive: true,
      OR: [
        { id: trimmed },
        { name: { equals: trimmed, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  return passion?.id ?? trimmed;
}

async function awardActivityXp(
  db: DbClient,
  userId: string,
  amount: number,
  reason: string,
  sourceType: string,
  sourceId: string,
  passionId: string | null
) {
  if (amount <= 0) return;

  await db.studentXP.upsert({
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

  await db.xPTransaction.create({
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

function isCompletionUniqueConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  if (!Array.isArray(error.meta?.target)) return false;
  const target = error.meta.target as string[];
  return (
    target.includes("studentId") &&
    target.includes("sourceType") &&
    target.includes("activityId")
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkRateLimit(
    `activities-complete:${session.user.id}`,
    40,
    10 * 60 * 1000
  );
  if (!rate.success) {
    return NextResponse.json(
      { error: "Too many completion requests. Please try again later." },
      { status: 429 }
    );
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
  const requestedPassionId = toOptionalString(body.passionId);
  const notes = toOptionalString(body.notes);
  const minutesSpent = toOptionalInt(body.minutesSpent);

  if (!sourceType || !activityId) {
    return NextResponse.json(
      { error: "sourceType and activityId are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_SOURCE_TYPES.has(sourceType)) {
    return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
  }

  const userId = session.user.id;
  const completionKey = {
    studentId: userId,
    sourceType,
    activityId,
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingCompletion = await tx.activityCompletion.findUnique({
        where: {
          studentId_sourceType_activityId: completionKey,
        },
        select: {
          id: true,
          awardedXp: true,
        },
      });

      if (existingCompletion) {
        return {
          success: true,
          awardedXp: 0,
          alreadyCompleted: true,
          completionId: existingCompletion.id,
        };
      }

      let timelineTitle = `Completed activity: ${title}`;
      let timelineType: "CHALLENGE_COMPLETED" | "PROJECT_COMPLETED" | "CUSTOM" =
        "CUSTOM";
      let timelinePassionId = await resolveCanonicalPassionId(tx, requestedPassionId);
      let awardedXp = XP_BY_SOURCE[sourceType] ?? 0;

      if (sourceType === "TRY_IT_SESSION") {
        const sessionRecord = await tx.tryItSession.findUnique({
          where: { id: activityId },
        });
        if (!sessionRecord) {
          throw new Error("Try-It session not found");
        }

        await tx.tryItSession.update({
          where: { id: activityId },
          data: { views: { increment: 1 } },
        });

        await tx.sessionWatchHistory.upsert({
          where: {
            studentId_sessionId: { studentId: userId, sessionId: activityId },
          },
          create: {
            studentId: userId,
            sessionId: activityId,
            completed: true,
            watchTime: Math.max(
              0,
              Math.round((minutesSpent ?? sessionRecord.duration) * 60)
            ),
          },
          update: {
            completed: true,
            watchTime: Math.max(
              0,
              Math.round((minutesSpent ?? sessionRecord.duration) * 60)
            ),
            watchedAt: new Date(),
          },
        });

        timelineTitle = `Completed Try-It: ${sessionRecord.title}`;
        timelinePassionId = await resolveCanonicalPassionId(tx, sessionRecord.passionId);
        await awardActivityXp(
          tx,
          userId,
          awardedXp,
          timelineTitle,
          sourceType,
          activityId,
          timelinePassionId
        );
      } else if (sourceType === "TALENT_CHALLENGE") {
        const challenge = await tx.talentChallenge.findUnique({
          where: { id: activityId },
        });
        if (!challenge) {
          throw new Error("Talent challenge not found");
        }

        const completion = await tx.challengeCompletion.findUnique({
          where: {
            studentId_challengeId: {
              studentId: userId,
              challengeId: activityId,
            },
          },
        });

        if (!completion) {
          await tx.challengeCompletion.create({
            data: {
              studentId: userId,
              challengeId: activityId,
              reflectionText: notes,
              discoveredPassions: challenge.passionIds,
            },
          });

          await tx.talentChallenge.update({
            where: { id: activityId },
            data: { completions: { increment: 1 } },
          });
        } else {
          awardedXp = 0;
        }

        timelineType = "CHALLENGE_COMPLETED";
        timelineTitle = `Completed Talent Challenge: ${challenge.title}`;
        timelinePassionId = await resolveCanonicalPassionId(
          tx,
          challenge.passionIds[0] ?? requestedPassionId
        );

        await awardActivityXp(
          tx,
          userId,
          awardedXp,
          timelineTitle,
          sourceType,
          activityId,
          timelinePassionId
        );
      } else if (sourceType === "PROJECT_TRACKER") {
        const project = await tx.projectTracker.findUnique({
          where: { id: activityId },
          select: { id: true, title: true, studentId: true, passionId: true },
        });
        if (!project || project.studentId !== userId) {
          throw new Error("Project not found");
        }

        timelineType = "PROJECT_COMPLETED";
        timelineTitle = `Project progress logged: ${project.title}`;
        timelinePassionId = await resolveCanonicalPassionId(tx, project.passionId);

        await awardActivityXp(
          tx,
          userId,
          awardedXp,
          timelineTitle,
          sourceType,
          activityId,
          timelinePassionId
        );
      } else if (sourceType === "INCUBATOR_PROJECT") {
        const project = await tx.incubatorProject.findUnique({
          where: { id: activityId },
          select: { id: true, title: true, studentId: true, passionArea: true },
        });
        if (!project || project.studentId !== userId) {
          throw new Error("Incubator project not found");
        }

        timelineType = "PROJECT_COMPLETED";
        timelineTitle = `Incubator progress logged: ${project.title}`;
        timelinePassionId = await resolveCanonicalPassionId(tx, project.passionArea);

        await awardActivityXp(
          tx,
          userId,
          awardedXp,
          timelineTitle,
          sourceType,
          activityId,
          timelinePassionId
        );
      } else if (sourceType === "PORTAL_CHALLENGE") {
        const challenge = await tx.challenge.findUnique({
          where: { id: activityId },
          select: { id: true, title: true, passionArea: true },
        });
        if (!challenge) {
          throw new Error("Challenge not found");
        }

        timelineType = "CHALLENGE_COMPLETED";
        timelineTitle = `Completed challenge work: ${challenge.title}`;
        timelinePassionId = await resolveCanonicalPassionId(tx, challenge.passionArea);

        await awardActivityXp(
          tx,
          userId,
          awardedXp,
          timelineTitle,
          sourceType,
          activityId,
          timelinePassionId
        );
      }

      const completion = await tx.activityCompletion.create({
        data: {
          studentId: userId,
          sourceType,
          activityId,
          title,
          passionId: timelinePassionId,
          notes,
          minutesSpent,
          awardedXp,
          metadata: {
            sourceType,
            activityId,
          },
        },
      });

      await tx.timelineEntry.create({
        data: {
          studentId: userId,
          passionId: timelinePassionId ?? "general",
          entryType: timelineType,
          title: timelineTitle,
          description: notes,
          tags: [sourceType, "activity-hub"],
          mediaUrls: [],
          metadata: {
            activityId,
            sourceType,
            completionId: completion.id,
            minutesSpent: minutesSpent ?? null,
          },
          xpAwarded: awardedXp,
        },
      });

      return {
        success: true,
        awardedXp,
        alreadyCompleted: false,
        completionId: completion.id,
      };
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (isCompletionUniqueConflict(error)) {
      const existing = await prisma.activityCompletion.findUnique({
        where: {
          studentId_sourceType_activityId: completionKey,
        },
        select: { id: true },
      });
      return NextResponse.json({
        success: true,
        awardedXp: 0,
        alreadyCompleted: true,
        completionId: existing?.id ?? null,
      });
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to record activity completion";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
