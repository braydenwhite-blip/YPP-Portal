/**
 * Parse `subjectsOfInterest` for display tags.
 * Split on comma/semicolon only — never whitespace — so "Computer Science"
 * stays one tag.
 */
export function parseSubjectsOfInterest(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
