"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { enrollStudentInOffering } from "@/lib/class-management-actions";
import { enrollStudentInProgram } from "@/lib/program-actions";
import { hasInstructorCohortTables } from "@/lib/schema-compat";

const INSTRUCTOR_COHORT_SCHEMA_MESSAGE =
  "Cohort enrollment tools will be available after the latest cohort database migration is applied to this deployment.";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireInstructor() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (
    !session?.user?.id ||
    (!roles.includes("ADMIN") &&
      !roles.includes("INSTRUCTOR") &&
      !roles.includes("CHAPTER_LEAD"))
  ) {
    throw new Error("Unauthorized – instructor role required");
  }
  return session;
}

async function requireInstructorCohortTables() {
  if (!(await hasInstructorCohortTables())) {
    throw new Error(INSTRUCTOR_COHORT_SCHEMA_MESSAGE);
  }
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value ? String(value).trim() : "";
}

// ─── Cohort CRUD ─────────────────────────────────────────────────────────────

export async function createInstructorCohort(formData: FormData) {
  const session = await requireInstructor();
  await requireInstructorCohortTables();

  const name = getString(formData, "name");
  const chapterId = getString(formData, "chapterId");

  const cohort = await prisma.instructorCohort.create({
    data: {
      name,
      chapterId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/instructor/workspace");
  return { success: true, cohortId: cohort.id };
}

export async function updateInstructorCohort(id: string, formData: FormData) {
  await requireInstructor();
  await requireInstructorCohortTables();
  const name = getString(formData, "name");
  await prisma.instructorCohort.update({ where: { id }, data: { name } });
  revalidatePath("/instructor/workspace");
  return { success: true };
}

export async function deleteInstructorCohort(id: string) {
  await requireInstructor();
  await requireInstructorCohortTables();
  await prisma.instructorCohort.delete({ where: { id } });
  revalidatePath("/instructor/workspace");
  return { success: true };
}

// ─── Membership ──────────────────────────────────────────────────────────────

export async function addMembersToCohort(cohortId: string, userIds: string[]) {
  await requireInstructor();
  await requireInstructorCohortTables();

  const results: { userId: string; added: boolean }[] = [];

  for (const userId of userIds) {
    try {
      await prisma.instructorCohortMember.create({
        data: { cohortId, userId },
      });
      results.push({ userId, added: true });
    } catch {
      // Likely a duplicate — skip silently
      results.push({ userId, added: false });
    }
  }

  revalidatePath("/instructor/workspace");
  return { success: true, results };
}

export async function removeMemberFromCohort(cohortId: string, userId: string) {
  await requireInstructor();
  await requireInstructorCohortTables();

  await prisma.instructorCohortMember.deleteMany({
    where: { cohortId, userId },
  });

  revalidatePath("/instructor/workspace");
  return { success: true };
}

// ─── Bulk Enrollment ─────────────────────────────────────────────────────────

/**
 * Enroll all members of a cohort into a ClassOffering.
 * Idempotent per student — already-enrolled members are skipped.
 */
export async function enrollCohortInOffering(
  cohortId: string,
  offeringId: string
) {
  await requireInstructor();
  await requireInstructorCohortTables();

  const cohort = await prisma.instructorCohort.findUnique({
    where: { id: cohortId },
    include: { members: true },
  });

  if (!cohort) throw new Error("Cohort not found");

  const results: Array<{
    userId: string;
    success: boolean;
    waitlisted: boolean;
    skipped: boolean;
    error?: string;
  }> = [];

  for (const member of cohort.members) {
    try {
      const res = await enrollStudentInOffering(member.userId, offeringId);
      results.push({
        userId: member.userId,
        success: true,
        waitlisted: res.waitlisted,
        skipped: res.skipped,
      });
    } catch (e) {
      results.push({
        userId: member.userId,
        success: false,
        waitlisted: false,
        skipped: false,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  revalidatePath(`/curriculum/${offeringId}`);
  revalidatePath("/instructor/workspace");

  const enrolled = results.filter((r) => r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success).length;

  return { success: true, enrolled, skipped, failed, results };
}

/**
 * Enroll all members of a cohort into a SpecialProgram (e.g. Passion Lab).
 * Idempotent per student.
 */
export async function enrollCohortInProgram(
  cohortId: string,
  programId: string
) {
  await requireInstructor();
  await requireInstructorCohortTables();

  const cohort = await prisma.instructorCohort.findUnique({
    where: { id: cohortId },
    include: { members: true },
  });

  if (!cohort) throw new Error("Cohort not found");

  const results: Array<{
    userId: string;
    success: boolean;
    skipped: boolean;
    error?: string;
  }> = [];

  for (const member of cohort.members) {
    try {
      const res = await enrollStudentInProgram(member.userId, programId);
      results.push({ userId: member.userId, success: true, skipped: res.skipped });
    } catch (e) {
      results.push({
        userId: member.userId,
        success: false,
        skipped: false,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  revalidatePath(`/programs/${programId}`);
  revalidatePath("/instructor/workspace");

  const enrolled = results.filter((r) => r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success).length;

  return { success: true, enrolled, skipped, failed, results };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getInstructorCohorts(chapterId?: string) {
  const session = await requireInstructor();
  if (!(await hasInstructorCohortTables())) {
    return [];
  }

  return prisma.instructorCohort.findMany({
    where: {
      createdById: session.user.id,
      ...(chapterId ? { chapterId } : {}),
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCohortById(cohortId: string) {
  await requireInstructor();
  if (!(await hasInstructorCohortTables())) {
    return null;
  }

  return prisma.instructorCohort.findUnique({
    where: { id: cohortId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}
