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

export type OperatingChapterName = (typeof OPERATING_CHAPTERS)[number]["name"];

/** Roles that should always sit on an operating chapter (null is wrong). */
export const CHAPTER_REQUIRED_ROLES = [
  "CHAPTER_PRESIDENT",
  "INSTRUCTOR",
  "MENTOR",
  "STUDENT",
  "PARENT",
] as const;

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

/** Infer Bronx vs Scarsdale from free text / legacy chapter names. */
export function inferOperatingChapterName(
  hint: string | null | undefined
): OperatingChapterName | null {
  const normalized = (hint ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized === "the bronx" ||
    normalized === "bronx" ||
    normalized === "bx" ||
    normalized.includes("bronx")
  ) {
    return "The Bronx";
  }
  if (normalized === "scarsdale" || normalized.includes("scarsdale")) {
    return "Scarsdale";
  }
  return null;
}

/**
 * Throws unless `chapterId` is one of the current operating chapters.
 * Pass `allowNull` when network-wide accounts may clear chapter.
 */
export async function requireOperatingChapterId(
  chapterId: string | null | undefined,
  opts?: { allowNull?: boolean; label?: string }
): Promise<string | null> {
  if (!chapterId) {
    if (opts?.allowNull) return null;
    throw new Error(
      opts?.label
        ? `${opts.label} requires The Bronx or Scarsdale.`
        : "Chapter must be The Bronx or Scarsdale."
    );
  }

  const operating = await ensureOperatingChapters();
  const match = operating.find((c) => c.id === chapterId);
  if (!match) {
    throw new Error("Only The Bronx and Scarsdale are valid chapters.");
  }
  return match.id;
}

export type UserChapterRepairRow = {
  userId: string;
  email: string;
  name: string | null;
  primaryRole: string;
  fromChapter: string | null;
  toChapter: string;
  reason: string;
};

/**
 * Remap users off archived / non-operating chapters onto Bronx or Scarsdale.
 * Also assigns a default operating chapter when a chapter-required role has null.
 * Leaves ADMIN / STAFF / HIRING_CHAIR / APPLICANT null alone (network-wide OK).
 */
export async function planUserChapterRepairs(): Promise<{
  operating: Array<{ id: string; name: string }>;
  repairs: UserChapterRepairRow[];
}> {
  const operating = await ensureOperatingChapters();
  const byName = new Map(operating.map((c) => [c.name, c.id]));
  const operatingIds = new Set(operating.map((c) => c.id));
  const required = new Set<string>(CHAPTER_REQUIRED_ROLES);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      chapterId: true,
      chapter: { select: { id: true, name: true, archivedAt: true } },
    },
  });

  const repairs: UserChapterRepairRow[] = [];

  for (const user of users) {
    const current = user.chapter;
    const onOperating =
      user.chapterId != null &&
      operatingIds.has(user.chapterId) &&
      !current?.archivedAt;

    if (onOperating) continue;

    if (!user.chapterId) {
      if (!required.has(user.primaryRole)) continue;
      repairs.push({
        userId: user.id,
        email: user.email,
        name: user.name,
        primaryRole: user.primaryRole,
        fromChapter: null,
        toChapter: "Scarsdale",
        reason: "chapter-required role with no chapter",
      });
      continue;
    }

    const inferred =
      inferOperatingChapterName(current?.name) ??
      ("Scarsdale" as OperatingChapterName);
    const targetName = byName.has(inferred) ? inferred : "Scarsdale";

    repairs.push({
      userId: user.id,
      email: user.email,
      name: user.name,
      primaryRole: user.primaryRole,
      fromChapter: current?.name ?? user.chapterId,
      toChapter: targetName,
      reason: current?.archivedAt ? "archived chapter" : "non-operating chapter",
    });
  }

  return { operating, repairs };
}

export async function applyUserChapterRepairs(
  repairs: UserChapterRepairRow[]
): Promise<number> {
  if (repairs.length === 0) return 0;
  const operating = await ensureOperatingChapters();
  const byName = new Map(operating.map((c) => [c.name, c.id]));

  let updated = 0;
  for (const row of repairs) {
    const chapterId = byName.get(row.toChapter);
    if (!chapterId) continue;
    await prisma.user.update({
      where: { id: row.userId },
      data: { chapterId },
    });
    updated += 1;
  }
  return updated;
}
