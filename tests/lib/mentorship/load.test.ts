import { describe, expect, it } from "vitest";

import {
  buildMentorHomeViewModel,
  headlineRatingColor,
  mentorCardsToFacts,
  type MentorHomeCardInput,
  type MentorHomeSessionInput,
} from "@/lib/mentorship/load";

const NOW = new Date("2026-06-16T12:00:00.000Z");

function card(overrides: Partial<MentorHomeCardInput> = {}): MentorHomeCardInput {
  return {
    mentorshipId: "m1",
    menteeId: "u-mentee",
    menteeName: "Sam Mentee",
    cycleStage: "REFLECTION_DUE",
    kickoffPending: false,
    latestRatings: [],
    ...overrides,
  };
}

describe("headlineRatingColor", () => {
  it("returns null when there are no ratings", () => {
    expect(headlineRatingColor([])).toBeNull();
  });

  it("leads with the most-actionable (lowest) rating", () => {
    expect(headlineRatingColor(["ACHIEVED", "BEHIND_SCHEDULE", "ABOVE_AND_BEYOND"])).toBe(
      "BEHIND_SCHEDULE"
    );
  });

  it("ignores unknown rating strings", () => {
    expect(headlineRatingColor(["WHATEVER", "ACHIEVED"])).toBe("ACHIEVED");
  });
});

describe("mentorCardsToFacts", () => {
  it("treats the viewer as the mentor and maps cycle signals", () => {
    const [fact] = mentorCardsToFacts({
      viewerId: "u-mentor",
      viewerName: "You",
      cards: [card({ cycleStage: "REFLECTION_SUBMITTED", mentorCheckInComplete: true })],
      sessions: [],
    });
    expect(fact.mentorId).toBe("u-mentor");
    expect(fact.status).toBe("ACTIVE");
    expect(fact.reviewDue).toBe(true);
    expect(fact.meetingDue).toBe(false);
    expect(fact.kickoffCompleted).toBe(true);
    expect(fact.reviewChangesRequested).toBe(false);
  });

  it("marks meeting due when the note is in but the meeting is not logged", () => {
    const [fact] = mentorCardsToFacts({
      viewerId: "u-mentor",
      viewerName: "You",
      cards: [card({ cycleStage: "REFLECTION_SUBMITTED", mentorCheckInComplete: false })],
      sessions: [],
    });
    expect(fact.meetingDue).toBe(true);
    expect(fact.reviewDue).toBe(false);
  });

  it("marks a pending kickoff as not completed", () => {
    const [fact] = mentorCardsToFacts({
      viewerId: "u-mentor",
      viewerName: "You",
      cards: [card({ cycleStage: "KICKOFF_PENDING", kickoffPending: true })],
      sessions: [],
    });
    expect(fact.kickoffCompleted).toBe(false);
  });

  it("attaches only the sessions belonging to each mentee", () => {
    const sessions: MentorHomeSessionInput[] = [
      { id: "s1", menteeId: "u-mentee", title: "Check-in", type: "CHECK_IN", scheduledISO: NOW.toISOString() },
      { id: "s2", menteeId: "other", title: "Other", type: "CHECK_IN", scheduledISO: NOW.toISOString() },
    ];
    const [fact] = mentorCardsToFacts({
      viewerId: "u-mentor",
      viewerName: "You",
      cards: [card()],
      sessions,
    });
    expect(fact.sessions.map((s) => s.id)).toEqual(["s1"]);
  });

  it("carries the headline rubric color through", () => {
    const [fact] = mentorCardsToFacts({
      viewerId: "u-mentor",
      viewerName: "You",
      cards: [card({ latestRatings: ["ACHIEVED", "BEHIND_SCHEDULE"] })],
      sessions: [],
    });
    expect(fact.releasedColorStatus).toBe("BEHIND_SCHEDULE");
  });
});

describe("buildMentorHomeViewModel", () => {
  it("surfaces the due review as the single focus and lists the relationships", () => {
    const vm = buildMentorHomeViewModel({
      viewerId: "u-mentor",
      viewerName: "You",
      cards: [
        card({
          mentorshipId: "m1",
          cycleStage: "REFLECTION_SUBMITTED",
          mentorCheckInComplete: true,
          menteeName: "Sam",
        }),
        card({ mentorshipId: "m2", menteeId: "u-2", cycleStage: "APPROVED", menteeName: "Lee" }),
      ],
      sessions: [],
      now: NOW,
    });
    expect(vm.focus?.kind).toBe("review");
    expect(vm.relationships).toHaveLength(2);
    expect(vm.relationships.every((r) => r.viewerRole === "mentor")).toBe(true);
  });

  it("surfaces log-meeting when the note is in but check-in is missing", () => {
    const vm = buildMentorHomeViewModel({
      viewerId: "u-mentor",
      viewerName: "You",
      cards: [
        card({
          mentorshipId: "m1",
          cycleStage: "REFLECTION_SUBMITTED",
          mentorCheckInComplete: false,
          menteeName: "Sam",
        }),
      ],
      sessions: [],
      now: NOW,
    });
    expect(vm.focus?.kind).toBe("session");
    expect(vm.focus?.ctaLabel).toBe("Log meeting");
  });

  it("returns no focus when nothing waits on the mentor", () => {
    const vm = buildMentorHomeViewModel({
      viewerId: "u-mentor",
      viewerName: "You",
      cards: [card({ cycleStage: "APPROVED" })],
      sessions: [],
      now: NOW,
    });
    expect(vm.focus).toBeNull();
  });
});
