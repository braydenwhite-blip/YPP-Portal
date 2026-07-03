import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authorization")>();
  return { ...actual, requireLeadership: vi.fn() };
});

import { prisma } from "@/lib/prisma";
import { requireLeadership } from "@/lib/authorization";
import { listReviewCycles, loadReviewCycle } from "@/lib/mentorship/cycle-load";

const LEADERSHIP_USER = {
  id: "leader-1",
  roles: ["ADMIN"],
  primaryRole: "ADMIN",
  adminSubtypes: ["LEADERSHIP"],
} as never;

const COHORT_CYCLE = {
  id: "cycle-cohort",
  name: "All instructors — 2026-07",
  kind: "monthly",
  periodLabel: "2026-07",
  scopeLabel: "All instructors",
  status: "active",
  dueDate: null,
  createdAt: new Date("2026-07-01"),
  closedAt: null,
};

function participantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: `p-${overrides.userId ?? "x"}`,
    cycleId: "cycle-cohort",
    userId: "user-x",
    mentorshipId: null,
    stageOverride: null,
    user: { name: "Person", email: "person@ypp.org", primaryRole: "INSTRUCTOR", chapter: null },
    mentorship: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENABLE_PEOPLE_DASHBOARD = "true";
  process.env.ENABLE_ACTION_TRACKER = "false";
  vi.mocked(requireLeadership).mockResolvedValue(LEADERSHIP_USER);

  (prisma as never as Record<string, unknown>).reviewCycle = {
    findMany: vi.fn().mockResolvedValue([COHORT_CYCLE]),
    findUnique: vi.fn().mockResolvedValue(COHORT_CYCLE),
  };
  (prisma as never as Record<string, unknown>).reviewCycleParticipant = {
    findMany: vi.fn().mockResolvedValue([
      participantRow({ id: "p-1", userId: "user-1" }),
      participantRow({ id: "p-2", userId: "user-2" }),
      participantRow({ id: "p-3", userId: "user-3" }),
    ]),
  };
  (prisma as never as Record<string, unknown>).monthlySelfReflection = {
    findMany: vi.fn().mockResolvedValue([]),
  };
  (prisma as never as Record<string, unknown>).mentorGoalReview = {
    findMany: vi.fn().mockResolvedValue([]),
  };
  (prisma as never as Record<string, unknown>).quarterlyReview = {
    findMany: vi.fn().mockResolvedValue([]),
  };
});

describe("loadReviewCycle — cohort sourcing", () => {
  it("derives every participant from ReviewCycleParticipant, not a single ReviewCycle.revieweeId", async () => {
    const detail = await loadReviewCycle("cycle-cohort");
    expect(detail).not.toBeNull();
    expect(detail!.participants).toHaveLength(3);
    expect(detail!.participants.map((p) => p.userId).sort()).toEqual([
      "user-1",
      "user-2",
      "user-3",
    ]);

    const participantSelect = (
      prisma as never as { reviewCycleParticipant: { findMany: ReturnType<typeof vi.fn> } }
    ).reviewCycleParticipant.findMany.mock.calls[0][0].select;
    expect(participantSelect).not.toHaveProperty("revieweeId");
    expect(participantSelect).toHaveProperty("userId");

    const cycleSelect = (
      prisma as never as { reviewCycle: { findUnique: ReturnType<typeof vi.fn> } }
    ).reviewCycle.findUnique.mock.calls[0][0].select;
    expect(cycleSelect).not.toHaveProperty("revieweeId");
  });

  it("returns null for a cycle that doesn't exist, instead of throwing", async () => {
    (
      prisma as never as { reviewCycle: { findUnique: ReturnType<typeof vi.fn> } }
    ).reviewCycle.findUnique.mockResolvedValue(null);
    const detail = await loadReviewCycle("missing-cycle");
    expect(detail).toBeNull();
  });
});

describe("listReviewCycles — cohort rollup", () => {
  it("rolls up progress across all of a cycle's participants", async () => {
    const summaries = await listReviewCycles();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].progress.total).toBe(3);
  });
});
