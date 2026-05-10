"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization-helpers";
import { isOfferingPubliclyVisible } from "@/lib/class-visibility";
import { promoteNextWaitlistedRaceSafe } from "@/lib/class-seat-allocation";

/**
 * Admin-only class operations.
 *
 * Lives alongside lib/offering-approval-actions.ts (which is ADMIN/CHAPTER_PRESIDENT)
 * and lib/class-management-actions.ts (which is INSTRUCTOR/ADMIN). This module
 * is strictly ADMIN — it powers the /admin/classes operations dashboard and
 * provides actions admins need that the instructor surface does not expose:
 * publish/unpublish, cancel, complete, capacity adjustment, and roster
 * enrollment status changes.
 *
 * Every exported action enforces the ADMIN role server-side so direct route
 * access cannot bypass UI gating.
 */

const ADMIN_REVALIDATE_PATHS = [
  "/admin/classes",
  "/admin/instructor-readiness",
  "/curriculum",
  "/my-classes",
];

function revalidateAdminClassSurfaces(offeringId?: string) {
  for (const path of ADMIN_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  if (offeringId) {
    revalidatePath(`/admin/classes/${offeringId}`);
    revalidatePath(`/admin/classes/${offeringId}/roster`);
    revalidatePath(`/curriculum/${offeringId}`);
  }
}

function getString(formData: FormData, key: string, required = true): string {
  const raw = formData.get(key);
  const value = raw == null ? "" : String(raw).trim();
  if (required && !value) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value;
}

function getInt(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw == null || String(raw).trim() === "") return null;
  const parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadOfferingOrThrow(offeringId: string) {
  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    select: {
      id: true,
      status: true,
      enrollmentOpen: true,
      capacity: true,
      grandfatheredTrainingExemption: true,
      instructorId: true,
      title: true,
      deliveryMode: true,
      locationName: true,
      locationAddress: true,
      zoomLink: true,
      chapterId: true,
      approval: { select: { status: true } },
    },
  });
  if (!offering) {
    throw new Error("Class offering not found.");
  }
  return offering;
}

/**
 * Admin publishes an approved offering. Splits the "approve and publish"
 * actions cleanly: approval is granted via offering-approval-actions; this
 * action only flips the offering live. Refuses to publish without approval.
 */
export async function adminPublishClassOffering(formData: FormData) {
  await requireAdmin();
  const offeringId = getString(formData, "offeringId");
  const offering = await loadOfferingOrThrow(offeringId);

  const approved =
    offering.grandfatheredTrainingExemption ||
    offering.approval?.status === "APPROVED";
  if (!approved) {
    throw new Error(
      "Cannot publish: this class has not been approved. Approve the proposal first.",
    );
  }

  if (offering.deliveryMode === "IN_PERSON") {
    if (!offering.locationName || !offering.locationAddress) {
      throw new Error(
        "In-person classes need a location name and address before publishing.",
      );
    }
  } else if (
    offering.deliveryMode === "VIRTUAL" ||
    offering.deliveryMode === "HYBRID"
  ) {
    if (!offering.zoomLink) {
      throw new Error(
        "Virtual and hybrid classes need a meeting link before publishing.",
      );
    }
  }

  if (offering.status === "PUBLISHED" || offering.status === "IN_PROGRESS") {
    return { success: true, alreadyPublished: true };
  }

  await prisma.classOffering.update({
    where: { id: offeringId },
    data: { status: "PUBLISHED", enrollmentOpen: true },
  });

  revalidateAdminClassSurfaces(offeringId);
  return { success: true };
}

/**
 * Admin returns a published or in-progress class to draft. Use sparingly —
 * existing rosters are preserved, but enrollment immediately closes.
 */
export async function adminUnpublishClassOffering(formData: FormData) {
  await requireAdmin();
  const offeringId = getString(formData, "offeringId");
  const offering = await loadOfferingOrThrow(offeringId);

  if (offering.status === "DRAFT") {
    return { success: true, alreadyDraft: true };
  }
  if (offering.status === "COMPLETED" || offering.status === "CANCELLED") {
    throw new Error(
      "Cannot unpublish a class that has been completed or cancelled.",
    );
  }

  await prisma.classOffering.update({
    where: { id: offeringId },
    data: { status: "DRAFT", enrollmentOpen: false },
  });

  revalidateAdminClassSurfaces(offeringId);
  return { success: true };
}

