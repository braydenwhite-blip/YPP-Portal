import { describe, expect, it } from "vitest";

import {
  actionPrefillToQuery,
  actionTitleFromDecision,
  buildActionPrefillFromDecision,
  buildActionPrefillFromEntity,
  buildActionPrefillFromMeetingFollowUp,
  buildActionPrefillFromMeeting,
  buildMeetingPrefillFromEntity,
  buildMeetingPrefillFromOperationalIssue,
  findDuplicateActionCandidates,
  findSimilarActionTitles,
  meetingPrefillToQuery,
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

  it("serializes an exact due date when provided", () => {
    const href = actionPrefillToQuery({
      title: "Follow up from meeting",
      dueDate: "2026-06-07",
    });
    expect(href).toContain("due=2026-06-07");
  });
});

describe("buildActionPrefillFromEntity", () => {
  it("links the entity and infers its operating area", () => {
    expect(buildActionPrefillFromEntity({ type: "CLASS_OFFERING", id: "cls1" })).toMatchObject({
      relatedType: "CLASS_OFFERING",
      relatedId: "cls1",
      area: "CLASSES",
      priority: "MEDIUM",
    });
    expect(buildActionPrefillFromEntity({ type: "MENTORSHIP", id: "m1" }).area).toBe("MENTORSHIP");
    expect(buildActionPrefillFromEntity({ type: "USER", id: "u1" }).area).toBe("LEADERSHIP");
  });
});

describe("buildActionPrefillFromMeeting", () => {
  it("carries the source meeting, area, and any related entity", () => {
    const p = buildActionPrefillFromMeeting({
      meetingId: "m1",
      title: "Recap: hire two more instructors",
      meetingCategory: "INSTRUCTORS",
      relatedEntityType: "USER",
      relatedEntityId: "u1",
    });
    expect(p.sourceMeetingId).toBe("m1");
    expect(p.area).toBe("INSTRUCTORS");
    expect(p.actionType).toBe("MEETING_RECAP");
    expect(p.relatedType).toBe("USER");
    expect(p.relatedId).toBe("u1");
  });
});

describe("buildActionPrefillFromMeetingFollowUp", () => {
  it("carries meeting source, owner, due date, and related entity context", () => {
    const p = buildActionPrefillFromMeetingFollowUp({
      followUpId: "f1",
      title: "Confirm STEM scope before emailing partner",
      description: "Rockets and planes may be too narrow.",
      meetingId: "m1",
      meetingTitle: "Curriculum sync",
      meetingCategory: "CLASSES",
      relatedEntityType: "CLASS_OFFERING",
      relatedEntityId: "cls1",
      suggestedOwnerId: "u1",
      dueDate: "2026-06-07",
    });
    expect(p.title).toBe("Confirm STEM scope before emailing partner");
    expect(p.description).toContain("Rockets and planes may be too narrow.");
    expect(p.sourceMeetingId).toBe("m1");
    expect(p.sourceType).toBe("MEETING_FOLLOW_UP");
    expect(p.sourceId).toBe("f1");
    expect(p.suggestedOwnerId).toBe("u1");
    expect(p.dueDate).toBe("2026-06-07");
    expect(p.relatedType).toBe("CLASS_OFFERING");
    expect(p.relatedId).toBe("cls1");
  });
});

describe("meeting prefill builders", () => {
  it("builds an entity meeting prefill with a suggested title + area", () => {
    const p = buildMeetingPrefillFromEntity({ type: "CLASS_OFFERING", id: "cls1", label: "Algebra 101" });
    expect(p.relatedType).toBe("CLASS_OFFERING");
    expect(p.relatedId).toBe("cls1");
    expect(p.area).toBe("CLASSES");
    expect(p.title).toContain("Algebra 101");
  });

  it("builds an issue meeting prefill, inheriting the entity area when present", () => {
    const p = buildMeetingPrefillFromOperationalIssue({
      title: "Algebra 101 needs attention",
      relatedType: "CLASS_OFFERING",
      relatedId: "cls1",
    });
    expect(p.title).toBe("Algebra 101 needs attention");
    expect(p.area).toBe("CLASSES");
    expect(p.relatedId).toBe("cls1");
  });

  it("serializes a meeting prefill to the new-meeting page href", () => {
    const href = meetingPrefillToQuery(
      buildMeetingPrefillFromEntity({ type: "PARTNER", id: "p1", label: "Lincoln HS" })
    );
    expect(href).toContain("/actions/meetings/new?");
    expect(href).toContain("relatedType=PARTNER");
    expect(href).toContain("relatedId=p1");
    expect(href).toContain("area=PARTNERSHIPS");
  });

  it("serializes meeting type, time, attendees, and agenda items", () => {
    const href = meetingPrefillToQuery({
      relatedType: "INSTRUCTOR_APPLICATION",
      relatedId: "app1",
      area: "APPLICATIONS",
      meetingType: "INSTRUCTOR_APPLICANT_INTERVIEW",
      title: "Instructor applicant interview: Maya",
      date: "2026-06-20",
      startTime: "16:00",
      endTime: "16:30",
      facilitatorId: "u1",
      attendeeIds: ["u1", "u2"],
      agendaTitles: ["Teaching motivation", "Recommended next step"],
    });
    const url = new URL(href, "https://portal.test");
    expect(url.pathname).toBe("/actions/meetings/new");
    expect(url.searchParams.get("meetingType")).toBe("INSTRUCTOR_APPLICANT_INTERVIEW");
    expect(url.searchParams.get("date")).toBe("2026-06-20");
    expect(url.searchParams.get("start")).toBe("16:00");
    expect(url.searchParams.get("end")).toBe("16:30");
    expect(url.searchParams.get("facilitatorId")).toBe("u1");
    expect(url.searchParams.getAll("attendeeIds")).toEqual(["u1", "u2"]);
    expect(url.searchParams.getAll("agenda")).toEqual([
      "Teaching motivation",
      "Recommended next step",
    ]);
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
    { id: "a1", title: "Email Lincoln HS about cohort", status: "IN_PROGRESS", relatedEntityType: "PARTNER", relatedEntityId: "p1" },
    { id: "a2", title: "Buy snacks", status: "IN_PROGRESS", relatedEntityType: null, relatedEntityId: null },
    { id: "a3", title: "Email Lincoln HS about cohort", status: "COMPLETE", relatedEntityType: "PARTNER", relatedEntityId: "p1" },
  ];

  it("flags an open action that shares the entity or a similar title", () => {
    const dups = findDuplicateActionCandidates(
      { title: "Email Lincoln HS about the cohort", sourceMeetingId: "m1", relatedType: "PARTNER", relatedId: "p1" },
      existing
    );
    expect(dups.map((d) => d.id)).toEqual(["a1"]);
    expect(dups[0].reasons).toContain("similar title");
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
