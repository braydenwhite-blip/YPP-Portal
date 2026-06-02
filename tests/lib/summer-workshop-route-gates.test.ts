import { describe, expect, it } from "vitest";

import {
  canBypassInstructorGate,
  isSummerWorkshopPermittedPath,
} from "@/lib/feature-flags";
import { isAllowedPublicPath } from "@/lib/public-gate";

describe("Summer Workshop route gates", () => {
  it("allows approved Summer Workshop instructors into the training hub and module pages", () => {
    expect(isSummerWorkshopPermittedPath("/instructor-training")).toBe(true);
    expect(isSummerWorkshopPermittedPath("/training/module-1")).toBe(true);
    expect(
      canBypassInstructorGate({
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
        instructorSubtype: "SUMMER_WORKSHOP",
        pathname: "/training/module-1",
      })
    ).toBe(true);
  });

  it("public gate allows the training hub but not per-module deep links", () => {
    expect(isAllowedPublicPath("/instructor-onboarding")).toBe(true);
    expect(isAllowedPublicPath("/instructor-training")).toBe(true);
    expect(isAllowedPublicPath("/training/module-1")).toBe(false);
  });
});

describe("Public portal gate allowlist", () => {
  const ALLOWED = [
    "/",
    "/login",
    "/signup",
    "/onboarding",
    "/instructor-onboarding",
    "/applications",
    "/applications/summer-workshop",
    "/application-status",
    "/instructor-training",
    "/instructor/workshop-design-studio",
    "/profile",
    "/settings",
    "/locked",
    "/preview",
  ];

  const GATED = [
    "/training/anything",
    "/admin",
    "/admin/action-center",
    "/admin/opportunities/123",
    "/admin/instructor-assignments/new",
    "/admin/external-applicants",
    "/leadership-pathway",
    "/mentorship",
    "/mentorship/mentees/abc/gr",
    "/mentorship/schedule",
    "/my-mentor",
    "/chapter-lead/instructor-applicants",
  ];

  it.each(ALLOWED)("allows %s through the public gate", (path) => {
    expect(isAllowedPublicPath(path)).toBe(true);
  });

  it.each(GATED)("redirects %s behind the public gate", (path) => {
    expect(isAllowedPublicPath(path)).toBe(false);
  });
});
