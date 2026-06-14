import { describe, expect, it } from "vitest";

import { parseSuggestedActions } from "@/lib/people-strategy/notes-to-actions";

const NOW = new Date("2026-06-10T12:00:00Z"); // a Wednesday

const PEOPLE = [
  { id: "milo", name: "Milo Wald" },
  { id: "ian", name: "Ian Carter" },
  { id: "aveena", name: "Aveena" },
];

describe("notes → actions heuristic parser", () => {
  it("returns nothing for empty notes", () => {
    expect(parseSuggestedActions({ notes: "" }, NOW)).toEqual([]);
    expect(parseSuggestedActions({ notes: null }, NOW)).toEqual([]);
  });

  it("detects an assignment and resolves the owner", () => {
    const out = parseSuggestedActions(
      { notes: "Milo will handle class pairing", people: PEOPLE },
      NOW
    );
    expect(out).toHaveLength(1);
    expect(out[0].ownerId).toBe("milo");
    expect(out[0].ownerName).toBe("Milo Wald");
    expect(out[0].title).toBe("Handle class pairing");
  });

  it("extracts an owner and infers a due date, with high confidence", () => {
    const out = parseSuggestedActions(
      { notes: "Ian needs to confirm interviews happened by Sunday", people: PEOPLE },
      NOW
    );
    expect(out).toHaveLength(1);
    expect(out[0].ownerId).toBe("ian");
    expect(out[0].title).toBe("Confirm interviews happened");
    expect(out[0].dueDateISO).not.toBeNull();
    expect(out[0].dueLabel).toBe("Sunday");
    expect(out[0].confidence).toBe("high");
  });

  it("recognizes an imperative follow-up with no owner", () => {
    const out = parseSuggestedActions(
      { notes: "Follow up with Beth El about workshop format", people: PEOPLE },
      NOW
    );
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].ownerId).toBeNull();
    expect(out[0].title.toLowerCase()).toContain("follow up with beth el");
  });

  it("resolves 'tomorrow' relative to the meeting date", () => {
    const out = parseSuggestedActions(
      { notes: "Aveena should send onboarding message tomorrow", people: PEOPLE, meetingDateISO: NOW.toISOString() },
      NOW
    );
    expect(out).toHaveLength(1);
    expect(out[0].ownerId).toBe("aveena");
    expect(out[0].dueLabel).toBe("tomorrow");
    expect(out[0].title.toLowerCase()).toContain("send onboarding message");
  });

  it("skips discussion notes and open questions", () => {
    const out = parseSuggestedActions(
      {
        notes: [
          "Discussed budget for spring planning.",
          "What should we do about funding?",
          "FYI: the venue is booked.",
        ].join("\n"),
        people: PEOPLE,
      },
      NOW
    );
    expect(out).toHaveLength(0);
  });

  it("does not re-suggest work that already exists for the meeting", () => {
    const out = parseSuggestedActions(
      {
        notes: "Send the onboarding message",
        people: PEOPLE,
        existingTitles: ["Send the onboarding message"],
      },
      NOW
    );
    expect(out).toHaveLength(0);
  });

  it("parses several lines and ranks the most confident first", () => {
    const out = parseSuggestedActions(
      {
        notes: [
          "- Milo will handle class pairing by Friday",
          "- Need to train instructors before Sunday",
          "- Discussed the new schedule",
        ].join("\n"),
        people: PEOPLE,
      },
      NOW
    );
    // The two action lines parse; the discussion line is skipped.
    expect(out.length).toBe(2);
    // Owner + due resolved ⇒ high confidence sorts first.
    expect(out[0].ownerId).toBe("milo");
    expect(out[0].confidence).toBe("high");
  });
});
