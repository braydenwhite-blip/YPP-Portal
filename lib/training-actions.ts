"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import {
  TrainingEvidenceStatus,
  TrainingModuleType,
  TrainingStatus,
  VideoProvider,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { checkAndIssueTrainingCompletion } from "@/lib/auto-certificate-actions";
import { onProgressEvent } from "@/lib/progress-events";
import {
  emptyReviewRubric,
  normalizeReviewRubric,
} from "@/lib/curriculum-draft-progress";
import { createOrUpdateStudioLaunchPackage } from "@/lib/curriculum-draft-launch-actions";
import { syncInstructorGrowthSignalsForInstructor } from "@/lib/instructor-growth-service";
import { canAccessTrainingLearnerActions } from "@/lib/training-access";
import {
  getDraftIdFromEvidenceUrl,
  TRACKABLE_REQUIRED_VIDEO_PROVIDERS,
} from "@/lib/training-constants";
import {
  computeQuizAttemptResult,
  parseQuizAnswers,
  QuizSubmissionError,
} from "@/lib/training-quiz-scoring";

async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }
  return session;
}

async function requireAdminOrChapterLead() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Unauthorized - Admin or Chapter President access required");
  }
  return session;
}

async function syncTrainingGrowth(userId: string) {
  await syncInstructorGrowthSignalsForInstructor(userId).catch((err) => {
    // Growth sync is non-critical; log but never block the action.
    console.warn("[training] syncTrainingGrowth failed", { userId, error: err });
    return null;
  });
}

/**
 * Asserts the learner has an active TrainingAssignment for the given module.
 * Auto-creates the assignment for instructors/students whose access is implied
 * by role (e.g. an approved INSTRUCTOR opening a freshly-imported module that
 * hasn't been bulk-assigned yet) — but never short-circuits the auth check.
 *
 * This is the single ownership-boundary helper for learner-side training
 * actions. Without it, any authenticated learner could submit progress for
 * any moduleId.
 */
async function assertModuleAccessibleForLearner(userId: string, moduleId: string) {
  const [module, assignment] = await Promise.all([
    prisma.trainingModule.findUnique({
      where: { id: moduleId },
      select: { id: true },
    }),
    prisma.trainingAssignment.findUnique({
      where: { userId_moduleId: { userId, moduleId } },
      select: { id: true },
    }),
  ]);

  if (!module) {
    throw new Error("Training module not found");
  }

  if (!assignment) {
    // Self-enroll: upsert ensures no race with a concurrent action creating
    // the same assignment row. NOT_STARTED is the safe initial state — the
    // sync-from-artifacts flow will promote it as evidence accumulates.
    await prisma.trainingAssignment.upsert({
      where: { userId_moduleId: { userId, moduleId } },
      create: { userId, moduleId, status: "NOT_STARTED" },
      update: {},
    });
  }
}

async function requireTrainingLearner() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const canAccessTraining = canAccessTrainingLearnerActions(roles);

  if (!canAccessTraining) {
    throw new Error("Unauthorized - Training is available after instructor approval.");
  }

  return session;
}

