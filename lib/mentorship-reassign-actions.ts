"use server";

/**
 * Non-destructive mentor reassignment (Phase 4 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
 *
 * Transfers a mentee's primary mentor at any time WITHOUT changing the mentee's
 * account, profile, notes, or reviews: the old Mentorship is completed (kept as
 * history with all its check-ins/reviews intact), a new one is created, and an
 * append-only MentorshipAssignmentHistory trail records the change with actor +
 * reason. Supports per-focus-area mentors (instruction vs leadership) and
 * temporary assignments.
 *
 * `recordPrimaryMentorAssignment` lets other assignment paths (e.g. the support
 * circle assign flow) keep the same history trail without duplicating logic.
 */

import { revalidatePath } from "next/cache";
import { MentorshipType, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireSessionUser, hasRole, hasAnyAdminSubtype } from "@/lib/authorization";
import { logAuditEvent } from "@/lib/audit-log-actions";
import {
  buildMentorTransferPlan,
  type CurrentAssignment,
  type FocusArea,
} from "@/lib/mentorship-transfer";

async function requireMentorshipAssigner() {
  const session = await requireSessionUser();
  const allowed =
    hasRole(session.roles, "ADMIN", session.primaryRole) ||
    hasRole(session.roles, "STAFF", session.primaryRole) ||
    hasRole(session.roles, "CHAPTER_PRESIDENT", session.primaryRole) ||
    hasAnyAdminSubtype(session.adminSubtypes, [
      "SUPER_ADMIN",
      "MENTORSHIP_ADMIN",
      "LEADERSHIP",
    ]);
  if (!allowed) {
    throw new Error("Unauthorized: only officers and mentorship admins can reassign mentors.");
  }
  return session;
}

interface ReconcileHistoryArgs {
  menteeId: string;
  newMentorId: string;
  previousMentorId?: string | null;
  previousMentorshipId?: string | null;
  previousStartedAt?: Date | null;
  mentorshipId: string;
  focusArea: FocusArea | null;
  role: string;
  isTemporary: boolean;
  reason?: string | null;
  actorId?: string | null;
  now: Date;
}

/**
 * Reconcile the assignment-history rows so the only OPEN row for this mentee +
 * focus area is the incoming mentor's. Closes the outgoing mentor's open row
 * (backfilling one for legacy assignments that predate the trail), defensively
 * closes any other stray open rows, and ensures exactly one open row for the new
 * mentor. Idempotent. Runs inside the caller's transaction.
 */
async function reconcileMentorHistory(
  tx: Prisma.TransactionClient,
  args: ReconcileHistoryArgs
): Promise<void> {
  const { menteeId, newMentorId, focusArea, now } = args;

  if (args.previousMentorId && args.previousMentorId !== newMentorId) {
    const closed = await tx.mentorshipAssignmentHistory.updateMany({
      where: { menteeId, focusArea, mentorId: args.previousMentorId, endedAt: null },
      data: { endedAt: now },
    });
    if (closed.count === 0) {
      await tx.mentorshipAssignmentHistory.create({
        data: {
          menteeId,
          mentorId: args.previousMentorId,
          focusArea,
          role: args.role,
          mentorshipId: args.previousMentorshipId ?? null,
          startedAt: args.previousStartedAt ?? now,
          endedAt: now,
          reason: "Closed on reassignment (backfilled history).",
          actorId: args.actorId ?? null,
        },
      });
    }
  }

  // Any other stray open rows for this focus area belong to a prior mentor.
  await tx.mentorshipAssignmentHistory.updateMany({
    where: { menteeId, focusArea, endedAt: null, mentorId: { not: newMentorId } },
    data: { endedAt: now },
  });

  // Ensure exactly one open row for the incoming mentor.
  const open = await tx.mentorshipAssignmentHistory.findFirst({
    where: { menteeId, focusArea, mentorId: newMentorId, endedAt: null },
    select: { id: true },
  });
  if (!open) {
    await tx.mentorshipAssignmentHistory.create({
      data: {
        menteeId,
        mentorId: newMentorId,
        focusArea,
        role: args.role,
        mentorshipId: args.mentorshipId,
        isTemporary: args.isTemporary,
        reason: args.reason ?? null,
        actorId: args.actorId ?? null,
        startedAt: now,
      },
    });
  }
}

