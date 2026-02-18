"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { requireCanMessage } from "@/lib/authorization-helpers";
import { getPusherServer, isPusherConfigured } from "@/lib/pusher";
import { createSystemNotification } from "@/lib/notification-actions";
import { NotificationType } from "@prisma/client";

// ============================================
// HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
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

type ChannelAudience = "ALL" | "STUDENTS" | "INSTRUCTORS" | "MENTORS" | "LEADERSHIP";

type ChatChannelSeed = {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  audience: ChannelAudience;
  source: "core" | "class";
};

export type ChatChannel = {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  audience: ChannelAudience;
  source: "core" | "class";
  conversationId: string;
  unreadCount: number;
};

const CORE_CHAT_CHANNELS: ChatChannelSeed[] = [
  {
    slug: "general",
    name: "General",
    description: "Community-wide announcements, wins, and quick questions.",
    emoji: "🌟",
    audience: "ALL",
    source: "core",
  },
  {
    slug: "students-lounge",
    name: "Students Lounge",
    description: "Students helping students with ideas, motivation, and progress.",
    emoji: "🎒",
    audience: "STUDENTS",
    source: "core",
  },
  {
    slug: "instructor-lounge",
    name: "Instructor Lounge",
    description: "Instructor planning, delivery tips, and collaboration.",
    emoji: "🧑‍🏫",
    audience: "INSTRUCTORS",
    source: "core",
  },
  {
    slug: "mentor-corner",
    name: "Mentor Corner",
    description: "Mentor and mentee support, check-ins, and growth conversations.",
    emoji: "🤝",
    audience: "MENTORS",
    source: "core",
  },
  {
    slug: "leadership-ops",
    name: "Leadership Ops",
    description: "Operational updates for chapter leads, staff, and admins.",
    emoji: "📈",
    audience: "LEADERSHIP",
    source: "core",
  },
];

function hasAudienceAccess(audience: ChannelAudience, roles: string[]) {
  if (audience === "ALL") return true;
  if (audience === "STUDENTS") return roles.includes("STUDENT") || roles.includes("ADMIN");
  if (audience === "INSTRUCTORS") {
    return roles.includes("INSTRUCTOR") || roles.includes("CHAPTER_LEAD") || roles.includes("ADMIN");
  }
  if (audience === "MENTORS") {
    return roles.includes("MENTOR") || roles.includes("CHAPTER_LEAD") || roles.includes("ADMIN");
  }
  return roles.includes("CHAPTER_LEAD") || roles.includes("STAFF") || roles.includes("ADMIN");
}

function channelSubject(slug: string) {
  return `#${slug}`;
}

async function ensureChannelConversation(slug: string, userId: string) {
  const subject = channelSubject(slug);

  let conversation = await prisma.conversation.findFirst({
    where: {
      isGroup: true,
      subject,
    },
    select: { id: true },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        subject,
        isGroup: true,
        participants: {
          create: [{ userId }],
        },
      },
      select: { id: true },
    });
  } else {
    await prisma.conversationParticipant.upsert({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId,
        },
      },
      create: {
        conversationId: conversation.id,
        userId,
      },
      update: {},
    });
  }

  return conversation.id;
}

async function getChannelUnreadCount(conversationId: string, userId: string) {
  const participation = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    select: { lastReadAt: true },
  });

  if (!participation) return 0;

  return prisma.message.count({
    where: {
      conversationId,
      senderId: { not: userId },
      createdAt: { gt: participation.lastReadAt },
    },
  });
}

