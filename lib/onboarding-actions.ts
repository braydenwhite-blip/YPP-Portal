"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getOnboardingProgress() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const progress = await prisma.onboardingProgress.findUnique({
    where: { userId: session.user.id },
  });

  return progress;
}

export async function saveOnboardingStep(step: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  await prisma.onboardingProgress.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      currentStep: step,
    },
    update: {
      currentStep: step,
    },
  });

  return { success: true };
}

export async function saveOnboardingProfile(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  const bio = formData.get("bio") as string | null;
  const school = formData.get("school") as string | null;
  const gradeStr = formData.get("grade") as string | null;
  const interestsStr = formData.get("interests") as string | null;
  const parentEmail = formData.get("parentEmail") as string | null;
  const parentPhone = formData.get("parentPhone") as string | null;
  const curriculumUrl = formData.get("curriculumUrl") as string | null;

  const grade = gradeStr ? parseInt(gradeStr, 10) : null;
  const interests = interestsStr
    ? interestsStr.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      bio: bio || null,
      school: school || null,
      grade: grade,
      interests,
      parentEmail: parentEmail || null,
      parentPhone: parentPhone || null,
      curriculumUrl: curriculumUrl || null,
    },
    update: {
      bio: bio || undefined,
      school: school || undefined,
      grade: grade ?? undefined,
      interests: interests.length > 0 ? interests : undefined,
      parentEmail: parentEmail || undefined,
      parentPhone: parentPhone || undefined,
      curriculumUrl: curriculumUrl || undefined,
    },
  });

  await prisma.onboardingProgress.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      currentStep: 2,
      profileCompleted: true,
    },
    update: {
      profileCompleted: true,
    },
  });

  return { success: true };
}

export async function completeOnboarding() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  await prisma.onboardingProgress.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      currentStep: 99,
      completedAt: new Date(),
    },
    update: {
      completedAt: new Date(),
    },
  });

  return { success: true };
}
