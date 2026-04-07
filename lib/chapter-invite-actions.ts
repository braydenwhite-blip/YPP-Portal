"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

// Cast for models not yet in generated Prisma client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ============================================
// CHAPTER INVITE MANAGEMENT
// ============================================

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex"); // 8 char hex code
}

/**
 * Create a new invite link for a chapter (lead/admin only).
 */
export async function createChapterInvite(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isLead = user?.roles.some((r) => r.role === "CHAPTER_PRESIDENT" || r.role === "ADMIN");
  if (!isLead || !user?.chapterId) throw new Error("Unauthorized");

  const label = (formData.get("label") as string) || null;
  const maxUsesRaw = formData.get("maxUses") as string;
  const maxUses = maxUsesRaw ? parseInt(maxUsesRaw, 10) : null;
  const expiresInDays = formData.get("expiresInDays") as string;

  let expiresAt: Date | null = null;
  if (expiresInDays && parseInt(expiresInDays, 10) > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays, 10));
  }

  const invite = await db.chapterInvite.create({
    data: {
      chapterId: user.chapterId,
      createdById: user.id,
      code: generateInviteCode(),
      label,
      maxUses: maxUses && maxUses > 0 ? maxUses : null,
      expiresAt,
    },
  });

  revalidatePath("/chapter/invites");
  return { success: true, code: invite.code };
}

/**
 * Get all invites for the current user's chapter.
 */
export async function getChapterInvites() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isLead = user?.roles.some((r) => r.role === "CHAPTER_PRESIDENT" || r.role === "ADMIN");
  if (!isLead || !user?.chapterId) throw new Error("Unauthorized");

  const invites = await db.chapterInvite.findMany({
    where: { chapterId: user.chapterId },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { usedBy: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return invites.map((inv: any) => ({
    id: inv.id,
    code: inv.code,
    label: inv.label,
    maxUses: inv.maxUses,
    useCount: inv._count.usedBy,
    expiresAt: inv.expiresAt,
    isActive: inv.isActive,
    isExpired: inv.expiresAt ? inv.expiresAt < new Date() : false,
    isFull: inv.maxUses ? inv._count.usedBy >= inv.maxUses : false,
    createdBy: inv.createdBy.name,
    createdAt: inv.createdAt,
  }));
}

/**
 * Deactivate an invite link.
 */
export async function deactivateInvite(inviteId: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isLead = user?.roles.some((r) => r.role === "CHAPTER_PRESIDENT" || r.role === "ADMIN");
  if (!isLead || !user?.chapterId) throw new Error("Unauthorized");

  const invite = await db.chapterInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.chapterId !== user.chapterId) throw new Error("Invite not found");

  await db.chapterInvite.update({
    where: { id: inviteId },
    data: { isActive: false },
  });

  revalidatePath("/chapter/invites");
  return { success: true };
}

/**
 * Look up an invite by code — for the public accept page.
 */
export async function getInviteByCode(code: string) {
  const invite = await db.chapterInvite.findUnique({
    where: { code },
    include: {
      chapter: {
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          region: true,
          tagline: true,
          logoUrl: true,
          bannerUrl: true,
          _count: { select: { users: true } },
        },
      },
      _count: { select: { usedBy: true } },
    },
  });

  if (!invite) return null;

  const isExpired = invite.expiresAt ? invite.expiresAt < new Date() : false;
  const isFull = invite.maxUses ? invite._count.usedBy >= invite.maxUses : false;
  const isValid = invite.isActive && !isExpired && !isFull;

  return {
    code: invite.code,
    label: invite.label,
    chapter: invite.chapter,
    isValid,
    isExpired,
    isFull,
    isActive: invite.isActive,
  };
}

/**
 * Accept an invite and join the chapter.
 */
