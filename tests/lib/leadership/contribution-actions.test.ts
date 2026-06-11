import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession, getSessionUser } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  assignContribution,
  logContributionActivity,
  updateContributionStatus,
} from "@/lib/leadership/contribution-actions";

function mockAdminSession() {
  vi.mocked(getSessionUser).mockResolvedValue({
    id: "admin-1",
    roles: ["ADMIN"],
    primaryRole: "ADMIN",
    adminSubtypes: [],
  } as any);
  vi.mocked(getSession).mockResolvedValue({
    user: { id: "admin-1", roles: ["ADMIN"] },
  } as any);
}

function mockInstructorSession(id = "instructor-1") {
  vi.mocked(getSessionUser).mockResolvedValue({
    id,
    roles: ["INSTRUCTOR"],
    primaryRole: "INSTRUCTOR",
    adminSubtypes: [],
  } as any);
  vi.mocked(getSession).mockResolvedValue({
    user: { id, roles: ["INSTRUCTOR"] },
  } as any);
}

describe("assignContribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminSession();
    (prisma as any).leadershipContribution = {
      create: vi.fn().mockResolvedValue({ id: "contrib-1" }),
    };
  });

  it("applies catalog defaults for title, level, weight, and ownership", async () => {
    await assignContribution({
      instructorId: "instructor-1",
      category: "INSTRUCTION_COMMITTEE",
    });

    expect((prisma as any).leadershipContribution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        instructorId: "instructor-1",
        category: "INSTRUCTION_COMMITTEE",
        title: "Instruction Committee Member",
        expectedLevel: "LEAD_INSTRUCTOR",
        weight: 3,
        isOwnership: true,
        status: "ASSIGNED",
        reviewVisible: true,
        adminOwnerId: "admin-1",
        createdById: "admin-1",
      }),
    });
  });

  it("lets explicit values override the defaults", async () => {
    await assignContribution({
      instructorId: "instructor-1",
      category: "OTHER",
      title: "Showcase night owner",
      weight: 3,
      isOwnership: true,
      expectedLevel: "LEAD_INSTRUCTOR",
      relatedProgram: "Spring showcase",
    });

    expect((prisma as any).leadershipContribution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Showcase night owner",
        weight: 3,
        isOwnership: true,
        expectedLevel: "LEAD_INSTRUCTOR",
        relatedProgram: "Spring showcase",
      }),
    });
  });

  it("rejects non-admin callers", async () => {
    mockInstructorSession();
    await expect(
      assignContribution({ instructorId: "instructor-1", category: "STUDENT_ADVISOR" }),
    ).rejects.toThrow("Unauthorized");
  });
});

describe("updateContributionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).leadershipContribution = {
      findUnique: vi.fn().mockResolvedValue({
        id: "contrib-1",
        instructorId: "instructor-1",
        status: "ASSIGNED",
      }),
      update: vi.fn().mockResolvedValue({ id: "contrib-1" }),
    };
    (prisma as any).leadershipContributionActivity = {
      create: vi.fn().mockResolvedValue({ id: "activity-1" }),
    };
  });

  it("lets the assigned instructor activate their own role and logs the change", async () => {
    mockInstructorSession("instructor-1");
    await updateContributionStatus("contrib-1", "ACTIVE");

    expect((prisma as any).leadershipContribution.update).toHaveBeenCalledWith({
      where: { id: "contrib-1" },
      data: { status: "ACTIVE", endDate: null },
    });
    expect((prisma as any).leadershipContributionActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contributionId: "contrib-1",
        authorId: "instructor-1",
        kind: "STATUS_CHANGE",
        body: "Status changed from ASSIGNED to ACTIVE.",
      }),
    });
  });

  it("sets endDate when completing", async () => {
    mockAdminSession();
    await updateContributionStatus("contrib-1", "COMPLETED");
    expect((prisma as any).leadershipContribution.update).toHaveBeenCalledWith({
      where: { id: "contrib-1" },
      data: { status: "COMPLETED", endDate: expect.any(Date) },
    });
  });

  it("rejects other instructors", async () => {
    mockInstructorSession("someone-else");
    await expect(updateContributionStatus("contrib-1", "ACTIVE")).rejects.toThrow("Forbidden");
    expect((prisma as any).leadershipContribution.update).not.toHaveBeenCalled();
  });
});

describe("logContributionActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).leadershipContribution = {
      findUnique: vi.fn().mockResolvedValue({
        id: "contrib-1",
        instructorId: "instructor-1",
      }),
    };
    (prisma as any).leadershipContributionActivity = {
      create: vi.fn().mockResolvedValue({ id: "activity-1" }),
    };
  });

  it("lets the assigned instructor log evidence", async () => {
    mockInstructorSession("instructor-1");
    await logContributionActivity({
      contributionId: "contrib-1",
      kind: "INTERVIEW_COMPLETED",
      body: "Interviewed candidate R.S.; recommended advance.",
    });

    expect((prisma as any).leadershipContributionActivity.create).toHaveBeenCalledWith({
      data: {
        contributionId: "contrib-1",
        authorId: "instructor-1",
        kind: "INTERVIEW_COMPLETED",
        body: "Interviewed candidate R.S.; recommended advance.",
      },
    });
  });

  it("rejects unknown activity kinds", async () => {
    mockInstructorSession("instructor-1");
    await expect(
      logContributionActivity({
        contributionId: "contrib-1",
        kind: "GRAFFITI" as never,
        body: "nope",
      }),
    ).rejects.toThrow();
    expect((prisma as any).leadershipContributionActivity.create).not.toHaveBeenCalled();
  });

  it("rejects instructors logging on someone else's contribution", async () => {
    mockInstructorSession("someone-else");
    await expect(
      logContributionActivity({ contributionId: "contrib-1", kind: "NOTE", body: "hello" }),
    ).rejects.toThrow("Forbidden");
  });
});
