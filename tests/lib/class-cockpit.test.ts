import { describe, it, expect } from "vitest";
import {
  pickNextSession,
  pickLastUnrecordedSession,
  pickReflectionDueSession,
  isSameUtcDay,
  buildInstructorCockpit,
  type CockpitSessionLite,
  type CockpitClass,
} from "@/lib/classes/cockpit";

const NOW = new Date("2026-06-24T12:00:00.000Z");
const D = (iso: string) => new Date(iso);

function s(date: string, o: Partial<CockpitSessionLite> = {}): CockpitSessionLite {
  return { id: `s-${date}`, date: D(date), isCancelled: false, attendanceRecorded: true, reflectionDone: true, ...o };
}

describe("session pickers", () => {
  const sessions = [
    s("2026-06-10T00:00:00Z", { attendanceRecorded: false, reflectionDone: false }),
    s("2026-06-17T00:00:00Z", { attendanceRecorded: true, reflectionDone: false }),
    s("2026-06-24T16:00:00Z"), // today (later than NOW)
    s("2026-07-01T00:00:00Z"),
  ];

  it("pickNextSession returns the earliest today-or-future session", () => {
    expect(pickNextSession(sessions, NOW)?.id).toBe("s-2026-06-24T16:00:00Z");
  });
  it("pickLastUnrecordedSession returns the most recent past session missing attendance", () => {
    expect(pickLastUnrecordedSession(sessions, NOW)?.id).toBe("s-2026-06-10T00:00:00Z");
  });
  it("pickReflectionDueSession returns a recorded-but-unreflected past session", () => {
    expect(pickReflectionDueSession(sessions, NOW)?.id).toBe("s-2026-06-17T00:00:00Z");
  });
  it("ignores cancelled sessions", () => {
    expect(pickNextSession([s("2026-07-01T00:00:00Z", { isCancelled: true })], NOW)).toBeNull();
  });
});

describe("isSameUtcDay", () => {
  it("matches by UTC calendar day", () => {
    expect(isSameUtcDay(D("2026-06-24T01:00:00Z"), D("2026-06-24T23:00:00Z"))).toBe(true);
    expect(isSameUtcDay(D("2026-06-24T01:00:00Z"), D("2026-06-25T01:00:00Z"))).toBe(false);
  });
});

function cockpitClass(o: Partial<CockpitClass> = {}): CockpitClass {
  return {
    id: "c1",
    title: "Robotics",
    stage: "healthy",
    stageLabel: "Healthy",
    health: "healthy",
    isLive: true,
    scheduleLabel: "Mon · 4:00 PM",
    locationLabel: "Virtual",
    rosterCount: 10,
    nextSession: null,
    attendanceDueSession: null,
    reflectionDueSession: null,
    atRiskCount: 0,
    feedbackCount: 0,
    interventionCount: 0,
    nextStep: { text: "Run the next session", actor: "instructor" },
    ...o,
  };
}

describe("buildInstructorCockpit", () => {
  it("surfaces today's sessions, needs-you classes, and a summary, sorted by health", () => {
    const todaySession = { id: "x", sessionNumber: 3, topic: "t", date: D("2026-06-24T16:00:00Z"), isCancelled: false, attendanceRecorded: false, reflectionDone: false };
    const classes = [
      cockpitClass({ id: "healthy", health: "healthy" }),
      cockpitClass({ id: "due", health: "at_risk", attendanceDueSession: todaySession, nextSession: todaySession }),
      cockpitClass({ id: "critical", health: "critical", atRiskCount: 2 }),
    ];
    const cockpit = buildInstructorCockpit(classes, NOW);
    expect(cockpit.summary.total).toBe(3);
    expect(cockpit.summary.attendanceDue).toBe(1);
    expect(cockpit.summary.atRisk).toBe(1);
    expect(cockpit.today.map((c) => c.id)).toEqual(["due"]);
    // needsYou: 'due' (attendance) + 'critical' (atRisk), critical sorts first
    expect(cockpit.needsYou.map((c) => c.id)).toEqual(["critical", "due"]);
  });

  it("a fully healthy class with nothing due does not appear in needsYou", () => {
    const cockpit = buildInstructorCockpit([cockpitClass()], NOW);
    expect(cockpit.needsYou).toHaveLength(0);
  });
});
