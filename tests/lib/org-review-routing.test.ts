import { describe, expect, it } from "vitest";

import { resolvePersonAuthority, type PersonAuthority } from "@/lib/org/levels";
import {
  evaluateReviewApproval,
  hasApprovalLevelAuthority,
  requiredApproverLevel,
  requiresBoardApproval,
  type ReviewParticipant,
} from "@/lib/org/review-routing";
import { findSelfFinalizeException } from "@/lib/org/review-exceptions";

function authority(
  internalLevel: number | null,
  ladder: PersonAuthority["ladder"] = null
): PersonAuthority {
  return { title: null, ladder, ladderLevel: null, internalLevel, source: "TITLE" };
}

function participant(
  name: string,
  internalLevel: number | null,
  ladder: PersonAuthority["ladder"] = null
): ReviewParticipant {
  return { ref: { name }, authority: authority(internalLevel, ladder) };
}

describe("hasApprovalLevelAuthority", () => {
  it("requires a strictly higher level below the top", () => {
    expect(hasApprovalLevelAuthority(3, 2)).toBe(true);
    expect(hasApprovalLevelAuthority(2, 2)).toBe(false);
    expect(hasApprovalLevelAuthority(1, 2)).toBe(false);
  });

  it("allows Board-on-Board at the top level", () => {
    expect(hasApprovalLevelAuthority(7, 7)).toBe(true);
  });

  it("is false when a level is unknown", () => {
    expect(hasApprovalLevelAuthority(null, 2)).toBe(false);
    expect(hasApprovalLevelAuthority(5, null)).toBe(false);
  });
});

describe("requiredApproverLevel / requiresBoardApproval", () => {
  it("needs subject role + 1, capped at the top", () => {
    expect(requiredApproverLevel(authority(2))).toBe(3);
    expect(requiredApproverLevel(authority(7))).toBe(7);
    expect(requiredApproverLevel(authority(null))).toBeNull();
  });

  it("flags Board approval for Officer-and-above subjects", () => {
    expect(requiresBoardApproval(authority(5))).toBe(true);
    expect(requiresBoardApproval(authority(6))).toBe(true);
    expect(requiresBoardApproval(authority(4))).toBe(false);
  });
});

