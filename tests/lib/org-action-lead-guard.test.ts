import { describe, expect, it } from "vitest";

import { resolvePersonAuthority, type PersonAuthority } from "@/lib/org/levels";
import {
  actionLeadIsEligible,
  actionNeedsOwner,
} from "@/lib/org/action-lead-guard";

function authority(internalLevel: number | null, partial: Partial<PersonAuthority> = {}): PersonAuthority {
  return { title: null, ladder: null, ladderLevel: null, internalLevel, source: "TITLE", ...partial };
}

describe("actionLeadIsEligible", () => {
  it("allows internal level >= 3", () => {
    expect(actionLeadIsEligible(resolvePersonAuthority({ title: "Lead Instructor" }))).toBe(true);
    expect(actionLeadIsEligible(resolvePersonAuthority({ title: "Director" }))).toBe(true);
  });

  it("blocks levels 1-2 unless an officer authorizes a Manager/Senior Manager", () => {
    const manager = resolvePersonAuthority({ title: "Manager" });
    expect(actionLeadIsEligible(manager)).toBe(false);
    expect(actionLeadIsEligible(manager, { authorizedByOfficer: true })).toBe(true);
  });

  it("does not extend the carve-out to a Senior Instructor", () => {
    const seniorInstructor = resolvePersonAuthority({ title: "Senior Instructor" });
    expect(actionLeadIsEligible(seniorInstructor, { authorizedByOfficer: true })).toBe(false);
  });
});

describe("actionNeedsOwner", () => {
  it("needs an owner when there is no lead", () => {
    expect(actionNeedsOwner({ hasLead: false, leadAuthority: null })).toBe(true);
  });

  it("needs an owner when the lead is not eligible", () => {
    expect(
      actionNeedsOwner({ hasLead: true, leadAuthority: authority(1, { ladder: "INSTRUCTION", ladderLevel: 1 }) })
    ).toBe(true);
  });

  it("is satisfied when the lead is eligible", () => {
    expect(actionNeedsOwner({ hasLead: true, leadAuthority: authority(3) })).toBe(false);
  });

  it("respects the officer-authorized Manager carve-out", () => {
    const manager = authority(1, { ladder: "LEADERSHIP", ladderLevel: 1 });
    expect(actionNeedsOwner({ hasLead: true, leadAuthority: manager })).toBe(true);
    expect(
      actionNeedsOwner({ hasLead: true, leadAuthority: manager, authorizedByOfficer: true })
    ).toBe(false);
  });
});
