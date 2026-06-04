import {
  ADMIN_SUBTYPE_LABELS,
  normalizeAdminSubtypes,
  type AdminSubtypeValue,
} from "@/lib/admin-subtypes";

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
 *   1. stored `title` (admin/self-edited free text),
 *   2. the admin-subtype label (e.g. CPO → "Leadership", "Hiring Admin"),
 *   3. a formatted `primaryRole` ("CHAPTER_PRESIDENT" → "Chapter President").
 */

export type TitleResolvable = {
  title?: string | null;
  primaryRole?: string | null;
  adminSubtypes?: Array<string | null | undefined> | null;
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
    "CPO",
    ...normalized,
  ];
  const pick = ordered.find((s) => normalized.includes(s)) ?? normalized[0];
  return ADMIN_SUBTYPE_LABELS[pick];
}

/** Resolve the best human title for a user. Never returns an empty string. */
export function getUserTitle(user: TitleResolvable | null | undefined): string {
  if (!user) return "Portal member";

  const stored = user.title?.trim();
  if (stored) return stored;

  // An ADMIN's subtype is the most meaningful label (Leadership, Hiring Admin…).
  const subtype = adminSubtypeLabel(user.adminSubtypes);
  if (subtype) return subtype;

  return formatRoleLabel(user.primaryRole ?? null);
}