async function assertReviewerCanManageInstructor(
  reviewerId: string,
  instructorId: string
) {
  const [reviewer, instructor] = await Promise.all([
    prisma.user.findUnique({
      where: { id: reviewerId },
      select: {
        chapterId: true,
        roles: { select: { role: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: instructorId },
      select: {
        chapterId: true,
      },
    }),
  ]);

  if (!reviewer || !instructor) {
    throw new Error("Reviewer or instructor not found");
  }

  const reviewerRoles = reviewer.roles.map((role) => role.role);
  const isAdmin = reviewerRoles.includes("ADMIN");
  const isChapterLead = reviewerRoles.includes("CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized");
  }

  if (isChapterLead && !isAdmin && reviewer.chapterId !== instructor.chapterId) {
    throw new Error("Chapter Presidents can only review instructors in their own chapter.");
  }
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getNumber(formData: FormData, key: string, fallback = 0) {
  const raw = formData.get(key);
  if (!raw || String(raw).trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildStudioReviewRubric(formData: FormData) {
  const fallback = emptyReviewRubric();
  return normalizeReviewRubric({
    scores: {
      clarity: getNumber(formData, "rubricClarity", fallback.scores.clarity),
      sequencing: getNumber(formData, "rubricSequencing", fallback.scores.sequencing),
      studentExperience: getNumber(
        formData,
        "rubricStudentExperience",
        fallback.scores.studentExperience
      ),
      launchReadiness: getNumber(
        formData,
        "rubricLaunchReadiness",
        fallback.scores.launchReadiness
      ),
    },
    sectionNotes: {
      overview: getString(formData, "rubricOverviewNote", false),
      courseStructure: getString(formData, "rubricCourseStructureNote", false),
      sessionPlans: getString(formData, "rubricSessionPlansNote", false),
      studentAssignments: getString(
        formData,
        "rubricStudentAssignmentsNote",
        false
      ),
    },
    summary: getString(formData, "rubricSummary", false),
  });
}

type ModuleValidationInput = {
  required: boolean;
  type?: TrainingModuleType | null;
  videoUrl: string | null;
  videoProvider: VideoProvider | null;
  requiresQuiz: boolean;
  requiresEvidence: boolean;
  requiredCheckpointCount: number;
  quizQuestionCount: number;
  hasInteractiveJourney?: boolean;
};

function getModuleConfigurationIssues(input: ModuleValidationInput): string[] {
  const issues: string[] = [];
  // Interactive-journey modules are inherently actionable: the journey itself
  // is the requirement. The legacy "must have video / quiz / evidence /
  // checkpoint" rule predates the interactive curriculum and would incorrectly
  // flag every modern module as misconfigured.
  const isInteractiveJourney =
    input.type === "INTERACTIVE_JOURNEY" || input.hasInteractiveJourney === true;
  const hasActionablePath =
    isInteractiveJourney ||
    Boolean(input.videoUrl) ||
    input.requiredCheckpointCount > 0 ||
    input.requiresQuiz ||
    input.requiresEvidence;

  if (input.required && !hasActionablePath) {
    issues.push(
      "Required modules must include at least one actionable requirement: interactive journey, video, required checkpoint, quiz, or evidence."
    );
  }

  if (input.requiresQuiz && input.quizQuestionCount === 0) {
    issues.push(
      "Cannot enable quiz requirement with zero quiz questions. Add at least one quiz question first."
    );
  }

  if (input.videoUrl && !input.videoProvider) {
    issues.push(
      "Video provider is required when a video URL is configured."
    );
  }

  if (
    input.required &&
    input.videoUrl &&
    input.videoProvider &&
    !TRACKABLE_REQUIRED_VIDEO_PROVIDERS.has(input.videoProvider)
  ) {
    issues.push(
      `Required modules can only use trackable video providers: ${Array.from(
        TRACKABLE_REQUIRED_VIDEO_PROVIDERS
      ).join(", ")}.`
    );
  }

  return issues;
}

function assertValidModuleConfiguration(input: ModuleValidationInput) {
  const issues = getModuleConfigurationIssues(input);
  if (issues.length > 0) {
    throw new Error(issues[0]);
  }
}

async function getModuleValidationInput(moduleId: string): Promise<ModuleValidationInput> {
  const [module, requiredCheckpointCount, quizQuestionCount] = await Promise.all([
    prisma.trainingModule.findUnique({
      where: { id: moduleId },
      select: {
        required: true,
        videoUrl: true,
        videoProvider: true,
        requiresQuiz: true,
        requiresEvidence: true,
      },
    }),
    prisma.trainingCheckpoint.count({
      where: {
        moduleId,
        required: true,
      },
    }),
    prisma.trainingQuizQuestion.count({
      where: { moduleId },
    }),
  ]);

  if (!module) {
    throw new Error("Training module not found");
  }

  return {
    required: module.required,
    videoUrl: module.videoUrl,
    videoProvider: module.videoProvider,
    requiresQuiz: module.requiresQuiz,
    requiresEvidence: module.requiresEvidence,
    requiredCheckpointCount,
    quizQuestionCount,
  };
}

async function syncAssignmentFromArtifacts(userId: string, moduleId: string) {
  const module = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      type: true,
      required: true,
      videoUrl: true,
      videoProvider: true,
      requiresQuiz: true,
      requiresEvidence: true,
      passScorePct: true,
      quizQuestions: {
        select: { id: true },
      },
      interactiveJourney: {
        select: { id: true },
      },
    },
  });

  if (!module) {
    throw new Error("Training module not found");
  }

  const quizQuestionCount = module.quizQuestions.length;
  const hasInteractiveJourney = module.interactiveJourney !== null;
  const moduleConfigurationIssues = getModuleConfigurationIssues({
    required: module.required,
    type: module.type,
    videoUrl: module.videoUrl,
    videoProvider: module.videoProvider,
    requiresQuiz: module.requiresQuiz,
    requiresEvidence: module.requiresEvidence,
    requiredCheckpointCount: 0,
    quizQuestionCount,
    hasInteractiveJourney,
  });
  const configurationIssue = moduleConfigurationIssues[0] ?? null;

  const [
    videoProgress,
    passedQuizAttempt,
    approvedEvidenceCount,
    quizAttemptCount,
    journeyState,
  ] = await Promise.all([
    prisma.videoProgress.findUnique({
      where: {
        userId_moduleId: { userId, moduleId },
      },
      select: {
        watchedSeconds: true,
        completed: true,
      },
    }),
    prisma.trainingQuizAttempt.findFirst({
      where: {
        userId,
        moduleId,
        passed: true,
      },
      orderBy: { attemptedAt: "desc" },
      select: { id: true },
    }),
    prisma.trainingEvidenceSubmission.count({
      where: {
        userId,
        moduleId,
        status: "APPROVED",
      },
    }),
    prisma.trainingQuizAttempt.count({ where: { userId, moduleId } }),
    hasInteractiveJourney && module.interactiveJourney
      ? Promise.all([
          prisma.interactiveJourneyCompletion.findUnique({
            where: {
              journeyId_userId: {
                journeyId: module.interactiveJourney.id,
                userId,
              },
            },
            select: { passed: true, completedAt: true },
          }),
          prisma.interactiveBeatAttempt.count({
            where: { userId, beat: { journeyId: module.interactiveJourney.id } },
          }),
        ]).then(([completion, attemptCount]) => ({ completion, attemptCount }))
      : Promise.resolve({ completion: null, attemptCount: 0 }),
  ]);

  const hasVideoProgress = (videoProgress?.watchedSeconds ?? 0) > 0;
  // Video completes when the player fires the "ended" event (forceComplete=true).
  // No 90% threshold — completion is driven entirely by watching to the end.
  const videoReady = !module.videoUrl || videoProgress?.completed === true;

  const checkpointsReady = true; // Goals are now purely informational — they no longer gate completion.
  const quizReady = !module.requiresQuiz || (quizQuestionCount > 0 && Boolean(passedQuizAttempt));
  const evidenceReady = !module.requiresEvidence || approvedEvidenceCount > 0;
  // Interactive-journey readiness: if the module has a journey, completion
  // requires the learner to have passed it. Modules without a journey ignore
  // this gate entirely.
  const journeyReady =
    !hasInteractiveJourney || journeyState.completion?.passed === true;

  const isComplete =
    !configurationIssue &&
    videoReady &&
    checkpointsReady &&
    quizReady &&
    evidenceReady &&
    journeyReady;
  const hasAnyProgress =
    hasVideoProgress || quizAttemptCount > 0 || journeyState.attemptCount > 0;

  const nextStatus: TrainingStatus = isComplete
    ? "COMPLETE"
    : hasAnyProgress || Boolean(configurationIssue)
      ? "IN_PROGRESS"
      : "NOT_STARTED";

  const assignment = await prisma.trainingAssignment.upsert({
    where: {
      userId_moduleId: { userId, moduleId },
    },
    create: {
      userId,
      moduleId,
      status: nextStatus,
      completedAt: isComplete ? new Date() : null,
    },
    update: {
      status: nextStatus,
      completedAt: isComplete ? new Date() : null,
    },
  });

  if (isComplete) {
    await checkAndIssueTrainingCompletion(userId);
    await syncTrainingGrowth(userId);
    onProgressEvent({ type: "TRAINING_MODULE_COMPLETED", userId, metadata: { moduleId } }).catch(() => {});
  }

  return {
    assignment,
    isComplete,
    videoReady,
    checkpointsReady,
    quizReady,
    evidenceReady,
    configurationIssue,
  };
}

export async function syncTrainingAssignmentFromArtifacts(userId: string, moduleId: string) {
  return syncAssignmentFromArtifacts(userId, moduleId);
}

async function syncAssignmentsForModule(moduleId: string) {
  // Bulk path: fetch the module + every learner's artifact summary once,
  // then update assignments in a single transaction. Replaces the prior
  // N×5-query fan-out, which became a hotspot for chapters with hundreds
  // of instructors when an admin edited a module.
  const [module, assignments] = await Promise.all([
    prisma.trainingModule.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        type: true,
        required: true,
        videoUrl: true,
        videoProvider: true,
        requiresQuiz: true,
        requiresEvidence: true,
        passScorePct: true,
        quizQuestions: { select: { id: true } },
        interactiveJourney: { select: { id: true } },
      },
    }),
    prisma.trainingAssignment.findMany({
      where: { moduleId },
      select: { id: true, userId: true, status: true },
    }),
  ]);

  if (!module || assignments.length === 0) return;

  const userIds = assignments.map((a) => a.userId);
  const quizQuestionCount = module.quizQuestions.length;
  const hasInteractiveJourney = module.interactiveJourney !== null;
  const journeyId = module.interactiveJourney?.id ?? null;

  const configurationIssue =
    getModuleConfigurationIssues({
      required: module.required,
      type: module.type,
      videoUrl: module.videoUrl,
      videoProvider: module.videoProvider,
      requiresQuiz: module.requiresQuiz,
      requiresEvidence: module.requiresEvidence,
      requiredCheckpointCount: 0,
      quizQuestionCount,
      hasInteractiveJourney,
    })[0] ?? null;

  const [
    videoProgress,
    passedQuizUserIds,
    approvedEvidenceUserIds,
    anyQuizAttempts,
    passedJourneyUserIds,
    journeyAttemptUserIds,
  ] = await Promise.all([
    prisma.videoProgress.findMany({
      where: { moduleId, userId: { in: userIds } },
      select: { userId: true, watchedSeconds: true, completed: true },
    }),
    prisma.trainingQuizAttempt
      .findMany({
        where: { moduleId, userId: { in: userIds }, passed: true },
        select: { userId: true },
        distinct: ["userId"],
      })
      .then((rows) => new Set(rows.map((r) => r.userId))),
    prisma.trainingEvidenceSubmission
      .findMany({
        where: { moduleId, userId: { in: userIds }, status: "APPROVED" },
        select: { userId: true },
        distinct: ["userId"],
      })
      .then((rows) => new Set(rows.map((r) => r.userId))),
    prisma.trainingQuizAttempt
      .findMany({
        where: { moduleId, userId: { in: userIds } },
        select: { userId: true },
        distinct: ["userId"],
      })
      .then((rows) => new Set(rows.map((r) => r.userId))),
    journeyId
      ? prisma.interactiveJourneyCompletion
          .findMany({
            where: { journeyId, userId: { in: userIds }, passed: true },
            select: { userId: true },
          })
          .then((rows) => new Set(rows.map((r) => r.userId)))
      : Promise.resolve(new Set<string>()),
    journeyId
      ? prisma.interactiveBeatAttempt
          .findMany({
            where: { userId: { in: userIds }, beat: { journeyId } },
            select: { userId: true },
            distinct: ["userId"],
          })
          .then((rows) => new Set(rows.map((r) => r.userId)))
      : Promise.resolve(new Set<string>()),
  ]);

  const videoByUser = new Map(videoProgress.map((vp) => [vp.userId, vp]));

  const usersNewlyCompleted: string[] = [];
  const updates = assignments.flatMap((assignment) => {
    const vp = videoByUser.get(assignment.userId);
    const hasVideoProgress = (vp?.watchedSeconds ?? 0) > 0;
    const videoReady = !module.videoUrl || vp?.completed === true;
    const quizReady =
      !module.requiresQuiz ||
      (quizQuestionCount > 0 && passedQuizUserIds.has(assignment.userId));
    const evidenceReady =
      !module.requiresEvidence || approvedEvidenceUserIds.has(assignment.userId);
    const journeyReady =
      !hasInteractiveJourney || passedJourneyUserIds.has(assignment.userId);

    const isComplete =
      !configurationIssue &&
      videoReady &&
      quizReady &&
      evidenceReady &&
      journeyReady;
    const hasAnyProgress =
      hasVideoProgress ||
      anyQuizAttempts.has(assignment.userId) ||
      journeyAttemptUserIds.has(assignment.userId);

    const nextStatus: TrainingStatus = isComplete
      ? "COMPLETE"
      : hasAnyProgress || Boolean(configurationIssue)
        ? "IN_PROGRESS"
        : "NOT_STARTED";

    if (isComplete && assignment.status !== "COMPLETE") {
      usersNewlyCompleted.push(assignment.userId);
    }

    if (nextStatus === assignment.status && !isComplete) {
      // No-op: nothing to update. The completedAt stamp is locked once set.
      return [];
    }

    return [
      prisma.trainingAssignment.update({
        where: { id: assignment.id },
        data: {
          status: nextStatus,
          completedAt: isComplete ? new Date() : null,
        },
      }),
    ];
  });

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  // Side-effects (cert issuance, growth sync) — only for users newly crossing
  // the COMPLETE threshold. These are intentionally outside the transaction
  // so a failed certificate render can never roll back assignment progress.
  for (const userId of usersNewlyCompleted) {
    await checkAndIssueTrainingCompletion(userId);
    await syncTrainingGrowth(userId);
    onProgressEvent({
      type: "TRAINING_MODULE_COMPLETED",
      userId,
      metadata: { moduleId },
    }).catch(() => {});
  }
}

