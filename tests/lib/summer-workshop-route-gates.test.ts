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

  it("keeps public gate allowlisting aligned with training module access", () => {
    expect(isAllowedPublicPath("/instructor-training")).toBe(true);
    expect(isAllowedPublicPath("/training/module-1")).toBe(true);
  });
});
