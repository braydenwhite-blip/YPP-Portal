import { describe, it, expect } from "vitest";
import { buildStudentAdvisingCockpit } from "@/lib/advising/cockpit";
import {
  buildAdvisorMatchSuggestions,
  scoreAdvisorForStudent,
} from "@/lib/advising/suggestions";
import { deriveAdvisingLifecycle } from "@/lib/advising/relationship";
import type {
  AdvisingAssignmentRow,
  AdvisingAdvisorRow,
  AdvisingCockpitInput,
  AdvisingLane,
} from "@/lib/advising/types";

const NOW = new Date("2026-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

function assignment(
  over: Partial<AdvisingAssignmentRow> & Pick<AdvisingAssignmentRow, "assignmentId" | "studentId" | "studentName" | "advisorId" | "advisorName">,
): AdvisingAssignmentRow {
  return {
    isActive: true,
    advisingStatus: "ENGAGED",
    needsFollowUp: false,
    followUpNote: null,
    nextSteps: null,
    lastCheckInAt: daysAgo(5),
    nextCheckInDueAt: new Date(NOW.getTime() + 9 * DAY),
    startDate: daysAgo(30),
    endedAt: null,
    studentInterests: [],
    studentGrade: null,
    studentChapterName: null,
    noteCount: 1,
    recommendationCount: 0,
    pendingRecommendations: [],
    ...over,
  };
}

function advisor(over: Partial<AdvisingAdvisorRow> & Pick<AdvisingAdvisorRow, "id" | "name">): AdvisingAdvisorRow {
  return {
    interests: [],
    chapterId: null,
    chapterName: null,
    activeCount: 3,
    band: "TYPICAL",
    health: "ACTIVE",
    needsFollowUpCount: 0,
    lastCheckInAt: daysAgo(5),
    ...over,
  };
}

function emptyInput(over: Partial<AdvisingCockpitInput> = {}): AdvisingCockpitInput {
  return {
    assignments: [],
    unadvisedStudents: [],
    advisors: [],
    suggestionsByStudent: {},
    ...over,
  };
}

function laneCards(cockpit: ReturnType<typeof buildStudentAdvisingCockpit>, lane: AdvisingLane) {
  return cockpit.lanes.find((l) => l.lane === lane)!.cards;
}

describe("deriveAdvisingLifecycle", () => {
  it("flags a never-checked-in assignment as KICKOFF_NEEDED", () => {
    const res = deriveAdvisingLifecycle(
      { isActive: true, advisingStatus: "ENGAGED", needsFollowUp: false, followUpNote: null, lastCheckInAt: null, nextCheckInDueAt: null, startDate: daysAgo(3) },
      NOW,
    );
    expect(res.lifecycle).toBe("KICKOFF_NEEDED");
  });

  it("flags a long-quiet relationship as STALE", () => {
    const res = deriveAdvisingLifecycle(
      { isActive: true, advisingStatus: "ENGAGED", needsFollowUp: false, followUpNote: null, lastCheckInAt: daysAgo(75), nextCheckInDueAt: null, startDate: daysAgo(120) },
      NOW,
    );
    expect(res.lifecycle).toBe("STALE");
  });

  it("flags an overdue scheduled check-in as FOLLOW_UP_DUE", () => {
    const res = deriveAdvisingLifecycle(
      { isActive: true, advisingStatus: "ENGAGED", needsFollowUp: false, followUpNote: null, lastCheckInAt: daysAgo(20), nextCheckInDueAt: daysAgo(2), startDate: daysAgo(60) },
      NOW,
    );
    expect(res.lifecycle).toBe("FOLLOW_UP_DUE");
  });

  it("treats a recent check-in with no flags as ACTIVE", () => {
    const res = deriveAdvisingLifecycle(
      { isActive: true, advisingStatus: "ENGAGED", needsFollowUp: false, followUpNote: null, lastCheckInAt: daysAgo(4), nextCheckInDueAt: new Date(NOW.getTime() + 10 * DAY), startDate: daysAgo(40) },
      NOW,
    );
    expect(res.lifecycle).toBe("ACTIVE");
  });

  it("marks ended relationships INACTIVE", () => {
    const res = deriveAdvisingLifecycle(
      { isActive: false, advisingStatus: "INACTIVE", needsFollowUp: false, followUpNote: null, lastCheckInAt: daysAgo(4), nextCheckInDueAt: null, startDate: daysAgo(40) },
      NOW,
    );
    expect(res.lifecycle).toBe("INACTIVE");
  });
});

describe("buildAdvisorMatchSuggestions", () => {
  it("ranks an interest + chapter match above a generic advisor and respects capacity", () => {
    const student = { interests: ["Robotics", "Coding"], chapterId: "ch1", chapterName: "Scarsdale" };
    const strong = advisor({ id: "a1", name: "Aisha", interests: ["Robotics"], chapterId: "ch1", chapterName: "Scarsdale", band: "LOW", activeCount: 1 });
    const weak = advisor({ id: "a2", name: "Ben", interests: ["History"], chapterId: "ch2", band: "TYPICAL", activeCount: 4 });
    const ranked = buildAdvisorMatchSuggestions(student, [weak, strong]);
    expect(ranked[0].advisorId).toBe("a1");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[0].reasons.join(" ")).toMatch(/Robotics/);
  });

  it("penalises an overloaded advisor and surfaces a warning", () => {
    const student = { interests: ["Robotics"], chapterId: "ch1", chapterName: "Scarsdale" };
    const overloaded = advisor({ id: "a1", name: "Aisha", interests: ["Robotics"], chapterId: "ch1", band: "HIGH", activeCount: 9 });
    const sug = scoreAdvisorForStudent(student, overloaded);
    expect(sug.warnings.join(" ")).toMatch(/capacity/i);
  });
});

