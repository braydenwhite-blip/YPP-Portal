"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import {
  generateInterviewSlots,
  rangesOverlap,
  type BusyInterval,
} from "@/lib/interview-scheduling-shared";
import {
  generateIcsContent,
  sendInterviewAutoAssignedEmail,
  sendNoMatchFoundEmail,
} from "@/lib/email";

// ---- Types ----

export type AvailabilityWindow = {
  dayOfWeek: number;   // 0=Sun … 6=Sat
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  timezone: string;    // IANA
};

// ---- Timezone conversion helper ----

/**
 * Given a date (used for its calendar day in UTC), a wall-clock time string
 * "HH:MM", and an IANA timezone, return the equivalent UTC Date.
 *
 * We use the Intl API to find what UTC time corresponds to midnight on that
 * calendar day in the given timezone, then add the HH:MM offset.
 */
function wallTimeToUtc(onDateUtc: Date, timeStr: string, tz: string): Date {
  const [hStr, mStr] = timeStr.split(":");
  const hours = Number(hStr);
  const minutes = Number(mStr);

  // Get the calendar date in UTC
  const year = onDateUtc.getUTCFullYear();
  const month = onDateUtc.getUTCMonth() + 1;
  const day = onDateUtc.getUTCDate();

  // Build an ISO string representing that wall-clock time in the given timezone,
  // then use Intl to resolve its UTC equivalent.
  // Strategy: find the UTC offset for that timezone on that date.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Find UTC offset by comparing a known UTC time to what it looks like in `tz`.
  // We probe midnight UTC on the target day, parse what the tz clock shows,
  // and compute the difference.
  const midnightUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const parts = fmt.formatToParts(new Date(midnightUtc));
  const p: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  // p.hour can be 24 (midnight next day) — normalize
  const tzHour = p.hour === 24 ? 0 : p.hour;
  const tzMinuteOffset = p.minute ?? 0;

  // UTC offset in minutes: when midnight UTC → tzHour:tzMinute in the timezone
  // tzLocalTime = UTC + offset  →  offset = tzHour * 60 + tzMinuteOffset
  const offsetMinutes = tzHour * 60 + tzMinuteOffset;

  // The wall-clock time we want in UTC:
  //   wallUtcMs = midnightUtc + wallMinutes - offsetMinutes * 60_000
  const wallMinutes = hours * 60 + minutes;
  return new Date(midnightUtc + (wallMinutes - offsetMinutes) * 60_000);
}

// ---- Day-of-week from UTC Date ----
function utcDayOfWeek(d: Date): number {
  return d.getUTCDay(); // 0=Sun
}

// ---- Core auto-assign engine ----

