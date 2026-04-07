import { describe, expect, it } from "vitest";
import {
  DEFAULT_COURSE_CONFIG,
  LESSON_DESIGN_UNDERSTANDING_QUESTIONS,
  UNDERSTANDING_PASS_SCORE_PCT,
  buildUnderstandingChecksState,
  buildWeeklyTopicsFromSessionPlans,
  getCourseConfigValidationIssues,
  getCurriculumDraftProgress,
  syncSessionPlansToCourseConfig,
} from "@/lib/curriculum-draft-progress";

const courseConfig = {
  ...DEFAULT_COURSE_CONFIG,
  durationWeeks: 2,
  sessionsPerWeek: 2,
  classDurationMin: 60,
  estimatedHours: 4,
};

function buildSession(weekNumber: number, sessionNumber: number) {
  return {
    id: `session-${weekNumber}-${sessionNumber}`,
    weekNumber,
    sessionNumber,
    title: `Week ${weekNumber} Session ${sessionNumber}`,
    classDurationMin: 60,
    objective: `Students will practice skill ${weekNumber}.${sessionNumber}`,
    teacherPrepNotes: "Print materials and prep slides.",
    materialsChecklist: ["Slides", "Handout"],
    atHomeAssignment: {
      type: "REFLECTION_PROMPT",
      title: `Reflection ${weekNumber}.${sessionNumber}`,
      description: "Reflect on the main skill from today.",
    },
    activities: [
      { title: "Warm up", type: "WARM_UP", durationMin: 10 },
      { title: "Mini lesson", type: "INSTRUCTION", durationMin: 20 },
      { title: "Practice", type: "PRACTICE", durationMin: 20 },
    ],
  };
}

function buildPassingUnderstandingChecks() {
  const answers = Object.fromEntries(
    LESSON_DESIGN_UNDERSTANDING_QUESTIONS.map((question) => [
      question.id,
      question.correctAnswer,
    ])
  );
  return buildUnderstandingChecksState(answers);
}

