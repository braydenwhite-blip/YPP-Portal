"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import {
  ConversationContextType,
  InterviewAvailabilityOverrideType,
  InterviewAvailabilityScope,
  InterviewDomain,
  InterviewSchedulingRequestStatus,
  InterviewSlotSource,
  Prisma,
} from "@prisma/client";
import { createSystemNotification } from "@/lib/notification-actions";
import {
  ACTIVE_INTERVIEW_REQUEST_STATUSES,
  generateInterviewSlots,
  getInterviewRequestAgeBase,
  isInterviewRequestAtRisk,
  rangesOverlap,
  type AvailabilityOverrideLike,
  type AvailabilityRuleLike,
  type BusyInterval,
  type WarningInterval,
} from "@/lib/interview-scheduling-shared";
import { getEnabledFeatureKeysForUser } from "@/lib/feature-gates";
import { toAbsoluteAppUrl } from "@/lib/public-app-url";
import {
  getSchedulingEventUid,
  type CalendarInviteInput,
} from "@/lib/scheduling/calendar";
import { sendSchedulingLifecycleEmail } from "@/lib/scheduling/email";

const DEFAULT_WINDOW_DAYS = 21;
const FINAL_APPLICATION_STATUSES = ["ACCEPTED", "REJECTED", "WITHDRAWN"] as const;
const ACTIVE_SLOT_STATUSES = ["POSTED", "CONFIRMED"] as const;

type SessionUser = Awaited<ReturnType<typeof getSession>> & {
  user: {
    id: string;
    roles?: string[];
    primaryRole?: string | null;
  };
};

type ViewerContext = {
  userId: string;
  userName: string;
  roles: string[];
  primaryRole: string | null;
  chapterId: string | null;
  isAdmin: boolean;
  isChapterLead: boolean;
  isDesignatedInterviewer: boolean;
  isReviewer: boolean;
  isInstructor: boolean;
};

type InterviewerOption = {
  id: string;
  name: string;
  primaryRole: string;
  chapterId: string | null;
  chapterName: string | null;
};

type SlotContext = {
  meetingLink: string | null;
  locationLabel: string | null;
  duration: number;
  sourceTimezone: string;
};

type HiringWorkflowRecord = Prisma.ApplicationGetPayload<{
  include: {
    applicant: {
      select: { id: true; name: true; email: true };
    };
    position: {
      select: {
        title: true;
        chapterId: true;
        chapter: { select: { id: true; name: true } };
      };
    };
    interviewSlots: true;
  };
}>;

function buildCalendarInviteInput(input: CalendarInviteInput) {
  return input;
}

type ReadinessWorkflowRecord = Prisma.InstructorInterviewGateGetPayload<{
  include: {
    instructor: {
      select: {
        id: true;
        name: true;
        email: true;
        chapterId: true;
        chapter: { select: { id: true; name: true } };
      };
    };
    slots: true;
  };
}>;

export interface InterviewCalendarSlotView {
  slotKey: string;
  interviewerId: string;
  interviewerName: string;
  interviewerRole: string;
  startsAt: string;
  endsAt: string;
  duration: number;
  timezone: string;
  meetingLink: string | null;
  locationLabel: string | null;
  warningLabels: string[];
}

export interface InterviewWorkflowView {
  id: string;
  domain: InterviewDomain;
  workflowId: string;
  chapterId: string | null;
  chapterName: string;
  title: string;
  subtitle: string;
  intervieweeId: string;
  intervieweeName: string;
  intervieweeEmail: string;
  interviewerId: string | null;
  interviewerName: string | null;
  interviewerRole: string | null;
  ownerName: string;
  status:
    | "UNSCHEDULED"
    | "AWAITING_RESPONSE"
    | "BOOKED"
    | "RESCHEDULE_REQUESTED"
    | "STALE"
    | "COMPLETED"
    | "CANCELLED";
  statusLabel: string;
  ageHours: number;
  isAtRisk: boolean;
  scheduledAt: string | null;
  duration: number | null;
  meetingLink: string | null;
  sourceTimezone: string | null;
  note: string | null;
  activeRequestId: string | null;
  conversationId: string | null;
  warnings: string[];
  openSlots: InterviewCalendarSlotView[];
  detailHref: string;
}

export interface InterviewAvailabilityRuleView {
  id: string;
  interviewerId: string;
  chapterId: string | null;
  scope: InterviewAvailabilityScope;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  slotDuration: number;
  bufferMinutes: number;
  meetingLink: string | null;
  locationLabel: string | null;
}

export interface InterviewAvailabilityOverrideView {
  id: string;
  interviewerId: string;
  chapterId: string | null;
  scope: InterviewAvailabilityScope;
  type: InterviewAvailabilityOverrideType;
  startsAt: string;
  endsAt: string;
  timezone: string;
  slotDuration: number | null;
  bufferMinutes: number | null;
  meetingLink: string | null;
  locationLabel: string | null;
  note: string | null;
}

export interface InterviewCalendarView {
  interviewerId: string;
  interviewerName: string;
  interviewerRole: string;
  chapterId: string | null;
  chapterName: string | null;
  rules: InterviewAvailabilityRuleView[];
  overrides: InterviewAvailabilityOverrideView[];
  nextOpenSlots: InterviewCalendarSlotView[];
}

export interface InterviewSchedulePageData {
  viewer: {
    userId: string;
    userName: string;
    roles: string[];
    primaryRole: string | null;
    chapterId: string | null;
    isAdmin: boolean;
    isReviewer: boolean;
    isChapterLead: boolean;
    isDesignatedInterviewer: boolean;
    isInstructor: boolean;
  };
  summary: {
    total: number;
    needsScheduling: number;
    booked: number;
    rescheduleRequested: number;
    atRisk: number;
  };
  workflows: InterviewWorkflowView[];
  calendars: InterviewCalendarView[];
  interviewerOptions: InterviewerOption[];
}

export interface InterviewScheduleHubWorkflow {
  id: string;
  title: string;
  intervieweeName: string;
  status: InterviewWorkflowView["status"];
  statusLabel: string;
  scheduledAt: string | null;
}

export interface InterviewScheduleHubData {
  summary: {
    total: number;
    needsScheduling: number;
    booked: number;
    rescheduleRequested: number;
    atRisk: number;
  };
  workflows: InterviewScheduleHubWorkflow[];
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing: ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getOptionalDateTime(raw: string | null | undefined) {
  if (!raw) return null;
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    throw new Error("Invalid date/time value");
  }
  return value;
}

