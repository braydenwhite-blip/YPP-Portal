"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { AchievementAwardTier, AwardNominationStatus } from "@prisma/client";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { TIER_CONFIG } from "@/lib/award-tier-config";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";

const TIER_ORDER: AchievementAwardTier[] = ["BRONZE", "SILVER", "GOLD", "LIFETIME"];

// ============================================
// AUTH HELPERS
// ============================================

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) throw new Error("Unauthorized");
  return session as typeof session & { user: { id: string } };
}

async function requireChairOrAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("MENTOR") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Unauthorized");
  }
  return session as typeof session & { user: { id: string } };
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) throw new Error(`Missing: ${key}`);
  return value ? String(value).trim() : "";
}

// ============================================
// FETCH: ELIGIBLE MENTEES FOR NOMINATION
// ============================================

/**
 * Returns mentees who have reached a tier's point threshold but don't yet
 * have an approved or pending nomination for that tier.
 */
export async function getEligibleMentees() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("MENTOR") && !roles.includes("CHAPTER_PRESIDENT")) return null;

  // All mentees with a point summary
  const summaries = await prisma.achievementPointSummary.findMany({
    include: {
      user: {
        select: { id: true, name: true, email: true, primaryRole: true },
      },
      nominations: {
        where: { status: { in: ["PENDING_CHAIR", "PENDING_BOARD", "APPROVED"] } },
        select: { tier: true, status: true },
      },
    },
  });

  return summaries.map((s) => {
    // Determine next eligible tier
    const approvedTiers = new Set(
      s.nominations.filter((n) => n.status === "APPROVED").map((n) => n.tier)
    );
    const pendingTiers = new Set(
      s.nominations.filter((n) => n.status !== "APPROVED").map((n) => n.tier)
    );

    const eligibleTiers = TIER_ORDER.filter((tier) => {
      const cfg = TIER_CONFIG[tier];
      return s.totalPoints >= cfg.min && !approvedTiers.has(tier) && !pendingTiers.has(tier);
    });

    return {
      userId: s.userId,
      userName: s.user.name,
      userEmail: s.user.email,
      userRole: s.user.primaryRole,
      totalPoints: s.totalPoints,
      currentTier: s.currentTier,
      eligibleTiers,
      approvedTiers: Array.from(approvedTiers),
      pendingTiers: Array.from(pendingTiers),
    };
  }).filter((m) => m.eligibleTiers.length > 0);
}

// ============================================
// FETCH: NOMINATION QUEUE
// ============================================

/**
 * Returns all nominations filtered by status for the chair/admin queue.
 */