describe("curriculum draft progress", () => {
  it("pads or trims session plans to match the configured course shape", () => {
    const synced = syncSessionPlansToCourseConfig([buildSession(1, 1)], courseConfig);

    expect(synced).toHaveLength(4);
    expect(synced[0].title).toBe("Week 1 Session 1");
    expect(synced[3].weekNumber).toBe(2);
    expect(synced[3].sessionNumber).toBe(2);
    expect(synced[3].title).toBe("");
  });

  it("recomputes week and session numbering when sessions per week changes", () => {
    const synced = syncSessionPlansToCourseConfig(
      [buildSession(1, 1), buildSession(2, 1)],
      {
        ...courseConfig,
        durationWeeks: 2,
        sessionsPerWeek: 2,
      }
    );

    expect(synced).toHaveLength(4);
    expect(synced[0]).toMatchObject({ weekNumber: 1, sessionNumber: 1 });
    expect(synced[1]).toMatchObject({ weekNumber: 1, sessionNumber: 2 });
    expect(synced[2]).toMatchObject({ weekNumber: 2, sessionNumber: 1 });
    expect(synced[3]).toMatchObject({ weekNumber: 2, sessionNumber: 2 });
  });

  it("normalizes invalid activity and at-home assignment types to safe defaults", () => {
    const synced = syncSessionPlansToCourseConfig(
      [
        {
          ...buildSession(1, 1),
          activities: [
            {
              title: "Mystery block",
              type: "NOT_A_REAL_ACTIVITY",
              durationMin: 12,
            },
          ],
          atHomeAssignment: {
            type: "NOT_A_REAL_ASSIGNMENT",
            title: "Try it",
            description: "Complete the practice.",
          },
        },
      ],
      courseConfig
    );

    expect(synced[0].activities[0]?.type).toBe("WARM_UP");
    expect(synced[0].atHomeAssignment?.type).toBe("REFLECTION_PROMPT");
  });

  it("passes the understanding check when the correct answers are selected", () => {
    const checks = buildPassingUnderstandingChecks();

    expect(checks.passed).toBe(true);
    expect(checks.lastScorePct).toBeGreaterThanOrEqual(UNDERSTANDING_PASS_SCORE_PCT);
    expect(checks.completedAt).not.toBeNull();
  });

  it("marks a fully built configured curriculum as ready for submission", () => {
    const weeklyPlans = [
      buildSession(1, 1),
      buildSession(1, 2),
      buildSession(2, 1),
      buildSession(2, 2),
    ];

    const progress = getCurriculumDraftProgress({
      title: "Ready to Teach Finance",
      interestArea: "Finance",
      outcomes: ["Budget responsibly", "Set savings goals", "Explain credit basics"],
      courseConfig,
      weeklyPlans,
      understandingChecks: buildPassingUnderstandingChecks(),
    });

    expect(progress.readyForSubmission).toBe(true);
    expect(progress.fullyBuiltSessions).toBe(4);
    expect(progress.totalSessionsExpected).toBe(4);
    expect(progress.submissionIssues).toHaveLength(0);
  });

  it("blocks submission when sessions or understanding are incomplete", () => {
    const progress = getCurriculumDraftProgress({
      title: "Incomplete Studio Draft",
      interestArea: "Design",
      outcomes: ["Prototype ideas"],
      courseConfig,
      weeklyPlans: [
        buildSession(1, 1),
        {
          ...buildSession(1, 2),
          objective: "",
          atHomeAssignment: null,
          activities: [{ title: "Only one activity", type: "PRACTICE", durationMin: 20 }],
        },
      ],
      understandingChecks: buildUnderstandingChecksState({}),
    });

    expect(progress.readyForSubmission).toBe(false);
    expect(progress.submissionIssues).toContain("Add at least 3 learning outcomes.");
    expect(progress.submissionIssues).toContain(
      "Write a concrete objective for every session."
    );
    expect(progress.submissionIssues).toContain(
      "Add an at-home assignment to every session."
    );
    expect(progress.submissionIssues).toContain(
      `Pass the curriculum understanding check with at least ${UNDERSTANDING_PASS_SCORE_PCT}%.`
    );
  });

  it("reports invalid student count relationships in the course shape", () => {
    const issues = getCourseConfigValidationIssues({
      ...courseConfig,
      minStudents: 14,
      idealSize: 10,
      maxStudents: 9,
    });

    expect(issues).toContain(
      "Set the minimum student count so it is not greater than the ideal class size."
    );
    expect(issues).toContain(
      "Set the ideal class size so it is not greater than the maximum student count."
    );
  });

  it("blocks submission when the course shape has impossible student counts", () => {
    const weeklyPlans = [
      buildSession(1, 1),
      buildSession(1, 2),
      buildSession(2, 1),
      buildSession(2, 2),
    ];

    const progress = getCurriculumDraftProgress({
      title: "Ready Except for Class Size",
      interestArea: "Finance",
      outcomes: ["Budget responsibly", "Set savings goals", "Explain credit basics"],
      courseConfig: {
        ...courseConfig,
        minStudents: 18,
        idealSize: 12,
        maxStudents: 10,
      },
      weeklyPlans,
      understandingChecks: buildPassingUnderstandingChecks(),
    });

    expect(progress.readyForSubmission).toBe(false);
    expect(progress.submissionIssues).toContain(
      "Set the minimum student count so it is not greater than the ideal class size."
    );
    expect(progress.submissionIssues).toContain(
      "Set the ideal class size so it is not greater than the maximum student count."
    );
  });

  it("builds grouped weekly topics from multiple sessions per week", () => {
    const topics = buildWeeklyTopicsFromSessionPlans(
      [
        buildSession(1, 1),
        buildSession(1, 2),
        buildSession(2, 1),
        buildSession(2, 2),
      ],
      courseConfig
    );

    expect(topics).toHaveLength(2);
    expect(topics[0].topic).toContain("Week 1 Session 1");
    expect(topics[0].topic).toContain("Week 1 Session 2");
    expect(topics[1].outcomes).toContain("Students will practice skill 2.1");
  });
});
