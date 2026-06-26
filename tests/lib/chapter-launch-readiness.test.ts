import { describe, it, expect } from "vitest";
import {
  computeClassLaunchReadiness,
  classHasLaunched,
  enrollmentBar,
  enrollmentHealth,
  summarizeLaunchReadiness,
  classEvidenceStatus,
  classEvidenceRow,
  launchReadinessRecommendation,
  MIN_ENROLLMENT_PRELAUNCH,
  MIN_ENROLLMENT_LAUNCH,
  type ClassLaunchRecord,
} from "@/lib/chapters/launch-readiness";

const NOW = new Date("2026-06-24T12:00:00.000Z");

function klass(overrides: Partial<ClassLaunchRecord> = {}): ClassLaunchRecord {
  return {
    id: "k1",
    title: "Robotics 101",
    ageRange: "10-12",
    startDate: new Date("2026-07-30T00:00:00.000Z"), // far out
    status: "DRAFT",
    partnerConfirmed: true,
    hasRoom: true,
    hasTimes: true,
    hasInstructor: true,
    instructorConfirmed: true,
    curriculumApproved: true,
    publiclyVisible: true,
    enrolledCount: 12,
    capacity: 25,
    instructorReady: true,
    preLaunchReminderSent: true,
    logisticsInWriting: true,
    ...overrides,
  };
}

describe("computeClassLaunchReadiness", () => {
  it("a fully-prepared class is ready with no missing items", () => {
    const r = computeClassLaunchReadiness(klass(), NOW);
    expect(r.ready).toBe(true);
    expect(r.done).toBe(r.total);
    expect(r.total).toBe(12);
    expect(r.missing).toHaveLength(0);
  });

  it("surfaces every missing launch requirement", () => {
    const r = computeClassLaunchReadiness(
      klass({
        partnerConfirmed: false,
        hasInstructor: false,
        curriculumApproved: false,
        publiclyVisible: false,
      }),
      NOW
    );
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("Confirmed partner");
    expect(r.missing).toContain("Assigned instructor");
    expect(r.missing).toContain("Curriculum fully approved");
    expect(r.missing).toContain("Class visible publicly");
  });

  it("treats a missing start date as a missing launch date", () => {
    const r = computeClassLaunchReadiness(klass({ startDate: null }), NOW);
    expect(r.missing).toContain("Confirmed launch date");
    expect(r.daysToLaunch).toBeNull();
  });
});

describe("classHasLaunched", () => {
  it("is true for in-progress/completed or a reached start date", () => {
    expect(classHasLaunched(klass({ status: "IN_PROGRESS" }), NOW)).toBe(true);
    expect(classHasLaunched(klass({ status: "COMPLETED" }), NOW)).toBe(true);
    expect(classHasLaunched(klass({ startDate: new Date("2026-06-01T00:00:00Z") }), NOW)).toBe(true);
    expect(classHasLaunched(klass(), NOW)).toBe(false);
  });
});

describe("enrollmentBar", () => {
  it("steps up as launch approaches", () => {
    expect(enrollmentBar(klass({ startDate: new Date("2026-08-30T00:00:00Z") }), NOW)).toBe(0); // far out
    expect(enrollmentBar(klass({ startDate: new Date("2026-06-30T00:00:00Z") }), NOW)).toBe(MIN_ENROLLMENT_PRELAUNCH); // within 2 weeks
    expect(enrollmentBar(klass({ status: "IN_PROGRESS" }), NOW)).toBe(MIN_ENROLLMENT_LAUNCH); // launched
  });
});