export async function getNominationQueue() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("MENTOR") && !roles.includes("CHAPTER_PRESIDENT")) return null;

  const nominations = await prisma.awardNomination.findMany({
    include: {
      nominee: { select: { id: true, name: true, email: true, primaryRole: true } },
      nominator: { select: { id: true, name: true } },
      summary: { select: { totalPoints: true, currentTier: true } },
      chairApprover: { select: { name: true } },
      boardApprover: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return nominations.map((n) => ({
    id: n.id,
    tier: n.tier,
    status: n.status,
    nomineeName: n.nominee.name,
    nomineeEmail: n.nominee.email,
    nomineeRole: n.nominee.primaryRole,
    nominatorName: n.nominator.name,
    totalPoints: n.summary.totalPoints,
    notes: n.notes,
    chairApproverName: n.chairApprover?.name ?? null,
    chairApprovedAt: n.chairApprovedAt?.toISOString() ?? null,
    boardApproverName: n.boardApprover?.name ?? null,
    boardApprovedAt: n.boardApprovedAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));
}

// ============================================
// FETCH: MY AWARDS DATA (MENTEE)
// ============================================

export async function getMyAwardsData() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;

  const [summary, nominations] = await Promise.all([
    prisma.achievementPointSummary.findUnique({
      where: { userId },
      include: {
        pointLogs: {
          orderBy: { createdAt: "desc" },
          include: { review: { select: { cycleNumber: true, overallRating: true } } },
        },
      },
    }),
    prisma.awardNomination.findMany({
      where: { nomineeId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        nominator: { select: { name: true } },
      },
    }),
  ]);

  if (!summary) {
    return {
      totalPoints: 0,
      currentTier: null,
      volunteerHoursAwarded: 0,
      pointLogs: [] as { id: string; points: number; reason: string | null; cycleMonth: string; cycleNumber: number; overallRating: string }[],
      nominations: [] as { id: string; tier: AchievementAwardTier; status: AwardNominationStatus; nominatorName: string; createdAt: string; boardApprovedAt: string | null }[],
      tierProgress: computeTierProgress(0, null),
    };
  }

  return {
    totalPoints: summary.totalPoints,
    currentTier: summary.currentTier,
    volunteerHoursAwarded: summary.volunteerHoursAwarded,
    pointLogs: summary.pointLogs.map((log) => ({
      id: log.id,
      points: log.points,
      reason: log.reason,
      cycleMonth: log.cycleMonth.toISOString(),
      cycleNumber: log.review.cycleNumber,
      overallRating: log.review.overallRating,
    })),
    nominations: nominations.map((n) => ({
      id: n.id,
      tier: n.tier,
      status: n.status,
      nominatorName: n.nominator.name,
      createdAt: n.createdAt.toISOString(),
      boardApprovedAt: n.boardApprovedAt?.toISOString() ?? null,
    })),
    tierProgress: computeTierProgress(summary.totalPoints, summary.currentTier),
  };
}

function computeTierProgress(totalPoints: number, currentTier: AchievementAwardTier | null) {
  const nextTierEntry = TIER_ORDER.find((t) => TIER_CONFIG[t].min > totalPoints);
  if (!nextTierEntry) return { nextTier: null, pointsNeeded: 0, progressPct: 100 };
  const nextMin = TIER_CONFIG[nextTierEntry].min;
  const prevMin = (() => {
    const idx = TIER_ORDER.indexOf(nextTierEntry);
    return idx === 0 ? 0 : TIER_CONFIG[TIER_ORDER[idx - 1]].min;
  })();
  const range = nextMin - prevMin;
  const earned = totalPoints - prevMin;
  return {
    nextTier: nextTierEntry,
    pointsNeeded: nextMin - totalPoints,
    progressPct: Math.min(100, Math.round((earned / range) * 100)),
  };
}

// ============================================
// NOMINATE
// ============================================

export async function nominateForAward(formData: FormData) {
  const session = await requireChairOrAdmin();

  const nomineeId = getString(formData, "nomineeId");
  const tierRaw = getString(formData, "tier");
  const notes = getString(formData, "notes", false);

  const tier = tierRaw as AchievementAwardTier;
  if (!Object.values(AchievementAwardTier).includes(tier)) throw new Error("Invalid tier");

  const [nominee, summary] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: nomineeId }, select: { name: true } }),
    prisma.achievementPointSummary.findUnique({ where: { userId: nomineeId }, select: { id: true, totalPoints: true } }),
  ]);

  if (!summary) throw new Error(`${nominee.name} has no achievement points yet`);

  const tierCfg = TIER_CONFIG[tier];
  if (summary.totalPoints < tierCfg.min) {
    throw new Error(
      `${nominee.name} only has ${summary.totalPoints} pts — ${tier} requires ${tierCfg.min} pts`
    );
  }

  // Block duplicate active nominations
  const existing = await prisma.awardNomination.findFirst({
    where: { nomineeId, tier, status: { in: ["PENDING_CHAIR", "PENDING_BOARD", "APPROVED"] } },
  });
  if (existing) throw new Error(`${nominee.name} already has an active or approved ${tier} nomination`);

  await prisma.awardNomination.create({
    data: {
      summaryId: summary.id,
      nomineeId,
      nominatedBy: session.user.id,
      tier,
      status: "PENDING_CHAIR",
      notes: notes || null,
    },
  });

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "AwardNomination",
    targetId: nomineeId,
    description: `${nominee.name} nominated for ${tier} award`,
  });

  // Notify mentee about their nomination
  await createMentorshipNotification({
    userId: nomineeId,
    title: `${TIER_CONFIG[tier].emoji} ${TIER_CONFIG[tier].label} Award Nomination`,
    body: `Congratulations! You have been nominated for the ${TIER_CONFIG[tier].label} Achievement Award.`,
    link: "/my-program/awards",
  });

  revalidatePath("/mentorship-program/awards");
}

