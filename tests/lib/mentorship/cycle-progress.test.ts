import { describe, expect, it } from "vitest";

import {
  deriveParticipantStage,
  rollupCycleProgress,
  type ParticipantArtifacts,
} from "@/lib/mentorship/cycle-progress";
import type { ParticipantStage } from "@/lib/mentorship/cycle-constants";

function artifacts(
  overrides: Partial<ParticipantArtifacts> = {}
): ParticipantArtifacts {
  return {
    hasMentorship: true,
    reflectionSubmitted: false,
    reviewStatus: null,
    releasedToMentee: false,
    openFollowUpCount: 0,
    quarterlyReviewExists: false,
    stageOverride: null,
    ...overrides,
  };
}

describe("deriveParticipantStage — monthly", () => {
  it("blocks on a missing mentor before anything else", () => {
    expect(deriveParticipantStage("monthly", artifacts({ hasMentorship: false }))).toBe(
      "blocked-no-mentor"
    );
  });

  it("waits on self-input until the reflection is submitted", () => {
    expect(deriveParticipantStage("monthly", artifacts())).toBe("waiting-self-input");
  });

  it("waits on the review while there is none, a draft, or changes requested", () => {
    for (const reviewStatus of [null, "DRAFT", "CHANGES_REQUESTED"] as const) {
      expect(
        deriveParticipantStage(
          "monthly",
          artifacts({ reflectionSubmitted: true, reviewStatus })
        )
      ).toBe("waiting-review");
    }
  });

  it("is ready for the chair once submitted, and until actually released", () => {
    expect(
      deriveParticipantStage(
        "monthly",
        artifacts({ reflectionSubmitted: true, reviewStatus: "PENDING_CHAIR_APPROVAL" })
      )
    ).toBe("ready-for-chair");
    // APPROVED but not yet released is still in the chair's hands.
    expect(
      deriveParticipantStage(
        "monthly",
        artifacts({ reflectionSubmitted: true, reviewStatus: "APPROVED" })
      )
    ).toBe("ready-for-chair");
  });

  it("is released once approved + released, unless follow-ups remain open", () => {
    const released = artifacts({
      reflectionSubmitted: true,
      reviewStatus: "APPROVED",
      releasedToMentee: true,
    });
    expect(deriveParticipantStage("monthly", released)).toBe("released");
    expect(
      deriveParticipantStage("monthly", { ...released, openFollowUpCount: 2 })
    ).toBe("follow-ups-open");
  });

  it("honors a waive override regardless of artifacts", () => {
    expect(
      deriveParticipantStage(
        "monthly",
        artifacts({ hasMentorship: false, stageOverride: "waived" })
      )
    ).toBe("waived");
  });
});

describe("deriveParticipantStage — quarterly", () => {
  it("waits on the review until the quarterly row exists (no self-input stage)", () => {
    expect(deriveParticipantStage("quarterly", artifacts())).toBe("waiting-review");
  });

  it("completes on the quarterly review, unless follow-ups remain open", () => {
    expect(
      deriveParticipantStage("quarterly", artifacts({ quarterlyReviewExists: true }))
    ).toBe("released");
    expect(
      deriveParticipantStage(
        "quarterly",
        artifacts({ quarterlyReviewExists: true, openFollowUpCount: 1 })
      )
    ).toBe("follow-ups-open");
  });

  it("a missing mentor never blocks a quarterly review", () => {
    expect(
      deriveParticipantStage(
        "quarterly",
        artifacts({ hasMentorship: false, quarterlyReviewExists: true })
      )
    ).toBe("released");
  });
});

describe("rollupCycleProgress", () => {
  it("counts stages, treats released + waived as complete, and rounds pct", () => {
    const stages: ParticipantStage[] = [
      "waiting-self-input",
      "waiting-review",
      "ready-for-chair",
      "released",
      "released",
      "waived",
    ];
    const progress = rollupCycleProgress(stages);
    expect(progress.total).toBe(6);
    expect(progress.completed).toBe(3);
    expect(progress.pctComplete).toBe(50);
    expect(progress.counts["waiting-self-input"]).toBe(1);
    expect(progress.counts.released).toBe(2);
    expect(progress.counts.waived).toBe(1);
    expect(progress.counts["blocked-no-mentor"]).toBe(0);
  });

  it("headlines the most pressing incomplete stage", () => {
    const progress = rollupCycleProgress([
      "released",
      "ready-for-chair",
      "waiting-self-input",
    ]);
    expect(progress.headlineStage).toBe("waiting-self-input");
  });

  it("handles an empty cycle without claiming completion", () => {
    const progress = rollupCycleProgress([]);
    expect(progress.total).toBe(0);
    expect(progress.pctComplete).toBe(0);
    expect(progress.headlineStage).toBeNull();
  });

  it("headlines released when everyone is done", () => {
    const progress = rollupCycleProgress(["released", "waived"]);
    expect(progress.pctComplete).toBe(100);
    expect(progress.headlineStage).toBe("released");
  });
});
