/**
 * Convert a database enum string to a human-readable label.
 * e.g. "BEHIND_SCHEDULE" → "Behind Schedule"
 *      "CHAPTER_LEAD"    → "Chapter Lead"
 *      "LEVEL_101"       → "Level 101"
 */
export function formatEnum(str: string): string {
  return str
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Strip a prefix from an enum value and format it.
 * e.g. formatEnumStripPrefix("LEVEL_101", "LEVEL_") → "101"
 */
export function formatEnumStripPrefix(str: string, prefix: string): string {
  const stripped = str.startsWith(prefix) ? str.slice(prefix.length) : str;
  return formatEnum(stripped);
}
