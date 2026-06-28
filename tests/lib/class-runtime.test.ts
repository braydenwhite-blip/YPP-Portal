import { describe, it, expect } from "vitest";
import {
  computeClassRuntime,
  deriveClassRuntimeStage,
  classRuntimeHealth,
  classRuntimeBlockers,
  classRuntimeNextStep,
  retentionPercent,
  renewalPotential,
  isAdvertisable,
  hasUnrecordedPastSession,
  type ClassRuntimeInput,
  type ClassRuntimeSession,
} from "@/lib/classes/class-runtime";

const NOW = new Date("2026-06-24T12:00:00.000Z");
const FUTURE = new Date("2026-07-30T00:00:00.000Z"); // >14d out
const SOON = new Date("2026-06-30T00:00:00.000Z"); // 6d out
const PAST = new Date("2026-06-01T00:00:00.000Z");

function session(date: Date, o: Partial<ClassRuntimeSession> = {}): ClassRuntimeSession {
  return { id: `s-${date.getTime()}`, date, isCancelled: false, attendanceRecorded: true, reflectionDone: true, ...o };
}

/** Base = a fully-prepared, not-yet-public class (advertisable). */
function klass(overrides: Partial<ClassRuntimeInput> = {}): ClassRuntimeInput {
  return {
    id: "c1",
    title: "Intro to Robotics",
    ageRange: "12-14",
    startDate: FUTURE,
    status: "DRAFT",
    partnerConfirmed: true,
    hasRoom: true,
    hasTimes: true,
    hasInstructor: true,
    instructorConfirmed: true,
    curriculumApproved: true,
    publiclyVisible: false,
    enrolledCount: 12,
    capacity: 25,
    instructorReady: true,
    preLaunchReminderSent: true,
    logisticsInWriting: true,
    enrollmentOpen: false,
    droppedCount: 0,
    sessions: [],
    attendancePercent: null,
    feedbackCount: 0,
    averageRating: null,
    negativeFeedbackCount: 0,
    openIssueCount: 0,
    needsHelp: false,
    curriculumSubmitted: true,
    ...overrides,
  };
}

describe("deriveClassRuntimeStage — pre-live ladder", () => {
  it("draft when curriculum is neither approved nor submitted", () => {
    expect(deriveClassRuntimeStage(klass({ curriculumApproved: false, curriculumSubmitted: false }), NOW)).toBe("draft");
  });
  it("needs_approval when curriculum is submitted but not fully approved", () => {
    expect(deriveClassRuntimeStage(klass({ curriculumApproved: false, curriculumSubmitted: true }), NOW)).toBe("needs_approval");
  });
  it("advertisable when ready to show but not yet public", () => {
    expect(deriveClassRuntimeStage(klass(), NOW)).toBe("advertisable");
  });
  it("enrolling when published + enrollment open but not launch-ready", () => {
    const stage = deriveClassRuntimeStage(
      klass({ publiclyVisible: true, enrollmentOpen: true, enrolledCount: 2 }),
      NOW
    );
    expect(stage).toBe("enrolling");
  });
  it("launch_ready when the full checklist passes", () => {
    expect(deriveClassRuntimeStage(klass({ publiclyVisible: true, enrollmentOpen: true, startDate: SOON }), NOW)).toBe("launch_ready");
  });
});

describe("deriveClassRuntimeStage — live + closed", () => {
  const liveBase = () =>
    klass({
      status: "IN_PROGRESS",
      startDate: PAST,
      publiclyVisible: true,
      enrollmentOpen: true,
      sessions: [session(PAST), session(new Date("2026-06-15T00:00:00Z"))],
      attendancePercent: 90,
      feedbackCount: 3,
      averageRating: 4.5,
    });

  it("healthy when live with good attendance, feedback, retention", () => {
    expect(deriveClassRuntimeStage(liveBase(), NOW)).toBe("healthy");
  });
  it("attendance_missing when a past session has no attendance", () => {
    const c = liveBase();
    c.sessions = [session(PAST, { attendanceRecorded: false })];
    expect(deriveClassRuntimeStage(c, NOW)).toBe("attendance_missing");
  });
  it("retention_risk when multiple students dropped", () => {
    const c = liveBase();
    c.enrolledCount = 5;
    c.droppedCount = 3; // 5/8 = 62%
    expect(deriveClassRuntimeStage(c, NOW)).toBe("retention_risk");
  });
  it("needs_intervention on negative feedback", () => {
    const c = liveBase();
    c.negativeFeedbackCount = 1;
    c.averageRating = 2;
    expect(deriveClassRuntimeStage(c, NOW)).toBe("needs_intervention");
  });
  it("needs_intervention when attendance is below the intervention threshold", () => {
    const c = liveBase();
    c.attendancePercent = 40;
    expect(deriveClassRuntimeStage(c, NOW)).toBe("needs_intervention");
  });
  it("feedback_missing when live past a session with no feedback", () => {
    const c = liveBase();
    c.feedbackCount = 0;
    c.averageRating = null;
    expect(deriveClassRuntimeStage(c, NOW)).toBe("feedback_missing");
  });
  it("completed when all sessions are past (weak signals → not renewal)", () => {
    const c = klass({
      status: "COMPLETED",
      startDate: PAST,
      sessions: [session(PAST)],
      attendancePercent: 50,
      feedbackCount: 2,
      averageRating: 2.5,
    });
    expect(deriveClassRuntimeStage(c, NOW)).toBe("completed");
  });
  it("renewal_candidate when a completed class performed strongly", () => {
    const c = klass({
      status: "COMPLETED",
      startDate: PAST,
      sessions: [session(PAST)],
      enrolledCount: 10,
      droppedCount: 0,
      attendancePercent: 92,
      feedbackCount: 5,
      averageRating: 4.7,
    });
    expect(deriveClassRuntimeStage(c, NOW)).toBe("renewal_candidate");
  });
  it("archived when cancelled", () => {
    expect(deriveClassRuntimeStage(klass({ status: "CANCELLED" }), NOW)).toBe("archived");
  });
});

