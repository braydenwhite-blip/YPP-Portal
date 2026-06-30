import { describe, it, expect } from "vitest";

import {
  summarizePartnerImpact,
  type PartnerMetricInput,
  type PartnerNoteMetricInput,
} from "@/lib/partners/metrics";

const NOW = new Date("2026-06-15T12:00:00.000Z"); // Monday
const WEEK_START = new Date("2026-06-15T00:00:00.000Z");

function partner(over: Partial<PartnerMetricInput>): PartnerMetricInput {
  return {
    stage: "RESEARCHING",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    nextFollowUpAt: null,
    meetingDate: null,
    lastContactedAt: null,
    contactName: null,
    contactEmail: null,
    logisticsComplete: null,
    ...over,
  };
}

const partners: PartnerMetricInput[] = [
  partner({ stage: "RESEARCHING" }), // RESEARCH
  partner({ stage: "REACHED_OUT", lastContactedAt: NOW, nextFollowUpAt: new Date("2026-06-18T00:00:00Z") }), // CONTACTED
  partner({ stage: "REACHED_OUT", lastContactedAt: NOW, nextFollowUpAt: new Date("2026-06-12T00:00:00Z") }), // FOLLOW_UP_DUE
  partner({ stage: "MEETING_SCHEDULED", lastContactedAt: NOW, meetingDate: new Date("2026-06-20T00:00:00Z"), nextFollowUpAt: new Date("2026-06-20T00:00:00Z") }), // MEETING
  partner({ stage: "ACTIVE_PARTNERSHIP", logisticsComplete: false }), // CONFIRMED, logistics incomplete
  partner({ stage: "NOT_A_FIT" }), // CLOSED
];

const notes: PartnerNoteMetricInput[] = [
  { id: "n1", partnerId: "2", kind: "OUTREACH_SENT", createdAt: WEEK_START },
  { id: "n2", partnerId: "3", kind: "OUTREACH_SENT", createdAt: new Date("2026-06-08T00:00:00Z") },
  { id: "n3", partnerId: "3", kind: "FOLLOW_UP_SENT", createdAt: WEEK_START },
  { id: "n4", partnerId: "4", kind: "OUTREACH_SENT", createdAt: new Date("2026-06-08T00:00:00Z") },
  { id: "n5", partnerId: "4", kind: "MEETING_OUTCOME", createdAt: WEEK_START, metadata: { outcome: "NEEDS_APPROVAL" } },
  { id: "n6", partnerId: "5", kind: "MEETING_OUTCOME", createdAt: WEEK_START, metadata: { outcome: "CONFIRMED_YES" } },
  { id: "n7", partnerId: "5", kind: "CHECK_IN", createdAt: WEEK_START },
  // issue1: unresolved, escalated, raised 3 days ago (> 24h)
  { id: "issue1", partnerId: "5", kind: "ISSUE", createdAt: new Date("2026-06-12T00:00:00Z"), metadata: { escalated: true } },
  // issue2: resolved
  { id: "issue2", partnerId: "4", kind: "ISSUE", createdAt: NOW, metadata: {} },
  { id: "n8", partnerId: "4", kind: "ISSUE_RESOLVED", createdAt: NOW, metadata: { resolvesNoteId: "issue2" } },
];

describe("summarizePartnerImpact — state metrics", () => {
  const m = summarizePartnerImpact(partners, notes, NOW);
  it("counts the pipeline by lane", () => {
    expect(m.researched).toBe(6);
    expect(m.contacted).toBe(5);
    expect(m.responses).toBe(2);
    expect(m.noReply).toBe(2);
    expect(m.meetingsScheduled).toBe(1);
    expect(m.followUpsDue).toBe(1);
    expect(m.confirmed).toBe(1);
    expect(m.closed).toBe(1);
    expect(m.activePartners).toBe(1);
  });
  it("flags confirmed-but-logistics-incomplete", () => {
    expect(m.logisticsIncomplete).toBe(1);
    expect(m.logisticsComplete).toBe(0);
  });
});

describe("summarizePartnerImpact — event metrics", () => {
  it("counts all emails/meetings/check-ins when unwindowed", () => {
    const m = summarizePartnerImpact(partners, notes, NOW);
    expect(m.emailsSent).toBe(4); // 3 OUTREACH + 1 FOLLOW_UP
    expect(m.meetingsCompleted).toBe(2);
    expect(m.outcomesByType).toEqual({ NEEDS_APPROVAL: 1, CONFIRMED_YES: 1 });
    expect(m.checkInsThisWeek).toBe(1);
  });
  it("honors the `since` window for event metrics", () => {
    const m = summarizePartnerImpact(partners, notes, NOW, { since: WEEK_START });
    // Only the two events dated 06-08 (n2 OUTREACH, n4 OUTREACH) fall outside the week.
    expect(m.emailsSent).toBe(2); // n1 OUTREACH + n3 FOLLOW_UP
    expect(m.meetingsCompleted).toBe(2);
  });
});

describe("summarizePartnerImpact — issues", () => {
  it("tracks unresolved, >24h, and escalated issues", () => {
    const m = summarizePartnerImpact(partners, notes, NOW);
    expect(m.issuesUnresolved).toBe(1); // issue1 (issue2 was resolved)
    expect(m.issuesOver24h).toBe(1);
    expect(m.escalations).toBe(1);
    expect(m.blockers).toBe(2); // logisticsIncomplete(1) + issuesOver24h(1)
  });
});
