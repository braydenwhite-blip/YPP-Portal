"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import {
  ApplicationStatus,
  HiringRecommendation,
  Prisma,
  PositionType,
  PositionVisibility,
  RoleType,
} from "@prisma/client";
import {
  assertAdminOrChapterLead,
  assertCanMakeChapterDecision,
  assertCanManagePosition,
  getHiringActor,
  isAdmin,
} from "@/lib/chapter-hiring-permissions";
import { createSystemNotification } from "@/lib/notification-actions";

const REVIEWABLE_APPLICATION_STATUSES: ApplicationStatus[] = [
  "UNDER_REVIEW",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
];

const FINAL_APPLICATION_STATUSES: ApplicationStatus[] = [
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdmin() {
  const session = await requireAuth();
  const actor = await getHiringActor(session.user.id);
  if (!isAdmin(actor)) {
    throw new Error("Unauthorized - Admin access required");
  }
  return { session, actor };
}

async function requireAdminOrChapterLead() {
  const session = await requireAuth();
  const actor = await getHiringActor(session.user.id);
  assertAdminOrChapterLead(actor);
  return { session, actor };
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getOptionalDate(rawValue: string): Date | null {
  if (!rawValue) return null;
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date value");
  }
  return parsed;
}

function parsePositionType(raw: string): PositionType {
  if (!["INSTRUCTOR", "CHAPTER_PRESIDENT", "MENTOR", "STAFF", "GLOBAL_ADMIN"].includes(raw)) {
    throw new Error("Invalid position type");
  }
  return raw as PositionType;
}

function parsePositionVisibility(raw: string): PositionVisibility {
  const value = raw || "CHAPTER_ONLY";
  if (!["CHAPTER_ONLY", "NETWORK_WIDE", "PUBLIC"].includes(value)) {
    throw new Error("Invalid position visibility");
  }
  return value as PositionVisibility;
}

function parseHiringRecommendation(raw: string): HiringRecommendation | null {
  if (!raw) return null;
  if (!["STRONG_YES", "YES", "MAYBE", "NO"].includes(raw)) {
    throw new Error("Invalid interview recommendation");
  }
  return raw as HiringRecommendation;
}

function parseBoolean(formData: FormData, key: string, fallback = false): boolean {
  const raw = formData.get(key);
  if (raw === null) return fallback;
  const value = String(raw).toLowerCase();
  return value === "on" || value === "true" || value === "1" || value === "yes";
}

function ensureValidApplicationDeadline(deadline: Date | null) {
  if (!deadline) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (deadline < today) {
    throw new Error("Application deadline must be today or in the future.");
  }
}

function roleForPosition(type: PositionType): RoleType {
  const roleMap: Record<PositionType, RoleType> = {
    INSTRUCTOR: "INSTRUCTOR",
    CHAPTER_PRESIDENT: "CHAPTER_LEAD",
    MENTOR: "MENTOR",
    STAFF: "STAFF",
    GLOBAL_ADMIN: "ADMIN",
  };
  return roleMap[type];
}

async function createHiringAudit(
  actorId: string,
  eventType: string,
  eventData: Prisma.InputJsonObject
) {
  await prisma.analyticsEvent.create({
    data: {
      userId: actorId,
      eventType,
      eventData,
    },
  });
}

function revalidateHiringPaths(chapterId?: string | null, applicationId?: string) {
  revalidatePath("/positions");
  revalidatePath("/applications");
  revalidatePath("/chapter/recruiting");
  revalidatePath("/chapter/applicants");
  revalidatePath("/admin/applications");

  if (chapterId) {
    revalidatePath("/chapter");
    revalidatePath("/chapter/recruiting");
  }

  if (applicationId) {
    revalidatePath(`/applications/${applicationId}`);
  }
}

async function getApplicationForReview(applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      applicant: {
        select: { id: true, name: true, email: true },
      },
      position: {
        select: {
          id: true,
          title: true,
          type: true,
          chapterId: true,
          interviewRequired: true,
          visibility: true,
          openedById: true,
          hiringLeadId: true,
        },
      },
      interviewSlots: {
        orderBy: { scheduledAt: "asc" },
      },
      interviewNotes: {
        orderBy: { createdAt: "desc" },
      },
      decision: true,
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  return application;
}

async function setApplicationInterviewReadinessInternal(applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      position: {
        select: {
          interviewRequired: true,
        },
      },
      interviewSlots: {
        select: {
          status: true,
          completedAt: true,
          isConfirmed: true,
        },
      },
      interviewNotes: {
        select: {
          recommendation: true,
        },
      },
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  if (FINAL_APPLICATION_STATUSES.includes(application.status)) {
    return {
      ready: true,
      reason: "Application already finalized.",
    };
  }

  if (!application.position.interviewRequired) {
    return {
      ready: true,
      reason: "Interview not required for this position.",
    };
  }

  const hasCompletedInterview = application.interviewSlots.some(
    (slot) => slot.status === "COMPLETED" || Boolean(slot.completedAt)
  );

  const hasRecommendation = application.interviewNotes.some(
    (note) => note.recommendation !== null
  );

  const hasInterviewActivity = application.interviewSlots.some(
    (slot) => slot.status !== "CANCELLED" || slot.isConfirmed
  );

  const ready = hasCompletedInterview && hasRecommendation;

  const nextStatus: ApplicationStatus = ready
    ? "INTERVIEW_COMPLETED"
    : hasInterviewActivity
      ? "INTERVIEW_SCHEDULED"
      : "UNDER_REVIEW";

  if (application.status !== nextStatus) {
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: nextStatus },
    });
  }

  return {
    ready,
    reason: ready
      ? "Interview and recommendation are complete."
      : "Interview completion and recommendation are required before decision.",
  };
}

