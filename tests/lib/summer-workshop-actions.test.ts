/**
 * Behavior tests for `promoteToFullInstructor` (server action) — auth
 * gating, idempotence on already-standard applicants, and the audit
 * timeline writes.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFindUnique,
  mockUpdate,
  mockTimelineCreate,
  mockTransaction,
  mockGetSession,
  mockGetHiringActor,
  mockIsAdmin,
  mockIsHiringChair,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockTimelineCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetSession: vi.fn(),
  mockGetHiringActor: vi.fn(),
  mockIsAdmin: vi.fn(),
  mockIsHiringChair: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    instructorApplicationTimelineEvent: {
      create: mockTimelineCreate,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession: mockGetSession,
}));

vi.mock("@/lib/chapter-hiring-permissions", () => ({
  getHiringActor: mockGetHiringActor,
  isAdmin: mockIsAdmin,
  isHiringChair: mockIsHiringChair,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { promoteToFullInstructor } from "@/lib/summer-workshop-actions";

beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
  mockTimelineCreate.mockReset();
  mockTransaction.mockReset();
  mockGetSession.mockReset();
  mockGetHiringActor.mockReset();
  mockIsAdmin.mockReset();
  mockIsHiringChair.mockReset();
  mockRevalidatePath.mockReset();

  // Run the array of operations (Prisma's $transaction(arr) pattern).
  mockTransaction.mockImplementation(async (ops: unknown) => {
    if (Array.isArray(ops)) {
      return Promise.all(ops);
    }
    return ops;
  });
});

describe("promoteToFullInstructor", () => {
  it("rejects unauthenticated callers", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await promoteToFullInstructor("app-1");
    expect(result).toEqual({ ok: false, error: "Not signed in." });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("rejects non-admin / non-chair callers", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "actor-1" } });
    mockGetHiringActor.mockResolvedValue({ id: "actor-1", roles: [] });
    mockIsAdmin.mockReturnValue(false);
    mockIsHiringChair.mockReturnValue(false);
    const result = await promoteToFullInstructor("app-1");
    expect(result).toEqual({
      ok: false,
      error: "Not authorized to promote applicants.",
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns a clear error when the application is missing", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "actor-1" } });
    mockGetHiringActor.mockResolvedValue({ id: "actor-1" });
    mockIsAdmin.mockReturnValue(true);
    mockIsHiringChair.mockReturnValue(false);
    mockFindUnique.mockResolvedValue(null);

    const result = await promoteToFullInstructor("missing");
    expect(result).toEqual({ ok: false, error: "Application not found." });
  });

  it("is a no-op when already STANDARD (idempotent)", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "actor-1" } });
    mockGetHiringActor.mockResolvedValue({ id: "actor-1" });
    mockIsAdmin.mockReturnValue(true);
    mockIsHiringChair.mockReturnValue(false);
    mockFindUnique.mockResolvedValue({
      id: "app-1",
      instructorSubtype: "STANDARD",
      applicationTrack: "STANDARD_INSTRUCTOR",
      promotionEligibility: null,
    });

    const result = await promoteToFullInstructor("app-1");
    expect(result).toEqual({ ok: true });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("flips subtype to STANDARD and writes audit events when allowed", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "chair-1" } });
    mockGetHiringActor.mockResolvedValue({ id: "chair-1" });
    mockIsAdmin.mockReturnValue(false);
    mockIsHiringChair.mockReturnValue(true);
    mockFindUnique.mockResolvedValue({
      id: "app-1",
      instructorSubtype: "SUMMER_WORKSHOP",
      applicationTrack: "SUMMER_WORKSHOP_INSTRUCTOR",
      promotionEligibility: null,
    });

    const result = await promoteToFullInstructor("app-1");
    expect(result).toEqual({ ok: true });

    // Transaction was executed.
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // The update flips the subtype and stamps audit fields.
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "app-1" });
    expect(updateArg.data.instructorSubtype).toBe("STANDARD");
    expect(updateArg.data.subtypeChangedById).toBe("chair-1");
    expect(updateArg.data.promotionEligibility.flaggedForPromotion).toBe(true);
    expect(updateArg.data.promotionEligibility.flaggedBy).toBe("chair-1");

    // Two timeline events (PROMOTED_TO_STANDARD + SUBTYPE_CHANGED) were
    // queued in the same transaction.
    expect(mockTimelineCreate).toHaveBeenCalledTimes(2);
    const kinds = mockTimelineCreate.mock.calls.map((c) => c[0].data.kind);
    expect(kinds).toContain("PROMOTED_TO_STANDARD");
    expect(kinds).toContain("SUBTYPE_CHANGED");

    // Cache revalidations fired for both surfaces.
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      "/applications/instructor/app-1"
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/instructor-applicants");
  });
});