// ============================================
// TRAINING MODULE MANAGEMENT (Admin)
// ============================================

export async function createTrainingModuleWithVideo(formData: FormData) {
  await requireAdmin();

  const contentKey = getString(formData, "contentKey", false);
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const materialUrl = getString(formData, "materialUrl", false);
  const materialNotes = getString(formData, "materialNotes", false);
  const type = getString(formData, "type") as TrainingModuleType;
  const required = formData.get("required") === "on";
  const sortOrder = Number(getString(formData, "sortOrder"));

  // Video fields
  const videoUrl = getString(formData, "videoUrl", false);
  const videoProvider = getString(formData, "videoProvider", false) as VideoProvider | undefined;
  const videoDuration = getString(formData, "videoDuration", false);
  const videoThumbnail = getString(formData, "videoThumbnail", false);

  // Academy settings
  const requiresQuiz = formData.get("requiresQuiz") === "on";
  const requiresEvidence = formData.get("requiresEvidence") === "on";
  const passScorePct = getNumber(formData, "passScorePct", 80);
  const estimatedMinutesRaw = getNumber(formData, "estimatedMinutes", 0);
  const estimatedMinutes = estimatedMinutesRaw > 0 ? estimatedMinutesRaw : null;
  const normalizedVideoUrl = videoUrl || null;

  if (passScorePct < 1 || passScorePct > 100) {
    throw new Error("Pass score must be between 1 and 100.");
  }

  assertValidModuleConfiguration({
    required,
    videoUrl: normalizedVideoUrl,
    videoProvider: videoProvider || null,
    requiresQuiz,
    requiresEvidence,
    requiredCheckpointCount: 0,
    quizQuestionCount: 0,
  });

  await prisma.trainingModule.create({
    data: {
      contentKey: contentKey || null,
      title,
      description,
      materialUrl: materialUrl || null,
      materialNotes: materialNotes || null,
      type,
      required,
      sortOrder,
      videoUrl: normalizedVideoUrl,
      videoProvider: videoProvider || null,
      videoDuration: videoDuration ? Number(videoDuration) : null,
      videoThumbnail: videoThumbnail || null,
      requiresQuiz,
      requiresEvidence,
      passScorePct,
      estimatedMinutes,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/admin/training");
}

export async function updateTrainingModule(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");
  const contentKey = getString(formData, "contentKey", false);
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const materialUrl = getString(formData, "materialUrl", false);
  const materialNotes = getString(formData, "materialNotes", false);
  const type = getString(formData, "type") as TrainingModuleType;
  const required = formData.get("required") === "on";
  const sortOrder = Number(getString(formData, "sortOrder"));

  // Video fields
  const videoUrl = getString(formData, "videoUrl", false);
  const videoProvider = getString(formData, "videoProvider", false) as VideoProvider | undefined;
  const videoDuration = getString(formData, "videoDuration", false);
  const videoThumbnail = getString(formData, "videoThumbnail", false);

  // Academy settings
  const requiresQuiz = formData.get("requiresQuiz") === "on";
  const requiresEvidence = formData.get("requiresEvidence") === "on";
  const passScorePct = getNumber(formData, "passScorePct", 80);
  const estimatedMinutesRaw = getNumber(formData, "estimatedMinutes", 0);
  const estimatedMinutes = estimatedMinutesRaw > 0 ? estimatedMinutesRaw : null;
  const normalizedVideoUrl = videoUrl || null;

  if (passScorePct < 1 || passScorePct > 100) {
    throw new Error("Pass score must be between 1 and 100.");
  }

  const [requiredCheckpointCount, quizQuestionCount] = await Promise.all([
    prisma.trainingCheckpoint.count({
      where: {
        moduleId,
        required: true,
      },
    }),
    prisma.trainingQuizQuestion.count({
      where: { moduleId },
    }),
  ]);

  assertValidModuleConfiguration({
    required,
    videoUrl: normalizedVideoUrl,
    videoProvider: videoProvider || null,
    requiresQuiz,
    requiresEvidence,
    requiredCheckpointCount,
    quizQuestionCount,
  });

  await prisma.trainingModule.update({
    where: { id: moduleId },
    data: {
      contentKey: contentKey || undefined,
      title,
      description,
      materialUrl: materialUrl || null,
      materialNotes: materialNotes || null,
      type,
      required,
      sortOrder,
      videoUrl: normalizedVideoUrl,
      videoProvider: videoProvider || null,
      videoDuration: videoDuration ? Number(videoDuration) : null,
      videoThumbnail: videoThumbnail || null,
      requiresQuiz,
      requiresEvidence,
      passScorePct,
      estimatedMinutes,
    },
  });

  await syncAssignmentsForModule(moduleId);

  revalidatePath("/admin");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath("/admin/training");
}

function parseQuizOptions(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Quiz options are required.");
  }

  let parsedOptions: string[] = [];

  if (trimmed.startsWith("[")) {
    try {
      const json = JSON.parse(trimmed) as unknown;
      if (Array.isArray(json)) {
        parsedOptions = json.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      parsedOptions = [];
    }
  }

  if (parsedOptions.length === 0) {
    parsedOptions = trimmed
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const deduped = Array.from(new Set(parsedOptions));
  if (deduped.length < 2) {
    if (parsedOptions.length >= 2 && deduped.length < parsedOptions.length) {
      throw new Error(
        "Quiz questions must have at least 2 distinct options. Remove duplicate options and try again."
      );
    }
    throw new Error(
      "Quiz questions must have at least 2 options. Provide options as a JSON array, comma-separated, or one per line."
    );
  }
  return deduped;
}

// ============================================
// TRAINING CONTENT CMS (Admin)
// ============================================

export async function createTrainingCheckpoint(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");
  const contentKey = getString(formData, "contentKey", false);
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const sortOrder = Math.max(1, getNumber(formData, "sortOrder", 1));
  const required = formData.get("required") === "on";

  const module = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    select: { id: true },
  });

  if (!module) {
    throw new Error("Training module not found");
  }

  await prisma.trainingCheckpoint.create({
    data: {
      moduleId,
      contentKey: contentKey || null,
      title,
      description: description || null,
      sortOrder,
      required,
    },
  });

  await syncAssignmentsForModule(moduleId);

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath("/admin/training");
}

export async function updateTrainingCheckpoint(formData: FormData) {
  await requireAdmin();

  const checkpointId = getString(formData, "checkpointId");
  const contentKey = getString(formData, "contentKey", false);
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const sortOrder = Math.max(1, getNumber(formData, "sortOrder", 1));
  const required = formData.get("required") === "on";

  const checkpoint = await prisma.trainingCheckpoint.findUnique({
    where: { id: checkpointId },
    select: {
      moduleId: true,
      required: true,
    },
  });

  if (!checkpoint) {
    throw new Error("Checkpoint not found");
  }

  const validation = await getModuleValidationInput(checkpoint.moduleId);
  const nextRequiredCheckpointCount =
    validation.requiredCheckpointCount + (required ? 1 : 0) - (checkpoint.required ? 1 : 0);

  assertValidModuleConfiguration({
    ...validation,
    requiredCheckpointCount: Math.max(0, nextRequiredCheckpointCount),
  });

  await prisma.trainingCheckpoint.update({
    where: { id: checkpointId },
    data: {
      contentKey: contentKey || undefined,
      title,
      description: description || null,
      sortOrder,
      required,
    },
  });

  await syncAssignmentsForModule(checkpoint.moduleId);

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath(`/training/${checkpoint.moduleId}`);
}

export async function deleteTrainingCheckpoint(formData: FormData) {
  await requireAdmin();

  const checkpointId = getString(formData, "checkpointId");
  const checkpoint = await prisma.trainingCheckpoint.findUnique({
    where: { id: checkpointId },
    select: {
      moduleId: true,
      required: true,
    },
  });

  if (!checkpoint) {
    throw new Error("Checkpoint not found");
  }

  const validation = await getModuleValidationInput(checkpoint.moduleId);
  const nextRequiredCheckpointCount =
    validation.requiredCheckpointCount - (checkpoint.required ? 1 : 0);

  assertValidModuleConfiguration({
    ...validation,
    requiredCheckpointCount: Math.max(0, nextRequiredCheckpointCount),
  });

  await prisma.trainingCheckpoint.delete({
    where: { id: checkpointId },
  });

  await syncAssignmentsForModule(checkpoint.moduleId);

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath(`/training/${checkpoint.moduleId}`);
}

export async function createTrainingQuizQuestion(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");
  const contentKey = getString(formData, "contentKey", false);
  const question = getString(formData, "question");
  const explanation = getString(formData, "explanation", false);
  const optionsRaw = getString(formData, "options");
  const sortOrder = Math.max(1, getNumber(formData, "sortOrder", 1));
  const options = parseQuizOptions(optionsRaw);
  const requestedCorrectAnswer = getString(formData, "correctAnswer", false);
  const correctAnswer = requestedCorrectAnswer || options[0];

  if (!options.includes(correctAnswer)) {
    throw new Error("Correct answer must match one of the options.");
  }

  const module = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    select: { id: true },
  });
  if (!module) {
    throw new Error("Training module not found");
  }

  await prisma.trainingQuizQuestion.create({
    data: {
      moduleId,
      contentKey: contentKey || null,
      question,
      options,
      correctAnswer,
      explanation: explanation || null,
      sortOrder,
    },
  });

  await syncAssignmentsForModule(moduleId);

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath("/admin/training");
  revalidatePath(`/training/${moduleId}`);
}

