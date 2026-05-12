/**
 * Pure unit tests for the Summer Workshop Instructor outline schema and
 * helpers. No DB / no IO — only the Zod schema and the tiny utility
 * helpers in `lib/summer-workshop.ts`.
 */

import { describe, expect, it } from "vitest";

import {
  workshopOutlineSchema,
  summerWorkshopInstructorApplicationSchema,
} from "@/lib/application-schemas";
import {
  isSummerWorkshopSubtype,
  isSummerWorkshopTrack,
  isWorkshopOutlineComplete,
  subtypeBadge,
  subtypeForTrack,
  trackLabel,
  workshopOutlineWarnings,
} from "@/lib/summer-workshop";

const completeOutline = (overrides: Record<string, unknown> = {}) => ({
  title: "Public Speaking 101",
  ageRange: "Grades 6–8",
  durationMinutes: 45,
  learningGoals: ["Identify a strong opening", "Practice a 60-second talk"],
  activityFlow:
    "Hook (5 min) → mini-lesson on opening lines (10 min) → pair practice (20 min) → 60-second share-outs (10 min).",
  materialsNeeded: ["Index cards", "Markers"],
  engagementHook:
    "Show two clip openings (one strong, one weak) and ask the room which kept their attention.",
  adaptationNotes:
    "If the group is shy, switch from share-outs to silent peer feedback on index cards.",
  ...overrides,
});

describe("workshopOutlineSchema", () => {
  it("accepts a complete outline", () => {
    const result = workshopOutlineSchema.safeParse(completeOutline());
    expect(result.success).toBe(true);
  });

  it("requires a title with at least 3 characters", () => {
    const result = workshopOutlineSchema.safeParse(completeOutline({ title: "AB" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path[0]).toBe("title");
    }
  });

  it("rejects durations under 15 minutes", () => {
    const result = workshopOutlineSchema.safeParse(completeOutline({ durationMinutes: 10 }));
    expect(result.success).toBe(false);
  });

  it("rejects durations over 240 minutes", () => {
    const result = workshopOutlineSchema.safeParse(completeOutline({ durationMinutes: 300 }));
    expect(result.success).toBe(false);
  });

  it("requires at least one learning goal", () => {
    const result = workshopOutlineSchema.safeParse(completeOutline({ learningGoals: [] }));
    expect(result.success).toBe(false);
  });

  it("caps learning goals at 5", () => {
    const result = workshopOutlineSchema.safeParse(
      completeOutline({ learningGoals: ["a", "b", "c", "d", "e", "f"] })
    );
    expect(result.success).toBe(false);
  });

  it("treats materialsNeeded as optional and defaults to []", () => {
    const { materialsNeeded: _ignored, ...rest } = completeOutline();
    void _ignored;
    const result = workshopOutlineSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.materialsNeeded).toEqual([]);
    }
  });

  it("requires a minimum-length engagement hook", () => {
    const result = workshopOutlineSchema.safeParse(
      completeOutline({ engagementHook: "short" })
    );
    expect(result.success).toBe(false);
  });

  it("requires a minimum-length adaptation note", () => {
    const result = workshopOutlineSchema.safeParse(
      completeOutline({ adaptationNotes: "tiny" })
    );
    expect(result.success).toBe(false);
  });

  it("requires a minimum-length activity flow", () => {
    const result = workshopOutlineSchema.safeParse(
      completeOutline({ activityFlow: "too short" })
    );
    expect(result.success).toBe(false);
  });
});