export async function adminCloseEnrollment(formData: FormData) {
  await requireAdmin();
  const offeringId = getString(formData, "offeringId");
  await loadOfferingOrThrow(offeringId);

  await prisma.classOffering.update({
    where: { id: offeringId },
    data: { enrollmentOpen: false },
  });

  revalidateAdminClassSurfaces(offeringId);
  return { success: true };
}

export async function adminReopenEnrollment(formData: FormData) {
  await requireAdmin();
  const offeringId = getString(formData, "offeringId");
  const offering = await loadOfferingOrThrow(offeringId);

  if (offering.status === "CANCELLED" || offering.status === "COMPLETED") {
    throw new Error(
      "Cannot reopen enrollment for a cancelled or completed class.",
    );
  }

  await prisma.classOffering.update({
    where: { id: offeringId },
    data: { enrollmentOpen: true },
  });

  revalidateAdminClassSurfaces(offeringId);
  return { success: true };
}

export async function adminCancelClassOffering(formData: FormData) {
  await requireAdmin();
  const offeringId = getString(formData, "offeringId");
  const offering = await loadOfferingOrThrow(offeringId);

  if (offering.status === "CANCELLED") {
    return { success: true, alreadyCancelled: true };
  }
  if (offering.status === "COMPLETED") {
    throw new Error("Cannot cancel a class that has already been completed.");
  }

  await prisma.classOffering.update({
    where: { id: offeringId },
    data: { status: "CANCELLED", enrollmentOpen: false },
  });

  revalidateAdminClassSurfaces(offeringId);
  return { success: true };
}

export async function adminMarkClassCompleted(formData: FormData) {
  await requireAdmin();
  const offeringId = getString(formData, "offeringId");
  const offering = await loadOfferingOrThrow(offeringId);

  if (offering.status === "COMPLETED") {
    return { success: true, alreadyCompleted: true };
  }
  if (offering.status === "CANCELLED") {
    throw new Error(
      "Cannot mark a cancelled class completed — un-cancel by editing the offering first.",
    );
  }

  await prisma.classOffering.update({
    where: { id: offeringId },
    data: { status: "COMPLETED", enrollmentOpen: false },
  });

  revalidateAdminClassSurfaces(offeringId);
  return { success: true };
}

export async function adminUpdateCapacity(formData: FormData) {
  await requireAdmin();
  const offeringId = getString(formData, "offeringId");
  const capacity = getInt(formData, "capacity");
  if (capacity == null || capacity < 1) {
    throw new Error("Capacity must be a positive whole number.");
  }
  await loadOfferingOrThrow(offeringId);

  await prisma.classOffering.update({
    where: { id: offeringId },
    data: { capacity },
  });

  revalidateAdminClassSurfaces(offeringId);
  return { success: true };
}

/**
 * Promote the next waitlisted student to ENROLLED, in order. No-op if
 * there is no one waiting or the class is already at capacity.
 */
export async function adminPromoteFromWaitlist(formData: FormData) {
  await requireAdmin();
  const offeringId = getString(formData, "offeringId");

  const result = await promoteNextWaitlistedRaceSafe({ offeringId });
  revalidateAdminClassSurfaces(offeringId);
  return { success: true, promoted: result.promoted };
}

/**
 * Reassign a class offering to a different instructor. Requires the new
 * user to hold the INSTRUCTOR role. Does not re-validate readiness — admin
 * is intentionally trusted here for emergency reassignments (e.g. the
 * original instructor is unreachable two days before class).
 */
export async function adminReassignInstructor(formData: FormData) {
  await requireAdmin();
  const offeringId = getString(formData, "offeringId");
  const newInstructorId = getString(formData, "instructorId");

  const newInstructor = await prisma.user.findUnique({
    where: { id: newInstructorId },
    select: {
      id: true,
      name: true,
      roles: { select: { role: true } },
    },
  });
  if (!newInstructor) {
    throw new Error("Instructor not found.");
  }
  const newRoles = newInstructor.roles.map((r) => r.role);
  if (!newRoles.includes("INSTRUCTOR") && !newRoles.includes("ADMIN")) {
    throw new Error(
      "The selected user does not have the INSTRUCTOR role.",
    );
  }

  await loadOfferingOrThrow(offeringId);

  await prisma.classOffering.update({
    where: { id: offeringId },
    data: { instructorId: newInstructorId },
  });

  revalidateAdminClassSurfaces(offeringId);
  return { success: true };
}

/**
 * Move a roster entry between enrollment statuses. Supports
 * confirmed → waitlisted, waitlisted → confirmed, and either → dropped.
 */
