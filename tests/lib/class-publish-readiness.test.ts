import { describe, it, expect } from "vitest";
import { computePublishReadiness } from "@/lib/class-publish-readiness";

const ready = {
  title: "Intro to Game Design",
  description: "A hands-on intro to building your first game.",
  instructorId: "instructor-1",
  startDate: new Date("2026-07-08"),
  endDate: new Date("2026-07-29"),
  meetingDays: ["Monday"],
  meetingTime: "4:00 PM",
  capacity: 20,
  targetAgeGroup: "12-14",
  deliveryMode: "VIRTUAL" as const,
  zoomLink: "https://zoom.us/j/123",
  sessionCount: 4,
  approvalStatus: "APPROVED" as const,
};

describe("computePublishReadiness", () => {
  it("is ready when every required field is present and approved", () => {
    const r = computePublishReadiness(ready);
    expect(r.ready).toBe(true);
    expect(r.missing).toHaveLength(0);
    expect(r.requiredDone).toBe(r.requiredTotal);
  });

  it("flags a missing meeting link for an online class", () => {
    const r = computePublishReadiness({ ...ready, zoomLink: null });
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => m.key)).toContain("logistics");
    expect(r.missing.find((m) => m.key === "logistics")?.label).toMatch(/meeting link/i);
  });

  it("requires a location + address for an in-person class", () => {
    const r = computePublishReadiness({
      ...ready,
      deliveryMode: "IN_PERSON",
      zoomLink: null,
      locationName: "Scarsdale Library",
      locationAddress: null,
    });
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => m.key)).toContain("logistics");
  });

  it("blocks publish until approved", () => {
    const r = computePublishReadiness({ ...ready, approvalStatus: "REQUESTED" });
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => m.key)).toContain("approval");
  });

  it("honors the grandfathered training exemption for approval", () => {
    const r = computePublishReadiness({
      ...ready,
      approvalStatus: "NOT_REQUESTED",
      grandfatheredTrainingExemption: true,
    });
    expect(r.missing.map((m) => m.key)).not.toContain("approval");
  });

  it("treats age guidance as recommended, not blocking", () => {
    const r = computePublishReadiness({ ...ready, targetAgeGroup: null });
    expect(r.ready).toBe(true);
    expect(r.recommended.map((m) => m.key)).toContain("ageRange");
  });

  it("counts multiple missing required fields", () => {
    const r = computePublishReadiness({
      title: null,
      description: null,
      instructorId: null,
      capacity: 0,
      deliveryMode: "VIRTUAL",
      approvalStatus: "NOT_REQUESTED",
    });
    expect(r.ready).toBe(false);
    expect(r.missing.length).toBeGreaterThanOrEqual(5);
  });
});
