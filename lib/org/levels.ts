/**
 * Org authority spine — internal levels, ladders, and the canonical title
 * taxonomy from the Roles/Mentorship/Reviews/Access proposal.
 *
 * Phase 0 of docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md. This module is PURE
 * (no DB, no I/O) so it can be unit-tested and consumed everywhere. It maps the
 * proposal's concepts onto the *existing* identity model (`primaryRole` +
 * free-text `title` + `adminSubtypes`) without any schema change. Once Phase 3
 * persists `internalLevel`/`ladder` columns, `resolvePersonAuthority` will read
 * those first; until then it derives them.
 *
 * Numbers are INTERNAL. UI renders titles; this module's integers only drive
 * approval / lead-eligibility / visibility / escalation math.
 */

import { normalizeAdminSubtypes } from "@/lib/admin-subtypes";
import { normalizeRoleValue } from "@/lib/role-utils";

export type Ladder = "INSTRUCTION" | "LEADERSHIP";

/** The top org-wide internal level (Board Member). */
export const TOP_INTERNAL_LEVEL = 7;

export const INSTRUCTION_TITLES = [
  "Instructor",
  "Senior Instructor",
  "Lead Instructor",
  "Chapter President",
] as const;

export const LEADERSHIP_TITLES = [
  "Manager",
  "Senior Manager",
  "Director",
  "Senior Director",
  "Officer",
  "Senior Officer",
  "Board Member",
] as const;

export type InstructionTitle = (typeof INSTRUCTION_TITLES)[number];
export type LeadershipTitle = (typeof LEADERSHIP_TITLES)[number];
export type CanonicalTitle = InstructionTitle | LeadershipTitle;

export interface TitleAuthority {
  title: CanonicalTitle;
  ladder: Ladder;
  /** Position within the title's own ladder (Instruction 1-4, Leadership 1-7). */
  ladderLevel: number;
  /**
   * Org-wide internal level (1-7) used for CROSS-ladder comparison (approval,
   * lead eligibility, visibility). This is the editable mapping flagged as an
   * open decision in the plan; the default below was approved with the plan.
   */
  internalLevel: number;
}

/**
 * Canonical title → authority. The `internalLevel` column is the org-wide scale.
 * Default mapping (approved): Instruction 1-4 and Leadership 1-7 share the same
 * integers, so comparisons are primarily meaningful *within* a ladder while
 * still being defined across ladders. Edit here to retune — no migration needed.
 */
export const TITLE_AUTHORITY: Record<CanonicalTitle, TitleAuthority> = {
  // Instruction ladder
  Instructor: { title: "Instructor", ladder: "INSTRUCTION", ladderLevel: 1, internalLevel: 1 },
  "Senior Instructor": { title: "Senior Instructor", ladder: "INSTRUCTION", ladderLevel: 2, internalLevel: 2 },
  "Lead Instructor": { title: "Lead Instructor", ladder: "INSTRUCTION", ladderLevel: 3, internalLevel: 3 },
  "Chapter President": { title: "Chapter President", ladder: "INSTRUCTION", ladderLevel: 4, internalLevel: 4 },
  // Leadership ladder
  Manager: { title: "Manager", ladder: "LEADERSHIP", ladderLevel: 1, internalLevel: 1 },
  "Senior Manager": { title: "Senior Manager", ladder: "LEADERSHIP", ladderLevel: 2, internalLevel: 2 },
  Director: { title: "Director", ladder: "LEADERSHIP", ladderLevel: 3, internalLevel: 3 },
  "Senior Director": { title: "Senior Director", ladder: "LEADERSHIP", ladderLevel: 4, internalLevel: 4 },
  Officer: { title: "Officer", ladder: "LEADERSHIP", ladderLevel: 5, internalLevel: 5 },
  "Senior Officer": { title: "Senior Officer", ladder: "LEADERSHIP", ladderLevel: 6, internalLevel: 6 },
  "Board Member": { title: "Board Member", ladder: "LEADERSHIP", ladderLevel: 7, internalLevel: 7 },
};

/** Case-insensitive aliases for free-text titles that mean a canonical title. */
const TITLE_ALIASES: Record<string, CanonicalTitle> = {
  board: "Board Member",
  "board member": "Board Member",
  "chapter president": "Chapter President",
  president: "Chapter President",
};

function canonicalKeyLookup(raw: string): CanonicalTitle | null {
  const want = raw.trim().toLowerCase();
  for (const title of Object.keys(TITLE_AUTHORITY) as CanonicalTitle[]) {
    if (title.toLowerCase() === want) return title;
  }
  return TITLE_ALIASES[want] ?? null;
}

/** Normalize a free-text title to the canonical taxonomy, or null if unknown. */
export function normalizeTitle(raw: string | null | undefined): CanonicalTitle | null {
  if (!raw || !raw.trim()) return null;
  return canonicalKeyLookup(raw);
}

export type AuthoritySource =
  | "PERSISTED"
  | "TITLE"
  | "ADMIN_SUBTYPE"
  | "PRIMARY_ROLE"
  | "UNKNOWN";