async function applyAcceptedCandidateEffects(
  tx: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  application: {
    id: string;
    applicantId: string;
    position: { type: PositionType; chapterId: string | null };
    interviewSlots: Array<{ status: string; isConfirmed: boolean }>;
    interviewNotes: Array<{ recommendation: HiringRecommendation | null }>;
  },
  decidedById: string
) {
  const newRole = roleForPosition(application.position.type);

  await tx.analyticsEvent.create({
    data: {
      userId: decidedById,
      eventType: "role_escalation",
      eventData: {
        action: "grant_role",
        targetUserId: application.applicantId,
        newRole,
        positionType: application.position.type,
        applicationId: application.id,
        decidedBy: decidedById,
      },
    },
  });

  await tx.userRole.upsert({
    where: {
      userId_role: {
        userId: application.applicantId,
        role: newRole,
      },
    },
    create: {
      userId: application.applicantId,
      role: newRole,
    },
    update: {},
  });

  if (application.position.chapterId) {
    await tx.user.update({
      where: { id: application.applicantId },
      data: { chapterId: application.position.chapterId },
    });
  }

  if (application.position.type === "INSTRUCTOR") {
    const hasCompletedInterviewEvidence =
      application.interviewNotes.some((note) => note.recommendation !== null) ||
      application.interviewSlots.some(
        (slot) => slot.status === "COMPLETED" || slot.isConfirmed
      );

    await tx.instructorInterviewGate.upsert({
      where: { instructorId: application.applicantId },
      create: {
        instructorId: application.applicantId,
        status: hasCompletedInterviewEvidence ? "PASSED" : "REQUIRED",
        outcome: hasCompletedInterviewEvidence ? "PASS" : null,
        completedAt: hasCompletedInterviewEvidence ? new Date() : null,
        reviewedById: hasCompletedInterviewEvidence ? decidedById : null,
        reviewedAt: hasCompletedInterviewEvidence ? new Date() : null,
        reviewNotes: hasCompletedInterviewEvidence
          ? "Auto-passed from accepted instructor application interview evidence."
          : "Accepted instructor application requires native interview gate completion.",
      },
      update: {
        status: hasCompletedInterviewEvidence ? "PASSED" : "REQUIRED",
        outcome: hasCompletedInterviewEvidence ? "PASS" : null,
        completedAt: hasCompletedInterviewEvidence ? new Date() : null,
        reviewedById: hasCompletedInterviewEvidence ? decidedById : null,
        reviewedAt: hasCompletedInterviewEvidence ? new Date() : null,
        reviewNotes: hasCompletedInterviewEvidence
          ? "Auto-passed from accepted instructor application interview evidence."
          : "Accepted instructor application requires native interview gate completion.",
      },
    });
  }
}

