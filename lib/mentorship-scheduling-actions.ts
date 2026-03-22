"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { MentorshipSessionType } from "@prisma/client";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";

// ============================================
// AUTH HELPERS
// ============================================

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session as typeof session & { user: { id: string } };
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) throw new Error(`Missing: ${key}`);
  return value ? String(value).trim() : "";
}

// ============================================
// FETCH: SCHEDULE DATA FOR MENTEE
// ============================================

export interface SchedulePageData {
  mentorship: {
    id: string;
    mentorId: string;
    mentorName: string;
    mentorEmail: string;
    status: string;
  } | null;
  scheduleRequests: Array<{
    id: string;
    sessionType: string;
    title: string;
    notes: string | null;
    status: string;
    preferredSlots: string[];
    scheduledAt: string | null;
    meetingLink: string | null;
    createdAt: string;
  }>;
  upcomingSessions: Array<{
    id: string;
    type: string;
    title: string;
    scheduledAt: string;
    meetingLink: string | null;
    agenda: string | null;
  }>;
  // For interview scheduling context
  interviewGate: {
    id: string;
    status: string;
    slots: Array<{
      id: string;
      scheduledAt: string;
      status: string;
      meetingLink: string | null;
    }>;
  } | null;
}

export async function getSchedulePageData(): Promise<SchedulePageData | null> {
  const session = await requireSession();
  const userId = session.user.id;

  // Get active mentorship
  const mentorship = await prisma.mentorship.findFirst({
    where: { menteeId: userId, status: "ACTIVE" },
    include: {
      mentor: { select: { id: true, name: true, email: true } },
      scheduleRequests: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      sessions: {
        where: { scheduledAt: { gte: new Date() }, completedAt: null },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      },
    },
  });

  // Interview gate for this user
  const interviewGate = await prisma.instructorInterviewGate.findFirst({
    where: { ownerId: userId, status: { not: "COMPLETED" } },
    include: {
      slots: {
        where: { status: { in: ["POSTED", "CONFIRMED"] } },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      },
    },
  });

  return {
    mentorship: mentorship
      ? {
          id: mentorship.id,
          mentorId: mentorship.mentor.id,
          mentorName: mentorship.mentor.name ?? "Unknown",
          mentorEmail: mentorship.mentor.email ?? "",
          status: mentorship.status,
        }
      : null,
    scheduleRequests: (mentorship?.scheduleRequests ?? []).map((r) => ({
      id: r.id,
      sessionType: r.sessionType,
      title: r.title,
      notes: r.notes,
      status: r.status,
      preferredSlots: r.preferredSlots as string[],
      scheduledAt: r.scheduledAt?.toISOString() ?? null,
      meetingLink: r.meetingLink,
      createdAt: r.createdAt.toISOString(),
    })),
    upcomingSessions: (mentorship?.sessions ?? []).map((s) => ({
      id: s.id,
      type: s.type,
      title: s.title,
      scheduledAt: s.scheduledAt.toISOString(),
      meetingLink: null,
      agenda: s.agenda,
    })),
    interviewGate: interviewGate
      ? {
          id: interviewGate.id,
          status: interviewGate.status,
          slots: interviewGate.slots.map((slot) => ({
            id: slot.id,
            scheduledAt: slot.scheduledAt.toISOString(),
            status: slot.status,
            meetingLink: slot.meetingLink,
          })),
        }
      : null,
  };
}

// ============================================
// FETCH: MENTOR'S INCOMING SCHEDULE REQUESTS
// ============================================

export interface MentorScheduleQueueItem {
  id: string;
  menteeName: string;
  menteeEmail: string;
  mentorshipId: string;
  sessionType: string;
  title: string;
  notes: string | null;
  preferredSlots: string[];
  status: string;
  createdAt: string;
}

