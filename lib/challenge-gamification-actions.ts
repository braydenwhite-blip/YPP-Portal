"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ============================================
// HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

function extractRoleSet(session: any): Set<string> {
  const roles = new Set<string>();
  const primaryRole = session?.user?.primaryRole;
  if (typeof primaryRole === "string" && primaryRole) {
    roles.add(primaryRole);
  }

  const rawRoles = session?.user?.roles;
  if (Array.isArray(rawRoles)) {
    for (const role of rawRoles) {
      if (typeof role === "string" && role) roles.add(role);
      if (role && typeof role === "object" && typeof role.role === "string") {
        roles.add(role.role);
      }
    }
  }

  return roles;
}

async function requireAnyRole(requiredRoles: string[]) {
  const session = await requireAuth();
  const roleSet = extractRoleSet(session);
  const allowed = requiredRoles.some((role) => roleSet.has(role));
  if (!allowed) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ============================================
// CHALLENGES (Features #12, #21)
// ============================================

export async function createChallenge(formData: FormData) {
  const session = await requireAnyRole(["ADMIN", "INSTRUCTOR"]);

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const type = formData.get("type") as "DAILY" | "WEEKLY" | "THIRTY_DAY" | "SEASONAL";
  const passionArea = formData.get("passionArea") as string || null;
  const startDate = new Date(formData.get("startDate") as string);
  const endDate = new Date(formData.get("endDate") as string);
  const dailyGoal = formData.get("dailyGoal") as string || null;
  const weeklyGoal = formData.get("weeklyGoal") as string || null;
  const submissionRequired = formData.get("submissionRequired") === "true";
  const xpReward = parseInt(formData.get("xpReward") as string) || 50;
  const showLeaderboard = formData.get("showLeaderboard") !== "false";
  const promptText = formData.get("promptText") as string || null;
  const votingEnabled = formData.get("votingEnabled") === "true";
  const specialRecognition = formData.get("specialRecognition") as string || null;

  if (!title || !description || !type) {
    throw new Error("Title, description, and type are required");
  }

  const challenge = await prisma.challenge.create({
    data: {
      title,
      description,
      type,
      passionArea,
      startDate,
      endDate,
      dailyGoal,
      weeklyGoal,
      submissionRequired,
      xpReward,
      showLeaderboard,
      promptText,
      votingEnabled,
      specialRecognition,
      createdById: session.user.id,
      status: "DRAFT",
    },
  });

  revalidatePath("/challenges");
  revalidatePath("/admin/challenges");
  return challenge;
}

export async function publishChallenge(challengeId: string) {
  await requireAnyRole(["ADMIN", "INSTRUCTOR"]);

  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: "ACTIVE" },
  });

  revalidatePath("/challenges");
  revalidatePath("/admin/challenges");
}

export async function unpublishChallenge(challengeId: string) {
  await requireAnyRole(["ADMIN", "INSTRUCTOR"]);

  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: "DRAFT" },
  });

  revalidatePath("/challenges");
  revalidatePath("/admin/challenges");
}

export async function archiveChallenge(challengeId: string) {
  await requireAnyRole(["ADMIN", "INSTRUCTOR"]);

  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: "ARCHIVED" },
  });

  revalidatePath("/challenges");
  revalidatePath("/admin/challenges");
}

export async function updateChallenge(formData: FormData) {
  await requireAnyRole(["ADMIN", "INSTRUCTOR"]);

  const challengeId = formData.get("challengeId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const passionArea = (formData.get("passionArea") as string) || null;
  const startDateRaw = formData.get("startDate") as string;
  const endDateRaw = formData.get("endDate") as string;
  const xpReward = parseInt(formData.get("xpReward") as string, 10);
  const dailyGoal = (formData.get("dailyGoal") as string) || null;
  const weeklyGoal = (formData.get("weeklyGoal") as string) || null;
  const promptText = (formData.get("promptText") as string) || null;
  const specialRecognition = (formData.get("specialRecognition") as string) || null;

  if (!challengeId || !title || !description) {
    throw new Error("Challenge id, title, and description are required");
  }

  await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      title,
      description,
      passionArea,
      startDate: startDateRaw ? new Date(startDateRaw) : undefined,
      endDate: endDateRaw ? new Date(endDateRaw) : undefined,
      xpReward: Number.isFinite(xpReward) && xpReward > 0 ? xpReward : 50,
      dailyGoal,
      weeklyGoal,
      promptText,
      specialRecognition,
    },
  });

  revalidatePath("/challenges");
  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/admin/challenges");
}