async function finalizeDecision({
  applicationId,
  accepted,
  notes,
  decidedById,
  enforceInterviewReadiness,
}: {
  applicationId: string;
  accepted: boolean;
  notes?: string | null;
  decidedById: string;
  enforceInterviewReadiness: boolean;
}) {
  const application = await getApplicationForReview(applicationId);

  if (application.decision) {
    throw new Error("A final decision already exists for this application.");
  }

  if (application.position.interviewRequired && enforceInterviewReadiness) {
    const readiness = await setApplicationInterviewReadinessInternal(applicationId);
    if (!readiness.ready) {
      throw new Error(readiness.reason);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.decision.create({
      data: {
        applicationId,
        decidedById,
        accepted,
        notes: notes || null,
      },
    });

    await tx.application.update({
      where: { id: applicationId },
      data: { status: accepted ? "ACCEPTED" : "REJECTED" },
    });

    if (accepted) {
      await applyAcceptedCandidateEffects(
        tx,
        {
          id: application.id,
          applicantId: application.applicantId,
          position: application.position,
          interviewSlots: application.interviewSlots.map((slot) => ({
            status: slot.status,
            isConfirmed: slot.isConfirmed,
          })),
          interviewNotes: application.interviewNotes.map((note) => ({
            recommendation: note.recommendation,
          })),
        },
        decidedById
      );
    }
  });

  await createSystemNotification(
    application.applicantId,
    "SYSTEM",
    accepted ? "Application Accepted" : "Application Decision Posted",
    accepted
      ? `Your application for ${application.position.title} was accepted.`
      : `Your application for ${application.position.title} has been reviewed.`,
    `/applications/${applicationId}`,
    true
  );

  await createHiringAudit(decidedById, "chapter_hiring_decision", {
    applicationId,
    accepted,
    positionType: application.position.type,
    chapterId: application.position.chapterId,
    enforceInterviewReadiness,
  });

  revalidateHiringPaths(application.position.chapterId, applicationId);
}

// ============================================
// POSITION MANAGEMENT (Admin and Chapter Leads)
// ============================================

export async function createPosition(formData: FormData) {
  const { session, actor } = await requireAdmin();

  const title = getString(formData, "title");
  const type = parsePositionType(getString(formData, "type"));
  const description = getString(formData, "description", false);
  const requirements = getString(formData, "requirements", false);
  const chapterId = getString(formData, "chapterId", false) || null;
  const visibility = parsePositionVisibility(getString(formData, "visibility", false));
  const interviewRequired = parseBoolean(formData, "interviewRequired", true);
  const targetStartDate = getOptionalDate(getString(formData, "targetStartDate", false));
  const applicationDeadline = getOptionalDate(getString(formData, "applicationDeadline", false));
  const hiringLeadId = getString(formData, "hiringLeadId", false) || null;

  ensureValidApplicationDeadline(applicationDeadline);

  await prisma.position.create({
    data: {
      title,
      type,
      description: description || null,
      requirements: requirements || null,
      chapterId,
      openedById: session.user.id,
      hiringLeadId,
      visibility,
      interviewRequired,
      targetStartDate,
      applicationDeadline,
      isOpen: true,
    },
  });

  await createHiringAudit(actor.id, "chapter_hiring_position_create", {
    title,
    type,
    chapterId,
    visibility,
    interviewRequired,
  });

  revalidateHiringPaths(chapterId);
}

