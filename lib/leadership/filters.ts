// Admin leadership dashboard filtering/grouping — pure helpers over
// serialized contribution rows so the client table and tests share one
// implementation.

import type {
  LeadershipContributionStatus,
  LeadershipExpectedLevel,
  LeadershipRoleCategory,
} from "@prisma/client";
import { LEADERSHIP_ROLE_CATALOG } from "./constants";

export type ContributionRow = {
  id: string;
  instructorId: string;
  instructorName: string;
  category: LeadershipRoleCategory;
  title: string;
  status: LeadershipContributionStatus;
  expectedLevel: LeadershipExpectedLevel;
  weight: number;
  isOwnership: boolean;
  reviewVisible: boolean;
  relatedLabel: string | null;
  adminOwnerName: string | null;
  startDate: string;
  endDate: string | null;
  lastActivityAt: string | null;
};

export type ContributionFilters = {
  category?: LeadershipRoleCategory | "ALL";
  instructorId?: string | "ALL";
  level?: LeadershipExpectedLevel | "ALL";
  status?: LeadershipContributionStatus | "ALL";
  search?: string;
};

export function filterContributions(
  rows: ContributionRow[],
  filters: ContributionFilters,
): ContributionRow[] {
  const search = filters.search?.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.category && filters.category !== "ALL" && row.category !== filters.category) {
      return false;
    }
    if (
      filters.instructorId &&
      filters.instructorId !== "ALL" &&
      row.instructorId !== filters.instructorId
    ) {
      return false;
    }
    if (filters.level && filters.level !== "ALL" && row.expectedLevel !== filters.level) {
      return false;
    }
    if (filters.status && filters.status !== "ALL" && row.status !== filters.status) {
      return false;
    }
    if (search) {
      const haystack =
        `${row.instructorName} ${row.title} ${row.relatedLabel ?? ""} ${row.adminOwnerName ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function groupByInstructor(
  rows: ContributionRow[],
): Map<string, ContributionRow[]> {
  const groups = new Map<string, ContributionRow[]>();
  for (const row of rows) {
    const list = groups.get(row.instructorId) ?? [];
    list.push(row);
    groups.set(row.instructorId, list);
  }
  return groups;
}

/**
 * Ownership areas (committee, subject/class lead, partner lead, recruitment,
 * training, student success, mentorship, curriculum, initiatives) with no
 * ACTIVE or ASSIGNED contribution — the gaps an admin should fill next.
 */
export function ownershipGaps(
  rows: Pick<ContributionRow, "category" | "status">[],
): LeadershipRoleCategory[] {
  const covered = new Set(
    rows
      .filter((r) => r.status === "ACTIVE" || r.status === "ASSIGNED")
      .map((r) => r.category),
  );
  return (
    Object.values(LEADERSHIP_ROLE_CATALOG)
      .filter((def) => def.isOwnership)
      .map((def) => def.category)
      .filter((category) => !covered.has(category))
  );
}
