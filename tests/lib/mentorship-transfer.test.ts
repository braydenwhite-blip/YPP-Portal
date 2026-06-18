import { describe, expect, it } from "vitest";

import {
  buildMentorTransferPlan,
  type CurrentAssignment,
} from "@/lib/mentorship-transfer";

const desired = (over: Partial<{ newMentorId: string; focusArea: "INSTRUCTION" | "LEADERSHIP" | null; isTemporary: boolean }> = {}) => ({
  menteeId: "mentee-1",
  newMentorId: over.newMentorId ?? "mentor-new",
  focusArea: over.focusArea ?? null,
  isTemporary: over.isTemporary ?? false,
});

describe("buildMentorTransferPlan", () => {
  it("is a no-op when the same mentor already holds the same focus area", () => {
    const current: CurrentAssignment = {
      mentorshipId: "m1",
      mentorId: "mentor-a",
      focusArea: null,
    };
    const plan = buildMentorTransferPlan(current, desired({ newMentorId: "mentor-a" }));
    expect(plan.noop).toBe(true);
    expect(plan.completeMentorshipId).toBeNull();
  });

  it("plans a non-destructive transfer when the mentor changes", () => {
    const current: CurrentAssignment = {
      mentorshipId: "m1",
      mentorId: "mentor-a",
      focusArea: null,
    };
    const plan = buildMentorTransferPlan(current, desired({ newMentorId: "mentor-b" }));
    expect(plan.noop).toBe(false);
    expect(plan.completeMentorshipId).toBe("m1");
    expect(plan.previousMentorId).toBe("mentor-a");
    expect(plan.newMentorId).toBe("mentor-b");
  });

  it("plans a first assignment when there is no current mentor", () => {
    const plan = buildMentorTransferPlan(null, desired({ newMentorId: "mentor-b" }));
    expect(plan.noop).toBe(false);
    expect(plan.completeMentorshipId).toBeNull();
    expect(plan.previousMentorId).toBeNull();
    expect(plan.newMentorId).toBe("mentor-b");
  });

  it("treats the same mentor on a different focus area as a new assignment", () => {
    const current: CurrentAssignment = {
      mentorshipId: "m1",
      mentorId: "mentor-a",
      focusArea: "INSTRUCTION",
    };
    const plan = buildMentorTransferPlan(
      current,
      desired({ newMentorId: "mentor-a", focusArea: "LEADERSHIP" })
    );
    expect(plan.noop).toBe(false);
    expect(plan.focusArea).toBe("LEADERSHIP");
  });

  it("carries the temporary flag into the plan", () => {
    const plan = buildMentorTransferPlan(null, desired({ isTemporary: true }));
    expect(plan.isTemporary).toBe(true);
  });
});
