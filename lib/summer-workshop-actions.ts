"use server";

/**
 * Server actions for the Summer Workshop Instructor pathway.
 *
 * Currently exposes a single first-class action: `promoteToFullInstructor`.
 * Implementation matches the spec in
 * `docs/summer-workshop-instructor-plan.md` §9 and §10.
 *
 * Notes for reviewers:
 *  - Subtype is single-valued and is flipped from SUMMER_WORKSHOP -> STANDARD
 *    on promotion. History (ratings, notes, audit log) is preserved on the
 *    same record.
 *  - We surface but do NOT enforce outstanding requirements (e.g. LDS) at
 *    promotion time. They become follow-ups on the standard profile (plan §9).
 *  - All state changes write to the existing
 *    `instructorApplicationTimelineEvent` table — no new audit log model.
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { getHiringActor, isAdmin, isHiringChair } from "@/lib/chapter-hiring-permissions";
import { InstructorSubtype } from "@prisma/client";
import {
  SUMMER_WORKSHOP_TIMELINE_KINDS,
  DEFAULT_PROMOTION_ELIGIBILITY,
  type PromotionEligibility,
} from "@/lib/summer-workshop";

export type PromoteToFullInstructorResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Promote a Summer Workshop Instructor applicant to the standard Instructor
 * subtype. Idempotent: calling on an already-standard applicant is a no-op.
 */
export async function promoteToFullInstructor(
  applicationId: string
): Promise<PromoteToFullInstructorResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "Not signed in." };

  const actor = await getHiringActor(session.user.id);
  if (!isAdmin(actor) && !isHiringChair(actor)) {
    return { ok: false, error: "Not authorized to promote applicants." };
  }

  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      instructorSubtype: true,
      applicationTrack: true,
      promotionEligibility: true,
    },
  });
  if (!application) return { ok: false, error: "Application not found." };

  if (application.instructorSubtype === InstructorSubtype.STANDARD) {
    return { ok: true };
  }

  const now = new Date();
  const existingEligibility =
    (application.promotionEligibility as PromotionEligibility | null) ??
    DEFAULT_PROMOTION_ELIGIBILITY;
  const updatedEligibility: PromotionEligibility = {
    ...existingEligibility,
    flaggedForPromotion: true,
    flaggedAt: now.toISOString(),
    flaggedBy: actor.id,
  };

  await prisma.$transaction([
    prisma.instructorApplication.update({
      where: { id: applicationId },
      data: {
        instructorSubtype: InstructorSubtype.STANDARD,
        subtypeChangedAt: now,
        subtypeChangedById: actor.id,
        promotionEligibility: updatedEligibility as object,
      },
    }),
    prisma.instructorApplicationTimelineEvent.create({
      data: {
        applicationId,
        kind: SUMMER_WORKSHOP_TIMELINE_KINDS.PROMOTED_TO_STANDARD,
        actorId: actor.id,
        payload: {
          previousSubtype: InstructorSubtype.SUMMER_WORKSHOP,
          newSubtype: InstructorSubtype.STANDARD,
          outstandingRequirements: existingEligibility.outstandingRequirements,
        },
      },
    }),
    prisma.instructorApplicationTimelineEvent.create({
      data: {
        applicationId,
        kind: SUMMER_WORKSHOP_TIMELINE_KINDS.SUBTYPE_CHANGED,
        actorId: actor.id,
        payload: {
          from: InstructorSubtype.SUMMER_WORKSHOP,
          to: InstructorSubtype.STANDARD,
          reason: "promotion",
        },
      },
    }),
  ]);

  revalidatePath(`/applications/instructor/${applicationId}`);
  revalidatePath("/admin/instructor-applicants");

  return { ok: true };
}
