import { describe, expect, it } from "vitest";

import {
  canAccessPeopleHub,
  isPeopleHubOfficerRoute,
} from "@/lib/people/hub-access";

describe("canAccessPeopleHub", () => {
  it("allows assigned officer-tier roles", () => {
    for (const primaryRole of [
      "ADMIN",
      "STAFF",
      "CHAPTER_PRESIDENT",
      "HIRING_CHAIR",
    ] as const) {
      expect(canAccessPeopleHub({ id: "u1", roles: [primaryRole], primaryRole })).toBe(
        true,
      );
    }
  });

  it("denies members and leadership preview pilots without officer roles", () => {
    expect(
      canAccessPeopleHub({
        id: "u1",
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
      }),
    ).toBe(false);
    expect(
      canAccessPeopleHub({
        id: "u1",
        roles: ["MENTOR"],
        primaryRole: "MENTOR",
      }),
    ).toBe(false);
    expect(
      canAccessPeopleHub({
        id: "u1",
        roles: ["STUDENT"],
        primaryRole: "STUDENT",
      }),
    ).toBe(false);
  });
});

describe("isPeopleHubOfficerRoute", () => {
  it("matches hub landing and static sub-routes", () => {
    expect(isPeopleHubOfficerRoute("/people")).toBe(true);
    expect(isPeopleHubOfficerRoute("/people/directory")).toBe(true);
    expect(isPeopleHubOfficerRoute("/people/check-ins")).toBe(true);
    expect(isPeopleHubOfficerRoute("/people/develop/abc")).toBe(true);
  });

  it("excludes per-person profile routes", () => {
    expect(isPeopleHubOfficerRoute("/people/clxyz123")).toBe(false);
    expect(isPeopleHubOfficerRoute("/people/uuid-profile-id")).toBe(false);
  });
});