function getNumber(formData: FormData, key: string, fallback: number) {
  const raw = formData.get(key);
  if (!raw || String(raw).trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session as SessionUser;
}

async function getViewerContext(): Promise<ViewerContext> {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      roles: { select: { role: true } },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const roles = user.roles.map((role) => role.role);
  const featureKeys = new Set(
    await getEnabledFeatureKeysForUser({
      userId: user.id,
      chapterId: user.chapterId,
      roles,
      primaryRole: user.primaryRole,
    }).catch(() => [])
  );

  return {
    userId: user.id,
    userName: user.name,
    roles,
    primaryRole: user.primaryRole,
    chapterId: user.chapterId,
    isAdmin: roles.includes("ADMIN"),
    isChapterLead: roles.includes("CHAPTER_PRESIDENT"),
    isDesignatedInterviewer: featureKeys.has("INTERVIEWER"),
    isReviewer:
      roles.includes("ADMIN") ||
      roles.includes("CHAPTER_PRESIDENT") ||
      featureKeys.has("INTERVIEWER"),
    isInstructor: roles.includes("INSTRUCTOR"),
  };
}

function scopeAllowsDomain(scope: InterviewAvailabilityScope, domain: InterviewDomain) {
  return scope === "ALL" || scope === domain;
}

function hoursBetween(from: Date, to: Date) {
  return Math.max(0, Math.round(((to.getTime() - from.getTime()) / 36e5) * 10) / 10);
}

function describeWorkflowStatus(status: InterviewWorkflowView["status"]) {
  switch (status) {
    case "UNSCHEDULED":
      return "Needs scheduling";
    case "AWAITING_RESPONSE":
      return "Awaiting response";
    case "BOOKED":
      return "Booked";
    case "RESCHEDULE_REQUESTED":
      return "Reschedule requested";
    case "STALE":
      return "At risk";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

async function sendInterviewLifecycleEmails(params: {
  event:
    | "CONFIRMED"
    | "RESCHEDULE_REQUESTED"
    | "RESCHEDULED"
    | "CANCELLED"
    | "REMINDER_24H"
    | "REMINDER_2H";
  requestId: string;
  domain: InterviewDomain;
  title: string;
  interviewee: { name: string | null; email: string | null };
  interviewer: { name: string | null; email: string | null };
  scheduledAt?: Date | null;
  duration?: number | null;
  meetingLink?: string | null;
}) {
  const {
    event,
    requestId,
    domain,
    title,
    interviewee,
    interviewer,
    scheduledAt = null,
    duration = 30,
    meetingLink = null,
  } = params;

  const label =
    domain === "HIRING" ? "Interview Scheduling" : "Readiness Interview Scheduling";
  const interviewLabel = domain === "HIRING" ? "interview" : "readiness interview";
  const when = scheduledAt ? new Date(scheduledAt).toLocaleString() : "To be scheduled";
  const uid = getSchedulingEventUid("interview", requestId);
  const calendarBase: CalendarInviteInput | null =
    scheduledAt && event !== "RESCHEDULE_REQUESTED"
      ? {
          uid,
          title,
          startsAt: scheduledAt,
          durationMinutes: duration ?? 30,
          descriptionLines: [
            `${domain === "HIRING" ? "Hiring interview" : "Readiness interview"}`,
            `Interviewee: ${interviewee.name ?? "Interviewee"}`,
            `Interviewer: ${interviewer.name ?? "Interviewer"}`,
            meetingLink ? `Meeting Link: ${meetingLink}` : "",
          ].filter(Boolean),
          location: meetingLink || "See YPP Portal for details",
        }
      : null;

  const intervieweeTemplate = {
    CONFIRMED: {
      subject: `${domain === "HIRING" ? "Interview" : "Readiness interview"} confirmed`,
      heading: `Your ${interviewLabel} is booked`,
      message: `${interviewer.name ?? "Your interviewer"} confirmed your time.`,
      calendar: calendarBase
        ? buildCalendarInviteInput({
            ...calendarBase,
            method: "REQUEST",
            filename: "interview-confirmed.ics",
          })
        : null,
    },
    RESCHEDULE_REQUESTED: {
      subject: `${domain === "HIRING" ? "Interview" : "Readiness interview"} reschedule requested`,
      heading: `A new ${interviewLabel} time is needed`,
      message: `${interviewer.name ?? "Your interviewer"} requested a new time.`,
      calendar: null,
    },
    RESCHEDULED: {
      subject: `${domain === "HIRING" ? "Interview" : "Readiness interview"} moved`,
      heading: `Your ${interviewLabel} has a new time`,
      message: `${interviewer.name ?? "Your interviewer"} confirmed the new slot.`,
      calendar: calendarBase
        ? buildCalendarInviteInput({
            ...calendarBase,
            method: "REQUEST",
            filename: "interview-rescheduled.ics",
          })
        : null,
    },
    CANCELLED: {
      subject: `${domain === "HIRING" ? "Interview" : "Readiness interview"} cancelled`,
      heading: `Your ${interviewLabel} was cancelled`,
      message: `Please return to the portal to choose a new time.`,
      calendar: calendarBase
        ? buildCalendarInviteInput({
            ...calendarBase,
            method: "CANCEL",
            status: "CANCELLED",
            filename: "interview-cancelled.ics",
          })
        : null,
    },
    REMINDER_24H: {
      subject: `Reminder: your ${interviewLabel} is within the next 24 hours`,
      heading: `Your ${interviewLabel} is coming up soon`,
      message: `${title} is coming up soon.`,
      calendar: null,
    },
    REMINDER_2H: {
      subject: `Reminder: your ${interviewLabel} starts soon`,
      heading: `Your ${interviewLabel} starts soon`,
      message: `${title} begins in about two hours.`,
      calendar: null,
    },
  } as const;

  const interviewerTemplate = {
    CONFIRMED: {
      subject: `New ${interviewLabel} booking`,
      heading: `A ${interviewLabel} was booked`,
      message: `${interviewee.name ?? "The interviewee"} now has a confirmed time with you.`,
      calendar: calendarBase
        ? buildCalendarInviteInput({
            ...calendarBase,
            method: "REQUEST",
            filename: "interview-confirmed.ics",
          })
        : null,
    },
    RESCHEDULE_REQUESTED: {
      subject: `${interviewLabel} reschedule requested`,
      heading: `A participant asked for a new time`,
      message: `Someone on this ${interviewLabel} asked for a new time.`,
      calendar: null,
    },
    RESCHEDULED: {
      subject: `${interviewLabel} moved`,
      heading: `The ${interviewLabel} has a new time`,
      message: `${interviewee.name ?? "The interviewee"} now has a new confirmed slot.`,
      calendar: calendarBase
        ? buildCalendarInviteInput({
            ...calendarBase,
            method: "REQUEST",
            filename: "interview-rescheduled.ics",
          })
        : null,
    },
    CANCELLED: {
      subject: `${interviewLabel} cancelled`,
      heading: `A ${interviewLabel} was cancelled`,
      message: `${title} was removed from the calendar.`,
      calendar: calendarBase
        ? buildCalendarInviteInput({
            ...calendarBase,
            method: "CANCEL",
            status: "CANCELLED",
            filename: "interview-cancelled.ics",
          })
        : null,
    },
    REMINDER_24H: {
      subject: `Reminder: ${interviewLabel} within the next 24 hours`,
      heading: `Your ${interviewLabel} is coming up soon`,
      message: `${title} is coming up soon.`,
      calendar: null,
    },
    REMINDER_2H: {
      subject: `Reminder: ${interviewLabel} starts soon`,
      heading: `Your ${interviewLabel} starts soon`,
      message: `${title} begins in about two hours.`,
      calendar: null,
    },
  } as const;

  const details = [
    { label: "When", value: when },
    { label: "Length", value: `${duration ?? 30} min` },
  ];

  await Promise.all(
    [
      interviewee.email
        ? sendSchedulingLifecycleEmail({
            to: interviewee.email,
            recipientName: interviewee.name,
            eyebrow: label,
            subject: intervieweeTemplate[event].subject,
            heading: intervieweeTemplate[event].heading,
            message: intervieweeTemplate[event].message,
            details,
            actionUrl: toAbsoluteAppUrl("/interviews/schedule"),
            actionLabel: "Open Interview Scheduler",
            calendar: intervieweeTemplate[event].calendar,
          })
        : null,
      interviewer.email
        ? sendSchedulingLifecycleEmail({
            to: interviewer.email,
            recipientName: interviewer.name,
            eyebrow: label,
            subject: interviewerTemplate[event].subject,
            heading: interviewerTemplate[event].heading,
            message: interviewerTemplate[event].message,
            details,
            actionUrl: toAbsoluteAppUrl("/interviews/schedule"),
            actionLabel: "Open Interview Scheduler",
            calendar: interviewerTemplate[event].calendar,
          })
        : null,
    ].filter(Boolean)
  );
}

async function getEligibleInterviewers(chapterId: string | null, includeAllAdmins = true) {
  const candidates = await prisma.user.findMany({
    where: includeAllAdmins
      ? chapterId
        ? {
            OR: [
              { roles: { some: { role: "ADMIN" } } },
              { chapterId },
            ],
          }
        : undefined
      : chapterId
      ? { chapterId }
      : { id: "__none__" },
    include: {
      roles: { select: { role: true } },
      chapter: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const eligible: InterviewerOption[] = [];

  for (const user of candidates) {
    const roles = user.roles.map((role) => role.role);
    const featureKeys = new Set(
      await getEnabledFeatureKeysForUser({
        userId: user.id,
        chapterId: user.chapterId,
        roles,
        primaryRole: user.primaryRole,
      }).catch(() => [])
    );

    if (
      roles.includes("ADMIN") ||
      roles.includes("CHAPTER_PRESIDENT") ||
      featureKeys.has("INTERVIEWER")
    ) {
      eligible.push({
        id: user.id,
        name: user.name,
        primaryRole: user.primaryRole,
        chapterId: user.chapterId,
        chapterName: user.chapter?.name ?? null,
      });
    }
  }

  return eligible;
}

async function getChapterOperatorIds(chapterId: string | null) {
  const orWhere: Prisma.UserWhereInput[] = [
    { roles: { some: { role: "ADMIN" } } },
  ];

  if (chapterId) {
    orWhere.push({
      chapterId,
      roles: { some: { role: "CHAPTER_PRESIDENT" } },
    });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: orWhere,
    },
    select: { id: true },
  });

  return users.map((user) => user.id);
}

async function syncConversationParticipants(conversationId: string, participantIds: string[]) {
  const existing = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((participant) => participant.userId));
  const missingIds = participantIds.filter((id) => !existingIds.has(id));
  if (missingIds.length === 0) return;

  await prisma.conversationParticipant.createMany({
    data: missingIds.map((userId) => ({ conversationId, userId })),
    skipDuplicates: true,
  });
}

async function ensureInterviewConversation({
  requestId,
  domain,
  subject,
  participantIds,
  senderId,
  initialMessage,
}: {
  requestId: string;
  domain: InterviewDomain;
  subject: string;
  participantIds: string[];
  senderId: string;
  initialMessage: string;
}) {
  const existing = await prisma.conversation.findFirst({
    where: {
      contextType: ConversationContextType.INTERVIEW,
      interviewDomain: domain,
      interviewEntityId: requestId,
    },
    select: { id: true },
  });

  if (existing) {
    await syncConversationParticipants(existing.id, participantIds);
    return existing.id;
  }

  const conversation = await prisma.conversation.create({
    data: {
      subject,
      isGroup: participantIds.length > 2,
      contextType: ConversationContextType.INTERVIEW,
      interviewDomain: domain,
      interviewEntityId: requestId,
      participants: {
        create: participantIds.map((userId) => ({ userId })),
      },
      messages: {
        create: {
          senderId,
          content: initialMessage,
        },
      },
    },
    select: { id: true },
  });

  return conversation.id;
}

async function createInterviewRequestConversation({
  requestId,
  domain,
  chapterId,
  interviewerId,
  intervieweeId,
  title,
  requesterId,
  initialMessage,
}: {
  requestId: string;
  domain: InterviewDomain;
  chapterId: string | null;
  interviewerId: string;
  intervieweeId: string;
  title: string;
  requesterId: string;
  initialMessage: string;
}) {
  const operatorIds = await getChapterOperatorIds(chapterId);
  const participantIds = Array.from(
    new Set([intervieweeId, interviewerId, ...operatorIds].filter(Boolean))
  );

  return ensureInterviewConversation({
    requestId,
    domain,
    subject: title,
    participantIds,
    senderId: requesterId,
    initialMessage,
  });
}

async function createThreadMessage(conversationId: string, senderId: string, content: string) {
  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
      },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);
}

async function getCalendarResources({
  chapterIds,
  interviewerIds,
  rangeEnd,
}: {
  chapterIds: string[];
  interviewerIds: string[];
  rangeEnd: Date;
}) {
  const [rules, overrides, hiringSlots, readinessSlots, requests, chapterEvents] =
    await Promise.all([
      prisma.interviewAvailabilityRule.findMany({
        where: {
          isActive: true,
          interviewerId: { in: interviewerIds.length > 0 ? interviewerIds : ["__none__"] },
        },
        include: {
          interviewer: {
            select: {
              id: true,
              name: true,
              primaryRole: true,
              chapter: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ interviewer: { name: "asc" } }, { dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      prisma.interviewAvailabilityOverride.findMany({
        where: {
          isActive: true,
          interviewerId: { in: interviewerIds.length > 0 ? interviewerIds : ["__none__"] },
          endsAt: { gte: new Date() },
        },
        orderBy: { startsAt: "asc" },
      }),
      prisma.interviewSlot.findMany({
        where: {
          interviewerId: { in: interviewerIds.length > 0 ? interviewerIds : ["__none__"] },
          status: { in: [...ACTIVE_SLOT_STATUSES] },
          scheduledAt: { lte: rangeEnd },
        },
        select: {
          interviewerId: true,
          scheduledAt: true,
          duration: true,
        },
      }),
      prisma.instructorInterviewSlot.findMany({
        where: {
          createdById: { in: interviewerIds.length > 0 ? interviewerIds : ["__none__"] },
          status: { in: [...ACTIVE_SLOT_STATUSES] },
          scheduledAt: { lte: rangeEnd },
        },
        select: {
          createdById: true,
          scheduledAt: true,
          duration: true,
        },
      }),
      prisma.interviewSchedulingRequest.findMany({
        where: {
          interviewerId: { in: interviewerIds.length > 0 ? interviewerIds : ["__none__"] },
          status: { in: ACTIVE_INTERVIEW_REQUEST_STATUSES },
          scheduledAt: { not: null, lte: rangeEnd },
        },
        select: {
          interviewerId: true,
          scheduledAt: true,
          duration: true,
        },
      }),
      prisma.event.findMany({
        where: {
          chapterId: { in: chapterIds.length > 0 ? chapterIds : ["__none__"] },
          startDate: { lte: rangeEnd },
          endDate: { gte: new Date() },
        },
        select: {
          chapterId: true,
          title: true,
          startDate: true,
          endDate: true,
        },
      }),
    ]);

  const busyByInterviewer = new Map<string, BusyInterval[]>();
  for (const slot of hiringSlots) {
    if (!slot.interviewerId) continue;
    const existing = busyByInterviewer.get(slot.interviewerId) ?? [];
    existing.push({
      startsAt: slot.scheduledAt,
      endsAt: new Date(slot.scheduledAt.getTime() + slot.duration * 60_000),
      label: "Hiring interview",
    });
    busyByInterviewer.set(slot.interviewerId, existing);
  }
  for (const slot of readinessSlots) {
    const existing = busyByInterviewer.get(slot.createdById) ?? [];
    existing.push({
      startsAt: slot.scheduledAt,
      endsAt: new Date(slot.scheduledAt.getTime() + slot.duration * 60_000),
      label: "Readiness interview",
    });
    busyByInterviewer.set(slot.createdById, existing);
  }
  for (const request of requests) {
    if (!request.scheduledAt) continue;
    const existing = busyByInterviewer.get(request.interviewerId) ?? [];
    existing.push({
      startsAt: request.scheduledAt,
      endsAt: new Date(request.scheduledAt.getTime() + request.duration * 60_000),
      label: "Interview booking",
    });
    busyByInterviewer.set(request.interviewerId, existing);
  }

  const warningsByChapter = new Map<string, WarningInterval[]>();
  for (const event of chapterEvents) {
    if (!event.chapterId) continue;
    const existing = warningsByChapter.get(event.chapterId) ?? [];
    existing.push({
      startsAt: event.startDate,
      endsAt: event.endDate,
      label: `Chapter event: ${event.title}`,
    });
    warningsByChapter.set(event.chapterId, existing);
  }

  return {
    rules,
    overrides,
    busyByInterviewer,
    warningsByChapter,
  };
}

function toRuleView(rule: Awaited<ReturnType<typeof getCalendarResources>>["rules"][number]): InterviewAvailabilityRuleView {
  return {
    id: rule.id,
    interviewerId: rule.interviewerId,
    chapterId: rule.chapterId,
    scope: rule.scope,
    dayOfWeek: rule.dayOfWeek,
    startTime: rule.startTime,
    endTime: rule.endTime,
    timezone: rule.timezone,
    slotDuration: rule.slotDuration,
    bufferMinutes: rule.bufferMinutes,
    meetingLink: rule.meetingLink,
    locationLabel: rule.locationLabel,
  };
}

function toOverrideView(
  override: AvailabilityOverrideLike & { chapterId?: string | null }
): InterviewAvailabilityOverrideView {
  return {
    id: override.id,
    interviewerId: override.interviewerId,
    chapterId: override.chapterId ?? null,
    scope: override.scope,
    type: override.type,
    startsAt: override.startsAt.toISOString(),
    endsAt: override.endsAt.toISOString(),
    timezone: override.timezone,
    slotDuration: override.slotDuration,
    bufferMinutes: override.bufferMinutes,
    meetingLink: override.meetingLink,
    locationLabel: override.locationLabel,
    note: override.note,
  };
}

function toSlotView(
  slot: ReturnType<typeof generateInterviewSlots>[number],
  interviewerName: string,
  interviewerRole: string
): InterviewCalendarSlotView {
  return {
    slotKey: slot.slotKey,
    interviewerId: slot.interviewerId,
    interviewerName,
    interviewerRole,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    duration: slot.duration,
    timezone: slot.timezone,
    meetingLink: slot.meetingLink,
    locationLabel: slot.locationLabel,
    warningLabels: slot.warningLabels,
  };
}

export async function runInterviewAutomation() {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const [twentyFourHourReminders, twoHourReminders, staleChapterEscalations, staleAdminEscalations] =
    await Promise.all([
      prisma.interviewSchedulingRequest.findMany({
        where: {
          status: "BOOKED",
          scheduledAt: {
            gt: now,
            lte: in24Hours,
          },
          reminder24SentAt: null,
        },
        include: {
          interviewee: { select: { id: true, name: true, email: true } },
          interviewer: { select: { id: true, name: true, email: true } },
          application: {
            select: {
              position: { select: { title: true } },
            },
          },
        },
      }),
      prisma.interviewSchedulingRequest.findMany({
        where: {
          status: "BOOKED",
          scheduledAt: {
            gt: now,
            lte: in2Hours,
          },
          reminder2SentAt: null,
        },
        include: {
          interviewee: { select: { id: true, name: true, email: true } },
          interviewer: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.interviewSchedulingRequest.findMany({
        where: {
          status: { in: ["REQUESTED", "RESCHEDULE_REQUESTED"] },
          chapterEscalatedAt: null,
        },
        select: {
          id: true,
          status: true,
          chapterId: true,
          interviewee: { select: { name: true } },
          interviewer: { select: { name: true } },
          createdAt: true,
          rescheduleRequestedAt: true,
        },
      }),
      prisma.interviewSchedulingRequest.findMany({
        where: {
          status: { in: ["REQUESTED", "RESCHEDULE_REQUESTED"] },
          chapterEscalatedAt: { not: null },
          adminEscalatedAt: null,
        },
        select: {
          id: true,
          interviewee: { select: { name: true } },
          interviewer: { select: { name: true } },
          chapterEscalatedAt: true,
        },
      }),
    ]);

  for (const request of twentyFourHourReminders) {
    if (!request.scheduledAt) continue;
    const when = request.scheduledAt.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    await Promise.all([
      createSystemNotification(
        request.intervieweeId,
        "SYSTEM",
        "Interview coming up",
        `Your interview with ${request.interviewer.name} is scheduled for ${when}.`,
        `/interviews/schedule`,
        { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
      ),
      createSystemNotification(
        request.interviewerId,
        "SYSTEM",
        "Interview coming up",
        `Your interview with ${request.interviewee.name} is scheduled for ${when}.`,
        `/interviews/schedule`,
        { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
      ),
      sendInterviewLifecycleEmails({
        event: "REMINDER_24H",
        requestId: request.id,
        domain: request.domain,
        title:
          request.domain === "HIRING"
            ? `Interview: ${request.application?.position.title ?? "Application interview"}`
            : "Instructor readiness interview",
        interviewee: request.interviewee,
        interviewer: request.interviewer,
        scheduledAt: request.scheduledAt,
        duration: request.duration,
        meetingLink: request.meetingLink,
      }),
      prisma.interviewSchedulingRequest.update({
        where: { id: request.id },
        data: { reminder24SentAt: new Date() },
      }),
    ]);
  }

  for (const request of twoHourReminders) {
    if (!request.scheduledAt) continue;
    const when = request.scheduledAt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    await Promise.all([
      createSystemNotification(
        request.intervieweeId,
        "SYSTEM",
        "Interview coming up",
        `Your interview with ${request.interviewer.name} starts at ${when}.`,
        `/interviews/schedule`,
        { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
      ),
      createSystemNotification(
        request.interviewerId,
        "SYSTEM",
        "Interview coming up",
        `Your interview with ${request.interviewee.name} starts at ${when}.`,
        `/interviews/schedule`,
        { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
      ),
      prisma.interviewSchedulingRequest.update({
        where: { id: request.id },
        data: { reminder2SentAt: new Date() },
      }),
    ]);
  }
  for (const request of staleChapterEscalations) {
    if (
      !isInterviewRequestAtRisk({
        createdAt: request.createdAt,
        rescheduleRequestedAt: request.rescheduleRequestedAt,
        status: request.status,
        now,
      })
    ) {
      continue;
    }

    const operatorIds = await getChapterOperatorIds(request.chapterId);
    for (const operatorId of operatorIds) {
      await createSystemNotification(
        operatorId,
        "SYSTEM",
        "Interview scheduling is at risk",
        `${request.interviewee.name} and ${request.interviewer.name} need scheduling attention.`,
        `/interviews/schedule`,
        { policyKey: "INTERVIEW_UPDATES" }
      );
    }

    await prisma.interviewSchedulingRequest.update({
      where: { id: request.id },
      data: { chapterEscalatedAt: new Date() },
    });
  }

  for (const request of staleAdminEscalations) {
    if (!request.chapterEscalatedAt) continue;
    if (now.getTime() - request.chapterEscalatedAt.getTime() < 24 * 60 * 60 * 1000) continue;

    const adminUsers = await prisma.user.findMany({
      where: { roles: { some: { role: "ADMIN" } } },
      select: { id: true },
    });

    for (const admin of adminUsers) {
      await createSystemNotification(
        admin.id,
        "SYSTEM",
        "Admin escalation: interview scheduling stalled",
        `${request.interviewee.name} and ${request.interviewer.name} still need scheduling help.`,
        `/interviews/schedule`,
        { policyKey: "INTERVIEW_UPDATES" }
      );
    }

    await prisma.interviewSchedulingRequest.update({
      where: { id: request.id },
      data: { adminEscalatedAt: new Date() },
    });
  }
}

async function backfillLegacyRequestForHiringSlot(slot: {
  id: string;
  applicationId: string;
  scheduledAt: Date;
  duration: number;
  meetingLink: string | null;
  interviewerId: string | null;
  confirmedAt?: Date | null;
  application: {
    applicantId: string;
    applicant: { name: string; email: string | null };
    position: {
      title: string;
      chapterId: string | null;
      chapter: { name: string } | null;
    };
  };
}) {
  if (!slot.interviewerId) return null;
  const existing = await prisma.interviewSchedulingRequest.findFirst({
    where: {
      domain: "HIRING",
      applicationId: slot.applicationId,
      status: { in: ACTIVE_INTERVIEW_REQUEST_STATUSES },
    },
    include: {
      interviewer: {
        select: { id: true, name: true, primaryRole: true },
      },
    },
  });
  if (existing) return existing;

  const request = await prisma.interviewSchedulingRequest.create({
    data: {
      domain: "HIRING",
      status: "BOOKED",
      chapterId: slot.application.position.chapterId,
      applicationId: slot.applicationId,
      intervieweeId: slot.application.applicantId,
      interviewerId: slot.interviewerId,
      requestedById: slot.application.applicantId,
      requestedStartAt: slot.scheduledAt,
      requestedEndAt: new Date(slot.scheduledAt.getTime() + slot.duration * 60_000),
      scheduledAt: slot.scheduledAt,
      duration: slot.duration,
      meetingLink: slot.meetingLink,
      sourceTimezone: "America/New_York",
      bookedAt: slot.confirmedAt ?? slot.scheduledAt,
    },
  });

  const conversationId = await createInterviewRequestConversation({
    requestId: request.id,
    domain: "HIRING",
    chapterId: slot.application.position.chapterId,
    interviewerId: slot.interviewerId,
    intervieweeId: slot.application.applicantId,
    title: `Interview: ${slot.application.position.title}`,
    requesterId: slot.application.applicantId,
    initialMessage: `${slot.application.applicant.name} booked an interview for ${slot.scheduledAt.toLocaleString()}.`,
  });

  return prisma.interviewSchedulingRequest.update({
    where: { id: request.id },
    data: { conversationId },
    include: {
      interviewer: {
        select: { id: true, name: true, primaryRole: true },
      },
    },
  });
}

async function backfillLegacyRequestForReadinessSlot(slot: {
  id: string;
  gateId: string;
  scheduledAt: Date;
  duration: number;
  meetingLink: string | null;
  createdById: string;
  confirmedAt?: Date | null;
  gate: {
    instructorId: string;
    instructor: { name: string; email: string | null };
  };
}) {
  const existing = await prisma.interviewSchedulingRequest.findFirst({
    where: {
      domain: "READINESS",
      gateId: slot.gateId,
      status: { in: ACTIVE_INTERVIEW_REQUEST_STATUSES },
    },
    include: {
      interviewer: {
        select: { id: true, name: true, primaryRole: true },
      },
    },
  });
  if (existing) return existing;

  const instructor = await prisma.user.findUnique({
    where: { id: slot.gate.instructorId },
    select: { chapterId: true },
  });

  const request = await prisma.interviewSchedulingRequest.create({
    data: {
      domain: "READINESS",
      status: "BOOKED",
      chapterId: instructor?.chapterId ?? null,
      gateId: slot.gateId,
      intervieweeId: slot.gate.instructorId,
      interviewerId: slot.createdById,
      requestedById: slot.gate.instructorId,
      requestedStartAt: slot.scheduledAt,
      requestedEndAt: new Date(slot.scheduledAt.getTime() + slot.duration * 60_000),
      scheduledAt: slot.scheduledAt,
      duration: slot.duration,
      meetingLink: slot.meetingLink,
      sourceTimezone: "America/New_York",
      bookedAt: slot.confirmedAt ?? slot.scheduledAt,
    },
  });

  const conversationId = await createInterviewRequestConversation({
    requestId: request.id,
    domain: "READINESS",
    chapterId: instructor?.chapterId ?? null,
    interviewerId: slot.createdById,
    intervieweeId: slot.gate.instructorId,
    title: "Instructor readiness interview",
    requesterId: slot.gate.instructorId,
    initialMessage: `${slot.gate.instructor.name} booked a readiness interview for ${slot.scheduledAt.toLocaleString()}.`,
  });

  return prisma.interviewSchedulingRequest.update({
    where: { id: request.id },
    data: { conversationId },
    include: {
      interviewer: {
        select: { id: true, name: true, primaryRole: true },
      },
    },
  });
}

async function getActiveSchedulingRequest(
  domain: InterviewDomain,
  workflowId: string
) {
  return prisma.interviewSchedulingRequest.findFirst({
    where:
      domain === "HIRING"
        ? { domain, applicationId: workflowId, status: { in: ACTIVE_INTERVIEW_REQUEST_STATUSES } }
        : { domain, gateId: workflowId, status: { in: ACTIVE_INTERVIEW_REQUEST_STATUSES } },
    include: {
      interviewer: {
        select: { id: true, name: true, primaryRole: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

type HubRequestRecord = {
  id: string;
  domain: InterviewDomain;
  applicationId: string | null;
  gateId: string | null;
  status: InterviewSchedulingRequestStatus;
  createdAt: Date;
  rescheduleRequestedAt: Date | null;
  scheduledAt: Date | null;
};

function buildHubWorkflowForHiring(params: {
  application: HiringWorkflowRecord;
  activeRequest: HubRequestRecord | null;
}): {
  status: InterviewWorkflowView["status"];
  isAtRisk: boolean;
  item: InterviewScheduleHubWorkflow;
} {
  const { application, activeRequest } = params;
  const confirmedSlot = application.interviewSlots.find((slot) => slot.status === "CONFIRMED");
  const completedSlot = application.interviewSlots.find((slot) => slot.status === "COMPLETED");

  const isAtRisk = activeRequest
    ? isInterviewRequestAtRisk({
        createdAt: activeRequest.createdAt,
        rescheduleRequestedAt: activeRequest.rescheduleRequestedAt,
        status: activeRequest.status,
      })
    : !confirmedSlot && Date.now() - application.submittedAt.getTime() >= 24 * 60 * 60 * 1000;

  let status: InterviewWorkflowView["status"] = "UNSCHEDULED";
  if (completedSlot) status = "COMPLETED";
  else if (activeRequest?.status === "RESCHEDULE_REQUESTED") status = "RESCHEDULE_REQUESTED";
  else if (activeRequest?.status === "REQUESTED") status = "AWAITING_RESPONSE";
  else if (activeRequest?.status === "CANCELLED") status = "CANCELLED";
  else if (confirmedSlot || activeRequest?.status === "BOOKED") status = "BOOKED";

  if (
    isAtRisk &&
    (status === "UNSCHEDULED" ||
      status === "AWAITING_RESPONSE" ||
      status === "RESCHEDULE_REQUESTED")
  ) {
    status = "STALE";
  }

  return {
    status,
    isAtRisk,
    item: {
      id: `HIRING:${application.id}`,
      title: application.position.title,
      intervieweeName: application.applicant.name ?? "Applicant",
      status,
      statusLabel: describeWorkflowStatus(status),
      scheduledAt:
        activeRequest?.scheduledAt?.toISOString() ??
        confirmedSlot?.scheduledAt.toISOString() ??
        completedSlot?.scheduledAt.toISOString() ??
        null,
    },
  };
}

function buildHubWorkflowForReadiness(params: {
  gate: ReadinessWorkflowRecord;
  activeRequest: HubRequestRecord | null;
}): {
  status: InterviewWorkflowView["status"];
  isAtRisk: boolean;
  item: InterviewScheduleHubWorkflow;
} {
  const { gate, activeRequest } = params;
  const confirmedSlot = gate.slots.find((slot) => slot.status === "CONFIRMED");
  const completedSlot = gate.slots.find((slot) => slot.status === "COMPLETED");

  const isAtRisk = activeRequest
    ? isInterviewRequestAtRisk({
        createdAt: activeRequest.createdAt,
        rescheduleRequestedAt: activeRequest.rescheduleRequestedAt,
        status: activeRequest.status,
      })
    : !confirmedSlot && Date.now() - gate.createdAt.getTime() >= 24 * 60 * 60 * 1000;

  let status: InterviewWorkflowView["status"] = "UNSCHEDULED";
  if (
    completedSlot ||
    gate.status === "COMPLETED" ||
    gate.status === "PASSED" ||
    gate.status === "WAIVED"
  ) {
    status = "COMPLETED";
  } else if (activeRequest?.status === "RESCHEDULE_REQUESTED") {
    status = "RESCHEDULE_REQUESTED";
  } else if (activeRequest?.status === "REQUESTED") {
    status = "AWAITING_RESPONSE";
  } else if (activeRequest?.status === "CANCELLED") {
    status = "CANCELLED";
  } else if (
    confirmedSlot ||
    activeRequest?.status === "BOOKED" ||
    gate.status === "SCHEDULED"
  ) {
    status = "BOOKED";
  }

  if (
    isAtRisk &&
    (status === "UNSCHEDULED" ||
      status === "AWAITING_RESPONSE" ||
      status === "RESCHEDULE_REQUESTED")
  ) {
    status = "STALE";
  }

  return {
    status,
    isAtRisk,
    item: {
      id: `READINESS:${gate.id}`,
      title: "Instructor readiness interview",
      intervieweeName: gate.instructor.name ?? "Instructor",
      status,
      statusLabel: describeWorkflowStatus(status),
      scheduledAt:
        activeRequest?.scheduledAt?.toISOString() ??
        confirmedSlot?.scheduledAt.toISOString() ??
        completedSlot?.scheduledAt.toISOString() ??
        gate.scheduledAt?.toISOString() ??
        null,
    },
  };
}

export async function getInterviewScheduleHubData(): Promise<InterviewScheduleHubData> {
  const viewer = await getViewerContext();

  const isInterviewParticipant =
    viewer.isReviewer ||
    viewer.isInstructor ||
    viewer.roles.includes("STUDENT") ||
    viewer.roles.includes("APPLICANT");

  if (!isInterviewParticipant) {
    throw new Error("You do not have access to interview scheduling.");
  }

  const [applications, gates] = await Promise.all([
    viewer.isReviewer
      ? prisma.application.findMany({
          where: {
            position: viewer.isAdmin
              ? { interviewRequired: true }
              : { interviewRequired: true, chapterId: viewer.chapterId ?? "__none__" },
            status: { notIn: [...FINAL_APPLICATION_STATUSES] },
          },
          include: {
            applicant: {
              select: { id: true, name: true, email: true },
            },
            position: {
              select: {
                title: true,
                chapterId: true,
                chapter: { select: { id: true, name: true } },
              },
            },
            interviewSlots: {
              orderBy: { scheduledAt: "asc" },
            },
          },
          orderBy: { submittedAt: "asc" },
        })
      : prisma.application.findMany({
          where: {
            applicantId: viewer.userId,
            status: { notIn: [...FINAL_APPLICATION_STATUSES] },
            position: { interviewRequired: true },
          },
          include: {
            applicant: {
              select: { id: true, name: true, email: true },
            },
            position: {
              select: {
                title: true,
                chapterId: true,
                chapter: { select: { id: true, name: true } },
              },
            },
            interviewSlots: {
              orderBy: { scheduledAt: "asc" },
            },
          },
          orderBy: { submittedAt: "asc" },
        }),
    viewer.isReviewer
      ? prisma.instructorInterviewGate.findMany({
          where: viewer.isAdmin
            ? { status: { notIn: ["PASSED", "WAIVED"] } }
            : {
                instructor: { chapterId: viewer.chapterId ?? "__none__" },
                status: { notIn: ["PASSED", "WAIVED"] },
              },
          include: {
            instructor: {
              select: {
                id: true,
                name: true,
                email: true,
                chapterId: true,
                chapter: { select: { id: true, name: true } },
              },
            },
            slots: {
              orderBy: { scheduledAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        })
      : viewer.isInstructor
        ? prisma.instructorInterviewGate.findMany({
            where: {
              instructorId: viewer.userId,
              status: { notIn: ["PASSED", "WAIVED"] },
            },
            include: {
              instructor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  chapterId: true,
                  chapter: { select: { id: true, name: true } },
                },
              },
              slots: {
                orderBy: { scheduledAt: "asc" },
              },
            },
            orderBy: { createdAt: "asc" },
          })
        : Promise.resolve([]),
  ]);

  const activeRequestsRaw = await prisma.interviewSchedulingRequest.findMany({
    where: {
      status: { in: ACTIVE_INTERVIEW_REQUEST_STATUSES },
      OR: [
        ...(applications.length > 0
          ? [{ domain: "HIRING" as const, applicationId: { in: applications.map((application) => application.id) } }]
          : []),
        ...(gates.length > 0
          ? [{ domain: "READINESS" as const, gateId: { in: gates.map((gate) => gate.id) } }]
          : []),
      ],
    },
    select: {
      id: true,
      domain: true,
      applicationId: true,
      gateId: true,
      status: true,
      createdAt: true,
      rescheduleRequestedAt: true,
      scheduledAt: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const activeRequestByWorkflowId = new Map<string, HubRequestRecord>();
  for (const request of activeRequestsRaw) {
    const workflowId = request.domain === "HIRING" ? request.applicationId : request.gateId;
    if (!workflowId || activeRequestByWorkflowId.has(workflowId)) continue;
    activeRequestByWorkflowId.set(workflowId, request);
  }

  const workflowSummaries = [
    ...applications.map((application) =>
      buildHubWorkflowForHiring({
        application,
        activeRequest: activeRequestByWorkflowId.get(application.id) ?? null,
      })
    ),
    ...gates.map((gate) =>
      buildHubWorkflowForReadiness({
        gate,
        activeRequest: activeRequestByWorkflowId.get(gate.id) ?? null,
      })
    ),
  ];

  workflowSummaries.sort((left, right) => {
    if (left.isAtRisk !== right.isAtRisk) return left.isAtRisk ? -1 : 1;
    if (left.status === right.status) {
      const leftTime = left.item.scheduledAt ? new Date(left.item.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.item.scheduledAt ? new Date(right.item.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    }
    return left.status.localeCompare(right.status);
  });

  return {
    summary: {
      total: workflowSummaries.length,
      needsScheduling: workflowSummaries.filter((workflow) => workflow.status === "UNSCHEDULED").length,
      booked: workflowSummaries.filter((workflow) => workflow.status === "BOOKED").length,
      rescheduleRequested: workflowSummaries.filter((workflow) => workflow.status === "RESCHEDULE_REQUESTED").length,
      atRisk: workflowSummaries.filter((workflow) => workflow.isAtRisk).length,
    },
    workflows: workflowSummaries.map((workflow) => workflow.item),
  };
}

async function buildWorkflowViewForHiring({
  application,
  viewer,
  rules,
  overrides,
  busyByInterviewer,
  warningsByChapter,
  interviewerDirectory,
}: {
  application: HiringWorkflowRecord;
  viewer: ViewerContext;
  rules: Awaited<ReturnType<typeof getCalendarResources>>["rules"];
  overrides: Awaited<ReturnType<typeof getCalendarResources>>["overrides"];
  busyByInterviewer: Map<string, BusyInterval[]>;
  warningsByChapter: Map<string, WarningInterval[]>;
  interviewerDirectory: Map<string, InterviewerOption>;
}): Promise<InterviewWorkflowView> {
  const confirmedSlot = application.interviewSlots.find((slot) => slot.status === "CONFIRMED");
  const completedSlot = application.interviewSlots.find((slot) => slot.status === "COMPLETED");
  let activeRequest = await getActiveSchedulingRequest("HIRING", application.id);

  if (!activeRequest && confirmedSlot) {
    activeRequest = await backfillLegacyRequestForHiringSlot({
      id: confirmedSlot.id,
      applicationId: application.id,
      scheduledAt: confirmedSlot.scheduledAt,
      duration: confirmedSlot.duration,
      meetingLink: confirmedSlot.meetingLink,
      interviewerId: confirmedSlot.interviewerId,
      application: {
        applicantId: application.applicantId,
        applicant: {
          name: application.applicant.name ?? "Applicant",
          email: application.applicant.email,
        },
        position: {
          title: application.position.title,
          chapterId: application.position.chapterId,
          chapter: application.position.chapter,
        },
      },
      confirmedAt: confirmedSlot.confirmedAt,
    });
  }

  const relevantInterviewers = Array.from(
    new Set(
      rules
        .filter(
          (rule) =>
            (rule.chapterId ?? rule.interviewer.chapter?.id) === application.position.chapterId &&
            scopeAllowsDomain(rule.scope, "HIRING")
        )
        .map((rule) => rule.interviewerId)
    )
  );

  const shouldShowOpenSlots =
    !completedSlot &&
    (!confirmedSlot || activeRequest?.status === "RESCHEDULE_REQUESTED");

  const openSlots = shouldShowOpenSlots
    ? relevantInterviewers.flatMap((interviewerId) => {
        const calendarOwner = interviewerDirectory.get(interviewerId);
        if (!calendarOwner) return [];
        return generateInterviewSlots({
          interviewerId,
          domain: "HIRING",
          rules: rules.filter((rule) => rule.interviewerId === interviewerId) as AvailabilityRuleLike[],
          overrides: overrides.filter((override) => override.interviewerId === interviewerId) as AvailabilityOverrideLike[],
          busyIntervals: busyByInterviewer.get(interviewerId) ?? [],
          warningIntervals: application.position.chapterId
            ? warningsByChapter.get(application.position.chapterId) ?? []
            : [],
          rangeStart: new Date(),
          days: DEFAULT_WINDOW_DAYS,
        })
          .slice(0, 8)
          .map((slot) =>
            toSlotView(slot, calendarOwner.name, calendarOwner.primaryRole.replace(/_/g, " "))
          );
      })
    : [];

  const ageBase = activeRequest
    ? getInterviewRequestAgeBase({
        createdAt: activeRequest.createdAt,
        rescheduleRequestedAt: activeRequest.rescheduleRequestedAt,
      })
    : application.submittedAt;
  const ageHours = hoursBetween(ageBase, new Date());
  const isAtRisk = activeRequest
    ? isInterviewRequestAtRisk({
        createdAt: activeRequest.createdAt,
        rescheduleRequestedAt: activeRequest.rescheduleRequestedAt,
        status: activeRequest.status,
      })
    : !confirmedSlot && Date.now() - application.submittedAt.getTime() >= 24 * 60 * 60 * 1000;

  let status: InterviewWorkflowView["status"] = "UNSCHEDULED";
  if (completedSlot) status = "COMPLETED";
  else if (activeRequest?.status === "RESCHEDULE_REQUESTED") status = "RESCHEDULE_REQUESTED";
  else if (activeRequest?.status === "REQUESTED") status = "AWAITING_RESPONSE";
  else if (activeRequest?.status === "CANCELLED") status = "CANCELLED";
  else if (confirmedSlot || activeRequest?.status === "BOOKED") status = "BOOKED";
  if (isAtRisk && (status === "UNSCHEDULED" || status === "AWAITING_RESPONSE" || status === "RESCHEDULE_REQUESTED")) {
    status = "STALE";
  }

  const interviewerInfo = activeRequest?.interviewerId
    ? interviewerDirectory.get(activeRequest.interviewerId) ?? null
    : confirmedSlot?.interviewerId
    ? interviewerDirectory.get(confirmedSlot.interviewerId) ?? null
    : null;

  return {
    id: `HIRING:${application.id}`,
    domain: "HIRING",
    workflowId: application.id,
    chapterId: application.position.chapterId,
    chapterName: application.position.chapter?.name ?? "Global",
    title: application.position.title,
    subtitle: application.applicant.name ?? "Applicant",
    intervieweeId: application.applicantId,
    intervieweeName: application.applicant.name ?? "Applicant",
    intervieweeEmail: application.applicant.email ?? "",
    interviewerId: interviewerInfo?.id ?? confirmedSlot?.interviewerId ?? activeRequest?.interviewerId ?? null,
    interviewerName: interviewerInfo?.name ?? activeRequest?.interviewer.name ?? null,
    interviewerRole: interviewerInfo?.primaryRole.replace(/_/g, " ") ?? null,
    ownerName: interviewerInfo?.name ?? application.position.chapter?.name ?? "Chapter team",
    status,
    statusLabel: describeWorkflowStatus(status),
    ageHours,
    isAtRisk,
    scheduledAt: activeRequest?.scheduledAt?.toISOString() ?? confirmedSlot?.scheduledAt.toISOString() ?? completedSlot?.scheduledAt.toISOString() ?? null,
    duration: activeRequest?.duration ?? confirmedSlot?.duration ?? completedSlot?.duration ?? null,
    meetingLink: activeRequest?.meetingLink ?? confirmedSlot?.meetingLink ?? completedSlot?.meetingLink ?? null,
    sourceTimezone: activeRequest?.sourceTimezone ?? "America/New_York",
    note: activeRequest?.note ?? null,
    activeRequestId: activeRequest?.id ?? null,
    conversationId: activeRequest?.conversationId ?? null,
    warnings: openSlots.flatMap((slot) => slot.warningLabels).slice(0, 3),
    openSlots,
    detailHref: `/applications/${application.id}`,
  };
}

async function buildWorkflowViewForReadiness({
  gate,
  viewer,
  rules,
  overrides,
  busyByInterviewer,
  warningsByChapter,
  interviewerDirectory,
}: {
  gate: ReadinessWorkflowRecord;
  viewer: ViewerContext;
  rules: Awaited<ReturnType<typeof getCalendarResources>>["rules"];
  overrides: Awaited<ReturnType<typeof getCalendarResources>>["overrides"];
  busyByInterviewer: Map<string, BusyInterval[]>;
  warningsByChapter: Map<string, WarningInterval[]>;
  interviewerDirectory: Map<string, InterviewerOption>;
}): Promise<InterviewWorkflowView> {
  const confirmedSlot = gate.slots.find((slot) => slot.status === "CONFIRMED");
  const completedSlot = gate.slots.find((slot) => slot.status === "COMPLETED");
  let activeRequest = await getActiveSchedulingRequest("READINESS", gate.id);

  if (!activeRequest && confirmedSlot) {
    activeRequest = await backfillLegacyRequestForReadinessSlot({
      id: confirmedSlot.id,
      gateId: gate.id,
      scheduledAt: confirmedSlot.scheduledAt,
      duration: confirmedSlot.duration,
      meetingLink: confirmedSlot.meetingLink,
      createdById: confirmedSlot.createdById,
      gate: {
        instructorId: gate.instructorId,
        instructor: {
          name: gate.instructor.name ?? "Instructor",
          email: gate.instructor.email,
        },
      },
      confirmedAt: confirmedSlot.confirmedAt,
    });
  }

  const chapterId = gate.instructor.chapter?.id ?? gate.instructor.chapterId ?? null;
  const relevantInterviewers = Array.from(
    new Set(
      rules
        .filter(
          (rule) =>
            (rule.chapterId ?? rule.interviewer.chapter?.id) === chapterId &&
            scopeAllowsDomain(rule.scope, "READINESS")
        )
        .map((rule) => rule.interviewerId)
    )
  );

  const shouldShowOpenSlots =
    !completedSlot &&
    (!confirmedSlot || activeRequest?.status === "RESCHEDULE_REQUESTED");

  const openSlots = shouldShowOpenSlots
    ? relevantInterviewers.flatMap((interviewerId) => {
        const calendarOwner = interviewerDirectory.get(interviewerId);
        if (!calendarOwner) return [];
        return generateInterviewSlots({
          interviewerId,
          domain: "READINESS",
          rules: rules.filter((rule) => rule.interviewerId === interviewerId) as AvailabilityRuleLike[],
          overrides: overrides.filter((override) => override.interviewerId === interviewerId) as AvailabilityOverrideLike[],
          busyIntervals: busyByInterviewer.get(interviewerId) ?? [],
          warningIntervals: chapterId ? warningsByChapter.get(chapterId) ?? [] : [],
          rangeStart: new Date(),
          days: DEFAULT_WINDOW_DAYS,
        })
          .slice(0, 8)
          .map((slot) =>
            toSlotView(slot, calendarOwner.name, calendarOwner.primaryRole.replace(/_/g, " "))
          );
      })
    : [];

  const ageBase = activeRequest
    ? getInterviewRequestAgeBase({
        createdAt: activeRequest.createdAt,
        rescheduleRequestedAt: activeRequest.rescheduleRequestedAt,
      })
    : gate.createdAt;
  const ageHours = hoursBetween(ageBase, new Date());
  const isAtRisk = activeRequest
    ? isInterviewRequestAtRisk({
        createdAt: activeRequest.createdAt,
        rescheduleRequestedAt: activeRequest.rescheduleRequestedAt,
        status: activeRequest.status,
      })
    : !confirmedSlot && Date.now() - gate.createdAt.getTime() >= 24 * 60 * 60 * 1000;

  let status: InterviewWorkflowView["status"] = "UNSCHEDULED";
  if (completedSlot || gate.status === "COMPLETED" || gate.status === "PASSED" || gate.status === "WAIVED") status = "COMPLETED";
  else if (activeRequest?.status === "RESCHEDULE_REQUESTED") status = "RESCHEDULE_REQUESTED";
  else if (activeRequest?.status === "REQUESTED") status = "AWAITING_RESPONSE";
  else if (activeRequest?.status === "CANCELLED") status = "CANCELLED";
  else if (confirmedSlot || activeRequest?.status === "BOOKED" || gate.status === "SCHEDULED") status = "BOOKED";
  if (isAtRisk && (status === "UNSCHEDULED" || status === "AWAITING_RESPONSE" || status === "RESCHEDULE_REQUESTED")) {
    status = "STALE";
  }

  const interviewerInfo = activeRequest?.interviewerId
    ? interviewerDirectory.get(activeRequest.interviewerId) ?? null
    : confirmedSlot?.createdById
    ? interviewerDirectory.get(confirmedSlot.createdById) ?? null
    : null;

  return {
    id: `READINESS:${gate.id}`,
    domain: "READINESS",
    workflowId: gate.id,
    chapterId,
    chapterName: gate.instructor.chapter?.name ?? "No chapter",
    title: "Instructor readiness interview",
    subtitle: gate.instructor.name ?? "Instructor",
    intervieweeId: gate.instructorId,
    intervieweeName: gate.instructor.name ?? "Instructor",
    intervieweeEmail: gate.instructor.email ?? "",
    interviewerId: interviewerInfo?.id ?? activeRequest?.interviewerId ?? confirmedSlot?.createdById ?? null,
    interviewerName: interviewerInfo?.name ?? activeRequest?.interviewer.name ?? null,
    interviewerRole: interviewerInfo?.primaryRole.replace(/_/g, " ") ?? null,
    ownerName: interviewerInfo?.name ?? gate.instructor.chapter?.name ?? "Chapter team",
    status,
    statusLabel: describeWorkflowStatus(status),
    ageHours,
    isAtRisk,
    scheduledAt: activeRequest?.scheduledAt?.toISOString() ?? confirmedSlot?.scheduledAt.toISOString() ?? completedSlot?.scheduledAt.toISOString() ?? gate.scheduledAt?.toISOString() ?? null,
    duration: activeRequest?.duration ?? confirmedSlot?.duration ?? completedSlot?.duration ?? null,
    meetingLink: activeRequest?.meetingLink ?? confirmedSlot?.meetingLink ?? completedSlot?.meetingLink ?? null,
    sourceTimezone: activeRequest?.sourceTimezone ?? "America/New_York",
    note: activeRequest?.note ?? null,
    activeRequestId: activeRequest?.id ?? null,
    conversationId: activeRequest?.conversationId ?? null,
    warnings: openSlots.flatMap((slot) => slot.warningLabels).slice(0, 3),
    openSlots,
    detailHref: `/interviews?scope=readiness&view=${viewer.isReviewer ? "team" : "mine"}`,
  };
}

export async function getInterviewScheduleData(): Promise<InterviewSchedulePageData> {
  const viewer = await getViewerContext();
  await runInterviewAutomation();

  const isInterviewParticipant =
    viewer.isReviewer ||
    viewer.isInstructor ||
    viewer.roles.includes("STUDENT") ||
    viewer.roles.includes("APPLICANT");

  if (!isInterviewParticipant) {
    throw new Error("You do not have access to interview scheduling.");
  }

  const now = new Date();
  const rangeEnd = new Date(now.getTime() + DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const interviewerOptions = await getEligibleInterviewers(viewer.chapterId, viewer.isAdmin);
  const interviewerDirectory = new Map(interviewerOptions.map((option) => [option.id, option]));

  const chapterIds = Array.from(
    new Set(interviewerOptions.map((option) => option.chapterId).filter(Boolean) as string[])
  );
  const { rules, overrides, busyByInterviewer, warningsByChapter } = await getCalendarResources({
    chapterIds,
    interviewerIds: interviewerOptions.map((option) => option.id),
    rangeEnd,
  });

  const workflows: InterviewWorkflowView[] = [];

  if (viewer.isReviewer) {
    const [applications, gates] = await Promise.all([
      prisma.application.findMany({
        where: {
          position: viewer.isAdmin
            ? { interviewRequired: true }
            : { interviewRequired: true, chapterId: viewer.chapterId ?? "__none__" },
          status: { notIn: [...FINAL_APPLICATION_STATUSES] },
        },
        include: {
          applicant: {
            select: { id: true, name: true, email: true },
          },
          position: {
            select: {
              title: true,
              chapterId: true,
              chapter: { select: { id: true, name: true } },
            },
          },
          interviewSlots: {
            orderBy: { scheduledAt: "asc" },
          },
        },
        orderBy: { submittedAt: "asc" },
      }),
      prisma.instructorInterviewGate.findMany({
        where: viewer.isAdmin
          ? { status: { notIn: ["PASSED", "WAIVED"] } }
          : {
              instructor: { chapterId: viewer.chapterId ?? "__none__" },
              status: { notIn: ["PASSED", "WAIVED"] },
            },
        include: {
          instructor: {
            select: {
              id: true,
              name: true,
              email: true,
              chapterId: true,
              chapter: { select: { id: true, name: true } },
            },
          },
          slots: {
            orderBy: { scheduledAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    for (const application of applications) {
      workflows.push(
        await buildWorkflowViewForHiring({
          application,
          viewer,
          rules,
          overrides,
          busyByInterviewer,
          warningsByChapter,
          interviewerDirectory,
        })
      );
    }

    for (const gate of gates) {
      workflows.push(
        await buildWorkflowViewForReadiness({
          gate,
          viewer,
          rules,
          overrides,
          busyByInterviewer,
          warningsByChapter,
          interviewerDirectory,
        })
      );
    }
  } else {
    const [applications, gate] = await Promise.all([
      prisma.application.findMany({
        where: {
          applicantId: viewer.userId,
          status: { notIn: [...FINAL_APPLICATION_STATUSES] },
          position: { interviewRequired: true },
        },
        include: {
          applicant: {
            select: { id: true, name: true, email: true },
          },
          position: {
            select: {
              title: true,
              chapterId: true,
              chapter: { select: { id: true, name: true } },
            },
          },
          interviewSlots: {
            orderBy: { scheduledAt: "asc" },
          },
        },
        orderBy: { submittedAt: "asc" },
      }),
      viewer.isInstructor
        ? prisma.instructorInterviewGate.upsert({
            where: { instructorId: viewer.userId },
            create: {
              instructorId: viewer.userId,
              status: "REQUIRED",
            },
            update: {},
            include: {
              instructor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  chapterId: true,
                  chapter: { select: { id: true, name: true } },
                },
              },
              slots: {
                orderBy: { scheduledAt: "asc" },
              },
            },
          })
        : null,
    ]);

    for (const application of applications) {
      workflows.push(
        await buildWorkflowViewForHiring({
          application,
          viewer,
          rules,
          overrides,
          busyByInterviewer,
          warningsByChapter,
          interviewerDirectory,
        })
      );
    }

    if (gate) {
      workflows.push(
        await buildWorkflowViewForReadiness({
          gate,
          viewer,
          rules,
          overrides,
          busyByInterviewer,
          warningsByChapter,
          interviewerDirectory,
        })
      );
    }
  }

  workflows.sort((left, right) => {
    if (left.isAtRisk !== right.isAtRisk) return left.isAtRisk ? -1 : 1;
    if (left.status === right.status) return right.ageHours - left.ageHours;
    return left.status.localeCompare(right.status);
  });

  const calendarsByInterviewer = new Map<string, InterviewCalendarView>();
  for (const interviewer of interviewerOptions) {
    calendarsByInterviewer.set(interviewer.id, {
      interviewerId: interviewer.id,
      interviewerName: interviewer.name,
      interviewerRole: interviewer.primaryRole.replace(/_/g, " "),
      chapterId: interviewer.chapterId,
      chapterName: interviewer.chapterName,
      rules: [],
      overrides: [],
      nextOpenSlots: [],
    });
  }

  for (const rule of rules) {
    const owner = interviewerDirectory.get(rule.interviewerId);
    if (!owner) continue;
    const current = calendarsByInterviewer.get(rule.interviewerId) ?? {
      interviewerId: rule.interviewerId,
      interviewerName: owner.name,
      interviewerRole: owner.primaryRole.replace(/_/g, " "),
      chapterId: owner.chapterId,
      chapterName: owner.chapterName,
      rules: [],
      overrides: [],
      nextOpenSlots: [],
    };
    current.rules.push(toRuleView(rule));
    calendarsByInterviewer.set(rule.interviewerId, current);
  }

  for (const override of overrides) {
    const current = calendarsByInterviewer.get(override.interviewerId);
    if (!current) continue;
    current.overrides.push(toOverrideView(override));
  }

  for (const [interviewerId, calendar] of calendarsByInterviewer.entries()) {
    const owner = interviewerDirectory.get(interviewerId);
    if (!owner) continue;
    calendar.nextOpenSlots = generateInterviewSlots({
      interviewerId,
      domain: "HIRING",
      rules: rules.filter((rule) => rule.interviewerId === interviewerId) as AvailabilityRuleLike[],
      overrides: overrides.filter((override) => override.interviewerId === interviewerId) as AvailabilityOverrideLike[],
      busyIntervals: busyByInterviewer.get(interviewerId) ?? [],
      warningIntervals: owner.chapterId ? warningsByChapter.get(owner.chapterId) ?? [] : [],
      rangeStart: now,
      days: 14,
    })
      .slice(0, 6)
      .map((slot) =>
        toSlotView(slot, owner.name, owner.primaryRole.replace(/_/g, " "))
      );
  }

  return {
    viewer: {
      userId: viewer.userId,
      userName: viewer.userName,
      roles: viewer.roles,
      primaryRole: viewer.primaryRole,
      chapterId: viewer.chapterId,
      isAdmin: viewer.isAdmin,
      isReviewer: viewer.isReviewer,
      isChapterLead: viewer.isChapterLead,
      isDesignatedInterviewer: viewer.isDesignatedInterviewer,
      isInstructor: viewer.isInstructor,
    },
    summary: {
      total: workflows.length,
      needsScheduling: workflows.filter((workflow) => workflow.status === "UNSCHEDULED").length,
      booked: workflows.filter((workflow) => workflow.status === "BOOKED").length,
      rescheduleRequested: workflows.filter((workflow) => workflow.status === "RESCHEDULE_REQUESTED").length,
      atRisk: workflows.filter((workflow) => workflow.isAtRisk).length,
    },
    workflows,
    calendars: Array.from(calendarsByInterviewer.values()).sort((left, right) =>
      left.interviewerName.localeCompare(right.interviewerName)
    ),
    interviewerOptions,
  };
}

function ensureViewerCanManageInterviewer(viewer: ViewerContext, interviewer: InterviewerOption) {
  if (viewer.isAdmin) return;
  if (!viewer.isReviewer) {
    throw new Error("Only reviewers can manage interviewer calendars.");
  }
  if (!viewer.chapterId || interviewer.chapterId !== viewer.chapterId) {
    throw new Error("You can only manage interviewer calendars in your own chapter.");
  }
}

export async function createInterviewAvailabilityRule(formData: FormData) {
  const viewer = await getViewerContext();
  if (!viewer.isReviewer) {
    throw new Error("Only reviewers can manage interview availability.");
  }

  const interviewerId = getString(formData, "interviewerId");
  const interviewer = (await getEligibleInterviewers(viewer.chapterId, viewer.isAdmin)).find(
    (option) => option.id === interviewerId
  );
  if (!interviewer) {
    throw new Error("Interviewer not found or not eligible.");
  }

  ensureViewerCanManageInterviewer(viewer, interviewer);

  const dayOfWeek = Number(getString(formData, "dayOfWeek"));
  const startTime = getString(formData, "startTime");
  const endTime = getString(formData, "endTime");
  const timezone = getString(formData, "timezone", false) || "America/New_York";
  const scope = (getString(formData, "scope", false) || "ALL") as InterviewAvailabilityScope;
  const slotDuration = getNumber(formData, "slotDuration", 30);
  const bufferMinutes = getNumber(formData, "bufferMinutes", 10);
  const meetingLink = getString(formData, "meetingLink", false) || null;
  const locationLabel = getString(formData, "locationLabel", false) || null;

  await prisma.interviewAvailabilityRule.create({
    data: {
      interviewerId,
      chapterId: interviewer.chapterId,
      dayOfWeek,
      startTime,
      endTime,
      timezone,
      scope,
      slotDuration,
      bufferMinutes,
      meetingLink,
      locationLabel,
    },
  });

  revalidatePath("/interviews/schedule");
  revalidatePath("/chapter");
}

export async function deactivateInterviewAvailabilityRule(formData: FormData) {
  const viewer = await getViewerContext();
  if (!viewer.isReviewer) {
    throw new Error("Only reviewers can manage interview availability.");
  }

  const ruleId = getString(formData, "ruleId");
  const rule = await prisma.interviewAvailabilityRule.findUnique({
    where: { id: ruleId },
    select: {
      id: true,
      interviewerId: true,
      chapterId: true,
    },
  });
  if (!rule) throw new Error("Availability rule not found.");

  const interviewer = {
    id: rule.interviewerId,
    name: "",
    primaryRole: "STAFF",
    chapterId: rule.chapterId,
    chapterName: null,
  } satisfies InterviewerOption;
  ensureViewerCanManageInterviewer(viewer, interviewer);

  await prisma.interviewAvailabilityRule.update({
    where: { id: ruleId },
    data: { isActive: false },
  });

  revalidatePath("/interviews/schedule");
  revalidatePath("/chapter");
}

export async function createInterviewAvailabilityOverride(formData: FormData) {
  const viewer = await getViewerContext();
  if (!viewer.isReviewer) {
    throw new Error("Only reviewers can manage interview availability.");
  }

  const interviewerId = getString(formData, "interviewerId");
  const interviewer = (await getEligibleInterviewers(viewer.chapterId, viewer.isAdmin)).find(
    (option) => option.id === interviewerId
  );
  if (!interviewer) {
    throw new Error("Interviewer not found or not eligible.");
  }

  ensureViewerCanManageInterviewer(viewer, interviewer);

  const type = (getString(formData, "type") as InterviewAvailabilityOverrideType);
  const scope = (getString(formData, "scope", false) || "ALL") as InterviewAvailabilityScope;
  const startsAt = getOptionalDateTime(getString(formData, "startsAt"));
  const endsAt = getOptionalDateTime(getString(formData, "endsAt"));
  if (!startsAt || !endsAt) throw new Error("Start and end time are required.");
  if (startsAt >= endsAt) throw new Error("Override end time must be after the start time.");

  await prisma.interviewAvailabilityOverride.create({
    data: {
      interviewerId,
      chapterId: interviewer.chapterId,
      type,
      scope,
      startsAt,
      endsAt,
      timezone: getString(formData, "timezone", false) || "America/New_York",
      slotDuration: formData.get("slotDuration") ? getNumber(formData, "slotDuration", 30) : null,
      bufferMinutes: formData.get("bufferMinutes") ? getNumber(formData, "bufferMinutes", 10) : null,
      meetingLink: getString(formData, "meetingLink", false) || null,
      locationLabel: getString(formData, "locationLabel", false) || null,
      note: getString(formData, "note", false) || null,
    },
  });

  revalidatePath("/interviews/schedule");
  revalidatePath("/chapter");
}

export async function deactivateInterviewAvailabilityOverride(formData: FormData) {
  const viewer = await getViewerContext();
  if (!viewer.isReviewer) {
    throw new Error("Only reviewers can manage interview availability.");
  }

  const overrideId = getString(formData, "overrideId");
  const override = await prisma.interviewAvailabilityOverride.findUnique({
    where: { id: overrideId },
    select: {
      id: true,
      interviewerId: true,
      chapterId: true,
    },
  });
  if (!override) throw new Error("Availability override not found.");

  const interviewer = {
    id: override.interviewerId,
    name: "",
    primaryRole: "STAFF",
    chapterId: override.chapterId,
    chapterName: null,
  } satisfies InterviewerOption;
  ensureViewerCanManageInterviewer(viewer, interviewer);

  await prisma.interviewAvailabilityOverride.update({
    where: { id: overrideId },
    data: { isActive: false },
  });

  revalidatePath("/interviews/schedule");
  revalidatePath("/chapter");
}

async function resolveInterviewerSlotContext({
  interviewerId,
  domain,
  scheduledAt,
  requestedDuration,
}: {
  interviewerId: string;
  domain: InterviewDomain;
  scheduledAt: Date;
  requestedDuration: number;
}): Promise<SlotContext> {
  const rangeStart = new Date(scheduledAt);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(rangeStart.getTime() + 2 * 24 * 60 * 60 * 1000);
  const interviewer = await prisma.user.findUnique({
    where: { id: interviewerId },
    select: { chapterId: true },
  });

  const { rules, overrides } = await getCalendarResources({
    chapterIds: interviewer?.chapterId ? [interviewer.chapterId] : [],
    interviewerIds: [interviewerId],
    rangeEnd,
  });

  const matchingSlot = generateInterviewSlots({
    interviewerId,
    domain,
    rules: rules.filter((rule) => rule.interviewerId === interviewerId) as AvailabilityRuleLike[],
    overrides: overrides.filter((override) => override.interviewerId === interviewerId) as AvailabilityOverrideLike[],
    busyIntervals: [],
    rangeStart,
    days: 2,
  }).find((slot) => slot.startsAt.getTime() === scheduledAt.getTime());

  if (!matchingSlot) {
    throw new Error("That interview time is no longer inside an active interviewer calendar.");
  }

  return {
    duration: matchingSlot.duration ?? requestedDuration,
    meetingLink: matchingSlot.meetingLink,
    locationLabel: matchingSlot.locationLabel,
    sourceTimezone: matchingSlot.timezone,
  };
}

async function assertNoBookingConflict({
  interviewerId,
  intervieweeId,
  scheduledAt,
  duration,
  ignoreRequestId,
  ignoreApplicationId,
  ignoreGateId,
}: {
  interviewerId: string;
  intervieweeId: string;
  scheduledAt: Date;
  duration: number;
  ignoreRequestId?: string | null;
  ignoreApplicationId?: string | null;
  ignoreGateId?: string | null;
}) {
  const endsAt = new Date(scheduledAt.getTime() + duration * 60_000);

  const [
    interviewerRequests,
    intervieweeRequests,
    interviewerHiringSlots,
    intervieweeHiringSlots,
    interviewerReadinessSlots,
    intervieweeReadinessSlots,
  ] = await Promise.all([
    prisma.interviewSchedulingRequest.findMany({
      where: {
        interviewerId,
        scheduledAt: { not: null },
        status: { in: ["BOOKED", "RESCHEDULE_REQUESTED"] },
        ...(ignoreRequestId ? { id: { not: ignoreRequestId } } : {}),
      },
      select: { scheduledAt: true, duration: true },
    }),
    prisma.interviewSchedulingRequest.findMany({
      where: {
        intervieweeId,
        scheduledAt: { not: null },
        status: { in: ["BOOKED", "RESCHEDULE_REQUESTED"] },
        ...(ignoreRequestId ? { id: { not: ignoreRequestId } } : {}),
      },
      select: { scheduledAt: true, duration: true },
    }),
    prisma.interviewSlot.findMany({
      where: {
        interviewerId,
        status: "CONFIRMED",
        ...(ignoreApplicationId ? { applicationId: { not: ignoreApplicationId } } : {}),
      },
      select: { scheduledAt: true, duration: true },
    }),
    prisma.interviewSlot.findMany({
      where: {
        application: { applicantId: intervieweeId },
        status: "CONFIRMED",
        ...(ignoreApplicationId ? { applicationId: { not: ignoreApplicationId } } : {}),
      },
      select: { scheduledAt: true, duration: true },
    }),
    prisma.instructorInterviewSlot.findMany({
      where: {
        createdById: interviewerId,
        status: "CONFIRMED",
        ...(ignoreGateId ? { gateId: { not: ignoreGateId } } : {}),
      },
      select: { scheduledAt: true, duration: true },
    }),
    prisma.instructorInterviewSlot.findMany({
      where: {
        gate: { instructorId: intervieweeId },
        status: "CONFIRMED",
        ...(ignoreGateId ? { gateId: { not: ignoreGateId } } : {}),
      },
      select: { scheduledAt: true, duration: true },
    }),
  ]);

  const allBusyIntervals = [
    ...interviewerRequests,
    ...intervieweeRequests,
    ...interviewerHiringSlots,
    ...intervieweeHiringSlots,
    ...interviewerReadinessSlots,
    ...intervieweeReadinessSlots,
  ];

  for (const interval of allBusyIntervals) {
    if (!interval.scheduledAt) continue;
    const intervalEndsAt = new Date(interval.scheduledAt.getTime() + interval.duration * 60_000);
    if (rangesOverlap(scheduledAt, endsAt, interval.scheduledAt, intervalEndsAt)) {
      throw new Error("That interview time conflicts with an existing booking.");
    }
  }
}

async function syncHiringBooking({
  applicationId,
  interviewerId,
  scheduledAt,
  duration,
  meetingLink,
}: {
  applicationId: string;
  interviewerId: string;
  scheduledAt: Date;
  duration: number;
  meetingLink: string | null;
}) {
  await prisma.$transaction([
    prisma.interviewSlot.updateMany({
      where: {
        applicationId,
        status: { in: ["POSTED", "CONFIRMED"] },
      },
      data: {
        status: "CANCELLED",
        isConfirmed: false,
      },
    }),
    prisma.interviewSlot.create({
      data: {
        applicationId,
        interviewerId,
        status: "CONFIRMED",
        isConfirmed: true,
        scheduledAt,
        duration,
        meetingLink,
        confirmedAt: new Date(),
      },
    }),
    prisma.application.update({
      where: { id: applicationId },
      data: { status: "INTERVIEW_SCHEDULED" },
    }),
  ]);
}

async function syncReadinessBooking({
  gateId,
  interviewerId,
  scheduledAt,
  duration,
  meetingLink,
  source,
}: {
  gateId: string;
  interviewerId: string;
  scheduledAt: Date;
  duration: number;
  meetingLink: string | null;
  source: InterviewSlotSource;
}) {
  await prisma.$transaction([
    prisma.instructorInterviewSlot.updateMany({
      where: {
        gateId,
        status: { in: ["POSTED", "CONFIRMED"] },
      },
      data: { status: "CANCELLED" },
    }),
    prisma.instructorInterviewSlot.create({
      data: {
        gateId,
        createdById: interviewerId,
        source,
        status: "CONFIRMED",
        scheduledAt,
        duration,
        meetingLink,
        confirmedAt: new Date(),
      },
    }),
    prisma.instructorInterviewGate.update({
      where: { id: gateId },
      data: {
        status: "SCHEDULED",
        scheduledAt,
      },
    }),
  ]);
}

function bookingInitialMessage({
  actorName,
  intervieweeName,
  interviewerName,
  scheduledAt,
  domain,
}: {
  actorName: string;
  intervieweeName: string;
  interviewerName: string;
  scheduledAt: Date;
  domain: InterviewDomain;
}) {
  const when = scheduledAt.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${actorName} booked a ${domain === "HIRING" ? "hiring" : "readiness"} interview for ${intervieweeName} with ${interviewerName} on ${when}.`;
}

export async function bookInterviewWorkflowSlot(formData: FormData) {
  const viewer = await getViewerContext();
  const domain = getString(formData, "domain") as InterviewDomain;
  const workflowId = getString(formData, "workflowId");
  const interviewerId = getString(formData, "interviewerId");
  const scheduledAt = getOptionalDateTime(getString(formData, "scheduledAt"));
  const requestedDuration = getNumber(formData, "duration", 30);
  const note = getString(formData, "note", false) || null;

  if (!scheduledAt) throw new Error("A valid interview time is required.");

  if (domain === "HIRING") {
    const application = await prisma.application.findUnique({
      where: { id: workflowId },
      include: {
        applicant: { select: { id: true, name: true, email: true } },
        position: {
          select: {
            title: true,
            chapterId: true,
            chapter: { select: { name: true } },
            interviewRequired: true,
          },
        },
      },
    });
    if (!application) throw new Error("Application not found.");
    if (!application.position.interviewRequired) throw new Error("This application does not require an interview.");
    if (
      application.applicantId !== viewer.userId &&
      !(viewer.isReviewer && (viewer.isAdmin || viewer.chapterId === application.position.chapterId))
    ) {
      throw new Error("You are not allowed to book this interview.");
    }

    const existingRequest = await prisma.interviewSchedulingRequest.findFirst({
      where: {
        domain: "HIRING",
        applicationId: workflowId,
        status: { in: ["BOOKED", "REQUESTED", "RESCHEDULE_REQUESTED"] },
      },
      select: { id: true },
    });
    if (existingRequest) {
      throw new Error("This application already has an active interview scheduling request.");
    }

    const slotContext = await resolveInterviewerSlotContext({
      interviewerId,
      domain,
      scheduledAt,
      requestedDuration,
    });
    await assertNoBookingConflict({
      interviewerId,
      intervieweeId: application.applicantId,
      scheduledAt,
      duration: slotContext.duration,
      ignoreApplicationId: workflowId,
    });

    const request = await prisma.interviewSchedulingRequest.create({
      data: {
        domain: "HIRING",
        status: "BOOKED",
        chapterId: application.position.chapterId,
        applicationId: workflowId,
        intervieweeId: application.applicantId,
        interviewerId,
        requestedById: viewer.userId,
        requestedStartAt: scheduledAt,
        requestedEndAt: new Date(scheduledAt.getTime() + slotContext.duration * 60_000),
        scheduledAt,
        duration: slotContext.duration,
        meetingLink: slotContext.meetingLink,
        sourceTimezone: slotContext.sourceTimezone,
        note,
        bookedAt: new Date(),
      },
    });

    const interviewer = await prisma.user.findUnique({
      where: { id: interviewerId },
      select: { id: true, name: true, email: true },
    });
    if (!interviewer) throw new Error("Interviewer not found.");

    const conversationId = await createInterviewRequestConversation({
      requestId: request.id,
      domain,
      chapterId: application.position.chapterId,
      interviewerId,
      intervieweeId: application.applicantId,
      title: `Interview: ${application.position.title}`,
      requesterId: viewer.userId,
      initialMessage: bookingInitialMessage({
        actorName: viewer.userName,
        intervieweeName: application.applicant.name ?? "Applicant",
        interviewerName: interviewer.name,
        scheduledAt,
        domain,
      }),
    });

    await prisma.interviewSchedulingRequest.update({
      where: { id: request.id },
      data: { conversationId },
    });

    await syncHiringBooking({
      applicationId: workflowId,
      interviewerId,
      scheduledAt,
      duration: slotContext.duration,
      meetingLink: slotContext.meetingLink,
    });

    await Promise.all([
      createSystemNotification(
        application.applicantId,
        "SYSTEM",
        "Interview booked",
        `Your interview with ${interviewer.name} has been booked.`,
        `/interviews/schedule`,
        { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
      ),
      createSystemNotification(
        interviewerId,
        "SYSTEM",
        "Interview booked",
        `${application.applicant.name} booked an interview with you.`,
        `/interviews/schedule`,
        { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
      ),
      sendInterviewLifecycleEmails({
        event: "CONFIRMED",
        requestId: request.id,
        domain,
        title: `Interview: ${application.position.title}`,
        interviewee: application.applicant,
        interviewer,
        scheduledAt,
        duration: slotContext.duration,
        meetingLink: slotContext.meetingLink,
      }),
    ]);
  } else {
    const gate = await prisma.instructorInterviewGate.findUnique({
      where: { id: workflowId },
      include: {
        instructor: {
          select: {
            id: true,
            name: true,
            email: true,
            chapterId: true,
            chapter: { select: { name: true } },
          },
        },
      },
    });
    if (!gate) throw new Error("Interview gate not found.");
    if (
      gate.instructorId !== viewer.userId &&
      !(viewer.isReviewer && (viewer.isAdmin || viewer.chapterId === gate.instructor.chapterId))
    ) {
      throw new Error("You are not allowed to book this interview.");
    }

    const existingRequest = await prisma.interviewSchedulingRequest.findFirst({
      where: {
        domain: "READINESS",
        gateId: workflowId,
        status: { in: ["BOOKED", "REQUESTED", "RESCHEDULE_REQUESTED"] },
      },
      select: { id: true },
    });
    if (existingRequest) {
      throw new Error("This interview gate already has an active scheduling request.");
    }

    const slotContext = await resolveInterviewerSlotContext({
      interviewerId,
      domain,
      scheduledAt,
      requestedDuration,
    });
    await assertNoBookingConflict({
      interviewerId,
      intervieweeId: gate.instructorId,
      scheduledAt,
      duration: slotContext.duration,
      ignoreGateId: workflowId,
    });

    const request = await prisma.interviewSchedulingRequest.create({
      data: {
        domain: "READINESS",
        status: "BOOKED",
        chapterId: gate.instructor.chapterId,
        gateId: workflowId,
        intervieweeId: gate.instructorId,
        interviewerId,
        requestedById: viewer.userId,
        requestedStartAt: scheduledAt,
        requestedEndAt: new Date(scheduledAt.getTime() + slotContext.duration * 60_000),
        scheduledAt,
        duration: slotContext.duration,
        meetingLink: slotContext.meetingLink,
        sourceTimezone: slotContext.sourceTimezone,
        note,
        bookedAt: new Date(),
      },
    });

    const interviewer = await prisma.user.findUnique({
      where: { id: interviewerId },
      select: { id: true, name: true, email: true },
    });
    if (!interviewer) throw new Error("Interviewer not found.");

    const conversationId = await createInterviewRequestConversation({
      requestId: request.id,
      domain,
      chapterId: gate.instructor.chapterId,
      interviewerId,
      intervieweeId: gate.instructorId,
      title: "Instructor readiness interview",
      requesterId: viewer.userId,
      initialMessage: bookingInitialMessage({
        actorName: viewer.userName,
        intervieweeName: gate.instructor.name ?? "Instructor",
        interviewerName: interviewer.name,
        scheduledAt,
        domain,
      }),
    });

    await prisma.interviewSchedulingRequest.update({
      where: { id: request.id },
      data: { conversationId },
    });

    await syncReadinessBooking({
      gateId: workflowId,
      interviewerId,
      scheduledAt,
      duration: slotContext.duration,
      meetingLink: slotContext.meetingLink,
      source: viewer.userId === gate.instructorId ? InterviewSlotSource.INSTRUCTOR_REQUESTED : InterviewSlotSource.REVIEWER_POSTED,
    });

    await Promise.all([
      createSystemNotification(
        gate.instructorId,
        "SYSTEM",
        "Readiness interview booked",
        `Your readiness interview with ${interviewer.name} has been booked.`,
        `/interviews/schedule`,
        { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
      ),
      createSystemNotification(
        interviewerId,
        "SYSTEM",
        "Readiness interview booked",
        `${gate.instructor.name} booked a readiness interview with you.`,
        `/interviews/schedule`,
        { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
      ),
      sendInterviewLifecycleEmails({
        event: "CONFIRMED",
        requestId: request.id,
        domain,
        title: "Instructor readiness interview",
        interviewee: gate.instructor,
        interviewer,
        scheduledAt,
        duration: slotContext.duration,
        meetingLink: slotContext.meetingLink,
      }),
    ]);
  }

  revalidatePath("/interviews/schedule");
  revalidatePath("/chapter");
}

export async function requestInterviewReschedule(formData: FormData) {
  const viewer = await getViewerContext();
  const requestId = getString(formData, "requestId");
  const note = getString(formData, "note", false) || "Requesting a new interview time.";

  const request = await prisma.interviewSchedulingRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      domain: true,
      status: true,
      chapterId: true,
      conversationId: true,
      intervieweeId: true,
      interviewerId: true,
      scheduledAt: true,
      duration: true,
      meetingLink: true,
      interviewee: { select: { name: true, email: true } },
      interviewer: { select: { name: true, email: true } },
      application: {
        select: {
          position: { select: { title: true } },
        },
      },
    },
  });
  if (!request) throw new Error("Interview request not found.");
  if (!["BOOKED", "REQUESTED"].includes(request.status)) {
    throw new Error("Only booked or pending interviews can be rescheduled.");
  }

  const canAct =
    viewer.userId === request.intervieweeId ||
    viewer.userId === request.interviewerId ||
    (viewer.isReviewer && (viewer.isAdmin || viewer.chapterId === request.chapterId));
  if (!canAct) {
    throw new Error("You are not allowed to update this interview.");
  }

  await prisma.interviewSchedulingRequest.update({
    where: { id: requestId },
    data: {
      status: "RESCHEDULE_REQUESTED",
      rescheduleRequestedAt: new Date(),
      chapterEscalatedAt: null,
      adminEscalatedAt: null,
      note,
    },
  });

  if (request.conversationId) {
    await createThreadMessage(request.conversationId, viewer.userId, note);
  }

  const notifyTargets = Array.from(
    new Set([request.intervieweeId, request.interviewerId].filter((id) => id !== viewer.userId))
  );
  for (const userId of notifyTargets) {
    await createSystemNotification(
      userId,
      "SYSTEM",
      "Interview reschedule requested",
      `${viewer.userName} requested a new interview time.`,
      `/interviews/schedule`,
      { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
    );
  }

  await sendInterviewLifecycleEmails({
    event: "RESCHEDULE_REQUESTED",
    requestId: request.id,
    domain: request.domain,
    title:
      request.domain === "HIRING"
        ? `Interview: ${request.application?.position.title ?? "Application interview"}`
        : "Instructor readiness interview",
    interviewee: request.interviewee,
    interviewer: request.interviewer,
    scheduledAt: request.scheduledAt,
    duration: request.duration,
    meetingLink: request.meetingLink,
  });

  revalidatePath("/interviews/schedule");
  revalidatePath("/chapter");
}

export async function confirmInterviewReschedule(formData: FormData) {
  const viewer = await getViewerContext();
  if (!viewer.isReviewer) {
    throw new Error("Only reviewers can confirm a reschedule.");
  }

  const requestId = getString(formData, "requestId");
  const interviewerId = getString(formData, "interviewerId");
  const scheduledAt = getOptionalDateTime(getString(formData, "scheduledAt"));
  const requestedDuration = getNumber(formData, "duration", 30);
  const note = getString(formData, "note", false) || "Interview reschedule confirmed.";

  if (!scheduledAt) throw new Error("A valid interview time is required.");

  const request = await prisma.interviewSchedulingRequest.findUnique({
    where: { id: requestId },
    include: {
      application: {
        include: {
          applicant: { select: { name: true, email: true } },
          position: { select: { title: true, chapterId: true } },
        },
      },
      gate: {
        include: {
          instructor: {
            select: { name: true, email: true, chapterId: true },
          },
        },
      },
    },
  });
  if (!request) throw new Error("Interview request not found.");
  if (!["RESCHEDULE_REQUESTED", "REQUESTED", "BOOKED"].includes(request.status)) {
    throw new Error("This interview cannot be rescheduled right now.");
  }
  if (!viewer.isAdmin && viewer.chapterId !== request.chapterId) {
    throw new Error("You can only manage interviews for your own chapter.");
  }

  const slotContext = await resolveInterviewerSlotContext({
    interviewerId,
    domain: request.domain,
    scheduledAt,
    requestedDuration,
  });
  await assertNoBookingConflict({
    interviewerId,
    intervieweeId: request.intervieweeId,
    scheduledAt,
    duration: slotContext.duration,
    ignoreRequestId: request.id,
    ignoreApplicationId: request.applicationId,
    ignoreGateId: request.gateId,
  });

  if (request.domain === "HIRING" && request.applicationId) {
    await syncHiringBooking({
      applicationId: request.applicationId,
      interviewerId,
      scheduledAt,
      duration: slotContext.duration,
      meetingLink: slotContext.meetingLink,
    });
  }

  if (request.domain === "READINESS" && request.gateId) {
    await syncReadinessBooking({
      gateId: request.gateId,
      interviewerId,
      scheduledAt,
      duration: slotContext.duration,
      meetingLink: slotContext.meetingLink,
      source: InterviewSlotSource.REVIEWER_POSTED,
    });
  }

  await prisma.interviewSchedulingRequest.update({
    where: { id: request.id },
    data: {
      interviewerId,
      status: "BOOKED",
      requestedStartAt: scheduledAt,
      requestedEndAt: new Date(scheduledAt.getTime() + slotContext.duration * 60_000),
      scheduledAt,
      duration: slotContext.duration,
      meetingLink: slotContext.meetingLink,
      sourceTimezone: slotContext.sourceTimezone,
      note,
      bookedAt: new Date(),
      reminder24SentAt: null,
      reminder2SentAt: null,
      rescheduleRequestedAt: null,
      chapterEscalatedAt: null,
      adminEscalatedAt: null,
    },
  });

  const interviewer = await prisma.user.findUnique({
    where: { id: interviewerId },
    select: { name: true, email: true },
  });
  if (!interviewer) {
    throw new Error("Interviewer not found.");
  }

  if (request.conversationId) {
    const operatorIds = await getChapterOperatorIds(request.chapterId);
    await syncConversationParticipants(request.conversationId, [
      request.intervieweeId,
      interviewerId,
      ...operatorIds,
    ]);
    await createThreadMessage(request.conversationId, viewer.userId, note);
  }

  await Promise.all([
    createSystemNotification(
      request.intervieweeId,
      "SYSTEM",
      "Interview rescheduled",
      `Your interview was moved to ${scheduledAt.toLocaleString()}.`,
      `/interviews/schedule`,
      { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
    ),
    createSystemNotification(
      interviewerId,
      "SYSTEM",
      "Interview rescheduled",
      `${request.intervieweeId === viewer.userId ? "The interviewee" : viewer.userName} confirmed a new time.`,
      `/interviews/schedule`,
      { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
    ),
    sendInterviewLifecycleEmails({
      event: "RESCHEDULED",
      requestId: request.id,
      domain: request.domain,
      title:
        request.domain === "HIRING"
          ? `Interview: ${request.application?.position.title ?? "Application interview"}`
          : "Instructor readiness interview",
      interviewee:
        request.domain === "HIRING" && request.application
          ? request.application.applicant
          : request.gate!.instructor,
      interviewer,
      scheduledAt,
      duration: slotContext.duration,
      meetingLink: slotContext.meetingLink,
    }),
  ]);

  revalidatePath("/interviews/schedule");
  revalidatePath("/chapter");
}

export async function runInterviewSchedulingAutomation() {
  await runInterviewAutomation();
}

export async function cancelInterviewWorkflow(formData: FormData) {
  const viewer = await getViewerContext();
  const requestId = getString(formData, "requestId");
  const note = getString(formData, "note", false) || "Interview cancelled.";

  const request = await prisma.interviewSchedulingRequest.findUnique({
    where: { id: requestId },
    include: {
      interviewee: {
        select: { name: true, email: true },
      },
      interviewer: {
        select: { name: true, email: true },
      },
      application: {
        include: {
          position: {
            select: { title: true },
          },
        },
      },
      gate: {
        select: { id: true },
      },
    },
  });
  if (!request) throw new Error("Interview request not found.");

  const canAct =
    viewer.userId === request.intervieweeId ||
    viewer.userId === request.interviewerId ||
    (viewer.isReviewer && (viewer.isAdmin || viewer.chapterId === request.chapterId));
  if (!canAct) throw new Error("You are not allowed to cancel this interview.");

  await prisma.interviewSchedulingRequest.update({
    where: { id: requestId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      note,
    },
  });

  if (request.domain === "HIRING" && request.applicationId) {
    await prisma.$transaction([
      prisma.interviewSlot.updateMany({
        where: {
          applicationId: request.applicationId,
          status: { in: ["POSTED", "CONFIRMED"] },
        },
        data: {
          status: "CANCELLED",
          isConfirmed: false,
        },
      }),
      prisma.application.update({
        where: { id: request.applicationId },
        data: { status: "UNDER_REVIEW" },
      }),
    ]);
  }

  if (request.domain === "READINESS" && request.gateId) {
    await prisma.$transaction([
      prisma.instructorInterviewSlot.updateMany({
        where: {
          gateId: request.gateId,
          status: { in: ["POSTED", "CONFIRMED"] },
        },
        data: { status: "CANCELLED" },
      }),
      prisma.instructorInterviewGate.update({
        where: { id: request.gateId },
        data: {
          status: "REQUIRED",
          scheduledAt: null,
        },
      }),
    ]);
  }

  if (request.conversationId) {
    await createThreadMessage(request.conversationId, viewer.userId, note);
  }

  await Promise.all([
    createSystemNotification(
      request.intervieweeId,
      "SYSTEM",
      "Interview cancelled",
      "An interview booking was cancelled. Please choose a new time.",
      `/interviews/schedule`,
      { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
    ),
    createSystemNotification(
      request.interviewerId,
      "SYSTEM",
      "Interview cancelled",
      "An interview booking was cancelled.",
      `/interviews/schedule`,
      { sendEmail: false, policyKey: "INTERVIEW_UPDATES" }
    ),
    sendInterviewLifecycleEmails({
      event: "CANCELLED",
      requestId: request.id,
      domain: request.domain,
      title:
        request.domain === "HIRING"
          ? `Interview: ${request.application?.position.title ?? "Application interview"}`
          : "Instructor readiness interview",
      interviewee: request.interviewee,
      interviewer: request.interviewer ?? { name: null, email: null },
      scheduledAt: request.scheduledAt,
      duration: request.duration,
      meetingLink: request.meetingLink,
    }),
  ]);

  revalidatePath("/interviews/schedule");
  revalidatePath("/chapter");
}
