"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireApplicationReviewerPage } from "@/lib/page-guards";
import {
  assertCanViewApplicant,
  getHiringActor,
  isAdmin,
  isHiringChair,
} from "@/lib/chapter-hiring-permissions";
import { OPERATING_CHAPTER_NAMES } from "@/lib/chapters/operating";

function getString(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function getOptionalChapterId(formData: FormData): string | null {
  const value = String(formData.get("chapterId") ?? "").trim();
  return value || null;
}

async function assertAllowedChapterChoice(
  actor: Awaited<ReturnType<typeof getHiringActor>>,
  chapterId: string | null
) {
  if (!chapterId) return;

  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      archivedAt: null,
      name: { in: [...OPERATING_CHAPTER_NAMES] },
    },
    select: { id: true },
  });
  if (!chapter) {
    throw new Error("Choose a valid chapter/location (The Bronx or Scarsdale).");
  }

  const networkScope = isAdmin(actor) || isHiringChair(actor);
  if (!networkScope && actor.chapterId && chapterId !== actor.chapterId) {
    throw new Error("You can only assign applicants to your own chapter.");
  }
}

/**
 * Set / clear an instructor applicant's chapter (user.chapterId).
 */
export async function updateInstructorApplicantChapter(formData: FormData) {
  const sessionUser = await requireApplicationReviewerPage();
  const actor = await getHiringActor(sessionUser.id);
  const applicationId = getString(formData, "applicationId");
  const chapterId = getOptionalChapterId(formData);

  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      applicantId: true,
      reviewerId: true,
      interviewRound: true,
      applicant: { select: { chapterId: true } },
      interviewerAssignments: {
        select: { interviewerId: true, round: true, removedAt: true },
      },
    },
  });
  if (!application) throw new Error("Application not found.");

  assertCanViewApplicant(actor, {
    id: application.id,
    applicantId: application.applicantId,
    reviewerId: application.reviewerId,
    interviewRound: application.interviewRound,
    applicantChapterId: application.applicant.chapterId,
    interviewerAssignments: application.interviewerAssignments,
  });

  await assertAllowedChapterChoice(actor, chapterId);

  await prisma.user.update({
    where: { id: application.applicantId },
    data: { chapterId },
  });

  revalidatePath(`/admin/instructor-applicants/${applicationId}`);
  revalidatePath("/admin/instructor-applicants");
}

/**
 * Set / clear a CP application's chapter (and mirror onto the applicant user).
 */
export async function updateChapterPresidentApplicantChapter(formData: FormData) {
  const sessionUser = await requireApplicationReviewerPage();
  const actor = await getHiringActor(sessionUser.id);
  const applicationId = getString(formData, "applicationId");
  const chapterId = getOptionalChapterId(formData);

  const application = await prisma.chapterPresidentApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, applicantId: true },
  });
  if (!application) throw new Error("Application not found.");

  const networkScope = isAdmin(actor) || isHiringChair(actor);
  if (!networkScope) {
    throw new Error("Only admins and hiring chairs can change CP chapter assignment.");
  }

  await assertAllowedChapterChoice(actor, chapterId);

  await prisma.$transaction([
    prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: { chapterId },
    }),
    prisma.user.update({
      where: { id: application.applicantId },
      data: { chapterId },
    }),
  ]);

  revalidatePath(`/admin/chapter-president-applicants/${applicationId}`);
  revalidatePath("/admin/chapter-president-applicants");
  revalidatePath("/admin/instructor-applicants");
}
