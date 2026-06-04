import { RoleType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  ACTIVE_MEMBER_ROLES,
  whereActiveMember,
  whereUserHasAnyRole,
  whereUserHasRole,
} from "@/lib/user-role-where";

describe("user-role-where", () => {
  it("builds a where clause for a single role", () => {
    expect(whereUserHasRole(RoleType.INSTRUCTOR)).toEqual({
      OR: [
        { primaryRole: RoleType.INSTRUCTOR },
        { roles: { some: { role: RoleType.INSTRUCTOR } } },
      ],
    });
  });

  it("builds a where clause for multiple roles without duplicates", () => {
    expect(
      whereUserHasAnyRole([
        RoleType.INSTRUCTOR,
        RoleType.MENTOR,
        RoleType.INSTRUCTOR,
      ])
    ).toEqual({
      OR: [
        { primaryRole: { in: [RoleType.INSTRUCTOR, RoleType.MENTOR] } },
        {
          roles: {
            some: {
              role: { in: [RoleType.INSTRUCTOR, RoleType.MENTOR] },
            },
          },
        },
      ],
    });
  });

  describe("whereActiveMember", () => {
    it("never matches on the APPLICANT role", () => {
      expect(ACTIVE_MEMBER_ROLES).not.toContain(RoleType.APPLICANT);

      const where = whereActiveMember();
      const json = JSON.stringify(where);
      expect(json).not.toContain(RoleType.APPLICANT);
    });

    it("includes every non-applicant role", () => {
      const expected = Object.values(RoleType).filter(
        (role) => role !== RoleType.APPLICANT
      );
      expect([...ACTIVE_MEMBER_ROLES].sort()).toEqual([...expected].sort());
    });

    it("matches members by primaryRole or a secondary role", () => {
      // A pure applicant (primaryRole APPLICANT, no member roles) satisfies
      // neither OR branch; a multi-role user (e.g. INSTRUCTOR + APPLICANT) does.
      expect(whereActiveMember()).toEqual({
        OR: [
          { primaryRole: { in: [...ACTIVE_MEMBER_ROLES] } },
          { roles: { some: { role: { in: [...ACTIVE_MEMBER_ROLES] } } } },
        ],
      });
    });
  });
});
