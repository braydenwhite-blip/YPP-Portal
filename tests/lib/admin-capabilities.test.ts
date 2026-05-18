/**
 * Behavior tests for lib/admin-capabilities.ts.
 *
 * Contract:
 *   - SUPER_ADMIN reaches every admin route (a true catch-all).
 *   - UNIVERSAL routes are reachable by any admin, even with no subtype.
 *   - An admin with no subtype is held to the universal set.
 *   - An admin with any subtype additionally gets the shared baseline.
 *   - Domain routes require the matching subtype; multiple subtypes union.
 *   - Unmapped paths fail open so new routes are never silently locked out.
 */
import { describe, it, expect } from "vitest";
import { canAccessAdminRoute, resolveAdminRouteDomain } from "@/lib/admin-capabilities";

describe("resolveAdminRouteDomain", () => {
  it("maps admin segments to their owning domain, ignoring sub-paths", () => {
    expect(resolveAdminRouteDomain("/admin/instructor-applicants")).toBe("HIRING_ADMIN");
    expect(resolveAdminRouteDomain("/admin/instructor-applicants/abc/review")).toBe("HIRING_ADMIN");
    expect(resolveAdminRouteDomain("/admin/course-library")).toBe("CONTENT_ADMIN");
    expect(resolveAdminRouteDomain("/admin/announcements")).toBe("COMMUNICATIONS_ADMIN");
    expect(resolveAdminRouteDomain("/admin/chapters")).toBe("UNIVERSAL");
    expect(resolveAdminRouteDomain("/admin/audit-log")).toBe("BASELINE");
    expect(resolveAdminRouteDomain("/admin")).toBe("BASELINE");
  });

  it("gates the participant-facing mentorship and intake surfaces", () => {
    expect(resolveAdminRouteDomain("/mentorship-program/reviews")).toBe("MENTORSHIP_ADMIN");
    expect(resolveAdminRouteDomain("/chapter/student-intake")).toBe("INTAKE_ADMIN");
  });

  it("returns null for non-gated and unmapped paths", () => {
    expect(resolveAdminRouteDomain("/dashboard")).toBeNull();
    expect(resolveAdminRouteDomain("/admin/some-future-tool")).toBeNull();
  });
});

describe("canAccessAdminRoute", () => {
  it("lets SUPER_ADMIN reach every domain", () => {
    for (const path of [
      "/admin/instructor-applicants",
      "/admin/course-library",
      "/admin/announcements",
      "/admin/audit-log",
      "/admin/chapters",
      "/mentorship-program/reviews",
    ]) {
      expect(canAccessAdminRoute(["SUPER_ADMIN"], path)).toBe(true);
    }
  });

  it("holds an admin with no subtype to the universal set", () => {
    expect(canAccessAdminRoute([], "/admin/chapters")).toBe(true);
    expect(canAccessAdminRoute([], "/admin/audit-log")).toBe(false);
    expect(canAccessAdminRoute([], "/admin/instructor-applicants")).toBe(false);
    expect(canAccessAdminRoute([], "/admin")).toBe(false);
  });

  it("grants the shared baseline to any admin with a subtype", () => {
    expect(canAccessAdminRoute(["HIRING_ADMIN"], "/admin/audit-log")).toBe(true);
    expect(canAccessAdminRoute(["CONTENT_ADMIN"], "/admin/analytics")).toBe(true);
    expect(canAccessAdminRoute(["CONTENT_ADMIN"], "/admin")).toBe(true);
  });

  it("restricts domain routes to the matching subtype", () => {
    expect(canAccessAdminRoute(["HIRING_ADMIN"], "/admin/recruiting")).toBe(true);
    expect(canAccessAdminRoute(["HIRING_ADMIN"], "/admin/course-library")).toBe(false);
    expect(canAccessAdminRoute(["CONTENT_ADMIN"], "/admin/recruiting")).toBe(false);
  });

  it("unions access across multiple subtypes", () => {
    const subtypes = ["HIRING_ADMIN", "CONTENT_ADMIN"];
    expect(canAccessAdminRoute(subtypes, "/admin/recruiting")).toBe(true);
    expect(canAccessAdminRoute(subtypes, "/admin/course-library")).toBe(true);
    expect(canAccessAdminRoute(subtypes, "/admin/announcements")).toBe(false);
  });

  it("fails open for unmapped admin routes", () => {
    expect(canAccessAdminRoute(["HIRING_ADMIN"], "/admin/some-future-tool")).toBe(true);
    expect(canAccessAdminRoute([], "/admin/some-future-tool")).toBe(true);
  });
});
