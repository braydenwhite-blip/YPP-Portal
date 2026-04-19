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
import { getHiringActor, isAdmin, isChapterLead, isDesignatedInterviewer } from "@/lib/chapter-hiring-permissions";
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
import {
  INSTRUCTOR_APPLICATION_NEXT_STEP_OPTIONS,
  INSTRUCTOR_INTERVIEW_RECOMMENDATION_OPTIONS,
  INSTRUCTOR_REVIEW_CATEGORIES,
  type InstructorApplicationNextStepValue,
  type InstructorInterviewRecommendationValue,
  type InstructorReviewCategoryValue,
  type ProgressRatingValue,
} from "@/lib/instructor-review-config";

type ReviewCategoryPayload = {
  category: InstructorReviewCategoryValue;
  rating?: ProgressRatingValue | null;
  notes?: string | null;
};

type QuestionResponsePayload = {
  questionBankId?: string | null;
  source?: "DEFAULT" | "CUSTOM";
  prompt?: string | null;
  followUpPrompt?: string | null;
  notes?: string | null;
  sortOrder?: number | null;
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

function parseQuestionResponses(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Interview question responses could not be parsed.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Interview question responses must be an array.");
  }

  return parsed.map((entry, index): QuestionResponsePayload => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Each interview question response must be an object.");
    }
    const prompt = normalizeNullableText(String((entry as { prompt?: unknown }).prompt ?? ""));
    const sourceRaw = String((entry as { source?: unknown }).source ?? "DEFAULT").trim();
    const source = sourceRaw === "CUSTOM" ? "CUSTOM" : "DEFAULT";

    if (!prompt) {
      throw new Error("Every interview question must have a prompt.");
    }

    const sortOrderValue = Number((entry as { sortOrder?: unknown }).sortOrder ?? index);
    return {
      questionBankId: normalizeNullableText(
        String((entry as { questionBankId?: unknown }).questionBankId ?? "")
      ),
      source,
      prompt,
      followUpPrompt: normalizeNullableText(
        String((entry as { followUpPrompt?: unknown }).followUpPrompt ?? "")
      ),
      notes: normalizeNullableText(String((entry as { notes?: unknown }).notes ?? "")),
      sortOrder: Number.isFinite(sortOrderValue) ? sortOrderValue : index,
    };
  });
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

function canReviewInterviewFlow(actor: Awaited<ReturnType<typeof getHiringActor>>, chapterId: string | null) {
  if (canReviewFullFlow(actor, chapterId)) return true;
  return Boolean(
    isDesignatedInterviewer(actor) &&
      actor.chapterId &&
      chapterId &&
      actor.chapterId === chapterId
  );
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

  if (!canReviewInterviewFlow(actor, application.applicant.chapterId)) {
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
  }
}

