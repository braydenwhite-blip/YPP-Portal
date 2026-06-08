/**
 * People Strategy — Meeting category (YPP operating area) vocabulary.
 *
 * A meeting category is the YPP operating area a meeting belongs to (Leadership,
 * Classes, Mentorship, …). Like `ActionItem.actionType`, it is stored as a
 * loosely-typed string column (no Postgres enum) and validated here, so adding a
 * category never needs a migration. `null` is a valid value meaning "Other".
 *
 * Kept as a plain value module (no Prisma runtime, no "use server") so the client
 * forms, cards, filter bars, and the server actions can all share one source of
 * truth without bundling the Prisma client. The `hue` powers the calm, low-chroma
 * category color identity (oklch) used by the badges and the Department Pulse —
 * the exact hues come from the approved design.
 */

export const MEETING_CATEGORY_VALUES = [
  "LEADERSHIP",
  "CLASSES",
  "INSTRUCTORS",
  "APPLICATIONS",
  "MENTORSHIP",
  "CHAPTERS",
  "PARTNERSHIPS",
  "MARKETING",
  "TECHNOLOGY",
  "OPERATIONS",
  "FINANCE",
  "OTHER",
] as const;

export type MeetingCategory = (typeof MEETING_CATEGORY_VALUES)[number];

/** Human-readable labels for selectors, badges, and detail views. */
export const MEETING_CATEGORY_LABELS: Record<MeetingCategory, string> = {
  LEADERSHIP: "Leadership",
  CLASSES: "Classes",
  INSTRUCTORS: "Instructors",
  APPLICATIONS: "Applications",
  MENTORSHIP: "Mentorship",
  CHAPTERS: "Chapters",
  PARTNERSHIPS: "Partnerships",
  MARKETING: "Marketing",
  TECHNOLOGY: "Technology",
  OPERATIONS: "Operations",
  FINANCE: "Finance",
  OTHER: "Other",
};

export type MeetingCategoryIdentity = {
  /** Icon key (see components/people-strategy/meeting-icons.tsx). */
  icon: string;
  /** oklch hue (0–360) for the harmonized category color. */
  hue: number;
  /** Chroma multiplier — 0 makes "Other" a neutral gray. */
  chroma: number;
};

/**
 * Per-category visual identity: hues spread around the wheel at one shared
 * lightness/chroma so a page full of categories stays calm rather than chaotic.
 * Mirrors the design's `CATEGORIES` map exactly.
 */
export const MEETING_CATEGORY_IDENTITY: Record<MeetingCategory, MeetingCategoryIdentity> = {
  LEADERSHIP: { icon: "compass", hue: 270, chroma: 1 },
  CLASSES: { icon: "book", hue: 210, chroma: 1 },
  INSTRUCTORS: { icon: "presenter", hue: 190, chroma: 1 },
  APPLICATIONS: { icon: "inbox", hue: 160, chroma: 1 },
  MENTORSHIP: { icon: "people", hue: 140, chroma: 1 },
  CHAPTERS: { icon: "map", hue: 95, chroma: 1 },
  PARTNERSHIPS: { icon: "handshake", hue: 45, chroma: 1 },
  MARKETING: { icon: "megaphone", hue: 25, chroma: 1 },
  TECHNOLOGY: { icon: "code", hue: 300, chroma: 1 },
  OPERATIONS: { icon: "gear", hue: 245, chroma: 1 },
  FINANCE: { icon: "coin", hue: 130, chroma: 1 },
  OTHER: { icon: "dot", hue: 0, chroma: 0 },
};

/** Type guard: is `value` a known meeting category? */
export function isMeetingCategory(value: unknown): value is MeetingCategory {
  return (
    typeof value === "string" &&
    (MEETING_CATEGORY_VALUES as readonly string[]).includes(value)
  );
}

/** Label for a category string, falling back to OTHER then the raw value. */
export function meetingCategoryLabel(value: string | null | undefined): string {
  if (!value) return MEETING_CATEGORY_LABELS.OTHER;
  return (MEETING_CATEGORY_LABELS as Record<string, string>)[value] ?? value;
}

/** Visual identity for a category string, falling back to OTHER. */
export function meetingCategoryIdentity(
  value: string | null | undefined
): MeetingCategoryIdentity {
  if (value && isMeetingCategory(value)) return MEETING_CATEGORY_IDENTITY[value];
  return MEETING_CATEGORY_IDENTITY.OTHER;
}

/**
 * Harmonized oklch color set for a category — used by badges, the category dot,
 * and the Department Pulse bars. Pure, so it can be unit-tested and reused by
 * both server and client without importing Prisma.
 */
export type CategoryTone = { bg: string; border: string; fg: string; dot: string };

export function meetingCategoryTone(value: string | null | undefined): CategoryTone {
  const id = meetingCategoryIdentity(value);
  const ch = id.chroma;
  return {
    bg: `oklch(0.962 ${0.045 * ch} ${id.hue})`,
    border: `oklch(0.895 ${0.075 * ch} ${id.hue})`,
    fg: `oklch(0.46 ${0.12 * ch} ${id.hue})`,
    dot: `oklch(0.63 ${0.16 * ch} ${id.hue})`,
  };
}

export type ParsedMeetingCategory =
  | { ok: true; value: MeetingCategory | null }
  | { ok: false; error: string };

/**
 * Pure validator for a submitted category on CREATE. Empty / null → null (a
 * valid "Other"-ish untyped category). A non-empty value must be a known member.
 * Shared by the create Zod schema and unit-tested directly so the rule can never
 * drift.
 */
export function parseMeetingCategory(
  input: string | null | undefined
): ParsedMeetingCategory {
  const value = typeof input === "string" ? input.trim().toUpperCase() : "";
  if (!value) return { ok: true, value: null };
  if (!isMeetingCategory(value)) return { ok: false, error: "Unknown meeting category." };
  return { ok: true, value };
}
