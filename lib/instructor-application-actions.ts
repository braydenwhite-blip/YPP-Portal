"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { RoleType, InstructorApplicationStatus, ApprovalStatus } from "@prisma/client";
import {
  sendNewApplicationNotification,
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
  sendInfoRequestEmail,
  sendInterviewScheduledEmail,
  sendAvailabilityRequestEmail,
  sendPickYourTimeEmail,
  sendInterviewConfirmedEmail,
  sendInstructorPreApprovedEmail,
} from "@/lib/email";
import {
  getLegacyApplicationTransitionError,
  type LegacyApplicationReviewAction,
} from "@/lib/legacy-application-review";
import { syncInstructorApplicationWorkflow } from "@/lib/workflow";

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
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Unauthorized - Admin or Chapter President access required");
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
  const isChapterLead = reviewerRoles.includes("CHAPTER_PRESIDENT");
  if (!isAdmin && !isChapterLead) throw new Error("Unauthorized");
  if (isChapterLead && !isAdmin && reviewer.chapterId !== applicant.chapterId) {
    throw new Error("Chapter Presidents can only review applicants in their own chapter.");
  }
}

export async function notifyReviewersOfNewApplication(applicantId: string) {
  const applicant = await prisma.user.findUnique({
    where: { id: applicantId },
    select: { name: true, email: true, chapterId: true },
  });
  if (!applicant) return;

  const emailSet = new Set<string>();

  // 1. Chapter president(s) for the applicant's chapter
  const chapterPresidents = await prisma.user.findMany({
    where: {
      roles: { some: { role: RoleType.CHAPTER_PRESIDENT } },
      ...(applicant.chapterId ? { chapterId: applicant.chapterId } : {}),
    },
    select: { email: true },
  });
  chapterPresidents.forEach((u) => u.email && emailSet.add(u.email));

  // 2. Hiring chair (HIRING_ADMIN default owner)
  const hiringChair = await prisma.userAdminSubtype.findFirst({
    where: { subtype: "HIRING_ADMIN", isDefaultOwner: true },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (hiringChair?.user?.email) emailSet.add(hiringChair.user.email);

  const emails = Array.from(emailSet).filter(Boolean) as string[];
  if (!emails.length) return;

  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const baseUrl = getBaseUrl();
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
        await syncInstructorApplicationWorkflow(applicationId);
        revalidatePath("/admin/instructor-applicants");
        revalidatePath("/admin/instructor-applicants");
        revalidatePath("/application-status");
        return { status: "success", message: "Application marked as under review." };

      case "approve": {
        const notes = getString(formData, "notes", false);
        await approveInstructorApplication(applicationId, session.user.id, notes || undefined);
        await syncInstructorApplicationWorkflow(applicationId);
        return { status: "success", message: "Application approved. Applicant is now an instructor." };
      }

      case "reject": {
        const reason = getString(formData, "reason");
        await rejectInstructorApplication(applicationId, session.user.id, reason);
        await syncInstructorApplicationWorkflow(applicationId);
        return { status: "success", message: "Application rejected." };
      }

      case "request_info": {
        const message = getString(formData, "message");
        await requestMoreInfo(applicationId, session.user.id, message);
        await syncInstructorApplicationWorkflow(applicationId);
        return { status: "success", message: "Information request sent to applicant." };
      }

      case "schedule_interview": {
        const dateStr = getString(formData, "scheduledAt");
        const scheduledAt = new Date(dateStr);
        if (isNaN(scheduledAt.getTime())) {
          return { status: "error", message: "Invalid date or time for the curriculum overview session." };
        }
        const notes = getString(formData, "notes", false);
        await scheduleInterview(applicationId, session.user.id, scheduledAt, notes || undefined);
        await syncInstructorApplicationWorkflow(applicationId);
        return { status: "success", message: "Curriculum overview session scheduled and applicant notified." };
      }

      case "mark_interview_complete": {
        const notes = getString(formData, "notes", false);
        await markInterviewCompleted(applicationId, session.user.id, notes || undefined);
        await syncInstructorApplicationWorkflow(applicationId);
        return { status: "success", message: "Curriculum overview session marked as completed." };
      }

      case "put_on_hold": {
        const notes = getString(formData, "notes", false);
        await prisma.instructorApplication.update({
          where: { id: applicationId },
          data: {
            status: InstructorApplicationStatus.ON_HOLD,
            reviewerId: session.user.id,
            reviewerNotes: notes || application.reviewerNotes,
          },
        });
        revalidatePath("/admin/instructor-applicants");
        return { status: "success", message: "Application placed on hold." };
      }

      case "resume_from_hold": {
        await prisma.instructorApplication.update({
          where: { id: applicationId },
          data: {
            status: InstructorApplicationStatus.UNDER_REVIEW,
            reviewerId: session.user.id,
          },
        });
        revalidatePath("/admin/instructor-applicants");
        return { status: "success", message: "Application resumed from hold." };
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

  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const baseUrl = getBaseUrl();
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

  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const baseUrl = getBaseUrl();
  try {
    await sendInterviewScheduledEmail({
      to: application.applicant.email,
      applicantName: application.applicant.name,
      scheduledAt,
      statusUrl: `${baseUrl}/application-status`,
      variant: "instructor_application",
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
    const session = await getSession();
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

/**
 * Update application stage (used by Kanban drag-and-drop).
 * PRE_APPROVED is intentionally blocked here — use the "Pre-approve" button
 * in the detail panel, which enforces the correct auth level and sends the email.
 */
export async function updateApplicationStage(
  applicationId: string,
  newStatus: InstructorApplicationStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    // Block drag-to-PRE_APPROVED: the detail panel "Pre-approve" button is the only
    // correct path because it enforces ADMIN/HIRING_ADMIN auth and sends the email.
    if (newStatus === InstructorApplicationStatus.PRE_APPROVED) {
      return {
        success: false,
        error: "Use the 'Pre-approve' button in the applicant panel — it sends the required email and enforces the correct permissions.",
      };
    }

    const session = await requireAdminOrChapterLead();
    const application = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      include: { applicant: { select: { id: true, name: true, email: true } } },
    });
    if (!application) return { success: false, error: "Application not found." };
    await assertReviewerCanManageApplicant(session.user.id, application.applicantId);

    const data: Record<string, unknown> = {
      status: newStatus,
      reviewerId: session.user.id,
    };
    if (newStatus === "APPROVED") {
      data.approvedAt = new Date();
    }
    if (newStatus === "REJECTED") {
      data.rejectedAt = new Date();
    }

    if (newStatus === "APPROVED") {
      await approveInstructorApplication(applicationId, session.user.id);
    } else if (newStatus === "REJECTED") {
      await prisma.instructorApplication.update({ where: { id: applicationId }, data });
      revalidatePath("/admin/instructor-applicants");
    } else {
      await prisma.instructorApplication.update({ where: { id: applicationId }, data });
      revalidatePath("/admin/instructor-applicants");

      // When moved to INTERVIEW_SCHEDULED, the reviewer will propose times via the detail panel.
      // The applicant will receive a "pick your time" email once the reviewer offers slots.
    }

    return { success: true };
  } catch (error) {
    console.error("[updateApplicationStage]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/**
 * Save structured decision recommendation.
 */
export async function saveDecisionRecommendation(
  applicationId: string,
  recommendation: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrChapterLead();
    await prisma.instructorApplication.update({
      where: { id: applicationId },
      data: { decisionRecommendation: recommendation },
    });
    revalidatePath("/admin/instructor-applicants");
    return { success: true };
  } catch (error) {
    console.error("[saveDecisionRecommendation]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/**
 * Assign a reviewer to an application.
 */
export async function assignReviewer(
  applicationId: string,
  reviewerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrChapterLead();
    await prisma.instructorApplication.update({
      where: { id: applicationId },
      data: { reviewerId },
    });
    revalidatePath("/admin/instructor-applicants");
    return { success: true };
  } catch (error) {
    console.error("[assignReviewer]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/**
 * Set an action due date on an application.
 */
export async function setActionDueDate(
  applicationId: string,
  dueDate: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrChapterLead();
    await prisma.instructorApplication.update({
      where: { id: applicationId },
      data: { actionDueDate: dueDate ? new Date(dueDate) : null },
    });
    revalidatePath("/admin/instructor-applicants");
    return { success: true };
  } catch (error) {
    console.error("[setActionDueDate]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/**
 * Save scores and notes (used by detail panel).
 */
export async function saveScoresAndNotes(
  applicationId: string,
  data: {
    scoreAcademic?: number | null;
    scoreCommunication?: number | null;
    scoreLeadership?: number | null;
    scoreMotivation?: number | null;
    scoreFit?: number | null;
    scoreSubjectKnowledge?: number | null;
    scoreTeachingMethodology?: number | null;
    scoreCurriculumAlignment?: number | null;
    curriculumReviewSummary?: string;
    reviewerNotes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminOrChapterLead();
    await prisma.instructorApplication.update({
      where: { id: applicationId },
      data: {
        scoreAcademic: data.scoreAcademic,
        scoreCommunication: data.scoreCommunication,
        scoreLeadership: data.scoreLeadership,
        scoreMotivation: data.scoreMotivation,
        scoreFit: data.scoreFit,
        scoreSubjectKnowledge: data.scoreSubjectKnowledge,
        scoreTeachingMethodology: data.scoreTeachingMethodology,
        scoreCurriculumAlignment: data.scoreCurriculumAlignment,
        curriculumReviewSummary: data.curriculumReviewSummary || null,
        reviewerNotes: data.reviewerNotes,
      },
    });
    revalidatePath("/admin/instructor-applicants");
    return { success: true };
  } catch (error) {
    console.error("[saveScoresAndNotes]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

// ─────────────────────────────────────────────────────────────────
// Scheduling: Reviewer offers times → Applicant picks one
// ─────────────────────────────────────────────────────────────────

export async function preApproveApplication(
  applicationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    const roles = session.user.roles ?? [];
    if (!roles.includes("ADMIN") && !roles.includes("HIRING_ADMIN")) {
      return { success: false, error: "Only admins or the hiring chair can pre-approve applications." };
    }

    const application = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      include: { applicant: { select: { name: true, email: true } } },
    });
    if (!application) return { success: false, error: "Application not found." };

    const preApprovableStatuses: InstructorApplicationStatus[] = [
      InstructorApplicationStatus.UNDER_REVIEW,
      InstructorApplicationStatus.INFO_REQUESTED,
    ];
    if (!preApprovableStatuses.includes(application.status)) {
      return { success: false, error: "Only applications under review or awaiting info can be pre-approved." };
    }

    await prisma.instructorApplication.update({
      where: { id: applicationId },
      data: { status: InstructorApplicationStatus.PRE_APPROVED },
    });

    const { getBaseUrl } = await import("@/lib/portal-auth-utils");
    const baseUrl = getBaseUrl();
    if (application.applicant.email) {
      await sendInstructorPreApprovedEmail({
        to: application.applicant.email,
        applicantName: application.applicant.name,
        trainingUrl: `${baseUrl}/instructor-training`,
      }).catch((err) => console.error("[preApproveApplication] email failed:", err));
    } else {
      console.error(
        `[preApproveApplication] applicant ${applicationId} has no email — pre-approval email not sent. Follow up manually.`
      );
    }

    revalidatePath("/admin/instructor-applicants");
    revalidatePath("/application-status");
    return { success: true };
  } catch (error) {
    console.error("[preApproveApplication]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function offerInterviewSlots(
  applicationId: string,
  slots: { scheduledAt: Date; durationMinutes: number }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdminOrChapterLead();

    const application = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      include: { applicant: { select: { name: true, email: true } } },
    });
    if (!application) return { success: false, error: "Application not found." };

    if (slots.length < 1 || slots.length > 4) {
      return { success: false, error: "Please provide between 1 and 4 time slots." };
    }

    // Reject any slots that are already in the past — the applicant shouldn't
    // see expired times in their "pick your time" email or on the status page.
    const now = new Date();
    if (slots.some((s) => s.scheduledAt <= now)) {
      return { success: false, error: "All proposed times must be in the future." };
    }

    // Replace any unconfirmed existing slots, then create the new ones
    await prisma.offeredInterviewSlot.deleteMany({
      where: { instructorApplicationId: applicationId, confirmedAt: null },
    });
    await prisma.offeredInterviewSlot.createMany({
      data: slots.map((s) => ({
        instructorApplicationId: applicationId,
        scheduledAt: s.scheduledAt,
        durationMinutes: s.durationMinutes,
        offeredByUserId: session.user.id,
      })),
    });

    // Send "pick your time" email to the applicant
    const { getBaseUrl } = await import("@/lib/portal-auth-utils");
    const baseUrl = getBaseUrl();
    await sendPickYourTimeEmail({
      to: application.applicant.email,
      applicantName: application.applicant.name,
      slots,
      statusUrl: `${baseUrl}/application-status`,
    }).catch((err) => console.error("[offerInterviewSlots] email failed:", err));

    revalidatePath("/admin/instructor-applicants");
    return { success: true };
  } catch (error) {
    console.error("[offerInterviewSlots]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function selectInterviewSlot(
  slotId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const slot = await prisma.offeredInterviewSlot.findUnique({
      where: { id: slotId },
      include: {
        instructorApplication: {
          include: { applicant: { select: { name: true, email: true } } },
        },
        offeredBy: { select: { name: true, email: true } },
      },
    });
    if (!slot) return { success: false, error: "Slot not found." };
    if (slot.confirmedAt) return { success: false, error: "This slot has already been confirmed." };
    if (slot.instructorApplication.applicantId !== session.user.id) {
      return { success: false, error: "Unauthorized." };
    }

    const now = new Date();
    // Use updateMany with confirmedAt: null as an atomic guard against concurrent
    // double-clicks or duplicate tab submissions. If count === 0, another request
    // already confirmed this slot — bail out before sending duplicate emails.
    const { count } = await prisma.$transaction(async (tx) => {
      const result = await tx.offeredInterviewSlot.updateMany({
        where: { id: slotId, confirmedAt: null },
        data: { confirmedAt: now },
      });
      if (result.count > 0) {
        await tx.instructorApplication.update({
          where: { id: slot.instructorApplicationId },
          data: { interviewScheduledAt: slot.scheduledAt },
        });
      }
      return result;
    });

    if (count === 0) {
      return { success: false, error: "This time slot has already been confirmed. Please refresh to see the updated schedule." };
    }

    // Build ICS and send confirmation to applicant + all reviewers who offered slots
    const { generateIcsContent } = await import("@/lib/email");
    const { getBaseUrl } = await import("@/lib/portal-auth-utils");
    const baseUrl = getBaseUrl();
    const endsAt = new Date(slot.scheduledAt.getTime() + slot.durationMinutes * 60_000);
    const icsContent = generateIcsContent({
      uid: `slot-${slotId}@youthpassionproject.org`,
      title: `YPP Curriculum Overview/Interview — ${slot.instructorApplication.applicant.name}`,
      description: "YPP instructor curriculum overview and interview session.",
      startsAt: slot.scheduledAt,
      endsAt,
    });

    const applicant = slot.instructorApplication.applicant;
    await sendInterviewConfirmedEmail({
      to: applicant.email,
      recipientName: applicant.name,
      applicantName: applicant.name,
      scheduledAt: slot.scheduledAt,
      durationMinutes: slot.durationMinutes,
      role: "applicant",
      detailUrl: `${baseUrl}/application-status`,
      icsContent,
    }).catch((err) => console.error("[selectInterviewSlot] applicant email failed:", err));

    // Find all reviewers who offered slots for this application and notify them
    const reviewerSlots = await prisma.offeredInterviewSlot.findMany({
      where: { instructorApplicationId: slot.instructorApplicationId },
      include: { offeredBy: { select: { name: true, email: true } } },
    });
    const reviewerEmails = new Set<string>();
    for (const rs of reviewerSlots) {
      if (rs.offeredBy.email && !reviewerEmails.has(rs.offeredBy.email)) {
        reviewerEmails.add(rs.offeredBy.email);
        await sendInterviewConfirmedEmail({
          to: rs.offeredBy.email,
          recipientName: rs.offeredBy.name,
          applicantName: applicant.name,
          scheduledAt: slot.scheduledAt,
          durationMinutes: slot.durationMinutes,
          role: "reviewer",
          detailUrl: `${baseUrl}/admin/instructor-applicants`,
          icsContent,
        }).catch((err) => console.error("[selectInterviewSlot] reviewer email failed:", err));
      }
    }

    revalidatePath("/application-status");
    return { success: true };
  } catch (error) {
    console.error("[selectInterviewSlot]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
