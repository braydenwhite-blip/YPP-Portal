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
 * Server-only. The async `getLessonDesignStudioGateStatus` delegates to
 * `getInstructorReadiness` so the readiness aggregate, hub card, and LDS
 * route hard-gate all share one decision source.
 */

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
 *
 * Reviewer roles short-circuit without touching the DB. Otherwise this
 * delegates to `getInstructorReadiness`, which loads required modules, the
 * user's assignments, and the user's roles in a single batch and computes
 * the gate inline. Single source of truth for the gate decision.
 */
export async function getLessonDesignStudioGateStatus(
  userId: string,
  roles: RoleLike[]
): Promise<LessonDesignStudioGateStatus> {
  if (isReviewer(roles)) {
    return { unlocked: true, reason: "REVIEWER_BYPASS" };
  }
  // Lazy import to avoid the circular `instructor-readiness → gate-helper →
  // instructor-readiness` cycle at module-evaluation time.
  const { getInstructorReadiness } = await import("@/lib/instructor-readiness");
  const readiness = await getInstructorReadiness(userId);
  return readiness.lessonDesignStudioGate;
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
