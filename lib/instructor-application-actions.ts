"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { RoleType, InstructorApplicationStatus, ApprovalStatus, ChairDecisionAction } from "@prisma/client";
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
  sendReviewerAssignedEmail,
  sendInterviewerAssignedEmail,
  sendChairDecisionEmail,
  sendMaterialsMissingReminderEmail,
} from "@/lib/email";
import {
  getLegacyApplicationTransitionError,
  type LegacyApplicationReviewAction,
} from "@/lib/legacy-application-review";
import { syncInstructorApplicationWorkflow } from "@/lib/workflow";
import {
  getHiringActor,
  assertCanManageApplication,
  assertCanAssignInterviewers,
  assertCanActAsChair,
} from "@/lib/chapter-hiring-permissions";
import { ApplicantWorkflowError } from "@/lib/applicant-workflow-error";
import { shouldSendAssignmentNotification } from "@/lib/notification-policy";
import { trackApplicantEvent } from "@/lib/telemetry";

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
  const baseUrl = await getBaseUrl();
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
        await markInstructorApplicationUnderReview(applicationId, session.user.id);
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
          return { status: "error", message: "Invalid date or time for the interview." };
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

      case "put_on_hold": {
        const notes = getString(formData, "notes", false);
        await holdInstructorApplication(
          applicationId,
          session.user.id,
          notes || application.reviewerNotes || undefined
        );
        return { status: "success", message: "Application placed on hold." };
      }

      case "resume_from_hold": {
        await markInstructorApplicationUnderReview(applicationId, session.user.id);
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

export async function markInstructorApplicationUnderReview(
  applicationId: string,
  reviewerId: string
) {
  await prisma.instructorApplication.update({
    where: { id: applicationId },
    data: {
      status: InstructorApplicationStatus.UNDER_REVIEW,
      reviewerId,
    },
  });

  await syncInstructorApplicationWorkflow(applicationId);
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

export async function moveInstructorApplicationToInterviewStage(
  applicationId: string,
  reviewerId: string,
  notes?: string
) {
  await prisma.instructorApplication.update({
    where: { id: applicationId },
    data: {
      status: InstructorApplicationStatus.INTERVIEW_SCHEDULED,
      reviewerId,
      reviewerNotes: notes ?? null,
      interviewScheduledAt: null,
    },
  });

  await syncInstructorApplicationWorkflow(applicationId);
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

export async function holdInstructorApplication(
  applicationId: string,
  reviewerId: string,
  notes?: string
) {
  await prisma.instructorApplication.update({
    where: { id: applicationId },
    data: {
      status: InstructorApplicationStatus.ON_HOLD,
      reviewerId,
      reviewerNotes: notes ?? null,
    },
  });

  await syncInstructorApplicationWorkflow(applicationId);
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

export async function approveInstructorApplication(
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

  await syncInstructorApplicationWorkflow(applicationId);
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

async function rejectInstructorApplicationInternal(
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

  await syncInstructorApplicationWorkflow(applicationId);
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

export async function rejectInstructorApplication(
  applicationId: string,
  reviewerId: string,
  reason: string
) {
  return rejectInstructorApplicationInternal(applicationId, reviewerId, reason);
}

async function requestMoreInfoInternal(
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
        infoRequestReturnStatus: InstructorApplicationStatus.UNDER_REVIEW,
      },
    });

  const { getBaseUrl } = await import("@/lib/portal-auth-utils");
  const baseUrl = await getBaseUrl();
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

  await syncInstructorApplicationWorkflow(applicationId);
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

export async function requestMoreInfo(
  applicationId: string,
  reviewerId: string,
  message: string
) {
  return requestMoreInfoInternal(applicationId, reviewerId, message);
}

export async function scheduleInterview(
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
  const baseUrl = await getBaseUrl();
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

  await syncInstructorApplicationWorkflow(applicationId);
  revalidatePath("/admin/instructor-applicants");
  revalidatePath("/chapter-lead/instructor-applicants");
  revalidatePath("/application-status");
}

export async function markInterviewCompleted(
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

  await syncInstructorApplicationWorkflow(applicationId);
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

    const returnStatus =
      application.infoRequestReturnStatus ?? InstructorApplicationStatus.UNDER_REVIEW;

    await prisma.instructorApplication.update({
      where: { id: application.id },
      data: {
        applicantResponse: response,
        status: returnStatus,
        infoRequestReturnStatus: null,
      },
    });

    try {
      await notifyReviewersOfNewApplication(session.user.id);
    } catch (e) {
      console.error("[submitInfoResponse] notify failed:", e);
    }

    await syncInstructorApplicationWorkflow(application.id);
    revalidatePath("/admin/instructor-applicants");
    revalidatePath("/admin/instructor-applicants/chair-queue");
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
      await syncInstructorApplicationWorkflow(applicationId);
      revalidatePath("/admin/instructor-applicants");
    } else if (newStatus === InstructorApplicationStatus.UNDER_REVIEW) {
      await markInstructorApplicationUnderReview(applicationId, session.user.id);
    } else if (newStatus === InstructorApplicationStatus.INTERVIEW_SCHEDULED) {
      await moveInstructorApplicationToInterviewStage(applicationId, session.user.id);
    } else if (newStatus === InstructorApplicationStatus.ON_HOLD) {
      await holdInstructorApplication(applicationId, session.user.id);
    } else {
      await prisma.instructorApplication.update({ where: { id: applicationId }, data });
      await syncInstructorApplicationWorkflow(applicationId);
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
 * V1: also sets reviewerAssignedAt/By, auto-advances SUBMITTED→UNDER_REVIEW, writes timeline.
 */
export async function assignReviewer(
  applicationId: string,
  reviewerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdminOrChapterLead();
    const application = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicantId: true,
        status: true,
        reviewerId: true,
        applicant: { select: { chapterId: true } },
      },
    });
    if (!application) return { success: false, error: "Application not found." };
    const actor = await getHiringActor(session.user.id);
    assertCanManageApplication(actor, {
      id: application.id,
      applicantId: application.applicantId,
      reviewerId: application.reviewerId,
      applicantChapterId: application.applicant.chapterId,
      interviewerAssignments: [],
    });
    const targetReviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
      select: { chapterId: true, roles: { select: { role: true } } },
    });
    if (!targetReviewer) return { success: false, error: "Reviewer not found." };
    const targetRoles = targetReviewer.roles.map((role) => role.role);
    const targetIsAdmin = targetRoles.includes("ADMIN");
    const targetIsChapterPresident = targetRoles.includes("CHAPTER_PRESIDENT");
    if (!targetIsAdmin && !targetIsChapterPresident) {
      return { success: false, error: "Reviewer must be an Admin or Chapter President." };
    }
    if (
      !targetIsAdmin &&
      application.applicant.chapterId &&
      targetReviewer.chapterId !== application.applicant.chapterId
    ) {
      return { success: false, error: "Chapter President reviewers must belong to the applicant's chapter." };
    }

    const now = new Date();
    const newStatus =
      application.status === InstructorApplicationStatus.SUBMITTED
        ? InstructorApplicationStatus.UNDER_REVIEW
        : application.status;

    await prisma.$transaction(async (tx) => {
      await tx.instructorApplication.update({
        where: { id: applicationId },
        data: {
          reviewerId,
          reviewerAssignedAt: now,
          reviewerAssignedById: session.user.id,
          status: newStatus,
        },
      });
      await tx.instructorApplicationTimelineEvent.create({
        data: {
          applicationId,
          kind: "REVIEWER_ASSIGNED",
          actorId: actor.id,
          payload: { reviewerId, previousReviewerId: application.reviewerId ?? null },
        },
      });
    });

    // Fire email outside transaction so DB is committed first.
    // Debounced: one email per reviewer per application per 5-min window (Risk 7).
    try {
      if (shouldSendAssignmentNotification("REVIEWER_ASSIGNED", reviewerId, applicationId)) {
        await sendReviewerAssignedEmail(reviewerId, applicationId);
      }
    } catch (e) {
      console.error("[assignReviewer] email failed:", e);
    }

    await syncInstructorApplicationWorkflow(applicationId);
    trackApplicantEvent("applicant.reviewer.assigned", {
      applicationId,
      actorId: actor.id,
      chapterId: application.applicant.chapterId ?? null,
      status: String(newStatus),
      meta: { reviewerId },
    });
    revalidatePath("/admin/instructor-applicants");
    revalidatePath("/chapter-lead/instructor-applicants");
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
    const session = await requireAdminOrChapterLead();
    const app = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicantId: true,
        reviewerId: true,
        applicant: { select: { chapterId: true } },
      },
    });
    if (!app) return { success: false, error: "Application not found." };
    assertCanManageApplication(await getHiringActor(session.user.id), {
      id: app.id,
      applicantId: app.applicantId,
      reviewerId: app.reviewerId,
      applicantChapterId: app.applicant.chapterId,
      interviewerAssignments: [],
    });
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
    const session = await requireAdminOrChapterLead();
    const app = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicantId: true,
        reviewerId: true,
        applicant: { select: { chapterId: true } },
      },
    });
    if (!app) return { success: false, error: "Application not found." };
    assertCanManageApplication(await getHiringActor(session.user.id), {
      id: app.id,
      applicantId: app.applicantId,
      reviewerId: app.reviewerId,
      applicantChapterId: app.applicant.chapterId,
      interviewerAssignments: [],
    });
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
    const baseUrl = await getBaseUrl();
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
    const baseUrl = await getBaseUrl();
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
          include: {
            applicant: { select: { name: true, email: true } },
          },
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
    const baseUrl = await getBaseUrl();
    const endsAt = new Date(slot.scheduledAt.getTime() + slot.durationMinutes * 60_000);
    const icsContent = generateIcsContent({
      uid: `slot-${slotId}@youthpassionproject.org`,
      title: `YPP Instructor Interview — ${slot.instructorApplication.applicant.name}`,
      description: "YPP instructor interview.",
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

    if (!slot.instructorApplication.materialsReadyAt) {
      await sendMaterialsMissingReminderEmail(
        applicant.email,
        applicant.name,
        slot.instructorApplicationId
      ).catch((err) => console.error("[selectInterviewSlot] materials reminder failed:", err));
    }

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

// ─── Instructor Applicant Workflow V1 actions ─────────────────────────────────

/** Reassign reviewer — same as assignReviewer but always fires, regardless of prior reviewer. */
export async function reassignReviewer(
  applicationId: string,
  newReviewerId: string
): Promise<{ success: boolean; error?: string }> {
  return assignReviewer(applicationId, newReviewerId);
}

/**
 * Assign an interviewer (LEAD or SECOND) to an application.
 * LEAD must exist before SECOND can be assigned.
 */
export async function assignInterviewer(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const applicationId = String(formData.get("applicationId") ?? "").trim();
    const interviewerId = String(formData.get("interviewerId") ?? "").trim();
    const roleRaw = String(formData.get("role") ?? "").trim();
    if (!applicationId || !interviewerId) return { success: false, error: "Missing fields." };
    if (roleRaw !== "LEAD" && roleRaw !== "SECOND") return { success: false, error: "role must be LEAD or SECOND." };
    const role = roleRaw as "LEAD" | "SECOND";

    const app = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicantId: true,
        reviewerId: true,
        interviewRound: true,
        status: true,
        applicant: { select: { chapterId: true } },
        interviewerAssignments: {
          where: { removedAt: null },
          select: { interviewerId: true, role: true, round: true, removedAt: true },
        },
      },
    });
    if (!app) return { success: false, error: "Application not found." };

    const actor = await getHiringActor(session.user.id);
    assertCanAssignInterviewers(
      actor,
      {
        id: app.id,
        applicantId: app.applicantId,
        reviewerId: app.reviewerId,
        interviewRound: app.interviewRound,
        applicantChapterId: app.applicant.chapterId,
        interviewerAssignments: app.interviewerAssignments,
      },
      role
    );

    const currentRoundAssignments = app.interviewerAssignments.filter(
      (assignment) => assignment.round === app.interviewRound
    );

    if (role === "SECOND" && !currentRoundAssignments.some((a) => a.role === "LEAD")) {
      return { success: false, error: "Assign a LEAD interviewer before adding a SECOND." };
    }
    if (currentRoundAssignments.some((a) => a.role === role)) {
      return { success: false, error: `${role} interviewer is already assigned for this round.` };
    }

    const alreadyAssigned = currentRoundAssignments.some((a) => a.interviewerId === interviewerId);
    if (alreadyAssigned) return { success: false, error: "This interviewer is already assigned." };

    await prisma.$transaction(async (tx) => {
      await tx.instructorApplicationInterviewer.create({
        data: {
          applicationId,
          interviewerId,
          round: app.interviewRound,
          role,
          assignedById: actor.id,
        },
      });
      await tx.instructorApplicationTimelineEvent.create({
        data: {
          applicationId,
          kind: "INTERVIEWER_ASSIGNED",
          actorId: actor.id,
          payload: { interviewerId, role, round: app.interviewRound },
        },
      });
    });

    // Debounced: one email per interviewer per application per 5-min window (Risk 7).
    try {
      if (shouldSendAssignmentNotification("INTERVIEWER_ASSIGNED", interviewerId, applicationId)) {
        await sendInterviewerAssignedEmail(interviewerId, applicationId, role);
      }
    } catch (e) {
      console.error("[assignInterviewer] email failed:", e);
    }

    trackApplicantEvent("applicant.interviewer.assigned", {
      applicationId,
      actorId: actor.id,
      chapterId: app.applicant.chapterId ?? null,
      status: app.status,
      meta: { interviewerId, role },
    });
    revalidatePath(`/applications/instructor/${applicationId}`);
    revalidatePath("/admin/instructor-applicants");
    return { success: true };
  } catch (error) {
    console.error("[assignInterviewer]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/** Soft-remove an interviewer assignment by setting removedAt. */
export async function removeInterviewer(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const assignmentId = String(formData.get("assignmentId") ?? "").trim();
    if (!assignmentId) return { success: false, error: "Missing assignmentId." };

    const assignment = await prisma.instructorApplicationInterviewer.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        applicationId: true,
        interviewerId: true,
        role: true,
        round: true,
        removedAt: true,
        application: {
          select: {
            id: true,
            applicantId: true,
            reviewerId: true,
            interviewRound: true,
            applicant: { select: { chapterId: true } },
          },
        },
      },
    });
    if (!assignment) return { success: false, error: "Interviewer assignment not found." };
    if (assignment.removedAt) return { success: false, error: "Already removed." };

    const actor = await getHiringActor(session.user.id);
    assertCanManageApplication(actor, {
      id: assignment.application.id,
      applicantId: assignment.application.applicantId,
      reviewerId: assignment.application.reviewerId,
      interviewRound: assignment.application.interviewRound,
      applicantChapterId: assignment.application.applicant.chapterId,
      interviewerAssignments: [],
    });

    await prisma.$transaction(async (tx) => {
      await tx.instructorApplicationInterviewer.update({
        where: { id: assignmentId },
        data: { removedAt: new Date() },
      });
      await tx.instructorApplicationTimelineEvent.create({
        data: {
          applicationId: assignment.applicationId,
          kind: "INTERVIEWER_REMOVED",
          actorId: actor.id,
          payload: { interviewerId: assignment.interviewerId, role: assignment.role, round: assignment.round },
        },
      });
    });

    revalidatePath(`/applications/instructor/${assignment.applicationId}`);
    revalidatePath("/admin/instructor-applicants");
    return { success: true };
  } catch (error) {
    console.error("[removeInterviewer]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/**
 * Manually send an application to the Chair queue.
 * Guard: status must be INTERVIEW_COMPLETED and every active interviewer must have
 * submitted an InstructorInterviewReview.
 * Admins may override the "all reviews submitted" guard with overrideReason.
 */
export async function sendToChair(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const applicationId = String(formData.get("applicationId") ?? "").trim();
    const overrideReason = String(formData.get("overrideReason") ?? "").trim() || null;
    if (!applicationId) return { success: false, error: "Missing applicationId." };

    const actor = await getHiringActor(session.user.id);

    const app = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicantId: true,
        reviewerId: true,
        status: true,
        interviewRound: true,
        applicant: { select: { chapterId: true } },
        interviewerAssignments: {
          where: { removedAt: null },
          select: { interviewerId: true, round: true, removedAt: true },
        },
        interviewReviews: {
          where: { status: "SUBMITTED" },
          select: { reviewerId: true, round: true, recommendation: true },
        },
      },
    });
    if (!app) return { success: false, error: "Application not found." };
    assertCanManageApplication(actor, {
      id: app.id,
      applicantId: app.applicantId,
      reviewerId: app.reviewerId,
      interviewRound: app.interviewRound,
      applicantChapterId: app.applicant.chapterId,
      interviewerAssignments: app.interviewerAssignments,
    });
    if (app.status !== InstructorApplicationStatus.INTERVIEW_COMPLETED) {
      return { success: false, error: "Application must be in INTERVIEW_COMPLETED status to send to chair." };
    }

    const activeInterviewerIds = app.interviewerAssignments
      .filter((assignment) => assignment.round === app.interviewRound)
      .map((a) => a.interviewerId);
    const submittedReviewerIds = new Set(
      app.interviewReviews
        .filter((review) => review.round === app.interviewRound && review.recommendation)
        .map((r) => r.reviewerId)
    );
    const missingReviews = activeInterviewerIds.filter((id) => !submittedReviewerIds.has(id));

    if (missingReviews.length > 0 && !actor.roles.includes("ADMIN")) {
      return {
        success: false,
        error: `${missingReviews.length} interviewer(s) have not yet submitted their review.`,
      };
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.instructorApplication.update({
        where: { id: applicationId },
        data: { status: InstructorApplicationStatus.CHAIR_REVIEW, chairQueuedAt: now },
      });
      await tx.instructorApplicationTimelineEvent.create({
        data: {
          applicationId,
          kind: "STATUS_CHANGE",
          actorId: actor.id,
          payload: {
            from: InstructorApplicationStatus.INTERVIEW_COMPLETED,
            to: InstructorApplicationStatus.CHAIR_REVIEW,
            ...(overrideReason ? { overrideReason } : {}),
          },
        },
      });
    });

    await syncInstructorApplicationWorkflow(applicationId);
    revalidatePath(`/applications/instructor/${applicationId}`);
    revalidatePath("/admin/instructor-applicants");
    revalidatePath("/admin/instructor-applicants/chair-queue");
    return { success: true };
  } catch (error) {
    console.error("[sendToChair]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/**
 * Admin-only force-override: advance a stuck INTERVIEW_COMPLETED application to
 * CHAIR_REVIEW even when one or more interviewers have not submitted (Risk 3).
 * Requires an explicit overrideReason for the audit log.
 */
export async function forceSendToChair(
  applicationId: string,
  overrideReason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    const roles = session.user.roles ?? [];
    if (!roles.includes("ADMIN")) {
      return { success: false, error: "forceSendToChair is admin-only." };
    }
    if (!overrideReason.trim()) {
      return { success: false, error: "An override reason is required." };
    }

    const app = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: { status: true },
    });
    if (!app) return { success: false, error: "Application not found." };
    if (app.status !== InstructorApplicationStatus.INTERVIEW_COMPLETED) {
      return {
        success: false,
        error: "forceSendToChair can only be called on INTERVIEW_COMPLETED applications.",
      };
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.instructorApplication.update({
        where: { id: applicationId },
        data: { status: InstructorApplicationStatus.CHAIR_REVIEW, chairQueuedAt: now },
      });
      await tx.instructorApplicationTimelineEvent.create({
        data: {
          applicationId,
          kind: "STATUS_CHANGE",
          actorId: session.user.id,
          payload: {
            from: InstructorApplicationStatus.INTERVIEW_COMPLETED,
            to: InstructorApplicationStatus.CHAIR_REVIEW,
            overrideReason: overrideReason.trim(),
            forcedBy: session.user.id,
          },
        },
      });
    });

    revalidatePath(`/applications/instructor/${applicationId}`);
    revalidatePath("/admin/instructor-applicants");
    revalidatePath("/admin/instructor-applicants/chair-queue");
    return { success: true };
  } catch (error) {
    console.error("[forceSendToChair]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/**
 * Chair decision action.
 * Validates chair role and CHAIR_REVIEW status inside the transaction.
 * APPROVE runs atomically with existing syncInstructorApplicationWorkflow.
 * REQUEST_SECOND_INTERVIEW reverts status to INTERVIEW_SCHEDULED.
 */
export async function chairDecide(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const applicationId = String(formData.get("applicationId") ?? "").trim();
    const actionRaw = String(formData.get("action") ?? "").trim();
    const rationale = String(formData.get("rationale") ?? "").trim() || null;
    const comparisonNotes = String(formData.get("comparisonNotes") ?? "").trim() || null;
    if (!applicationId || !actionRaw) return { success: false, error: "Missing required fields." };

    const validActions = Object.values(ChairDecisionAction) as string[];
    if (!validActions.includes(actionRaw)) {
      return { success: false, error: "Invalid chair action." };
    }
    const action = actionRaw as ChairDecisionAction;
    if ((action === "REQUEST_INFO" || action === "REJECT") && !rationale) {
      return {
        success: false,
        error:
          action === "REQUEST_INFO"
            ? "Add the information request before sending it to the applicant."
            : "Add a rejection reason before rejecting the application.",
      };
    }

    const actor = await getHiringActor(session.user.id);
    assertCanActAsChair(actor);

    const app = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: {
        status: true,
        applicantId: true,
        reviewerId: true,
        interviewRound: true,
        applicant: { select: { id: true, name: true, email: true } },
        interviewerAssignments: {
          where: { removedAt: null },
          select: { interviewerId: true, round: true, interviewer: { select: { id: true, email: true } } },
        },
      },
    });
    if (!app) return { success: false, error: "Application not found." };
    if (app.status !== InstructorApplicationStatus.CHAIR_REVIEW) {
      return { success: false, error: "Chair decisions can only be made when the application is in CHAIR_REVIEW status." };
    }

    const now = new Date();

    const statusByAction: Partial<Record<ChairDecisionAction, InstructorApplicationStatus>> = {
      APPROVE: InstructorApplicationStatus.APPROVED,
      REJECT: InstructorApplicationStatus.REJECTED,
      HOLD: InstructorApplicationStatus.ON_HOLD,
      REQUEST_INFO: InstructorApplicationStatus.INFO_REQUESTED,
      REQUEST_SECOND_INTERVIEW: InstructorApplicationStatus.INTERVIEW_SCHEDULED,
    };
    const newStatus = statusByAction[action]!;

    let approvalRollback:
      | {
          previousPrimaryRole: RoleType;
          hadInstructorRole: boolean;
          existingApprovalId: string | null;
        }
      | null = null;

    await prisma.$transaction(async (tx) => {
      // Re-check status inside transaction to guard against stale clicks
      const fresh = await tx.instructorApplication.findUnique({
        where: { id: applicationId },
        select: { status: true },
      });
      if (fresh?.status !== InstructorApplicationStatus.CHAIR_REVIEW) {
        throw new ApplicantWorkflowError(
          "STATUS_CHANGED",
          "Application status changed before decision was recorded — please refresh."
        );
      }

      // Supersede any prior chair decision for audit chain
      await tx.instructorApplicationChairDecision.updateMany({
        where: { applicationId, supersededAt: null },
        data: { supersededAt: now },
      });

      await tx.instructorApplicationChairDecision.create({
        data: { applicationId, chairId: actor.id, action, rationale, comparisonNotes, decidedAt: now },
      });

      const appUpdateData: Record<string, unknown> = { status: newStatus };
      if (action === "APPROVE") appUpdateData.approvedAt = now;
      if (action === "REJECT") {
        appUpdateData.rejectedAt = now;
        appUpdateData.rejectionReason = rationale;
      }
      if (action === "REQUEST_INFO") {
        appUpdateData.infoRequest = rationale;
        appUpdateData.infoRequestReturnStatus = InstructorApplicationStatus.CHAIR_REVIEW;
      }
      if (action === "REQUEST_SECOND_INTERVIEW") {
        appUpdateData.interviewRound = { increment: 1 };
        appUpdateData.chairQueuedAt = null;
        appUpdateData.interviewScheduledAt = null;
      }

      if (action === "APPROVE") {
        const [applicantUser, existingInstructorRole, existingApproval] = await Promise.all([
          tx.user.findUnique({
            where: { id: app.applicantId },
            select: { primaryRole: true },
          }),
          tx.userRole.findUnique({
            where: { userId_role: { userId: app.applicantId, role: RoleType.INSTRUCTOR } },
            select: { userId: true },
          }),
          tx.instructorApproval.findFirst({
            where: { instructorId: app.applicantId },
            select: { id: true },
          }),
        ]);
        if (!applicantUser) {
          throw new Error("Applicant user not found.");
        }
        approvalRollback = {
          previousPrimaryRole: applicantUser.primaryRole,
          hadInstructorRole: Boolean(existingInstructorRole),
          existingApprovalId: existingApproval?.id ?? null,
        };
        // Grant INSTRUCTOR role atomically in the same transaction
        await tx.instructorApplication.update({ where: { id: applicationId }, data: appUpdateData });
        await tx.user.update({
          where: { id: app.applicantId },
          data: { primaryRole: RoleType.INSTRUCTOR },
        });
        await tx.userRole.upsert({
          where: { userId_role: { userId: app.applicantId, role: RoleType.INSTRUCTOR } },
          update: {},
          create: { userId: app.applicantId, role: RoleType.INSTRUCTOR },
        });
        if (!existingApproval) {
          await tx.instructorApproval.create({
            data: { instructorId: app.applicantId, status: ApprovalStatus.TRAINING_IN_PROGRESS },
          });
        }
      } else {
        await tx.instructorApplication.update({ where: { id: applicationId }, data: appUpdateData });
      }

      await tx.instructorApplicationTimelineEvent.create({
        data: {
          applicationId,
          kind: "CHAIR_DECISION",
          actorId: actor.id,
          payload: {
            action,
            from: InstructorApplicationStatus.CHAIR_REVIEW,
            to: newStatus,
            rationale: rationale ?? null,
          },
        },
      });
    });

    // Post-transaction side effects.
    // APPROVE: sync must succeed or we compensate (Risk 10).
    if (action === "APPROVE") {
      try {
        await syncInstructorApplicationWorkflow(applicationId);
      } catch (syncError) {
        console.error("[chairDecide] onboarding sync failed — compensating rollback", syncError);
        // Revert status + decision so the chair can try again with a clean state.
        const rollbackNow = new Date();
        await prisma.$transaction(async (tx) => {
          await tx.instructorApplicationChairDecision.updateMany({
            where: { applicationId, supersededAt: null },
            data: { supersededAt: rollbackNow },
          });
          if (approvalRollback && !approvalRollback.hadInstructorRole) {
            await tx.userRole.deleteMany({
              where: { userId: app.applicantId, role: RoleType.INSTRUCTOR },
            });
          }
          if (approvalRollback && !approvalRollback.existingApprovalId) {
            await tx.instructorApproval.deleteMany({
              where: { instructorId: app.applicantId },
            });
          }
          if (approvalRollback) {
            await tx.user.update({
              where: { id: app.applicantId },
              data: { primaryRole: approvalRollback.previousPrimaryRole },
            });
          }
          await tx.instructorApplication.update({
            where: { id: applicationId },
            data: {
              status: InstructorApplicationStatus.CHAIR_REVIEW,
              approvedAt: null,
            },
          });
          await tx.instructorApplicationTimelineEvent.create({
            data: {
              applicationId,
              kind: "SYNC_ROLLBACK",
              actorId: actor.id,
              payload: {
                error: syncError instanceof Error ? syncError.message : String(syncError),
                rolledBackAt: rollbackNow.toISOString(),
              },
            },
          });
        });
        return {
          success: false,
          error: "Onboarding sync failed — decision was reversed. Please try again.",
        };
      }
      try {
        await sendApplicationApprovedEmail({
          to: app.applicant.email,
          applicantName: app.applicant.name,
        });
      } catch (e) {
        console.error("[chairDecide] approval email failed:", e);
      }
    }

    if (action === "REJECT") {
      try {
        await sendApplicationRejectedEmail({
          to: app.applicant.email,
          applicantName: app.applicant.name,
          reason: rationale ?? "The chair review did not result in approval.",
        });
      } catch (e) {
        console.error("[chairDecide] rejection email failed:", e);
      }
    } else if (action === "REQUEST_INFO") {
      try {
        const { getBaseUrl } = await import("@/lib/portal-auth-utils");
        const baseUrl = await getBaseUrl();
        await sendInfoRequestEmail({
          to: app.applicant.email,
          applicantName: app.applicant.name,
          message: rationale ?? "Please provide the requested follow-up information.",
          statusUrl: `${baseUrl}/application-status`,
        });
      } catch (e) {
        console.error("[chairDecide] info-request email failed:", e);
      }
    } else if (action !== "APPROVE") {
      try {
        await sendChairDecisionEmail(app.applicant.email, applicationId, action);
      } catch (e) {
        console.error("[chairDecide] decision email failed:", e);
      }
    }

    trackApplicantEvent("applicant.chair.decided", {
      applicationId,
      actorId: actor.id,
      chapterId: null,
      status: String(newStatus),
      meta: { action },
    });
    revalidatePath(`/applications/instructor/${applicationId}`);
    revalidatePath("/admin/instructor-applicants");
    revalidatePath("/admin/instructor-applicants/chair-queue");
    return { success: true };
  } catch (error) {
    console.error("[chairDecide]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/** Admin-only manual archive — sets archivedAt immediately. */
export async function archiveApplication(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    const roles = session.user.roles ?? [];
    if (!roles.includes("ADMIN")) return { success: false, error: "Only Admins can manually archive applications." };

    const applicationId = String(formData.get("applicationId") ?? "").trim();
    if (!applicationId) return { success: false, error: "Missing applicationId." };

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.instructorApplication.update({
        where: { id: applicationId },
        data: { archivedAt: now },
      });
      await tx.instructorApplicationTimelineEvent.create({
        data: {
          applicationId,
          kind: "ARCHIVED",
          actorId: session.user.id,
          payload: { manual: true, archivedAt: now.toISOString() },
        },
      });
    });

    revalidatePath("/admin/instructor-applicants");
    return { success: true };
  } catch (error) {
    console.error("[archiveApplication]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

/**
 * Server-only cron helper — archives terminal applications older than 30 days.
 * Called from /api/admin/applicants/auto-archive (cron-protected route).
 * Idempotent: safe to run multiple times.
 */
export async function autoArchiveTerminalApplications(): Promise<{ archived: number }> {
  const TERMINAL_STATUSES: InstructorApplicationStatus[] = [
    InstructorApplicationStatus.APPROVED,
    InstructorApplicationStatus.REJECTED,
    InstructorApplicationStatus.WITHDRAWN,
  ];
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const candidates = await prisma.instructorApplication.findMany({
    where: {
      status: { in: TERMINAL_STATUSES },
      archivedAt: null,
      updatedAt: { lt: cutoff },
    },
    select: { id: true, status: true },
  });

  const now = new Date();
  let archived = 0;

  for (const app of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.instructorApplication.update({
          where: { id: app.id },
          data: { archivedAt: now },
        });
        await tx.instructorApplicationTimelineEvent.create({
          data: {
            applicationId: app.id,
            kind: "ARCHIVED",
            actorId: null,
            payload: { manual: false, reason: "auto-archive-30d" },
          },
        });
      });
      archived++;
    } catch (e) {
      console.error(`[autoArchiveTerminalApplications] failed for ${app.id}:`, e);
    }
  }

  return { archived };
}
