import { prisma } from "@/lib/prisma";

/**
 * Student full-360 record reads (Knowledge OS V2, plan §12).
 *
 * One loader assembling everything the admin student record shows: identity,
 * class enrollments (new ClassOffering enrollments + legacy course
 * enrollments), the full advisor assignment with check-in state, notes and
 * recommendations, mentor and parent/guardian links. Open actions/meetings
 * load separately through `getOperationalContextForEntity` (same loader the
 * other record pages use). Advisor state is the centerpiece — concrete dates
 * and flags, never a "student health" label (§19).
 */

export type StudentClassRow = {
  enrollmentId: string;
  offering: { id: string; title: string; semester: string | null };
  status: string;
  enrolledAtISO: string;
  sessionsAttended: number;
  sessionTotal: number;
  leadInstructor: { id: string; name: string } | null;
};

export type StudentAdvisingRecord = {
  assignmentId: string;
  advisor: { id: string; name: string; email: string };
  advisingStatus: string;
  startDateISO: string;
  checkInCadenceDays: number;
  lastCheckInISO: string | null;
  nextCheckInISO: string | null;
  overdue: boolean;
  needsFollowUp: boolean;
  followUpNote: string | null;
  nextSteps: string | null;
  notes: Array<{
    id: string;
    kind: string;
    body: string;
    authorName: string;
    createdAtISO: string;
  }>;
  recommendations: Array<{
    id: string;
    kind: string;
    title: string;
    detail: string | null;
    href: string | null;
    status: string;
    createdAtISO: string;
  }>;
};

export type StudentRecord = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  grade: number | null;
  school: string | null;
  chapterName: string | null;
  joinedAtISO: string;
  roleSet: string[];
  certificateCount: number;
  classes: StudentClassRow[];
  legacyCourses: Array<{
    enrollmentId: string;
    courseTitle: string;
    status: string;
    createdAtISO: string;
  }>;
  advising: StudentAdvisingRecord | null;
  mentor: { id: string; name: string; sinceISO: string } | null;
  parents: Array<{ id: string; name: string; relationship: string }>;
};

export async function loadStudentRecord(
  id: string,
  now: Date = new Date()
): Promise<StudentRecord | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      archivedAt: true,
      createdAt: true,
      roles: { select: { role: true } },
      chapter: { select: { name: true } },
      profile: { select: { grade: true, school: true, avatarUrl: true } },
      _count: { select: { certificates: true } },
      classEnrollments: {
        orderBy: { enrolledAt: "desc" },
        take: 20,
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          sessionsAttended: true,
          offering: {
            select: {
              id: true,
              title: true,
              semester: true,
              instructor: { select: { id: true, name: true, email: true } },
              _count: { select: { sessions: true } },
            },
          },
        },
      },
      enrollments: {
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          status: true,
          createdAt: true,
          course: { select: { title: true } },
        },
      },
      adviseeAssignments: {
        where: { isActive: true },
        orderBy: { startDate: "desc" },
        take: 1,
        select: {
          id: true,
          advisingStatus: true,
          startDate: true,
          checkInCadenceDays: true,
          lastCheckInAt: true,
          nextCheckInDueAt: true,
          needsFollowUp: true,
          followUpNote: true,
          nextSteps: true,
          advisor: { select: { id: true, name: true, email: true } },
          notes: {
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
              id: true,
              kind: true,
              body: true,
              createdAt: true,
              author: { select: { name: true, email: true } },
            },
          },
          recommendations: {
            where: { status: { not: "DISMISSED" } },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
              id: true,
              kind: true,
              title: true,
              detail: true,
              href: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
      menteePairs: {
        where: { status: "ACTIVE", type: "STUDENT" },
        take: 1,
        select: {
          startDate: true,
          mentor: { select: { id: true, name: true, email: true } },
        },
      },
      studentLinks: {
        where: { archivedAt: null, approvalStatus: "APPROVED" },
        select: {
          relationship: true,
          parent: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!user || user.archivedAt) return null;

  const roleSet = Array.from(
    new Set<string>([user.primaryRole, ...user.roles.map((r) => r.role)])
  );
  if (!roleSet.includes("STUDENT")) return null;

  const advisingRaw = user.adviseeAssignments[0] ?? null;
  const advising: StudentAdvisingRecord | null = advisingRaw
    ? {
        assignmentId: advisingRaw.id,
        advisor: {
          id: advisingRaw.advisor.id,
          name: advisingRaw.advisor.name || advisingRaw.advisor.email,
          email: advisingRaw.advisor.email,
        },
        advisingStatus: advisingRaw.advisingStatus,
        startDateISO: advisingRaw.startDate.toISOString(),
        checkInCadenceDays: advisingRaw.checkInCadenceDays,
        lastCheckInISO: advisingRaw.lastCheckInAt?.toISOString() ?? null,
        nextCheckInISO: advisingRaw.nextCheckInDueAt?.toISOString() ?? null,
        overdue: Boolean(
          advisingRaw.nextCheckInDueAt &&
            advisingRaw.nextCheckInDueAt.getTime() < now.getTime()
        ),
        needsFollowUp: advisingRaw.needsFollowUp,
        followUpNote: advisingRaw.followUpNote,
        nextSteps: advisingRaw.nextSteps,
        notes: advisingRaw.notes.map((n) => ({
          id: n.id,
          kind: n.kind,
          body: n.body,
          authorName: n.author.name || n.author.email,
          createdAtISO: n.createdAt.toISOString(),
        })),
        recommendations: advisingRaw.recommendations.map((r) => ({
          id: r.id,
          kind: r.kind,
          title: r.title,
          detail: r.detail,
          href: r.href,
          status: r.status,
          createdAtISO: r.createdAt.toISOString(),
        })),
      }
    : null;

  const mentorPair = user.menteePairs[0] ?? null;

  return {
    id: user.id,
    name: user.name || user.email,
    email: user.email,
    avatarUrl: user.profile?.avatarUrl ?? null,
    grade: user.profile?.grade ?? null,
    school: user.profile?.school ?? null,
    chapterName: user.chapter?.name ?? null,
    joinedAtISO: user.createdAt.toISOString(),
    roleSet,
    certificateCount: user._count.certificates,
    classes: user.classEnrollments.map((e) => ({
      enrollmentId: e.id,
      offering: {
        id: e.offering.id,
        title: e.offering.title,
        semester: e.offering.semester,
      },
      status: e.status,
      enrolledAtISO: e.enrolledAt.toISOString(),
      sessionsAttended: e.sessionsAttended,
      sessionTotal: e.offering._count.sessions,
      leadInstructor: e.offering.instructor
        ? {
            id: e.offering.instructor.id,
            name: e.offering.instructor.name || e.offering.instructor.email,
          }
        : null,
    })),
    legacyCourses: user.enrollments.map((e) => ({
      enrollmentId: e.id,
      courseTitle: e.course.title,
      status: e.status,
      createdAtISO: e.createdAt.toISOString(),
    })),
    advising,
    mentor: mentorPair
      ? {
          id: mentorPair.mentor.id,
          name: mentorPair.mentor.name || mentorPair.mentor.email,
          sinceISO: mentorPair.startDate.toISOString(),
        }
      : null,
    parents: user.studentLinks.map((link) => ({
      id: link.parent.id,
      name: link.parent.name || link.parent.email,
      relationship: link.relationship,
    })),
  };
}
