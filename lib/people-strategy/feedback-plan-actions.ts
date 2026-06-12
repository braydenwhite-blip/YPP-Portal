"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireLeadership } from "@/lib/authorization";
import {
  isActionTrackerEmailsEnabled,
  isPeopleDashboardEnabled,
  isQuarterlyReviewsEnabled,
} from "@/lib/feature-flags";
import { sendMonthlyFeedbackRequestEmail } from "@/lib/email";
import { toAbsoluteAppUrl } from "@/lib/public-app-url";
import { formatDueDateLong } from "@/lib/leadership-action-center/dates";

import { buildFeedbackRequestEmailContent } from "./feedback-email-content";
import { getFeedbackResponsesForSubject } from "./feedback-requests";
import {
  suggestFeedbackCollaborators,
  type SuggestedFeedbackCollaborator,
} from "./feedback-plan";
import {
  allowedFeedbackMonths,
  monthKeyUTC,
  monthLabelUTC,
  parseMonthKey,
  type FeedbackMonthOption,
} from "./people-performance-selectors";

/**
 * People & Performance — the REVIEWABLE monthly feedback request workflow.
 *
 * Unlike the legacy bulk `requestMonthlyFeedback` (which emailed every recent
 * collaborator with no review step), this flow is two-phase:
 *
 *   1. `prepareMonthlyFeedbackPlan` — loads the suggested collaborators WITH
 *      their reasons and shared work, plus which of them were already asked
 *      for each selectable month, so Leadership reviews exactly who would be
 *      contacted and why before anything is sent.
 *   2. `sendPlannedFeedbackRequests` — creates `FeedbackRequest` rows for the
 *      APPROVED recipients only and emails them. Reasons and context are
 *      recomputed server-side at send time (client input is ids only — never
 *      trusted for content), and persisted on the row so the recipient's form
 *      shows the same evidence.
 *
 * Both actions are Leadership/Board only (`requireLeadership()`) and gated by
 * ENABLE_PEOPLE_DASHBOARD + ENABLE_ACTION_TRACKER_EMAILS, matching the legacy
 * surface. Results are reported honestly: created vs already-requested vs
 * email-failed are separate counts — a queued/failed email is never claimed
 * as sent.
 */

function assertFeatureEnabled(): void {
  if (!isPeopleDashboardEnabled() || !isActionTrackerEmailsEnabled()) {
    throw new Error("Monthly feedback requests are not enabled");
  }
}

const REPLY_WINDOW_DAYS = 7;

export type MonthlyFeedbackPlan = {
  subject: {
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    title: string | null;
  };
  /** Selectable target months (current + two previous). */
  months: FeedbackMonthOption[];
  defaultMonthKey: string;
  /** Reply-by date the email will state ("Friday, June 19, 2026"). */
  dueDateLabel: string;
  suggestions: SuggestedFeedbackCollaborator[];
  /** monthKey -> collaborator ids already asked for that month. */
  alreadyRequestedByMonth: Record<string, string[]>;
};

const PrepareSchema = z.object({
  subjectUserId: z.string().min(1),
});

export async function prepareMonthlyFeedbackPlan(
  input: z.input<typeof PrepareSchema>
): Promise<MonthlyFeedbackPlan> {
  assertFeatureEnabled();
  await requireLeadership();

  const { subjectUserId } = PrepareSchema.parse(input);
  const now = new Date();
  const months = allowedFeedbackMonths(now);

  const subject = await prisma.user.findUnique({
    where: { id: subjectUserId },
    select: { id: true, name: true, email: true, primaryRole: true, title: true },
  });
  if (!subject) throw new Error("Member not found");

  const monthStarts = months
    .map((m) => parseMonthKey(m.key))
    .filter((d): d is Date => d !== null);

  const [suggestions, existing] = await Promise.all([
    suggestFeedbackCollaborators(subjectUserId),
    prisma.feedbackRequest.findMany({
      where: { subjectUserId, month: { in: monthStarts } },
      select: { collaboratorId: true, month: true },
    }),
  ]);

  const alreadyRequestedByMonth: Record<string, string[]> = {};
  for (const m of months) alreadyRequestedByMonth[m.key] = [];
  for (const row of existing) {
    alreadyRequestedByMonth[monthKeyUTC(row.month)]?.push(row.collaboratorId);
  }

  return {
    subject: {
      id: subject.id,
      name: subject.name,
      email: subject.email,
      role: subject.primaryRole,
      title: subject.title,
    },
    months,
    defaultMonthKey: months[0].key,
    dueDateLabel: formatDueDateLong(
      new Date(now.getTime() + REPLY_WINDOW_DAYS * 86_400_000)
    ),
    suggestions,
    alreadyRequestedByMonth,
  };
}

