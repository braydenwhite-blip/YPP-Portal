import { describe, it, expect } from "vitest";
import {
  businessDaysBetween,
  partnerPlaybookStatus,
  partnerFollowUp,
  partnerLogistics,
  summarizePartnerPipeline,
  instructorPlaybookStage,
  instructorWaitingForReview,
  instructorInterviewReadyNotScheduled,
  instructorDecisionOverdue,
  instructorMissingMaterials,
  summarizeInstructorPipeline,
  type PartnerRecord,
  type InstructorApplicantRecord,
} from "@/lib/chapters/pipeline";

const NOW = new Date("2026-06-24T12:00:00.000Z"); // a Wednesday

function partner(overrides: Partial<PartnerRecord> = {}): PartnerRecord {
  return {
    id: "p1",
    name: "Lincoln Elementary",
    stage: "REACHED_OUT",
    lastContactedAt: new Date("2026-06-20T00:00:00.000Z"),
    nextFollowUpAt: new Date("2026-06-30T00:00:00.000Z"),
    hasRelationshipLead: true,
    confirmedRoom: false,
    confirmedTimes: false,
    confirmedLaunchDate: false,
    hasSupervisor: false,
    writtenConfirmation: false,
    openIssues: 0,
    ...overrides,
  };
}

function applicant(overrides: Partial<InstructorApplicantRecord> = {}): InstructorApplicantRecord {
  return {
    id: "a1",
    name: "Jordan",
    status: "SUBMITTED",
    hasReviewer: false,
    interviewScheduledAt: null,
    interviewCompletedAt: null,
    hasDecision: false,
    hasCourseDescription: true,
    hasLessonPlan: true,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("businessDaysBetween", () => {
  it("counts only weekdays", () => {
    // Mon 2026-06-15 → Mon 2026-06-22 = 5 business days
    expect(businessDaysBetween(new Date("2026-06-15T00:00:00Z"), new Date("2026-06-22T00:00:00Z"))).toBe(5);
  });
  it("is 0 when to <= from", () => {
    expect(businessDaysBetween(NOW, NOW)).toBe(0);
    expect(businessDaysBetween(NOW, new Date(NOW.getTime() - 1000))).toBe(0);
  });
});

describe("partnerPlaybookStatus", () => {
  it("maps existing stages to playbook statuses", () => {
    expect(partnerPlaybookStatus("RESEARCHING")).toBe("researching");
    expect(partnerPlaybookStatus("REACHED_OUT")).toBe("contacted");
    expect(partnerPlaybookStatus("RESPONDED")).toBe("interested");
    expect(partnerPlaybookStatus("MEETING_SCHEDULED")).toBe("meeting_scheduled");
    expect(partnerPlaybookStatus("NEGOTIATING")).toBe("final_conversation");
    expect(partnerPlaybookStatus("ACTIVE_PARTNERSHIP")).toBe("confirmed");
    expect(partnerPlaybookStatus("COMPLETED")).toBe("closed");
    expect(partnerPlaybookStatus(null)).toBe("researching");
  });
});

describe("partnerFollowUp", () => {
  it("flags an overdue follow-up with a day count", () => {
    const r = partnerFollowUp(partner({ nextFollowUpAt: new Date("2026-06-20T12:00:00Z") }), NOW);
    expect(r.needed).toBe(true);
    expect(r.reason).toMatch(/overdue by 4 days/);
  });
  it("flags a missing follow-up date", () => {
    const r = partnerFollowUp(partner({ nextFollowUpAt: null }), NOW);
    expect(r.needed).toBe(true);
    expect(r.reason).toMatch(/No follow-up scheduled/);
  });
  it("does not chase confirmed or closed partners", () => {
    expect(partnerFollowUp(partner({ stage: "ACTIVE_PARTNERSHIP", nextFollowUpAt: null }), NOW).needed).toBe(false);
    expect(partnerFollowUp(partner({ stage: "NOT_A_FIT", nextFollowUpAt: null }), NOW).needed).toBe(false);
  });
  it("is satisfied when a future follow-up is set", () => {
    expect(partnerFollowUp(partner({ nextFollowUpAt: new Date("2026-07-01T00:00:00Z") }), NOW).needed).toBe(false);
  });
});

describe("partnerLogistics", () => {
  it("reports incomplete logistics with the missing items", () => {
    const log = partnerLogistics(partner());
    expect(log.complete).toBe(false);
    expect(log.done).toBe(0);
    expect(log.total).toBe(5);
    expect(log.missing).toContain("Room / space confirmed");
  });
  it("is complete only when all five are locked in", () => {
    const log = partnerLogistics(
      partner({
        confirmedRoom: true,
        confirmedTimes: true,
        confirmedLaunchDate: true,
        hasSupervisor: true,
        writtenConfirmation: true,
      })
    );
    expect(log.complete).toBe(true);
    expect(log.done).toBe(5);
    expect(log.missing).toHaveLength(0);
  });
});

describe("summarizePartnerPipeline", () => {
  it("counts by status and surfaces follow-up + logistics gaps", () => {
    const partners = [
      partner({ id: "a", stage: "RESEARCHING", nextFollowUpAt: null }),
      partner({ id: "b", stage: "MEETING_SCHEDULED", nextFollowUpAt: new Date("2026-07-01T00:00:00Z") }),
      partner({ id: "c", stage: "ACTIVE_PARTNERSHIP" }), // confirmed but no logistics
      partner({ id: "d", stage: "COMPLETED" }),
    ];
    const s = summarizePartnerPipeline(partners, NOW);
    expect(s.total).toBe(4);
    expect(s.byStatus.researching).toBe(1);
    expect(s.byStatus.meeting_scheduled).toBe(1);
    expect(s.confirmed).toBe(1);
    expect(s.confirmedWithIncompleteLogistics).toBe(1);
    expect(s.followUpNeeded).toBe(1); // only the researching one with no follow-up
  });
});

describe("instructorPlaybookStage", () => {
  it("maps statuses to playbook stages", () => {
    expect(instructorPlaybookStage("SUBMITTED")).toBe("applied");
    expect(instructorPlaybookStage("UNDER_REVIEW")).toBe("under_review");
    expect(instructorPlaybookStage("PRE_APPROVED")).toBe("interview_ready");
    expect(instructorPlaybookStage("INTERVIEW_SCHEDULED")).toBe("interview_scheduled");
    expect(instructorPlaybookStage("INTERVIEW_COMPLETED")).toBe("interview_complete");
    expect(instructorPlaybookStage("CHAIR_REVIEW")).toBe("interview_complete");
    expect(instructorPlaybookStage("APPROVED")).toBe("hired");
    expect(instructorPlaybookStage("REJECTED")).toBe("rejected");
  });
});

describe("instructor blockers", () => {
  it("a submitted application with no reviewer is waiting for review", () => {
    expect(instructorWaitingForReview(applicant({ status: "SUBMITTED" }))).toBe(true);
    expect(instructorWaitingForReview(applicant({ status: "UNDER_REVIEW", hasReviewer: true }))).toBe(false);
    expect(instructorWaitingForReview(applicant({ status: "UNDER_REVIEW", hasReviewer: false }))).toBe(true);
  });

  it("interview-ready with no scheduled time is flagged", () => {
    expect(instructorInterviewReadyNotScheduled(applicant({ status: "PRE_APPROVED" }))).toBe(true);
    expect(
      instructorInterviewReadyNotScheduled(applicant({ status: "PRE_APPROVED", interviewScheduledAt: NOW }))
    ).toBe(false);
  });

  it("decision is overdue only past the 12-hour SLA after interview", () => {
    const completed13hAgo = new Date(NOW.getTime() - 13 * 60 * 60 * 1000);
    const completed3hAgo = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
    expect(
      instructorDecisionOverdue(
        applicant({ status: "INTERVIEW_COMPLETED", interviewCompletedAt: completed13hAgo }),
        NOW
      )
    ).toBe(true);
    expect(
      instructorDecisionOverdue(
        applicant({ status: "INTERVIEW_COMPLETED", interviewCompletedAt: completed3hAgo }),
        NOW
      )
    ).toBe(false);
    // already decided ⇒ not overdue
    expect(
      instructorDecisionOverdue(
        applicant({ status: "INTERVIEW_COMPLETED", interviewCompletedAt: completed13hAgo, hasDecision: true }),
        NOW
      )
    ).toBe(false);
  });

  it("missing pre-interview materials is flagged once interviewing", () => {
    expect(
      instructorMissingMaterials(applicant({ status: "INTERVIEW_SCHEDULED", hasLessonPlan: false }))
    ).toBe(true);
    expect(
      instructorMissingMaterials(applicant({ status: "INTERVIEW_SCHEDULED", hasLessonPlan: true, hasCourseDescription: true }))
    ).toBe(false);
    // hired/rejected applicants are not chased for materials
    expect(instructorMissingMaterials(applicant({ status: "APPROVED", hasLessonPlan: false }))).toBe(false);
  });
});

describe("summarizeInstructorPipeline", () => {
  it("counts stages and hiring progress", () => {
    const applicants = [
      applicant({ id: "1", status: "SUBMITTED" }),
      applicant({ id: "2", status: "UNDER_REVIEW", hasReviewer: true }),
      applicant({ id: "3", status: "APPROVED" }),
      applicant({ id: "4", status: "REJECTED" }),
    ];
    const s = summarizeInstructorPipeline(applicants, NOW);
    expect(s.total).toBe(4);
    expect(s.hired).toBe(1);
    expect(s.applicants).toBe(3); // excludes the rejected one
    expect(s.byStage.applied).toBe(1);
    expect(s.waitingForReview).toBe(1); // the SUBMITTED one
  });
});
