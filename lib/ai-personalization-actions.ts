"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { LEVELS } from "@/lib/xp-config";

type LearningPathMilestone = {
  week: number;
  goal: string;
  resources: string[];
  tasks: string[];
  isComplete: boolean;
  level: string;
};

// ============================================
// HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

// ============================================
// LEARNING PATH GENERATOR (Feature #8)
// ============================================

export async function generateLearningPath(formData: FormData) {
  const session = await requireAuth();
  const studentId = session.user.id;

  const passionArea = formData.get("passionArea") as string;
  const targetSkillLevel = formData.get("targetSkillLevel") as string || "intermediate";
  const timeframeDays = parseInt(formData.get("timeframeDays") as string) || 90;
  const weeklyHoursAvailable = parseInt(formData.get("weeklyHoursAvailable") as string) || 5;

  if (!passionArea) throw new Error("Passion area is required");

  // Gather student context for AI path generation
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      xp: true,
      level: true,
      enrollments: {
        include: { course: { select: { title: true, interestArea: true, level: true } } },
        where: { status: "COMPLETED" },
      },
      classEnrollments: {
        include: {
          offering: {
            include: { template: { select: { title: true, interestArea: true, difficultyLevel: true } } },
          },
        },
      },
      practiceLogs: {
        where: { passionId: passionArea },
        orderBy: { date: "desc" },
        take: 30,
        select: { duration: true, activity: true, skillsFocused: true, date: true },
      },
    },
  });

  // Calculate current skill level based on completed courses and practice
  const completedInArea = user?.enrollments.filter(
    (e) => e.course.interestArea === passionArea
  ).length || 0;
  const totalPracticeMinutes = user?.practiceLogs.reduce((sum, log) => sum + log.duration, 0) || 0;
  const avgWeeklyPractice = totalPracticeMinutes / 4; // Last month avg

  // Determine starting point
  let currentLevel = "beginner";
  if (completedInArea >= 3 || totalPracticeMinutes > 3000) currentLevel = "advanced";
  else if (completedInArea >= 1 || totalPracticeMinutes > 1000) currentLevel = "intermediate";

  // Generate milestones based on target and timeframe
  const totalWeeks = Math.ceil(timeframeDays / 7);
  const milestones = generateMilestones(
    passionArea,
    currentLevel,
    targetSkillLevel,
    totalWeeks,
    weeklyHoursAvailable
  );

  // Find recommended classes
  const recommendedClasses = await prisma.classOffering.findMany({
    where: {
      status: { in: ["PUBLISHED", "IN_PROGRESS"] },
      template: { interestArea: passionArea },
    },
    select: { id: true },
    take: 5,
    orderBy: { startDate: "asc" },
  });

  // Build practice goals
  const practiceGoals: Record<string, string> = {};
  if (weeklyHoursAvailable >= 7) {
    practiceGoals[passionArea] = "1 hour/day";
  } else if (weeklyHoursAvailable >= 3) {
    practiceGoals[passionArea] = `${Math.round(weeklyHoursAvailable / 3)} hours, 3x/week`;
  } else {
    practiceGoals[passionArea] = `${weeklyHoursAvailable} hours/week`;
  }

  const path = await prisma.learningPath.create({
    data: {
      studentId,
      passionArea,
      generatedBy: "ai",
      targetSkillLevel,
      timeframeDays,
      weeklyHoursAvailable,
      milestones,
      recommendedClasses: recommendedClasses.map((c) => c.id),
      practiceGoals,
      status: "ACTIVE",
      startedAt: new Date(),
    },
  });

  revalidatePath("/learn/path-generator");
  revalidatePath("/analytics");
  return { success: true, id: path.id };
}

