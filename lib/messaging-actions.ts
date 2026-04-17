"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { requireCanMessage } from "@/lib/authorization-helpers";
import { getPusherServer, isPusherConfigured } from "@/lib/pusher-server";
import { createSystemNotification } from "@/lib/notification-actions";
import {
  ConversationContextType,
  MessagePriority,
  NotificationType,
} from "@prisma/client";
import { normalizeConversationContextType } from "@/lib/message-center";
import { messagePriorityToNotificationUrgency } from "@/lib/notification-matrix";

// ============================================
// HELPERS
// ============================================

async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
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

function getMessagePriority(formData: FormData) {
  const rawValue = getString(formData, "priority", false).toUpperCase();
  return Object.values(MessagePriority).includes(rawValue as MessagePriority)
    ? (rawValue as MessagePriority)
    : MessagePriority.NORMAL;
}

function getSenderDisplayName(name?: string | null) {
  return name?.trim() || "Portal User";
}

async function notifyConversationParticipants(params: {
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  priority: MessagePriority;
  isNewThread: boolean;
  recipientIds?: string[];
}) {
  try {
    const participantIds =
      params.recipientIds ??
      (
        await prisma.conversationParticipant.findMany({
          where: { conversationId: params.conversationId },
          select: { userId: true },
        })
      ).map((participant) => participant.userId);

    const urgency = messagePriorityToNotificationUrgency(params.priority);
    const scenarioKey =
      params.isNewThread && urgency === "P1"
        ? "SYSTEM_NEW_MESSAGING_THREAD"
        : "SYSTEM_NEW_MESSAGE";

    for (const userId of participantIds) {
      if (userId === params.senderId) continue;

      await createSystemNotification(
        userId,
        NotificationType.MESSAGE,
        params.isNewThread ? `New Message Thread from ${params.senderName}` : `New Message from ${params.senderName}`,
        params.content.substring(0, 100),
        `/messages/${params.conversationId}`,
        {
          scenarioKey,
          urgency,
        }
      );
    }
  } catch (error) {
    console.error("[Notifications] Failed to create notification:", error);
  }
}

export async function getConversations() {
  const session = await requireAuth();
  const userId = session.user.id;

  const conversations = await prisma.conversation.findMany({
    where: {
      isGroup: false,
      participants: {
        some: { userId },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Compute unreadCount for each conversation based on the user's lastReadAt
  const result = conversations.map((convo) => {
    const myParticipation = convo.participants.find(
      (p) => p.userId === userId
    );
    const lastReadAt = myParticipation?.lastReadAt ?? new Date(0);

    const lastMessage = convo.messages[0]
      ? {
          content: convo.messages[0].content,
          senderName: convo.messages[0].sender.name,
          createdAt: convo.messages[0].createdAt,
        }
      : null;

    return {
      id: convo.id,
      subject: convo.subject,
      contextType: normalizeConversationContextType(convo.contextType, convo.isGroup),
      updatedAt: convo.updatedAt,
      participants: convo.participants.map((p) => ({
        id: p.user.id,
        name: p.user.name,
      })),
      lastMessage,
      // We need a separate count for unread messages; compute it below
      _lastReadAt: lastReadAt,
    };
  });

  // Fetch unread counts in parallel for all conversations
  const unreadCounts = await Promise.all(
    result.map((convo) =>
      prisma.message.count({
        where: {
          conversationId: convo.id,
          createdAt: { gt: convo._lastReadAt },
          senderId: { not: userId },
        },
      })
    )
  );

  return result.map((convo, idx) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _lastReadAt, ...rest } = convo;
    return {
      ...rest,
      unreadCount: unreadCounts[idx],
    };
  });
}

// ============================================
// 2. getConversation
// ============================================

export async function getConversation(conversationId: string) {
  const session = await requireAuth();
  const userId = session.user.id;

  // Verify user is a participant
  const participation = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!participation) {
    throw new Error("You are not a participant in this conversation");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  // Update lastReadAt to now
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    data: { lastReadAt: new Date() },
  });

  return {
    id: conversation.id,
    subject: conversation.subject,
    contextType: normalizeConversationContextType(conversation.contextType, conversation.isGroup),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    participants: conversation.participants.map((p) => ({
      id: p.user.id,
      name: p.user.name,
    })),
    messages: conversation.messages.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      sender: {
        id: m.sender.id,
        name: m.sender.name,
      },
    })),
  };
}

// ============================================
// 3. sendMessage
// ============================================

