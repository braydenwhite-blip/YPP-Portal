"use server";

import { prisma } from "@/lib/prisma";

export type StudentProgressSnapshot = {
  activeEnrollments: number;
  dueAssignmentsNext7Days: number;
  upcomingSessionsNext7Days: number;
  trainingDue: number;
  nextPathwaySteps: number;
  submissionsStarted: number;
  checkInsThisWeek: number;
  checklist: {
    profileCompleted: boolean;
    joinedFirstClass: boolean;
    submittedFirstAssignment: boolean;
    checkedInAtLeastOnce: boolean;
  };
};

export async function getStudentProgressSnapshot(userId: string): Promise<StudentProgressSnapshot> {
  const now = new Date();
  const next7Days = new Date(now);
  next7Days.setDate(next7Days.getDate() + 7);

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  startOfWeek.setDate(startOfWeek.getDate() + offset);
  startOfWeek.setHours(0, 0, 0, 0);

  const [
    activeClassEnrollments,
    activeLegacyEnrollments,
    dueAssignmentsNext7Days,
    upcomingSessionsNext7Days,
    trainingDue,
    submissionsStarted,
    checkInsThisWeek,
    onboarding,
    pathways,
    legacyEnrollments,
  ] = await Promise.all([
    prisma.classEnrollment.count({
      where: { studentId: userId, status: "ENROLLED" },
    }),
    prisma.enrollment.count({
      where: { userId, status: "ENROLLED" },
    }),
    prisma.classAssignment.count({
      where: {
        isPublished: true,
        hardDeadline: {
          gte: now,
          lte: next7Days,
        },
        offering: {
          enrollments: {
            some: {
              studentId: userId,
              status: "ENROLLED",
            },
          },
        },
      },
    }),
    prisma.classSession.count({
      where: {
        isCancelled: false,
        date: {
          gte: now,
          lte: next7Days,
        },
        offering: {
          enrollments: {
            some: {
              studentId: userId,
              status: "ENROLLED",
            },
          },
        },
      },
    }),
    prisma.trainingAssignment.count({
      where: {
        userId,
        status: { not: "COMPLETE" },
      },
    }),
    prisma.classAssignmentSubmission.count({
      where: {
        studentId: userId,
        status: { not: "NOT_STARTED" },
      },
    }),
    prisma.attendanceRecord.count({
      where: {
        userId,
        checkedInAt: { gte: startOfWeek },
      },
    }),
    prisma.onboardingProgress.findUnique({
      where: { userId },
      select: { profileCompleted: true },
    }),
    prisma.pathway.findMany({
      select: {
        steps: {
          select: { courseId: true },
        },
      },
    }),
    prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true },
    }),
  ]);

  const enrolledCourseIds = new Set(legacyEnrollments.map((enrollment) => enrollment.courseId));
  const nextPathwaySteps = pathways.filter((pathway) =>
    pathway.steps.some((step) => !enrolledCourseIds.has(step.courseId))
  ).length;

  const activeEnrollments = activeClassEnrollments + activeLegacyEnrollments;

  return {
    activeEnrollments,
    dueAssignmentsNext7Days,
    upcomingSessionsNext7Days,
    trainingDue,
    nextPathwaySteps,
    submissionsStarted,
    checkInsThisWeek,
    checklist: {
      profileCompleted: onboarding?.profileCompleted ?? false,
      joinedFirstClass: activeEnrollments > 0,
      submittedFirstAssignment: submissionsStarted > 0,
      checkedInAtLeastOnce: checkInsThisWeek > 0,
    },
  };
}