function generateMilestones(
  passionArea: string,
  currentLevel: string,
  targetLevel: string,
  totalWeeks: number,
  weeklyHours: number
): LearningPathMilestone[] {
  const milestones: LearningPathMilestone[] = [];
  const levels = ["beginner", "intermediate", "advanced", "expert"];
  const startIdx = levels.indexOf(currentLevel);
  const endIdx = levels.indexOf(targetLevel);
  const levelsToProgress = Math.max(endIdx - startIdx, 1);
  const weeksPerLevel = Math.floor(totalWeeks / levelsToProgress);

  // Template activities per passion area
  const activities: Record<string, string[][]> = {
    Art: [
      ["Learn fundamental color theory", "Practice basic shapes and forms", "Study composition basics"],
      ["Explore mixed media techniques", "Develop personal style", "Create a series of related works"],
      ["Master advanced composition", "Build a cohesive portfolio", "Teach a beginner technique"],
      ["Create exhibition-quality work", "Develop artistic voice", "Mentor other artists"],
    ],
    Music: [
      ["Learn basic music theory", "Practice scales and chords daily", "Play simple songs"],
      ["Study rhythm and timing", "Learn improvisation basics", "Perform for small audience"],
      ["Compose original pieces", "Join ensemble or band", "Explore genre fusion"],
      ["Perform solo recitals", "Record original album", "Teach advanced techniques"],
    ],
    Writing: [
      ["Develop daily writing habit", "Study story structure", "Complete short pieces"],
      ["Explore different genres", "Develop voice and style", "Join writing group"],
      ["Write longer-form works", "Edit and revise critically", "Submit for publication"],
      ["Complete a major work", "Build author platform", "Mentor emerging writers"],
    ],
    default: [
      ["Explore fundamentals", "Build daily practice habit", "Learn core concepts"],
      ["Apply skills to projects", "Develop personal approach", "Seek peer feedback"],
      ["Create complex projects", "Share with community", "Refine technique"],
      ["Produce professional work", "Teach others", "Push creative boundaries"],
    ],
  };

  const areaActivities = activities[passionArea] || activities.default;

  for (let levelStep = 0; levelStep < levelsToProgress; levelStep++) {
    const levelIdx = Math.min(startIdx + levelStep, 3);
    const levelActivities = areaActivities[levelIdx];
    const startWeek = levelStep * weeksPerLevel + 1;

    for (let i = 0; i < Math.min(levelActivities.length, weeksPerLevel); i++) {
      const weekNum = startWeek + Math.floor((i * weeksPerLevel) / levelActivities.length);
      milestones.push({
        week: weekNum,
        goal: levelActivities[i],
        resources: [],
        tasks: [`Practice ${weeklyHours} hours this week`, levelActivities[i]],
        isComplete: false,
        level: levels[levelIdx],
      });
    }
  }

  // Add a final milestone
  milestones.push({
    week: totalWeeks,
    goal: `Reach ${targetLevel} level in ${passionArea}!`,
    resources: [],
    tasks: ["Reflect on your journey", "Celebrate your progress"],
    isComplete: false,
    level: targetLevel,
  });

  return milestones;
}

export async function updateLearningPathProgress(pathId: string, milestoneIndex: number) {
  const session = await requireAuth();

  const path = await prisma.learningPath.findUnique({ where: { id: pathId } });
  if (!path || path.studentId !== session.user.id) throw new Error("Not found");

  const milestones = (path.milestones as unknown as LearningPathMilestone[]) || [];
  if (milestoneIndex >= 0 && milestoneIndex < milestones.length) {
    milestones[milestoneIndex].isComplete = !milestones[milestoneIndex].isComplete;
  }

  const completed = milestones.filter((m) => m.isComplete).length;
  const completionPct = milestones.length > 0 ? (completed / milestones.length) * 100 : 0;
  const allComplete = completed === milestones.length;

  await prisma.learningPath.update({
    where: { id: pathId },
    data: {
      milestones,
      currentMilestone: milestoneIndex,
      completionPct,
      ...(allComplete ? { status: "COMPLETED", completedAt: new Date() } : {}),
    },
  });

  revalidatePath("/learn/path-generator");
  revalidatePath("/analytics");
  return { success: true };
}

