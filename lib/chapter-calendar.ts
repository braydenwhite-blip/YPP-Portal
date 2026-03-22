import {
  EventRecurrenceFrequency,
  EventScope,
  EventType,
  EventVisibility,
  NotificationType,
  ReminderType,
  RsvpStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deliverBulkNotifications } from "@/lib/notification-delivery";

const DAY_TO_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

type ManualEventInput = {
  title: string;
  description: string;
  eventType: EventType;
  scope: EventScope;
  visibility: EventVisibility;
  chapterId?: string | null;
  startDate: Date;
  endDate: Date;
  location?: string | null;
  meetingUrl?: string | null;
  isAlumniOnly?: boolean;
  createdById?: string | null;
  updatedById?: string | null;
  reminder24Hr?: boolean;
  reminder1Hr?: boolean;
};

type EventSeriesInput = ManualEventInput & {
  recurrenceFrequency: EventRecurrenceFrequency;
  recurrenceInterval?: number;
  recurrenceDays?: string[];
  recurrenceCount?: number | null;
  recurrenceUntil?: Date | null;
  timezone?: string;
};

export type ChapterCalendarEntry = {
  id: string;
  source: "EVENT" | "CLASS_SESSION" | "MILESTONE" | "LAUNCH_TASK";
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string | null;
  meetingUrl: string | null;
  visibility: "INTERNAL" | "PUBLIC";
  chapterName: string;
  chapterSlug: string;
  eventTypeLabel: string;
  eventTypeColor: string;
  isCancelled: boolean;
  link: string | null;
  eventId: string | null;
  milestoneId: string | null;
  seriesId: string | null;
  userRsvpStatus: RsvpStatus | null;
  isSubscribed: boolean;
};

export function slugifyChapterName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function chapterSlugValue(chapter: { slug: string | null; name: string }) {
  return chapter.slug?.trim() || slugifyChapterName(chapter.name);
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(base: Date, months: number) {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

function eventColorForType(type: string) {
  switch (type) {
    case "SHOWCASE":
      return "#8b5cf6";
    case "FESTIVAL":
      return "#ec4899";
    case "COMPETITION":
      return "#f59e0b";
    case "WORKSHOP":
      return "#3b82f6";
    case "ALUMNI_EVENT":
      return "#10b981";
    case "CLASS_SESSION":
      return "#0f766e";
    case "CHAPTER_MILESTONE":
      return "#b45309";
    case "LAUNCH_TASK":
      return "#dc2626";
    default:
      return "#6366f1";
  }
}

function eventLabelForSource(source: ChapterCalendarEntry["source"], eventType?: string) {
  if (source === "EVENT") return (eventType || "EVENT").replace(/_/g, " ");
  if (source === "CLASS_SESSION") return "CLASS SESSION";
  if (source === "MILESTONE") return "CHAPTER MILESTONE";
  return "LAUNCH TASK";
}

function ensureStartBeforeEnd(startDate: Date, endDate: Date) {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
    throw new Error("Invalid start date");
  }
  if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid end date");
  }
  if (endDate <= startDate) {
    throw new Error("End date must be after the start date");
  }
}

function isSameInstant(a: Date | null | undefined, b: Date | null | undefined) {
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

function buildReminderCopy(event: {
  title: string;
  startDate: Date;
  endDate: Date;
  location: string | null;
  meetingUrl: string | null;
  chapter?: { name: string | null } | null;
}) {
  const formattedDate = event.startDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const chapterCopy = event.chapter?.name ? ` for ${event.chapter.name}` : "";
  const locationCopy = event.location ? ` Location: ${event.location}.` : "";
  const meetingCopy = event.meetingUrl ? ` Join link: ${event.meetingUrl}` : "";
  return {
    soonTitle: `${event.title} starts soon`,
    dayTitle: `Reminder: ${event.title} is tomorrow`,
    soonBody: `${event.title}${chapterCopy} starts at ${formattedDate}.${locationCopy}${meetingCopy}`.trim(),
    dayBody: `${event.title}${chapterCopy} is scheduled for ${formattedDate}.${locationCopy}${meetingCopy}`.trim(),
  };
}

function rangeOverlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA <= endB && endA >= startB;
}

