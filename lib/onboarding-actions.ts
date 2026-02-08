"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { awardXp, XP_REWARDS } from "@/lib/xp";

export async function getOnboardingProgress() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  try {
    return await prisma.onboardingProgress.findUnique({
      where: { userId: session.user.id },
    });
  } catch {
    return null;
  }
}

export async function saveOnboardingStep(step: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  try {
    await prisma.onboardingProgress.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, currentStep: step },
      update: { currentStep: step },
    });
  } catch {
    // Table may not exist yet — continue silently
  }

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

  try {
    await prisma.onboardingProgress.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        currentStep: 2,
        profileCompleted: true,
      },
      update: { profileCompleted: true },
    });
  } catch {
    // Table may not exist yet
  }

  return { success: true };
}

export async function selectPathways(pathwayIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  for (const pathwayId of pathwayIds) {
    const firstStep = await prisma.pathwayStep.findFirst({
      where: { pathwayId },
      orderBy: { stepOrder: "asc" },
    });
    if (!firstStep) continue;

    const existing = await prisma.enrollment.findFirst({
      where: { userId: session.user.id, courseId: firstStep.courseId },
    });
    if (!existing) {
      await prisma.enrollment.create({
        data: {
          userId: session.user.id,
          courseId: firstStep.courseId,
          status: "ENROLLED",
        },
      });

      try {
        await awardXp(session.user.id, XP_REWARDS.ENROLL_COURSE, "Enrolled in pathway course", { pathwayId, courseId: firstStep.courseId });
      } catch {
        // XP columns may not exist yet
      }
    }
  }

  return { success: true };
}

export async function completeOnboarding() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  try {
    await prisma.onboardingProgress.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        currentStep: 99,
        completedAt: new Date(),
      },
      update: { completedAt: new Date() },
    });
  } catch {
    // Table may not exist yet
  }

  try {
    await awardXp(session.user.id, XP_REWARDS.COMPLETE_ONBOARDING, "Completed onboarding");
  } catch {
    // XP columns may not exist yet
  }

  return { success: true };
}
