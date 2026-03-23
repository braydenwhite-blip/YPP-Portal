"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { OnboardingStepType } from "@prisma/client";

// ============================================
// CHAPTER MEMBER ONBOARDING
// ============================================

/**
 * Default onboarding steps created for new chapters.
 */
const DEFAULT_STEPS: Array<{
  title: string;
  description: string;
  type: OnboardingStepType;
  sortOrder: number;
  isRequired: boolean;
}> = [
  {
    title: "Complete Your Profile",
    description: "Add a bio and your interests so other members can get to know you.",
    type: "COMPLETE_PROFILE",
    sortOrder: 1,
    isRequired: true,
  },
  {
    title: "Meet the Team",
    description: "See who leads your chapter and who your fellow members are.",
    type: "MEET_THE_TEAM",
    sortOrder: 2,
    isRequired: true,
  },
  {
    title: "Join Channels",
    description: "Join the chapter discussion channels to start connecting.",
    type: "JOIN_CHANNELS",
    sortOrder: 3,
    isRequired: true,
  },
  {
    title: "Introduce Yourself",
    description: "Post a quick introduction in the #general channel so everyone knows you've arrived.",
    type: "INTRODUCE_SELF",
    sortOrder: 4,
    isRequired: false,
  },
  {
    title: "Explore a Pathway",
    description: "Browse the available pathways and consider enrolling in your first one.",
    type: "FIRST_PATHWAY",
    sortOrder: 5,
    isRequired: false,
  },
];

/**
 * Get onboarding steps and progress for the current user.
 * Creates default steps if the chapter has none.
 */
export async function getOnboardingData() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, chapterId: true, name: true },
  });

  if (!user?.chapterId) throw new Error("Not in a chapter");

  // Get chapter info
  const chapter = await prisma.chapter.findUnique({
    where: { id: user.chapterId },
    select: { id: true, name: true, logoUrl: true, bannerUrl: true, tagline: true },
  });

  // Get steps (or create defaults)
  let steps = await prisma.chapterOnboardingStep.findMany({
    where: { chapterId: user.chapterId },
    orderBy: { sortOrder: "asc" },
  });

  if (steps.length === 0) {
    // Create default steps for this chapter
    await prisma.chapterOnboardingStep.createMany({
      data: DEFAULT_STEPS.map((s) => ({ ...s, chapterId: user.chapterId! })),
    });
    steps = await prisma.chapterOnboardingStep.findMany({
      where: { chapterId: user.chapterId },
      orderBy: { sortOrder: "asc" },
    });
  }

  // Get user's progress
  const progress = await prisma.memberOnboardingProgress.findMany({
    where: { userId: user.id, chapterId: user.chapterId },
  });

  const progressMap = new Map(progress.map((p) => [p.stepId, p]));

  const stepsWithProgress = steps.map((step) => {
    const prog = progressMap.get(step.id);
    return {
      ...step,
      isCompleted: !!prog?.completedAt,
      completedAt: prog?.completedAt ?? null,
    };
  });

  const completedCount = stepsWithProgress.filter((s) => s.isCompleted).length;
  const totalSteps = stepsWithProgress.length;
  const isComplete = completedCount === totalSteps;
  const currentStepIndex = stepsWithProgress.findIndex((s) => !s.isCompleted);

  return {
    chapter,
    user: { id: user.id, name: user.name },
    steps: stepsWithProgress,
    completedCount,
    totalSteps,
    isComplete,
    currentStepIndex: currentStepIndex === -1 ? totalSteps - 1 : currentStepIndex,
  };
}

/**
 * Mark an onboarding step as complete.
 */
