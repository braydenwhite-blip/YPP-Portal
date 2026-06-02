"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireCPO } from "@/lib/authorization";
import { isProvisionalClockEnabled } from "@/lib/feature-flags";

/**
 * People Strategy — provisional hire confirmation (ENABLE_PROVISIONAL_CLOCK).
 *
 * The Month-3 confirmation decision is recorded through the existing Quarterly
 * Review form/workflow; this action is the final "confirm the hire" step that
 * clears the provisional state. Gated to senior leadership / Board via
 * `requireCPO()` (the same guard the Quarterly Review submission uses), matching
 * the confirmation criterion "senior leadership or Board approval".
 *
 * Idempotent: only flips `provisionalConfirmedAt` when the user is currently
 * provisional (a start set, not already confirmed).
 */

const ConfirmSchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

export interface ConfirmProvisionalResult {
  confirmed: boolean;
  confirmedAt: string | null;
}

export async function confirmProvisionalHire(
  userId: string
): Promise<ConfirmProvisionalResult> {
  if (!isProvisionalClockEnabled()) {
    throw new Error("Provisional clock is not enabled");
  }
  await requireCPO();
  const { userId: id } = ConfirmSchema.parse({ userId });

  const now = new Date();
  // Only confirm a user who is actually provisional and not yet confirmed.
  const updated = await prisma.user.updateMany({
    where: { id, provisionalStart: { not: null }, provisionalConfirmedAt: null },
    data: { provisionalConfirmedAt: now },
  });

  revalidatePath(`/admin/instructors/${id}`);
  revalidatePath("/people");

  if (updated.count === 0) {
    // Either not provisional or already confirmed — return current state.
    const user = await prisma.user.findUnique({
      where: { id },
      select: { provisionalConfirmedAt: true },
    });
    return {
      confirmed: user?.provisionalConfirmedAt != null,
      confirmedAt: user?.provisionalConfirmedAt?.toISOString() ?? null,
    };
  }

  return { confirmed: true, confirmedAt: now.toISOString() };
}
