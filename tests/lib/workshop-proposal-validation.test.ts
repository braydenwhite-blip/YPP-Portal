import { describe, expect, it } from "vitest";
import {
  EMPTY_CUSTOM_WORKSHOP,
  EMPTY_REFLECTION,
  isSubmissionEditable,
  isSubmissionReviewable,
  type CustomWorkshopPayload,
  type WorkshopReflectionPayload,
} from "@/lib/workshop-proposal-constants";
import {
  customWorkshopIssues,
  normalizeCustomWorkshop,
  normalizeReflection,
  reflectionIssues,
  submissionIssues,
} from "@/lib/workshop-proposal-validation";

const completeCustomWorkshop = (
  overrides: Partial<CustomWorkshopPayload> = {}
): CustomWorkshopPayload => ({
  title: "Bridge Engineering for Beginners",
  targetAgeGroup: "Grades 4–6",
  lengthMinutes: 60,
  category: "STEM",
  learningObjective:
    "By the end of the workshop, students will be able to identify load, tension, and compression on a paper bridge.",
  materials: ["Cardstock", "Tape", "Weights"],
  openingHook:
    "Show two bridges (one strong, one collapsing) and ask students why one held up.",
  mainActivity:
    "Students design a paper bridge in pairs, build it in 15 minutes, then test it with weights. They iterate after the first failure with one new technique they observed working in another pair's bridge. Everyone re-tests and shares their strongest move.",
  participationPlan: "Pairs of two. Each pair tests publicly so the group can see the result.",
  wrapUp: "One-sentence answer: what's the strongest shape?",
  backupPlan: "If the room is shy, run a teacher-led demo of the iteration step before pair work.",
  format: "IN_PERSON",
  locationNotes: "Roosevelt Middle School cafeteria, indoor.",
  capacity: 12,
  availability: "Saturdays in July 2026",
  safetyNotes: "Scissors used in pairs, supervised. One adult in the room.",
  ...overrides,
});

const completeReflection = (
  overrides: Partial<WorkshopReflectionPayload> = {}
): WorkshopReflectionPayload => ({
  whyChosen:
    "I have run hands-on engineering activities at summer camp before and want to bring the iterate-after-failure mindset to YPP.",
  audienceAdaptation:
    "I'd give younger students pre-cut paper strips and a templated build sheet so they can focus on the testing/iteration loop.",
  hardestPart:
    "Keeping pairs from rushing past the iteration step. I'll add a hard pause after the first round of testing so reflection happens before the next build.",
  engagementPlan:
    "Public testing creates suspense and ownership. I'll make the moment of failure visible so students learn it's part of the work.",
  ...overrides,
});

describe("normalizeCustomWorkshop", () => {
  it("returns EMPTY_CUSTOM_WORKSHOP for null/undefined/non-object input", () => {
    expect(normalizeCustomWorkshop(null)).toEqual(EMPTY_CUSTOM_WORKSHOP);
    expect(normalizeCustomWorkshop(undefined)).toEqual(EMPTY_CUSTOM_WORKSHOP);
    expect(normalizeCustomWorkshop("garbage")).toEqual(EMPTY_CUSTOM_WORKSHOP);
  });

  it("trims string fields and coerces lengthMinutes", () => {
    const raw = {
      title: "  My workshop  ",
      lengthMinutes: "75",
      materials: [" Paper ", "", "Glue"],
    };
    const out = normalizeCustomWorkshop(raw);
    expect(out.title).toBe("My workshop");
    expect(out.lengthMinutes).toBe(75);
    expect(out.materials).toEqual(["Paper", "Glue"]);
  });

  it("coerces non-numeric lengthMinutes to 0", () => {
    expect(normalizeCustomWorkshop({ lengthMinutes: "abc" }).lengthMinutes).toBe(0);
  });

  it("only accepts known workshop format strings", () => {
    expect(normalizeCustomWorkshop({ format: "IN_PERSON" }).format).toBe("IN_PERSON");
    expect(normalizeCustomWorkshop({ format: "VIRTUAL" }).format).toBe("VIRTUAL");
    expect(normalizeCustomWorkshop({ format: "HYBRID" }).format).toBe("HYBRID");
    expect(normalizeCustomWorkshop({ format: "bogus" }).format).toBe("");
    expect(normalizeCustomWorkshop({ format: 5 }).format).toBe("");
  });

  it("normalizes capacity and trims logistics text", () => {
    const out = normalizeCustomWorkshop({
      capacity: "24",
      locationNotes: "  Cafeteria  ",
      availability: "  July  ",
      safetyNotes: "  Adult chaperone  ",
    });
    expect(out.capacity).toBe(24);
    expect(out.locationNotes).toBe("Cafeteria");
    expect(out.availability).toBe("July");
    expect(out.safetyNotes).toBe("Adult chaperone");
  });
});

