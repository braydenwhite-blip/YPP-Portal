/**
 * Canonical leadership-preview roster for the public-gate ship.
 *
 * These are the people actively testing People / Actions / Meetings before the
 * wider portal opens. Officer-tier roles alone are NOT enough — hiring chairs
 * and chapter presidents stay on the published hiring surfaces unless they are
 * on this roster or carry Officer+ on the org ladder (internalLevel ≥ 5).
 */

/** Verified @youthpassionproject.org accounts on the leadership ship. */
export const LEADERSHIP_PREVIEW_ROSTER_EMAILS = [
  "brayden.white@youthpassionproject.org",
  "anthea.zamir@youthpassionproject.org",
  "sanvi.mehta@youthpassionproject.org",
  "ian.dilorenzo@youthpassionproject.org",
] as const;

/**
 * Mentor first names granted leadership preview when their Prisma/Supabase name
 * matches (Sam / Zach are mentors who may not yet carry Officer on the ladder).
 */
export const LEADERSHIP_PREVIEW_ROSTER_FIRST_NAMES = ["sam", "zach"] as const;

export function isLeadershipRosterEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return LEADERSHIP_PREVIEW_ROSTER_EMAILS.some((entry) => entry === normalized);
}

export function isLeadershipRosterName(name: string | null | undefined): boolean {
  const first = name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (!first) return false;
  return (LEADERSHIP_PREVIEW_ROSTER_FIRST_NAMES as readonly string[]).includes(first);
}
