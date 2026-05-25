import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workshopProposalSubmission: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  countApprovedUnplaced,
  listApprovedUnplacedCandidates,
} from "@/lib/workshop-proposal-pool";

const findMany =
  prisma.workshopProposalSubmission.findMany as unknown as ReturnType<typeof vi.fn>;

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sub-1",
    sourceType: "CUSTOM_DESIGN" as const,
    customWorkshop: {
      title: "Bridges 101",
      category: "STEM",
      targetAgeGroup: "Grades 5-7",
    },
    template: null,
    reviewedAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-02T00:00:00.000Z"),
    author: {
      id: "user-1",
      name: "Alex Lee",
      email: "alex@example.com",
      chapter: { name: "Brooklyn" },
    },
    assignments: [],
    ...overrides,
  };
}

describe("workshop-proposal-pool", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("returns approved rows with zero active assignments and derives display fields", async () => {
    findMany.mockResolvedValueOnce([row()]);
    const result = await listApprovedUnplacedCandidates();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      submissionId: "sub-1",
      applicantId: "user-1",
      applicantName: "Alex Lee",
      chapterName: "Brooklyn",
      category: "STEM",
      ageRange: "Grades 5-7",
      workshopTitle: "Bridges 101",
      sourceLabel: "Custom-designed",
    });
  });

  it("filters out rows with any active assignment", async () => {
    findMany.mockResolvedValueOnce([
      row({ id: "placed", assignments: [{ id: "asn-1" }] }),
      row({ id: "free" }),
    ]);
    const result = await listApprovedUnplacedCandidates();
    expect(result.map((r) => r.submissionId)).toEqual(["free"]);
  });

  it("prefers template fields over custom blob when both are present", async () => {
    findMany.mockResolvedValueOnce([
      row({
        sourceType: "TEMPLATE_SELECTION",
        template: {
          title: "Coding for Kids",
          category: "Computer Science",
          targetAgeRange: "Grades 3-5",
        },
        customWorkshop: null,
      }),
    ]);
    const result = await listApprovedUnplacedCandidates();
    expect(result[0]).toMatchObject({
      category: "Computer Science",
      ageRange: "Grades 3-5",
      workshopTitle: "Coding for Kids",
      sourceLabel: "From library",
    });
  });

  it("respects the limit option", async () => {
    findMany.mockResolvedValueOnce(
      Array.from({ length: 25 }, (_, i) => row({ id: `r-${i}` }))
    );
    const result = await listApprovedUnplacedCandidates({ limit: 5 });
    expect(result).toHaveLength(5);
  });

  it("count helper returns only unplaced rows", async () => {
    findMany.mockResolvedValueOnce([
      { id: "a", assignments: [] },
      { id: "b", assignments: [{ id: "x" }] },
      { id: "c", assignments: [] },
    ]);
    expect(await countApprovedUnplaced()).toBe(2);
  });

  it("falls back to [] / 0 if Prisma read fails (recoverable error)", async () => {
    // Simulate the kind of recoverable error withPrismaFallback handles —
    // a thrown Postgres timeout. Our helper swallows it and returns [].
    findMany.mockRejectedValueOnce(
      new Error("canceling statement due to statement timeout")
    );
    expect(await listApprovedUnplacedCandidates()).toEqual([]);

    findMany.mockRejectedValueOnce(
      new Error("canceling statement due to statement timeout")
    );
    expect(await countApprovedUnplaced()).toBe(0);
  });
});
