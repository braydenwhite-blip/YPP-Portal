import { cache } from "react";
import type { FeatureKey } from "@/lib/feature-gate-constants";
import { getEnabledFeatureKeysForUser } from "@/lib/feature-gates";

export function rolesToSortedCsv(roles: string[]): string {
  if (roles.length === 0) return "";
  return [...roles].sort().join(",");
}

/** Dedupes identical feature-gate resolution within one RSC request (layout + page). */
export const getEnabledFeatureKeysForUserCached = cache(
  async (
    userId: string,
    chapterId: string | null,
    rolesSortedCsv: string,
    primaryRole: string | null
  ): Promise<FeatureKey[]> => {
    const roles = rolesSortedCsv.length > 0 ? rolesSortedCsv.split(",") : [];
    return getEnabledFeatureKeysForUser({
      userId,
      chapterId,
      roles,
      primaryRole,
    });
  }
);