export async function pauseLearningPath(pathId: string) {
  const session = await requireAuth();
  const path = await prisma.learningPath.findUnique({ where: { id: pathId } });
  if (!path || path.studentId !== session.user.id) throw new Error("Not found");

  const newStatus = path.status === "PAUSED" ? "ACTIVE" : "PAUSED";
  await prisma.learningPath.update({
    where: { id: pathId },
    data: { status: newStatus },
  });

  revalidatePath("/learn/path-generator");
  return { success: true };
}

// ============================================
// ANALYTICS SNAPSHOT GENERATION (Feature #22)
// ============================================

export async function generateAnalyticsSnapshot(studentId: string) {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { xp: true, level: true },
  });
  if (!user) throw new Error("User not found");

  // Practice logs this week and last week
  const practiceThisWeek = await prisma.practiceLog.findMany({
    where: { studentId, date: { gte: oneWeekAgo } },
    select: { duration: true, date: true, passionId: true },
  });
  const practiceLastWeek = await prisma.practiceLog.findMany({
    where: { studentId, date: { gte: twoWeeksAgo, lt: oneWeekAgo } },
    select: { duration: true },
  });
  const practiceThisMonth = await prisma.practiceLog.findMany({
    where: { studentId, date: { gte: oneMonthAgo } },
    select: { duration: true, date: true },
  });

  const practiceMinutesThisWeek = practiceThisWeek.reduce((s, l) => s + l.duration, 0);
  const practiceMinutesLastWeek = practiceLastWeek.reduce((s, l) => s + l.duration, 0);
  const practiceMinutesAvg = practiceThisMonth.length > 0
    ? practiceThisMonth.reduce((s, l) => s + l.duration, 0) / 4
    : 0;

  // Active passions
  const uniquePassions = new Set(practiceThisWeek.map((l) => l.passionId));

  // Productivity patterns
  const dayCount: Record<string, number> = {};
  const hourCount: Record<number, number> = {};
  const sessionLengths: number[] = [];

  for (const log of practiceThisMonth) {
    const day = new Date(log.date).toLocaleDateString("en-US", { weekday: "long" });
    dayCount[day] = (dayCount[day] || 0) + log.duration;
    const hour = new Date(log.date).getHours();
    hourCount[hour] = (hourCount[hour] || 0) + log.duration;
    sessionLengths.push(log.duration);
  }

  const mostProductiveDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const mostProductiveHour = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]
    ? parseInt(Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0][0])
    : null;
  const preferredSessionLength = sessionLengths.length > 0
    ? Math.round(sessionLengths.reduce((s, v) => s + v, 0) / sessionLengths.length)
    : null;

  // Streak calculation
  let currentStreak = 0;
  let longestStreak = 0;
  const dates = practiceThisMonth
    .map((l) => new Date(l.date).toDateString())
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort()
    .reverse();

  if (dates.length > 0) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime();
      if (diff <= 86400000 * 1.5) {
        currentStreak++;
      } else break;
    }
    // Longest streak (simplified)
    longestStreak = currentStreak;
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime();
      if (diff <= 86400000 * 1.5) {
        streak++;
        longestStreak = Math.max(longestStreak, streak);
      } else {
        streak = 1;
      }
    }
  }

  // Class engagement
  const classesEnrolled = await prisma.classEnrollment.count({
    where: { studentId, status: "ENROLLED" },
  });
  const classesCompleted = await prisma.classEnrollment.count({
    where: { studentId, status: "COMPLETED" },
  });

  // Assignments
  const assignmentsCompleted = await prisma.classAssignmentSubmission.count({
    where: { studentId, status: { in: ["SUBMITTED", "FEEDBACK_GIVEN"] } },
  });

  // Average enjoyment
  const enjoymentSubs = await prisma.classAssignmentSubmission.findMany({
    where: { studentId, enjoymentRating: { not: null } },
    select: { enjoymentRating: true },
  });
  const averageEnjoymentRating = enjoymentSubs.length > 0
    ? enjoymentSubs.reduce((s, e) => s + (e.enjoymentRating || 0), 0) / enjoymentSubs.length
    : null;

  // XP this week
  const xpThisWeek = await prisma.xpTransaction.aggregate({
    where: { userId: studentId, createdAt: { gte: oneWeekAgo } },
    _sum: { amount: true },
  });
  const xpLastWeek = await prisma.xpTransaction.aggregate({
    where: { userId: studentId, createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } },
    _sum: { amount: true },
  });

  const snapshot = await prisma.analyticsSnapshot.create({
    data: {
      studentId,
      totalXP: user.xp,
      level: user.level,
      activePassions: uniquePassions.size,
      practiceMinutesThisWeek,
      practiceMinutesLastWeek,
      practiceMinutesAvg,
      longestStreak,
      currentStreak,
      mostProductiveDay,
      mostProductiveHour,
      preferredSessionLength,
      totalSessionsThisMonth: practiceThisMonth.length,
      classesEnrolled,
      classesCompleted,
      assignmentsCompleted,
      averageEnjoymentRating,
      xpGainedThisWeek: xpThisWeek._sum.amount || 0,
      xpGainedLastWeek: xpLastWeek._sum.amount || 0,
    },
  });

  return snapshot;
}

