import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth-supabase";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/audit-log-actions", () => ({
  logAuditEvent: vi.fn(),
  AuditAction: { MENTORSHIP_CREATED: "MENTORSHIP_CREATED", MENTORSHIP_UPDATED: "MENTORSHIP_UPDATED" },
}));

vi.mock("@/lib/mentorship-canonical", () => ({
  ensureCanonicalTrack: vi.fn(async () => ({ id: "track-1" })),
  enforceFullProgramMentorCapacity: vi.fn(),
  getAchievementAwardLevelForPoints: vi.fn(),
  getAwardPolicyForProgramGroup: vi.fn(),
  getCommitteeScopeForProgramGroup: vi.fn(),
  getDefaultMentorCapForProgramGroup: vi.fn(),
  getGovernanceModeForProgramGroup: vi.fn(() => "FULL_PROGRAM"),
  getLegacyMenteeRoleTypeForRole: vi.fn(() => "INSTRUCTOR"),
  getMentorshipProgramGroupForRole: vi.fn(() => "INSTRUCTOR"),
  getMentorshipTypeForProgramGroup: vi.fn(() => "INSTRUCTOR"),
  mentorshipRequiresChairApproval: vi.fn(),
  mentorshipRequiresKickoff: vi.fn(),
  mentorshipRequiresMonthlyReflection: vi.fn(),
}));

vi.mock("@/lib/mentorship-access", () => ({
  getMentorshipAccessibleMenteeIds: vi.fn(),
  hasMentorshipMenteeAccess: vi.fn(),
}));

vi.mock("@/lib/mentorship-hub-actions", () => ({
  ensureMentorshipSupportCircle: vi.fn(),
}));

import { logAuditEvent } from "@/lib/audit-log-actions";
import { enforceFullProgramMentorCapacity } from "@/lib/mentorship-canonical";
import { ensureMentorshipSupportCircle } from "@/lib/mentorship-hub-actions";
import { prisma } from "@/lib/prisma";
import {
  reassignProgramMentor,
  setProgramMentorshipStatus,
} from "@/lib/mentorship-program-actions";

function installPrismaStubs() {
  (prisma as any).mentorship = {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  };
  (prisma as any).mentorshipCircleMember = {
    updateMany: vi.fn(),
  };
  (prisma as any).mentorshipTrack = {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  };
  (prisma as any).mentorCommitteeChair = {
    findFirst: vi.fn(),
  };
  (prisma as any).$transaction = vi.fn(async (callback: any) =>
    callback({
      mentorship: {
        update: (prisma as any).mentorship.update,
        create: (prisma as any).mentorship.create,
      },
      mentorshipCircleMember: {
        updateMany: (prisma as any).mentorshipCircleMember.updateMany,
      },
    })
  );
}

const ACTIVE_MENTORSHIP = {
  id: "ms-1",
  status: "ACTIVE",
  mentorId: "mentor-old",
  menteeId: "mentee-1",
  mentor: { name: "Old Mentor" },
  mentee: {
    id: "mentee-1",
    name: "Mentee One",
    primaryRole: "INSTRUCTOR",
    chapterId: "chapter-1",
    chapter: { name: "Atlanta" },
  },
};

