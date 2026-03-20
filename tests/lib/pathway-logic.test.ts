import { describe, expect, it } from "vitest";

import {
  getCourseBackedPathwayStepsThroughOrder,
  getPathwayProgressSummary,
  getRequiredCourseStepsFor,
} from "@/lib/pathway-logic";

describe("pathway-logic", () => {
  it("treats an explicitly loaded empty prerequisite list as a real root step", () => {
    const steps = [
      {
        id: "step-1",
        stepOrder: 1,
        courseId: "course-1",
        course: { title: "Intro" },
        prerequisites: [],
      },
    ];

    expect(getRequiredCourseStepsFor(steps[0], steps)).toEqual([]);
  });

  it("falls back to the previous course-backed step when a milestone sits between courses", () => {
    const introStep = {
      id: "step-1",
      stepOrder: 1,
      courseId: "course-1",
      course: { title: "Intro" },
    };
    const milestoneStep = {
      id: "step-2",
      stepOrder: 2,
      courseId: null,
      title: "Checkpoint",
    };
    const advancedStep = {
      id: "step-3",
      stepOrder: 3,
      courseId: "course-2",
      course: { title: "Advanced" },
    };

    expect(
      getRequiredCourseStepsFor(advancedStep, [
        introStep,
        milestoneStep,
        advancedStep,
      ]).map((step) => step.courseId)
    ).toEqual(["course-1"]);
  });

  it("keeps progress based on course-backed steps and surfaces the current in-progress course", () => {
    const steps = [
      {
        id: "step-1",
        stepOrder: 1,
        courseId: "course-1",
        course: { title: "Intro" },
      },
      {
        id: "step-2",
        stepOrder: 2,
        courseId: null,
        title: "Milestone",
      },
      {
        id: "step-3",
        stepOrder: 3,
        courseId: "course-2",
        course: { title: "Advanced" },
      },
    ];

    const summary = getPathwayProgressSummary(
      steps,
      new Map([["course-1", "ENROLLED"]])
    );

    expect(summary.totalCount).toBe(2);
    expect(summary.completedCount).toBe(0);
    expect(summary.progressPercent).toBe(0);
    expect(summary.currentStep?.courseId).toBe("course-1");
    expect(summary.nextActionStep?.courseId).toBe("course-1");
  });

  it("counts only course-backed steps toward event requirements", () => {
    const steps = [
      {
        id: "step-1",
        stepOrder: 1,
        courseId: "course-1",
        course: { title: "Intro" },
      },
      {
        id: "step-2",
        stepOrder: 2,
        courseId: null,
        title: "Milestone",
      },
      {
        id: "step-3",
        stepOrder: 3,
        courseId: "course-2",
        course: { title: "Advanced" },
      },
    ];

    expect(
      getCourseBackedPathwayStepsThroughOrder(steps, 2).map(
        (step) => step.courseId
      )
    ).toEqual(["course-1"]);
  });
});