export async function getMentorScheduleQueue(): Promise<MentorScheduleQueueItem[]> {
  const session = await requireSession();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const mentorships = await prisma.mentorship.findMany({
    where: isAdmin ? { status: "ACTIVE" } : { mentorId: userId, status: "ACTIVE" },
    select: { id: true },
  });

  const requests = await prisma.mentorshipScheduleRequest.findMany({
    where: {
      mentorshipId: { in: mentorships.map((m) => m.id) },
      status: "PENDING",
    },
    include: {
      requestedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return requests.map((r) => ({
    id: r.id,
    menteeName: r.requestedBy.name ?? "Unknown",
    menteeEmail: r.requestedBy.email ?? "",
    mentorshipId: r.mentorshipId,
    sessionType: r.sessionType,
    title: r.title,
    notes: r.notes,
    preferredSlots: r.preferredSlots as string[],
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ============================================
// ACTION: REQUEST A MEETING
// ============================================

export async function requestMentorMeeting(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;

  const mentorshipId = getString(formData, "mentorshipId");
  const title = getString(formData, "title");
  const notes = getString(formData, "notes", false);
  const sessionTypeRaw = getString(formData, "sessionType", false) || "CHECK_IN";
  const preferredSlotsRaw = formData.getAll("preferredSlots").map(String).filter(Boolean);

  const sessionType = sessionTypeRaw as MentorshipSessionType;

  // Verify mentee owns this mentorship
  const mentorship = await prisma.mentorship.findUniqueOrThrow({
    where: { id: mentorshipId },
    include: { mentor: { select: { id: true, name: true } } },
  });

  if (mentorship.menteeId !== userId) throw new Error("Unauthorized");

  const request = await prisma.mentorshipScheduleRequest.create({
    data: {
      mentorshipId,
      requestedById: userId,
      sessionType,
      title,
      notes: notes || null,
      preferredSlots: preferredSlotsRaw,
      status: "PENDING",
    },
  });

  // Notify mentor
  await createMentorshipNotification({
    userId: mentorship.mentor.id,
    title: "New Meeting Request",
    body: `A mentee has requested a ${sessionType.replace(/_/g, " ").toLowerCase()} meeting: "${title}"`,
    link: "/mentorship-program/schedule",
  });

  revalidatePath("/my-program/schedule");
  return { success: true, requestId: request.id };
}

// ============================================
// ACTION: CONFIRM / DECLINE SCHEDULE REQUEST (mentor)
// ============================================

export async function confirmScheduleRequest(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const requestId = getString(formData, "requestId");
  const scheduledAtRaw = getString(formData, "scheduledAt");
  const meetingLink = getString(formData, "meetingLink", false);

  const request = await prisma.mentorshipScheduleRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      mentorship: { select: { mentorId: true, menteeId: true } },
    },
  });

  const isMentor = request.mentorship.mentorId === userId;
  if (!isMentor && !isAdmin) throw new Error("Unauthorized");

  const scheduledAt = new Date(scheduledAtRaw);
  if (isNaN(scheduledAt.getTime())) throw new Error("Invalid date");

  await prisma.$transaction(async (tx) => {
    await tx.mentorshipScheduleRequest.update({
      where: { id: requestId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        scheduledAt,
        meetingLink: meetingLink || null,
      },
    });

    // Auto-create a MentorshipSession
    await tx.mentorshipSession.create({
      data: {
        mentorshipId: request.mentorshipId,
        menteeId: request.mentorship.menteeId,
        type: request.sessionType,
        title: request.title,
        scheduledAt,
        agenda: request.notes,
        participantIds: [userId, request.mentorship.menteeId],
        createdById: userId,
        ledById: userId,
      },
    });
  });

  // Notify mentee
  await createMentorshipNotification({
    userId: request.mentorship.menteeId,
    title: "Meeting Confirmed",
    body: `Your meeting "${request.title}" has been confirmed for ${scheduledAt.toLocaleDateString("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
    link: "/my-program/schedule",
  });

  revalidatePath("/my-program/schedule");
  revalidatePath("/mentorship-program/schedule");
}

export async function declineScheduleRequest(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const requestId = getString(formData, "requestId");

  const request = await prisma.mentorshipScheduleRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { mentorship: { select: { mentorId: true, menteeId: true } } },
  });

  const isMentor = request.mentorship.mentorId === userId;
  if (!isMentor && !isAdmin) throw new Error("Unauthorized");

  await prisma.mentorshipScheduleRequest.update({
    where: { id: requestId },
    data: { status: "DECLINED" },
  });

  // Notify mentee
  await createMentorshipNotification({
    userId: request.mentorship.menteeId,
    title: "Meeting Request Declined",
    body: `Your meeting request "${request.title}" was declined. Please request a new time.`,
    link: "/my-program/schedule",
  });

  revalidatePath("/my-program/schedule");
  revalidatePath("/mentorship-program/schedule");
}

// ============================================
// ACTION: CANCEL SCHEDULE REQUEST (mentee)
// ============================================

export async function cancelScheduleRequest(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;

  const requestId = getString(formData, "requestId");

  const request = await prisma.mentorshipScheduleRequest.findUniqueOrThrow({
    where: { id: requestId },
  });

  if (request.requestedById !== userId) throw new Error("Unauthorized");

  await prisma.mentorshipScheduleRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/my-program/schedule");
}
