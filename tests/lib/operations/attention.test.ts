import { describe, expect, it } from "vitest";

import type { OperationalReviewItem } from "@/lib/people-strategy/operational-digest";
import {
  attentionFromReviewItem,
  buildNeedsAttention,
  deriveApplicantAttention,
  deriveClassSetupAttention,
  deriveMentorshipAttention,
  derivePartnerAttention,
  partnerIsActive,
  type ApplicantAttentionInput,
  type ClassSetupAttentionInput,
  type MentorshipAttentionInput,
  type PartnerAttentionInput,
} from "@/lib/operations/attention";

const NOW = new Date("2026-06-11T12:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function daysAhead(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

function partner(overrides: Partial<PartnerAttentionInput> = {}): PartnerAttentionInput {
  return {
    id: "p1",
    name: "Mohawk Day Camp",
    stage: "IN_CONVERSATION",
    nextFollowUpAt: null,
    lastContactedAt: daysAgo(10),
    relationshipLeadName: "Ian Chen",
    ...overrides,
  };
}

describe("derivePartnerAttention", () => {
  it("flags an active partner with no next step, explaining why", () => {
    const items = derivePartnerAttention([partner()], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Mohawk Day Camp has no next step");
    expect(items[0].why).toContain("10 days ago");
    expect(items[0].entityType).toBe("partner");
  });

  it("flags an overdue follow-up, escalating with age", () => {
    const recent = derivePartnerAttention(
      [partner({ nextFollowUpAt: daysAgo(3) })],
      NOW
    );
    expect(recent[0].id).toBe("partner:p1:follow-up-overdue");
    expect(recent[0].severity).toBe("warning");

    const ancient = derivePartnerAttention(
      [partner({ nextFollowUpAt: daysAgo(20) })],
      NOW
    );
    expect(ancient[0].severity).toBe("critical");
  });

  it("ignores inactive pipeline stages and future follow-ups", () => {
    expect(derivePartnerAttention([partner({ stage: "NOT_STARTED" })], NOW)).toEqual([]);
    expect(derivePartnerAttention([partner({ stage: null })], NOW)).toEqual([]);
    expect(
      derivePartnerAttention([partner({ nextFollowUpAt: daysAhead(5) })], NOW)
    ).toEqual([]);
  });

  it("partnerIsActive matches the rule used above", () => {
    expect(partnerIsActive(partner())).toBe(true);
    expect(partnerIsActive(partner({ stage: "CLOSED" }))).toBe(false);
  });
});

function applicant(overrides: Partial<ApplicantAttentionInput> = {}): ApplicantAttentionInput {
  return {
    id: "app1",
    name: "Tyler Park",
    status: "UNDER_REVIEW",
    submittedAt: daysAgo(30),
    updatedAt: daysAgo(20),
    interviewScheduledAt: null,
    ...overrides,
  };
}

describe("deriveApplicantAttention", () => {
  it("flags applicants idle past the threshold", () => {
    const items = deriveApplicantAttention([applicant()], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("20 days");
    expect(items[0].why).toContain("walk away");
  });

  it("skips fresh applications, scheduled interviews, and decided statuses", () => {
    expect(deriveApplicantAttention([applicant({ updatedAt: daysAgo(5) })], NOW)).toEqual([]);
    expect(
      deriveApplicantAttention(
        [applicant({ interviewScheduledAt: daysAhead(2) })],
        NOW
      )
    ).toEqual([]);
    expect(deriveApplicantAttention([applicant({ status: "APPROVED" })], NOW)).toEqual([]);
  });
});

function mentorship(
  overrides: Partial<MentorshipAttentionInput> = {}
): MentorshipAttentionInput {
  return {
    id: "men1",
    mentorName: "Ian Chen",
    menteeName: "Maya Johnson",
    menteeId: "u9",
    lastActivityAt: daysAgo(60),
    ...overrides,
  };
}

describe("deriveMentorshipAttention", () => {
  it("flags quiet pairings with the quiet-day count", () => {
    const items = deriveMentorshipAttention([mentorship()], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Ian Chen → Maya Johnson has been quiet 60 days");
  });

  it("skips recently active pairings", () => {
    expect(
      deriveMentorshipAttention([mentorship({ lastActivityAt: daysAgo(10) })], NOW)
    ).toEqual([]);
  });
});

function classSetup(
  overrides: Partial<ClassSetupAttentionInput> = {}
): ClassSetupAttentionInput {
  return {
    id: "c1",
    title: "Introduction to Entrepreneurship",
    status: "PUBLISHED",
    startDate: daysAhead(10),
    endDate: daysAhead(60),
    instructorName: "Maya Johnson",
    sessionCount: 0,
    enrolledCount: 5,
    ...overrides,
  };
}

describe("deriveClassSetupAttention", () => {
  it("flags an imminent class missing sessions, naming the instructor", () => {
    const items = deriveClassSetupAttention([classSetup()], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("no sessions scheduled");
    expect(items[0].why).toContain("Maya Johnson");
    expect(items[0].entityType).toBe("class");
  });

  it("compounds multiple gaps into one item", () => {
    const items = deriveClassSetupAttention(
      [classSetup({ status: "DRAFT", enrolledCount: 0 })],
      NOW
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("no sessions scheduled");
    expect(items[0].title).toContain("still in draft");
    expect(items[0].title).toContain("no students enrolled");
  });

  it("escalates to critical inside a week of start", () => {
    expect(deriveClassSetupAttention([classSetup({ startDate: daysAhead(3) })], NOW)[0].severity).toBe("critical");
    expect(deriveClassSetupAttention([classSetup({ startDate: daysAhead(15) })], NOW)[0].severity).toBe("warning");
  });

  it("ignores fully-set-up, far-future, finished, and cancelled classes", () => {
    expect(deriveClassSetupAttention([classSetup({ sessionCount: 4 })], NOW)).toEqual([]);
    expect(deriveClassSetupAttention([classSetup({ startDate: daysAhead(40) })], NOW)).toEqual([]);
    expect(deriveClassSetupAttention([classSetup({ status: "CANCELLED" })], NOW)).toEqual([]);
    expect(
      deriveClassSetupAttention(
        [classSetup({ startDate: daysAgo(60), endDate: daysAgo(10) })],
        NOW
      )
    ).toEqual([]);
  });
});

describe("buildNeedsAttention", () => {
  const reviewItem: OperationalReviewItem = {
    id: "action:a1",
    kind: "action",
    title: "Confirm Friday planning meeting",
    reason: "Overdue 4 days",
    reasons: ["Overdue 4 days", "No owner assigned"],
    score: 50,
    severity: "critical",
    href: "/actions/a1",
  };

  it("maps digest review items with their reasons as the why", () => {
    const item = attentionFromReviewItem(reviewItem);
    expect(item.why).toBe("Overdue 4 days · No owner assigned");
    expect(item.severity).toBe("critical");
  });

  it("merges all sources, severity first then score, and respects the limit", () => {
    const items = buildNeedsAttention({
      reviewItems: [reviewItem],
      partners: [partner({ nextFollowUpAt: daysAgo(20) })], // critical, score 44
      applicants: [applicant()], // watch
      mentorships: [mentorship()], // watch
      classes: [classSetup({ startDate: daysAhead(15) })], // warning
      now: NOW,
    });
    expect(items[0].severity).toBe("critical");
    expect(items[1].severity).toBe("critical");
    const severities = items.map((i) => i.severity);
    const rank = { critical: 3, warning: 2, watch: 1, neutral: 0 } as const;
    for (let i = 1; i < severities.length; i++) {
      expect(rank[severities[i - 1]]).toBeGreaterThanOrEqual(rank[severities[i]]);
    }

    const limited = buildNeedsAttention({
      reviewItems: [reviewItem],
      partners: [partner({ nextFollowUpAt: daysAgo(20) })],
      applicants: [applicant()],
      mentorships: [mentorship()],
      classes: [classSetup()],
      now: NOW,
      limit: 2,
    });
    expect(limited).toHaveLength(2);
  });

  it("is deterministic — same inputs, same order", () => {
    const input = {
      reviewItems: [reviewItem],
      partners: [partner()],
      applicants: [applicant()],
      mentorships: [mentorship()],
      classes: [classSetup()],
      now: NOW,
    };
    expect(buildNeedsAttention(input)).toEqual(buildNeedsAttention(input));
  });
});
