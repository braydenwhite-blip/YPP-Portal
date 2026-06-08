"use server";

/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M1) — mentor expertise mutations.
 *
 * A mentor manages their own expertise tags; an Officer-tier user may manage
 * anyone's (for admin curation). Gated by ENABLE_MENTORSHIP_2 — with the flag
 * off these actions throw, so no behavior changes for existing users.
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
import { isExpertiseProficiency } from "./constants";

function ensureEnabled() {
  if (!isMentorship2Enabled()) {
    throw new Error("Mentorship 2.0 is not enabled");
  }
}

const SetExpertiseSchema = z.object({
  userId: z.string().min(1).optional(),
  expertiseAreaId: z.string().min(1),
  proficiency: z.string().min(1).nullish(),
});

/**
 * Claim (or update the proficiency of) an expertise area for a mentor.
 * Idempotent: upserts on the (userId, expertiseAreaId) unique pair.
 */
export async function setMentorExpertise(input: z.infer<typeof SetExpertiseSchema>) {
  ensureEnabled();
  const session = await requireSessionUser();
  const { userId, expertiseAreaId, proficiency } = SetExpertiseSchema.parse(input);

  const targetUserId = userId ?? session.id;
  if (
    targetUserId !== session.id &&
    !hasAnyRole(session.roles, [...OFFICER_TIER_ROLES], session.primaryRole)
  ) {
    throw new Error("Unauthorized");
  }

  const area = await prisma.expertiseArea.findUnique({
    where: { id: expertiseAreaId },
    select: { id: true, isActive: true },
  });
  if (!area || !area.isActive) {
    throw new Error("Unknown or inactive expertise area");
  }

  const normalizedProficiency =
    proficiency && isExpertiseProficiency(proficiency) ? proficiency : null;

  const row = await prisma.mentorExpertise.upsert({
    where: {
      userId_expertiseAreaId: { userId: targetUserId, expertiseAreaId },
    },
    create: {
      userId: targetUserId,
      expertiseAreaId,
      proficiency: normalizedProficiency,
    },
    update: { proficiency: normalizedProficiency },
  });

  revalidatePath("/mentorship");
  return row;
}

const RemoveExpertiseSchema = z.object({
  userId: z.string().min(1).optional(),
  expertiseAreaId: z.string().min(1),
});

/** Remove an expertise claim. Self-service for mentors; officer-tier for others. */
export async function removeMentorExpertise(
  input: z.infer<typeof RemoveExpertiseSchema>
) {
  ensureEnabled();
  const session = await requireSessionUser();
  const { userId, expertiseAreaId } = RemoveExpertiseSchema.parse(input);

  const targetUserId = userId ?? session.id;
  if (
    targetUserId !== session.id &&
    !hasAnyRole(session.roles, [...OFFICER_TIER_ROLES], session.primaryRole)
  ) {
    throw new Error("Unauthorized");
  }

  await prisma.mentorExpertise.deleteMany({
    where: { userId: targetUserId, expertiseAreaId },
  });

  revalidatePath("/mentorship");
}
