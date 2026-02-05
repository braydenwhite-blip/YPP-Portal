"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { AttendanceStatus } from "@prisma/client";

// ============================================
// HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireStaffRole() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (
    !session?.user?.id ||
    (!roles.includes("ADMIN") &&
      !roles.includes("INSTRUCTOR") &&
      !roles.includes("CHAPTER_LEAD"))
  ) {
    throw new Error("Unauthorized");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

// ============================================
// 1. createAttendanceSession
// ============================================

export async function createAttendanceSession(formData: FormData) {
  const session = await requireStaffRole();
  const createdById = session.user.id;

  const title = getString(formData, "title");
  const dateStr = getString(formData, "date");
  const courseId = getString(formData, "courseId", false);
  const eventId = getString(formData, "eventId", false);

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  const attendanceSession = await prisma.attendanceSession.create({
    data: {
      title,
      date,
      courseId: courseId || null,
      eventId: eventId || null,
      createdById,
    },
  });

  revalidatePath("/attendance");
  return attendanceSession;
}

// ============================================
// 2. getAttendanceSessions
// ============================================

export async function getAttendanceSessions() {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  const isAdmin = roles.includes("ADMIN");
  const isInstructor = roles.includes("INSTRUCTOR");
  const isChapterLead = roles.includes("CHAPTER_LEAD");

  // Build the where clause based on role
  let whereClause = {};

  if (isAdmin) {
    // Admins see all sessions
    whereClause = {};
  } else if (isInstructor) {
    // Instructors see sessions for courses they lead
    const instructorCourses = await prisma.course.findMany({
      where: { leadInstructorId: userId },
      select: { id: true },
    });
    const courseIds = instructorCourses.map((c) => c.id);

    whereClause = {
      OR: [
        { courseId: { in: courseIds } },
        { createdById: userId },
      ],
    };
  } else if (isChapterLead) {
    // Chapter leads see sessions for courses in their chapter
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { chapterId: true },
    });

    if (currentUser?.chapterId) {
      const chapterCourses = await prisma.course.findMany({
        where: { chapterId: currentUser.chapterId },
        select: { id: true },
      });
      const courseIds = chapterCourses.map((c) => c.id);

      const chapterEvents = await prisma.event.findMany({
        where: { chapterId: currentUser.chapterId },
        select: { id: true },
      });
      const eventIds = chapterEvents.map((e) => e.id);

      whereClause = {
        OR: [
          { courseId: { in: courseIds } },
          { eventId: { in: eventIds } },
          { createdById: userId },
        ],
      };
    } else {
      whereClause = { createdById: userId };
    }
  } else {
    // Other roles only see sessions they created
    whereClause = { createdById: userId };
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: whereClause,
    include: {
      course: {
        select: { id: true, title: true },
      },
      event: {
        select: { id: true, title: true },
      },
      createdBy: {
        select: { id: true, name: true },
      },
      _count: {
        select: { records: true },
      },
    },
    orderBy: { date: "desc" },
  });

  return sessions;
}

// ============================================
// 3. getSessionWithRecords
// ============================================

export async function getSessionWithRecords(sessionId: string) {
  await requireAuth();

  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      course: {
        select: { id: true, title: true },
      },
      event: {
        select: { id: true, title: true },
      },
      createdBy: {
        select: { id: true, name: true },
      },
      records: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { checkedInAt: "asc" },
      },
    },
  });

  if (!session) {
    throw new Error("Attendance session not found");
  }

  return session;
}

// ============================================
// 4. recordAttendance
// ============================================

export async function recordAttendance(formData: FormData) {
  await requireStaffRole();

  const sessionId = getString(formData, "sessionId");
  const userId = getString(formData, "userId");
  const status = getString(formData, "status") as AttendanceStatus;
  const notes = getString(formData, "notes", false);

  if (!Object.values(AttendanceStatus).includes(status)) {
    throw new Error("Invalid attendance status");
  }

  // Verify the session exists
  const attendanceSession = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
  });

  if (!attendanceSession) {
    throw new Error("Attendance session not found");
  }

  await prisma.attendanceRecord.upsert({
    where: {
      sessionId_userId: { sessionId, userId },
    },
    create: {
      sessionId,
      userId,
      status,
      notes: notes || null,
    },
    update: {
      status,
      notes: notes || null,
      checkedInAt: new Date(),
    },
  });

  revalidatePath("/attendance");
  revalidatePath(`/attendance/${sessionId}`);
}

// ============================================
// 5. bulkRecordAttendance
// ============================================

