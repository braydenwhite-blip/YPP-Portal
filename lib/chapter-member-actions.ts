"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ============================================
// CHAPTER MEMBER DIRECTORY
// ============================================

/**
 * Get all members of the current user's chapter with role and join info.
 */
export async function getChapterMembers(search?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { chapterId: true },
  });

  if (!user?.chapterId) throw new Error("You must be in a chapter to view members");

  const members = await prisma.user.findMany({
    where: {
      chapterId: user.chapterId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      createdAt: true,
      roles: { select: { role: true } },
    },
    orderBy: [{ primaryRole: "asc" }, { name: "asc" }],
  });

  return members;
}

/**
 * Get the member home data: chapter info, members preview, upcoming events, user's courses.
 */
export async function getMyChapterHomeData() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, chapterId: true, primaryRole: true },
  });

  if (!user?.chapterId) return null;

  const now = new Date();

  const [chapter, members, channels, recentAnnouncements, myEnrollments] = await Promise.all([
    prisma.chapter.findUnique({
      where: { id: user.chapterId },
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        logoUrl: true,
        bannerUrl: true,
        city: true,
        region: true,
        _count: { select: { users: true, courses: true } },
        events: {
          where: { startDate: { gte: now } },
          orderBy: { startDate: "asc" },
          take: 5,
          select: { id: true, title: true, startDate: true, eventType: true, location: true },
        },
      },
    }),

    prisma.user.findMany({
      where: { chapterId: user.chapterId },
      select: { id: true, name: true, primaryRole: true },
      orderBy: { createdAt: "asc" },
      take: 12,
    }),

    prisma.chapterChannel.findMany({
      where: { chapterId: user.chapterId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      take: 5,
      select: {
        id: true,
        name: true,
        _count: { select: { messages: true } },
      },
    }),

    prisma.chapterUpdate.findMany({
      where: { chapterId: user.chapterId },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        content: true,
        publishedAt: true,
        isPinned: true,
        author: { select: { name: true } },
      },
    }),

    prisma.enrollment.findMany({
      where: { userId: user.id },
      include: {
        course: {
          select: { id: true, title: true, chapterId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    chapter,
    members,
    channels,
    recentAnnouncements,
    myEnrollments: myEnrollments.filter((e) => e.course.chapterId === user.chapterId),
    userId: user.id,
    userRole: user.primaryRole,
  };
}