// ============================================
// CHAIR APPROVE / REJECT
// ============================================

/**
 * Chair approves a nomination.
 * Bronze/Silver → APPROVED immediately.
 * Gold/Lifetime → PENDING_BOARD (requires Board approval).
 */
export async function chairApproveNomination(formData: FormData) {
  const session = await requireChairOrAdmin();

  const nominationId = getString(formData, "nominationId");

  const nomination = await prisma.awardNomination.findUniqueOrThrow({
    where: { id: nominationId },
    include: { nominee: { select: { name: true } } },
  });

  if (nomination.status !== "PENDING_CHAIR") throw new Error("Not in PENDING_CHAIR status");

  const requiresBoard = TIER_CONFIG[nomination.tier].requiresBoard;
  const newStatus: AwardNominationStatus = requiresBoard ? "PENDING_BOARD" : "APPROVED";

  await prisma.$transaction(async (tx) => {
    await tx.awardNomination.update({
      where: { id: nominationId },
      data: {
        status: newStatus,
        chairApproverId: session.user.id,
        chairApprovedAt: new Date(),
      },
    });

    // If directly approved (Bronze/Silver), grant volunteer hours
    if (newStatus === "APPROVED") {
      const hours = TIER_CONFIG[nomination.tier].volunteerHours;
      await tx.achievementPointSummary.updateMany({
        where: { userId: nomination.nomineeId },
        data: { volunteerHoursAwarded: hours },
      });
    }
  });

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "AwardNomination",
    targetId: nominationId,
    description: `${nomination.nominee.name} ${nomination.tier} nomination chair-approved → ${newStatus}`,
  });

  revalidatePath("/mentorship-program/awards");
}

// ============================================
// BOARD APPROVE / REJECT
// ============================================

/**
 * Board (Admin) final approval for Gold/Lifetime awards.
 */
export async function boardApproveNomination(formData: FormData) {
  const session = await requireAdmin();

  const nominationId = getString(formData, "nominationId");

  const nomination = await prisma.awardNomination.findUniqueOrThrow({
    where: { id: nominationId },
    include: { nominee: { select: { name: true } } },
  });

  if (nomination.status !== "PENDING_BOARD") throw new Error("Not in PENDING_BOARD status");

  await prisma.$transaction(async (tx) => {
    await tx.awardNomination.update({
      where: { id: nominationId },
      data: {
        status: "APPROVED",
        boardApproverId: session.user.id,
        boardApprovedAt: new Date(),
      },
    });

    // Grant volunteer hours for this tier
    const hours = TIER_CONFIG[nomination.tier].volunteerHours;
    await tx.achievementPointSummary.updateMany({
      where: { userId: nomination.nomineeId },
      data: { volunteerHoursAwarded: hours },
    });
  });

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "AwardNomination",
    targetId: nominationId,
    description: `${nomination.nominee.name} ${nomination.tier} award BOARD APPROVED`,
  });

  revalidatePath("/mentorship-program/awards");
  revalidatePath("/my-program/awards");
}

/**
 * Reject a nomination at any stage.
 */
export async function rejectNomination(formData: FormData) {
  const session = await requireChairOrAdmin();

  const nominationId = getString(formData, "nominationId");

  const nomination = await prisma.awardNomination.findUniqueOrThrow({
    where: { id: nominationId },
    include: { nominee: { select: { name: true } } },
  });

  if (nomination.status === "APPROVED") throw new Error("Cannot reject an already approved award");

  await prisma.awardNomination.update({
    where: { id: nominationId },
    data: { status: "REJECTED" },
  });

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "AwardNomination",
    targetId: nominationId,
    description: `${nomination.nominee.name} ${nomination.tier} nomination rejected`,
  });

  revalidatePath("/mentorship-program/awards");
}