export async function sendMessage(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const senderName = getSenderDisplayName(session.user.name);

  const conversationId = getString(formData, "conversationId");
  const content = getString(formData, "content");
  const priority = getMessagePriority(formData);

  // Verify user is a participant
  const participation = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!participation) {
    throw new Error("You are not a participant in this conversation");
  }

  // Create the message and update conversation updatedAt in a transaction
  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        priority,
      },
    });

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return msg;
  });

  // Trigger real-time event if Pusher is configured
  if (isPusherConfigured()) {
    const pusher = getPusherServer();
    if (pusher) {
      try {
        await pusher.trigger(
          `conversation-${conversationId}`,
          'new-message',
          {
            messageId: message.id,
            senderId: message.senderId,
            senderName,
            content: message.content,
            createdAt: message.createdAt
          }
        );

        // Notify all participants (except sender)
        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId },
          include: { user: { select: { id: true, name: true } } }
        });

        for (const participant of participants) {
          if (participant.userId !== userId) {
            await pusher.trigger(
              `user-${participant.userId}`,
              'notification',
              {
                type: 'MESSAGE',
                conversationId,
                senderName
              }
            );
          }
        }
      } catch (error) {
        console.error('[Pusher] Failed to trigger event:', error);
        // Don't fail the message send if Pusher fails
      }
    }
  }

  await notifyConversationParticipants({
    conversationId,
    senderId: userId,
    senderName,
    content: message.content,
    priority,
    isNewThread: false,
  });

  revalidatePath("/messages");
  return message;
}

// ============================================
// 4. startConversation
// ============================================

export async function startConversation(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const senderName = getSenderDisplayName(session.user.name);

  const recipientId = getString(formData, "recipientId");
  const subject = getString(formData, "subject", false) || null;
  const message = getString(formData, "message");
  const priority = getMessagePriority(formData);

  // Verify user is allowed to message this recipient
  // This checks role-based messaging rules and prevents self-messaging
  await requireCanMessage(recipientId);

  // Check if a 1:1 conversation already exists between these two users
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      contextType: ConversationContextType.DIRECT,
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: recipientId } } },
      ],
    },
    include: {
      participants: true,
    },
  });

  if (existingConversation) {
    // Filter to only 1:1 (exactly 2 participants)
    if (existingConversation.participants.length === 2) {
      // Conversation already exists - just send a message there
      await prisma.$transaction(async (tx) => {
        await tx.message.create({
          data: {
            conversationId: existingConversation.id,
            senderId: userId,
            content: message,
            priority,
          },
        });

        await tx.conversation.update({
          where: { id: existingConversation.id },
          data: { updatedAt: new Date() },
        });
      });

      await notifyConversationParticipants({
        conversationId: existingConversation.id,
        senderId: userId,
        senderName,
        content: message,
        priority,
        isNewThread: false,
        recipientIds: [recipientId],
      });

      revalidatePath("/messages");
      return { conversationId: existingConversation.id };
    }
  }

  // Create a new conversation with both participants and the first message
  const conversation = await prisma.$transaction(async (tx) => {
    const convo = await tx.conversation.create({
      data: {
        subject,
        isGroup: false,
        contextType: ConversationContextType.DIRECT,
        participants: {
          create: [
            { userId },
            { userId: recipientId },
          ],
        },
        messages: {
          create: {
            senderId: userId,
            content: message,
            priority,
          },
        },
      },
    });

    return convo;
  });

  await notifyConversationParticipants({
    conversationId: conversation.id,
    senderId: userId,
    senderName,
    content: message,
    priority,
    isNewThread: true,
    recipientIds: [recipientId],
  });

  revalidatePath("/messages");
  return { conversationId: conversation.id };
}

// ============================================
// 5. getMessageableUsers
// ============================================

export async function getMessageableUsers() {
  const session = await requireAuth();
  const userId = session.user.id;

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: true },
  });

  if (!currentUser) {
    throw new Error("User not found");
  }

  const roleTypes = currentUser.roles.map((r) => r.role);
  const isAdmin = roleTypes.includes("ADMIN");

  // Admins can message everyone
  if (isAdmin) {
    const users = await prisma.user.findMany({
      where: { id: { not: userId } },
      select: {
        id: true,
        name: true,
        email: true,
        primaryRole: true,
      },
      orderBy: { name: "asc" },
    });
    return users;
  }

  const userIds = new Set<string>();

  // Mentors: can message their mentees
  if (roleTypes.includes("MENTOR") || roleTypes.includes("CHAPTER_PRESIDENT")) {
    const mentorships = await prisma.mentorship.findMany({
      where: { mentorId: userId, status: "ACTIVE" },
      select: { menteeId: true },
    });
    mentorships.forEach((m) => userIds.add(m.menteeId));
  }

  // Instructors: can message students enrolled in their courses
  if (roleTypes.includes("INSTRUCTOR")) {
    const courses = await prisma.course.findMany({
      where: { leadInstructorId: userId },
      include: {
        enrollments: {
          select: { userId: true },
        },
      },
    });
    courses.forEach((c) =>
      c.enrollments.forEach((e) => userIds.add(e.userId))
    );
  }

  // Students: can message their instructors and mentors
  if (roleTypes.includes("STUDENT")) {
    // Instructors from enrolled courses
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: { leadInstructorId: true },
        },
      },
    });
    enrollments.forEach((e) => {
      if (e.course.leadInstructorId) {
        userIds.add(e.course.leadInstructorId);
      }
    });

    // Mentors assigned to this student
    const mentorships = await prisma.mentorship.findMany({
      where: { menteeId: userId, status: "ACTIVE" },
      select: { mentorId: true },
    });
    mentorships.forEach((m) => userIds.add(m.mentorId));
  }

  // Remove self if accidentally included
  userIds.delete(userId);

  if (userIds.size === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
    },
    orderBy: { name: "asc" },
  });

  return users;
}
