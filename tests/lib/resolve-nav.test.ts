import { describe, expect, it } from "vitest";
import { resolveNavModel } from "@/lib/navigation/resolve-nav";

function hrefs(model: ReturnType<typeof resolveNavModel>) {
  return model.visible.map((item) => item.href);
}

describe("resolveNavModel", () => {
  it("shows only the focused default instructor navigation", () => {
    const model = resolveNavModel({
      roles: ["INSTRUCTOR"],
      primaryRole: "INSTRUCTOR",
      pathname: "/",
      enabledFeatureKeys: new Set(),
    });

    const visibleHrefs = hrefs(model);

    expect(visibleHrefs).toContain("/");
    expect(visibleHrefs).toContain("/instructor-training");
    expect(visibleHrefs).toContain("/attendance");
    expect(visibleHrefs).toContain("/instructor/parent-feedback");
    expect(visibleHrefs).toContain("/mentorship");
    expect(visibleHrefs).toContain("/my-program/awards");
    expect(visibleHrefs).toContain("/messages");
    expect(visibleHrefs).toContain("/notifications");

    expect(visibleHrefs).not.toContain("/pathways");
    expect(visibleHrefs).not.toContain("/challenges");
    expect(visibleHrefs).not.toContain("/incubator");
    expect(visibleHrefs).not.toContain("/world");
    expect(visibleHrefs).not.toContain("/instructor/workspace");
    expect(visibleHrefs).not.toContain("/lesson-plans");
  });

  it("unlocks instructor teaching tools only when the feature key is enabled", () => {
    const model = resolveNavModel({
      roles: ["INSTRUCTOR"],
      primaryRole: "INSTRUCTOR",
      pathname: "/",
      enabledFeatureKeys: new Set(["INSTRUCTOR_TEACHING_TOOLS"]),
    });

    const visibleHrefs = hrefs(model);
    expect(visibleHrefs).toContain("/instructor/workspace");
    expect(visibleHrefs).toContain("/instructor/class-settings");
    expect(visibleHrefs).toContain("/lesson-plans");
    expect(visibleHrefs).toContain("/instructor/lesson-plans/templates");
    expect(visibleHrefs).toContain("/instructor/curriculum-builder");
    expect(visibleHrefs).toContain("/instructor/peer-observation");
  });

  it("keeps people and support visible for students before progression unlocks", () => {
    const model = resolveNavModel({
      roles: ["STUDENT"],
      primaryRole: "STUDENT",
      pathname: "/",
      unlockedSections: new Set(),
      enabledFeatureKeys: new Set(["ACTIVITY_HUB", "CHALLENGES", "INCUBATOR"]),
    });

    const visibleHrefs = hrefs(model);

    expect(visibleHrefs).toContain("/pathways");
    expect(visibleHrefs).toContain("/mentorship");
    expect(visibleHrefs).toContain("/check-in");
    expect(visibleHrefs).not.toContain("/challenges");
    expect(visibleHrefs).not.toContain("/incubator");
    expect(model.lockedGroups?.has("Challenges")).toBe(true);
    expect(model.lockedGroups?.has("Projects")).toBe(true);
    expect(model.lockedGroups?.has("Opportunities")).toBe(true);
    expect(model.lockedGroups?.has("People & Support")).toBe(false);
  });

  it("shows Passion World only when the feature key is enabled", () => {
    const hiddenModel = resolveNavModel({
      roles: ["STUDENT"],
      primaryRole: "STUDENT",
      pathname: "/",
      unlockedSections: new Set(),
      enabledFeatureKeys: new Set(["ACTIVITY_HUB", "CHALLENGES", "INCUBATOR"]),
    });

    const visibleModel = resolveNavModel({
      roles: ["STUDENT"],
      primaryRole: "STUDENT",
      pathname: "/",
      unlockedSections: new Set(),
      enabledFeatureKeys: new Set(["ACTIVITY_HUB", "CHALLENGES", "INCUBATOR", "PASSION_WORLD"]),
    });

    expect(hrefs(hiddenModel)).not.toContain("/world");
    expect(hrefs(visibleModel)).toContain("/world");
  });
});
