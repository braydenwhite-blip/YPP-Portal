/**
 * Append-only audit-log writer for ClassOffering admin actions.
 *
 * Every admin/reviewer action that mutates an offering or its approval
 * record should call recordOfferingTimeline so the /admin/classes/[id]
 * page can render an authoritative "who did what when" feed without
 * having to grep application logs.
 *
 * Failures are swallowed — journaling must never block a successful
 * write to the underlying offering. We log to console so an alerting
 * pipeline can pick up systematic failures.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OfferingTimelineKind =
  | "PROPOSAL_SUBMITTED"
  | "PROPOSAL_APPROVED"
  | "PROPOSAL_CHANGES_REQUESTED"
  | "PROPOSAL_REJECTED"
  | "PUBLISHED"
  | "UNPUBLISHED"
  | "ENROLLMENT_OPENED"
  | "ENROLLMENT_CLOSED"
  | "CANCELLED"
  | "COMPLETED"
  | "CAPACITY_CHANGED"
  | "INSTRUCTOR_REASSIGNED"
  | "WAITLIST_PROMOTION"
  | "ENROLLMENT_STATUS_CHANGED"
  | "NOTE";

export async function recordOfferingTimeline(args: {
  offeringId: string;
  actorId: string | null;
  kind: OfferingTimelineKind;
  summary?: string | null;
  payload?: Prisma.InputJsonValue | null;
}): Promise<void> {
  const { offeringId, actorId, kind, summary, payload } = args;
  try {
    await prisma.classOfferingTimelineEvent.create({
      data: {
        offeringId,
        actorId,
        kind,
        summary: summary ?? null,
        payload: payload ?? Prisma.DbNull,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[class-offering-timeline] failed to record event", {
      offeringId,
      kind,
      error: (error as Error)?.message,
    });
  }
}

export async function getOfferingTimeline(offeringId: string, take = 50) {
  return prisma.classOfferingTimelineEvent.findMany({
    where: { offeringId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  });
}
