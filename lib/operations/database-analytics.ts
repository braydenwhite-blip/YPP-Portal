import { prisma } from "@/lib/prisma";

export type DatabaseAnalytics = {
  totalUsers: number;
  totalChapters: number;
  totalCourses: number;
  totalEnrollments: number;
  totalActionItems: number;
  totalPartners: number;
  totalMentorships: number;
  totalEvents: number;
  totalCertificates: number;
  totalAttendanceRecords: number;
  totalFeedbackRecords: number;
  totalAuditLogs: number;
  actionItemsByStatus: Record<string, number>;
  usersByRole: Record<string, number>;
  usersByChapter: Array<{ chapterId: string; chapterName: string; count: number }>;
  coursesByFormat: Record<string, number>;
  coursesByLevel: Record<string, number>;
  enrollmentsByStatus: Record<string, number>;
  certificatesByType: Record<string, number>;
  attendanceByStatus: Record<string, number>;
  eventsByType: Record<string, number>;
  feedbackBySource: Record<string, number>;
  feedbackAverageRating: number;
};

export async function getDatabaseAnalytics(): Promise<DatabaseAnalytics> {
  const [
    totalUsers,
    totalChapters,
    totalCourses,
    totalEnrollments,
    totalActionItems,
    totalPartners,
    totalMentorships,
    totalEvents,
    totalCertificates,
    totalAttendanceRecords,
    totalFeedbackRecords,
    totalAuditLogs,
    actionItemsByStatus,
    usersByRole,
    usersByChapter,
    coursesByFormat,
    coursesByLevel,
    enrollmentsByStatus,
    certificatesByType,
    attendanceByStatus,
    eventsByType,
    feedbackBySource,
    feedbackStats,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.chapter.count(),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.actionItem.count(),
    prisma.partner.count(),
    prisma.mentorship.count(),
    prisma.event.count(),
    prisma.certificate.count(),
    prisma.attendanceRecord.count(),
    prisma.feedback.count(),
    prisma.auditLog.count(),
    prisma.actionItem.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.user.groupBy({
      by: ["primaryRole"],
      _count: { primaryRole: true },
    }),
    prisma.user.groupBy({
      by: ["chapterId"],
      _count: { chapterId: true },
    }),
    prisma.course.groupBy({
      by: ["format"],
      _count: { format: true },
    }),
    prisma.course.groupBy({
      by: ["level"],
      _count: { level: true },
    }),
    prisma.enrollment.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    // Certificate doesn't have awardType field - skip grouping
    Promise.resolve([]),
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.event.groupBy({
      by: ["eventType"],
      _count: { eventType: true },
    }),
    prisma.feedback.groupBy({
      by: ["source"],
      _count: { source: true },
    }),
    prisma.feedback.aggregate({
      _avg: { rating: true },
    }),
  ]);

  const actionStatusMap = new Map(
    actionItemsByStatus.map((item) => [item.status, item._count.status])
  );

  const userRoleMap = new Map(
    usersByRole.map((item) => [item.primaryRole, item._count.primaryRole])
  );

  const coursesByFormatMap = new Map(
    coursesByFormat.map((item) => [item.format, item._count.format])
  );

  const coursesByLevelMap = new Map(
    coursesByLevel.map((item) => [item.level, item._count.level])
  );

  const enrollmentsByStatusMap = new Map(
    enrollmentsByStatus.map((item) => [item.status, item._count.status])
  );

  // Certificate doesn't have awardType - create empty map
  const certificatesByTypeMap = new Map<string, number>();

  const attendanceByStatusMap = new Map(
    attendanceByStatus.map((item) => [item.status, item._count.status])
  );

  const eventsByTypeMap = new Map(
    eventsByType.map((item) => [item.eventType, item._count.eventType])
  );

  const feedbackBySourceMap = new Map(
    feedbackBySource.map((item) => [item.source, item._count.source])
  );

  // Fetch chapter names for users by chapter
  const chapterIds = usersByChapter.map((item) => item.chapterId).filter((id): id is string => id !== null);
  const chapters = await prisma.chapter.findMany({
    where: { id: { in: chapterIds } },
    select: { id: true, name: true },
  });
  const chapterNameMap = new Map(chapters.map((c) => [c.id, c.name]));

  const usersByChapterData = usersByChapter
    .filter((item) => item.chapterId !== null)
    .map((item) => ({
      chapterId: item.chapterId!,
      chapterName: chapterNameMap.get(item.chapterId!) || "Unknown",
      count: item._count.chapterId,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalUsers,
    totalChapters,
    totalCourses,
    totalEnrollments,
    totalActionItems,
    totalPartners,
    totalMentorships,
    totalEvents,
    totalCertificates,
    totalAttendanceRecords,
    totalFeedbackRecords,
    totalAuditLogs,
    actionItemsByStatus: Object.fromEntries(actionStatusMap),
    usersByRole: Object.fromEntries(userRoleMap),
    usersByChapter: usersByChapterData,
    coursesByFormat: Object.fromEntries(coursesByFormatMap),
    coursesByLevel: Object.fromEntries(coursesByLevelMap),
    enrollmentsByStatus: Object.fromEntries(enrollmentsByStatusMap),
    certificatesByType: Object.fromEntries(certificatesByTypeMap),
    attendanceByStatus: Object.fromEntries(attendanceByStatusMap),
    eventsByType: Object.fromEntries(eventsByTypeMap),
    feedbackBySource: Object.fromEntries(feedbackBySourceMap),
    feedbackAverageRating: Math.round((feedbackStats._avg.rating || 0) * 10) / 10,
  };
}
