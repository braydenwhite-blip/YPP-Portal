import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession, getSessionUser } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  addAdvisingNote,
  assignStudentAdvisor,
  endAdvisorAssignment,
  setFollowUpFlag,
} from "@/lib/leadership/advisor-actions";

function mockAdminSession() {
  // requireAdmin() resolves through getSessionUser; the actions' own
  // session check resolves through getSession.
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

function mockAdvisorSession(id = "advisor-1") {
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

describe("assignStudentAdvisor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminSession();

    (prisma as any).leadershipContribution = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "contrib-1" }),
      update: vi.fn().mockResolvedValue({ id: "contrib-1" }),
    };
    (prisma as any).studentAdvisorAssignment = {
      upsert: vi.fn().mockResolvedValue({ id: "assignment-1" }),
      count: vi.fn().mockResolvedValue(1),
    };
  });

  it("creates a STUDENT_ADVISOR contribution and upserts one assignment per student", async () => {
    const result = await assignStudentAdvisor({
      advisorId: "advisor-1",
      studentIds: ["student-1", "student-2"],
    });

    expect(result).toEqual({ success: true, contributionId: "contrib-1" });
    expect((prisma as any).leadershipContribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instructorId: "advisor-1",
          category: "STUDENT_ADVISOR",
          status: "ACTIVE",
          weight: 2,
          isOwnership: false,
          adminOwnerId: "admin-1",
        }),
      }),
    );
    expect((prisma as any).studentAdvisorAssignment.upsert).toHaveBeenCalledTimes(2);
    expect((prisma as any).studentAdvisorAssignment.upsert).toHaveBeenCalledWith({
      where: {
        advisorId_studentId: { advisorId: "advisor-1", studentId: "student-1" },
      },
      create: {
        advisorId: "advisor-1",
        studentId: "student-1",
        contributionId: "contrib-1",
        assignedById: "admin-1",
        // Knowledge OS V2: assignments seed the first check-in due date.
        nextCheckInDueAt: expect.any(Date),
      },
      update: {
        isActive: true,
        endedAt: null,
        contributionId: "contrib-1",
        assignedById: "admin-1",
        nextCheckInDueAt: expect.any(Date),
      },
    });
  });

  it("reuses an existing open contribution and reactivates it", async () => {
    (prisma as any).leadershipContribution.findFirst.mockResolvedValue({
      id: "contrib-existing",
      status: "ASSIGNED",
    });

    const result = await assignStudentAdvisor({
      advisorId: "advisor-1",
      studentIds: ["student-1"],
    });

    expect(result.contributionId).toBe("contrib-existing");
    expect((prisma as any).leadershipContribution.create).not.toHaveBeenCalled();
    expect((prisma as any).leadershipContribution.update).toHaveBeenCalledWith({
      where: { id: "contrib-existing" },
      data: { status: "ACTIVE" },
    });
  });

  it("never assigns an advisor to themselves", async () => {
    await assignStudentAdvisor({
      advisorId: "advisor-1",
      studentIds: ["advisor-1", "student-1"],
    });
    expect((prisma as any).studentAdvisorAssignment.upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects non-admin callers", async () => {
    mockAdvisorSession();
    await expect(
      assignStudentAdvisor({ advisorId: "advisor-1", studentIds: ["student-1"] }),
    ).rejects.toThrow("Unauthorized");
    expect((prisma as any).studentAdvisorAssignment.upsert).not.toHaveBeenCalled();
  });
});

