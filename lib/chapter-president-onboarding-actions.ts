"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";

async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  return session.user.id;
}

const STEP_FIELDS = [
  "metTeam",
  "setChapterGoals",
  "reviewedResources",
  "introMessageSent",
] as const;

export async function getOnboardingStatus() {
  const userId = await requireUserId();
  return prisma.chapterPresidentOnboarding.findUnique({
    where: { userId },
    include: { chapter: true },
  });
}

/**
 * Recomputes the onboarding `status` from the four step flags. Marks
 * COMPLETED (stamping `completedAt` once) when every step is done.
 */
async function recomputeStatus(userId: string): Promise<void> {
  const onboarding = await prisma.chapterPresidentOnboarding.findUnique({
    where: { userId },
  });
  if (!onboarding) return;
  const allDone = STEP_FIELDS.every((field) => onboarding[field] === true);
  await prisma.chapterPresidentOnboarding.update({
    where: { userId },
    data: allDone
      ? { status: "COMPLETED", completedAt: onboarding.completedAt ?? new Date() }
      : { status: "IN_PROGRESS" },
  });
}

/** Marks a checkbox-style step (Meet Your Team / Review Resources) complete. */
export async function completeOnboardingStep(formData: FormData) {
  const userId = await requireUserId();
  const step = String(formData.get("step") ?? "");
  if (step !== "metTeam" && step !== "reviewedResources") {
    throw new Error("Invalid step");
  }
  await prisma.chapterPresidentOnboarding.update({
    where: { userId },
    data: { [step]: true },
  });
  await recomputeStatus(userId);
  revalidatePath("/chapter/onboarding");
}

/** Saves the president's chapter goals and marks that step complete. */
export async function saveChapterGoals(formData: FormData) {
  const userId = await requireUserId();
  const goals = String(formData.get("chapterGoals") ?? "").trim();
  if (!goals) {
    throw new Error("Write a few sentences about your chapter goals first.");
  }
  await prisma.chapterPresidentOnboarding.update({
    where: { userId },
    data: { chapterGoals: goals, setChapterGoals: true },
  });
  await recomputeStatus(userId);
  revalidatePath("/chapter/onboarding");
}

/** Saves the president's intro message and marks that step complete. */
export async function saveIntroMessage(formData: FormData) {
  const userId = await requireUserId();
  const message = String(formData.get("introMessage") ?? "").trim();
  if (!message) {
    throw new Error("Write your intro message before marking this step done.");
  }
  await prisma.chapterPresidentOnboarding.update({
    where: { userId },
    data: { introMessage: message, introMessageSent: true },
  });
  await recomputeStatus(userId);
  revalidatePath("/chapter/onboarding");
}

/** Admin / self override that force-completes every onboarding step. */
export async function markOnboardingComplete() {
  const userId = await requireUserId();
  await prisma.chapterPresidentOnboarding.update({
    where: { userId },
    data: {
      metTeam: true,
      setChapterGoals: true,
      reviewedResources: true,
      introMessageSent: true,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
  revalidatePath("/chapter/onboarding");
}
