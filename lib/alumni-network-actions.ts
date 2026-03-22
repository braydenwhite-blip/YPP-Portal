"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";

// Intro request rate limits by tier
const TIER_INTRO_LIMITS: Record<string, number> = {
  BRONZE: 1,
  SILVER: 3,
  GOLD: 5,
  LIFETIME: 10,
};

// ============================================
// PANEL EVENTS
// ============================================

export async function getPanelEvents(options?: { upcoming?: boolean; limit?: number }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;
  const now = new Date();

  const events = await prisma.alumniPanelEvent.findMany({
    where: options?.upcoming ? { scheduledAt: { gte: now } } : {},
    include: {
      panelists: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      rsvps: {
        where: { userId },
      },
      _count: { select: { rsvps: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: options?.limit ?? 20,
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    topic: e.topic,
    scheduledAt: e.scheduledAt.toISOString(),
    durationMinutes: e.durationMinutes,
    meetingLink: e.meetingLink,
    maxAttendees: e.maxAttendees,
    recording: e.recording,
    isPublic: e.isPublic,
    panelists: e.panelists.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      college: p.college,
      yearStarted: p.yearStarted,
      bio: p.bio,
    })),
    myRsvpStatus: e.rsvps[0]?.status ?? null,
    rsvpCount: e._count.rsvps,
    isFull: e.maxAttendees !== null && e._count.rsvps >= e.maxAttendees,
  }));
}

export async function getPanelEvent(eventId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;

  const event = await prisma.alumniPanelEvent.findUnique({
    where: { id: eventId },
    include: {
      panelists: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      rsvps: {
        include: {
          user: { select: { id: true, name: true, primaryRole: true } },
        },
      },
    },
  });

  if (!event) return null;

  const myRsvp = event.rsvps.find((r) => r.userId === userId);

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    topic: event.topic,
    scheduledAt: event.scheduledAt.toISOString(),
    durationMinutes: event.durationMinutes,
    meetingLink: event.meetingLink,
    maxAttendees: event.maxAttendees,
    recording: event.recording,
    isPublic: event.isPublic,
    panelists: event.panelists.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      email: p.user.email,
      college: p.college,
      yearStarted: p.yearStarted,
      bio: p.bio,
    })),
    rsvps: event.rsvps.map((r) => ({
      userId: r.userId,
      name: r.user.name,
      role: r.user.primaryRole,
      status: r.status,
    })),
    myRsvpStatus: myRsvp?.status ?? null,
    rsvpCount: event.rsvps.filter((r) => r.status === "GOING").length,
    isFull:
      event.maxAttendees !== null &&
      event.rsvps.filter((r) => r.status === "GOING").length >= event.maxAttendees,
  };
}

export async function rsvpToEvent(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;
  const eventId = String(formData.get("eventId") ?? "").trim();
  const status = String(formData.get("status") ?? "GOING").trim();

  if (!["GOING", "MAYBE", "NOT_GOING"].includes(status)) throw new Error("Invalid RSVP status");

  const event = await prisma.alumniPanelEvent.findUnique({
    where: { id: eventId },
    include: { _count: { select: { rsvps: { where: { status: "GOING" } } } } },
  });
  if (!event) throw new Error("Event not found");

  // Check capacity
  if (status === "GOING" && event.maxAttendees !== null && event._count.rsvps >= event.maxAttendees) {
    throw new Error("This event is at capacity");
  }

  await prisma.alumniPanelRsvp.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, status },
    update: { status },
  });

  revalidatePath("/alumni-network/events");
  revalidatePath(`/alumni-network/events/${eventId}`);
  return { success: true };
}

export async function createPanelEvent(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("STAFF")) throw new Error("Unauthorized");

  const userId = session.user.id as string;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const topic = String(formData.get("topic") ?? "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
  const durationMinutes = parseInt(String(formData.get("durationMinutes") ?? "60"), 10);
  const meetingLink = String(formData.get("meetingLink") ?? "").trim();
  const maxAttendeesRaw = formData.get("maxAttendees");
  const isPublicRaw = formData.get("isPublic");

  if (!title || !description || !topic || !scheduledAtRaw) {
    throw new Error("Missing required fields");
  }

  const event = await prisma.alumniPanelEvent.create({
    data: {
      title,
      description,
      topic,
      scheduledAt: new Date(scheduledAtRaw),
      durationMinutes: isNaN(durationMinutes) ? 60 : durationMinutes,
      meetingLink: meetingLink || null,
      maxAttendees: maxAttendeesRaw ? parseInt(String(maxAttendeesRaw), 10) : null,
      isPublic: isPublicRaw === "true",
      createdById: userId,
    },
  });

  revalidatePath("/alumni-network/events");
  return { success: true, eventId: event.id };
}

