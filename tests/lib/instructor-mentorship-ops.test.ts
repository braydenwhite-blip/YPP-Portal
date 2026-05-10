import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession } from "@/lib/auth-supabase";
import {
  getAdminMentorshipActionQueue,
  getInstructorMentorshipOpsSummary,
  getMentorWorkload,
  getOverdueCheckInQueue,
  getStalledGoalQueue,
  getUnassignedInstructorQueue,
} from "@/lib/instructor-mentorship-ops";
import { prisma } from "@/lib/prisma";

function mockSession(roles: string[]) {
  vi.mocked(getSession).mockResolvedValue({
    user: { id: "u-admin", roles },
  } as any);
}

function installMentorshipPrismaStubs() {
  (prisma as any).mentorship = {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  };
  (prisma as any).mentorGoalReview = {
    count: vi.fn(),
    findMany: vi.fn(),
  };
  (prisma as any).gRDocumentGoal = {
    count: vi.fn(),
    findMany: vi.fn(),
  };
  (prisma as any).user.count = vi.fn();
}

describe("instructor-mentorship-ops permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMentorshipPrismaStubs();
  });

  it("rejects unauthenticated callers", async () => {
    vi.mocked(getSession).mockResolvedValue(null as any);
    await expect(getInstructorMentorshipOpsSummary()).rejects.toThrow(
      "Unauthorized"
    );
    await expect(getUnassignedInstructorQueue()).rejects.toThrow(
      "Unauthorized"
    );
    await expect(getMentorWorkload()).rejects.toThrow("Unauthorized");
    await expect(getOverdueCheckInQueue()).rejects.toThrow("Unauthorized");
    await expect(getStalledGoalQueue()).rejects.toThrow("Unauthorized");
    await expect(getAdminMentorshipActionQueue()).rejects.toThrow(
      "Unauthorized"
    );
  });

  it("rejects non-admin authenticated callers", async () => {
    mockSession(["INSTRUCTOR"]);
    await expect(getInstructorMentorshipOpsSummary()).rejects.toThrow(
      "Unauthorized"
    );
    await expect(getUnassignedInstructorQueue()).rejects.toThrow(
      "Unauthorized"
    );
    await expect(getMentorWorkload()).rejects.toThrow("Unauthorized");
    await expect(getOverdueCheckInQueue()).rejects.toThrow("Unauthorized");
    await expect(getStalledGoalQueue()).rejects.toThrow("Unauthorized");
    await expect(getAdminMentorshipActionQueue()).rejects.toThrow(
      "Unauthorized"
    );
  });

  it("rejects mentors who are not also admins", async () => {
    mockSession(["MENTOR"]);
    await expect(getInstructorMentorshipOpsSummary()).rejects.toThrow(
      "Unauthorized"
    );
  });
});

describe("getInstructorMentorshipOpsSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMentorshipPrismaStubs();
    mockSession(["ADMIN"]);
  });

  it("aggregates capacity, unassigned, and stalled metrics for admins", async () => {
    (prisma as any).mentorship.count.mockImplementation((args: any) => {
      if (args?.where?.sessions?.none) return Promise.resolve(2); // overdue check-ins
      if (args?.where?.grDocuments?.none) return Promise.resolve(1); // no goals
      if (args?.where?.sessions?.some) return Promise.resolve(3); // recently active
      return Promise.resolve(7); // active relationships
    });
    (prisma as any).user.count.mockResolvedValue(4);
    (prisma as any).mentorship.groupBy.mockResolvedValue([
      { mentorId: "m-1", _count: { id: 3 } },
      { mentorId: "m-2", _count: { id: 4 } },
      { mentorId: "m-3", _count: { id: 1 } },
    ]);
    (prisma as any).gRDocumentGoal.count.mockResolvedValue(5);
    (prisma as any).mentorGoalReview.count.mockResolvedValue(2);

    const summary = await getInstructorMentorshipOpsSummary();

    expect(summary).toEqual({
      activeRelationships: 7,
      unassignedInstructors: 4,
      mentorsAtOrOverCapacity: 2,
      mentorsOverCapacity: 1,
      overdueCheckIns: 2,
      stalledGoals: 5,
      pendingReviews: 2,
      relationshipsWithoutGoals: 1,
      recentlyActive: 3,
    });
  });
});

describe("getUnassignedInstructorQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMentorshipPrismaStubs();
    mockSession(["ADMIN"]);
  });

  it("describes never-assigned, paused, and ended cases", async () => {
    const baseDate = new Date("2026-04-01T00:00:00Z");
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "u-never",
        name: "Never Assigned",
        email: "never@example.com",
        primaryRole: "INSTRUCTOR",
        createdAt: baseDate,
        chapter: { name: "Atlanta" },
        menteePairs: [],
      },
      {
        id: "u-paused",
        name: "Paused Mentee",
        email: "paused@example.com",
        primaryRole: "INSTRUCTOR",
        createdAt: baseDate,
        chapter: null,
        menteePairs: [{ status: "PAUSED", endDate: null }],
      },
      {
        id: "u-ended",
        name: "Ended Mentee",
        email: "ended@example.com",
        primaryRole: "INSTRUCTOR",
        createdAt: baseDate,
        chapter: { name: "Phoenix" },
        menteePairs: [{ status: "COMPLETE", endDate: baseDate }],
      },
    ] as any);

    const queue = await getUnassignedInstructorQueue();

    expect(queue.map((row) => row.reason)).toEqual([
      "Never assigned a mentor",
      "Mentorship paused — needs reassignment",
      "Previous mentorship ended",
    ]);
    expect(queue[0].chapterName).toBe("Atlanta");
    expect(queue[2].chapterName).toBe("Phoenix");
  });
});

