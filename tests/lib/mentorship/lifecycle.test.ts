import { describe, expect, it } from "vitest";

import {
  buildCycleStrip,
  defaultLifecycleHrefs,
  deriveNextAction,
  deriveReviewCapabilities,
  type LifecycleSnapshot,
} from "@/lib/mentorship/lifecycle";

const hrefs = defaultLifecycleHrefs("mentee-1");

function snapshot(overrides: Partial<LifecycleSnapshot> = {}): LifecycleSnapshot {
  return {
    hasActiveMentorship: true,
    mentorshipStatus: "ACTIVE",
    kickoffComplete: true,
    cycleStage: "REFLECTION_DUE",
    mentorName: "Maya Chen",
    grDocStatus: "ACTIVE",
    cycleLabel: "July 2026",
    reflectionOverdue: false,
    releasedReviewPendingAck: false,
    requiresChairApproval: true,
    overdueFollowUpLabel: null,
    openActionItems: 0,
    overdueActionItems: 0,
    lastCheckInLabel: "Jul 1, 2026",
    commentsRequested: 0,
    commentsSubmitted: 0,
    commentsOverdue: 0,
    quarterlyDue: false,
    quarterlyStatus: null,
    quarterlyRequiresBoardApproval: false,
    ...overrides,
  };
}

describe("deriveNextAction — one lifecycle, one verb per POV", () => {
  it("routes an unpaired person to matching for leadership, patience for the mentee", () => {
    const s = snapshot({ hasActiveMentorship: false, mentorshipStatus: null, cycleStage: null });
    expect(deriveNextAction(s, "leadership", hrefs, "Ari").key).toBe("assign-mentor");
    expect(deriveNextAction(s, "leadership", hrefs, "Ari").href).toBe(hrefs.adminMatching);
    expect(deriveNextAction(s, "me", hrefs).key).toBe("await-pairing");
    expect(deriveNextAction(s, "me", hrefs).href).toBeNull();
  });

  it("surfaces paused relationships to leadership only", () => {
    const s = snapshot({ hasActiveMentorship: false, mentorshipStatus: "PAUSED" });
    expect(deriveNextAction(s, "leadership", hrefs).key).toBe("resume-or-close");
    expect(deriveNextAction(s, "me", hrefs).key).toBe("await-pairing");
  });

  it("allows leadership to start a new pairing after a completed relationship", () => {
    const s = snapshot({ hasActiveMentorship: false, mentorshipStatus: "COMPLETE" });
    expect(deriveNextAction(s, "leadership", hrefs, "Ari").key).toBe("assign-mentor");
    expect(deriveNextAction(s, "leadership", hrefs, "Ari").href).toBe(hrefs.adminMatching);
    expect(deriveNextAction(s, "me", hrefs).label).toBe("Previous mentorship complete");
  });

  it("puts the kickoff on the mentor, urgently", () => {
    const s = snapshot({ kickoffComplete: false, cycleStage: "KICKOFF_PENDING" });
    const mentor = deriveNextAction(s, "mentor", hrefs, "Ari");
    expect(mentor.key).toBe("schedule-kickoff");
    expect(mentor.urgent).toBe(true);
    expect(deriveNextAction(s, "me", hrefs).key).toBe("await-kickoff");
  });

  it("asks leadership to assign G&R goals when no document exists", () => {
    const s = snapshot({ grDocStatus: "NONE" });
    const action = deriveNextAction(s, "leadership", hrefs, "Ari");
    expect(action.key).toBe("assign-goals");
    expect(action.href).toBe(hrefs.adminGoals);
    // The mentee's cycle is not blocked by the missing doc.
    expect(deriveNextAction(s, "me", hrefs).key).toBe("submit-reflection");
  });

  it("walks the review cycle: reflection → review → approval → ack", () => {
    const due = snapshot({ cycleStage: "REFLECTION_DUE" });
    expect(deriveNextAction(due, "me", hrefs).key).toBe("submit-reflection");
    expect(deriveNextAction(due, "mentor", hrefs).key).toBe("log-check-in");

    const submitted = snapshot({ cycleStage: "REFLECTION_SUBMITTED" });
    const write = deriveNextAction(submitted, "mentor", hrefs, "Ari");
    expect(write.key).toBe("write-review");
    expect(write.href).toBe("/people/mentee-1?section=review&panel=draft");
    expect(write.urgent).toBe(true);
    expect(deriveNextAction(submitted, "me", hrefs).key).toBe("await-reflection");

    const withChair = snapshot({ cycleStage: "REVIEW_SUBMITTED" });
    expect(deriveNextAction(withChair, "leadership", hrefs).key).toBe("approve-review");
    expect(deriveNextAction(withChair, "mentor", hrefs).key).toBe("await-approval");

    const changes = snapshot({ cycleStage: "CHANGES_REQUESTED" });
    expect(deriveNextAction(changes, "mentor", hrefs).key).toBe("revise-review");

    const released = snapshot({ cycleStage: "APPROVED", releasedReviewPendingAck: true });
    expect(deriveNextAction(released, "me", hrefs).key).toBe("acknowledge-review");
    expect(deriveNextAction(released, "mentor", hrefs).key).toBe("await-acknowledgment");
  });

  it("flags an overdue reflection as urgent for the mentee", () => {
    const s = snapshot({ reflectionOverdue: true });
    const action = deriveNextAction(s, "me", hrefs);
    expect(action.key).toBe("submit-reflection");
    expect(action.urgent).toBe(true);
  });

  it("falls through to follow-up work once the cycle is settled", () => {
    const s = snapshot({ cycleStage: "APPROVED", overdueActionItems: 2 });
    const me = deriveNextAction(s, "me", hrefs);
    expect(me.key).toBe("close-follow-up");
    const mentor = deriveNextAction(s, "mentor", hrefs);
    expect(mentor.key).toBe("close-follow-up");
    expect(mentor.href).toBe(hrefs.section("check-ins"));

    const overdueCheckIn = snapshot({
      cycleStage: "APPROVED",
      overdueFollowUpLabel: "Follow-up was due Jun 12, 2026",
    });
    expect(deriveNextAction(overdueCheckIn, "mentor", hrefs).key).toBe("close-follow-up");
    // A check-in follow-up nudge belongs to the relationship owner, not the mentee.
    expect(deriveNextAction(overdueCheckIn, "me", hrefs).key).toBe("all-caught-up");
  });

  it("defaults to a check-in for mentors and calm for the mentee", () => {
    const s = snapshot({ cycleStage: "APPROVED" });
    expect(deriveNextAction(s, "mentor", hrefs).key).toBe("log-check-in");
    const me = deriveNextAction(s, "me", hrefs);
    expect(me.key).toBe("all-caught-up");
    expect(me.href).toBeNull();
  });
});

