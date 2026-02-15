"use server";

import { authOptions } from "@/lib/auth";
import { createSystemNotification } from "@/lib/notification-actions";
import { prisma } from "@/lib/prisma";
import { InterviewOutcome, InterviewRequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getNumber(formData: FormData, key: string, fallback: number) {
  const raw = formData.get(key);
  if (!raw || String(raw).trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireReviewer() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_LEAD")) {
    throw new Error("Unauthorized - reviewer role required");
  }
  return session;
}

async function ensureInterviewGate(instructorId: string) {
  return prisma.instructorInterviewGate.upsert({
    where: { instructorId },
    create: {
      instructorId,
      status: "REQUIRED",
    },
    update: {},
  });
}

async function assertReviewerCanManageInstructor(
  reviewerId: string,
  instructorId: string
) {
  const [reviewer, instructor] = await Promise.all([
    prisma.user.findUnique({
      where: { id: reviewerId },
      select: {
        id: true,
        chapterId: true,
        roles: { select: { role: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: instructorId },
      select: {
        id: true,
        chapterId: true,
      },
    }),
  ]);

  if (!reviewer || !instructor) {
    throw new Error("Reviewer or instructor not found");
  }

  const reviewerRoles = reviewer.roles.map((role) => role.role);
  const isAdmin = reviewerRoles.includes("ADMIN");
  const isChapterLead = reviewerRoles.includes("CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    throw new Error("Unauthorized");
  }

  if (isChapterLead && !isAdmin && reviewer.chapterId !== instructor.chapterId) {
    throw new Error("Chapter Leads can only manage instructors in their chapter");
  }
}

async function getReviewerIdsForInstructor(instructorId: string) {
  const instructor = await prisma.user.findUnique({
    where: { id: instructorId },
    select: { chapterId: true },
  });

  const reviewers = await prisma.user.findMany({
    where: {
      OR: [
        { roles: { some: { role: "ADMIN" } } },
        {
          AND: [
            { roles: { some: { role: "CHAPTER_LEAD" } } },
            { chapterId: instructor?.chapterId ?? undefined },
          ],
        },
      ],
    },
    select: { id: true },
  });

  return reviewers.map((reviewer) => reviewer.id);
}

function assertGateCanSchedule(status: string) {
  if (status === "PASSED" || status === "WAIVED") {
    throw new Error("Interview is already complete and approved.");
  }
}

function revalidateInterviewPaths() {
  revalidatePath("/instructor/training-progress");
  revalidatePath("/admin/instructor-readiness");
  revalidatePath("/chapter-lead/instructor-readiness");
}

export async function getMyInterviewGate() {
  const session = await requireAuth();
  const gate = await ensureInterviewGate(session.user.id);

  return prisma.instructorInterviewGate.findUnique({
    where: { id: gate.id },
    include: {
      slots: {
        orderBy: { scheduledAt: "asc" },
      },
      availabilityRequests: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function confirmPostedInterviewSlot(formData: FormData) {
  const session = await requireAuth();
  const instructorId = session.user.id;
  const slotId = getString(formData, "slotId");

  const gate = await ensureInterviewGate(instructorId);
  assertGateCanSchedule(gate.status);

  const slot = await prisma.instructorInterviewSlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      gateId: true,
      status: true,
      scheduledAt: true,
      createdById: true,
    },
  });

  if (!slot || slot.gateId !== gate.id) {
    throw new Error("Interview slot not found");
  }
  if (slot.status !== "POSTED") {
    throw new Error("This slot is no longer available");
  }

  const existingConfirmed = await prisma.instructorInterviewSlot.findFirst({
    where: {
      gateId: gate.id,
      status: "CONFIRMED",
    },
    select: { id: true },
  });
  if (existingConfirmed) {
    throw new Error("You already have a confirmed interview slot");
  }

  await prisma.$transaction([
    prisma.instructorInterviewSlot.update({
      where: { id: slot.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    }),
    prisma.instructorInterviewGate.update({
      where: { id: gate.id },
      data: {
        status: "SCHEDULED",
        scheduledAt: slot.scheduledAt,
      },
    }),
  ]);

  if (slot.createdById !== instructorId) {
    await createSystemNotification(
      slot.createdById,
      "SYSTEM",
      "Interview Slot Confirmed",
      "An instructor confirmed a posted interview slot.",
      "/admin/instructor-readiness"
    );
  }

  revalidateInterviewPaths();
}

type PreferredSlot = {
  start: string;
  end?: string;
};

function parsePreferredSlots(raw: string): PreferredSlot[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Preferred slots must be a valid JSON array");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Preferred slots must include at least one option");
  }

  const normalized: PreferredSlot[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Each preferred slot must be an object with start/end");
    }

    const start = String((entry as { start?: unknown }).start ?? "").trim();
    const end = String((entry as { end?: unknown }).end ?? "").trim();

    if (!start || isNaN(new Date(start).getTime())) {
      throw new Error("Preferred slot start time is invalid");
    }

    if (end && isNaN(new Date(end).getTime())) {
      throw new Error("Preferred slot end time is invalid");
    }

    normalized.push({
      start,
      ...(end ? { end } : {}),
    });
  }

  return normalized;
}

function parsePreferredSlotsFromInputs(formData: FormData): PreferredSlot[] {
  const slots: PreferredSlot[] = [];

  for (let i = 1; i <= 3; i += 1) {
    const start = getString(formData, `preferredStart${i}`, false);
    const end = getString(formData, `preferredEnd${i}`, false);

    if (!start) continue;
    if (isNaN(new Date(start).getTime())) {
      throw new Error(`Preferred slot ${i} start time is invalid`);
    }
    if (end && isNaN(new Date(end).getTime())) {
      throw new Error(`Preferred slot ${i} end time is invalid`);
    }

    slots.push({
      start,
      ...(end ? { end } : {}),
    });
  }

  return slots;
}

export async function submitInterviewAvailabilityRequest(formData: FormData) {
  const session = await requireAuth();
  const instructorId = session.user.id;
  const preferredSlotsRaw = getString(formData, "preferredSlots", false);
  const note = getString(formData, "note", false);

  const preferredSlots = preferredSlotsRaw
    ? parsePreferredSlots(preferredSlotsRaw)
    : parsePreferredSlotsFromInputs(formData);

  if (preferredSlots.length === 0) {
    throw new Error("Add at least one preferred slot.");
  }

  const gate = await ensureInterviewGate(instructorId);
  assertGateCanSchedule(gate.status);

  const pendingCount = await prisma.instructorInterviewAvailabilityRequest.count({
    where: {
      gateId: gate.id,
      status: "PENDING",
    },
  });

  if (pendingCount >= 3) {
    throw new Error("You already have 3 pending availability requests");
  }

  await prisma.instructorInterviewAvailabilityRequest.create({
    data: {
      gateId: gate.id,
      instructorId,
      preferredSlots,
      note: note || null,
      status: "PENDING",
    },
  });

  const reviewerIds = await getReviewerIdsForInstructor(instructorId);
  for (const reviewerId of reviewerIds) {
    await createSystemNotification(
      reviewerId,
      "SYSTEM",
      "New Interview Availability Request",
      "An instructor submitted preferred interview times.",
      "/admin/instructor-readiness"
    );
  }

  revalidateInterviewPaths();
}

export async function cancelInterviewAvailabilityRequest(formData: FormData) {
  const session = await requireAuth();
  const instructorId = session.user.id;
  const requestId = getString(formData, "requestId");

  const request = await prisma.instructorInterviewAvailabilityRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      instructorId: true,
      status: true,
    },
  });

  if (!request || request.instructorId !== instructorId) {
    throw new Error("Availability request not found");
  }
  if (request.status !== "PENDING") {
    throw new Error("Only pending requests can be cancelled");
  }

  await prisma.instructorInterviewAvailabilityRequest.update({
    where: { id: requestId },
    data: {
      status: "CANCELLED",
    },
  });

  revalidateInterviewPaths();
}