describe("reassignProgramMentor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installPrismaStubs();
    (prisma as any).user.findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: "mentor-new",
      name: "New Mentor",
    });
    (prisma as any).mentorshipTrack.findUniqueOrThrow.mockResolvedValue({
      id: "track-1",
      committees: [],
    });
    (prisma as any).mentorshipTrack.findUnique.mockResolvedValue({
      committees: [],
    });
    (prisma as any).mentorCommitteeChair.findFirst.mockResolvedValue(null);
    (prisma as any).mentorship.create.mockResolvedValue({ id: "ms-2" });
  });

  it("rejects non-admin sessions", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u-1", roles: ["INSTRUCTOR"] },
    } as any);
    const fd = new FormData();
    fd.set("mentorshipId", "ms-1");
    fd.set("newMentorId", "mentor-new");
    await expect(reassignProgramMentor(fd)).rejects.toThrow("Unauthorized");
  });

  it("ends the existing mentorship and creates a new one in a transaction", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as any);
    (prisma as any).mentorship.findUniqueOrThrow.mockResolvedValue(
      ACTIVE_MENTORSHIP
    );

    const fd = new FormData();
    fd.set("mentorshipId", "ms-1");
    fd.set("newMentorId", "mentor-new");
    fd.set("reason", "Schedule conflict");

    await reassignProgramMentor(fd);

    expect(enforceFullProgramMentorCapacity).toHaveBeenCalledWith(
      expect.objectContaining({ mentorId: "mentor-new" })
    );
    expect((prisma as any).mentorship.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ms-1" },
        data: expect.objectContaining({ status: "COMPLETE" }),
      })
    );
    expect((prisma as any).mentorshipCircleMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { mentorshipId: "ms-1" } })
    );
    expect((prisma as any).mentorship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mentorId: "mentor-new",
          menteeId: "mentee-1",
          status: "ACTIVE",
        }),
      })
    );
    expect(ensureMentorshipSupportCircle).toHaveBeenCalledWith("ms-2");
    expect(vi.mocked(logAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: "ms-1",
        description: expect.stringContaining(
          "Mentorship reassigned: Old Mentor -> New Mentor"
        ),
      })
    );
  });

  it("rejects assigning the same mentor", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as any);
    (prisma as any).mentorship.findUniqueOrThrow.mockResolvedValue(
      ACTIVE_MENTORSHIP
    );
    const fd = new FormData();
    fd.set("mentorshipId", "ms-1");
    fd.set("newMentorId", "mentor-old");
    await expect(reassignProgramMentor(fd)).rejects.toThrow(
      "New mentor must differ from current mentor"
    );
  });

  it("rejects reassigning a non-active mentorship", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as any);
    (prisma as any).mentorship.findUniqueOrThrow.mockResolvedValue({
      ...ACTIVE_MENTORSHIP,
      status: "COMPLETE",
    });
    const fd = new FormData();
    fd.set("mentorshipId", "ms-1");
    fd.set("newMentorId", "mentor-new");
    await expect(reassignProgramMentor(fd)).rejects.toThrow(
      "Only active mentorships can be reassigned"
    );
  });
});

describe("setProgramMentorshipStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installPrismaStubs();
  });

  it("rejects non-admin sessions", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u-1", roles: ["MENTOR"] },
    } as any);
    const fd = new FormData();
    fd.set("mentorshipId", "ms-1");
    fd.set("status", "PAUSED");
    await expect(setProgramMentorshipStatus(fd)).rejects.toThrow(
      "Unauthorized"
    );
  });

  it("rejects invalid status values", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as any);
    const fd = new FormData();
    fd.set("mentorshipId", "ms-1");
    fd.set("status", "BOGUS");
    await expect(setProgramMentorshipStatus(fd)).rejects.toThrow(
      "Invalid status"
    );
  });

  it("pauses an active mentorship without ending the circle", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as any);
    (prisma as any).mentorship.findUniqueOrThrow.mockResolvedValue({
      id: "ms-1",
      status: "ACTIVE",
      menteeId: "mentee-1",
      mentor: { name: "M" },
      mentee: { name: "N" },
    });

    const fd = new FormData();
    fd.set("mentorshipId", "ms-1");
    fd.set("status", "PAUSED");
    await setProgramMentorshipStatus(fd);

    expect((prisma as any).mentorship.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PAUSED", endDate: null }),
      })
    );
    expect((prisma as any).mentorshipCircleMember.updateMany).not.toHaveBeenCalled();
  });

  it("deactivates the support circle when marking COMPLETE", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"] },
    } as any);
    (prisma as any).mentorship.findUniqueOrThrow.mockResolvedValue({
      id: "ms-1",
      status: "ACTIVE",
      menteeId: "mentee-1",
      mentor: { name: "M" },
      mentee: { name: "N" },
    });

    const fd = new FormData();
    fd.set("mentorshipId", "ms-1");
    fd.set("status", "COMPLETE");
    await setProgramMentorshipStatus(fd);

    expect((prisma as any).mentorship.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETE",
          endDate: expect.any(Date),
        }),
      })
    );
    expect((prisma as any).mentorshipCircleMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { mentorshipId: "ms-1" } })
    );
  });
});