async function autoAssignSession(
  applicationId: string,
  kind: "cp" | "instructor"
): Promise<{ matched: boolean }> {
  const baseUrl = process.env.NEXTAUTH_URL || "https://portal.youthpassionproject.org";

  // 1. Fetch application with reviewer + windows
  let reviewerId: string | null = null;
  let applicantEmail: string | null = null;
  let applicantName = "Applicant";
  let reviewerEmail: string | null = null;
  let reviewerName = "Reviewer";
  let availabilityWindows: AvailabilityWindow[] = [];
  let interviewDuration = 30;

  if (kind === "cp") {
    const app = await prisma.chapterPresidentApplication.findUnique({
      where: { id: applicationId },
      include: {
        applicant: { select: { name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        availabilityWindows: true,
      },
    });
    if (!app) return { matched: false };
    reviewerId = app.reviewerId ?? null;
    applicantEmail = app.applicant.email;
    applicantName = app.applicant.name;
    reviewerEmail = app.reviewer?.email ?? null;
    reviewerName = app.reviewer?.name ?? "Reviewer";
    availabilityWindows = app.availabilityWindows;
  } else {
    const app = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      include: {
        applicant: { select: { name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        availabilityWindows: true,
      },
    });
    if (!app) return { matched: false };
    reviewerId = app.reviewerId ?? null;
    applicantEmail = app.applicant.email;
    applicantName = app.applicant.name;
    reviewerEmail = app.reviewer?.email ?? null;
    reviewerName = app.reviewer?.name ?? "Reviewer";
    availabilityWindows = app.availabilityWindows;
  }

  // 2. No reviewer → can't match
  if (!reviewerId) {
    await markNoMatch(applicationId, kind);
    if (applicantEmail) {
      const adminUrl = kind === "cp"
        ? `${baseUrl}/admin/chapter-president-applicants`
        : `${baseUrl}/admin/instructor-applicants`;
      await sendNoMatchFoundEmail({
        to: await getAdminEmails(),
        applicantName,
        adminUrl,
        variant: kind,
      }).catch(console.error);
    }
    return { matched: false };
  }

  // 3. Fetch reviewer availability rules + overrides
  const [rules, overrides] = await Promise.all([
    prisma.interviewAvailabilityRule.findMany({
      where: { interviewerId: reviewerId, isActive: true },
    }),
    prisma.interviewAvailabilityOverride.findMany({
      where: { interviewerId: reviewerId, isActive: true },
    }),
  ]);

  // 4. Fetch busy intervals for the reviewer
  const busyRequests = await prisma.interviewSchedulingRequest.findMany({
    where: {
      interviewerId: reviewerId,
      domain: "HIRING",
      status: { in: ["BOOKED", "REQUESTED", "RESCHEDULE_REQUESTED"] },
      scheduledAt: { not: null },
    },
    select: { scheduledAt: true, duration: true },
  });

  // Also count already-confirmed CP/instructor interviews so we don't double-book
  const [cpBooked, instrBooked] = await Promise.all([
    prisma.chapterPresidentApplication.findMany({
      where: {
        reviewerId,
        interviewScheduledAt: { not: null },
        status: { in: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"] },
        id: { not: applicationId },
      },
      select: { interviewScheduledAt: true },
    }),
    prisma.instructorApplication.findMany({
      where: {
        reviewerId,
        interviewScheduledAt: { not: null },
        status: { in: ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"] },
        id: { not: applicationId },
      },
      select: { interviewScheduledAt: true },
    }),
  ]);

  const busyIntervals: BusyInterval[] = [
    ...busyRequests.map((r) => ({
      startsAt: r.scheduledAt!,
      endsAt: new Date(r.scheduledAt!.getTime() + (r.duration ?? 30) * 60_000),
    })),
    ...cpBooked.map((a) => ({
      startsAt: a.interviewScheduledAt!,
      endsAt: new Date(a.interviewScheduledAt!.getTime() + interviewDuration * 60_000),
    })),
    ...instrBooked.map((a) => ({
      startsAt: a.interviewScheduledAt!,
      endsAt: new Date(a.interviewScheduledAt!.getTime() + interviewDuration * 60_000),
    })),
  ];

  // 5. Generate candidate slots
  const slots = generateInterviewSlots({
    interviewerId: reviewerId,
    domain: "HIRING",
    rules,
    overrides,
    busyIntervals,
    rangeStart: new Date(),
    days: 28,
  });

  // 6. Find first slot overlapping any applicant window
  let matchedSlot: (typeof slots)[0] | null = null;

  outer: for (const slot of slots) {
    const slotDow = utcDayOfWeek(slot.startsAt);
    for (const win of availabilityWindows) {
      if (win.dayOfWeek !== slotDow) continue;
      try {
        const winStart = wallTimeToUtc(slot.startsAt, win.startTime, win.timezone);
        const winEnd = wallTimeToUtc(slot.startsAt, win.endTime, win.timezone);
        if (rangesOverlap(slot.startsAt, slot.endsAt, winStart, winEnd)) {
          matchedSlot = slot;
          break outer;
        }
      } catch {
        // Invalid timezone — skip this window
        continue;
      }
    }
  }

  // 7a. Match found
  if (matchedSlot) {
    if (kind === "cp") {
      await prisma.chapterPresidentApplication.update({
        where: { id: applicationId },
        data: { interviewScheduledAt: matchedSlot.startsAt, schedulingNoMatchAt: null },
      });
    } else {
      await prisma.instructorApplication.update({
        where: { id: applicationId },
        data: { interviewScheduledAt: matchedSlot.startsAt, schedulingNoMatchAt: null },
      });
    }

    const uid = `${applicationId}-${matchedSlot.startsAt.getTime()}`;
    const sessionTitle = kind === "cp"
      ? `YPP Interview — ${applicantName}`
      : `YPP Curriculum Review — ${applicantName}`;
    const sessionDesc = kind === "cp"
      ? `YPP Chapter President interview with ${applicantName}.${matchedSlot.meetingLink ? " Meeting link: " + matchedSlot.meetingLink : ""}`
      : `YPP Instructor curriculum review session with ${applicantName}.${matchedSlot.meetingLink ? " Meeting link: " + matchedSlot.meetingLink : ""}`;
    const endsAt = matchedSlot.endsAt;

    const icsContent = generateIcsContent({
      uid,
      title: sessionTitle,
      description: sessionDesc,
      startsAt: matchedSlot.startsAt,
      endsAt,
      meetingLink: matchedSlot.meetingLink,
      organizerEmail: reviewerEmail ?? undefined,
      attendeeEmail: applicantEmail ?? undefined,
    });

    // Send to applicant
    if (applicantEmail) {
      await sendInterviewAutoAssignedEmail({
        to: applicantEmail,
        recipientName: applicantName,
        applicantName,
        scheduledAt: matchedSlot.startsAt,
        meetingLink: matchedSlot.meetingLink,
        icsContent,
        variant: kind,
        role: "applicant",
      }).catch(console.error);
    }

    // Send to reviewer/interviewer
    if (reviewerEmail) {
      await sendInterviewAutoAssignedEmail({
        to: reviewerEmail,
        recipientName: reviewerName,
        applicantName,
        scheduledAt: matchedSlot.startsAt,
        meetingLink: matchedSlot.meetingLink,
        icsContent,
        variant: kind,
        role: "interviewer",
      }).catch(console.error);
    }

    revalidatePath("/application-status");
    return { matched: true };
  }

  // 7b. No match
  await markNoMatch(applicationId, kind);
  const adminUrl = kind === "cp"
    ? `${baseUrl}/admin/chapter-president-applicants`
    : `${baseUrl}/admin/instructor-applicants`;
  await sendNoMatchFoundEmail({
    to: await getAdminEmails(),
    applicantName,
    adminUrl,
    variant: kind,
  }).catch(console.error);

  revalidatePath("/application-status");
  return { matched: false };
}

async function markNoMatch(applicationId: string, kind: "cp" | "instructor") {
  const now = new Date();
  if (kind === "cp") {
    await prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: { schedulingNoMatchAt: now },
    });
  } else {
    await prisma.instructorApplication.update({
      where: { id: applicationId },
      data: { schedulingNoMatchAt: now },
    });
  }
}

async function getAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { roles: { some: { role: "ADMIN" } } },
    select: { email: true },
  });
  return admins.map((a) => a.email).filter(Boolean) as string[];
}

