import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canAccessLeadershipPreviewStack,
  isLeadershipPilotEmail,
  isLeadershipPreviewAccessFromAuth,
  isLeadershipPreviewPath,
  resetLeadershipPilotEmailCache,
} from "@/lib/leadership-preview-access";

describe("leadership-preview-access", () => {
  const originalPilotEmails = process.env.PORTAL_LEADERSHIP_PILOT_EMAILS;

  beforeEach(() => {
    resetLeadershipPilotEmailCache();
    process.env.PORTAL_LEADERSHIP_PILOT_EMAILS = "sam@ypp.org,zach@ypp.org";
  });

  afterEach(() => {
    resetLeadershipPilotEmailCache();
    if (originalPilotEmails === undefined) {
      delete process.env.PORTAL_LEADERSHIP_PILOT_EMAILS;
    } else {
      process.env.PORTAL_LEADERSHIP_PILOT_EMAILS = originalPilotEmails;
    }
    vi.resetModules();
  });

  it("recognizes leadership preview paths", () => {
    expect(isLeadershipPreviewPath("/people")).toBe(true);
    expect(isLeadershipPreviewPath("/actions/abc")).toBe(true);
    expect(isLeadershipPreviewPath("/applications")).toBe(false);
  });

  it("allows officer-tier roles from Prisma/Supabase roles", () => {
    expect(
      canAccessLeadershipPreviewStack({
        roles: ["ADMIN"],
        primaryRole: "ADMIN",
      }),
    ).toBe(true);
    expect(
      canAccessLeadershipPreviewStack({
        roles: ["STUDENT"],
        primaryRole: "STUDENT",
      }),
    ).toBe(false);
  });

  it("allows leadership ladder level 5+ without officer role", () => {
    expect(
      canAccessLeadershipPreviewStack({
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
        internalLevel: 5,
      }),
    ).toBe(true);
  });

  it("allows Sam and Zach via pilot email env", () => {
    expect(isLeadershipPilotEmail("sam@ypp.org")).toBe(true);
    expect(
      canAccessLeadershipPreviewStack({
        email: "zach@ypp.org",
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
      }),
    ).toBe(true);
  });

  it("reads mirrored metadata on the edge", () => {
    expect(
      isLeadershipPreviewAccessFromAuth(
        {
          leadershipPreviewAccess: true,
          roles: ["STUDENT"],
          primaryRole: "STUDENT",
        },
        "student@ypp.org",
      ),
    ).toBe(true);

    expect(
      isLeadershipPreviewAccessFromAuth(
        { roles: ["ADMIN"], primaryRole: "ADMIN" },
        "admin@ypp.org",
      ),
    ).toBe(true);
  });
});
