import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getChairQueueBadgeCount,
  shouldSeeChairQueueBadge,
} from "@/lib/hiring-chair-badge";

const mockCount = prisma.instructorApplication.count as unknown as ReturnType<typeof vi.fn>;

describe("hiring-chair-badge", () => {
  beforeEach(() => {
    mockCount.mockReset();
  });

  describe("shouldSeeChairQueueBadge", () => {
    it("returns true for ADMIN", () => {
      expect(shouldSeeChairQueueBadge(["ADMIN"])).toBe(true);
    });
    it("returns true for HIRING_CHAIR", () => {
      expect(shouldSeeChairQueueBadge(["HIRING_CHAIR"])).toBe(true);
    });
    it("returns true when both are present", () => {
      expect(shouldSeeChairQueueBadge(["ADMIN", "HIRING_CHAIR"])).toBe(true);
    });
    it("returns false for unrelated roles", () => {
      expect(shouldSeeChairQueueBadge(["STUDENT"])).toBe(false);
      expect(shouldSeeChairQueueBadge(["CHAPTER_PRESIDENT"])).toBe(false);
      expect(shouldSeeChairQueueBadge([])).toBe(false);
    });
  });

  describe("getChairQueueBadgeCount", () => {
    it("returns 0 without querying for non-eligible roles", async () => {
      const count = await getChairQueueBadgeCount(["STUDENT"]);
      expect(count).toBe(0);
      expect(mockCount).not.toHaveBeenCalled();
    });

    it("queries CHAIR_REVIEW count for HIRING_CHAIR", async () => {
      mockCount.mockResolvedValueOnce(7);
      const count = await getChairQueueBadgeCount(["HIRING_CHAIR"]);
      expect(count).toBe(7);
      expect(mockCount).toHaveBeenCalledWith({
        where: { status: "CHAIR_REVIEW" },
      });
    });

    it("queries for ADMIN as well", async () => {
      mockCount.mockResolvedValueOnce(3);
      const count = await getChairQueueBadgeCount(["ADMIN"]);
      expect(count).toBe(3);
    });

    it("returns 0 when prisma reports a missing table (P2021)", async () => {
      const err = Object.assign(new Error("P2021"), { code: "P2021" });
      mockCount.mockRejectedValueOnce(err);
      const count = await getChairQueueBadgeCount(["ADMIN"]);
      expect(count).toBe(0);
    });

    it("returns 0 on unexpected errors and does not throw", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockCount.mockRejectedValueOnce(new Error("boom"));
      const count = await getChairQueueBadgeCount(["HIRING_CHAIR"]);
      expect(count).toBe(0);
      consoleSpy.mockRestore();
    });
  });
});
