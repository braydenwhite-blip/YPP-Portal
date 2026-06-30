// ============================================================================
// Universal Workflow Engine — entity-status-triggered auto-start (server-only)
// ============================================================================
//
// A small, deliberately contained mechanism: when a real entity (e.g. a
// Chapter) transitions to a status a published template's WorkflowTrigger
// is watching, start an instance for that entity automatically. This is the
// ONE place WorkflowTrigger rows are evaluated — call fireEntityStatusChanged()
// from the small set of mutation sites that own a real status transition (see
// lib/chapters/actions.ts and lib/chapter-president-application-actions.ts for
// the two call sites wired in this pass). Do not wire this broadly; extending
// coverage to another entity/mutation site is a deliberate, one-line addition
// per site, not a generic listener.

import "server-only";

import { prisma } from "@/lib/prisma";
import { startInstance } from "@/lib/workflow-engine/engine";

export type FireEntityStatusChangedArgs = {
  /** RELATED_ENTITY_TYPE-style subject vocabulary, e.g. "CHAPTER". */
  subjectType: string;
  subjectId: string;
  newStatus: string;
  chapterId?: string | null;
  /** Owner for the new instance; falls back to the matched template's
   *  defaultOwnerRole/defaultOwnerSubtype resolution when omitted. */
  ownerId?: string | null;
  startedById?: string | null;
  now?: Date;
};

/** Evaluate enabled ENTITY_STATUS_CHANGED triggers for a status transition and
 *  start any matching, published templates' instances. Best-effort: a failed
 *  or no-op trigger never blocks the caller's own transaction/mutation —
 *  callers should invoke this AFTER their own status write commits. */
export async function fireEntityStatusChanged(args: FireEntityStatusChangedArgs): Promise<void> {
  const now = args.now ?? new Date();
  try {
    const triggers = await prisma.workflowTrigger.findMany({
      where: { event: "ENTITY_STATUS_CHANGED", subjectType: args.subjectType, enabled: true },
      include: { template: { select: { id: true, status: true, defaultOwnerRole: true, defaultOwnerSubtype: true } } },
    });

    for (const trigger of triggers) {
      const matchStatus = (trigger.matchConfig as Record<string, unknown> | null)?.status;
      if (typeof matchStatus !== "string" || matchStatus !== args.newStatus) continue;
      if (trigger.template.status !== "PUBLISHED") continue;

      const existing = await prisma.workflowInstance.findFirst({
        where: {
          templateId: trigger.template.id,
          subjectType: args.subjectType,
          subjectId: args.subjectId,
          status: { in: ["ACTIVE", "BLOCKED", "ON_HOLD"] },
        },
        select: { id: true },
      });
      if (existing) continue; // already running for this subject — don't double-start

      await startInstance({
        templateId: trigger.template.id,
        subjectType: args.subjectType,
        subjectId: args.subjectId,
        chapterId: args.chapterId ?? null,
        ownerId: args.ownerId ?? null,
        startedById: args.startedById ?? null,
        now,
      });
    }
  } catch (err) {
    // Mirrors the engine's automation philosophy: side-effects are best-effort
    // and never throw back into the caller's own mutation.
    console.error("[workflow-engine] fireEntityStatusChanged failed", err);
  }
}
