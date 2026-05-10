import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { enrollInClass } from "@/lib/class-management-actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({
    user: { id: "student-1", roles: ["STUDENT"] },
  } as any);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ chapterId: "c1" } as any);
});

describe("enrollInClass — defense in depth", () => {
  it("refuses enrollment when offering is PUBLISHED but has no approval record", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "PUBLISHED",
      enrollmentOpen: true,
      capacity: 10,
      chapterId: "c1",
      grandfatheredTrainingExemption: false,
      approval: null,
      enrollments: [],
      _count: { enrollments: 0 },
    } as any);

    await expect(enrollInClass("o1")).rejects.toThrow(/not yet approved/i);
  });

  it("refuses enrollment when approval is REJECTED", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "PUBLISHED",
      enrollmentOpen: true,
      capacity: 10,
      chapterId: "c1",
      grandfatheredTrainingExemption: false,
      approval: { status: "REJECTED" },
      enrollments: [],
      _count: { enrollments: 0 },
    } as any);

    await expect(enrollInClass("o1")).rejects.toThrow(/not yet approved/i);
  });

  it("refuses enrollment when approval is CHANGES_REQUESTED", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "PUBLISHED",
      enrollmentOpen: true,
      capacity: 10,
      chapterId: "c1",
      grandfatheredTrainingExemption: false,
      approval: { status: "CHANGES_REQUESTED" },
      enrollments: [],
      _count: { enrollments: 0 },
    } as any);

    await expect(enrollInClass("o1")).rejects.toThrow(/not yet approved/i);
  });

  it("permits enrollment for grandfathered offerings without approval record", async () => {
    vi.mocked(prisma.classOffering.findUnique).mockResolvedValue({
      id: "o1",
      status: "PUBLISHED",
      enrollmentOpen: true,
      capacity: 10,
      chapterId: "c1",
      grandfatheredTrainingExemption: true,
      approval: null,
      enrollments: [],
      _count: { enrollments: 0 },
    } as any);
    vi.mocked(prisma.classEnrollment.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.classEnrollment.count).mockResolvedValue(0);
    vi.mocked(prisma.classEnrollment.create).mockResolvedValue({
      id: "e-new",
    } as any);

    const result = await enrollInClass("o1");
    expect(result.success).toBe(true);
    expect(result.waitlisted).toBe(false);
  });
});
