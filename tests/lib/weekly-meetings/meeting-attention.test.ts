import { describe, expect, it } from "vitest";

import {
  deriveMeetingAttention,
  laneForMeeting,
  HAPPENING_SOON_DAYS,
  NO_OUTCOMES_LOOKBACK_DAYS,
} from "@/lib/weekly-meetings/meeting-attention";
import type { MeetingListItem } from "@/lib/weekly-meetings/meeting-types";

const NOW = new Date("2026-07-02T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function iso(daysFromNow: number): string {
  return new Date(NOW.getTime() + daysFromNow * DAY_MS).toISOString();
}

function meeting(overrides: Partial<MeetingListItem>): MeetingListItem {
  return {
    id: "m1",
    type: "GENERIC",
    typeLabel: "General Meeting",
    status: "SCHEDULED",
    title: "Weekly sync",
    scheduledISO: iso(7),
    facilitator: { id: "u1", name: "Maya" },
    scopeLabel: null,
    counts: { attendees: 4, decisions: 0, followUps: 0, openFollowUps: 0, topics: 0 },
    ...overrides,
  };
}

describe("laneForMeeting", () => {
  it("flags a scheduled meeting with no facilitator as needing an owner", () => {
    const hit = laneForMeeting(meeting({ facilitator: null }), NOW);
    expect(hit?.lane).toBe("needs_owner");
    expect(hit?.detail).toBe("No facilitator assigned");
  });

  it("flags a completed meeting with open follow-ups", () => {
    const hit = laneForMeeting(
      meeting({
        status: "COMPLETED",
        scheduledISO: iso(-2),
        counts: { attendees: 4, decisions: 1, followUps: 3, openFollowUps: 3, topics: 0 },
      }),
      NOW
    );
    expect(hit?.lane).toBe("follow_ups_unresolved");
    expect(hit?.detail).toBe("3 open follow-ups");
  });

  it("flags a recent completion with no recorded outcomes", () => {
    const hit = laneForMeeting(
      meeting({ status: "COMPLETED", scheduledISO: iso(-3) }),
      NOW
    );
    expect(hit?.lane).toBe("no_outcomes");
  });

  it("lets an old no-outcome completion age out of the strip", () => {
    const hit = laneForMeeting(
      meeting({
        status: "COMPLETED",
        scheduledISO: iso(-(NO_OUTCOMES_LOOKBACK_DAYS + 1)),
      }),
      NOW
    );
    expect(hit).toBeNull();
  });

  it("flags an owned meeting inside the happening-soon window", () => {
    const hit = laneForMeeting(meeting({ scheduledISO: iso(1) }), NOW);
    expect(hit?.lane).toBe("happening_soon");
    expect(hit?.detail).toBe("4 invited");
  });

  it("calls out missing attendees on a happening-soon meeting", () => {
    const hit = laneForMeeting(
      meeting({
        scheduledISO: iso(1),
        counts: { attendees: 0, decisions: 0, followUps: 0, openFollowUps: 0, topics: 0 },
      }),
      NOW
    );
    expect(hit?.detail).toBe("No attendees invited yet");
  });

  it("leaves a healthy future meeting outside every lane", () => {
    const hit = laneForMeeting(
      meeting({ scheduledISO: iso(HAPPENING_SOON_DAYS + 2) }),
      NOW
    );
    expect(hit).toBeNull();
  });

  it("prefers needs_owner over happening_soon (first matching rule wins)", () => {
    const hit = laneForMeeting(meeting({ facilitator: null, scheduledISO: iso(1) }), NOW);
    expect(hit?.lane).toBe("needs_owner");
  });
});

describe("deriveMeetingAttention", () => {
  it("skips cancelled meetings and omits empty lanes", () => {
    const groups = deriveMeetingAttention(
      [
        meeting({ id: "cancelled", status: "CANCELLED", facilitator: null }),
        meeting({ id: "healthy", scheduledISO: iso(10) }),
      ],
      NOW
    );
    expect(groups).toEqual([]);
  });

  it("groups each meeting into exactly one lane, in lane order", () => {
    const groups = deriveMeetingAttention(
      [
        meeting({ id: "soon", scheduledISO: iso(1) }),
        meeting({ id: "unowned", facilitator: null }),
        meeting({
          id: "open-fu",
          status: "COMPLETED",
          scheduledISO: iso(-1),
          counts: { attendees: 4, decisions: 0, followUps: 2, openFollowUps: 2, topics: 0 },
        }),
      ],
      NOW
    );
    expect(groups.map((g) => g.lane)).toEqual([
      "needs_owner",
      "follow_ups_unresolved",
      "happening_soon",
    ]);
    const allIds = groups.flatMap((g) => g.items.map((i) => i.id));
    expect(allIds.sort()).toEqual(["open-fu", "soon", "unowned"]);
  });

  it("caps each lane at five meetings", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      meeting({ id: `m${i}`, facilitator: null, scheduledISO: iso(i + 1) })
    );
    const groups = deriveMeetingAttention(many, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(5);
    // Soonest first for upcoming lanes.
    expect(groups[0].items[0].id).toBe("m0");
  });
});