export async function updateTrainingQuizQuestion(formData: FormData) {
  await requireAdmin();

  const questionId = getString(formData, "questionId");
  const contentKey = getString(formData, "contentKey", false);
  const question = getString(formData, "question");
  const explanation = getString(formData, "explanation", false);
  const optionsRaw = getString(formData, "options");
  const sortOrder = Math.max(1, getNumber(formData, "sortOrder", 1));
  const options = parseQuizOptions(optionsRaw);
  const correctAnswer = getString(formData, "correctAnswer");

  if (!options.includes(correctAnswer)) {
    throw new Error("Correct answer must match one of the options.");
  }

  const existingQuestion = await prisma.trainingQuizQuestion.findUnique({
    where: { id: questionId },
    select: { moduleId: true },
  });

  if (!existingQuestion) {
    throw new Error("Quiz question not found");
  }

  await prisma.trainingQuizQuestion.update({
    where: { id: questionId },
    data: {
      contentKey: contentKey || undefined,
      question,
      options,
      correctAnswer,
      explanation: explanation || null,
      sortOrder,
    },
  });

  await syncAssignmentsForModule(existingQuestion.moduleId);

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath(`/training/${existingQuestion.moduleId}`);
}

export async function deleteTrainingQuizQuestion(formData: FormData) {
  await requireAdmin();

  const questionId = getString(formData, "questionId");
  const question = await prisma.trainingQuizQuestion.findUnique({
    where: { id: questionId },
    select: { moduleId: true },
  });

  if (!question) {
    throw new Error("Quiz question not found");
  }

  const validation = await getModuleValidationInput(question.moduleId);
  assertValidModuleConfiguration({
    ...validation,
    quizQuestionCount: Math.max(0, validation.quizQuestionCount - 1),
  });

  await prisma.trainingQuizQuestion.delete({
    where: { id: questionId },
  });

  await syncAssignmentsForModule(question.moduleId);

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath(`/training/${question.moduleId}`);
}