const SendSchema = z.object({
  subjectUserId: z.string().min(1),
  /** "2026-06" — must be one of the allowed months. */
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  collaboratorIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one recipient.")
    .max(30, "Too many recipients selected at once."),
});

export type SendPlannedFeedbackInput = z.input<typeof SendSchema>;

export type SendPlannedFeedbackResult = {
  ok: true;
  /** New FeedbackRequest rows created this call. */
  created: number;
  /** Recipients skipped because this month's request already existed. */
  alreadyRequested: number;
  /** Chosen ids that are no longer suggested collaborators (stale UI). */
  notSuggested: number;
  /** Emails confirmed handed to the provider. */
  emailsSent: number;
  /** Requests created but whose email failed or had no address on file. */
  emailsNotSent: number;
};

export async function sendPlannedFeedbackRequests(
  input: SendPlannedFeedbackInput
): Promise<SendPlannedFeedbackResult> {
  assertFeatureEnabled();
  const viewer = await requireLeadership();

  const { subjectUserId, monthKey, collaboratorIds } = SendSchema.parse(input);

  const now = new Date();
  const allowed = allowedFeedbackMonths(now);
  if (!allowed.some((m) => m.key === monthKey)) {
    throw new Error("Target month must be the current month or one of the two before it");
  }
  const month = parseMonthKey(monthKey);
  if (!month) throw new Error("Invalid target month");
  const monthLabel = monthLabelUTC(month);

  const subject = await prisma.user.findUnique({
    where: { id: subjectUserId },
    select: { id: true, name: true, email: true },
  });
  if (!subject) throw new Error("Member not found");
  const subjectName = subject.name || subject.email || "a colleague";

  // Recompute the suggestions server-side: the client sends ids only, and
  // anyone not currently backed by real shared work is refused.
  const suggestions = await suggestFeedbackCollaborators(subjectUserId);
  const suggestionById = new Map(suggestions.map((s) => [s.id, s]));

  const dueAt = new Date(now.getTime() + REPLY_WINDOW_DAYS * 86_400_000);
  const dueDateLabel = formatDueDateLong(dueAt);

  let created = 0;
  let alreadyRequested = 0;
  let notSuggested = 0;
  let emailsSent = 0;
  let emailsNotSent = 0;

  for (const collaboratorId of Array.from(new Set(collaboratorIds))) {
    const suggestion = suggestionById.get(collaboratorId);
    if (!suggestion) {
      notSuggested++;
      continue;
    }

    let requestId: string;
    try {
      const row = await prisma.feedbackRequest.create({
        data: {
          subjectUserId,
          collaboratorId,
          month,
          requestedById: viewer.id,
          reason: suggestion.reasons.join("; "),
          contextItems: suggestion.contextItems as unknown as Prisma.InputJsonValue,
          dueAt,
        },
        select: { id: true },
      });
      requestId = row.id;
      created++;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        alreadyRequested++; // (subject, collaborator, month) already asked
        continue;
      }
      throw err;
    }

    if (!suggestion.email) {
      emailsNotSent++;
      continue;
    }
    try {
      const content = buildFeedbackRequestEmailContent({
        recipientName: suggestion.name,
        subjectName,
        monthLabel,
        dueDateLabel,
        workItems: suggestion.contextItems.map((item) =>
          item.detail ? `${item.title} — ${item.detail}` : item.title
        ),
      });
      const result = await sendMonthlyFeedbackRequestEmail({
        to: suggestion.email,
        content,
        formUrl: toAbsoluteAppUrl(`/people-strategy/feedback/${requestId}`),
      });
      if (result.success) emailsSent++;
      else emailsNotSent++;
    } catch (err) {
      emailsNotSent++;
      logger.error(
        { err, subjectUserId, collaboratorId },
        "feedback-plan: email send failed"
      );
    }
  }

  logger.info(
    { subjectUserId, monthKey, created, alreadyRequested, notSuggested, emailsSent, emailsNotSent },
    "feedback-plan: requests sent"
  );

  revalidatePath("/people/performance");
  revalidatePath(`/admin/instructors/${subjectUserId}`);

  return { ok: true, created, alreadyRequested, notSuggested, emailsSent, emailsNotSent };
}

