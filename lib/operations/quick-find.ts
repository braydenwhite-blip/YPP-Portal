import type { QuickFindEntry } from "./data-360-queries";

/**
 * Data 360 — Quick Find ranking. Pure client-side filtering over the page's
 * loaded index: prefix matches beat word-start matches beat substring matches,
 * ties broken alphabetically, capped for a readable dropdown.
 */
export function rankQuickFind(
  entries: QuickFindEntry[],
  query: string,
  limit = 8
): QuickFindEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: Array<{ entry: QuickFindEntry; score: number }> = [];
  for (const entry of entries) {
    const label = entry.label.toLowerCase();
    let score: number;
    if (label.startsWith(q)) score = 3;
    else if (label.split(/\s+/).some((w) => w.startsWith(q))) score = 2;
    else if (label.includes(q)) score = 1;
    else continue;
    scored.push({ entry, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label)
  );
  return scored.slice(0, limit).map((s) => s.entry);
}
