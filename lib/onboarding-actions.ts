"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import {
  getSingleStudentPathwayJourney,
} from "@/lib/chapter-pathway-journey";
import { enrollInClass } from "@/lib/class-management-actions";
import { awardXp, XP_REWARDS } from "@/lib/xp";

export async function getOnboardingProgress() {
  const session = await getSession();
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
  const session = await getSession();
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
  const session = await getSession();
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
  const session = await getSession();
  if (!session?.user?.id) return { error: "Not authenticated" };
  let joinablePathwayCount = 0;
  const unavailableMessages: string[] = [];

  for (const pathwayId of pathwayIds) {
    const pathway = await getSingleStudentPathwayJourney(session.user.id, pathwayId);
    if (!pathway) continue;
    if (!pathway.isVisibleInChapter && !pathway.isEnrolled) {
      unavailableMessages.push(`${pathway.name} is currently hidden for your chapter.`);
      continue;
    }
    if (!pathway.localNextOffering) {
      if (pathway.fallbackOfferings.length > 0) {
        unavailableMessages.push(`${pathway.name} does not have a local run right now. Request a partner-chapter fallback from My Chapter.`);
      } else {
        unavailableMessages.push(`${pathway.name} does not have a local class run available yet.`);
      }
      continue;
    }

    joinablePathwayCount += 1;

    const existing = await prisma.classEnrollment.findUnique({
      where: {
        studentId_offeringId: {
          studentId: session.user.id,
          offeringId: pathway.localNextOffering.id,
        },
      },
      select: { id: true, status: true },
    });

    if (!existing || existing.status === "DROPPED") {
      await enrollInClass(pathway.localNextOffering.id);
      try {
        await awardXp(session.user.id, XP_REWARDS.ENROLL_COURSE, "Joined chapter pathway class", {
          pathwayId,
          offeringId: pathway.localNextOffering.id,
        });
      } catch {
        // XP columns may not exist yet
      }
    }
  }

  if (pathwayIds.length > 0 && joinablePathwayCount === 0) {
    return { error: unavailableMessages[0] ?? "This pathway does not have a joinable local class step yet." };
  }

  return { success: true };
}

export async function enrollInNextPathwayStep(pathwayId: string) {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const pathway = await getSingleStudentPathwayJourney(session.user.id, pathwayId);
  if (!pathway) {
    return { error: "Pathway not found." };
  }

  if (pathway.currentStep) {
    return { success: true, alreadyOnTrack: true };
  }

  if (!pathway.nextJoinableStep) {
    return { success: true, allStepsEnrolled: true };
  }

  if (!pathway.localNextOffering) {
    if (pathway.fallbackOfferings.length > 0) {
      return {
        error: "Your chapter is not running the next step right now. Open My Chapter to request a partner-chapter fallback.",
        locked: true,
      };
    }

    return {
      error: "Your chapter does not have a local class run for the next step yet.",
      locked: true,
    };
  }

  await enrollInClass(pathway.localNextOffering.id);
  try {
    await awardXp(session.user.id, XP_REWARDS.ENROLL_COURSE, "Enrolled in chapter pathway step", {
      pathwayId,
      offeringId: pathway.localNextOffering.id,
    });
  } catch {
    // XP columns may not exist yet
  }

  return { success: true, enrolledOfferingId: pathway.localNextOffering.id };
}

export async function checkAndAwardPathwayCertificate(userId: string, pathwayId: string) {
  const summary = await getSingleStudentPathwayJourney(userId, pathwayId);
  if (!summary || summary.totalCount === 0 || !summary.isComplete) return;

  // Check if certificate already issued
  const existing = await prisma.certificate.findFirst({ where: { recipientId: userId, pathwayId } });
  if (existing) return;

  const pathway = await prisma.pathway.findUnique({ where: { id: pathwayId }, select: { name: true } });
  if (!pathway) return;

  // Find or create a PATHWAY_COMPLETION template
  let template = await prisma.certificateTemplate.findFirst({
    where: { type: "PATHWAY_COMPLETION", isActive: true },
  });
  if (!template) {
    template = await prisma.certificateTemplate.create({
      data: {
        name: "Pathway Completion Certificate",
        description: "Awarded upon completing all steps in a pathway",
        type: "PATHWAY_COMPLETION",
        isActive: true,
      },
    });
  }

  await prisma.certificate.create({
    data: {
      templateId: template.id,
      recipientId: userId,
      pathwayId,
      title: `${pathway.name} — Completion Certificate`,
      description: `Awarded for completing all courses in the ${pathway.name}.`,
    },
  });

  try {
    await awardXp(userId, 500, `Completed ${pathway.name}`, { pathwayId });
  } catch { /* XP may not exist */ }
}

export async function leavePathway(pathwayId: string) {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const steps = await prisma.pathwayStep.findMany({
    where: { pathwayId },
    select: { id: true, classTemplateId: true },
  });
  const stepIds = steps.map((step) => step.id);
  const templateIds = steps
    .map((step) => step.classTemplateId)
    .filter((templateId): templateId is string => Boolean(templateId));

  await prisma.classEnrollment.deleteMany({
    where: {
      studentId: session.user.id,
      offering: {
        OR: [
          stepIds.length > 0 ? { pathwayStepId: { in: stepIds } } : undefined,
          templateIds.length > 0
            ? {
                pathwayStepId: null,
                templateId: { in: templateIds },
              }
            : undefined,
        ].filter(Boolean) as Array<Record<string, unknown>>,
      },
      status: { not: "COMPLETED" },
    },
  });

  return { success: true };
}

export async function completeOnboarding() {
  const session = await getSession();
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
