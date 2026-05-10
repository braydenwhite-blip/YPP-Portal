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
import { enrollInClass } from "@/lib/class-management-actions";
import { prisma } from "@/lib/prisma";

type MockedPrisma = typeof prisma & {
  classOffering: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  classEnrollment: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  pathwayFallbackRequest: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

const prismaMock = prisma as MockedPrisma;
const sessionMock = vi.mocked(getSession);

function buildOffering(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "offering-1",
    capacity: 10,
    enrollmentOpen: true,
    status: "PUBLISHED",
    chapterId: "chapter-1",
    grandfatheredTrainingExemption: false,
    approval: { status: "APPROVED" },
    enrollments: [],
    _count: { enrollments: { _all: 0 } },
    ...overrides,
  };
}

function ensureClassEnrollmentMock() {
  // tests/setup.ts does not declare classEnrollment / pathwayFallbackRequest on
  // the shared prisma mock, so add the bare minimum here per-test-file.
  if (!prismaMock.classEnrollment) {
    (prismaMock as unknown as { classEnrollment: unknown }).classEnrollment = {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    };
  } else {
    // Augment the shared mock with the entries the seat-allocation helper
    // requires, without clobbering ones already wired.
    if (!prismaMock.classEnrollment.findFirst) {
      prismaMock.classEnrollment.findFirst = vi.fn();
    }
    if (!prismaMock.classEnrollment.count) {
      prismaMock.classEnrollment.count = vi.fn();
    }
  }
  if (!prismaMock.pathwayFallbackRequest) {
    (prismaMock as unknown as { pathwayFallbackRequest: unknown }).pathwayFallbackRequest = {
      findFirst: vi.fn(),
    };
  }
}

describe("enrollInClass — student-facing signup flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureClassEnrollmentMock();
    sessionMock.mockResolvedValue({
      user: {
        id: "student-1",
        roles: ["STUDENT"],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(prismaMock.user.findUnique).mockResolvedValue({
      chapterId: "chapter-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it("enrolls a brand-new student into an open class", async () => {
    prismaMock.classOffering.findUnique.mockResolvedValue(buildOffering());
    prismaMock.classEnrollment.findUnique.mockResolvedValue(null);
    prismaMock.classEnrollment.count.mockResolvedValue(0);
    prismaMock.classEnrollment.create.mockResolvedValue({ id: "enroll-1" });

    const result = await enrollInClass("offering-1");

    expect(result).toEqual({
      success: true,
      waitlisted: false,
      alreadyEnrolled: false,
      status: "ENROLLED",
      waitlistPosition: null,
    });
    expect(prismaMock.classEnrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: "student-1",
          offeringId: "offering-1",
          status: "ENROLLED",
          waitlistPosition: null,
        }),
      }),
    );
  });

  it("places the student on the waitlist when the class is at capacity", async () => {
    prismaMock.classOffering.findUnique.mockResolvedValue(
      buildOffering({ capacity: 2 }),
    );
    prismaMock.classEnrollment.findUnique.mockResolvedValue(null);
    prismaMock.classEnrollment.count.mockResolvedValue(2);
    prismaMock.classEnrollment.findFirst.mockResolvedValue(null);
    prismaMock.classEnrollment.create.mockResolvedValue({ id: "enroll-2" });

    const result = await enrollInClass("offering-1");

    expect(result).toMatchObject({
      success: true,
      waitlisted: true,
      alreadyEnrolled: false,
      status: "WAITLISTED",
      waitlistPosition: 1,
    });
    expect(prismaMock.classEnrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "WAITLISTED",
          waitlistPosition: 1,
        }),
      }),
    );
  });

  it("treats a duplicate signup attempt as a friendly already-enrolled result", async () => {
    prismaMock.classOffering.findUnique.mockResolvedValue(buildOffering());
    prismaMock.classEnrollment.findUnique.mockResolvedValue({
      id: "enroll-existing",
      status: "ENROLLED",
      waitlistPosition: null,
    });

    const result = await enrollInClass("offering-1");

    expect(result).toEqual({
      success: true,
      waitlisted: false,
      alreadyEnrolled: true,
      status: "ENROLLED",
      waitlistPosition: null,
    });
    expect(prismaMock.classEnrollment.create).not.toHaveBeenCalled();
    expect(prismaMock.classEnrollment.update).not.toHaveBeenCalled();
  });

  it("re-enrolls a student who previously dropped the class", async () => {
    prismaMock.classOffering.findUnique.mockResolvedValue(buildOffering());
    prismaMock.classEnrollment.findUnique.mockResolvedValue({
      id: "enroll-old",
      status: "DROPPED",
      waitlistPosition: null,
    });
    prismaMock.classEnrollment.count.mockResolvedValue(0);
    prismaMock.classEnrollment.update.mockResolvedValue({ id: "enroll-old" });

    const result = await enrollInClass("offering-1");

    expect(result.success).toBe(true);
    expect(result.alreadyEnrolled).toBe(false);
    expect(result.status).toBe("ENROLLED");
    expect(prismaMock.classEnrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "enroll-old" },
        data: expect.objectContaining({
          status: "ENROLLED",
          droppedAt: null,
        }),
      }),
    );
    expect(prismaMock.classEnrollment.create).not.toHaveBeenCalled();
  });

  it("rejects enrollment when the offering is closed", async () => {
    prismaMock.classOffering.findUnique.mockResolvedValue(
      buildOffering({ enrollmentOpen: false }),
    );

    await expect(enrollInClass("offering-1")).rejects.toThrow(/closed/i);
  });
});
