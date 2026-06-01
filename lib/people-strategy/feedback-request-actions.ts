"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireCPO, requireSessionUser } from "@/lib/authorization";
import {
  isActionTrackerEmailsEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";

import { sendFeedbackRequest } from "./feedback-requests";

/**
 * People Strategy — feedback response submission.
 *
 * Follows the `lib/*-actions.ts` convention: `"use server"`, a guard first, zod
 * validation, prisma write, then `revalidatePath`. Only the collaborator named
 * on the request may submit it — the SERVER-resolved session is the source of
 * truth, never a client-supplied id. Gated by ENABLE_ACTION_TRACKER_EMAILS.
 */

const RequestMonthlyFeedbackSchema = z.object({
  /** One or more subjects to request monthly feedback about. */
  subjectUserIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one member.")
    .max(100, "Too many members selected at once."),
});

export type RequestMonthlyFeedbackInput = z.input<typeof RequestMonthlyFeedbackSchema>;

export type RequestMonthlyFeedbackResult = {
  ok: true;
  /** How many subjects were processed. */
  subjects: number;
  /** Total recent collaborators found across all subjects. */
  collaborators: number;
  /** New `FeedbackRequest` rows created (idempotent — skips existing). */
  created: number;
  /** Emails actually sent for the newly created requests. */
  emailsSent: number;
};

/**
 * Request monthly feedback about one or more subjects from their recent
 * collaborators (the "Request Monthly Feedback" button on the CPO People
 * Dashboard). CPO/Board only — `requireCPO()` enforces the boundary server-side.
 * Gated by BOTH ENABLE_PEOPLE_DASHBOARD and ENABLE_ACTION_TRACKER_EMAILS.
 *
 * Delegates to `sendFeedbackRequest(subjectUserId, month)` per subject for the
 * current month; that call is idempotent, so re-running only emails newly
 * created requests. Revalidates the dashboard + each member detail so the
 * last-requested status refreshes.
 */
export async function requestMonthlyFeedback(
  input: RequestMonthlyFeedbackInput
): Promise<RequestMonthlyFeedbackResult> {
  if (!isPeopleDashboardEnabled() || !isActionTrackerEmailsEnabled()) {
    throw new Error("Monthly feedback requests are not enabled");
  }

  await requireCPO(); // CPO/Board only — throws "Unauthorized" otherwise

  const { subjectUserIds } = RequestMonthlyFeedbackSchema.parse(input);
  const uniqueIds = Array.from(new Set(subjectUserIds));
  const month = new Date();

  let collaborators = 0;
  let created = 0;
  let emailsSent = 0;

  for (const subjectUserId of uniqueIds) {
    const result = await sendFeedbackRequest(subjectUserId, month);
    collaborators += result.collaborators;
    created += result.created;
    emailsSent += result.emailsSent;
    revalidatePath(`/admin/instructors/${subjectUserId}`);
  }

  revalidatePath("/people");

  return { ok: true, subjects: uniqueIds.length, collaborators, created, emailsSent };
}

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
