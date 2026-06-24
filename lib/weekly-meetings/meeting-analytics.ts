/**
 * Weekly Meetings — hub analytics.
 *
 * Pure aggregations over an ALREADY-FILTERED set of meetings, so the status
 * donut and the per-type mini-bars always reflect exactly the rows currently
 * shown in the list (mirrors lib/people-strategy/action-analytics.ts). Client-
 * safe: no `server-only`/prisma import, so the hub components can render these
 * server-side or in the browser.
 */
import {
  MEETING_TYPE_LABELS,
  type MeetingListItem,
  type MeetingStatus,
  type MeetingType,
} from "./meeting-types";

/** Canonical ordering for type-keyed UI (bars, groups, legend). */
export const MEETING_TYPE_ORDER: MeetingType[] = [
  "OFFICER",
  "WEEKLY_TEAM_IMPACT",
  "CHAPTER_IMPACT",
  "GENERIC",
];

export type MeetingStatusBreakdown = {
  total: number;
  counts: Record<MeetingStatus, number>;
};

/** Count meetings by status for the donut. */
export function summarizeMeetingStatuses(
  meetings: MeetingListItem[]
): MeetingStatusBreakdown {
  const counts: Record<MeetingStatus, number> = {
    SCHEDULED: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  for (const m of meetings) counts[m.status] += 1;
  return { total: meetings.length, counts };
}

export type MeetingTypeBar = {
  type: MeetingType;
  label: string;
  total: number;
};

/** Per-type totals for the mini-bars, sorted by total (desc) then canonical order. */
export function summarizeMeetingTypes(meetings: MeetingListItem[]): MeetingTypeBar[] {
  const counts = new Map<MeetingType, number>();
  for (const m of meetings) counts.set(m.type, (counts.get(m.type) ?? 0) + 1);
  return MEETING_TYPE_ORDER.map((type) => ({
    type,
    label: MEETING_TYPE_LABELS[type],
    total: counts.get(type) ?? 0,
  }))
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total);
}

export type MeetingGroup = {
  type: MeetingType;
  label: string;
  meetings: MeetingListItem[];
};

/**
 * Group meetings by type for the hub's colored-header sections. Preserves the
 * incoming order of meetings within each group (the page sorts beforehand) and
 * orders the groups by canonical type order.
 */
export function groupMeetingsByType(meetings: MeetingListItem[]): MeetingGroup[] {
  const byType = new Map<MeetingType, MeetingListItem[]>();
  for (const m of meetings) {
    const arr = byType.get(m.type);
    if (arr) arr.push(m);
    else byType.set(m.type, [m]);
  }
  return MEETING_TYPE_ORDER.filter((type) => byType.has(type)).map((type) => ({
    type,
    label: MEETING_TYPE_LABELS[type],
    meetings: byType.get(type)!,
  }));
}