describe("normalizeReflection", () => {
  it("trims all four fields", () => {
    const out = normalizeReflection({
      whyChosen: "  hi  ",
      audienceAdaptation: 42,
      hardestPart: null,
      engagementPlan: undefined,
    });
    expect(out.whyChosen).toBe("hi");
    expect(out.audienceAdaptation).toBe("");
    expect(out.hardestPart).toBe("");
    expect(out.engagementPlan).toBe("");
  });
});

describe("customWorkshopIssues", () => {
  it("complete payload yields zero issues", () => {
    expect(customWorkshopIssues(completeCustomWorkshop())).toEqual([]);
  });

  it("empty payload yields a non-empty issue list per required field", () => {
    const issues = customWorkshopIssues(EMPTY_CUSTOM_WORKSHOP);
    // Title, age, category, length, learning objective, main activity,
    // opening hook, participation, wrap-up, backup plan = 10 fields.
    expect(issues.length).toBeGreaterThanOrEqual(8);
  });

  it("rejects too-short main activity", () => {
    const issues = customWorkshopIssues(
      completeCustomWorkshop({ mainActivity: "Just a sentence." })
    );
    expect(issues.find((i) => i.toLowerCase().includes("main activity"))).toBeDefined();
  });

  it("rejects out-of-range length", () => {
    const issues = customWorkshopIssues(
      completeCustomWorkshop({ lengthMinutes: 5 })
    );
    expect(issues.find((i) => i.toLowerCase().includes("length"))).toBeDefined();
  });

  it("rejects too-short learning objective", () => {
    const issues = customWorkshopIssues(
      completeCustomWorkshop({ learningObjective: "Make stuff." })
    );
    expect(
      issues.find((i) => i.toLowerCase().includes("learning objective"))
    ).toBeDefined();
  });

  it("requires a workshop format", () => {
    const issues = customWorkshopIssues(
      completeCustomWorkshop({ format: "" })
    );
    expect(
      issues.find((i) => i.toLowerCase().includes("workshop format"))
    ).toBeDefined();
  });

  it("requires location and safety notes for in-person workshops", () => {
    const issues = customWorkshopIssues(
      completeCustomWorkshop({
        format: "IN_PERSON",
        locationNotes: "",
        safetyNotes: "",
      })
    );
    expect(issues.find((i) => i.toLowerCase().includes("location"))).toBeDefined();
    expect(issues.find((i) => i.toLowerCase().includes("safety"))).toBeDefined();
  });

  it("does not require location or safety notes for virtual workshops", () => {
    const issues = customWorkshopIssues(
      completeCustomWorkshop({
        format: "VIRTUAL",
        locationNotes: "",
        safetyNotes: "",
      })
    );
    expect(issues.find((i) => i.toLowerCase().includes("location"))).toBeUndefined();
    expect(issues.find((i) => i.toLowerCase().includes("safety"))).toBeUndefined();
  });

  it("requires location and safety notes for hybrid workshops", () => {
    const issues = customWorkshopIssues(
      completeCustomWorkshop({
        format: "HYBRID",
        locationNotes: "",
        safetyNotes: "",
      })
    );
    expect(issues.find((i) => i.toLowerCase().includes("location"))).toBeDefined();
    expect(issues.find((i) => i.toLowerCase().includes("safety"))).toBeDefined();
  });

  it("rejects out-of-range capacity", () => {
    const tooSmall = customWorkshopIssues(
      completeCustomWorkshop({ capacity: 0 })
    );
    expect(tooSmall.find((i) => i.toLowerCase().includes("capacity"))).toBeDefined();
    const tooLarge = customWorkshopIssues(
      completeCustomWorkshop({ capacity: 9999 })
    );
    expect(tooLarge.find((i) => i.toLowerCase().includes("capacity"))).toBeDefined();
  });

  it("requires availability", () => {
    const issues = customWorkshopIssues(
      completeCustomWorkshop({ availability: "" })
    );
    expect(issues.find((i) => i.toLowerCase().includes("availability"))).toBeDefined();
  });
});