export async function createChapterPosition(formData: FormData) {
  const { session, actor } = await requireAdminOrChapterLead();

  const title = getString(formData, "title");
  const type = parsePositionType(getString(formData, "type"));
  const description = getString(formData, "description", false);
  const requirements = getString(formData, "requirements", false);
  const requestedChapterId = getString(formData, "chapterId", false) || null;
  const chapterId = isAdmin(actor) ? requestedChapterId : actor.chapterId;
  const visibility = parsePositionVisibility(getString(formData, "visibility", false));
  const interviewRequired = parseBoolean(formData, "interviewRequired", true);
  const targetStartDate = getOptionalDate(getString(formData, "targetStartDate", false));
  const applicationDeadline = getOptionalDate(getString(formData, "applicationDeadline", false));
  const requestedHiringLeadId = getString(formData, "hiringLeadId", false) || null;
  const hiringLeadId = isAdmin(actor) ? requestedHiringLeadId : actor.id;

  if (!chapterId) {
    throw new Error("Chapter hiring positions must be attached to a chapter.");
  }

  ensureValidApplicationDeadline(applicationDeadline);
  assertCanManagePosition(actor, chapterId);

  await prisma.position.create({
    data: {
      title,
      type,
      description: description || null,
      requirements: requirements || null,
      chapterId,
      openedById: session.user.id,
      hiringLeadId,
      visibility,
      interviewRequired,
      targetStartDate,
      applicationDeadline,
      isOpen: true,
    },
  });

  await createHiringAudit(actor.id, "chapter_hiring_position_create", {
    title,
    type,
    chapterId,
    visibility,
    interviewRequired,
  });

  revalidateHiringPaths(chapterId);
}

export async function updateChapterPosition(formData: FormData) {
  const { actor } = await requireAdminOrChapterLead();

  const positionId = getString(formData, "positionId");
  const existing = await prisma.position.findUnique({
    where: { id: positionId },
    select: { id: true, chapterId: true },
  });

  if (!existing) {
    throw new Error("Position not found");
  }

  assertCanManagePosition(actor, existing.chapterId);

  const title = getString(formData, "title");
  const type = parsePositionType(getString(formData, "type"));
  const description = getString(formData, "description", false);
  const requirements = getString(formData, "requirements", false);
  const visibility = parsePositionVisibility(getString(formData, "visibility", false));
  const interviewRequired = parseBoolean(formData, "interviewRequired", true);
  const targetStartDate = getOptionalDate(getString(formData, "targetStartDate", false));
  const applicationDeadline = getOptionalDate(getString(formData, "applicationDeadline", false));

  ensureValidApplicationDeadline(applicationDeadline);

  const requestedHiringLeadId = getString(formData, "hiringLeadId", false) || null;
  const requestedChapterId = getString(formData, "chapterId", false) || null;

  const nextChapterId = isAdmin(actor) ? requestedChapterId || existing.chapterId : existing.chapterId;
  const nextHiringLeadId = isAdmin(actor) ? requestedHiringLeadId : actor.id;

  await prisma.position.update({
    where: { id: positionId },
    data: {
      title,
      type,
      description: description || null,
      requirements: requirements || null,
      chapterId: nextChapterId,
      hiringLeadId: nextHiringLeadId,
      visibility,
      interviewRequired,
      targetStartDate,
      applicationDeadline,
    },
  });

  await createHiringAudit(actor.id, "chapter_hiring_position_update", {
    positionId,
    chapterId: nextChapterId,
    type,
    visibility,
    interviewRequired,
  });

  revalidateHiringPaths(nextChapterId);
}

