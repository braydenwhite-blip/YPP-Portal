"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { RoleType, InstructorApplicationStatus, ApprovalStatus } from "@prisma/client";
import {
  sendNewApplicationNotification,
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
  sendInfoRequestEmail,
  sendInterviewScheduledEmail,
} from "@/lib/email";
import {
  getLegacyApplicationTransitionError,
  type LegacyApplicationReviewAction,
} from "@/lib/legacy-application-review";

type FormState = {
  status: "idle" | "error" | "success";
  message: string;
};

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value ? String(value).trim() : "";
}

async function requireAdminOrChapterLead() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_LEAD")) {
    throw new Error("Unauthorized - Admin or Chapter Lead access required");
  }
  return session;
}

async function assertReviewerCanManageApplicant(reviewerId: string, applicantId: string) {
  const [reviewer, applicant] = await Promise.all([
    prisma.user.findUnique({
      where: { id: reviewerId },
      select: { chapterId: true, roles: { select: { role: true } } },
    }),
    prisma.user.findUnique({
      where: { id: applicantId },
      select: { chapterId: true },
    }),
  ]);
  if (!reviewer || !applicant) throw new Error("Reviewer or applicant not found");
  const reviewerRoles = reviewer.roles.map((r) => r.role);
  const isAdmin = reviewerRoles.includes("ADMIN");
  const isChapterLead = reviewerRoles.includes("CHAPTER_LEAD");
  if (!isAdmin && !isChapterLead) throw new Error("Unauthorized");
  if (isChapterLead && !isAdmin && reviewer.chapterId !== applicant.chapterId) {
    throw new Error("Chapter Leads can only review applicants in their own chapter.");
  }
}

export async function notifyReviewersOfNewApplication(applicantId: string) {
  const applicant = await prisma.user.findUnique({
    where: { id: applicantId },
    select: { name: true, email: true, chapterId: true },
  });
  if (!applicant) return;
  const reviewers = await prisma.user.findMany({
    where: {
      OR: [
        { roles: { some: { role: RoleType.ADMIN } } },
        {
          roles: { some: { role: RoleType.CHAPTER_LEAD } },
          chapterId: applicant.chapterId ?? undefined,
        },
      ],
    },
    select: { email: true },
  });
  const emails = reviewers.map((r) => r.email).filter(Boolean) as string[];
  if (!emails.length) return;
  const baseUrl = process.env.NEXTAUTH_URL || "https://portal.youthpassionproject.org";
  await sendNewApplicationNotification({
    to: emails,
    applicantName: applicant.name,
    reviewUrl: `${baseUrl}/admin/instructor-applicants`,
  });
}

export async function reviewInstructorApplication(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const session = await requireAdminOrChapterLead();
    const action = getString(formData, "action");
    const applicationId = getString(formData, "applicationId");

    const application = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      include: { applicant: { select: { id: true, name: true, email: true } } },
    });
    if (!application) return { status: "error", message: "Application not found." };
    await assertReviewerCanManageApplicant(session.user.id, application.applicantId);

    const reviewAction = action as LegacyApplicationReviewAction;
    const transitionError = getLegacyApplicationTransitionError({
      status: application.status,
      action: reviewAction,
    });
    if (transitionError) {
      return { status: "error", message: transitionError };
    }

    switch (reviewAction) {
      case "mark_under_review":
        await prisma.instructorApplication.update({
          where: { id: applicationId },
          data: { status: InstructorApplicationStatus.UNDER_REVIEW, reviewerId: session.user.id },
        });
        revalidatePath("/admin/instructor-applicants");
        revalidatePath("/chapter-lead/instructor-applicants");
        revalidatePath("/application-status");
        return { status: "success", message: "Application marked as under review." };

      case "approve": {
        const notes = getString(formData, "notes", false);
        await approveInstructorApplication(applicationId, session.user.id, notes || undefined);
        return { status: "success", message: "Application approved. Applicant is now an instructor." };
      }

      case "reject": {
        const reason = getString(formData, "reason");
        await rejectInstructorApplication(applicationId, session.user.id, reason);
        return { status: "success", message: "Application rejected." };
      }

      case "request_info": {
        const message = getString(formData, "message");
        await requestMoreInfo(applicationId, session.user.id, message);
        return { status: "success", message: "Information request sent to applicant." };
      }

      case "schedule_interview": {
        const dateStr = getString(formData, "scheduledAt");
        const scheduledAt = new Date(dateStr);
        if (isNaN(scheduledAt.getTime())) {
          return { status: "error", message: "Invalid interview date/time." };
        }
        const notes = getString(formData, "notes", false);
        await scheduleInterview(applicationId, session.user.id, scheduledAt, notes || undefined);
        return { status: "success", message: "Interview scheduled and applicant notified." };
      }

      case "mark_interview_complete": {
        const notes = getString(formData, "notes", false);
        await markInterviewCompleted(applicationId, session.user.id, notes || undefined);
        return { status: "success", message: "Interview marked as completed." };
      }

      default:
        return { status: "error", message: "Unknown action." };
    }
  } catch (error) {
    console.error("[reviewInstructorApplication]", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

async function approveInstructorApplication(
  applicationId: string,
  reviewerId: string,
  notes?: string
) {
  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    include: { applicant: { select: { id: true, name: true, email: true } } },
  });
  if (!application) throw new Error("Application not found");

  await prisma.$transaction(async (tx) => {
    await tx.instructorApplication.update({
      where: { id: applicationId },
      data: {
        status: InstructorApplicationStatus.APPROVED,
        reviewerId,
        reviewerNotes: notes ?? null,
        approvedAt: new Date(),
      },
    });
    await tx.user.update({
      where: { id: application.applicantId },
      data: { primaryRole: RoleType.INSTRUCTOR },
    });
    await tx.userRole.upsert({
      where: { userId_role: { userId: application.applicantId, role: RoleType.INSTRUCTOR } },
      update: {},
      create: { userId: application.applicantId, role: RoleType.INSTRUCTOR },
    });
    const existing = await tx.instructorApproval.findFirst({
      where: { instructorId: application.applicantId },
    });
    if (!existing) {
      await tx.instructorApproval.create({
        data: {
          instructorId: application.applicantId,
          status: ApprovalStatus.TRAINING_IN_PROGRESS,
        },
      });
    }
  });

  try {
    await sendApplicationApprovedEmail({
      to: application.applicant.email,
      applicantName: application.applicant.name,
    });
  } catch (e) {
    console.error("[approveInstructorApplication] email failed:", e);
  }

  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

async function rejectInstructorApplication(
  applicationId: string,
  reviewerId: string,
  reason: string
) {
  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    include: { applicant: { select: { name: true, email: true } } },
  });
  if (!application) throw new Error("Application not found");

  await prisma.instructorApplication.update({
    where: { id: applicationId },
    data: {
      status: InstructorApplicationStatus.REJECTED,
      reviewerId,
      rejectionReason: reason,
      rejectedAt: new Date(),
    },
  });

  try {
    await sendApplicationRejectedEmail({
      to: application.applicant.email,
      applicantName: application.applicant.name,
      reason,
    });
  } catch (e) {
    console.error("[rejectInstructorApplication] email failed:", e);
  }

  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