export interface RecordPrimaryMentorAssignmentInput {
  menteeId: string;
  newMentorId: string;
  mentorshipId: string;
  previousMentorId?: string | null;
  previousMentorshipId?: string | null;
  previousStartedAt?: Date | null;
  focusArea?: FocusArea | null;
  role?: string;
  isTemporary?: boolean;
  reason?: string | null;
  actorId?: string | null;
}

/**
 * Record (reconcile) the mentor-assignment history for a mentee whose primary
 * mentor was set or changed by some other flow. Safe to call after the live
 * Mentorship row has already been updated/created. No-op-safe and idempotent.
 */
export async function recordPrimaryMentorAssignment(
  input: RecordPrimaryMentorAssignmentInput
): Promise<void> {
  const now = new Date();
  await prisma.$transaction((tx) =>
    reconcileMentorHistory(tx, {
      menteeId: input.menteeId,
      newMentorId: input.newMentorId,
      previousMentorId: input.previousMentorId ?? null,
      previousMentorshipId: input.previousMentorshipId ?? null,
      previousStartedAt: input.previousStartedAt ?? null,
      mentorshipId: input.mentorshipId,
      focusArea: input.focusArea ?? null,
      role: input.role?.trim() || "PRIMARY_MENTOR",
      isTemporary: Boolean(input.isTemporary),
      reason: input.reason ?? null,
      actorId: input.actorId ?? null,
      now,
    })
  );
}

export interface ReassignPrimaryMentorInput {
  menteeId: string;
  newMentorId: string;
  focusArea?: FocusArea | null;
  reason?: string | null;
  isTemporary?: boolean;
  /** Defaults to PRIMARY_MENTOR; recorded on the history row. */
  role?: string;
}

export interface ReassignPrimaryMentorResult {
  status: "reassigned" | "unchanged";
  mentorshipId: string;
}

/**
 * Reassign (or first-assign) a mentee's primary mentor for a focus area.
 * Idempotent: re-running with the same mentor is a no-op.
 */
