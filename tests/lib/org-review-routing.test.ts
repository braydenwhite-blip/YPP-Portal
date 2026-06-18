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

function authority(internalLevel: number | null): PersonAuthority {
  return { title: null, ladder: null, ladderLevel: null, internalLevel, source: "TITLE" };
}

function participant(name: string, internalLevel: number | null): ReviewParticipant {
  return { ref: { name }, authority: authority(internalLevel) };
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
  it("needs author level + 1, capped at the top", () => {
    expect(requiredApproverLevel(authority(2))).toBe(3);
    expect(requiredApproverLevel(authority(7))).toBe(7);
    expect(requiredApproverLevel(authority(null))).toBeNull();
  });

  it("flags Board approval for Officer-and-above authors", () => {
    expect(requiresBoardApproval(authority(5))).toBe(true);
    expect(requiresBoardApproval(authority(6))).toBe(true);
    expect(requiresBoardApproval(authority(4))).toBe(false);
  });
});

describe("evaluateReviewApproval — proposal examples", () => {
  it("Senior Instructor draft → Lead Instructor approves", () => {
    const decision = evaluateReviewApproval({
      author: participant("Sahil", 2),
      approver: participant("Lina", 3),
      subject: { name: "Trainee" },
    });
    expect(decision.allowed).toBe(true);
    expect(decision.viaException).toBe(false);
  });

  it("Officer draft → Senior Officer approves; Senior Officer draft → Board approves", () => {
    expect(
      evaluateReviewApproval({
        author: participant("Officer A", 5),
        approver: participant("Senior Officer B", 6),
        subject: { name: "X" },
      }).allowed
    ).toBe(true);
    expect(
      evaluateReviewApproval({
        author: participant("Senior Officer B", 6),
        approver: participant("Board C", 7),
        subject: { name: "X" },
      }).allowed
    ).toBe(true);
  });

  it("Board draft → another (different) Board approves", () => {
    expect(
      evaluateReviewApproval({
        author: participant("Board One", 7),
        approver: participant("Board Two", 7),
        subject: { name: "X" },
      }).allowed
    ).toBe(true);
  });

  it("denies an equal-level approver below the top", () => {
    const decision = evaluateReviewApproval({
      author: participant("Peer A", 4),
      approver: participant("Peer B", 4),
      subject: { name: "X" },
    });
    expect(decision.allowed).toBe(false);
  });

  it("denies a mentor finalizing their own draft without an exception", () => {
    const decision = evaluateReviewApproval({
      author: participant("Dana", 6),
      approver: participant("Dana", 6),
      subject: { name: "Some Mentee" },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/cannot give final approval/i);
  });
});

describe("self-finalize exceptions (Sam / Zach)", () => {
  it("lets Sam finalize reviews for Aveena, Brayden, and Sanvi", () => {
    for (const mentee of ["Aveena", "Brayden", "Sanvi"]) {
      const decision = evaluateReviewApproval({
        author: participant("Sam", 6),
        approver: participant("Sam", 6),
        subject: { name: mentee },
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
        subject: { name: mentee },
      });
      expect(decision.allowed).toBe(true);
    }
  });

  it("does not extend Sam's exception to an unlisted mentee", () => {
    const decision = evaluateReviewApproval({
      author: participant("Sam", 6),
      approver: participant("Sam", 6),
      subject: { name: "Milo" },
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
    expect(
      evaluateReviewApproval({ author, approver, subject: author.ref }).allowed
    ).toBe(true);
  });
});