// ---- Public server actions ----

export async function submitCPAvailability(
  applicationId: string,
  windows: AvailabilityWindow[]
): Promise<{ success: boolean; matched?: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // Verify this application belongs to the current user
    const app = await prisma.chapterPresidentApplication.findUnique({
      where: { id: applicationId },
      select: { applicantId: true, status: true },
    });
    if (!app || app.applicantId !== session.user.id) {
      return { success: false, error: "Application not found." };
    }
    if (app.status !== "INTERVIEW_SCHEDULED") {
      return { success: false, error: "This application is not awaiting scheduling." };
    }

    // Validate windows
    if (!windows.length || windows.length > 5) {
      return { success: false, error: "Please provide 1–5 availability windows." };
    }

    // Replace existing windows for this application
    await prisma.applicantAvailabilityWindow.deleteMany({
      where: { chapterPresidentApplicationId: applicationId },
    });
    await prisma.applicantAvailabilityWindow.createMany({
      data: windows.map((w) => ({
        chapterPresidentApplicationId: applicationId,
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime,
        timezone: w.timezone,
      })),
    });

    const result = await autoAssignSession(applicationId, "cp");
    return { success: true, matched: result.matched };
  } catch (error) {
    console.error("[submitCPAvailability]", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

export async function submitInstructorAvailability(
  applicationId: string,
  windows: AvailabilityWindow[]
): Promise<{ success: boolean; matched?: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const app = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: { applicantId: true, status: true },
    });
    if (!app || app.applicantId !== session.user.id) {
      return { success: false, error: "Application not found." };
    }
    if (app.status !== "INTERVIEW_SCHEDULED") {
      return { success: false, error: "This application is not awaiting scheduling." };
    }

    if (!windows.length || windows.length > 5) {
      return { success: false, error: "Please provide 1–5 availability windows." };
    }

    await prisma.applicantAvailabilityWindow.deleteMany({
      where: { instructorApplicationId: applicationId },
    });
    await prisma.applicantAvailabilityWindow.createMany({
      data: windows.map((w) => ({
        instructorApplicationId: applicationId,
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime,
        timezone: w.timezone,
      })),
    });

    const result = await autoAssignSession(applicationId, "instructor");
    return { success: true, matched: result.matched };
  } catch (error) {
    console.error("[submitInstructorAvailability]", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