export async function closeChapterPosition(formData: FormData) {
  const { actor } = await requireAdminOrChapterLead();

  const positionId = getString(formData, "positionId");
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: { id: true, chapterId: true },
  });

  if (!position) {
    throw new Error("Position not found");
  }

  assertCanManagePosition(actor, position.chapterId);

  await prisma.position.update({
    where: { id: positionId },
    data: {
      isOpen: false,
      closedAt: new Date(),
    },
  });

  await createHiringAudit(actor.id, "chapter_hiring_position_close", {
    positionId,
    chapterId: position.chapterId,
  });

  revalidateHiringPaths(position.chapterId);
}

export async function reopenChapterPosition(formData: FormData) {
  const { actor } = await requireAdminOrChapterLead();

  const positionId = getString(formData, "positionId");
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: { id: true, chapterId: true },
  });

  if (!position) {
    throw new Error("Position not found");
  }

  assertCanManagePosition(actor, position.chapterId);

  await prisma.position.update({
    where: { id: positionId },
    data: {
      isOpen: true,
      closedAt: null,
    },
  });

  await createHiringAudit(actor.id, "chapter_hiring_position_reopen", {
    positionId,
    chapterId: position.chapterId,
  });

  revalidateHiringPaths(position.chapterId);
}

export async function updatePositionVisibility(formData: FormData) {
  const { actor } = await requireAdminOrChapterLead();

  const positionId = getString(formData, "positionId");
  const visibility = parsePositionVisibility(getString(formData, "visibility"));

  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: { chapterId: true },
  });

  if (!position) {
    throw new Error("Position not found");
  }

  assertCanManagePosition(actor, position.chapterId);

  await prisma.position.update({
    where: { id: positionId },
    data: { visibility },
  });

  await createHiringAudit(actor.id, "chapter_hiring_position_visibility", {
    positionId,
    visibility,
    chapterId: position.chapterId,
  });

  revalidateHiringPaths(position.chapterId);
}

// Backward-compatible admin wrappers.
export async function closePosition(formData: FormData) {
  return closeChapterPosition(formData);
}

export async function reopenPosition(formData: FormData) {
  return reopenChapterPosition(formData);
}

// ============================================
// APPLICATION SUBMISSION
// ============================================

export async function submitApplication(formData: FormData) {
  const session = await requireAuth();
  const applicantId = session.user.id;

  const positionId = getString(formData, "positionId");
  const coverLetter = getString(formData, "coverLetter", false);
  const resumeUrl = getString(formData, "resumeUrl", false);
  const additionalMaterials = getString(formData, "additionalMaterials", false);

  const position = await prisma.position.findUnique({
    where: { id: positionId },
    select: {
      id: true,
      title: true,
      chapterId: true,
      openedById: true,
      hiringLeadId: true,
      isOpen: true,
      applicationDeadline: true,
    },
  });

  if (!position || !position.isOpen) {
    throw new Error("This position is no longer accepting applications");
  }

  if (position.applicationDeadline && position.applicationDeadline < new Date()) {
    throw new Error("This position is no longer accepting applications.");
  }

  const existingApplication = await prisma.application.findFirst({
    where: {
      positionId,
      applicantId,
    },
  });

  if (existingApplication) {
    throw new Error("You have already applied to this position");
  }

  const created = await prisma.application.create({
    data: {
      positionId,
      applicantId,
      coverLetter: coverLetter || null,
      resumeUrl: resumeUrl || null,
      additionalMaterials: additionalMaterials || null,
      status: "SUBMITTED",
    },
  });

  const notifyReviewerIds = Array.from(
    new Set([position.openedById, position.hiringLeadId].filter(Boolean) as string[])
  );

  for (const reviewerId of notifyReviewerIds) {
    await createSystemNotification(
      reviewerId,
      "SYSTEM",
      "New Chapter Hiring Application",
      `A new application was submitted for ${position.title}.`,
      `/applications/${created.id}`,
      true
    );
  }

  revalidateHiringPaths(position.chapterId, created.id);
}