// ============================================
// VIDEO PROGRESS TRACKING
// ============================================

export async function updateVideoProgress(formData: FormData) {
  const session = await requireTrainingLearner();
  const userId = session.user.id;

  const moduleId = getString(formData, "moduleId");
  const watchedSecondsRaw = Number(getString(formData, "watchedSeconds"));
  const lastPositionRaw = Number(getString(formData, "lastPosition"));
  const requestedCompleted = formData.get("completed") === "true";

  if (!Number.isFinite(watchedSecondsRaw) || watchedSecondsRaw < 0) {
    throw new Error("Invalid watchedSeconds value");
  }
  if (!Number.isFinite(lastPositionRaw) || lastPositionRaw < 0) {
    throw new Error("Invalid lastPosition value");
  }

  await assertModuleAccessibleForLearner(userId, moduleId);

  const [module, existingProgress] = await Promise.all([
    prisma.trainingModule.findUnique({
      where: { id: moduleId },
      select: {
        id: true,
        videoDuration: true,
      },
    }),
    prisma.videoProgress.findUnique({
      where: {
        userId_moduleId: { userId, moduleId },
      },
      select: {
        watchedSeconds: true,
        lastPosition: true,
        completed: true,
      },
    }),
  ]);

  if (!module) {
    throw new Error("Training module not found");
  }

  const rawWatchedSeconds = Math.floor(watchedSecondsRaw);
  const rawLastPosition = Math.floor(lastPositionRaw);
  const maxDuration = module.videoDuration ?? null;

  const clampedWatchedSeconds =
    maxDuration && maxDuration > 0
      ? Math.min(rawWatchedSeconds, maxDuration)
      : rawWatchedSeconds;
  const clampedLastPosition =
    maxDuration && maxDuration > 0
      ? Math.min(rawLastPosition, maxDuration)
      : rawLastPosition;

  const watchedSeconds = Math.max(
    existingProgress?.watchedSeconds ?? 0,
    clampedWatchedSeconds
  );
  const lastPosition = Math.max(
    existingProgress?.lastPosition ?? 0,
    clampedLastPosition
  );

  // Completion is driven entirely by the client sending completed=true (on video end).
  // No 90% fallback — only an explicit end event marks the video complete.
  const completed =
    Boolean(existingProgress?.completed) || requestedCompleted;

  // Preserve the original completedAt if the row was already completed —
  // we never want to bump the timestamp on a re-render. If the row is
  // freshly being marked complete, stamp now. Otherwise null.
  const completedAt = completed
    ? (existingProgress?.completed
        ? undefined // leave existing timestamp untouched
        : new Date())
    : null;

  await prisma.videoProgress.upsert({
    where: {
      userId_moduleId: { userId, moduleId },
    },
    create: {
      userId,
      moduleId,
      watchedSeconds,
      lastPosition,
      completed,
      completedAt: completed ? new Date() : null,
    },
    update: {
      watchedSeconds,
      lastPosition,
      completed,
      completedAt,
    },
  });

  await syncAssignmentFromArtifacts(userId, moduleId);

  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath(`/training/${moduleId}`);
}

