/**
 * Server-side readiness gate for the Lesson Design Studio capstone.
 *
 * Enforces the rule from `docs/instructor-training-rebuild.md` §4 Module 6:
 *   "Locked until Readiness Check is passed."
 *
 * Behavior summary:
 *   - Reviewers (ADMIN, CHAPTER_PRESIDENT) always bypass the gate.
 *   - If the Readiness Check module (M5) is not yet imported into the DB,
 *     access is allowed (backward compatibility before the import lands).
 *   - If M5 exists and the user's TrainingAssignment for it has status
 *     COMPLETE, access is allowed.
 *   - Otherwise the gate is locked.
 *
 * Server-only. Imports `prisma` directly; do not import from client code.
 */

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";

export const READINESS_CHECK_MODULE_KEY = "academy_readiness_check_005";

export type LessonDesignStudioGateReason =
  | "READY"
  | "REVIEWER_BYPASS"
  | "READINESS_CHECK_NOT_IMPORTED"
  | "READINESS_CHECK_REQUIRED";

export type LessonDesignStudioGateStatus =
  | { unlocked: true; reason: Exclude<LessonDesignStudioGateReason, "READINESS_CHECK_REQUIRED"> }
  | { unlocked: false; reason: "READINESS_CHECK_REQUIRED"; readinessCheckModuleId: string };

type RoleLike = string | null | undefined;

function isReviewer(roles: RoleLike[]): boolean {
  return roles.some((r) => r === "ADMIN" || r === "CHAPTER_PRESIDENT");
}

/**
 * Resolve whether the user should be allowed into the Lesson Design Studio.
 * Caller is responsible for the role-based access check (instructor/admin/etc.)
 * — this function only adds the Readiness-Check gate on top of that.
 */
export async function getLessonDesignStudioGateStatus(
  userId: string,
  roles: RoleLike[]
): Promise<LessonDesignStudioGateStatus> {
  if (isReviewer(roles)) {
    return { unlocked: true, reason: "REVIEWER_BYPASS" };
  }

  const m5Module = await withPrismaFallback(
    "lds-gate:readiness-module",
    () =>
      prisma.trainingModule.findUnique({
        where: { contentKey: READINESS_CHECK_MODULE_KEY },
        select: { id: true },
      }),
    null
  );

  if (!m5Module) {
    return { unlocked: true, reason: "READINESS_CHECK_NOT_IMPORTED" };
  }

  const assignment = await withPrismaFallback(
    "lds-gate:assignment",
    () =>
      prisma.trainingAssignment.findUnique({
        where: { userId_moduleId: { userId, moduleId: m5Module.id } },
        select: { status: true },
      }),
    null
  );

  if (assignment?.status === "COMPLETE") {
    return { unlocked: true, reason: "READY" };
  }

  return {
    unlocked: false,
    reason: "READINESS_CHECK_REQUIRED",
    readinessCheckModuleId: m5Module.id,
  };
}

/**
 * Convenience: when a hub or component needs the same data the LDS server
 * pages use, but already has the M5 module id and the user's assignment from
 * its own queries (avoiding double round-trips). Keeps the gate decision
 * logic in one place.
 */
export function evaluateLessonDesignStudioGateFromAssignment(opts: {
  roles: RoleLike[];
  readinessCheckModuleId: string | null | undefined;
  readinessCheckAssignmentStatus: string | null | undefined;
}): LessonDesignStudioGateStatus {
  if (isReviewer(opts.roles)) {
    return { unlocked: true, reason: "REVIEWER_BYPASS" };
  }
  if (!opts.readinessCheckModuleId) {
    return { unlocked: true, reason: "READINESS_CHECK_NOT_IMPORTED" };
  }
  if (opts.readinessCheckAssignmentStatus === "COMPLETE") {
    return { unlocked: true, reason: "READY" };
  }
  return {
    unlocked: false,
    reason: "READINESS_CHECK_REQUIRED",
    readinessCheckModuleId: opts.readinessCheckModuleId,
  };
}
