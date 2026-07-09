import type { PersonAuthority } from "@/lib/org/levels";

/**
 * Maps a person's canonical authority (and, for titles the org authority
 * spine doesn't recognize, their raw free-text title) onto one of a G&R
 * template's rubric columns — e.g. "Senior Instructor", or one of the four
 * Global Leadership columns the rubric groups several titles into.
 *
 * This is deliberately NOT wired into `lib/org/levels.ts`'s `TITLE_AUTHORITY`:
 * that table's integers drive unrelated access-level math (approval routing,
 * lead eligibility, visibility) elsewhere, and the Global Leadership rubric
 * groups titles ("Director / Senior Director / Executive Director") that
 * don't all exist as canonical titles today (Executive Director, Regional
 * Director, and Senior Regional Director have no analog in TITLE_AUTHORITY).
 * Extending that table just to resolve a rubric column would carry blast
 * radius the rubric doesn't need. Column resolution here is informational
 * only — it can return null, in which case the reviewer picks the column
 * manually — and the chosen result is always snapshotted onto
 * MentorGoalReview.columnLabel at submit time, so a later promotion or a
 * change to this mapping never rewrites how a past review reads.
 */

const INSTRUCTOR_COLUMNS = ["Instructor", "Senior Instructor", "Lead Instructor"] as const;

const GLOBAL_LEADERSHIP_COLUMNS = [
  "Manager / Senior Manager",
  "Director / Senior Director / Executive Director",
  "Chapter President / Regional Director / Senior Regional Director",
  "Officer",
] as const;

/** Free-text title (case-insensitive) -> Global Leadership rubric column. */
const GLOBAL_LEADERSHIP_TITLE_TO_COLUMN: Record<string, (typeof GLOBAL_LEADERSHIP_COLUMNS)[number]> = {
  manager: "Manager / Senior Manager",
  "senior manager": "Manager / Senior Manager",
  director: "Director / Senior Director / Executive Director",
  "senior director": "Director / Senior Director / Executive Director",
  "executive director": "Director / Senior Director / Executive Director",
  "chapter president": "Chapter President / Regional Director / Senior Regional Director",
  "regional director": "Chapter President / Regional Director / Senior Regional Director",
  "senior regional director": "Chapter President / Regional Director / Senior Regional Director",
  officer: "Officer",
  "senior officer": "Officer",
  "board member": "Officer",
};

/**
 * Resolve the rubric column for a person, given their canonical authority
 * (from `resolvePersonAuthority()`) and, when available, their raw free-text
 * title (for titles the authority spine doesn't recognize at all).
 */
export function columnForAuthority(args: {
  roleType: "INSTRUCTOR" | "CHAPTER_PRESIDENT" | "GLOBAL_LEADERSHIP";
  authority: PersonAuthority;
  rawTitle?: string | null;
}): string | null {
  const { roleType, authority, rawTitle } = args;

  if (roleType === "INSTRUCTOR") {
    if (authority.title && (INSTRUCTOR_COLUMNS as readonly string[]).includes(authority.title)) {
      return authority.title;
    }
    return null;
  }

  if (roleType === "GLOBAL_LEADERSHIP") {
    const candidate = (authority.title ?? rawTitle ?? "").trim().toLowerCase();
    if (candidate && GLOBAL_LEADERSHIP_TITLE_TO_COLUMN[candidate]) {
      return GLOBAL_LEADERSHIP_TITLE_TO_COLUMN[candidate];
    }
    return null;
  }

  return null;
}
