import { describe, expect, it } from "vitest";

import {
  OPERATIONAL_QUEUE_KEYS,
  OPERATIONAL_QUEUE_LABELS,
  isReviewAwaitingDraft,
} from "@/lib/org/operational-queues-utils";

describe("operational queue registry", () => {
  it("labels every queue key", () => {
    for (const key of OPERATIONAL_QUEUE_KEYS) {
      expect(OPERATIONAL_QUEUE_LABELS[key]).toBeTruthy();
    }
  });

  it("includes the proposal's required queues", () => {
    expect(OPERATIONAL_QUEUE_KEYS).toContain("reviews-to-draft");
    expect(OPERATIONAL_QUEUE_KEYS).toContain("reviews-to-approve");
    expect(OPERATIONAL_QUEUE_KEYS).toContain("curriculum-to-review");
    expect(OPERATIONAL_QUEUE_KEYS).toContain("interviews-assigned");
    expect(OPERATIONAL_QUEUE_KEYS).toContain("missing-chapter");
  });
});

describe("isReviewAwaitingDraft", () => {
  it("is false without a submitted reflection", () => {
    expect(isReviewAwaitingDraft(null, false)).toBe(false);
    expect(isReviewAwaitingDraft("DRAFT", false)).toBe(false);
  });

  it("is true when a reflection is in but no review exists yet", () => {
    expect(isReviewAwaitingDraft(null, true)).toBe(true);
  });

  it("is true for a working draft or a returned review", () => {
    expect(isReviewAwaitingDraft("DRAFT", true)).toBe(true);
    expect(isReviewAwaitingDraft("CHANGES_REQUESTED", true)).toBe(true);
  });

  it("is false once submitted for approval or approved", () => {
    expect(isReviewAwaitingDraft("PENDING_CHAIR_APPROVAL", true)).toBe(false);
    expect(isReviewAwaitingDraft("APPROVED", true)).toBe(false);
  });
});
