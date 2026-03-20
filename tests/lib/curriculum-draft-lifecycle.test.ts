import { describe, expect, it } from "vitest";
import {
  buildWorkingCopyCurriculumDraftRecord,
  isEditableCurriculumDraftStatus,
  pickPrimaryEditableCurriculumDraft,
  sortCurriculumDraftsForChooser,
} from "@/lib/curriculum-draft-lifecycle";
import {
  DEFAULT_COURSE_CONFIG,
  buildUnderstandingChecksState,
} from "@/lib/curriculum-draft-progress";

function buildDraft(overrides: Partial<any> = {}) {
  return {
    id: "draft-1",
    status: "IN_PROGRESS",
    updatedAt: new Date("2026-03-18T14:00:00.000Z"),
    ...overrides,
  };
}

describe("curriculum draft lifecycle helpers", () => {
  it("recognizes the editable draft statuses", () => {
    expect(isEditableCurriculumDraftStatus("IN_PROGRESS")).toBe(true);
    expect(isEditableCurriculumDraftStatus("COMPLETED")).toBe(true);
    expect(isEditableCurriculumDraftStatus("NEEDS_REVISION")).toBe(true);
    expect(isEditableCurriculumDraftStatus("SUBMITTED")).toBe(false);
  });

  it("picks the newest editable draft as the primary working draft", () => {
    const primary = pickPrimaryEditableCurriculumDraft([
      buildDraft({
        id: "submitted",
        status: "SUBMITTED",
        updatedAt: new Date("2026-03-18T16:00:00.000Z"),
      }),
      buildDraft({
        id: "older-editable",
        status: "IN_PROGRESS",
        updatedAt: new Date("2026-03-18T12:00:00.000Z"),
      }),
      buildDraft({
        id: "newer-editable",
        status: "COMPLETED",
        updatedAt: new Date("2026-03-18T15:00:00.000Z"),
      }),
    ]);

    expect(primary?.id).toBe("newer-editable");
  });

  it("sorts the primary editable draft to the top of the chooser list", () => {
    const ordered = sortCurriculumDraftsForChooser([
      buildDraft({
        id: "history",
        status: "APPROVED",
        updatedAt: new Date("2026-03-18T17:00:00.000Z"),
      }),
      buildDraft({
        id: "active",
        status: "IN_PROGRESS",
        updatedAt: new Date("2026-03-18T15:00:00.000Z"),
      }),
    ]);

    expect(ordered[0]?.id).toBe("active");
    expect(ordered[1]?.id).toBe("history");
  });

  it("keeps a copied ready-to-submit draft in completed status", () => {
    const workingCopy = buildWorkingCopyCurriculumDraftRecord({
      title: "Ready Draft",
      description: "A full curriculum",
      interestArea: "Finance",
      outcomes: ["One", "Two", "Three"],
      courseConfig: {
        ...DEFAULT_COURSE_CONFIG,
        durationWeeks: 1,
      },
      weeklyPlans: [
        {
          id: "session-1",
          weekNumber: 1,
          sessionNumber: 1,
          title: "Week 1",
          classDurationMin: 60,
          objective: "Students practice budgeting.",
          teacherPrepNotes: "Prep slides.",
          materialsChecklist: ["Slides"],
          atHomeAssignment: {
            type: "REFLECTION_PROMPT",
            title: "Reflect",
            description: "Reflect on budgeting.",
          },
          activities: [
            { title: "Warm up", type: "WARM_UP", durationMin: 10 },
            { title: "Teach", type: "INSTRUCTION", durationMin: 20 },
            { title: "Practice", type: "PRACTICE", durationMin: 20 },
          ],
        },
      ],
      understandingChecks: buildUnderstandingChecksState({
        objective_alignment:
          "It names what students will be able to do by the end of the session.",
        session_pacing:
          "A realistic plan protects flow, transitions, and student energy in real teaching.",
        activity_sequence:
          "Students learn better when the session builds from entry, to understanding, to application, to closure.",
        homework_purpose:
          "Extend or reinforce the learning from the session in a manageable way.",
        example_usage:
          "Study why they work, then adapt the moves to fit their own curriculum and students.",
        course_outcomes:
          "Outcomes clarify what students should leave able to do, which helps the whole sequence stay coherent.",
        differentiation_use:
          "They help the instructor plan how the same activity can still work for students who need more support or more challenge.",
        capstone_goal:
          "A full curriculum package that is ready for review and close to ready to teach, not just a rough outline.",
      }),
    });

    expect(workingCopy.status).toBe("COMPLETED");
    expect(workingCopy.reviewNotes).toBeNull();
    expect(workingCopy.generatedTemplateId).toBeNull();
  });

  it("syncs copied session plans to the active course shape", () => {
    const workingCopy = buildWorkingCopyCurriculumDraftRecord({
      title: "Expanded Draft",
      description: "A curriculum that now has more sessions.",
      interestArea: "Finance",
      outcomes: ["One", "Two", "Three"],
      courseConfig: {
        ...DEFAULT_COURSE_CONFIG,
        durationWeeks: 2,
        sessionsPerWeek: 2,
      },
      weeklyPlans: [
        {
          id: "session-1",
          weekNumber: 1,
          sessionNumber: 1,
          title: "Week 1",
          classDurationMin: 60,
          objective: "Students practice budgeting.",
          teacherPrepNotes: "Prep slides.",
          materialsChecklist: ["Slides"],
          atHomeAssignment: {
            type: "REFLECTION_PROMPT",
            title: "Reflect",
            description: "Reflect on budgeting.",
          },
          activities: [
            { title: "Warm up", type: "WARM_UP", durationMin: 10 },
            { title: "Teach", type: "INSTRUCTION", durationMin: 20 },
            { title: "Practice", type: "PRACTICE", durationMin: 20 },
          ],
        },
      ],
      understandingChecks: buildUnderstandingChecksState({}),
    });

    expect(workingCopy.weeklyPlans).toHaveLength(4);
    expect(workingCopy.weeklyPlans[0]).toMatchObject({
      weekNumber: 1,
      sessionNumber: 1,
      title: "Week 1",
    });
    expect(workingCopy.weeklyPlans[3]).toMatchObject({
      weekNumber: 2,
      sessionNumber: 2,
      title: "",
      activities: [],
    });
  });
});
