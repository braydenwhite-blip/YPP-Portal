"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSessionUser } from "@/lib/authorization";
import {
  withReviewDocumentTitle,
} from "@/lib/mentorship/review-document-meta";
import { prisma } from "@/lib/prisma";

function monthStartFromKey(monthKey: string): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) throw new Error("Pick a valid month.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("Pick a valid month.");
  return new Date(Date.UTC(year, month - 1, 1));
}

function defaultTitleForMonth(cycleMonth: Date): string {
  const label = cycleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${label} Performance Review`;
}

async function assertCanComposeReview(
  mentorshipId: string,
  viewerId: string,
  roles: string[],
) {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: {
      id: true,
      status: true,
      mentorId: true,
      menteeId: true,
    },
  });
  if (!mentorship || mentorship.status !== "ACTIVE") {
    throw new Error("Active mentorship not found.");
  }
  const isAdmin = roles.includes("ADMIN");
  if (mentorship.mentorId !== viewerId && !isAdmin) {
    throw new Error("Only the assigned mentor can create a review document.");
  }
  return mentorship;
}

const CreateSchema = z.object({
  mentorshipId: z.string().min(1),
  menteeId: z.string().min(1),
  title: z.string().trim().min(1, "Add a title.").max(120),
  /** YYYY-MM */
  monthKey: z.string().regex(/^\d{4}-\d{2}$/, "Pick a month."),
});

/**
 * Creates a blank draft performance review document (stub reflection + DRAFT
 * MentorGoalReview) so it appears in Reviews & Documents and can be opened
 * on the Review tab.
 */
export async function createPerformanceReviewDocument(input: unknown) {
  const viewer = await requireSessionUser();
  const data = CreateSchema.parse(input);
  const mentorship = await assertCanComposeReview(
    data.mentorshipId,
    viewer.id,
    viewer.roles ?? [],
  );
  if (mentorship.menteeId !== data.menteeId) {
    throw new Error("Mentee does not match this mentorship.");
  }

  const cycleMonth = monthStartFromKey(data.monthKey);
  const title = data.title.trim() || defaultTitleForMonth(cycleMonth);
  const quarterly = [2, 5, 8, 11].includes(cycleMonth.getUTCMonth());

  const last = await prisma.monthlySelfReflection.findFirst({
    where: { mentorshipId: mentorship.id },
    orderBy: { cycleNumber: "desc" },
    select: { cycleNumber: true },
  });
  const cycleNumber = (last?.cycleNumber ?? 0) + 1;
  const stubNote =
    "(Draft performance review — mentee reflection was not submitted for this document.)";

  const review = await prisma.$transaction(async (tx) => {
    const reflection = await tx.monthlySelfReflection.create({
      data: {
        menteeId: mentorship.menteeId,
        mentorshipId: mentorship.id,
        cycleMonth,
        cycleNumber,
        overallReflection: stubNote,
        engagementOverall: stubNote,
        workingWell: stubNote,
        supportNeeded: stubNote,
        mentorHelpfulness: stubNote,
        collaborationAssessment: stubNote,
      },
      select: { id: true },
    });

    return tx.mentorGoalReview.create({
      data: {
        mentorId: viewer.id,
        menteeId: mentorship.menteeId,
        mentorshipId: mentorship.id,
        selfReflectionId: reflection.id,
        cycleMonth,
        cycleNumber,
        isQuarterly: quarterly,
        overallRating: "ACHIEVED",
        overallComments: "",
        planOfAction: "",
        status: "DRAFT",
        nextMonthGoalDraftsJson: withReviewDocumentTitle(null, title),
      },
      select: { id: true },
    });
  });

  revalidatePath(`/mentorship/people/${mentorship.menteeId}`);
  revalidatePath(`/people/${mentorship.menteeId}`);
  return { ok: true as const, reviewId: review.id };
}

const UpdateMetaSchema = z.object({
  reviewId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
});

/** Edit title + cycle month on an existing draft/in-progress review document. */
export async function updatePerformanceReviewDocumentMeta(input: unknown) {
  const viewer = await requireSessionUser();
  const data = UpdateMetaSchema.parse(input);

  const review = await prisma.mentorGoalReview.findUnique({
    where: { id: data.reviewId },
    select: {
      id: true,
      mentorshipId: true,
      menteeId: true,
      selfReflectionId: true,
      status: true,
      nextMonthGoalDraftsJson: true,
      mentorship: { select: { mentorId: true, status: true } },
    },
  });
  if (!review || review.mentorship.status !== "ACTIVE") {
    throw new Error("Review not found.");
  }
  const isAdmin = (viewer.roles ?? []).includes("ADMIN");
  if (review.mentorship.mentorId !== viewer.id && !isAdmin) {
    throw new Error("Only the assigned mentor can edit this document.");
  }
  if (review.status === "APPROVED") {
    throw new Error("Released reviews keep their original period.");
  }

  const cycleMonth = monthStartFromKey(data.monthKey);
  const quarterly = [2, 5, 8, 11].includes(cycleMonth.getUTCMonth());

  await prisma.$transaction([
    prisma.mentorGoalReview.update({
      where: { id: review.id },
      data: {
        cycleMonth,
        isQuarterly: quarterly,
        nextMonthGoalDraftsJson: withReviewDocumentTitle(
          review.nextMonthGoalDraftsJson,
          data.title.trim(),
        ),
      },
    }),
    prisma.monthlySelfReflection.update({
      where: { id: review.selfReflectionId },
      data: { cycleMonth },
    }),
  ]);

  revalidatePath(`/mentorship/people/${review.menteeId}`);
  return { ok: true as const };
}
