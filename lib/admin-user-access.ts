import { AdminSubtype, RoleType } from "@prisma/client";

import { validateEnum } from "@/lib/validate-enum";

export type ResolvedUserAccessSelection = {
  primaryRole: RoleType;
  roles: RoleType[];
  adminSubtypes: AdminSubtype[];
  defaultOwnerSubtype: AdminSubtype | null;
};

function uniqueValues<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function formatAccessLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveUserAccessSelection(input: {
  primaryRoleRaw: string;
  roleValues?: string[];
  adminSubtypeValues?: string[];
  defaultOwnerSubtypeRaw?: string | null;
}): ResolvedUserAccessSelection {
  const primaryRole = validateEnum(RoleType, input.primaryRoleRaw, "primaryRole");

  const selectedRoles = uniqueValues(
    (input.roleValues ?? []).map((value) =>
      validateEnum(RoleType, value, "role")
    )
  );
  const adminSubtypes = uniqueValues(
    (input.adminSubtypeValues ?? []).map((value) =>
      validateEnum(AdminSubtype, value, "adminSubtype")
    )
  );

  const roles = selectedRoles.length ? [...selectedRoles] : [primaryRole];
  if (!roles.includes(primaryRole)) {
    roles.push(primaryRole);
  }
  if (adminSubtypes.length > 0 && !roles.includes(RoleType.ADMIN)) {
    roles.push(RoleType.ADMIN);
  }

  const defaultOwnerSubtypeRaw = input.defaultOwnerSubtypeRaw?.trim() ?? "";
  const defaultOwnerSubtype = defaultOwnerSubtypeRaw
    ? validateEnum(AdminSubtype, defaultOwnerSubtypeRaw, "defaultOwnerSubtype")
    : null;

  if (defaultOwnerSubtype && !adminSubtypes.includes(defaultOwnerSubtype)) {
    throw new Error("Default owner subtype must also be selected in admin subtypes.");
  }

  return {
    primaryRole,
    roles,
    adminSubtypes,
    defaultOwnerSubtype,
  };
}

export function buildUserRoleRecords(userId: string, roles: RoleType[]) {
  return uniqueValues(roles).map((role) => ({
    userId,
    role,
  }));
}

export function buildUserAdminSubtypeRecords(
  userId: string,
  adminSubtypes: AdminSubtype[],
  defaultOwnerSubtype: AdminSubtype | null
) {
  return uniqueValues(adminSubtypes).map((subtype) => ({
    userId,
    subtype,
    isDefaultOwner: subtype === defaultOwnerSubtype,
  }));
}
