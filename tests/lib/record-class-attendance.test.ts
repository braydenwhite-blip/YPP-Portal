import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/instructor-readiness", () => ({
  assertCanPublishOffering: vi.fn(),
}));

vi.mock("@/lib/class-template-compat", () => ({
  createCompatibleClassTemplate: vi.fn(),
  getClassTemplateCapabilities: vi.fn(async () => ({
    hasLearnerFitFields: true,
    hasReviewWorkflow: true,
  })),
  getClassTemplateSelect: vi.fn(() => ({})),
}));

vi.mock("@/lib/workflow", () => ({
  syncCurriculumApprovalWorkflow: vi.fn(),
}));

vi.mock("@/lib/instructor-growth-service", () => ({
  syncInstructorGrowthSignalsForInstructor: vi.fn(async () => null),
}));

import { getSession } from "@/lib/auth-supabase";
import { recordClassAttendance } from "@/lib/class-management-actions";
import { prisma } from "@/lib/prisma";

const sessionMock = vi.mocked(getSession);

type AnyMock = ReturnType<typeof vi.fn>;
const prismaAny = prisma as unknown as {
  classSession: { findUnique: AnyMock };
  classAttendanceRecord: { upsert: AnyMock; count: AnyMock };
  classEnrollment: { updateMany: AnyMock };
};

function ensureMocks() {
  if (!prismaAny.classSession) {
    prismaAny.classSession = { findUnique: vi.fn() };
  }
  if (!prismaAny.classAttendanceRecord) {
    prismaAny.classAttendanceRecord = { upsert: vi.fn(), count: vi.fn() };
  }
  if (!prismaAny.classEnrollment.updateMany) {
    prismaAny.classEnrollment.updateMany = vi.fn();
  }
}

function fd(status = "PRESENT") {
  const f = new FormData();
  f.set("sessionId", "session-1");
  f.set("studentId", "student-1");
  f.set("status", status);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  ensureMocks();
  prismaAny.classSession.findUnique.mockResolvedValue({
    offeringId: "offering-1",
    offering: { instructorId: "owner-1" },
  });
  prismaAny.classAttendanceRecord.upsert.mockResolvedValue({});
  prismaAny.classAttendanceRecord.count.mockResolvedValue(1);
  prismaAny.classEnrollment.updateMany.mockResolvedValue({ count: 1 });
});

describe("recordClassAttendance authorization", () => {
  it("blocks an instructor who does not own the class and writes nothing", async () => {
    sessionMock.mockResolvedValue({
      user: { id: "intruder-1", roles: ["INSTRUCTOR"] },
    } as never);

    await expect(recordClassAttendance(fd())).rejects.toThrow(/not authorized/i);
    expect(prismaAny.classAttendanceRecord.upsert).not.toHaveBeenCalled();
  });

  it("allows the owning instructor", async () => {
    sessionMock.mockResolvedValue({
      user: { id: "owner-1", roles: ["INSTRUCTOR"] },
    } as never);

    await expect(recordClassAttendance(fd())).resolves.toEqual({ success: true });
    expect(prismaAny.classAttendanceRecord.upsert).toHaveBeenCalledTimes(1);
  });

  it("allows an admin who is not the instructor", async () => {
    sessionMock.mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as never);

    await expect(recordClassAttendance(fd("LATE"))).resolves.toEqual({ success: true });
    expect(prismaAny.classAttendanceRecord.upsert).toHaveBeenCalledTimes(1);
  });
});
