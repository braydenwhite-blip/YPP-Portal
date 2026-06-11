// Leadership Roles & Contributions — server-side loaders for the advisor
// dashboard, the instructor leadership section, the admin dashboard, and the
// student advising panel. Read-only; mutations live in *-actions.ts.

import type { AdvisingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeExpectationProgress,
  type ExpectationProgress,
} from "./expectations";
import {
  generateReviewEvidence,
  type AdvisorEvidenceStats,
  type ReviewEvidence,
} from "./review-summary";
import {
  assignmentsNeedingFollowUp,
  summarizeAdvisorCaseloads,
  studentsWithoutAdvisor,
  type AdvisorCaseloadSummary,
} from "./caseload";
import type { ContributionRow } from "./filters";

// ─────────────────────────────────────────────────────────────────────────────
// Instructor leadership section (own profile + admin instructor profile)
// ─────────────────────────────────────────────────────────────────────────────

export type InstructorLeadership = {
  contributions: Array<{
    id: string;
    category: string;
    title: string;
    description: string | null;
    status: string;
    expectedLevel: string;
    weight: number;
    isOwnership: boolean;
    reviewVisible: boolean;
    relatedLabel: string | null;
    relatedProgram: string | null;
    notes: string | null;
    adminOwnerName: string | null;
    startDate: Date;
    endDate: Date | null;
    activities: Array<{
      id: string;
      kind: string;
      body: string;
      authorName: string;
      createdAt: Date;
    }>;
  }>;
  advisorStats: AdvisorEvidenceStats;
  progress: ExpectationProgress;
  evidence: ReviewEvidence;
};

export async function loadInstructorLeadership(
  userId: string,
): Promise<InstructorLeadership> {
  const [contributions, activeAdvisees, checkIns, recommendations] =
    await Promise.all([
      prisma.leadershipContribution.findMany({
        where: { instructorId: userId },
        include: {
          relatedUser: { select: { name: true } },
          relatedOffering: { select: { title: true } },
          relatedPartner: { select: { name: true } },
          adminOwner: { select: { name: true } },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { author: { select: { name: true } } },
          },
        },
        orderBy: [{ status: "asc" }, { startDate: "desc" }],
      }),
      prisma.studentAdvisorAssignment.count({
        where: { advisorId: userId, isActive: true },
      }),
      prisma.advisingNote.count({
        where: { assignment: { advisorId: userId }, kind: "CHECK_IN" },
      }),
      prisma.advisingRecommendation.count({
        where: { assignment: { advisorId: userId } },
      }),
    ]);

  const advisorStats: AdvisorEvidenceStats = {
    activeAdvisees,
    checkInsLogged: checkIns,
    recommendationsMade: recommendations,
  };

  const progress = computeExpectationProgress(contributions);
  const evidence = generateReviewEvidence(contributions, advisorStats);

  return {
    contributions: contributions.map((c) => ({
      id: c.id,
      category: c.category,
      title: c.title,
      description: c.description,
      status: c.status,
      expectedLevel: c.expectedLevel,
      weight: c.weight,
      isOwnership: c.isOwnership,
      reviewVisible: c.reviewVisible,
      relatedLabel:
        c.relatedUser?.name ??
        c.relatedOffering?.title ??
        c.relatedPartner?.name ??
        c.relatedProgram ??
        null,
      relatedProgram: c.relatedProgram,
      notes: c.notes,
      adminOwnerName: c.adminOwner?.name ?? null,
      startDate: c.startDate,
      endDate: c.endDate,
      activities: c.activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        body: a.body,
        authorName: a.author.name,
        createdAt: a.createdAt,
      })),
    })),
    advisorStats,
    progress,
    evidence,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Advisor dashboard (/my-advisees)
// ─────────────────────────────────────────────────────────────────────────────

export async function loadAdvisorDashboard(advisorId: string) {
  const assignments = await prisma.studentAdvisorAssignment.findMany({
    where: { advisorId, isActive: true },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          chapter: { select: { name: true } },
          profile: { select: { interests: true, grade: true, school: true } },
        },
      },
      _count: { select: { notes: true, recommendations: true } },
    },
    orderBy: [{ needsFollowUp: "desc" }, { updatedAt: "desc" }],
  });

  return { assignments };
}

export async function loadAdvisingAssignmentDetail(assignmentId: string) {
  const assignment = await prisma.studentAdvisorAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      advisor: { select: { id: true, name: true, email: true } },
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          chapter: { select: { name: true } },
          profile: {
            select: {
              interests: true,
              grade: true,
              school: true,
              primaryGoal: true,
              bio: true,
            },
          },
          classEnrollments: {
            orderBy: { enrolledAt: "desc" },
            take: 8,
            select: {
              id: true,
              status: true,
              enrolledAt: true,
              offering: { select: { id: true, title: true } },
            },
          },
          menteePairs: {
            where: { status: "ACTIVE" },
            take: 3,
            select: { mentor: { select: { name: true } } },
          },
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { author: { select: { name: true } } },
      },
      recommendations: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
    },
  });

  return assignment;
}

