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
    monthlySelfReflection: { findFirst: vi.fn() },
    mentorGoalReview: { findFirst: vi.fn() },
    feedbackRequest: { findMany: vi.fn() },
    checkIn: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}));

import { getSessionUser } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { compileCheckIn } from "@/lib/people-strategy/check-in-actions";

const mockGetSessionUser = vi.mocked(getSessionUser);
const fn = (m: unknown) => m as unknown as ReturnType<typeof vi.fn>;

function sessionAs(
  roles: string[],
  id = "officer-1",
  adminSubtypes: string[] = ["LEADERSHIP"]
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
  // No prior check-in and no feedback by default; individual tests override.
  fn(prisma.checkIn.findUnique).mockResolvedValue(null);
  fn(prisma.feedbackRequest.findMany).mockResolvedValue([]);
  // Echo the upsert payload back as the persisted row.
  fn(prisma.checkIn.upsert).mockImplementation(async (args: { create: Record<string, unknown> }) => ({
    id: "ci1",
    ...args.create,
  }));
});

afterEach(() => {
  delete process.env.ENABLE_QUARTERLY_REVIEWS;
});

describe("compileCheckIn", () => {
  it("derives performanceRating from the existing mentor goal review and upserts on (userId, month)", async () => {
    sessionAs(["ADMIN"]);
    fn(prisma.monthlySelfReflection.findFirst).mockResolvedValue({ id: "refl1" });
    fn(prisma.mentorGoalReview.findFirst).mockResolvedValue({
      id: "rev1",
      overallRating: "ACHIEVED",
      goalRatings: [{ rating: "ACHIEVED" }, { rating: "GETTING_STARTED" }],
    });

    const result = await compileCheckIn({ userId: "u1", month: "2026-05-15" });

    expect(result.performanceRating).toBe("ACHIEVED");
    expect(result.selfReflectionId).toBe("refl1");
    expect(result.mentorGoalReviewId).toBe("rev1");

    const arg = fn(prisma.checkIn.upsert).mock.calls[0][0];
    // Upsert keyed on the unique (userId, month) — no duplicate row possible.
    expect(arg.where.userId_month.userId).toBe("u1");
    // Month normalized to the first of the month (UTC).
    expect((arg.where.userId_month.month as Date).toISOString()).toBe(
      "2026-05-01T00:00:00.000Z"
    );
    expect(arg.create.performanceRating).toBe("ACHIEVED");
    expect(arg.update.performanceRating).toBe("ACHIEVED");
  });

  it("compiles with a null rating when no goal data exists", async () => {
    sessionAs(["ADMIN"]);
    fn(prisma.monthlySelfReflection.findFirst).mockResolvedValue(null);
    fn(prisma.mentorGoalReview.findFirst).mockResolvedValue(null);

    const result = await compileCheckIn({ userId: "u1", month: "2026-05-01" });

    expect(result.performanceRating).toBeNull();
    expect(result.selfReflectionId).toBeNull();
    expect(result.mentorGoalReviewId).toBeNull();
    expect(result.compiledNotes).toContain("not submitted");
  });

  it("is feedback-aware: counts responses, persists only aggregate counts, and reports new-on-recompile", async () => {
    sessionAs(["ADMIN"]);
    fn(prisma.monthlySelfReflection.findFirst).mockResolvedValue(null);
    fn(prisma.mentorGoalReview.findFirst).mockResolvedValue(null);
    // A check-in already exists, compiled before the newest response arrived.
    const priorCompiledAt = new Date("2026-05-20T00:00:00.000Z");
    fn(prisma.checkIn.findUnique).mockResolvedValue({ createdAt: priorCompiledAt });
    fn(prisma.feedbackRequest.findMany).mockResolvedValue([
      { submittedAt: new Date("2026-05-10T00:00:00.000Z") }, // before prior compile
      { submittedAt: new Date("2026-05-25T00:00:00.000Z") }, // new since prior compile
      { submittedAt: null }, // still pending
    ]);

    const result = await compileCheckIn({ userId: "u1", month: "2026-05-15" });

    expect(result.feedbackResponses).toBe(2);
    expect(result.feedbackPending).toBe(1);
    expect(result.isRecompile).toBe(true);
    expect(result.newResponses).toBe(1);

    const arg = fn(prisma.checkIn.upsert).mock.calls[0][0];
    // Aggregate counts are persisted; no response body text leaks into notes.
    expect(arg.create.compiledNotes).toContain("2 responses received");
    expect(arg.create.compiledNotes).toContain("1 still pending");
  });

  it("denies a user below leadership tier", async () => {
    sessionAs(["STUDENT"], "student-1", []);
    await expect(
      compileCheckIn({ userId: "u1", month: "2026-05-01" })
    ).rejects.toThrow("Unauthorized");
    expect(prisma.checkIn.upsert).not.toHaveBeenCalled();
  });

  it("denies admin without leadership subtype", async () => {
    sessionAs(["ADMIN"], "admin-1", []);
    await expect(
      compileCheckIn({ userId: "u1", month: "2026-05-01" })
    ).rejects.toThrow("Unauthorized");
    expect(prisma.checkIn.upsert).not.toHaveBeenCalled();
  });

  it("throws when the feature flag is off", async () => {
    delete process.env.ENABLE_QUARTERLY_REVIEWS;
    sessionAs(["ADMIN"]);
    await expect(
      compileCheckIn({ userId: "u1", month: "2026-05-01" })
    ).rejects.toThrow("Quarterly Reviews are not enabled");
  });
});
