"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isRecoverablePrismaError, withPrismaFallback } from "@/lib/prisma-guard";

type MyChapterHomeChapter = {
  id: string;
  name: string;
  slug: string | null;
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  city: string | null;
  region: string | null;
  _count: { users: number; courses: number };
  events: Array<{
    id: string;
    title: string;
    startDate: Date;
    eventType: string;
    location: string | null;
  }>;
} | null;

type MyChapterChannelSummary = {
  id: string;
  name: string;
  _count: { messages: number };
};

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
 * Get the member home data: chapter info, members preview, upcoming events, user's classes.
 */
export async function getMyChapterHomeData() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, chapterId: true, primaryRole: true },
  });

  if (!user?.chapterId) return null;
  const chapterId = user.chapterId;

  const [chapter, members, channels, recentAnnouncements, myEnrollments] = await Promise.all([
    (async (): Promise<MyChapterHomeChapter> => {
      try {
        return (await prisma.chapter.findUnique({
          where: { id: chapterId },
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
              where: { startDate: { gte: new Date() } },
              orderBy: { startDate: "asc" },
              take: 5,
              select: { id: true, title: true, startDate: true, eventType: true, location: true },
            },
          },
        })) as MyChapterHomeChapter;
      } catch (error) {
        if (!isRecoverablePrismaError(error)) {
          throw error;
        }

        console.error(
          "[getMyChapterHomeData] Chapter branding fields are unavailable; using basic chapter fallback.",
          error
        );

        const basicChapter = await prisma.chapter.findUnique({
          where: { id: chapterId },
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            region: true,
            _count: { select: { users: true, courses: true } },
          },
        });

        return basicChapter
          ? {
              ...basicChapter,
              tagline: null,
              logoUrl: null,
              bannerUrl: null,
              events: [],
            }
          : null;
      }
    })(),

    prisma.user.findMany({
      where: { chapterId },
      select: { id: true, name: true, primaryRole: true },
      orderBy: { createdAt: "asc" },
      take: 12,
    }),

    withPrismaFallback<MyChapterChannelSummary[]>(
      "getMyChapterHomeData.channels",
      async () =>
        prisma.chapterChannel.findMany({
          where: { chapterId },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          take: 5,
          select: {
            id: true,
            name: true,
            _count: { select: { messages: true } },
          },
        }),
      () => [] as MyChapterChannelSummary[],
    ),

    prisma.chapterUpdate.findMany({
      where: { chapterId },
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

    prisma.classEnrollment.findMany({
      where: {
        studentId: user.id,
        status: { in: ["ENROLLED", "WAITLISTED"] },
      },
      include: {
        offering: {
          select: { id: true, title: true, chapterId: true },
        },
      },
      orderBy: { enrolledAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    chapter,
    members,
    channels,
    recentAnnouncements,
    myEnrollments: myEnrollments.filter((e) => e.offering.chapterId === chapterId),
    userId: user.id,
    userRole: user.primaryRole,
  };
}