describe("buildCycleStrip — the loop in plain language", () => {
  it("marks the reflection step current when the cycle starts", () => {
    const steps = buildCycleStrip(snapshot(), "me");
    expect(steps.map((s) => s.key)).toEqual([
      "reflection",
      "review",
      "approval",
      "released",
      "acknowledged",
    ]);
    expect(steps[0].state).toBe("current");
    expect(steps[0].detail).toBe("Waiting on you");
    expect(steps.slice(1).every((s) => s.state === "upcoming")).toBe(true);
  });

  it("says who moves next at every stage, with no database words", () => {
    const review = buildCycleStrip(snapshot({ cycleStage: "REFLECTION_SUBMITTED" }), "me");
    expect(review[1].state).toBe("current");
    expect(review[1].detail).toBe("Waiting on Maya Chen");

    const mentorView = buildCycleStrip(
      snapshot({ cycleStage: "CHANGES_REQUESTED" }),
      "mentor",
      "Ari"
    );
    expect(mentorView[1].detail).toBe("Back with you for changes");

    const approval = buildCycleStrip(snapshot({ cycleStage: "REVIEW_SUBMITTED" }), "me");
    expect(approval[2].state).toBe("current");
    expect(approval[2].detail).toBe("With the chair for approval");
  });

  it("completes through acknowledgment", () => {
    const pendingAck = buildCycleStrip(
      snapshot({ cycleStage: "APPROVED", releasedReviewPendingAck: true }),
      "mentor",
      "Ari"
    );
    expect(pendingAck[3].state).toBe("done"); // released
    expect(pendingAck[4].state).toBe("current");
    expect(pendingAck[4].detail).toBe("Waiting on Ari to react");

    const done = buildCycleStrip(snapshot({ cycleStage: "APPROVED" }), "me");
    expect(done.every((s) => s.state === "done")).toBe(true);
  });

  it("hides the approval step for pairings without a chair", () => {
    const steps = buildCycleStrip(snapshot({ requiresChairApproval: false }), "me");
    expect(steps.map((s) => s.key)).toEqual([
      "reflection",
      "review",
      "released",
      "acknowledged",
    ]);
  });
});

