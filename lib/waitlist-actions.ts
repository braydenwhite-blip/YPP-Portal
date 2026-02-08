"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { createSystemNotification } from "@/lib/notification-actions";

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

// ============================================
// ENROLL OR WAITLIST
// ============================================

export async function enrollOrWaitlist(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const courseId = formData.get("courseId") as string;
  if (!courseId) throw new Error("Missing courseId");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      _count: {
        select: {
          enrollments: { where: { status: "ENROLLED" } },
        },
      },
    },
  });

  if (!course) throw new Error("Course not found");

  // Check if already enrolled or waitlisted
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId },
  });
  if (existingEnrollment) throw new Error("Already enrolled in this course");

  const existingWaitlist = await prisma.waitlistEntry.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existingWaitlist) throw new Error("Already on the waitlist for this course");

  // If no cap or under cap, enroll directly
  if (!course.maxEnrollment || course._count.enrollments < course.maxEnrollment) {
    await prisma.enrollment.create({
      data: { userId, courseId, status: "ENROLLED" },
    });
    revalidatePath("/curriculum");
    revalidatePath("/my-courses");
    return { action: "enrolled" as const };
  }

  // Course is full — add to waitlist
  const lastEntry = await prisma.waitlistEntry.findFirst({
    where: { courseId },
    orderBy: { position: "desc" },
  });
  const nextPosition = (lastEntry?.position ?? 0) + 1;

  await prisma.waitlistEntry.create({
    data: {
      userId,
      courseId,
      position: nextPosition,
      status: "WAITING",
    },
  });

  revalidatePath("/curriculum");
  revalidatePath("/my-courses");
  return { action: "waitlisted" as const, position: nextPosition };
}

// ============================================
// PROMOTE NEXT IN WAITLIST (Admin)
// ============================================

export async function promoteFromWaitlist(formData: FormData) {
  const session = await requireAdmin();
  const courseId = formData.get("courseId") as string;
  if (!courseId) throw new Error("Missing courseId");

  const nextEntry = await prisma.waitlistEntry.findFirst({
    where: { courseId, status: "WAITING" },
    orderBy: { position: "asc" },
    include: { user: true, course: true },
  });

  if (!nextEntry) throw new Error("No one on the waitlist");

  // Update waitlist entry
  await prisma.waitlistEntry.update({
    where: { id: nextEntry.id },
    data: {
      status: "OFFERED",
      notifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48-hour window
    },
  });

  // Create enrollment as PENDING
  await prisma.enrollment.create({
    data: {
      userId: nextEntry.userId,
      courseId,
      status: "PENDING",
    },
  });

  // Notify the user
  await createSystemNotification(
    nextEntry.userId,
    "COURSE_UPDATE",
    "Spot Available!",
    `A spot has opened up in ${nextEntry.course.title}. You have 48 hours to confirm your enrollment.`,
    `/curriculum`
  );

  await logAuditEvent({
    action: "WAITLIST_PROMOTED",
    actorId: session.user.id,
    targetType: "WaitlistEntry",
    targetId: nextEntry.id,
    description: `Promoted ${nextEntry.user.name} from waitlist for ${nextEntry.course.title}`,
  });

  revalidatePath("/admin/waitlist");
  revalidatePath("/curriculum");
}

// ============================================
// GET COURSE WAITLIST (Admin)
// ============================================

export async function getCourseWaitlist(courseId: string) {
  await requireAdmin();

  return prisma.waitlistEntry.findMany({
    where: { courseId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { position: "asc" },
  });
}

// ============================================
// GET ALL WAITLISTS OVERVIEW (Admin)
// ============================================

export async function getWaitlistOverview() {
  await requireAdmin();

  const coursesWithWaitlist = await prisma.course.findMany({
    where: {
      waitlistEntries: { some: { status: "WAITING" } },
    },
    include: {
      _count: {
        select: {
          enrollments: { where: { status: "ENROLLED" } },
          waitlistEntries: { where: { status: "WAITING" } },
        },
      },
    },
    orderBy: { title: "asc" },
  });

  return coursesWithWaitlist.map((course) => ({
    id: course.id,
    title: course.title,
    maxEnrollment: course.maxEnrollment,
    currentEnrollment: course._count.enrollments,
    waitlistCount: course._count.waitlistEntries,
  }));
}

// ============================================
// UPDATE COURSE CAPACITY (Admin)
// ============================================

export async function updateCourseCapacity(formData: FormData) {
  const session = await requireAdmin();

  const courseId = formData.get("courseId") as string;
  const maxEnrollmentStr = formData.get("maxEnrollment") as string;
  if (!courseId) throw new Error("Missing courseId");

  const maxEnrollment = maxEnrollmentStr ? parseInt(maxEnrollmentStr, 10) : null;

  await prisma.course.update({
    where: { id: courseId },
    data: { maxEnrollment },
  });

  await logAuditEvent({
    action: "COURSE_UPDATED",
    actorId: session.user.id,
    targetType: "Course",
    targetId: courseId,
    description: `Updated course capacity to ${maxEnrollment ?? "unlimited"}`,
  });

  revalidatePath("/admin/waitlist");
  revalidatePath("/curriculum");
}

// ============================================
// CANCEL WAITLIST ENTRY
// ============================================

export async function cancelWaitlistEntry(formData: FormData) {
  const session = await requireAuth();
  const entryId = formData.get("entryId") as string;
  if (!entryId) throw new Error("Missing entryId");

  const entry = await prisma.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Waitlist entry not found");

  // Users can cancel their own; admins can cancel any
  const roles = session.user.roles ?? [];
  if (entry.userId !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }

  await prisma.waitlistEntry.update({
    where: { id: entryId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/admin/waitlist");
  revalidatePath("/curriculum");
  revalidatePath("/my-courses");
}
