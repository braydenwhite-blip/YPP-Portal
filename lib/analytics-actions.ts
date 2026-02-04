"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }
  return session;
}

// ============================================
// EVENT TRACKING
// ============================================

export async function trackEvent(
  eventType: string,
  eventData?: Record<string, unknown>
) {
  const session = await getServerSession(authOptions);

  await prisma.analyticsEvent.create({
    data: {
      userId: session?.user?.id || null,
      eventType,
      eventData: eventData || null
    }
  });
}

export async function trackPageView(path: string) {
  const session = await getServerSession(authOptions);

  await prisma.analyticsEvent.create({
    data: {
      userId: session?.user?.id || null,
      eventType: "page_view",
      eventData: { path }
    }
  });
}

export async function trackVideoWatch(
  moduleId: string,
  watchedSeconds: number,
  completed: boolean
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return;

  await prisma.analyticsEvent.create({
    data: {
      userId: session.user.id,
      eventType: "video_watch",
      eventData: { moduleId, watchedSeconds, completed }
    }
  });
}

// ============================================
// DASHBOARD ANALYTICS (Admin)
// ============================================

export async function getDashboardAnalytics() {
  await requireAdmin();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get basic counts
  const [
    totalUsers,
    totalInstructors,
    totalStudents,
    totalParents,
    totalCourses,
    totalEnrollments,
    totalCertificates
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { primaryRole: "INSTRUCTOR" } }),
    prisma.user.count({ where: { primaryRole: "STUDENT" } }),
    prisma.user.count({ where: { primaryRole: "PARENT" } }),
    prisma.course.count(),
    prisma.enrollment.count({ where: { status: "ENROLLED" } }),
    prisma.certificate.count()
  ]);

  // Get recent activity
  const [
    newUsersLast30Days,
    newEnrollmentsLast30Days,
    certificatesLast30Days,
    activeUsersLast7Days
  ] = await Promise.all([
    prisma.user.count({
      where: { createdAt: { gte: thirtyDaysAgo } }
    }),
    prisma.enrollment.count({
      where: { createdAt: { gte: thirtyDaysAgo } }
    }),
    prisma.certificate.count({
      where: { issuedAt: { gte: thirtyDaysAgo } }
    }),
    prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: sevenDaysAgo },
        userId: { not: null }
      }
    }).then(results => results.length)
  ]);

  // Get enrollment by course format
  const enrollmentsByFormat = await prisma.enrollment.groupBy({
    by: ["courseId"],
    where: { status: "ENROLLED" },
    _count: true
  });

  const courses = await prisma.course.findMany({
    where: { id: { in: enrollmentsByFormat.map(e => e.courseId) } },
    select: { id: true, format: true }
  });

  const courseFormatMap = new Map(courses.map(c => [c.id, c.format]));
  const formatCounts: Record<string, number> = {};
  enrollmentsByFormat.forEach(e => {
    const format = courseFormatMap.get(e.courseId) || "UNKNOWN";
    formatCounts[format] = (formatCounts[format] || 0) + e._count;
  });

  // Get video watch statistics
  const videoStats = await prisma.videoProgress.aggregate({
    _sum: { watchedSeconds: true },
    _count: { id: true }
  });

  // Get daily signups for chart (last 30 days)
  const dailySignups = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM "User"
    WHERE created_at >= ${thirtyDaysAgo}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  // Get top courses by enrollment
  const topCourses = await prisma.enrollment.groupBy({
    by: ["courseId"],
    where: { status: "ENROLLED" },
    _count: true,
    orderBy: { _count: { courseId: "desc" } },
    take: 5
  });

  const topCourseDetails = await prisma.course.findMany({
    where: { id: { in: topCourses.map(c => c.courseId) } },
    select: { id: true, title: true, format: true }
  });

  // Get chapter statistics
  const chapterStats = await prisma.chapter.findMany({
    include: {
      _count: {
        select: {
          users: true,
          courses: true,
          events: true
        }
      }
    }
  });

  return {
    overview: {
      totalUsers,
      totalInstructors,
      totalStudents,
      totalParents,
      totalCourses,
      totalEnrollments,
      totalCertificates
    },
    recentActivity: {
      newUsersLast30Days,
      newEnrollmentsLast30Days,
      certificatesLast30Days,
      activeUsersLast7Days
    },
    enrollmentsByFormat: formatCounts,
    videoStats: {
      totalWatchTimeMinutes: Math.round((videoStats._sum.watchedSeconds || 0) / 60),
      totalVideoViews: videoStats._count.id
    },
    dailySignups: dailySignups.map(d => ({
      date: d.date,
      count: Number(d.count)
    })),
    topCourses: topCourses.map(c => ({
      ...topCourseDetails.find(d => d.id === c.courseId),
      enrollments: c._count
    })),
    chapterStats: chapterStats.map(c => ({
      id: c.id,
      name: c.name,
      city: c.city,
      users: c._count.users,
      courses: c._count.courses,
      events: c._count.events
    }))
  };
}

