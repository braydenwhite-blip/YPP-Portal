import type { RegularInstructorAssignmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isActionTrackerEmailsEnabled } from "@/lib/feature-flags";
import { requireCPO, hasRole, hasAnyAdminSubtype } from "@/lib/authorization";
import type { SessionUser } from "@/lib/auth-supabase";
import { sendFeedbackRequestEmail } from "@/lib/email";
import { toAbsoluteAppUrl } from "@/lib/public-app-url";

/**
 * People Strategy — confidential 360 feedback requests.
 *
 * `sendFeedbackRequest(subjectUserId, month)` finds the subject's recent
 * collaborators (from Action Items, classes, and mentorship — the best
 * documented working relationships in the portal), creates one
 * `FeedbackRequest` row per collaborator for that month, and emails them a link
 * to the confidential form.
 *
 * Reads of `responseBody` are CPO/Board-only (`getFeedbackResponsesForSubject`
 * calls `requireCPO()`); the subject can never read raw responses. The whole
 * surface is gated by ENABLE_ACTION_TRACKER_EMAILS.
 */

/** Normalize any date to the first of its UTC month (the `month` key). */
export function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export type CollaboratorRef = { id: string; name: string | null; email: string | null };

/** Active assignment states that count as a live class collaboration. */
const ACTIVE_ASSIGNMENT_STATUSES: RegularInstructorAssignmentStatus[] = [
  "INSTRUCTOR_CONFIRMED",
  "CHAPTER_CONFIRMED",
  "FULLY_CONFIRMED",
  "OFFERED",
  "PENDING_REVIEW",
];

/**
 * Recent collaborators of `subjectUserId`, deduped and excluding the subject
 * themselves. Pulls from three documented sources:
 *   1. Action Items — anyone sharing an assignment (or lead) on an item the
 *      subject leads or is assigned to (updated within `sinceDays`).
 *   2. Mentorship — the other party on the subject's active pairings
 *      (mentor / mentee / chair).
 *   3. Classes — co-instructors on offerings the subject leads or is an active
 *      assigned instructor on.
 */
export async function findRecentCollaborators(
  subjectUserId: string,
  sinceDays = 120
): Promise<CollaboratorRef[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const found = new Map<string, CollaboratorRef>();
  const add = (u: CollaboratorRef | null | undefined) => {
    if (!u || u.id === subjectUserId) return;
    if (!found.has(u.id)) found.set(u.id, u);
  };
  const userSelect = { id: true, name: true, email: true } as const;

  // 1. Action Items the subject leads or is assigned to.
  const actionItems = await prisma.actionItem.findMany({
    where: {
      updatedAt: { gte: since },
      OR: [{ leadId: subjectUserId }, { assignments: { some: { userId: subjectUserId } } }],
    },
    select: {
      lead: { select: userSelect },
      assignments: { select: { user: { select: userSelect } } },
    },
  });
  for (const item of actionItems) {
    add(item.lead);
    for (const a of item.assignments) add(a.user);
  }

  // 2. Active mentorship pairings (the other party).
  const mentorships = await prisma.mentorship.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ mentorId: subjectUserId }, { menteeId: subjectUserId }, { chairId: subjectUserId }],
    },
    select: {
      mentor: { select: userSelect },
      mentee: { select: userSelect },
      chair: { select: userSelect },
    },
  });
  for (const m of mentorships) {
    add(m.mentor);
    add(m.mentee);
    add(m.chair);
  }

  // 3. Classes — offerings the subject leads, or is an active assigned
  //    instructor on — gather the lead + co-assigned instructors.
  const offerings = await prisma.classOffering.findMany({
    where: {
      OR: [
        { instructorId: subjectUserId },
        {
          regularInstructorAssignments: {
            some: { instructorId: subjectUserId, status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
          },
        },
      ],
    },
    select: {
      instructor: { select: userSelect },
      regularInstructorAssignments: {
        where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } },
        select: { instructor: { select: userSelect } },
      },
    },
  });
  for (const o of offerings) {
    add(o.instructor);
    for (const a of o.regularInstructorAssignments) add(a.instructor);
  }

  return Array.from(found.values());
}

export type SendFeedbackRequestResult = {
  collaborators: number;
  created: number;
  emailsSent: number;
};

/**
 * Create feedback requests for `subjectUserId`'s recent collaborators for the
 * given month and email each one. Idempotent: the unique
 * (subject, collaborator, month) constraint means re-running only creates rows
 * for collaborators that don't already have one, and emails go out only for
 * those newly created requests. No-op unless ENABLE_ACTION_TRACKER_EMAILS.
 */
