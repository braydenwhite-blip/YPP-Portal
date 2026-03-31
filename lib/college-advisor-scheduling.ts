"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { CollegeMeetingStatus, CollegeResourceCategory } from "@prisma/client";
import { getUserAwardTier } from "@/lib/alumni-actions";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";
import { toAbsoluteAppUrl } from "@/lib/public-app-url";
import { getSchedulingEventUid } from "@/lib/scheduling/calendar";
import { getUserBusyIntervals } from "@/lib/scheduling/busy-intervals";
import { sendSchedulingLifecycleEmail } from "@/lib/scheduling/email";
import {
  formatScheduleDateTime,
  generateSchedulingSlots,
  rangesOverlap,
  type SchedulingOverrideLike,
  type SchedulingRuleLike,
} from "@/lib/scheduling/shared";

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

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing: ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getNumber(formData: FormData, key: string, fallback = 0) {
  const raw = formData.get(key);
  if (!raw) return fallback;
  const value = Number(String(raw));
  return Number.isFinite(value) ? value : fallback;
}

function getOptionalDate(raw: string | null | undefined) {
  if (!raw) return null;
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value;
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

async function requireAdvisorOrAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const advisor = await prisma.collegeAdvisor.findUnique({
    where: { userId: session.user.id },
  });

  if (!advisor && !isAdmin) {
    throw new Error("Unauthorized");
  }

  return {
    session,
    isAdmin,
    advisor,
  };
}

type AdvisorBookableSlotView = {
  slotKey: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  duration: number;
  meetingLink: string | null;
  locationLabel: string | null;
  warningLabels: string[];
};

function formatDurationLabel(duration: number) {
  return `${duration} min`;
}