export async function getVideoProgress(moduleId: string) {
  const session = await getSession();
  if (!session?.user?.id) return null;

  return prisma.videoProgress.findUnique({
    where: {
      userId_moduleId: {
        userId: session.user.id,
        moduleId,
      },
    },
  });
}

// ============================================
// ACADEMY ACTIONS
// ============================================

export async function submitTrainingCheckpoint(formData: FormData) {
  formData.set("completed", "true");
  await setTrainingCheckpointCompletion(formData);
}

export async function setTrainingCheckpointCompletion(formData: FormData) {
  const session = await requireTrainingLearner();
  const userId = session.user.id;

  const checkpointId = getString(formData, "checkpointId");
  const notes = getString(formData, "notes", false);
  const completedRaw = getString(formData, "completed", false).toLowerCase();
  const completed =
    completedRaw === "" ||
    completedRaw === "true" ||
    completedRaw === "1" ||
    completedRaw === "yes";

  const checkpoint = await prisma.trainingCheckpoint.findUnique({
    where: { id: checkpointId },
    select: { id: true, moduleId: true },
  });

  if (!checkpoint) {
    throw new Error("Checkpoint not found");
  }

  await assertModuleAccessibleForLearner(userId, checkpoint.moduleId);

  if (completed) {
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
        notes: notes || null,
        completedAt: new Date(),
      },
    });
  } else {
    await prisma.trainingCheckpointCompletion.deleteMany({
      where: {
        checkpointId,
        userId,
      },
    });
  }

  await syncAssignmentFromArtifacts(userId, checkpoint.moduleId);

  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath("/admin/training");
  revalidatePath(`/training/${checkpoint.moduleId}`);
}

export async function submitTrainingQuizAttempt(formData: FormData) {
  const session = await requireTrainingLearner();
  const userId = session.user.id;

  const moduleId = getString(formData, "moduleId");
  const answersRaw = getString(formData, "answers", false);

  await assertModuleAccessibleForLearner(userId, moduleId);

  const module = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    select: {
      requiresQuiz: true,
      passScorePct: true,
      quizQuestions: {
        select: {
          id: true,
          correctAnswer: true,
        },
      },
    },
  });

  if (!module) {
    throw new Error("Training module not found");
  }
  if (module.requiresQuiz && module.quizQuestions.length === 0) {
    throw new Error(
      "Quiz is required for this module, but no quiz questions are configured yet. Ask an admin to configure this module."
    );
  }
  if (module.quizQuestions.length === 0) {
    throw new Error("No quiz questions are configured for this module yet.");
  }

  // Score is computed server-side from stored correctAnswer values. Any
  // `scorePct` the client may have included is intentionally ignored — the
  // only inputs we trust are the moduleId and the submitted answers map.
  let answersJson: Record<string, string>;
  try {
    answersJson = parseQuizAnswers(answersRaw);
  } catch (err) {
    if (err instanceof QuizSubmissionError) {
      throw new Error(err.message);
    }
    throw err;
  }

  const { results, scorePct } = computeQuizAttemptResult(
    module.quizQuestions,
    answersJson
  );

  const passed = scorePct >= module.passScorePct;

  await prisma.trainingQuizAttempt.create({
    data: {
      moduleId,
      userId,
      scorePct,
      passed,
      answers: answersJson,
    },
  });

  await syncAssignmentFromArtifacts(userId, moduleId);

  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath("/admin/training");
  revalidatePath(`/training/${moduleId}`);

  return { passed, scorePct, passScorePct: module.passScorePct, results };
}

