import { PRIMARY_ROLE_FALLBACK_ORDER } from "@/lib/navigation/core-map";
import type { NavRole } from "@/lib/navigation/types";
import type { DashboardRole } from "@/lib/dashboard/types";

const SUPPORTED_ROLES: DashboardRole[] = [
  "ADMIN",
  "CHAPTER_LEAD",
  "INSTRUCTOR",
  "MENTOR",
  "PARENT",
  "STAFF",
  "STUDENT",
];

function normalizeRole(value: string | null | undefined): DashboardRole | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  return SUPPORTED_ROLES.includes(normalized as DashboardRole)
    ? (normalized as DashboardRole)
    : null;
}

function normalizeRoles(values: string[] | null | undefined): DashboardRole[] {
  if (!values || values.length === 0) return [];
  const parsed = values
    .map((value) => normalizeRole(value))
    .filter((value): value is DashboardRole => value !== null);
  return Array.from(new Set(parsed));
}

function fallbackFromRoles(roles: DashboardRole[]): DashboardRole {
  for (const candidate of PRIMARY_ROLE_FALLBACK_ORDER as NavRole[]) {
    if (roles.includes(candidate as DashboardRole)) {
      return candidate as DashboardRole;
    }
  }
  return "STUDENT";
}

export function resolveDashboardRole(input: {
  primaryRole?: string | null;
  roles?: string[] | null;
}): DashboardRole {
  const primary = normalizeRole(input.primaryRole);
  if (primary) {
    return primary;
  }

  const normalizedRoles = normalizeRoles(input.roles);
  return fallbackFromRoles(normalizedRoles);
}
