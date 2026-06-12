"use server";

// Student Advisor workflow — server actions. Admins assign/end advisors;
// the advisor (or an admin) logs notes and check-ins, sets advising status,
// flags follow-up, maintains next steps, and recommends opportunities.
//
// Assigning an advisor get-or-creates an ACTIVE STUDENT_ADVISOR
// LeadershipContribution for that advisor and back-links every assignment to
// it, so advising work automatically counts as leadership/review evidence.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AdvisingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { requireAdmin } from "@/lib/authorization-helpers";
import {
  ADVISING_NOTE_KINDS,
  LEADERSHIP_ROLE_CATALOG,
  RECOMMENDATION_KINDS,
  RECOMMENDATION_STATUSES,
} from "./constants";

const ADVISOR_PATHS = ["/my-advisees", "/admin/leadership", "/profile"];

function revalidateAdvising(assignmentId?: string) {
  for (const path of ADVISOR_PATHS) revalidatePath(path);
  if (assignmentId) revalidatePath(`/my-advisees/${assignmentId}`);
}

async function requireSessionUser() {
  const session = await getSession();
  const user = session?.user;
  if (!user?.id) throw new Error("Unauthorized");
  return user as { id: string; roles?: string[] };
}

function isAdminUser(user: { roles?: string[] }): boolean {
  return (user.roles ?? []).includes("ADMIN");
}

/** Load an assignment and verify the caller is its advisor or an admin. */
async function requireAssignmentAccess(assignmentId: string) {
  const user = await requireSessionUser();
  const assignment = await prisma.studentAdvisorAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      advisorId: true,
      studentId: true,
      contributionId: true,
      checkInCadenceDays: true,
    },
  });
  if (!assignment) throw new Error("Assignment not found");
  if (!isAdminUser(user) && assignment.advisorId !== user.id) {
    throw new Error("Forbidden");
  }
  return { user, assignment };
}

// ─────────────────────────────────────────────────────────────────────────────
// Assignment (admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get-or-create the advisor's STUDENT_ADVISOR leadership contribution so
 * advising shows up on their leadership record and in reviews.
 */
async function ensureAdvisorContribution(advisorId: string, adminId: string) {
  const existing = await prisma.leadershipContribution.findFirst({
    where: {
      instructorId: advisorId,
      category: "STUDENT_ADVISOR",
      status: { in: ["SUGGESTED", "ASSIGNED", "ACTIVE", "NEEDS_ATTENTION"] },
    },
    select: { id: true, status: true },
  });
  if (existing) {
    if (existing.status !== "ACTIVE") {
      await prisma.leadershipContribution.update({
        where: { id: existing.id },
        data: { status: "ACTIVE" },
      });
    }
    return existing.id;
  }

  const definition = LEADERSHIP_ROLE_CATALOG.STUDENT_ADVISOR;
  const created = await prisma.leadershipContribution.create({
    data: {
      instructorId: advisorId,
      category: "STUDENT_ADVISOR",
      title: definition.label,
      description: definition.description,
      status: "ACTIVE",
      expectedLevel: definition.defaultLevel,
      weight: definition.defaultWeight,
      isOwnership: definition.isOwnership,
      adminOwnerId: adminId,
      createdById: adminId,
    },
    select: { id: true },
  });
  return created.id;
}

const assignAdvisorSchema = z.object({
  advisorId: z.string().min(1),
  studentIds: z.array(z.string().min(1)).min(1),
});

/**
 * Assign an advisor to one or more students. Re-assigning a previously ended
 * pair reactivates the existing row (history preserved) instead of
 * duplicating it.
 */
export async function assignStudentAdvisor(
  input: z.infer<typeof assignAdvisorSchema>,
) {
  const admin = await requireAdmin();
  const data = assignAdvisorSchema.parse(input);

  const contributionId = await ensureAdvisorContribution(
    data.advisorId,
    admin.id,
  );

  // Seed the first check-in due date from the default cadence so a fresh
  // assignment is schedulable (and eventually overdue) from day one
  // (Knowledge OS V2, plan §12/§23).
  const DEFAULT_CADENCE_DAYS = 14;
  const firstCheckInDue = new Date(
    Date.now() + DEFAULT_CADENCE_DAYS * 24 * 60 * 60 * 1000,
  );

  for (const studentId of data.studentIds) {
    if (studentId === data.advisorId) continue;
    await prisma.studentAdvisorAssignment.upsert({
      where: {
        advisorId_studentId: { advisorId: data.advisorId, studentId },
      },
      create: {
        advisorId: data.advisorId,
        studentId,
        contributionId,
        assignedById: admin.id,
        nextCheckInDueAt: firstCheckInDue,
      },
      update: {
        isActive: true,
        endedAt: null,
        contributionId,
        assignedById: admin.id,
        nextCheckInDueAt: firstCheckInDue,
      },
    });
  }

  revalidateAdvising();
  return { success: true, contributionId };
}

