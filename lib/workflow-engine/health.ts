// ============================================================================
// Universal Workflow Engine — pure health scoring
// ============================================================================
//
// Turns an instance + its current stage + executions into a single, honest
// health status plus a list of concrete, human-readable reasons (never a vague
// blob). Pure + deterministic (no Prisma, no server-only, "now" injected) —
// exactly the style of lib/workflow-engine/runtime.ts — so it is usable from a
// server loader, a cron, or a client component that already has the data.

import type {
  StepExecutionView,
  WorkflowInstanceStatusValue,
} from "@/lib/workflow-engine/types";

export type WorkflowHealthStatus =
  | "ON_TRACK"
  | "NEEDS_ATTENTION"
  | "BLOCKED"
  | "OVERDUE"
  | "STALLED"
  | "COMPLETE"
  | "ARCHIVED";

export type WorkflowHealth = {
  status: WorkflowHealthStatus;
  reasons: string[];
};

/** A workflow with zero activity for this many days after starting is "stalled". */
export const STALLED_NO_ACTIVITY_DAYS = 10;
/** A required step due within this many days (or already past due) needs its meeting scheduled. */
export const MEETING_SCHEDULING_LEAD_DAYS = 3;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const DONE_STATES = new Set(["COMPLETE", "SKIPPED"]);

/** Status precedence, worst-first: BLOCKED > OVERDUE > STALLED > NEEDS_ATTENTION > ON_TRACK. */
const STATUS_RANK: Record<WorkflowHealthStatus, number> = {
  BLOCKED: 0,
  OVERDUE: 1,
  STALLED: 2,
  NEEDS_ATTENTION: 3,
  ON_TRACK: 4,
  COMPLETE: 5,
  ARCHIVED: 5,
};

function worse(
  a: WorkflowHealthStatus,
  b: WorkflowHealthStatus
): WorkflowHealthStatus {
  return STATUS_RANK[a] <= STATUS_RANK[b] ? a : b;
}

function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function pluralDays(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

function isNonTerminal(exec: StepExecutionView): boolean {
  return exec.state === "PENDING" || exec.state === "IN_PROGRESS";
}

export function computeWorkflowHealth(input: {
  instance: {
    status: WorkflowInstanceStatusValue;
    dueAt: string | null;
    followUpAt: string | null;
    escalatedAt: string | null;
    startedAt: string;
    completionPercent: number;
  };
  currentStage: { key: string; slaHours: number | null; name: string } | null;
  /** ISO timestamp the instance entered currentStage, if known (from the most recent STAGE_ENTERED
      WorkflowEvent for that stage -- callers pass it in, this function does not fetch events). */
  currentStageEnteredAt: string | null;
  /** Expected: only the CURRENT stage's executions (this function scores "what's happening now",
      not the whole history — a completed earlier stage's steps shouldn't count toward overdue/owner
      findings for a workflow that has already moved on). */
  executions: StepExecutionView[];
  now: string; // ISO
}): WorkflowHealth {
  const { instance, currentStage, currentStageEnteredAt, executions, now } = input;

  if (instance.status === "COMPLETED") {
    return { status: "COMPLETE", reasons: [] };
  }
  if (instance.status === "CANCELLED") {
    return { status: "ARCHIVED", reasons: [] };
  }

  const nowMs = toMs(now) ?? Date.now();
  const reasons: string[] = [];
  let status: WorkflowHealthStatus = "ON_TRACK";

  // --- BLOCKED --------------------------------------------------------------
  const blockedExecs = executions.filter((e) => e.state === "BLOCKED");
  if (instance.status === "BLOCKED" || blockedExecs.length > 0) {
    status = worse(status, "BLOCKED");
    if (blockedExecs.length > 0) {
      for (const e of blockedExecs) {
        reasons.push(
          e.blockedReason
            ? `"${e.title}" is blocked: ${e.blockedReason}`
            : `"${e.title}" is blocked`
        );
      }
    } else {
      reasons.push("Workflow is blocked");
    }
  }

  // --- OVERDUE required steps -------------------------------------------------
  const overdueRequired = executions.filter(
    (e) =>
      e.isRequired &&
      isNonTerminal(e) &&
      toMs(e.dueAt) !== null &&
      (toMs(e.dueAt) as number) < nowMs
  );
  if (overdueRequired.length > 0) {
    status = worse(status, "OVERDUE");
    reasons.push(
      `${overdueRequired.length} required step${
        overdueRequired.length === 1 ? "" : "s"
      } overdue`
    );
  }

  // --- STALLED: no activity anywhere since start ------------------------------
  const hasAnyActivity = executions.some((e) => e.startedAt || e.completedAt);
  const startedMs = toMs(instance.startedAt);
  if (!hasAnyActivity && startedMs !== null) {
    const daysSinceStart = Math.floor((nowMs - startedMs) / DAY_MS);
    if (daysSinceStart >= STALLED_NO_ACTIVITY_DAYS) {
      status = worse(status, "STALLED");
      reasons.push(`No activity in ${pluralDays(daysSinceStart)}`);
    }
  }

  // --- Stage exceeding its SLA window -----------------------------------------
  if (
    currentStage &&
    currentStage.slaHours != null &&
    currentStage.slaHours > 0 &&
    currentStageEnteredAt
  ) {
    const enteredMs = toMs(currentStageEnteredAt);
    if (enteredMs !== null) {
      const slaMs = currentStage.slaHours * HOUR_MS;
      if (nowMs > enteredMs + slaMs) {
        status = worse(status, "NEEDS_ATTENTION");
        const overDays = Math.floor((nowMs - (enteredMs + slaMs)) / DAY_MS);
        const windowDays = Math.round(currentStage.slaHours / 24);
        reasons.push(
          `"${currentStage.name}" has run ${pluralDays(
            overDays
          )} past its expected ${windowDays}-day window`
        );
      }
    }
  }

  // --- Meeting steps not yet scheduled -----------------------------------------
  const unscheduledMeetings = executions.filter((e) => {
    if (e.kind !== "MEETING" || !e.isRequired || !isNonTerminal(e)) return false;
    if (e.linkedMeetingId) return false;
    const dueMs = toMs(e.dueAt);
    if (dueMs === null) return false;
    return dueMs <= nowMs + MEETING_SCHEDULING_LEAD_DAYS * DAY_MS;
  });
  if (unscheduledMeetings.length > 0) {
    status = worse(status, "NEEDS_ATTENTION");
    reasons.push("Meeting not scheduled");
  }

  // --- Missing owner ------------------------------------------------------------
  const noOwner = executions.filter(
    (e) => e.isRequired && isNonTerminal(e) && e.ownerId === null
  );
  if (noOwner.length > 0) {
    status = worse(status, "NEEDS_ATTENTION");
    reasons.push(
      noOwner.length === 1
        ? "1 step has no owner"
        : `${noOwner.length} steps have no owner`
    );
  }

  // --- Escalated (informational only) -------------------------------------------
  if (instance.escalatedAt) {
    reasons.push("Escalated to leadership");
  }

  if (reasons.length === 0) {
    return { status: "ON_TRACK", reasons: [] };
  }

  return { status, reasons };
}
