import { loadPeoplePerformance, type PeoplePerformanceRow } from "./people-performance";
import {
  peopleChairTier,
  quarterlyReviewTableStatus,
  sortQuarterlyReviewRows,
} from "./people-performance-selectors";
import { formatRoleLabel } from "@/lib/user-title";
import type { GoalRatingColor } from "@prisma/client";

export type QuarterlyReviewRow = {
  id: string;
  name: string;
  subtitle: string;
  performanceRating: GoalRatingColor | null;
  potentialRating: GoalRatingColor | null;
  statusLabel: string;
  statusTone: "success" | "warning" | "danger" | "neutral";
  personHref: string;
};

function mapRow(row: PeoplePerformanceRow): QuarterlyReviewRow {
  const name = row.name || row.email;
  const roleTitle = formatRoleLabel(row.role);
  const committee = peopleChairTier(row.role);
  const status = quarterlyReviewTableStatus(row.facts);

  return {
    id: row.id,
    name,
    subtitle: `${roleTitle} · committee ${committee}`,
    performanceRating: row.quarterly?.performanceRating ?? null,
    potentialRating: row.quarterly?.potentialRating ?? null,
    statusLabel: status.text,
    statusTone: status.tone,
    personHref: `/people/${row.id}`,
  };
}

export async function loadQuarterlyReviewsDashboard() {
  const { rows, currentQuarter } = await loadPeoplePerformance();
  const sorted = sortQuarterlyReviewRows(rows);
  return {
    currentQuarter,
    rows: sorted.map(mapRow),
  };
}
