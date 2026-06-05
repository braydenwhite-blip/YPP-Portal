import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    quarterlyReview: { upsert: vi.fn(), findFirst: vi.fn() },
  },
}));

import { getSessionUser } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  getLatestQuarterlyReview,
  submitQuarterlyReview,
} from "@/lib/people-strategy/quarterly-review-actions";

const mockGetSessionUser = vi.mocked(getSessionUser);
const fn = (m: unknown) => m as unknown as ReturnType<typeof vi.fn>;

function sessionAs(
  roles: string[],
  adminSubtypes: string[] = [],
  id = "reviewer-1"
) {
  mockGetSessionUser.mockResolvedValue({
    id,
    name: "Test",
    email: "t@example.com",
    roles,
    primaryRole: roles[0] ?? "STUDENT",
    chapterId: null,
    adminSubtypes,
  } as never);
}

beforeEach(() => {
  process.env.ENABLE_QUARTERLY_REVIEWS = "true";
  vi.clearAllMocks();
  // Echo the upsert payload back as the persisted row.
  fn(prisma.quarterlyReview.upsert).mockImplementation(
    async (args: { create: Record<string, unknown> }) => ({
      id: "qr1",
      notes: null,
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      ...args.create,
    })
  );
});

afterEach(() => {
  delete process.env.ENABLE_QUARTERLY_REVIEWS;
});

describe("submitQuarterlyReview", () => {
  it("computes successionFlag=true and returns the Clear Successor matrix label for Above & Beyond x Above & Beyond", async () => {
    sessionAs(["ADMIN"], ["LEADERSHIP"]);

    const result = await submitQuarterlyReview({
      userId: "u1",
      quarter: "2026-Q2",
      performanceRating: "ABOVE_AND_BEYOND",
      potentialRating: "ABOVE_AND_BEYOND",
      decision: "PROMOTION",
    });

    expect(result.successionFlag).toBe(true);
    expect(result.matrixLabel).toBe("Clear Successor");

    const arg = fn(prisma.quarterlyReview.upsert).mock.calls[0][0];
    // Upsert keyed on the unique (userId, quarter) — no duplicate row possible.
    expect(arg.where.userId_quarter).toEqual({ userId: "u1", quarter: "2026-Q2" });
    // successionFlag is persisted; the matrix label is NOT in the write payload.
    expect(arg.create.successionFlag).toBe(true);
    expect(arg.create).not.toHaveProperty("matrixLabel");
    expect(arg.update).not.toHaveProperty("matrixLabel");
    // Author stamped from the session.
    expect(arg.create.createdById).toBe("reviewer-1");
  });

  it("computes successionFlag=false and Critical Risk for At Risk x At Risk", async () => {
    sessionAs(["ADMIN"], ["SUPER_ADMIN"]);

    const result = await submitQuarterlyReview({
      userId: "u1",
      quarter: "2026-Q2",
      performanceRating: "BEHIND_SCHEDULE",
      potentialRating: "BEHIND_SCHEDULE",
      decision: "PIP",
    });

    expect(result.successionFlag).toBe(false);
    expect(result.matrixLabel).toBe("Critical Risk");
    expect(fn(prisma.quarterlyReview.upsert).mock.calls[0][0].create.successionFlag).toBe(
      false
    );
  });

  it("Board (SUPER_ADMIN) passes the CPO gate", async () => {
    sessionAs(["ADMIN"], ["SUPER_ADMIN"]);
    await expect(
      submitQuarterlyReview({
        userId: "u1",
        quarter: "2026-Q3",
        performanceRating: "ACHIEVED",
        potentialRating: "ACHIEVED",
        decision: "CONTINUATION",
      })
    ).resolves.toMatchObject({ successionFlag: true });
  });

  it("denies an ADMIN without the CPO/Board subtype", async () => {
    sessionAs(["ADMIN"], ["HIRING_ADMIN"]);
    await expect(
      submitQuarterlyReview({
        userId: "u1",
        quarter: "2026-Q2",
        performanceRating: "ACHIEVED",
        potentialRating: "ACHIEVED",
        decision: "CONTINUATION",
      })
    ).rejects.toThrow("Unauthorized");
    expect(prisma.quarterlyReview.upsert).not.toHaveBeenCalled();
  });

  it("denies a non-admin officer", async () => {
    sessionAs(["STAFF"]);
    await expect(
      submitQuarterlyReview({
        userId: "u1",
        quarter: "2026-Q2",
        performanceRating: "ACHIEVED",
        potentialRating: "ACHIEVED",
        decision: "CONTINUATION",
      })
    ).rejects.toThrow("Unauthorized");
    expect(prisma.quarterlyReview.upsert).not.toHaveBeenCalled();
  });

  it("throws when the feature flag is off", async () => {
    delete process.env.ENABLE_QUARTERLY_REVIEWS;
    sessionAs(["ADMIN"], ["LEADERSHIP"]);
    await expect(
      submitQuarterlyReview({
        userId: "u1",
        quarter: "2026-Q2",
        performanceRating: "ACHIEVED",
        potentialRating: "ACHIEVED",
        decision: "CONTINUATION",
      })
    ).rejects.toThrow("Quarterly Reviews are not enabled");
    expect(prisma.quarterlyReview.upsert).not.toHaveBeenCalled();
  });
});

describe("getLatestQuarterlyReview", () => {
  it("returns the latest review with a computed (not persisted) matrix label", async () => {
    fn(prisma.quarterlyReview.findFirst).mockResolvedValue({
      id: "qr1",
      userId: "u1",
      quarter: "2026-Q2",
      performanceRating: "ACHIEVED",
      potentialRating: "ABOVE_AND_BEYOND",
      decision: "PROMOTION",
      notes: null,
      successionFlag: true,
      createdById: "reviewer-1",
      createdAt: new Date(),
    });

    const result = await getLatestQuarterlyReview("u1");
    expect(result?.matrixLabel).toBe("Rising Talent");
  });

  it("returns null when the feature flag is off (no DB read)", async () => {
    delete process.env.ENABLE_QUARTERLY_REVIEWS;
    const result = await getLatestQuarterlyReview("u1");
    expect(result).toBeNull();
    expect(prisma.quarterlyReview.findFirst).not.toHaveBeenCalled();
  });
});
