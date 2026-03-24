import { describe, expect, it } from "vitest";
import { assertReadinessAllowsPublish } from "@/lib/instructor-readiness";

describe("assertReadinessAllowsPublish", () => {
  it("allows publish when readiness is complete", () => {
    expect(() =>
      assertReadinessAllowsPublish({ baseReadinessComplete: true })
    ).not.toThrow();
  });

  it("blocks publish when readiness is incomplete", () => {
    expect(() =>
      assertReadinessAllowsPublish({ baseReadinessComplete: false })
    ).toThrow(
      "Publishing blocked. Complete required training modules and pass interview readiness first."
    );
  });
});