describe("addAdvisingNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdvisorSession();

    (prisma as any).studentAdvisorAssignment = {
      findUnique: vi.fn().mockResolvedValue({
        id: "assignment-1",
        advisorId: "advisor-1",
        studentId: "student-1",
        contributionId: "contrib-1",
        checkInCadenceDays: 10,
      }),
      update: vi.fn().mockResolvedValue({ id: "assignment-1" }),
    };
    (prisma as any).advisingNote = {
      create: vi.fn().mockResolvedValue({ id: "note-1" }),
    };
  });

  it("logs a check-in, bumps lastCheckInAt, and schedules the next check-in", async () => {
    await addAdvisingNote({
      assignmentId: "assignment-1",
      kind: "CHECK_IN",
      body: "Met for 20 minutes; she wants to try the robotics project.",
    });

    expect((prisma as any).advisingNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assignmentId: "assignment-1",
        authorId: "advisor-1",
        kind: "CHECK_IN",
      }),
    });
    expect((prisma as any).studentAdvisorAssignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: {
        lastCheckInAt: expect.any(Date),
        nextCheckInDueAt: expect.any(Date),
      },
    });
    // Next check-in is one cadence (10 days here) after the logged check-in.
    const call = (prisma as any).studentAdvisorAssignment.update.mock.calls[0][0];
    const deltaDays =
      (call.data.nextCheckInDueAt.getTime() - call.data.lastCheckInAt.getTime()) /
      (24 * 60 * 60 * 1000);
    expect(deltaDays).toBeCloseTo(10, 5);
  });

  it("does not bump lastCheckInAt for plain notes", async () => {
    await addAdvisingNote({
      assignmentId: "assignment-1",
      kind: "NOTE",
      body: "Parent mentioned scheduling constraints.",
    });
    expect((prisma as any).studentAdvisorAssignment.update).not.toHaveBeenCalled();
  });

  it("rejects users who are neither the advisor nor an admin", async () => {
    mockAdvisorSession("intruder-9");
    await expect(
      addAdvisingNote({ assignmentId: "assignment-1", kind: "NOTE", body: "hi" }),
    ).rejects.toThrow("Forbidden");
    expect((prisma as any).advisingNote.create).not.toHaveBeenCalled();
  });
});

describe("endAdvisorAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminSession();

    (prisma as any).studentAdvisorAssignment = {
      update: vi.fn().mockResolvedValue({
        advisorId: "advisor-1",
        contributionId: "contrib-1",
      }),
      count: vi.fn().mockResolvedValue(0),
    };
    (prisma as any).leadershipContribution = {
      update: vi.fn().mockResolvedValue({ id: "contrib-1" }),
    };
  });

  it("ends the assignment and completes the contribution when no advisees remain", async () => {
    await endAdvisorAssignment("assignment-1");

    expect((prisma as any).studentAdvisorAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "assignment-1" },
        data: expect.objectContaining({ isActive: false, needsFollowUp: false }),
      }),
    );
    expect((prisma as any).leadershipContribution.update).toHaveBeenCalledWith({
      where: { id: "contrib-1" },
      data: { status: "COMPLETED", endDate: expect.any(Date) },
    });
  });

  it("keeps the contribution active while other advisees remain", async () => {
    (prisma as any).studentAdvisorAssignment.count.mockResolvedValue(2);
    await endAdvisorAssignment("assignment-1");
    expect((prisma as any).leadershipContribution.update).not.toHaveBeenCalled();
  });
});

describe("setFollowUpFlag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdvisorSession();

    (prisma as any).studentAdvisorAssignment = {
      findUnique: vi.fn().mockResolvedValue({
        id: "assignment-1",
        advisorId: "advisor-1",
        studentId: "student-1",
        contributionId: null,
      }),
      update: vi.fn().mockResolvedValue({ id: "assignment-1" }),
    };
  });

  it("sets the flag with a note", async () => {
    await setFollowUpFlag({
      assignmentId: "assignment-1",
      needsFollowUp: true,
      followUpNote: "Hasn't responded in two weeks",
    });
    expect((prisma as any).studentAdvisorAssignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { needsFollowUp: true, followUpNote: "Hasn't responded in two weeks" },
    });
  });

  it("clears the note when unflagging", async () => {
    await setFollowUpFlag({ assignmentId: "assignment-1", needsFollowUp: false });
    expect((prisma as any).studentAdvisorAssignment.update).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: { needsFollowUp: false, followUpNote: null },
    });
  });
});
