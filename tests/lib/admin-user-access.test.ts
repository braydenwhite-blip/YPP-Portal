import { AdminSubtype, RoleType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildUserAdminSubtypeRecords,
  buildUserRoleRecords,
  resolveUserAccessSelection,
} from "@/lib/admin-user-access";

describe("admin-user-access", () => {
  it("keeps the primary role even when it was not checked separately", () => {
    const access = resolveUserAccessSelection({
      primaryRoleRaw: RoleType.INSTRUCTOR,
      roleValues: [RoleType.MENTOR],
    });

    expect(access.primaryRole).toBe(RoleType.INSTRUCTOR);
    expect(access.roles).toEqual([RoleType.MENTOR, RoleType.INSTRUCTOR]);
  });

  it("adds the admin role automatically when admin subtypes are selected", () => {
    const access = resolveUserAccessSelection({
      primaryRoleRaw: RoleType.STAFF,
      roleValues: [RoleType.STAFF],
      adminSubtypeValues: [AdminSubtype.CONTENT_ADMIN],
    });

    expect(access.roles).toEqual([RoleType.STAFF, RoleType.ADMIN]);
    expect(access.adminSubtypes).toEqual([AdminSubtype.CONTENT_ADMIN]);
  });

  it("rejects a default owner subtype that is not also selected", () => {
    expect(() =>
      resolveUserAccessSelection({
        primaryRoleRaw: RoleType.ADMIN,
        roleValues: [RoleType.ADMIN],
        adminSubtypeValues: [AdminSubtype.CONTENT_ADMIN],
        defaultOwnerSubtypeRaw: AdminSubtype.HIRING_ADMIN,
      })
    ).toThrow("Default owner subtype must also be selected in admin subtypes.");
  });

  it("builds role and subtype records with the expected default owner flag", () => {
    expect(buildUserRoleRecords("user-1", [RoleType.ADMIN, RoleType.ADMIN, RoleType.STAFF])).toEqual([
      { userId: "user-1", role: RoleType.ADMIN },
      { userId: "user-1", role: RoleType.STAFF },
    ]);

    expect(
      buildUserAdminSubtypeRecords(
        "user-1",
        [AdminSubtype.CONTENT_ADMIN, AdminSubtype.HIRING_ADMIN],
        AdminSubtype.HIRING_ADMIN
      )
    ).toEqual([
      {
        userId: "user-1",
        subtype: AdminSubtype.CONTENT_ADMIN,
        isDefaultOwner: false,
      },
      {
        userId: "user-1",
        subtype: AdminSubtype.HIRING_ADMIN,
        isDefaultOwner: true,
      },
    ]);
  });
});