function buildWeeklyOccurrences(
  series: {
    startDate: Date;
    endDate: Date;
    recurrenceInterval: number;
    recurrenceDays: string[];
    recurrenceCount: number | null;
    recurrenceUntil: Date | null;
  }
) {
  const duration = series.endDate.getTime() - series.startDate.getTime();
  const recurrenceDays = series.recurrenceDays.length > 0
    ? series.recurrenceDays
    : [series.startDate.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()];

  const allowedDays = recurrenceDays
    .map((day) => DAY_TO_INDEX[day])
    .filter((value) => value !== undefined)
    .sort((left, right) => left - right);

  const weekAnchor = new Date(series.startDate);
  weekAnchor.setHours(0, 0, 0, 0);
  weekAnchor.setDate(weekAnchor.getDate() - weekAnchor.getDay());

  const occurrences: Array<{ startDate: Date; endDate: Date; originalStart: Date }> = [];
  let cycle = 0;

  while (occurrences.length < (series.recurrenceCount ?? 120)) {
    const cycleStart = addDays(weekAnchor, cycle * 7 * series.recurrenceInterval);

    for (const dayIndex of allowedDays) {
      const occurrenceStart = new Date(cycleStart);
      occurrenceStart.setDate(cycleStart.getDate() + dayIndex);
      occurrenceStart.setHours(
        series.startDate.getHours(),
        series.startDate.getMinutes(),
        series.startDate.getSeconds(),
        series.startDate.getMilliseconds()
      );

      if (occurrenceStart < series.startDate) {
        continue;
      }

      if (series.recurrenceUntil && occurrenceStart > series.recurrenceUntil) {
        return occurrences;
      }

      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
      occurrences.push({
        startDate: occurrenceStart,
        endDate: occurrenceEnd,
        originalStart: new Date(occurrenceStart),
      });

      if (series.recurrenceCount && occurrences.length >= series.recurrenceCount) {
        return occurrences;
      }
    }

    cycle += 1;
    if (cycle > 180) {
      break;
    }
  }

  return occurrences;
}

export function generateSeriesOccurrences(
  series: {
    startDate: Date;
    endDate: Date;
    recurrenceFrequency: EventRecurrenceFrequency;
    recurrenceInterval: number;
    recurrenceDays: string[];
    recurrenceCount: number | null;
    recurrenceUntil: Date | null;
  }
) {
  ensureStartBeforeEnd(series.startDate, series.endDate);

  const duration = series.endDate.getTime() - series.startDate.getTime();
  const occurrences: Array<{ startDate: Date; endDate: Date; originalStart: Date }> = [];

  if (series.recurrenceFrequency === "WEEKLY") {
    return buildWeeklyOccurrences(series);
  }

  let cursor = new Date(series.startDate);
  let created = 0;
  const maxCount = series.recurrenceCount ?? 120;

  while (created < maxCount) {
    if (series.recurrenceUntil && cursor > series.recurrenceUntil) {
      break;
    }

    occurrences.push({
      startDate: new Date(cursor),
      endDate: new Date(cursor.getTime() + duration),
      originalStart: new Date(cursor),
    });
    created += 1;

    cursor =
      series.recurrenceFrequency === "DAILY"
        ? addDays(cursor, series.recurrenceInterval)
        : addMonths(cursor, series.recurrenceInterval);

    if (created > 180) break;
  }

  return occurrences;
}

