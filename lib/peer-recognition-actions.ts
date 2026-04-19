"use server";

import { prisma } from "@/lib/prisma";
import { MENTORSHIP_LEGACY_ROOT_SELECT } from "@/lib/mentorship-read-fragments";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { KudosCategory } from "@prisma/client";

// ============================================
// FETCH: KUDOS FEED
// ============================================

/**
 * Get the public kudos feed, most recent first.
 * Optionally filter by receiverId to show a single user's kudos wall.
 */
export async function getKudosFeed(options?: { receiverId?: string; limit?: number }) {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const limit = options?.limit ?? 50;

  const kudos = await prisma.peerKudos.findMany({
    where: {
      isPublic: true,
      ...(options?.receiverId ? { receiverId: options.receiverId } : {}),
    },
    include: {
      giver: { select: { id: true, name: true, primaryRole: true } },
      receiver: { select: { id: true, name: true, primaryRole: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return kudos.map((k) => ({
    id: k.id,
    category: k.category,
    message: k.message,
    isPublic: k.isPublic,
    createdAt: k.createdAt.toISOString(),
    giver: { id: k.giver.id, name: k.giver.name, role: k.giver.primaryRole },
    receiver: { id: k.receiver.id, name: k.receiver.name, role: k.receiver.primaryRole },
  }));
}

/**
 * Get kudos summary for a user (count by category, total received).
 */
export async function getKudosSummary(userId: string) {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const kudos = await prisma.peerKudos.findMany({
    where: { receiverId: userId, isPublic: true },
    select: { category: true },
  });

  const byCategory: Record<string, number> = {};
  for (const k of kudos) {
    byCategory[k.category] = (byCategory[k.category] ?? 0) + 1;
  }

  return {
    totalReceived: kudos.length,
    byCategory,
  };
}

/**
 * Get all mentees visible to a mentor/admin for the kudos "send to" dropdown.
 */
export async function getKudosRecipients() {
  const session = await getSession();
  if (!session?.user?.id) return [];

  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  if (isAdmin) {
    // Admins can send kudos to anyone in active mentorships
    const mentorships = await prisma.mentorship.findMany({
      where: { status: "ACTIVE" },
      select: {
        ...MENTORSHIP_LEGACY_ROOT_SELECT,
        mentee: { select: { id: true, name: true, primaryRole: true } },
      },
    });
    return mentorships.map((m) => ({
      id: m.mentee.id,
      name: m.mentee.name,
      role: m.mentee.primaryRole,
    }));
  }

  // Mentors can send kudos to their mentees
  const mentorships = await prisma.mentorship.findMany({
    where: { mentorId: userId, status: "ACTIVE" },
    select: {
      ...MENTORSHIP_LEGACY_ROOT_SELECT,
      mentee: { select: { id: true, name: true, primaryRole: true } },
    },
  });

  // Mentees can send kudos to peers in their chapter/program
  const menteeships = await prisma.mentorship.findMany({
    where: { menteeId: userId, status: "ACTIVE" },
    select: {
      ...MENTORSHIP_LEGACY_ROOT_SELECT,
      mentee: {
        select: {
          chapterId: true,
        },
      },
    },
  });

  const chapterIds = menteeships
    .map((m) => m.mentee.chapterId)
    .filter((id): id is string => id !== null);

  const peers =
    chapterIds.length > 0
      ? await prisma.user.findMany({
          where: {
            chapterId: { in: chapterIds },
            id: { not: userId },
          },
          select: { id: true, name: true, primaryRole: true },
          take: 100,
        })
      : [];

  const menteeRecipients = mentorships.map((m) => ({
    id: m.mentee.id,
    name: m.mentee.name,
    role: m.mentee.primaryRole,
  }));

  const peerRecipients = peers.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.primaryRole,
  }));

  // Deduplicate by id
  const seen = new Set<string>();
  const combined = [...menteeRecipients, ...peerRecipients].filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return combined;
}

// ============================================
// SEND KUDOS
// ============================================

/**
 * Send peer kudos to another user.
 */
export async function sendKudos(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const giverId = session.user.id as string;
  const receiverId = String(formData.get("receiverId") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const isPublicRaw = formData.get("isPublic");
  const isPublic = isPublicRaw !== "false";

  if (!receiverId) throw new Error("Missing recipient");
  if (!message) throw new Error("Missing message");
  if (receiverId === giverId) throw new Error("You cannot send kudos to yourself");

  if (!Object.values(KudosCategory).includes(categoryRaw as KudosCategory)) {
    throw new Error("Invalid category");
  }

  // Verify recipient exists
  const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } });
  if (!receiver) throw new Error("Recipient not found");

  await prisma.peerKudos.create({
    data: {
      giverId,
      receiverId,
      category: categoryRaw as KudosCategory,
      message,
      isPublic,
    },
  });

  revalidatePath("/peer-recognition");
  revalidatePath("/my-program");
  return { success: true };
}

/**
 * Delete a kudos entry (only the sender or an admin can delete).
 */
export async function deleteKudos(kudosId: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const kudos = await prisma.peerKudos.findUnique({ where: { id: kudosId } });
  if (!kudos) throw new Error("Not found");
  if (kudos.giverId !== userId && !isAdmin) throw new Error("Unauthorized");

  await prisma.peerKudos.delete({ where: { id: kudosId } });
  revalidatePath("/peer-recognition");
  return { success: true };
}

/**
 * Get kudos entries that can be referenced in a mentor's review
 * (kudos received by the mentee in the last 45 days).
 */
export async function getKudosForReview(menteeId: string) {
  const session = await getSession();
  if (!session?.user?.id) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 45);

  const kudos = await prisma.peerKudos.findMany({
    where: {
      receiverId: menteeId,
      createdAt: { gte: cutoff },
    },
    include: {
      giver: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return kudos.map((k) => ({
    id: k.id,
    category: k.category,
    message: k.message,
    giverName: k.giver.name,
    createdAt: k.createdAt.toISOString(),
  }));
}
