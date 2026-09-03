import { describe, expect, it, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const create = vi.fn();
const update = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chapter: {
      findFirst,
      create,
      update,
      findMany,
    },
  },
}));

const FIVE = [
  "Brooklyn Bay Ridge",
  "Frisco",
  "Lower Manhattan",
  "Scarsdale",
  "The Bronx",
];

describe("operating chapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("creates all five operating chapters when missing", async () => {
    findFirst.mockResolvedValue(null);
    create
      .mockResolvedValueOnce({ id: "bronx", name: "The Bronx", isPublic: true })
      .mockResolvedValueOnce({ id: "scarsdale", name: "Scarsdale", isPublic: true })
      .mockResolvedValueOnce({ id: "lm", name: "Lower Manhattan", isPublic: true })
      .mockResolvedValueOnce({ id: "bbr", name: "Brooklyn Bay Ridge", isPublic: true })
      .mockResolvedValueOnce({ id: "frisco", name: "Frisco", isPublic: true });

    const { ensureOperatingChapters, OPERATING_CHAPTER_NAMES } = await import(
      "@/lib/chapters/operating"
    );

    expect([...OPERATING_CHAPTER_NAMES].sort()).toEqual(FIVE);

    const rows = await ensureOperatingChapters();
    expect(create).toHaveBeenCalledTimes(5);
    expect(rows.map((r) => r.name).sort()).toEqual(FIVE);
  });

  it("normalizes a short Bronx name to The Bronx", async () => {
    findFirst
      .mockResolvedValueOnce({
        id: "bronx",
        name: "Bronx",
        isPublic: true,
        archivedAt: null,
        lifecycleStatus: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "scarsdale",
        name: "Scarsdale",
        isPublic: true,
        archivedAt: null,
        lifecycleStatus: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "lm",
        name: "Lower Manhattan",
        isPublic: true,
        archivedAt: null,
        lifecycleStatus: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "bbr",
        name: "Brooklyn Bay Ridge",
        isPublic: true,
        archivedAt: null,
        lifecycleStatus: "ACTIVE",
      })
      .mockResolvedValueOnce({
        id: "frisco",
        name: "Frisco",
        isPublic: true,
        archivedAt: null,
        lifecycleStatus: "ACTIVE",
      });
    update.mockResolvedValue({ id: "bronx", name: "The Bronx", isPublic: true });

    const { ensureOperatingChapters } = await import("@/lib/chapters/operating");
    const rows = await ensureOperatingChapters();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bronx" },
        data: expect.objectContaining({ name: "The Bronx", isPublic: true }),
      }),
    );
    expect(rows.some((r) => r.name === "The Bronx")).toBe(true);
  });

  it("infers Lower Manhattan, Brooklyn Bay Ridge, and Frisco", async () => {
    const { inferOperatingChapterName } = await import("@/lib/chapters/operating");
    expect(inferOperatingChapterName("manhattan")).toBe("Lower Manhattan");
    expect(inferOperatingChapterName("Bay Ridge")).toBe("Brooklyn Bay Ridge");
    expect(inferOperatingChapterName("Brooklyn")).toBe("Brooklyn Bay Ridge");
    expect(inferOperatingChapterName("Frisco")).toBe("Frisco");
    expect(inferOperatingChapterName("Frisco, TX")).toBe("Frisco");
    expect(inferOperatingChapterName("frisco texas")).toBe("Frisco");
  });
});