export async function syncEventSeriesOccurrences(seriesId: string) {
  const series = await prisma.eventSeries.findUnique({
    where: { id: seriesId },
  });

  if (!series) {
    throw new Error("Series not found");
  }

  const occurrences = generateSeriesOccurrences({
    startDate: series.startDate,
    endDate: series.endDate,
    recurrenceFrequency: series.recurrenceFrequency,
    recurrenceInterval: series.recurrenceInterval,
    recurrenceDays: series.recurrenceDays,
    recurrenceCount: series.recurrenceCount,
    recurrenceUntil: series.recurrenceUntil,
  });

  const existingEvents = await prisma.event.findMany({
    where: { seriesId },
    orderBy: { startDate: "asc" },
  });

  const existingByOriginalStart = new Map<number, typeof existingEvents[number]>();
  for (const event of existingEvents) {
    const originalStart = event.occurrenceOriginalStart ?? event.startDate;
    existingByOriginalStart.set(originalStart.getTime(), event);
  }

  const keptKeys = new Set<number>();

  for (const occurrence of occurrences) {
    const key = occurrence.originalStart.getTime();
    keptKeys.add(key);
    const existing = existingByOriginalStart.get(key);

    if (!existing) {
      await prisma.event.create({
        data: {
          title: series.title,
          description: series.description,
          eventType: series.eventType,
          scope: series.scope,
          visibility: series.visibility,
          startDate: occurrence.startDate,
          endDate: occurrence.endDate,
          chapterId: series.chapterId || null,
          location: series.location,
          meetingUrl: series.meetingUrl,
          createdById: series.createdById || null,
          updatedById: series.updatedById || null,
          seriesId: series.id,
          occurrenceOriginalStart: occurrence.originalStart,
          reminder24Hr: series.reminder24Hr,
          reminder1Hr: series.reminder1Hr,
          isCancelled: false,
        },
      });
      continue;
    }

    if (existing.isException) {
      continue;
    }

    await prisma.event.update({
      where: { id: existing.id },
      data: {
        title: series.title,
        description: series.description,
        eventType: series.eventType,
        scope: series.scope,
        visibility: series.visibility,
        startDate: occurrence.startDate,
        endDate: occurrence.endDate,
        chapterId: series.chapterId || null,
        location: series.location,
        meetingUrl: series.meetingUrl,
        updatedById: series.updatedById || null,
        reminder24Hr: series.reminder24Hr,
        reminder1Hr: series.reminder1Hr,
        isCancelled: false,
        cancellationReason: null,
      },
    });
  }

  for (const event of existingEvents) {
    const originalStart = event.occurrenceOriginalStart ?? event.startDate;
    if (keptKeys.has(originalStart.getTime())) {
      continue;
    }

    if (event.isException) {
      continue;
    }

    await prisma.event.update({
      where: { id: event.id },
      data: {
        isCancelled: true,
        cancellationReason: "Removed from the recurring series.",
        updatedById: series.updatedById || null,
      },
    });
  }
}

export async function createManualEvent(input: ManualEventInput) {
  ensureStartBeforeEnd(input.startDate, input.endDate);

  return await prisma.event.create({
    data: {
      title: input.title,
      description: input.description,
      eventType: input.eventType,
      scope: input.scope,
      visibility: input.visibility,
      chapterId: input.chapterId || null,
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location || null,
      meetingUrl: input.meetingUrl || null,
      isAlumniOnly: input.isAlumniOnly ?? false,
      createdById: input.createdById || null,
      updatedById: input.updatedById || null,
      reminder24Hr: input.reminder24Hr ?? true,
      reminder1Hr: input.reminder1Hr ?? true,
    },
  });
}

export async function createRecurringEventSeries(input: EventSeriesInput) {
  ensureStartBeforeEnd(input.startDate, input.endDate);

  const series = await prisma.eventSeries.create({
    data: {
      title: input.title,
      description: input.description,
      eventType: input.eventType,
      scope: input.scope,
      visibility: input.visibility,
      chapterId: input.chapterId || null,
      startDate: input.startDate,
      endDate: input.endDate,
      timezone: input.timezone || "America/New_York",
      location: input.location || null,
      meetingUrl: input.meetingUrl || null,
      recurrenceFrequency: input.recurrenceFrequency,
      recurrenceInterval: input.recurrenceInterval ?? 1,
      recurrenceDays: input.recurrenceDays ?? [],
      recurrenceCount: input.recurrenceCount ?? null,
      recurrenceUntil: input.recurrenceUntil ?? null,
      reminder24Hr: input.reminder24Hr ?? true,
      reminder1Hr: input.reminder1Hr ?? true,
      createdById: input.createdById || null,
      updatedById: input.updatedById || null,
    },
  });

  await syncEventSeriesOccurrences(series.id);
  return series;
}

