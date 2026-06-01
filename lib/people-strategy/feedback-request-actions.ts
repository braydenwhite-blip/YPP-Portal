"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";
import { isActionTrackerEmailsEnabled } from "@/lib/feature-flags";

/**
 * People Strategy — feedback response submission.
 *
 * Follows the `lib/*-actions.ts` convention: `"use server"`, a guard first, zod
 * validation, prisma write, then `revalidatePath`. Only the collaborator named
 * on the request may submit it — the SERVER-resolved session is the source of
 * truth, never a client-supplied id. Gated by ENABLE_ACTION_TRACKER_EMAILS.
 */

const SubmitSchema = z.object({
  requestId: z.string().min(1, "Missing request id"),
  responseBody: z
    .string()
    .trim()
    .min(1, "Please write your feedback before submitting.")
    .max(10_000, "Feedback is too long."),
});

export type SubmitFeedbackResponseInput = z.infer<typeof SubmitSchema>;

export async function submitFeedbackResponse(
  input: SubmitFeedbackResponseInput
): Promise<{ ok: true; submittedAt: Date }> {
  if (!isActionTrackerEmailsEnabled()) {
    throw new Error("Feedback requests are not enabled");
  }

  const { requestId, responseBody } = SubmitSchema.parse(input);
  const sessionUser = await requireSessionUser();

  const request = await prisma.feedbackRequest.findUnique({
    where: { id: requestId },
    select: { id: true, collaboratorId: true },
  });

  // Same "not found" surface whether it's missing or not the viewer's request —
  // never reveal that someone else's request exists.
  if (!request || request.collaboratorId !== sessionUser.id) {
    throw new Error("Unauthorized");
  }

  const submittedAt = new Date();
  await prisma.feedbackRequest.update({
    where: { id: requestId },
    data: { responseBody, submittedAt },
  });

  revalidatePath(`/people-strategy/feedback/${requestId}`);
  return { ok: true, submittedAt };
}
