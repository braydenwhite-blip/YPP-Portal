// Student Advising cockpit — server data loader.
//
// Loads the advising picture in a few batched queries, normalises it into the
// pure-selector input shape, and returns a fully-built, serializable cockpit
// plus the advisor picker pool the drawers need. Read-only; mutations live in
// lib/leadership/advisor-actions.ts.

import { prisma } from "@/lib/prisma";
import {
  summarizeAdvisorCaseloads,
  type AssignmentLike,
} from "@/lib/leadership/caseload";
import { buildAdvisorMatchSuggestions } from "./suggestions";
import { buildStudentAdvisingCockpit } from "./cockpit";
import type {
  AdvisingAdvisorRow,
  AdvisingAssignmentRow,
  AdvisingCockpit,
  AdvisingCockpitInput,
  AdvisingStudentRow,
} from "./types";

export type AdvisorPickOption = {
  id: string;
  name: string;
  activeCount: number;
  band: "HIGH" | "TYPICAL" | "LOW";
  chapterName: string | null;
};

export type AdvisingCockpitViewer = {
  id: string;
  roles: string[];
  chapterId?: string | null;
};

export type AdvisingCockpitData = {
  cockpit: AdvisingCockpit;
  advisorPool: AdvisorPickOption[];
  /** Lightweight list of unassigned students for the assign drawer. */
  unassignedStudents: Array<{ id: string; name: string; chapterName: string | null }>;
};

function chapterScoped(viewer: AdvisingCockpitViewer): string | null {
  const isOrgWide =
    viewer.roles.includes("ADMIN") || viewer.roles.includes("STAFF");
  if (isOrgWide) return null;
  if (viewer.roles.includes("CHAPTER_PRESIDENT") && viewer.chapterId) {
    return viewer.chapterId;
  }
  return null;
}