export async function scheduleEventReminders(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      chapter: { select: { name: true } },
      rsvps: {
        where: { status: "GOING" },
        select: { userId: true },
      },
    },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  await prisma.eventReminder.deleteMany({
    where: {
      eventId,
      status: "PENDING",
    },
  });

  if (event.isCancelled || event.startDate <= new Date()) {
    return;
  }

  const copy = buildReminderCopy(event);
  const now = new Date();
  const reminders = [];

  for (const rsvp of event.rsvps) {
    if (event.reminder24Hr) {
      const scheduledFor = new Date(event.startDate.getTime() - 24 * 60 * 60 * 1000);
      reminders.push({
        eventId,
        userId: rsvp.userId,
        type: "TWENTY_FOUR_HOUR" as ReminderType,
        scheduledFor: scheduledFor < now ? now : scheduledFor,
        subject: copy.dayTitle,
        body: copy.dayBody,
      });
    }

    if (event.reminder1Hr) {
      const scheduledFor = new Date(event.startDate.getTime() - 60 * 60 * 1000);
      reminders.push({
        eventId,
        userId: rsvp.userId,
        type: "ONE_HOUR" as ReminderType,
        scheduledFor: scheduledFor < now ? now : scheduledFor,
        subject: copy.soonTitle,
        body: copy.soonBody,
      });
    }
  }

  if (reminders.length > 0) {
    await prisma.eventReminder.createMany({
      data: reminders,
      skipDuplicates: true,
    });
  }
}

export async function notifyChapterSubscribers(params: {
  chapterId: string;
  title: string;
  body: string;
  link?: string | null;
}) {
  const subscriptions = await prisma.chapterCalendarSubscription.findMany({
    where: { chapterId: params.chapterId },
    select: { userId: true },
  });

  await deliverBulkNotifications(
    subscriptions.map((subscription) => ({
      userId: subscription.userId,
      type: NotificationType.EVENT_UPDATE,
      title: params.title,
      body: params.body,
      link: params.link || null,
    }))
  );
}

export async function notifyRsvpUsersAboutEventChange(params: {
  eventId: string;
  title: string;
  body: string;
  link?: string | null;
}) {
  const rsvps = await prisma.eventRsvp.findMany({
    where: {
      eventId: params.eventId,
      status: { in: ["GOING", "MAYBE"] },
    },
    select: { userId: true },
  });

  await deliverBulkNotifications(
    rsvps.map((rsvp) => ({
      userId: rsvp.userId,
      type: NotificationType.EVENT_UPDATE,
      title: params.title,
      body: params.body,
      link: params.link || null,
    }))
  );
}

export async function getChapterByPublicSlug(slug: string) {
  const direct = await prisma.chapter.findFirst({
    where: {
      OR: [{ slug }, { slug: slug.toLowerCase() }],
      publicProfileEnabled: true,
    },
  });

  if (direct) return direct;

  const chapters = await prisma.chapter.findMany({
    where: { publicProfileEnabled: true },
  });

  return chapters.find((chapter) => chapterSlugValue(chapter) === slug) ?? null;
}

