import { describe, expect, it } from "vitest";

import {
  findVaguePhrase,
  isImpactEntrySubmittable,
  validateImpactEntry,
  validateMemberSubmission,
} from "@/lib/people-strategy/impact-specificity";

describe("findVaguePhrase", () => {
  it("flags the template's ✗ phrases", () => {
    expect(findVaguePhrase("Worked on it")).toBe("worked on it");
    expect(findVaguePhrase("Making progress on the guide")).toBe("making progress");
    expect(findVaguePhrase("Ongoing conversations")).toBe("ongoing");
    expect(findVaguePhrase("Did some outreach")).toBe("did some");
  });

  it("respects word boundaries (does not trip on substrings)", () => {
    // "stuffed" must not match the "stuff" phrase.
    expect(findVaguePhrase("Stuffed the schedule with 5 booked meetings")).toBeNull();
    // A concrete, specific sentence is clean.
    expect(
      findVaguePhrase("Cold-contacted 8 schools, booked 3 meetings")
    ).toBeNull();
  });
});

describe("validateImpactEntry", () => {
  it("passes a specific, concrete entry", () => {
    const issues = validateImpactEntry({
      workCompleted: "Cold-contacted 8 schools and followed up on 4 prior leads",
      currentResult: "Pipeline grew from 2 to 5 warm leads",
      nextAction: "Book intro calls with the 3 schools that replied",
    });
    expect(issues).toHaveLength(0);
    expect(isImpactEntrySubmittable(issues)).toBe(true);
  });

  it("blocks a vague 'worked on it' progress entry", () => {
    const issues = validateImpactEntry({ workCompleted: "Worked on it" });
    expect(isImpactEntrySubmittable(issues)).toBe(false);
    expect(issues.some((i) => i.field === "workCompleted" && i.code === "vague_phrase")).toBe(
      true
    );
  });

  it("blocks a too-short answer", () => {
    const issues = validateImpactEntry({ currentResult: "done" });
    expect(issues.some((i) => i.code === "too_short")).toBe(true);
  });

  it("requires an outcome when work was described (missing_outcome)", () => {
    const issues = validateImpactEntry({
      workCompleted: "Wrote sections 1-3 and added the onboarding checklist",
      currentResult: "",
    });
    expect(
      issues.some((i) => i.field === "currentResult" && i.code === "missing_outcome")
    ).toBe(true);
  });

  it("requires a concrete deliverable when an objective is set", () => {
    const issues = validateImpactEntry({
      personalObjective: "Build the instructor onboarding system this cycle",
      personalDeliverable: "",
    });
    expect(
      issues.some((i) => i.field === "personalDeliverable" && i.code === "empty")
    ).toBe(true);
  });

  it("ignores fields that are left empty and optional", () => {
    // Only an objective+deliverable pair provided, both specific → clean.
    const issues = validateImpactEntry({
      personalObjective: "Expand the NJ partner network this cycle",
      personalDeliverable: "Signed LOIs from 3 new schools live in the partner tracker",
    });
    expect(issues).toHaveLength(0);
  });
});

describe("validateMemberSubmission", () => {
  it("tags task-level issues with their taskUpdateId", () => {
    const issues = validateMemberSubmission({
      member: {
        personalObjective: "Ship the portal testing checklist",
        personalDeliverable: "Live checklist in the portal with 12 passing cases",
      },
      tasks: [
        {
          taskUpdateId: "tu-1",
          workCompleted: "Worked on it",
          currentResult: "",
          nextAction: "Finish QA",
        },
      ],
    });
    const tagged = issues.find((i) => i.taskUpdateId === "tu-1");
    expect(tagged).toBeDefined();
    expect(tagged?.code).toBe("vague_phrase");
  });

  it("returns no issues for a fully specific submission", () => {
    const issues = validateMemberSubmission({
      member: {
        personalObjective: "Grow the sponsor pipeline this cycle",
        personalDeliverable: "Sponsor tracker showing 5 warm leads with next steps",
        inputNeeded: "Approve the sponsor outreach email before I send to 10 contacts",
      },
      tasks: [
        {
          taskUpdateId: "tu-9",
          workCompleted: "Emailed 8 sponsors and followed up with 4 prior contacts",
          currentResult: "Two sponsors asked for the pitch deck",
          nextAction: "Send the pitch deck to the two interested sponsors",
        },
      ],
    });
    expect(issues).toHaveLength(0);
  });
});