describe("supporting derivations", () => {
  it("retentionPercent reflects active ÷ ever-enrolled", () => {
    expect(retentionPercent(klass({ enrolledCount: 8, droppedCount: 2 }))).toBe(80);
    expect(retentionPercent(klass({ enrolledCount: 0, droppedCount: 0 }))).toBeNull();
  });
  it("renewalPotential is strong only with strong real signals", () => {
    expect(renewalPotential(klass({ attendancePercent: 92, averageRating: 4.6, enrolledCount: 10, droppedCount: 0 }))).toBe("strong");
    expect(renewalPotential(klass({ attendancePercent: 40 }))).toBe("unlikely");
    expect(renewalPotential(klass())).toBe("unknown");
  });
  it("isAdvertisable requires approved curriculum + instructor + schedule", () => {
    expect(isAdvertisable(klass())).toBe(true);
    expect(isAdvertisable(klass({ curriculumApproved: false }))).toBe(false);
    expect(isAdvertisable(klass({ hasInstructor: false }))).toBe(false);
  });
  it("hasUnrecordedPastSession ignores future and cancelled sessions", () => {
    const c = klass({
      status: "IN_PROGRESS",
      startDate: PAST,
      sessions: [session(FUTURE, { attendanceRecorded: false }), session(PAST, { isCancelled: true, attendanceRecorded: false })],
    });
    expect(hasUnrecordedPastSession(c, NOW)).toBe(false);
  });
});

describe("classRuntimeHealth", () => {
  it("is critical when live with negative feedback", () => {
    const c = klass({ status: "IN_PROGRESS", startDate: PAST, sessions: [session(PAST)], attendancePercent: 90, feedbackCount: 1, negativeFeedbackCount: 1, averageRating: 2 });
    expect(classRuntimeHealth(c, NOW)).toBe("critical");
  });
  it("is healthy when live and all signals strong", () => {
    const c = klass({ status: "IN_PROGRESS", startDate: PAST, sessions: [session(PAST)], attendancePercent: 95, feedbackCount: 3, averageRating: 4.8 });
    expect(classRuntimeHealth(c, NOW)).toBe("healthy");
  });
});

describe("blockers + next step + composition", () => {
  it("derives live blockers ranked by severity", () => {
    const c = klass({ status: "IN_PROGRESS", startDate: PAST, sessions: [session(PAST, { attendanceRecorded: false })], openIssueCount: 1 });
    const blockers = classRuntimeBlockers(c, NOW);
    expect(blockers[0].severity).toBe("critical");
    expect(blockers.some((b) => b.key === "attendance")).toBe(true);
    expect(blockers.some((b) => b.key === "issues")).toBe(true);
  });
  it("next step matches the stage", () => {
    expect(classRuntimeNextStep(klass({ status: "IN_PROGRESS", startDate: PAST, sessions: [session(PAST, { attendanceRecorded: false })] }), NOW).actor).toBe("instructor");
  });
  it("computeClassRuntime is deterministic and well-formed", () => {
    const c = klass({ status: "IN_PROGRESS", startDate: PAST, sessions: [session(PAST)], attendancePercent: 88, feedbackCount: 2, averageRating: 4 });
    const a = computeClassRuntime(c, NOW);
    const b = computeClassRuntime(c, NOW);
    expect(a).toEqual(b);
    expect(a.stageLabel).toBe("Healthy");
    expect(a.evidence.sessionsHeld).toBe(1);
    expect(a.isLive).toBe(true);
  });
});
