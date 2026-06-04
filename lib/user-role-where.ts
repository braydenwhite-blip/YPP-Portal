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

/** Every role that signifies an active portal member (everything but APPLICANT). */
export const ACTIVE_MEMBER_ROLES: readonly RoleType[] = Object.values(
  RoleType
).filter((role) => role !== RoleType.APPLICANT);

/**
 * Active portal members: users who hold at least one non-APPLICANT role.
 *
 * Intentionally tests for "has a member role" rather than "lacks APPLICANT" so
 * a multi-role user (e.g. an INSTRUCTOR who once applied) still counts, while a
 * pure applicant — whose only role is APPLICANT — is excluded. Use this for any
 * people/member/assignee picker that must never surface applicants.
 */
export function whereActiveMember(): Prisma.UserWhereInput {
  return whereUserHasAnyRole(ACTIVE_MEMBER_ROLES);
}
