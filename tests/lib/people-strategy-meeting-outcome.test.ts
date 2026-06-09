import { describe, expect, it, vi } from "vitest";

// meeting-outcome only imports pure helpers + DTO types, but the meetings-queries
// barrel touches prisma; mock so importing never spins up a real client.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import {
  deriveMeetingOutcomeQuality,
  STALE_MEETING_DAYS,
  type MeetingOutcomeInput,
} from "@/lib/people-strategy/meeting-outcome";

const NOW = new Date("2026-06-04T12:00:00");

function input(overrides: Partial<MeetingOutcomeInput> = {}): MeetingOutcomeInput {
  return {
    effectiveStatus: "completed",
    start: new Date("2026-06-02T18:00:00"),
    decisionCount: 0,
    linkedActionCount: 0,
    openFollowUps: 0,
    followUpCount: 0,
    attendeeCount: 0,
    agendaCount: 0,
    hasNotes: false,
    ...overrides,
  };
}

describe("deriveMeetingOutcomeQuality", () => {
  it("an empty past meeting that produced nothing reads as empty", () => {
    const q = deriveMeetingOutcomeQuality(input(), NOW);
    expect(q.level).toBe("empty");
    expect(q.reasons[0]).toMatch(/No decisions/);
  });

  it("a decision with no action needs follow-through", () => {
    const q = deriveMeetingOutcomeQuality(input({ decisionCount: 2, linkedActionCount: 0 }), NOW);
    expect(q.level).toBe("needs_follow_through");
    expect(q.headline).toMatch(/no action assigned/i);
  });

  it("open follow-ups need follow-through", () => {
    const q = deriveMeetingOutcomeQuality(input({ linkedActionCount: 1, openFollowUps: 2, followUpCount: 3 }), NOW);
    expect(q.level).toBe("needs_follow_through");
    expect(q.reasons[0]).toMatch(/open follow-up/);
  });

  it("decisions converted to action with attendees + notes are strong", () => {
    const q = deriveMeetingOutcomeQuality(
      input({ decisionCount: 2, linkedActionCount: 2, attendeeCount: 4, hasNotes: true, openFollowUps: 0 }),
      NOW
    );
    expect(q.level).toBe("strong");
  });

  it("an upcoming meeting is graded on preparedness, not output", () => {
    const prepared = deriveMeetingOutcomeQuality(
      input({ effectiveStatus: "upcoming", start: new Date("2026-06-06T18:00:00"), agendaCount: 3 }),
      NOW
    );
    expect(prepared.level).toBe("adequate");
    const unprepared = deriveMeetingOutcomeQuality(
      input({ effectiveStatus: "upcoming", start: new Date("2026-06-06T18:00:00"), agendaCount: 0, attendeeCount: 0 }),
      NOW
    );
    expect(unprepared.level).toBe("empty");
    expect(unprepared.headline).toMatch(/not set up/i);
  });

  it("an old past meeting with open follow-ups is stale", () => {
    const old = new Date(NOW);
    old.setDate(old.getDate() - (STALE_MEETING_DAYS + 5));
    const q = deriveMeetingOutcomeQuality(
      input({ start: old, linkedActionCount: 1, openFollowUps: 1, followUpCount: 1 }),
      NOW
    );
    expect(q.level).toBe("stale");
  });

  it("a canceled meeting has no outcome", () => {
    const q = deriveMeetingOutcomeQuality(input({ effectiveStatus: "canceled" }), NOW);
    expect(q.level).toBe("empty");
    expect(q.headline).toMatch(/Canceled/);
  });
});
