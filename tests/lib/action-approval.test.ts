import { describe, expect, it } from "vitest";

import {
  APPROVED_HUB_GRACE_MS,
  filterActiveHubItems,
  filterApprovedHubItems,
  isRecentlyApprovedOnHub,
  isWaitingForActionApproval,
  showOnActiveHub,
} from "@/lib/people-strategy/action-approval";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";

function item(
  overrides: Partial<ActionItemWithRelations> & Pick<ActionItemWithRelations, "status">
): ActionItemWithRelations {
  return {
    id: "a1",
    title: "Test",
    approvedAt: null,
    approvedById: null,
    ...overrides,
  } as ActionItemWithRelations;
}

describe("action-approval", () => {
  const now = new Date("2026-06-22T12:00:00.000Z");

  it("detects waiting for approval", () => {
    expect(isWaitingForActionApproval({ status: "COMPLETE", approvedAt: null })).toBe(true);
    expect(
      isWaitingForActionApproval({ status: "COMPLETE", approvedAt: new Date() })
    ).toBe(false);
  });

  it("keeps recently approved items on the active hub", () => {
    const approvedAt = new Date(now.getTime() - 60_000);
    expect(isRecentlyApprovedOnHub({ status: "COMPLETE", approvedAt }, now)).toBe(true);
    expect(showOnActiveHub({ status: "COMPLETE", approvedAt }, now)).toBe(true);
  });

  it("rolls approved items off the active hub and approved tab after the grace window", () => {
    const approvedAt = new Date(now.getTime() - APPROVED_HUB_GRACE_MS - 1);
    expect(showOnActiveHub({ status: "COMPLETE", approvedAt }, now)).toBe(false);
    expect(isRecentlyApprovedOnHub({ status: "COMPLETE", approvedAt }, now)).toBe(false);
    expect(filterApprovedHubItems([item({ status: "COMPLETE", approvedAt })], now)).toHaveLength(
      0
    );
    expect(filterActiveHubItems([item({ status: "COMPLETE", approvedAt })], now)).toHaveLength(
      0
    );
  });

  it("shows recently approved items on the approved tab", () => {
    const approvedAt = new Date(now.getTime() - 60_000);
    expect(filterApprovedHubItems([item({ status: "COMPLETE", approvedAt })], now)).toHaveLength(
      1
    );
  });
});