export async function adminUpdateEnrollmentStatus(formData: FormData) {
  await requireAdmin();
  const enrollmentId = getString(formData, "enrollmentId");
  const nextStatus = getString(formData, "status");
  const allowed = new Set(["ENROLLED", "WAITLISTED", "DROPPED", "COMPLETED"]);
  if (!allowed.has(nextStatus)) {
    throw new Error(`Invalid enrollment status: ${nextStatus}`);
  }

  const enrollment = await prisma.classEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, offeringId: true, status: true },
  });
  if (!enrollment) throw new Error("Enrollment not found.");

  const data: {
    status: "ENROLLED" | "WAITLISTED" | "DROPPED" | "COMPLETED";
    droppedAt?: Date | null;
    completedAt?: Date | null;
    waitlistPosition?: number | null;
  } = { status: nextStatus as never };

  if (nextStatus === "DROPPED") {
    data.droppedAt = new Date();
    data.waitlistPosition = null;
  } else if (nextStatus === "COMPLETED") {
    data.completedAt = new Date();
    data.waitlistPosition = null;
  } else if (nextStatus === "ENROLLED") {
    data.droppedAt = null;
    data.waitlistPosition = null;
  }

  await prisma.classEnrollment.update({
    where: { id: enrollmentId },
    data,
  });

  revalidateAdminClassSurfaces(enrollment.offeringId);
  return { success: true };
}

/* ────────────────────────────────────────────────────────────
 * Read-only loaders used by admin pages. These intentionally do NOT
 * apply the public visibility filter — admins need to see all offerings
 * regardless of approval/publish state. Permission is gated by the page.
 * ──────────────────────────────────────────────────────────── */

export type AdminClassOperationsListItem = Awaited<
  ReturnType<typeof getAdminClassOperationsList>
>[number];

export async function getAdminClassOperationsList() {
  await requireAdmin();
  const offerings = await prisma.classOffering.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      enrollmentOpen: true,
      startDate: true,
      endDate: true,
      meetingDays: true,
      meetingTime: true,
      deliveryMode: true,
      locationName: true,
      locationAddress: true,
      zoomLink: true,
      capacity: true,
      grandfatheredTrainingExemption: true,
      semester: true,
      createdAt: true,
      updatedAt: true,
      instructor: {
        select: { id: true, name: true, email: true },
      },
      chapter: {
        select: { id: true, name: true, city: true, region: true },
      },
      template: {
        select: { id: true, title: true, interestArea: true, difficultyLevel: true, targetAgeGroup: true },
      },
      approval: {
        select: {
          status: true,
          requestedAt: true,
          reviewedAt: true,
          requestNotes: true,
          reviewNotes: true,
        },
      },
      _count: {
        select: {
          enrollments: { where: { status: "ENROLLED" } },
          sessions: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  // Compute waitlisted counts in a separate aggregate to avoid N+1.
  const waitlistedCounts = await prisma.classEnrollment.groupBy({
    by: ["offeringId"],
    where: { status: "WAITLISTED" },
    _count: { _all: true },
  });
  const waitlistByOffering = new Map(
    waitlistedCounts.map((row) => [row.offeringId, row._count._all]),
  );

  return offerings.map((offering) => {
    const confirmedCount = offering._count.enrollments;
    const waitlistedCount = waitlistByOffering.get(offering.id) ?? 0;
    const isPublic = isOfferingPubliclyVisible(offering);
    const isApproved =
      offering.grandfatheredTrainingExemption ||
      offering.approval?.status === "APPROVED";
    const reasons = computeActionFlags({
      offering,
      confirmedCount,
      waitlistedCount,
      isApproved,
    });
    return {
      ...offering,
      confirmedCount,
      waitlistedCount,
      isPublic,
      isApproved,
      actionFlags: reasons,
    };
  });
}

function computeActionFlags(args: {
  offering: {
    id: string;
    status: string;
    capacity: number;
    enrollmentOpen: boolean;
    startDate: Date;
    chapter: { id: string } | null;
    deliveryMode: string;
    locationName: string | null;
    locationAddress: string | null;
    zoomLink: string | null;
    approval: { status: string } | null;
    grandfatheredTrainingExemption: boolean;
  };
  confirmedCount: number;
  waitlistedCount: number;
  isApproved: boolean;
}): {
  needsReview: boolean;
  needsRevision: boolean;
  approvedNotPublished: boolean;
  missingLocation: boolean;
  missingMeetingLink: boolean;
  noEnrollments: boolean;
  full: boolean;
  hasWaitlist: boolean;
  startsWithin7Days: boolean;
  isCancelled: boolean;
  isCompleted: boolean;
} {
  const { offering, confirmedCount, waitlistedCount, isApproved } = args;
  const sevenDaysOut = new Date();
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

  return {
    needsReview: offering.approval?.status === "REQUESTED" ||
      offering.approval?.status === "UNDER_REVIEW",
    needsRevision: offering.approval?.status === "CHANGES_REQUESTED",
    approvedNotPublished:
      isApproved && offering.status === "DRAFT",
    // ClassOffering.instructorId is non-nullable in the schema, so a
    // "missing instructor" flag is dead code. Reassignment is exposed via
    // the per-class adminReassignInstructor action instead.
    missingLocation:
      offering.deliveryMode === "IN_PERSON" &&
      (!offering.locationName || !offering.locationAddress),
    missingMeetingLink:
      (offering.deliveryMode === "VIRTUAL" || offering.deliveryMode === "HYBRID") &&
      !offering.zoomLink,
    noEnrollments:
      (offering.status === "PUBLISHED" || offering.status === "IN_PROGRESS") &&
      confirmedCount === 0,
    full: confirmedCount >= offering.capacity,
    hasWaitlist: waitlistedCount > 0,
    startsWithin7Days:
      offering.startDate.getTime() <= sevenDaysOut.getTime() &&
      offering.startDate.getTime() >= Date.now(),
    isCancelled: offering.status === "CANCELLED",
    isCompleted: offering.status === "COMPLETED",
  };
}

export async function getAdminClassDetail(offeringId: string) {
  await requireAdmin();
  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    include: {
      instructor: {
        select: { id: true, name: true, email: true, chapterId: true },
      },
      chapter: { select: { id: true, name: true, city: true, region: true } },
      template: true,
      approval: true,
      sessions: { orderBy: { sessionNumber: "asc" } },
      _count: {
        select: {
          enrollments: { where: { status: "ENROLLED" } },
          sessions: true,
          announcements: true,
        },
      },
    },
  });
  if (!offering) return null;

  const waitlistedCount = await prisma.classEnrollment.count({
    where: { offeringId, status: "WAITLISTED" },
  });

  return {
    ...offering,
    confirmedCount: offering._count.enrollments,
    waitlistedCount,
    isApproved:
      offering.grandfatheredTrainingExemption ||
      offering.approval?.status === "APPROVED",
    isPublic: isOfferingPubliclyVisible(offering),
  };
}

