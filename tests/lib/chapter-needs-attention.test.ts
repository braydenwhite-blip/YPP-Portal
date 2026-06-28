import { describe, it, expect } from "vitest";
import {
  deriveChapterBlockers,
  summarizeBlockers,
  type ChapterBlockerInput,
} from "@/lib/chapters/needs-attention-rules";
import { type PartnerRecord, type InstructorApplicantRecord } from "@/lib/chapters/pipeline";
import { type CurriculumRecord } from "@/lib/chapters/curriculum-review";
import { type ClassLaunchRecord } from "@/lib/chapters/launch-readiness";

const NOW = new Date("2026-06-24T12:00:00.000Z");

function emptyInput(): ChapterBlockerInput {
  return { partners: [], applicants: [], curricula: [], classes: [] };
}

function partner(o: Partial<PartnerRecord> = {}): PartnerRecord {
  return {
    id: "p1",
    name: "Lincoln Elementary",
    type: "School",
    stage: "REACHED_OUT",
    lastContactedAt: new Date("2026-06-20T00:00:00Z"),
    nextFollowUpAt: new Date("2026-07-01T00:00:00Z"),
    hasRelationshipLead: true,
    confirmedRoom: false,
    confirmedTimes: false,
    confirmedLaunchDate: false,
    hasSupervisor: false,
    writtenConfirmation: false,
    openIssues: 0,
    ...o,
  };
}

function applicant(o: Partial<InstructorApplicantRecord> = {}): InstructorApplicantRecord {
  return {
    id: "a1",
    name: "Jordan",
    status: "SUBMITTED",
    appliedAt: new Date("2026-06-21T12:00:00Z"),
    specialties: "Python, Robotics",
    hasReviewer: false,
    interviewScheduledAt: null,
    interviewCompletedAt: null,
    hasDecision: false,
    hasCourseDescription: true,
    hasLessonPlan: true,
    updatedAt: NOW,
    ...o,
  };
}

function curriculum(o: Partial<CurriculumRecord> = {}): CurriculumRecord {
  return {
    id: "c1",
    title: "Robotics",
    subject: "Robotics",
    instructorName: "Sam",
    status: "SUBMITTED",
    submittedAt: new Date(NOW.getTime() - 60 * 60 * 60 * 1000), // 60h ago → overdue
    reviewedAt: null,
    ...o,
  };
}

function klass(o: Partial<ClassLaunchRecord> = {}): ClassLaunchRecord {
  return {
    id: "k1",
    title: "Robotics 101",
    ageRange: "10-12",
    startDate: new Date("2026-09-01T00:00:00Z"),
    status: "DRAFT",
    partnerConfirmed: true,
    hasRoom: true,
    hasTimes: true,
    hasInstructor: true,
    instructorConfirmed: true,
    curriculumApproved: true,
    publiclyVisible: true,
    enrolledCount: 12,
    capacity: 25,
    instructorReady: true,
    preLaunchReminderSent: true,
    logisticsInWriting: true,
    ...o,
  };
}

