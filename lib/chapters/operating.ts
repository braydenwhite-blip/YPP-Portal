import { prisma } from "@/lib/prisma";

/**
 * Chapters currently open for hiring / applicant signup / analytics.
 * Keep this list in sync with real operating chapters (not historical rows).
 */
export const OPERATING_CHAPTERS = [
  { name: "The Bronx", city: "Bronx", region: "Northeast" },
  { name: "Scarsdale", city: "Scarsdale", region: "Northeast" },
  { name: "Lower Manhattan", city: "New York", region: "Northeast" },
  { name: "Brooklyn Bay Ridge", city: "Brooklyn", region: "Northeast" },
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

/** Alternate DB names we treat as the same operating chapter (avoid duplicates). */
function nameAliases(name: OperatingChapterName): string[] {
  switch (name) {
    case "The Bronx":
      return ["The Bronx", "Bronx"];
    case "Scarsdale":
      return ["Scarsdale"];
    case "Lower Manhattan":
      return ["Lower Manhattan", "Manhattan"];
    case "Brooklyn Bay Ridge":
      return ["Brooklyn Bay Ridge", "Bay Ridge", "Brooklyn"];
    default:
      return [name];
  }
}

/**
 * Idempotent: create any missing operating chapter and make sure it is public
 * and unarchived so it appears in filters and applicant dropdowns.
 */
export async function ensureOperatingChapters(): Promise<
  Array<{ id: string; name: string; isPublic: boolean }>
> {
  const results: Array<{ id: string; name: string; isPublic: boolean }> = [];

  for (const chapter of OPERATING_CHAPTERS) {
    const aliases = nameAliases(chapter.name);
    const existing = await prisma.chapter.findFirst({
      where: {
        OR: aliases.map((name) => ({ name })),
      },
      select: { id: true, name: true, isPublic: true, archivedAt: true, lifecycleStatus: true },
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
        select: { id: true, name: true, isPublic: true },
      });
      results.push(created);
      continue;
    }

    const needsRepair =
      !existing.isPublic ||
      existing.archivedAt != null ||
      existing.name !== chapter.name ||
      existing.lifecycleStatus === "PROSPECT";

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
          lifecycleStatus: "ACTIVE",
        },
        select: { id: true, name: true, isPublic: true },
      });
      results.push(updated);
    } else {
      results.push({
        id: existing.id,
        name: existing.name,
        isPublic: existing.isPublic,
      });
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

/** Infer an operating chapter from free text / legacy chapter names. */
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
  if (
    normalized === "lower manhattan" ||
    normalized === "manhattan" ||
    normalized.includes("lower manhattan") ||
    (normalized.includes("manhattan") && !normalized.includes("upper"))
  ) {
    return "Lower Manhattan";
  }
  if (
    normalized === "brooklyn bay ridge" ||
    normalized === "bay ridge" ||
    normalized.includes("bay ridge") ||
    normalized === "brooklyn" ||
    normalized.includes("brooklyn")
  ) {
    return "Brooklyn Bay Ridge";
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
        ? `${opts.label} requires an operating chapter.`
        : "Chapter must be an operating chapter."
    );
  }

  const operating = await ensureOperatingChapters();
  const match = operating.find((c) => c.id === chapterId);
  if (!match) {
    throw new Error(
      `Only ${OPERATING_CHAPTER_NAMES.join(", ")} are valid chapters.`
    );
  }
  return match.id;
}

export type UserChapterRepairRow = {
  userId: string;
  email: string;
  name: string | null;
  primaryRole: string;
  fromChapter: string | null;
  toChapter: string | null;
  reason: string;
};

/**
 * Remap users off archived / non-operating chapters onto an operating chapter.
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

    const inferred = inferOperatingChapterName(current?.name);
    const targetName = inferred && byName.has(inferred) ? inferred : null;

    if (!targetName) continue;

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
    const targetName = row.toChapter;
    if (!targetName) continue;
    const chapterId = byName.get(targetName);
    if (!chapterId) continue;
    await prisma.user.update({
      where: { id: row.userId },
      data: { chapterId },
    });
    updated += 1;
  }
  return updated;
}