export async function getAdminClassRoster(offeringId: string) {
  await requireAdmin();
  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    select: {
      id: true,
      title: true,
      capacity: true,
      status: true,
      enrollmentOpen: true,
    },
  });
  if (!offering) return null;

  const enrollments = await prisma.classEnrollment.findMany({
    where: { offeringId },
    orderBy: [{ status: "asc" }, { waitlistPosition: "asc" }, { enrolledAt: "asc" }],
    select: {
      id: true,
      status: true,
      enrolledAt: true,
      droppedAt: true,
      completedAt: true,
      sessionsAttended: true,
      waitlistPosition: true,
      instructorNotes: true,
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profile: { select: { grade: true, school: true, parentEmail: true, parentPhone: true } },
          studentLinks: {
            where: { archivedAt: null },
            select: {
              relationship: true,
              parent: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
        },
      },
    },
  });

  const groups = {
    confirmed: enrollments.filter((entry) => entry.status === "ENROLLED"),
    waitlisted: enrollments.filter((entry) => entry.status === "WAITLISTED"),
    dropped: enrollments.filter((entry) => entry.status === "DROPPED"),
    completed: enrollments.filter((entry) => entry.status === "COMPLETED"),
  };

  return { offering, enrollments, groups };
}

export async function getAdminProposalQueue() {
  await requireAdmin();
  return prisma.classOffering.findMany({
    where: {
      approval: {
        is: {
          status: { in: ["REQUESTED", "UNDER_REVIEW", "CHANGES_REQUESTED"] },
        },
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      meetingDays: true,
      meetingTime: true,
      deliveryMode: true,
      locationName: true,
      locationAddress: true,
      capacity: true,
      semester: true,
      instructor: { select: { id: true, name: true, email: true } },
      chapter: { select: { id: true, name: true } },
      template: {
        select: {
          id: true,
          title: true,
          interestArea: true,
          difficultyLevel: true,
          targetAgeGroup: true,
        },
      },
      approval: {
        select: {
          status: true,
          requestedAt: true,
          requestNotes: true,
          reviewNotes: true,
        },
      },
    },
    orderBy: [{ approval: { requestedAt: "asc" } }, { updatedAt: "desc" }],
  });
}