describe("deriveChapterBlockers", () => {
  it("returns nothing for a clean chapter", () => {
    const blockers = deriveChapterBlockers(
      { partners: [partner()], applicants: [], curricula: [], classes: [klass()] },
      NOW
    );
    expect(blockers).toHaveLength(0);
  });

  it("flags a partner with no follow-up date", () => {
    const blockers = deriveChapterBlockers(
      { ...emptyInput(), partners: [partner({ nextFollowUpAt: null })] },
      NOW
    );
    expect(blockers.some((b) => b.key === "partner-followup:p1")).toBe(true);
    expect(blockers[0].lane).toBe("partners");
    expect(blockers[0].entityType).toBe("PARTNER");
  });

  it("flags a partner contacted 7+ business days ago with no response", () => {
    const blockers = deriveChapterBlockers(
      { ...emptyInput(), partners: [partner({ stage: "REACHED_OUT", lastContactedAt: new Date("2026-06-10T00:00:00Z"), nextFollowUpAt: new Date("2026-07-01T00:00:00Z") })] },
      NOW
    );
    expect(blockers.some((b) => b.key === "partner-no-response:p1")).toBe(true);
  });

  it("flags a confirmed partner with incomplete logistics", () => {
    const blockers = deriveChapterBlockers(
      { ...emptyInput(), partners: [partner({ stage: "ACTIVE_PARTNERSHIP", nextFollowUpAt: null })] },
      NOW
    );
    expect(blockers.some((b) => b.key === "partner-logistics:p1")).toBe(true);
  });

  it("flags an applicant waiting for review and a decision overdue", () => {
    const overdue = new Date(NOW.getTime() - 13 * 60 * 60 * 1000);
    const blockers = deriveChapterBlockers(
      {
        ...emptyInput(),
        applicants: [
          applicant({ id: "a1", status: "SUBMITTED" }),
          applicant({ id: "a2", status: "INTERVIEW_COMPLETED", interviewCompletedAt: overdue }),
        ],
      },
      NOW
    );
    expect(blockers.some((b) => b.key === "applicant-review:a1")).toBe(true);
    const decision = blockers.find((b) => b.key === "applicant-decision:a2");
    expect(decision?.severity).toBe("critical");
  });

  it("flags a curriculum review overdue as critical", () => {
    const blockers = deriveChapterBlockers({ ...emptyInput(), curricula: [curriculum()] }, NOW);
    const c = blockers.find((b) => b.key === "curriculum-review:c1");
    expect(c?.severity).toBe("critical");
    expect(c?.lane).toBe("curriculum");
    expect(c?.entityId).toBe("c1"); // carries the template id for the inline action
  });

  it("detects CP review needed (warning, in-SLA) and carries the template id", () => {
    const fresh = curriculum({ approvalStage: "CP_REVIEW", submittedAt: new Date(NOW.getTime() - 60 * 60 * 1000) });
    const blockers = deriveChapterBlockers({ ...emptyInput(), curricula: [fresh] }, NOW);
    const c = blockers.find((b) => b.key === "curriculum-review:c1");
    expect(c?.severity).toBe("warning");
    expect(c?.entityId).toBe("c1");
  });

  it("surfaces a CP-approved curriculum's send-to-global step", () => {
    const blockers = deriveChapterBlockers(
      { ...emptyInput(), curricula: [curriculum({ approvalStage: "CP_APPROVED" })] },
      NOW
    );
    const c = blockers.find((b) => b.key === "curriculum-send-global:c1");
    expect(c).toBeTruthy();
    expect(c?.entityId).toBe("c1");
  });

  it("detects global review needed", () => {
    const blockers = deriveChapterBlockers(
      { ...emptyInput(), curricula: [curriculum({ approvalStage: "GLOBAL_REVIEW", sentToGlobalAt: NOW })] },
      NOW
    );
    const c = blockers.find((b) => b.key === "curriculum-global-review:c1");
    expect(c).toBeTruthy();
    expect(c?.lane).toBe("curriculum");
  });

  it("flags class launch gaps and under-enrollment", () => {
    const blockers = deriveChapterBlockers(
      {
        ...emptyInput(),
        classes: [
          klass({ id: "k1", hasInstructor: false }),
          klass({ id: "k2", status: "IN_PROGRESS", enrolledCount: 4 }), // under-enrolled at launch
        ],
      },
      NOW
    );
    expect(blockers.some((b) => b.key === "class-no-instructor:k1")).toBe(true);
    const under = blockers.find((b) => b.key === "class-under-enrolled:k2");
    expect(under?.severity).toBe("critical"); // launched + under
  });

  it("ranks critical before warning before info", () => {
    const overdue = new Date(NOW.getTime() - 13 * 60 * 60 * 1000);
    const blockers = deriveChapterBlockers(
      {
        partners: [partner({ stage: "RESPONDED", nextFollowUpAt: new Date("2026-07-01T00:00:00Z") })], // info: interested no meeting
        applicants: [applicant({ id: "a2", status: "INTERVIEW_COMPLETED", interviewCompletedAt: overdue })], // critical
        curricula: [],
        classes: [klass({ hasInstructor: false })], // warning
      },
      NOW
    );
    expect(blockers[0].severity).toBe("critical");
    const severities = blockers.map((b) => b.severity);
    expect(severities.indexOf("critical")).toBeLessThan(severities.indexOf("warning"));
  });
});

describe("summarizeBlockers", () => {
  it("counts by severity and lane", () => {
    const blockers = deriveChapterBlockers(
      {
        ...emptyInput(),
        partners: [partner({ nextFollowUpAt: null })],
        curricula: [curriculum()],
      },
      NOW
    );
    const s = summarizeBlockers(blockers);
    expect(s.total).toBe(blockers.length);
    expect(s.byLane.curriculum).toBe(1);
    expect(s.critical).toBeGreaterThanOrEqual(1);
  });
});