export async function completeOnboardingStep(stepId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, chapterId: true },
  });

  if (!user?.chapterId) throw new Error("Not in a chapter");

  // Verify step belongs to user's chapter
  const step = await prisma.chapterOnboardingStep.findUnique({
    where: { id: stepId },
    select: { chapterId: true },
  });

  if (!step || step.chapterId !== user.chapterId) {
    throw new Error("Step not found");
  }

  await prisma.memberOnboardingProgress.upsert({
    where: { userId_stepId: { userId: user.id, stepId } },
    create: {
      userId: user.id,
      chapterId: user.chapterId,
      stepId,
      completedAt: new Date(),
    },
    update: { completedAt: new Date() },
  });

  revalidatePath("/chapter/welcome");
  return { success: true };
}

/**
 * Check if a user has completed onboarding for their chapter.
 */
export async function hasCompletedOnboarding(userId: string, chapterId: string): Promise<boolean> {
  const steps = await prisma.chapterOnboardingStep.findMany({
    where: { chapterId, isRequired: true },
    select: { id: true },
  });

  if (steps.length === 0) return true; // No required steps = done

  const completedCount = await prisma.memberOnboardingProgress.count({
    where: {
      userId,
      chapterId,
      stepId: { in: steps.map((s) => s.id) },
      completedAt: { not: null },
    },
  });

  return completedCount >= steps.length;
}

/**
 * Get onboarding step config for chapter leads to customize.
 */
export async function getOnboardingConfig() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD" || r.role === "ADMIN");
  if (!isLead || !user?.chapterId) throw new Error("Unauthorized");

  // Get or create default steps
  let steps = await prisma.chapterOnboardingStep.findMany({
    where: { chapterId: user.chapterId },
    orderBy: { sortOrder: "asc" },
  });

  if (steps.length === 0) {
    await prisma.chapterOnboardingStep.createMany({
      data: DEFAULT_STEPS.map((s) => ({ ...s, chapterId: user.chapterId! })),
    });
    steps = await prisma.chapterOnboardingStep.findMany({
      where: { chapterId: user.chapterId },
      orderBy: { sortOrder: "asc" },
    });
  }

  return steps;
}

/**
 * Add a custom onboarding step (chapter lead only).
 */
export async function addOnboardingStep(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD" || r.role === "ADMIN");
  if (!isLead || !user?.chapterId) throw new Error("Unauthorized");

  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;
  const isRequired = formData.get("isRequired") === "true";

  if (!title) throw new Error("Title is required");

  // Get max sort order
  const lastStep = await prisma.chapterOnboardingStep.findFirst({
    where: { chapterId: user.chapterId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.chapterOnboardingStep.create({
    data: {
      chapterId: user.chapterId,
      title,
      description: description || null,
      type: "CUSTOM",
      sortOrder: (lastStep?.sortOrder ?? 0) + 1,
      isRequired,
    },
  });

  revalidatePath("/chapter/settings/onboarding");
  return { success: true };
}

/**
 * Remove an onboarding step (chapter lead only).
 */
export async function removeOnboardingStep(stepId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD" || r.role === "ADMIN");
  if (!isLead || !user?.chapterId) throw new Error("Unauthorized");

  const step = await prisma.chapterOnboardingStep.findUnique({
    where: { id: stepId },
    select: { chapterId: true },
  });

  if (!step || step.chapterId !== user.chapterId) throw new Error("Step not found");

  // Delete progress records first, then the step
  await prisma.memberOnboardingProgress.deleteMany({ where: { stepId } });
  await prisma.chapterOnboardingStep.delete({ where: { id: stepId } });

  revalidatePath("/chapter/settings/onboarding");
  return { success: true };
}

/**
 * Toggle step required/optional (chapter lead only).
 */
export async function toggleStepRequired(stepId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isLead = user?.roles.some((r) => r.role === "CHAPTER_LEAD" || r.role === "ADMIN");
  if (!isLead || !user?.chapterId) throw new Error("Unauthorized");

  const step = await prisma.chapterOnboardingStep.findUnique({ where: { id: stepId } });
  if (!step || step.chapterId !== user.chapterId) throw new Error("Step not found");

  await prisma.chapterOnboardingStep.update({
    where: { id: stepId },
    data: { isRequired: !step.isRequired },
  });

  revalidatePath("/chapter/settings/onboarding");
  return { success: true };
}
