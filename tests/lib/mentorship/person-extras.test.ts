import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authorization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/authorization")>();
  return { ...actual, requireLeadership: vi.fn() };
});

import { prisma } from "@/lib/prisma";
import { requireLeadership } from "@/lib/authorization";
import {
  getLatestCoachingPlan,
  getMyReleasedCoachingPlan,
} from "@/lib/mentorship/person-extras";

const LEADERSHIP_USER = {
  id: "leader-1",
  roles: ["ADMIN"],
  primaryRole: "ADMIN",
  adminSubtypes: ["LEADERSHIP"],
} as never;

const APPROVED_REVIEW = {
  planOfAction: "Own the spring cohort kickoff end to end.",
  overallRating: "ACHIEVED",
  cycleMonth: new Date("2026-06-01T00:00:00.000Z"),
  releasedToMenteeAt: new Date("2026-06-20T00:00:00.000Z"),
  mentor: { name: "Jordan Lee", email: "jordan@ypp.org" },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENABLE_PEOPLE_DASHBOARD = "true";
  vi.mocked(requireLeadership).mockResolvedValue(LEADERSHIP_USER);
  (prisma as never as Record<string, unknown>).mentorGoalReview = {
    findFirst: vi.fn().mockResolvedValue(APPROVED_REVIEW),
  };
});

describe("getLatestCoachingPlan", () => {
  it("returns the latest APPROVED review's plan with the mentor's name", async () => {
    const plan = await getLatestCoachingPlan("mentee-1");
    expect(plan).toMatchObject({
      planOfAction: "Own the spring cohort kickoff end to end.",
      overallRating: "ACHIEVED",
      mentorName: "Jordan Lee",
    });

    const query = (
      prisma as never as { mentorGoalReview: { findFirst: ReturnType<typeof vi.fn> } }
    ).mentorGoalReview.findFirst.mock.calls[0][0];
    expect(query.where).toMatchObject({ menteeId: "mentee-1", status: "APPROVED" });
    expect(query.orderBy).toEqual({ cycleMonth: "desc" });
  });

  it("returns null when no approved review exists", async () => {
    (
      prisma as never as { mentorGoalReview: { findFirst: ReturnType<typeof vi.fn> } }
    ).mentorGoalReview.findFirst.mockResolvedValue(null);
    expect(await getLatestCoachingPlan("mentee-1")).toBeNull();
  });

  it("requires the leadership command gate", async () => {
    vi.mocked(requireLeadership).mockRejectedValue(new Error("Unauthorized"));
    await expect(getLatestCoachingPlan("mentee-1")).rejects.toThrow();
  });
});

describe("getMyReleasedCoachingPlan", () => {
  it("only reads released reviews (a mentee never sees an unreleased plan)", async () => {
    await getMyReleasedCoachingPlan("mentee-1");
    const query = (
      prisma as never as { mentorGoalReview: { findFirst: ReturnType<typeof vi.fn> } }
    ).mentorGoalReview.findFirst.mock.calls[0][0];
    expect(query.where).toMatchObject({
      menteeId: "mentee-1",
      releasedToMenteeAt: { not: null },
    });
    expect(query.orderBy).toEqual({ releasedToMenteeAt: "desc" });
  });

  it("needs no leadership gate — it is self-scoped", async () => {
    vi.mocked(requireLeadership).mockRejectedValue(new Error("Unauthorized"));
    const plan = await getMyReleasedCoachingPlan("mentee-1");
    expect(plan?.mentorName).toBe("Jordan Lee");
  });
});
