import { describe, it, expect } from "vitest";
import {
  curriculumPlaybookStatus,
  curriculumActor,
  curriculumSatisfiesLaunch,
  nextCurriculumStage,
  legacyInitialStage,
  legacySubmissionStatusForStage,
  curriculumNextStep,
  curriculumReviewOverdue,
  curriculumGlobalReviewOverdue,
  curriculumHoursWaiting,
  summarizeCurriculumReview,
  curriculumEvidenceStatus,
  curriculumEvidenceRow,
  curriculumReviewRecommendation,
  CURRICULUM_ACTION_AUTHORITY,
  type CurriculumRecord,
  type CurriculumApprovalStage,
} from "@/lib/chapters/curriculum-review";

const NOW = new Date("2026-06-24T12:00:00.000Z");

function curriculum(overrides: Partial<CurriculumRecord> = {}): CurriculumRecord {
  return {
    id: "c1",
    title: "Intro to Robotics",
    subject: "Robotics",
    instructorName: "Sam",
    status: null,
    approvalStage: "CP_REVIEW",
    submittedAt: new Date("2026-06-24T00:00:00.000Z"),
    reviewedAt: null,
    ...overrides,
  };
}

describe("curriculumPlaybookStatus", () => {
  it("uses the two-stage approval stage when present (authoritative)", () => {
    expect(curriculumPlaybookStatus({ approvalStage: "NOT_SUBMITTED" })).toBe("not_submitted");
    expect(curriculumPlaybookStatus({ approvalStage: "CP_REVIEW" })).toBe("cp_review");
    expect(curriculumPlaybookStatus({ approvalStage: "CP_REVISION_REQUESTED" })).toBe("cp_revision");
    expect(curriculumPlaybookStatus({ approvalStage: "CP_APPROVED" })).toBe("cp_approved");
    expect(curriculumPlaybookStatus({ approvalStage: "GLOBAL_REVIEW" })).toBe("global_review");
    expect(curriculumPlaybookStatus({ approvalStage: "GLOBAL_REVISION_REQUESTED" })).toBe("global_revision");
    expect(curriculumPlaybookStatus({ approvalStage: "FULLY_APPROVED" })).toBe("fully_approved");
  });

  it("falls back to the legacy single-stage submissionStatus when no approval row", () => {
    expect(curriculumPlaybookStatus({ status: "SUBMITTED" })).toBe("cp_review");
    expect(curriculumPlaybookStatus({ status: "NEEDS_REVISION" })).toBe("cp_revision");
    // legacy single-stage APPROVED is grandfathered to fully approved (no regression)
    expect(curriculumPlaybookStatus({ status: "APPROVED" })).toBe("fully_approved");
    expect(curriculumPlaybookStatus({ status: "DRAFT" })).toBe("not_submitted");
    expect(curriculumPlaybookStatus({ status: null })).toBe("not_submitted");
  });

  it("prefers the approval stage over legacy status", () => {
    expect(curriculumPlaybookStatus({ approvalStage: "CP_REVIEW", status: "APPROVED" })).toBe("cp_review");
  });
});

describe("curriculumSatisfiesLaunch — only a TRUE global approval counts", () => {
  it("CP approved does NOT satisfy launch readiness", () => {
    expect(curriculumSatisfiesLaunch({ approvalStage: "CP_APPROVED" })).toBe(false);
  });
  it("global review pending does NOT satisfy launch readiness", () => {
    expect(curriculumSatisfiesLaunch({ approvalStage: "GLOBAL_REVIEW" })).toBe(false);
  });
  it("fully approved satisfies launch readiness", () => {
    expect(curriculumSatisfiesLaunch({ approvalStage: "FULLY_APPROVED" })).toBe(true);
  });
  it("grandfathered legacy APPROVED satisfies launch readiness", () => {
    expect(curriculumSatisfiesLaunch({ status: "APPROVED" })).toBe(true);
  });
});

describe("nextCurriculumStage — the transition state machine", () => {
  it("walks the full happy path CP review → CP approved → global → fully approved", () => {
    expect(nextCurriculumStage("NOT_SUBMITTED", "submit_for_cp_review")).toBe("CP_REVIEW");
    expect(nextCurriculumStage("CP_REVIEW", "cp_approve")).toBe("CP_APPROVED");
    expect(nextCurriculumStage("CP_APPROVED", "send_to_global")).toBe("GLOBAL_REVIEW");
    expect(nextCurriculumStage("GLOBAL_REVIEW", "global_approve")).toBe("FULLY_APPROVED");
  });

  it("supports revision loops at both stages", () => {
    expect(nextCurriculumStage("CP_REVIEW", "cp_request_revision")).toBe("CP_REVISION_REQUESTED");
    expect(nextCurriculumStage("CP_REVISION_REQUESTED", "submit_for_cp_review")).toBe("CP_REVIEW");
    expect(nextCurriculumStage("GLOBAL_REVIEW", "global_request_revision")).toBe("GLOBAL_REVISION_REQUESTED");
    expect(nextCurriculumStage("GLOBAL_REVISION_REQUESTED", "submit_for_cp_review")).toBe("CP_REVIEW");
  });

  it("rejects out-of-order transitions", () => {
    // can't approve an already-approved curriculum
    expect(nextCurriculumStage("FULLY_APPROVED", "cp_approve")).toBeNull();
    // can't send to global before CP approval
    expect(nextCurriculumStage("CP_REVIEW", "send_to_global")).toBeNull();
    // global can't act before it's escalated
    expect(nextCurriculumStage("CP_APPROVED", "global_approve")).toBeNull();
    // can't CP-approve a not-yet-submitted curriculum
    expect(nextCurriculumStage("NOT_SUBMITTED", "cp_approve")).toBeNull();
  });
});