describe("enrollmentHealth (under-enrollment detection)", () => {
  it("flags <5 within two weeks of launch", () => {
    const eh = enrollmentHealth(
      klass({ startDate: new Date("2026-06-30T00:00:00Z"), enrolledCount: 3 }),
      NOW
    );
    expect(eh.underEnrolled).toBe(true);
    expect(eh.enrollmentWarning).toMatch(/needs 5 before launch/);
  });

  it("flags <10 at launch", () => {
    const eh = enrollmentHealth(klass({ status: "IN_PROGRESS", enrolledCount: 7 }), NOW);
    expect(eh.underEnrolled).toBe(true);
    expect(eh.enrollmentWarning).toMatch(/needs 10 at launch/);
  });

  it("does not flag a far-out class with low enrollment", () => {
    const eh = enrollmentHealth(klass({ startDate: new Date("2026-09-01T00:00:00Z"), enrolledCount: 0 }), NOW);
    expect(eh.underEnrolled).toBe(false);
  });

  it("does not flag a healthy class", () => {
    const eh = enrollmentHealth(klass({ status: "IN_PROGRESS", enrolledCount: 14 }), NOW);
    expect(eh.underEnrolled).toBe(false);
  });
});

describe("summarizeLaunchReadiness", () => {
  it("rolls up ready / not-ready / under-enrolled", () => {
    const classes = [
      klass({ id: "ready" }),
      klass({ id: "missing", hasInstructor: false }),
      klass({ id: "low", startDate: new Date("2026-06-28T00:00:00Z"), enrolledCount: 2 }),
    ];
    const s = summarizeLaunchReadiness(classes, NOW);
    expect(s.total).toBe(3);
    expect(s.ready).toBe(1);
    expect(s.notReady).toBe(2);
    expect(s.underEnrolled).toBe(1);
    expect(s.launchingSoonNotReady).toBeGreaterThanOrEqual(1);
  });
});

describe("classEvidenceStatus + classEvidenceRow", () => {
  it("a fully-prepared, adequately-enrolled class is ready at 100%", () => {
    const row = classEvidenceRow(klass(), NOW);
    expect(row).toMatchObject({
      title: "Robotics 101",
      subtitle: "Ages 10–12",
      launchDate: "Jul 30, 2026",
      enrolled: 12,
      capacity: 25,
      readinessPct: 100,
      status: "ready",
    });
  });
  it("a barely-started class is not ready (<50%)", () => {
    const bare = klass({
      partnerConfirmed: false,
      hasRoom: false,
      hasTimes: false,
      startDate: null,
      hasInstructor: false,
      instructorConfirmed: false,
      curriculumApproved: false,
      publiclyVisible: false,
      enrolledCount: 0,
      instructorReady: false,
      preLaunchReminderSent: false,
      logisticsInWriting: false,
    });
    const row = classEvidenceRow(bare, NOW);
    expect(row.status).toBe("not_ready");
    expect(row.launchDate).toBe("TBD");
  });
  it("under-enrollment pulls an otherwise-ready class down to needs-attention", () => {
    const row = classEvidenceRow(klass({ startDate: new Date("2026-06-28T00:00:00Z"), enrolledCount: 2 }), NOW);
    expect(row.status).toBe("needs_attention");
  });
  it("classEvidenceStatus reads a computed readiness", () => {
    expect(classEvidenceStatus(computeClassLaunchReadiness(klass(), NOW))).toBe("ready");
  });
});

describe("launchReadinessRecommendation", () => {
  it("prioritises launching-soon blockers, then enrollment, then nothing", () => {
    const soon = summarizeLaunchReadiness(
      [klass({ startDate: new Date("2026-06-28T00:00:00Z"), hasInstructor: false })],
      NOW
    );
    expect(launchReadinessRecommendation(soon)).toMatch(/Unblock 1 class launching soon/);

    // A launched class can be checklist-complete yet still under the ≥10 bar,
    // isolating the under-enrolled branch (a not-yet-launched under-enrolled
    // class also fails the enrollment checklist item → "launching soon").
    const under = summarizeLaunchReadiness([klass({ status: "IN_PROGRESS", enrolledCount: 7 })], NOW);
    expect(launchReadinessRecommendation(under)).toMatch(/5-student threshold/);

    expect(launchReadinessRecommendation(summarizeLaunchReadiness([klass()], NOW))).toMatch(/on track to launch/);
    expect(launchReadinessRecommendation(summarizeLaunchReadiness([], NOW))).toMatch(/No classes planned yet/);
  });
});
