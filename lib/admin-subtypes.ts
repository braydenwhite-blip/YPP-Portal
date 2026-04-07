import type { AdminSubtype } from "@prisma/client";

export const ADMIN_SUBTYPE_VALUES = [
  "SUPER_ADMIN",
  "HIRING_ADMIN",
  "MENTORSHIP_ADMIN",
  "INTAKE_ADMIN",
  "CONTENT_ADMIN",
  "COMMUNICATIONS_ADMIN",
] as const satisfies readonly AdminSubtype[];

export type AdminSubtypeValue = (typeof ADMIN_SUBTYPE_VALUES)[number];

export const ADMIN_SUBTYPE_LABELS: Record<AdminSubtypeValue, string> = {
  SUPER_ADMIN: "Super Admin",
  HIRING_ADMIN: "Hiring Admin",
  MENTORSHIP_ADMIN: "Mentorship Admin",
  INTAKE_ADMIN: "Intake Admin",
  CONTENT_ADMIN: "Content Admin",
  COMMUNICATIONS_ADMIN: "Communications Admin",
};

export function normalizeAdminSubtype(
  value: string | null | undefined
): AdminSubtypeValue | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return ADMIN_SUBTYPE_VALUES.includes(normalized as AdminSubtypeValue)
    ? (normalized as AdminSubtypeValue)
    : null;
}

export function normalizeAdminSubtypes(
  values: Array<string | null | undefined>
): AdminSubtypeValue[] {
  const normalized = values
    .map((value) => normalizeAdminSubtype(value))
    .filter((value): value is AdminSubtypeValue => value !== null);

  return Array.from(new Set(normalized));
}

export function getAdminSubtypeSet(
  values: Array<string | null | undefined> | undefined | null
): Set<AdminSubtypeValue> {
  return new Set(normalizeAdminSubtypes(values ?? []));
}

export function hasAdminSubtype(
  values: Array<string | null | undefined> | undefined | null,
  subtype: AdminSubtypeValue
): boolean {
  return getAdminSubtypeSet(values).has(subtype);
}

export function hasAnyAdminSubtype(
  values: Array<string | null | undefined> | undefined | null,
  subtypes: readonly AdminSubtypeValue[]
): boolean {
  const subtypeSet = getAdminSubtypeSet(values);
  return subtypes.some((subtype) => subtypeSet.has(subtype));
}

export function isSuperAdmin(
  values: Array<string | null | undefined> | undefined | null
): boolean {
  return hasAdminSubtype(values, "SUPER_ADMIN");
}

export function canAccessContentAdmin(
  values: Array<string | null | undefined> | undefined | null
): boolean {
  return hasAnyAdminSubtype(values, ["SUPER_ADMIN", "CONTENT_ADMIN"]);
}
