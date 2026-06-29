/**
 * Data 360 — KPI shaping (pure).
 *
 * Turns the flat counts the loader gathered into the ordered `Kpi[]` the
 * Overview renders, reading every label / group / drill-down / availability
 * from the metric registry so a metric is defined once. No DB, no scores —
 * tone here is cosmetic (which accent bar), never a quality grade.
 */

import { METRIC_REGISTRY } from "./registry";
import type { Kpi, MetricTone, ResolvedRange } from "./types";

/** Every number the Overview KPI strip needs, gathered by `overview.ts`. */
export type OverviewCounts = {
  totalStudents: number;
  studentsAdded: number;
  activeStudents: number;
  totalInstructors: number;
  instructorsAdded: number;
  activeInstructors: number;
  activeMentorships: number;

  activeClasses: number;
  completedClasses: number;
  activePrograms: number;
  totalEnrollments: number;

  totalChapters: number;
  activeChapters: number;
  chaptersAdded: number;

  applicationsPipeline: number;
  applicationsAwaitingReview: number;

  openActions: number;
  overdueActions: number;
  completedActions: number;
  meetingsCompleted: number;

  activePartners: number;
  partnersNeedFollowup: number;
};

const numberFmt = new Intl.NumberFormat("en-US");

export function formatCount(n: number): string {
  return numberFmt.format(n);
}

/** Keys whose total is meaningfully "+N added" within the range via createdAt. */
const DELTA_KEYS = new Set([
  "total_students",
  "total_instructors",
  "total_chapters",
]);

function toneFor(key: string, value: number): MetricTone {
  if (key === "overdue_actions") return value > 0 ? "danger" : "muted";
  if (key === "partners_need_followup") return value > 0 ? "warning" : "muted";
  if (key === "applications_awaiting_review")
    return value > 0 ? "warning" : "default";
  if (
    key === "active_students" ||
    key === "active_instructors" ||
    key === "active_chapters" ||
    key === "active_classes" ||
    key === "active_programs" ||
    key === "active_mentorships" ||
    key === "active_partners"
  ) {
    return "accent";
  }
  return "default";
}

export function buildKpis(
  counts: OverviewCounts,
  range: ResolvedRange
): Kpi[] {
  const valueByKey: Record<string, number> = {
    total_students: counts.totalStudents,
    active_students: counts.activeStudents,
    total_instructors: counts.totalInstructors,
    active_instructors: counts.activeInstructors,
    active_mentorships: counts.activeMentorships,
    active_classes: counts.activeClasses,
    completed_classes: counts.completedClasses,
    active_programs: counts.activePrograms,
    total_enrollments: counts.totalEnrollments,
    active_chapters: counts.activeChapters,
    total_chapters: counts.totalChapters,
    applications_pipeline: counts.applicationsPipeline,
    applications_awaiting_review: counts.applicationsAwaitingReview,
    open_actions: counts.openActions,
    overdue_actions: counts.overdueActions,
    completed_actions: counts.completedActions,
    meetings_completed: counts.meetingsCompleted,
    active_partners: counts.activePartners,
    partners_need_followup: counts.partnersNeedFollowup,
  };

  const deltaByKey: Record<string, number> = {
    total_students: counts.studentsAdded,
    total_instructors: counts.instructorsAdded,
    total_chapters: counts.chaptersAdded,
  };

  return METRIC_REGISTRY.map((def): Kpi => {
    if (!def.available) {
      return {
        key: def.key,
        label: def.name,
        value: null,
        display: "Unavailable",
        unit: "count",
        group: def.group,
        tone: "muted",
        href: def.drilldown,
        delta: null,
        hint: def.unavailableReason ?? null,
        available: false,
        unavailableReason: def.unavailableReason ?? null,
      };
    }

    const value = valueByKey[def.key] ?? 0;
    const showDelta =
      DELTA_KEYS.has(def.key) && range.key !== "all" && (deltaByKey[def.key] ?? 0) > 0;

    return {
      key: def.key,
      label: def.name,
      value,
      display: formatCount(value),
      unit: "count",
      group: def.group,
      tone: toneFor(def.key, value),
      href: def.drilldown,
      delta: showDelta
        ? {
            value: deltaByKey[def.key],
            label: `+${formatCount(deltaByKey[def.key])} ${range.sinceLabel}`,
          }
        : null,
      hint: null,
      available: true,
      unavailableReason: null,
    };
  });
}