describe("action authority — who can do what", () => {
  it("instructors only (re)submit; CP owns stage 1; global owns stage 2", () => {
    expect(CURRICULUM_ACTION_AUTHORITY.submit_for_cp_review).toBe("author");
    expect(CURRICULUM_ACTION_AUTHORITY.cp_approve).toBe("chapter_president");
    expect(CURRICULUM_ACTION_AUTHORITY.cp_request_revision).toBe("chapter_president");
    expect(CURRICULUM_ACTION_AUTHORITY.send_to_global).toBe("chapter_president");
    expect(CURRICULUM_ACTION_AUTHORITY.global_approve).toBe("global_leadership");
    expect(CURRICULUM_ACTION_AUTHORITY.global_request_revision).toBe("global_leadership");
  });
});

describe("legacy stage mapping helpers", () => {
  it("legacyInitialStage maps a no-approval-row template's submissionStatus", () => {
    expect(legacyInitialStage("SUBMITTED")).toBe("CP_REVIEW");
    expect(legacyInitialStage("NEEDS_REVISION")).toBe("CP_REVISION_REQUESTED");
    expect(legacyInitialStage("APPROVED")).toBe("FULLY_APPROVED");
    expect(legacyInitialStage(null)).toBe("NOT_SUBMITTED");
  });

  it("legacySubmissionStatusForStage keeps the single-stage field coherent", () => {
    const cases: [CurriculumApprovalStage, string][] = [
      ["NOT_SUBMITTED", "DRAFT"],
      ["CP_REVIEW", "SUBMITTED"],
      ["CP_APPROVED", "SUBMITTED"],
      ["GLOBAL_REVIEW", "SUBMITTED"],
      ["CP_REVISION_REQUESTED", "NEEDS_REVISION"],
      ["GLOBAL_REVISION_REQUESTED", "NEEDS_REVISION"],
      ["FULLY_APPROVED", "APPROVED"],
    ];
    for (const [stage, expected] of cases) {
      expect(legacySubmissionStatusForStage(stage)).toBe(expected);
    }
  });
});

describe("curriculumActor / curriculumNextStep — who needs to act next", () => {
  it("routes each stage to the right actor", () => {
    expect(curriculumActor({ approvalStage: "CP_REVIEW" })).toBe("chapter_president");
    expect(curriculumActor({ approvalStage: "CP_REVISION_REQUESTED" })).toBe("instructor");
    expect(curriculumActor({ approvalStage: "CP_APPROVED" })).toBe("chapter_president");
    expect(curriculumActor({ approvalStage: "GLOBAL_REVIEW" })).toBe("global_leadership");
    expect(curriculumActor({ approvalStage: "FULLY_APPROVED" })).toBe("none");
  });

  it("gives the one recommended next move per stage", () => {
    expect(curriculumNextStep("cp_review").action).toBe("cp_approve");
    expect(curriculumNextStep("cp_approved").action).toBe("send_to_global");
    expect(curriculumNextStep("global_review").action).toBe("global_approve");
    expect(curriculumNextStep("fully_approved").action).toBeNull();
  });
});

describe("review SLAs", () => {
  it("CP review is overdue once a submission passes the 48-hour SLA", () => {
    const submitted50hAgo = new Date(NOW.getTime() - 50 * 60 * 60 * 1000);
    expect(curriculumReviewOverdue(curriculum({ submittedAt: submitted50hAgo }), NOW)).toBe(true);
  });
  it("CP review is not overdue within the SLA", () => {
    const submitted10hAgo = new Date(NOW.getTime() - 10 * 60 * 60 * 1000);
    expect(curriculumReviewOverdue(curriculum({ submittedAt: submitted10hAgo }), NOW)).toBe(false);
  });
  it("CP overdue only applies while in CP review", () => {
    const submitted50hAgo = new Date(NOW.getTime() - 50 * 60 * 60 * 1000);
    expect(
      curriculumReviewOverdue(curriculum({ approvalStage: "FULLY_APPROVED", submittedAt: submitted50hAgo }), NOW)
    ).toBe(false);
  });
  it("global review is overdue 48h after escalation", () => {
    const sent50hAgo = new Date(NOW.getTime() - 50 * 60 * 60 * 1000);
    const c = curriculum({ approvalStage: "GLOBAL_REVIEW", sentToGlobalAt: sent50hAgo });
    expect(curriculumGlobalReviewOverdue(c, NOW)).toBe(true);
    const sent10hAgo = new Date(NOW.getTime() - 10 * 60 * 60 * 1000);
    expect(curriculumGlobalReviewOverdue(curriculum({ approvalStage: "GLOBAL_REVIEW", sentToGlobalAt: sent10hAgo }), NOW)).toBe(false);
  });
});

