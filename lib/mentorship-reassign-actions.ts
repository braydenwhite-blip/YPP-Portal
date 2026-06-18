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
 */

import { revalidatePath } from "next/cache";
import { MentorshipType } from "@prisma/client";

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
    select: { id: true, mentorId: true, focusArea: true, type: true },
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

      // Close the outgoing mentor's open history row, or synthesize a closed row
      // for legacy assignments that predate this trail.
      const closed = await tx.mentorshipAssignmentHistory.updateMany({
        where: {
          menteeId: input.menteeId,
          mentorId: plan.previousMentorId ?? undefined,
          focusArea,
          endedAt: null,
        },
        data: { endedAt: now },
      });
      if (closed.count === 0 && plan.previousMentorId) {
        await tx.mentorshipAssignmentHistory.create({
          data: {
            menteeId: input.menteeId,
            mentorId: plan.previousMentorId,
            focusArea,
            role,
            mentorshipId: plan.completeMentorshipId,
            endedAt: now,
            reason: "Closed on reassignment (backfilled history).",
            actorId: session.id,
          },
        });
      }
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

    // 3. Open the incoming mentor's history row.
    await tx.mentorshipAssignmentHistory.create({
      data: {
        menteeId: input.menteeId,
        mentorId: input.newMentorId,
        focusArea,
        role,
        mentorshipId: created.id,
        isTemporary,
        reason: input.reason?.trim() || null,
        actorId: session.id,
      },
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
