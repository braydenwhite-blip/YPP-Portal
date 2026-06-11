// Student Advisor caseload + coverage math — pure functions over
// assignment-shaped rows. Used by the advisor dashboard, the admin leadership
// dashboard, and tests; no Prisma access here.

import type { AdvisingStatus } from "@prisma/client";
import {
  ADVISOR_ACTIVE_WINDOW_DAYS,
  ADVISOR_INACTIVE_AFTER_DAYS,
  CASELOAD_HIGH_THRESHOLD,
  CASELOAD_LOW_THRESHOLD,
} from "./constants";

export type AssignmentLike = {
  advisorId: string;
  studentId: string;
  isActive: boolean;
  advisingStatus: AdvisingStatus;
  needsFollowUp: boolean;
  lastCheckInAt: Date | null;
  startDate: Date;
};

export type CaseloadBand = "HIGH" | "TYPICAL" | "LOW";

export function caseloadBand(activeCount: number): CaseloadBand {
  if (activeCount >= CASELOAD_HIGH_THRESHOLD) return "HIGH";
  if (activeCount <= CASELOAD_LOW_THRESHOLD) return "LOW";
  return "TYPICAL";
}

export type AdvisorActivityHealth = "ACTIVE" | "STALE" | "INACTIVE";

/**
 * Whether the advisor is actually doing the role, judged by their most recent
 * check-in across the caseload: within 30 days = ACTIVE, within 60 = STALE,
 * older or never (with a caseload older than the active window) = INACTIVE.
 * A brand-new caseload with no check-ins yet counts as ACTIVE until the
 * window elapses.
 */
export function advisorActivityHealth(
  assignments: AssignmentLike[],
  now: Date = new Date(),
): AdvisorActivityHealth {
  const active = assignments.filter((a) => a.isActive);
  if (active.length === 0) return "INACTIVE";

  const dayMs = 24 * 60 * 60 * 1000;
  const lastCheckIn = active
    .map((a) => a.lastCheckInAt?.getTime() ?? 0)
    .reduce((max, t) => Math.max(max, t), 0);

  if (lastCheckIn > 0) {
    const days = (now.getTime() - lastCheckIn) / dayMs;
    if (days <= ADVISOR_ACTIVE_WINDOW_DAYS) return "ACTIVE";
    if (days <= ADVISOR_INACTIVE_AFTER_DAYS) return "STALE";
    return "INACTIVE";
  }

  // Never checked in: grace period from the newest assignment start.
  const newestStart = active
    .map((a) => a.startDate.getTime())
    .reduce((max, t) => Math.max(max, t), 0);
  const daysSinceStart = (now.getTime() - newestStart) / dayMs;
  if (daysSinceStart <= ADVISOR_ACTIVE_WINDOW_DAYS) return "ACTIVE";
  if (daysSinceStart <= ADVISOR_INACTIVE_AFTER_DAYS) return "STALE";
  return "INACTIVE";
}

export type AdvisorCaseloadSummary = {
  advisorId: string;
  activeCount: number;
  needsFollowUpCount: number;
  needsAttentionCount: number;
  band: CaseloadBand;
  health: AdvisorActivityHealth;
  lastCheckInAt: Date | null;
};

export function summarizeAdvisorCaseloads(
  assignments: AssignmentLike[],
  now: Date = new Date(),
): AdvisorCaseloadSummary[] {
  const byAdvisor = new Map<string, AssignmentLike[]>();
  for (const assignment of assignments) {
    const list = byAdvisor.get(assignment.advisorId) ?? [];
    list.push(assignment);
    byAdvisor.set(assignment.advisorId, list);
  }

  return Array.from(byAdvisor.entries()).map(([advisorId, rows]) => {
    const active = rows.filter((a) => a.isActive);
    const lastCheckInTime = active
      .map((a) => a.lastCheckInAt?.getTime() ?? 0)
      .reduce((max, t) => Math.max(max, t), 0);
    return {
      advisorId,
      activeCount: active.length,
      needsFollowUpCount: active.filter((a) => a.needsFollowUp).length,
      needsAttentionCount: active.filter(
        (a) => a.advisingStatus === "NEEDS_ATTENTION",
      ).length,
      band: caseloadBand(active.length),
      health: advisorActivityHealth(rows, now),
      lastCheckInAt: lastCheckInTime > 0 ? new Date(lastCheckInTime) : null,
    };
  });
}

/** Student ids with no active advisor assignment. */
export function studentsWithoutAdvisor(
  studentIds: string[],
  assignments: AssignmentLike[],
): string[] {
  const advised = new Set(
    assignments.filter((a) => a.isActive).map((a) => a.studentId),
  );
  return studentIds.filter((id) => !advised.has(id));
}

/** Active assignments flagged for follow-up or marked needs-attention. */
export function assignmentsNeedingFollowUp<T extends AssignmentLike>(
  assignments: T[],
): T[] {
  return assignments.filter(
    (a) =>
      a.isActive && (a.needsFollowUp || a.advisingStatus === "NEEDS_ATTENTION"),
  );
}
