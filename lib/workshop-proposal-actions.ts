"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type {
  WorkshopProposalDifficulty,
  WorkshopProposalReviewRecommendation,
  WorkshopProposalSourceType,
  WorkshopProposalSubmissionStatus,
  WorkshopProposalTemplateStatus,
} from "@prisma/client";
import {
  EMPTY_CUSTOM_WORKSHOP,
  EMPTY_REFLECTION,
  isSubmissionEditable,
  isSubmissionReviewable,
} from "@/lib/workshop-proposal-constants";
import {
  customWorkshopIssues,
  normalizeCustomWorkshop,
  normalizeReflection,
  reflectionIssues,
  submissionIssues,
} from "@/lib/workshop-proposal-validation";
import {
  getWorkshopStudioGateStatus,
  isSummerWorkshopApplicant,
} from "@/lib/workshop-proposal-access";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

async function requireAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized — Admin access required");
  }
  return session;
}

async function requireReviewer() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Unauthorized — reviewer access required");
  }
  return session;
}

/**
 * Chapter-scoped reviewer guard. Mirrors the
 * `assertReviewerCanManageInstructor` pattern in `training-actions.ts`:
 *   * ADMIN — passes for any submission.
 *   * CHAPTER_PRESIDENT — only passes if the submission's author and the
 *     reviewer share a `chapterId`. If either side is missing a chapter, we
 *     fail closed (chapter data must be reliable for this gate to be safe).
 *
 * Throws on failure so the action never silently writes to a submission the
 * reviewer shouldn't see.
 */
