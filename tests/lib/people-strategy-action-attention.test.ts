import { describe, expect, it } from "vitest";

import {
  actionDataQuality,
  deriveActionSignals,
  leadershipActionAttention,
  personalActionAttention,
  summarizeActionAttention,
} from "@/lib/people-strategy/action-attention";

import { NOW, actionItem, assignment } from "./people-strategy-action-fixtures";

const DAY = 86_400_000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

const kinds = (signals: { kind: string }[]) => signals.map((s) => s.kind);
const issues = (flags: { kind: string }[]) => flags.map((f) => f.kind);

describe("deriveActionSignals", () => {
  it("flags an overdue action as critical with a next step", () => {
    const signals = deriveActionSignals(
      actionItem({ status: "IN_PROGRESS", deadlineStart: days(-5) }),
      NOW
    );
    const overdue = signals.find((s) => s.kind === "overdue");
    expect(overdue?.severity).toBe("critical");
    expect(overdue?.reason).toContain("Overdue by 5 days");
    expect(overdue?.nextStep).toBeTruthy();
  });

  it("flags a blocked action and surfaces the blocker reason", () => {
    const signals = deriveActionSignals(
      actionItem({ status: "BLOCKED", deadlineStart: days(20), blockedReason: "waiting on vendor" }),
      NOW
    );
    const blocked = signals.find((s) => s.kind === "blocked");
    expect(blocked?.severity).toBe("high");
    expect(blocked?.reason).toContain("waiting on vendor");
  });

  it("flags a missing accountable lead", () => {
    const signals = deriveActionSignals(
      actionItem({ leadId: null, assignments: [assignment("x", "EXECUTING")] }),
      NOW
    );
    expect(kinds(signals)).toContain("missing_lead");
  });

  it("flags a lead with no executor", () => {
    const signals = deriveActionSignals(
      actionItem({ leadId: "lead-1", assignments: [assignment("lead-1", "LEAD")], deadlineStart: days(20) }),
      NOW
    );
    expect(kinds(signals)).toContain("missing_executor");
  });

  it("flags an escalated action", () => {
    const signals = deriveActionSignals(
      actionItem({ deadlineStart: days(20), escalatedToLeadershipAt: days(-2) }),
      NOW
    );
    expect(kinds(signals)).toContain("escalated");
  });

  it("flags a stale action with no recent activity", () => {
    const signals = deriveActionSignals(
      actionItem({ status: "IN_PROGRESS", deadlineStart: days(30), updatedAt: days(-30) }),
      NOW
    );
    expect(kinds(signals)).toContain("stale");
  });

  it("emits nothing for a settled (COMPLETE) action", () => {
    expect(
      deriveActionSignals(actionItem({ status: "COMPLETE", deadlineStart: days(-5) }), NOW)
    ).toHaveLength(0);
  });

  it("does not double-count stale when the action is already overdue", () => {
    const signals = deriveActionSignals(
      actionItem({ status: "IN_PROGRESS", deadlineStart: days(-5), updatedAt: days(-40) }),
      NOW
    );
    expect(kinds(signals)).toContain("overdue");
    expect(kinds(signals)).not.toContain("stale");
  });
});

describe("personalActionAttention / leadershipActionAttention", () => {
  const overdueMine = actionItem({
    id: "mine",
    status: "IN_PROGRESS",
    deadlineStart: days(-3),
    leadId: "me",
    assignments: [assignment("me", "LEAD")],
  });
  const overdueTheirs = actionItem({
    id: "theirs",
    status: "IN_PROGRESS",
    deadlineStart: days(-3),
    leadId: "other",
    assignments: [assignment("other", "LEAD")],
  });

  it("personal feed only includes actions the viewer is involved in", () => {
    const signals = personalActionAttention([overdueMine, overdueTheirs], "me", NOW);
    expect(signals.every((s) => s.actionId === "mine")).toBe(true);
  });

  it("leadership feed includes everyone's stuck work, most severe first", () => {
    const signals = leadershipActionAttention([overdueMine, overdueTheirs], NOW);
    const ids = new Set(signals.map((s) => s.actionId));
    expect(ids.has("mine")).toBe(true);
    expect(ids.has("theirs")).toBe(true);
    expect(signals[0].severity).toBe("critical");
  });

  it("summarizes counts by severity", () => {
    const summary = summarizeActionAttention(
      leadershipActionAttention([overdueMine, overdueTheirs], NOW)
    );
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.bySeverity.critical).toBe(2);
  });
});

describe("actionDataQuality", () => {
  it("flags ownerless, dateless, and unnoted-blocked work", () => {
    const flags = actionDataQuality(
      [
        actionItem({ id: "a", leadId: null, assignments: [] }),
        actionItem({ id: "b", status: "BLOCKED", blockedReason: null, leadId: "l", assignments: [assignment("l", "LEAD"), assignment("e", "EXECUTING")] }),
      ],
      NOW
    );
    expect(issues(flags)).toContain("no_lead");
    expect(issues(flags)).toContain("blocked_without_note");
  });

  it("flags an action overdue past the grace period with no escalation", () => {
    const flags = actionDataQuality(
      [
        actionItem({
          id: "c",
          status: "IN_PROGRESS",
          deadlineStart: days(-10),
          escalatedToLeadershipAt: null,
          leadId: "l",
          assignments: [assignment("l", "LEAD"), assignment("e", "EXECUTING")],
        }),
      ],
      NOW
    );
    expect(issues(flags)).toContain("overdue_not_escalated");
  });

  it("ignores settled actions", () => {
    expect(
      actionDataQuality([actionItem({ status: "COMPLETE", leadId: null, assignments: [] })], NOW)
    ).toHaveLength(0);
  });
});