describe("evaluateReviewApproval — proposal examples", () => {
  it("approves when the approver is above the person being reviewed", () => {
    const decision = evaluateReviewApproval({
      author: participant("Sahil", 2),
      approver: participant("Lina", 2),
      subject: participant("Trainee", 1),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.viaException).toBe(false);
  });

  it("routes Officer and Senior Officer subjects to Board approval", () => {
    expect(
      evaluateReviewApproval({
        author: participant("Mentor A", 4),
        approver: participant("Senior Officer B", 6),
        subject: participant("Officer Subject", 5),
      }).allowed
    ).toBe(false);
    expect(
      evaluateReviewApproval({
        author: participant("Mentor A", 4),
        approver: participant("Board C", 7),
        subject: participant("Senior Officer Subject", 6),
      }).allowed
    ).toBe(true);
  });

  it("Board subject → another Board approves", () => {
    expect(
      evaluateReviewApproval({
        author: participant("Mentor", 7),
        approver: participant("Board Two", 7),
        subject: participant("Board Subject", 7),
      }).allowed
    ).toBe(true);
  });

  it("denies an equal-role approver below Board", () => {
    const decision = evaluateReviewApproval({
      author: participant("Mentor A", 2),
      approver: participant("Peer B", 4),
      subject: participant("Subject", 4),
    });
    expect(decision.allowed).toBe(false);
  });

  it("denies a mentor finalizing their own draft without an exception", () => {
    const decision = evaluateReviewApproval({
      author: participant("Dana", 6),
      approver: participant("Dana", 6),
      subject: participant("Some Mentee", 1),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/cannot give final approval/i);
  });
});

describe("Board approval review routes", () => {
  it("routes Aveena's listed mentees to Board approval", () => {
    const seniorOfficer = evaluateReviewApproval({
      author: participant("Aveena", 6),
      approver: participant("Senior Officer", 6),
      subject: participant("Jackson", 2),
    });
    expect(seniorOfficer.allowed).toBe(false);
    expect(seniorOfficer.reason).toMatch(/Board approval/i);

    const board = evaluateReviewApproval({
      author: participant("Aveena", 6),
      approver: participant("Board", 7),
      subject: participant("Jackson", 2),
    });
    expect(board.allowed).toBe(true);
  });

  it("routes Ian's review for Milo to Board approval", () => {
    expect(
      evaluateReviewApproval({
        author: participant("Ian", 4),
        approver: participant("Director", 4),
        subject: participant("Milo", 1),
      }).allowed
    ).toBe(false);
    expect(
      evaluateReviewApproval({
        author: participant("Ian", 4),
        approver: participant("Board", 7),
        subject: participant("Milo", 1),
      }).allowed
    ).toBe(true);
  });

  it("routes Brayden's top-instructor reviews to Board approval", () => {
    expect(
      evaluateReviewApproval({
        author: participant("Brayden", 6),
        approver: participant("Chapter President", 4),
        subject: participant("Lead Instructor", 3, "INSTRUCTION"),
      }).allowed
    ).toBe(false);
    expect(
      evaluateReviewApproval({
        author: participant("Brayden", 6),
        approver: participant("Board", 7),
        subject: participant("Lead Instructor", 3, "INSTRUCTION"),
      }).allowed
    ).toBe(true);
  });
});

describe("self-finalize exceptions (Sam / Zach)", () => {
  it("lets Sam finalize reviews for Aveena, Brayden, and Sanvi", () => {
    for (const mentee of ["Aveena", "Brayden", "Sanvi"]) {
      const decision = evaluateReviewApproval({
        author: participant("Sam", 6),
        approver: participant("Sam", 6),
        subject: participant(mentee, 5),
      });
      expect(decision.allowed).toBe(true);
      expect(decision.viaException).toBe(true);
    }
  });

  it("lets Zach finalize reviews for Ian and Anthea", () => {
    for (const mentee of ["Ian", "Anthea"]) {
      const decision = evaluateReviewApproval({
        author: participant("Zach", 6),
        approver: participant("Zach", 6),
        subject: participant(mentee, 5),
      });
      expect(decision.allowed).toBe(true);
    }
  });

  it("does not extend Sam's exception to an unlisted mentee", () => {
    const decision = evaluateReviewApproval({
      author: participant("Sam", 6),
      approver: participant("Sam", 6),
      subject: participant("Milo", 1),
    });
    expect(decision.allowed).toBe(false);
  });

  it("findSelfFinalizeException matches by name and respects the mentee list", () => {
    expect(findSelfFinalizeException({ name: "Sam" }, { name: "aveena" })).not.toBeNull();
    expect(findSelfFinalizeException({ name: "Sam" }, { name: "Ian" })).toBeNull();
  });
});

describe("resolvePersonAuthority integrates with routing", () => {
  it("a Chapter President can approve an Instructor's review", () => {
    const author: ReviewParticipant = {
      ref: { id: "i1", name: "Instructor" },
      authority: resolvePersonAuthority({ primaryRole: "INSTRUCTOR" }),
    };
    const approver: ReviewParticipant = {
      ref: { id: "cp1", name: "Prez" },
      authority: resolvePersonAuthority({ primaryRole: "CHAPTER_PRESIDENT" }),
    };
    const subject: ReviewParticipant = {
      ref: { id: "i1", name: "Instructor" },
      authority: resolvePersonAuthority({ primaryRole: "INSTRUCTOR" }),
    };
    expect(
      evaluateReviewApproval({ author, approver, subject }).allowed
    ).toBe(true);
  });
});

describe("evaluateReviewApproval — fail open while the spine is unpopulated", () => {
  it("allows (defers to existing checks) when the approver's level is unknown", () => {
    const decision = evaluateReviewApproval({
      approver: participant("Approver", null),
      author: participant("Author", 2),
      subject: participant("Mentee", 1),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toMatch(/not complete/i);
  });

  it("allows when the subject's role is unknown", () => {
    const decision = evaluateReviewApproval({
      approver: participant("Approver", 6),
      author: participant("Author", 2),
      subject: participant("Mentee", null),
    });
    expect(decision.allowed).toBe(true);
  });

  it("still enforces the role rule once the approver and subject are known", () => {
    const denied = evaluateReviewApproval({
      approver: participant("Approver", 2),
      author: participant("Author", null),
      subject: participant("Mentee", 3),
    });
    expect(denied.allowed).toBe(false);
  });
});
