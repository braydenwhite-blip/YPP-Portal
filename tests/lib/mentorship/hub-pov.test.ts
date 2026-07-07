import { describe, expect, it } from "vitest";

import {
  availablePovs,
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

  it("chairs and admins get the mentor console even with zero mentees", () => {
    expect(availablePovs(viewer({ isChair: true }))).toContain("mentor");
    expect(availablePovs(viewer({ isAdmin: true }))).toContain("mentor");
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
