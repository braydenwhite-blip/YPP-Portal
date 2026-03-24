"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isRecoverablePrismaError, withPrismaFallback } from "@/lib/prisma-guard";

// ============================================
// CHAPTER COMMAND CENTER DATA
// ============================================

async function requireChapterLead() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isAdmin = user?.roles.some((r) => r.role === "ADMIN");
  const isChapterLead = user?.roles.some((r) => r.role === "CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Only Chapter Presidents and Admins can access this");
  }

  if (!user?.chapterId) throw new Error("User is not assigned to a chapter");
  return { user, chapterId: user.chapterId, isAdmin: !!isAdmin };
}

/**
 * Get all data needed for the chapter president command center in a single call.
 */
export async function getCommandCenterData() {
  const { chapterId } = await requireChapterLead();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Run all queries in parallel
  const [
    chapter,
    pendingJoinRequests,
    pendingApplications,
    recentEnrollments,
    activeGoals,
    kpiSnapshots,
    allMembers,
  ] = await Promise.all([
    // Chapter basics with upcoming events and open positions
    (async () => {
      try {
        return await prisma.chapter.findUnique({
          where: { id: chapterId },
          select: {
            id: true,
            name: true,
            slug: true,
            tagline: true,
            logoUrl: true,
            bannerUrl: true,
            events: {
              where: { startDate: { gte: now } },
              orderBy: { startDate: "asc" },
              take: 5,
              select: { id: true, title: true, startDate: true, eventType: true },
            },
            positions: {
              where: { isOpen: true },
              select: {
                id: true,
                title: true,
                type: true,
                _count: { select: { applications: true } },
              },
            },
            announcements: {
              where: { isActive: true },
              orderBy: { publishedAt: "desc" },
              take: 3,
              select: { id: true, title: true, publishedAt: true },
            },
            courses: {
              select: {
                id: true,
                title: true,
                enrollments: { select: { id: true } },
              },
            },
          },
        });
      } catch (error) {
        if (!isRecoverablePrismaError(error)) {
          throw error;
        }

        console.error(
          "[getCommandCenterData] Chapter branding fields are unavailable; using basic chapter fallback.",
          error
        );

        const basicChapter = await prisma.chapter.findUnique({
          where: { id: chapterId },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        });

        return basicChapter
          ? {
              ...basicChapter,
              tagline: null,
              logoUrl: null,
              bannerUrl: null,
              events: [],
              positions: [],
              announcements: [],
              courses: [],
            }
          : null;
      }
    })(),

    // Pending join requests
    withPrismaFallback(
      "getCommandCenterData.pendingJoinRequests",
      async () =>
        prisma.chapterJoinRequest.findMany({
          where: { chapterId, status: "PENDING" },
          include: {
            user: { select: { id: true, name: true, email: true, primaryRole: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
      () =>
        [] as Array<{
          id: string;
          userId: string;
          chapterId: string;
          message: string | null;
          status: "PENDING" | "APPROVED" | "REJECTED";
          reviewedById: string | null;
          createdAt: Date;
          updatedAt: Date;
          user: {
            id: string;
            name: string;
            email: string;
            primaryRole: string;
          };
        }>,
    ),

    // Pending applications across all open positions
    prisma.application.findMany({
      where: {
        position: { chapterId, isOpen: true },
        status: "SUBMITTED",
      },
      include: {
        applicant: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),

    // Recent enrollments (last 30 days)
    prisma.enrollment.findMany({
      where: {
        course: { chapterId },
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        user: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),

    // Active chapter goals
    withPrismaFallback(
      "getCommandCenterData.activeGoals",
      async () =>
        prisma.chapterGoal.findMany({
          where: { chapterId, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
        }),
      () =>
        [] as Array<{
          id: string;
          chapterId: string;
          createdById: string;
          title: string;
          description: string | null;
          targetValue: number;
          currentValue: number;
          unit: string;
          deadline: Date | null;
          status: "ACTIVE" | "COMPLETED" | "PAUSED" | "CANCELLED";
          createdAt: Date;
          updatedAt: Date;
        }>,
    ),

    // KPI snapshots for the last 8 weeks (for growth chart)
    withPrismaFallback(
      "getCommandCenterData.kpiSnapshots",
      async () =>
        prisma.chapterKpiSnapshot.findMany({
          where: {
            chapterId,
            snapshotDate: { gte: new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { snapshotDate: "asc" },
          select: {
            snapshotDate: true,
            activeStudents: true,
            activeInstructors: true,
            classesRunningCount: true,
            enrollmentFillPercent: true,
            retentionRate: true,
            newMembersThisWeek: true,
          },
        }),
      () =>
        [] as Array<{
          snapshotDate: Date;
          activeStudents: number;
          activeInstructors: number;
          classesRunningCount: number;
          enrollmentFillPercent: number | null;
          retentionRate: number | null;
          newMembersThisWeek: number;
        }>,
    ),

    // All chapter members with last activity info
    prisma.user.findMany({
      where: { chapterId },
      select: {
        id: true,
        name: true,
        email: true,
        primaryRole: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  // Compute member stats
  const totalMembers = allMembers.length;
  const instructors = allMembers.filter((m) => m.primaryRole === "INSTRUCTOR");
  const students = allMembers.filter((m) => m.primaryRole === "STUDENT");
  const mentors = allMembers.filter((m) => m.primaryRole === "MENTOR");

  // Members active in last 7 days (using updatedAt as a proxy)
  const activeThisWeek = allMembers.filter(
    (m) => new Date(m.updatedAt) >= sevenDaysAgo
  ).length;

  // Members who joined in last 30 days
  const newMembers30d = allMembers.filter(
    (m) => new Date(m.createdAt) >= thirtyDaysAgo
  ).length;

  // Members inactive for 14+ days
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const inactiveMembers = allMembers.filter(
    (m) => new Date(m.updatedAt) < fourteenDaysAgo
  );

  // Build action items queue
  const actionItems: Array<{
    type: string;
    label: string;
    count: number;
    href: string;
    priority: number;
  }> = [];

  if (pendingJoinRequests.length > 0) {
    actionItems.push({
      type: "join_requests",
      label: "Join requests",
      count: pendingJoinRequests.length,
      href: "/chapter/settings",
      priority: 1,
    });
  }

  if (pendingApplications.length > 0) {
    actionItems.push({
      type: "applications",
      label: "New applications",
      count: pendingApplications.length,
      href: "/chapter/recruiting",
      priority: 2,
    });
  }

  if (inactiveMembers.length > 0) {
    actionItems.push({
      type: "inactive_members",
      label: "Inactive members (14+ days)",
      count: inactiveMembers.length,
      href: "/chapter/students",
      priority: 3,
    });
  }

  const totalApplications = chapter?.positions.reduce(
    (sum, p) => sum + p._count.applications, 0
  ) ?? 0;

  // Sort action items by priority
  actionItems.sort((a, b) => a.priority - b.priority);

  return {
    chapter,
    stats: {
      totalMembers,
      totalInstructors: instructors.length,
      totalStudents: students.length,
      totalMentors: mentors.length,
      totalCourses: chapter?.courses.length ?? 0,
      upcomingEvents: chapter?.events.length ?? 0,
      openPositions: chapter?.positions.length ?? 0,
      totalApplications,
      activeThisWeek,
      newMembers30d,
      inactiveMemberCount: inactiveMembers.length,
    },
    actionItems,
    pendingJoinRequests,
    pendingApplications,
    recentEnrollments,
    activeGoals,
    kpiSnapshots,
    members: allMembers,
    inactiveMembers: inactiveMembers.slice(0, 5),
  };
}