async function requestMoreInfo(
  applicationId: string,
  reviewerId: string,
  message: string
) {
  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    include: { applicant: { select: { name: true, email: true } } },
  });
  if (!application) throw new Error("Application not found");

  await prisma.instructorApplication.update({
    where: { id: applicationId },
    data: {
      status: InstructorApplicationStatus.INFO_REQUESTED,
      reviewerId,
      infoRequest: message,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "https://portal.youthpassionproject.org";
  try {
    await sendInfoRequestEmail({
      to: application.applicant.email,
      applicantName: application.applicant.name,
      message,
      statusUrl: `${baseUrl}/application-status`,
    });
  } catch (e) {
    console.error("[requestMoreInfo] email failed:", e);
  }

  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

async function scheduleInterview(
  applicationId: string,
  reviewerId: string,
  scheduledAt: Date,
  notes?: string
) {
  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    include: { applicant: { select: { name: true, email: true } } },
  });
  if (!application) throw new Error("Application not found");

  await prisma.instructorApplication.update({
    where: { id: applicationId },
    data: {
      status: InstructorApplicationStatus.INTERVIEW_SCHEDULED,
      reviewerId,
      interviewScheduledAt: scheduledAt,
      reviewerNotes: notes ?? null,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "https://portal.youthpassionproject.org";
  try {
    await sendInterviewScheduledEmail({
      to: application.applicant.email,
      applicantName: application.applicant.name,
      scheduledAt,
      statusUrl: `${baseUrl}/application-status`,
    });
  } catch (e) {
    console.error("[scheduleInterview] email failed:", e);
  }

  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

async function markInterviewCompleted(
  applicationId: string,
  reviewerId: string,
  notes?: string
) {
  await prisma.instructorApplication.update({
    where: { id: applicationId },
    data: {
      status: InstructorApplicationStatus.INTERVIEW_COMPLETED,
      reviewerId,
      reviewerNotes: notes ?? null,
    },
  });

  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

export async function submitInfoResponse(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { status: "error", message: "Unauthorized" };

    const response = getString(formData, "applicantResponse");

    const application = await prisma.instructorApplication.findUnique({
      where: { applicantId: session.user.id },
    });
    if (!application) return { status: "error", message: "Application not found." };
    if (application.applicantId !== session.user.id) {
      return { status: "error", message: "Unauthorized." };
    }
    if (application.status !== InstructorApplicationStatus.INFO_REQUESTED) {
      return {
        status: "error",
        message: "Your application is not waiting on an information response right now.",
      };
    }

    await prisma.instructorApplication.update({
      where: { id: application.id },
      data: {
        applicantResponse: response,
        status: InstructorApplicationStatus.SUBMITTED,
      },
    });

    try {
      await notifyReviewersOfNewApplication(session.user.id);
    } catch (e) {
      console.error("[submitInfoResponse] notify failed:", e);
    }

    revalidatePath("/application-status");
    return { status: "success", message: "Your response has been submitted." };
  } catch (error) {
    console.error("[submitInfoResponse]", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}

/**
 * Direct form action wrapper for server components (no prevState).
 */
export async function reviewInstructorApplicationAction(formData: FormData): Promise<void> {
  await reviewInstructorApplication({ status: "idle", message: "" }, formData);
}