// ─────────────────────────────────────────────────────────────────────────────
// Student advising panel (student profile)
// ─────────────────────────────────────────────────────────────────────────────

export async function loadStudentAdvisingPanel(studentId: string) {
  const assignment = await prisma.studentAdvisorAssignment.findFirst({
    where: { studentId, isActive: true },
    include: {
      advisor: { select: { id: true, name: true, email: true } },
      recommendations: {
        where: { status: { not: "DISMISSED" } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
    orderBy: { startDate: "desc" },
  });

  return assignment;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin leadership dashboard (/admin/leadership)
// ─────────────────────────────────────────────────────────────────────────────

export type InstructorExpectationRow = {
  instructorId: string;
  instructorName: string;
  email: string;
  progress: ExpectationProgress;
};

export type AdminLeadershipDashboard = {
  contributionRows: ContributionRow[];
  instructorOptions: Array<{ id: string; name: string }>;
  expectations: InstructorExpectationRow[];
  caseloads: Array<AdvisorCaseloadSummary & { advisorName: string }>;
  unadvisedStudents: Array<{ id: string; name: string; chapterName: string | null }>;
  followUps: Array<{
    assignmentId: string;
    studentName: string;
    advisorName: string;
    advisingStatus: AdvisingStatus;
    needsFollowUp: boolean;
    followUpNote: string | null;
    lastCheckInAt: Date | null;
  }>;
  ownershipGapRows: Array<
    Pick<ContributionRow, "category" | "status">
  >;
};

export async function loadAdminLeadershipDashboard(): Promise<AdminLeadershipDashboard> {
  const [contributions, instructors, students, assignments] =
    await Promise.all([
      prisma.leadershipContribution.findMany({
        include: {
          instructor: { select: { id: true, name: true, email: true } },
          relatedUser: { select: { name: true } },
          relatedOffering: { select: { title: true } },
          relatedPartner: { select: { name: true } },
          adminOwner: { select: { name: true } },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.user.findMany({
        where: {
          archivedAt: null,
          roles: { some: { role: "INSTRUCTOR" } },
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: {
          archivedAt: null,
          roles: { some: { role: "STUDENT" } },
        },
        select: { id: true, name: true, chapter: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.studentAdvisorAssignment.findMany({
        include: {
          advisor: { select: { id: true, name: true } },
          student: { select: { id: true, name: true } },
        },
      }),
    ]);

  const contributionRows: ContributionRow[] = contributions.map((c) => ({
    id: c.id,
    instructorId: c.instructorId,
    instructorName: c.instructor.name,
    category: c.category,
    title: c.title,
    status: c.status,
    expectedLevel: c.expectedLevel,
    weight: c.weight,
    isOwnership: c.isOwnership,
    reviewVisible: c.reviewVisible,
    relatedLabel:
      c.relatedUser?.name ??
      c.relatedOffering?.title ??
      c.relatedPartner?.name ??
      c.relatedProgram ??
      null,
    adminOwnerName: c.adminOwner?.name ?? null,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate?.toISOString() ?? null,
    lastActivityAt: c.activities[0]?.createdAt.toISOString() ?? null,
  }));

  // Per-instructor Senior/Lead expectation progress. Includes every
  // instructor, not just those with contributions, so "below expectations"
  // and "no contributions" are visible gaps rather than missing rows.
  const byInstructor = new Map<string, typeof contributions>();
  for (const c of contributions) {
    const list = byInstructor.get(c.instructorId) ?? [];
    list.push(c);
    byInstructor.set(c.instructorId, list);
  }
  const expectations: InstructorExpectationRow[] = instructors.map((i) => ({
    instructorId: i.id,
    instructorName: i.name,
    email: i.email,
    progress: computeExpectationProgress(byInstructor.get(i.id) ?? []),
  }));

  const advisorNames = new Map(
    assignments.map((a) => [a.advisorId, a.advisor.name]),
  );
  const caseloads = summarizeAdvisorCaseloads(assignments).map((summary) => ({
    ...summary,
    advisorName: advisorNames.get(summary.advisorId) ?? "Unknown",
  }));

  const unadvisedIds = new Set(
    studentsWithoutAdvisor(
      students.map((s) => s.id),
      assignments,
    ),
  );
  const unadvisedStudents = students
    .filter((s) => unadvisedIds.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      chapterName: s.chapter?.name ?? null,
    }));

  const followUps = assignmentsNeedingFollowUp(assignments).map((a) => ({
    assignmentId: a.id,
    studentName: a.student.name,
    advisorName: a.advisor.name,
    advisingStatus: a.advisingStatus,
    needsFollowUp: a.needsFollowUp,
    followUpNote: a.followUpNote,
    lastCheckInAt: a.lastCheckInAt,
  }));

  return {
    contributionRows,
    instructorOptions: instructors.map((i) => ({ id: i.id, name: i.name })),
    expectations,
    caseloads,
    unadvisedStudents,
    followUps,
    ownershipGapRows: contributions.map((c) => ({
      category: c.category,
      status: c.status,
    })),
  };
}
