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
      videoUrl: true,
      videoDuration: true,
      requiresQuiz: true,
      requiresEvidence: true,
      passScorePct: true,
      checkpoints: {
        where: { required: true },
        select: { id: true },
      },
    },
  });

  if (!module) {
    throw new Error("Training module not found");
  }

  const requiredCheckpointIds = module.checkpoints.map((checkpoint) => checkpoint.id);

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
  const quizReady = !module.requiresQuiz || Boolean(passedQuizAttempt);
  const evidenceReady = !module.requiresEvidence || approvedEvidenceCount > 0;

  const isComplete = videoReady && checkpointsReady && quizReady && evidenceReady;
  const hasAnyProgress =
    hasVideoProgress || completedCheckpointCount > 0 || quizAttemptCount > 0 || evidenceSubmissionCount > 0;

  const nextStatus: TrainingStatus = isComplete
    ? "COMPLETE"
    : hasAnyProgress
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
  };
}

// ============================================
// TRAINING MODULE MANAGEMENT (Admin)
// ============================================

export async function createTrainingModuleWithVideo(formData: FormData) {
  await requireAdmin();

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

  await prisma.trainingModule.create({
    data: {
      title,
      description,
      materialUrl: materialUrl || null,
      materialNotes: materialNotes || null,
      type,
      required,
      sortOrder,
      videoUrl: videoUrl || null,
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
  revalidatePath("/admin/training");
}

export async function updateTrainingModule(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");
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

  await prisma.trainingModule.update({
    where: { id: moduleId },
    data: {
      title,
      description,
      materialUrl: materialUrl || null,
      materialNotes: materialNotes || null,
      type,
      required,
      sortOrder,
      videoUrl: videoUrl || null,
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
  revalidatePath("/admin/training");
}

// ============================================
// VIDEO PROGRESS TRACKING
// ============================================

export async function updateVideoProgress(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const moduleId = getString(formData, "moduleId");
  const watchedSeconds = Number(getString(formData, "watchedSeconds"));
  const lastPosition = Number(getString(formData, "lastPosition"));
  const completed = formData.get("completed") === "true";

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
  const session = await requireAuth();
  const userId = session.user.id;

  const checkpointId = getString(formData, "checkpointId");
  const notes = getString(formData, "notes", false);

  const checkpoint = await prisma.trainingCheckpoint.findUnique({
    where: { id: checkpointId },
    select: { id: true, moduleId: true },
  });

  if (!checkpoint) {
    throw new Error("Checkpoint not found");
  }

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

  await syncAssignmentFromArtifacts(userId, checkpoint.moduleId);

  revalidatePath("/instructor/training-progress");
  revalidatePath(`/training/${checkpoint.moduleId}`);
}

export async function submitTrainingQuizAttempt(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const moduleId = getString(formData, "moduleId");
  const scorePctRaw = getString(formData, "scorePct", false);
  const answersRaw = getString(formData, "answers", false);

  const module = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    select: {
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
    if (module.quizQuestions.length === 0) {
      scorePct = 100;
    } else {
      const correct = module.quizQuestions.filter(
        (question) => answersJson[question.id] === question.correctAnswer
      ).length;
      scorePct = Math.round((correct / module.quizQuestions.length) * 100);
    }
  }

  const passed = scorePct >= module.passScorePct;

  await prisma.trainingQuizAttempt.create({
    data: {
      moduleId,
      userId,
      scorePct,
      passed,
      answers: Object.keys(answersJson).length > 0 ? answersJson : null,
    },
  });

  await syncAssignmentFromArtifacts(userId, moduleId);

  revalidatePath("/instructor/training-progress");
  revalidatePath(`/training/${moduleId}`);

  return { passed, scorePct, passScorePct: module.passScorePct };
}

export async function submitTrainingEvidence(formData: FormData) {
  const session = await requireAuth();
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
  revalidatePath("/instructor/training-progress");
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
  revalidatePath("/instructor/training-progress");
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
  revalidatePath(`/profile/${instructorId}`);
}