// ============================================
// PROGRESS PREDICTIONS (Feature #25)
// ============================================

export async function generateProgressPredictions(studentId: string) {
  const user = await prisma.user.findUnique({
    where: { id: studentId },
    select: { xp: true, level: true },
  });
  if (!user) throw new Error("User not found");

  // Get recent XP rate
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentXP = await prisma.xpTransaction.aggregate({
    where: { userId: studentId, createdAt: { gte: thirtyDaysAgo } },
    _sum: { amount: true },
  });
  const monthlyXPRate = recentXP._sum.amount || 0;
  const weeklyXPRate = monthlyXPRate / 4;

  const predictions: {
    predictionType: "LEVEL_UP" | "SKILL_MASTERY" | "COURSE_COMPLETION" | "STREAK_MILESTONE";
    title: string;
    description: string;
    currentValue: number;
    targetValue: number;
    progressPct: number;
    predictedDate: Date;
    confidence: number;
    assumedWeeklyHours: number;
    passionArea?: string;
  }[] = [];

  // Level-up prediction
  const nextLevel = LEVELS.find((l) => l.level === user.level + 1);
  if (nextLevel && weeklyXPRate > 0) {
    const xpNeeded = nextLevel.xpRequired - user.xp;
    const weeksToLevel = xpNeeded / weeklyXPRate;
    const predictedDate = new Date(Date.now() + weeksToLevel * 7 * 24 * 60 * 60 * 1000);

    predictions.push({
      predictionType: "LEVEL_UP",
      title: `Reach Level ${nextLevel.level}: ${nextLevel.title}`,
      description: `At your current pace of ~${Math.round(weeklyXPRate)} XP/week, you'll reach ${nextLevel.title} status.`,
      currentValue: user.xp,
      targetValue: nextLevel.xpRequired,
      progressPct: (user.xp / nextLevel.xpRequired) * 100,
      predictedDate,
      confidence: weeksToLevel <= 4 ? 0.9 : weeksToLevel <= 12 ? 0.7 : 0.5,
      assumedWeeklyHours: 5,
    });
  }

  // Practice streak prediction
  const recentLogs = await prisma.practiceLog.findMany({
    where: { studentId, date: { gte: thirtyDaysAgo } },
    select: { date: true },
  });
  const uniqueDays = new Set(recentLogs.map((l) => new Date(l.date).toDateString())).size;
  const practiceFrequency = uniqueDays / 30; // % of days practiced

  if (practiceFrequency > 0.3) {
    const daysToThirty = Math.ceil((30 - uniqueDays) / practiceFrequency);
    predictions.push({
      predictionType: "STREAK_MILESTONE",
      title: "30-Day Practice Streak",
      description: `You've practiced ${uniqueDays} of the last 30 days. Keep it up!`,
      currentValue: uniqueDays,
      targetValue: 30,
      progressPct: (uniqueDays / 30) * 100,
      predictedDate: new Date(Date.now() + daysToThirty * 24 * 60 * 60 * 1000),
      confidence: practiceFrequency > 0.7 ? 0.8 : 0.5,
      assumedWeeklyHours: 5,
    });
  }

  // Course completion predictions
  const activeEnrollments = await prisma.classEnrollment.findMany({
    where: { studentId, status: "ENROLLED" },
    include: {
      offering: {
        include: {
          template: { select: { interestArea: true, durationWeeks: true } },
          sessions: { select: { date: true, isCancelled: true } },
        },
      },
    },
  });

  for (const enrollment of activeEnrollments.slice(0, 3)) {
    const totalSessions = enrollment.offering.sessions.filter((s) => !s.isCancelled).length;
    const attended = enrollment.sessionsAttended;
    if (totalSessions > 0 && attended > 0) {
      const remaining = totalSessions - attended;
      const avgDaysBetweenSessions = 7;
      const predictedDate = new Date(Date.now() + remaining * avgDaysBetweenSessions * 24 * 60 * 60 * 1000);

      predictions.push({
        predictionType: "COURSE_COMPLETION",
        title: `Complete: ${enrollment.offering.title}`,
        description: `${attended}/${totalSessions} sessions attended. ${remaining} sessions remaining.`,
        currentValue: attended,
        targetValue: totalSessions,
        progressPct: (attended / totalSessions) * 100,
        predictedDate,
        confidence: 0.75,
        assumedWeeklyHours: 2,
        passionArea: enrollment.offering.template.interestArea,
      });
    }
  }

  // Save predictions (delete old ones first)
  await prisma.progressPrediction.deleteMany({ where: { studentId } });

  if (predictions.length > 0) {
    await prisma.progressPrediction.createMany({
      data: predictions.map((p) => ({
        studentId,
        ...p,
      })),
    });
  }

  return predictions;
}