export async function reassignPrimaryMentor(
  input: ReassignPrimaryMentorInput
): Promise<ReassignPrimaryMentorResult> {
  const session = await requireMentorshipAssigner();

  const focusArea = input.focusArea ?? null;
  const role = input.role?.trim() || "PRIMARY_MENTOR";
  const isTemporary = Boolean(input.isTemporary);

  if (input.menteeId === input.newMentorId) {
    throw new Error("A person cannot be their own mentor.");
  }

  const [mentee, newMentor] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.menteeId }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: input.newMentorId }, select: { id: true, name: true } }),
  ]);
  if (!mentee) throw new Error("Mentee not found");
  if (!newMentor) throw new Error("Mentor not found");

  // The current active mentorship for this focus area (null focus = the general
  // primary relationship).
  const existing = await prisma.mentorship.findFirst({
    where: { menteeId: input.menteeId, status: "ACTIVE", focusArea },
    select: { id: true, mentorId: true, focusArea: true, type: true, startDate: true },
    orderBy: { startDate: "desc" },
  });

  const current: CurrentAssignment | null = existing
    ? { mentorshipId: existing.id, mentorId: existing.mentorId, focusArea: existing.focusArea }
    : null;

  const plan = buildMentorTransferPlan(current, {
    menteeId: input.menteeId,
    newMentorId: input.newMentorId,
    focusArea,
    isTemporary,
  });

  if (plan.noop) {
    return { status: "unchanged", mentorshipId: existing!.id };
  }

  const mentorshipType: MentorshipType = existing?.type ?? MentorshipType.INSTRUCTOR;
  const now = new Date();

  const newMentorshipId = await prisma.$transaction(async (tx) => {
    // 1. Complete the outgoing mentorship (kept with its notes/reviews intact).
    if (plan.completeMentorshipId) {
      await tx.mentorship.update({
        where: { id: plan.completeMentorshipId },
        data: { status: "COMPLETE", endDate: now },
      });
    }

    // 2. Create the incoming mentorship.
    const created = await tx.mentorship.create({
      data: {
        mentorId: input.newMentorId,
        menteeId: input.menteeId,
        type: mentorshipType,
        focusArea,
        isTemporary,
        notes: input.reason?.trim() || null,
      },
      select: { id: true },
    });

    // 3. Reconcile the append-only assignment-history trail.
    await reconcileMentorHistory(tx, {
      menteeId: input.menteeId,
      newMentorId: input.newMentorId,
      previousMentorId: plan.previousMentorId,
      previousMentorshipId: plan.completeMentorshipId,
      previousStartedAt: existing?.startDate ?? null,
      mentorshipId: created.id,
      focusArea,
      role,
      isTemporary,
      reason: input.reason ?? null,
      actorId: session.id,
      now,
    });

    return created.id;
  });

  await logAuditEvent({
    action: "MENTORSHIP_UPDATED",
    actorId: session.id,
    targetType: "Mentorship",
    targetId: newMentorshipId,
    description:
      `Primary mentor for ${mentee.name} reassigned to ${newMentor.name}` +
      `${focusArea ? ` (${focusArea.toLowerCase()})` : ""}` +
      `${isTemporary ? " [temporary]" : ""}` +
      `${input.reason ? ` — ${input.reason}` : ""}`,
  });

  revalidatePath(`/people/${input.menteeId}`);
  revalidatePath("/admin/mentorship");

  return { status: "reassigned", mentorshipId: newMentorshipId };
}

/**
 * FormData wrapper so a profile <form action={…}> can reassign a mentor.
 */
export async function reassignPrimaryMentorFromForm(formData: FormData): Promise<void> {
  const menteeId = String(formData.get("menteeId") ?? "").trim();
  const newMentorId = String(formData.get("newMentorId") ?? "").trim();
  if (!menteeId || !newMentorId) throw new Error("Mentee and new mentor are required.");

  const focusRaw = String(formData.get("focusArea") ?? "").trim().toUpperCase();
  const focusArea: FocusArea | null =
    focusRaw === "INSTRUCTION" || focusRaw === "LEADERSHIP" ? focusRaw : null;

  await reassignPrimaryMentor({
    menteeId,
    newMentorId,
    focusArea,
    reason: String(formData.get("reason") ?? "").trim() || null,
    isTemporary: formData.get("isTemporary") === "on" || formData.get("isTemporary") === "true",
  });
}

export interface MentorshipHistoryEntry {
  id: string;
  mentorId: string;
  mentorName: string;
  focusArea: FocusArea | null;
  role: string;
  isTemporary: boolean;
  startedAt: Date;
  endedAt: Date | null;
  reason: string | null;
}

/** The full mentor history for a mentee (current first), for the profile timeline. */
export async function getMentorshipAssignmentHistory(
  menteeId: string
): Promise<MentorshipHistoryEntry[]> {
  const rows = await prisma.mentorshipAssignmentHistory.findMany({
    where: { menteeId },
    select: {
      id: true,
      mentorId: true,
      focusArea: true,
      role: true,
      isTemporary: true,
      startedAt: true,
      endedAt: true,
      reason: true,
      mentor: { select: { name: true } },
    },
    orderBy: [{ endedAt: "asc" }, { startedAt: "desc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    mentorId: r.mentorId,
    mentorName: r.mentor.name,
    focusArea: r.focusArea as FocusArea | null,
    role: r.role,
    isTemporary: r.isTemporary,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    reason: r.reason,
  }));
}