async function assertReviewerCanReviewSubmission(
  reviewerId: string,
  submissionAuthorId: string
) {
  const [reviewer, author] = await Promise.all([
    prisma.user.findUnique({
      where: { id: reviewerId },
      select: {
        chapterId: true,
        roles: { select: { role: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: submissionAuthorId },
      select: { chapterId: true },
    }),
  ]);

  if (!reviewer || !author) {
    throw new Error("Reviewer or applicant not found");
  }

  const reviewerRoles = reviewer.roles.map((r) => r.role);
  const isAdmin = reviewerRoles.includes("ADMIN");
  const isChapterLead = reviewerRoles.includes("CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized — reviewer access required");
  }

  if (isChapterLead && !isAdmin) {
    if (!reviewer.chapterId || !author.chapterId) {
      throw new Error(
        "Chapter Presidents can only review applicants in their own chapter."
      );
    }
    if (reviewer.chapterId !== author.chapterId) {
      throw new Error(
        "Chapter Presidents can only review applicants in their own chapter."
      );
    }
  }
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getNumber(formData: FormData, key: string, fallback = 0): number {
  const raw = formData.get(key);
  if (!raw || String(raw).trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getStringList(formData: FormData, key: string): string[] {
  const raw = formData.get(key);
  if (raw == null) return [];
  return String(raw)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const VALID_TEMPLATE_STATUS = new Set<WorkshopProposalTemplateStatus>([
  "DRAFT",
  "APPROVED",
  "ARCHIVED",
]);
const VALID_DIFFICULTY = new Set<WorkshopProposalDifficulty>([
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
]);
const VALID_RECOMMENDATION = new Set<WorkshopProposalReviewRecommendation>([
  "APPROVE",
  "REQUEST_CHANGES",
  "REJECT",
]);

const ADMIN_LIBRARY_PATH = "/admin/workshop-library";
const ADMIN_REVIEWS_PATH = "/admin/workshop-reviews";
const APPLICANT_STUDIO_PATH = "/instructor/workshop-design-studio";

function revalidateAllWorkshopSurfaces(submissionId?: string) {
  revalidatePath(ADMIN_LIBRARY_PATH);
  revalidatePath(ADMIN_REVIEWS_PATH);
  revalidatePath(APPLICANT_STUDIO_PATH);
  revalidatePath(`${APPLICANT_STUDIO_PATH}/library`);
  revalidatePath(`${APPLICANT_STUDIO_PATH}/design`);
  if (submissionId) {
    revalidatePath(`${ADMIN_REVIEWS_PATH}/${submissionId}`);
  }
}

// ===========================================================================
// ADMIN — TEMPLATE CRUD
// ===========================================================================

export async function createWorkshopTemplate(formData: FormData) {
  const session = await requireAdmin();

  const title = getString(formData, "title");
  const category = getString(formData, "category");
  const targetAgeRange = getString(formData, "targetAgeRange");
  const estimatedMinutes = Math.max(15, getNumber(formData, "estimatedMinutes", 60));
  const description = getString(formData, "description");
  const learningObjectives = getStringList(formData, "learningObjectives");
  const activityPlan = getString(formData, "activityPlan");
  const materials = getStringList(formData, "materials");
  const difficultyRaw = getString(formData, "difficulty", false) || "BEGINNER";
  const tags = getStringList(formData, "tags");
  const statusRaw = getString(formData, "status", false) || "DRAFT";

  if (!VALID_DIFFICULTY.has(difficultyRaw as WorkshopProposalDifficulty)) {
    throw new Error("Invalid difficulty");
  }
  if (!VALID_TEMPLATE_STATUS.has(statusRaw as WorkshopProposalTemplateStatus)) {
    throw new Error("Invalid status");
  }

  await prisma.workshopProposalTemplate.create({
    data: {
      title,
      category,
      targetAgeRange,
      estimatedMinutes,
      description,
      learningObjectives,
      activityPlan,
      materials,
      difficulty: difficultyRaw as WorkshopProposalDifficulty,
      tags,
      status: statusRaw as WorkshopProposalTemplateStatus,
      createdById: session.user.id,
      updatedById: session.user.id,
    },
  });

  revalidateAllWorkshopSurfaces();
}

export async function updateWorkshopTemplate(formData: FormData) {
  const session = await requireAdmin();
  const id = getString(formData, "id");

  const existing = await prisma.workshopProposalTemplate.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("Workshop template not found");

  const title = getString(formData, "title");
  const category = getString(formData, "category");
  const targetAgeRange = getString(formData, "targetAgeRange");
  const estimatedMinutes = Math.max(15, getNumber(formData, "estimatedMinutes", 60));
  const description = getString(formData, "description");
  const learningObjectives = getStringList(formData, "learningObjectives");
  const activityPlan = getString(formData, "activityPlan");
  const materials = getStringList(formData, "materials");
  const difficultyRaw = getString(formData, "difficulty", false) || "BEGINNER";
  const tags = getStringList(formData, "tags");
  const statusRaw = getString(formData, "status", false) || "DRAFT";

  if (!VALID_DIFFICULTY.has(difficultyRaw as WorkshopProposalDifficulty)) {
    throw new Error("Invalid difficulty");
  }
  if (!VALID_TEMPLATE_STATUS.has(statusRaw as WorkshopProposalTemplateStatus)) {
    throw new Error("Invalid status");
  }

  await prisma.workshopProposalTemplate.update({
    where: { id },
    data: {
      title,
      category,
      targetAgeRange,
      estimatedMinutes,
      description,
      learningObjectives,
      activityPlan,
      materials,
      difficulty: difficultyRaw as WorkshopProposalDifficulty,
      tags,
      status: statusRaw as WorkshopProposalTemplateStatus,
      updatedById: session.user.id,
      // Stamp archivedAt when the admin moves the row into ARCHIVED so the
      // applicant library can hide stale entries by date if needed later.
      archivedAt:
        statusRaw === "ARCHIVED"
          ? new Date()
          : statusRaw === "APPROVED" || statusRaw === "DRAFT"
            ? null
            : undefined,
    },
  });

  revalidateAllWorkshopSurfaces();
}

export async function setWorkshopTemplateStatus(formData: FormData) {
  await requireAdmin();
  const id = getString(formData, "id");
  const statusRaw = getString(formData, "status");

  if (!VALID_TEMPLATE_STATUS.has(statusRaw as WorkshopProposalTemplateStatus)) {
    throw new Error("Invalid status");
  }

  await prisma.workshopProposalTemplate.update({
    where: { id },
    data: {
      status: statusRaw as WorkshopProposalTemplateStatus,
      archivedAt: statusRaw === "ARCHIVED" ? new Date() : null,
    },
  });
  revalidateAllWorkshopSurfaces();
}

// ===========================================================================
// APPLICANT — Submission lifecycle
// ===========================================================================

/**
 * Resolves (and lazily creates) the applicant's working submission row. We
 * keep one submission per applicant — the @@unique([authorId]) constraint
 * makes that the data-layer invariant. This action is idempotent.
 */
async function resolveApplicantSubmission(
  userId: string,
  applicationId: string | null
) {
  const existing = await prisma.workshopProposalSubmission.findUnique({
    where: { authorId: userId },
  });
  if (existing) return existing;

  return prisma.workshopProposalSubmission.create({
    data: {
      authorId: userId,
      applicationId,
      sourceType: "CUSTOM_DESIGN",
      customWorkshop: EMPTY_CUSTOM_WORKSHOP as unknown as Prisma.InputJsonValue,
      reflection: EMPTY_REFLECTION as unknown as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });
}

async function assertApplicantCanWriteSubmission(userId: string, roles: string[]) {
  // Reviewers can preview but not write submissions on behalf of applicants.
  const gate = await getWorkshopStudioGateStatus(userId, roles);
  if (gate.unlocked && gate.reason === "REVIEWER_BYPASS") {
    throw new Error(
      "Reviewers can preview the studio but cannot submit on behalf of applicants."
    );
  }
  if (!gate.unlocked) {
    if (gate.reason === "WRONG_SUBTYPE") {
      throw new Error(
        "Workshop Design Studio is only for Summer Workshop Instructor applicants."
      );
    }
    throw new Error("Complete required training before working on the workshop.");
  }
}

export async function getOrCreateApplicantSubmission() {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  await assertApplicantCanWriteSubmission(userId, roles);

  // Re-application: link the workshop submission to the applicant's most
  // recent active application.
  const application = await prisma.instructorApplication.findFirst({
    where: {
      applicantId: userId,
      status: { notIn: ["REJECTED", "WITHDRAWN"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return resolveApplicantSubmission(userId, application?.id ?? null);
}

/**
 * Read-only page helper that returns the applicant's submission for display
 * without throwing if auth/gate hiccups happen. Safe to call from server
 * components for context — never use for writes (use the action-layer
 * variants which re-validate the gate explicitly).
 */
export async function readApplicantSubmissionSafe() {
  try {
    const session = await getSession();
    if (!session?.user?.id) return null;
    const userId = session.user.id;
    return await prisma.workshopProposalSubmission.findUnique({
      where: { authorId: userId },
    });
  } catch (error) {
    console.error("[workshop-studio] readApplicantSubmissionSafe failed", error);
    return null;
  }
}

/**
 * Applicant chooses a path. Switches the submission's sourceType, blanking
 * the unused payload so old data never leaks into the new flow.
 */
export async function chooseWorkshopPath(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  await assertApplicantCanWriteSubmission(userId, roles);

  const sourceType = getString(formData, "sourceType") as WorkshopProposalSourceType;
  if (sourceType !== "CUSTOM_DESIGN" && sourceType !== "TEMPLATE_SELECTION") {
    throw new Error("Invalid path");
  }

  const submission = await getOrCreateApplicantSubmission();
  if (!isSubmissionEditable(submission.status)) {
    throw new Error(
      "Your workshop submission is locked. A reviewer is taking a look — wait for their feedback before switching paths."
    );
  }

  await prisma.workshopProposalSubmission.update({
    where: { id: submission.id },
    data: {
      sourceType,
      // Blank the side that doesn't apply so reviewers don't see stale data.
      ...(sourceType === "CUSTOM_DESIGN"
        ? { templateId: null }
        : {
            customWorkshop:
              EMPTY_CUSTOM_WORKSHOP as unknown as Prisma.InputJsonValue,
          }),
    },
  });
  revalidateAllWorkshopSurfaces(submission.id);
}

/**
 * Save the applicant's custom-design draft. Autosave-friendly: never throws
 * on incomplete fields; validation runs on submit.
 */
export async function saveCustomWorkshopDraft(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  await assertApplicantCanWriteSubmission(userId, roles);

  const submission = await getOrCreateApplicantSubmission();
  if (!isSubmissionEditable(submission.status)) {
    throw new Error("Submission is locked while review is in progress.");
  }

  const payload = normalizeCustomWorkshop({
    title: getString(formData, "title", false),
    targetAgeGroup: getString(formData, "targetAgeGroup", false),
    lengthMinutes: getNumber(formData, "lengthMinutes", 0),
    category: getString(formData, "category", false),
    learningObjective: getString(formData, "learningObjective", false),
    materials: getStringList(formData, "materials"),
    openingHook: getString(formData, "openingHook", false),
    mainActivity: getString(formData, "mainActivity", false),
    participationPlan: getString(formData, "participationPlan", false),
    wrapUp: getString(formData, "wrapUp", false),
    backupPlan: getString(formData, "backupPlan", false),
    format: getString(formData, "format", false),
    locationNotes: getString(formData, "locationNotes", false),
    capacity: getNumber(formData, "capacity", 0),
    availability: getString(formData, "availability", false),
    safetyNotes: getString(formData, "safetyNotes", false),
  });

  await prisma.workshopProposalSubmission.update({
    where: { id: submission.id },
    data: {
      sourceType: "CUSTOM_DESIGN",
      customWorkshop: payload as unknown as Prisma.InputJsonValue,
      templateId: null,
    },
  });
  revalidateAllWorkshopSurfaces(submission.id);
}

export async function selectWorkshopTemplate(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  await assertApplicantCanWriteSubmission(userId, roles);

  const templateId = getString(formData, "templateId");
  const template = await prisma.workshopProposalTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, status: true },
  });
  if (!template || template.status !== "APPROVED") {
    throw new Error(
      "That workshop is no longer available. Pick a different one from the library."
    );
  }

  const submission = await getOrCreateApplicantSubmission();
  if (!isSubmissionEditable(submission.status)) {
    throw new Error("Submission is locked while review is in progress.");
  }

  await prisma.workshopProposalSubmission.update({
    where: { id: submission.id },
    data: {
      sourceType: "TEMPLATE_SELECTION",
      templateId: template.id,
      customWorkshop: Prisma.JsonNull,
    },
  });
  revalidateAllWorkshopSurfaces(submission.id);
}

export async function saveReflection(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  await assertApplicantCanWriteSubmission(userId, roles);

  const submission = await getOrCreateApplicantSubmission();
  if (!isSubmissionEditable(submission.status)) {
    throw new Error("Submission is locked while review is in progress.");
  }

  const payload = normalizeReflection({
    whyChosen: getString(formData, "whyChosen", false),
    audienceAdaptation: getString(formData, "audienceAdaptation", false),
    hardestPart: getString(formData, "hardestPart", false),
    engagementPlan: getString(formData, "engagementPlan", false),
  });

  await prisma.workshopProposalSubmission.update({
    where: { id: submission.id },
    data: { reflection: payload as unknown as Prisma.InputJsonValue },
  });
  revalidateAllWorkshopSurfaces(submission.id);
}

export async function submitWorkshopProposal() {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  await assertApplicantCanWriteSubmission(userId, roles);

  const submission = await prisma.workshopProposalSubmission.findUnique({
    where: { authorId: userId },
  });
  if (!submission) throw new Error("Nothing to submit yet.");
  if (!isSubmissionEditable(submission.status)) {
    throw new Error("This submission has already been sent — wait for the reviewer.");
  }

  const custom =
    submission.sourceType === "CUSTOM_DESIGN"
      ? normalizeCustomWorkshop(submission.customWorkshop)
      : null;
  const reflection = normalizeReflection(submission.reflection);

  const issues = submissionIssues({
    sourceType: submission.sourceType,
    custom,
    reflection,
    templateId: submission.templateId,
  });
  if (issues.length > 0) {
    throw new Error(
      `Before submitting, finish these items: ${issues.join(" ")}`
    );
  }

  await prisma.workshopProposalSubmission.update({
    where: { id: submission.id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });
  revalidateAllWorkshopSurfaces(submission.id);
}

// ===========================================================================
// REVIEWER — Decisions
// ===========================================================================

export async function startWorkshopReview(formData: FormData) {
  const session = await requireReviewer();
  const submissionId = getString(formData, "submissionId");

  const submission = await prisma.workshopProposalSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, authorId: true },
  });
  if (!submission) throw new Error("Submission not found");
  await assertReviewerCanReviewSubmission(session.user.id, submission.authorId);
  if (!isSubmissionReviewable(submission.status)) {
    throw new Error("This submission isn't open for review.");
  }

  await prisma.workshopProposalSubmission.update({
    where: { id: submissionId },
    data: {
      status: "IN_REVIEW",
      inReviewAt: submission.status === "SUBMITTED" ? new Date() : undefined,
    },
  });
  revalidateAllWorkshopSurfaces(submissionId);
  // We intentionally don't pre-create a draft review row. Reviewers commit
  // a single row per decision, which keeps the audit trail clean: every row
  // in `WorkshopProposalReview` represents a real decision moment, not a
  // page-load side effect.
}

function asRating(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return Math.min(5, Math.max(1, Math.round(value)));
}

export async function commitWorkshopReview(formData: FormData) {
  const session = await requireReviewer();
  const reviewerId = session.user.id;
  const submissionId = getString(formData, "submissionId");

  const recommendationRaw = getString(formData, "overallRecommendation");
  if (!VALID_RECOMMENDATION.has(recommendationRaw as WorkshopProposalReviewRecommendation)) {
    throw new Error("Invalid recommendation");
  }
  const recommendation = recommendationRaw as WorkshopProposalReviewRecommendation;

  const ratings = {
    clarityRating: asRating(getNumber(formData, "clarityRating", 0)),
    engagementRating: asRating(getNumber(formData, "engagementRating", 0)),
    feasibilityRating: asRating(getNumber(formData, "feasibilityRating", 0)),
    ageAppropriatenessRating: asRating(getNumber(formData, "ageAppropriatenessRating", 0)),
    preparednessRating: asRating(getNumber(formData, "preparednessRating", 0)),
    alignmentRating: asRating(getNumber(formData, "alignmentRating", 0)),
  };

  const applicantFeedback = getString(formData, "applicantFeedback", false) || null;
  const internalNote = getString(formData, "internalNote", false) || null;

  const submission = await prisma.workshopProposalSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, status: true, authorId: true },
  });
  if (!submission) throw new Error("Submission not found");
  await assertReviewerCanReviewSubmission(reviewerId, submission.authorId);
  if (!isSubmissionReviewable(submission.status)) {
    throw new Error("This submission isn't open for review.");
  }

  const nextStatus: WorkshopProposalSubmissionStatus =
    recommendation === "APPROVE"
      ? "APPROVED"
      : recommendation === "REQUEST_CHANGES"
        ? "CHANGES_REQUESTED"
        : "REJECTED";

  await prisma.$transaction([
    // Append the committed review row (audit trail).
    prisma.workshopProposalReview.create({
      data: {
        submissionId,
        reviewerId,
        ...ratings,
        overallRecommendation: recommendation,
        applicantFeedback,
        internalNote,
        committed: true,
        committedAt: new Date(),
      },
    }),
    // Update the submission's headline status to match the latest decision.
    prisma.workshopProposalSubmission.update({
      where: { id: submissionId },
      data: {
        status: nextStatus,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        applicantFeedback,
        internalNotes: internalNote,
      },
    }),
  ]);

  revalidateAllWorkshopSurfaces(submissionId);
}
