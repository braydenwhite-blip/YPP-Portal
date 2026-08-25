import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  canApproveActionCompletion,
  filterActiveHubItems,
  filterArchivedItems,
  isArchivedAction,
  isPendingCompletionApproval,
  pendingApprovalQueue,
  showOnActiveHub,
} from "@/lib/people-strategy/action-approval";

function item(overrides: Partial<ActionItemWithRelations> = {}): ActionItemWithRelations {
  return {
    id: "a1",
    status: "NOT_STARTED",
    approvedAt: null,
    approvedById: null,
    ...overrides,
  } as ActionItemWithRelations;
}

describe("action hub visibility", () => {
  it("shows open work and pending approvals on the active hub", () => {
    expect(showOnActiveHub({ status: "NOT_STARTED" })).toBe(true);
    expect(showOnActiveHub({ status: "IN_PROGRESS" })).toBe(true);
    expect(showOnActiveHub({ status: "BLOCKED" })).toBe(true);
    expect(
      showOnActiveHub({ status: "COMPLETE", approvedAt: null }),
    ).toBe(true);
  });

  it("hides approved completions and dropped items from the active hub", () => {
    expect(showOnActiveHub({ status: "DROPPED" })).toBe(false);
    expect(
      showOnActiveHub({ status: "COMPLETE", approvedAt: new Date() }),
    ).toBe(false);
    expect(filterActiveHubItems([item({ status: "COMPLETE", approvedAt: new Date() })])).toHaveLength(0);
    expect(filterActiveHubItems([item({ status: "DROPPED" })])).toHaveLength(0);
    expect(
      filterActiveHubItems([item({ status: "COMPLETE", approvedAt: null })]),
    ).toHaveLength(1);
  });

  it("archives approved completions and dropped items", () => {
    expect(isArchivedAction({ status: "DROPPED" })).toBe(true);
    expect(
      isArchivedAction({ status: "COMPLETE", approvedAt: new Date() }),
    ).toBe(true);
    expect(isArchivedAction({ status: "COMPLETE", approvedAt: null })).toBe(false);
    expect(
      filterArchivedItems([item({ status: "COMPLETE", approvedAt: new Date() })]),
    ).toHaveLength(1);
    expect(filterArchivedItems([item({ status: "IN_PROGRESS" })])).toHaveLength(0);
  });

  it("detects pending completion approval", () => {
    expect(isPendingCompletionApproval({ status: "COMPLETE", approvedAt: null })).toBe(true);
    expect(
      isPendingCompletionApproval({ status: "COMPLETE", approvedAt: new Date() }),
    ).toBe(false);
  });

  it("allows officer-tier users to approve completions", () => {
    expect(
      canApproveActionCompletion({ id: "u1", roles: ["STAFF"], primaryRole: "STAFF" }),
    ).toBe(true);
    expect(
      canApproveActionCompletion({ id: "u1", roles: ["INSTRUCTOR"], primaryRole: "INSTRUCTOR" }),
    ).toBe(false);
  });

  it("builds a pending approval queue from submitted completions", () => {
    expect(
      pendingApprovalQueue([
        item({
          id: "a1",
          title: "Call families",
          status: "COMPLETE",
          approvedAt: null,
          completedAt: new Date("2026-08-01T12:00:00.000Z"),
          lead: { name: "Alex Lead", email: "alex@ypp.org" },
          department: { id: "d1", name: "Instruction", slug: "instruction" },
          chapter: { id: "c1", name: "Scarsdale", lifecycleStatus: "ACTIVE" },
        }),
        item({ id: "a2", status: "IN_PROGRESS" }),
        item({ id: "a3", status: "COMPLETE", approvedAt: new Date() }),
      ]),
    ).toEqual([
      {
        id: "a1",
        title: "Call families",
        leadName: "Alex Lead",
        department: "Instruction",
        chapter: "Scarsdale",
        submittedAt: "2026-08-01T12:00:00.000Z",
      },
    ]);
  });
});
