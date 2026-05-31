import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    instructorApplicationChairDecision: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getHiringChairHomeData } from "@/lib/hiring-chair-home";

const findMany = prisma.instructorApplication.findMany as unknown as ReturnType<typeof vi.fn>;
const appCount = prisma.instructorApplication.count as unknown as ReturnType<typeof vi.fn>;
const decisionCount = prisma.instructorApplicationChairDecision.count as unknown as ReturnType<
  typeof vi.fn
>;
const decisionFindMany = prisma.instructorApplicationChairDecision.findMany as unknown as ReturnType<
  typeof vi.fn
>;

describe("getHiringChairHomeData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-13T15:00:00Z")); // Wednesday
    findMany.mockReset();
    appCount.mockReset();
    decisionCount.mockReset();
    decisionFindMany.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aggregates pending applications, week counts, and recent decisions", async () => {
    const queuedAt = new Date("2026-05-09T15:00:00Z"); // 4 days ago
    findMany.mockResolvedValueOnce([
      {
        id: "app-1",
        preferredFirstName: "Alex",
        legalName: "Alex Rivera",
        chairQueuedAt: queuedAt,
        applicant: { name: "Alex Rivera", chapter: { name: "NYC" } },
      },
    ]);
    appCount.mockResolvedValueOnce(3);
    decisionCount.mockResolvedValueOnce(5); // total this week
    decisionCount.mockResolvedValueOnce(2); // mine this week
    decisionFindMany.mockResolvedValueOnce([
      {
        id: "dec-1",
        applicationId: "app-9",
        action: "APPROVE",
        decidedAt: new Date("2026-05-12T15:00:00Z"),
        chairId: "chair-1",
        chair: { name: "Morgan Ellison" },
        application: {
          preferredFirstName: "Sam",
          legalName: "Samuel Lee",
          applicant: { name: "Samuel Lee", chapter: { name: "BOS" } },
        },
      },
    ]);

    const data = await getHiringChairHomeData("chair-1");

    expect(data.pendingTotal).toBe(3);
    expect(data.pending).toHaveLength(1);
    expect(data.pending[0]).toMatchObject({
      id: "app-1",
      displayName: "Alex Rivera",
      chapterName: "NYC",
      daysInQueue: 4,
    });
    expect(data.oldestWaiting?.id).toBe("app-1");
    expect(data.decisionsThisWeek).toBe(5);
    expect(data.myDecisionsThisWeek).toBe(2);
    expect(data.recentDecisions).toHaveLength(1);
    expect(data.recentDecisions[0].isMine).toBe(true);
    expect(data.recentDecisions[0].action).toBe("APPROVE");
  });

  it("returns a zero-filled object when prisma reports a missing table", async () => {
    findMany.mockRejectedValueOnce(Object.assign(new Error("P2021"), { code: "P2021" }));
    const data = await getHiringChairHomeData("chair-1");
    expect(data).toEqual({
      pendingTotal: 0,
      oldestWaiting: null,
      pending: [],
      decisionsThisWeek: 0,
      myDecisionsThisWeek: 0,
      recentDecisions: [],
    });
  });

  it("renders zero state when no rows exist", async () => {
    findMany.mockResolvedValueOnce([]);
    appCount.mockResolvedValueOnce(0);
    decisionCount.mockResolvedValueOnce(0);
    decisionCount.mockResolvedValueOnce(0);
    decisionFindMany.mockResolvedValueOnce([]);

    const data = await getHiringChairHomeData("chair-1");
    expect(data.pendingTotal).toBe(0);
    expect(data.oldestWaiting).toBeNull();
    expect(data.pending).toEqual([]);
    expect(data.recentDecisions).toEqual([]);
  });

  it("flags decisions made by other chairs as not mine", async () => {
    findMany.mockResolvedValueOnce([]);
    appCount.mockResolvedValueOnce(0);
    decisionCount.mockResolvedValueOnce(1);
    decisionCount.mockResolvedValueOnce(0);
    decisionFindMany.mockResolvedValueOnce([
      {
        id: "dec-2",
        applicationId: "app-2",
        action: "REJECT",
        decidedAt: new Date("2026-05-12T15:00:00Z"),
        chairId: "other-chair",
        chair: { name: "Other Chair" },
        application: {
          preferredFirstName: null,
          legalName: "Pat Doe",
          applicant: { name: null, chapter: null },
        },
      },
    ]);

    const data = await getHiringChairHomeData("chair-1");
    expect(data.recentDecisions[0].isMine).toBe(false);
    expect(data.recentDecisions[0].chairName).toBe("Other Chair");
    expect(data.recentDecisions[0].displayName).toBe("Pat Doe");
  });
});
