"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { withPrismaFallback } from "@/lib/prisma-guard";

// ============================================
// CHAPTER CHANNELS & MESSAGING
// ============================================

async function requireChapterMember() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, chapterId: true, roles: true },
  });

  if (!user?.chapterId) throw new Error("You must be in a chapter to use channels");
  const isLead = user.roles.some((r: { role: string }) => r.role === "CHAPTER_PRESIDENT" || r.role === "ADMIN");

  return { userId: user.id, userName: user.name, chapterId: user.chapterId, isLead };
}

/**
 * Get all channels for the current user's chapter.
 */
export async function getChapterChannels() {
  const { chapterId } = await requireChapterMember();

  const channels = await withPrismaFallback(
    "getChapterChannels",
    async () =>
      prisma.chapterChannel.findMany({
        where: { chapterId },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          isDefault: true,
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              content: true,
              createdAt: true,
              author: { select: { name: true } },
            },
          },
        },
      }),
    () =>
      [] as Array<{
        id: string;
        name: string;
        description: string | null;
        isDefault: boolean;
        _count: { messages: number };
        messages: Array<{
          content: string;
          createdAt: Date;
          author: { name: string };
        }>;
      }>,
  );

  return channels;
}

/**
 * Get messages for a specific channel (paginated).
 */
export async function getChannelMessages(channelId: string, cursor?: string) {
  const { chapterId } = await requireChapterMember();

  // Verify channel belongs to user's chapter
  const channel = await prisma.chapterChannel.findUnique({
    where: { id: channelId },
    select: { id: true, name: true, description: true, chapterId: true },
  });

  if (!channel || channel.chapterId !== chapterId) {
    throw new Error("Channel not found");
  }

  const messages = await prisma.chapterChannelMessage.findMany({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    take: 50,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { id: true, name: true, primaryRole: true } },
    },
  });

  return { channel, messages: messages.reverse() };
}

/**
 * Send a message to a chapter channel.
 */
export async function sendChannelMessage(channelId: string, content: string) {
  const { userId, chapterId } = await requireChapterMember();

  if (!content.trim()) throw new Error("Message cannot be empty");
  if (content.length > 2000) throw new Error("Message too long (max 2000 characters)");

  // Verify channel belongs to user's chapter
  const channel = await prisma.chapterChannel.findUnique({
    where: { id: channelId },
    select: { chapterId: true },
  });

  if (!channel || channel.chapterId !== chapterId) {
    throw new Error("Channel not found");
  }

  await prisma.chapterChannelMessage.create({
    data: {
      channelId,
      authorId: userId,
      content: content.trim(),
    },
  });

  revalidatePath(`/chapter/channels/${channelId}`);
  return { success: true };
}

/**
 * Create a new channel (chapter president only).
 */
export async function createChannel(formData: FormData) {
  const { chapterId, isLead } = await requireChapterMember();
  if (!isLead) throw new Error("Only chapter presidents can create channels");

  const name = (formData.get("name") as string)?.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const description = formData.get("description") as string | null;
  const isDefault = formData.get("isDefault") === "true";

  if (!name || name.length < 2) throw new Error("Channel name must be at least 2 characters");
  if (name.length > 30) throw new Error("Channel name too long");

  await prisma.chapterChannel.create({
    data: {
      chapterId,
      name,
      description: description || null,
      isDefault,
    },
  });

  revalidatePath("/chapter/channels");
  return { success: true };
}

/**
 * Delete a channel (chapter president only).
 */
export async function deleteChannel(channelId: string) {
  const { chapterId, isLead } = await requireChapterMember();
  if (!isLead) throw new Error("Only chapter presidents can delete channels");

  const channel = await prisma.chapterChannel.findUnique({
    where: { id: channelId },
    select: { chapterId: true },
  });

  if (!channel || channel.chapterId !== chapterId) {
    throw new Error("Channel not found");
  }

  await prisma.chapterChannel.delete({ where: { id: channelId } });

  revalidatePath("/chapter/channels");
  return { success: true };
}