export async function postInterviewSlot(formData: FormData) {
  const session = await requireReviewer();
  const instructorId = getString(formData, "instructorId");
  const scheduledAt = new Date(getString(formData, "scheduledAt"));
  const duration = getNumber(formData, "duration", 30);
  const meetingLink = getString(formData, "meetingLink", false);
  const notes = getString(formData, "notes", false);

  if (isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid scheduled date");
  }

  await assertReviewerCanManageInstructor(session.user.id, instructorId);

  const gate = await ensureInterviewGate(instructorId);
  assertGateCanSchedule(gate.status);

  await prisma.instructorInterviewSlot.create({
    data: {
      gateId: gate.id,
      createdById: session.user.id,
      source: "REVIEWER_POSTED",
      status: "POSTED",
      scheduledAt,
      duration,
      meetingLink: meetingLink || null,
      notes: notes || null,
    },
  });

  await createSystemNotification(
    instructorId,
    "SYSTEM",
    "Interview Slot Available",
    "A reviewer posted a new interview slot for you.",
    "/instructor/training-progress"
  );

  revalidateInterviewPaths();
}

export async function acceptInterviewAvailabilityRequest(formData: FormData) {
  const session = await requireReviewer();
  const requestId = getString(formData, "requestId");
  const scheduledAt = new Date(getString(formData, "scheduledAt"));
  const duration = getNumber(formData, "duration", 30);
  const meetingLink = getString(formData, "meetingLink", false);
  const notes = getString(formData, "notes", false);

  if (isNaN(scheduledAt.getTime())) {
    throw new Error("Invalid scheduled date");
  }

  const request = await prisma.instructorInterviewAvailabilityRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      gateId: true,
      instructorId: true,
      status: true,
    },
  });

  if (!request) {
    throw new Error("Availability request not found");
  }
  if (request.status !== "PENDING") {
    throw new Error("Request is no longer pending");
  }

  await assertReviewerCanManageInstructor(session.user.id, request.instructorId);

  const gate = await prisma.instructorInterviewGate.findUnique({
    where: { id: request.gateId },
    select: { status: true },
  });

  if (!gate) {
    throw new Error("Interview gate not found");
  }
  assertGateCanSchedule(gate.status);

  const existingConfirmed = await prisma.instructorInterviewSlot.findFirst({
    where: {
      gateId: request.gateId,
      status: "CONFIRMED",
    },
    select: { id: true },
  });
  if (existingConfirmed) {
    throw new Error("Instructor already has a confirmed interview slot");
  }

  await prisma.$transaction([
    prisma.instructorInterviewAvailabilityRequest.update({
      where: { id: requestId },
      data: {
        status: "ACCEPTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    }),
    prisma.instructorInterviewSlot.create({
      data: {
        gateId: request.gateId,
        createdById: session.user.id,
        source: "INSTRUCTOR_REQUESTED",
        status: "CONFIRMED",
        scheduledAt,
        duration,
        meetingLink: meetingLink || null,
        notes: notes || null,
        confirmedAt: new Date(),
      },
    }),
    prisma.instructorInterviewAvailabilityRequest.updateMany({
      where: {
        gateId: request.gateId,
        status: "PENDING",
        id: { not: request.id },
      },
      data: {
        status: "DECLINED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: "A different availability request was accepted.",
      },
    }),
    prisma.instructorInterviewGate.update({
      where: { id: request.gateId },
      data: {
        status: "SCHEDULED",
        scheduledAt,
      },
    }),
  ]);

  await createSystemNotification(
    request.instructorId,
    "SYSTEM",
    "Interview Request Accepted",
    "Your preferred interview request was accepted and scheduled.",
    "/instructor/training-progress"
  );

  revalidateInterviewPaths();
}

export async function declineInterviewAvailabilityRequest(formData: FormData) {
  const session = await requireReviewer();
  const requestId = getString(formData, "requestId");
  const reviewNotes = getString(formData, "reviewNotes", false);

  const request = await prisma.instructorInterviewAvailabilityRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      instructorId: true,
      status: true,
    },
  });

  if (!request) {
    throw new Error("Availability request not found");
  }
  if (request.status !== "PENDING") {
    throw new Error("Request is no longer pending");
  }

  await assertReviewerCanManageInstructor(session.user.id, request.instructorId);

  await prisma.instructorInterviewAvailabilityRequest.update({
    where: { id: requestId },
    data: {
      status: "DECLINED",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
    },
  });

  await createSystemNotification(
    request.instructorId,
    "SYSTEM",
    "Interview Request Declined",
    "A reviewer declined your interview availability request. Submit new preferred times.",
    "/instructor/training-progress"
  );

  revalidateInterviewPaths();
}

