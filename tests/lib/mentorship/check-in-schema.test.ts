import { describe, it, expect } from "vitest";

import {
  RecordCheckInSchema,
  composeNotesSummary,
} from "@/lib/mentorship/check-in-schema";

describe("RecordCheckInSchema", () => {
  it("coerces string dates and defaults kind + participants", () => {
    const parsed = RecordCheckInSchema.parse({
      subjectId: "u1",
      mentorshipId: "m1",
      occurredAt: "2026-07-03",
      followUpDate: "2026-07-17",
    });
    expect(parsed.kind).toBe("CHECK_IN");
    expect(parsed.participantIds).toEqual([]);
    expect(parsed.occurredAt).toBeInstanceOf(Date);
    expect(parsed.followUpDate).toBeInstanceOf(Date);
  });

  it("normalizes blank structured fields to null", () => {
    const parsed = RecordCheckInSchema.parse({
      subjectId: "u1",
      mentorshipId: "m1",
      wins: "   ",
      discussion: "",
      challenges: "  real challenge  ",
    });
    expect(parsed.wins).toBeNull();
    expect(parsed.discussion).toBeNull();
    expect(parsed.challenges).toBe("real challenge");
  });

  it("requires both relationship discriminators (subject + mentorship)", () => {
    expect(() => RecordCheckInSchema.parse({ subjectId: "", mentorshipId: "m1" })).toThrow();
    expect(() => RecordCheckInSchema.parse({ subjectId: "u1", mentorshipId: "" })).toThrow();
  });

  it("rejects an out-of-range rating", () => {
    expect(() =>
      RecordCheckInSchema.parse({ subjectId: "u1", mentorshipId: "m1", rating: 9 })
    ).toThrow();
    expect(
      RecordCheckInSchema.parse({ subjectId: "u1", mentorshipId: "m1", rating: 4 }).rating
    ).toBe(4);
  });
});

describe("composeNotesSummary", () => {
  const base = { subjectId: "u1", mentorshipId: "m1" };

  it("prefers the discussion over wins/challenges", () => {
    const summary = composeNotesSummary(
      RecordCheckInSchema.parse({ ...base, discussion: "Talked through goals", wins: "shipped" })
    );
    expect(summary).toContain("Talked through goals");
    expect(summary).not.toContain("Wins:");
  });

  it("falls back to wins + challenges when there is no discussion", () => {
    const summary = composeNotesSummary(
      RecordCheckInSchema.parse({ ...base, wins: "shipped a class", challenges: "time" })
    );
    expect(summary).toContain("Wins: shipped a class");
    expect(summary).toContain("Challenges: time");
  });

  it("uses a sensible default when the record is empty", () => {
    const summary = composeNotesSummary(
      RecordCheckInSchema.parse({ ...base, kind: "MEETING" })
    );
    expect(summary).toBe("Meeting logged.");
  });
});
