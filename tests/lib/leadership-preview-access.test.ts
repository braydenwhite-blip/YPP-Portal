import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canAccessActionsOnlyPreview,
  canAccessLeadershipPreviewStack,
  isLeadershipPilotEmail,
  isLeadershipPreviewAccessFromAuth,
  isLeadershipPreviewPath,
  isActionsOnlyPreviewAllowedPath,
  resetLeadershipPilotEmailCache,
} from "@/lib/leadership-preview-access";

describe("leadership-preview-access", () => {
  const originalPilotEmails = process.env.PORTAL_LEADERSHIP_PILOT_EMAILS;
  const originalActionsOnlyEmails = process.env.PORTAL_ACTIONS_ONLY_PREVIEW_EMAILS;

  beforeEach(() => {
    resetLeadershipPilotEmailCache();
    delete process.env.PORTAL_LEADERSHIP_PILOT_EMAILS;
    delete process.env.PORTAL_ACTIONS_ONLY_PREVIEW_EMAILS;
  });

  afterEach(() => {
    resetLeadershipPilotEmailCache();
    if (originalPilotEmails === undefined) {
      delete process.env.PORTAL_LEADERSHIP_PILOT_EMAILS;
    } else {
      process.env.PORTAL_LEADERSHIP_PILOT_EMAILS = originalPilotEmails;
    }
    if (originalActionsOnlyEmails === undefined) {
      delete process.env.PORTAL_ACTIONS_ONLY_PREVIEW_EMAILS;
    } else {
      process.env.PORTAL_ACTIONS_ONLY_PREVIEW_EMAILS = originalActionsOnlyEmails;
    }
  });

  it("recognizes leadership preview paths", () => {
    expect(isLeadershipPreviewPath("/people")).toBe(true);
    expect(isLeadershipPreviewPath("/actions/abc")).toBe(true);
    expect(isLeadershipPreviewPath("/applications")).toBe(false);
  });

  it("allows rostered leadership emails", () => {
    expect(
      canAccessLeadershipPreviewStack({
        email: "brayden.white@youthpassionproject.org",
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
      }),
    ).toBe(true);
  });

  it("allows ADMIN and STAFF platform officers", () => {
    expect(
      canAccessLeadershipPreviewStack({
        roles: ["ADMIN"],
        primaryRole: "ADMIN",
      }),
    ).toBe(true);
    expect(
      canAccessLeadershipPreviewStack({
        roles: ["STAFF"],
        primaryRole: "STAFF",
      }),
    ).toBe(true);
  });

  it("does not grant leadership preview to hiring chair alone", () => {
    expect(
      canAccessLeadershipPreviewStack({
        roles: ["HIRING_CHAIR"],
        primaryRole: "HIRING_CHAIR",
      }),
    ).toBe(false);
  });

  it("allows leadership ladder level 5+ without admin role", () => {
    expect(
      canAccessLeadershipPreviewStack({
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
        internalLevel: 5,
      }),
    ).toBe(true);
  });

  it("allows Sam and Zach by first name on the user record", () => {
    expect(
      canAccessLeadershipPreviewStack({
        name: "Sam Singer",
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
      }),
    ).toBe(true);
    expect(
      canAccessLeadershipPreviewStack({
        name: "Zach",
        roles: ["MENTOR"],
        primaryRole: "MENTOR",
      }),
    ).toBe(true);
  });

  it("merges extra pilot emails from env", () => {
    process.env.PORTAL_LEADERSHIP_PILOT_EMAILS = "extra.pilot@ypp.org";
    resetLeadershipPilotEmailCache();
    expect(isLeadershipPilotEmail("extra.pilot@ypp.org")).toBe(true);
    expect(
      canAccessLeadershipPreviewStack({
        email: "extra.pilot@ypp.org",
        roles: ["STUDENT"],
        primaryRole: "STUDENT",
      }),
    ).toBe(true);
  });

  it("reads mirrored metadata on the edge", () => {
    expect(
      isLeadershipPreviewAccessFromAuth(
        {
          name: "Sam Singer",
          roles: ["INSTRUCTOR"],
          primaryRole: "INSTRUCTOR",
        },
        "instructor@ypp.org",
      ),
    ).toBe(true);

    expect(
      isLeadershipPreviewAccessFromAuth(
        { roles: ["ADMIN"], primaryRole: "ADMIN", name: "Anthea Zamir" },
        "anthea.zamir@youthpassionproject.org",
      ),
    ).toBe(true);
  });

  it("honors the synced leadershipPreviewAccess flag", () => {
    expect(
      isLeadershipPreviewAccessFromAuth(
        { leadershipPreviewAccess: true, roles: ["STUDENT"], primaryRole: "STUDENT" },
        "student@example.com",
      ),
    ).toBe(true);
  });

  it("allows actions-only pilot emails from env", () => {
    process.env.PORTAL_ACTIONS_ONLY_PREVIEW_EMAILS = "actions.reviewer@ypp.org";
    resetLeadershipPilotEmailCache();
    expect(
      canAccessActionsOnlyPreview({
        email: "actions.reviewer@ypp.org",
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
      }),
    ).toBe(true);
    expect(
      canAccessLeadershipPreviewStack({
        email: "actions.reviewer@ypp.org",
        roles: ["ADMIN"],
        primaryRole: "ADMIN",
      }),
    ).toBe(false);
  });

  it("recognizes actions-only allowed paths", () => {
    expect(isActionsOnlyPreviewAllowedPath("/")).toBe(true);
    expect(isActionsOnlyPreviewAllowedPath("/actions")).toBe(true);
    expect(isActionsOnlyPreviewAllowedPath("/actions/abc")).toBe(true);
    expect(isActionsOnlyPreviewAllowedPath("/people")).toBe(false);
    expect(isActionsOnlyPreviewAllowedPath("/applications")).toBe(false);
  });

  it("allows legacy local-password sessions via roster email", () => {
    expect(
      isLeadershipPreviewAccessFromAuth(
        { roles: ["ADMIN"], primaryRole: "ADMIN" },
        "anthea.zamir@youthpassionproject.org",
      ),
    ).toBe(true);
  });
});