describe("curriculumHoursWaiting", () => {
  it("reports whole hours since submission", () => {
    const submitted24hAgo = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(curriculumHoursWaiting(curriculum({ submittedAt: submitted24hAgo }), NOW)).toBe(24);
  });
  it("is 0 when never submitted", () => {
    expect(curriculumHoursWaiting(curriculum({ submittedAt: null }), NOW)).toBe(0);
  });
});

describe("summarizeCurriculumReview", () => {
  it("counts every stage and flags overdue CP reviews", () => {
    const submitted50hAgo = new Date(NOW.getTime() - 50 * 60 * 60 * 1000);
    const items = [
      curriculum({ id: "1", approvalStage: "CP_REVIEW", submittedAt: submitted50hAgo }), // overdue
      curriculum({ id: "2", approvalStage: "CP_REVIEW", submittedAt: new Date(NOW.getTime() - 60 * 60 * 1000) }), // fresh
      curriculum({ id: "3", approvalStage: "CP_REVISION_REQUESTED" }),
      curriculum({ id: "4", approvalStage: "CP_APPROVED" }),
      curriculum({ id: "5", approvalStage: "GLOBAL_REVIEW" }),
      curriculum({ id: "6", approvalStage: "GLOBAL_REVISION_REQUESTED" }),
      curriculum({ id: "7", approvalStage: "FULLY_APPROVED" }),
      curriculum({ id: "8", approvalStage: "NOT_SUBMITTED" }),
    ];
    const s = summarizeCurriculumReview(items, NOW);
    expect(s.total).toBe(8);
    expect(s.cpReviewNeeded).toBe(2);
    expect(s.cpReviewOverdue).toBe(1);
    expect(s.cpApproved).toBe(1);
    expect(s.globalReviewNeeded).toBe(1);
    expect(s.needsRevision).toBe(2); // cp_revision + global_revision
    expect(s.fullyApproved).toBe(1);
    expect(s.submittedEver).toBe(7);
    expect(s.byStatus.not_submitted).toBe(1);
    // back-compat aliases
    expect(s.reviewNeeded).toBe(s.cpReviewNeeded);
    expect(s.approved).toBe(s.fullyApproved);
  });
});

describe("curriculumEvidenceStatus / Row", () => {
  it("maps stage to the three-way health", () => {
    expect(curriculumEvidenceStatus({ approvalStage: "FULLY_APPROVED" })).toBe("ready");
    expect(curriculumEvidenceStatus({ approvalStage: "CP_REVIEW" })).toBe("needs_feedback");
    expect(curriculumEvidenceStatus({ approvalStage: "CP_APPROVED" })).toBe("needs_feedback");
    expect(curriculumEvidenceStatus({ approvalStage: "GLOBAL_REVIEW" })).toBe("needs_feedback");
    expect(curriculumEvidenceStatus({ approvalStage: "NOT_SUBMITTED" })).toBe("not_started");
  });

  it("builds a row showing the precise stage and who acts next", () => {
    expect(curriculumEvidenceRow(curriculum())).toMatchObject({
      title: "Intro to Robotics",
      subject: "Robotics",
      stage: "CP Review",
      actor: "Chapter President",
      owner: "Sam",
      status: "needs_feedback",
    });
  });

  it("labels an ownerless curriculum Unassigned", () => {
    expect(curriculumEvidenceRow(curriculum({ instructorName: null })).owner).toBe("Unassigned");
  });
});

describe("curriculumReviewRecommendation", () => {
  it("leads with overdue, then CP review, then send-to-global, then global review", () => {
    const overdue = summarizeCurriculumReview(
      [curriculum({ submittedAt: new Date(NOW.getTime() - 50 * 60 * 60 * 1000) })],
      NOW
    );
    expect(curriculumReviewRecommendation(overdue)).toMatch(/overdue past the 48-hour window/);

    const waiting = summarizeCurriculumReview(
      [curriculum({ submittedAt: new Date(NOW.getTime() - 60 * 60 * 1000) })],
      NOW
    );
    expect(curriculumReviewRecommendation(waiting)).toMatch(/in CP review/);

    const cpApproved = summarizeCurriculumReview([curriculum({ approvalStage: "CP_APPROVED" })], NOW);
    expect(curriculumReviewRecommendation(cpApproved)).toMatch(/send .* to global review/i);

    const globalPending = summarizeCurriculumReview([curriculum({ approvalStage: "GLOBAL_REVIEW" })], NOW);
    expect(curriculumReviewRecommendation(globalPending)).toMatch(/awaiting global review/);

    expect(curriculumReviewRecommendation(summarizeCurriculumReview([], NOW))).toMatch(/No curricula yet/);
  });
});
