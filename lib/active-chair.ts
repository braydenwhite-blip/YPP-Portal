import { prisma } from "@/lib/prisma";

/**
 * Single active-Chair authority.
 *
 * Exactly one user is the "active Chair" at any time — the only person allowed
 * to make a final applicant decision (approve / reject / hold / request another
 * interview / submit or change the final rationale). The assignment is stored
 * centrally in a singleton `ActiveChairAssignment` row (NOT per-applicant), so
 * reassigning the Chair is a single write that instantly transfers decision
 * permission. Every change is mirrored into `ChairAssignmentHistory`.
 *
 * Authorization is identity-based: it compares the authenticated user's ID
 * against the currently assigned Chair's user ID. It deliberately does NOT key
 * off role names (Chair / officer / leadership / board / super admin) — the
 * user must be the one currently assigned active Chair.
 */

export const ACTIVE_CHAIR_SINGLETON_ID = "singleton";

/** Shown to authorized non-Chair viewers in place of active decision buttons. */
export const NON_CHAIR_DECISION_MESSAGE =
  "Only the currently assigned Chair can submit the final decision.";

export type ActiveChairUser = {
  id: string;
  name: string | null;
  email: string;
} | null;

/** Minimal shape needed to compare identities. */
type UserIdentity = { id: string } | null | undefined;
type ChairIdentity =
  | { id: string }
  | { userId: string }
  | { chairUserId: string }
  | string
  | null
  | undefined;

function resolveChairId(chair: ChairIdentity): string | null {
  if (!chair) return null;
  if (typeof chair === "string") return chair || null;
  if ("id" in chair) return chair.id || null;
  if ("userId" in chair) return chair.userId || null;
  if ("chairUserId" in chair) return chair.chairUserId || null;
  return null;
}

/**
 * Centralized final-decision authorization. Returns `true` only when the
 * authenticated user's ID matches the currently assigned Chair's user ID.
 *
 * Pure and synchronous so it can be reused everywhere (workspace, decision
 * buttons, server actions, API routes, mutations, decision edits, tests)
 * against an already-loaded active Chair.
 */
export function canMakeFinalApplicantDecision(
  user: UserIdentity,
  activeChair: ChairIdentity
): boolean {
  const userId = user?.id ?? null;
  const chairId = resolveChairId(activeChair);
  return Boolean(userId && chairId && userId === chairId);
}

/** The full active-Chair user record, or `null` if none assigned. */
export async function getActiveChair(): Promise<ActiveChairUser> {
  const row = await prisma.activeChairAssignment.findUnique({
    where: { id: ACTIVE_CHAIR_SINGLETON_ID },
    select: { chair: { select: { id: true, name: true, email: true } } },
  });
  return row?.chair ?? null;
}

/** Just the active Chair's user ID, or `null` if none assigned. */
export async function getActiveChairUserId(): Promise<string | null> {
  const row = await prisma.activeChairAssignment.findUnique({
    where: { id: ACTIVE_CHAIR_SINGLETON_ID },
    select: { chairUserId: true },
  });
  return row?.chairUserId ?? null;
}

/** Server-side guard mirroring `canMakeFinalApplicantDecision`. */
export async function assertCanMakeFinalApplicantDecision(
  userId: string | null | undefined
): Promise<void> {
  const chairId = await getActiveChairUserId();
  if (!canMakeFinalApplicantDecision(userId ? { id: userId } : null, chairId)) {
    throw new Error(NON_CHAIR_DECISION_MESSAGE);
  }
}

export type SetActiveChairResult =
  | { success: true; previousChairId: string | null; newChairId: string }
  | { success: false; error: string };

/**
 * Assign a new active Chair, replacing whoever held it before. Because the
 * assignment is a singleton row, the previous Chair is automatically and
 * atomically removed — there can never be two active Chairs. The change is
 * recorded in `ChairAssignmentHistory`.
 */
export async function setActiveChair(
  newChairUserId: string,
  changedByUserId: string
): Promise<SetActiveChairResult> {
  const trimmedNew = newChairUserId?.trim();
  if (!trimmedNew) {
    return { success: false, error: "Select a user to assign as Chair." };
  }

  const candidate = await prisma.user.findUnique({
    where: { id: trimmedNew },
    select: { id: true },
  });
  if (!candidate) {
    return { success: false, error: "That user could not be found." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.activeChairAssignment.findUnique({
      where: { id: ACTIVE_CHAIR_SINGLETON_ID },
      select: { chairUserId: true },
    });
    const previousChairId = current?.chairUserId ?? null;

    if (previousChairId === trimmedNew) {
      // No-op: the requested Chair already holds the seat. Don't write a
      // misleading history row.
      return { previousChairId, newChairId: trimmedNew, changed: false };
    }

    await tx.activeChairAssignment.upsert({
      where: { id: ACTIVE_CHAIR_SINGLETON_ID },
      create: {
        id: ACTIVE_CHAIR_SINGLETON_ID,
        chairUserId: trimmedNew,
        assignedById: changedByUserId,
      },
      update: {
        chairUserId: trimmedNew,
        assignedById: changedByUserId,
      },
    });

    await tx.chairAssignmentHistory.create({
      data: {
        previousChairId,
        newChairId: trimmedNew,
        changedById: changedByUserId,
      },
    });

    return { previousChairId, newChairId: trimmedNew, changed: true };
  });

  return {
    success: true,
    previousChairId: result.previousChairId,
    newChairId: result.newChairId,
  };
}

export type ChairHistoryEntry = {
  id: string;
  previousChair: { id: string; name: string | null } | null;
  newChair: { id: string; name: string | null } | null;
  changedBy: { id: string; name: string | null } | null;
  createdAt: string;
};

/** Recent Chair reassignments, newest first. */
export async function getChairAssignmentHistory(
  limit = 20
): Promise<ChairHistoryEntry[]> {
  const rows = await prisma.chairAssignmentHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      previousChair: { select: { id: true, name: true } },
      newChair: { select: { id: true, name: true } },
      changedBy: { select: { id: true, name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    previousChair: row.previousChair ?? null,
    newChair: row.newChair ?? null,
    changedBy: row.changedBy ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
