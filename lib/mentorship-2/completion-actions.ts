"use server";

/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M1) — completion → Alumni transition.
 *
 * Closes the audit's "no completion/exit/alumni flow" dead end: when a mentorship
 * wraps up, the mentee is graduated into the Alumni network in one step. Reuses
 * the existing AlumniProfile model. Gated by ENABLE_MENTORSHIP_2.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  requireSessionUser,
  hasAnyRole,
  OFFICER_TIER_ROLES,
} from "@/lib/authorization";
import { isMentorship2Enabled } from "@/lib/feature-flags";

function ensureEnabled() {
  if (!isMentorship2Enabled()) {
    throw new Error("Mentorship 2.0 is not enabled");
  }
}

const CompleteSchema = z.object({
  mentorshipId: z.string().min(1),
  graduationYear: z.number().int().min(1900).max(2100).optional(),
  college: z.string().trim().max(200).optional(),
});

/**
 * Mark a mentorship COMPLETE and ensure the mentee has an AlumniProfile.
 * Idempotent: re-running on an already-complete mentorship only fills in any
 * provided alumni details. Authorized for the mentorship's mentor or chair, or
 * any Officer-tier user.
 */
export async function completeMentorshipToAlumni(
  input: z.infer<typeof CompleteSchema>
) {
  ensureEnabled();
  const session = await requireSessionUser();
  const { mentorshipId, graduationYear, college } = CompleteSchema.parse(input);

  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: {
      id: true,
      mentorId: true,
      menteeId: true,
      chairId: true,
      status: true,
    },
  });
  if (!mentorship) {
    throw new Error("Not found");
  }

  const isOfficer = hasAnyRole(
    session.roles,
    [...OFFICER_TIER_ROLES],
    session.primaryRole
  );
  const isOwner =
    session.id === mentorship.mentorId || session.id === mentorship.chairId;
  if (!isOfficer && !isOwner) {
    throw new Error("Unauthorized");
  }

  const alreadyComplete = mentorship.status === "COMPLETE";

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.mentorship.update({
      where: { id: mentorshipId },
      data: {
        status: "COMPLETE",
        cycleStage: "COMPLETE",
        // Stamp the end date only on the first completion.
        endDate: alreadyComplete ? undefined : new Date(),
      },
    });

    const alumni = await tx.alumniProfile.upsert({
      where: { userId: mentorship.menteeId },
      create: {
        userId: mentorship.menteeId,
        graduationYear: graduationYear ?? null,
        college: college || null,
      },
      update: {
        // Only overwrite when a value was supplied.
        graduationYear: graduationYear ?? undefined,
        college: college || undefined,
      },
    });

    return { mentorship: updated, alumni };
  });

  revalidatePath(`/mentorship/mentees/${mentorship.menteeId}`);
  revalidatePath("/mentorship");
  return result;
}
