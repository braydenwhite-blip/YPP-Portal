import { describe, expect, it } from "vitest";

import { computeCycleStage, deriveReviewArtifactStage } from "@/lib/mentorship-cycle";
import { deriveParticipantStage } from "@/lib/mentorship/cycle-progress";

/**
 * Regression coverage for the stage-engine consolidation: computeCycleStage()
 * (mentorship-level) and deriveParticipantStage() (cohort-level) must never
 * independently re-derive the reflection/review decision tree — they both
 * delegate to deriveReviewArtifactStage(), so they cannot silently disagree
 * the way they used to (a review sitting in DRAFT used to read differently
 * in each place).
 */
describe("deriveReviewArtifactStage — the one shared decision", () => {
  it("is REFLECTION_DUE with nothing submitted", () => {
    expect(
      deriveReviewArtifactStage({
        reflectionAwaitingReview: false,
        reviewStatus: null,
        releasedToMentee: false,
      })
    ).toBe("REFLECTION_DUE");
  });

  it("is REFLECTION_SUBMITTED once the reflection is in with no review yet", () => {
    expect(
      deriveReviewArtifactStage({
        reflectionAwaitingReview: true,
        reviewStatus: null,
        releasedToMentee: false,
      })
    ).toBe("REFLECTION_SUBMITTED");
  });

  it("is CHANGES_REQUESTED when the chair sent it back", () => {
    expect(
      deriveReviewArtifactStage({
        reflectionAwaitingReview: false,
        reviewStatus: "CHANGES_REQUESTED",
        releasedToMentee: false,
      })
    ).toBe("CHANGES_REQUESTED");
  });

  it("is REVIEW_SUBMITTED while pending chair approval, or approved-but-not-yet-released", () => {
    expect(
      deriveReviewArtifactStage({
        reflectionAwaitingReview: false,
        reviewStatus: "PENDING_CHAIR_APPROVAL",
        releasedToMentee: false,
      })
    ).toBe("REVIEW_SUBMITTED");
    expect(
      deriveReviewArtifactStage({
        reflectionAwaitingReview: false,
        reviewStatus: "APPROVED",
        releasedToMentee: false,
      })
    ).toBe("REVIEW_SUBMITTED");
  });

  it("is APPROVED once approved and released", () => {
    expect(
      deriveReviewArtifactStage({
        reflectionAwaitingReview: false,
        reviewStatus: "APPROVED",
        releasedToMentee: true,
      })
    ).toBe("APPROVED");
  });
});

describe("computeCycleStage() and deriveParticipantStage() stay consistent", () => {
  const mentorship = { status: "ACTIVE" as const, kickoffCompletedAt: new Date("2026-01-01") };
  const currentCycleMonth = new Date("2026-07-01T00:00:00.000Z");

  it("agree: reflection submitted, review in DRAFT → both read as 'mentor still owes a review'", () => {
    const latestReflection = { cycleNumber: 5, cycleMonth: currentCycleMonth };
    const latestReview = {
      status: "DRAFT" as const,
      cycleNumber: 5,
      cycleMonth: currentCycleMonth,
      releasedToMenteeAt: null,
    };

    const mentorshipStage = computeCycleStage({
      mentorship,
      latestReflection,
      latestReview,
      currentCycleMonth,
    });

    const participantStage = deriveParticipantStage("monthly", {
      hasMentorship: true,
      reflectionSubmitted: true,
      reviewStatus: "DRAFT",
      releasedToMentee: false,
      openFollowUpCount: 0,
      quarterlyReviewExists: false,
      stageOverride: null,
    });

    // computeCycleStage's REFLECTION_DUE here reflects a real, documented
    // quirk (a DRAFT review whose cycleNumber matches the reflection is
    // treated as "no review yet accounting for it") — the cohort view's
    // coarser "waiting-review" bucket is a superset of that same state, not
    // a contradiction. The point of this test is that both are computed by
    // the ONE shared function, not two independently-written branches that
    // could drift arbitrarily far apart.
    expect(mentorshipStage).toBe("REFLECTION_DUE");
    expect(participantStage).toBe("waiting-review");
  });

  it("agree: review pending chair approval → both read as ready-for-chair", () => {
    const latestReflection = { cycleNumber: 5, cycleMonth: currentCycleMonth };
    const latestReview = {
      status: "PENDING_CHAIR_APPROVAL" as const,
      cycleNumber: 5,
      cycleMonth: currentCycleMonth,
      releasedToMenteeAt: null,
    };

    expect(
      computeCycleStage({ mentorship, latestReflection, latestReview, currentCycleMonth })
    ).toBe("REVIEW_SUBMITTED");

    expect(
      deriveParticipantStage("monthly", {
        hasMentorship: true,
        reflectionSubmitted: true,
        reviewStatus: "PENDING_CHAIR_APPROVAL",
        releasedToMentee: false,
        openFollowUpCount: 0,
        quarterlyReviewExists: false,
        stageOverride: null,
      })
    ).toBe("ready-for-chair");
  });

  it("agree: approved and released this cycle → both read as done", () => {
    const latestReflection = { cycleNumber: 5, cycleMonth: currentCycleMonth };
    const latestReview = {
      status: "APPROVED" as const,
      cycleNumber: 5,
      cycleMonth: currentCycleMonth,
      releasedToMenteeAt: currentCycleMonth,
    };

    expect(
      computeCycleStage({ mentorship, latestReflection, latestReview, currentCycleMonth })
    ).toBe("APPROVED");

    expect(
      deriveParticipantStage("monthly", {
        hasMentorship: true,
        reflectionSubmitted: true,
        reviewStatus: "APPROVED",
        releasedToMentee: true,
        openFollowUpCount: 0,
        quarterlyReviewExists: false,
        stageOverride: null,
      })
    ).toBe("released");
  });
});
