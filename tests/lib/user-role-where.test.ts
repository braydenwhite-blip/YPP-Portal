import { RoleType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { whereUserHasAnyRole, whereUserHasRole } from "@/lib/user-role-where";

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
});
