"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { createSystemNotification } from "@/lib/notification-actions";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session as typeof session & { user: { id: string; roles: string[] } };
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (!value || String(value).trim() === "") {
    throw new Error(`Missing ${key}`);
  }
  return String(value).trim();
}

// ============================================
// APPROVE PARENT-STUDENT LINK
// ============================================

export async function approveParentLinkRequest(formData: FormData) {
  const session = await requireAdmin();
  const id = getString(formData, "id");

  const link = await prisma.parentStudent.findUnique({
    where: { id },
    include: {
      parent: { select: { name: true } },
      student: { select: { name: true } },
    },
  });

  if (!link) {
    throw new Error("Link not found");
  }

  await prisma.parentStudent.update({
    where: { id },
    data: {
      approvalStatus: "APPROVED",
      isPrimary: true,
      reviewedAt: new Date(),
      reviewedById: session.user.id,
    },
  });

  // Notify parent
  await createSystemNotification(
    link.parentId,
    "SYSTEM",
    "Parent Link Approved",
    `Your link to ${link.student.name} has been approved. You can now view their progress.`,
    "/parent"
  );

  await logAuditEvent({
    action: "PARENT_LINK_APPROVED",
    actorId: session.user.id,
    targetType: "ParentStudent",
    targetId: id,
    description: `Approved parent link: ${link.parent.name} -> ${link.student.name}`,
  });

  revalidatePath("/admin/parent-approvals");
  revalidatePath("/parent");
}

// ============================================
// REJECT PARENT-STUDENT LINK
// ============================================

export async function rejectParentLinkRequest(formData: FormData) {
  const session = await requireAdmin();
  const id = getString(formData, "id");

  const link = await prisma.parentStudent.findUnique({
    where: { id },
    include: {
      parent: { select: { name: true } },
      student: { select: { name: true } },
    },
  });

  if (!link) {
    throw new Error("Link not found");
  }

  await prisma.parentStudent.update({
    where: { id },
    data: {
      approvalStatus: "REJECTED",
      isPrimary: false,
      reviewedAt: new Date(),
      reviewedById: session.user.id,
    },
  });

  // Notify parent
  await createSystemNotification(
    link.parentId,
    "SYSTEM",
    "Parent Link Request Declined",
    `Your request to link to ${link.student.name} was not approved. Please contact support if you believe this is an error.`,
    "/parent"
  );

  await logAuditEvent({
    action: "PARENT_LINK_REJECTED",
    actorId: session.user.id,
    targetType: "ParentStudent",
    targetId: id,
    description: `Rejected parent link: ${link.parent.name} -> ${link.student.name}`,
  });

  revalidatePath("/admin/parent-approvals");
  revalidatePath("/parent");
}
