"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  InstructorApplicationStatus,
  Prisma,
  ProgressStatus,
  StructuredReviewStatus,
} from "@prisma/client";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getHiringActor, isAdmin, isChapterLead, isAssignedInterviewer } from "@/lib/chapter-hiring-permissions";
import {
  approveInstructorApplication,
  holdInstructorApplication,
  markInstructorApplicationUnderReview,
  markInterviewCompleted,
  moveInstructorApplicationToInterviewStage,
  rejectInstructorApplication,
  requestMoreInfo,
  scheduleInterview,
} from "@/lib/instructor-application-actions";
import { maybeAutoAdvanceAfterInterviewReview } from "@/lib/instructor-interview-actions";
import {
  INSTRUCTOR_APPLICATION_NEXT_STEP_OPTIONS,
  INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS,
  INSTRUCTOR_REVIEW_CATEGORIES,
  type InstructorApplicationNextStepValue,
  type InstructorInterviewRecommendationValue,
  type InstructorReviewCategoryValue,
  type ProgressRatingValue,
} from "@/lib/instructor-review-config";
import {
  parseInterviewQuestionResponses,
  validateSubmittedQuestionResponses,
  type LiveQuestionResponsePayload,
} from "@/lib/instructor-interview-live";

type ReviewCategoryPayload = {
  category: InstructorReviewCategoryValue;
  rating?: ProgressRatingValue | null;
  notes?: string | null;
};

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  return getString(formData, key, false) || null;
}