export async function joinChallenge(challengeId: string) {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);

  // Check not already joined
  const existing = await prisma.challengeParticipant.findUnique({
    where: { challengeId_studentId: { challengeId, studentId: session.user.id } },
  });
  if (existing) throw new Error("Already joined this challenge");

  // Check challenge is active
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });
  if (!challenge || challenge.status !== "ACTIVE") {
    throw new Error("Challenge is not active");
  }

  await prisma.challengeParticipant.create({
    data: {
      challengeId,
      studentId: session.user.id,
    },
  });

  revalidatePath("/challenges");
}

export async function dropChallenge(challengeId: string) {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);

  await prisma.challengeParticipant.update({
    where: { challengeId_studentId: { challengeId, studentId: session.user.id } },
    data: { status: "DROPPED" },
  });

  revalidatePath("/challenges");
}

export async function checkInChallenge(formData: FormData) {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);
  const challengeId = formData.get("challengeId") as string;
  const minutesPracticed = parseInt(formData.get("minutesPracticed") as string) || 0;
  const reflection = formData.get("reflection") as string || null;
  const workUrl = formData.get("workUrl") as string || null;
  const title = formData.get("title") as string || null;
  const description = formData.get("description") as string || null;

  // Get participant
  const participant = await prisma.challengeParticipant.findUnique({
    where: { challengeId_studentId: { challengeId, studentId: session.user.id } },
  });
  if (!participant || participant.status !== "ACTIVE") {
    throw new Error("Not an active participant");
  }

  // Check if already checked in today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingToday = await prisma.challengeSubmission.findFirst({
    where: {
      challengeId,
      studentId: session.user.id,
      submittedAt: { gte: today, lt: tomorrow },
    },
  });

  if (existingToday) {
    throw new Error("Already checked in today");
  }

  // Create submission
  const newDaysCompleted = participant.daysCompleted + 1;
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  const totalDays = challenge
    ? Math.ceil((challenge.endDate.getTime() - challenge.startDate.getTime()) / (1000 * 60 * 60 * 24))
    : 30;

  await prisma.challengeSubmission.create({
    data: {
      challengeId,
      studentId: session.user.id,
      title,
      description,
      workUrl,
      dayNumber: newDaysCompleted,
      minutesPracticed,
      reflection,
    },
  });

  // Update participant streak and progress
  const wasYesterday = participant.lastCheckIn
    ? new Date(participant.lastCheckIn).toDateString() ===
      new Date(Date.now() - 86400000).toDateString()
    : false;

  const newStreak = wasYesterday ? participant.currentStreak + 1 : 1;
  const newLongest = Math.max(participant.longestStreak, newStreak);
  const progress = Math.min(newDaysCompleted / totalDays, 1);

  const isComplete = progress >= 1;

  await prisma.challengeParticipant.update({
    where: { id: participant.id },
    data: {
      daysCompleted: newDaysCompleted,
      currentStreak: newStreak,
      longestStreak: newLongest,
      totalProgress: progress,
      lastCheckIn: new Date(),
      status: isComplete ? "COMPLETED" : "ACTIVE",
      completedAt: isComplete ? new Date() : null,
    },
  });

  // Award XP on completion
  if (isComplete && challenge) {
    await prisma.xpTransaction.create({
      data: {
        userId: session.user.id,
        amount: challenge.xpReward,
        reason: `Completed challenge: ${challenge.title}`,
      },
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { xp: { increment: challenge.xpReward } },
    });
  }

  // Update leaderboard ranks for this challenge
  await updateLeaderboard(challengeId);

  revalidatePath("/challenges");
  return { isComplete, daysCompleted: newDaysCompleted, streak: newStreak };
}

