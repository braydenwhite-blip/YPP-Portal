"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import {
  ApplicationCohortType,
  PositionType,
  InstructorApplicationStatus,
  ChapterPresidentApplicationStatus,
} from "@prisma/client";
import {
  getLegacyApplicationTransitionError,
  type LegacyApplicationReviewAction,
} from "@/lib/legacy-application-review";
import {
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
  sendInstructorPreApprovedEmail,
  sendInfoRequestEmail,
  sendInterviewScheduledEmail,
} from "@/lib/email";

async function requireAdmin() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!session || !roles.includes("ADMIN")) {
    throw new Error("Unauthorized: Admin access required");
  }
  return session;
}

export async function getApplicationCohorts(
  type?: string,
  roleType?: string
) {
  await requireAdmin();

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (roleType) where.roleType = roleType;

  const cohorts = await prisma.applicationCohort.findMany({
    where,
    include: {
      _count: {
        select: {
          instructorApplications: true,
          chapterPresidentApplications: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return cohorts;
}

export async function createApplicationCohort(formData: FormData) {
  const session = await requireAdmin();

  const name = formData.get("name") as string;
  const type = formData.get("type") as ApplicationCohortType;
  const roleType = formData.get("roleType") as PositionType;

  if (!name || !type || !roleType) {
    throw new Error("Name, type, and role type are required");
  }

  await prisma.applicationCohort.create({
    data: {
      name,
      type,
      roleType,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/application-cohorts");
}

export async function addApplicationsToCohort(
  cohortId: string,
  applicationIds: string[],
  applicationType: "instructor" | "chapter_president"
) {
  await requireAdmin();

  if (applicationType === "instructor") {
    await prisma.instructorApplication.updateMany({
      where: { id: { in: applicationIds } },
      data: { cohortId },
    });
  } else {
    await prisma.chapterPresidentApplication.updateMany({
      where: { id: { in: applicationIds } },
      data: { cohortId },
    });
  }

  revalidatePath("/admin/application-cohorts");
}

export async function removeApplicationFromCohort(
  applicationId: string,
  applicationType: "instructor" | "chapter_president"
) {
  await requireAdmin();

  if (applicationType === "instructor") {
    await prisma.instructorApplication.update({
      where: { id: applicationId },
      data: { cohortId: null },
    });
  } else {
    await prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: { cohortId: null },
    });
  }

  revalidatePath("/admin/application-cohorts");
}

function deriveInstructorAction(
  newStatus: InstructorApplicationStatus
): LegacyApplicationReviewAction | null {
  switch (newStatus) {
    case InstructorApplicationStatus.UNDER_REVIEW:
      return "mark_under_review";
    case InstructorApplicationStatus.INFO_REQUESTED:
      return "request_info";
    case InstructorApplicationStatus.INTERVIEW_SCHEDULED:
      return "schedule_interview";
    case InstructorApplicationStatus.INTERVIEW_COMPLETED:
      return "mark_interview_complete";
    case InstructorApplicationStatus.APPROVED:
      return "approve";
    case InstructorApplicationStatus.REJECTED:
      return "reject";
    case InstructorApplicationStatus.ON_HOLD:
      return "put_on_hold";
    default:
      return null;
  }
}

function deriveCPAction(
  newStatus: ChapterPresidentApplicationStatus
): LegacyApplicationReviewAction | null {
  switch (newStatus) {
    case ChapterPresidentApplicationStatus.UNDER_REVIEW:
      return "mark_under_review";
    case ChapterPresidentApplicationStatus.INFO_REQUESTED:
      return "request_info";
    case ChapterPresidentApplicationStatus.INTERVIEW_SCHEDULED:
      return "schedule_interview";
    case ChapterPresidentApplicationStatus.INTERVIEW_COMPLETED:
      return "mark_interview_complete";
    case ChapterPresidentApplicationStatus.RECOMMENDATION_SUBMITTED:
      return "submit_recommendation";
    case ChapterPresidentApplicationStatus.APPROVED:
      return "approve";
    case ChapterPresidentApplicationStatus.REJECTED:
      return "reject";
    default:
      return null;
  }
}

export type BatchUpdateResult = {
  ok: true;
  total: number;
  updated: number;
  skipped: Array<{ id: string; reason: string }>;
  emailed: number;
  emailFailures: number;
} | {
  ok: false;
  error: string;
};

export async function batchUpdateStatus(
  cohortId: string,
  newStatus: string,
  applicationType: "instructor" | "chapter_president"
): Promise<BatchUpdateResult> {
  const session = await requireAdmin();
  const actorId = session.user.id;

  if (applicationType === "instructor") {
    if (!Object.values(InstructorApplicationStatus).includes(newStatus as InstructorApplicationStatus)) {
      return { ok: false, error: "Invalid status" };
    }
    const toStatus = newStatus as InstructorApplicationStatus;
    const action = deriveInstructorAction(toStatus);

    const apps = await prisma.instructorApplication.findMany({
      where: { cohortId },
      select: {
        id: true,
        status: true,
        applicant: { select: { id: true, email: true, name: true } },
      },
    });

    const skipped: Array<{ id: string; reason: string }> = [];
    const toEmail: Array<{ id: string; email: string; name: string }> = [];
    let updated = 0;

    for (const app of apps) {
      // Skip apps that can't legally transition to the target status.
      if (action !== null) {
        const err = getLegacyApplicationTransitionError({ status: app.status, action });
        if (err !== null) {
          skipped.push({ id: app.id, reason: err });
          continue;
        }
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.instructorApplication.update({
            where: { id: app.id },
            data: { status: toStatus },
          });
          await tx.instructorApplicationTimelineEvent.create({
            data: {
              applicationId: app.id,
              kind: "STATUS_CHANGE_BATCH",
              actorId,
              payload: {
                fromStatus: app.status,
                toStatus,
                cohortId,
                batchAction: true,
              },
            },
          });
        });
        updated++;
        toEmail.push({ id: app.id, email: app.applicant.email, name: app.applicant.name });
      } catch (e) {
        console.error(`[batchUpdateStatus] transaction failed for ${app.id}:`, e);
        skipped.push({ id: app.id, reason: "Transaction failed" });
      }
    }

    // Dispatch emails after all transactions commit.
    let emailed = 0;
    let emailFailures = 0;

    if (toStatus === InstructorApplicationStatus.APPROVED) {
      for (const a of toEmail) {
        try {
          await sendApplicationApprovedEmail({ to: a.email, applicantName: a.name });
          emailed++;
        } catch (e) {
          console.error(`[batchUpdateStatus] approval email failed for ${a.id}:`, e);
          emailFailures++;
        }
      }
    } else if (toStatus === InstructorApplicationStatus.REJECTED) {
      for (const a of toEmail) {
        try {
          await sendApplicationRejectedEmail({ to: a.email, applicantName: a.name, reason: "Batch cohort decision." });
          emailed++;
        } catch (e) {
          console.error(`[batchUpdateStatus] rejection email failed for ${a.id}:`, e);
          emailFailures++;
        }
      }
    } else if (toStatus === InstructorApplicationStatus.PRE_APPROVED) {
      const { getPublicAppUrl } = await import("@/lib/public-app-url");
      const baseUrl = getPublicAppUrl();
      for (const a of toEmail) {
        try {
          await sendInstructorPreApprovedEmail({ to: a.email, applicantName: a.name, trainingUrl: `${baseUrl}/instructor-training` });
          emailed++;
        } catch (e) {
          console.error(`[batchUpdateStatus] pre-approved email failed for ${a.id}:`, e);
          emailFailures++;
        }
      }
    } else if (toStatus === InstructorApplicationStatus.INFO_REQUESTED) {
      const { getBaseUrl } = await import("@/lib/portal-auth-utils");
      const baseUrl = await getBaseUrl();
      for (const a of toEmail) {
        try {
          await sendInfoRequestEmail({
            to: a.email,
            applicantName: a.name,
            message: "Please provide the requested follow-up information.",
            statusUrl: `${baseUrl}/application-status`,
          });
          emailed++;
        } catch (e) {
          console.error(`[batchUpdateStatus] info-request email failed for ${a.id}:`, e);
          emailFailures++;
        }
      }
    } else if (toStatus === InstructorApplicationStatus.INTERVIEW_SCHEDULED) {
      const { getBaseUrl } = await import("@/lib/portal-auth-utils");
      const baseUrl = await getBaseUrl();
      for (const a of toEmail) {
        try {
          await sendInterviewScheduledEmail({
            to: a.email,
            applicantName: a.name,
            scheduledAt: new Date(),
            statusUrl: `${baseUrl}/application-status`,
            variant: "instructor_application",
          });
          emailed++;
        } catch (e) {
          console.error(`[batchUpdateStatus] interview-scheduled email failed for ${a.id}:`, e);
          emailFailures++;
        }
      }
    }
    // No email for UNDER_REVIEW, CHAIR_REVIEW, INTERVIEW_COMPLETED, ON_HOLD, WITHDRAWN.

    revalidatePath("/admin/application-cohorts");
    return { ok: true, total: apps.length, updated, skipped, emailed, emailFailures };

  } else {
    // chapter_president branch — no timeline table in schema; email + validate only.
    if (!Object.values(ChapterPresidentApplicationStatus).includes(newStatus as ChapterPresidentApplicationStatus)) {
      return { ok: false, error: "Invalid status" };
    }
    const toStatus = newStatus as ChapterPresidentApplicationStatus;
    const action = deriveCPAction(toStatus);

    const apps = await prisma.chapterPresidentApplication.findMany({
      where: { cohortId },
      select: {
        id: true,
        status: true,
        applicant: { select: { id: true, email: true, name: true } },
      },
    });

    const skipped: Array<{ id: string; reason: string }> = [];
    const toEmail: Array<{ id: string; email: string; name: string }> = [];
    let updated = 0;

    for (const app of apps) {
      if (action !== null) {
        const err = getLegacyApplicationTransitionError({ status: app.status, action });
        if (err !== null) {
          skipped.push({ id: app.id, reason: err });
          continue;
        }
      }

      try {
        await prisma.chapterPresidentApplication.update({
          where: { id: app.id },
          data: { status: toStatus },
        });
        updated++;
        toEmail.push({ id: app.id, email: app.applicant.email, name: app.applicant.name });
      } catch (e) {
        console.error(`[batchUpdateStatus] CP update failed for ${app.id}:`, e);
        skipped.push({ id: app.id, reason: "Update failed" });
      }
    }

    let emailed = 0;
    let emailFailures = 0;

    if (toStatus === ChapterPresidentApplicationStatus.APPROVED) {
      for (const a of toEmail) {
        try {
          await sendApplicationApprovedEmail({ to: a.email, applicantName: a.name });
          emailed++;
        } catch (e) {
          console.error(`[batchUpdateStatus] CP approval email failed for ${a.id}:`, e);
          emailFailures++;
        }
      }
    } else if (toStatus === ChapterPresidentApplicationStatus.REJECTED) {
      for (const a of toEmail) {
        try {
          await sendApplicationRejectedEmail({ to: a.email, applicantName: a.name, reason: "Batch cohort decision." });
          emailed++;
        } catch (e) {
          console.error(`[batchUpdateStatus] CP rejection email failed for ${a.id}:`, e);
          emailFailures++;
        }
      }
    } else if (toStatus === ChapterPresidentApplicationStatus.INFO_REQUESTED) {
      const { getBaseUrl } = await import("@/lib/portal-auth-utils");
      const baseUrl = await getBaseUrl();
      for (const a of toEmail) {
        try {
          await sendInfoRequestEmail({
            to: a.email,
            applicantName: a.name,
            message: "Please provide the requested follow-up information.",
            statusUrl: `${baseUrl}/application-status`,
          });
          emailed++;
        } catch (e) {
          console.error(`[batchUpdateStatus] CP info-request email failed for ${a.id}:`, e);
          emailFailures++;
        }
      }
    } else if (toStatus === ChapterPresidentApplicationStatus.INTERVIEW_SCHEDULED) {
      const { getBaseUrl } = await import("@/lib/portal-auth-utils");
      const baseUrl = await getBaseUrl();
      for (const a of toEmail) {
        try {
          await sendInterviewScheduledEmail({
            to: a.email,
            applicantName: a.name,
            scheduledAt: new Date(),
            statusUrl: `${baseUrl}/application-status`,
          });
          emailed++;
        } catch (e) {
          console.error(`[batchUpdateStatus] CP interview-scheduled email failed for ${a.id}:`, e);
          emailFailures++;
        }
      }
    }

    revalidatePath("/admin/application-cohorts");
    return { ok: true, total: apps.length, updated, skipped, emailed, emailFailures };
  }
}