export async function sendFeedbackRequest(
  subjectUserId: string,
  month: Date
): Promise<SendFeedbackRequestResult> {
  if (!isActionTrackerEmailsEnabled()) {
    return { collaborators: 0, created: 0, emailsSent: 0 };
  }

  const monthKey = monthStart(month);
  const label = monthLabel(monthKey);

  const subject = await prisma.user.findUnique({
    where: { id: subjectUserId },
    select: { id: true, name: true, email: true },
  });
  if (!subject) throw new Error("Subject user not found");

  const collaborators = await findRecentCollaborators(subjectUserId);

  let created = 0;
  let emailsSent = 0;

  for (const collaborator of collaborators) {
    // Create only if one doesn't already exist for this month (idempotent).
    // `createMany({ skipDuplicates })` lets the DB enforce the race cleanly.
    const result = await prisma.feedbackRequest.createMany({
      data: [{ subjectUserId, collaboratorId: collaborator.id, month: monthKey }],
      skipDuplicates: true,
    });
    if (result.count === 0) continue; // already requested this month
    created++;

    if (!collaborator.email) continue;
    try {
      await sendFeedbackRequestEmail({
        to: collaborator.email,
        recipientName: collaborator.name,
        subjectName: subject.name || subject.email || "a colleague",
        monthLabel: label,
        formUrl: toAbsoluteAppUrl(
          `/people-strategy/feedback/${await feedbackRequestId(subjectUserId, collaborator.id, monthKey)}`
        ),
      });
      emailsSent++;
    } catch (err) {
      logger.error(
        { err, subjectUserId, collaboratorId: collaborator.id },
        "feedback-request: email send failed"
      );
    }
  }

  logger.info(
    { subjectUserId, collaborators: collaborators.length, created, emailsSent },
    "feedback-request: sent"
  );
  return { collaborators: collaborators.length, created, emailsSent };
}

/** Resolve the id of the (just-created) request so the email can link to it. */
async function feedbackRequestId(
  subjectUserId: string,
  collaboratorId: string,
  month: Date
): Promise<string> {
  const row = await prisma.feedbackRequest.findUnique({
    where: {
      subjectUserId_collaboratorId_month: { subjectUserId, collaboratorId, month },
    },
    select: { id: true },
  });
  return row?.id ?? "";
}

export type CollaboratorFeedbackRequest = {
  id: string;
  month: Date;
  responseBody: string | null;
  submittedAt: Date | null;
  subjectUser: { id: string; name: string | null };
};

/**
 * The feedback request a collaborator is being asked to fill in. Returns null
 * unless the viewer IS the collaborator on the request (or the feature is off /
 * the request doesn't exist). This NEVER exposes other collaborators' responses
 * or the subject's aggregate feedback — only the viewer's own request.
 */
export async function getFeedbackRequestForCollaborator(
  requestId: string,
  collaboratorId: string
): Promise<CollaboratorFeedbackRequest | null> {
  if (!isActionTrackerEmailsEnabled()) return null;

  const request = await prisma.feedbackRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      collaboratorId: true,
      month: true,
      responseBody: true,
      submittedAt: true,
      subjectUser: { select: { id: true, name: true } },
    },
  });
  if (!request || request.collaboratorId !== collaboratorId) return null;

  return {
    id: request.id,
    month: request.month,
    responseBody: request.responseBody,
    submittedAt: request.submittedAt,
    subjectUser: request.subjectUser,
  };
}

export type SubjectFeedbackResponse = {
  id: string;
  month: Date;
  submittedAt: Date | null;
  responseBody: string | null;
  collaborator: { id: string; name: string | null; email: string | null };
};

/**
 * All feedback responses about a subject — CONFIDENTIAL. Calls `requireCPO()`
 * first, so only ADMIN users with the CPO or SUPER_ADMIN (Board) subtype can
 * read raw `responseBody`. The subject themselves cannot read these unless they
 * are also CPO/Board. Throws "Unauthorized" otherwise.
 */
export async function getFeedbackResponsesForSubject(
  subjectUserId: string,
  month?: Date
): Promise<SubjectFeedbackResponse[]> {
  await requireCPO(); // throws Unauthorized for non-CPO/Board

  const rows = await prisma.feedbackRequest.findMany({
    where: {
      subjectUserId,
      ...(month ? { month: monthStart(month) } : {}),
    },
    orderBy: [{ month: "desc" }, { submittedAt: "desc" }],
    select: {
      id: true,
      month: true,
      submittedAt: true,
      responseBody: true,
      collaborator: { select: { id: true, name: true, email: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    month: r.month,
    submittedAt: r.submittedAt,
    responseBody: r.responseBody,
    collaborator: r.collaborator,
  }));
}

/** Non-throwing CPO/Board check, for conditional UI (not a security boundary). */
export function isCpoOrBoard(user: Pick<SessionUser, "roles" | "primaryRole" | "adminSubtypes">): boolean {
  return (
    hasRole(user.roles, "ADMIN", user.primaryRole) &&
    hasAnyAdminSubtype(user.adminSubtypes, ["CPO", "SUPER_ADMIN"])
  );
}
