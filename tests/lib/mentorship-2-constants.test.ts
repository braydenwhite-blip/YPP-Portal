import { describe, expect, it } from "vitest";

import {
  APPLICATION_STATUS_TRANSITIONS,
  EXPERTISE_PROFICIENCIES,
  MENTORSHIP_APPLICATION_STATUSES,
  canTransitionApplication,
  expertiseProficiencyWeight,
  isExpertiseProficiency,
  isMentorshipApplicationStatus,
  isOpenApplicationStatus,
  isTerminalApplicationStatus,
  type MentorshipApplicationStatus,
} from "@/lib/mentorship-2/constants";

describe("mentorship-2 application status", () => {
  it("recognizes valid statuses and rejects junk", () => {
    expect(isMentorshipApplicationStatus("SUBMITTED")).toBe(true);
    expect(isMentorshipApplicationStatus("MATCHED")).toBe(true);
    expect(isMentorshipApplicationStatus("nonsense")).toBe(false);
    expect(isMentorshipApplicationStatus(null)).toBe(false);
    expect(isMentorshipApplicationStatus(42)).toBe(false);
  });

  it("classifies open vs terminal correctly and partitions all statuses", () => {
    expect(isOpenApplicationStatus("SUBMITTED")).toBe(true);
    expect(isOpenApplicationStatus("UNDER_REVIEW")).toBe(true);
    expect(isTerminalApplicationStatus("MATCHED")).toBe(true);
    expect(isTerminalApplicationStatus("DECLINED")).toBe(true);
    expect(isTerminalApplicationStatus("WITHDRAWN")).toBe(true);
    // every status is exactly one of open | terminal
    for (const status of MENTORSHIP_APPLICATION_STATUSES) {
      const open = isOpenApplicationStatus(status);
      const terminal = isTerminalApplicationStatus(status);
      expect(open).not.toBe(terminal);
    }
  });

  it("allows only legal forward transitions", () => {
    expect(canTransitionApplication("SUBMITTED", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionApplication("SUBMITTED", "MATCHED")).toBe(true);
    expect(canTransitionApplication("UNDER_REVIEW", "DECLINED")).toBe(true);
    expect(canTransitionApplication("SUBMITTED", "WITHDRAWN")).toBe(true);
  });

  it("forbids self-transitions and re-opening terminal applications", () => {
    expect(canTransitionApplication("SUBMITTED", "SUBMITTED")).toBe(false);
    expect(canTransitionApplication("MATCHED", "UNDER_REVIEW")).toBe(false);
    expect(canTransitionApplication("DECLINED", "SUBMITTED")).toBe(false);
    expect(canTransitionApplication("WITHDRAWN", "MATCHED")).toBe(false);
  });

  it("keeps terminal states truly terminal in the transition map", () => {
    const terminal: MentorshipApplicationStatus[] = [
      "MATCHED",
      "DECLINED",
      "WITHDRAWN",
    ];
    for (const status of terminal) {
      expect(APPLICATION_STATUS_TRANSITIONS[status]).toHaveLength(0);
    }
  });
});

describe("mentorship-2 expertise proficiency", () => {
  it("validates proficiency values", () => {
    expect(isExpertiseProficiency("EXPERT")).toBe(true);
    expect(isExpertiseProficiency("familiar")).toBe(false); // case-sensitive vocab
    expect(isExpertiseProficiency(undefined)).toBe(false);
  });

  it("weights proficiency monotonically and defaults unscored to a baseline", () => {
    expect(expertiseProficiencyWeight("FAMILIAR")).toBe(1);
    expect(expertiseProficiencyWeight("PROFICIENT")).toBe(2);
    expect(expertiseProficiencyWeight("EXPERT")).toBe(3);
    // unscored / unknown still contributes the baseline signal
    expect(expertiseProficiencyWeight(null)).toBe(1);
    expect(expertiseProficiencyWeight("???")).toBe(1);
    // strictly increasing across the ordered vocabulary
    const weights = EXPERTISE_PROFICIENCIES.map((p) => expertiseProficiencyWeight(p));
    for (let i = 1; i < weights.length; i += 1) {
      expect(weights[i]).toBeGreaterThan(weights[i - 1]);
    }
  });
});
