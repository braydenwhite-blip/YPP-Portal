import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  evaluateLessonDesignStudioGateFromAssignment,
  getLessonDesignStudioGateStatus,
} from "@/lib/lesson-design-studio-gate";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingModule: { findUnique: vi.fn() },
    trainingAssignment: { findUnique: vi.fn() },
  },
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

  it("admin short-circuits without DB lookups", async () => {
    const result = await getLessonDesignStudioGateStatus("user-1", ["ADMIN"]);
    expect(result).toEqual({ unlocked: true, reason: "REVIEWER_BYPASS" });
    expect(prisma.trainingModule.findUnique).not.toHaveBeenCalled();
    expect(prisma.trainingAssignment.findUnique).not.toHaveBeenCalled();
  });

  it("returns READINESS_CHECK_NOT_IMPORTED when M5 module missing", async () => {
    vi.mocked(prisma.trainingModule.findUnique).mockResolvedValue(null);
    const result = await getLessonDesignStudioGateStatus("user-1", ["INSTRUCTOR"]);
    expect(result).toEqual({ unlocked: true, reason: "READINESS_CHECK_NOT_IMPORTED" });
    expect(prisma.trainingAssignment.findUnique).not.toHaveBeenCalled();
  });

  it("returns READY when assignment COMPLETE", async () => {
    vi.mocked(prisma.trainingModule.findUnique).mockResolvedValue({ id: "m5-id" });
    vi.mocked(prisma.trainingAssignment.findUnique).mockResolvedValue({
      status: "COMPLETE",
    });
    const result = await getLessonDesignStudioGateStatus("user-1", ["INSTRUCTOR"]);
    expect(result).toEqual({ unlocked: true, reason: "READY" });
  });

  it("returns READINESS_CHECK_REQUIRED with module id when assignment is incomplete", async () => {
    vi.mocked(prisma.trainingModule.findUnique).mockResolvedValue({ id: "m5-id" });
    vi.mocked(prisma.trainingAssignment.findUnique).mockResolvedValue({
      status: "IN_PROGRESS",
    });
    const result = await getLessonDesignStudioGateStatus("user-1", ["INSTRUCTOR"]);
    expect(result).toEqual({
      unlocked: false,
      reason: "READINESS_CHECK_REQUIRED",
      readinessCheckModuleId: "m5-id",
    });
  });

  it("returns READINESS_CHECK_REQUIRED when assignment row missing", async () => {
    vi.mocked(prisma.trainingModule.findUnique).mockResolvedValue({ id: "m5-id" });
    vi.mocked(prisma.trainingAssignment.findUnique).mockResolvedValue(null);
    const result = await getLessonDesignStudioGateStatus("user-1", ["INSTRUCTOR"]);
    expect(result).toEqual({
      unlocked: false,
      reason: "READINESS_CHECK_REQUIRED",
      readinessCheckModuleId: "m5-id",
    });
  });
});