export async function withdrawApplication(formData: FormData) {
  const session = await requireAuth();
  const applicationId = getString(formData, "applicationId");

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      position: {
        select: {
          chapterId: true,
        },
      },
    },
  });

  if (!application || application.applicantId !== session.user.id) {
    throw new Error("Application not found");
  }

  if (application.status === "ACCEPTED" || application.status === "REJECTED") {
    throw new Error("Cannot withdraw a decided application");
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "WITHDRAWN" },
  });

  revalidateHiringPaths(application.position.chapterId, applicationId);
}

// ============================================
// APPLICATION REVIEW (Admin/Chapter Lead)
// ============================================

export async function updateApplicationStatus(formData: FormData) {
  const { actor } = await requireAdminOrChapterLead();

  const applicationId = getString(formData, "applicationId");
  const status = getString(formData, "status") as ApplicationStatus;

  if (!REVIEWABLE_APPLICATION_STATUSES.includes(status)) {
    throw new Error("Invalid status for this action");
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      position: {
        select: {
          chapterId: true,
        },
      },
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  assertCanManagePosition(actor, application.position.chapterId);

  await prisma.application.update({
    where: { id: applicationId },
    data: { status },
  });

  await createHiringAudit(actor.id, "chapter_hiring_application_status", {
    applicationId,
    status,
    chapterId: application.position.chapterId,
  });

  revalidateHiringPaths(application.position.chapterId, applicationId);
}

export async function postApplicationInterviewSlot(formData: FormData) {
  const { actor } = await requireAdminOrChapterLead();

  const applicationId = getString(formData, "applicationId");
  const scheduledAt = new Date(getString(formData, "scheduledAt"));
  const duration = Number(getString(formData, "duration", false) || "30");
  const meetingLink = getString(formData, "meetingLink", false);
  const interviewerIdRaw = getString(formData, "interviewerId", false);

  if (!Number.isFinite(scheduledAt.getTime())) {
    throw new Error("Invalid interview scheduledAt value");
  }

  const application = await getApplicationForReview(applicationId);
  assertCanManagePosition(actor, application.position.chapterId);

  if (application.decision) {
    throw new Error("Cannot schedule interview after a final decision.");
  }

  const interviewerId = interviewerIdRaw || actor.id;

  await prisma.$transaction([
    prisma.interviewSlot.create({
      data: {
        applicationId,
        status: "POSTED",
        scheduledAt,
        duration,
        meetingLink: meetingLink || null,
        interviewerId,
      },
    }),
    prisma.application.update({
      where: { id: applicationId },
      data: { status: "INTERVIEW_SCHEDULED" },
    }),
  ]);

  await createSystemNotification(
    application.applicantId,
    "SYSTEM",
    "Interview Slot Posted",
    `A new interview slot was posted for ${application.position.title}.`,
    `/applications/${applicationId}`,
    true
  );

  await createHiringAudit(actor.id, "chapter_hiring_interview_slot_posted", {
    applicationId,
    chapterId: application.position.chapterId,
    scheduledAt: scheduledAt.toISOString(),
    duration,
    interviewerId,
  });

  revalidateHiringPaths(application.position.chapterId, applicationId);
}

export async function confirmApplicationInterviewSlot(formData: FormData) {
  const session = await requireAuth();
  const slotId = getString(formData, "slotId");

  const slot = await prisma.interviewSlot.findUnique({
    where: { id: slotId },
    include: {
      application: {
        include: {
          applicant: {
            select: {
              name: true,
            },
          },
          position: {
            select: {
              chapterId: true,
              title: true,
              openedById: true,
              hiringLeadId: true,
            },
          },
        },
      },
    },
  });

  if (!slot || slot.application.applicantId !== session.user.id) {
    throw new Error("Interview slot not found");
  }

  if (slot.status !== "POSTED") {
    throw new Error("Only posted interview slots can be confirmed.");
  }

  const alreadyConfirmed = await prisma.interviewSlot.findFirst({
    where: {
      applicationId: slot.applicationId,
      status: "CONFIRMED",
      id: { not: slot.id },
    },
    select: { id: true },
  });

  if (alreadyConfirmed) {
    throw new Error("This application already has a confirmed interview slot.");
  }

  await prisma.$transaction([
    prisma.interviewSlot.update({
      where: { id: slotId },
      data: {
        status: "CONFIRMED",
        isConfirmed: true,
        confirmedAt: new Date(),
      },
    }),
    prisma.application.update({
      where: { id: slot.applicationId },
      data: { status: "INTERVIEW_SCHEDULED" },
    }),
  ]);

  const reviewerIds = Array.from(
    new Set([slot.application.position.openedById, slot.application.position.hiringLeadId].filter(Boolean) as string[])
  );

  for (const reviewerId of reviewerIds) {
    await createSystemNotification(
      reviewerId,
      "SYSTEM",
      "Interview Slot Confirmed",
      `${slot.application.applicant.name} confirmed an interview slot for ${slot.application.position.title}.`,
      `/applications/${slot.applicationId}`,
      true
    );
  }

  revalidateHiringPaths(slot.application.position.chapterId, slot.applicationId);
}

export async function cancelApplicationInterviewSlot(formData: FormData) {
  const { actor } = await requireAdminOrChapterLead();

  const slotId = getString(formData, "slotId");

  const slot = await prisma.interviewSlot.findUnique({
    where: { id: slotId },
    include: {
      application: {
        include: {
          applicant: {
            select: { id: true },
          },
          position: {
            select: {
              chapterId: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!slot) {
    throw new Error("Interview slot not found");
  }

  assertCanManagePosition(actor, slot.application.position.chapterId);

  if (slot.status === "COMPLETED") {
    throw new Error("Completed interview slots cannot be cancelled.");
  }

  await prisma.interviewSlot.update({
    where: { id: slotId },
    data: {
      status: "CANCELLED",
      isConfirmed: false,
    },
  });

  await createSystemNotification(
    slot.application.applicantId,
    "SYSTEM",
    "Interview Slot Cancelled",
    `An interview slot for ${slot.application.position.title} was cancelled.`,
    `/applications/${slot.applicationId}`,
    true
  );

  await createHiringAudit(actor.id, "chapter_hiring_interview_slot_cancelled", {
    slotId,
    applicationId: slot.applicationId,
    chapterId: slot.application.position.chapterId,
  });

  revalidateHiringPaths(slot.application.position.chapterId, slot.applicationId);
}

export async function markApplicationInterviewCompleted(formData: FormData) {
  const { actor } = await requireAdminOrChapterLead();

  const slotId = getString(formData, "slotId");

  const slot = await prisma.interviewSlot.findUnique({
    where: { id: slotId },
    include: {
      application: {
        include: {
          applicant: {
            select: { id: true },
          },
          position: {
            select: {
              chapterId: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!slot) {
    throw new Error("Interview slot not found");
  }

  assertCanManagePosition(actor, slot.application.position.chapterId);

  if (slot.status !== "CONFIRMED") {
    throw new Error("Only confirmed interview slots can be marked complete.");
  }

  await prisma.interviewSlot.update({
    where: { id: slotId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      isConfirmed: true,
    },
  });

  await setApplicationInterviewReadinessInternal(slot.applicationId);

  await createSystemNotification(
    slot.application.applicantId,
    "SYSTEM",
    "Interview Completed",
    `Your interview for ${slot.application.position.title} was marked complete.`,
    `/applications/${slot.applicationId}`,
    true
  );

  await createHiringAudit(actor.id, "chapter_hiring_interview_completed", {
    slotId,
    applicationId: slot.applicationId,
    chapterId: slot.application.position.chapterId,
  });

  revalidateHiringPaths(slot.application.position.chapterId, slot.applicationId);
}

export async function saveStructuredInterviewNote(formData: FormData) {
  const { actor } = await requireAdminOrChapterLead();

  const applicationId = getString(formData, "applicationId");
  const content = getString(formData, "content");
  const ratingRaw = getString(formData, "rating", false);
  const recommendationRaw = getString(formData, "recommendation", false);
  const strengths = getString(formData, "strengths", false);
  const concerns = getString(formData, "concerns", false);
  const nextStepSuggestion = getString(formData, "nextStepSuggestion", false);

  const application = await getApplicationForReview(applicationId);
  assertCanManagePosition(actor, application.position.chapterId);

  await prisma.interviewNote.create({
    data: {
      applicationId,
      authorId: actor.id,
      content,
      rating: ratingRaw ? Number(ratingRaw) : null,
      recommendation: parseHiringRecommendation(recommendationRaw),
      strengths: strengths || null,
      concerns: concerns || null,
      nextStepSuggestion: nextStepSuggestion || null,
    },
  });

  await setApplicationInterviewReadinessInternal(applicationId);

  await createHiringAudit(actor.id, "chapter_hiring_interview_note", {
    applicationId,
    chapterId: application.position.chapterId,
    hasRecommendation: Boolean(recommendationRaw),
  });

  revalidateHiringPaths(application.position.chapterId, applicationId);
}

export async function setApplicationInterviewReadiness(formData: FormData) {
  const { actor } = await requireAdminOrChapterLead();

  const applicationId = getString(formData, "applicationId");
  const application = await getApplicationForReview(applicationId);
  assertCanManagePosition(actor, application.position.chapterId);

  await setApplicationInterviewReadinessInternal(applicationId);

  await createHiringAudit(actor.id, "chapter_hiring_interview_readiness_sync", {
    applicationId,
    chapterId: application.position.chapterId,
  });

  revalidateHiringPaths(application.position.chapterId, applicationId);
}

// Backward-compatible wrappers.
export async function scheduleInterview(formData: FormData) {
  return postApplicationInterviewSlot(formData);
}

export async function addInterviewNote(formData: FormData) {
  return saveStructuredInterviewNote(formData);
}

// ============================================
// DECISIONS
// ============================================

export async function makeDecision(formData: FormData) {
  const { session } = await requireAdmin();

  const applicationId = getString(formData, "applicationId");
  const accepted = parseBoolean(formData, "accepted");
  const notes = getString(formData, "notes", false);

  await finalizeDecision({
    applicationId,
    accepted,
    notes,
    decidedById: session.user.id,
    enforceInterviewReadiness: false,
  });
}

export async function chapterMakeDecision(formData: FormData) {
  const { actor } = await requireAdminOrChapterLead();

  const applicationId = getString(formData, "applicationId");
  const accepted = parseBoolean(formData, "accepted");
  const notes = getString(formData, "notes", false);

  const application = await getApplicationForReview(applicationId);

  assertCanMakeChapterDecision(
    actor,
    application.position.type,
    application.position.chapterId
  );

  if (application.position.type === "GLOBAL_ADMIN") {
    throw new Error("Only admins can decide GLOBAL_ADMIN applications.");
  }

  if (application.position.interviewRequired) {
    const readiness = await setApplicationInterviewReadinessInternal(applicationId);
    if (!readiness.ready) {
      throw new Error(readiness.reason);
    }
  }

  const hasRecommendation = application.interviewNotes.some(
    (note) => note.recommendation !== null
  );
  if (!hasRecommendation) {
    throw new Error("At least one interview note with recommendation is required.");
  }

  await finalizeDecision({
    applicationId,
    accepted,
    notes,
    decidedById: actor.id,
    enforceInterviewReadiness: true,
  });
}

// ============================================
// INTERVIEW SLOT MANAGEMENT (Applicant)
// ============================================

export async function confirmInterviewSlot(formData: FormData) {
  return confirmApplicationInterviewSlot(formData);
}
