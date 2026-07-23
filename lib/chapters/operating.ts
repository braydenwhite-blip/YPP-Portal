import { prisma } from "@/lib/prisma";

/**
 * Chapters currently open for hiring / applicant signup.
 * Keep this list in sync with real operating chapters (not historical rows).
 */
export const OPERATING_CHAPTERS = [
  { name: "The Bronx", city: "Bronx", region: "Northeast" },
  { name: "Scarsdale", city: "Scarsdale", region: "Northeast" },
] as const;

export const OPERATING_CHAPTER_NAMES = OPERATING_CHAPTERS.map((c) => c.name);

/**
 * Idempotent: create any missing operating chapter and make sure it is public
 * and unarchived so it appears in filters and applicant dropdowns.
 */
export async function ensureOperatingChapters(): Promise<
  Array<{ id: string; name: string }>
> {
  const results: Array<{ id: string; name: string }> = [];

  for (const chapter of OPERATING_CHAPTERS) {
    const existing = await prisma.chapter.findFirst({
      where: {
        OR: [
          { name: chapter.name },
          // Accept a short name variant so we don't create a duplicate.
          ...(chapter.name === "The Bronx" ? [{ name: "Bronx" }] : []),
        ],
      },
      select: { id: true, name: true, isPublic: true, archivedAt: true },
    });

    if (!existing) {
      const created = await prisma.chapter.create({
        data: {
          name: chapter.name,
          city: chapter.city,
          region: chapter.region,
          isPublic: true,
          lifecycleStatus: "ACTIVE",
        },
        select: { id: true, name: true },
      });
      results.push(created);
      continue;
    }

    const needsRepair =
      !existing.isPublic ||
      existing.archivedAt != null ||
      existing.name !== chapter.name;

    if (needsRepair) {
      const updated = await prisma.chapter.update({
        where: { id: existing.id },
        data: {
          name: chapter.name,
          city: chapter.city,
          region: chapter.region,
          isPublic: true,
          archivedAt: null,
          archivedById: null,
        },
        select: { id: true, name: true },
      });
      results.push(updated);
    } else {
      results.push({ id: existing.id, name: existing.name });
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/** Active operating chapters for filter dropdowns (ensures rows exist first). */
export async function listOperatingChaptersForFilters(): Promise<
  Array<{ id: string; name: string; city: string | null; region: string | null }>
> {
  await ensureOperatingChapters();
  return prisma.chapter.findMany({
    where: {
      archivedAt: null,
      name: { in: [...OPERATING_CHAPTER_NAMES] },
    },
    select: { id: true, name: true, city: true, region: true },
    orderBy: { name: "asc" },
  });
}
