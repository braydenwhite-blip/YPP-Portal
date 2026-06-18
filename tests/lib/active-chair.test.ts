import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_CHAIR_SINGLETON_ID,
  assertCanMakeFinalApplicantDecision,
  canMakeFinalApplicantDecision,
  getActiveChairUserId,
  setActiveChair,
} from "@/lib/active-chair";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canMakeFinalApplicantDecision", () => {
  it("returns true only when the user IS the active Chair", () => {
    // (2) The active Chair can submit a final decision.
    expect(
      canMakeFinalApplicantDecision({ id: "u1" }, { id: "u1" })
    ).toBe(true);
  });

  it("returns false for any other user, even another leader", () => {
    // (3) Other leadership users cannot submit a final decision.
    expect(canMakeFinalApplicantDecision({ id: "u2" }, { id: "u1" })).toBe(false);
  });

  it("returns false when there is no active Chair", () => {
    expect(canMakeFinalApplicantDecision({ id: "u1" }, null)).toBe(false);
  });

  it("returns false for an unauthenticated user", () => {
    expect(canMakeFinalApplicantDecision(null, { id: "u1" })).toBe(false);
  });

  it("accepts the chair id as a string or {userId}/{chairUserId} shapes", () => {
    expect(canMakeFinalApplicantDecision({ id: "u1" }, "u1")).toBe(true);
    expect(canMakeFinalApplicantDecision({ id: "u1" }, { userId: "u1" })).toBe(true);
    expect(
      canMakeFinalApplicantDecision({ id: "u1" }, { chairUserId: "u1" })
    ).toBe(true);
  });
});

describe("assertCanMakeFinalApplicantDecision", () => {
  it("(6) rejects a non-Chair user (server/API guard)", async () => {
    db.activeChairAssignment.findUnique.mockResolvedValue({ chairUserId: "chair-1" });
    await expect(assertCanMakeFinalApplicantDecision("intruder")).rejects.toThrow(
      /Only the currently assigned Chair/
    );
  });

  it("allows the active Chair", async () => {
    db.activeChairAssignment.findUnique.mockResolvedValue({ chairUserId: "chair-1" });
    await expect(
      assertCanMakeFinalApplicantDecision("chair-1")
    ).resolves.toBeUndefined();
  });
});

describe("setActiveChair", () => {
  it("(1) stores a single active Chair via the singleton row and (7) records history", async () => {
    db.user.findUnique.mockResolvedValue({ id: "new-chair" });
    db.activeChairAssignment.findUnique.mockResolvedValue({ chairUserId: "old-chair" });
    db.activeChairAssignment.upsert.mockResolvedValue({});
    db.chairAssignmentHistory.create.mockResolvedValue({});

    const result = await setActiveChair("new-chair", "admin-1");

    expect(result).toEqual({
      success: true,
      previousChairId: "old-chair",
      newChairId: "new-chair",
    });

    // Singleton: the upsert always targets the one fixed row, so there can
    // never be two active Chairs.
    expect(db.activeChairAssignment.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = db.activeChairAssignment.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({ id: ACTIVE_CHAIR_SINGLETON_ID });
    expect(upsertArgs.update.chairUserId).toBe("new-chair");

    // (7) Chair changes are recorded in the audit history.
    expect(db.chairAssignmentHistory.create).toHaveBeenCalledTimes(1);
    const historyArgs = db.chairAssignmentHistory.create.mock.calls[0][0];
    expect(historyArgs.data).toMatchObject({
      previousChairId: "old-chair",
      newChairId: "new-chair",
      changedById: "admin-1",
    });
  });

  it("(4)+(5) replacing the Chair moves decision permission to the new Chair", async () => {
    db.user.findUnique.mockResolvedValue({ id: "new-chair" });
    db.activeChairAssignment.findUnique.mockResolvedValue({ chairUserId: "old-chair" });
    db.activeChairAssignment.upsert.mockResolvedValue({});
    db.chairAssignmentHistory.create.mockResolvedValue({});

    await setActiveChair("new-chair", "admin-1");

    // After replacement, the singleton resolves to the new Chair...
    db.activeChairAssignment.findUnique.mockResolvedValue({ chairUserId: "new-chair" });
    const activeId = await getActiveChairUserId();
    expect(activeId).toBe("new-chair");

    // (5) The new Chair immediately receives decision permission...
    expect(canMakeFinalApplicantDecision({ id: "new-chair" }, activeId)).toBe(true);
    // (4) ...and the previous Chair immediately loses it.
    expect(canMakeFinalApplicantDecision({ id: "old-chair" }, activeId)).toBe(false);
  });

  it("does not write a history row when re-assigning the same Chair (no-op)", async () => {
    db.user.findUnique.mockResolvedValue({ id: "chair-1" });
    db.activeChairAssignment.findUnique.mockResolvedValue({ chairUserId: "chair-1" });

    const result = await setActiveChair("chair-1", "admin-1");

    expect(result.success).toBe(true);
    expect(db.activeChairAssignment.upsert).not.toHaveBeenCalled();
    expect(db.chairAssignmentHistory.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown user", async () => {
    db.user.findUnique.mockResolvedValue(null);
    const result = await setActiveChair("ghost", "admin-1");
    expect(result).toEqual({ success: false, error: "That user could not be found." });
  });
});