describe("deriveNextAction — quarterly committee review dominates when due", () => {
  it("puts starting the quarterly review on the mentor once monthly work is released", () => {
    const s = snapshot({ cycleStage: "APPROVED", releasedReviewPendingAck: false, quarterlyDue: true, quarterlyStatus: null });
    const mentor = deriveNextAction(s, "mentor", hrefs, "Ari");
    expect(mentor.key).toBe("start-quarterly-review");
    expect(mentor.urgent).toBe(true);
    expect(deriveNextAction(s, "leadership", hrefs, "Ari").key).toBe("await-quarterly-start");
  });

  it("gives the mentee no quarterly action — it's committee-internal", () => {
    const s = snapshot({ cycleStage: "APPROVED", quarterlyDue: true, quarterlyStatus: "DRAFT" });
    const mine = deriveNextAction(s, "me", hrefs, "Ari");
    expect(mine.key).not.toMatch(/quarterly/);
  });

  it("routes changes-requested back to the mentor", () => {
    const s = snapshot({ cycleStage: "APPROVED", quarterlyDue: true, quarterlyStatus: "CHANGES_REQUESTED" });
    expect(deriveNextAction(s, "mentor", hrefs, "Ari").key).toBe("revise-quarterly-review");
  });

  it("puts committee approval on leadership, waiting on mentor", () => {
    const s = snapshot({ cycleStage: "APPROVED", quarterlyDue: true, quarterlyStatus: "PENDING_CHAIR_APPROVAL" });
    expect(deriveNextAction(s, "leadership", hrefs, "Ari").key).toBe("approve-quarterly-review");
    expect(deriveNextAction(s, "mentor", hrefs, "Ari").key).toBe("await-quarterly-approval");
  });

  it("puts board sign-off on leadership when required", () => {
    const s = snapshot({
      cycleStage: "APPROVED",
      quarterlyDue: true,
      quarterlyStatus: "PENDING_BOARD_APPROVAL",
      quarterlyRequiresBoardApproval: true,
    });
    expect(deriveNextAction(s, "leadership", hrefs, "Ari").key).toBe("board-approve-quarterly-review");
  });

  it("stops dominating once the quarterly review is approved", () => {
    const s = snapshot({ cycleStage: "APPROVED", releasedReviewPendingAck: false, quarterlyDue: true, quarterlyStatus: "APPROVED" });
    const mentor = deriveNextAction(s, "mentor", hrefs, "Ari");
    expect(mentor.key).not.toMatch(/quarterly/);
  });

  it("never surfaces quarterly actions off-cycle", () => {
    const s = snapshot({ cycleStage: "APPROVED", quarterlyDue: false });
    const mentor = deriveNextAction(s, "mentor", hrefs, "Ari");
    expect(mentor.key).not.toMatch(/quarterly/);
  });
});

describe("deriveReviewCapabilities — lifecycle capabilities beyond draft/approve/release", () => {
  const base = { isSelf: false, isAdmin: false, isMentor: false, isChair: false, isLeadership: false, canRecordCheckIn: false };

  it("gives the chair calibration, quarterly-review, and pathway-approval authority", () => {
    const caps = deriveReviewCapabilities({ ...base, isChair: true });
    expect(caps.canCalibratePoints).toBe(true);
    expect(caps.canRunQuarterlyReview).toBe(true);
    expect(caps.canApprovePathwayDecision).toBe(true);
    // Chair alone (not also the mentor) can recommend but the mentor is the primary author.
    expect(caps.canRecommendPathwayDecision).toBe(false);
  });

  it("gives the mentor pathway-recommendation and packet-visibility authority but not calibration/approval", () => {
    const caps = deriveReviewCapabilities({ ...base, isMentor: true });
    expect(caps.canRecommendPathwayDecision).toBe(true);
    expect(caps.canRunQuarterlyReview).toBe(true);
    expect(caps.canCalibratePoints).toBe(false);
    expect(caps.canApprovePathwayDecision).toBe(false);
  });

  it("gives leadership every lifecycle capability regardless of the direct pairing", () => {
    const caps = deriveReviewCapabilities({ ...base, isLeadership: true });
    expect(caps.canRunQuarterlyReview).toBe(true);
    expect(caps.canRecommendPathwayDecision).toBe(true);
    expect(caps.canApprovePathwayDecision).toBe(true);
  });

  it("denies every new capability to a plain mentee viewing their own record", () => {
    const caps = deriveReviewCapabilities({ ...base, isSelf: true });
    expect(caps.canCalibratePoints).toBe(false);
    expect(caps.canRunQuarterlyReview).toBe(false);
    expect(caps.canRecommendPathwayDecision).toBe(false);
    expect(caps.canApprovePathwayDecision).toBe(false);
  });

  it("admin gets full authority same as chair", () => {
    const caps = deriveReviewCapabilities({ ...base, isAdmin: true });
    expect(caps.canCalibratePoints).toBe(true);
    expect(caps.canApprovePathwayDecision).toBe(true);
  });
});
