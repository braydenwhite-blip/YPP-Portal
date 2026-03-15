"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { RoleType, ChapterPresidentApplicationStatus } from "@prisma/client";
import {
  sendNewApplicationNotification,
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
  sendInfoRequestEmail,
  sendInterviewScheduledEmail,
} from "@/lib/email";

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

export async function submitChapterPresidentApplication(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { status: "error", message: "Unauthorized" };

    const existing = await prisma.chapterPresidentApplication.findUnique({
      where: { applicantId: session.user.id },
    });
    if (existing) {
      return { status: "error", message: "You already have a chapter president application." };
    }

    const leadershipExperience = getString(formData, "leadershipExperience");
    const chapterVision = getString(formData, "chapterVision");
    const availability = getString(formData, "availability");
    const chapterId = getString(formData, "chapterId", false) || null;

    // Get custom field responses
    const customFields: { fieldId: string; value: string; fileUrl?: string }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("custom_field_")) {
        const fieldId = key.replace("custom_field_", "");
        customFields.push({ fieldId, value: String(value) });
      }
      if (key.startsWith("custom_file_")) {
        const fieldId = key.replace("custom_file_", "");
        const existing = customFields.find((f) => f.fieldId === fieldId);
        if (existing) {
          existing.fileUrl = String(value);
        } else {
          customFields.push({ fieldId, value: "", fileUrl: String(value) });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      const application = await tx.chapterPresidentApplication.create({
        data: {
          applicantId: session.user.id,
          chapterId,
          leadershipExperience,
          chapterVision,
          availability,
        },
      });

      // Save custom form responses
      if (customFields.length > 0) {
        await tx.applicationFormResponse.createMany({
          data: customFields.map((f) => ({
            fieldId: f.fieldId,
            chapterPresidentApplicationId: application.id,
            value: f.value,
            fileUrl: f.fileUrl || null,
          })),
        });
      }
    });

    // Notify reviewers
    try {
      const applicant = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, chapterId: true },
      });
      const reviewers = await prisma.user.findMany({
        where: {
          OR: [
            { roles: { some: { role: RoleType.ADMIN } } },
            {
              roles: { some: { role: RoleType.CHAPTER_LEAD } },
              chapterId: chapterId ?? undefined,
            },
          ],
        },
        select: { email: true },
      });
      const emails = reviewers.map((r) => r.email).filter(Boolean);
      if (emails.length > 0) {
        const baseUrl = process.env.NEXTAUTH_URL || "https://portal.youthpassionproject.org";
        await sendNewApplicationNotification({
          to: emails,
          applicantName: applicant?.name ?? "Unknown",
          reviewUrl: `${baseUrl}/admin/chapter-president-applicants`,
        });
      }
    } catch (e) {
      console.error("[submitCPApplication] notify failed:", e);
    }

    revalidatePath("/application-status");
    revalidatePath("/admin/chapter-president-applicants");
    return { status: "success", message: "Your chapter president application has been submitted!" };
  } catch (error) {
    console.error("[submitCPApplication]", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function reviewChapterPresidentApplication(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const session = await requireAdminOrChapterLead();
    const action = getString(formData, "action");
    const applicationId = getString(formData, "applicationId");

    const application = await prisma.chapterPresidentApplication.findUnique({
      where: { id: applicationId },
      include: { applicant: { select: { id: true, name: true, email: true } } },
    });
    if (!application) return { status: "error", message: "Application not found." };

    switch (action) {
      case "mark_under_review":
        await prisma.chapterPresidentApplication.update({
          where: { id: applicationId },
          data: { status: ChapterPresidentApplicationStatus.UNDER_REVIEW, reviewerId: session.user.id },
        });
        break;

      case "approve": {
        const notes = getString(formData, "notes", false);
        const chapterId = application.chapterId;

        await prisma.$transaction(async (tx) => {
          await tx.chapterPresidentApplication.update({
            where: { id: applicationId },
            data: {
              status: ChapterPresidentApplicationStatus.APPROVED,
              reviewerId: session.user.id,
              reviewerNotes: notes || null,
              approvedAt: new Date(),
            },
          });

          // Assign CHAPTER_LEAD role
          await tx.user.update({
            where: { id: application.applicantId },
            data: {
              primaryRole: RoleType.CHAPTER_LEAD,
              ...(chapterId ? { chapterId } : {}),
            },
          });
          await tx.userRole.upsert({
            where: { userId_role: { userId: application.applicantId, role: RoleType.CHAPTER_LEAD } },
            update: {},
            create: { userId: application.applicantId, role: RoleType.CHAPTER_LEAD },
          });

          // Create onboarding record
          if (chapterId) {
            await tx.chapterPresidentOnboarding.upsert({
              where: { userId: application.applicantId },
              update: { chapterId, status: "NOT_STARTED" },
              create: {
                userId: application.applicantId,
                chapterId,
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
          console.error("[approveCPApplication] email failed:", e);
        }

        revalidatePath("/admin/chapter-president-applicants");
        revalidatePath("/application-status");
        return { status: "success", message: "Application approved. Applicant is now a Chapter Lead." };
      }

      case "reject": {
        const reason = getString(formData, "reason");
        await prisma.chapterPresidentApplication.update({
          where: { id: applicationId },
          data: {
            status: ChapterPresidentApplicationStatus.REJECTED,
            reviewerId: session.user.id,
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
          console.error("[rejectCPApplication] email failed:", e);
        }
        break;
      }

      case "request_info": {
        const message = getString(formData, "message");
        await prisma.chapterPresidentApplication.update({
          where: { id: applicationId },
          data: {
            status: ChapterPresidentApplicationStatus.INFO_REQUESTED,
            reviewerId: session.user.id,
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
          console.error("[requestCPInfo] email failed:", e);
        }
        break;
      }

      case "schedule_interview": {
        const dateStr = getString(formData, "scheduledAt");
        const scheduledAt = new Date(dateStr);
        if (isNaN(scheduledAt.getTime())) {
          return { status: "error", message: "Invalid interview date/time." };
        }
        const notes = getString(formData, "notes", false);
        await prisma.chapterPresidentApplication.update({
          where: { id: applicationId },
          data: {
            status: ChapterPresidentApplicationStatus.INTERVIEW_SCHEDULED,
            reviewerId: session.user.id,
            interviewScheduledAt: scheduledAt,
            reviewerNotes: notes || null,
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
          console.error("[scheduleCPInterview] email failed:", e);
        }
        break;
      }

      case "mark_interview_complete": {
        const notes = getString(formData, "notes", false);
        await prisma.chapterPresidentApplication.update({
          where: { id: applicationId },
          data: {
            status: ChapterPresidentApplicationStatus.INTERVIEW_COMPLETED,
            reviewerId: session.user.id,
            reviewerNotes: notes || null,
          },
        });
        break;
      }

      default:
        return { status: "error", message: "Unknown action." };
    }

    revalidatePath("/admin/chapter-president-applicants");
    revalidatePath("/chapter-lead/instructor-applicants");
    revalidatePath("/application-status");
    return { status: "success", message: "Action completed." };
  } catch (error) {
    console.error("[reviewCPApplication]", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function reviewCPApplicationAction(formData: FormData): Promise<void> {
  await reviewChapterPresidentApplication({ status: "idle", message: "" }, formData);
}

export async function submitCPInfoResponse(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { status: "error", message: "Unauthorized" };

    const response = getString(formData, "applicantResponse");

    const application = await prisma.chapterPresidentApplication.findUnique({
      where: { applicantId: session.user.id },
    });
    if (!application) return { status: "error", message: "Application not found." };
    if (application.applicantId !== session.user.id) {
      return { status: "error", message: "Unauthorized." };
    }

    await prisma.chapterPresidentApplication.update({
      where: { id: application.id },
      data: {
        applicantResponse: response,
        status: ChapterPresidentApplicationStatus.SUBMITTED,
      },
    });

    revalidatePath("/application-status");
    return { status: "success", message: "Your response has been submitted." };
  } catch (error) {
    console.error("[submitCPInfoResponse]", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }
}
