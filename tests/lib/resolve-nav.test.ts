import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveNavActiveHref, resolveNavModel } from "@/lib/navigation/resolve-nav";
import { INSTRUCTOR_V1_ALLOWED_HREFS } from "@/lib/navigation/instructor-v1-allowlist";
import { STUDENT_V1_ALLOWED_HREFS } from "@/lib/navigation/student-v1-allowlist";

// The regular Instructor program is paused in production; enable it for the
// nav-shape tests so the assertions cover the un-gated catalog.
const ORIGINAL_ENABLE_REGULAR_INSTRUCTOR = process.env.ENABLE_REGULAR_INSTRUCTOR;
beforeAll(() => {
  process.env.ENABLE_REGULAR_INSTRUCTOR = "true";
});
afterAll(() => {
  if (ORIGINAL_ENABLE_REGULAR_INSTRUCTOR === undefined) {
    delete process.env.ENABLE_REGULAR_INSTRUCTOR;
  } else {
    process.env.ENABLE_REGULAR_INSTRUCTOR = ORIGINAL_ENABLE_REGULAR_INSTRUCTOR;
  }
});

function hrefs(model: ReturnType<typeof resolveNavModel>) {
  return model.visible.map((item) => item.href);
}

describe("resolveNavActiveHref", () => {
  it("maps /profile to personalization when /profile is not in the nav", () => {
    const candidates = ["/settings/personalization", "/profile/timeline"];
    expect(resolveNavActiveHref("/profile", candidates)).toBe("/settings/personalization");
    expect(resolveNavActiveHref("/profile/edit", candidates)).toBe("/settings/personalization");
  });

  it("does not steal Journey: /profile/timeline stays on Journey", () => {
    const candidates = ["/settings/personalization", "/profile/timeline"];
    expect(resolveNavActiveHref("/profile/timeline", candidates)).toBe("/profile/timeline");
    expect(resolveNavActiveHref("/profile/timeline/step", candidates)).toBe("/profile/timeline");
  });

  it("highlights Assignments hub when viewing a class assignment under /curriculum/.../assignments", () => {
    const candidates = ["/my-classes", "/my-classes/assignments", "/curriculum"];
    expect(
      resolveNavActiveHref("/curriculum/offering-1/assignments/a1", candidates),
    ).toBe("/my-classes/assignments");
  });

  it("keeps /profile as its own active link when it appears in the nav", () => {
    const candidates = ["/profile", "/settings/personalization", "/profile/timeline"];
    expect(resolveNavActiveHref("/profile", candidates)).toBe("/profile");
  });
});

