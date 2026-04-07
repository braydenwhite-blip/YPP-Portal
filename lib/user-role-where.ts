import { Prisma, RoleType } from "@prisma/client";

export function whereUserHasRole(role: RoleType): Prisma.UserWhereInput {
  return {
    OR: [
      { primaryRole: role },
      { roles: { some: { role } } },
    ],
  };
}

export function whereUserHasAnyRole(
  roles: readonly RoleType[]
): Prisma.UserWhereInput {
  const uniqueRoles = Array.from(new Set(roles));

  if (uniqueRoles.length === 1) {
    return whereUserHasRole(uniqueRoles[0]);
  }

  return {
    OR: [
      { primaryRole: { in: uniqueRoles } },
      { roles: { some: { role: { in: uniqueRoles } } } },
    ],
  };
}
