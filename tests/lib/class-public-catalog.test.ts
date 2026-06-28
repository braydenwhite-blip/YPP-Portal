import { describe, it, expect } from "vitest";
import {
  isClassPubliclyAdvertisable,
  getSpotsRemaining,
  getSignupAvailability,
  detectDuplicateEnrollment,
  buildSignupConfirmation,
  type PublicClassInput,
} from "@/lib/classes/public-catalog";

function pub(o: Partial<PublicClassInput> = {}): PublicClassInput {
  return {
    id: "o1",
    title: "Intro to Robotics",
    status: "PUBLISHED",
    approvalStatus: "APPROVED",
    grandfathered: false,
    enrollmentOpen: true,
    capacity: 12,
    enrolledCount: 4,
    startDate: new Date("2026-07-01T00:00:00Z"),
    hasDescription: true,
    hasSchedule: true,
    ...o,
  };
}

describe("isClassPubliclyAdvertisable", () => {
  it("advertises a published, approved, described, scheduled class", () => {
    expect(isClassPubliclyAdvertisable(pub())).toBe(true);
    expect(isClassPubliclyAdvertisable(pub({ status: "IN_PROGRESS" }))).toBe(true);
    expect(isClassPubliclyAdvertisable(pub({ approvalStatus: null, grandfathered: true }))).toBe(true);
  });
  it("hides drafts, unapproved, undescribed, or unscheduled classes", () => {
    expect(isClassPubliclyAdvertisable(pub({ status: "DRAFT" }))).toBe(false);
    expect(isClassPubliclyAdvertisable(pub({ approvalStatus: "CHANGES_REQUESTED" }))).toBe(false);
    expect(isClassPubliclyAdvertisable(pub({ hasDescription: false }))).toBe(false);
    expect(isClassPubliclyAdvertisable(pub({ hasSchedule: false }))).toBe(false);
    expect(isClassPubliclyAdvertisable(pub({ status: "CANCELLED" }))).toBe(false);
  });
});

describe("getSpotsRemaining + availability", () => {
  it("computes spots and returns null for uncapped classes", () => {
    expect(getSpotsRemaining({ capacity: 12, enrolledCount: 4 })).toBe(8);
    expect(getSpotsRemaining({ capacity: 12, enrolledCount: 15 })).toBe(0);
    expect(getSpotsRemaining({ capacity: 0, enrolledCount: 4 })).toBeNull();
  });
  it("maps availability to open / waitlist / closed", () => {
    expect(getSignupAvailability(pub())).toBe("open");
    expect(getSignupAvailability(pub({ capacity: 4, enrolledCount: 4 }))).toBe("waitlist");
    expect(getSignupAvailability(pub({ enrollmentOpen: false }))).toBe("closed");
    expect(getSignupAvailability(pub({ capacity: 0 }))).toBe("open"); // uncapped
  });
});

describe("detectDuplicateEnrollment", () => {
  it("treats enrolled / waitlisted / completed as duplicates, dropped as not", () => {
    expect(detectDuplicateEnrollment(["ENROLLED"])).toBe(true);
    expect(detectDuplicateEnrollment(["WAITLISTED"])).toBe(true);
    expect(detectDuplicateEnrollment(["COMPLETED"])).toBe(true);
    expect(detectDuplicateEnrollment(["DROPPED"])).toBe(false);
    expect(detectDuplicateEnrollment([])).toBe(false);
  });
});

describe("buildSignupConfirmation", () => {
  it("gives enrolled families calendar next-steps", () => {
    const c = buildSignupConfirmation({ title: "Robotics", scheduleLabel: "Mon · 4PM", locationLabel: "Online", waitlisted: false });
    expect(c.waitlisted).toBe(false);
    expect(c.nextSteps.some((s) => s.includes("enrolled"))).toBe(true);
    expect(c.nextSteps.some((s) => s.includes("Mon · 4PM"))).toBe(true);
  });
  it("gives waitlisted families a reassuring message + position", () => {
    const c = buildSignupConfirmation({ title: "Robotics", scheduleLabel: "Mon", locationLabel: "Online", waitlisted: true, waitlistPosition: 3 });
    expect(c.waitlisted).toBe(true);
    expect(c.waitlistPosition).toBe(3);
    expect(c.nextSteps.some((s) => s.toLowerCase().includes("waitlist"))).toBe(true);
  });
});
