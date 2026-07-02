import { describe, expect, it } from "vitest";

import {
  groupMeetingsByType,
  summarizeMeetingStatuses,
  summarizeMeetingTypes,
} from "@/lib/weekly-meetings/meeting-analytics";
import {
  MEETING_TYPE_LABELS,
  type MeetingListItem,
  type MeetingStatus,
  type MeetingType,
} from "@/lib/weekly-meetings/meeting-types";

function meeting(
  id: string,
  type: MeetingType,
  status: MeetingStatus
): MeetingListItem {
  return {
    id,
    type,
    typeLabel: MEETING_TYPE_LABELS[type],
    status,
    title: `Meeting ${id}`,
    scheduledISO: "2026-06-22T15:00:00.000Z",
    facilitator: null,
    scopeLabel: null,
    counts: { attendees: 0, decisions: 0, followUps: 0, openFollowUps: 0, topics: 0 },
  };
}

describe("summarizeMeetingStatuses", () => {
  it("counts meetings by status with a total", () => {
    const breakdown = summarizeMeetingStatuses([
      meeting("a", "OFFICER", "SCHEDULED"),
      meeting("b", "OFFICER", "IN_PROGRESS"),
      meeting("c", "GENERIC", "COMPLETED"),
      meeting("d", "GENERIC", "COMPLETED"),
    ]);
    expect(breakdown.total).toBe(4);
    expect(breakdown.counts.SCHEDULED).toBe(1);
    expect(breakdown.counts.IN_PROGRESS).toBe(1);
    expect(breakdown.counts.COMPLETED).toBe(2);
    expect(breakdown.counts.CANCELLED).toBe(0);
  });

  it("returns a zeroed breakdown for an empty list", () => {
    const breakdown = summarizeMeetingStatuses([]);
    expect(breakdown.total).toBe(0);
    expect(Object.values(breakdown.counts).every((n) => n === 0)).toBe(true);
  });
});

describe("summarizeMeetingTypes", () => {
  it("drops zero-count types and sorts by total desc", () => {
    const bars = summarizeMeetingTypes([
      meeting("a", "WEEKLY_TEAM_IMPACT", "SCHEDULED"),
      meeting("b", "WEEKLY_TEAM_IMPACT", "SCHEDULED"),
      meeting("c", "OFFICER", "SCHEDULED"),
    ]);
    expect(bars.map((b) => b.type)).toEqual(["WEEKLY_TEAM_IMPACT", "OFFICER"]);
    expect(bars[0].total).toBe(2);
    expect(bars[0].label).toBe(MEETING_TYPE_LABELS.WEEKLY_TEAM_IMPACT);
  });
});

describe("groupMeetingsByType", () => {
  it("groups by type in canonical order and preserves within-group order", () => {
    const groups = groupMeetingsByType([
      meeting("g1", "GENERIC", "SCHEDULED"),
      meeting("o1", "OFFICER", "SCHEDULED"),
      meeting("g2", "GENERIC", "COMPLETED"),
    ]);
    expect(groups.map((g) => g.type)).toEqual(["OFFICER", "GENERIC"]);
    expect(groups[1].meetings.map((m) => m.id)).toEqual(["g1", "g2"]);
  });
});