export async function submitTrainingEvidence(formData: FormData) {
  const session = await requireTrainingLearner();
  const userId = session.user.id;

  const moduleId = getString(formData, "moduleId");
  const fileUrl = getString(formData, "uploadedFileUrl", false) || getString(formData, "fileUrl", false);
  const notes = getString(formData, "notes", false);

  if (!fileUrl) {
    throw new Error("Missing evidence file URL");
  }

  await assertModuleAccessibleForLearner(userId, moduleId);

  await prisma.trainingEvidenceSubmission.create({
    data: {
      moduleId,
      userId,
      fileUrl,
      notes: notes || null,
      status: "PENDING_REVIEW",
    },
  });

  await syncAssignmentFromArtifacts(userId, moduleId);

  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath("/admin/training");
  revalidatePath(`/training/${moduleId}`);
}

export async function reviewTrainingEvidence(formData: FormData) {
  const session = await requireAdminOrChapterLead();

  const submissionId = getString(formData, "submissionId");
  const statusRaw = getString(formData, "status");
  const reviewNotes = getString(formData, "reviewNotes", false);

  if (!["APPROVED", "REVISION_REQUESTED", "REJECTED"].includes(statusRaw)) {
    throw new Error("Invalid evidence review status");
  }

  const status = statusRaw as TrainingEvidenceStatus;

  const submissionOwner = await prisma.trainingEvidenceSubmission.findUnique({
    where: { id: submissionId },
    select: { userId: true, moduleId: true, fileUrl: true },
  });

  if (!submissionOwner) {
    throw new Error("Evidence submission not found");
  }

  await assertReviewerCanManageInstructor(session.user.id, submissionOwner.userId);

  const submission = await prisma.trainingEvidenceSubmission.update({
    where: { id: submissionId },
    data: {
      status,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
    },
    select: {
      moduleId: true,
      userId: true,
    },
  });

  const draftId = getDraftIdFromEvidenceUrl(submissionOwner.fileUrl);
  if (draftId) {
    const reviewRubric = buildStudioReviewRubric(formData);
    const draftStatus =
      status === "APPROVED"
        ? "APPROVED"
        : status === "REVISION_REQUESTED"
          ? "NEEDS_REVISION"
          : "REJECTED";

    await prisma.curriculumDraft.update({
      where: { id: draftId },
      data: {
        status: draftStatus,
        reviewNotes: reviewNotes || null,
        reviewRubric: reviewRubric as Prisma.InputJsonValue,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        approvedAt: status === "APPROVED" ? new Date() : null,
      },
      select: { id: true },
    });

    if (status === "APPROVED") {
      await createOrUpdateStudioLaunchPackage({
        draftId,
        reviewerId: session.user.id,
      });
    }
  }

  await syncAssignmentFromArtifacts(submission.userId, submission.moduleId);

  revalidatePath("/admin/instructor-readiness");
  revalidatePath("/chapter-lead/instructor-readiness");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath("/instructor/lesson-design-studio");
  revalidatePath("/admin/training");
  revalidatePath(`/training/${submission.moduleId}`);
}

// ============================================
// TRAINING ASSIGNMENT MANAGEMENT
// ============================================

