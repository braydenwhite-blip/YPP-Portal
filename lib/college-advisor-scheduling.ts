"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { CollegeMeetingStatus, CollegeResourceCategory } from "@prisma/client";
import { getUserAwardTier } from "@/lib/alumni-actions";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";

// ============================================
// TIER MEETING LIMITS
// ============================================

const TIER_MEETING_LIMITS: Record<string, number> = {
  BRONZE: 0,
  SILVER: 1,
  GOLD: 2,
  LIFETIME: -1, // unlimited
};

function getTierMeetingLimit(tier: string | null): number {
  if (!tier) return 0;
  return TIER_MEETING_LIMITS[tier] ?? 0;
}

// ============================================
// AUTH HELPERS
// ============================================

async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session as typeof session & { user: { id: string } };
}

async function requireAdvisor() {
  const session = await requireAuth();
  const advisor = await prisma.collegeAdvisor.findUnique({
    where: { userId: session.user.id },
  });
  if (!advisor) throw new Error("You are not a college advisor");
  return { session, advisor };
}

async function requireAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) throw new Error("Unauthorized");
  return session;
}

// ============================================
// MEETINGS — ADVISEE ACTIONS
// ============================================

/**
 * Get meeting history for the current advisee's active advisorship.
 */
export async function getMyMeetings() {
  const session = await requireAuth();
  const userId = session.user.id as string;

  const advisorship = await prisma.collegeAdvisorship.findFirst({
    where: { adviseeId: userId, endDate: null },
    include: {
      meetings: {
        orderBy: { scheduledAt: "desc" },
      },
      advisor: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!advisorship) return null;

  return {
    advisorshipId: advisorship.id,
    advisorName: advisorship.advisor.user.name,
    meetings: advisorship.meetings.map((m) => ({
      id: m.id,
      scheduledAt: m.scheduledAt.toISOString(),
      durationMinutes: m.durationMinutes,
      status: m.status,
      meetingLink: m.meetingLink,
      topic: m.topic,
      notes: m.notes,
      actionItems: m.actionItems,
      adviseeRating: m.adviseeRating,
      adviseeFeedback: m.adviseeFeedback,
    })),
  };
}

/**
 * Request a meeting with the assigned advisor. Enforces tier-based limits.
 */
export async function requestMeeting(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id as string;

  const advisorshipId = formData.get("advisorshipId") as string;
  const scheduledAt = formData.get("scheduledAt") as string;
  const topic = formData.get("topic") as string;
  const durationMinutes = parseInt(formData.get("durationMinutes") as string) || 30;

  if (!advisorshipId || !scheduledAt) throw new Error("Missing required fields");

  const advisorship = await prisma.collegeAdvisorship.findUniqueOrThrow({
    where: { id: advisorshipId },
    include: {
      advisor: { include: { user: { select: { id: true, name: true } } } },
      advisee: { select: { id: true, name: true } },
    },
  });

  if (advisorship.adviseeId !== userId) throw new Error("Not your advisorship");

  // Check tier meeting limit
  const tier = await getUserAwardTier(userId);
  const limit = getTierMeetingLimit(tier);

  if (limit === 0) throw new Error("Your award tier does not include college advisor meetings");

  if (limit > 0) {
    const existingCount = await prisma.collegeAdvisorMeeting.count({
      where: {
        advisorshipId,
        status: { in: ["REQUESTED", "CONFIRMED", "COMPLETED"] },
      },
    });
    if (existingCount >= limit) {
      throw new Error(`You have reached your meeting limit (${limit} meetings for ${tier} tier)`);
    }
  }

  const meeting = await prisma.collegeAdvisorMeeting.create({
    data: {
      advisorshipId,
      scheduledAt: new Date(scheduledAt),
      durationMinutes,
      topic: topic || null,
      status: "REQUESTED",
    },
  });

  // Notify advisor
  await createMentorshipNotification({
    userId: advisorship.advisor.user.id,
    title: "New Meeting Request",
    body: `${advisorship.advisee.name} has requested a college advising meeting${topic ? ` about: ${topic}` : ""}.`,
    link: "/advisor-dashboard",
  });

  revalidatePath("/college-advisor");
  return meeting.id;
}

/**
 * Rate and leave feedback on a completed meeting.
 */
export async function rateMeeting(formData: FormData) {
  const session = await requireAuth();
  const meetingId = formData.get("meetingId") as string;
  const rating = parseInt(formData.get("rating") as string);
  const feedback = formData.get("feedback") as string;

  if (!meetingId || !rating || rating < 1 || rating > 5) throw new Error("Invalid rating");

  const meeting = await prisma.collegeAdvisorMeeting.findUniqueOrThrow({
    where: { id: meetingId },
    include: { advisorship: { select: { adviseeId: true } } },
  });

  if (meeting.advisorship.adviseeId !== session.user.id) throw new Error("Not your meeting");
  if (meeting.status !== "COMPLETED") throw new Error("Can only rate completed meetings");

  await prisma.collegeAdvisorMeeting.update({
    where: { id: meetingId },
    data: {
      adviseeRating: rating,
      adviseeFeedback: feedback || null,
    },
  });

  revalidatePath("/college-advisor");
}

// ============================================
// MEETINGS — ADVISOR ACTIONS
// ============================================

/**
 * Get all meetings for the current advisor across all advisees.
 */
export async function getAdvisorMeetings() {
  const { advisor } = await requireAdvisor();

  const meetings = await prisma.collegeAdvisorMeeting.findMany({
    where: { advisorship: { advisorId: advisor.id } },
    include: {
      advisorship: {
        include: {
          advisee: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { scheduledAt: "desc" },
  });

  return meetings.map((m) => ({
    id: m.id,
    adviseeName: m.advisorship.advisee.name,
    adviseeEmail: m.advisorship.advisee.email,
    advisorshipId: m.advisorshipId,
    scheduledAt: m.scheduledAt.toISOString(),
    durationMinutes: m.durationMinutes,
    status: m.status,
    meetingLink: m.meetingLink,
    topic: m.topic,
    notes: m.notes,
    actionItems: m.actionItems,
    adviseeRating: m.adviseeRating,
    adviseeFeedback: m.adviseeFeedback,
  }));
}

/**
 * Advisor confirms a meeting request, optionally adding a meeting link.
 */
export async function confirmMeeting(formData: FormData) {
  const { advisor } = await requireAdvisor();
  const meetingId = formData.get("meetingId") as string;
  const meetingLink = formData.get("meetingLink") as string;

  const meeting = await prisma.collegeAdvisorMeeting.findUniqueOrThrow({
    where: { id: meetingId },
    include: {
      advisorship: {
        select: { advisorId: true, advisee: { select: { id: true, name: true } } },
      },
    },
  });

  if (meeting.advisorship.advisorId !== advisor.id) throw new Error("Not your meeting");
  if (meeting.status !== "REQUESTED") throw new Error("Meeting is not in REQUESTED status");

  await prisma.collegeAdvisorMeeting.update({
    where: { id: meetingId },
    data: {
      status: "CONFIRMED",
      meetingLink: meetingLink || null,
    },
  });

  // Notify advisee
  await createMentorshipNotification({
    userId: meeting.advisorship.advisee.id,
    title: "Meeting Confirmed",
    body: `Your college advisor meeting has been confirmed for ${meeting.scheduledAt.toLocaleDateString()}.`,
    link: "/college-advisor",
  });

  revalidatePath("/advisor-dashboard");
}

/**
 * Advisor marks a meeting as completed with notes and action items.
 */
export async function completeMeeting(formData: FormData) {
  const { advisor } = await requireAdvisor();
  const meetingId = formData.get("meetingId") as string;
  const notes = formData.get("notes") as string;
  const actionItems = formData.get("actionItems") as string;

  const meeting = await prisma.collegeAdvisorMeeting.findUniqueOrThrow({
    where: { id: meetingId },
    include: { advisorship: { select: { advisorId: true } } },
  });

  if (meeting.advisorship.advisorId !== advisor.id) throw new Error("Not your meeting");

  await prisma.collegeAdvisorMeeting.update({
    where: { id: meetingId },
    data: {
      status: "COMPLETED",
      notes: notes || null,
      actionItems: actionItems || null,
    },
  });

  revalidatePath("/advisor-dashboard");
}

/**
 * Advisor cancels a meeting.
 */
export async function cancelMeeting(formData: FormData) {
  const { advisor } = await requireAdvisor();
  const meetingId = formData.get("meetingId") as string;

  const meeting = await prisma.collegeAdvisorMeeting.findUniqueOrThrow({
    where: { id: meetingId },
    include: {
      advisorship: {
        select: { advisorId: true, advisee: { select: { id: true } } },
      },
    },
  });

  if (meeting.advisorship.advisorId !== advisor.id) throw new Error("Not your meeting");

  await prisma.collegeAdvisorMeeting.update({
    where: { id: meetingId },
    data: { status: "CANCELLED" },
  });

  await createMentorshipNotification({
    userId: meeting.advisorship.advisee.id,
    title: "Meeting Cancelled",
    body: "Your college advisor meeting has been cancelled. Please request a new time.",
    link: "/college-advisor",
  });

  revalidatePath("/advisor-dashboard");
}

// ============================================
// AVAILABILITY SLOTS
// ============================================

/**
 * Get the current advisor's availability slots.
 */
export async function getMyAvailabilitySlots() {
  const { advisor } = await requireAdvisor();

  const slots = await prisma.advisorAvailabilitySlot.findMany({
    where: { advisorId: advisor.id, isActive: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return slots.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    timezone: s.timezone,
    isRecurring: s.isRecurring,
  }));
}

/**
 * Get available slots for a specific advisor (for advisee scheduling).
 */
export async function getAdvisorAvailability(advisorId: string) {
  await requireAuth();

  const slots = await prisma.advisorAvailabilitySlot.findMany({
    where: { advisorId, isActive: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return slots.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    timezone: s.timezone,
  }));
}

/**
 * Advisor adds a new availability slot.
 */
export async function addAvailabilitySlot(formData: FormData) {
  const { advisor } = await requireAdvisor();

  const dayOfWeek = parseInt(formData.get("dayOfWeek") as string);
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const timezone = (formData.get("timezone") as string) || "America/New_York";

  if (dayOfWeek < 0 || dayOfWeek > 6) throw new Error("Invalid day of week");
  if (!startTime || !endTime) throw new Error("Start and end time required");

  await prisma.advisorAvailabilitySlot.create({
    data: {
      advisorId: advisor.id,
      dayOfWeek,
      startTime,
      endTime,
      timezone,
    },
  });

  revalidatePath("/college-advisor/advisor-settings");
  revalidatePath("/advisor-dashboard");
}

/**
 * Advisor removes an availability slot.
 */
export async function removeAvailabilitySlot(slotId: string) {
  const { advisor } = await requireAdvisor();

  const slot = await prisma.advisorAvailabilitySlot.findUniqueOrThrow({
    where: { id: slotId },
  });

  if (slot.advisorId !== advisor.id) throw new Error("Not your slot");

  await prisma.advisorAvailabilitySlot.update({
    where: { id: slotId },
    data: { isActive: false },
  });

  revalidatePath("/college-advisor/advisor-settings");
  revalidatePath("/advisor-dashboard");
}

// ============================================
// COLLEGE RESOURCES
// ============================================

/**
 * Get all resources (public — any authenticated user).
 */
export async function getCollegeResources(filters?: {
  category?: CollegeResourceCategory;
  search?: string;
}) {
  await requireAuth();

  const where: Record<string, unknown> = {};
  if (filters?.category) where.category = filters.category;
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const resources = await prisma.collegeResource.findMany({
    where,
    include: {
      advisor: {
        include: { user: { select: { name: true } } },
      },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
  });

  return resources.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    url: r.url,
    category: r.category,
    tags: r.tags,
    isFeatured: r.isFeatured,
    advisorName: r.advisor.user.name,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Advisor creates a new resource.
 */
export async function createResource(formData: FormData) {
  const { advisor } = await requireAdvisor();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const url = formData.get("url") as string;
  const category = formData.get("category") as CollegeResourceCategory;
  const tagsRaw = formData.get("tags") as string;
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  if (!title) throw new Error("Title is required");
  if (!Object.values(CollegeResourceCategory).includes(category)) throw new Error("Invalid category");

  await prisma.collegeResource.create({
    data: {
      advisorId: advisor.id,
      title,
      description: description || null,
      url: url || null,
      category,
      tags,
    },
  });

  revalidatePath("/college-advisor/resources");
  revalidatePath("/advisor-dashboard");
}

/**
 * Advisor deletes their own resource.
 */
export async function deleteResource(resourceId: string) {
  const { advisor } = await requireAdvisor();

  const resource = await prisma.collegeResource.findUniqueOrThrow({
    where: { id: resourceId },
  });

  if (resource.advisorId !== advisor.id) throw new Error("Not your resource");

  await prisma.collegeResource.delete({
    where: { id: resourceId },
  });

  revalidatePath("/college-advisor/resources");
  revalidatePath("/advisor-dashboard");
}

// ============================================
// ADVISOR DASHBOARD DATA
// ============================================

/**
 * Get comprehensive dashboard data for a college advisor.
 */
export async function getAdvisorDashboardData() {
  const { advisor } = await requireAdvisor();

  const [advisees, meetings, resources, slots] = await Promise.all([
    prisma.collegeAdvisorship.findMany({
      where: { advisorId: advisor.id, endDate: null },
      include: {
        advisee: { select: { id: true, name: true, email: true } },
        _count: { select: { meetings: true } },
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.collegeAdvisorMeeting.findMany({
      where: { advisorship: { advisorId: advisor.id } },
      include: {
        advisorship: {
          include: { advisee: { select: { name: true } } },
        },
      },
      orderBy: { scheduledAt: "desc" },
      take: 20,
    }),
    prisma.collegeResource.findMany({
      where: { advisorId: advisor.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.advisorAvailabilitySlot.findMany({
      where: { advisorId: advisor.id, isActive: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
  ]);

  // Compute average rating
  const ratedMeetings = meetings.filter((m) => m.adviseeRating !== null);
  const avgRating = ratedMeetings.length > 0
    ? ratedMeetings.reduce((sum, m) => sum + (m.adviseeRating ?? 0), 0) / ratedMeetings.length
    : null;

  return {
    advisorId: advisor.id,
    college: advisor.college,
    major: advisor.major,
    advisees: advisees.map((a) => ({
      advisorshipId: a.id,
      adviseeName: a.advisee.name,
      adviseeEmail: a.advisee.email,
      startDate: a.startDate.toISOString(),
      meetingCount: a._count.meetings,
    })),
    upcomingMeetings: meetings
      .filter((m) => m.status === "REQUESTED" || m.status === "CONFIRMED")
      .map((m) => ({
        id: m.id,
        adviseeName: m.advisorship.advisee.name,
        scheduledAt: m.scheduledAt.toISOString(),
        status: m.status,
        topic: m.topic,
        meetingLink: m.meetingLink,
      })),
    pastMeetings: meetings
      .filter((m) => m.status === "COMPLETED" || m.status === "CANCELLED" || m.status === "NO_SHOW")
      .map((m) => ({
        id: m.id,
        adviseeName: m.advisorship.advisee.name,
        scheduledAt: m.scheduledAt.toISOString(),
        status: m.status,
        topic: m.topic,
        notes: m.notes,
        actionItems: m.actionItems,
        adviseeRating: m.adviseeRating,
        adviseeFeedback: m.adviseeFeedback,
      })),
    resources: resources.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      createdAt: r.createdAt.toISOString(),
    })),
    availabilitySlots: slots.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      timezone: s.timezone,
    })),
    avgRating,
    totalMeetings: meetings.length,
    completedMeetings: meetings.filter((m) => m.status === "COMPLETED").length,
  };
}

// ============================================
// ADMIN: ADVISOR ANALYTICS
// ============================================

/**
 * Get advisor utilization metrics for the admin panel.
 */
export async function getAdvisorAnalytics() {
  await requireAdmin();

  const advisors = await prisma.collegeAdvisor.findMany({
    where: { isActive: true },
    include: {
      user: { select: { name: true, email: true } },
      advisees: {
        where: { endDate: null },
        include: {
          meetings: {
            select: { status: true, adviseeRating: true },
          },
        },
      },
    },
  });

  return advisors.map((a) => {
    const allMeetings = a.advisees.flatMap((adv) => adv.meetings);
    const completed = allMeetings.filter((m) => m.status === "COMPLETED");
    const rated = completed.filter((m) => m.adviseeRating !== null);
    const avgRating = rated.length > 0
      ? rated.reduce((sum, m) => sum + (m.adviseeRating ?? 0), 0) / rated.length
      : null;

    return {
      advisorId: a.id,
      advisorName: a.user.name,
      advisorEmail: a.user.email,
      college: a.college,
      activeAdvisees: a.advisees.length,
      totalMeetings: allMeetings.length,
      completedMeetings: completed.length,
      avgRating,
    };
  });
}