export async function loadAdvisingCockpitData(
  viewer: AdvisingCockpitViewer,
  now: Date = new Date(),
): Promise<AdvisingCockpitData> {
  const scopeChapterId = chapterScoped(viewer);

  const [allAssignments, students, advisorUsers] = await Promise.all([
    prisma.studentAdvisorAssignment.findMany({
      include: {
        student: {
          select: {
            id: true,
            name: true,
            chapterId: true,
            chapter: { select: { name: true } },
            profile: { select: { interests: true, grade: true } },
          },
        },
        advisor: { select: { id: true, name: true } },
        recommendations: {
          where: { status: "SUGGESTED" },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: { select: { notes: true, recommendations: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        archivedAt: null,
        roles: { some: { role: "STUDENT" } },
        ...(scopeChapterId ? { chapterId: scopeChapterId } : {}),
      },
      select: {
        id: true,
        name: true,
        chapterId: true,
        chapter: { select: { name: true } },
        profile: { select: { interests: true, grade: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { archivedAt: null, roles: { some: { role: "INSTRUCTOR" } } },
      select: {
        id: true,
        name: true,
        chapterId: true,
        chapter: { select: { name: true } },
        profile: { select: { interests: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Caseload summary across ALL assignments (org-wide, so capacity is real).
  const caseloadInput: AssignmentLike[] = allAssignments.map((a) => ({
    advisorId: a.advisorId,
    studentId: a.studentId,
    isActive: a.isActive,
    advisingStatus: a.advisingStatus,
    needsFollowUp: a.needsFollowUp,
    lastCheckInAt: a.lastCheckInAt,
    startDate: a.startDate,
  }));
  const caseloads = summarizeAdvisorCaseloads(caseloadInput, now);
  const caseloadByAdvisor = new Map(caseloads.map((c) => [c.advisorId, c]));

  // Advisor rows = instructor pool unioned with anyone already advising.
  const advisorRowById = new Map<string, AdvisingAdvisorRow>();
  const registerAdvisor = (u: {
    id: string;
    name: string;
    chapterId: string | null;
    chapter: { name: string } | null;
    profile: { interests: string[] } | null;
  }) => {
    if (advisorRowById.has(u.id)) return;
    const load = caseloadByAdvisor.get(u.id);
    advisorRowById.set(u.id, {
      id: u.id,
      name: u.name,
      interests: u.profile?.interests ?? [],
      chapterId: u.chapterId,
      chapterName: u.chapter?.name ?? null,
      activeCount: load?.activeCount ?? 0,
      band: load?.band ?? "LOW",
      health: load?.health ?? "ACTIVE",
      needsFollowUpCount: load?.needsFollowUpCount ?? 0,
      lastCheckInAt: load?.lastCheckInAt ?? null,
    });
  };
  for (const u of advisorUsers) registerAdvisor(u);
  // Ensure advisors who aren't instructors still appear with their load.
  for (const a of allAssignments) {
    if (!advisorRowById.has(a.advisorId)) {
      registerAdvisor({
        id: a.advisor.id,
        name: a.advisor.name,
        chapterId: null,
        chapter: null,
        profile: null,
      });
    }
  }
  const advisors = Array.from(advisorRowById.values());

  // Normalise assignments for the selector (chapter-scoped for CPs).
  const assignmentRows: AdvisingAssignmentRow[] = allAssignments
    .filter((a) => !scopeChapterId || a.student.chapterId === scopeChapterId)
    .map((a) => ({
      assignmentId: a.id,
      isActive: a.isActive,
      advisingStatus: a.advisingStatus,
      needsFollowUp: a.needsFollowUp,
      followUpNote: a.followUpNote,
      nextSteps: a.nextSteps,
      lastCheckInAt: a.lastCheckInAt,
      nextCheckInDueAt: a.nextCheckInDueAt,
      startDate: a.startDate,
      endedAt: a.endedAt,
      studentId: a.studentId,
      studentName: a.student.name,
      studentInterests: a.student.profile?.interests ?? [],
      studentGrade: a.student.profile?.grade ?? null,
      studentChapterName: a.student.chapter?.name ?? null,
      advisorId: a.advisorId,
      advisorName: a.advisor.name,
      noteCount: a._count.notes,
      recommendationCount: a._count.recommendations,
      pendingRecommendations: a.recommendations.map((r) => ({
        id: r.id,
        assignmentId: a.id,
        studentId: a.studentId,
        studentName: a.student.name,
        advisorId: a.advisorId,
        advisorName: a.advisor.name,
        kind: r.kind,
        title: r.title,
        detail: r.detail,
        createdAt: r.createdAt,
      })),
    }));

  // Unadvised = students with no active assignment.
  const advisedStudentIds = new Set(
    allAssignments.filter((a) => a.isActive).map((a) => a.studentId),
  );
  const unadvisedStudents: AdvisingStudentRow[] = students
    .filter((s) => !advisedStudentIds.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      interests: s.profile?.interests ?? [],
      grade: s.profile?.grade ?? null,
      chapterId: s.chapterId,
      chapterName: s.chapter?.name ?? null,
    }));

  // Deterministic suggestions for each unadvised student.
  const suggestionsByStudent: Record<string, ReturnType<typeof buildAdvisorMatchSuggestions>> = {};
  for (const student of unadvisedStudents) {
    suggestionsByStudent[student.id] = buildAdvisorMatchSuggestions(student, advisors, 3);
  }

  const input: AdvisingCockpitInput = {
    assignments: assignmentRows,
    unadvisedStudents,
    advisors,
    suggestionsByStudent,
  };

  const cockpit = buildStudentAdvisingCockpit(input, now);

  const advisorPool: AdvisorPickOption[] = advisors
    .map((a) => ({
      id: a.id,
      name: a.name,
      activeCount: a.activeCount,
      band: a.band,
      chapterName: a.chapterName,
    }))
    .sort((a, b) => {
      if (a.activeCount !== b.activeCount) return a.activeCount - b.activeCount;
      return a.name.localeCompare(b.name);
    });

  return {
    cockpit,
    advisorPool,
    unassignedStudents: unadvisedStudents.map((s) => ({
      id: s.id,
      name: s.name,
      chapterName: s.chapterName,
    })),
  };
}