// ============================================
// TRAINING ANALYTICS
// ============================================

export async function getTrainingAnalytics() {
  await requireAdmin();

  // Training completion rates
  const trainingAssignments = await prisma.trainingAssignment.groupBy({
    by: ["status"],
    _count: true
  });

  const statusCounts = trainingAssignments.reduce((acc, curr) => {
    acc[curr.status] = curr._count;
    return acc;
  }, {} as Record<string, number>);

  // Video completion rates
  const videoProgress = await prisma.videoProgress.aggregate({
    _count: { id: true },
    _sum: { watchedSeconds: true }
  });

  const completedVideos = await prisma.videoProgress.count({
    where: { completed: true }
  });

  // Training module popularity
  const moduleStats = await prisma.trainingAssignment.groupBy({
    by: ["moduleId"],
    _count: true,
    orderBy: { _count: { moduleId: "desc" } }
  });

  const modules = await prisma.trainingModule.findMany({
    where: { id: { in: moduleStats.map(m => m.moduleId) } },
    select: { id: true, title: true, type: true, videoUrl: true }
  });

  return {
    completionRates: {
      notStarted: statusCounts.NOT_STARTED || 0,
      inProgress: statusCounts.IN_PROGRESS || 0,
      complete: statusCounts.COMPLETE || 0
    },
    videoStats: {
      totalViews: videoProgress._count.id,
      totalWatchMinutes: Math.round((videoProgress._sum.watchedSeconds || 0) / 60),
      completedVideos
    },
    moduleStats: moduleStats.map(m => ({
      ...modules.find(mod => mod.id === m.moduleId),
      assignments: m._count
    }))
  };
}

// ============================================
// USER ENGAGEMENT ANALYTICS
// ============================================

export async function getUserEngagementStats(userId: string) {
  await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      enrollments: {
        include: { course: true }
      },
      trainings: {
        include: { module: true }
      },
      videoProgress: true,
      certificates: true,
      goals: {
        include: {
          progress: {
            orderBy: { createdAt: "desc" },
            take: 1
          }
        }
      }
    }
  });

  if (!user) {
    throw new Error("User not found");
  }

  const recentActivity = await prisma.analyticsEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      primaryRole: user.primaryRole,
      createdAt: user.createdAt
    },
    enrollments: user.enrollments.length,
    completedCourses: user.enrollments.filter(e => e.status === "COMPLETED").length,
    trainingProgress: {
      total: user.trainings.length,
      completed: user.trainings.filter(t => t.status === "COMPLETE").length
    },
    videoProgress: {
      totalVideos: user.videoProgress.length,
      completedVideos: user.videoProgress.filter(v => v.completed).length,
      totalWatchMinutes: Math.round(
        user.videoProgress.reduce((sum, v) => sum + v.watchedSeconds, 0) / 60
      )
    },
    certificates: user.certificates.length,
    goalsProgress: user.goals.map(g => ({
      title: g.template?.title,
      latestStatus: g.progress[0]?.status
    })),
    recentActivity: recentActivity.map(a => ({
      type: a.eventType,
      data: a.eventData,
      timestamp: a.createdAt
    }))
  };
}

// ============================================
// DAILY STATS AGGREGATION
// ============================================

export async function aggregateDailyStats() {
  await requireAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Count stats for yesterday
  const [
    totalUsers,
    activeUsers,
    newEnrollments,
    courseCompletions,
    videoProgress
  ] = await Promise.all([
    prisma.user.count(),
    prisma.analyticsEvent.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: yesterday, lt: today },
        userId: { not: null }
      }
    }).then(r => r.length),
    prisma.enrollment.count({
      where: {
        createdAt: { gte: yesterday, lt: today }
      }
    }),
    prisma.enrollment.count({
      where: {
        status: "COMPLETED",
        updatedAt: { gte: yesterday, lt: today }
      }
    }),
    prisma.videoProgress.aggregate({
      where: {
        updatedAt: { gte: yesterday, lt: today }
      },
      _sum: { watchedSeconds: true }
    })
  ]);

  await prisma.dailyStats.upsert({
    where: { date: yesterday },
    create: {
      date: yesterday,
      totalUsers,
      activeUsers,
      newEnrollments,
      courseCompletions,
      videoWatchMinutes: Math.round((videoProgress._sum.watchedSeconds || 0) / 60)
    },
    update: {
      totalUsers,
      activeUsers,
      newEnrollments,
      courseCompletions,
      videoWatchMinutes: Math.round((videoProgress._sum.watchedSeconds || 0) / 60)
    }
  });
}
