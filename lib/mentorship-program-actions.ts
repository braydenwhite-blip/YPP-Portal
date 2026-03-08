"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { MenteeRoleType, MentorshipStatus, MentorshipType } from "@prisma/client";
import { logAuditEvent } from "@/lib/audit-log-actions";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) throw new Error("Unauthorized");
  return session as typeof session & { user: { id: string } };
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

// ============================================
// PAIRING ACTIONS
// ============================================

/**
 * Assign a mentor to a mentee in the YPP Mentorship Program.
 * Creates a standard Mentorship record so MonthlySelfReflections and
 * MentorGoalReviews can link to it.
 */
export async function assignProgramMentor(formData: FormData) {
  const session = await requireAdmin();
  const mentorId = getString(formData, "mentorId");
  const menteeId = getString(formData, "menteeId");
  const notes = getString(formData, "notes", false);

  if (mentorId === menteeId) throw new Error("Mentor and mentee cannot be the same person");

  // Verify both users exist
  const [mentor, mentee] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: mentorId }, select: { id: true, name: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: menteeId }, select: { id: true, name: true, primaryRole: true } }),
  ]);

  // Check for an existing active program pairing
  const existing = await prisma.mentorship.findFirst({
    where: { menteeId, status: "ACTIVE" },
  });
  if (existing) {
    throw new Error(`${mentee.name} already has an active program mentor`);
  }

  // Determine MentorshipType from mentee's primaryRole
  const programType: MentorshipType =
    mentee.primaryRole === "STUDENT" ? MentorshipType.STUDENT : MentorshipType.INSTRUCTOR;

  const mentorship = await prisma.mentorship.create({
    data: {
      mentorId: mentor.id,
      menteeId: mentee.id,
      type: programType,
      status: MentorshipStatus.ACTIVE,
      notes: notes || null,
    },
  });

  await logAuditEvent({
    action: "MENTORSHIP_CREATED",
    actorId: session.user.id,
    targetType: "Mentorship",
    targetId: mentorship.id,
    description: `Program mentor assigned: ${mentor.name} → ${mentee.name}`,
  });

  revalidatePath("/admin/mentorship-program");
}

/**
 * End (pause/complete) an active program mentorship pairing.
 */
export async function endProgramMentorship(formData: FormData) {
  const session = await requireAdmin();
  const mentorshipId = getString(formData, "mentorshipId");
  const newStatus = (getString(formData, "status", false) || "COMPLETE") as MentorshipStatus;

  const mentorship = await prisma.mentorship.findUniqueOrThrow({
    where: { id: mentorshipId },
    include: {
      mentor: { select: { name: true } },
      mentee: { select: { name: true } },
    },
  });

  await prisma.mentorship.update({
    where: { id: mentorshipId },
    data: { status: newStatus, endDate: new Date() },
  });

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.user.id,
    targetType: "Mentorship",
    targetId: mentorshipId,
    description: `Program mentorship ended (${newStatus}): ${mentorship.mentor.name} → ${mentorship.mentee.name}`,
  });

  revalidatePath("/admin/mentorship-program");
}

// ============================================
// MENTOR COMMITTEE CHAIR ACTIONS
// ============================================

/**
 * Assign a user as Mentor Committee Chair for a role group.
 * Only one active chair per role type is enforced at the application layer;
 * the DB allows multiple for audit history.
 */
export async function assignCommitteeChair(formData: FormData) {
  const session = await requireAdmin();
  const userId = getString(formData, "userId");
  const roleTypeRaw = getString(formData, "roleType");

  const roleType = roleTypeRaw as MenteeRoleType;
  if (!Object.values(MenteeRoleType).includes(roleType)) {
    throw new Error("Invalid roleType");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true },
  });

  // Deactivate any existing active chair for this role group
  await prisma.mentorCommitteeChair.updateMany({
    where: { roleType, isActive: true },
    data: { isActive: false },
  });

  // Upsert the new chair record
  await prisma.mentorCommitteeChair.upsert({
    where: { userId_roleType: { userId, roleType } },
    create: { userId, roleType, isActive: true },
    update: { isActive: true },
  });

  await logAuditEvent({
    action: "SETTINGS_CHANGED",
    actorId: session.user.id,
    targetType: "MentorCommitteeChair",
    targetId: userId,
    description: `Mentor Committee Chair assigned: ${user.name} → ${roleType}`,
  });

  revalidatePath("/admin/mentorship-program");
}

/**
 * Remove (deactivate) a Mentor Committee Chair assignment.
 */
export async function removeCommitteeChair(formData: FormData) {
  const session = await requireAdmin();
  const chairId = getString(formData, "chairId");

  const chair = await prisma.mentorCommitteeChair.findUniqueOrThrow({
    where: { id: chairId },
    include: { user: { select: { name: true } } },
  });

  await prisma.mentorCommitteeChair.update({
    where: { id: chairId },
    data: { isActive: false },
  });

  await logAuditEvent({
    action: "SETTINGS_CHANGED",
    actorId: session.user.id,
    targetType: "MentorCommitteeChair",
    targetId: chairId,
    description: `Mentor Committee Chair removed: ${chair.user.name} (${chair.roleType})`,
  });

  revalidatePath("/admin/mentorship-program");
}

// ============================================
// PROGRAM GOAL ACTIONS
// ============================================

/**
 * Create a new goal definition for a role group.
 */
export async function createProgramGoal(formData: FormData) {
  const session = await requireAdmin();
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const roleTypeRaw = getString(formData, "roleType");

  const roleType = roleTypeRaw as MenteeRoleType;
  if (!Object.values(MenteeRoleType).includes(roleType)) {
    throw new Error("Invalid roleType");
  }

  const sortOrderRaw = getString(formData, "sortOrder", false);
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;

  await prisma.mentorshipProgramGoal.create({
    data: {
      title,
      description: description || null,
      roleType,
      sortOrder,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/mentorship-program");
}

/**
 * Toggle a goal's active/inactive status.
 */
export async function toggleProgramGoal(formData: FormData) {
  await requireAdmin();
  const goalId = getString(formData, "goalId");
  const isActiveRaw = getString(formData, "isActive");
  const isActive = isActiveRaw === "true";

  await prisma.mentorshipProgramGoal.update({
    where: { id: goalId },
    data: { isActive: !isActive },
  });

  revalidatePath("/admin/mentorship-program");
}

/**
 * Update a goal's title/description/sortOrder.
 */
export async function updateProgramGoal(formData: FormData) {
  await requireAdmin();
  const goalId = getString(formData, "goalId");
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const sortOrderRaw = getString(formData, "sortOrder", false);
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 0;

  await prisma.mentorshipProgramGoal.update({
    where: { id: goalId },
    data: { title, description: description || null, sortOrder },
  });

  revalidatePath("/admin/mentorship-program");
}
