/**
 * Pure helper for computing per-module unlock state in the training hub.
 *
 * Modules are linearly gated by `sortOrder` — each required module must be
 * COMPLETE before the next required module unlocks. Non-required modules are
 * always UNLOCKED regardless of prior state.
 *
 * No IO, no side effects. Takes plain arrays, returns a plain array.
 */

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

/** Snapshot of a required training module for unlock computation. */
export type ModuleForUnlock = {
  id: string;
  contentKey: string | null;
  sortOrder: number;
  required: boolean;
};

/** Snapshot of a user's TrainingAssignment row. */
export type AssignmentForUnlock = {
  moduleId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
};

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export type ModuleUnlockState = {
  moduleId: string;
  contentKey: string | null;
  sortOrder: number;
  status: "LOCKED" | "UNLOCKED" | "IN_PROGRESS" | "COMPLETE";
};

// ---------------------------------------------------------------------------
// computeModuleUnlockState
// ---------------------------------------------------------------------------

/**
 * Compute per-module unlock state for the hub.
 *
 * **Unlock rules (plan §2, §4):**
 * - Modules are linearly gated by `sortOrder` (ascending).
 * - The **first** required module (by `sortOrder`) is always UNLOCKED — it
 *   is never LOCKED regardless of assignment state.
 * - A subsequent required module unlocks when the **prior** required module
 *   has assignment status COMPLETE.
 * - Non-required modules are always UNLOCKED (they don't gate anyone else).
 * - If the user already has a COMPLETE assignment → status = `COMPLETE`.
 * - If IN_PROGRESS → status = `IN_PROGRESS`.
 * - Otherwise → `UNLOCKED` if the module is unlocked, `LOCKED` if not.
 *
 * @param modules     - All training modules (unsorted input is fine).
 * @param assignments - The user's assignment rows (may be empty).
 * @returns Array of `ModuleUnlockState` sorted by `sortOrder` ascending.
 */
export function computeModuleUnlockState(
  modules: ModuleForUnlock[],
  assignments: AssignmentForUnlock[]
): ModuleUnlockState[] {
  // Sort modules by sortOrder ascending for linear processing.
  const sorted = [...modules].sort((a, b) => a.sortOrder - b.sortOrder);

  // Build a fast lookup for assignment status.
  const assignmentMap = new Map<string, AssignmentForUnlock["status"]>();
  for (const assignment of assignments) {
    assignmentMap.set(assignment.moduleId, assignment.status);
  }

  // Linear pass: track whether the previous required module was COMPLETE.
  // The first required module is always unlocked, so we start with `true`.
  let prevRequiredComplete = true;

  const result: ModuleUnlockState[] = [];

  for (const mod of sorted) {
    const assignmentStatus = assignmentMap.get(mod.id) ?? "NOT_STARTED";

    let unlocked: boolean;

    if (!mod.required) {
      // Non-required modules are always UNLOCKED.
      unlocked = true;
    } else {
      // Required module: unlocked iff prev required module is complete (or
      // this is the first required module, in which case prevRequiredComplete
      // starts as true).
      unlocked = prevRequiredComplete;

      // Update the gate for the *next* required module.
      prevRequiredComplete = assignmentStatus === "COMPLETE";
    }

    let status: ModuleUnlockState["status"];

    if (!unlocked) {
      status = "LOCKED";
    } else if (assignmentStatus === "COMPLETE") {
      status = "COMPLETE";
    } else if (assignmentStatus === "IN_PROGRESS") {
      status = "IN_PROGRESS";
    } else {
      status = "UNLOCKED";
    }

    result.push({
      moduleId: mod.id,
      contentKey: mod.contentKey,
      sortOrder: mod.sortOrder,
      status,
    });
  }

  return result;
}
