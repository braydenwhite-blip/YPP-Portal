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
    "/applications/instructor",
    "/application-status",
    "/instructor-training",
    "/instructor/workshop-design-studio",
    "/profile",
    "/settings",
    "/locked",
    "/preview",
    "/admin/external-applicants",
    "/admin/instructor-applicants",
    "/admin/chapter-president-applicants",
    "/chapter-lead/instructor-applicants",
  ];

  const GATED = [
    "/training/anything",
    "/admin",
    "/admin/action-center",
    "/admin/opportunities/123",
    "/admin/instructor-assignments/new",
    "/leadership-pathway",
    "/mentorship",
    "/mentorship/mentees/abc/gr",
    "/mentorship/schedule",
    "/my-mentor",
    // Re-hidden from the public gate: internal People-Strategy / ops, general
    // comms, and the AI help agent. Officers still reach these via role bypass
    // in proxy.ts; non-officers without a preview passcode get /locked.
    "/people",
    "/actions",
    "/meetings",
    "/operations",
    "/partners",
    "/messages",
    "/notifications",
    "/help-agent",
  ];

  it.each(ALLOWED)("allows %s through the public gate", (path) => {
    expect(isAllowedPublicPath(path)).toBe(true);
  });

  it.each(GATED)("redirects %s behind the public gate", (path) => {
    expect(isAllowedPublicPath(path)).toBe(false);
  });
});