describe("buildStudentAdvisingCockpit", () => {
  it("puts an unassigned student with no strong match in Needs advisor", () => {
    const cockpit = buildStudentAdvisingCockpit(
      emptyInput({
        unadvisedStudents: [{ id: "s1", name: "Maya", interests: [], grade: 9, chapterId: null, chapterName: null }],
      }),
      NOW,
    );
    const cards = laneCards(cockpit, "needs_advisor");
    expect(cards).toHaveLength(1);
    expect(cards[0].studentId).toBe("s1");
    expect(cards[0].primaryAction.kind).toBe("assign_advisor");
    expect(cards[0].why).toMatch(/No advisor/i);
  });

  it("routes an unassigned student with a strong match into Suggested matches", () => {
    const cockpit = buildStudentAdvisingCockpit(
      emptyInput({
        unadvisedStudents: [{ id: "s1", name: "Maya", interests: ["Robotics"], grade: 9, chapterId: "ch1", chapterName: "Scarsdale" }],
        suggestionsByStudent: {
          s1: [{ advisorId: "a1", advisorName: "Aisha", score: 36, reasons: ["Same chapter", "Shares interests: Robotics"], warnings: [], activeCount: 2, band: "LOW" }],
        },
      }),
      NOW,
    );
    expect(laneCards(cockpit, "needs_advisor")).toHaveLength(0);
    const suggested = laneCards(cockpit, "suggested_matches");
    expect(suggested).toHaveLength(1);
    expect(suggested[0].suggestion?.advisorName).toBe("Aisha");
    expect(suggested[0].primaryAction.kind).toBe("review_suggestion");
  });

  it("puts a never-checked-in assignment in Kickoff needed", () => {
    const cockpit = buildStudentAdvisingCockpit(
      emptyInput({
        assignments: [assignment({ assignmentId: "as1", studentId: "s1", studentName: "Maya", advisorId: "a1", advisorName: "Aisha", lastCheckInAt: null, startDate: daysAgo(2) })],
        advisors: [advisor({ id: "a1", name: "Aisha" })],
      }),
      NOW,
    );
    const cards = laneCards(cockpit, "kickoff_needed");
    expect(cards).toHaveLength(1);
    expect(cards[0].assignmentId).toBe("as1");
    expect(cards[0].primaryAction.kind).toBe("schedule_kickoff");
  });

  it("puts a stale check-in in Follow-up due (advisor has capacity)", () => {
    const cockpit = buildStudentAdvisingCockpit(
      emptyInput({
        assignments: [assignment({ assignmentId: "as1", studentId: "s1", studentName: "Maya", advisorId: "a1", advisorName: "Aisha", lastCheckInAt: daysAgo(40), nextCheckInDueAt: daysAgo(5) })],
        advisors: [advisor({ id: "a1", name: "Aisha", band: "TYPICAL", health: "ACTIVE" })],
      }),
      NOW,
    );
    expect(laneCards(cockpit, "follow_up_due")).toHaveLength(1);
  });

  it("routes a stale relationship with an overloaded advisor into Needs reassignment", () => {
    const cockpit = buildStudentAdvisingCockpit(
      emptyInput({
        assignments: [assignment({ assignmentId: "as1", studentId: "s1", studentName: "Maya", advisorId: "a1", advisorName: "Aisha", lastCheckInAt: daysAgo(80) })],
        advisors: [advisor({ id: "a1", name: "Aisha", band: "HIGH", activeCount: 10 })],
      }),
      NOW,
    );
    expect(laneCards(cockpit, "needs_reassignment")).toHaveLength(1);
    expect(laneCards(cockpit, "follow_up_due")).toHaveLength(0);
    expect(laneCards(cockpit, "needs_reassignment")[0].primaryAction.kind).toBe("reassign_advisor");
  });

  it("surfaces an overloaded advisor in Advisors at capacity", () => {
    const cockpit = buildStudentAdvisingCockpit(
      emptyInput({ advisors: [advisor({ id: "a1", name: "Aisha", band: "HIGH", activeCount: 9, needsFollowUpCount: 2 })] }),
      NOW,
    );
    const cards = laneCards(cockpit, "advisor_overloaded");
    expect(cards).toHaveLength(1);
    expect(cards[0].why).toMatch(/9 active students/);
  });

  it("surfaces a pending recommendation in Recommendations ready", () => {
    const cockpit = buildStudentAdvisingCockpit(
      emptyInput({
        assignments: [
          assignment({
            assignmentId: "as1",
            studentId: "s1",
            studentName: "Maya",
            advisorId: "a1",
            advisorName: "Aisha",
            pendingRecommendations: [
              { id: "r1", assignmentId: "as1", studentId: "s1", studentName: "Maya", advisorId: "a1", advisorName: "Aisha", kind: "CLASS", title: "Robotics 201", detail: null, createdAt: daysAgo(3) },
            ],
          }),
        ],
        advisors: [advisor({ id: "a1", name: "Aisha" })],
      }),
      NOW,
    );
    const cards = laneCards(cockpit, "recommendations_ready");
    expect(cards.some((c) => c.recommendationId === "r1")).toBe(true);
  });

  it("does not duplicate the same assignment across lifecycle lanes", () => {
    const cockpit = buildStudentAdvisingCockpit(
      emptyInput({
        assignments: [assignment({ assignmentId: "as1", studentId: "s1", studentName: "Maya", advisorId: "a1", advisorName: "Aisha", lastCheckInAt: null, needsFollowUp: true })],
        advisors: [advisor({ id: "a1", name: "Aisha" })],
      }),
      NOW,
    );
    const appearances = cockpit.lanes.flatMap((l) => l.cards).filter((c) => c.assignmentId === "as1");
    expect(appearances).toHaveLength(1);
    expect(appearances[0].lane).toBe("kickoff_needed");
  });

  it("computes briefing chips from the lanes", () => {
    const cockpit = buildStudentAdvisingCockpit(
      emptyInput({
        unadvisedStudents: [{ id: "s1", name: "Maya", interests: [], grade: null, chapterId: null, chapterName: null }],
      }),
      NOW,
    );
    const chip = cockpit.briefing.find((c) => c.key === "needs_advisor")!;
    expect(chip.count).toBe(1);
    expect(chip.tone).toBe("danger");
  });
});
