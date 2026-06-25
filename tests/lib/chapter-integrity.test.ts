import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chapterPresidentApplication: { findMany: vi.fn() },
    chapter: { findMany: vi.fn(), groupBy: vi.fn() },
    chapterSupportRequest: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { loadChapterIntegrityIssues } from "@/lib/chapters/integrity";

const mockPrisma = prisma as unknown as {
  chapterPresidentApplication: { findMany: ReturnType<typeof vi.fn> };
  chapter: { findMany: ReturnType<typeof vi.fn>; groupBy: ReturnType<typeof vi.fn> };
  chapterSupportRequest: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: clean system.
  mockPrisma.chapterPresidentApplication.findMany.mockResolvedValue([]);
  mockPrisma.chapter.findMany.mockResolvedValue([]);
  mockPrisma.chapter.groupBy.mockResolvedValue([]);
  mockPrisma.chapterSupportRequest.findMany.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("loadChapterIntegrityIssues", () => {
  it("returns nothing on a clean system", async () => {
    expect(await loadChapterIntegrityIssues()).toEqual([]);
  });

  it("flags an approved application with no chapter as a repairable danger", async () => {
    mockPrisma.chapterPresidentApplication.findMany.mockResolvedValue([
      { id: "app1", preferredFirstName: "Sam", lastName: "Lee", legalName: null },
    ]);
    const issues = await loadChapterIntegrityIssues();
    const issue = issues.find((i) => i.kind === "approved_app_no_chapter");
    expect(issue).toBeTruthy();
    expect(issue!.repairable).toBe(true);
    expect(issue!.severity).toBe("danger");
    expect(issue!.title).toContain("Sam Lee");
  });

  it("flags an open support request with no action as repairable", async () => {
    mockPrisma.chapterSupportRequest.findMany.mockResolvedValue([
      { id: "sr1", title: "Need a room", chapterId: "chap-1", chapter: { name: "Austin" } },
    ]);
    const issues = await loadChapterIntegrityIssues();
    const issue = issues.find((i) => i.kind === "support_no_action");
    expect(issue).toBeTruthy();
    expect(issue!.repairable).toBe(true);
    expect(issue!.href).toBe("/admin/chapters/chap-1");
  });

  it("flags a chapter with no president (not auto-repairable)", async () => {
    // First chapter.findMany call = no-president check; later calls default [].
    mockPrisma.chapter.findMany
      .mockResolvedValueOnce([{ id: "chap-2", name: "Dallas" }])
      .mockResolvedValue([]);
    const issues = await loadChapterIntegrityIssues();
    const issue = issues.find((i) => i.kind === "chapter_no_president");
    expect(issue).toBeTruthy();
    expect(issue!.repairable).toBe(false);
  });

  it("flags duplicate chapters for one school", async () => {
    mockPrisma.chapter.groupBy.mockResolvedValue([
      { partnerSchool: "Lincoln High", _count: { _all: 2 } },
    ]);
    const issues = await loadChapterIntegrityIssues();
    const issue = issues.find((i) => i.kind === "duplicate_school");
    expect(issue).toBeTruthy();
    expect(issue!.title).toContain("Lincoln High");
  });

  it("tolerates a failing check without blanking the rest", async () => {
    mockPrisma.chapter.groupBy.mockRejectedValue(new Error("boom"));
    mockPrisma.chapterSupportRequest.findMany.mockResolvedValue([
      { id: "sr1", title: "Help", chapterId: "chap-1", chapter: { name: "Austin" } },
    ]);
    const issues = await loadChapterIntegrityIssues();
    expect(issues.some((i) => i.kind === "support_no_action")).toBe(true);
  });
});
