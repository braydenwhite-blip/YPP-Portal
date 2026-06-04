import { describe, expect, it } from "vitest";
import { buildTrainingEvidence } from "@/lib/training-evidence";

const modules = [
  { id: "m0", goalKey: "WELCOME", title: "Welcome to YPP", journeyId: "j0" },
  { id: "m1", goalKey: "GOAL_1", title: "Curriculum & Class Delivery", journeyId: "j1" },
  { id: "m2", goalKey: "GOAL_2", title: "Student & Family Relationships", journeyId: "j2" },
  { id: "m3", goalKey: "GOAL_3", title: "Organization & Reliability", journeyId: "j3" },
  { id: "m4", goalKey: "GOAL_4", title: "Community Involvement", journeyId: "j4" },
  { id: "m5", goalKey: "GOAL_5", title: "Long-Term Growth", journeyId: "j5" },
  { id: "m6", goalKey: "CAPSTONE", title: "Readiness Check", journeyId: "j6" },
];

describe("buildTrainingEvidence", () => {
  it("maps per-GOAL status and journey scores", () => {
    const evidence = buildTrainingEvidence({
      instructorIds: ["u1"],
      modules,
      assignments: [
        { userId: "u1", moduleId: "m1", status: "COMPLETE" },
        { userId: "u1", moduleId: "m2", status: "IN_PROGRESS" },
      ],
      completions: [
        { userId: "u1", journeyId: "j1", scorePct: 92, passed: true },
      ],
      beatAttempts: [],
      drafts: [],
    }).get("u1")!;

    const g1 = evidence.goals.find((g) => g.goalKey === "GOAL_1")!;
    expect(g1.status).toBe("COMPLETE");
    expect(g1.scorePct).toBe(92);
    expect(g1.passed).toBe(true);

    const g2 = evidence.goals.find((g) => g.goalKey === "GOAL_2")!;
    expect(g2.status).toBe("IN_PROGRESS");
    expect(g2.scorePct).toBeNull();

    const g3 = evidence.goals.find((g) => g.goalKey === "GOAL_3")!;
    expect(g3.status).toBe("NOT_STARTED");
  });

  it("marks academyComplete only when all numbered goals are complete", () => {
    const assignments = ["m1", "m2", "m3", "m4", "m5"].map((moduleId) => ({
      userId: "u1",
      moduleId,
      status: "COMPLETE",
    }));
    const evidence = buildTrainingEvidence({
      instructorIds: ["u1"],
      modules,
      assignments,
      completions: [],
      beatAttempts: [],
      drafts: [],
    }).get("u1")!;
    expect(evidence.academyComplete).toBe(true);
  });

  it("is not academyComplete when a numbered goal is missing", () => {
    const assignments = ["m1", "m2", "m3", "m4"].map((moduleId) => ({
      userId: "u1",
      moduleId,
      status: "COMPLETE",
    }));
    const evidence = buildTrainingEvidence({
      instructorIds: ["u1"],
      modules,
      assignments,
      completions: [],
      beatAttempts: [],
      drafts: [],
    }).get("u1")!;
    expect(evidence.academyComplete).toBe(false);
  });

  it("surfaces never-correct and high-retry beats as topics to probe", () => {
    const evidence = buildTrainingEvidence({
      instructorIds: ["u1"],
      modules,
      assignments: [],
      completions: [],
      beatAttempts: [
        // Never correct across two tries → probe.
        { userId: "u1", beatTitle: "Differentiation choice", goalKey: "GOAL_1", attemptNumber: 1, correct: false },
        { userId: "u1", beatTitle: "Differentiation choice", goalKey: "GOAL_1", attemptNumber: 2, correct: false },
        // Eventually correct but took 3 tries → probe.
        { userId: "u1", beatTitle: "Parent update", goalKey: "GOAL_2", attemptNumber: 1, correct: false },
        { userId: "u1", beatTitle: "Parent update", goalKey: "GOAL_2", attemptNumber: 3, correct: true },
        // First-try correct → not a probe.
        { userId: "u1", beatTitle: "Session arc", goalKey: "GOAL_1", attemptNumber: 1, correct: true },
      ],
      drafts: [],
    }).get("u1")!;

    const titles = evidence.topicsToProbe.map((t) => t.beatTitle);
    expect(titles).toContain("Differentiation choice");
    expect(titles).toContain("Parent update");
    expect(titles).not.toContain("Session arc");

    // Never-correct beats sort ahead of merely high-retry ones.
    expect(evidence.topicsToProbe[0].beatTitle).toBe("Differentiation choice");
    expect(evidence.topicsToProbe[0].everCorrect).toBe(false);
    expect(evidence.topicsToProbe[0].goalBadge).toBe("GOAL 1");
  });

  it("takes the most recent Studio draft and normalizes its rubric", () => {
    const evidence = buildTrainingEvidence({
      instructorIds: ["u1"],
      modules,
      assignments: [],
      completions: [],
      beatAttempts: [],
      // getTrainingEvidenceMany orders drafts newest-first; first wins.
      drafts: [
        {
          authorId: "u1",
          status: "APPROVED",
          reviewRubric: {
            scores: { clarity: 4, sequencing: 3, studentExperience: 4, launchReadiness: 3 },
            summary: "Strong package.",
          },
          submittedAt: "2026-06-01T00:00:00.000Z",
        },
        {
          authorId: "u1",
          status: "NEEDS_REVISION",
          reviewRubric: null,
          submittedAt: "2026-05-01T00:00:00.000Z",
        },
      ],
    }).get("u1")!;

    expect(evidence.studioRubric?.status).toBe("APPROVED");
    expect(evidence.studioRubric?.rubric.scores.clarity).toBe(4);
    expect(evidence.studioRubric?.rubric.summary).toBe("Strong package.");
  });

  it("returns empty evidence for instructors with no data", () => {
    const evidence = buildTrainingEvidence({
      instructorIds: ["u1"],
      modules,
      assignments: [],
      completions: [],
      beatAttempts: [],
      drafts: [],
    }).get("u1")!;
    expect(evidence.studioRubric).toBeNull();
    expect(evidence.topicsToProbe).toEqual([]);
    expect(evidence.academyComplete).toBe(false);
    expect(evidence.goals).toHaveLength(7);
  });
});