describe("resolveNavModel", () => {
  it("shows only the focused default instructor navigation", () => {
    const model = resolveNavModel({
      roles: ["INSTRUCTOR"],
      primaryRole: "INSTRUCTOR",
      pathname: "/",
      enabledFeatureKeys: new Set(),
      instructorFullPortalExplorer: false,
    });

    const visibleHrefs = hrefs(model);

    for (const href of visibleHrefs) {
      expect(INSTRUCTOR_V1_ALLOWED_HREFS.has(href)).toBe(true);
    }

    expect(visibleHrefs).toContain("/");
    expect(visibleHrefs).toContain("/instructor-training");
    expect(visibleHrefs).toContain("/instructor/lesson-design-studio");
    expect(visibleHrefs).toContain("/attendance");
    expect(visibleHrefs).toContain("/instructor/parent-feedback");
    expect(visibleHrefs).toContain("/feedback/anonymous");
    expect(visibleHrefs).toContain("/scheduling");
    expect(visibleHrefs).toContain("/announcements");
    expect(visibleHrefs).toContain("/calendar");
    expect(visibleHrefs).toContain("/my-mentor");
    expect(visibleHrefs).toContain("/messages");
    // `/chapters` (Find a Chapter) is consolidated into the Chapter Hub and
    // intentionally hidden from the sidebar — see ALWAYS_HIDDEN_HREFS.
    expect(visibleHrefs).not.toContain("/chapters");
    expect(visibleHrefs).toContain("/notifications");
    expect(visibleHrefs).toContain("/settings/personalization");

    expect(visibleHrefs).not.toContain("/interviews");
    expect(visibleHrefs).not.toContain("/my-program/awards");
    expect(visibleHrefs).not.toContain("/goals");
    expect(visibleHrefs).not.toContain("/reflection");
    expect(visibleHrefs).not.toContain("/events");
    expect(visibleHrefs).not.toContain("/profile/timeline");
    expect(visibleHrefs).not.toContain("/pathways");
    expect(visibleHrefs).not.toContain("/challenges");
    expect(visibleHrefs).not.toContain("/incubator");
    expect(visibleHrefs).not.toContain("/world");
    expect(visibleHrefs).not.toContain("/instructor/workspace");
    expect(visibleHrefs).not.toContain("/lesson-plans");
  });

  it("restores broad instructor navigation when full portal explorer is on", () => {
    const model = resolveNavModel({
      roles: ["INSTRUCTOR"],
      primaryRole: "INSTRUCTOR",
      pathname: "/",
      enabledFeatureKeys: new Set(),
      instructorFullPortalExplorer: true,
    });
    expect(hrefs(model)).toContain("/interviews");
    expect(hrefs(model)).toContain("/my-mentor");
    expect(hrefs(model)).not.toContain("/my-program");
    expect(hrefs(model)).not.toContain("/my-program/awards");
  });

  it("unlocks instructor teaching tools only when the feature key is enabled", () => {
    const model = resolveNavModel({
      roles: ["INSTRUCTOR"],
      primaryRole: "INSTRUCTOR",
      pathname: "/",
      enabledFeatureKeys: new Set(["INSTRUCTOR_TEACHING_TOOLS"]),
      instructorFullPortalExplorer: true,
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
      studentFullPortalExplorer: true,
    });

    const visibleHrefs = hrefs(model);

    expect(visibleHrefs).toContain("/pathways");
    expect(visibleHrefs).toContain("/my-program");
    expect(visibleHrefs).toContain("/check-in");
    expect(visibleHrefs).not.toContain("/challenges");
    expect(visibleHrefs).not.toContain("/incubator");
    expect(model.lockedGroups?.has("Challenges")).toBe(true);
    expect(model.lockedGroups?.has("Projects")).toBe(true);
    expect(model.lockedGroups?.has("Opportunities")).toBe(true);
    expect(model.lockedGroups?.has("People & Support")).toBe(false);
    expect(visibleHrefs).not.toContain("/mentorship");
    expect(visibleHrefs).not.toContain("/my-mentor");
  });

  it("hides People Strategy action tracker links when the tracker flag is off", () => {
    const model = resolveNavModel({
      roles: ["STAFF"],
      primaryRole: "STAFF",
      pathname: "/",
      actionTrackerEnabled: false,
    });

    const visibleHrefs = hrefs(model);
    expect(visibleHrefs).not.toContain("/my-actions");
    expect(visibleHrefs).not.toContain("/all-actions");
    expect(visibleHrefs).not.toContain("/officer-meetings");
  });

  it("shows My Actions to non-officers without exposing Officer-only action views", () => {
    const model = resolveNavModel({
      roles: ["STUDENT"],
      primaryRole: "STUDENT",
      pathname: "/",
      unlockedSections: new Set(),
      enabledFeatureKeys: new Set(),
      studentFullPortalExplorer: true,
      actionTrackerEnabled: true,
    });

    const visibleHrefs = hrefs(model);
    expect(visibleHrefs).toContain("/my-actions");
    expect(visibleHrefs).not.toContain("/all-actions");
    expect(visibleHrefs).not.toContain("/officer-meetings");
  });

  it("does not show Interviews in navigation for students (even with full portal explorer)", () => {
    const model = resolveNavModel({
      roles: ["STUDENT"],
      primaryRole: "STUDENT",
      pathname: "/",
      unlockedSections: new Set(),
      enabledFeatureKeys: new Set(),
      studentFullPortalExplorer: true,
    });
    expect(hrefs(model)).not.toContain("/interviews");
  });

  it("hides Join a chapter regardless of chapter assignment (consolidated under Chapter Hub)", () => {
    // `/join-chapter` is in ALWAYS_HIDDEN_HREFS — the destination still works
    // by URL but the sidebar surfaces Chapter Hub instead. The studentHasChapter
    // gate is preserved in resolve-nav for if/when product reverts that
    // consolidation, but for now the link should never appear in either branch.
    const withJoin = resolveNavModel({
      roles: ["STUDENT"],
      primaryRole: "STUDENT",
      pathname: "/",
      unlockedSections: new Set(),
      enabledFeatureKeys: new Set(),
      studentFullPortalExplorer: true,
    });
    expect(hrefs(withJoin)).not.toContain("/join-chapter");

    const withoutJoin = resolveNavModel({
      roles: ["STUDENT"],
      primaryRole: "STUDENT",
      pathname: "/",
      unlockedSections: new Set(),
      enabledFeatureKeys: new Set(),
      studentFullPortalExplorer: true,
      studentHasChapter: true,
    });
    expect(hrefs(withoutJoin)).not.toContain("/join-chapter");
  });

  it("restricts students to the v1 allowlist when full portal explorer is off", () => {
    const model = resolveNavModel({
      roles: ["STUDENT"],
      primaryRole: "STUDENT",
      pathname: "/",
      unlockedSections: new Set(),
      enabledFeatureKeys: new Set(["ACTIVITY_HUB", "CHALLENGES", "INCUBATOR", "PASSION_WORLD"]),
      studentFullPortalExplorer: false,
    });

    for (const href of hrefs(model)) {
      expect(STUDENT_V1_ALLOWED_HREFS.has(href)).toBe(true);
    }
    expect(hrefs(model)).not.toContain("/profile");
    expect(hrefs(model)).toContain("/settings/personalization");
    expect(hrefs(model)).toContain("/my-program");
    expect(hrefs(model)).toContain("/my-classes/assignments");
    expect(hrefs(model)).not.toContain("/join-chapter");
    expect(hrefs(model)).not.toContain("/world");
    expect(hrefs(model)).not.toContain("/challenges");
    expect(hrefs(model)).not.toContain("/interviews");
  });

  it("keeps admin users without subtypes on the reduced navigation allowlist", () => {
    const model = resolveNavModel({
      roles: ["ADMIN"],
      primaryRole: "ADMIN",
      pathname: "/",
      enabledFeatureKeys: new Set(),
    });

    const visibleHrefs = hrefs(model);
    expect(visibleHrefs).toContain("/");
    expect(visibleHrefs).toContain("/messages");
    expect(visibleHrefs).toContain("/notifications");
    expect(visibleHrefs).not.toContain("/admin");
    expect(visibleHrefs).not.toContain("/my-mentor");
    expect(visibleHrefs).not.toContain("/my-program");
    expect(visibleHrefs).not.toContain("/admin/instructor-applicants");
    expect(visibleHrefs).not.toContain("/admin/portal-rollout");
  });

  it("trims admin navigation to public-allowed routes when the public gate is active", () => {
    // The public gate applies to everyone, admins included. Until an admin
    // enters preview mode the layout passes publicGateActive=true, so only
    // public-allowed surfaces stay in the sidebar. The instructor applicant
    // board is on the public allowlist; bulk users and messages are not.
    const model = resolveNavModel({
      roles: ["ADMIN"],
      adminSubtypes: ["HIRING_ADMIN"],
      primaryRole: "ADMIN",
      pathname: "/",
      enabledFeatureKeys: new Set(),
      publicGateActive: true,
    });

    const visibleHrefs = hrefs(model);
    expect(visibleHrefs).toContain("/admin/instructor-applicants");
    expect(visibleHrefs).not.toContain("/admin/bulk-users");
    expect(visibleHrefs).not.toContain("/messages");
  });

  it("shows only application status for applicants in hiring demo mode", () => {
    const model = resolveNavModel({
      roles: ["APPLICANT"],
      primaryRole: "APPLICANT",
      pathname: "/application-status",
      hiringDemoMode: true,
    });

    expect(hrefs(model)).toEqual(["/application-status"]);
    expect(model.core.map((item) => item.href)).toEqual(["/application-status"]);
    expect(model.more).toEqual([]);
  });

  it("shows only the instructor applicants admin page in hiring demo mode", () => {
    const model = resolveNavModel({
      roles: ["ADMIN"],
      primaryRole: "ADMIN",
      pathname: "/admin/instructor-applicants",
      hiringDemoMode: true,
    });

    expect(hrefs(model)).toEqual(["/admin/instructor-applicants"]);
    expect(model.core.map((item) => item.href)).toEqual(["/admin/instructor-applicants"]);
    expect(model.more).toEqual([]);
  });

  it("unlocks only the approved admin pages for content admins", () => {
    const model = resolveNavModel({
      roles: ["ADMIN"],
      adminSubtypes: ["CONTENT_ADMIN"],
      primaryRole: "ADMIN",
      pathname: "/",
      enabledFeatureKeys: new Set(),
    });

    const visibleHrefs = hrefs(model);
    expect(visibleHrefs).toContain("/admin/curricula");
    expect(visibleHrefs).not.toContain("/admin/recruiting");
    expect(visibleHrefs).not.toContain("/admin/announcements");
  });

  it("preserves non-admin pathway access for multi-role users", () => {
    const model = resolveNavModel({
      roles: ["ADMIN", "MENTOR"],
      primaryRole: "ADMIN",
      adminSubtypes: ["MENTORSHIP_ADMIN"],
      pathname: "/",
      enabledFeatureKeys: new Set(),
    });

    expect(hrefs(model)).toContain("/mentorship");
    expect(hrefs(model)).toContain("/admin/mentorship");
    expect(hrefs(model)).not.toContain("/mentorship/reviews");
  });
});
