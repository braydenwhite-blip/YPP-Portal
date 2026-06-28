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
  partnerNextStep,
  partnerEvidenceStatus,
  partnerEvidenceRow,
  partnerPipelineRecommendation,
  instructorEvidenceStatus,
  instructorEvidenceRow,
  instructorPipelineRecommendation,
  DEFAULT_PIPELINE_THRESHOLDS,
  type PartnerRecord,
  type InstructorApplicantRecord,
} from "@/lib/chapters/pipeline";

const NOW = new Date("2026-06-24T12:00:00.000Z"); // a Wednesday

function partner(overrides: Partial<PartnerRecord> = {}): PartnerRecord {
  return {
    id: "p1",
    name: "Lincoln Elementary",
    type: "School",
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
    appliedAt: new Date("2026-06-21T12:00:00.000Z"), // 3 days before NOW
    specialties: "Python, Robotics",
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

describe("configurable pipeline thresholds", () => {
  it("partner stuck cutoff is driven by partnerFollowUpOverdueStuckDays", () => {
    // Follow-up 8 days overdue, last contact 4 days ago, in-flight with a lead.
    const p = partner({
      stage: "REACHED_OUT",
      nextFollowUpAt: new Date("2026-06-16T00:00:00.000Z"), // ~8 days before NOW
      lastContactedAt: new Date("2026-06-20T00:00:00.000Z"), // ~4 days before NOW
      hasRelationshipLead: true,
    });
    // Default cutoff (7) → 8 days overdue counts as stuck.
    expect(partnerEvidenceStatus(p, NOW)).toBe("stuck");
    // Raising the cutoff to 14 means 8 days overdue no longer counts as stuck.
    expect(
      partnerEvidenceStatus(p, NOW, {
        ...DEFAULT_PIPELINE_THRESHOLDS,
        partnerFollowUpOverdueStuckDays: 14,
      })
    ).toBe("at_risk");
  });

  it("instructor triage staleness is driven by instructorTriageStaleDays", () => {
    const a = applicant({
      status: "SUBMITTED", // → "applied", waiting for review
      appliedAt: new Date("2026-06-21T12:00:00.000Z"), // exactly 3 days before NOW
      hasReviewer: false,
    });
    // Default cutoff (7) → 3 days stalled is fine.
    expect(instructorEvidenceStatus(a, NOW)).toBe("on_track");
    // Lowering the cutoff to 2 flags the same applicant as at risk.
    expect(
      instructorEvidenceStatus(a, NOW, {
        ...DEFAULT_PIPELINE_THRESHOLDS,
        instructorTriageStaleDays: 2,
      })
    ).toBe("at_risk");
  });

  it("instructor decision SLA is driven by instructorDecisionSlaHours", () => {
    const a = applicant({
      status: "INTERVIEW_COMPLETED", // → "interview_complete"
      interviewCompletedAt: new Date("2026-06-24T06:00:00.000Z"), // 6 hours before NOW
      hasDecision: false,
    });
    // Default SLA (12h) → 6 hours is not yet overdue.
    expect(instructorDecisionOverdue(a, NOW)).toBe(false);
    // Tightening the SLA to 4h makes the same decision overdue.
    expect(
      instructorDecisionOverdue(a, NOW, {
        ...DEFAULT_PIPELINE_THRESHOLDS,
        instructorDecisionSlaHours: 4,
      })
    ).toBe(true);
  });
});

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

describe("partnerNextStep", () => {
  it("is the stage-appropriate action", () => {
    expect(partnerNextStep(partner({ stage: "RESEARCHING" }))).toBe("Send first outreach");
    expect(partnerNextStep(partner({ stage: "REACHED_OUT" }))).toBe("Follow up on outreach");
    expect(partnerNextStep(partner({ stage: "MEETING_SCHEDULED" }))).toBe("Hold the partner meeting");
  });
  it("surfaces open requests and confirmed-partner logistics", () => {
    expect(partnerNextStep(partner({ stage: "RESPONDED", openIssues: 2 }))).toBe("Resolve 2 open requests");
    expect(partnerNextStep(partner({ stage: "ACTIVE_PARTNERSHIP" }))).toBe("Lock in remaining logistics");
    expect(
      partnerNextStep(
        partner({
          stage: "ACTIVE_PARTNERSHIP",
          confirmedRoom: true,
          confirmedTimes: true,
          confirmedLaunchDate: true,
          hasSupervisor: true,
          writtenConfirmation: true,
        })
      )
    ).toBe("Schedule classes");
  });
});

describe("partnerEvidenceStatus", () => {
  it("is stuck when the follow-up is 7+ days overdue", () => {
    expect(partnerEvidenceStatus(partner({ nextFollowUpAt: new Date("2026-06-15T00:00:00Z") }), NOW)).toBe("stuck");
  });
  it("is stuck when there's been no contact in 14+ days", () => {
    expect(
      partnerEvidenceStatus(partner({ lastContactedAt: new Date("2026-06-05T00:00:00Z") }), NOW)
    ).toBe("stuck");
  });
  it("is at risk with no follow-up or no lead", () => {
    expect(partnerEvidenceStatus(partner({ nextFollowUpAt: null }), NOW)).toBe("at_risk");
    expect(partnerEvidenceStatus(partner({ hasRelationshipLead: false }), NOW)).toBe("at_risk");
  });
  it("is on track for a warm, well-owned partner", () => {
    expect(partnerEvidenceStatus(partner(), NOW)).toBe("on_track");
  });
  it("ties confirmed-partner health to logistics", () => {
    expect(partnerEvidenceStatus(partner({ stage: "ACTIVE_PARTNERSHIP" }), NOW)).toBe("at_risk");
    expect(
      partnerEvidenceStatus(
        partner({
          stage: "ACTIVE_PARTNERSHIP",
          confirmedRoom: true,
          confirmedTimes: true,
          confirmedLaunchDate: true,
          hasSupervisor: true,
          writtenConfirmation: true,
        }),
        NOW
      )
    ).toBe("on_track");
  });
});

describe("partnerEvidenceRow + recommendation", () => {
  it("builds a row from real fields", () => {
    const row = partnerEvidenceRow(partner(), NOW);
    expect(row).toMatchObject({
      name: "Lincoln Elementary",
      subtitle: "School",
      stage: "Contacted",
      lastContact: "4 days ago",
      nextStep: "Follow up on outreach",
      status: "on_track",
    });
  });
  it("recommends action on the most urgent class of partner", () => {
    const stuckRow = partnerEvidenceRow(partner({ nextFollowUpAt: new Date("2026-06-15T00:00:00Z") }), NOW);
    expect(partnerPipelineRecommendation([stuckRow])).toMatch(/1 stuck partner/);
    expect(partnerPipelineRecommendation([partnerEvidenceRow(partner(), NOW)])).toMatch(/healthy/);
    expect(partnerPipelineRecommendation([])).toMatch(/Add your first partner/);
  });
});

describe("instructorEvidenceStatus", () => {
  it("is at risk when a decision is overdue or materials are missing", () => {
    const overdue = new Date(NOW.getTime() - 13 * 60 * 60 * 1000);
    expect(
      instructorEvidenceStatus(applicant({ status: "INTERVIEW_COMPLETED", interviewCompletedAt: overdue }), NOW)
    ).toBe("at_risk");
    expect(
      instructorEvidenceStatus(applicant({ status: "INTERVIEW_SCHEDULED", hasLessonPlan: false }), NOW)
    ).toBe("at_risk");
  });
  it("is at risk when stalled in triage 7+ days", () => {
    expect(
      instructorEvidenceStatus(applicant({ status: "SUBMITTED", appliedAt: new Date("2026-06-10T12:00:00Z") }), NOW)
    ).toBe("at_risk");
  });
  it("is strong for hired or well-prepared, supported candidates", () => {
    expect(instructorEvidenceStatus(applicant({ status: "APPROVED" }), NOW)).toBe("strong");
    expect(
      instructorEvidenceStatus(applicant({ status: "UNDER_REVIEW", hasReviewer: true }), NOW)
    ).toBe("strong");
  });
  it("is on track otherwise", () => {
    expect(instructorEvidenceStatus(applicant({ status: "SUBMITTED" }), NOW)).toBe("on_track");
  });
});

describe("instructorEvidenceRow + recommendation", () => {
  it("builds a row from real fields", () => {
    const row = instructorEvidenceRow(applicant(), NOW);
    expect(row).toMatchObject({
      name: "Jordan",
      stage: "Applied",
      applied: "3 days ago",
      specialties: "Python, Robotics",
      status: "on_track",
    });
  });
  it("falls back to a dash when no specialties are listed", () => {
    expect(instructorEvidenceRow(applicant({ specialties: null }), NOW).specialties).toBe("—");
  });
  it("recommends the highest-priority instructor action", () => {
    const reviewQueue = summarizeInstructorPipeline([applicant({ status: "SUBMITTED" })], NOW);
    expect(instructorPipelineRecommendation(reviewQueue)).toMatch(/Review 1 application/);
    expect(instructorPipelineRecommendation(summarizeInstructorPipeline([], NOW))).toMatch(/Open applications/);
  });
});