export async function getChapterCalendarEntries(params: {
  chapterId: string;
  start: Date;
  end: Date;
  includeInternal: boolean;
  userId?: string | null;
  subscribedChapterIds?: string[];
}) {
  const { chapterId, start, end, includeInternal, userId, subscribedChapterIds = [] } = params;

  const manualEvents = await prisma.event.findMany({
    where: {
      chapterId,
      OR: includeInternal ? undefined : [{ visibility: "PUBLIC" }],
      startDate: { lte: end },
      endDate: { gte: start },
    },
    include: {
      chapter: { select: { id: true, name: true, slug: true } },
      rsvps: userId
        ? {
            where: { userId },
            select: { status: true },
          }
        : false,
    },
    orderBy: { startDate: "asc" },
  });

  const milestones = await prisma.chapterMilestone.findMany({
    where: {
      chapterId,
      isArchived: false,
      dueDate: { gte: start, lte: end },
      ...(includeInternal ? {} : { visibility: "PUBLIC" }),
    },
    include: {
      chapter: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const sessions = includeInternal
    ? await prisma.classSession.findMany({
        where: {
          date: { gte: start, lte: end },
          offering: { chapterId },
        },
        include: {
          offering: {
            select: {
              id: true,
              title: true,
              chapter: { select: { id: true, name: true, slug: true } },
              locationName: true,
              zoomLink: true,
            },
          },
        },
        orderBy: { date: "asc" },
      })
    : [];

  const launchTasks = includeInternal
    ? await prisma.launchTask.findMany({
        where: {
          chapterId,
          dueDate: { gte: start, lte: end },
          isActive: true,
        },
        include: {
          chapter: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const entries: ChapterCalendarEntry[] = [];

  for (const event of manualEvents) {
    if (!event.chapter) continue;
    entries.push({
      id: `event-${event.id}`,
      source: "EVENT",
      title: event.title,
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      allDay: false,
      location: event.location,
      meetingUrl: event.meetingUrl,
      visibility: event.visibility,
      chapterName: event.chapter.name,
      chapterSlug: chapterSlugValue(event.chapter),
      eventTypeLabel: eventLabelForSource("EVENT", event.eventType),
      eventTypeColor: eventColorForType(event.eventType),
      isCancelled: event.isCancelled,
      link: `/my-chapter/calendar?eventId=${event.id}`,
      eventId: event.id,
      milestoneId: null,
      seriesId: event.seriesId,
      userRsvpStatus: Array.isArray(event.rsvps) && event.rsvps[0] ? event.rsvps[0].status : null,
      isSubscribed: subscribedChapterIds.includes(event.chapterId ?? ""),
    });
  }

  for (const milestone of milestones) {
    entries.push({
      id: `milestone-${milestone.id}`,
      source: "MILESTONE",
      title: milestone.title,
      description: milestone.description,
      startDate: milestone.dueDate.toISOString(),
      endDate: milestone.dueDate.toISOString(),
      allDay: true,
      location: null,
      meetingUrl: null,
      visibility: milestone.visibility,
      chapterName: milestone.chapter.name,
      chapterSlug: chapterSlugValue(milestone.chapter),
      eventTypeLabel: eventLabelForSource("MILESTONE"),
      eventTypeColor: eventColorForType("CHAPTER_MILESTONE"),
      isCancelled: false,
      link: null,
      eventId: null,
      milestoneId: milestone.id,
      seriesId: null,
      userRsvpStatus: null,
      isSubscribed: subscribedChapterIds.includes(milestone.chapterId),
    });
  }

  for (const session of sessions) {
    const chapter = session.offering.chapter;
    if (!chapter) continue;
    const sessionStart = new Date(session.date);
    const [startHour, startMinute] = session.startTime.split(":").map(Number);
    const [endHour, endMinute] = session.endTime.split(":").map(Number);
    sessionStart.setHours(startHour || 0, startMinute || 0, 0, 0);
    const sessionEnd = new Date(session.date);
    sessionEnd.setHours(endHour || 0, endMinute || 0, 0, 0);

    entries.push({
      id: `session-${session.id}`,
      source: "CLASS_SESSION",
      title: `${session.offering.title}: ${session.topic}`,
      description: session.description,
      startDate: sessionStart.toISOString(),
      endDate: sessionEnd.toISOString(),
      allDay: false,
      location: session.offering.locationName,
      meetingUrl: session.offering.zoomLink,
      visibility: "INTERNAL",
      chapterName: chapter.name,
      chapterSlug: chapterSlugValue(chapter),
      eventTypeLabel: eventLabelForSource("CLASS_SESSION"),
      eventTypeColor: eventColorForType("CLASS_SESSION"),
      isCancelled: session.isCancelled,
      link: `/curriculum/${session.offering.id}`,
      eventId: null,
      milestoneId: null,
      seriesId: null,
      userRsvpStatus: null,
      isSubscribed: subscribedChapterIds.includes(chapter.id),
    });
  }

  for (const task of launchTasks) {
    if (!task.chapter || !task.dueDate) continue;
    entries.push({
      id: `launch-${task.id}`,
      source: "LAUNCH_TASK",
      title: task.title,
      description: task.blocker || `Owner: ${task.ownerLabel}`,
      startDate: task.dueDate.toISOString(),
      endDate: task.dueDate.toISOString(),
      allDay: true,
      location: null,
      meetingUrl: null,
      visibility: "INTERNAL",
      chapterName: task.chapter.name,
      chapterSlug: chapterSlugValue(task.chapter),
      eventTypeLabel: eventLabelForSource("LAUNCH_TASK"),
      eventTypeColor: eventColorForType("LAUNCH_TASK"),
      isCancelled: task.status === "BLOCKED" && false,
      link: "/chapter-lead/portal-rollout",
      eventId: null,
      milestoneId: null,
      seriesId: null,
      userRsvpStatus: null,
      isSubscribed: subscribedChapterIds.includes(task.chapterId ?? ""),
    });
  }

  return entries.sort(
    (left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime()
  );
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcsText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function addIcsDateValue(lines: string[], startDate: Date, endDate: Date, allDay: boolean) {
  if (!allDay) {
    lines.push(`DTSTART:${formatIcsDate(startDate)}`);
    lines.push(`DTEND:${formatIcsDate(endDate)}`);
    return;
  }

  const startValue = startDate.toISOString().slice(0, 10).replace(/-/g, "");
  const endValue = addDays(endDate, 1).toISOString().slice(0, 10).replace(/-/g, "");
  lines.push(`DTSTART;VALUE=DATE:${startValue}`);
  lines.push(`DTEND;VALUE=DATE:${endValue}`);
}

export function buildChapterCalendarIcs(entries: ChapterCalendarEntry[], calendarName: string) {
  const body = entries
    .map((entry) => {
      const lines = [
        "BEGIN:VEVENT",
        `UID:${escapeIcsText(entry.id)}@youthpassionproject.org`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
      ];
      addIcsDateValue(
        lines,
        new Date(entry.startDate),
        new Date(entry.endDate),
        entry.allDay
      );
      lines.push(`SUMMARY:${escapeIcsText(entry.title)}`);
      if (entry.description) lines.push(`DESCRIPTION:${escapeIcsText(entry.description)}`);
      if (entry.location) lines.push(`LOCATION:${escapeIcsText(entry.location)}`);
      if (entry.meetingUrl) lines.push(`URL:${escapeIcsText(entry.meetingUrl)}`);
      lines.push(`CATEGORIES:${escapeIcsText(entry.eventTypeLabel)}`);
      if (entry.isCancelled) lines.push("STATUS:CANCELLED");
      lines.push("END:VEVENT");
      return lines.join("\r\n");
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YPP Portal//Chapter Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    body,
    "END:VCALENDAR",
  ].join("\r\n");
}

export async function buildChapterPublicProfile(slug: string) {
  const chapter = await getChapterByPublicSlug(slug);
  if (!chapter) return null;

  const [memberCount, activePrograms, publicEvents, chapterPresident] = await Promise.all([
    prisma.user.count({ where: { chapterId: chapter.id } }),
    prisma.classOffering.findMany({
      where: {
        chapterId: chapter.id,
        status: { in: ["PUBLISHED", "IN_PROGRESS", "COMPLETED"] },
      },
      orderBy: { startDate: "asc" },
      take: 6,
      select: {
        id: true,
        title: true,
        deliveryMode: true,
        semester: true,
        startDate: true,
        endDate: true,
      },
    }),
    getChapterCalendarEntries({
      chapterId: chapter.id,
      start: new Date(),
      end: addDays(new Date(), 120),
      includeInternal: false,
      subscribedChapterIds: [],
    }),
    prisma.user.findFirst({
      where: {
        chapterId: chapter.id,
        roles: { some: { role: "CHAPTER_LEAD" } },
      },
      select: { name: true, email: true },
    }),
  ]);

  return {
    chapter,
    memberCount,
    activePrograms,
    publicEvents,
    chapterPresident,
  };
}
