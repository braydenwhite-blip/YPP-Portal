import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";

import { savePathwayReflection } from "@/lib/pathway-reflection-actions";
import { prisma } from "@/lib/prisma";

describe("pathway-reflection-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: "student-1",
        roles: ["STUDENT"],
      },
    } as any);
    (prisma as any).pathwayStep = {
      findFirst: vi.fn(),
    };
    (prisma as any).pathwayReflection = {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    };
    (prisma as any).enrollment = {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    };
  });

  it("updates an existing reflection instead of creating a duplicate entry", async () => {
    (prisma as any).pathwayStep.findFirst.mockResolvedValue({
      id: "step-1",
      courseId: "course-1",
    });
    (prisma as any).enrollment.findFirst.mockResolvedValue({
      id: "enrollment-1",
    });
    (prisma as any).pathwayReflection.findFirst.mockResolvedValue({
      id: "reflection-1",
    });

    await expect(
      savePathwayReflection({
        pathwayId: "pathway-1",
        stepOrder: 1,
        content: "  Updated insight  ",
        visibleToMentor: false,
      })
    ).resolves.toEqual({ success: true });

    expect((prisma as any).pathwayReflection.update).toHaveBeenCalledWith({
      where: { id: "reflection-1" },
      data: {
        content: "Updated insight",
        visibleToMentor: false,
      },
    });
    expect((prisma as any).pathwayReflection.create).not.toHaveBeenCalled();
  });

  it("rejects reflections for steps that are not complete yet", async () => {
    (prisma as any).pathwayStep.findFirst.mockResolvedValue({
      id: "step-1",
      courseId: "course-1",
    });
    (prisma as any).enrollment.findFirst.mockResolvedValue(null);

    await expect(
      savePathwayReflection({
        pathwayId: "pathway-1",
        stepOrder: 1,
        content: "Need to finish first",
        visibleToMentor: true,
      })
    ).resolves.toEqual({
      error: "Complete this step before saving a reflection.",
    });
    expect((prisma as any).pathwayReflection.create).not.toHaveBeenCalled();
  });
});
