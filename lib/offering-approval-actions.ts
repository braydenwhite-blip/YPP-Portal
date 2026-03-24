"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInstructorReadiness } from "@/lib/instructor-readiness";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireReviewer() {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function getOfferingForApproval(offeringId: string) {
  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    select: {
      id: true,
      title: true,
      instructorId: true,
      status: true,
      chapterId: true,
      grandfatheredTrainingExemption: true,
    },
  });

  if (!offering) {
    throw new Error("Offering not found");
  }

  return offering;
}

async function assertReviewerCanManageOffering(reviewerId: string, offeringId: string) {
  const [reviewer, offering] = await Promise.all([
    prisma.user.findUnique({
      where: { id: reviewerId },
      select: {
        chapterId: true,
        roles: { select: { role: true } },
      },
    }),
    prisma.classOffering.findUnique({
      where: { id: offeringId },
      select: {
        chapterId: true,
        instructor: {
          select: {
            chapterId: true,
          },
        },
      },
    }),
  ]);

  if (!reviewer || !offering) {
    throw new Error("Reviewer or offering not found");
  }

  const reviewerRoles = reviewer.roles.map((role) => role.role);
  const isAdmin = reviewerRoles.includes("ADMIN");
  const isChapterPresident = reviewerRoles.includes("CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterPresident) {
    throw new Error("Unauthorized");
  }

  if (!isAdmin) {
    const reviewerChapterId = reviewer.chapterId;
    const targetChapterId = offering.chapterId || offering.instructor.chapterId;
    if (!reviewerChapterId || !targetChapterId || reviewerChapterId !== targetChapterId) {
      throw new Error("Chapter Presidents can only review offerings in their own chapter.");
    }
  }
}

function revalidateOfferingApprovalSurfaces(offeringId: string) {
  revalidatePath("/instructor-training");
  revalidatePath("/instructor/class-settings");
  revalidatePath(`/instructor/class-settings?offering=${offeringId}`);
  revalidatePath("/admin/instructor-readiness");
  revalidatePath("/chapter-lead/instructor-readiness");
  revalidatePath(`/curriculum/${offeringId}`);
}

export async function requestOfferingApproval(formData: FormData) {
  const session = await requireSession();
  const offeringId = String(formData.get("offeringId") || "");
  const requestNotes = String(formData.get("requestNotes") || "").trim();

  if (!offeringId) {
    throw new Error("Offering is required");
  }

  const offering = await getOfferingForApproval(offeringId);
  const roles = session.user.roles ?? [];
  if (offering.instructorId !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }

  if (offering.grandfatheredTrainingExemption) {
    throw new Error("Legacy grandfathered offerings do not require an approval request.");
  }

  const readiness = await getInstructorReadiness(offering.instructorId);
  if (!readiness.canRequestOfferingApproval) {
    throw new Error(
      "You need to finish required training and pass the interview before requesting offering approval."
    );
  }

  await prisma.classOfferingApproval.upsert({
    where: { offeringId },
    create: {
      offeringId,
      status: "REQUESTED",
      requestedById: session.user.id,
      requestNotes: requestNotes || null,
      requestedAt: new Date(),
    },
    update: {
      status: "REQUESTED",
      requestedById: session.user.id,
      requestNotes: requestNotes || null,
      requestedAt: new Date(),
      reviewedById: null,
      reviewNotes: null,
      reviewedAt: null,
    },
  });

  revalidateOfferingApprovalSurfaces(offeringId);
}

export async function approveOfferingApproval(formData: FormData) {
  const session = await requireReviewer();
  const offeringId = String(formData.get("offeringId") || "");
  const reviewNotes = String(formData.get("reviewNotes") || "").trim();

  if (!offeringId) {
    throw new Error("Offering is required");
  }

  await assertReviewerCanManageOffering(session.user.id, offeringId);

  const offering = await getOfferingForApproval(offeringId);
  const readiness = await getInstructorReadiness(offering.instructorId);
  if (!readiness.baseReadinessComplete) {
    throw new Error(
      "Cannot approve offering before required training is complete and the interview is passed or waived."
    );
  }

  await prisma.classOfferingApproval.upsert({
    where: { offeringId },
    create: {
      offeringId,
      status: "APPROVED",
      reviewedById: session.user.id,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
      requestedAt: new Date(),
    },
    update: {
      status: "APPROVED",
      reviewedById: session.user.id,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
    },
  });

  revalidateOfferingApprovalSurfaces(offeringId);
}

export async function requestOfferingApprovalRevision(formData: FormData) {
  const session = await requireReviewer();
  const offeringId = String(formData.get("offeringId") || "");
  const reviewNotes = String(formData.get("reviewNotes") || "").trim();
  const statusRaw = String(formData.get("status") || "CHANGES_REQUESTED");

  if (!offeringId) {
    throw new Error("Offering is required");
  }

  if (!["CHANGES_REQUESTED", "REJECTED"].includes(statusRaw)) {
    throw new Error("Invalid approval status");
  }

  await assertReviewerCanManageOffering(session.user.id, offeringId);

  await prisma.classOfferingApproval.upsert({
    where: { offeringId },
    create: {
      offeringId,
      status: statusRaw as "CHANGES_REQUESTED" | "REJECTED",
      reviewedById: session.user.id,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
      requestedAt: new Date(),
    },
    update: {
      status: statusRaw as "CHANGES_REQUESTED" | "REJECTED",
      reviewedById: session.user.id,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
    },
  });

  revalidateOfferingApprovalSurfaces(offeringId);
}

export async function rejectOfferingApproval(formData: FormData) {
  const forwarded = new FormData();
  forwarded.set("offeringId", String(formData.get("offeringId") || ""));
  forwarded.set("reviewNotes", String(formData.get("reviewNotes") || ""));
  forwarded.set("status", "REJECTED");
  return requestOfferingApprovalRevision(forwarded);
}
