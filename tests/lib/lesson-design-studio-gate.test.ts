import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  evaluateLessonDesignStudioGateFromAssignment,
  getLessonDesignStudioGateStatus,
} from "@/lib/lesson-design-studio-gate";
import * as instructorReadiness from "@/lib/instructor-readiness";

vi.mock("@/lib/instructor-readiness", () => ({
  getInstructorReadiness: vi.fn(),
}));

describe("evaluateLessonDesignStudioGateFromAssignment", () => {
  it("admins bypass the gate", () => {
    expect(
      evaluateLessonDesignStudioGateFromAssignment({
        roles: ["ADMIN"],
        readinessCheckModuleId: null,
        readinessCheckAssignmentStatus: null,
      })
    ).toEqual({ unlocked: true, reason: "REVIEWER_BYPASS" });
  });

  it("chapter presidents bypass the gate", () => {
    expect(
      evaluateLessonDesignStudioGateFromAssignment({
        roles: ["CHAPTER_PRESIDENT"],
        readinessCheckModuleId: "m5-id",
        readinessCheckAssignmentStatus: "NOT_STARTED",
      })
    ).toEqual({ unlocked: true, reason: "REVIEWER_BYPASS" });
  });

  it("missing M5 module → unlocked (backward compat)", () => {
    expect(
      evaluateLessonDesignStudioGateFromAssignment({
        roles: ["INSTRUCTOR"],
        readinessCheckModuleId: null,
        readinessCheckAssignmentStatus: null,
      })
    ).toEqual({ unlocked: true, reason: "READINESS_CHECK_NOT_IMPORTED" });
  });

  it("M5 exists, assignment COMPLETE → unlocked", () => {
    expect(
      evaluateLessonDesignStudioGateFromAssignment({
        roles: ["INSTRUCTOR"],
        readinessCheckModuleId: "m5-id",
        readinessCheckAssignmentStatus: "COMPLETE",
      })
    ).toEqual({ unlocked: true, reason: "READY" });
  });

  it("M5 exists, assignment IN_PROGRESS → locked", () => {
    expect(
      evaluateLessonDesignStudioGateFromAssignment({
        roles: ["INSTRUCTOR"],
        readinessCheckModuleId: "m5-id",
        readinessCheckAssignmentStatus: "IN_PROGRESS",
      })
    ).toEqual({
      unlocked: false,
      reason: "READINESS_CHECK_REQUIRED",
      readinessCheckModuleId: "m5-id",
    });
  });

  it("M5 exists, no assignment row → locked", () => {
    expect(
      evaluateLessonDesignStudioGateFromAssignment({
        roles: ["INSTRUCTOR"],
        readinessCheckModuleId: "m5-id",
        readinessCheckAssignmentStatus: null,
      })
    ).toEqual({
      unlocked: false,
      reason: "READINESS_CHECK_REQUIRED",
      readinessCheckModuleId: "m5-id",
    });
  });
});

describe("getLessonDesignStudioGateStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin short-circuits without calling getInstructorReadiness", async () => {
    const result = await getLessonDesignStudioGateStatus("user-1", ["ADMIN"]);
    expect(result).toEqual({ unlocked: true, reason: "REVIEWER_BYPASS" });
    expect(instructorReadiness.getInstructorReadiness).not.toHaveBeenCalled();
  });

  it("chapter president short-circuits without calling getInstructorReadiness", async () => {
    const result = await getLessonDesignStudioGateStatus("user-1", [
      "CHAPTER_PRESIDENT",
    ]);
    expect(result).toEqual({ unlocked: true, reason: "REVIEWER_BYPASS" });
    expect(instructorReadiness.getInstructorReadiness).not.toHaveBeenCalled();
  });

  it("delegates to getInstructorReadiness for instructors and returns its gate", async () => {
    vi.mocked(instructorReadiness.getInstructorReadiness).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lessonDesignStudioGate: { unlocked: true, reason: "READY" },
    } as any);
    const result = await getLessonDesignStudioGateStatus("user-1", ["INSTRUCTOR"]);
    expect(result).toEqual({ unlocked: true, reason: "READY" });
    expect(instructorReadiness.getInstructorReadiness).toHaveBeenCalledWith(
      "user-1"
    );
  });

  it("returns the locked gate from readiness when M5 is incomplete", async () => {
    vi.mocked(instructorReadiness.getInstructorReadiness).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lessonDesignStudioGate: {
        unlocked: false,
        reason: "READINESS_CHECK_REQUIRED",
        readinessCheckModuleId: "m5-id",
      },
    } as any);
    const result = await getLessonDesignStudioGateStatus("user-1", ["INSTRUCTOR"]);
    expect(result).toEqual({
      unlocked: false,
      reason: "READINESS_CHECK_REQUIRED",
      readinessCheckModuleId: "m5-id",
    });
  });

  it("returns the not-imported gate from readiness when M5 row is absent", async () => {
    vi.mocked(instructorReadiness.getInstructorReadiness).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lessonDesignStudioGate: {
        unlocked: true,
        reason: "READINESS_CHECK_NOT_IMPORTED",
      },
    } as any);
    const result = await getLessonDesignStudioGateStatus("user-1", ["INSTRUCTOR"]);
    expect(result).toEqual({
      unlocked: true,
      reason: "READINESS_CHECK_NOT_IMPORTED",
    });
  });
});
