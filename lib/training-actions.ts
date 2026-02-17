"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import {
  CourseLevel,
  ReadinessReviewStatus,
  TrainingEvidenceStatus,
  TrainingModuleType,
  TrainingStatus,
  VideoProvider,
} from "@prisma/client";
import { checkAndIssueTrainingCompletion } from "@/lib/auto-certificate-actions";
import { getInstructorReadiness } from "@/lib/instructor-readiness";

async function requireAuth() {
  const session = await getServerSession(authOptions);
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
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_LEAD")) {
    throw new Error("Unauthorized - Admin or Chapter Lead access required");
  }
  return session;
}

async function requireTrainingLearner() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const canAccessTraining =
    roles.includes("STUDENT") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("ADMIN") ||
    roles.includes("CHAPTER_LEAD");

  if (!canAccessTraining) {
    throw new Error("Unauthorized - Training learner access required");
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
  const isChapterLead = reviewerRoles.includes("CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized");
  }

  if (isChapterLead && !isAdmin && reviewer.chapterId !== instructor.chapterId) {
    throw new Error("Chapter Leads can only review instructors in their own chapter.");
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

function getCourseLevel(raw: string): CourseLevel {
  if (!["LEVEL_101", "LEVEL_201", "LEVEL_301", "LEVEL_401"].includes(raw)) {
    throw new Error("Invalid course level");
  }
  return raw as CourseLevel;
}

type ModuleValidationInput = {
  required: boolean;
  videoUrl: string | null;
  videoProvider: VideoProvider | null;
  requiresQuiz: boolean;
  requiresEvidence: boolean;
  requiredCheckpointCount: number;
  quizQuestionCount: number;
};

const TRACKABLE_REQUIRED_VIDEO_PROVIDERS = new Set<VideoProvider>([
  "YOUTUBE",
  "VIMEO",
  "CUSTOM",
]);

function getModuleConfigurationIssues(input: ModuleValidationInput): string[] {
  const issues: string[] = [];
  const hasActionablePath =
    Boolean(input.videoUrl) ||
    input.requiredCheckpointCount > 0 ||
    input.requiresQuiz ||
    input.requiresEvidence;

  if (input.required && !hasActionablePath) {
    issues.push(
      "Required modules must include at least one actionable requirement: video, required checkpoint, quiz, or evidence."
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

async function ensureSequentialPermission(instructorId: string, level: CourseLevel) {
  const requiredPrereq: Record<CourseLevel, CourseLevel | null> = {
    LEVEL_101: null,
    LEVEL_201: "LEVEL_101",
    LEVEL_301: "LEVEL_201",
    LEVEL_401: "LEVEL_301",
  };

  const prereq = requiredPrereq[level];
  if (!prereq) return;

  const hasPrereqPermission = await prisma.instructorTeachingPermission.findUnique({
    where: {
      instructorId_level: { instructorId, level: prereq },
    },
    select: { id: true },
  });

  if (hasPrereqPermission) return;

  const hasLegacyPrereq = await prisma.instructorApprovalLevel.findFirst({
    where: {
      level: prereq,
      approval: { instructorId },
    },
    select: { id: true },
  });

  if (!hasLegacyPrereq) {
    throw new Error(
      `Cannot grant ${level.replace("LEVEL_", "")} before ${prereq.replace("LEVEL_", "")}.`
    );
  }
}

async function upsertTeachingPermission({
  instructorId,
  level,
  grantedById,
  reason,
}: {
  instructorId: string;
  level: CourseLevel;
  grantedById: string;
  reason?: string | null;
}) {
  await ensureSequentialPermission(instructorId, level);

  await prisma.instructorTeachingPermission.upsert({
    where: {
      instructorId_level: { instructorId, level },
    },
    create: {
      instructorId,
      level,
      grantedById,
      reason: reason || null,
    },
    update: {
      grantedById,
      reason: reason || null,
      grantedAt: new Date(),
    },
  });

  // Keep legacy approval records aligned for existing pages.
  let approval = await prisma.instructorApproval.findFirst({
    where: { instructorId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!approval) {
    approval = await prisma.instructorApproval.create({
      data: {
        instructorId,
        status: "APPROVED",
        notes: "Auto-synced from native teaching permission.",
      },
      select: { id: true },
    });
  } else {
    await prisma.instructorApproval.update({
      where: { id: approval.id },
      data: {
        status: "APPROVED",
        notes: "Auto-synced from native teaching permission.",
      },
    });
  }

  const existingLevel = await prisma.instructorApprovalLevel.findFirst({
    where: {
      approvalId: approval.id,
      level,
    },
    select: { id: true },
  });

  if (!existingLevel) {
    await prisma.instructorApprovalLevel.create({
      data: {
        approvalId: approval.id,
        level,
      },
    });
  }
}

async function syncAssignmentFromArtifacts(userId: string, moduleId: string) {
  const module = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    select: {
      id: true,
      required: true,
      videoUrl: true,
      videoProvider: true,
      videoDuration: true,
      requiresQuiz: true,
      requiresEvidence: true,
      passScorePct: true,
      checkpoints: {
        where: { required: true },
        select: { id: true },
      },
      quizQuestions: {
        select: { id: true },
      },
    },
  });

  if (!module) {
    throw new Error("Training module not found");
  }

  const requiredCheckpointIds = module.checkpoints.map((checkpoint) => checkpoint.id);
  const quizQuestionCount = module.quizQuestions.length;
  const moduleConfigurationIssues = getModuleConfigurationIssues({
    required: module.required,
    videoUrl: module.videoUrl,
    videoProvider: module.videoProvider,
    requiresQuiz: module.requiresQuiz,
    requiresEvidence: module.requiresEvidence,
    requiredCheckpointCount: requiredCheckpointIds.length,
    quizQuestionCount,
  });
  const configurationIssue = moduleConfigurationIssues[0] ?? null;

  const [videoProgress, completedCheckpointCount, passedQuizAttempt, approvedEvidenceCount, quizAttemptCount, evidenceSubmissionCount] =
    await Promise.all([
      prisma.videoProgress.findUnique({
        where: {
          userId_moduleId: { userId, moduleId },
        },
        select: {
          watchedSeconds: true,
          completed: true,
        },
      }),
      requiredCheckpointIds.length
        ? prisma.trainingCheckpointCompletion.count({
            where: {
              userId,
              checkpointId: { in: requiredCheckpointIds },
            },
          })
        : Promise.resolve(0),
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
      prisma.trainingEvidenceSubmission.count({ where: { userId, moduleId } }),
    ]);

  const hasVideoProgress = (videoProgress?.watchedSeconds ?? 0) > 0;
  const videoReady =
    !module.videoUrl ||
    videoProgress?.completed === true ||
    (module.videoDuration !== null && module.videoDuration !== undefined
      ? (videoProgress?.watchedSeconds ?? 0) >= Math.floor(module.videoDuration * 0.9)
      : false);

  const checkpointsReady =
    requiredCheckpointIds.length === 0 || completedCheckpointCount >= requiredCheckpointIds.length;
  const quizReady = !module.requiresQuiz || (quizQuestionCount > 0 && Boolean(passedQuizAttempt));
  const evidenceReady = !module.requiresEvidence || approvedEvidenceCount > 0;

  const isComplete =
    !configurationIssue && videoReady && checkpointsReady && quizReady && evidenceReady;
  const hasAnyProgress =
    hasVideoProgress || completedCheckpointCount > 0 || quizAttemptCount > 0 || evidenceSubmissionCount > 0;

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

async function syncAssignmentsForModule(moduleId: string) {
  const assignments = await prisma.trainingAssignment.findMany({
    where: { moduleId },
    select: { userId: true },
  });

  await Promise.all(
    assignments.map((assignment) => syncAssignmentFromArtifacts(assignment.userId, moduleId))
  );
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
    throw new Error("Quiz questions must have at least 2 options.");
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

  const autoCompleted =
    maxDuration && maxDuration > 0
      ? watchedSeconds >= Math.floor(maxDuration * 0.9)
      : false;
  const completed =
    Boolean(existingProgress?.completed) || requestedCompleted || autoCompleted;

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
      completedAt: completed ? new Date() : undefined,
    },
  });

  await syncAssignmentFromArtifacts(userId, moduleId);

  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath(`/training/${moduleId}`);
}

export async function getVideoProgress(moduleId: string) {
  const session = await getServerSession(authOptions);
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
        notes: notes || undefined,
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
  const scorePctRaw = getString(formData, "scorePct", false);
  const answersRaw = getString(formData, "answers", false);

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

  let answersJson: Record<string, string> = {};
  if (answersRaw) {
    try {
      const parsed = JSON.parse(answersRaw) as Record<string, string>;
      answersJson = parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      answersJson = {};
    }
  }

  let scorePct = scorePctRaw ? Number(scorePctRaw) : NaN;

  if (!Number.isFinite(scorePct)) {
    const correct = module.quizQuestions.filter(
      (question) => answersJson[question.id] === question.correctAnswer
    ).length;
    scorePct = Math.round((correct / module.quizQuestions.length) * 100);
  }

  const passed = scorePct >= module.passScorePct;

  await prisma.trainingQuizAttempt.create({
    data: {
      moduleId,
      userId,
      scorePct,
      passed,
      answers: Object.keys(answersJson).length > 0 ? answersJson : undefined,
    },
  });

  await syncAssignmentFromArtifacts(userId, moduleId);

  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath("/admin/training");
  revalidatePath(`/training/${moduleId}`);

  return { passed, scorePct, passScorePct: module.passScorePct };
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

export async function requestReadinessReview(formData?: FormData) {
  const session = await requireAuth();
  const instructorId = session.user.id;
  const notes = formData ? getString(formData, "notes", false) : "";

  const readiness = await getInstructorReadiness(instructorId);
  if (!readiness.trainingComplete) {
    throw new Error("Complete all required training modules before requesting readiness review.");
  }

  await prisma.readinessReviewRequest.create({
    data: {
      instructorId,
      status: "REQUESTED",
      notes: notes || null,
    },
  });

  revalidatePath("/instructor/training-progress");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/admin/instructor-readiness");
  revalidatePath("/chapter-lead/instructor-readiness");
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
    select: { userId: true },
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

  await syncAssignmentFromArtifacts(submission.userId, submission.moduleId);

  revalidatePath("/admin/instructor-readiness");
  revalidatePath("/chapter-lead/instructor-readiness");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
  revalidatePath("/instructor/training-progress");
  revalidatePath("/admin/training");
  revalidatePath(`/training/${submission.moduleId}`);
}

export async function grantTeachingPermission(formData: FormData) {
  const session = await requireAdminOrChapterLead();

  const instructorId = getString(formData, "instructorId");
  const level = getCourseLevel(getString(formData, "level"));
  const reason = getString(formData, "reason", false);

  await assertReviewerCanManageInstructor(session.user.id, instructorId);

  await upsertTeachingPermission({
    instructorId,
    level,
    grantedById: session.user.id,
    reason: reason || null,
  });

  revalidatePath("/admin/instructor-readiness");
  revalidatePath("/chapter-lead/instructor-readiness");
  revalidatePath("/instructor/certifications");
}

export async function approveReadinessReview(formData: FormData) {
  const session = await requireAdminOrChapterLead();

  const requestId = getString(formData, "requestId");
  const level = getCourseLevel(getString(formData, "level", false) || "LEVEL_101");
  const reviewNotes = getString(formData, "reviewNotes", false);

  const request = await prisma.readinessReviewRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      instructorId: true,
    },
  });

  if (!request) {
    throw new Error("Readiness request not found");
  }

  await assertReviewerCanManageInstructor(session.user.id, request.instructorId);

  await prisma.readinessReviewRequest.update({
    where: { id: requestId },
    data: {
      status: "APPROVED",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
    },
  });

  const interviewGate = await prisma.instructorInterviewGate.findUnique({
    where: { instructorId: request.instructorId },
    select: { status: true },
  });

  if (interviewGate && !["PASSED", "WAIVED"].includes(interviewGate.status)) {
    throw new Error("Cannot approve readiness before interview gate is passed or waived.");
  }

  await upsertTeachingPermission({
    instructorId: request.instructorId,
    level,
    grantedById: session.user.id,
    reason:
      reviewNotes || `Approved via readiness review ${requestId} by ${session.user.id}.`,
  });

  revalidatePath("/admin/instructor-readiness");
  revalidatePath("/chapter-lead/instructor-readiness");
}

