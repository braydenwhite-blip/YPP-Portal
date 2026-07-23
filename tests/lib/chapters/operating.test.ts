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

describe("operating chapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates The Bronx and Scarsdale when missing", async () => {
    findFirst.mockResolvedValue(null);
    create
      .mockResolvedValueOnce({ id: "bronx", name: "The Bronx" })
      .mockResolvedValueOnce({ id: "scarsdale", name: "Scarsdale" });

    const { ensureOperatingChapters, OPERATING_CHAPTER_NAMES } = await import(
      "@/lib/chapters/operating"
    );

    expect(OPERATING_CHAPTER_NAMES).toEqual(["The Bronx", "Scarsdale"]);

    const rows = await ensureOperatingChapters();
    expect(create).toHaveBeenCalledTimes(2);
    expect(rows.map((r) => r.name).sort()).toEqual(["Scarsdale", "The Bronx"]);
  });

  it("normalizes a short Bronx name to The Bronx", async () => {
    findFirst
      .mockResolvedValueOnce({
        id: "bronx",
        name: "Bronx",
        isPublic: true,
        archivedAt: null,
      })
      .mockResolvedValueOnce({
        id: "scarsdale",
        name: "Scarsdale",
        isPublic: true,
        archivedAt: null,
      });
    update.mockResolvedValue({ id: "bronx", name: "The Bronx" });

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
});