export interface PersonAuthority {
  title: CanonicalTitle | null;
  ladder: Ladder | null;
  ladderLevel: number | null;
  /** Org-wide internal level (1-7) or null when it cannot be determined. */
  internalLevel: number | null;
  /** Where the authority was resolved from (for "Why This Person Has Access"). */
  source: AuthoritySource;
}

const UNKNOWN_AUTHORITY: PersonAuthority = {
  title: null,
  ladder: null,
  ladderLevel: null,
  internalLevel: null,
  source: "UNKNOWN",
};

function authorityForTitle(title: CanonicalTitle, source: AuthoritySource): PersonAuthority {
  const meta = TITLE_AUTHORITY[title];
  return {
    title,
    ladder: meta.ladder,
    ladderLevel: meta.ladderLevel,
    internalLevel: meta.internalLevel,
    source,
  };
}

export interface AuthorityResolvable {
  title?: string | null;
  primaryRole?: string | null;
  adminSubtypes?: Array<string | null | undefined> | null;
  // Phase 3 persisted spine — preferred when present.
  internalLevel?: number | null;
  ladder?: Ladder | string | null;
  canonicalTitle?: string | null;
}

/**
 * Resolve a person's authority. Resolution order (first hit wins):
 *   0. the persisted Phase 3 spine (`internalLevel` + `ladder`/`canonicalTitle`),
 *   1. an explicit canonical `title`,
 *   2. an admin subtype (SUPER_ADMIN → Board Member, LEADERSHIP → Senior Officer),
 *   3. the `primaryRole` (CHAPTER_PRESIDENT, INSTRUCTOR, STAFF→Manager, ADMIN→Officer).
 *
 * The subtype/role derivations are provisional defaults documented in the plan;
 * an explicit `title` always overrides them, and the persisted columns override
 * everything once the Phase 3 backfill has populated them.
 */
export function resolvePersonAuthority(
  user: AuthorityResolvable | null | undefined
): PersonAuthority {
  if (!user) return UNKNOWN_AUTHORITY;

  // 0. Persisted spine wins when an internal level has been recorded.
  if (user.internalLevel != null) {
    const persistedTitle = normalizeTitle(user.canonicalTitle);
    const meta = persistedTitle ? TITLE_AUTHORITY[persistedTitle] : null;
    const ladder =
      user.ladder === "INSTRUCTION" || user.ladder === "LEADERSHIP"
        ? user.ladder
        : meta?.ladder ?? null;
    return {
      title: persistedTitle,
      ladder,
      ladderLevel: meta?.ladderLevel ?? null,
      internalLevel: user.internalLevel,
      source: "PERSISTED",
    };
  }

  const canonical = normalizeTitle(user.title);
  if (canonical) return authorityForTitle(canonical, "TITLE");

  const subtypes = normalizeAdminSubtypes(user.adminSubtypes ?? []);
  if (subtypes.includes("SUPER_ADMIN")) return authorityForTitle("Board Member", "ADMIN_SUBTYPE");
  if (subtypes.includes("LEADERSHIP")) return authorityForTitle("Senior Officer", "ADMIN_SUBTYPE");

  switch (normalizeRoleValue(user.primaryRole)?.toUpperCase()) {
    case "CHAPTER_PRESIDENT":
      return authorityForTitle("Chapter President", "PRIMARY_ROLE");
    case "INSTRUCTOR":
      return authorityForTitle("Instructor", "PRIMARY_ROLE");
    case "STAFF":
      return authorityForTitle("Manager", "PRIMARY_ROLE");
    case "ADMIN":
      return authorityForTitle("Officer", "PRIMARY_ROLE");
    default:
      return UNKNOWN_AUTHORITY;
  }
}

export interface LeadEligibility {
  eligible: boolean;
  reason: string;
}

/**
 * Action-lead eligibility per the proposal: a Lead must be internal level >= 3
 * on either ladder. Managers / Senior Managers (Leadership levels 1-2) may lead
 * only when explicitly authorized by an Officer or Board Member (or within their
 * assigned role — which the caller signals via `authorizedByOfficer`).
 */
export function canLeadAction(
  authority: PersonAuthority,
  opts: { authorizedByOfficer?: boolean } = {}
): LeadEligibility {
  const { internalLevel, ladder, ladderLevel } = authority;
  if (internalLevel == null) {
    return { eligible: false, reason: "No internal level could be determined." };
  }
  if (internalLevel >= 3) {
    return { eligible: true, reason: `Internal level ${internalLevel} (>= 3) can lead actions.` };
  }
  if (ladder === "LEADERSHIP" && (ladderLevel === 1 || ladderLevel === 2) && opts.authorizedByOfficer) {
    return {
      eligible: true,
      reason: "Manager/Senior Manager explicitly authorized by an Officer or Board Member.",
    };
  }
  return {
    eligible: false,
    reason: `Internal level ${internalLevel} is below 3 and not authorized to lead.`,
  };
}
