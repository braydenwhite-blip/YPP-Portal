"use server";

import {
  EventRecurrenceFrequency,
  EventScope,
  EventType,
  EventVisibility,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  createManualEvent,
  createRecurringEventSeries,
  notifyChapterSubscribers,
  notifyRsvpUsersAboutEventChange,
  scheduleEventReminders,
  slugifyChapterName,
  syncEventSeriesOccurrences,
} from "@/lib/chapter-calendar";
import {
  requireChapterCalendarManager,
  requireChapterCalendarViewer,
} from "@/lib/chapter-calendar-auth";

function getString(formData: FormData, key: string, required = true) {
  const raw = formData.get(key);
  if (required && (!raw || String(raw).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return raw ? String(raw).trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  return getString(formData, key, false) || null;
}

function getDate(formData: FormData, key: string): Date;
function getDate(formData: FormData, key: string, required: true): Date;
function getDate(formData: FormData, key: string, required: false): Date | null;
function getDate(formData: FormData, key: string, required = true) {
  const value = getString(formData, key, required);
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${key}`);
  }
  return parsed;
}

function getBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

function parseEventType(value: string) {
  if (!Object.values(EventType).includes(value as EventType)) {
    throw new Error("Invalid event type");
  }
  return value as EventType;
}

function parseVisibility(value: string | null) {
  if (!value) return EventVisibility.INTERNAL;
  if (!Object.values(EventVisibility).includes(value as EventVisibility)) {
    throw new Error("Invalid visibility");
  }
  return value as EventVisibility;
}

function parseScope(value: string | null, chapterId: string | null) {
  if (!value) return chapterId ? EventScope.CHAPTER : EventScope.GLOBAL;
  if (!Object.values(EventScope).includes(value as EventScope)) {
    throw new Error("Invalid event scope");
  }
  return value as EventScope;
}

function parseRecurrenceFrequency(value: string | null) {
  if (!value || value === "NONE") return null;
  if (!Object.values(EventRecurrenceFrequency).includes(value as EventRecurrenceFrequency)) {
    throw new Error("Invalid recurrence frequency");
  }
  return value as EventRecurrenceFrequency;
}

function parseRecurrenceDays(formData: FormData) {
  return formData
    .getAll("recurrenceDays")
    .map((value) => String(value).trim().toUpperCase())
    .filter(Boolean);
}

function formatDateLabel(date: Date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function revalidateChapterSurfaces(chapterSlug?: string | null) {
  revalidatePath("/chapter/calendar");
  revalidatePath("/my-chapter/calendar");
  revalidatePath("/calendar");
  revalidatePath("/events");
  revalidatePath("/chapter");
  revalidatePath("/my-chapter");
  revalidatePath("/chapters");
  revalidatePath("/chapter/president");
  revalidatePath("/admin/events");
  if (chapterSlug) {
    revalidatePath(`/chapters/${chapterSlug}`);
  }
}

async function ensureUniqueSlug(baseSlug: string, chapterId?: string) {
  const cleaned = slugifyChapterName(baseSlug);
  let candidate = cleaned || "chapter";
  let suffix = 2;

  while (true) {
    const existing = await prisma.chapter.findFirst({
      where: {
        slug: candidate,
        ...(chapterId ? { id: { not: chapterId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return candidate;
    candidate = `${cleaned || "chapter"}-${suffix}`;
    suffix += 1;
  }
}

async function verifyManagedEvent(eventId: string, chapterId: string, isAdmin: boolean) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      chapter: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  if (!isAdmin && event.chapterId !== chapterId) {
    throw new Error("You can only manage events in your own chapter.");
  }

  return event;
}

async function verifyManagedSeries(seriesId: string, chapterId: string, isAdmin: boolean) {
  const series = await prisma.eventSeries.findUnique({
    where: { id: seriesId },
    include: {
      chapter: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!series) {
    throw new Error("Series not found");
  }

  if (!isAdmin && series.chapterId !== chapterId) {
    throw new Error("You can only manage event series in your own chapter.");
  }

  return series;
}

async function notifyChapterEventCreated(params: {
  chapterId: string;
  chapterName: string;
  title: string;
  eventType: string;
  startDate: Date;
  link?: string | null;
}) {
  await notifyChapterSubscribers({
    chapterId: params.chapterId,
    title: `New chapter event: ${params.title}`,
    body: `${params.chapterName} added a ${params.eventType.toLowerCase().replace(/_/g, " ")} for ${formatDateLabel(params.startDate)}.`,
    link: params.link || "/my-chapter/calendar",
  });
}

async function notifyChapterEventUpdated(params: {
  chapterId: string;
  chapterName: string;
  title: string;
  startDate: Date;
  eventId?: string | null;
  link?: string | null;
}) {
  await notifyChapterSubscribers({
    chapterId: params.chapterId,
    title: `Chapter event updated: ${params.title}`,
    body: `${params.chapterName} updated an event scheduled for ${formatDateLabel(params.startDate)}.`,
    link: params.link || "/my-chapter/calendar",
  });

  if (params.eventId) {
    await notifyRsvpUsersAboutEventChange({
      eventId: params.eventId,
      title: `Event change: ${params.title}`,
      body: `${params.title} was updated. Review the latest chapter calendar details before it begins.`,
      link: params.link || "/my-chapter/calendar",
    });
  }
}

export async function saveChapterEventAction(formData: FormData) {
  const chapterIdInput = getString(formData, "chapterId", false) || null;
  const manager = await requireChapterCalendarManager(chapterIdInput);
  const eventId = getString(formData, "eventId", false) || null;
  const seriesId = getString(formData, "seriesId", false) || null;
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const eventType = parseEventType(getString(formData, "eventType"));
  const startDate = getDate(formData, "startDate");
  const endDate = getDate(formData, "endDate");
  const visibility = parseVisibility(getString(formData, "visibility", false) || null);
  const scope = parseScope(getString(formData, "scope", false) || null, manager.chapterId);
  const location = getOptionalString(formData, "location");
  const meetingUrl = getOptionalString(formData, "meetingUrl");
  const reminder24Hr = getBoolean(formData, "reminder24Hr");
  const reminder1Hr = getBoolean(formData, "reminder1Hr");
  const isAlumniOnly = getBoolean(formData, "isAlumniOnly");
  const recurrenceFrequency = parseRecurrenceFrequency(getString(formData, "recurrenceFrequency", false) || null);
  const recurrenceInterval = Number(getString(formData, "recurrenceInterval", false) || "1");
  const recurrenceUntil = getDate(formData, "recurrenceUntil", false);
  const recurrenceCountRaw = getString(formData, "recurrenceCount", false);
  const recurrenceCount = recurrenceCountRaw ? Number(recurrenceCountRaw) : null;
  const recurrenceDays = parseRecurrenceDays(formData);
  const chapter = await prisma.chapter.findUnique({
    where: { id: manager.chapterId },
    select: { id: true, name: true, slug: true },
  });

  if (!chapter) {
    throw new Error("Chapter not found");
  }

  if (seriesId) {
    const series = await verifyManagedSeries(seriesId, manager.chapterId, manager.isAdmin);
    await prisma.eventSeries.update({
      where: { id: seriesId },
      data: {
        title,
        description,
        eventType,
        visibility,
        scope,
        chapterId: manager.chapterId,
        startDate,
        endDate,
        location,
        meetingUrl,
        recurrenceFrequency: recurrenceFrequency ?? series.recurrenceFrequency,
        recurrenceInterval: Number.isFinite(recurrenceInterval) && recurrenceInterval > 0 ? recurrenceInterval : 1,
        recurrenceUntil: recurrenceUntil ?? null,
        recurrenceCount,
        recurrenceDays,
        reminder24Hr,
        reminder1Hr,
        updatedById: manager.user.id,
      },
    });

    await syncEventSeriesOccurrences(seriesId);

    const futureEvents = await prisma.event.findMany({
      where: {
        seriesId,
        startDate: { gte: new Date() },
      },
      orderBy: { startDate: "asc" },
      take: 20,
      select: { id: true },
    });

    for (const futureEvent of futureEvents) {
      await scheduleEventReminders(futureEvent.id);
    }

    await notifyChapterEventUpdated({
      chapterId: manager.chapterId,
      chapterName: chapter.name,
      title,
      startDate,
      link: "/chapter/calendar",
    });

    revalidateChapterSurfaces(series.chapter ? (series.chapter.slug || null) : null);
    return;
  }

  if (eventId) {
    const existing = await verifyManagedEvent(eventId, manager.chapterId, manager.isAdmin);
    await prisma.event.update({
      where: { id: eventId },
      data: {
        title,
        description,
        eventType,
        visibility,
        scope,
        chapterId: manager.chapterId,
        startDate,
        endDate,
        location,
        meetingUrl,
        isAlumniOnly,
        reminder24Hr,
        reminder1Hr,
        isException: existing.seriesId ? true : existing.isException,
        updatedById: manager.user.id,
      },
    });

    await scheduleEventReminders(eventId);
    await notifyChapterEventUpdated({
      chapterId: manager.chapterId,
      chapterName: chapter.name,
      title,
      startDate,
      eventId,
      link: `/my-chapter/calendar?eventId=${eventId}`,
    });

    revalidateChapterSurfaces(existing.chapter ? (existing.chapter.slug || null) : null);
    return;
  }

  if (recurrenceFrequency) {
    await createRecurringEventSeries({
      title,
      description,
      eventType,
      scope,
      visibility,
      chapterId: manager.chapterId,
      startDate,
      endDate,
      location,
      meetingUrl,
      isAlumniOnly,
      createdById: manager.user.id,
      updatedById: manager.user.id,
      recurrenceFrequency,
      recurrenceInterval: Number.isFinite(recurrenceInterval) && recurrenceInterval > 0 ? recurrenceInterval : 1,
      recurrenceDays,
      recurrenceCount,
      recurrenceUntil,
      reminder24Hr,
      reminder1Hr,
    });

    await notifyChapterEventCreated({
      chapterId: manager.chapterId,
      chapterName: chapter.name,
      title,
      eventType,
      startDate,
      link: "/chapter/calendar",
    });

    revalidateChapterSurfaces(chapter.slug || null);
    return;
  }

  const event = await createManualEvent({
    title,
    description,
    eventType,
    scope,
    visibility,
    chapterId: manager.chapterId,
    startDate,
    endDate,
    location,
    meetingUrl,
    isAlumniOnly,
    createdById: manager.user.id,
    updatedById: manager.user.id,
    reminder24Hr,
    reminder1Hr,
  });

  await scheduleEventReminders(event.id);
  await notifyChapterEventCreated({
    chapterId: manager.chapterId,
    chapterName: chapter.name,
    title,
    eventType,
    startDate,
    link: `/my-chapter/calendar?eventId=${event.id}`,
  });

  revalidateChapterSurfaces(chapter.slug || null);
}

export async function cancelChapterEventAction(formData: FormData) {
  const manager = await requireChapterCalendarManager(getString(formData, "chapterId", false) || null);
  const eventId = getString(formData, "eventId");
  const reason = getString(formData, "cancellationReason", false) || "Cancelled by the chapter team.";
  const event = await verifyManagedEvent(eventId, manager.chapterId, manager.isAdmin);

  await prisma.event.update({
    where: { id: eventId },
    data: {
      isCancelled: true,
      cancellationReason: reason,
      updatedById: manager.user.id,
    },
  });

  await notifyChapterEventUpdated({
    chapterId: manager.chapterId,
    chapterName: event.chapter?.name || "This chapter",
    title: event.title,
    startDate: event.startDate,
    eventId,
    link: `/my-chapter/calendar?eventId=${eventId}`,
  });

  revalidateChapterSurfaces(event.chapter?.slug || null);
}

export async function saveChapterMilestoneAction(formData: FormData) {
  const manager = await requireChapterCalendarManager(getString(formData, "chapterId", false) || null);
  const milestoneId = getString(formData, "milestoneId", false) || null;
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const dueDate = getDate(formData, "dueDate");
  const visibility = parseVisibility(getString(formData, "visibility", false) || null);
  const chapter = await prisma.chapter.findUnique({
    where: { id: manager.chapterId },
    select: { slug: true },
  });

  if (milestoneId) {
    const milestone = await prisma.chapterMilestone.findUnique({
      where: { id: milestoneId },
      select: { chapterId: true },
    });

    if (!milestone || (!manager.isAdmin && milestone.chapterId !== manager.chapterId)) {
      throw new Error("Milestone not found");
    }

    await prisma.chapterMilestone.update({
      where: { id: milestoneId },
      data: {
        title,
        description,
        dueDate,
        visibility,
        updatedById: manager.user.id,
      },
    });
  } else {
    await prisma.chapterMilestone.create({
      data: {
        chapterId: manager.chapterId,
        title,
        description,
        dueDate,
        visibility,
        createdById: manager.user.id,
        updatedById: manager.user.id,
      },
    });
  }

  revalidateChapterSurfaces(chapter?.slug || null);
}

export async function archiveChapterMilestoneAction(formData: FormData) {
  const manager = await requireChapterCalendarManager(getString(formData, "chapterId", false) || null);
  const milestoneId = getString(formData, "milestoneId");
  const milestone = await prisma.chapterMilestone.findUnique({
    where: { id: milestoneId },
    select: { chapterId: true, chapter: { select: { slug: true } } },
  });

  if (!milestone || (!manager.isAdmin && milestone.chapterId !== manager.chapterId)) {
    throw new Error("Milestone not found");
  }

  await prisma.chapterMilestone.update({
    where: { id: milestoneId },
    data: {
      isArchived: true,
      updatedById: manager.user.id,
    },
  });

  revalidateChapterSurfaces(milestone.chapter?.slug || null);
}

export async function toggleChapterCalendarSubscriptionAction(formData: FormData) {
  const viewer = await requireChapterCalendarViewer();
  const chapterId = getString(formData, "chapterId");
  const existing = await prisma.chapterCalendarSubscription.findUnique({
    where: {
      chapterId_userId: {
        chapterId,
        userId: viewer.user.id,
      },
    },
  });

  if (existing) {
    await prisma.chapterCalendarSubscription.delete({
      where: { id: existing.id },
    });
  } else {
    await prisma.chapterCalendarSubscription.create({
      data: {
        chapterId,
        userId: viewer.user.id,
      },
    });
  }

  revalidatePath("/my-chapter/calendar");
}

export async function rotateChapterCalendarFeedTokenAction(formData: FormData) {
  const viewer = await requireChapterCalendarViewer();
  const chapterId = getString(formData, "chapterId");
  const subscription = await prisma.chapterCalendarSubscription.findUnique({
    where: {
      chapterId_userId: {
        chapterId,
        userId: viewer.user.id,
      },
    },
  });

  if (!subscription) {
    throw new Error("Subscribe to the chapter calendar first.");
  }

  await prisma.chapterCalendarSubscription.update({
    where: { id: subscription.id },
    data: {
      feedToken: crypto.randomUUID().replace(/-/g, ""),
    },
  });

  revalidatePath("/my-chapter/calendar");
}

export async function updateChapterProfileAction(formData: FormData) {
  const manager = await requireChapterCalendarManager(getString(formData, "chapterId", false) || null);
  const chapter = await prisma.chapter.findUnique({
    where: { id: manager.chapterId },
    select: { id: true, name: true },
  });

  if (!chapter) {
    throw new Error("Chapter not found");
  }

  const requestedSlug = getString(formData, "slug", false);
  const slug = await ensureUniqueSlug(requestedSlug || chapter.name, chapter.id);

  await prisma.chapter.update({
    where: { id: chapter.id },
    data: {
      slug,
      publicProfileEnabled: getBoolean(formData, "publicProfileEnabled"),
      publicSummary: getOptionalString(formData, "publicSummary"),
      publicStory: getOptionalString(formData, "publicStory"),
      publicContactEmail: getOptionalString(formData, "publicContactEmail"),
      publicContactUrl: getOptionalString(formData, "publicContactUrl"),
      calendarDescription: getOptionalString(formData, "calendarDescription"),
      calendarThemeColor: getOptionalString(formData, "calendarThemeColor"),
    },
  });

  revalidateChapterSurfaces(slug);
}