export async function endAdvisorAssignment(assignmentId: string) {
  await requireAdmin();
  const assignment = await prisma.studentAdvisorAssignment.update({
    where: { id: assignmentId },
    data: { isActive: false, endedAt: new Date(), needsFollowUp: false },
    select: { advisorId: true, contributionId: true },
  });

  // If that was the advisor's last active advisee, mark the contribution
  // completed so their leadership record reflects reality.
  const remaining = await prisma.studentAdvisorAssignment.count({
    where: { advisorId: assignment.advisorId, isActive: true },
  });
  if (remaining === 0 && assignment.contributionId) {
    await prisma.leadershipContribution.update({
      where: { id: assignment.contributionId },
      data: { status: "COMPLETED", endDate: new Date() },
    });
  }

  revalidateAdvising(assignmentId);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Advising work (advisor or admin)
// ─────────────────────────────────────────────────────────────────────────────

const addNoteSchema = z.object({
  assignmentId: z.string().min(1),
  kind: z.enum(ADVISING_NOTE_KINDS).default("NOTE"),
  body: z.string().trim().min(1).max(8000),
});

export async function addAdvisingNote(input: z.infer<typeof addNoteSchema>) {
  const data = addNoteSchema.parse(input);
  const { user, assignment } = await requireAssignmentAccess(data.assignmentId);

  await prisma.advisingNote.create({
    data: {
      assignmentId: data.assignmentId,
      authorId: user.id,
      kind: data.kind,
      body: data.body,
    },
  });

  if (data.kind === "CHECK_IN") {
    // A logged check-in also schedules the next one from the assignment's
    // cadence, so "check-in overdue" stays a stored, queryable fact
    // (Knowledge OS V2, plan §12/§23).
    const now = new Date();
    const cadenceDays = assignment.checkInCadenceDays ?? 14;
    const nextDue = new Date(now.getTime() + cadenceDays * 24 * 60 * 60 * 1000);
    await prisma.studentAdvisorAssignment.update({
      where: { id: data.assignmentId },
      data: { lastCheckInAt: now, nextCheckInDueAt: nextDue },
    });
  }

  revalidateAdvising(assignment.id);
  return { success: true };
}

export async function setAdvisingStatus(
  assignmentId: string,
  advisingStatus: AdvisingStatus,
) {
  const parsedStatus = z.nativeEnum(AdvisingStatus).parse(advisingStatus);
  const { assignment } = await requireAssignmentAccess(assignmentId);

  await prisma.studentAdvisorAssignment.update({
    where: { id: assignmentId },
    data: { advisingStatus: parsedStatus },
  });

  revalidateAdvising(assignment.id);
  return { success: true };
}

const followUpSchema = z.object({
  assignmentId: z.string().min(1),
  needsFollowUp: z.boolean(),
  followUpNote: z.string().trim().max(500).optional(),
});

export async function setFollowUpFlag(input: z.infer<typeof followUpSchema>) {
  const data = followUpSchema.parse(input);
  const { assignment } = await requireAssignmentAccess(data.assignmentId);

  await prisma.studentAdvisorAssignment.update({
    where: { id: data.assignmentId },
    data: {
      needsFollowUp: data.needsFollowUp,
      followUpNote: data.needsFollowUp ? data.followUpNote || null : null,
    },
  });

  revalidateAdvising(assignment.id);
  return { success: true };
}

export async function setNextSteps(assignmentId: string, nextSteps: string) {
  const body = z.string().trim().max(4000).parse(nextSteps);
  const { assignment } = await requireAssignmentAccess(assignmentId);

  await prisma.studentAdvisorAssignment.update({
    where: { id: assignmentId },
    data: { nextSteps: body || null },
  });

  revalidateAdvising(assignment.id);
  return { success: true };
}

const addRecommendationSchema = z.object({
  assignmentId: z.string().min(1),
  kind: z.enum(RECOMMENDATION_KINDS).default("OPPORTUNITY"),
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(2000).optional(),
  href: z.string().trim().max(500).optional(),
});

export async function addAdvisingRecommendation(
  input: z.infer<typeof addRecommendationSchema>,
) {
  const data = addRecommendationSchema.parse(input);
  const { user, assignment } = await requireAssignmentAccess(data.assignmentId);

  await prisma.advisingRecommendation.create({
    data: {
      assignmentId: data.assignmentId,
      authorId: user.id,
      kind: data.kind,
      title: data.title,
      detail: data.detail || null,
      href: data.href || null,
    },
  });

  revalidateAdvising(assignment.id);
  return { success: true };
}

export async function updateRecommendationStatus(
  recommendationId: string,
  status: (typeof RECOMMENDATION_STATUSES)[number],
) {
  const parsedStatus = z.enum(RECOMMENDATION_STATUSES).parse(status);
  const user = await requireSessionUser();

  const recommendation = await prisma.advisingRecommendation.findUnique({
    where: { id: recommendationId },
    select: { id: true, assignment: { select: { id: true, advisorId: true } } },
  });
  if (!recommendation) throw new Error("Recommendation not found");
  if (!isAdminUser(user) && recommendation.assignment.advisorId !== user.id) {
    throw new Error("Forbidden");
  }

  await prisma.advisingRecommendation.update({
    where: { id: recommendationId },
    data: { status: parsedStatus },
  });

  revalidateAdvising(recommendation.assignment.id);
  return { success: true };
}