export async function markInterviewCompleted(formData: FormData) {
  const session = await requireReviewer();
  const slotId = getString(formData, "slotId");

  const slot = await prisma.instructorInterviewSlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      gateId: true,
      status: true,
      gate: {
        select: {
          instructorId: true,
          status: true,
        },
      },
    },
  });

  if (!slot) {
    throw new Error("Interview slot not found");
  }

  await assertReviewerCanManageInstructor(session.user.id, slot.gate.instructorId);

  if (slot.gate.status === "PASSED" || slot.gate.status === "WAIVED") {
    throw new Error("Interview gate is already finalized.");
  }

  if (slot.status !== "CONFIRMED") {
    throw new Error("Only confirmed slots can be marked completed");
  }

  await prisma.$transaction([
    prisma.instructorInterviewSlot.update({
      where: { id: slot.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    }),
    prisma.instructorInterviewGate.update({
      where: { id: slot.gateId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    }),
  ]);

  await createSystemNotification(
    slot.gate.instructorId,
    "SYSTEM",
    "Interview Completed",
    "Your interview was marked completed. A reviewer will post your outcome next.",
    "/instructor/training-progress"
  );

  revalidateInterviewPaths();
}

export async function setInterviewOutcome(formData: FormData) {
  const session = await requireReviewer();
  const gateId = getString(formData, "gateId");
  const outcomeRaw = getString(formData, "outcome");
  const reviewNotes = getString(formData, "reviewNotes", false);

  if (!["PASS", "HOLD", "FAIL", "WAIVE"].includes(outcomeRaw)) {
    throw new Error("Invalid interview outcome");
  }

  const roles = session.user.roles ?? [];
  if (outcomeRaw === "WAIVE" && !roles.includes("ADMIN")) {
    throw new Error("Only admins can waive interview outcomes");
  }

  const outcome = outcomeRaw as InterviewOutcome;

  const gate = await prisma.instructorInterviewGate.findUnique({
    where: { id: gateId },
    select: {
      id: true,
      instructorId: true,
      status: true,
    },
  });

  if (!gate) {
    throw new Error("Interview gate not found");
  }

  await assertReviewerCanManageInstructor(session.user.id, gate.instructorId);

  if (outcome !== "WAIVE") {
    const completedInterview = await prisma.instructorInterviewSlot.findFirst({
      where: {
        gateId: gate.id,
        status: "COMPLETED",
      },
      select: { id: true },
    });

    if (!completedInterview) {
      throw new Error(
        "Cannot set interview outcome until at least one interview is marked completed."
      );
    }
  }

  if (outcome === "WAIVE") {
    await prisma.analyticsEvent.create({
      data: {
        userId: session.user.id,
        eventType: "interview_outcome_waived",
        eventData: {
          gateId,
          instructorId: gate.instructorId,
          reviewerId: session.user.id,
          notes: reviewNotes || null,
        },
      },
    });
  }

  const statusByOutcome: Record<
    InterviewOutcome,
    "PASSED" | "HOLD" | "FAILED" | "WAIVED"
  > = {
    PASS: "PASSED",
    HOLD: "HOLD",
    FAIL: "FAILED",
    WAIVE: "WAIVED",
  };

  await prisma.instructorInterviewGate.update({
    where: { id: gateId },
    data: {
      status: statusByOutcome[outcome],
      outcome,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
      completedAt: new Date(),
    },
  });

  // If this was PASS/WAIVE, clear out lingering pending requests to prevent duplicate scheduling.
  if (outcome === "PASS" || outcome === "WAIVE") {
    await prisma.instructorInterviewAvailabilityRequest.updateMany({
      where: {
        gateId,
        status: "PENDING",
      },
      data: {
        status: "DECLINED" as InterviewRequestStatus,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: "Interview gate finalized.",
      },
    });
  }

  await createSystemNotification(
    gate.instructorId,
    "SYSTEM",
    "Interview Outcome Posted",
    `Your interview outcome is ${outcome}. Check your training progress for next steps.`,
    "/instructor/training-progress"
  );

  revalidateInterviewPaths();
}
