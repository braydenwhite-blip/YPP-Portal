/**
 * Data 360 — role/view lenses.
 *
 * Different leaders read the org differently. A lens reorders which KPI groups
 * lead on the Overview; it never hides data a leader is authorized to see (it is
 * an emphasis, not a permission). The route guard (`requireLeadership`) is what
 * actually authorizes access. Pure and client-safe.
 */

import type { KpiGroupKey } from "./types";

export const DATA_360_LENSES = [
  "executive",
  "operations",
  "expansion",
  "programs",
  "chapters",
] as const;
export type Data360Lens = (typeof DATA_360_LENSES)[number];

export const LENS_LABELS: Record<Data360Lens, string> = {
  executive: "Executive",
  operations: "Operations",
  expansion: "Expansion",
  programs: "Programs",
  chapters: "Chapter leadership",
};

export const LENS_BLURBS: Record<Data360Lens, string> = {
  executive: "The whole organization at a glance.",
  operations: "Work, meetings, and the hiring pipeline first.",
  expansion: "Chapter growth and partner development first.",
  programs: "Classes, programs, and enrollment first.",
  chapters: "Chapters and the people inside them first.",
};

/** All groups, in the canonical order used as the executive default. */
const ALL_GROUPS: KpiGroupKey[] = [
  "people",
  "programs",
  "chapters",
  "pipeline",
  "work",
  "partners",
  "fundraising",
];

/**
 * Per-lens group emphasis. Every lens still lists all groups (nothing hidden) —
 * the leading groups simply come first.
 */
export const LENS_GROUP_ORDER: Record<Data360Lens, KpiGroupKey[]> = {
  executive: ALL_GROUPS,
  operations: orderWith(["work", "pipeline", "people"]),
  expansion: orderWith(["chapters", "partners", "people"]),
  programs: orderWith(["programs", "people", "chapters"]),
  chapters: orderWith(["chapters", "people", "programs"]),
};

function orderWith(lead: KpiGroupKey[]): KpiGroupKey[] {
  const rest = ALL_GROUPS.filter((g) => !lead.includes(g));
  return [...lead, ...rest];
}

/** The sensible default lens for a viewer, by role. */
export function defaultLensForRole(
  primaryRole: string | null | undefined,
  internalLevel: number | null | undefined
): Data360Lens {
  if (internalLevel != null && internalLevel >= 6) return "executive";
  switch ((primaryRole ?? "").toUpperCase()) {
    case "CHAPTER_PRESIDENT":
      return "chapters";
    case "HIRING_CHAIR":
      return "operations";
    case "STAFF":
      return "operations";
    default:
      return "executive";
  }
}