describe("workshopOutlineWarnings", () => {
  it("returns an explicit warning when the outline is missing", () => {
    expect(workshopOutlineWarnings(null)).toEqual(["Workshop outline is missing."]);
    expect(workshopOutlineWarnings(undefined)).toEqual(["Workshop outline is missing."]);
  });

  it("flags every missing field", () => {
    const warnings = workshopOutlineWarnings({
      title: "",
      ageRange: "",
      durationMinutes: 0,
      learningGoals: [],
      activityFlow: "",
      materialsNeeded: [],
      engagementHook: "",
      adaptationNotes: "",
    });
    expect(warnings).toContain("Title is missing.");
    expect(warnings).toContain("Age range is missing.");
    expect(warnings).toContain("Duration is missing or invalid.");
    expect(warnings).toContain("Learning goals are missing.");
    expect(warnings).toContain("Activity flow is missing or too short.");
    expect(warnings).toContain("Engagement hook is missing.");
    expect(warnings).toContain("Adaptation notes are missing.");
  });

  it("returns no warnings for a complete outline", () => {
    expect(workshopOutlineWarnings(completeOutline() as never)).toEqual([]);
    expect(isWorkshopOutlineComplete(completeOutline() as never)).toBe(true);
  });

  it("warns when activity flow is shorter than 30 chars", () => {
    expect(
      workshopOutlineWarnings({
        ...completeOutline(),
        activityFlow: "short",
      } as never)
    ).toContain("Activity flow is missing or too short.");
  });
});

describe("summerWorkshopInstructorApplicationSchema", () => {
  const baseInstructorPayload = {
    legalName: "Ada Lovelace",
    preferredFirstName: "Ada",
    city: "Boston",
    stateProvince: "MA",
    zipCode: "02118",
    country: "United States" as const,
    schoolName: "Camp Hill High",
    graduationYear: 2026,
    teachingExperience:
      "Tutored 3 middle-schoolers in math last summer and helped lead a one-day robotics workshop at YPP camp.",
    availability: "Tuesday and Thursday afternoons in July; flexible most weekends.",
    hoursPerWeek: 5,
  };

  it("accepts a valid SW application with the workshop outline", () => {
    const result = summerWorkshopInstructorApplicationSchema.safeParse({
      ...baseInstructorPayload,
      workshopOutline: completeOutline(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects when workshopOutline is missing", () => {
    const result = summerWorkshopInstructorApplicationSchema.safeParse(
      baseInstructorPayload
    );
    expect(result.success).toBe(false);
  });

  it("relaxes teaching experience minimum vs the standard schema", () => {
    const result = summerWorkshopInstructorApplicationSchema.safeParse({
      ...baseInstructorPayload,
      teachingExperience:
        "Helped run summer camps for two years; comfortable with grades 4–8.",
      workshopOutline: completeOutline(),
    });
    expect(result.success).toBe(true);
  });

  it("does not require courseOutline / firstClassPlan / courseIdea", () => {
    const result = summerWorkshopInstructorApplicationSchema.safeParse({
      ...baseInstructorPayload,
      courseIdea: "",
      courseOutline: "",
      firstClassPlan: "",
      workshopOutline: completeOutline(),
    });
    expect(result.success).toBe(true);
  });
});

describe("track + subtype helpers", () => {
  it("isSummerWorkshopTrack identifies the SW track", () => {
    expect(isSummerWorkshopTrack("SUMMER_WORKSHOP_INSTRUCTOR")).toBe(true);
    expect(isSummerWorkshopTrack("STANDARD_INSTRUCTOR")).toBe(false);
    expect(isSummerWorkshopTrack(null)).toBe(false);
  });

  it("isSummerWorkshopSubtype identifies the SW subtype", () => {
    expect(isSummerWorkshopSubtype("SUMMER_WORKSHOP")).toBe(true);
    expect(isSummerWorkshopSubtype("STANDARD")).toBe(false);
    expect(isSummerWorkshopSubtype(null)).toBe(false);
  });

  it("subtypeForTrack maps tracks to the post-acceptance subtype", () => {
    expect(subtypeForTrack("SUMMER_WORKSHOP_INSTRUCTOR")).toBe("SUMMER_WORKSHOP");
    expect(subtypeForTrack("STANDARD_INSTRUCTOR")).toBe("STANDARD");
  });

  it("trackLabel + subtypeBadge produce stable display values", () => {
    // STANDARD copy reframed to "Full Instructor" so Summer Workshop
    // doesn't read as a lesser role — see commit 39b0479.
    expect(trackLabel("SUMMER_WORKSHOP_INSTRUCTOR")).toBe("Summer Workshop");
    expect(trackLabel("STANDARD_INSTRUCTOR")).toBe("Full Instructor");
    expect(subtypeBadge("SUMMER_WORKSHOP")).toBe("SW");
    expect(subtypeBadge("STANDARD")).toBe(null);
  });
});