function validateSubmittedQuestions(questionResponses: QuestionResponsePayload[]) {
  if (questionResponses.length === 0) {
    throw new Error("Interview questions are required before submission.");
  }

  for (const question of questionResponses) {
    if (!question.prompt) {
      throw new Error("Every interview question must include a prompt.");
    }
    if (!question.notes) {
      throw new Error("Every interview question must include interviewer notes before submission.");
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

async function replaceInterviewQuestionResponses(
  tx: Prisma.TransactionClient,
  reviewId: string,
  questionResponses: QuestionResponsePayload[]
) {
  await tx.instructorInterviewQuestionResponse.deleteMany({
    where: { reviewId },
  });

  if (questionResponses.length === 0) return;

  await tx.instructorInterviewQuestionResponse.createMany({
    data: questionResponses.map((question, index) => ({
      reviewId,
      questionBankId: question.questionBankId ?? null,
      source: question.source === "CUSTOM" ? "CUSTOM" : "DEFAULT",
      prompt: question.prompt ?? "",
      followUpPrompt: question.followUpPrompt ?? null,
      notes: question.notes ?? null,
      sortOrder: question.sortOrder ?? index,
    })),
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
      where: { applicationId },
      include: {
        reviewer: { select: { id: true, name: true } },
        categories: true,
        questionResponses: {
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
    canFinalizeRecommendation: canReviewFullFlow(actor, application.applicant.chapterId),
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
    if (isLeadReviewer && nextStep === "MOVE_TO_INTERVIEW" && !hasDraft) {
      if (!isAdmin(actor) || !draftOverrideUsed || !draftOverrideReason) {
        throw new Error("A Lesson Design Studio draft is required before moving to interview unless an admin uses the override with a reason.");
      }
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
        draftOverrideUsed: isLeadReviewer ? draftOverrideUsed : false,
        draftOverrideReason: isLeadReviewer ? draftOverrideReason : null,
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
        draftOverrideUsed: isLeadReviewer ? draftOverrideUsed : false,
        draftOverrideReason: isLeadReviewer ? draftOverrideReason : null,
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

export async function saveInstructorInterviewReviewAction(formData: FormData) {
  const session = await requireReviewSession();
  const applicationId = getString(formData, "applicationId");
  const returnTo = getString(formData, "returnTo");
  const intent = getString(formData, "intent") === "submit" ? "submit" : "save";
  const overallRating = parseProgressRating(formData.get("overallRating"));
  const recommendation = parseInterviewRecommendation(formData.get("recommendation"));
  const categories = parseCategories(getString(formData, "categoriesJson"));
  const questionResponses = parseQuestionResponses(getString(formData, "questionResponsesJson"));
  const summary = normalizeNullableText(getString(formData, "summary", false));
  const overallNotes = normalizeNullableText(getString(formData, "overallNotes", false));
  const curriculumFeedback = normalizeNullableText(getString(formData, "curriculumFeedback", false));
  const revisionRequirements = normalizeNullableText(getString(formData, "revisionRequirements", false));
  const applicantMessage = normalizeNullableText(getString(formData, "applicantMessage", false));
  const curriculumDraftId = normalizeNullableText(getString(formData, "curriculumDraftId", false));
  const flagForLeadership = getString(formData, "flagForLeadership", false) === "true";

  const { actor, application } = await assertInterviewReviewAccess(applicationId, session.user.id);
  const drafts = await listApplicantCurriculumDrafts(application.applicantId);

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
  const canFinalizeRecommendation = canReviewFullFlow(actor, application.applicant.chapterId);
  const existingReview = await prisma.instructorInterviewReview.findUnique({
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
    throw new Error("Submitted interview reviews are locked. Ask an admin to reopen it if changes are needed.");
  }

  if (intent === "submit") {
    validateSubmittedCategories(categories);
    validateSubmittedQuestions(questionResponses);
    if (!overallRating) {
      throw new Error("An overall interview evaluation is required before submission.");
    }
    if (isLeadReviewer && canFinalizeRecommendation && !recommendation) {
      throw new Error("The lead reviewer must choose a final recommendation before submitting the interview review.");
    }
    if (isLeadReviewer && recommendation === "ACCEPT_WITH_SUPPORT" && !revisionRequirements) {
      throw new Error("Required support notes must be listed for an 'Accept with Support' outcome.");
    }
    if (isLeadReviewer && recommendation === "REJECT" && !applicantMessage) {
      throw new Error("A short applicant-facing rejection reason is required.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const review = await tx.instructorInterviewReview.upsert({
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
        recommendation: isLeadReviewer ? recommendation : null,
        summary,
        overallNotes,
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
        recommendation: isLeadReviewer ? recommendation : null,
        summary,
        overallNotes,
        curriculumFeedback,
        revisionRequirements,
        applicantMessage,
        flagForLeadership,
        submittedAt: intent === "submit" ? new Date() : null,
      },
      select: { id: true },
    });

    await replaceInterviewReviewCategories(tx, review.id, categories);
    await replaceInterviewQuestionResponses(tx, review.id, questionResponses);
    await syncLeadFlags(tx, applicationId, leadReviewerId ?? null);
  });

  if (intent === "submit" && isLeadReviewer && canFinalizeRecommendation && recommendation) {
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
  } else {
    await revalidateInstructorReviewPaths(applicationId);
  }

  redirect(appendNotice(returnTo, buildReviewNotice(intent, "interview")));
}
