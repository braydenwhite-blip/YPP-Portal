import {
  ADMIN_SUBTYPE_LABELS,
  normalizeAdminSubtypes,
  type AdminSubtypeValue,
} from "@/lib/admin-subtypes";
import { resolvePersonAuthority, type Ladder } from "@/lib/org/levels";

/**
 * People Strategy — canonical "what's this person's title?" resolver.
 *
 * Identity in this codebase is `primaryRole` (enum) + `roles` + `adminSubtypes`;
 * there was no human title, so the UI showed account *types* where a title
 * belongs (e.g. `CHAPTER_PRESIDENT` → "Chapter President"). Phase 4 adds a stored
 * `User.title` and centralizes the fallback chain here so every surface renders
 * the same label.
 *
 * Resolution order (first hit wins):
 *   1. the persisted org-ladder title (`canonicalTitle`/`internalLevel`, set via
 *      promotion or the backfill) — the official assigned title,
 *   2. stored `title` (admin/self-edited free text),
 *   3. the derived canonical title (admin-subtype/primaryRole via the org spine,
 *      e.g. ADMIN → "Officer", CHAPTER_PRESIDENT → "Chapter President"),
 *   4. a formatted `primaryRole` as a last resort.
 */

export type TitleResolvable = {
  title?: string | null;
  primaryRole?: string | null;
  adminSubtypes?: Array<string | null | undefined> | null;
  // Persisted org-authority spine — preferred when present.
  internalLevel?: number | null;
  ladder?: Ladder | string | null;
  canonicalTitle?: string | null;
};

/** Title-case an enum-style role string: `CHAPTER_PRESIDENT` → "Chapter President". */
export function formatRoleLabel(role: string | null | undefined): string {
  if (!role || !role.trim()) return "Portal member";
  return role
    .trim()
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** The single label for an admin-subtype set, or null when none apply. */
function adminSubtypeLabel(
  adminSubtypes: Array<string | null | undefined> | null | undefined
): string | null {
  const normalized: AdminSubtypeValue[] = normalizeAdminSubtypes(adminSubtypes ?? []);
  if (normalized.length === 0) return null;
  // Prefer the most senior signal (Leadership/Super Admin) when present, else
  // the first declared subtype — keeps the label deterministic.
  const ordered: AdminSubtypeValue[] = [
    "SUPER_ADMIN",
    "LEADERSHIP",
    ...normalized,
  ];
  const pick = ordered.find((s) => normalized.includes(s)) ?? normalized[0];
  return ADMIN_SUBTYPE_LABELS[pick];
}

/** Resolve the best human title for a user. Never returns an empty string. */
export function getUserTitle(user: TitleResolvable | null | undefined): string {
  if (!user) return "Portal member";

  const authority = resolvePersonAuthority(user);

  // 1. Persisted org-ladder title (set via promotion/backfill) is authoritative.
  if (authority.source === "PERSISTED" && authority.title) return authority.title;

  // 2. A human-set free-text title is the next most specific signal.
  const stored = user.title?.trim();
  if (stored) return stored;

  // 3. Canonical title derived from the spine (admin subtype / primaryRole),
  //    e.g. ADMIN → "Officer", CHAPTER_PRESIDENT → "Chapter President".
  if (authority.title) return authority.title;

  // 4. Legacy admin-subtype label, then a formatted primaryRole as a last resort.
  const subtype = adminSubtypeLabel(user.adminSubtypes);
  if (subtype) return subtype;

  return formatRoleLabel(user.primaryRole ?? null);
}
