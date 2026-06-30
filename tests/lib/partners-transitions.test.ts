import { describe, it, expect } from "vitest";

import { addBusinessDays } from "@/lib/partners/follow-up";
import {
  planEmailSent,
  planFollowUpSent,
  planResponseLogged,
  planMeetingScheduled,
  planMeetingOutcome,
  planProposalSent,
  planConfirmed,
  planClosed,
  planStageChange,
  MEETING_OUTCOMES,
} from "@/lib/partners/transitions";

const NOW = new Date("2026-06-01T09:00:00.000Z"); // Monday
const partner = { name: "Scarsdale Public Library", stage: "RESEARCHING", contactName: "Jane Miller" };

describe("planEmailSent", () => {
  it("advances to REACHED_OUT, stamps contact, schedules 5-business-day follow-up, logs OUTREACH_SENT", () => {
    const plan = planEmailSent(partner, NOW);
    expect(plan.patch.stage).toBe("REACHED_OUT");
    expect(plan.patch.lastContactedAt).toEqual(NOW);
    expect(plan.patch.nextFollowUpAt?.toISOString()).toBe(addBusinessDays(NOW, 5).toISOString());
    expect(plan.note.kind).toBe("OUTREACH_SENT");
    expect(plan.note.body).toContain("Jane");
  });
});

describe("planFollowUpSent", () => {
  it("re-arms the 5-business-day clock and logs FOLLOW_UP_SENT (no stage change)", () => {
    const plan = planFollowUpSent({ ...partner, stage: "REACHED_OUT" }, NOW);
    expect(plan.patch.stage).toBeUndefined();
    expect(plan.patch.lastContactedAt).toEqual(NOW);
    expect(plan.patch.nextFollowUpAt?.toISOString()).toBe(addBusinessDays(NOW, 5).toISOString());
    expect(plan.note.kind).toBe("FOLLOW_UP_SENT");
  });
});

describe("planResponseLogged", () => {
  it("moves to RESPONDED and clears the follow-up clock", () => {
    const plan = planResponseLogged(partner, "They're interested!", NOW);
    expect(plan.patch.stage).toBe("RESPONDED");
    expect(plan.patch.nextFollowUpAt).toBeNull();
    expect(plan.note.kind).toBe("RESPONSE_RECEIVED");
    expect(plan.note.body).toContain("interested");
  });
});

describe("planMeetingScheduled", () => {
  it("sets MEETING_SCHEDULED + meetingDate and points the clock at the meeting", () => {
    const meeting = new Date("2026-06-10T14:00:00.000Z");
    const plan = planMeetingScheduled(partner, meeting, NOW);
    expect(plan.patch.stage).toBe("MEETING_SCHEDULED");
    expect(plan.patch.meetingDate).toEqual(meeting);
    expect(plan.patch.nextFollowUpAt).toEqual(meeting);
    expect(plan.note.kind).toBe("MEETING_SCHEDULED");
    expect(plan.note.metadata?.meetingDate).toBe(meeting.toISOString());
  });
});

describe("planMeetingOutcome", () => {
  it("CONFIRMED_YES → ACTIVE_PARTNERSHIP, follow-up 1 business day out", () => {
    const plan = planMeetingOutcome(partner, "CONFIRMED_YES", null, NOW);
    expect(plan.patch.stage).toBe("ACTIVE_PARTNERSHIP");
    expect(plan.patch.nextFollowUpAt?.toISOString()).toBe(addBusinessDays(NOW, 1).toISOString());
    expect(plan.note.metadata?.outcome).toBe("CONFIRMED_YES");
  });
  it("WANTS_PROPOSAL → NEEDS_PROPOSAL with a fast (1-day) follow-up", () => {
    const plan = planMeetingOutcome(partner, "WANTS_PROPOSAL", null, NOW);
    expect(plan.patch.stage).toBe("NEEDS_PROPOSAL");
    expect(plan.patch.nextFollowUpAt?.toISOString()).toBe(addBusinessDays(NOW, 1).toISOString());
  });
  it("NOT_A_FIT → NOT_A_FIT and clears the follow-up clock", () => {
    const plan = planMeetingOutcome(partner, "NOT_A_FIT", null, NOW);
    expect(plan.patch.stage).toBe("NOT_A_FIT");
    expect(plan.patch.nextFollowUpAt).toBeNull();
  });
  it("every outcome produces a MEETING_OUTCOME note with the outcome in metadata", () => {
    for (const outcome of MEETING_OUTCOMES) {
      const plan = planMeetingOutcome(partner, outcome, null, NOW);
      expect(plan.note.kind).toBe("MEETING_OUTCOME");
      expect(plan.note.metadata?.outcome).toBe(outcome);
    }
  });
});

describe("planProposalSent", () => {
  it("moves to PROPOSAL_SENT and schedules a follow-up", () => {
    const plan = planProposalSent(partner, NOW);
    expect(plan.patch.stage).toBe("PROPOSAL_SENT");
    expect(plan.patch.nextFollowUpAt?.toISOString()).toBe(addBusinessDays(NOW, 5).toISOString());
    expect(plan.note.kind).toBe("PROPOSAL_SENT");
  });
});

describe("planConfirmed", () => {
  it("moves to ACTIVE_PARTNERSHIP", () => {
    const plan = planConfirmed(partner, NOW);
    expect(plan.patch.stage).toBe("ACTIVE_PARTNERSHIP");
    expect(plan.note.metadata?.confirmed).toBe(true);
  });
});

describe("planClosed", () => {
  it("PAUSED reason parks the partner (revisitable)", () => {
    const plan = planClosed(partner, "PAUSED", null, NOW);
    expect(plan.patch.stage).toBe("PAUSED");
    expect(plan.patch.nextFollowUpAt).toBeNull();
    expect(plan.note.kind).toBe("CLOSED");
    expect(plan.note.metadata?.reason).toBe("PAUSED");
  });
  it("other reasons mark not-a-fit", () => {
    expect(planClosed(partner, "NO_RESPONSE", null, NOW).patch.stage).toBe("NOT_A_FIT");
    expect(planClosed(partner, "DECLINED", "Budget", NOW).patch.stage).toBe("NOT_A_FIT");
  });
});

describe("planStageChange", () => {
  it("records a STAGE_CHANGE note with from/to metadata", () => {
    const plan = planStageChange(partner, "MEETING_SCHEDULED", NOW);
    expect(plan.patch.stage).toBe("MEETING_SCHEDULED");
    expect(plan.note.kind).toBe("STAGE_CHANGE");
    expect(plan.note.metadata).toMatchObject({ from: "RESEARCHING", to: "MEETING_SCHEDULED" });
  });
});