// ── Feedback review (request → responses → check-in) ────────────────────────

export type FeedbackReviewResponse = {
  id: string;
  collaboratorName: string;
  submittedAtISO: string;
  responseBody: string;
};

export type FeedbackReviewMonth = {
  monthKey: string;
  /** "June 2026" */
  monthLabel: string;
  /** Answered requests, newest first — the confidential bodies. */
  submitted: FeedbackReviewResponse[];
  /** Collaborators asked for this month who haven't answered yet. */
  pending: Array<{ id: string; collaboratorName: string }>;
  /** The compiled CheckIn for this month, if one exists. */
  checkIn: {
    performanceRating: GoalRatingColorValue | null;
    compiledAtISO: string;
  } | null;
};

/** Mirror of the Prisma enum, kept as a string union so the client component
 *  doesn't need the Prisma runtime types for a display value. */
export type GoalRatingColorValue =
  | "BEHIND_SCHEDULE"
  | "GETTING_STARTED"
  | "ACHIEVED"
  | "ABOVE_AND_BEYOND";

export type FeedbackReview = {
  subject: { id: string; name: string | null };
  /** Months with at least one request, newest first. */
  months: FeedbackReviewMonth[];
  /** False when ENABLE_QUARTERLY_REVIEWS is off — compile is unavailable. */
  canCompile: boolean;
};

const ReviewSchema = z.object({
  subjectUserId: z.string().min(1),
});

/**
 * Everything Leadership needs to read a member's feedback and close the loop:
 * the CONFIDENTIAL responses grouped by month (newest first), who is still
 * pending, and whether each month already has a compiled CheckIn.
 *
 * The body read goes through `getFeedbackResponsesForSubject`, which enforces
 * `requireLeadership()` itself — re-asserted here so the boundary holds even
 * if that internal changes. Page-level flag: ENABLE_PEOPLE_DASHBOARD (reading
 * responses does not require the emails flag — requests may predate it).
 */
export async function loadFeedbackReviewForSubject(
  input: z.input<typeof ReviewSchema>
): Promise<FeedbackReview> {
  if (!isPeopleDashboardEnabled()) {
    throw new Error("The People dashboard is not enabled");
  }
  await requireLeadership();

  const { subjectUserId } = ReviewSchema.parse(input);

  const subject = await prisma.user.findUnique({
    where: { id: subjectUserId },
    select: { id: true, name: true, email: true },
  });
  if (!subject) throw new Error("Member not found");

  const responses = await getFeedbackResponsesForSubject(subjectUserId);

  const byMonth = new Map<string, FeedbackReviewMonth>();
  for (const row of responses) {
    const monthKey = monthKeyUTC(row.month);
    let month = byMonth.get(monthKey);
    if (!month) {
      month = {
        monthKey,
        monthLabel: monthLabelUTC(row.month),
        submitted: [],
        pending: [],
        checkIn: null,
      };
      byMonth.set(monthKey, month);
    }
    const collaboratorName =
      row.collaborator.name || row.collaborator.email || "Unnamed collaborator";
    if (row.submittedAt && row.responseBody) {
      month.submitted.push({
        id: row.id,
        collaboratorName,
        submittedAtISO: row.submittedAt.toISOString(),
        responseBody: row.responseBody,
      });
    } else {
      month.pending.push({ id: row.id, collaboratorName });
    }
  }

  // Attach the compiled CheckIn state for each month that has requests.
  const monthStarts = Array.from(byMonth.keys())
    .map((key) => parseMonthKey(key))
    .filter((d): d is Date => d !== null);
  if (monthStarts.length > 0) {
    const checkIns = await prisma.checkIn.findMany({
      where: { userId: subjectUserId, month: { in: monthStarts } },
      select: { month: true, performanceRating: true, createdAt: true },
    });
    for (const checkIn of checkIns) {
      const month = byMonth.get(monthKeyUTC(checkIn.month));
      if (month) {
        month.checkIn = {
          performanceRating: checkIn.performanceRating,
          compiledAtISO: checkIn.createdAt.toISOString(),
        };
      }
    }
  }

  // Newest month first; within a month, newest response first.
  const months = Array.from(byMonth.values()).sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey)
  );
  for (const month of months) {
    month.submitted.sort((a, b) => b.submittedAtISO.localeCompare(a.submittedAtISO));
  }

  return {
    subject: { id: subject.id, name: subject.name ?? subject.email },
    months,
    canCompile: isQuarterlyReviewsEnabled(),
  };
}
