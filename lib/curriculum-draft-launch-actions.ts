"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  createCompatibleClassTemplate,
  getClassTemplateCapabilities,
} from "@/lib/class-template-compat";
import {
  buildSessionLabel,
  buildWeeklyTopicsFromSessionPlans,
  normalizeCourseConfig,
  syncSessionPlansToCourseConfig,
} from "@/lib/curriculum-draft-progress";

function combineTextParts(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}

function combineActivityResources(activity: {
  resources?: string | null;
  materials?: string | null;
}) {
  return combineTextParts([
    activity.resources,
    activity.materials ? `Materials:\n${activity.materials}` : null,
  ]);
}

function combineActivityNotes(activity: {
  notes?: string | null;
  differentiationTips?: string | null;
  rubric?: string | null;
}) {
  return combineTextParts([
    activity.notes,
    activity.differentiationTips
      ? `Differentiation:\n${activity.differentiationTips}`
      : null,
    activity.rubric ? `Rubric:\n${activity.rubric}` : null,
  ]);
}

export async function createOrUpdateStudioLaunchPackage(input: {
  draftId: string;
  reviewerId?: string | null;
}) {
  const capabilities = await getClassTemplateCapabilities();
  const draft = await prisma.curriculumDraft.findUnique({
    where: { id: input.draftId },
    select: {
      id: true,
      authorId: true,
      generatedTemplateId: true,
      title: true,
      description: true,
      interestArea: true,
      outcomes: true,
      weeklyPlans: true,
      courseConfig: true,
      submittedAt: true,
      reviewNotes: true,
      author: {
        select: {
          chapterId: true,
        },
      },
    },
  });

  if (!draft) {
    throw new Error("Curriculum draft not found");
  }

  const courseConfig = normalizeCourseConfig(draft.courseConfig);
  const sessionPlans = syncSessionPlansToCourseConfig(
    draft.weeklyPlans,
    courseConfig
  );
  const weeklyTopics = buildWeeklyTopicsFromSessionPlans(
    draft.weeklyPlans,
    courseConfig
  );

  const computedEstimatedHours = Math.max(
    1,
    Math.round(
      (courseConfig.durationWeeks *
        courseConfig.sessionsPerWeek *
        courseConfig.classDurationMin) /
        60
    )
  );

  const templateData = {
    title: draft.title.trim(),
    description: (draft.description ?? "").trim(),
    interestArea: draft.interestArea.trim(),
    difficultyLevel: courseConfig.difficultyLevel,
    prerequisites: [] as string[],
    weeklyTopics: weeklyTopics as Prisma.InputJsonValue,
    learningOutcomes: draft.outcomes,
    estimatedHours: courseConfig.estimatedHours || computedEstimatedHours,
    durationWeeks: courseConfig.durationWeeks,
    sessionsPerWeek: courseConfig.sessionsPerWeek,
    minStudents: courseConfig.minStudents,
    maxStudents: courseConfig.maxStudents,
    idealSize: courseConfig.idealSize,
    sizeNotes: "Generated from the Lesson Design Studio first curriculum flow.",
    deliveryModes: courseConfig.deliveryModes,
    createdById: draft.authorId,
    chapterId: draft.author.chapterId ?? null,
    isPublished: false,
  };

  const templateUpdateData: Prisma.ClassTemplateUncheckedUpdateInput = {
    ...templateData,
    ...(capabilities.hasAdvancedCurriculumFields
      ? {
          targetAgeGroup: courseConfig.targetAgeGroup || null,
          classDurationMin: courseConfig.classDurationMin,
        }
      : {}),
    ...(capabilities.hasReviewWorkflow
      ? {
          submissionStatus: "APPROVED" as const,
          submittedAt: draft.submittedAt ?? new Date(),
          reviewedById: input.reviewerId || null,
          reviewNotes: draft.reviewNotes || null,
        }
      : {}),
  };

  const templateId = await prisma.$transaction(async (tx) => {
    let resolvedTemplateId = draft.generatedTemplateId;

    if (resolvedTemplateId) {
      await tx.classTemplate.update({
        where: { id: resolvedTemplateId },
        data: templateUpdateData,
        select: { id: true },
      });
      await tx.lessonPlan.deleteMany({
        where: {
          classTemplateId: resolvedTemplateId,
          authorId: draft.authorId,
        },
      });
    } else {
      const template = await createCompatibleClassTemplate(tx, capabilities, {
        ...templateData,
        targetAgeGroup: courseConfig.targetAgeGroup || null,
        classDurationMin: courseConfig.classDurationMin,
        submissionStatus: "APPROVED",
        submittedAt: draft.submittedAt ?? new Date(),
        reviewedById: input.reviewerId || null,
        reviewNotes: draft.reviewNotes || null,
      });
      resolvedTemplateId = template.id;
    }

    for (const sessionPlan of sessionPlans) {
      const label = buildSessionLabel(sessionPlan, courseConfig);
      const totalMinutes = sessionPlan.activities.reduce(
        (sum, activity) => sum + (activity.durationMin ?? 0),
        0
      );

      await tx.lessonPlan.create({
        data: {
          title: sessionPlan.title.trim()
            ? `${label}: ${sessionPlan.title.trim()}`
            : label,
          description: combineTextParts([
            sessionPlan.objective ? `Objective: ${sessionPlan.objective}` : null,
            sessionPlan.teacherPrepNotes
              ? `Teacher prep: ${sessionPlan.teacherPrepNotes}`
              : null,
            sessionPlan.atHomeAssignment
              ? `At-home assignment: ${sessionPlan.atHomeAssignment.title}\n${sessionPlan.atHomeAssignment.description}`
              : null,
          ]),
          classTemplateId: resolvedTemplateId,
          totalMinutes,
          authorId: draft.authorId,
          isTemplate: true,
          activities: {
            create: sessionPlan.activities.map((activity, index) => ({
              title: activity.title?.trim() || `Activity ${index + 1}`,
              description: activity.description || null,
              type: (activity.type as
                | "WARM_UP"
                | "INSTRUCTION"
                | "PRACTICE"
                | "DISCUSSION"
                | "ASSESSMENT"
                | "BREAK"
                | "REFLECTION"
                | "GROUP_WORK") || "PRACTICE",
              durationMin: activity.durationMin ?? 10,
              sortOrder: index,
              resources: combineActivityResources(activity) || null,
              notes: combineActivityNotes(activity) || null,
            })),
          },
        },
        select: { id: true },
      });
    }

    await tx.curriculumDraft.update({
      where: { id: draft.id },
      data: {
        generatedTemplateId: resolvedTemplateId,
        approvedAt: new Date(),
        reviewedAt: new Date(),
        status: "APPROVED",
      },
    });

    return resolvedTemplateId;
  });

  revalidatePath("/instructor/lesson-design-studio");
  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/instructor/workspace");
  revalidatePath("/lesson-plans");
  revalidatePath(`/lesson-plans?templateId=${templateId}`);
  revalidatePath(`/instructor/class-settings?template=${templateId}`);

  return { templateId };
}
