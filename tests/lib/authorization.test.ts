import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-supabase", () => ({
  getSessionUser: vi.fn(),
}));

import { getSessionUser } from "@/lib/auth-supabase";
import {
  hasAnyRole,
  normalizeRoleList,
  normalizeRoleSet,
  requireBoard,
  requireLeadership,
  requireOfficer,
} from "@/lib/authorization";

const mockGetSessionUser = vi.mocked(getSessionUser);

function mockSessionUser(overrides: {
  adminSubtypes?: string[];
  primaryRole?: string;
  roles?: string[];
}) {
  mockGetSessionUser.mockResolvedValue({
    id: "user_1",
    name: "Test User",
    email: "test@example.com",
    roles: overrides.roles ?? [],
    primaryRole: overrides.primaryRole ?? overrides.roles?.[0] ?? "STUDENT",
    chapterId: null,
    adminSubtypes: overrides.adminSubtypes ?? [],
  });
}

describe("authorization role helpers", () => {
  beforeEach(() => {
    mockGetSessionUser.mockReset();
  });

  it("builds a unified role set from the primary role and role entries", () => {
    expect(
      Array.from(
        normalizeRoleSet(
          ["INSTRUCTOR", { role: "ADMIN" }, "INSTRUCTOR"],
          "MENTOR"
        )
      )
    ).toEqual(["MENTOR", "INSTRUCTOR", "ADMIN"]);
  });

  it("treats the primary role as a valid role when checking access", () => {
    expect(hasAnyRole([], ["ADMIN"], "ADMIN")).toBe(true);
    expect(hasAnyRole([{ role: "MENTOR" }], ["ADMIN", "MENTOR"])).toBe(true);
    expect(hasAnyRole([], ["ADMIN"], "STUDENT")).toBe(false);
  });

  it("returns a normalized role list that includes the primary role", () => {
    expect(
      normalizeRoleList([{ role: "INSTRUCTOR" }], "CHAPTER_PRESIDENT")
    ).toEqual(["CHAPTER_PRESIDENT", "INSTRUCTOR"]);
  });

  it("allows CPO and board-equivalent admins through requireLeadership", async () => {
    mockSessionUser({ roles: ["ADMIN"], adminSubtypes: ["LEADERSHIP"] });
    await expect(requireLeadership()).resolves.toMatchObject({ id: "user_1" });

    mockSessionUser({ roles: ["ADMIN"], adminSubtypes: ["SUPER_ADMIN"] });
    await expect(requireLeadership()).resolves.toMatchObject({ id: "user_1" });
  });

  it("blocks non-CPO admins and non-admin users with a stray CPO subtype", async () => {
    mockSessionUser({ roles: ["ADMIN"], adminSubtypes: ["HIRING_ADMIN"] });
    await expect(requireLeadership()).rejects.toThrow("Unauthorized");

    mockSessionUser({ roles: ["STAFF"], adminSubtypes: ["LEADERSHIP"] });
    await expect(requireLeadership()).rejects.toThrow("Unauthorized");
  });

  it("allows only Board (ADMIN + SUPER_ADMIN) through requireBoard", async () => {
    mockSessionUser({ roles: ["ADMIN"], adminSubtypes: ["SUPER_ADMIN"] });
    await expect(requireBoard()).resolves.toMatchObject({ id: "user_1" });
  });

  it("blocks a plain CPO and non-admins from requireBoard (Board list is locked)", async () => {
    // A plain Leadership (no SUPER_ADMIN) must NOT reach the Board roll-up list.
    mockSessionUser({ roles: ["ADMIN"], adminSubtypes: ["LEADERSHIP"] });
    await expect(requireBoard()).rejects.toThrow("Unauthorized");

    // SUPER_ADMIN subtype without the ADMIN role does not pass either.
    mockSessionUser({ roles: ["STAFF"], adminSubtypes: ["SUPER_ADMIN"] });
    await expect(requireBoard()).rejects.toThrow("Unauthorized");
  });

  it("allows officer-tier users through requireOfficer", async () => {
    for (const role of ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"]) {
      mockSessionUser({ roles: [role] });
      await expect(requireOfficer()).resolves.toMatchObject({ id: "user_1" });
    }
  });

  it("blocks participant roles from requireOfficer", async () => {
    for (const role of ["STUDENT", "PARENT", "APPLICANT", "MENTOR", "INSTRUCTOR"]) {
      mockSessionUser({ roles: [role] });
      await expect(requireOfficer()).rejects.toThrow("Unauthorized");
    }
  });
});
