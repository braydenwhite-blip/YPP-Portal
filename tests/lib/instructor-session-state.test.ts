import { describe, expect, it } from "vitest";

import {
  attendanceCompletion,
  deriveSessionState,
  sessionDateTime,
  type SessionStateInput,
} from "@/lib/classes/instructor-state";

function session(overrides: Partial<SessionStateInput> = {}): SessionStateInput {
  return {
    id: "session-1",
    classId: "class-1",
    sessionNumber: 2,
    topic: "Build a prototype",
    date: new Date("2026-07-12T00:00:00.000Z"),
    startTime: "16:00",
    endTime: "17:00",
    timezone: "America/Denver",
    isCancelled: false,
    notesUrl: "https://example.com/lesson",
    lessonPlanId: null,
    description: "Students build and test a prototype.",
    learningOutcomes: ["Explain one design choice"],
    materialsUrl: "https://example.com/materials",
    classMaterials: [],
    deliveryMode: "VIRTUAL",
    zoomLink: "https://example.com/meet",
    locationName: null,
    locationAddress: null,
    room: null,
    activeStudentCount: 3,
    attendanceRecordCount: 0,
    reflectionDone: false,
    preparationCompletedAt: new Date("2026-07-11T18:00:00.000Z"),
    ...overrides,
  };
}

describe("sessionDateTime", () => {
  it("combines the stored day and wall clock in the offering timezone", () => {
    expect(
      sessionDateTime(
        new Date("2026-07-12T00:00:00.000Z"),
        "16:00",
        "America/Denver"
      ).toISOString()
    ).toBe("2026-07-12T22:00:00.000Z");
  });
});

describe("attendanceCompletion", () => {
  it("distinguishes no roster, missing, partial, and complete attendance", () => {
    expect(attendanceCompletion(0, 0)).toBe("not_required");
    expect(attendanceCompletion(3, 0)).toBe("missing");
    expect(attendanceCompletion(3, 2)).toBe("partial");
    expect(attendanceCompletion(3, 3)).toBe("complete");
  });
});

describe("deriveSessionState", () => {
  it("does not demand attendance before the real start time", () => {
    const state = deriveSessionState(session(), new Date("2026-07-12T21:00:00.000Z"));
    expect(state.lifecycle).toBe("before");
    expect(state.action.kind).toBe("review_lesson");
  });

  it("opens attendance during the session", () => {
    const state = deriveSessionState(session(), new Date("2026-07-12T22:30:00.000Z"));
    expect(state.lifecycle).toBe("during");
    expect(state.action.kind).toBe("take_attendance");
  });

  it("explains partial attendance after the session", () => {
    const state = deriveSessionState(
      session({ attendanceRecordCount: 2 }),
      new Date("2026-07-13T00:00:00.000Z")
    );
    expect(state.lifecycle).toBe("after");
    expect(state.attendance).toBe("partial");
    expect(state.action.label).toBe("Finish attendance");
    expect(state.action.reason).toContain("2 of 3");
  });

  it("requires a useful recap after complete attendance", () => {
    const state = deriveSessionState(
      session({ attendanceRecordCount: 3 }),
      new Date("2026-07-13T00:00:00.000Z")
    );
    expect(state.action.kind).toBe("add_recap");
  });

  it("names each missing preparation fact", () => {
    const state = deriveSessionState(
      session({
        notesUrl: null,
        description: null,
        learningOutcomes: [],
        materialsUrl: null,
        zoomLink: null,
        preparationCompletedAt: null,
      }),
      new Date("2026-07-12T20:00:00.000Z")
    );
    expect(state.action.kind).toBe("finish_preparation");
    expect(state.preparation.incompleteReasons).toHaveLength(4);
    expect(state.action.reason).toContain("virtual meeting link is missing");
    expect(state.action.reason).toContain("not marked this session's preparation review complete");
  });
});

