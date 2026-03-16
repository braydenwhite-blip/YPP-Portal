"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

async function requireParent() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Parent access required");
  }
  return session;
}

async function requireInstructor() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (
    !roles.includes("INSTRUCTOR") &&
    !roles.includes("ADMIN") &&
    !roles.includes("CHAPTER_LEAD")
  ) {
    throw new Error("Unauthorized - Instructor access required");
  }
  return session;
}

// ============================================
// GET OR CREATE PARENT-INSTRUCTOR CONVERSATION
// ============================================

export async function getOrCreateParentConversation(studentId: string) {
  const session = await requireParent();
  const parentId = session.user.id;

  // Verify approved parent-student link
  const link = await prisma.parentStudent.findUnique({
    where: { parentId_studentId: { parentId, studentId } },
  });
  if (!link || link.approvalStatus !== "APPROVED") {
    throw new Error("You do not have access to this student's data");
  }

  // Get student info and their lead instructor
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      enrollments: {
        where: { status: "ENROLLED" },
        include: {
          course: {
            select: {
              leadInstructorId: true,
              leadInstructor: { select: { id: true, name: true } },
            },
          },
        },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!student) throw new Error("Student not found");

  const instructorId =
    student.enrollments[0]?.course?.leadInstructorId ?? null;
  const subject = `${student.name} — Parent Updates`;

  // Look for an existing conversation for this parent–student pair
  // We store studentId in the subject as a marker; find by participants
  const existing = await prisma.conversation.findFirst({
    where: {
      subject,
      participants: {
        some: { userId: parentId },
      },
    },
    include: {
      messages: {
        include: { sender: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      participants: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (existing) return existing;

  // Create a new conversation
  const participantData: { userId: string }[] = [{ userId: parentId }];
  if (instructorId) participantData.push({ userId: instructorId });

  const conversation = await prisma.conversation.create({
    data: {
      subject,
      isGroup: false,
      participants: {
        create: participantData,
      },
    },
    include: {
      messages: {
        include: { sender: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      participants: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  return conversation;
}

// ============================================
// SEND PARENT MESSAGE
// ============================================

export async function sendParentMessage(formData: FormData) {
  const session = await requireAuth();
  const senderId = session.user.id;
  const roles = session.user.roles ?? [];

  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();

  if (!conversationId || !content) {
    throw new Error("Missing required fields");
  }

  // Verify sender is a participant in this conversation
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: senderId },
  });

  // Allow ADMINs to message in any conversation
  if (!participant && !roles.includes("ADMIN")) {
    throw new Error("You are not a participant in this conversation");
  }

  await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content,
    },
  });

  // Touch updatedAt on conversation
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  revalidatePath(`/parent/${studentId}/messages`);
  revalidatePath(`/parent/messages`);
  revalidatePath(`/instructor/parent-messages`);
}

// ============================================
// GET ALL CONVERSATIONS FOR PARENT
// ============================================

export async function getParentConversations() {
  const session = await requireParent();
  const parentId = session.user.id;

  const participations = await prisma.conversationParticipant.findMany({
    where: { userId: parentId },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: { id: true, name: true } } },
          },
          participants: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  return participations.map((p) => ({
    conversationId: p.conversation.id,
    subject: p.conversation.subject ?? "Conversation",
    lastMessage: p.conversation.messages[0] ?? null,
    participants: p.conversation.participants.map((cp) => cp.user),
    updatedAt: p.conversation.updatedAt,
    // Unread = last message was not from this parent
    hasUnread:
      p.conversation.messages[0] != null &&
      p.conversation.messages[0].senderId !== parentId,
  }));
}

// ============================================
// GET ALL PARENT CONVERSATIONS FOR INSTRUCTOR
// ============================================

export async function getInstructorParentConversations() {
  const session = await requireInstructor();
  const instructorId = session.user.id;

  const participations = await prisma.conversationParticipant.findMany({
    where: { userId: instructorId },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: { sender: { select: { id: true, name: true } } },
          },
          participants: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  return participations.map((p) => {
    const lastMsg =
      p.conversation.messages[p.conversation.messages.length - 1] ?? null;
    return {
      conversationId: p.conversation.id,
      subject: p.conversation.subject ?? "Conversation",
      messages: p.conversation.messages,
      participants: p.conversation.participants.map((cp) => cp.user),
      updatedAt: p.conversation.updatedAt,
      hasUnread: lastMsg != null && lastMsg.senderId !== instructorId,
    };
  });
}

// ============================================
// GET SINGLE CONVERSATION WITH MESSAGES
// ============================================

export async function getConversationMessages(conversationId: string) {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId },
  });

  if (!participant && !roles.includes("ADMIN")) {
    throw new Error("You are not a participant in this conversation");
  }

  return prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        include: { sender: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      participants: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
}
