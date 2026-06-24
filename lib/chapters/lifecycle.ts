// Chapter lifecycle: the canonical stage of a chapter across the national
// pipeline. This is the source of truth leadership/system manages. The DISPLAYED
// "health" label (On Track / Needs Support / At Risk / Paused) is computed
// separately from concrete signals — see lib/chapters/health.ts.
//
// Pure module: no Prisma client calls, only a type import, so it stays unit
// testable without a database.

import type { ChapterLifecycleStatus } from "@prisma/client";

export const CHAPTER_LIFECYCLE_STATUSES = [
  "PROSPECT",
  "APPROVED",
  "LAUNCHING",
  "ACTIVE",
  "NEEDS_SUPPORT",
  "AT_RISK",
  "PAUSED",
  "ALUMNI",
] as const;

export type ChapterLifecycle = (typeof CHAPTER_LIFECYCLE_STATUSES)[number];

export const CHAPTER_LIFECYCLE_LABELS: Record<ChapterLifecycle, string> = {
  PROSPECT: "Prospect",
  APPROVED: "Approved",
  LAUNCHING: "Launching",
  ACTIVE: "Active",
  NEEDS_SUPPORT: "Needs Support",
  AT_RISK: "At Risk",
  PAUSED: "Paused",
  ALUMNI: "Alumni / Closed",
};

export const CHAPTER_LIFECYCLE_DESCRIPTIONS: Record<ChapterLifecycle, string> = {
  PROSPECT: "A school/community we want a chapter in — no approved president yet.",
  APPROVED: "A Chapter President is approved; chapter setup can begin.",
  LAUNCHING: "Working through the launch checklist toward the first meeting.",
  ACTIVE: "Running: meetings, members, and programs are underway.",
  NEEDS_SUPPORT: "Active but slipping — needs a nudge or help from national.",
  AT_RISK: "At risk of stalling out — needs leadership intervention now.",
  PAUSED: "Temporarily inactive (e.g. summer break) by agreement.",
  ALUMNI: "Closed or graduated — kept for history and impact totals.",
};

export type ChapterBadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand";

export const CHAPTER_LIFECYCLE_TONE: Record<ChapterLifecycle, ChapterBadgeTone> = {
  PROSPECT: "neutral",
  APPROVED: "info",
  LAUNCHING: "brand",
  ACTIVE: "success",
  NEEDS_SUPPORT: "warning",
  AT_RISK: "danger",
  PAUSED: "neutral",
  ALUMNI: "neutral",
};

export function chapterLifecycleLabel(status: ChapterLifecycleStatus | string): string {
  return CHAPTER_LIFECYCLE_LABELS[status as ChapterLifecycle] ?? String(status);
}

export function chapterLifecycleTone(
  status: ChapterLifecycleStatus | string
): ChapterBadgeTone {
  return CHAPTER_LIFECYCLE_TONE[status as ChapterLifecycle] ?? "neutral";
}

// A chapter is "launching" while it works the launch checklist.
export function isLaunchingStatus(status: ChapterLifecycleStatus | string): boolean {
  return status === "APPROVED" || status === "LAUNCHING";
}

// A chapter is "operating" once it has launched (active or any active-with-risk
// flavour). PAUSED/ALUMNI are not operating; PROSPECT/APPROVED/LAUNCHING are
// pre-launch.
export function isOperatingStatus(status: ChapterLifecycleStatus | string): boolean {
  return status === "ACTIVE" || status === "NEEDS_SUPPORT" || status === "AT_RISK";
}

export function isTerminalStatus(status: ChapterLifecycleStatus | string): boolean {
  return status === "ALUMNI";
}

// Leadership Chapter Command views. Lifecycle-based views filter on the stored
// `lifecycleStatus`; signal-based views (computed from health/meetings) are
// resolved in the loader, not here.
export type ChapterCommandView = {
  key: string;
  label: string;
  // null = all chapters; otherwise filter by these lifecycle statuses.
  statuses: ChapterLifecycle[] | null;
  // signal-based views are computed in the loader and have no status filter.
  signal?:
    | "no_upcoming_meeting"
    | "waiting_on_cp"
    | "waiting_on_ypp"
    | "recently_launched"
    | "high_performing";
};

export const CHAPTER_COMMAND_VIEWS: ChapterCommandView[] = [
  { key: "all", label: "All", statuses: null },
  { key: "launching", label: "Launching", statuses: ["APPROVED", "LAUNCHING"] },
  { key: "active", label: "Active", statuses: ["ACTIVE", "NEEDS_SUPPORT", "AT_RISK"] },
  { key: "needs_support", label: "Needs Support", statuses: ["NEEDS_SUPPORT"] },
  { key: "at_risk", label: "At Risk", statuses: ["AT_RISK"] },
  { key: "no_upcoming_meeting", label: "No Upcoming Meeting", statuses: null, signal: "no_upcoming_meeting" },
  { key: "waiting_on_cp", label: "Waiting on CP", statuses: null, signal: "waiting_on_cp" },
  { key: "waiting_on_ypp", label: "Waiting on YPP", statuses: null, signal: "waiting_on_ypp" },
  { key: "recently_launched", label: "Recently Launched", statuses: null, signal: "recently_launched" },
  { key: "high_performing", label: "High Performing", statuses: null, signal: "high_performing" },
  { key: "prospect", label: "Prospects", statuses: ["PROSPECT"] },
  { key: "paused", label: "Paused", statuses: ["PAUSED"] },
  { key: "alumni", label: "Alumni / Closed", statuses: ["ALUMNI"] },
];

export function resolveChapterCommandView(key: string | undefined | null): ChapterCommandView {
  return CHAPTER_COMMAND_VIEWS.find((v) => v.key === key) ?? CHAPTER_COMMAND_VIEWS[0];
}

// Statuses leadership may set by hand from the command center. We allow the full
// set; the system also moves chapters automatically (PROSPECT→…→LAUNCHING on CP
// approval, LAUNCHING→ACTIVE when the launch checklist completes).
export const CHAPTER_MANUAL_STATUSES: ChapterLifecycle[] = [
  "PROSPECT",
  "APPROVED",
  "LAUNCHING",
  "ACTIVE",
  "NEEDS_SUPPORT",
  "AT_RISK",
  "PAUSED",
  "ALUMNI",
];

export function isValidChapterLifecycleStatus(value: string): value is ChapterLifecycle {
  return (CHAPTER_LIFECYCLE_STATUSES as readonly string[]).includes(value);
}
