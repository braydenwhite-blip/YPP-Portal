import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveNavActiveHref, resolveNavModel } from "@/lib/navigation/resolve-nav";
import { INSTRUCTOR_V1_ALLOWED_HREFS } from "@/lib/navigation/instructor-v1-allowlist";
import { STUDENT_V1_ALLOWED_HREFS } from "@/lib/navigation/student-v1-allowlist";

// The regular Instructor program is paused in production; enable it for the
// nav-shape tests so the assertions cover the un-gated catalog.
const ORIGINAL_ENABLE_REGULAR_INSTRUCTOR = process.env.ENABLE_REGULAR_INSTRUCTOR;
const ORIGINAL_PORTAL_SLIM_NAV = process.env.PORTAL_SLIM_NAV;
beforeAll(() => {
  process.env.ENABLE_REGULAR_INSTRUCTOR = "true";
  process.env.PORTAL_SLIM_NAV = "false";
});
afterAll(() => {
  if (ORIGINAL_ENABLE_REGULAR_INSTRUCTOR === undefined) {
    delete process.env.ENABLE_REGULAR_INSTRUCTOR;
  } else {
    process.env.ENABLE_REGULAR_INSTRUCTOR = ORIGINAL_ENABLE_REGULAR_INSTRUCTOR;
  }
  if (ORIGINAL_PORTAL_SLIM_NAV === undefined) {
    delete process.env.PORTAL_SLIM_NAV;
  } else {
    process.env.PORTAL_SLIM_NAV = ORIGINAL_PORTAL_SLIM_NAV;
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
    expect(visibleHrefs).toContain("/instructor-onboarding");
    expect(visibleHrefs).toContain("/instructor-training");
    expect(visibleHrefs).toContain("/instructor/lesson-design-studio");
    expect(visibleHrefs).toContain("/attendance");
    expect(visibleHrefs).toContain("/instructor/parent-feedback");
    expect(visibleHrefs).toContain("/feedback/anonymous");
    expect(visibleHrefs).toContain("/scheduling");
    expect(visibleHrefs).toContain("/announcements");
    expect(visibleHrefs).toContain("/calendar");
    expect(visibleHrefs).toContain("/my-mentor");
    expect(visibleHrefs).not.toContain("/messages");
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
    expect(visibleHrefs).not.toContain("/actions");
    expect(visibleHrefs).not.toContain("/actions/all");
    expect(visibleHrefs).not.toContain("/meetings");
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
    expect(visibleHrefs).toContain("/actions");
    expect(visibleHrefs).not.toContain("/actions/all");
    expect(visibleHrefs).not.toContain("/meetings");
  });

  it("never shows the retired Leadership Action Center nav entry (Phase 5 consolidation)", () => {
    // The legacy entry was removed from the catalog entirely; the People
    // Strategy Action Tracker (/actions/*) is now the single canonical surface.
    // It must not appear regardless of the (now-vestigial) legacy flag.
    for (const legacyActionCenterNavEnabled of [false, true]) {
      const model = resolveNavModel({
        roles: ["ADMIN"],
        adminSubtypes: ["SUPER_ADMIN"],
        primaryRole: "ADMIN",
        pathname: "/",
        actionTrackerEnabled: true,
        legacyActionCenterNavEnabled,
      });
      expect(hrefs(model)).not.toContain("/admin/action-center");
    }
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
    // Messages is a portal-wide core nav item (restored to match main when
    // merging the Actions hub redesign); subtype-less admins see it too.
    expect(visibleHrefs).toContain("/messages");
    expect(visibleHrefs).toContain("/notifications");
    // Knowledge OS V2: /admin is the universal admin home, so it stays
    // visible even for a subtype-less admin (the page itself filters
    // domain links by access).
    expect(visibleHrefs).toContain("/admin");
    expect(visibleHrefs).not.toContain("/my-mentor");
    expect(visibleHrefs).not.toContain("/my-program");
    expect(visibleHrefs).not.toContain("/admin/instructor-applicants");
    expect(visibleHrefs).not.toContain("/admin/portal-rollout");
  });

  it("pins People, Actions, and Meetings for admins even when publicGateActive is true", () => {
    const model = resolveNavModel({
      roles: ["ADMIN"],
      adminSubtypes: ["SUPER_ADMIN"],
      primaryRole: "ADMIN",
      pathname: "/",
      actionTrackerEnabled: true,
      operationsHubEnabled: true,
      publicGateActive: true,
    });

    const coreHrefs = model.core.map((item) => item.href);
    expect(coreHrefs).toContain("/people");
    expect(coreHrefs).toContain("/actions");
    // The canonical Meetings umbrella is the pinned front door.
    expect(coreHrefs).toContain("/meetings");
    // The retired Work hub is no longer pinned (or present at all).
    expect(coreHrefs).not.toContain("/work");
  });

  it("trims admin navigation to public-allowed routes when the public gate is active for non-officers", () => {
    const model = resolveNavModel({
      roles: ["INSTRUCTOR"],
      primaryRole: "INSTRUCTOR",
      pathname: "/",
      enabledFeatureKeys: new Set(),
      publicGateActive: true,
    });

    const visibleHrefs = hrefs(model);
    expect(visibleHrefs).not.toContain("/people");
    expect(visibleHrefs).not.toContain("/admin/bulk-users");
  });

  it("shows the full leadership sidebar for officers even when publicGateActive is true", () => {
    const model = resolveNavModel({
      roles: ["ADMIN"],
      adminSubtypes: ["HIRING_ADMIN"],
      primaryRole: "ADMIN",
      pathname: "/",
      enabledFeatureKeys: new Set(),
      actionTrackerEnabled: true,
      operationsHubEnabled: true,
      publicGateActive: true,
    });

    const visibleHrefs = hrefs(model);
    expect(visibleHrefs).toContain("/admin/instructor-applicants");
    expect(visibleHrefs).toContain("/people");
    expect(visibleHrefs).toContain("/admin/bulk-users");
  });

  describe("public preview slim nav legacy flag", () => {
    beforeAll(() => {
      process.env.PORTAL_SLIM_NAV = "true";
    });

    afterAll(() => {
      process.env.PORTAL_SLIM_NAV = "false";
    });

    it("keeps the full officer section nav for admins", () => {
      const model = resolveNavModel({
        roles: ["ADMIN"],
        adminSubtypes: ["SUPER_ADMIN"],
        primaryRole: "ADMIN",
        pathname: "/",
        actionTrackerEnabled: true,
        operationsHubEnabled: true,
        publicGateActive: true,
      });

      const visibleHrefs = hrefs(model);
      expect(visibleHrefs).toContain("/admin");
      expect(visibleHrefs).toContain("/admin/bulk-users");
      expect(visibleHrefs).toContain("/people");
      expect(visibleHrefs).toContain("/actions");
      // The single Meetings home is present; type-specific hubs are retired.
      expect(visibleHrefs).toContain("/meetings");
      expect(visibleHrefs).not.toContain("/actions/meetings");
      expect(visibleHrefs).not.toContain("/impact-meetings");
      expect(visibleHrefs).toContain("/operations/initiatives");
      // The retired Work hub and Command Center are gone from the nav entirely.
      expect(visibleHrefs).not.toContain("/work");
      expect(visibleHrefs).not.toContain("/command-center");
      expect(model.more.length).toBeGreaterThan(0);
      expect(model.core.map((item) => item.href)).toEqual([
        "/",
        "/people",
        "/actions",
        "/meetings",
        "/messages",
      ]);
    });

    it("keeps hiring-chair applicant routes inside the full officer catalog", () => {
      const model = resolveNavModel({
        roles: ["ADMIN"],
        adminSubtypes: ["HIRING_ADMIN"],
        primaryRole: "ADMIN",
        pathname: "/",
        actionTrackerEnabled: true,
        operationsHubEnabled: true,
        publicGateActive: true,
      });

      const visibleHrefs = hrefs(model);
      expect(visibleHrefs).toContain("/admin/instructor-applicants");
      expect(visibleHrefs).toContain("/admin/instructor-applicants/chair-queue");
      expect(visibleHrefs).toContain("/admin/bulk-users");
      expect(visibleHrefs).toContain("/admin");
      expect(model.more.length).toBeGreaterThan(0);
    });
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

describe("officer section navigation (9-section IA)", () => {
  function officerModel() {
    return resolveNavModel({
      roles: ["ADMIN"],
      adminSubtypes: ["SUPER_ADMIN"],
      primaryRole: "ADMIN",
      pathname: "/",
      actionTrackerEnabled: true,
      operationsHubEnabled: true,
    });
  }

  function groupOf(model: ReturnType<typeof resolveNavModel>, href: string): string | undefined {
    return model.visible.find((item) => item.href === href)?.group;
  }

  it("organizes the leadership sidebar into the eight object sections in order", () => {
    const model = officerModel();
    const sectionLabels = model.more.map((group) => group.label);
    expect(sectionLabels.slice(0, 8)).toEqual([
      "People",
      "Programs",
      "Meetings",
      "Actions",
      "Applicants",
      "Partners",
      "Chapters",
      "Admin",
    ]);
  });

  it("removes the Work hub, Command Center, and the old operating modes from the nav", () => {
    const model = officerModel();
    const visibleHrefs = hrefs(model);
    for (const retired of [
      "/work",
      "/command-center",
      "/work/queue",
      "/browse",
      "/decide",
      "/meet",
      "/review",
    ]) {
      expect(visibleHrefs).not.toContain(retired);
    }
    // No visible link should still be labelled "Work" or "Command Center".
    const labels = model.visible.map((item) => item.label);
    expect(labels).not.toContain("Work");
    expect(labels).not.toContain("Command Center");
  });

  it("keeps every object section reachable from the sidebar", () => {
    const model = officerModel();
    const visibleHrefs = hrefs(model);
    for (const href of [
      "/people",
      "/admin/instructor-applicants",
      "/admin/chapter-president-applicants",
      "/actions",
      "/meetings",
      "/follow-up",
      "/delegate",
      "/partners",
      "/admin/partners",
      "/admin/chapters",
      "/admin/chapter-reports",
      "/admin",
    ]) {
      expect(visibleHrefs).toContain(href);
    }
  });

  it("assigns each surface to the right object section", () => {
    const model = officerModel();
    expect(groupOf(model, "/people")).toBe("People");
    expect(groupOf(model, "/meetings")).toBe("Meetings");
    expect(groupOf(model, "/actions/meetings")).toBeUndefined();
    expect(groupOf(model, "/impact-meetings")).toBeUndefined();
    expect(groupOf(model, "/actions")).toBe("Actions");
    expect(groupOf(model, "/admin/instructor-applicants")).toBe("Applicants");
    expect(groupOf(model, "/partners")).toBe("Partners");
    expect(groupOf(model, "/admin/chapters")).toBe("Chapters");
    expect(groupOf(model, "/admin")).toBe("Admin");
  });
});

describe("chapter-president section navigation", () => {
  function cpModel() {
    return resolveNavModel({
      roles: ["CHAPTER_PRESIDENT"],
      primaryRole: "CHAPTER_PRESIDENT",
      pathname: "/",
      actionTrackerEnabled: true,
      operationsHubEnabled: true,
    });
  }

  it("gives chapter presidents the People/Programs/Meetings/Actions sections plus Chapter ops", () => {
    const model = cpModel();
    const visibleHrefs = model.visible.map((item) => item.href);
    // Cross-cutting object sections are now reachable for CPs.
    expect(visibleHrefs).toContain("/people");
    expect(visibleHrefs).toContain("/actions");
    expect(visibleHrefs).toContain("/meetings");
    expect(visibleHrefs).toContain("/mentorship");
    // Chapter operations stay.
    expect(visibleHrefs).toContain("/chapter");
    expect(visibleHrefs).toContain("/chapter/recruiting");
    // The Work hub and Command Center never leak in.
    expect(visibleHrefs).not.toContain("/work");
    expect(visibleHrefs).not.toContain("/command-center");

    const groupOf = (href: string) => model.visible.find((i) => i.href === href)?.group;
    expect(groupOf("/people")).toBe("People");
    expect(groupOf("/meetings")).toBe("Meetings");
    expect(groupOf("/actions")).toBe("Actions");
    expect(groupOf("/mentorship")).toBe("Programs");
  });
});
