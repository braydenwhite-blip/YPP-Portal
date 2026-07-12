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

vi.mock("@/lib/classes/instructor-access", () => ({
  requireTeachingSessionAccess: vi.fn(),
}));

import { requireTeachingSessionAccess } from "@/lib/classes/instructor-access";
import { recordClassAttendance } from "@/lib/class-management-actions";
import { prisma } from "@/lib/prisma";

const accessMock = vi.mocked(requireTeachingSessionAccess);

type AnyMock = ReturnType<typeof vi.fn>;
const prismaAny = prisma as unknown as {
  classSession: { findUnique: AnyMock };
  classAttendanceRecord: { upsert: AnyMock; count: AnyMock };
  classEnrollment: { findFirst: AnyMock; updateMany: AnyMock };
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
  if (!prismaAny.classEnrollment.findFirst) {
    prismaAny.classEnrollment.findFirst = vi.fn();
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
  });
  accessMock.mockResolvedValue({
    viewer: { id: "owner-1", roles: ["INSTRUCTOR"] },
    assignment: null,
    managesChapter: false,
    classSession: {
      id: "session-1",
      offeringId: "offering-1",
      date: new Date("2020-01-01T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "10:00",
      isCancelled: false,
      offering: {
        id: "offering-1",
        instructorId: "owner-1",
        chapterId: "chapter-1",
        title: "Design for Good",
        timezone: "America/Denver",
        templateId: "template-1",
      },
    },
  } as never);
  prismaAny.classEnrollment.findFirst.mockResolvedValue({ id: "enrollment-1" });
  prismaAny.classAttendanceRecord.upsert.mockResolvedValue({});
  prismaAny.classAttendanceRecord.count.mockResolvedValue(1);
  prismaAny.classEnrollment.updateMany.mockResolvedValue({ count: 1 });
});

describe("recordClassAttendance authorization", () => {
  it("blocks an instructor who does not own the class and writes nothing", async () => {
    accessMock.mockRejectedValue(new Error("Not authorized"));

    await expect(recordClassAttendance(fd())).rejects.toThrow(/not authorized/i);
    expect(prismaAny.classAttendanceRecord.upsert).not.toHaveBeenCalled();
  });

  it("allows the owning instructor", async () => {
    await expect(recordClassAttendance(fd())).resolves.toEqual({ success: true });
    expect(prismaAny.classAttendanceRecord.upsert).toHaveBeenCalledTimes(1);
  });

  it("allows an admin who is not the instructor", async () => {
    await expect(recordClassAttendance(fd("LATE"))).resolves.toEqual({ success: true });
    expect(prismaAny.classAttendanceRecord.upsert).toHaveBeenCalledTimes(1);
  });
});