async function getClassChannelSeeds(userId: string, roles: string[]) {
  const channelMap = new Map<string, ChatChannelSeed>();
  const canTeach = roles.includes("INSTRUCTOR") || roles.includes("CHAPTER_LEAD") || roles.includes("ADMIN");
  const isStudent = roles.includes("STUDENT");

  if (canTeach) {
    const instructedOfferings = await prisma.classOffering.findMany({
      where: {
        instructorId: userId,
        status: { in: ["PUBLISHED", "IN_PROGRESS"] },
      },
      select: {
        id: true,
        title: true,
        semester: true,
      },
      orderBy: { startDate: "desc" },
      take: 8,
    });

    for (const offering of instructedOfferings) {
      const slug = `class-${offering.id}`;
      channelMap.set(slug, {
        slug,
        name: `${offering.title} Chat`,
        description: offering.semester
          ? `Class discussion channel for ${offering.semester}.`
          : "Class discussion channel for students and instructor.",
        emoji: "📚",
        audience: "ALL",
        source: "class",
      });
    }
  }

  if (isStudent) {
    const myEnrollments = await prisma.classEnrollment.findMany({
      where: {
        studentId: userId,
        status: { in: ["ENROLLED", "WAITLISTED"] },
      },
      include: {
        offering: {
          select: {
            id: true,
            title: true,
            semester: true,
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
      take: 8,
    });

    for (const enrollment of myEnrollments) {
      const slug = `class-${enrollment.offering.id}`;
      if (channelMap.has(slug)) continue;

      channelMap.set(slug, {
        slug,
        name: `${enrollment.offering.title} Chat`,
        description: enrollment.offering.semester
          ? `Class discussion channel for ${enrollment.offering.semester}.`
          : "Class discussion channel for students and instructor.",
        emoji: "📚",
        audience: "ALL",
        source: "class",
      });
    }
  }

  return Array.from(channelMap.values());
}

export async function getChatChannels(): Promise<ChatChannel[]> {
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
  const coreChannels = CORE_CHAT_CHANNELS.filter((channel) =>
    hasAudienceAccess(channel.audience, roleTypes)
  );
  const classChannels = await getClassChannelSeeds(userId, roleTypes);
  const allChannels = [...coreChannels, ...classChannels];

  const channelsWithMeta = await Promise.all(
    allChannels.map(async (channel) => {
      const conversationId = await ensureChannelConversation(channel.slug, userId);
      const unreadCount = await getChannelUnreadCount(conversationId, userId);
      return {
        ...channel,
        conversationId,
        unreadCount,
      };
    })
  );

  channelsWithMeta.sort((a, b) => {
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    if (a.source !== b.source) return a.source === "core" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return channelsWithMeta;
}

// ============================================
// 1. getConversations
// ============================================

export async function getConversations() {
  const session = await requireAuth();
  const userId = session.user.id;

  const conversations = await prisma.conversation.findMany({
    where: {
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
      isGroup: convo.isGroup,
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
    isGroup: conversation.isGroup,
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

  const conversationId = getString(formData, "conversationId");
  const content = getString(formData, "content");

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
            senderName: session.user.name,
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
                senderName: session.user.name
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

  // Create system notifications for all participants (except sender)
  try {
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true }
    });

    for (const participant of participants) {
      if (participant.userId !== userId) {
        await createSystemNotification(
          participant.userId,
          NotificationType.MESSAGE,
          `New Message from ${session.user.name}`,
          message.content.substring(0, 100),
          `/messages/${conversationId}`,
          false // Don't send email for every message
        );
      }
    }
  } catch (error) {
    console.error('[Notifications] Failed to create notification:', error);
    // Don't fail the message send if notifications fail
  }

  revalidatePath("/messages");
  return message;
}

// ============================================
// 4. startConversation
// ============================================

export async function startConversation(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const recipientId = getString(formData, "recipientId");
  const subject = getString(formData, "subject", false) || null;
  const message = getString(formData, "message");

  // Verify user is allowed to message this recipient
  // This checks role-based messaging rules and prevents self-messaging
  await requireCanMessage(recipientId);

  // Check if a 1:1 conversation already exists between these two users
  const existingConversation = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
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
          },
        });

        await tx.conversation.update({
          where: { id: existingConversation.id },
          data: { updatedAt: new Date() },
        });
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
          },
        },
      },
    });

    return convo;
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
  if (roleTypes.includes("MENTOR") || roleTypes.includes("CHAPTER_LEAD")) {
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