// ============================================
// QUERY HELPERS
// ============================================

export async function getStudentAnalytics(studentId: string) {
  // Get or create latest snapshot
  const latestSnapshot = await prisma.analyticsSnapshot.findFirst({
    where: { studentId },
    orderBy: { date: "desc" },
  });

  // If snapshot is older than 1 hour, regenerate
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  let snapshot = latestSnapshot;
  if (!latestSnapshot || new Date(latestSnapshot.date) < oneHourAgo) {
    try {
      snapshot = await generateAnalyticsSnapshot(studentId);
    } catch {
      snapshot = latestSnapshot;
    }
  }

  // Get historical snapshots for trends
  const historicalSnapshots = await prisma.analyticsSnapshot.findMany({
    where: { studentId },
    orderBy: { date: "desc" },
    take: 12, // Last 12 snapshots
  });

  // Get active learning paths
  const learningPaths = await prisma.learningPath.findMany({
    where: { studentId, status: { in: ["ACTIVE", "PAUSED"] } },
    orderBy: { updatedAt: "desc" },
  });

  // Get predictions
  let predictions = await prisma.progressPrediction.findMany({
    where: { studentId },
    orderBy: { predictedDate: "asc" },
  });

  // Regenerate if empty or stale
  if (predictions.length === 0) {
    try {
      await generateProgressPredictions(studentId);
      predictions = await prisma.progressPrediction.findMany({
        where: { studentId },
        orderBy: { predictedDate: "asc" },
      });
    } catch {
      // ok, use empty
    }
  }

  return { snapshot, historicalSnapshots, learningPaths, predictions };
}

export async function getStudentLearningPaths(studentId: string) {
  return prisma.learningPath.findMany({
    where: { studentId },
    orderBy: { updatedAt: "desc" },
  });
}
