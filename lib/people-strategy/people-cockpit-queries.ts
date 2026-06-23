import { formatRoleLabel } from "@/lib/user-title";

import {
  buildPeopleCockpit,
  type CockpitPerformanceRow,
  type MeetingWithOpenFollowups,
  type PeopleCockpit,
} from "./people-cockpit";
import type { PeoplePerformanceRow } from "./people-performance";

/**
 * People Strategy — cockpit loader.
 *
 * Assembles the deterministic cockpit model from the data the People &
 * Performance page already loads (per-person performance rows) plus one extra
 * officer read: recent meetings that left follow-ups unresolved. The per-person
 * lanes come from the existing `deriveNextAction` engine; the meeting lane comes
 * from the live officer-meeting follow-up counts. No new schema — only existing
 * read-loaders, composed.
 */

function personContext(row: PeoplePerformanceRow): string | null {
  const parts = [formatRoleLabel(row.role), ...row.departments].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function toCockpitPerformanceRow(row: PeoplePerformanceRow): CockpitPerformanceRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    context: personContext(row),
    facts: row.facts,
  };
}

export async function loadPeopleCockpit(args: {
  performanceRows: PeoplePerformanceRow[];
  monthLabel: string;
  quarter: string;
  now?: Date;
}): Promise<PeopleCockpit> {
  // The old Meetings Tracker was removed — the meeting lane is always empty now.
  const meetingsWithOpenFollowups: MeetingWithOpenFollowups[] = [];

  return buildPeopleCockpit({
    performance: {
      rows: args.performanceRows.map(toCockpitPerformanceRow),
      ctx: { monthLabel: args.monthLabel, quarter: args.quarter },
    },
    meetingsWithOpenFollowups,
  });
}
