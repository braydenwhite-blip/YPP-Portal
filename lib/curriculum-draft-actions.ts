"use server";

/**
 * Curriculum Draft Actions — server actions for the Curriculum Builder Studio.
 * Handles creating, auto-saving, and submitting curriculum drafts.
 * Allows APPLICANT role so instructor applicants can build curricula during training.
 */

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireStudioAccess() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  const allowed =
    roles.includes("INSTRUCTOR") ||
    roles.includes("ADMIN") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("APPLICANT");
  if (!allowed) throw new Error("Studio access requires Instructor or Applicant role");
  return session;
}

/**
 * Get the user's existing curriculum draft, or create a new one if none exists.
 */
export async function getOrCreateCurriculumDraft() {
  const session = await requireStudioAccess();

  let draft = await prisma.curriculumDraft.findFirst({
    where: { authorId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  if (!draft) {
    draft = await prisma.curriculumDraft.create({
      data: {
        authorId: session.user.id,
        title: "",
        description: null,
        interestArea: "",
        outcomes: [],
        weeklyPlans: JSON.parse("[]"),
        status: "IN_PROGRESS",
      },
    });
  }

  return draft;
}

/**
 * Auto-save the curriculum draft. Called on a debounce from the client.
 */
export async function saveCurriculumDraft(data: {
  draftId: string;
  title: string;
  description: string;
  interestArea: string;
  outcomes: string[];
  weeklyPlans: unknown[];
}) {
  const session = await requireStudioAccess();

  const existing = await prisma.curriculumDraft.findUnique({
    where: { id: data.draftId },
    select: { authorId: true },
  });

  if (!existing || existing.authorId !== session.user.id) {
    throw new Error("Draft not found or unauthorized");
  }

  await prisma.curriculumDraft.update({
    where: { id: data.draftId },
    data: {
      title: data.title,
      description: data.description || null,
      interestArea: data.interestArea,
      outcomes: data.outcomes,
      weeklyPlans: data.weeklyPlans as any,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/instructor/lesson-design-studio");
  return { success: true };
}

/**
 * Mark the curriculum draft as completed/submitted.
 */
export async function submitCurriculumDraft(draftId: string) {
  const session = await requireStudioAccess();

  const existing = await prisma.curriculumDraft.findUnique({
    where: { id: draftId },
    select: { authorId: true, title: true },
  });

  if (!existing || existing.authorId !== session.user.id) {
    throw new Error("Draft not found or unauthorized");
  }

  if (!existing.title?.trim()) {
    throw new Error("Curriculum must have a title before submitting");
  }

  await prisma.curriculumDraft.update({
    where: { id: draftId },
    data: {
      status: "SUBMITTED",
      completedAt: new Date(),
    },
  });

  revalidatePath("/instructor/lesson-design-studio");
  return { success: true };
}

/**
 * Load a curriculum draft by ID (for the print page).
 */
export async function getCurriculumDraftById(draftId: string) {
  const session = await requireStudioAccess();

  const draft = await prisma.curriculumDraft.findUnique({
    where: { id: draftId },
    include: {
      author: { select: { name: true } },
    },
  });

  if (!draft) return null;

  const roles = session.user.roles ?? [];
  if (draft.authorId !== session.user.id && !roles.includes("ADMIN")) {
    return null;
  }

  return draft;
}
