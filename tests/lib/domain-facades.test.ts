import { describe, expect, it } from "vitest";
describe("Session 5 domain facades", () => {
  it("exposes durable operational services instead of only the Session 4 aggregate", async () => {
    const staffing = await import("@/lib/instructor-assignment-service");
    const enrollment = await import("@/lib/staff-enrollment-service");
    const support = await import("@/lib/family-support-triage-service");
    expect(typeof staffing.assignInstructor).toBe("function");
    expect(typeof enrollment.updateEnrollmentOperations).toBe("function");
    expect(typeof support.triageSupportRequest).toBe("function");
  });
});
