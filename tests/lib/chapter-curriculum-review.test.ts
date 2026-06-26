import { describe, it, expect } from "vitest";
import {
  curriculumPlaybookStatus,
  curriculumReviewOverdue,
  curriculumHoursWaiting,
  summarizeCurriculumReview,
  curriculumEvidenceStatus,
  curriculumEvidenceRow,
  curriculumReviewRecommendation,
  type CurriculumRecord,
} from "@/lib/chapters/curriculum-review";

const NOW = new Date("2026-06-24T12:00:00.000Z");

function curriculum(overrides: Partial<CurriculumRecord> = {}): CurriculumRecord {
  return {
    id: "c1",
    title: "Intro to Robotics",
    subject: "Robotics",
    instructorName: "Sam",
    status: "SUBMITTED",
    submittedAt: new Date("2026-06-24T00:00:00.000Z"),
    reviewedAt: null,
    ...overrides,
  };
}

describe("curriculumPlaybookStatus", () => {
  it("maps submission statuses to playbook statuses", () => {
    expect(curriculumPlaybookStatus("SUBMITTED")).toBe("submitted");
    expect(curriculumPlaybookStatus("NEEDS_REVISION")).toBe("needs_revision");
    expect(curriculumPlaybookStatus("APPROVED")).toBe("approved");
    expect(curriculumPlaybookStatus("DRAFT")).toBe("not_submitted");
    expect(curriculumPlaybookStatus(null)).toBe("not_submitted");
  });
});

describe("curriculumReviewOverdue", () => {
  it("is overdue once a submission passes the 48-hour SLA", () => {
    const submitted50hAgo = new Date(NOW.getTime() - 50 * 60 * 60 * 1000);
    expect(curriculumReviewOverdue(curriculum({ submittedAt: submitted50hAgo }), NOW)).toBe(true);
  });
  it("is not overdue within the SLA", () => {
    const submitted10hAgo = new Date(NOW.getTime() - 10 * 60 * 60 * 1000);
    expect(curriculumReviewOverdue(curriculum({ submittedAt: submitted10hAgo }), NOW)).toBe(false);
  });
  it("only applies to submitted curricula", () => {
    const submitted50hAgo = new Date(NOW.getTime() - 50 * 60 * 60 * 1000);
    expect(
      curriculumReviewOverdue(curriculum({ status: "APPROVED", submittedAt: submitted50hAgo }), NOW)
    ).toBe(false);
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
  it("counts by status and flags overdue reviews", () => {
    const submitted50hAgo = new Date(NOW.getTime() - 50 * 60 * 60 * 1000);
    const items = [
      curriculum({ id: "1", status: "SUBMITTED", submittedAt: submitted50hAgo }), // overdue
      curriculum({ id: "2", status: "SUBMITTED", submittedAt: new Date(NOW.getTime() - 60 * 60 * 1000) }), // fresh
      curriculum({ id: "3", status: "NEEDS_REVISION" }),
      curriculum({ id: "4", status: "APPROVED" }),
      curriculum({ id: "5", status: "DRAFT" }),
    ];
    const s = summarizeCurriculumReview(items, NOW);
    expect(s.total).toBe(5);
    expect(s.reviewNeeded).toBe(2);
    expect(s.reviewOverdue).toBe(1);
    expect(s.needsRevision).toBe(1);
    expect(s.approved).toBe(1);
    expect(s.byStatus.not_submitted).toBe(1);
  });
});

describe("curriculumEvidenceStatus", () => {
  it("maps playbook status to the three-way health", () => {
    expect(curriculumEvidenceStatus("APPROVED")).toBe("ready");
    expect(curriculumEvidenceStatus("SUBMITTED")).toBe("needs_feedback");
    expect(curriculumEvidenceStatus("NEEDS_REVISION")).toBe("needs_feedback");
    expect(curriculumEvidenceStatus("DRAFT")).toBe("not_started");
    expect(curriculumEvidenceStatus(null)).toBe("not_started");
  });
});

describe("curriculumEvidenceRow", () => {
  it("builds a row from real fields", () => {
    expect(curriculumEvidenceRow(curriculum())).toMatchObject({
      title: "Intro to Robotics",
      subject: "Robotics",
      stage: "In Review",
      owner: "Sam",
      status: "needs_feedback",
    });
  });
  it("labels an ownerless curriculum Unassigned", () => {
    expect(curriculumEvidenceRow(curriculum({ instructorName: null })).owner).toBe("Unassigned");
  });
});

describe("curriculumReviewRecommendation", () => {
  it("leads with overdue, then awaiting review, then nothing to do", () => {
    const overdue = summarizeCurriculumReview(
      [curriculum({ submittedAt: new Date(NOW.getTime() - 50 * 60 * 60 * 1000) })],
      NOW
    );
    expect(curriculumReviewRecommendation(overdue)).toMatch(/overdue past the 48-hour window/);

    const waiting = summarizeCurriculumReview(
      [curriculum({ submittedAt: new Date(NOW.getTime() - 60 * 60 * 1000) })],
      NOW
    );
    expect(curriculumReviewRecommendation(waiting)).toMatch(/Give feedback on 1 curriculum/);

    expect(curriculumReviewRecommendation(summarizeCurriculumReview([], NOW))).toMatch(/No curricula yet/);
  });
});