async function updateLeaderboard(challengeId: string) {
  const participants = await prisma.challengeParticipant.findMany({
    where: { challengeId, status: { in: ["ACTIVE", "COMPLETED"] } },
    orderBy: [{ daysCompleted: "desc" }, { longestStreak: "desc" }],
  });

  for (let i = 0; i < participants.length; i++) {
    await prisma.challengeParticipant.update({
      where: { id: participants[i].id },
      data: { leaderboardRank: i + 1 },
    });
  }
}

// ============================================
// WEEKLY CHALLENGE VOTING (Feature #21)
// ============================================

export async function submitWeeklyWork(formData: FormData) {
  const session = await requireAnyRole(["STUDENT", "ADMIN"]);
  const challengeId = formData.get("challengeId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string || null;
  const workUrl = formData.get("workUrl") as string || null;
  const mediaUrl = formData.get("mediaUrl") as string || null;

  if (!title) throw new Error("Title is required");

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.type !== "WEEKLY") {
    throw new Error("Not a weekly challenge");
  }

  const submission = await prisma.challengeSubmission.create({
    data: {
      challengeId,
      studentId: session.user.id,
      title,
      description,
      workUrl,
      mediaUrl,
    },
  });

  revalidatePath("/challenges/weekly");
  return submission;
}

export async function voteForSubmission(submissionId: string) {
  await requireAuth();

  await prisma.challengeSubmission.update({
    where: { id: submissionId },
    data: { voteCount: { increment: 1 } },
  });

  revalidatePath("/challenges/weekly");
}

// ============================================
// PASSION PASSPORT (Feature #20)
// ============================================

const PASSION_SUB_AREAS: Record<string, string[]> = {
  Art: ["Drawing", "Painting", "Sculpture", "Digital Art", "Photography", "Printmaking", "Mixed Media", "Ceramics"],
  Music: ["Guitar", "Piano", "Vocals", "Drums", "Bass", "Music Production", "Music Theory", "Songwriting"],
  Writing: ["Poetry", "Short Stories", "Journalism", "Screenwriting", "Blogging", "Creative Nonfiction", "Novel Writing", "Playwriting"],
  Dance: ["Ballet", "Hip Hop", "Contemporary", "Jazz", "Tap", "Ballroom", "Choreography", "Cultural Dance"],
  Theater: ["Acting", "Directing", "Stage Design", "Improv", "Monologues", "Musical Theater", "Playwriting", "Stage Management"],
  Film: ["Cinematography", "Editing", "Directing", "Screenwriting", "Animation", "Documentary", "Sound Design", "VFX"],
  Coding: ["Web Dev", "Mobile Apps", "Game Dev", "Data Science", "AI/ML", "Cybersecurity", "Design", "Open Source"],
  Science: ["Biology", "Chemistry", "Physics", "Astronomy", "Environmental", "Robotics", "Engineering", "Research"],
};

