import { describe, it, expect } from "vitest";
import { detectChapterStages } from "@/lib/automation/stage-detector";
import { facts } from "./_fixtures";

describe("automation/stage-detector", () => {
  it("a brand-new chapter is NEW_CHAPTER", () => {
    const d = detectChapterStages(facts());
    expect(d.primaryStage).toBe("NEW_CHAPTER");
    expect(d.activeStages).toContain("NEW_CHAPTER");
    expect(d.blockingGaps.length).toBeGreaterThan(0);
  });

  it("detects multiple concurrent stages and anchors on the earliest blocking one", () => {
    const d = detectChapterStages(
      facts({
        weekNumber: 6,
        partnersConfirmed: 1,
        partnersConfirmedLogisticsIncomplete: 1, // PARTNER_CLOSING (blocking)
        curriculaSubmitted: 2,
        curriculaApproved: 0, // CURRICULUM_BUILDING
        classesTotal: 1,
        classesPublic: 1, // STUDENT_RECRUITMENT
        instructorApplicants: 10,
        instructorsHired: 1, // INSTRUCTOR_RECRUITING
      })
    );
    expect(d.activeStages).toContain("PARTNER_CLOSING");
    expect(d.activeStages).toContain("CURRICULUM_BUILDING");
    expect(d.activeStages).toContain("STUDENT_RECRUITMENT");
    expect(d.activeStages).toContain("INSTRUCTOR_RECRUITING");
    // PARTNER_CLOSING is the earliest stage with a blocking gap
    expect(d.primaryStage).toBe("PARTNER_CLOSING");
    expect(d.nextStageRequirements.length).toBeGreaterThan(0);
  });

  it("running classes mark LIVE_CLASSES active", () => {
    const d = detectChapterStages(facts({ weekNumber: 9, classesRunning: 2, partnersConfirmed: 1 }));
    expect(d.activeStages).toContain("LIVE_CLASSES");
  });
});
