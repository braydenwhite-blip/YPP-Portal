"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { RsvpStatus } from "@prisma/client";

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

// ============================================
// EVENT RSVP
// ============================================

export async function rsvpToEvent(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const eventId = getString(formData, "eventId");
  const status = getString(formData, "status") as RsvpStatus;

  await prisma.eventRsvp.upsert({
    where: {
      eventId_userId: { eventId, userId }
    },
    create: {
      eventId,
      userId,
      status
    },
    update: {
      status
    }
  });

  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
}

export async function cancelRsvp(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const eventId = getString(formData, "eventId");

  await prisma.eventRsvp.delete({
    where: {
      eventId_userId: { eventId, userId }
    }
  });

  revalidatePath("/events");
}

// ============================================
// ICAL GENERATION
// ============================================

export async function generateICalForEvent(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { chapter: true }
  });

  if (!event) {
    throw new Error("Event not found");
  }

  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const escapeText = (text: string) => {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  };

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YPP Portal//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.calendarUid}@youthpassionproject.org`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(event.startDate)}`,
    `DTEND:${formatDate(event.endDate)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    event.location ? `LOCATION:${escapeText(event.location)}` : null,
    event.meetingUrl ? `URL:${event.meetingUrl}` : null,
    event.chapter ? `CATEGORIES:${event.chapter.name}` : null,
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");

  return ical;
}

export async function generateICalForAllEvents(userId?: string): Promise<string> {
  const session = await getServerSession(authOptions);

  // Get user's RSVPs if logged in
  const rsvpEventIds = userId || session?.user?.id
    ? await prisma.eventRsvp.findMany({
        where: {
          userId: userId || session?.user?.id,
          status: "GOING"
        },
        select: { eventId: true }
      }).then(rsvps => rsvps.map(r => r.eventId))
    : [];

  const events = await prisma.event.findMany({
    where: rsvpEventIds.length > 0
      ? { id: { in: rsvpEventIds } }
      : { startDate: { gte: new Date() } },
    include: { chapter: true },
    orderBy: { startDate: "asc" },
    take: 50
  });

  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const escapeText = (text: string) => {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  };

  const vevents = events.map(event => [
    "BEGIN:VEVENT",
    `UID:${event.calendarUid}@youthpassionproject.org`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(event.startDate)}`,
    `DTEND:${formatDate(event.endDate)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    event.location ? `LOCATION:${escapeText(event.location)}` : null,
    event.meetingUrl ? `URL:${event.meetingUrl}` : null,
    "END:VEVENT"
  ].filter(Boolean).join("\r\n")).join("\r\n");

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YPP Portal//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:YPP Events",
    vevents,
    "END:VCALENDAR"
  ].join("\r\n");

  return ical;
}

// ============================================
// GOOGLE CALENDAR URL GENERATION
// ============================================

export async function getGoogleCalendarUrl(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!event) {
    throw new Error("Event not found");
  }

  const formatGoogleDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatGoogleDate(event.startDate)}/${formatGoogleDate(event.endDate)}`,
    details: event.description,
    ...(event.location && { location: event.location }),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