function appendNotice(path: string, notice: string) {
  if (!path) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}notice=${encodeURIComponent(notice)}`;
}

function isFinalApplicationStatus(status: InstructorApplicationStatus) {
  return status === "APPROVED" || status === "REJECTED";
}

function normalizeNullableText(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function parseProgressRating(value: unknown): ProgressStatus | null {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (!PROGRESS_VALUES.has(normalized as ProgressStatus)) {
    throw new Error(`Invalid progress rating: ${normalized}`);
  }
  return normalized as ProgressStatus;
}

function parseApplicationNextStep(value: unknown): InstructorApplicationNextStepValue | null {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (!APPLICATION_NEXT_STEP_VALUES.has(normalized as InstructorApplicationNextStepValue)) {
    throw new Error(`Invalid application next step: ${normalized}`);
  }
  return normalized as InstructorApplicationNextStepValue;
}

function parseInterviewRecommendation(value: unknown): InstructorInterviewRecommendationValue | null {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (!INTERVIEW_RECOMMENDATION_VALUES.has(normalized as InstructorInterviewRecommendationValue)) {
    throw new Error(`Invalid interview recommendation: ${normalized}`);
  }
  return normalized as InstructorInterviewRecommendationValue;
}

function parseCategories(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Category ratings could not be parsed.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Category ratings must be an array.");
  }

  const categories = parsed.map((entry): ReviewCategoryPayload => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Each category rating must be an object.");
    }
    const category = String((entry as { category?: unknown }).category ?? "").trim();
    if (!CATEGORY_VALUE_SET.has(category as InstructorReviewCategoryValue)) {
      throw new Error(`Invalid review category: ${category}`);
    }

    return {
      category: category as InstructorReviewCategoryValue,
      rating: parseProgressRating((entry as { rating?: unknown }).rating) as ProgressRatingValue | null,
      notes: normalizeNullableText(String((entry as { notes?: unknown }).notes ?? "")),
    };
  });

  const uniqueCategories = new Set(categories.map((category) => category.category));
  if (uniqueCategories.size !== categories.length) {
    throw new Error("Duplicate category ratings are not allowed.");
  }

  return categories;
}

const CATEGORY_VALUE_SET = new Set(
  INSTRUCTOR_REVIEW_CATEGORIES.map((category) => category.key)
);
const PROGRESS_VALUES = new Set(
  ["BEHIND_SCHEDULE", "GETTING_STARTED", "ON_TRACK", "ABOVE_AND_BEYOND"] as const
);
const APPLICATION_NEXT_STEP_VALUES = new Set(
  INSTRUCTOR_APPLICATION_NEXT_STEP_OPTIONS.map((option) => option.value)
);
const INTERVIEW_RECOMMENDATION_VALUES = new Set(
  INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS.map((option) => option.value)
);

async function requireReviewSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function loadApplicationForReviewer(applicationId: string) {
  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    include: {
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          chapterId: true,
          chapter: {
            select: { id: true, name: true },
          },
        },
      },
      reviewer: {
        select: { id: true, name: true },
      },
      interviewerAssignments: {
        where: { removedAt: null },
        select: { interviewerId: true, round: true, removedAt: true },
      },
      customResponses: {
        include: {
          field: {
            select: {
              id: true,
              label: true,
              helpText: true,
              placeholder: true,
              sortOrder: true,
            },
          },
        },
        orderBy: [{ field: { sortOrder: "asc" } }],
      },
    },
  });

  if (!application) {
    throw new Error("Instructor application not found.");
  }

  return application;
}

function canReviewFullFlow(actor: Awaited<ReturnType<typeof getHiringActor>>, chapterId: string | null) {
  if (isAdmin(actor)) return true;
  return Boolean(isChapterLead(actor) && actor.chapterId && chapterId && actor.chapterId === chapterId);
}

function canAccessInterviewWorkspace(
  actor: Awaited<ReturnType<typeof getHiringActor>>,
  application: Awaited<ReturnType<typeof loadApplicationForReviewer>>
) {
  if (canReviewFullFlow(actor, application.applicant.chapterId)) return true;
  return isAssignedInterviewer(actor, {
    id: application.id,
    applicantId: application.applicantId,
    reviewerId: application.reviewerId,
    interviewRound: application.interviewRound,
    applicantChapterId: application.applicant.chapterId,
    interviewerAssignments: application.interviewerAssignments,
  });
}

function canSubmitCurrentRoundInterviewReview(
  actor: Awaited<ReturnType<typeof getHiringActor>>,
  application: Awaited<ReturnType<typeof loadApplicationForReviewer>>
) {
  if (isAdmin(actor)) return true;
  return isAssignedInterviewer(actor, {
    id: application.id,
    applicantId: application.applicantId,
    reviewerId: application.reviewerId,
    interviewRound: application.interviewRound,
    applicantChapterId: application.applicant.chapterId,
    interviewerAssignments: application.interviewerAssignments,
  });
}

async function assertApplicationReviewAccess(
  applicationId: string,
  viewerId: string
) {
  const [actor, application] = await Promise.all([
    getHiringActor(viewerId),
    loadApplicationForReviewer(applicationId),
  ]);

  if (!canReviewFullFlow(actor, application.applicant.chapterId)) {
    throw new Error("Unauthorized");
  }

  return { actor, application };
}

async function assertInterviewReviewAccess(
  applicationId: string,
  viewerId: string
) {
  const [actor, application] = await Promise.all([
    getHiringActor(viewerId),
    loadApplicationForReviewer(applicationId),
  ]);

  if (!canAccessInterviewWorkspace(actor, application)) {
    throw new Error("Unauthorized");
  }

  return { actor, application };
}

async function listApplicantCurriculumDrafts(applicantId: string) {
  return prisma.curriculumDraft.findMany({
    where: { authorId: applicantId },
    select: {
      id: true,
      title: true,
      status: true,
      submittedAt: true,
      approvedAt: true,
      updatedAt: true,
      generatedTemplateId: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 6,
  });
}

function isWorkingDraftStatus(status: string) {
  return ["IN_PROGRESS", "COMPLETED", "NEEDS_REVISION"].includes(status);
}

function pickDefaultCurriculumDraftId(
  drafts: Array<{ id: string; status: string }>,
  preferredId?: string | null
) {
  if (preferredId && drafts.some((draft) => draft.id === preferredId)) {
    return preferredId;
  }
  const workingDraft = drafts.find((draft) => isWorkingDraftStatus(draft.status));
  return workingDraft?.id ?? drafts[0]?.id ?? null;
}

async function revalidateInstructorReviewPaths(applicationId: string) {
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath(`/applications/instructor/${applicationId}`);
  revalidatePath(`/applications/instructor/${applicationId}/interview`);
  revalidatePath("/application-status");
}

async function syncLeadFlags(
  tx: Prisma.TransactionClient,
  applicationId: string,
  leadReviewerId: string | null
) {
  await tx.instructorApplicationReview.updateMany({
    where: { applicationId },
    data: { isLeadReview: false },
  });
  await tx.instructorInterviewReview.updateMany({
    where: { applicationId },
    data: { isLeadReview: false },
  });

  if (!leadReviewerId) return;

  await tx.instructorApplicationReview.updateMany({
    where: { applicationId, reviewerId: leadReviewerId },
    data: { isLeadReview: true },
  });
  await tx.instructorInterviewReview.updateMany({
    where: { applicationId, reviewerId: leadReviewerId },
    data: { isLeadReview: true },
  });
}

function validateSubmittedCategories(categories: ReviewCategoryPayload[]) {
  if (categories.length !== INSTRUCTOR_REVIEW_CATEGORIES.length) {
    throw new Error("Every review category must be present before submission.");
  }

  for (const category of INSTRUCTOR_REVIEW_CATEGORIES) {
    const match = categories.find((entry) => entry.category === category.key);
    if (!match || !match.rating) {
      throw new Error(`A rating is required for ${category.label}.`);
    }
    if (!match.notes) {
      throw new Error(`An internal note is required for ${category.label}.`);
    }
  }
}

async function replaceApplicationReviewCategories(
  tx: Prisma.TransactionClient,
  reviewId: string,
  categories: ReviewCategoryPayload[]
) {
  await tx.instructorApplicationReviewCategory.deleteMany({
    where: { reviewId },
  });

  if (categories.length === 0) return;

  await tx.instructorApplicationReviewCategory.createMany({
    data: categories.map((category) => ({
      reviewId,
      category: category.category,
      rating: category.rating ?? null,
      notes: category.notes ?? null,
    })),
  });
}

async function replaceInterviewReviewCategories(
  tx: Prisma.TransactionClient,
  reviewId: string,
  categories: ReviewCategoryPayload[]
) {
  await tx.instructorInterviewReviewCategory.deleteMany({
    where: { reviewId },
  });

  if (categories.length === 0) return;

  await tx.instructorInterviewReviewCategory.createMany({
    data: categories.map((category) => ({
      reviewId,
      category: category.category,
      rating: category.rating ?? null,
      notes: category.notes ?? null,
    })),
  });
}

async function syncInterviewQuestionResponses(
  tx: Prisma.TransactionClient,
  reviewId: string,
  questionResponses: LiveQuestionResponsePayload[]
) {
  const existing = await tx.instructorInterviewQuestionResponse.findMany({
    where: { reviewId },
    select: { id: true, questionBankId: true, source: true },
  });
  const existingById = new Map(existing.map((response) => [response.id, response]));
  const existingByQuestionBankId = new Map(
    existing
      .filter((response) => response.questionBankId)
      .map((response) => [response.questionBankId!, response])
  );
  const keptIds = new Set<string>();

  for (const [index, question] of questionResponses.entries()) {
    const matched =
      (question.id ? existingById.get(question.id) : null) ??
      (question.questionBankId ? existingByQuestionBankId.get(question.questionBankId) : null);
    const normalizedStatus = question.status ?? "UNTOUCHED";
    const askedAt =
      normalizedStatus === "ASKED"
        ? question.askedAt ?? new Date()
        : null;
    const skippedAt =
      normalizedStatus === "SKIPPED"
        ? question.skippedAt ?? new Date()
        : null;
    const data = {
      questionBankId: question.questionBankId ?? null,
      source: question.source === "CUSTOM" ? ("CUSTOM" as const) : ("DEFAULT" as const),
      status: normalizedStatus,
      prompt: question.prompt,
      followUpPrompt: question.followUpPrompt ?? null,
      competency: question.competency ?? null,
      whyAsked: question.whyAsked ?? null,
      notes: question.notes ?? null,
      rating: question.rating ?? null,
      askedAt,
      skippedAt,
      sortOrder: question.sortOrder ?? index,
    };

    if (matched) {
      await tx.instructorInterviewQuestionResponse.update({
        where: { id: matched.id },
        data: {
          ...data,
          tags: { set: question.tags ?? [] },
        },
      });
      keptIds.add(matched.id);
    } else {
      const created = await tx.instructorInterviewQuestionResponse.create({
        data: {
          reviewId,
          ...data,
          tags: question.tags ?? [],
        },
        select: { id: true },
      });
      keptIds.add(created.id);
    }
  }

  await tx.instructorInterviewQuestionResponse.deleteMany({
    where: {
      reviewId,
      id: { notIn: Array.from(keptIds) },
    },
  });
}

function buildReviewNotice(intent: "save" | "submit", reviewType: "application" | "interview") {
  if (intent === "submit") {
    return reviewType === "application"
      ? "application-review-submitted"
      : "interview-review-submitted";
  }

  return reviewType === "application"
    ? "application-review-saved"
    : "interview-review-saved";
}

export async function getInstructorApplicationReviewWorkspace(applicationId: string) {
  const session = await requireReviewSession();
  const { actor, application } = await assertApplicationReviewAccess(applicationId, session.user.id);

  const [drafts, questionlessReviews] = await Promise.all([
    listApplicantCurriculumDrafts(application.applicantId),
    prisma.instructorApplicationReview.findMany({
      where: { applicationId },
      include: {
        reviewer: { select: { id: true, name: true } },
        categories: true,
        curriculumDraft: {
          select: { id: true, title: true, status: true, updatedAt: true },
        },
      },
      orderBy: [{ isLeadReview: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  const myReview =
    questionlessReviews.find((review) => review.reviewerId === session.user.id) ?? null;
  const selectedDraftId = pickDefaultCurriculumDraftId(
    drafts,
    myReview?.curriculumDraftId ?? null
  );

  return {
    actor,
    application,
    drafts,
    selectedDraftId,
    reviews: questionlessReviews,
    myReview,
    isLeadReviewer:
      application.reviewerId === session.user.id ||
      (!application.reviewerId && canReviewFullFlow(actor, application.applicant.chapterId)),
    canEditSubmittedReview: isAdmin(actor),
  };
}

export async function getInstructorInterviewReviewWorkspace(applicationId: string) {
  const session = await requireReviewSession();
  const { actor, application } = await assertInterviewReviewAccess(applicationId, session.user.id);

  if (
    application.status === InstructorApplicationStatus.SUBMITTED ||
    application.status === InstructorApplicationStatus.UNDER_REVIEW ||
    application.status === InstructorApplicationStatus.INFO_REQUESTED
  ) {
    throw new Error("This applicant has not reached the interview workflow yet.");
  }

  const [drafts, reviews, questionBank, applicationReviews] = await Promise.all([
    listApplicantCurriculumDrafts(application.applicantId),
    prisma.instructorInterviewReview.findMany({
      where: { applicationId, round: application.interviewRound },
      include: {
        reviewer: { select: { id: true, name: true } },
        categories: true,
        questionResponses: {
          select: {
            id: true,
            questionBankId: true,
            source: true,
            status: true,
            prompt: true,
            followUpPrompt: true,
            competency: true,
            whyAsked: true,
            notes: true,
            rating: true,
            tags: true,
            askedAt: true,
            skippedAt: true,
            sortOrder: true,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
        curriculumDraft: {
          select: { id: true, title: true, status: true, updatedAt: true },
        },
      },
      orderBy: [{ isLeadReview: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.instructorInterviewQuestionBank.findMany({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        prompt: true,
        helperText: true,
        followUpPrompt: true,
        topic: true,
        competency: true,
        whyItMatters: true,
        interviewerGuidance: true,
        listenFor: true,
        suggestedFollowUps: true,
        strongSignals: true,
        concernSignals: true,
        notePrompts: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.instructorApplicationReview.findMany({
      where: { applicationId, status: StructuredReviewStatus.SUBMITTED },
      include: {
        reviewer: { select: { id: true, name: true } },
        categories: true,
      },
      orderBy: [{ isLeadReview: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  const myReview = reviews.find((review) => review.reviewerId === session.user.id) ?? null;
  const selectedDraftId = pickDefaultCurriculumDraftId(
    drafts,
    myReview?.curriculumDraftId ?? null
  );

  return {
    actor,
    application,
    drafts,
    selectedDraftId,
    reviews,
    myReview,
    questionBank,
    applicationReviews,
    isLeadReviewer:
      application.reviewerId === session.user.id ||
      (!application.reviewerId && canReviewFullFlow(actor, application.applicant.chapterId)),
    canFinalizeRecommendation: canSubmitCurrentRoundInterviewReview(actor, application),
    canEditSubmittedReview: isAdmin(actor),
  };
}

export async function claimInstructorApplicationLeadReviewerAction(formData: FormData) {
  const session = await requireReviewSession();
  const applicationId = getString(formData, "applicationId");
  const returnTo = getString(formData, "returnTo");

  const { actor, application } = await assertApplicationReviewAccess(applicationId, session.user.id);
  if (!canReviewFullFlow(actor, application.applicant.chapterId)) {
    throw new Error("Unauthorized");
  }

  await prisma.$transaction(async (tx) => {
    await tx.instructorApplication.update({
      where: { id: applicationId },
      data: {
        reviewerId: actor.id,
        status:
          application.status === InstructorApplicationStatus.SUBMITTED
            ? InstructorApplicationStatus.UNDER_REVIEW
            : application.status,
      },
    });
    await syncLeadFlags(tx, applicationId, actor.id);
  });

  if (application.status === InstructorApplicationStatus.SUBMITTED) {
    await markInstructorApplicationUnderReview(applicationId, actor.id);
  } else {
    await revalidateInstructorReviewPaths(applicationId);
  }

  redirect(appendNotice(returnTo, "lead-reviewer-claimed"));
}

export async function saveInstructorApplicationReviewAction(formData: FormData) {
  const session = await requireReviewSession();
  const applicationId = getString(formData, "applicationId");
  const returnTo = getString(formData, "returnTo");
  const intent = getString(formData, "intent") === "submit" ? "submit" : "save";
  const overallRating = parseProgressRating(formData.get("overallRating"));
  const nextStep = parseApplicationNextStep(formData.get("nextStep"));
  const categories = parseCategories(getString(formData, "categoriesJson"));
  const summary = normalizeNullableText(getString(formData, "summary", false));
  const notes = normalizeNullableText(getString(formData, "notes", false));
  const concerns = normalizeNullableText(getString(formData, "concerns", false));
  const applicantMessage = normalizeNullableText(getString(formData, "applicantMessage", false));
  const curriculumDraftId = normalizeNullableText(getString(formData, "curriculumDraftId", false));
  const draftOverrideUsed = getString(formData, "draftOverrideUsed", false) === "true";
  const draftOverrideReason = normalizeNullableText(getString(formData, "draftOverrideReason", false));
  const flagForLeadership = getString(formData, "flagForLeadership", false) === "true";

  const { actor, application } = await assertApplicationReviewAccess(applicationId, session.user.id);
  const drafts = await listApplicantCurriculumDrafts(application.applicantId);
  const hasDraft = drafts.length > 0;

  if (isFinalApplicationStatus(application.status) && !isAdmin(actor)) {
    throw new Error("This application is already finalized.");
  }

  let leadReviewerId = application.reviewerId;
  if (!leadReviewerId && canReviewFullFlow(actor, application.applicant.chapterId)) {
    leadReviewerId = actor.id;
    await prisma.instructorApplication.update({
      where: { id: applicationId },
      data: { reviewerId: actor.id },
    });
  }

  const isLeadReviewer = leadReviewerId === actor.id;
  const existingReview = await prisma.instructorApplicationReview.findUnique({
    where: {
      applicationId_reviewerId: {
        applicationId,
        reviewerId: actor.id,
      },
    },
    select: { id: true, status: true },
  });

  if (
    existingReview?.status === StructuredReviewStatus.SUBMITTED &&
    !isAdmin(actor)
  ) {
    throw new Error("Submitted application reviews are locked. Ask an admin to reopen it if changes are needed.");
  }

  const movingToInterviewWithoutDraft = isLeadReviewer && nextStep === "MOVE_TO_INTERVIEW" && !hasDraft;
  const normalizedDraftOverrideUsed = isLeadReviewer
    ? draftOverrideUsed || movingToInterviewWithoutDraft
    : false;
  const normalizedDraftOverrideReason =
    isLeadReviewer && movingToInterviewWithoutDraft
      ? draftOverrideReason ?? "No Lesson Design Studio draft was available during application review."
      : draftOverrideReason;

  if (intent === "submit") {
    validateSubmittedCategories(categories);
    if (!overallRating) {
      throw new Error("An overall application evaluation is required before submission.");
    }
    if (isLeadReviewer && !nextStep) {
      throw new Error("The lead reviewer must choose the application next step before submission.");
    }
    if (isLeadReviewer && (nextStep === "REQUEST_INFO" || nextStep === "REJECT") && !applicantMessage) {
      throw new Error("An applicant-facing message is required for request-info and rejection decisions.");
    }
  }

  if (application.status === InstructorApplicationStatus.SUBMITTED) {
    await markInstructorApplicationUnderReview(applicationId, actor.id);
  }

  await prisma.$transaction(async (tx) => {
    const review = await tx.instructorApplicationReview.upsert({
      where: {
        applicationId_reviewerId: {
          applicationId,
          reviewerId: actor.id,
        },
      },
      create: {
        applicationId,
        reviewerId: actor.id,
        curriculumDraftId: curriculumDraftId ?? pickDefaultCurriculumDraftId(drafts) ?? null,
        status:
          intent === "submit"
            ? StructuredReviewStatus.SUBMITTED
            : StructuredReviewStatus.DRAFT,
        isLeadReview: isLeadReviewer,
        overallRating,
        nextStep: isLeadReviewer ? nextStep : null,
        summary,
        notes,
        concerns,
        applicantMessage,
        flagForLeadership,
        draftOverrideUsed: normalizedDraftOverrideUsed,
        draftOverrideReason: isLeadReviewer ? normalizedDraftOverrideReason : null,
        submittedAt: intent === "submit" ? new Date() : null,
      },
      update: {
        curriculumDraftId: curriculumDraftId ?? pickDefaultCurriculumDraftId(drafts) ?? null,
        status:
          intent === "submit"
            ? StructuredReviewStatus.SUBMITTED
            : StructuredReviewStatus.DRAFT,
        isLeadReview: isLeadReviewer,
        overallRating,
        nextStep: isLeadReviewer ? nextStep : null,
        summary,
        notes,
        concerns,
        applicantMessage,
        flagForLeadership,
        draftOverrideUsed: normalizedDraftOverrideUsed,
        draftOverrideReason: isLeadReviewer ? normalizedDraftOverrideReason : null,
        submittedAt: intent === "submit" ? new Date() : null,
      },
      select: { id: true },
    });

    await replaceApplicationReviewCategories(tx, review.id, categories);
    await syncLeadFlags(tx, applicationId, leadReviewerId ?? null);
  });

  if (intent === "submit" && isLeadReviewer && nextStep) {
    if (nextStep === "MOVE_TO_INTERVIEW") {
      await moveInstructorApplicationToInterviewStage(applicationId, actor.id, summary ?? notes ?? undefined);
    } else if (nextStep === "REQUEST_INFO" && applicantMessage) {
      await requestMoreInfo(applicationId, actor.id, applicantMessage);
    } else if (nextStep === "HOLD") {
      await holdInstructorApplication(applicationId, actor.id, summary ?? concerns ?? notes ?? undefined);
    } else if (nextStep === "REJECT" && applicantMessage) {
      await rejectInstructorApplication(applicationId, actor.id, applicantMessage);
    }
  } else {
    await revalidateInstructorReviewPaths(applicationId);
  }

  redirect(appendNotice(returnTo, buildReviewNotice(intent, "application")));
}

export async function updateInstructorInterviewScheduleAction(formData: FormData) {
  const session = await requireReviewSession();
  const applicationId = getString(formData, "applicationId");
  const returnTo = getString(formData, "returnTo");
  const scheduledAtRaw = getString(formData, "scheduledAt");
  const notes = normalizeNullableText(getString(formData, "scheduleNotes", false));

  const scheduledAt = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Interview schedule must be a valid date and time.");
  }

  const { actor, application } = await assertInterviewReviewAccess(applicationId, session.user.id);
  if (!canReviewFullFlow(actor, application.applicant.chapterId)) {
    throw new Error("Only admins and same-chapter presidents can schedule instructor interviews.");
  }
  if (isFinalApplicationStatus(application.status)) {
    throw new Error("Finalized applications can no longer be rescheduled.");
  }

  await scheduleInterview(applicationId, actor.id, scheduledAt, notes ?? undefined);
  redirect(appendNotice(returnTo, "interview-scheduled"));
}

export async function saveInstructorInterviewLiveDraftAction(input: {
  applicationId?: string;
  categoriesJson?: string;
  questionResponsesJson?: string;
  overallRating?: string | null;
  recommendation?: string | null;
  summary?: string | null;
  overallNotes?: string | null;
  demeanorNotes?: string | null;
  maturityNotes?: string | null;
  communicationNotes?: string | null;
  professionalismNotes?: string | null;
  followUpItems?: string | null;
  curriculumFeedback?: string | null;
  revisionRequirements?: string | null;
  applicantMessage?: string | null;
  curriculumDraftId?: string | null;
  flagForLeadership?: boolean | string | null;
}) {
  try {
    const session = await requireReviewSession();
    const applicationId = normalizeNullableText(input.applicationId ?? "");
    if (!applicationId) {
      throw new Error("Missing required field: applicationId");
    }

    const overallRating = parseProgressRating(input.overallRating);
    const recommendation = parseInterviewRecommendation(input.recommendation);
    const categories = parseCategories(input.categoriesJson ?? "[]");
    const questionResponses = parseInterviewQuestionResponses(input.questionResponsesJson ?? "[]");
    const summary = normalizeNullableText(input.summary);
    const overallNotes = normalizeNullableText(input.overallNotes);
    const demeanorNotes = normalizeNullableText(input.demeanorNotes);
    const maturityNotes = normalizeNullableText(input.maturityNotes);
    const communicationNotes = normalizeNullableText(input.communicationNotes);
    const professionalismNotes = normalizeNullableText(input.professionalismNotes);
    const followUpItems = normalizeNullableText(input.followUpItems);
    const curriculumFeedback = normalizeNullableText(input.curriculumFeedback);
    const revisionRequirements = normalizeNullableText(input.revisionRequirements);
    const applicantMessage = normalizeNullableText(input.applicantMessage);
    const curriculumDraftId = normalizeNullableText(input.curriculumDraftId);
    const flagForLeadership =
      input.flagForLeadership === true || String(input.flagForLeadership ?? "") === "true";

    const { actor, application } = await assertInterviewReviewAccess(applicationId, session.user.id);
    const drafts = await listApplicantCurriculumDrafts(application.applicantId);

    if (!canSubmitCurrentRoundInterviewReview(actor, application)) {
      throw new Error("Only admins or assigned current-round interviewers can save interview notes.");
    }

    if (isFinalApplicationStatus(application.status) && !isAdmin(actor)) {
      throw new Error("This application is already finalized.");
    }

    let leadReviewerId = application.reviewerId;
    if (!leadReviewerId && canReviewFullFlow(actor, application.applicant.chapterId)) {
      leadReviewerId = actor.id;
      await prisma.instructorApplication.update({
        where: { id: applicationId },
        data: { reviewerId: actor.id },
      });
    }

    const isLeadReviewer = leadReviewerId === actor.id;
    const existingReview = await prisma.instructorInterviewReview.findUnique({
      where: {
        applicationId_reviewerId_round: {
          applicationId,
          reviewerId: actor.id,
          round: application.interviewRound,
        },
      },
      select: { id: true, status: true },
    });

    if (
      existingReview?.status === StructuredReviewStatus.SUBMITTED &&
      !isAdmin(actor)
    ) {
      throw new Error("Submitted interview reviews are locked. Ask an admin to reopen it if changes are needed.");
    }

    const savedAt = new Date();
    const review = await prisma.$transaction(async (tx) => {
      const savedReview = await tx.instructorInterviewReview.upsert({
        where: {
          applicationId_reviewerId_round: {
            applicationId,
            reviewerId: actor.id,
            round: application.interviewRound,
          },
        },
        create: {
          applicationId,
          reviewerId: actor.id,
          round: application.interviewRound,
          curriculumDraftId: curriculumDraftId ?? pickDefaultCurriculumDraftId(drafts) ?? null,
          status: StructuredReviewStatus.DRAFT,
          isLeadReview: isLeadReviewer,
          overallRating,
          recommendation,
          summary,
          overallNotes,
          demeanorNotes,
          maturityNotes,
          communicationNotes,
          professionalismNotes,
          followUpItems,
          curriculumFeedback,
          revisionRequirements,
          applicantMessage,
          flagForLeadership,
          submittedAt: null,
        },
        update: {
          curriculumDraftId: curriculumDraftId ?? pickDefaultCurriculumDraftId(drafts) ?? null,
          status: StructuredReviewStatus.DRAFT,
          isLeadReview: isLeadReviewer,
          overallRating,
          recommendation,
          summary,
          overallNotes,
          demeanorNotes,
          maturityNotes,
          communicationNotes,
          professionalismNotes,
          followUpItems,
          curriculumFeedback,
          revisionRequirements,
          applicantMessage,
          flagForLeadership,
          submittedAt: null,
        },
        select: { id: true },
      });

      await replaceInterviewReviewCategories(tx, savedReview.id, categories);
      await syncInterviewQuestionResponses(tx, savedReview.id, questionResponses);
      await syncLeadFlags(tx, applicationId, leadReviewerId ?? null);
      return savedReview;
    });

    return {
      success: true,
      savedAt: savedAt.toISOString(),
      reviewId: review.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Interview draft could not be saved.",
    };
  }
}

export async function saveInstructorInterviewReviewAction(formData: FormData) {
  const session = await requireReviewSession();
  const applicationId = getString(formData, "applicationId");
  const returnTo = getString(formData, "returnTo");
  const intent = getString(formData, "intent") === "submit" ? "submit" : "save";
  const overallRating = parseProgressRating(formData.get("overallRating"));
  const recommendation = parseInterviewRecommendation(formData.get("recommendation"));
  const categories = parseCategories(getString(formData, "categoriesJson"));
  const questionResponses = parseInterviewQuestionResponses(getString(formData, "questionResponsesJson"));
  const summary = normalizeNullableText(getString(formData, "summary", false));
  const overallNotes = normalizeNullableText(getString(formData, "overallNotes", false));
  const demeanorNotes = normalizeNullableText(getString(formData, "demeanorNotes", false));
  const maturityNotes = normalizeNullableText(getString(formData, "maturityNotes", false));
  const communicationNotes = normalizeNullableText(getString(formData, "communicationNotes", false));
  const professionalismNotes = normalizeNullableText(getString(formData, "professionalismNotes", false));
  const followUpItems = normalizeNullableText(getString(formData, "followUpItems", false));
  const curriculumFeedback = normalizeNullableText(getString(formData, "curriculumFeedback", false));
  const revisionRequirements = normalizeNullableText(getString(formData, "revisionRequirements", false));
  const applicantMessage = normalizeNullableText(getString(formData, "applicantMessage", false));
  const curriculumDraftId = normalizeNullableText(getString(formData, "curriculumDraftId", false));
  const flagForLeadership = getString(formData, "flagForLeadership", false) === "true";

  const { actor, application } = await assertInterviewReviewAccess(applicationId, session.user.id);
  const drafts = await listApplicantCurriculumDrafts(application.applicantId);

  if (!canSubmitCurrentRoundInterviewReview(actor, application)) {
    throw new Error("Only admins or assigned current-round interviewers can submit interview reviews.");
  }

  if (isFinalApplicationStatus(application.status) && !isAdmin(actor)) {
    throw new Error("This application is already finalized.");
  }

  let leadReviewerId = application.reviewerId;
  if (!leadReviewerId && canReviewFullFlow(actor, application.applicant.chapterId)) {
    leadReviewerId = actor.id;
    await prisma.instructorApplication.update({
      where: { id: applicationId },
      data: { reviewerId: actor.id },
    });
  }

  const isLeadReviewer = leadReviewerId === actor.id;
  const canFinalizeRecommendation = canSubmitCurrentRoundInterviewReview(actor, application);
  const existingReview = await prisma.instructorInterviewReview.findUnique({
    where: {
      applicationId_reviewerId_round: {
        applicationId,
        reviewerId: actor.id,
        round: application.interviewRound,
      },
    },
    select: { id: true, status: true },
  });

  if (
    existingReview?.status === StructuredReviewStatus.SUBMITTED &&
    !isAdmin(actor)
  ) {
    throw new Error("Submitted interview reviews are locked. Ask an admin to reopen it if changes are needed.");
  }

  if (intent === "submit") {
    validateSubmittedCategories(categories);
    validateSubmittedQuestionResponses(questionResponses);
    if (!overallRating) {
      throw new Error("An overall interview evaluation is required before submission.");
    }
    if (canFinalizeRecommendation && !recommendation) {
      throw new Error("Choose a recommendation before submitting the interview review.");
    }
    if (recommendation === "ACCEPT_WITH_SUPPORT" && !revisionRequirements) {
      throw new Error("Required support notes must be listed for an 'Accept with Support' outcome.");
    }
    if (recommendation === "REJECT" && !applicantMessage) {
      throw new Error("A short applicant-facing rejection reason is required.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const review = await tx.instructorInterviewReview.upsert({
      where: {
        applicationId_reviewerId_round: {
          applicationId,
          reviewerId: actor.id,
          round: application.interviewRound,
        },
      },
      create: {
        applicationId,
        reviewerId: actor.id,
        round: application.interviewRound,
        curriculumDraftId: curriculumDraftId ?? pickDefaultCurriculumDraftId(drafts) ?? null,
        status:
          intent === "submit"
            ? StructuredReviewStatus.SUBMITTED
            : StructuredReviewStatus.DRAFT,
        isLeadReview: isLeadReviewer,
        overallRating,
        recommendation,
        summary,
        overallNotes,
        demeanorNotes,
        maturityNotes,
        communicationNotes,
        professionalismNotes,
        followUpItems,
        curriculumFeedback,
        revisionRequirements,
        applicantMessage,
        flagForLeadership,
        submittedAt: intent === "submit" ? new Date() : null,
      },
      update: {
        curriculumDraftId: curriculumDraftId ?? pickDefaultCurriculumDraftId(drafts) ?? null,
        status:
          intent === "submit"
            ? StructuredReviewStatus.SUBMITTED
            : StructuredReviewStatus.DRAFT,
        isLeadReview: isLeadReviewer,
        overallRating,
        recommendation,
        summary,
        overallNotes,
        demeanorNotes,
        maturityNotes,
        communicationNotes,
        professionalismNotes,
        followUpItems,
        curriculumFeedback,
        revisionRequirements,
        applicantMessage,
        flagForLeadership,
        submittedAt: intent === "submit" ? new Date() : null,
      },
      select: { id: true },
    });

    await replaceInterviewReviewCategories(tx, review.id, categories);
    await syncInterviewQuestionResponses(tx, review.id, questionResponses);
    await syncLeadFlags(tx, applicationId, leadReviewerId ?? null);
  });

  if (intent === "submit") {
    // V1 workflow: if there are active interviewer assignments, use auto-advance
    // (all-reviews-submitted → INTERVIEW_COMPLETED → CHAIR_REVIEW) instead of
    // the old lead-reviewer-decides-directly path.
    const autoAdvanced = await maybeAutoAdvanceAfterInterviewReview(applicationId, actor.id);

    if (!autoAdvanced && isLeadReviewer && canFinalizeRecommendation && recommendation) {
      // Legacy / no-interviewer-assignment path — keep original behavior
      await markInterviewCompleted(applicationId, actor.id, summary ?? overallNotes ?? undefined);

      if (recommendation === "ACCEPT") {
        await approveInstructorApplication(applicationId, actor.id, summary ?? overallNotes ?? undefined);
      } else if (recommendation === "ACCEPT_WITH_SUPPORT") {
        await holdInstructorApplication(
          applicationId,
          actor.id,
          revisionRequirements ?? curriculumFeedback ?? summary ?? overallNotes ?? undefined
        );
      } else if (recommendation === "HOLD") {
        await holdInstructorApplication(
          applicationId,
          actor.id,
          summary ?? overallNotes ?? curriculumFeedback ?? undefined
        );
      } else if (recommendation === "REJECT") {
        await rejectInstructorApplication(
          applicationId,
          actor.id,
          applicantMessage ?? summary ?? "The interview review did not result in approval."
        );
      }
    } else if (!autoAdvanced) {
      await revalidateInstructorReviewPaths(applicationId);
    }
  } else {
    await revalidateInstructorReviewPaths(applicationId);
  }

  redirect(appendNotice(returnTo, buildReviewNotice(intent, "interview")));
}
