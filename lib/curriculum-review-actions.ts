"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getClassTemplateCapabilities } from "@/lib/class-template-compat";
import { createOrUpdateStudioLaunchPackage } from "@/lib/curriculum-draft-launch-actions";
import {
  emptyReviewRubric,
  normalizeReviewRubric,
} from "@/lib/curriculum-draft-progress";

async function requireReviewer() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Forbidden");
  }
  return session;
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

function revalidateCurriculumReviewSurfaces() {
  revalidatePath("/admin/curricula");
  revalidatePath("/chapter-lead/instructor-readiness");
  revalidatePath("/admin/instructor-readiness");
  revalidatePath("/instructor/lesson-design-studio");
  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/instructor/workspace");
  revalidatePath("/instructor-training");
  revalidatePath("/student-training");
}

async function approveCurriculumDraftReview(
  draftId: string,
  reviewerId: string,
  reviewNotes: string | null,
  reviewRubric: ReturnType<typeof buildStudioReviewRubric>
) {
  const draft = await prisma.curriculumDraft.findUnique({
    where: { id: draftId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!draft) return false;
  if (draft.status === "REJECTED") {
    throw new Error("Create a working copy before approving a rejected draft.");
  }

  await prisma.curriculumDraft.update({
    where: { id: draftId },
    data: {
      status: "APPROVED",
      reviewNotes,
      reviewRubric: reviewRubric as Prisma.InputJsonValue,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      approvedAt: new Date(),
    },
    select: { id: true },
  });

  await createOrUpdateStudioLaunchPackage({
    draftId,
    reviewerId,
  });

  revalidateCurriculumReviewSurfaces();
  return true;
}

async function requestCurriculumDraftRevision(
  draftId: string,
  reviewerId: string,
  reviewNotes: string,
  reviewRubric: ReturnType<typeof buildStudioReviewRubric>
) {
  const draft = await prisma.curriculumDraft.findUnique({
    where: { id: draftId },
    select: {
      id: true,
      generatedTemplateId: true,
    },
  });

  if (!draft) return false;

  await prisma.curriculumDraft.update({
    where: { id: draftId },
    data: {
      status: "NEEDS_REVISION",
      reviewNotes,
      reviewRubric: reviewRubric as Prisma.InputJsonValue,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      approvedAt: null,
    },
    select: { id: true },
  });

  const capabilities = await getClassTemplateCapabilities();
  if (draft.generatedTemplateId && capabilities.hasReviewWorkflow) {
    await prisma.classTemplate.update({
      where: { id: draft.generatedTemplateId },
      data: {
        submissionStatus: "NEEDS_REVISION",
        reviewedById: reviewerId,
        reviewNotes,
      },
      select: { id: true },
    });
  }

  revalidateCurriculumReviewSurfaces();
  return true;
}

async function syncDraftByTemplateReview(args: {
  templateId: string;
  status: "APPROVED" | "NEEDS_REVISION";
  reviewerId: string;
  reviewNotes: string | null;
  reviewRubric: ReturnType<typeof buildStudioReviewRubric>;
}) {
  const linkedDraft = await prisma.curriculumDraft.findFirst({
    where: { generatedTemplateId: args.templateId },
    select: { id: true },
  });

  if (!linkedDraft) return;

  await prisma.curriculumDraft.update({
    where: { id: linkedDraft.id },
    data: {
      status: args.status,
      reviewNotes: args.reviewNotes,
      reviewRubric: args.reviewRubric as Prisma.InputJsonValue,
      reviewedById: args.reviewerId,
      reviewedAt: new Date(),
      approvedAt: args.status === "APPROVED" ? new Date() : null,
    },
    select: { id: true },
  });
}

export async function approveCurriculum(formData: FormData) {
  const session = await requireReviewer();
  const capabilities = await getClassTemplateCapabilities();
  const id = getString(formData, "id");
  const reviewNotes = getString(formData, "reviewNotes", false) || null;
  const reviewRubric = buildStudioReviewRubric(formData);

  const handledDraft = await approveCurriculumDraftReview(
    id,
    session.user.id,
    reviewNotes,
    reviewRubric
  );
  if (handledDraft) {
    return;
  }

  if (!capabilities.hasReviewWorkflow) {
    throw new Error(
      "Curriculum review will be available after the latest database migration is applied."
    );
  }

  await prisma.classTemplate.update({
    where: { id },
    data: {
      submissionStatus: "APPROVED",
      reviewedById: session.user.id,
      reviewNotes,
    },
    select: { id: true },
  });

  await syncDraftByTemplateReview({
    templateId: id,
    status: "APPROVED",
    reviewerId: session.user.id,
    reviewNotes,
    reviewRubric,
  });

  revalidateCurriculumReviewSurfaces();
}

export async function requestCurriculumRevision(formData: FormData) {
  const session = await requireReviewer();
  const capabilities = await getClassTemplateCapabilities();
  const id = getString(formData, "id");
  const reviewNotes = getString(formData, "reviewNotes");
  const reviewRubric = buildStudioReviewRubric(formData);

  const handledDraft = await requestCurriculumDraftRevision(
    id,
    session.user.id,
    reviewNotes,
    reviewRubric
  );
  if (handledDraft) {
    return;
  }

  if (!capabilities.hasReviewWorkflow) {
    throw new Error(
      "Curriculum review will be available after the latest database migration is applied."
    );
  }

  await prisma.classTemplate.update({
    where: { id },
    data: {
      submissionStatus: "NEEDS_REVISION",
      reviewedById: session.user.id,
      reviewNotes,
    },
    select: { id: true },
  });

  await syncDraftByTemplateReview({
    templateId: id,
    status: "NEEDS_REVISION",
    reviewerId: session.user.id,
    reviewNotes,
    reviewRubric,
  });

  revalidateCurriculumReviewSurfaces();
}
