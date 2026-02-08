"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { MentorshipType } from "@prisma/client";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit-log-actions";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session as typeof session & { user: { id: string } };
}

// Zod schemas for bulk operation payloads
const stringArraySchema = z.array(z.string().min(1)).min(1).max(100);
const mentorshipTypeSchema = z.enum(["INSTRUCTOR", "STUDENT"]);

function parseJsonField(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON for ${label}`);
  }
}

export async function assignMentorBulk(formData: FormData) {
  const session = await requireAdmin();

  const mentorId = formData.get("mentorId") as string;
  const menteeIdsJson = formData.get("menteeIds") as string;
  const typeRaw = formData.get("type") as string;

  if (!mentorId || !menteeIdsJson || !typeRaw) {
    throw new Error("Missing required fields");
  }

  const menteeIds = stringArraySchema.parse(parseJsonField(menteeIdsJson, "menteeIds"));
  const type = mentorshipTypeSchema.parse(typeRaw) as MentorshipType;

  // Verify mentor exists
  const mentor = await prisma.user.findUnique({ where: { id: mentorId }, select: { id: true } });
  if (!mentor) throw new Error("Mentor not found");

  for (const menteeId of menteeIds) {
    const existing = await prisma.mentorship.findFirst({
      where: { mentorId, menteeId, type }
    });

    if (!existing) {
      await prisma.mentorship.create({
        data: { mentorId, menteeId, type }
      });
    }
  }

  await logAuditEvent({
    action: "MENTORSHIP_CREATED",
    actorId: session.user.id,
    targetType: "User",
    targetId: mentorId,
    description: `Bulk assigned ${menteeIds.length} mentees to mentor`,
    metadata: { mentorId, menteeCount: menteeIds.length, type },
  });

  revalidatePath("/admin/instructors");
  revalidatePath("/admin/students");
  revalidatePath("/mentorship");
}

export async function updateChapterBulk(formData: FormData) {
  const session = await requireAdmin();

  const chapterId = formData.get("chapterId") as string;
  const userIdsJson = formData.get("userIds") as string;

  if (!userIdsJson) {
    throw new Error("Missing required fields");
  }

  const userIds = stringArraySchema.parse(parseJsonField(userIdsJson, "userIds"));

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { chapterId: chapterId || null }
  });

  await logAuditEvent({
    action: "USER_UPDATED",
    actorId: session.user.id,
    targetType: "Chapter",
    targetId: chapterId || "none",
    description: `Bulk reassigned ${userIds.length} users to chapter`,
    metadata: { userCount: userIds.length, chapterId },
  });

  revalidatePath("/admin/instructors");
  revalidatePath("/admin/students");
  revalidatePath("/admin/chapters");
}

export async function deleteUsersBulk(formData: FormData) {
  const session = await requireAdmin();

  const userIdsJson = formData.get("userIds") as string;

  if (!userIdsJson) {
    throw new Error("Missing required fields");
  }

  const userIds = stringArraySchema.parse(parseJsonField(userIdsJson, "userIds"));

  // Prevent admins from deleting themselves
  if (userIds.includes(session.user.id)) {
    throw new Error("Cannot delete your own account");
  }

  // Atomic transaction for cascade delete
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.enrollment.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.trainingAssignment.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.mentorship.deleteMany({
      where: { OR: [{ mentorId: { in: userIds } }, { menteeId: { in: userIds } }] }
    }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);

  await logAuditEvent({
    action: "USER_DELETED",
    actorId: session.user.id,
    targetType: "User",
    description: `Bulk deleted ${userIds.length} users`,
    metadata: { userCount: userIds.length },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/instructors");
  revalidatePath("/admin/students");
}
