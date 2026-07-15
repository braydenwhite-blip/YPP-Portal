/**
 * DB-backed review-routing exceptions (Phase 8 promotion of the plan's Phase 1
 * config-file exceptions). Loads active `ReviewRoutingException` rows and
 * merges them with the code-defined defaults in `lib/org/review-exceptions.ts`,
 * so existing behavior never changes on its own — admins add/override on top
 * via /admin/review-routing instead of editing code.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import {
  SELF_FINALIZE_EXCEPTIONS,
  BOARD_APPROVAL_REVIEW_ROUTES,
  type SelfFinalizeException,
  type BoardApprovalReviewRoute,
  type PersonRef,
} from "@/lib/org/review-exceptions";

export interface MergedReviewRoutingExceptions {
  selfFinalizeExceptions: SelfFinalizeException[];
  boardApprovalRoutes: BoardApprovalReviewRoute[];
}

function toPersonRef(id: string | null, name: string | null): PersonRef {
  return { id: id ?? undefined, name: name ?? undefined };
}

/** Load admin-configured exceptions and merge them with the code defaults. */
export async function loadReviewRoutingExceptions(): Promise<MergedReviewRoutingExceptions> {
  const rows = await prisma.reviewRoutingException.findMany({
    where: { isActive: true },
    include: {
      mentor: { select: { id: true, name: true } },
      mentee: { select: { id: true, name: true } },
    },
  });

  const dbSelfFinalize: SelfFinalizeException[] = [];
  const dbByMentor = new Map<string, PersonRef[]>();

  for (const row of rows) {
    if (row.kind !== "SELF_FINALIZE") continue;
    const mentorRef = toPersonRef(row.mentor?.id ?? row.mentorId, row.mentor?.name ?? row.mentorName);
    const menteeRef = toPersonRef(row.mentee?.id ?? row.menteeId, row.mentee?.name ?? row.menteeName);
    const key = mentorRef.id ?? mentorRef.name ?? row.id;
    const mentees = dbByMentor.get(key) ?? [];
    mentees.push(menteeRef);
    dbByMentor.set(key, mentees);
    if (mentees.length === 1) {
      dbSelfFinalize.push({
        mentor: mentorRef,
        mentees,
        effectiveFrom: row.effectiveFrom?.toISOString(),
        note: row.note ?? undefined,
      });
    }
  }

  const dbBoardRoutes: BoardApprovalReviewRoute[] = rows
    .filter((row) => row.kind === "BOARD_APPROVAL")
    .map((row) => ({
      mentor: toPersonRef(row.mentor?.id ?? row.mentorId, row.mentor?.name ?? row.mentorName),
      mentees: row.mentee || row.menteeName ? [toPersonRef(row.mentee?.id ?? row.menteeId, row.mentee?.name ?? row.menteeName)] : undefined,
      topInstructionMentees: row.topInstructionMentees,
      effectiveFrom: row.effectiveFrom?.toISOString(),
      note: row.note ?? undefined,
    }));

  return {
    selfFinalizeExceptions: [...SELF_FINALIZE_EXCEPTIONS, ...dbSelfFinalize],
    boardApprovalRoutes: [...BOARD_APPROVAL_REVIEW_ROUTES, ...dbBoardRoutes],
  };
}
