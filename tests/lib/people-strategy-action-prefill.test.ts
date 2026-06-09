import { describe, expect, it } from "vitest";

import {
  actionPrefillToQuery,
  actionTitleFromDecision,
  buildActionPrefillFromDecision,
  findDuplicateActionCandidates,
  findSimilarActionTitles,
  titleSimilarity,
  type ExistingActionLite,
} from "@/lib/people-strategy/action-prefill";

describe("actionTitleFromDecision", () => {
  it("uses the first line and truncates very long decisions", () => {
    expect(actionTitleFromDecision("Approve the new mentor onboarding flow")).toBe(
      "Approve the new mentor onboarding flow"
    );
    expect(actionTitleFromDecision("Line one\nLine two")).toBe("Line one");
    const long = "x".repeat(200);
    const title = actionTitleFromDecision(long);
    expect(title.length).toBeLessThanOrEqual(140);
    expect(title.endsWith("…")).toBe(true);
  });

  it("never produces an empty title", () => {
    expect(actionTitleFromDecision("")).toBe("Action from meeting decision");
    expect(actionTitleFromDecision("   ")).toBe("Action from meeting decision");
  });
});

describe("buildActionPrefillFromDecision", () => {
  it("maps a decision with a linked entity into a full prefill", () => {
    const p = buildActionPrefillFromDecision({
      decision: "Email Lincoln HS about the spring cohort",
      rationale: "They asked for dates",
      meetingId: "m1",
      meetingTitle: "Partnerships Sync",
      meetingCategory: "PARTNERSHIPS",
      relatedEntityType: "PARTNER",
      relatedEntityId: "p1",
    });
    expect(p.title).toBe("Email Lincoln HS about the spring cohort");
    expect(p.description).toContain("Decision: Email Lincoln HS about the spring cohort");
    expect(p.description).toContain("Rationale: They asked for dates");
    expect(p.description).toContain("Partnerships Sync");
    expect(p.sourceMeetingId).toBe("m1");
    expect(p.area).toBe("PARTNERSHIPS");
    expect(p.actionType).toBe("FOLLOW_UP");
    expect(p.priority).toBe("MEDIUM");
    expect(p.relatedType).toBe("PARTNER");
    expect(p.relatedId).toBe("p1");
    expect(p.dueInDays).toBeGreaterThan(0);
  });

  it("omits the entity link when the meeting has none", () => {
    const p = buildActionPrefillFromDecision({
      decision: "Draft the Q3 budget",
      meetingId: "m2",
      meetingCategory: "FINANCE",
    });
    expect(p.relatedType).toBeUndefined();
    expect(p.relatedId).toBeUndefined();
    expect(p.area).toBe("FINANCE");
    expect(p.description).toContain("From a logged meeting decision.");
  });

  it("ignores an unknown category and a malformed entity link safely", () => {
    const p = buildActionPrefillFromDecision({
      decision: "Do the thing",
      meetingId: "m3",
      meetingCategory: "NONSENSE",
      relatedEntityType: "WAT",
      relatedEntityId: "x",
    });
    expect(p.area).toBeUndefined();
    expect(p.relatedType).toBeUndefined();
    expect(p.title).toBe("Do the thing");
  });
});

describe("actionPrefillToQuery", () => {
  it("serializes a prefill to a /actions/new href", () => {
    const href = actionPrefillToQuery(
      buildActionPrefillFromDecision({
        decision: "Call the partner",
        meetingId: "m1",
        meetingCategory: "PARTNERSHIPS",
        relatedEntityType: "PARTNER",
        relatedEntityId: "p1",
      })
    );
    expect(href.startsWith("/actions/new?")).toBe(true);
    expect(href).toContain("title=Call+the+partner");
    expect(href).toContain("relatedType=PARTNER");
    expect(href).toContain("relatedId=p1");
    expect(href).toContain("fromMeeting=m1");
    expect(href).toContain("area=PARTNERSHIPS");
  });
});

describe("titleSimilarity", () => {
  it("scores related titles high and unrelated titles low", () => {
    expect(titleSimilarity("Email Lincoln HS", "Email Lincoln High School about partnership")).toBeGreaterThan(0.6);
    expect(titleSimilarity("Email Lincoln HS", "Order pizza for the showcase")).toBeLessThan(0.3);
    expect(titleSimilarity("Same words here", "Same words here")).toBe(1);
  });

  it("is symmetric and safe on empty input", () => {
    expect(titleSimilarity("", "anything")).toBe(0);
    expect(titleSimilarity("a b c", "c b a")).toBe(titleSimilarity("c b a", "a b c"));
  });
});

describe("findDuplicateActionCandidates", () => {
  const existing: ExistingActionLite[] = [
    { id: "a1", title: "Email Lincoln HS about cohort", status: "IN_PROGRESS", officerMeetingId: "m1", relatedEntityType: "PARTNER", relatedEntityId: "p1" },
    { id: "a2", title: "Buy snacks", status: "IN_PROGRESS", officerMeetingId: "m9", relatedEntityType: null, relatedEntityId: null },
    { id: "a3", title: "Email Lincoln HS about cohort", status: "COMPLETE", officerMeetingId: "m1", relatedEntityType: "PARTNER", relatedEntityId: "p1" },
  ];

  it("flags an open action that shares the meeting, entity, or a similar title", () => {
    const dups = findDuplicateActionCandidates(
      { title: "Email Lincoln HS about the cohort", sourceMeetingId: "m1", relatedType: "PARTNER", relatedId: "p1" },
      existing
    );
    expect(dups.map((d) => d.id)).toEqual(["a1"]);
    expect(dups[0].reasons).toContain("similar title");
    expect(dups[0].reasons).toContain("from the same meeting");
    expect(dups[0].reasons).toContain("on the same entity");
  });

  it("never flags settled (complete/dropped) actions", () => {
    const dups = findDuplicateActionCandidates(
      { title: "Email Lincoln HS about cohort", sourceMeetingId: "m1" },
      [existing[2]]
    );
    expect(dups).toEqual([]);
  });

  it("returns nothing when the work is genuinely new", () => {
    const dups = findDuplicateActionCandidates(
      { title: "Plan the summer showcase", sourceMeetingId: "m5", relatedType: "CLASS_OFFERING", relatedId: "c1" },
      existing
    );
    expect(dups).toEqual([]);
  });
});

describe("findSimilarActionTitles", () => {
  it("finds open actions with similar titles only", () => {
    const out = findSimilarActionTitles("Email Lincoln HS about cohort", [
      { id: "a1", title: "Email Lincoln HS about the cohort", status: "IN_PROGRESS" },
      { id: "a2", title: "Completely unrelated", status: "IN_PROGRESS" },
      { id: "a3", title: "Email Lincoln HS about cohort", status: "COMPLETE" },
    ]);
    expect(out.map((o) => o.id)).toEqual(["a1"]);
  });
});
