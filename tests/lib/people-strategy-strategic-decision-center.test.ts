import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import { deriveDecisionCenter } from "@/lib/people-strategy/strategic-decision-center";

import { decision, NOW } from "./strategic-helpers";

describe("deriveDecisionCenter", () => {
  // NOW = 2026-06-04.
  const recentUnactioned = () =>
    decision({ decision: "Lock the four host sites", hasLinkedAction: false, createdAt: new Date("2026-06-01") });
  const oldUnactioned = () =>
    decision({ decision: "Pick a camp theme", hasLinkedAction: false, createdAt: new Date("2026-04-01") });
  const inMotion = () =>
    decision({ decision: "Approve materials budget", hasLinkedAction: true, createdAt: new Date("2026-06-01") });
  const followedThrough = () =>
    decision({ decision: "Choose the LMS", hasLinkedAction: true, createdAt: new Date("2026-03-01") });

  it("categorizes by provable follow-through state", () => {
    const c = deriveDecisionCenter(
      [recentUnactioned(), oldUnactioned(), inMotion(), followedThrough()],
      NOW
    );
    expect(c.stats.total).toBe(4);
    expect(c.needsFollowThrough).toHaveLength(2);
    expect(c.inMotion).toHaveLength(1);
    expect(c.followedThrough).toHaveLength(1);
    // critical = recent AND unactioned (the one most at risk of dying).
    expect(c.critical).toHaveLength(1);
    expect(c.critical[0].decision).toBe("Lock the four host sites");
  });

  it("computes the follow-through rate from actioned decisions", () => {
    const c = deriveDecisionCenter([recentUnactioned(), inMotion(), followedThrough()], NOW);
    // 2 of 3 became action.
    expect(c.stats.followThroughRate).toBe(67);
  });

  it("orders history newest-first", () => {
    const c = deriveDecisionCenter([followedThrough(), recentUnactioned()], NOW);
    expect(c.history[0].decision).toBe("Lock the four host sites");
  });

  it("is empty + safe with no decisions", () => {
    const c = deriveDecisionCenter([], NOW);
    expect(c.stats.total).toBe(0);
    expect(c.stats.followThroughRate).toBe(0);
    expect(c.history).toEqual([]);
  });
});
