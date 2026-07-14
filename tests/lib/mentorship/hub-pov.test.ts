import { describe, expect, it } from "vitest";

import {
  availablePovs,
  isMenteeOnly,
  needsMentorshipRoleChooser,
  resolvePov,
  type HubViewerFacts,
} from "@/lib/mentorship/hub-pov";

function viewer(overrides: Partial<HubViewerFacts> = {}): HubViewerFacts {
  return {
    isMentee: false,
    isMentor: false,
    isAdmin: false,
    isChair: false,
    hasCommandCenterAccess: false,
    ...overrides,
  };
}

describe("availablePovs", () => {
  it("gives a mentee-only instructor just their own development", () => {
    expect(availablePovs(viewer({ isMentee: true }))).toEqual(["me"]);
  });

  it("gives a mentor the console, and both views when they are also mentored", () => {
    expect(availablePovs(viewer({ isMentor: true }))).toEqual(["mentor"]);
    expect(availablePovs(viewer({ isMentor: true, isMentee: true }))).toEqual([
      "me",
      "mentor",
    ]);
  });

  it("chairs (and committees) get the mentor console for queues; admins alone do not", () => {
    expect(availablePovs(viewer({ isChair: true }))).toContain("mentor");
    expect(availablePovs(viewer({ isCommitteeMember: true }))).toContain("mentor");
    expect(availablePovs(viewer({ isAdmin: true }))).not.toContain("mentor");
    expect(availablePovs(viewer({ isAdmin: true, isMentor: true }))).toContain("mentor");
  });

  it("admins and command-center access both unlock the admin POV", () => {
    // Parity with the old ADMIN-gated /admin/mentorship cockpit, which now
    // lives inside this POV.
    expect(availablePovs(viewer({ isAdmin: true }))).toContain("admin");
    expect(
      availablePovs(viewer({ isAdmin: false, hasCommandCenterAccess: true }))
    ).toContain("admin");
    expect(availablePovs(viewer({ isMentor: true }))).not.toContain("admin");
  });

  it("someone with no capabilities still gets their own development view", () => {
    expect(availablePovs(viewer())).toEqual(["me"]);
  });
});

describe("isMenteeOnly", () => {
  it("is true only when mentored and nothing else", () => {
    expect(isMenteeOnly(viewer({ isMentee: true }))).toBe(true);
    expect(isMenteeOnly(viewer({ isMentee: true, isMentor: true }))).toBe(false);
    expect(isMenteeOnly(viewer({ isMentee: true, isChair: true }))).toBe(false);
    expect(isMenteeOnly(viewer({ isMentee: true, isAdmin: true }))).toBe(false);
    expect(isMenteeOnly(viewer({ isMentee: true, isCommitteeMember: true }))).toBe(
      false
    );
    expect(
      isMenteeOnly(viewer({ isMentee: true, hasCommandCenterAccess: true }))
    ).toBe(false);
    expect(isMenteeOnly(viewer())).toBe(false);
  });
});

describe("needsMentorshipRoleChooser", () => {
  it("shows for everyone until a view is chosen", () => {
    expect(
      needsMentorshipRoleChooser(viewer({ isMentee: true, isMentor: true }), undefined)
    ).toBe(true);
    expect(needsMentorshipRoleChooser(viewer({ isMentor: true }), undefined)).toBe(
      true
    );
    expect(needsMentorshipRoleChooser(viewer({ isMentee: true }), undefined)).toBe(
      true
    );
    expect(needsMentorshipRoleChooser(viewer({ isAdmin: true }), undefined)).toBe(
      true
    );
  });

  it("hides once a view is chosen", () => {
    const dual = viewer({ isMentee: true, isMentor: true });
    expect(needsMentorshipRoleChooser(dual, "mentor")).toBe(false);
    expect(needsMentorshipRoleChooser(dual, "me")).toBe(false);
    expect(needsMentorshipRoleChooser(dual, "admin")).toBe(false);
  });
});

describe("resolvePov", () => {
  const leadership = viewer({
    isMentee: true,
    isMentor: true,
    isAdmin: true,
    hasCommandCenterAccess: true,
  });

  it("honors a requested view the viewer holds", () => {
    expect(resolvePov(leadership, "me")).toBe("me");
    expect(resolvePov(leadership, "mentor")).toBe("mentor");
    expect(resolvePov(leadership, "admin")).toBe("admin");
  });

  it("defaults to the most operational POV: admin, then mentor, then me", () => {
    expect(resolvePov(leadership, undefined)).toBe("admin");
    expect(resolvePov(viewer({ isMentee: true, isMentor: true }), undefined)).toBe(
      "mentor"
    );
    expect(resolvePov(viewer({ isMentee: true }), undefined)).toBe("me");
  });

  it("denies view=admin without command access", () => {
    expect(resolvePov(viewer({ isMentee: true, isMentor: true }), "admin")).toBe(
      "mentor"
    );
  });

  it("falls back on an unknown view param", () => {
    expect(resolvePov(leadership, "nonsense")).toBe("admin");
    expect(resolvePov(viewer({ isMentee: true }), "nonsense")).toBe("me");
  });
});
