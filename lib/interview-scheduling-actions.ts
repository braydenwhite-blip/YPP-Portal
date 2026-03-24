"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { createSystemNotification } from "@/lib/notification-actions";

// ============================================
// AUTH HELPERS
// ============================================

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session as typeof session & { user: { id: string; roles?: string[] } };
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) throw new Error(`Missing: ${key}`);
  return value ? String(value).trim() : "";
}

function getNumber(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key);
  if (!raw || String(raw).trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ============================================
// TYPES
// ============================================

export interface InterviewSlotData {
  id: string;
  scheduledAt: string;
  duration: number;
  status: string;
  meetingLink: string | null;
  notes: string | null;
  source: string;
  confirmedAt: string | null;
  completedAt: string | null;
  createdBy: string;
}

export interface AvailabilityRequestData {
  id: string;
  preferredSlots: Array<{ start: string; end?: string }>;
  note: string | null;
  status: string;
  instructorName: string;
  instructorId: string;
  reviewNotes: string | null;
  createdAt: string;
}

export interface InterviewScheduleItem {
  id: string;
  type: "HIRING" | "READINESS";
  // Common fields
  personName: string;
  personEmail: string;
  chapterName: string;
  gateStatus: string;
  outcome: string | null;
  slots: InterviewSlotData[];
  // Readiness-specific
  gateId?: string;
  instructorId?: string;
  pendingRequests: AvailabilityRequestData[];
  // Hiring-specific
  applicationId?: string;
  positionTitle?: string;
}

export interface InterviewSchedulePageData {
  items: InterviewScheduleItem[];
  viewer: {
    userId: string;
    roles: string[];
    isAdmin: boolean;
    isReviewer: boolean;
    isInstructor: boolean;
  };
}

// ============================================
// FETCH: INTERVIEW SCHEDULE DATA
// ============================================

export async function getInterviewScheduleData(): Promise<InterviewSchedulePageData> {
  const session = await requireSession();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");
  const isInstructor = roles.includes("INSTRUCTOR");
  const isReviewer = isAdmin || isChapterLead;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, chapterId: true },
  });

  const items: InterviewScheduleItem[] = [];

  // ---- READINESS INTERVIEWS ----
  if (isReviewer) {
    // Reviewers see all gates (admin) or their chapter's gates
    const gates = await prisma.instructorInterviewGate.findMany({
      where: isAdmin
        ? { status: { notIn: ["PASSED", "WAIVED"] } }
        : {
            status: { notIn: ["PASSED", "WAIVED"] },
            instructor: { chapterId: user?.chapterId ?? "__no_chapter__" },
          },
      include: {
        instructor: {
          select: { id: true, name: true, email: true, chapter: { select: { name: true } } },
        },
        slots: { orderBy: { scheduledAt: "asc" } },
        availabilityRequests: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          include: {
            instructor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    for (const gate of gates) {
      items.push({
        id: gate.id,
        type: "READINESS",
        personName: gate.instructor.name ?? "Instructor",
        personEmail: gate.instructor.email ?? "",
        chapterName: gate.instructor.chapter?.name ?? "No chapter",
        gateStatus: gate.status,
        outcome: gate.outcome,
        gateId: gate.id,
        instructorId: gate.instructorId,
        slots: gate.slots.map((s) => ({
          id: s.id,
          scheduledAt: s.scheduledAt.toISOString(),
          duration: s.duration,
          status: s.status,
          meetingLink: s.meetingLink,
          notes: s.notes,
          source: s.source,
          confirmedAt: s.confirmedAt?.toISOString() ?? null,
          completedAt: s.completedAt?.toISOString() ?? null,
          createdBy: s.createdById,
        })),
        pendingRequests: gate.availabilityRequests.map((r) => ({
          id: r.id,
          preferredSlots: r.preferredSlots as Array<{ start: string; end?: string }>,
          note: r.note,
          status: r.status,
          instructorName: r.instructor.name ?? "Instructor",
          instructorId: r.instructorId,
          reviewNotes: r.reviewNotes,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }
  } else if (isInstructor) {
    // Instructor sees own gate
    const gate = await prisma.instructorInterviewGate.findUnique({
      where: { instructorId: userId },
      include: {
        instructor: {
          select: { id: true, name: true, email: true, chapter: { select: { name: true } } },
        },
        slots: { orderBy: { scheduledAt: "asc" } },
        availabilityRequests: {
          where: { instructorId: userId },
          orderBy: { createdAt: "desc" },
          include: {
            instructor: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (gate && gate.status !== "PASSED" && gate.status !== "WAIVED") {
      items.push({
        id: gate.id,
        type: "READINESS",
        personName: gate.instructor.name ?? "You",
        personEmail: gate.instructor.email ?? "",
        chapterName: gate.instructor.chapter?.name ?? "No chapter",
        gateStatus: gate.status,
        outcome: gate.outcome,
        gateId: gate.id,
        instructorId: gate.instructorId,
        slots: gate.slots.map((s) => ({
          id: s.id,
          scheduledAt: s.scheduledAt.toISOString(),
          duration: s.duration,
          status: s.status,
          meetingLink: s.meetingLink,
          notes: s.notes,
          source: s.source,
          confirmedAt: s.confirmedAt?.toISOString() ?? null,
          completedAt: s.completedAt?.toISOString() ?? null,
          createdBy: s.createdById,
        })),
        pendingRequests: gate.availabilityRequests.map((r) => ({
          id: r.id,
          preferredSlots: r.preferredSlots as Array<{ start: string; end?: string }>,
          note: r.note,
          status: r.status,
          instructorName: r.instructor.name ?? "You",
          instructorId: r.instructorId,
          reviewNotes: r.reviewNotes,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    }
  }

  // ---- HIRING INTERVIEWS ----
  // Show applications with pending interview scheduling
  if (isReviewer) {
    const applications = await prisma.application.findMany({
      where: {
        status: { notIn: ["ACCEPTED", "REJECTED", "WITHDRAWN"] },
        decision: null,
        position: {
          interviewRequired: true,
          ...(isAdmin ? {} : { chapterId: user?.chapterId ?? "__no_chapter__" }),
        },
      },
      include: {
        applicant: { select: { id: true, name: true, email: true } },
        position: {
          select: { title: true, chapter: { select: { name: true } } },
        },
        interviewSlots: { orderBy: { scheduledAt: "asc" } },
      },
      orderBy: { submittedAt: "desc" },
    });

    for (const app of applications) {
      items.push({
        id: app.id,
        type: "HIRING",
        personName: app.applicant.name ?? "Applicant",
        personEmail: app.applicant.email ?? "",
        chapterName: app.position.chapter?.name ?? "Global",
        gateStatus: app.status,
        outcome: null,
        applicationId: app.id,
        positionTitle: app.position.title,
        slots: app.interviewSlots.map((s) => ({
          id: s.id,
          scheduledAt: s.scheduledAt.toISOString(),
          duration: s.duration,
          status: s.status,
          meetingLink: s.meetingLink,
          notes: null,
          source: "REVIEWER_POSTED",
          confirmedAt: s.confirmedAt?.toISOString() ?? null,
          completedAt: s.completedAt?.toISOString() ?? null,
          createdBy: s.interviewerId ?? "",
        })),
        pendingRequests: [],
      });
    }
  }

  return {
    items,
    viewer: {
      userId,
      roles,
      isAdmin,
      isReviewer,
      isInstructor,
    },
  };
}

// ============================================
// ACTION: POST INTERVIEW SLOTS (READINESS)
// ============================================

export async function scheduleInterviewSlots(formData: FormData) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterLead) throw new Error("Unauthorized - reviewer role required");

  const instructorId = getString(formData, "instructorId");
  const gateId = getString(formData, "gateId");
  const duration = getNumber(formData, "duration", 30);
  const meetingLink = getString(formData, "meetingLink", false);

  // Parse up to 5 slot dates
  const slotDates: Date[] = [];
  for (let i = 1; i <= 5; i++) {
    const raw = getString(formData, `slot${i}`, false);
    if (!raw) continue;
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) throw new Error(`Invalid date for slot ${i}`);
    slotDates.push(parsed);
  }

  if (slotDates.length === 0) throw new Error("Add at least one interview slot.");

  // Deduplicate
  const deduped = Array.from(
    new Map(slotDates.map((d) => [d.toISOString(), d])).values()
  );

  // Verify gate exists and is schedulable
  const gate = await prisma.instructorInterviewGate.findUnique({
    where: { id: gateId },
    select: { id: true, instructorId: true, status: true },
  });

  if (!gate) throw new Error("Interview gate not found");
  if (gate.instructorId !== instructorId) throw new Error("Gate/instructor mismatch");
  if (gate.status === "PASSED" || gate.status === "WAIVED") {
    throw new Error("Interview is already complete.");
  }

  // Filter out existing slots
  const existing = await prisma.instructorInterviewSlot.findMany({
    where: { gateId, scheduledAt: { in: deduped } },
    select: { scheduledAt: true },
  });
  const existingTimes = new Set(existing.map((s) => s.scheduledAt.toISOString()));
  const toCreate = deduped.filter((d) => !existingTimes.has(d.toISOString()));

  if (toCreate.length === 0) throw new Error("All selected times already have slots.");

  const result = await prisma.instructorInterviewSlot.createMany({
    data: toCreate.map((scheduledAt) => ({
      gateId,
      createdById: session.user.id,
      source: "REVIEWER_POSTED" as const,
      status: "POSTED" as const,
      scheduledAt,
      duration,
      meetingLink: meetingLink || null,
    })),
    skipDuplicates: true,
  });

  await createSystemNotification(
    instructorId,
    "SYSTEM",
    "Interview Slots Available",
    `${result.count} new interview slot${result.count > 1 ? "s" : ""} posted for you.`,
    "/interviews/schedule"
  );

  revalidatePath("/interviews/schedule");
  revalidatePath("/interviews");
  return { success: true, count: result.count };
}

// ============================================
// ACTION: ACCEPT AVAILABILITY REQUEST
// ============================================

export async function acceptAvailabilityAndSchedule(formData: FormData) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterLead) throw new Error("Unauthorized - reviewer role required");

  const requestId = getString(formData, "requestId");
  const scheduledAt = new Date(getString(formData, "scheduledAt"));
  const duration = getNumber(formData, "duration", 30);
  const meetingLink = getString(formData, "meetingLink", false);

  if (isNaN(scheduledAt.getTime())) throw new Error("Invalid date");

  const request = await prisma.instructorInterviewAvailabilityRequest.findUnique({
    where: { id: requestId },
    select: { id: true, gateId: true, instructorId: true, status: true },
  });

  if (!request) throw new Error("Request not found");
  if (request.status !== "PENDING") throw new Error("Request is no longer pending");

  await prisma.$transaction([
    prisma.instructorInterviewAvailabilityRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED", reviewedById: session.user.id, reviewedAt: new Date() },
    }),
    prisma.instructorInterviewSlot.upsert({
      where: { gateId_scheduledAt: { gateId: request.gateId, scheduledAt } },
      create: {
        gateId: request.gateId,
        createdById: session.user.id,
        source: "INSTRUCTOR_REQUESTED",
        status: "CONFIRMED",
        scheduledAt,
        duration,
        meetingLink: meetingLink || null,
        confirmedAt: new Date(),
      },
      update: {
        status: "CONFIRMED",
        duration,
        meetingLink: meetingLink || null,
        confirmedAt: new Date(),
      },
    }),
    // Decline other pending requests for same gate
    prisma.instructorInterviewAvailabilityRequest.updateMany({
      where: { gateId: request.gateId, status: "PENDING", id: { not: request.id } },
      data: {
        status: "DECLINED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: "A different availability request was accepted.",
      },
    }),
    prisma.instructorInterviewGate.update({
      where: { id: request.gateId },
      data: { status: "SCHEDULED", scheduledAt },
    }),
  ]);

  await createSystemNotification(
    request.instructorId,
    "SYSTEM",
    "Interview Scheduled",
    "Your interview availability request was accepted and your interview is scheduled.",
    "/interviews/schedule"
  );

  revalidatePath("/interviews/schedule");
  revalidatePath("/interviews");
  return { success: true };
}

// ============================================
// ACTION: CANCEL A SLOT (reviewer)
// ============================================

export async function cancelInterviewSlot(formData: FormData) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterLead) throw new Error("Unauthorized");

  const slotId = getString(formData, "slotId");

  const slot = await prisma.instructorInterviewSlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      status: true,
      gateId: true,
      gate: { select: { instructorId: true, status: true } },
    },
  });

  if (!slot) throw new Error("Slot not found");
  if (slot.status === "COMPLETED") throw new Error("Cannot cancel a completed slot");

  const wasConfirmed = slot.status === "CONFIRMED";

  await prisma.$transaction([
    prisma.instructorInterviewSlot.update({
      where: { id: slotId },
      data: { status: "CANCELLED" },
    }),
    // If this was the confirmed slot, revert gate to REQUIRED
    ...(wasConfirmed
      ? [
          prisma.instructorInterviewGate.update({
            where: { id: slot.gateId },
            data: { status: "REQUIRED", scheduledAt: null },
          }),
        ]
      : []),
  ]);

  await createSystemNotification(
    slot.gate.instructorId,
    "SYSTEM",
    "Interview Slot Cancelled",
    wasConfirmed
      ? "Your confirmed interview slot was cancelled. Please schedule a new time."
      : "An interview slot was removed.",
    "/interviews/schedule"
  );

  revalidatePath("/interviews/schedule");
  revalidatePath("/interviews");
  return { success: true };
}

// ============================================
// ACTION: POST HIRING INTERVIEW SLOTS
// ============================================

export async function scheduleHiringInterviewSlots(formData: FormData) {
  const session = await requireSession();
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");

  if (!isAdmin && !isChapterLead) throw new Error("Unauthorized - reviewer role required");

  const applicationId = getString(formData, "applicationId");
  const duration = getNumber(formData, "duration", 30);
  const meetingLink = getString(formData, "meetingLink", false);

  const slotDates: Date[] = [];
  for (let i = 1; i <= 5; i++) {
    const raw = getString(formData, `slot${i}`, false);
    if (!raw) continue;
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) throw new Error(`Invalid date for slot ${i}`);
    slotDates.push(parsed);
  }

  if (slotDates.length === 0) throw new Error("Add at least one interview slot.");

  const deduped = Array.from(
    new Map(slotDates.map((d) => [d.toISOString(), d])).values()
  );

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, applicantId: true, position: { select: { title: true } } },
  });

  if (!app) throw new Error("Application not found");

  const existing = await prisma.interviewSlot.findMany({
    where: { applicationId, scheduledAt: { in: deduped } },
    select: { scheduledAt: true },
  });
  const existingTimes = new Set(existing.map((s) => s.scheduledAt.toISOString()));
  const toCreate = deduped.filter((d) => !existingTimes.has(d.toISOString()));

  if (toCreate.length === 0) throw new Error("All selected times already have slots.");

  const result = await prisma.interviewSlot.createMany({
    data: toCreate.map((scheduledAt) => ({
      applicationId,
      status: "POSTED" as const,
      scheduledAt,
      duration,
      meetingLink: meetingLink || null,
      interviewerId: session.user.id,
    })),
    skipDuplicates: true,
  });

  await createSystemNotification(
    app.applicantId,
    "SYSTEM",
    "Interview Slots Available",
    `${result.count} interview slot${result.count > 1 ? "s" : ""} posted for "${app.position.title}".`,
    `/applications/${applicationId}`
  );

  revalidatePath("/interviews/schedule");
  revalidatePath("/interviews");
  return { success: true, count: result.count };
}
