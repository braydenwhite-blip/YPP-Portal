import { describe, expect, it } from "vitest";
import {
  buildGuidedStudioJourney,
  buildLessonDesignStudioHref,
  deriveStudioPhase,
  getCanonicalStudioHref,
  getStudioEntryContextFromSearchParams,
} from "@/lib/lesson-design-studio";

function buildProgress(overrides: Record<string, unknown> = {}) {
  return {
    fullyBuiltSessions: 0,
    totalSessionsExpected: 4,
    sessionsWithTitles: 0,
    sessionsWithObjectives: 0,
    sessionsWithThreeActivities: 0,
    sessionsWithAtHomeAssignments: 0,
    sessionsWithinTimeBudget: 0,
    hasFirstWeekWithThreeActivities: false,
    hasAnyObjective: false,
    hasAnyAtHomeAssignment: false,
    understandingChecksPassed: false,
    readyForSubmission: false,
    submissionIssues: ["Missing required pieces"],
    ...overrides,
  } as any;
}

describe("lesson design studio helpers", () => {
  it("keeps the canonical route unchanged when no redirect is needed", () => {
    expect(getCanonicalStudioHref({})).toBeNull();
  });

  it("removes legacy templateId links and keeps application status entry metadata", () => {
    expect(
      getCanonicalStudioHref({
        templateId: "tmpl_123",
        entry: "application-status",
      })
    ).toBe("/instructor/lesson-design-studio?entry=application-status");
  });

  it("normalizes underscored entry values to the canonical hyphenated route", () => {
    expect(
      getCanonicalStudioHref({
        entry: "application_status",
      })
    ).toBe("/instructor/lesson-design-studio?entry=application-status");
    expect(
      getStudioEntryContextFromSearchParams({ entry: "application_status" })
    ).toBe("APPLICATION_STATUS");
  });

  it("preserves the selected draft id when canonicalizing studio links", () => {
    expect(
      getCanonicalStudioHref({
        entry: "application_status",
        draftId: "draft_123",
      })
    ).toBe("/instructor/lesson-design-studio?entry=application-status&draftId=draft_123");
  });

  it("builds chooser and editor links with optional draft ids", () => {
    expect(
      buildLessonDesignStudioHref({
        entryContext: "TRAINING",
        draftId: "draft_456",
      })
    ).toBe("/instructor/lesson-design-studio?entry=training&draftId=draft_456");
    expect(buildLessonDesignStudioHref()).toBe("/instructor/lesson-design-studio");
  });

  it("starts in the starter phase when the draft is blank", () => {
    expect(
      deriveStudioPhase({
        title: "",
        interestArea: "",
        outcomes: [],
        progress: buildProgress(),
      })
    ).toBe("START");
  });

  it("moves into course map work once the draft has started but is not yet structured", () => {
    expect(
      deriveStudioPhase({
        title: "Money Moves",
        interestArea: "",
        outcomes: ["Understand saving"],
        progress: buildProgress(),
      })
    ).toBe("COURSE_MAP");
  });

  it("moves into session building after the course map is ready", () => {
    expect(
      deriveStudioPhase({
        title: "Money Moves",
        interestArea: "Personal Finance",
        outcomes: [
          "Understand saving",
          "Build a spending plan",
          "Practice financial decision making",
        ],
        progress: buildProgress(),
      })
    ).toBe("SESSIONS");
  });

  it("moves into readiness once sessions are complete but submission blockers remain", () => {
    expect(
      deriveStudioPhase({
        title: "Money Moves",
        interestArea: "Personal Finance",
        outcomes: [
          "Understand saving",
          "Build a spending plan",
          "Practice financial decision making",
        ],
        progress: buildProgress({
          sessionsWithTitles: 4,
          sessionsWithObjectives: 4,
          sessionsWithThreeActivities: 4,
          sessionsWithAtHomeAssignments: 4,
          sessionsWithinTimeBudget: 4,
        }),
      })
    ).toBe("READINESS");
  });

  it("moves into the review and launch phase for reviewer-controlled statuses", () => {
    expect(
      deriveStudioPhase({
        status: "SUBMITTED",
        progress: buildProgress({ readyForSubmission: true }),
      })
    ).toBe("REVIEW_LAUNCH");
  });

  it("shows a started draft as current when the instructor revisits the first step", () => {
    const journey = buildGuidedStudioJourney({
      activePhase: "START",
      title: "Money Moves",
      interestArea: "Personal Finance",
      outcomes: [
        "Understand saving",
        "Build a spending plan",
        "Practice financial decision making",
      ],
      progress: buildProgress({
        sessionsWithTitles: 1,
      }),
    });

    expect(journey.steps.find((step) => step.id === "START")?.status).toBe(
      "current"
    );
    expect(journey.steps.find((step) => step.id === "START")?.blockers).toEqual(
      []
    );
    expect(journey.recommendedAction).toBe("Move into the course map");
  });
});