describe("getMentorWorkload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMentorshipPrismaStubs();
    mockSession(["ADMIN"]);
  });

  it("flags over-capacity mentors and counts overdue / stalled signals", async () => {
    const now = new Date();
    const oldSession = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "m-over",
        name: "Over Capacity",
        email: "over@example.com",
        mentorPairs: [
          {
            id: "p-1",
            sessions: [{ completedAt: oldSession, scheduledAt: oldSession }],
            grDocuments: [{ goals: [{ id: "g-1" }, { id: "g-2" }] }],
          },
          {
            id: "p-2",
            sessions: [],
            grDocuments: [],
          },
          {
            id: "p-3",
            sessions: [],
            grDocuments: [],
          },
          {
            id: "p-4",
            sessions: [],
            grDocuments: [],
          },
        ],
      },
      {
        id: "m-fine",
        name: "Fine Mentor",
        email: "fine@example.com",
        mentorPairs: [
          {
            id: "p-5",
            sessions: [{ completedAt: now, scheduledAt: now }],
            grDocuments: [],
          },
        ],
      },
    ] as any);

    const workload = await getMentorWorkload();

    const over = workload.find((row) => row.id === "m-over");
    const fine = workload.find((row) => row.id === "m-fine");

    expect(over?.activeMenteeCount).toBe(4);
    expect(over?.isOverCapacity).toBe(true);
    expect(over?.overdueCheckIns).toBe(4);
    expect(over?.stalledGoals).toBe(2);
    expect(over?.warning).toContain("over the cap");

    expect(fine?.activeMenteeCount).toBe(1);
    expect(fine?.isOverCapacity).toBe(false);
    expect(fine?.warning).toBeNull();
  });
});

describe("getAdminMentorshipActionQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMentorshipPrismaStubs();
    mockSession(["ADMIN"]);
  });

  it("orders unassigned > missing G&R > overdue check-ins > stalled goals > pending reviews", async () => {
    const baseDate = new Date("2026-04-01T00:00:00Z");
    // Unassigned (priority 0)
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "u-1",
        name: "U One",
        email: "u1@example.com",
        primaryRole: "INSTRUCTOR",
        createdAt: baseDate,
        chapter: null,
        menteePairs: [],
      },
    ] as any);
    // mentorship.findMany is called from two places — getOverdueCheckInQueue
    // (sessions filter) and the inline "without goals" probe (grDocuments
    // filter). Branch by query shape so call ordering doesn't matter.
    (prisma as any).mentorship.findMany.mockImplementation((args: any) => {
      if (args?.where?.sessions?.none) {
        return Promise.resolve([
          {
            id: "ms-overdue",
            menteeId: "u-2",
            mentee: { name: "Overdue Mentee", primaryRole: "INSTRUCTOR" },
            mentor: { name: "Mentor X" },
            sessions: [],
          },
        ]);
      }
      if (args?.where?.grDocuments?.none) {
        return Promise.resolve([
          {
            id: "ms-nogoals",
            menteeId: "u-3",
            mentee: { name: "Nogoals Mentee" },
            mentor: { name: "Mentor Y" },
          },
        ]);
      }
      return Promise.resolve([]);
    });
    // Stalled goal (priority 3)
    (prisma as any).gRDocumentGoal.findMany.mockResolvedValue([
      {
        id: "g-stalled",
        title: "Plan curriculum",
        progressState: "BLOCKED",
        lifecycleStatus: "ACTIVE",
        dueDate: null,
        updatedAt: baseDate,
        document: {
          id: "doc-1",
          mentorshipId: "ms-stalled",
          mentorship: {
            menteeId: "u-4",
            mentee: { name: "Stalled Mentee" },
            mentor: { name: "Mentor Z" },
          },
        },
      },
    ] as any);
    // Pending review (priority 4)
    (prisma as any).mentorGoalReview.findMany.mockResolvedValue([
      {
        id: "rev-1",
        mentee: { id: "u-5", name: "Review Mentee" },
        mentor: { name: "Mentor R" },
        createdAt: baseDate,
      },
    ] as any);

    const queue = await getAdminMentorshipActionQueue();

    const kinds = queue.map((item) => item.kind);
    expect(kinds).toEqual([
      "UNASSIGNED_INSTRUCTOR",
      "NO_GOALS",
      "OVERDUE_CHECK_IN",
      "STALLED_GOAL",
      "PENDING_REVIEW",
    ]);
    expect(queue[0].href).toContain("/admin/mentorship-program?focus=matching");
    expect(queue[2].href).toBe(
      "/admin/mentorship/relationships/ms-overdue"
    );
    expect(queue[3].href).toBe(
      "/admin/mentorship/relationships/ms-stalled"
    );
  });
});