export async function requestReadinessRevision(formData: FormData) {
  const session = await requireAdminOrChapterLead();

  const requestId = getString(formData, "requestId");
  const reviewNotes = getString(formData, "reviewNotes", false);
  const statusRaw = getString(formData, "status", false) || "REVISION_REQUESTED";

  if (!["REVISION_REQUESTED", "REJECTED"].includes(statusRaw)) {
    throw new Error("Invalid readiness review status");
  }

  const request = await prisma.readinessReviewRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      instructorId: true,
    },
  });

  if (!request) {
    throw new Error("Readiness request not found");
  }

  await assertReviewerCanManageInstructor(session.user.id, request.instructorId);

  await prisma.readinessReviewRequest.update({
    where: { id: requestId },
    data: {
      status: statusRaw as ReadinessReviewStatus,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
    },
  });

  revalidatePath("/admin/instructor-readiness");
  revalidatePath("/chapter-lead/instructor-readiness");
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

  const assignment = await prisma.trainingAssignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  if (assignment.userId !== userId && !roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }

  if (status === "COMPLETE" && !roles.includes("ADMIN")) {
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

  await prisma.trainingCheckpointCompletion.deleteMany({
    where: { checkpoint: { moduleId } },
  });
  await prisma.trainingCheckpoint.deleteMany({ where: { moduleId } });
  await prisma.trainingQuizAttempt.deleteMany({ where: { moduleId } });
  await prisma.trainingQuizQuestion.deleteMany({ where: { moduleId } });
  await prisma.trainingEvidenceSubmission.deleteMany({ where: { moduleId } });
  await prisma.videoProgress.deleteMany({ where: { moduleId } });
  await prisma.trainingAssignment.deleteMany({ where: { moduleId } });

  await prisma.trainingModule.delete({ where: { id: moduleId } });

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
    !roles.includes("CHAPTER_LEAD")
  ) {
    throw new Error("Only admins, mentors, and chapter leads can submit curriculum feedback");
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
