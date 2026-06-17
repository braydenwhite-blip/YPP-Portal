import { describe, expect, it } from "vitest";

import {
  buildMentorshipPanel,
  mentorshipPairingFocus,
  type MentorshipPairingInput,
} from "@/lib/operations/entity-360";

function pairing(overrides: Partial<MentorshipPairingInput> = {}): MentorshipPairingInput {
  return {
    id: "ms-1",
    role: "mentor",
    partnerName: "Sam",
    partnerId: "mentee-1",
    cycleStage: "REFLECTION_SUBMITTED",
    kickoffCompleted: true,
    openCommitments: 2,
    nextSessionISO: "2026-06-20T15:00:00.000Z",
    ...overrides,
  };
}

describe("buildMentorshipPanel", () => {
  it("returns null when the person has no active pairings", () => {
    expect(buildMentorshipPanel([])).toBeNull();
  });

  it("maps a mentor pairing to its cycle label, focus, and href", () => {
    const panel = buildMentorshipPanel([pairing()]);
    expect(panel).not.toBeNull();
    const p = panel!.pairings[0];
    expect(p.cycleLabel).toBe("Review due");
    expect(p.nextFocus).toBe("Write the review");
    expect(p.openCommitments).toBe(2);
    expect(p.href).toBe("/admin/mentorship/relationships/ms-1");
  });

  it("frames the focus from the mentee's side too", () => {
    const panel = buildMentorshipPanel([
      pairing({ role: "mentee", cycleStage: "REFLECTION_DUE" }),
    ]);
    expect(panel!.pairings[0].nextFocus).toBe("Submit this month's reflection");
  });
});

describe("mentorshipPairingFocus", () => {
  it("leads with kickoff until it's done", () => {
    expect(mentorshipPairingFocus("mentor", "KICKOFF_PENDING", false)).toBe("Hold the kickoff");
    expect(mentorshipPairingFocus("mentee", "REFLECTION_DUE", false)).toBe("Get ready for kickoff");
  });

  it("reads APPROVED as on track", () => {
    expect(mentorshipPairingFocus("mentor", "APPROVED", true)).toBe("On track");
  });
});
