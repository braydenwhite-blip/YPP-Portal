import { describe, it, expect } from "vitest";

import {
  partnerCpLane,
  partnerNextAction,
  summarizeLanes,
  isPartnerFollowUpDue,
  STAGE_TO_LANE,
  type PartnerWorkInput,
} from "@/lib/partners/pipeline";

const NOW = new Date("2026-06-10T12:00:00.000Z");

function p(over: Partial<PartnerWorkInput>): PartnerWorkInput {
  return {
    stage: "NOT_STARTED",
    nextFollowUpAt: null,
    meetingDate: null,
    lastContactedAt: null,
    contactName: null,
    contactEmail: null,
    logisticsComplete: null,
    ...over,
  };
}

describe("partnerCpLane", () => {
  it("maps stages to lanes via the static map by default", () => {
    expect(partnerCpLane(p({ stage: "NOT_STARTED" }), NOW)).toBe("RESEARCH");
    expect(partnerCpLane(p({ stage: "RESEARCHING" }), NOW)).toBe("RESEARCH");
    expect(partnerCpLane(p({ stage: "REACHED_OUT" }), NOW)).toBe("CONTACTED");
    expect(partnerCpLane(p({ stage: "RESPONDED" }), NOW)).toBe("INTERESTED");
    expect(partnerCpLane(p({ stage: "MEETING_SCHEDULED" }), NOW)).toBe("MEETING");
    expect(partnerCpLane(p({ stage: "PROPOSAL_SENT" }), NOW)).toBe("PROPOSAL");
    expect(partnerCpLane(p({ stage: "ACTIVE_PARTNERSHIP" }), NOW)).toBe("CONFIRMED");
    expect(partnerCpLane(p({ stage: "PAUSED" }), NOW)).toBe("CLOSED");
    expect(partnerCpLane(p({ stage: "NOT_A_FIT" }), NOW)).toBe("CLOSED");
  });

  it("pulls in-conversation partners with an overdue follow-up into FOLLOW_UP_DUE", () => {
    const overdue = new Date("2026-06-09T12:00:00.000Z");
    for (const stage of ["REACHED_OUT", "RESPONDED", "NEEDS_PROPOSAL", "PROPOSAL_SENT", "NEGOTIATING"]) {
      expect(partnerCpLane(p({ stage, nextFollowUpAt: overdue }), NOW)).toBe("FOLLOW_UP_DUE");
    }
    // Not yet due stays in its natural lane.
    expect(partnerCpLane(p({ stage: "REACHED_OUT", nextFollowUpAt: new Date("2026-06-12T12:00:00.000Z") }), NOW)).toBe("CONTACTED");
    expect(partnerCpLane(p({ stage: "RESPONDED", nextFollowUpAt: new Date("2026-06-12T12:00:00.000Z") }), NOW)).toBe("INTERESTED");
  });

  it("does not pull a meeting-scheduled or confirmed partner into FOLLOW_UP_DUE", () => {
    const overdue = new Date("2026-06-01T12:00:00.000Z");
    expect(partnerCpLane(p({ stage: "MEETING_SCHEDULED", nextFollowUpAt: overdue }), NOW)).toBe("MEETING");
    expect(partnerCpLane(p({ stage: "ACTIVE_PARTNERSHIP", nextFollowUpAt: overdue }), NOW)).toBe("CONFIRMED");
  });

  it("isPartnerFollowUpDue agrees with the FOLLOW_UP_DUE lane", () => {
    const overdue = new Date("2026-06-01T12:00:00.000Z");
    expect(isPartnerFollowUpDue(p({ stage: "RESPONDED", nextFollowUpAt: overdue }), NOW)).toBe(true);
    expect(isPartnerFollowUpDue(p({ stage: "MEETING_SCHEDULED", nextFollowUpAt: overdue }), NOW)).toBe(false);
    expect(isPartnerFollowUpDue(p({ stage: "REACHED_OUT", nextFollowUpAt: null }), NOW)).toBe(false);
  });

  it("coerces unknown/legacy stage strings to RESEARCH", () => {
    expect(partnerCpLane(p({ stage: "CLOSED" }), NOW)).toBe("RESEARCH"); // CLOSED is not a PARTNER_STAGE
    expect(partnerCpLane(p({ stage: null }), NOW)).toBe("RESEARCH");
  });

  it("STAGE_TO_LANE covers all 12 stages", () => {
    expect(Object.keys(STAGE_TO_LANE)).toHaveLength(12);
  });
});

describe("partnerNextAction", () => {
  it("research without a contact email → find a contact", () => {
    expect(partnerNextAction(p({ stage: "RESEARCHING" }), NOW).key).toBe("ADD_CONTACT");
  });
  it("research with a contact email → send the intro email", () => {
    expect(partnerNextAction(p({ stage: "RESEARCHING", contactEmail: "a@b.org" }), NOW).key).toBe("GENERATE_EMAIL");
  });
  it("follow-up due → send a follow-up (danger tone)", () => {
    const a = partnerNextAction(p({ stage: "REACHED_OUT", nextFollowUpAt: new Date("2026-06-01T00:00:00Z") }), NOW);
    expect(a.key).toBe("SEND_FOLLOW_UP");
    expect(a.tone).toBe("danger");
  });
  it("interested → schedule a meeting", () => {
    expect(partnerNextAction(p({ stage: "RESPONDED" }), NOW).key).toBe("SCHEDULE_MEETING");
  });
  it("meeting in the past → log the outcome", () => {
    const a = partnerNextAction(p({ stage: "MEETING_SCHEDULED", meetingDate: new Date("2026-06-05T12:00:00Z") }), NOW);
    expect(a.key).toBe("LOG_OUTCOME");
  });
  it("meeting in the future → prep for the meeting", () => {
    const a = partnerNextAction(p({ stage: "MEETING_SCHEDULED", meetingDate: new Date("2026-06-20T12:00:00Z") }), NOW);
    expect(a.key).toBe("MEETING_BRIEF");
  });
  it("confirmed with incomplete logistics → confirm logistics", () => {
    expect(partnerNextAction(p({ stage: "ACTIVE_PARTNERSHIP", logisticsComplete: false }), NOW).key).toBe("CONFIRM_LOGISTICS");
  });
  it("confirmed with complete logistics → weekly check-in", () => {
    expect(partnerNextAction(p({ stage: "ACTIVE_PARTNERSHIP", logisticsComplete: true }), NOW).key).toBe("CHECK_IN");
  });
});

describe("summarizeLanes", () => {
  it("counts partners per lane", () => {
    const counts = summarizeLanes(
      [
        p({ stage: "NOT_STARTED" }),
        p({ stage: "RESEARCHING" }),
        p({ stage: "REACHED_OUT" }),
        p({ stage: "ACTIVE_PARTNERSHIP" }),
      ],
      NOW
    );
    expect(counts.RESEARCH).toBe(2);
    expect(counts.CONTACTED).toBe(1);
    expect(counts.CONFIRMED).toBe(1);
    expect(counts.CLOSED).toBe(0);
  });
});