export async function bulkRecordAttendance(formData: FormData) {
  await requireStaffRole();

  const sessionId = getString(formData, "sessionId");
  const recordsJson = getString(formData, "records");

  // Verify the session exists
  const attendanceSession = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
  });

  if (!attendanceSession) {
    throw new Error("Attendance session not found");
  }

  let records: { userId: string; status: AttendanceStatus }[];
  try {
    records = JSON.parse(recordsJson);
  } catch {
    throw new Error("Invalid records JSON");
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Records must be a non-empty array");
  }

  // Validate all statuses
  for (const record of records) {
    if (!record.userId || !record.status) {
      throw new Error("Each record must have userId and status");
    }
    if (!Object.values(AttendanceStatus).includes(record.status)) {
      throw new Error(`Invalid attendance status: ${record.status}`);
    }
  }

  await prisma.$transaction(
    records.map((record) =>
      prisma.attendanceRecord.upsert({
        where: {
          sessionId_userId: { sessionId, userId: record.userId },
        },
        create: {
          sessionId,
          userId: record.userId,
          status: record.status,
        },
        update: {
          status: record.status,
          checkedInAt: new Date(),
        },
      })
    )
  );

  revalidatePath("/attendance");
  revalidatePath(`/attendance/${sessionId}`);
}

// ============================================
// 6. getStudentAttendanceSummary
// ============================================

export async function getStudentAttendanceSummary(userId: string) {
  await requireAuth();

  const records = await prisma.attendanceRecord.findMany({
    where: { userId },
    select: { status: true },
  });

  const totalSessions = records.length;
  const presentCount = records.filter(
    (r) => r.status === AttendanceStatus.PRESENT
  ).length;
  const absentCount = records.filter(
    (r) => r.status === AttendanceStatus.ABSENT
  ).length;
  const lateCount = records.filter(
    (r) => r.status === AttendanceStatus.LATE
  ).length;
  const excusedCount = records.filter(
    (r) => r.status === AttendanceStatus.EXCUSED
  ).length;

  const attendanceRate =
    totalSessions > 0
      ? Math.round(((presentCount + lateCount) / totalSessions) * 100)
      : 0;

  return {
    userId,
    totalSessions,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    attendanceRate,
  };
}

// ============================================
// 7. getCourseAttendanceReport
// ============================================

export async function getCourseAttendanceReport(courseId: string) {
  await requireAuth();

  // Get all sessions for this course with their records
  const sessions = await prisma.attendanceSession.findMany({
    where: { courseId },
    include: {
      records: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  // Collect all unique students who have attendance records in this course
  const studentMap = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      presentCount: number;
      absentCount: number;
      lateCount: number;
      excusedCount: number;
      totalSessions: number;
    }
  >();

  for (const sess of sessions) {
    for (const record of sess.records) {
      const existing = studentMap.get(record.userId) || {
        id: record.user.id,
        name: record.user.name,
        email: record.user.email,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        excusedCount: 0,
        totalSessions: 0,
      };

      existing.totalSessions += 1;
      if (record.status === AttendanceStatus.PRESENT) existing.presentCount += 1;
      if (record.status === AttendanceStatus.ABSENT) existing.absentCount += 1;
      if (record.status === AttendanceStatus.LATE) existing.lateCount += 1;
      if (record.status === AttendanceStatus.EXCUSED) existing.excusedCount += 1;

      studentMap.set(record.userId, existing);
    }
  }

  const studentSummaries = Array.from(studentMap.values()).map((student) => ({
    ...student,
    attendanceRate:
      student.totalSessions > 0
        ? Math.round(
            ((student.presentCount + student.lateCount) /
              student.totalSessions) *
              100
          )
        : 0,
  }));

  return {
    courseId,
    totalSessions: sessions.length,
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      date: s.date,
      recordCount: s.records.length,
      records: s.records.map((r) => ({
        userId: r.userId,
        userName: r.user.name,
        status: r.status,
        notes: r.notes,
        checkedInAt: r.checkedInAt,
      })),
    })),
    studentSummaries,
  };
}

// ============================================
// 8. getMyAttendance
// ============================================

export async function getMyAttendance() {
  const session = await requireAuth();
  const userId = session.user.id;

  const records = await prisma.attendanceRecord.findMany({
    where: { userId },
    include: {
      session: {
        include: {
          course: {
            select: { id: true, title: true },
          },
          event: {
            select: { id: true, title: true },
          },
        },
      },
    },
    orderBy: { checkedInAt: "desc" },
  });

  return records;
}
