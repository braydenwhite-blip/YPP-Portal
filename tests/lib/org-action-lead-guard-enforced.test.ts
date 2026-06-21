import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  assertActionLeadEligible,
  isActionLeadEligibilityEnforced,
} from "@/lib/org/action-lead-guard";

const mockFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    name: "Test User",
    title: null,
    primaryRole: "INSTRUCTOR",
    internalLevel: null,
    ladder: null,
    canonicalTitle: null,
    adminSubtypes: [],
    ...overrides,
  };
}

describe("isActionLeadEligibilityEnforced", () => {
  const original = process.env.ORG_ACTION_LEAD_ELIGIBILITY_ENFORCED;
  afterEach(() => {
    process.env.ORG_ACTION_LEAD_ELIGIBILITY_ENFORCED = original;
  });

  it("defaults ON and only the explicit kill-switch disables it", () => {
    delete process.env.ORG_ACTION_LEAD_ELIGIBILITY_ENFORCED;
    expect(isActionLeadEligibilityEnforced()).toBe(true);
    process.env.ORG_ACTION_LEAD_ELIGIBILITY_ENFORCED = "false";
    expect(isActionLeadEligibilityEnforced()).toBe(false);
    process.env.ORG_ACTION_LEAD_ELIGIBILITY_ENFORCED = "true";
    expect(isActionLeadEligibilityEnforced()).toBe(true);
  });
});

describe("assertActionLeadEligible — fail open even when enforced", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    process.env.ORG_ACTION_LEAD_ELIGIBILITY_ENFORCED = "true";
  });

  it("is a no-op when no internal level can be resolved (backfill window)", async () => {
    // primaryRole that the resolver cannot map → UNKNOWN authority, null level.
    mockFindUnique.mockResolvedValue(
      userRow({ primaryRole: "STUDENT", internalLevel: null })
    );
    await expect(assertActionLeadEligible("u1")).resolves.toBeUndefined();
  });

  it("is a no-op when the user cannot be loaded", async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(assertActionLeadEligible("missing")).resolves.toBeUndefined();
  });

  it("blocks an ineligible lead once the level is populated", async () => {
    mockFindUnique.mockResolvedValue(
      userRow({ internalLevel: 1, ladder: "INSTRUCTION", canonicalTitle: "Instructor" })
    );
    await expect(assertActionLeadEligible("u2")).rejects.toThrow(/cannot be the accountable Lead/);
  });

  it("allows an eligible lead (level >= 3)", async () => {
    mockFindUnique.mockResolvedValue(
      userRow({ internalLevel: 3, ladder: "INSTRUCTION", canonicalTitle: "Lead Instructor" })
    );
    await expect(assertActionLeadEligible("u3")).resolves.toBeUndefined();
  });
});
