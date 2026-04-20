import { describe, expect, it } from "vitest";
import {
  getHiringDemoHomeHref,
  isDemoAllowedPathname,
} from "@/lib/hiring-demo-mode";

describe("demo mode middleware allowlist", () => {
  it("allows applicant application status and curriculum prep routes", () => {
    expect(isDemoAllowedPathname("/application-status")).toBe(true);
    expect(isDemoAllowedPathname("/instructor/lesson-design-studio")).toBe(true);
    expect(
      isDemoAllowedPathname(
        "/instructor/lesson-design-studio/draft-1/setup"
      )
    ).toBe(true);
  });

  it("keeps non-demo training routes blocked", () => {
    expect(isDemoAllowedPathname("/instructor-training")).toBe(false);
    expect(isDemoAllowedPathname("/training/module-1")).toBe(false);
  });

  it("sends demo users to the right hiring home", () => {
    expect(getHiringDemoHomeHref({ primaryRole: "APPLICANT" })).toBe(
      "/application-status"
    );
    expect(getHiringDemoHomeHref({ primaryRole: "ADMIN" })).toBe(
      "/admin/instructor-applicants"
    );
    expect(getHiringDemoHomeHref({ primaryRole: "CHAPTER_PRESIDENT" })).toBe(
      "/chapter-lead/instructor-applicants"
    );
  });
});