export async function acceptInvite(code: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Please sign in to accept this invite");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, chapterId: true },
  });

  if (user?.chapterId) {
    throw new Error("You are already a member of a chapter. Leave your current chapter first.");
  }

  const invite = await db.chapterInvite.findUnique({
    where: { code },
    include: {
      chapter: { select: { id: true, name: true } },
      _count: { select: { usedBy: true } },
    },
  });

  if (!invite) throw new Error("Invite not found");
  if (!invite.isActive) throw new Error("This invite has been deactivated");
  if (invite.expiresAt && invite.expiresAt < new Date()) throw new Error("This invite has expired");
  if (invite.maxUses && invite._count.usedBy >= invite.maxUses) throw new Error("This invite has reached its maximum uses");

  // Join the chapter and track the invite
  await db.$transaction([
    db.user.update({
      where: { id: session.user.id },
      data: {
        chapterId: invite.chapter.id,
        joinedViaInviteId: invite.id,
      },
    }),
    db.chapterInvite.update({
      where: { id: invite.id },
      data: {
        useCount: { increment: 1 },
        usedBy: { connect: { id: session.user.id } },
      },
    }),
  ]);

  revalidatePath("/my-chapter");
  revalidatePath("/chapters");
  return { joined: true, chapterName: invite.chapter.name };
}

// ============================================
// GROWTH LEADERBOARD
// ============================================

/**
 * Get chapter growth leaderboard data for the network.
 */
export async function getGrowthLeaderboard() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const chapters = await prisma.chapter.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      region: true,
      logoUrl: true,
      _count: {
        select: {
          users: true,
          courses: true,
          events: { where: { startDate: { gte: new Date() } } },
        },
      },
    },
    orderBy: { users: { _count: "desc" } },
  });

  // Get recent KPI snapshots for growth calculation (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const snapshots = await prisma.chapterKpiSnapshot.findMany({
    where: {
      chapterId: { in: chapters.map((c) => c.id) },
      snapshotDate: { gte: thirtyDaysAgo },
    },
    select: {
      chapterId: true,
      newMembersThisWeek: true,
      retentionRate: true,
      eventsThisWeek: true,
    },
    orderBy: { snapshotDate: "desc" },
  });

  // Aggregate snapshot data per chapter
  const chapterStats = new Map<string, {
    newMembers30d: number;
    avgRetention: number | null;
    events30d: number;
    snapshotCount: number;
    retentionSum: number;
  }>();

  for (const snap of snapshots) {
    const existing = chapterStats.get(snap.chapterId) ?? {
      newMembers30d: 0,
      avgRetention: null,
      events30d: 0,
      snapshotCount: 0,
      retentionSum: 0,
    };
    existing.newMembers30d += snap.newMembersThisWeek;
    existing.events30d += snap.eventsThisWeek;
    if (snap.retentionRate !== null) {
      existing.retentionSum += snap.retentionRate;
      existing.snapshotCount++;
    }
    chapterStats.set(snap.chapterId, existing);
  }

  const leaderboard = chapters.map((ch) => {
    const stats = chapterStats.get(ch.id);
    return {
      id: ch.id,
      name: ch.name,
      slug: ch.slug,
      city: ch.city,
      region: ch.region,
      logoUrl: ch.logoUrl,
      memberCount: ch._count.users,
      courseCount: ch._count.courses,
      upcomingEvents: ch._count.events,
      newMembers30d: stats?.newMembers30d ?? 0,
      avgRetention: stats && stats.snapshotCount > 0
        ? Math.round(stats.retentionSum / stats.snapshotCount)
        : null,
      events30d: stats?.events30d ?? 0,
    };
  });

  // Sort by total members by default
  leaderboard.sort((a, b) => b.memberCount - a.memberCount);

  return leaderboard;
}

/**
 * Get referral stats for the current chapter.
 */
export async function getChapterReferralStats() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isLead = user?.roles.some((r) => r.role === "CHAPTER_PRESIDENT" || r.role === "ADMIN");
  if (!isLead || !user?.chapterId) throw new Error("Unauthorized");

  // Get invite usage stats
  const invites = await db.chapterInvite.findMany({
    where: { chapterId: user.chapterId },
    include: {
      createdBy: { select: { name: true } },
      usedBy: { select: { id: true, name: true, createdAt: true } },
    },
    orderBy: { useCount: "desc" },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalInviteJoins = invites.reduce((sum: number, inv: any) => sum + inv.usedBy.length, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeInvites = invites.filter((inv: any) => {
    const isExpired = inv.expiresAt ? inv.expiresAt < new Date() : false;
    const isFull = inv.maxUses ? inv.usedBy.length >= inv.maxUses : false;
    return inv.isActive && !isExpired && !isFull;
  }).length;

  return {
    totalInviteJoins,
    activeInvites,
    totalInvites: invites.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topInvites: invites.slice(0, 5).map((inv: any) => ({
      label: inv.label || inv.code,
      useCount: inv.usedBy.length,
      createdBy: inv.createdBy.name,
    })),
  };
}
