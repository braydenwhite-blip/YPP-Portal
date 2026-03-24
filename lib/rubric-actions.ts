"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireInstructor() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (
    !session?.user?.id ||
    (!roles.includes("ADMIN") &&
      !roles.includes("INSTRUCTOR") &&
      !roles.includes("CHAPTER_PRESIDENT"))
  ) {
    throw new Error("Unauthorized – instructor role required");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getInt(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key);
  if (!raw || String(raw).trim() === "") return fallback;
  const n = parseInt(String(raw), 10);
  return isNaN(n) ? fallback : n;
}

// ─── Rubric CRUD ─────────────────────────────────────────────────────────────

export async function createRubric(formData: FormData) {
  const session = await requireInstructor();

  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const chapterId = getString(formData, "chapterId", false) || null;

  const rubric = await prisma.rubric.create({
    data: {
      title,
      description: description || null,
      chapterId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/instructor/workspace");
  return { success: true, rubricId: rubric.id };
}

export async function updateRubric(id: string, formData: FormData) {
  const session = await requireInstructor();

  const rubric = await prisma.rubric.findUnique({ where: { id } });
  if (!rubric) throw new Error("Rubric not found");
  if (
    rubric.createdById !== session.user.id &&
    !(session.user.roles ?? []).includes("ADMIN")
  ) {
    throw new Error("Not authorized to edit this rubric");
  }

  const title = getString(formData, "title");
  const description = getString(formData, "description", false);

  await prisma.rubric.update({
    where: { id },
    data: {
      title,
      description: description || null,
    },
  });

  revalidatePath("/instructor/workspace");
  return { success: true };
}

export async function deleteRubric(id: string) {
  const session = await requireInstructor();

  const rubric = await prisma.rubric.findUnique({ where: { id } });
  if (!rubric) throw new Error("Rubric not found");
  if (
    rubric.createdById !== session.user.id &&
    !(session.user.roles ?? []).includes("ADMIN")
  ) {
    throw new Error("Not authorized to delete this rubric");
  }

  await prisma.rubric.delete({ where: { id } });
  revalidatePath("/instructor/workspace");
  return { success: true };
}

// ─── Rubric Criteria ─────────────────────────────────────────────────────────

export async function addCriterion(rubricId: string, formData: FormData) {
  await requireInstructor();

  const name = getString(formData, "name");
  const description = getString(formData, "description", false);
  const pointValue = getInt(formData, "pointValue", 10);

  // Get current max sortOrder
  const last = await prisma.rubricCriterion.findFirst({
    where: { rubricId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  const criterion = await prisma.rubricCriterion.create({
    data: {
      rubricId,
      name,
      description: description || null,
      pointValue,
      sortOrder,
    },
  });

  return { success: true, criterionId: criterion.id };
}

export async function updateCriterion(id: string, formData: FormData) {
  await requireInstructor();

  const name = getString(formData, "name");
  const description = getString(formData, "description", false);
  const pointValue = getInt(formData, "pointValue", 10);

  await prisma.rubricCriterion.update({
    where: { id },
    data: {
      name,
      description: description || null,
      pointValue,
    },
  });

  return { success: true };
}

export async function deleteCriterion(id: string) {
  await requireInstructor();
  await prisma.rubricCriterion.delete({ where: { id } });
  return { success: true };
}

export async function reorderCriteria(rubricId: string, orderedIds: string[]) {
  await requireInstructor();

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.rubricCriterion.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  return { success: true };
}

// ─── Attach / Detach ─────────────────────────────────────────────────────────

export async function attachRubricToAssignment(
  assignmentId: string,
  rubricId: string
) {
  await requireInstructor();

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { rubricId },
  });

  revalidatePath("/instructor/workspace");
  return { success: true };
}

export async function detachRubricFromAssignment(assignmentId: string) {
  await requireInstructor();

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { rubricId: null },
  });

  revalidatePath("/instructor/workspace");
  return { success: true };
}

export async function attachRubricToClassAssignment(
  classAssignmentId: string,
  rubricId: string
) {
  await requireInstructor();

  await prisma.classAssignment.update({
    where: { id: classAssignmentId },
    data: { rubricId },
  });

  revalidatePath("/instructor/workspace");
  return { success: true };
}

export async function detachRubricFromClassAssignment(classAssignmentId: string) {
  await requireInstructor();

  await prisma.classAssignment.update({
    where: { id: classAssignmentId },
    data: { rubricId: null },
  });

  revalidatePath("/instructor/workspace");
  return { success: true };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getRubricsForChapter(chapterId: string) {
  return prisma.rubric.findMany({
    where: {
      OR: [{ chapterId }, { chapterId: null }],
    },
    include: {
      criteria: { orderBy: { sortOrder: "asc" } },
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRubricById(id: string) {
  return prisma.rubric.findUnique({
    where: { id },
    include: {
      criteria: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function getMyRubrics() {
  const session = await requireInstructor();

  return prisma.rubric.findMany({
    where: { createdById: session.user.id },
    include: {
      criteria: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}
