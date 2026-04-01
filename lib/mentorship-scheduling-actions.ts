"use server";

import { MentorshipSessionType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-supabase";
import { createMentorshipNotification } from "@/lib/mentorship-program-actions";
import { prisma } from "@/lib/prisma";
import { toAbsoluteAppUrl } from "@/lib/public-app-url";
import {
  getSchedulingEventUid,
  type CalendarInviteInput,
} from "@/lib/scheduling/calendar";
import { sendSchedulingLifecycleEmail } from "@/lib/scheduling/email";
import { getUserBusyIntervals } from "@/lib/scheduling/busy-intervals";
import {
  formatScheduleDateTime,
  generateSchedulingSlots,
  rangesOverlap,
  type SchedulingOverrideLike,
  type SchedulingRuleLike,
} from "@/lib/scheduling/shared";

const DEFAULT_SLOT_WINDOW_DAYS = 21;

type SessionWithUser = Awaited<ReturnType<typeof getSession>> & {
  user: {
    id: string;
    roles?: string[];
  };
};

type BookableSlotView = {
  slotKey: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  duration: number;
  meetingLink: string | null;
  locationLabel: string | null;
  warningLabels: string[];
};

type MentorshipRequestRecord = {
  id: string;
  mentorshipId: string;
  requestedById: string;
  sessionType: MentorshipSessionType;
  title: string;
  notes: string | null;
  preferredSlots: string[];
  status: string;
  confirmedAt: Date | null;
  scheduledAt: Date | null;
  meetingLink: string | null;
  mentorship: {
    mentorId: string;
    menteeId: string;
    mentor: { id: string; name: string | null; email: string | null };
    mentee: { id: string; name: string | null; email: string | null };
  };
};

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

function formatDurationLabel(duration: number) {
  return `${duration} min`;
}

function formatSessionTypeLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session as SessionWithUser;
}

async function requireMentorOrAdmin() {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isMentor =
    roles.includes("MENTOR") || roles.includes("CHAPTER_PRESIDENT") || isAdmin;

  if (!isMentor) {
    throw new Error("Unauthorized");
  }

  return { session, roles, isAdmin };
}

