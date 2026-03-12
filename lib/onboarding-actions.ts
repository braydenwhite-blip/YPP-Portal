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

    if (!firstStep.courseId) continue;

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

export async function enrollInNextPathwayStep(pathwayId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  const steps = await prisma.pathwayStep.findMany({
    where: { pathwayId },
    orderBy: { stepOrder: "asc" },
    include: { course: true },
  });

  const stepCourseIds = steps.map((s) => s.courseId).filter((id): id is string => id !== null);
  const userEnrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id, courseId: { in: stepCourseIds } },
  });
  const enrollmentByCourseId = new Map(userEnrollments.map((e) => [e.courseId, e]));

  for (const step of steps) {
    if (!step.courseId) continue; // Skip non-course steps (Passion Lab / Standalone)
    const enrollment = enrollmentByCourseId.get(step.courseId);
    if (!enrollment) {
      // This step is not enrolled — check if previous step is complete (or it's step 1)
      if (step.stepOrder === 1) {
        // First step: enroll freely
        await prisma.enrollment.create({
          data: { userId: session.user.id, courseId: step.courseId, status: "ENROLLED" },
        });
        try {
          await awardXp(session.user.id, XP_REWARDS.ENROLL_COURSE, "Enrolled in pathway step", { pathwayId, courseId: step.courseId });
        } catch { /* XP may not exist */ }
        return { success: true, enrolledCourseId: step.courseId };
      }
      // Find previous step
      const prevStep = steps.find((s) => s.stepOrder === step.stepOrder - 1);
      if (!prevStep) return { error: "Previous step not found" };
      const prevEnrollment = prevStep.courseId ? enrollmentByCourseId.get(prevStep.courseId) : null;
      if (!prevEnrollment || prevEnrollment.status !== "COMPLETED") {
        return { error: `Complete "${prevStep.course?.title ?? "previous step"}" first to unlock this step.`, locked: true };
      }
      // Prev step completed: enroll in this step
      await prisma.enrollment.create({
        data: { userId: session.user.id, courseId: step.courseId, status: "ENROLLED" },
      });
      try {
        await awardXp(session.user.id, XP_REWARDS.ENROLL_COURSE, "Enrolled in pathway step", { pathwayId, courseId: step.courseId });
      } catch { /* XP may not exist */ }
      return { success: true, enrolledCourseId: step.courseId };
    }
  }

  return { success: true, allStepsEnrolled: true };
}

export async function checkAndAwardPathwayCertificate(userId: string, pathwayId: string) {
  const steps = await prisma.pathwayStep.findMany({ where: { pathwayId }, select: { courseId: true } });
  if (steps.length === 0) return;

  const courseStepIds = steps.map((s) => s.courseId).filter((id): id is string => id !== null);
  const completedEnrollments = await prisma.enrollment.count({
    where: { userId, courseId: { in: courseStepIds }, status: "COMPLETED" },
  });

  if (completedEnrollments < steps.length) return; // Not all steps complete

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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  // Get all courses in this pathway
  const steps = await prisma.pathwayStep.findMany({
    where: { pathwayId },
    select: { courseId: true },
  });
  const courseIds = steps.map((s) => s.courseId).filter((id): id is string => id !== null);

  // Remove all non-completed enrollments in pathway courses
  await prisma.enrollment.deleteMany({
    where: {
      userId: session.user.id,
      courseId: { in: courseIds },
      status: { not: "COMPLETED" },
    },
  });

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
