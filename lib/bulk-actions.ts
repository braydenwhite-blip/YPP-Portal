"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { MentorshipType } from "@prisma/client";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function assignMentorBulk(formData: FormData) {
  await requireAdmin();

  const mentorId = formData.get("mentorId") as string;
  const menteeIdsJson = formData.get("menteeIds") as string;
  const type = formData.get("type") as MentorshipType;

  if (!mentorId || !menteeIdsJson || !type) {
    throw new Error("Missing required fields");
  }

  const menteeIds = JSON.parse(menteeIdsJson) as string[];

  // Create mentorships for all selected mentees
  for (const menteeId of menteeIds) {
    // Check if mentorship already exists
    const existing = await prisma.mentorship.findFirst({
      where: { mentorId, menteeId, type }
    });

    if (!existing) {
      await prisma.mentorship.create({
        data: { mentorId, menteeId, type }
      });
    }
  }

  revalidatePath("/admin/instructors");
  revalidatePath("/admin/students");
  revalidatePath("/mentorship");
}

export async function updateChapterBulk(formData: FormData) {
  await requireAdmin();

  const chapterId = formData.get("chapterId") as string;
  const userIdsJson = formData.get("userIds") as string;

  if (!userIdsJson) {
    throw new Error("Missing required fields");
  }

  const userIds = JSON.parse(userIdsJson) as string[];

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { chapterId: chapterId || null }
  });

  revalidatePath("/admin/instructors");
  revalidatePath("/admin/students");
  revalidatePath("/admin/chapters");
}

export async function deleteUsersBulk(formData: FormData) {
  await requireAdmin();

  const userIdsJson = formData.get("userIds") as string;

  if (!userIdsJson) {
    throw new Error("Missing required fields");
  }

  const userIds = JSON.parse(userIdsJson) as string[];

  // Delete related records first
  await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.enrollment.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.trainingAssignment.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.mentorship.deleteMany({
    where: { OR: [{ mentorId: { in: userIds } }, { menteeId: { in: userIds } }] }
  });

  // Delete users
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  revalidatePath("/admin");
  revalidatePath("/admin/instructors");
  revalidatePath("/admin/students");
}