describe("reflectionIssues", () => {
  it("complete reflection yields zero issues", () => {
    expect(reflectionIssues(completeReflection())).toEqual([]);
  });

  it("empty reflection yields one issue per prompt", () => {
    const issues = reflectionIssues(EMPTY_REFLECTION);
    expect(issues.length).toBe(4);
  });

  it("rejects too-short answers but accepts beyond the threshold", () => {
    const short = reflectionIssues(
      completeReflection({ whyChosen: "I like it." })
    );
    expect(short.length).toBe(1);
    expect(short[0].toLowerCase()).toContain("why you chose");
  });
});

describe("submissionIssues", () => {
  it("CUSTOM_DESIGN happy path is empty when both custom and reflection are complete", () => {
    expect(
      submissionIssues({
        sourceType: "CUSTOM_DESIGN",
        custom: completeCustomWorkshop(),
        reflection: completeReflection(),
      })
    ).toEqual([]);
  });

  it("CUSTOM_DESIGN reports custom + reflection issues together", () => {
    const issues = submissionIssues({
      sourceType: "CUSTOM_DESIGN",
      custom: EMPTY_CUSTOM_WORKSHOP,
      reflection: EMPTY_REFLECTION,
    });
    // Rough lower bound: lots of fields, expect plenty of issues.
    expect(issues.length).toBeGreaterThan(10);
  });

  it("TEMPLATE_SELECTION without templateId says 'pick a workshop'", () => {
    const issues = submissionIssues({
      sourceType: "TEMPLATE_SELECTION",
      reflection: completeReflection(),
      templateId: null,
    });
    expect(issues[0].toLowerCase()).toContain("pick a workshop");
  });

  it("TEMPLATE_SELECTION with templateId + reflection is clean", () => {
    expect(
      submissionIssues({
        sourceType: "TEMPLATE_SELECTION",
        reflection: completeReflection(),
        templateId: "tmpl-1",
      })
    ).toEqual([]);
  });

  it("TEMPLATE_SELECTION still requires reflection", () => {
    const issues = submissionIssues({
      sourceType: "TEMPLATE_SELECTION",
      reflection: EMPTY_REFLECTION,
      templateId: "tmpl-1",
    });
    expect(issues.length).toBe(4);
  });
});

describe("status predicates", () => {
  it("isSubmissionEditable is true only for DRAFT and CHANGES_REQUESTED", () => {
    expect(isSubmissionEditable("DRAFT")).toBe(true);
    expect(isSubmissionEditable("CHANGES_REQUESTED")).toBe(true);
    expect(isSubmissionEditable("SUBMITTED")).toBe(false);
    expect(isSubmissionEditable("IN_REVIEW")).toBe(false);
    expect(isSubmissionEditable("APPROVED")).toBe(false);
    expect(isSubmissionEditable("REJECTED")).toBe(false);
  });

  it("isSubmissionReviewable is true only for SUBMITTED and IN_REVIEW", () => {
    expect(isSubmissionReviewable("SUBMITTED")).toBe(true);
    expect(isSubmissionReviewable("IN_REVIEW")).toBe(true);
    expect(isSubmissionReviewable("DRAFT")).toBe(false);
    expect(isSubmissionReviewable("CHANGES_REQUESTED")).toBe(false);
    expect(isSubmissionReviewable("APPROVED")).toBe(false);
    expect(isSubmissionReviewable("REJECTED")).toBe(false);
  });
});