// ============================================
// ALUMNI DIRECTORY & INTRO REQUESTS
// ============================================

export async function getAlumniDirectory() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;

  // Get users with alumni profile or who have paneled events
  const [panelists, introRequests] = await Promise.all([
    prisma.alumniPanelist.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            primaryRole: true,
            chapter: { select: { name: true } },
          },
        },
      },
      distinct: ["userId"],
    }),
    prisma.alumniIntroRequest.findMany({
      where: { requesterId: userId },
      select: { alumniId: true, status: true },
    }),
  ]);

  const introStatusMap = new Map(introRequests.map((r) => [r.alumniId, r.status]));

  // Deduplicate panelists by userId
  const seen = new Set<string>();
  const alumni = panelists
    .filter((p) => {
      if (seen.has(p.userId)) return false;
      seen.add(p.userId);
      return p.userId !== userId;
    })
    .map((p) => ({
      id: p.userId,
      name: p.user.name,
      role: p.user.primaryRole,
      college: p.college,
      yearStarted: p.yearStarted,
      bio: p.bio,
      chapterName: p.user.chapter?.name ?? null,
      introStatus: introStatusMap.get(p.userId) ?? null,
    }));

  return alumni;
}

export async function sendIntroRequest(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const requesterId = session.user.id as string;
  const alumniId = String(formData.get("alumniId") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!alumniId || !message) throw new Error("Missing required fields");
  if (alumniId === requesterId) throw new Error("Cannot send intro request to yourself");

  // Check tier-based rate limits
  const [summary, existingRequests] = await Promise.all([
    prisma.achievementPointSummary.findUnique({
      where: { userId: requesterId },
      select: { currentTier: true },
    }),
    prisma.alumniIntroRequest.count({
      where: { requesterId },
    }),
  ]);

  const tier = summary?.currentTier ?? null;
  const limit = tier ? TIER_INTRO_LIMITS[tier] ?? 1 : 1;

  if (existingRequests >= limit) {
    throw new Error(
      `You've reached your intro request limit (${limit} for ${tier ?? "no tier"}). Earn more achievement points to increase your limit.`
    );
  }

  // Check for duplicate
  const existing = await prisma.alumniIntroRequest.findFirst({
    where: { requesterId, alumniId, status: { not: "DECLINED" } },
  });
  if (existing) throw new Error("You already have a pending intro request with this alumni");

  const request = await prisma.alumniIntroRequest.create({
    data: { requesterId, alumniId, message },
  });

  // Notify the alumni
  await createMentorshipNotification({
    userId: alumniId,
    title: "New Intro Request",
    body: "A YPP member has sent you an introduction request through the Alumni Network.",
    link: "/alumni-network/requests",
  });

  revalidatePath("/alumni-network/browse");
  return { success: true, requestId: request.id };
}

export async function respondToIntroRequest(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id as string;
  const requestId = String(formData.get("requestId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!["ACCEPTED", "DECLINED"].includes(status)) throw new Error("Invalid status");

  const request = await prisma.alumniIntroRequest.findUnique({
    where: { id: requestId },
    include: { requester: { select: { name: true } } },
  });

  if (!request || request.alumniId !== userId) throw new Error("Not found");

  await prisma.alumniIntroRequest.update({
    where: { id: requestId },
    data: {
      status,
      acceptedAt: status === "ACCEPTED" ? new Date() : null,
    },
  });

  // Notify the requester
  if (status === "ACCEPTED") {
    await createMentorshipNotification({
      userId: request.requesterId,
      title: "Intro Request Accepted",
      body: "An alumni has accepted your introduction request! Check the Alumni Network to connect.",
      link: "/alumni-network/browse",
    });
  }

  revalidatePath("/alumni-network/requests");
  return { success: true };
}

export async function getMyIntroRequests() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;

  const [sent, received] = await Promise.all([
    prisma.alumniIntroRequest.findMany({
      where: { requesterId: userId },
      include: {
        alumni: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.alumniIntroRequest.findMany({
      where: { alumniId: userId, status: "PENDING" },
      include: {
        requester: { select: { id: true, name: true, primaryRole: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    sent: sent.map((r) => ({
      id: r.id,
      alumniId: r.alumniId,
      alumniName: r.alumni.name,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      acceptedAt: r.acceptedAt?.toISOString() ?? null,
    })),
    received: received.map((r) => ({
      id: r.id,
      requesterId: r.requesterId,
      requesterName: r.requester.name,
      requesterRole: r.requester.primaryRole,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
