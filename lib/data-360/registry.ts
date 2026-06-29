/**
 * Data 360 — metric registry (the Data Dictionary).
 *
 * The single source of truth for every Phase-1 metric: what it means, where it
 * comes from (model + field), how fresh it is, who can see it, and where it
 * drills down to. The Data Dictionary tab renders this verbatim, and the KPI
 * builder reads label/group/href/availability from here so a metric is defined
 * in exactly ONE place.
 *
 * Adding a metric = adding a registry entry. This is the contract the Phase-5
 * SaaS generalization builds on (roadmap §6).
 */

import type { KpiGroupKey } from "./types";

export type MetricCadence = "real-time" | "daily" | "on-write";
export type MetricVisibility = "leadership" | "officer" | "admin";

export type MetricDefinition = {
  key: string;
  name: string;
  description: string;
  /** The concrete derivation, e.g. "User where primaryRole=STUDENT, archivedAt=null". */
  source: string;
  cadence: MetricCadence;
  visibility: MetricVisibility;
  /** Where this number's underlying records live. */
  drilldown: string | null;
  group: KpiGroupKey;
  available: boolean;
  unavailableReason?: string;
};

export const METRIC_REGISTRY: MetricDefinition[] = [
  // --- People -----------------------------------------------------------------
  {
    key: "total_students",
    name: "Total students",
    description: "Every student account in the portal that has not been archived.",
    source: "User · primaryRole = STUDENT · archivedAt IS NULL",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/admin/students",
    group: "people",
    available: true,
  },
  {
    key: "active_students",
    name: "Active students",
    description: "Students with at least one current (ENROLLED) class enrollment.",
    source: "ClassEnrollment · status = ENROLLED · distinct studentId",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/admin/students",
    group: "people",
    available: true,
  },
  {
    key: "total_instructors",
    name: "Total instructors",
    description: "Every instructor account that has not been archived.",
    source: "User · primaryRole = INSTRUCTOR · archivedAt IS NULL",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/admin/instructors",
    group: "people",
    available: true,
  },
  {
    key: "active_instructors",
    name: "Active instructors",
    description:
      "Instructors teaching a class that is published or currently in progress.",
    source: "ClassOffering · status IN (PUBLISHED, IN_PROGRESS) · distinct instructorId",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/admin/instructors",
    group: "people",
    available: true,
  },
  {
    key: "active_mentorships",
    name: "Active mentorships",
    description: "Mentor–mentee pairings currently marked active.",
    source: "Mentorship · status = ACTIVE",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/admin/mentorship",
    group: "people",
    available: true,
  },

  // --- Programs & classes -----------------------------------------------------
  {
    key: "active_classes",
    name: "Active classes",
    description: "Class offerings that are published or in progress.",
    source: "ClassOffering · status IN (PUBLISHED, IN_PROGRESS)",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/admin/classes",
    group: "programs",
    available: true,
  },
  {
    key: "completed_classes",
    name: "Classes completed",
    description: "Class offerings that have finished.",
    source: "ClassOffering · status = COMPLETED",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/admin/classes",
    group: "programs",
    available: true,
  },
  {
    key: "active_programs",
    name: "Active programs",
    description:
      "Special programs (passion labs, summer workshops, competitions, sequences) marked active.",
    source: "SpecialProgram · isActive = true",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/programs",
    group: "programs",
    available: true,
  },
  {
    key: "total_enrollments",
    name: "Current enrollments",
    description: "Active student seats across all class offerings.",
    source: "ClassEnrollment · status = ENROLLED",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/admin/classes",
    group: "programs",
    available: true,
  },

  // --- Chapters ---------------------------------------------------------------
  {
    key: "active_chapters",
    name: "Active chapters",
    description: "Chapters whose lifecycle status is Active.",
    source: "Chapter · lifecycleStatus = ACTIVE · archivedAt IS NULL",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/admin/chapters",
    group: "chapters",
    available: true,
  },
  {
    key: "total_chapters",
    name: "Total chapters",
    description:
      "Every chapter on record (any lifecycle stage) that has not been archived.",
    source: "Chapter · archivedAt IS NULL",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/admin/chapters",
    group: "chapters",
    available: true,
  },

  // --- Hiring pipeline --------------------------------------------------------
  {
    key: "applications_pipeline",
    name: "Applications in pipeline",
    description:
      "Instructor applications that are not yet approved, rejected, or withdrawn.",
    source:
      "InstructorApplication · status NOT IN (APPROVED, REJECTED, WITHDRAWN)",
    cadence: "real-time",
    visibility: "officer",
    drilldown: "/admin/instructor-applicants",
    group: "pipeline",
    available: true,
  },
  {
    key: "applications_awaiting_review",
    name: "Awaiting review",
    description: "Applications submitted or under review, waiting on YPP.",
    source: "InstructorApplication · status IN (SUBMITTED, UNDER_REVIEW)",
    cadence: "real-time",
    visibility: "officer",
    drilldown: "/admin/instructor-applicants",
    group: "pipeline",
    available: true,
  },

  // --- Work & meetings --------------------------------------------------------
  {
    key: "open_actions",
    name: "Open actions",
    description: "Action-tracker items not started or in progress.",
    source: "ActionItem · status IN (NOT_STARTED, IN_PROGRESS)",
    cadence: "real-time",
    visibility: "officer",
    drilldown: "/actions/all",
    group: "work",
    available: true,
  },
  {
    key: "overdue_actions",
    name: "Overdue actions",
    description: "Open actions past their deadline, or flagged overdue.",
    source:
      "ActionItem · status = OVERDUE OR (open AND deadlineEnd < now)",
    cadence: "real-time",
    visibility: "officer",
    drilldown: "/actions/all?status=OVERDUE",
    group: "work",
    available: true,
  },
  {
    key: "completed_actions",
    name: "Actions completed",
    description: "Action-tracker items marked complete within the selected period.",
    source: "ActionItem · status = COMPLETE · completedAt in range",
    cadence: "real-time",
    visibility: "officer",
    drilldown: "/actions/all",
    group: "work",
    available: true,
  },
  {
    key: "meetings_completed",
    name: "Meetings completed",
    description: "Meetings marked completed within the selected period.",
    source: "Meeting · status = COMPLETED · scheduledAt in range",
    cadence: "real-time",
    visibility: "officer",
    drilldown: "/meetings",
    group: "work",
    available: true,
  },

  // --- Partners ---------------------------------------------------------------
  {
    key: "active_partners",
    name: "Active partners",
    description:
      "Partner organizations with a live pipeline stage (not closed, declined, archived, or not-started).",
    source: "Partner · stage set and not inactive · archivedAt IS NULL",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/partners",
    group: "partners",
    available: true,
  },
  {
    key: "partners_need_followup",
    name: "Partners needing follow-up",
    description:
      "Active partners with no scheduled next touch, or a follow-up already past due.",
    source: "Partner · active AND (nextFollowUpAt IS NULL OR nextFollowUpAt < now)",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: "/partners",
    group: "partners",
    available: true,
  },

  // --- Fundraising (no data source yet) --------------------------------------
  {
    key: "fundraising_total",
    name: "Fundraising raised",
    description:
      "Total dollars raised. No fundraising/donation model exists in the portal yet, so this metric has no source.",
    source: "—",
    cadence: "real-time",
    visibility: "leadership",
    drilldown: null,
    group: "fundraising",
    available: false,
    unavailableReason:
      "No fundraising, donation, or campaign model exists in the schema. Adding one (or a MetricSnapshot feed) would source this.",
  },
];

const REGISTRY_BY_KEY = new Map(METRIC_REGISTRY.map((m) => [m.key, m]));

export function getMetric(key: string): MetricDefinition | undefined {
  return REGISTRY_BY_KEY.get(key);
}
