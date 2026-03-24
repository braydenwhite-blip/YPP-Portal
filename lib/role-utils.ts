const LEGACY_ROLE_ALIASES: Record<string, string> = {
  CHAPTER_PRESIDENT: "CHAPTER_PRESIDENT",
};

export function normalizeRoleValue(role: string | null | undefined): string | null {
  if (!role) return null;
  const normalized = role.trim();
  if (!normalized) return null;
  return LEGACY_ROLE_ALIASES[normalized] ?? normalized;
}

export function normalizeRoleValues(
  roles: Array<string | null | undefined>
): string[] {
  const normalized = roles
    .map((role) => normalizeRoleValue(role))
    .filter((role): role is string => Boolean(role));

  return Array.from(new Set(normalized));
}

export function roleMatches(
  actualRole: string | null | undefined,
  expectedRole: string
): boolean {
  return normalizeRoleValue(actualRole) === normalizeRoleValue(expectedRole);
}