export async function getPassionPassports() {
  const session = await requireAuth();

  const passports = await prisma.passionPassport.findMany({
    where: { studentId: session.user.id },
    include: { stamps: { orderBy: { earnedAt: "desc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return { passports, subAreas: PASSION_SUB_AREAS };
}

export async function createPassport(passionArea: string) {
  const session = await requireAuth();

  const existing = await prisma.passionPassport.findUnique({
    where: { studentId_passionArea: { studentId: session.user.id, passionArea } },
  });
  if (existing) throw new Error("Passport already exists for this area");

  const passport = await prisma.passionPassport.create({
    data: {
      studentId: session.user.id,
      passionArea,
    },
    include: { stamps: true },
  });

  revalidatePath("/challenges/passport");
  return passport;
}

export async function earnStamp(formData: FormData) {
  const session = await requireAuth();
  const passportId = formData.get("passportId") as string;
  const subArea = formData.get("subArea") as string;
  const earnedBy = formData.get("earnedBy") as "TRY_IT" | "CLASS" | "PROJECT" | "PRACTICE_HOURS";
  const evidence = formData.get("evidence") as string || null;
  const hoursLogged = parseInt(formData.get("hoursLogged") as string) || null;
  const description = formData.get("description") as string || null;

  if (!passportId || !subArea || !earnedBy) {
    throw new Error("Passport, sub-area, and method are required");
  }

  // Verify ownership
  const passport = await prisma.passionPassport.findFirst({
    where: { id: passportId, studentId: session.user.id },
  });
  if (!passport) throw new Error("Passport not found");

  // Check if stamp already earned
  const existing = await prisma.passportStamp.findUnique({
    where: { passportId_subArea: { passportId, subArea } },
  });
  if (existing) throw new Error("Already earned this stamp");

  await prisma.passportStamp.create({
    data: {
      passportId,
      subArea,
      earnedBy,
      evidence,
      hoursLogged,
      description,
    },
  });

  // Update passport totals
  const totalSubAreas = PASSION_SUB_AREAS[passport.passionArea]?.length || 8;
  const newTotal = passport.totalStamps + 1;

  await prisma.passionPassport.update({
    where: { id: passportId },
    data: {
      totalStamps: newTotal,
      completionPercentage: (newTotal / totalSubAreas) * 100,
    },
  });

  // Award XP for exploration
  await prisma.xpTransaction.create({
    data: {
      userId: session.user.id,
      amount: 15,
      reason: `Earned passport stamp: ${subArea} in ${passport.passionArea}`,
    },
  });
  await prisma.user.update({
    where: { id: session.user.id },
    data: { xp: { increment: 15 } },
  });

  revalidatePath("/challenges/passport");
  return { newTotal, completion: (newTotal / totalSubAreas) * 100 };
}

// ============================================
// SEASONAL COMPETITIONS (Feature #18)
// ============================================

export async function getCompetitions() {
  const session = await requireAuth();

  const competitions = await prisma.seasonalCompetition.findMany({
    include: {
      entries: {
        include: { student: { select: { id: true, name: true } } },
        orderBy: { finalScore: "desc" },
      },
      _count: { select: { entries: true, votes: true } },
    },
    orderBy: { startDate: "desc" },
  });

  // Check which ones user has entered
  const myEntries = await prisma.competitionEntry.findMany({
    where: { studentId: session.user.id },
    select: { competitionId: true, id: true },
  });
  const myEntryMap = Object.fromEntries(myEntries.map((e) => [e.competitionId, e.id]));

  return { competitions, myEntryMap };
}

export async function submitCompetitionEntry(formData: FormData) {
  const session = await requireAuth();
  const competitionId = formData.get("competitionId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string || null;
  const workUrl = formData.get("workUrl") as string || null;
  const mediaUrl = formData.get("mediaUrl") as string || null;

  if (!competitionId || !title) {
    throw new Error("Competition and title are required");
  }

  const competition = await prisma.seasonalCompetition.findUnique({
    where: { id: competitionId },
  });
  if (!competition || competition.status !== "OPEN_FOR_SUBMISSIONS") {
    throw new Error("Competition is not accepting submissions");
  }

  if (new Date() > competition.submissionDeadline) {
    throw new Error("Submission deadline has passed");
  }

  const entry = await prisma.competitionEntry.create({
    data: {
      competitionId,
      studentId: session.user.id,
      title,
      description,
      workUrl,
      mediaUrl,
    },
  });

  revalidatePath("/competitions");
  return entry;
}

export async function voteOnCompetitionEntry(formData: FormData) {
  const session = await requireAuth();
  const entryId = formData.get("entryId") as string;
  const score = parseInt(formData.get("score") as string);
  const comment = formData.get("comment") as string || null;

  if (!entryId || !score || score < 1 || score > 5) {
    throw new Error("Entry and score (1-5) are required");
  }

  const entry = await prisma.competitionEntry.findUnique({
    where: { id: entryId },
    include: { competition: true },
  });
  if (!entry) throw new Error("Entry not found");
  if (entry.studentId === session.user.id) throw new Error("Cannot vote for your own entry");
  if (entry.competition.status !== "VOTING") throw new Error("Competition is not in voting phase");

  await prisma.competitionVote.upsert({
    where: { entryId_voterId: { entryId, voterId: session.user.id } },
    create: {
      competitionId: entry.competitionId,
      entryId,
      voterId: session.user.id,
      score,
      comment,
    },
    update: { score, comment },
  });

  // Recalculate community score for entry
  const votes = await prisma.competitionVote.aggregate({
    where: { entryId },
    _avg: { score: true },
  });

  await prisma.competitionEntry.update({
    where: { id: entryId },
    data: { communityScore: votes._avg.score },
  });

  revalidatePath("/competitions");
}

// ============================================
// ACHIEVEMENT RARITY (Feature #19)
// ============================================

export async function getBadgesWithRarity() {
  const session = await requireAuth();

  const badges = await prisma.badge.findMany({
    where: { isActive: true },
    include: {
      studentBadges: {
        where: { studentId: session.user.id },
        select: { earnedAt: true, isPinned: true },
      },
    },
    orderBy: { order: "asc" },
  });

  const rarities = await prisma.badgeRarity.findMany();
  const rarityMap = Object.fromEntries(rarities.map((r) => [r.badgeId, r]));

  return { badges, rarityMap };
}

export async function toggleBadgePin(badgeId: string) {
  const session = await requireAuth();

  const badge = await prisma.studentBadge.findUnique({
    where: { studentId_badgeId: { studentId: session.user.id, badgeId } },
  });
  if (!badge) throw new Error("Badge not earned");

  await prisma.studentBadge.update({
    where: { id: badge.id },
    data: { isPinned: !badge.isPinned },
  });

  revalidatePath("/achievements/badges");
}

// ============================================
// QUERY HELPERS
// ============================================

export async function getChallengeAdminList() {
  await requireAnyRole(["ADMIN", "INSTRUCTOR", "CHAPTER_LEAD"]);

  return prisma.challenge.findMany({
    include: {
      _count: { select: { participants: true, submissions: true } },
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function getActiveChallenges() {
  const session = await requireAuth();

  const challenges = await prisma.challenge.findMany({
    where: {
      status: "ACTIVE",
      endDate: { gte: new Date() },
    },
    include: {
      participants: {
        where: { studentId: session.user.id },
        take: 1,
      },
      _count: { select: { participants: true, submissions: true } },
    },
    orderBy: { startDate: "asc" },
  });

  return challenges;
}

export async function getChallengeDetail(challengeId: string) {
  const session = await requireAuth();

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      participants: {
        orderBy: { leaderboardRank: "asc" },
        take: 20,
        include: {
          student: { select: { id: true, name: true, level: true } },
        },
      },
      submissions: {
        where: { studentId: session.user.id },
        orderBy: { submittedAt: "desc" },
      },
      _count: { select: { participants: true } },
    },
  });

  if (!challenge) throw new Error("Challenge not found");

  const myParticipation = challenge.participants.find(
    (p) => p.studentId === session.user.id
  );

  return { challenge, myParticipation };
}

export async function getWeeklyChallenges() {
  const session = await requireAuth();
  const now = new Date();

  const challenges = await prisma.challenge.findMany({
    where: {
      type: "WEEKLY",
      status: "ACTIVE",
      endDate: { gte: now },
    },
    include: {
      submissions: {
        orderBy: { voteCount: "desc" },
        take: 10,
        include: {
          student: { select: { id: true, name: true } },
        },
      },
      participants: {
        where: { studentId: session.user.id },
        take: 1,
      },
      _count: { select: { participants: true, submissions: true } },
    },
    orderBy: { startDate: "desc" },
  });

  return challenges;
}

export async function getMyChallengeProgress() {
  const session = await requireAuth();

  const participations = await prisma.challengeParticipant.findMany({
    where: { studentId: session.user.id },
    include: {
      challenge: {
        select: { id: true, title: true, type: true, endDate: true, xpReward: true },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return participations;
}