async function getMentorshipScheduleRequest(requestId: string) {
  return prisma.mentorshipScheduleRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      mentorship: {
        include: {
          mentor: { select: { id: true, name: true, email: true } },
          mentee: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

async function getMentorAvailabilityData(mentorId: string) {
  const [rules, overrides] = await Promise.all([
    prisma.mentorAvailabilityRule.findMany({
      where: { mentorId, isActive: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.mentorAvailabilityOverride.findMany({
      where: {
        mentorId,
        isActive: true,
        endsAt: { gte: new Date() },
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  return {
    rules: rules.map<SchedulingRuleLike>((rule) => ({
      id: rule.id,
      ownerId: rule.mentorId,
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
      ownerId: override.mentorId,
      ruleId: override.ruleId,
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

async function getMentorBookableSlots(mentorId: string, rangeStart = new Date()) {
  const [availability, busyIntervals] = await Promise.all([
    getMentorAvailabilityData(mentorId),
    getUserBusyIntervals(mentorId, rangeStart),
  ]);

  return generateSchedulingSlots({
    ownerId: mentorId,
    rules: availability.rules,
    overrides: availability.overrides,
    busyIntervals,
    rangeStart,
    days: DEFAULT_SLOT_WINDOW_DAYS,
  });
}

async function assertUserCanTakeSlot(userId: string, startsAt: Date, duration: number) {
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

async function sendMentorshipLifecycleEmails(params: {
  event:
    | "REQUESTED"
    | "CONFIRMED"
    | "RESCHEDULED"
    | "CANCELLED"
    | "REMINDER_24H"
    | "REMINDER_2H";
  requestId: string;
  title: string;
  sessionType: string;
  scheduledAt?: Date | null;
  durationMinutes?: number;
  meetingLink?: string | null;
  mentor: { name: string | null; email: string | null };
  mentee: { name: string | null; email: string | null };
  actionUrlMentor?: string;
  actionUrlMentee?: string;
  note?: string | null;
}) {
  const {
    event,
    requestId,
    title,
    sessionType,
    scheduledAt = null,
    durationMinutes = 30,
    meetingLink = null,
    mentor,
    mentee,
    actionUrlMentor = toAbsoluteAppUrl("/mentorship-program/schedule"),
    actionUrlMentee = toAbsoluteAppUrl("/my-program/schedule"),
    note = null,
  } = params;

  const when = scheduledAt ? formatScheduleDateTime(scheduledAt) : "To be scheduled";
  const sessionLabel = formatSessionTypeLabel(sessionType);
  const uid = getSchedulingEventUid("mentorship", requestId);
  const calendarBase: CalendarInviteInput | null =
    scheduledAt && event !== "REQUESTED"
      ? {
          uid,
          title: `Mentorship ${sessionLabel}: ${title}`,
          startsAt: scheduledAt,
          durationMinutes,
          descriptionLines: [
            `Mentorship session: ${title}`,
            `Type: ${sessionLabel}`,
            `Mentor: ${mentor.name ?? "Mentor"}`,
            `Mentee: ${mentee.name ?? "Mentee"}`,
            note || "",
            meetingLink ? `Meeting Link: ${meetingLink}` : "",
          ].filter(Boolean),
          location: meetingLink || "See YPP Portal for details",
        }
      : null;

  const mentorTemplates = {
    REQUESTED: {
      subject: `New mentorship meeting request: ${title}`,
      heading: "A mentee asked for a meeting",
      message: `${mentee.name ?? "Your mentee"} requested a ${sessionLabel.toLowerCase()} meeting.`,
      details: [
        { label: "Meeting", value: title },
        { label: "Type", value: sessionLabel },
      ],
      calendar: null,
    },
    CONFIRMED: {
      subject: `Mentorship meeting confirmed: ${title}`,
      heading: "Your mentorship meeting is booked",
      message: `${mentee.name ?? "Your mentee"} booked a confirmed time.`,
      details: [
        { label: "Meeting", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: calendarBase
        ? { ...calendarBase, method: "REQUEST", filename: "mentorship-confirmed.ics" as const }
        : null,
    },
    RESCHEDULED: {
      subject: `Mentorship meeting moved: ${title}`,
      heading: "Your mentorship meeting was rescheduled",
      message: `${mentee.name ?? "Your mentee"} now has a new confirmed time.`,
      details: [
        { label: "Meeting", value: title },
        { label: "New Time", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: calendarBase
        ? { ...calendarBase, method: "REQUEST", filename: "mentorship-rescheduled.ics" as const }
        : null,
    },
    CANCELLED: {
      subject: `Mentorship meeting cancelled: ${title}`,
      heading: "A mentorship meeting was cancelled",
      message: `${title} is no longer on the calendar.`,
      details: scheduledAt
        ? [
            { label: "Meeting", value: title },
            { label: "Cancelled Time", value: when },
          ]
        : [{ label: "Meeting", value: title }],
      calendar: calendarBase
        ? { ...calendarBase, method: "CANCEL", status: "CANCELLED", filename: "mentorship-cancelled.ics" as const }
        : null,
    },
    REMINDER_24H: {
      subject: `Reminder: mentorship meeting within the next 24 hours`,
      heading: "Your mentorship meeting is coming up soon",
      message: `${title} is coming up soon.`,
      details: [
        { label: "Meeting", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: null,
    },
    REMINDER_2H: {
      subject: `Reminder: mentorship meeting coming up`,
      heading: "Your mentorship meeting starts soon",
      message: `${title} starts in about two hours.`,
      details: [
        { label: "Meeting", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: null,
    },
  } as const;

  const menteeTemplates = {
    REQUESTED: {
      subject: `Your mentorship meeting request was sent`,
      heading: "Your request is on its way",
      message: `We sent ${mentor.name ?? "your mentor"} your ${sessionLabel.toLowerCase()} request.`,
      details: [
        { label: "Meeting", value: title },
        { label: "Type", value: sessionLabel },
      ],
      calendar: null,
    },
    CONFIRMED: {
      subject: `Mentorship meeting confirmed: ${title}`,
      heading: "Your mentorship meeting is booked",
      message: `${mentor.name ?? "Your mentor"} confirmed your time.`,
      details: [
        { label: "Meeting", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: calendarBase
        ? { ...calendarBase, method: "REQUEST", filename: "mentorship-confirmed.ics" as const }
        : null,
    },
    RESCHEDULED: {
      subject: `Mentorship meeting moved: ${title}`,
      heading: "Your mentorship meeting has a new time",
      message: `${mentor.name ?? "Your mentor"} updated the schedule.`,
      details: [
        { label: "Meeting", value: title },
        { label: "New Time", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: calendarBase
        ? { ...calendarBase, method: "REQUEST", filename: "mentorship-rescheduled.ics" as const }
        : null,
    },
    CANCELLED: {
      subject: `Mentorship meeting cancelled: ${title}`,
      heading: "Your mentorship meeting was cancelled",
      message: `You can choose a new time in the portal whenever you are ready.`,
      details: scheduledAt
        ? [
            { label: "Meeting", value: title },
            { label: "Cancelled Time", value: when },
          ]
        : [{ label: "Meeting", value: title }],
      calendar: calendarBase
        ? { ...calendarBase, method: "CANCEL", status: "CANCELLED", filename: "mentorship-cancelled.ics" as const }
        : null,
    },
    REMINDER_24H: {
      subject: `Reminder: mentorship meeting within the next 24 hours`,
      heading: "Your mentorship meeting is coming up soon",
      message: `${title} is almost here.`,
      details: [
        { label: "Meeting", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: null,
    },
    REMINDER_2H: {
      subject: `Reminder: mentorship meeting coming up`,
      heading: "Your mentorship meeting starts soon",
      message: `${title} starts in about two hours.`,
      details: [
        { label: "Meeting", value: title },
        { label: "When", value: when },
        { label: "Length", value: formatDurationLabel(durationMinutes) },
      ],
      calendar: null,
    },
  } as const;

  const mentorTemplate = mentorTemplates[event];
  const menteeTemplate = menteeTemplates[event];

  await Promise.all(
    [
      mentor.email
        ? sendSchedulingLifecycleEmail({
            to: mentor.email,
            recipientName: mentor.name,
            eyebrow: "Mentorship Scheduling",
            subject: mentorTemplate.subject,
            heading: mentorTemplate.heading,
            message: mentorTemplate.message,
            details: mentorTemplate.details,
            actionUrl: actionUrlMentor,
            actionLabel: "Open Mentor Scheduler",
            calendar: mentorTemplate.calendar,
          })
        : null,
      mentee.email
        ? sendSchedulingLifecycleEmail({
            to: mentee.email,
            recipientName: mentee.name,
            eyebrow: "Mentorship Scheduling",
            subject: menteeTemplate.subject,
            heading: menteeTemplate.heading,
            message: menteeTemplate.message,
            details: menteeTemplate.details,
            actionUrl: actionUrlMentee,
            actionLabel: "Open My Schedule",
            calendar: menteeTemplate.calendar,
          })
        : null,
    ].filter(Boolean)
  );
}

async function notifyMentorshipBooking(params: {
  event: "CONFIRMED" | "RESCHEDULED" | "CANCELLED";
  request: MentorshipRequestRecord;
  scheduledAt?: Date | null;
  durationMinutes?: number;
  meetingLink?: string | null;
  note?: string | null;
}) {
  const { request, event } = params;
  const title = request.title;
  const scheduledAt = params.scheduledAt ?? request.scheduledAt;
  const durationMinutes = params.durationMinutes ?? 30;
  const meetingLink = params.meetingLink ?? request.meetingLink;
  const note = params.note ?? request.notes;

  if (event === "CONFIRMED") {
    await createMentorshipNotification({
      userId: request.mentorship.menteeId,
      title: "Meeting Confirmed",
      body: `Your meeting "${title}" has been confirmed for ${scheduledAt ? formatScheduleDateTime(scheduledAt) : "a scheduled time"}.`,
      link: "/my-program/schedule",
    });
  }

  if (event === "RESCHEDULED") {
    await Promise.all([
      createMentorshipNotification({
        userId: request.mentorship.menteeId,
        title: "Meeting Rescheduled",
        body: `"${title}" now starts at ${scheduledAt ? formatScheduleDateTime(scheduledAt) : "a new time"}.`,
        link: "/my-program/schedule",
      }),
      createMentorshipNotification({
        userId: request.mentorship.mentorId,
        title: "Meeting Rescheduled",
        body: `"${title}" now starts at ${scheduledAt ? formatScheduleDateTime(scheduledAt) : "a new time"}.`,
        link: "/mentorship-program/schedule",
      }),
    ]);
  }

  if (event === "CANCELLED") {
    await Promise.all([
      createMentorshipNotification({
        userId: request.mentorship.menteeId,
        title: "Meeting Cancelled",
        body: `"${title}" was cancelled. You can book a new time anytime.`,
        link: "/my-program/schedule",
      }),
      createMentorshipNotification({
        userId: request.mentorship.mentorId,
        title: "Meeting Cancelled",
        body: `"${title}" was cancelled.`,
        link: "/mentorship-program/schedule",
      }),
    ]);
  }

  await sendMentorshipLifecycleEmails({
    event,
    requestId: request.id,
    title,
    sessionType: request.sessionType,
    scheduledAt,
    durationMinutes,
    meetingLink,
    mentor: request.mentorship.mentor,
    mentee: request.mentorship.mentee,
    note,
  });
}

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
    scheduleRequestId: string | null;
    type: string;
    title: string;
    scheduledAt: string;
    meetingLink: string | null;
    agenda: string | null;
    durationMinutes: number | null;
    schedulingOverrideReason: string | null;
  }>;
  availableSlots: BookableSlotView[];
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

export interface MentorScheduleManagerData {
  mentorId: string;
  availabilityRules: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    timezone: string;
    slotDuration: number;
    bufferMinutes: number;
    meetingLink: string | null;
    locationLabel: string | null;
  }>;
  availabilityOverrides: Array<{
    id: string;
    type: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    note: string | null;
  }>;
  pendingRequests: MentorScheduleQueueItem[];
  upcomingSessions: Array<{
    id: string;
    scheduleRequestId: string | null;
    menteeName: string;
    menteeEmail: string;
    title: string;
    sessionType: string;
    scheduledAt: string;
    durationMinutes: number | null;
    meetingLink: string | null;
  }>;
  slotPreview: BookableSlotView[];
}

export async function getSchedulePageData(): Promise<SchedulePageData | null> {
  const session = await requireSession();
  const userId = session.user.id;

  const mentorship = await prisma.mentorship.findFirst({
    where: { menteeId: userId, status: "ACTIVE" },
    include: {
      mentor: { select: { id: true, name: true, email: true } },
      scheduleRequests: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      sessions: {
        where: {
          scheduledAt: { gte: new Date() },
          completedAt: null,
          cancelledAt: null,
        },
        orderBy: { scheduledAt: "asc" },
        take: 8,
      },
    },
  });

  const interviewGate = await prisma.instructorInterviewGate.findFirst({
    where: { instructorId: userId, status: { not: "COMPLETED" } },
    include: {
      slots: {
        where: { status: { in: ["POSTED", "CONFIRMED"] } },
        orderBy: { scheduledAt: "asc" },
        take: 5,
      },
    },
  });

  const availableSlots = mentorship
    ? await getMentorBookableSlots(mentorship.mentor.id)
    : [];

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
    scheduleRequests: (mentorship?.scheduleRequests ?? []).map((request) => ({
      id: request.id,
      sessionType: request.sessionType,
      title: request.title,
      notes: request.notes,
      status: request.status,
      preferredSlots: request.preferredSlots as string[],
      scheduledAt: request.scheduledAt?.toISOString() ?? null,
      meetingLink: request.meetingLink,
      createdAt: request.createdAt.toISOString(),
    })),
    upcomingSessions: (mentorship?.sessions ?? []).map((sessionRecord) => ({
      id: sessionRecord.id,
      scheduleRequestId: sessionRecord.scheduleRequestId,
      type: sessionRecord.type,
      title: sessionRecord.title,
      scheduledAt: sessionRecord.scheduledAt.toISOString(),
      meetingLink: sessionRecord.meetingLink,
      agenda: sessionRecord.agenda,
      durationMinutes: sessionRecord.durationMinutes,
      schedulingOverrideReason: sessionRecord.schedulingOverrideReason,
    })),
    availableSlots: availableSlots.map((slot) => ({
      slotKey: slot.slotKey,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      timezone: slot.timezone,
      duration: slot.duration,
      meetingLink: slot.meetingLink,
      locationLabel: slot.locationLabel,
      warningLabels: slot.warningLabels,
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

export async function getMentorScheduleQueue(): Promise<MentorScheduleQueueItem[]> {
  const data = await getMentorScheduleManagerData();
  return data.pendingRequests;
}

export async function getMentorScheduleManagerData(): Promise<MentorScheduleManagerData> {
  const { session, isAdmin } = await requireMentorOrAdmin();
  const userId = session.user.id;

  const mentorId = userId;
  const [availability, slotPreview, pendingRequests, upcomingSessions] = await Promise.all([
    getMentorAvailabilityData(mentorId),
    getMentorBookableSlots(mentorId),
    prisma.mentorshipScheduleRequest.findMany({
      where: {
        mentorship: isAdmin
          ? { status: "ACTIVE" }
          : {
              mentorId: userId,
              status: "ACTIVE",
            },
        status: "PENDING",
      },
      include: {
        requestedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mentorshipSession.findMany({
      where: isAdmin
        ? {
            scheduledAt: { gte: new Date() },
            cancelledAt: null,
            mentorship: { status: "ACTIVE" },
          }
        : {
            scheduledAt: { gte: new Date() },
            cancelledAt: null,
            mentorship: { mentorId: userId, status: "ACTIVE" },
          },
      include: {
        mentorship: {
          include: {
            mentee: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
  ]);

  return {
    mentorId,
    availabilityRules: availability.rules.map((rule) => ({
      id: rule.id,
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      timezone: rule.timezone,
      slotDuration: rule.slotDuration,
      bufferMinutes: rule.bufferMinutes,
      meetingLink: rule.meetingLink,
      locationLabel: rule.locationLabel,
    })),
    availabilityOverrides: availability.overrides.map((override) => ({
      id: override.id,
      type: override.type,
      startsAt: override.startsAt.toISOString(),
      endsAt: override.endsAt.toISOString(),
      timezone: override.timezone,
      note: override.note,
    })),
    pendingRequests: pendingRequests.map((request) => ({
      id: request.id,
      menteeName: request.requestedBy.name ?? "Unknown",
      menteeEmail: request.requestedBy.email ?? "",
      mentorshipId: request.mentorshipId,
      sessionType: request.sessionType,
      title: request.title,
      notes: request.notes,
      preferredSlots: request.preferredSlots as string[],
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    })),
    upcomingSessions: upcomingSessions.map((sessionRecord) => ({
      id: sessionRecord.id,
      scheduleRequestId: sessionRecord.scheduleRequestId,
      menteeName: sessionRecord.mentorship?.mentee.name ?? "Unknown",
      menteeEmail: sessionRecord.mentorship?.mentee.email ?? "",
      title: sessionRecord.title,
      sessionType: sessionRecord.type,
      scheduledAt: sessionRecord.scheduledAt.toISOString(),
      durationMinutes: sessionRecord.durationMinutes,
      meetingLink: sessionRecord.meetingLink,
    })),
    slotPreview: slotPreview.slice(0, 16).map((slot) => ({
      slotKey: slot.slotKey,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      timezone: slot.timezone,
      duration: slot.duration,
      meetingLink: slot.meetingLink,
      locationLabel: slot.locationLabel,
      warningLabels: slot.warningLabels,
    })),
  };
}

export async function requestMentorMeeting(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;

  const mentorshipId = getString(formData, "mentorshipId");
  const title = getString(formData, "title");
  const notes = getString(formData, "notes", false);
  const sessionType = (getString(formData, "sessionType", false) ||
    "CHECK_IN") as MentorshipSessionType;
  const preferredSlots = formData.getAll("preferredSlots").map(String).filter(Boolean);

  const mentorship = await prisma.mentorship.findUniqueOrThrow({
    where: { id: mentorshipId },
    include: {
      mentor: { select: { id: true, name: true, email: true } },
      mentee: { select: { id: true, name: true, email: true } },
    },
  });

  if (mentorship.menteeId !== userId) throw new Error("Unauthorized");

  const request = await prisma.mentorshipScheduleRequest.create({
    data: {
      mentorshipId,
      requestedById: userId,
      sessionType,
      title,
      notes: notes || null,
      preferredSlots,
      status: "PENDING",
    },
  });

  await createMentorshipNotification({
    userId: mentorship.mentor.id,
    title: "New Meeting Request",
    body: `${mentorship.mentee.name ?? "A mentee"} requested "${title}".`,
    link: "/mentorship-program/schedule",
  });

  await sendMentorshipLifecycleEmails({
    event: "REQUESTED",
    requestId: request.id,
    title,
    sessionType,
    mentor: mentorship.mentor,
    mentee: mentorship.mentee,
    note: notes || null,
  });

  revalidatePath("/my-program/schedule");
  revalidatePath("/mentorship-program/schedule");

  return { success: true, requestId: request.id };
}

export async function addMentorAvailabilityRule(formData: FormData) {
  const { session } = await requireMentorOrAdmin();

  const dayOfWeek = getNumber(formData, "dayOfWeek", -1);
  const startTime = getString(formData, "startTime");
  const endTime = getString(formData, "endTime");
  const timezone = getString(formData, "timezone", false) || "America/New_York";
  const slotDuration = getNumber(formData, "slotDuration", 30);
  const bufferMinutes = getNumber(formData, "bufferMinutes", 10);
  const meetingLink = getString(formData, "meetingLink", false) || null;
  const locationLabel = getString(formData, "locationLabel", false) || null;

  if (dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error("Invalid day of week.");
  }

  await prisma.mentorAvailabilityRule.create({
    data: {
      mentorId: session.user.id,
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

  revalidatePath("/mentorship-program/schedule");
  revalidatePath("/my-program/schedule");
}

export async function removeMentorAvailabilityRule(ruleId: string) {
  const { session, isAdmin } = await requireMentorOrAdmin();
  const rule = await prisma.mentorAvailabilityRule.findUniqueOrThrow({
    where: { id: ruleId },
  });

  if (!isAdmin && rule.mentorId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await prisma.mentorAvailabilityRule.update({
    where: { id: ruleId },
    data: { isActive: false },
  });

  revalidatePath("/mentorship-program/schedule");
  revalidatePath("/my-program/schedule");
}

export async function addMentorAvailabilityOverride(formData: FormData) {
  const { session } = await requireMentorOrAdmin();

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

  await prisma.mentorAvailabilityOverride.create({
    data: {
      mentorId: session.user.id,
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

  revalidatePath("/mentorship-program/schedule");
  revalidatePath("/my-program/schedule");
}

export async function deactivateMentorAvailabilityOverride(overrideId: string) {
  const { session, isAdmin } = await requireMentorOrAdmin();
  const override = await prisma.mentorAvailabilityOverride.findUniqueOrThrow({
    where: { id: overrideId },
  });

  if (!isAdmin && override.mentorId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await prisma.mentorAvailabilityOverride.update({
    where: { id: overrideId },
    data: { isActive: false },
  });

  revalidatePath("/mentorship-program/schedule");
  revalidatePath("/my-program/schedule");
}

export async function bookMentorAvailabilitySlot(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;

  const mentorshipId = getString(formData, "mentorshipId");
  const slotKey = getString(formData, "slotKey");
  const title = getString(formData, "title");
  const notes = getString(formData, "notes", false) || null;
  const sessionType = (getString(formData, "sessionType", false) ||
    "CHECK_IN") as MentorshipSessionType;

  const mentorship = await prisma.mentorship.findUniqueOrThrow({
    where: { id: mentorshipId },
    include: {
      mentor: { select: { id: true, name: true, email: true } },
      mentee: { select: { id: true, name: true, email: true } },
    },
  });

  if (mentorship.menteeId !== userId) throw new Error("Unauthorized");

  const slots = await getMentorBookableSlots(mentorship.mentorId);
  const slot = slots.find((candidate) => candidate.slotKey === slotKey);
  if (!slot) throw new Error("That slot is no longer available.");

  await Promise.all([
    assertUserCanTakeSlot(mentorship.mentorId, slot.startsAt, slot.duration),
    assertUserCanTakeSlot(mentorship.menteeId, slot.startsAt, slot.duration),
  ]);

  const request = await prisma.$transaction(async (tx) => {
    const scheduleRequest = await tx.mentorshipScheduleRequest.create({
      data: {
        mentorshipId,
        requestedById: userId,
        sessionType,
        title,
        notes,
        preferredSlots: [slot.startsAt.toISOString()],
        status: "CONFIRMED",
        confirmedAt: new Date(),
        scheduledAt: slot.startsAt,
        meetingLink: slot.meetingLink,
      },
    });

    await tx.mentorshipSession.create({
      data: {
        mentorshipId,
        scheduleRequestId: scheduleRequest.id,
        menteeId: mentorship.menteeId,
        type: sessionType,
        title,
        scheduledAt: slot.startsAt,
        durationMinutes: slot.duration,
        agenda: notes,
        meetingLink: slot.meetingLink,
        participantIds: [mentorship.mentorId, mentorship.menteeId],
        createdById: userId,
        ledById: mentorship.mentorId,
      },
    });

    return scheduleRequest;
  });

  await notifyMentorshipBooking({
    event: "CONFIRMED",
    request: {
      ...request,
      mentorship: {
        mentorId: mentorship.mentorId,
        menteeId: mentorship.menteeId,
        mentor: mentorship.mentor,
        mentee: mentorship.mentee,
      },
    } as MentorshipRequestRecord,
    scheduledAt: slot.startsAt,
    durationMinutes: slot.duration,
    meetingLink: slot.meetingLink,
    note: notes,
  });

  revalidatePath("/my-program/schedule");
  revalidatePath("/mentorship-program/schedule");
}

export async function confirmScheduleRequest(formData: FormData) {
  const { session, isAdmin } = await requireMentorOrAdmin();
  const userId = session.user.id;
  const requestId = getString(formData, "requestId");
  const scheduledAt = getOptionalDate(getString(formData, "scheduledAt"));
  const meetingLink = getString(formData, "meetingLink", false) || null;

  if (!scheduledAt) throw new Error("Invalid date.");

  const request = await getMentorshipScheduleRequest(requestId);
  const isMentor = request.mentorship.mentorId === userId;
  if (!isMentor && !isAdmin) throw new Error("Unauthorized");

  await Promise.all([
    assertUserCanTakeSlot(request.mentorship.mentorId, scheduledAt, 30),
    assertUserCanTakeSlot(request.mentorship.menteeId, scheduledAt, 30),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.mentorshipScheduleRequest.update({
      where: { id: requestId },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        scheduledAt,
        meetingLink,
      },
    });

    const existingSession = await tx.mentorshipSession.findFirst({
      where: { scheduleRequestId: requestId },
      select: { id: true },
    });

    if (existingSession) {
      await tx.mentorshipSession.update({
        where: { id: existingSession.id },
        data: {
          scheduledAt,
          durationMinutes: 30,
          agenda: request.notes,
          meetingLink,
          cancelledAt: null,
          cancellationReason: null,
          reminder24SentAt: null,
          reminder2SentAt: null,
        },
      });
    } else {
      await tx.mentorshipSession.create({
        data: {
          mentorshipId: request.mentorshipId,
          scheduleRequestId: requestId,
          menteeId: request.mentorship.menteeId,
          type: request.sessionType,
          title: request.title,
          scheduledAt,
          durationMinutes: 30,
          agenda: request.notes,
          meetingLink,
          participantIds: [request.mentorship.mentorId, request.mentorship.menteeId],
          createdById: userId,
          ledById: request.mentorship.mentorId,
        },
      });
    }
  });

  await notifyMentorshipBooking({
    event: "CONFIRMED",
    request,
    scheduledAt,
    durationMinutes: 30,
    meetingLink,
  });

  revalidatePath("/my-program/schedule");
  revalidatePath("/mentorship-program/schedule");
}

export async function rescheduleMentorMeeting(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const requestId = getString(formData, "requestId");
  const scheduledAt = getOptionalDate(getString(formData, "scheduledAt"));
  const durationMinutes = getNumber(formData, "durationMinutes", 30);
  const meetingLink = getString(formData, "meetingLink", false) || null;
  const overrideReason = getString(formData, "overrideReason", false) || null;

  if (!scheduledAt) throw new Error("Invalid date.");

  const request = await getMentorshipScheduleRequest(requestId);
  const canAct =
    userId === request.mentorship.mentorId ||
    userId === request.mentorship.menteeId ||
    isAdmin;
  if (!canAct) throw new Error("Unauthorized");

  await Promise.all([
    assertUserCanTakeSlot(request.mentorship.mentorId, scheduledAt, durationMinutes),
    assertUserCanTakeSlot(request.mentorship.menteeId, scheduledAt, durationMinutes),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.mentorshipScheduleRequest.update({
      where: { id: requestId },
      data: {
        status: "CONFIRMED",
        confirmedAt: request.confirmedAt ?? new Date(),
        scheduledAt,
        meetingLink,
      },
    });

    const sessionRecord = await tx.mentorshipSession.findFirstOrThrow({
      where: { scheduleRequestId: requestId },
      select: { id: true },
    });

    await tx.mentorshipSession.update({
      where: { id: sessionRecord.id },
      data: {
        scheduledAt,
        durationMinutes,
        meetingLink,
        schedulingOverrideReason: overrideReason,
        reminder24SentAt: null,
        reminder2SentAt: null,
      },
    });
  });

  await notifyMentorshipBooking({
    event: "RESCHEDULED",
    request,
    scheduledAt,
    durationMinutes,
    meetingLink,
    note: overrideReason,
  });

  revalidatePath("/my-program/schedule");
  revalidatePath("/mentorship-program/schedule");
}

export async function declineScheduleRequest(formData: FormData) {
  const { session, isAdmin } = await requireMentorOrAdmin();
  const userId = session.user.id;
  const requestId = getString(formData, "requestId");

  const request = await getMentorshipScheduleRequest(requestId);
  const isMentor = request.mentorship.mentorId === userId;
  if (!isMentor && !isAdmin) throw new Error("Unauthorized");

  await prisma.mentorshipScheduleRequest.update({
    where: { id: requestId },
    data: { status: "DECLINED" },
  });

  await createMentorshipNotification({
    userId: request.mentorship.menteeId,
    title: "Meeting Request Declined",
    body: `Your meeting request "${request.title}" was declined. Please choose a different time.`,
    link: "/my-program/schedule",
  });

  revalidatePath("/my-program/schedule");
  revalidatePath("/mentorship-program/schedule");
}

export async function cancelScheduleRequest(formData: FormData) {
  const session = await requireSession();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  const requestId = getString(formData, "requestId");
  const reason = getString(formData, "reason", false) || "Meeting cancelled.";

  const request = await getMentorshipScheduleRequest(requestId);
  const canAct =
    request.requestedById === userId ||
    request.mentorship.mentorId === userId ||
    request.mentorship.menteeId === userId ||
    isAdmin;
  if (!canAct) throw new Error("Unauthorized");

  await prisma.$transaction(async (tx) => {
    await tx.mentorshipScheduleRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
    });

    const sessionRecord = await tx.mentorshipSession.findFirst({
      where: { scheduleRequestId: requestId },
      select: { id: true },
    });

    if (sessionRecord) {
      await tx.mentorshipSession.update({
        where: { id: sessionRecord.id },
        data: {
          cancelledAt: new Date(),
          cancellationReason: reason,
          reminder24SentAt: null,
          reminder2SentAt: null,
        },
      });
    }
  });

  await notifyMentorshipBooking({
    event: "CANCELLED",
    request,
    note: reason,
  });

  revalidatePath("/my-program/schedule");
  revalidatePath("/mentorship-program/schedule");
}

export async function processMentorshipSchedulingReminders() {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowSessions = await prisma.mentorshipSession.findMany({
    where: {
      cancelledAt: null,
      completedAt: null,
      scheduledAt: { gt: now, lte: in24Hours },
      reminder24SentAt: null,
      scheduleRequestId: { not: null },
    },
    include: {
      scheduleRequest: {
        include: {
          mentorship: {
            include: {
              mentor: { select: { name: true, email: true } },
              mentee: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });

  let sent24 = 0;

  for (const sessionRecord of tomorrowSessions) {
    if (!sessionRecord.scheduleRequest) continue;
    await sendMentorshipLifecycleEmails({
      event: "REMINDER_24H",
      requestId: sessionRecord.scheduleRequest.id,
      title: sessionRecord.title,
      sessionType: sessionRecord.type,
      scheduledAt: sessionRecord.scheduledAt,
      durationMinutes: sessionRecord.durationMinutes ?? 30,
      meetingLink: sessionRecord.meetingLink,
      mentor: sessionRecord.scheduleRequest.mentorship.mentor,
      mentee: sessionRecord.scheduleRequest.mentorship.mentee,
      note: sessionRecord.agenda,
    });
    await prisma.mentorshipSession.update({
      where: { id: sessionRecord.id },
      data: { reminder24SentAt: new Date() },
    });
    sent24 += 1;
  }

  return { sent24 };
}
