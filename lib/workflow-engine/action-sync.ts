// ============================================================================
// Universal Workflow Engine — Action <-> Workflow Step sync (server-only)
// ============================================================================
//
// The reverse direction from lib/workflow-engine/engine.ts's CREATE_ACTION
// automation: ActionItem stays the real task system, and this module reacts
// to its mutations by nudging the linked WorkflowStepExecution (found via
// linkedActionItemId) forward. Side-effects are best-effort — never let a
// failure here propagate back into the caller's own ActionItem mutation.

import "server-only";

import { prisma } from "@/lib/prisma";
import { completeStep, blockStep, reassignStep } from "@/lib/workflow-engine/engine";

const TERMINAL_STATES = new Set(["COMPLETE", "SKIPPED"]);

/** An ActionItem reached COMPLETE — complete its linked step, if any, so the
 *  workflow can react (automations + auto-advance) and never explicitly.  */
export async function onActionItemCompleted(
  actionItemId: string,
  actorId: string | null,
  now?: Date
): Promise<void> {
  try {
    const execution = await prisma.workflowStepExecution.findFirst({
      where: { linkedActionItemId: actionItemId },
    });
    if (!execution || TERMINAL_STATES.has(execution.state)) return;
    await completeStep(execution.id, { actorId, now });
  } catch (err) {
    console.error("[workflow-engine] onActionItemCompleted failed", err);
  }
}

/** An ActionItem was marked BLOCKED with a reason — block its linked step. */
export async function onActionItemBlocked(
  actionItemId: string,
  reason: string,
  actorId: string | null,
  now?: Date
): Promise<void> {
  try {
    const execution = await prisma.workflowStepExecution.findFirst({
      where: { linkedActionItemId: actionItemId },
    });
    if (!execution || TERMINAL_STATES.has(execution.state)) return;
    await blockStep(execution.id, reason, { actorId, now });
  } catch (err) {
    console.error("[workflow-engine] onActionItemBlocked failed", err);
  }
}

/** An ActionItem's LEAD was reassigned — mirror the new owner onto its
 *  linked step so step ownership never drifts from the action's real lead. */
export async function onActionItemReassigned(
  actionItemId: string,
  newOwnerId: string
): Promise<void> {
  try {
    const execution = await prisma.workflowStepExecution.findFirst({
      where: { linkedActionItemId: actionItemId },
    });
    if (!execution) return;
    await reassignStep(execution.id, newOwnerId);
  } catch (err) {
    console.error("[workflow-engine] onActionItemReassigned failed", err);
  }
}
