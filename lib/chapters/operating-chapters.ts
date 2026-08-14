/**
 * Pure operating-chapter constants + name matching.
 * Safe for client and server — no Prisma. Server helpers that create/list
 * chapters live in `lib/chapters/operating.ts`.
 */

export const OPERATING_CHAPTERS = [
  { name: "The Bronx", city: "Bronx", region: "Northeast" },
  { name: "Scarsdale", city: "Scarsdale", region: "Northeast" },
  { name: "Lower Manhattan", city: "New York", region: "Northeast" },
  { name: "Brooklyn Bay Ridge", city: "Brooklyn", region: "Northeast" },
] as const;

export const OPERATING_CHAPTER_NAMES = OPERATING_CHAPTERS.map((c) => c.name);

export type OperatingChapterName = (typeof OPERATING_CHAPTERS)[number]["name"];

/** Alternate DB names we treat as the same operating chapter (avoid duplicates). */
export function operatingChapterNameAliases(name: OperatingChapterName): string[] {
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

/** Human-readable list for errors and placeholders. */
export function operatingChapterNamesList(joiner = ", "): string {
  return OPERATING_CHAPTER_NAMES.join(joiner);
}