async function getAdvisorAvailabilityData(advisorId: string) {
  const [rules, overrides] = await Promise.all([
    prisma.advisorAvailabilitySlot.findMany({
      where: { advisorId, isActive: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.advisorAvailabilityOverride.findMany({
      where: {
        advisorId,
        isActive: true,
        endsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  return {
    rules: rules.map<SchedulingRuleLike>((rule) => ({
      id: rule.id,
      ownerId: rule.advisorId,
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      timezone: rule.timezone,
      slotDuration: rule.slotDuration,
      bufferMinutes: rule.bufferMinutes,
      meetingLink: rule.meetingLink,
      locationLabel: rule.locationLabel,
      isActive: rule.isActive,
    })),
    overrides: overrides.map<SchedulingOverrideLike>((override) => ({
      id: override.id,
      ownerId: override.advisorId,
      ruleId: override.slotId,
      type: override.type,
      startsAt: override.startsAt,
      endsAt: override.endsAt,
      timezone: override.timezone,
      slotDuration: override.slotDuration,
      bufferMinutes: override.bufferMinutes,
      meetingLink: override.meetingLink,
      locationLabel: override.locationLabel,
      note: override.note,
      isActive: override.isActive,
    })),
  };
}

async function getAdvisorBookableSlots(advisorUserId: string, advisorId: string, rangeStart = new Date()) {
  const [availability, busyIntervals] = await Promise.all([
    getAdvisorAvailabilityData(advisorId),
    getUserBusyIntervals(advisorUserId, rangeStart),
  ]);

  return generateSchedulingSlots({
    ownerId: advisorId,
    rules: availability.rules,
    overrides: availability.overrides,
    busyIntervals,
    rangeStart,
    days: 21,
  });
}

async function assertCollegeMeetingConflict(userId: string, startsAt: Date, duration: number) {
  const intervals = await getUserBusyIntervals(userId, new Date(startsAt.getTime() - 24 * 60 * 60 * 1000));
  const endsAt = new Date(startsAt.getTime() + duration * 60_000);
  const conflict = intervals.find((interval) =>
    rangesOverlap(startsAt, endsAt, interval.startsAt, interval.endsAt)
  );

  if (conflict) {
    throw new Error(
      `That time conflicts with an existing booking${conflict.label ? ` (${conflict.label})` : ""}.`
    );
  }
}

async function sendCollegeAdvisorLifecycleEmails(params: {
  event: "REQUESTED" | "CONFIRMED" | "RESCHEDULED" | "CANCELLED" | "REMINDER_24H" | "REMINDER_2H";
  meetingId: string;
  topic: string | null;
  scheduledAt?: Date | null;
  durationMinutes?: number;
  meetingLink?: string | null;
  advisor: { name: string | null; email: string | null };
  advisee: { name: string | null; email: string | null };
}) {
  const {
    event,
    meetingId,
    topic,
    scheduledAt = null,
    durationMinutes = 30,
    meetingLink = null,
    advisor,
    advisee,
  } = params;

  const title = topic?.trim() || "College advising meeting";
  const when = scheduledAt ? formatScheduleDateTime(scheduledAt) : "To be scheduled";
  const uid = getSchedulingEventUid("college-advisor", meetingId);
  const calendarBase =
    scheduledAt && event !== "REQUESTED"
      ? {
          uid,
          title,
          startsAt: scheduledAt,
          durationMinutes,
          descriptionLines: [
            `College advisor meeting`,
            `Advisor: ${advisor.name ?? "Advisor"}`,
            `Student: ${advisee.name ?? "Student"}`,
            meetingLink ? `Meeting Link: ${meetingLink}` : "",
          ].filter(Boolean),
          location: meetingLink || "See YPP Portal for details",
        }
      : null;

  const advisorTemplate = {
    REQUESTED: {
      subject: "New college advising meeting request",
      heading: "A student asked for time with you",
      message: `${advisee.name ?? "A student"} sent a new meeting request.`,
      details: [{ label: "Topic", value: title }],
      calendar: null,
    },
    CONFIRMED: {
      subject: "College advising meeting confirmed",
      heading: "The meeting is booked",
      message: `${advisee.name ?? "Your student"} has a confirmed time.`,
      details: [
        { label: "Topic", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: calendarBase
        ? { ...calendarBase, method: "REQUEST", filename: "advisor-confirmed.ics" as const }
        : null,
    },
    RESCHEDULED: {
      subject: "College advising meeting moved",
      heading: "The meeting has a new time",
      message: `${advisee.name ?? "Your student"} now has a new confirmed slot.`,
      details: [
        { label: "Topic", value: title },
        { label: "New Time", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: calendarBase
        ? { ...calendarBase, method: "REQUEST", filename: "advisor-rescheduled.ics" as const }
        : null,
    },
    CANCELLED: {
      subject: "College advising meeting cancelled",
      heading: "A meeting was cancelled",
      message: `${title} was removed from the calendar.`,
      details: [{ label: "Topic", value: title }],
      calendar: calendarBase
        ? { ...calendarBase, method: "CANCEL", status: "CANCELLED", filename: "advisor-cancelled.ics" as const }
        : null,
    },
    REMINDER_24H: {
      subject: "Reminder: advising meeting tomorrow",
      heading: "Your college advising meeting is tomorrow",
      message: `${title} is coming up tomorrow.`,
      details: [
        { label: "Topic", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: null,
    },
    REMINDER_2H: {
      subject: "Reminder: advising meeting coming up",
      heading: "Your college advising meeting starts soon",
      message: `${title} starts in about two hours.`,
      details: [
        { label: "Topic", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: null,
    },
  } as const;

  const adviseeTemplate = {
    REQUESTED: {
      subject: "Your college advising meeting request was sent",
      heading: "Your request is on its way",
      message: `We sent your request to ${advisor.name ?? "your advisor"}.`,
      details: [{ label: "Topic", value: title }],
      calendar: null,
    },
    CONFIRMED: {
      subject: "College advising meeting confirmed",
      heading: "Your advising meeting is booked",
      message: `${advisor.name ?? "Your advisor"} confirmed your time.`,
      details: [
        { label: "Topic", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: calendarBase
        ? { ...calendarBase, method: "REQUEST", filename: "advisor-confirmed.ics" as const }
        : null,
    },
    RESCHEDULED: {
      subject: "College advising meeting moved",
      heading: "Your advising meeting has a new time",
      message: `${advisor.name ?? "Your advisor"} updated the schedule.`,
      details: [
        { label: "Topic", value: title },
        { label: "New Time", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: calendarBase
        ? { ...calendarBase, method: "REQUEST", filename: "advisor-rescheduled.ics" as const }
        : null,
    },
    CANCELLED: {
      subject: "College advising meeting cancelled",
      heading: "Your advising meeting was cancelled",
      message: "You can pick a new time in the portal whenever you are ready.",
      details: [{ label: "Topic", value: title }],
      calendar: calendarBase
        ? { ...calendarBase, method: "CANCEL", status: "CANCELLED", filename: "advisor-cancelled.ics" as const }
        : null,
    },
    REMINDER_24H: {
      subject: "Reminder: advising meeting tomorrow",
      heading: "Your college advising meeting is tomorrow",
      message: `${title} is almost here.`,
      details: [
        { label: "Topic", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: null,
    },
    REMINDER_2H: {
      subject: "Reminder: advising meeting coming up",
      heading: "Your college advising meeting starts soon",
      message: `${title} starts in about two hours.`,
      details: [
        { label: "Topic", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: null,
    },
  } as const;

  const advisorCard = advisorTemplate[event];
  const adviseeCard = adviseeTemplate[event];

  await Promise.all(
    [
      advisor.email
        ? sendSchedulingLifecycleEmail({
            to: advisor.email,
            recipientName: advisor.name,
            eyebrow: "College Advisor Scheduling",
            subject: advisorCard.subject,
            heading: advisorCard.heading,
            message: advisorCard.message,
            details: advisorCard.details,
            actionUrl: toAbsoluteAppUrl("/advisor-dashboard"),
            actionLabel: "Open Advisor Dashboard",
            calendar: advisorCard.calendar,
          })
        : null,
      advisee.email
        ? sendSchedulingLifecycleEmail({
            to: advisee.email,
            recipientName: advisee.name,
            eyebrow: "College Advisor Scheduling",
            subject: adviseeCard.subject,
            heading: adviseeCard.heading,
            message: adviseeCard.message,
            details: adviseeCard.details,
            actionUrl: toAbsoluteAppUrl("/college-advisor"),
            actionLabel: "Open College Advisor",
            calendar: adviseeCard.calendar,
          })
        : null,
    ].filter(Boolean)
  );
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

  const [slots, overrides] = await Promise.all([
    prisma.advisorAvailabilitySlot.findMany({
      where: { advisorId: advisor.id, isActive: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.advisorAvailabilityOverride.findMany({
      where: {
        advisorId: advisor.id,
        isActive: true,
        endsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  return {
    slots: slots.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      timezone: s.timezone,
      slotDuration: s.slotDuration,
      bufferMinutes: s.bufferMinutes,
      meetingLink: s.meetingLink,
      locationLabel: s.locationLabel,
      isRecurring: s.isRecurring,
    })),
    overrides: overrides.map((override) => ({
      id: override.id,
      type: override.type,
      startsAt: override.startsAt.toISOString(),
      endsAt: override.endsAt.toISOString(),
      timezone: override.timezone,
      note: override.note,
    })),
  };
}

/**
 * Get available slots for a specific advisor (for advisee scheduling).
 */
export async function getAdvisorAvailability(advisorId: string) {
  await requireAuth();

  const advisor = await prisma.collegeAdvisor.findUniqueOrThrow({
    where: { id: advisorId },
    include: {
      user: { select: { id: true } },
    },
  });

  const slots = await getAdvisorBookableSlots(advisor.user.id, advisor.id);

  return slots.map<AdvisorBookableSlotView>((slot) => ({
    slotKey: slot.slotKey,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    timezone: slot.timezone,
    duration: slot.duration,
    meetingLink: slot.meetingLink,
    locationLabel: slot.locationLabel,
    warningLabels: slot.warningLabels,
  }));
}

/**
 * Advisor adds a new availability slot.
 */
export async function addAvailabilitySlot(formData: FormData) {
  const { advisor } = await requireAdvisor();

  const dayOfWeek = getNumber(formData, "dayOfWeek", -1);
  const startTime = getString(formData, "startTime");
  const endTime = getString(formData, "endTime");
  const timezone = getString(formData, "timezone", false) || "America/New_York";
  const slotDuration = getNumber(formData, "slotDuration", 30);
  const bufferMinutes = getNumber(formData, "bufferMinutes", 10);
  const meetingLink = getString(formData, "meetingLink", false) || null;
  const locationLabel = getString(formData, "locationLabel", false) || null;

  if (dayOfWeek < 0 || dayOfWeek > 6) throw new Error("Invalid day of week");
  if (!startTime || !endTime) throw new Error("Start and end time required");

  await prisma.advisorAvailabilitySlot.create({
    data: {
      advisorId: advisor.id,
      dayOfWeek,
      startTime,
      endTime,
      timezone,
      slotDuration,
      bufferMinutes,
      meetingLink,
      locationLabel,
    },
  });

  revalidatePath("/college-advisor/advisor-settings");
  revalidatePath("/advisor-dashboard");
  revalidatePath("/college-advisor/schedule");
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
  revalidatePath("/college-advisor/schedule");
}

export async function addAdvisorAvailabilityOverride(formData: FormData) {
  const { advisor } = await requireAdvisor();

  const startsAt = getOptionalDate(getString(formData, "startsAt"));
  const endsAt = getOptionalDate(getString(formData, "endsAt"));
  const type = getString(formData, "type") as "OPEN" | "BLOCKED";
  const timezone = getString(formData, "timezone", false) || "America/New_York";
  const slotDuration = getNumber(formData, "slotDuration", 30);
  const bufferMinutes = getNumber(formData, "bufferMinutes", 10);
  const meetingLink = getString(formData, "meetingLink", false) || null;
  const locationLabel = getString(formData, "locationLabel", false) || null;
  const note = getString(formData, "note", false) || null;

  if (!startsAt || !endsAt || endsAt <= startsAt) {
    throw new Error("Override end must be after start.");
  }

  await prisma.advisorAvailabilityOverride.create({
    data: {
      advisorId: advisor.id,
      type,
      startsAt,
      endsAt,
      timezone,
      slotDuration,
      bufferMinutes,
      meetingLink,
      locationLabel,
      note,
    },
  });

  revalidatePath("/college-advisor/advisor-settings");
  revalidatePath("/advisor-dashboard");
  revalidatePath("/college-advisor/schedule");
}

export async function deactivateAdvisorAvailabilityOverride(overrideId: string) {
  const { advisor } = await requireAdvisor();
  const override = await prisma.advisorAvailabilityOverride.findUniqueOrThrow({
    where: { id: overrideId },
  });

  if (override.advisorId !== advisor.id) throw new Error("Not your override");

  await prisma.advisorAvailabilityOverride.update({
    where: { id: overrideId },
    data: { isActive: false },
  });

  revalidatePath("/college-advisor/advisor-settings");
  revalidatePath("/advisor-dashboard");
  revalidatePath("/college-advisor/schedule");
}

export async function getCollegeAdvisorScheduleData() {
  const session = await requireAuth();
  const userId = session.user.id as string;

  const advisorship = await prisma.collegeAdvisorship.findFirst({
    where: { adviseeId: userId, endDate: null },
    include: {
      advisor: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      meetings: {
        where: {
          status: { in: ["REQUESTED", "CONFIRMED"] },
          scheduledAt: { gte: new Date() },
        },
        orderBy: { scheduledAt: "asc" },
      },
    },
  });

  if (!advisorship) return null;

  const [slots, tier] = await Promise.all([
    getAdvisorBookableSlots(advisorship.advisor.user.id, advisorship.advisor.id),
    getUserAwardTier(userId),
  ]);

  return {
    advisorshipId: advisorship.id,
    tier,
    advisor: {
      id: advisorship.advisor.id,
      name: advisorship.advisor.user.name,
      email: advisorship.advisor.user.email,
      college: advisorship.advisor.college,
      major: advisorship.advisor.major,
      bio: advisorship.advisor.bio,
    },
    availableSlots: slots.map<AdvisorBookableSlotView>((slot) => ({
      slotKey: slot.slotKey,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      timezone: slot.timezone,
      duration: slot.duration,
      meetingLink: slot.meetingLink,
      locationLabel: slot.locationLabel,
      warningLabels: slot.warningLabels,
    })),
    upcomingMeetings: advisorship.meetings.map((meeting) => ({
      id: meeting.id,
      scheduledAt: meeting.scheduledAt.toISOString(),
      durationMinutes: meeting.durationMinutes,
      status: meeting.status,
      meetingLink: meeting.meetingLink,
      topic: meeting.topic,
      schedulingOverrideReason: meeting.schedulingOverrideReason,
    })),
  };
}

export async function getAdvisorScheduleManagerData() {
  const { advisor } = await requireAdvisor();

  const [availability, slotPreview, upcomingMeetings] = await Promise.all([
    getMyAvailabilitySlots(),
    getAdvisorBookableSlots(advisor.userId, advisor.id),
    prisma.collegeAdvisorMeeting.findMany({
      where: {
        advisorship: { advisorId: advisor.id },
        status: { in: ["REQUESTED", "CONFIRMED"] },
        scheduledAt: { gte: new Date() },
      },
      include: {
        advisorship: {
          include: {
            advisee: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
  ]);

  return {
    availability,
    slotPreview: slotPreview.slice(0, 16).map<AdvisorBookableSlotView>((slot) => ({
      slotKey: slot.slotKey,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      timezone: slot.timezone,
      duration: slot.duration,
      meetingLink: slot.meetingLink,
      locationLabel: slot.locationLabel,
      warningLabels: slot.warningLabels,
    })),
    upcomingMeetings: upcomingMeetings.map((meeting) => ({
      id: meeting.id,
      adviseeName: meeting.advisorship.advisee.name,
      adviseeEmail: meeting.advisorship.advisee.email,
      scheduledAt: meeting.scheduledAt.toISOString(),
      durationMinutes: meeting.durationMinutes,
      status: meeting.status,
      topic: meeting.topic,
      meetingLink: meeting.meetingLink,
      schedulingOverrideReason: meeting.schedulingOverrideReason,
    })),
  };
}

export async function bookCollegeAdvisorMeeting(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id as string;

  const advisorshipId = getString(formData, "advisorshipId");
  const slotKey = getString(formData, "slotKey");
  const topic = getString(formData, "topic", false) || null;

  const advisorship = await prisma.collegeAdvisorship.findUniqueOrThrow({
    where: { id: advisorshipId },
    include: {
      advisor: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      advisee: { select: { id: true, name: true, email: true } },
    },
  });

  if (advisorship.adviseeId !== userId) throw new Error("Not your advisorship");

  const tier = await getUserAwardTier(userId);
  const limit = getTierMeetingLimit(tier);
  if (limit === 0) {
    throw new Error("Your award tier does not include college advisor meetings");
  }

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

  const slots = await getAdvisorBookableSlots(advisorship.advisor.user.id, advisorship.advisor.id);
  const slot = slots.find((candidate) => candidate.slotKey === slotKey);
  if (!slot) throw new Error("That slot is no longer available.");

  await Promise.all([
    assertCollegeMeetingConflict(advisorship.advisor.user.id, slot.startsAt, slot.duration),
    assertCollegeMeetingConflict(advisorship.adviseeId, slot.startsAt, slot.duration),
  ]);

  const meeting = await prisma.collegeAdvisorMeeting.create({
    data: {
      advisorshipId,
      scheduledAt: slot.startsAt,
      durationMinutes: slot.duration,
      status: "CONFIRMED",
      meetingLink: slot.meetingLink,
      topic,
    },
  });

  await Promise.all([
    createMentorshipNotification({
      userId: advisorship.advisor.user.id,
      title: "New Meeting Booking",
      body: `${advisorship.advisee.name ?? "A student"} booked ${topic || "a college advising meeting"}.`,
      link: "/advisor-dashboard",
    }),
    createMentorshipNotification({
      userId: advisorship.advisee.id,
      title: "Meeting Confirmed",
      body: `${topic || "Your college advising meeting"} is confirmed for ${formatScheduleDateTime(slot.startsAt)}.`,
      link: "/college-advisor",
    }),
  ]);

  await sendCollegeAdvisorLifecycleEmails({
    event: "CONFIRMED",
    meetingId: meeting.id,
    topic,
    scheduledAt: slot.startsAt,
    durationMinutes: slot.duration,
    meetingLink: slot.meetingLink,
    advisor: advisorship.advisor.user,
    advisee: advisorship.advisee,
  });

  revalidatePath("/college-advisor");
  revalidatePath("/college-advisor/schedule");
  revalidatePath("/advisor-dashboard");
}

export async function rescheduleCollegeAdvisorMeeting(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const meetingId = getString(formData, "meetingId");
  const scheduledAt = getOptionalDate(getString(formData, "scheduledAt"));
  const durationMinutes = getNumber(formData, "durationMinutes", 30);
  const meetingLink = getString(formData, "meetingLink", false) || null;
  const overrideReason = getString(formData, "overrideReason", false) || null;

  if (!scheduledAt) throw new Error("Invalid date.");

  const meeting = await prisma.collegeAdvisorMeeting.findUniqueOrThrow({
    where: { id: meetingId },
    include: {
      advisorship: {
        include: {
          advisor: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          advisee: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const canAct =
    meeting.advisorship.adviseeId === userId ||
    meeting.advisorship.advisor.user.id === userId ||
    isAdmin;
  if (!canAct) throw new Error("Unauthorized");

  await Promise.all([
    assertCollegeMeetingConflict(meeting.advisorship.advisor.user.id, scheduledAt, durationMinutes),
    assertCollegeMeetingConflict(meeting.advisorship.adviseeId, scheduledAt, durationMinutes),
  ]);

  await prisma.collegeAdvisorMeeting.update({
    where: { id: meetingId },
    data: {
      scheduledAt,
      durationMinutes,
      meetingLink,
      status: "CONFIRMED",
      schedulingOverrideReason: overrideReason,
      reminder24SentAt: null,
      reminder2SentAt: null,
    },
  });

  await sendCollegeAdvisorLifecycleEmails({
    event: "RESCHEDULED",
    meetingId,
    topic: meeting.topic,
    scheduledAt,
    durationMinutes,
    meetingLink,
    advisor: meeting.advisorship.advisor.user,
    advisee: meeting.advisorship.advisee,
  });

  revalidatePath("/college-advisor");
  revalidatePath("/college-advisor/meetings");
  revalidatePath("/advisor-dashboard");
}

export async function cancelAdvisorMeetingBooking(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id as string;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const meetingId = getString(formData, "meetingId");

  const meeting = await prisma.collegeAdvisorMeeting.findUniqueOrThrow({
    where: { id: meetingId },
    include: {
      advisorship: {
        include: {
          advisor: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          advisee: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const canAct =
    meeting.advisorship.adviseeId === userId ||
    meeting.advisorship.advisor.user.id === userId ||
    isAdmin;
  if (!canAct) throw new Error("Unauthorized");

  await prisma.collegeAdvisorMeeting.update({
    where: { id: meetingId },
    data: {
      status: "CANCELLED",
      reminder24SentAt: null,
      reminder2SentAt: null,
    },
  });

  await sendCollegeAdvisorLifecycleEmails({
    event: "CANCELLED",
    meetingId,
    topic: meeting.topic,
    scheduledAt: meeting.scheduledAt,
    durationMinutes: meeting.durationMinutes,
    meetingLink: meeting.meetingLink,
    advisor: meeting.advisorship.advisor.user,
    advisee: meeting.advisorship.advisee,
  });

  revalidatePath("/college-advisor");
  revalidatePath("/college-advisor/meetings");
  revalidatePath("/advisor-dashboard");
}

export async function processCollegeAdvisorSchedulingReminders() {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const before24Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const before2Hours = new Date(now.getTime() + 90 * 60 * 60 * 1000);

  const [tomorrowMeetings, soonMeetings] = await Promise.all([
    prisma.collegeAdvisorMeeting.findMany({
      where: {
        status: "CONFIRMED",
        scheduledAt: { gte: before24Hours, lte: in24Hours },
        reminder24SentAt: null,
      },
      include: {
        advisorship: {
          include: {
            advisor: {
              include: {
                user: { select: { name: true, email: true } },
              },
            },
            advisee: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.collegeAdvisorMeeting.findMany({
      where: {
        status: "CONFIRMED",
        scheduledAt: { gte: before2Hours, lte: in2Hours },
        reminder2SentAt: null,
      },
      include: {
        advisorship: {
          include: {
            advisor: {
              include: {
                user: { select: { name: true, email: true } },
              },
            },
            advisee: { select: { name: true, email: true } },
          },
        },
      },
    }),
  ]);

  let sent24 = 0;
  let sent2 = 0;

  for (const meeting of tomorrowMeetings) {
    await sendCollegeAdvisorLifecycleEmails({
      event: "REMINDER_24H",
      meetingId: meeting.id,
      topic: meeting.topic,
      scheduledAt: meeting.scheduledAt,
      durationMinutes: meeting.durationMinutes,
      meetingLink: meeting.meetingLink,
      advisor: meeting.advisorship.advisor.user,
      advisee: meeting.advisorship.advisee,
    });
    await prisma.collegeAdvisorMeeting.update({
      where: { id: meeting.id },
      data: { reminder24SentAt: new Date() },
    });
    sent24 += 1;
  }

  for (const meeting of soonMeetings) {
    await sendCollegeAdvisorLifecycleEmails({
      event: "REMINDER_2H",
      meetingId: meeting.id,
      topic: meeting.topic,
      scheduledAt: meeting.scheduledAt,
      durationMinutes: meeting.durationMinutes,
      meetingLink: meeting.meetingLink,
      advisor: meeting.advisorship.advisor.user,
      advisee: meeting.advisorship.advisee,
    });
    await prisma.collegeAdvisorMeeting.update({
      where: { id: meeting.id },
      data: { reminder2SentAt: new Date() },
    });
    sent2 += 1;
  }

  return { sent24, sent2 };
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