export async function assignTrainingToUser(formData: FormData) {
  await requireAdmin();

  const userId = getString(formData, "userId");
  const moduleId = getString(formData, "moduleId");

  await prisma.trainingAssignment.upsert({
    where: {
      userId_moduleId: { userId, moduleId },
    },
    create: {
      userId,
      moduleId,
      status: "NOT_STARTED",
    },
    update: {},
  });

  revalidatePath("/admin");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

export async function assignAllTrainingToUser(formData: FormData) {
  await requireAdmin();

  const userId = getString(formData, "userId");

  const modules = await prisma.trainingModule.findMany({
    where: { required: true },
    select: { id: true },
  });

  const newAssignments = modules.map((module) => ({
    userId,
    moduleId: module.id,
    status: "NOT_STARTED" as TrainingStatus,
  }));

  if (newAssignments.length > 0) {
    await prisma.trainingAssignment.createMany({
      data: newAssignments,
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

export async function updateTrainingStatus(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  const assignmentId = getString(formData, "assignmentId");
  const status = getString(formData, "status") as TrainingStatus;

  if (!["NOT_STARTED", "IN_PROGRESS", "COMPLETE"].includes(status)) {
    throw new Error("Invalid training status");
  }

  const assignment = await prisma.trainingAssignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  const isAdmin = roles.includes("ADMIN");
  if (assignment.userId !== userId && !isAdmin) {
    throw new Error("Unauthorized");
  }

  // Self-promote to COMPLETE is not allowed: learners cannot bypass
  // checkpoints/quiz/evidence by flipping the status. Re-derive from
  // artifacts instead — that path will only land on COMPLETE if every
  // requirement is genuinely satisfied.
  if (status === "COMPLETE" && !isAdmin) {
    await syncAssignmentFromArtifacts(assignment.userId, assignment.moduleId);
  } else {
    await prisma.trainingAssignment.update({
      where: { id: assignmentId },
      data: {
        status,
        completedAt: status === "COMPLETE" ? new Date() : null,
      },
    });

    if (status === "COMPLETE") {
      await checkAndIssueTrainingCompletion(assignment.userId);
      await syncTrainingGrowth(assignment.userId);
    }
  }

  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
}

// ============================================
// MODULE DELETION
// ============================================

export async function deleteTrainingModule(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");

  // All-or-nothing: cascade child deletes inside a single transaction so a
  // mid-failure can never leave orphan checkpoints / attempts / progress
  // pointing at a deleted module.
  await prisma.$transaction([
    prisma.trainingCheckpointCompletion.deleteMany({
      where: { checkpoint: { moduleId } },
    }),
    prisma.trainingCheckpoint.deleteMany({ where: { moduleId } }),
    prisma.trainingQuizAttempt.deleteMany({ where: { moduleId } }),
    prisma.trainingQuizQuestion.deleteMany({ where: { moduleId } }),
    prisma.trainingEvidenceSubmission.deleteMany({ where: { moduleId } }),
    prisma.videoProgress.deleteMany({ where: { moduleId } }),
    prisma.trainingAssignment.deleteMany({ where: { moduleId } }),
    prisma.trainingModule.delete({ where: { id: moduleId } }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

export async function cloneTrainingModule(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");

  const source = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    include: {
      checkpoints: { orderBy: { sortOrder: "asc" } },
      quizQuestions: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!source) throw new Error("Module not found");

  const aggregate = await prisma.trainingModule.aggregate({ _max: { sortOrder: true } });
  const nextSortOrder = (aggregate._max.sortOrder ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    const clone = await tx.trainingModule.create({
      data: {
        contentKey: null, // contentKey is @unique — clones must not inherit it
        title: `${source.title} (Copy)`,
        description: source.description,
        materialUrl: source.materialUrl,
        materialNotes: source.materialNotes,
        type: source.type,
        required: source.required,
        sortOrder: nextSortOrder,
        videoUrl: source.videoUrl,
        videoProvider: source.videoProvider,
        videoDuration: source.videoDuration,
        videoThumbnail: source.videoThumbnail,
        requiresQuiz: source.requiresQuiz,
        requiresEvidence: source.requiresEvidence,
        passScorePct: source.passScorePct,
        estimatedMinutes: source.estimatedMinutes,
      },
    });

    for (const cp of source.checkpoints) {
      await tx.trainingCheckpoint.create({
        data: {
          moduleId: clone.id,
          contentKey: null,
          title: cp.title,
          description: cp.description,
          sortOrder: cp.sortOrder,
          required: cp.required,
        },
      });
    }

    for (const q of source.quizQuestions) {
      await tx.trainingQuizQuestion.create({
        data: {
          moduleId: clone.id,
          contentKey: null,
          question: q.question,
          options: q.options as Prisma.InputJsonValue,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          sortOrder: q.sortOrder,
        },
      });
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

export async function archiveTrainingModule(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");

  await prisma.trainingModule.update({
    where: { id: moduleId },
    data: { archivedAt: new Date() },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

export async function unarchiveTrainingModule(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");

  await prisma.trainingModule.update({
    where: { id: moduleId },
    data: { archivedAt: null },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

export async function inlineUpdateTrainingModule(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const required = formData.get("required") === "on";

  await prisma.trainingModule.update({
    where: { id: moduleId },
    data: { title, description, required },
  });

  await syncAssignmentsForModule(moduleId);

  revalidatePath("/admin");
  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

export async function reorderTrainingModules(formData: FormData) {
  await requireAdmin();

  const raw = formData.get("order");
  if (typeof raw !== "string" || !raw) throw new Error("Order data is required");

  const items = JSON.parse(raw) as Array<{ id: string; sortOrder: number }>;
  if (!Array.isArray(items) || items.length === 0) throw new Error("Invalid order data");

  await prisma.$transaction(
    items.map((item) =>
      prisma.trainingModule.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  );

  revalidatePath("/admin");
  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

// ============================================
// BULK ASSIGNMENT
// ============================================

export async function bulkAssignModuleToInstructors(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");

  const instructors = await prisma.user.findMany({
    where: { roles: { some: { role: "INSTRUCTOR" } } },
    select: { id: true },
  });

  const newAssignments = instructors.map((instructor) => ({
    userId: instructor.id,
    moduleId,
    status: "NOT_STARTED" as TrainingStatus,
  }));

  if (newAssignments.length > 0) {
    await prisma.trainingAssignment.createMany({
      data: newAssignments,
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

export async function bulkAssignModuleToStudents(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");

  const students = await prisma.user.findMany({
    where: { roles: { some: { role: "STUDENT" } } },
    select: { id: true },
  });

  const newAssignments = students.map((student) => ({
    userId: student.id,
    moduleId,
    status: "NOT_STARTED" as TrainingStatus,
  }));

  if (newAssignments.length > 0) {
    await prisma.trainingAssignment.createMany({
      data: newAssignments,
      skipDuplicates: true,
    });
  }

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

export async function markTrainingComplete(formData: FormData) {
  await requireAdmin();

  const assignmentId = getString(formData, "assignmentId");

  const updated = await prisma.trainingAssignment.update({
    where: { id: assignmentId },
    data: { status: "COMPLETE", completedAt: new Date() },
    select: { userId: true },
  });

  await checkAndIssueTrainingCompletion(updated.userId);
  await syncTrainingGrowth(updated.userId);

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

// ============================================
// CURRICULUM FEEDBACK
// ============================================

export async function submitCurriculumFeedback(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];

  if (
    !roles.includes("ADMIN") &&
    !roles.includes("MENTOR") &&
    !roles.includes("CHAPTER_PRESIDENT")
  ) {
    throw new Error("Only admins, mentors, and chapter presidents can submit curriculum feedback");
  }

  const instructorId = getString(formData, "instructorId");
  const rating = getString(formData, "rating", false);
  const comments = getString(formData, "comments");

  await prisma.feedback.create({
    data: {
      source: "PEER",
      rating: rating ? Number(rating) : null,
      comments,
      instructorId,
      authorId: session.user.id,
    },
  });

  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath(`/profile/${instructorId}`);
}
