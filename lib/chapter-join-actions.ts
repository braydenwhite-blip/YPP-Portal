"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ============================================
// CHAPTER DISCOVERY & JOIN FLOW
// ============================================

/**
 * Get all public chapters for the directory / discovery page.
 */
export async function getPublicChapters() {
  const chapters = await prisma.chapter.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      region: true,
      tagline: true,
      logoUrl: true,
      bannerUrl: true,
      joinPolicy: true,
      _count: {
        select: {
          users: true,
          courses: true,
          events: { where: { startDate: { gte: new Date() } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return chapters;
}

/**
 * Get a single chapter's public profile by slug.
 */
export async function getChapterBySlug(slug: string) {
  const chapter = await prisma.chapter.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      region: true,
      description: true,
      tagline: true,
      logoUrl: true,
      bannerUrl: true,
      joinPolicy: true,
      isPublic: true,
      _count: {
        select: {
          users: true,
          courses: true,
          events: { where: { startDate: { gte: new Date() } } },
        },
      },
      users: {
        where: {
          roles: { some: { role: { in: ["CHAPTER_LEAD", "ADMIN"] } } },
        },
        select: { id: true, name: true, primaryRole: true },
        take: 5,
      },
      pathwayConfigs: {
        where: { isAvailable: true },
        select: {
          pathway: { select: { id: true, name: true } },
          isFeatured: true,
          runStatus: true,
        },
        take: 10,
      },
      events: {
        where: { startDate: { gte: new Date() } },
        orderBy: { startDate: "asc" },
        take: 3,
        select: {
          id: true,
          title: true,
          startDate: true,
          eventType: true,
          location: true,
        },
      },
    },
  });

  if (!chapter || !chapter.isPublic) return null;

  return chapter;
}

/**
 * Join a chapter directly (OPEN policy) or submit a join request (APPROVAL policy).
 */
export async function joinChapter(chapterId: string, message?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Please sign in to join a chapter");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, chapterId: true },
  });

  if (user?.chapterId) {
    throw new Error("You are already a member of a chapter. Leave your current chapter first.");
  }

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, joinPolicy: true, name: true },
  });

  if (!chapter) throw new Error("Chapter not found");

  if (chapter.joinPolicy === "INVITE_ONLY") {
    throw new Error("This chapter is invite-only. Contact the chapter lead for an invitation.");
  }

  if (chapter.joinPolicy === "OPEN") {
    // Direct join
    await prisma.user.update({
      where: { id: session.user.id },
      data: { chapterId },
    });

    revalidatePath("/my-chapter");
    revalidatePath("/chapters");
    return { joined: true, chapterName: chapter.name };
  }

  // APPROVAL policy — create join request
  const existing = await prisma.chapterJoinRequest.findUnique({
    where: { userId_chapterId: { userId: session.user.id, chapterId } },
  });

  if (existing) {
    if (existing.status === "PENDING") {
      throw new Error("You already have a pending request for this chapter");
    }
    if (existing.status === "REJECTED") {
      // Allow reapplication by updating existing
      await prisma.chapterJoinRequest.update({
        where: { id: existing.id },
        data: { status: "PENDING", message: message || null },
      });
      revalidatePath("/chapters");
      return { requested: true, chapterName: chapter.name };
    }
  }

  await prisma.chapterJoinRequest.create({
    data: {
      userId: session.user.id,
      chapterId,
      message: message || null,
    },
  });

  revalidatePath("/chapters");
  return { requested: true, chapterName: chapter.name };
}

/**
 * Leave current chapter.
 */
export async function leaveChapter() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { chapterId: null },
  });

  revalidatePath("/my-chapter");
  revalidatePath("/chapters");
  return { success: true };
}

/**
 * Get pending join requests for a chapter (chapter lead only).
 */
export async function getJoinRequests() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) throw new Error("Unauthorized");
  if (!user?.chapterId) throw new Error("No chapter assigned");

  const requests = await prisma.chapterJoinRequest.findMany({
    where: { chapterId: user.chapterId, status: "PENDING" },
    include: {
      user: { select: { id: true, name: true, email: true, primaryRole: true, createdAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return requests;
}

/**
 * Approve or reject a join request (chapter lead only).
 */
export async function reviewJoinRequest(requestId: string, decision: "APPROVED" | "REJECTED") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) throw new Error("Unauthorized");

  const request = await prisma.chapterJoinRequest.findUnique({
    where: { id: requestId },
    include: { chapter: true },
  });

  if (!request) throw new Error("Request not found");

  // Chapter leads can only review requests for their own chapter
  if (!isAdmin && request.chapterId !== user?.chapterId) {
    throw new Error("You can only review requests for your own chapter");
  }

  await prisma.chapterJoinRequest.update({
    where: { id: requestId },
    data: {
      status: decision,
      reviewedById: session.user.id,
    },
  });

  // If approved, assign user to chapter
  if (decision === "APPROVED") {
    await prisma.user.update({
      where: { id: request.userId },
      data: { chapterId: request.chapterId },
    });
  }

  revalidatePath("/chapter/settings");
  revalidatePath("/chapters");
  return { success: true };
}

/**
 * Get current user's join request status for a chapter.
 */
export async function getMyJoinRequestStatus(chapterId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const request = await prisma.chapterJoinRequest.findUnique({
    where: { userId_chapterId: { userId: session.user.id, chapterId } },
    select: { status: true, createdAt: true },
  });

  return request;
}
