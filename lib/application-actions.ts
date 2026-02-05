"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { ApplicationStatus, PositionType, RoleType } from "@prisma/client";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }
  return session;
}

async function requireAdminOrChapterLead() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_LEAD")) {
    throw new Error("Unauthorized - Admin or Chapter Lead access required");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

// ============================================
// POSITION MANAGEMENT (Admin only)
// ============================================

export async function createPosition(formData: FormData) {
  await requireAdmin();

  const title = getString(formData, "title");
  const type = getString(formData, "type") as PositionType;
  const description = getString(formData, "description", false);
  const requirements = getString(formData, "requirements", false);
  const chapterId = getString(formData, "chapterId", false);

  await prisma.position.create({
    data: {
      title,
      type,
      description: description || null,
      requirements: requirements || null,
      chapterId: chapterId || null,
      isOpen: true
    }
  });

  revalidatePath("/admin/positions");
  revalidatePath("/positions");
}

export async function closePosition(formData: FormData) {
  await requireAdmin();

  const positionId = getString(formData, "positionId");

  await prisma.position.update({
    where: { id: positionId },
    data: {
      isOpen: false,
      closedAt: new Date()
    }
  });

  revalidatePath("/admin/positions");
  revalidatePath("/positions");
}

export async function reopenPosition(formData: FormData) {
  await requireAdmin();

  const positionId = getString(formData, "positionId");

  await prisma.position.update({
    where: { id: positionId },
    data: {
      isOpen: true,
      closedAt: null
    }
  });

  revalidatePath("/admin/positions");
  revalidatePath("/positions");
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

  // Check if position is open
  const position = await prisma.position.findUnique({
    where: { id: positionId }
  });

  if (!position || !position.isOpen) {
    throw new Error("This position is no longer accepting applications");
  }

  // Check if user already applied
  const existingApplication = await prisma.application.findFirst({
    where: {
      positionId,
      applicantId
    }
  });

  if (existingApplication) {
    throw new Error("You have already applied to this position");
  }

  await prisma.application.create({
    data: {
      positionId,
      applicantId,
      coverLetter: coverLetter || null,
      resumeUrl: resumeUrl || null,
      additionalMaterials: additionalMaterials || null,
      status: "SUBMITTED"
    }
  });

  revalidatePath("/applications");
  revalidatePath("/admin/applications");
}

export async function withdrawApplication(formData: FormData) {
  const session = await requireAuth();
  const applicationId = getString(formData, "applicationId");

  const application = await prisma.application.findUnique({
    where: { id: applicationId }
  });

  if (!application || application.applicantId !== session.user.id) {
    throw new Error("Application not found");
  }

  if (application.status === "ACCEPTED" || application.status === "REJECTED") {
    throw new Error("Cannot withdraw a decided application");
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "WITHDRAWN" }
  });

  revalidatePath("/applications");
}

// ============================================
// APPLICATION REVIEW (Admin/Chapter Lead)
// ============================================

export async function updateApplicationStatus(formData: FormData) {
  await requireAdminOrChapterLead();

  const applicationId = getString(formData, "applicationId");
  const status = getString(formData, "status") as ApplicationStatus;

  if (!["UNDER_REVIEW", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(status)) {
    throw new Error("Invalid status for this action");
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: { status }
  });

  revalidatePath("/admin/applications");
}

export async function scheduleInterview(formData: FormData) {
  await requireAdminOrChapterLead();

  const applicationId = getString(formData, "applicationId");
  const scheduledAt = new Date(getString(formData, "scheduledAt"));
  const duration = Number(getString(formData, "duration", false) || "30");
  const meetingLink = getString(formData, "meetingLink", false);

  await prisma.$transaction([
    prisma.interviewSlot.create({
      data: {
        applicationId,
        scheduledAt,
        duration,
        meetingLink: meetingLink || null
      }
    }),
    prisma.application.update({
      where: { id: applicationId },
      data: { status: "INTERVIEW_SCHEDULED" }
    })
  ]);

  revalidatePath("/admin/applications");
  revalidatePath("/applications");
}

export async function addInterviewNote(formData: FormData) {
  const session = await requireAdminOrChapterLead();

  const applicationId = getString(formData, "applicationId");
  const content = getString(formData, "content");
  const rating = getString(formData, "rating", false);

  await prisma.interviewNote.create({
    data: {
      applicationId,
      authorId: session.user.id,
      content,
      rating: rating ? Number(rating) : null
    }
  });

  revalidatePath(`/admin/applications/${applicationId}`);
}

export async function makeDecision(formData: FormData) {
  const session = await requireAdmin();

  const applicationId = getString(formData, "applicationId");
  const accepted = formData.get("accepted") === "true";
  const notes = getString(formData, "notes", false);

  // Create decision
  await prisma.$transaction(async (tx) => {
    await tx.decision.create({
      data: {
        applicationId,
        decidedById: session.user.id,
        accepted,
        notes: notes || null
      }
    });

    await tx.application.update({
      where: { id: applicationId },
      data: { status: accepted ? "ACCEPTED" : "REJECTED" }
    });

    // If accepted, convert user role
    if (accepted) {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
        include: { position: true }
      });

      if (application) {
        const roleMap: Record<PositionType, RoleType> = {
          INSTRUCTOR: "INSTRUCTOR",
          CHAPTER_PRESIDENT: "CHAPTER_LEAD",
          MENTOR: "MENTOR",
          STAFF: "STAFF",
          GLOBAL_ADMIN: "ADMIN"
        };

        const newRole = roleMap[application.position.type];

        // Audit log: track role escalation
        await tx.analyticsEvent.create({
          data: {
            userId: session.user.id,
            eventType: "role_escalation",
            eventData: {
              action: "grant_role",
              targetUserId: application.applicantId,
              newRole,
              positionType: application.position.type,
              applicationId,
              decidedBy: session.user.id,
            },
          },
        });

        // Add role to user
        await tx.userRole.upsert({
          where: {
            userId_role: {
              userId: application.applicantId,
              role: newRole
            }
          },
          create: {
            userId: application.applicantId,
            role: newRole
          },
          update: {}
        });

        // Update chapter if position has one
        if (application.position.chapterId) {
          await tx.user.update({
            where: { id: application.applicantId },
            data: { chapterId: application.position.chapterId }
          });
        }
      }
    }
  });

  revalidatePath("/admin/applications");
  revalidatePath("/applications");
}

// ============================================
// INTERVIEW SLOT MANAGEMENT
// ============================================

export async function confirmInterviewSlot(formData: FormData) {
  const session = await requireAuth();
  const slotId = getString(formData, "slotId");

  const slot = await prisma.interviewSlot.findUnique({
    where: { id: slotId },
    include: { application: true }
  });

  if (!slot || slot.application.applicantId !== session.user.id) {
    throw new Error("Interview slot not found");
  }

  await prisma.interviewSlot.update({
    where: { id: slotId },
    data: { isConfirmed: true }
  });

  revalidatePath("/applications");
}
