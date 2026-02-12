"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

const XP_PER_PRACTICE = 10;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch the current user's recent practice logs, newest first. */
export async function getMyPracticeLogs(limit = 20) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];

  return prisma.practiceLog.findMany({
    where: { studentId: session.user.id },
    orderBy: { date: "desc" },
    take: limit,
  });
}

/** Aggregate stats for the current user's practice. */
export async function getMyPracticeStats() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { sessionsThisMonth: 0, totalMinutes: 0, streak: 0 };
  }

  const userId = session.user.id;

  // Sessions this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [sessionsThisMonth, allLogs] = await Promise.all([
    prisma.practiceLog.count({
      where: { studentId: userId, date: { gte: startOfMonth } },
    }),
    // For total minutes & streak we need a broader set
    prisma.practiceLog.findMany({
      where: { studentId: userId },
      select: { duration: true, date: true },
      orderBy: { date: "desc" },
    }),
  ]);

  // Total minutes across all time
  const totalMinutes = allLogs.reduce(
    (sum: number, log: { duration: number }) => sum + log.duration,
    0,
  );

  // Current streak: count consecutive days with at least one log, starting from today
  const streak = calculateStreak(
    allLogs.map((l: { date: Date }) => l.date),
  );

  return { sessionsThisMonth, totalMinutes, streak };
}

/** Get unique passion IDs the user has practiced. */
export async function getMyPracticePassions() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];

  const logs = await prisma.practiceLog.findMany({
    where: { studentId: session.user.id },
    select: { passionId: true },
    distinct: ["passionId"],
  });
  return logs.map((l: { passionId: string }) => l.passionId);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Log a new practice session and award XP. */
export async function logPractice(formData: FormData) {
  const session = await requireUser();
  const userId = session.user.id as string;

  const passionId = formData.get("passionId") as string;
  const activity = formData.get("activity") as string;
  const durationStr = formData.get("duration") as string;
  const mood = formData.get("mood") as string | null;
  const notes = formData.get("notes") as string | null;

  if (!passionId || !activity || !durationStr) {
    throw new Error("Missing required fields");
  }

  const duration = parseInt(durationStr, 10);
  if (isNaN(duration) || duration < 1) {
    throw new Error("Duration must be at least 1 minute");
  }

  // Create the practice log
  await prisma.practiceLog.create({
    data: {
      studentId: userId,
      passionId,
      activity,
      duration,
      mood: mood || undefined,
      notes: notes || undefined,
    },
  });

  // Award XP
  try {
    await prisma.xpTransaction.create({
      data: {
        userId,
        amount: XP_PER_PRACTICE,
        reason: "Logged practice session",
        metadata: { type: "PRACTICE", activity, duration },
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: XP_PER_PRACTICE } },
    });
  } catch {
    // XP system may not be fully configured — non-critical
  }

  revalidatePath("/learn/practice");
}

// ---------------------------------------------------------------------------
// Streak calculation
// ---------------------------------------------------------------------------

function calculateStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  // Normalize to date-only strings in local time, deduplicate
  const uniqueDays = [
    ...new Set(
      dates.map((d) => {
        const dt = new Date(d);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      }),
    ),
  ].sort().reverse(); // most recent first

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // The streak must include today or yesterday to be "active"
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (uniqueDays[0] !== todayStr && uniqueDays[0] !== yesterdayStr) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diffMs = prev.getTime() - curr.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
