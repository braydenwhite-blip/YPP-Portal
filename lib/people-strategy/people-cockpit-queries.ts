import { addDays, formatMonthDay } from "@/lib/leadership-action-center/dates";
import { formatRoleLabel } from "@/lib/user-title";

import {
  buildPeopleCockpit,
  type CockpitPerformanceRow,
  type MeetingWithOpenFollowups,
  type PeopleCockpit,
} from "./people-cockpit";
import type { PeoplePerformanceRow } from "./people-performance";
import { listMeetingsInRange, mapMeetingToCardDTO } from "./meetings-queries";

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

/** How far back to look for meetings that may still have open follow-ups. */
const RECENT_MEETING_WINDOW_DAYS = 30;

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

async function loadMeetingsWithOpenFollowups(
  now: Date
): Promise<MeetingWithOpenFollowups[]> {
  // Read-loaders fail safe (return []) when the Action Tracker flag is off, so
  // this degrades to "no meeting lane" rather than throwing.
  const meetings = await listMeetingsInRange(addDays(now, -RECENT_MEETING_WINDOW_DAYS), now);
  const result: MeetingWithOpenFollowups[] = [];
  for (const meeting of meetings) {
    const card = mapMeetingToCardDTO(meeting, now);
    if (card.openFollowUps <= 0) continue;
    result.push({
      id: card.id,
      title: card.title,
      unresolvedCount: card.openFollowUps,
      metLabel: `Met ${formatMonthDay(new Date(card.startISO))}`,
      href: `/actions/meetings/${card.id}`,
    });
  }
  return result;
}

export async function loadPeopleCockpit(args: {
  performanceRows: PeoplePerformanceRow[];
  monthLabel: string;
  quarter: string;
  now?: Date;
}): Promise<PeopleCockpit> {
  const now = args.now ?? new Date();
  const meetingsWithOpenFollowups = await loadMeetingsWithOpenFollowups(now);

  return buildPeopleCockpit({
    performance: {
      rows: args.performanceRows.map(toCockpitPerformanceRow),
      ctx: { monthLabel: args.monthLabel, quarter: args.quarter },
    },
    meetingsWithOpenFollowups,
  });
}
