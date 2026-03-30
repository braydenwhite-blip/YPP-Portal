"use server";

/**
 * Curriculum Draft Actions — server actions for the Curriculum Builder Studio.
 * Handles creating, auto-saving, and submitting curriculum drafts.
 * Allows APPLICANT role so instructor applicants can build curricula during training.
 */

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { CurriculumDraftStatus, TrainingModuleType } from "@prisma/client";
import {
  getCurriculumDraftProgress,
  normalizeCourseConfig,
  syncSessionPlansToCourseConfig,
  normalizeUnderstandingChecks,
} from "@/lib/curriculum-draft-progress";
import {
  buildBlankCurriculumDraftRecord,
  buildWorkingCopyCurriculumDraftRecord,
  deriveEditableCurriculumDraftStatus,
  isEditableCurriculumDraftStatus,
  isReadOnlyCurriculumDraftStatus,
  pickPrimaryEditableCurriculumDraft,
  sortCurriculumDraftsForChooser,
  type CurriculumDraftSummaryRecord,
} from "@/lib/curriculum-draft-lifecycle";
import { syncTrainingAssignmentFromArtifacts } from "@/lib/training-actions";
import { canAccessCurriculumDraftForPrint } from "@/lib/curriculum-draft-access";

const LESSON_DESIGN_STUDIO_MODULE_KEY = "academy_lesson_studio_006";
const LESSON_DESIGN_STUDIO_TOUR_KEY = "studio_onboarding_tour";

async function requireStudioAccess() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  const allowed =
    roles.includes("INSTRUCTOR") ||
    roles.includes("ADMIN") ||
    roles.includes("CHAPTER_PRESIDENT") ||
    roles.includes("APPLICANT");
  if (!allowed) throw new Error("Studio access requires Instructor or Applicant role");
  return session;
}

function revalidateStudioAndTrainingSurfaces(moduleIds: string[] = []) {
  revalidatePath("/instructor/lesson-design-studio");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath("/instructor/workspace");
  for (const moduleId of moduleIds) {
    revalidatePath(`/training/${moduleId}`);
  }
}

function normalizeSaveSnapshot(input: {
  title: string;
  description: string;
  interestArea: string;
  outcomes: string[];
  courseConfig: unknown;
  weeklyPlans: unknown;
  understandingChecks: unknown;
}) {
  const normalizedCourseConfig = normalizeCourseConfig(input.courseConfig);
  const normalizedUnderstandingChecks = normalizeUnderstandingChecks(
    input.understandingChecks
  );
  const syncedWeeklyPlans = syncSessionPlansToCourseConfig(
    input.weeklyPlans,
    normalizedCourseConfig
  );

  return {
    title: input.title,
    description: input.description || null,
    interestArea: input.interestArea,
    outcomes: Array.isArray(input.outcomes)
      ? input.outcomes.filter((outcome): outcome is string => typeof outcome === "string")
      : [],
    courseConfig: normalizedCourseConfig,
    weeklyPlans: syncedWeeklyPlans,
    understandingChecks: normalizedUnderstandingChecks,
  };
}

function buildSaveSnapshotSignature(input: {
  title: string;
  description: string | null;
  interestArea: string;
  outcomes: string[];
  courseConfig: unknown;
  weeklyPlans: unknown;
  understandingChecks: unknown;
  status: string;
  completedAt: Date | null;
}) {
  return JSON.stringify({
    title: input.title,
    description: input.description,
    interestArea: input.interestArea,
    outcomes: input.outcomes,
    courseConfig: input.courseConfig,
    weeklyPlans: input.weeklyPlans,
    understandingChecks: input.understandingChecks,
    status: input.status,
    completedAt: input.completedAt ? "set" : null,
  });
}

function buildDraftSummary(draft: {
  id: string;
  title: string;
  status: string;
  updatedAt: Date;
  submittedAt: Date | null;
  approvedAt: Date | null;
  generatedTemplateId: string | null;
}) {
  return {
    id: draft.id,
    title: draft.title,
    status: draft.status,
    updatedAt: draft.updatedAt.toISOString(),
    submittedAt: draft.submittedAt?.toISOString() ?? null,
    approvedAt: draft.approvedAt?.toISOString() ?? null,
    generatedTemplateId: draft.generatedTemplateId,
    isEditable: isEditableCurriculumDraftStatus(draft.status),
    isPrimaryEditable: false,
  } satisfies CurriculumDraftSummaryRecord;
}

