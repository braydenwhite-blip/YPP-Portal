"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";

export async function getOnboardingStatus() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const onboarding = await prisma.chapterPresidentOnboarding.findUnique({
    where: { userId: session.user.id },
    include: {
      chapter: true,
    },
  });

  return onboarding;
}

export async function completeOnboardingStep(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const step = formData.get("step") as string;

  const validSteps = [
    "metTeam",
    "setChapterGoals",
    "reviewedResources",
    "introMessageSent",
  ];

  if (!validSteps.includes(step)) {
    throw new Error("Invalid step");
  }

  const onboarding = await prisma.chapterPresidentOnboarding.update({
    where: { userId: session.user.id },
    data: {
      [step]: true,
    },
  });

  const allComplete =
    (step === "metTeam" || onboarding.metTeam) &&
    (step === "setChapterGoals" || onboarding.setChapterGoals) &&
    (step === "reviewedResources" || onboarding.reviewedResources) &&
    (step === "introMessageSent" || onboarding.introMessageSent);

  // Re-fetch to check all steps after update
  const updated = await prisma.chapterPresidentOnboarding.findUnique({
    where: { userId: session.user.id },
  });

  if (
    updated &&
    updated.metTeam &&
    updated.setChapterGoals &&
    updated.reviewedResources &&
    updated.introMessageSent
  ) {
    await prisma.chapterPresidentOnboarding.update({
      where: { userId: session.user.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
  } else {
    await prisma.chapterPresidentOnboarding.update({
      where: { userId: session.user.id },
      data: {
        status: "IN_PROGRESS",
      },
    });
  }

  revalidatePath("/chapter/onboarding");
}

export async function markOnboardingComplete() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  await prisma.chapterPresidentOnboarding.update({
    where: { userId: session.user.id },
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
