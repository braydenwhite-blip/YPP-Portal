"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { ChapterPresidentApplicationStatus } from "@prisma/client";
import { sendAvailabilityRequestEmail } from "@/lib/email";

export async function updateCPApplicationStage(
  applicationId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    const roles = session.user.roles ?? [];
    if (!roles.includes("ADMIN")) {
      return { success: false, error: "Unauthorized - Admin access required" };
    }

    const validStatuses = Object.values(ChapterPresidentApplicationStatus);
    if (!validStatuses.includes(newStatus as ChapterPresidentApplicationStatus)) {
      return { success: false, error: "Invalid status." };
    }

    const application = await prisma.chapterPresidentApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) return { success: false, error: "Application not found." };

    const data: Record<string, unknown> = {
      status: newStatus as ChapterPresidentApplicationStatus,
      reviewerId: session.user.id,
    };
    if (newStatus === "APPROVED") {
      data.approvedAt = new Date();
    }
    if (newStatus === "REJECTED") {
      data.rejectedAt = new Date();
    }

    const updated = await prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data,
      include: { applicant: { select: { name: true, email: true } } },
    });

    // When moved to INTERVIEW_SCHEDULED, prompt applicant to submit availability windows
    if (newStatus === "INTERVIEW_SCHEDULED") {
      const { getBaseUrl } = await import("@/lib/portal-auth-utils");
      const baseUrl = getBaseUrl();
      sendAvailabilityRequestEmail({
        to: updated.applicant.email,
        applicantName: updated.applicant.name,
        statusUrl: `${baseUrl}/application-status`,
        variant: "cp",
      }).catch((e) => console.error("[updateCPApplicationStage] availability email failed:", e));
    }

    revalidatePath("/admin/chapter-president-applicants");
    return { success: true };
  } catch (error) {
    console.error("[updateCPApplicationStage]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }
  return session;
}

export async function saveCPScoresAndNotes(
  applicationId: string,
  data: {
    scoreLeadership?: number | null;
    scoreVision?: number | null;
    scoreOrganization?: number | null;
    scoreCommitment?: number | null;
    scoreFit?: number | null;
    scoreCommunication?: number | null;
    interviewSummary?: string;
    reviewerNotes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: {
        scoreLeadership: data.scoreLeadership,
        scoreVision: data.scoreVision,
        scoreOrganization: data.scoreOrganization,
        scoreCommitment: data.scoreCommitment,
        scoreFit: data.scoreFit,
        scoreCommunication: data.scoreCommunication,
        interviewSummary: data.interviewSummary || null,
        reviewerNotes: data.reviewerNotes,
      },
    });
    revalidatePath("/admin/chapter-president-applicants");
    return { success: true };
  } catch (error) {
    console.error("[saveCPScoresAndNotes]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function assignCPReviewer(
  applicationId: string,
  reviewerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: { reviewerId },
    });
    revalidatePath("/admin/chapter-president-applicants");
    return { success: true };
  } catch (error) {
    console.error("[assignCPReviewer]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