async function findEditableDraftsForUser(userId: string) {
  return prisma.curriculumDraft.findMany({
    where: {
      authorId: userId,
      status: {
        in: ["IN_PROGRESS", "COMPLETED", "NEEDS_REVISION"],
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function getEditableDraftForUser(userId: string) {
  const editableDrafts = await findEditableDraftsForUser(userId);
  return pickPrimaryEditableCurriculumDraft(editableDrafts);
}

async function getOwnedCurriculumDraftForStudio(userId: string, draftId: string) {
  const draft = await prisma.curriculumDraft.findUnique({
    where: { id: draftId },
  });

  if (!draft || draft.authorId !== userId) {
    return null;
  }

  return draft;
}

async function getLessonDesignStudioModules() {
  return prisma.trainingModule.findMany({
    where: {
      OR: [
        { contentKey: LESSON_DESIGN_STUDIO_MODULE_KEY },
        { type: TrainingModuleType.CURRICULUM_REVIEW },
      ],
    },
    select: {
      id: true,
      checkpoints: {
        select: {
          id: true,
          contentKey: true,
        },
      },
    },
  });
}

async function upsertCheckpointCompletion(checkpointId: string, userId: string, notes?: string) {
  await prisma.trainingCheckpointCompletion.upsert({
    where: {
      checkpointId_userId: { checkpointId, userId },
    },
    create: {
      checkpointId,
      userId,
      notes: notes || null,
    },
    update: {
      notes: notes || undefined,
      completedAt: new Date(),
    },
  });
}

async function deleteCheckpointCompletion(checkpointId: string, userId: string) {
  await prisma.trainingCheckpointCompletion.deleteMany({
    where: {
      checkpointId,
      userId,
    },
  });
}

async function ensureLessonDesignStudioEvidenceSubmission(
  userId: string,
  moduleId: string,
  draft: {
    id: string;
    title: string;
    status: string;
  }
) {
  if (draft.status !== "SUBMITTED") return;

  const fileUrl = `/instructor/lesson-design-studio/print?draftId=${draft.id}&type=instructor`;
  const existing = await prisma.trainingEvidenceSubmission.findFirst({
    where: {
      userId,
      moduleId,
      fileUrl,
    },
    select: { id: true },
  });

  if (existing) return;

  await prisma.trainingEvidenceSubmission.create({
    data: {
      moduleId,
      userId,
      fileUrl,
      notes: draft.title
        ? `Submitted automatically from Lesson Design Studio: ${draft.title}`
        : "Submitted automatically from Lesson Design Studio",
      status: "PENDING_REVIEW",
    },
  });
}

async function syncLessonDesignStudioTrainingArtifacts(
  userId: string,
  draft: {
    id: string;
    title: string;
    interestArea: string;
    outcomes: string[];
    courseConfig?: unknown;
    weeklyPlans: unknown;
    understandingChecks?: unknown;
    status: string;
  },
  options?: {
    tourCompleted?: boolean;
  }
) {
  const modules = await getLessonDesignStudioModules();
  if (modules.length === 0) return;

  const progress = getCurriculumDraftProgress({
    title: draft.title,
    interestArea: draft.interestArea,
    outcomes: draft.outcomes,
    courseConfig: draft.courseConfig,
    weeklyPlans: draft.weeklyPlans,
    understandingChecks: draft.understandingChecks,
  });

  for (const trainingModule of modules) {
    const checkpointByKey = new Map(
      trainingModule.checkpoints
        .filter((checkpoint) => checkpoint.contentKey)
        .map((checkpoint) => [checkpoint.contentKey as string, checkpoint.id])
    );

    const syncCheckpoint = async (contentKey: string, completed: boolean) => {
      const checkpointId = checkpointByKey.get(contentKey);
      if (!checkpointId) return;

      if (completed) {
        await upsertCheckpointCompletion(checkpointId, userId);
      } else {
        await deleteCheckpointCompletion(checkpointId, userId);
      }
    };

    if (options?.tourCompleted) {
      const checkpointId = checkpointByKey.get(LESSON_DESIGN_STUDIO_TOUR_KEY);
      if (checkpointId) {
        await upsertCheckpointCompletion(checkpointId, userId, "Completed from the Lesson Design Studio onboarding tour.");
      }
    }

    await syncCheckpoint("studio_first_week", progress.hasFirstWeekWithThreeActivities);
    await syncCheckpoint("studio_week_objective", progress.hasAnyObjective);
    await syncCheckpoint("studio_at_home_assignment", progress.hasAnyAtHomeAssignment);
    await ensureLessonDesignStudioEvidenceSubmission(
      userId,
      trainingModule.id,
      draft
    );
    await syncTrainingAssignmentFromArtifacts(userId, trainingModule.id);
  }

  revalidateStudioAndTrainingSurfaces(
    modules.map((trainingModule) => trainingModule.id)
  );
}

/**
 * Get the user's active editable curriculum draft, or create a blank one if none exists.
 */
export async function getOrCreateCurriculumDraft() {
  const session = await requireStudioAccess();
  let draft = await getEditableDraftForUser(session.user.id);

  if (!draft) {
    draft = await prisma.curriculumDraft.create({
      data: {
        authorId: session.user.id,
        ...(buildBlankCurriculumDraftRecord() as any),
      },
    });
  }

  await syncLessonDesignStudioTrainingArtifacts(session.user.id, draft);
  return draft;
}

export async function listCurriculumDraftSummaries() {
  const session = await requireStudioAccess();
  const drafts = await prisma.curriculumDraft.findMany({
    where: { authorId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      submittedAt: true,
      approvedAt: true,
      generatedTemplateId: true,
    },
  });

  const primaryEditableDraft = pickPrimaryEditableCurriculumDraft(drafts);

  return sortCurriculumDraftsForChooser(drafts).map((draft) => ({
    ...buildDraftSummary(draft),
    isPrimaryEditable: primaryEditableDraft?.id === draft.id,
  }));
}

export async function getPreferredCurriculumDraftForStudioSurface() {
  const session = await requireStudioAccess();
  const drafts = await prisma.curriculumDraft.findMany({
    where: { authorId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  const primaryEditableDraft = pickPrimaryEditableCurriculumDraft(drafts);
  return primaryEditableDraft ?? drafts[0] ?? null;
}

export async function getCurriculumDraftForStudio(draftId: string) {
  const session = await requireStudioAccess();
  return getOwnedCurriculumDraftForStudio(session.user.id, draftId);
}

export async function createBlankCurriculumDraft() {
  const session = await requireStudioAccess();

  const result = await prisma.$transaction(async (tx) => {
    const editableDrafts = await tx.curriculumDraft.findMany({
      where: {
        authorId: session.user.id,
        status: {
          in: ["IN_PROGRESS", "COMPLETED", "NEEDS_REVISION"],
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const existingEditableDraft = pickPrimaryEditableCurriculumDraft(editableDrafts);
    if (existingEditableDraft) {
      return {
        draft: existingEditableDraft,
        reusedExisting: true,
      };
    }

    const createdDraft = await tx.curriculumDraft.create({
      data: {
        authorId: session.user.id,
        ...(buildBlankCurriculumDraftRecord() as any),
      },
    });

    return {
      draft: createdDraft,
      reusedExisting: false,
    };
  });

  await syncLessonDesignStudioTrainingArtifacts(session.user.id, result.draft);
  revalidateStudioAndTrainingSurfaces();

  return {
    draftId: result.draft.id,
    reusedExisting: result.reusedExisting,
  };
}

export async function createWorkingCopyFromCurriculumDraft(sourceDraftId: string) {
  const session = await requireStudioAccess();

  const result = await prisma.$transaction(async (tx) => {
    const editableDrafts = await tx.curriculumDraft.findMany({
      where: {
        authorId: session.user.id,
        status: {
          in: ["IN_PROGRESS", "COMPLETED", "NEEDS_REVISION"],
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const existingEditableDraft = pickPrimaryEditableCurriculumDraft(editableDrafts);
    if (existingEditableDraft) {
      return {
        draft: existingEditableDraft,
        reusedExisting: true,
      };
    }

    const sourceDraft = await tx.curriculumDraft.findUnique({
      where: { id: sourceDraftId },
      select: {
        id: true,
        authorId: true,
        title: true,
        description: true,
        interestArea: true,
        outcomes: true,
        courseConfig: true,
        weeklyPlans: true,
        understandingChecks: true,
        status: true,
      },
    });

    if (!sourceDraft || sourceDraft.authorId !== session.user.id) {
      throw new Error("Draft not found or unauthorized");
    }

    if (isEditableCurriculumDraftStatus(sourceDraft.status)) {
      return {
        draft: sourceDraft,
        reusedExisting: true,
      };
    }

    const createdDraft = await tx.curriculumDraft.create({
      data: {
        authorId: session.user.id,
        ...(buildWorkingCopyCurriculumDraftRecord(sourceDraft) as any),
      },
    });

    return {
      draft: createdDraft,
      reusedExisting: false,
    };
  });

  await syncLessonDesignStudioTrainingArtifacts(session.user.id, result.draft);
  revalidateStudioAndTrainingSurfaces();

  return {
    draftId: result.draft.id,
    reusedExisting: result.reusedExisting,
  };
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
  courseConfig: unknown;
  weeklyPlans: unknown[];
  understandingChecks: unknown;
  lastKnownUpdatedAt?: string | null;
}) {
  const session = await requireStudioAccess();

  const existing = await prisma.curriculumDraft.findUnique({
    where: { id: data.draftId },
    select: {
      id: true,
      authorId: true,
      title: true,
      description: true,
      interestArea: true,
      outcomes: true,
      courseConfig: true,
      weeklyPlans: true,
      understandingChecks: true,
      status: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  if (!existing || existing.authorId !== session.user.id) {
    throw new Error("Draft not found or unauthorized");
  }

  if (isReadOnlyCurriculumDraftStatus(existing.status)) {
    throw new Error(
      "This draft is locked for review history. Create a working copy to keep editing."
    );
  }

  const nextSnapshot = normalizeSaveSnapshot(data);

  const nextStatus: CurriculumDraftStatus =
    existing.status === "NEEDS_REVISION"
      ? existing.status
      : (deriveEditableCurriculumDraftStatus({
          title: nextSnapshot.title,
          interestArea: nextSnapshot.interestArea,
          outcomes: nextSnapshot.outcomes,
          courseConfig: nextSnapshot.courseConfig,
          weeklyPlans: nextSnapshot.weeklyPlans,
          understandingChecks: nextSnapshot.understandingChecks,
        }) as CurriculumDraftStatus);

  const currentSnapshot = normalizeSaveSnapshot({
    title: existing.title,
    description: existing.description ?? "",
    interestArea: existing.interestArea,
    outcomes: existing.outcomes,
    courseConfig: existing.courseConfig,
    weeklyPlans: existing.weeklyPlans,
    understandingChecks: existing.understandingChecks,
  });

  const nextCompletedAt =
    nextStatus === "COMPLETED" ? existing.completedAt ?? new Date() : null;

  const currentSignature = buildSaveSnapshotSignature({
    ...currentSnapshot,
    status: existing.status,
    completedAt: existing.completedAt,
  });
  const nextSignature = buildSaveSnapshotSignature({
    ...nextSnapshot,
    status: nextStatus,
    completedAt: nextCompletedAt,
  });

  if (currentSignature === nextSignature) {
    return {
      success: true,
      deduped: true,
      updatedAt: existing.updatedAt.toISOString(),
      status: existing.status,
    };
  }

  const updateData = {
    title: nextSnapshot.title,
    description: nextSnapshot.description,
    interestArea: nextSnapshot.interestArea,
    outcomes: nextSnapshot.outcomes,
    courseConfig: nextSnapshot.courseConfig as any,
    weeklyPlans: nextSnapshot.weeklyPlans as any,
    understandingChecks: nextSnapshot.understandingChecks as any,
    status: nextStatus,
    completedAt: nextCompletedAt,
    updatedAt: new Date(),
  };

  let draft =
    data.lastKnownUpdatedAt && Number.isFinite(Date.parse(data.lastKnownUpdatedAt))
      ? null
      : await prisma.curriculumDraft.update({
          where: { id: data.draftId },
          data: updateData,
        });

  if (!draft && data.lastKnownUpdatedAt) {
    const guardedUpdatedAt = new Date(data.lastKnownUpdatedAt);
    const updateResult = await prisma.curriculumDraft.updateMany({
      where: {
        id: data.draftId,
        updatedAt: guardedUpdatedAt,
      },
      data: updateData,
    });

    if (updateResult.count === 0) {
      const latest = await prisma.curriculumDraft.findUnique({
        where: { id: data.draftId },
        select: {
          id: true,
          authorId: true,
          title: true,
          description: true,
          interestArea: true,
          outcomes: true,
          courseConfig: true,
          weeklyPlans: true,
          understandingChecks: true,
          status: true,
          completedAt: true,
          updatedAt: true,
        },
      });

      if (!latest || latest.authorId !== session.user.id) {
        throw new Error("Draft not found or unauthorized");
      }

      const latestSignature = buildSaveSnapshotSignature({
        ...normalizeSaveSnapshot({
          title: latest.title,
          description: latest.description ?? "",
          interestArea: latest.interestArea,
          outcomes: latest.outcomes,
          courseConfig: latest.courseConfig,
          weeklyPlans: latest.weeklyPlans,
          understandingChecks: latest.understandingChecks,
        }),
        status: latest.status,
        completedAt: latest.completedAt,
      });

      if (latestSignature === nextSignature) {
        return {
          success: true,
          deduped: true,
          updatedAt: latest.updatedAt.toISOString(),
          status: latest.status,
        };
      }

      throw new Error(
        "This draft changed in another tab. Refresh the studio to keep editing the newest version."
      );
    }

    draft = await prisma.curriculumDraft.findUnique({
      where: { id: data.draftId },
    });
  }

  if (!draft) {
    throw new Error("Draft save failed unexpectedly.");
  }

  await syncLessonDesignStudioTrainingArtifacts(session.user.id, draft);
  return {
    success: true,
    deduped: false,
    updatedAt: draft.updatedAt.toISOString(),
    status: draft.status,
  };
}

/**
 * Mark the curriculum draft as completed/submitted.
 */
export async function submitCurriculumDraft(draftId: string) {
  const session = await requireStudioAccess();

  const existing = await prisma.curriculumDraft.findUnique({
    where: { id: draftId },
    select: {
      authorId: true,
      title: true,
      interestArea: true,
      outcomes: true,
      courseConfig: true,
      weeklyPlans: true,
      understandingChecks: true,
      status: true,
    },
  });

  if (!existing || existing.authorId !== session.user.id) {
    throw new Error("Draft not found or unauthorized");
  }

  if (existing.status === "APPROVED") {
    throw new Error("This curriculum has already been approved and moved into launch.");
  }

  if (existing.status === "SUBMITTED") {
    throw new Error("This curriculum is already waiting for review.");
  }

  if (existing.status === "REJECTED") {
    throw new Error("Create a working copy from this draft before submitting again.");
  }

  const progress = getCurriculumDraftProgress({
    title: existing.title,
    interestArea: existing.interestArea,
    outcomes: existing.outcomes,
    courseConfig: existing.courseConfig,
    weeklyPlans: existing.weeklyPlans,
    understandingChecks: existing.understandingChecks,
  });

  if (!progress.readyForSubmission) {
    throw new Error(`Before submitting, finish these items: ${progress.submissionIssues.join(" ")}`);
  }

  const draft = await prisma.curriculumDraft.update({
    where: { id: draftId },
    data: {
      status: "SUBMITTED",
      completedAt: new Date(),
      submittedAt: new Date(),
    },
  });

  await syncLessonDesignStudioTrainingArtifacts(session.user.id, draft);
  return { success: true };
}

export async function markLessonDesignStudioTourComplete(draftId: string) {
  const session = await requireStudioAccess();
  const draft = await getOwnedCurriculumDraftForStudio(session.user.id, draftId);
  if (!draft) {
    throw new Error("Draft not found or unauthorized");
  }

  await syncLessonDesignStudioTrainingArtifacts(session.user.id, draft, {
    tourCompleted: true,
  });
  return { success: true };
}

/**
 * Load a curriculum draft by ID (for the print page).
 */
export async function getCurriculumDraftById(draftId: string) {
  const session = await requireStudioAccess();
  const roles = session.user.roles ?? [];
  const requesterChapterId = roles.includes("CHAPTER_PRESIDENT")
    ? (
        await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { chapterId: true },
        })
      )?.chapterId ?? null
    : null;

  const draft = await prisma.curriculumDraft.findUnique({
    where: { id: draftId },
    include: {
      author: { select: { name: true, chapterId: true } },
    },
  });

  if (!draft) return null;

  if (
    !canAccessCurriculumDraftForPrint({
      requesterId: session.user.id,
      requesterRoles: roles,
      requesterChapterId,
      authorId: draft.authorId,
      authorChapterId: draft.author.chapterId,
    })
  ) {
    return null;
  }

  return draft;
}
