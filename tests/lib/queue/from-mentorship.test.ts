import { describe, expect, it } from "vitest";

import {
  queueItemsFromMentorshipApplications,
  queueItemsFromMentorshipFacts,
} from "@/lib/queue/from-mentorship";
import type {
  MentorshipRelationshipFact,
  MentorshipViewModelInput,
} from "@/lib/mentorship/view-model";

const NOW = new Date("2026-06-17T12:00:00.000Z");

function fact(overrides: Partial<MentorshipRelationshipFact> = {}): MentorshipRelationshipFact {
  return {
    id: "ms-1",
    mentorId: "mentor-1",
    mentorName: "Morgan",
    menteeId: "mentee-1",
    menteeName: "Sam",
    chairId: "chair-1",
    status: "ACTIVE",
    cycleStage: "APPROVED",
    cycleNumber: 1,
    releasedColorStatus: null,
    kickoffCompleted: true,
    reflectionDue: false,
    meetingDue: false,
    reviewDue: false,
    reviewPendingChairApproval: false,
    reviewChangesRequested: false,
    lastActivityISO: null,
    sessions: [],
    goals: [],
    commitments: [],
    feedback: [],
    support: [],
    ...overrides,
  };
}

function input(
  viewerId: string,
  facts: MentorshipRelationshipFact[],
  opts: { isAdmin?: boolean; isChair?: boolean } = {}
): MentorshipViewModelInput {
  return {
    viewer: { userId: viewerId, isAdmin: opts.isAdmin ?? false, isChair: opts.isChair ?? false },
    relationships: facts,
  };
}

describe("queueItemsFromMentorshipFacts", () => {
  it("emits a review-due loop for the mentor when a reflection is in", () => {
    const items = queueItemsFromMentorshipFacts(
      input("mentor-1", [fact({ cycleStage: "REFLECTION_SUBMITTED", reviewDue: true })]),
      NOW
    );
    const review = items.find((i) => i.id === "ment:review:ms-1");
    expect(review).toBeDefined();
    expect(review!.type).toBe("mentorship");
    expect(review!.primaryAction.href).toBe("/mentorship/people/mentee-1?section=reviews");
    expect(review!.signals.mine).toBe(true);
    expect(review!.inline).toBeNull();
  });

  it("emits a changes-requested and kickoff loop, but only for the mentor", () => {
    const facts = [fact({ reviewChangesRequested: true, kickoffCompleted: false, cycleStage: "KICKOFF_PENDING" })];
    const mentorItems = queueItemsFromMentorshipFacts(input("mentor-1", facts), NOW);
    expect(mentorItems.map((i) => i.id)).toEqual(
      expect.arrayContaining(["ment:changes_requested:ms-1", "ment:kickoff:ms-1"])
    );

    // A bystander officer with no role on the pairing gets nothing.
    const strangerItems = queueItemsFromMentorshipFacts(input("someone-else", facts), NOW);
    expect(strangerItems).toHaveLength(0);
  });

  it("gives the chair the approval loop, not the mentor", () => {
    const facts = [fact({ cycleStage: "REVIEW_SUBMITTED", reviewPendingChairApproval: true })];
    const chairItems = queueItemsFromMentorshipFacts(input("chair-1", facts), NOW);
    expect(chairItems.map((i) => i.id)).toContain("ment:chair_approval:ms-1");

    const mentorItems = queueItemsFromMentorshipFacts(input("mentor-1", facts), NOW);
    expect(mentorItems.map((i) => i.id)).not.toContain("ment:chair_approval:ms-1");
  });

  it("makes an overdue commitment an inline-completable loop, ignoring on-time ones", () => {
    const facts = [
      fact({
        commitments: [
          { id: "c-late", title: "Send outline", status: "OPEN", ownerId: "mentor-1", ownerName: "Morgan", dueISO: "2026-06-01T00:00:00.000Z" },
          { id: "c-soon", title: "Future task", status: "OPEN", ownerId: "mentor-1", ownerName: "Morgan", dueISO: "2026-12-01T00:00:00.000Z" },
          { id: "c-done", title: "Done task", status: "COMPLETE", ownerId: "mentor-1", ownerName: "Morgan", dueISO: "2026-01-01T00:00:00.000Z" },
        ],
      }),
    ];
    const items = queueItemsFromMentorshipFacts(input("mentor-1", facts), NOW);
    const commitmentLoops = items.filter((i) => i.id.startsWith("ment:commitment:"));
    expect(commitmentLoops).toHaveLength(1);
    expect(commitmentLoops[0].id).toBe("ment:commitment:c-late");
    expect(commitmentLoops[0].signals.overdue).toBe(true);
    expect(commitmentLoops[0].inline).toEqual({
      kind: "mentorship_commitment",
      actionItemId: "c-late",
      menteeId: "mentee-1",
      title: "Send outline",
    });
  });

  it("surfaces an open support request assigned to the viewer", () => {
    const facts = [
      fact({
        support: [
          { id: "req-1", title: "Need help with a pitch", status: "OPEN", assignedToId: "mentor-1", requesterId: "mentee-1" },
          { id: "req-2", title: "Assigned elsewhere", status: "OPEN", assignedToId: "other", requesterId: "mentee-1" },
        ],
      }),
    ];
    const items = queueItemsFromMentorshipFacts(input("mentor-1", facts), NOW);
    const support = items.filter((i) => i.id.startsWith("ment:support:"));
    expect(support).toHaveLength(1);
    expect(support[0].id).toBe("ment:support:req-1");
  });

  it("produces no loops for a paused relationship", () => {
    const items = queueItemsFromMentorshipFacts(
      input("mentor-1", [fact({ status: "PAUSED", reviewDue: true, cycleStage: "REFLECTION_SUBMITTED" })]),
      NOW
    );
    expect(items).toHaveLength(0);
  });
});

describe("queueItemsFromMentorshipApplications", () => {
  it("splits open applications into needs-recommendations and decision loops", () => {
    const items = queueItemsFromMentorshipApplications([
      { id: "a1", applicantName: "New A", bucket: "new" },
      { id: "a2", applicantName: "Review A", bucket: "needsRecommendations" },
      { id: "a3", applicantName: "Scored A", bucket: "hasRecommendations" },
      { id: "a4", applicantName: "Finalist A", bucket: "shortlisted" },
      { id: "a5", applicantName: "Parked A", bucket: "held" },
    ]);

    const ids = items.map((i) => i.id);
    expect(ids).toContain("ment:m2_needs_recs:a1");
    expect(ids).toContain("ment:m2_needs_recs:a2");
    expect(ids).toContain("ment:m2_decision:a3");
    expect(ids).toContain("ment:m2_decision:a4");
    // Held applications were parked on purpose — not a loop.
    expect(ids).not.toContain("ment:m2_needs_recs:a5");
    expect(ids).not.toContain("ment:m2_decision:a5");

    const decision = items.find((i) => i.id === "ment:m2_decision:a3");
    // The dominant move opens the application to decide, not a generic meeting.
    expect(decision!.primaryAction.resolution).toBe("resolve");
    expect(decision!.primaryAction.href).toBe("/admin/mentorship/applications/a3");
  });
});
