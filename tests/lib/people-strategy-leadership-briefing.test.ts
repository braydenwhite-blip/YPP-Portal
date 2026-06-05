import { describe, expect, it } from "vitest";

import {
  buildLeadershipBriefing,
  type LeadershipBriefingInput,
} from "@/lib/people-strategy/leadership-briefing";
import type {
  AttentionEntry,
  PersonMomentum,
  WeeklyPulse,
  WinEntry,
} from "@/lib/people-strategy/command-center-selectors";

const weekStart = new Date("2026-06-01T00:00:00.000Z"); // Monday

function pulse(overrides: Partial<WeeklyPulse> = {}): WeeklyPulse {
  return {
    weekStart,
    openTotal: 12,
    completedThisWeek: 3,
    overdue: 2,
    flagged: 1,
    blocked: 1,
    dueThisWeek: 4,
    unowned: 2,
    ...overrides,
  };
}

function attentionEntry(over: Partial<AttentionEntry> = {}): AttentionEntry {
  return {
    id: "a1",
    title: "Finalize fall syllabus",
    reason: "Overdue 4 days",
    severity: "high",
    priority: "HIGH",
    ownerName: "Avery Lin",
    departmentName: "Instructional Affairs",
    daysOverdue: 4,
    dueLabel: "Jun 1",
    ...over,
  } as AttentionEntry;
}

function person(over: Partial<PersonMomentum> = {}): PersonMomentum {
  return {
    id: "u1",
    name: "Jordan Patel",
    email: "jordan@example.com",
    role: "STAFF",
    avatarUrl: null,
    overloaded: false,
    momentum: {
      label: "AT_RISK",
      score: -4,
      factors: { openCount: 6, completedRecent: 0, overdue: 3, flagged: 1, hasRecentActivity: false },
    },
    ...over,
  };
}

function win(over: Partial<WinEntry> = {}): WinEntry {
  return {
    id: "w1",
    title: "Launched mentor onboarding",
    ownerName: "Milo Wald",
    departmentName: null,
    completedLabel: "Jun 3",
    ...over,
  } as WinEntry;
}

function input(over: Partial<LeadershipBriefingInput> = {}): LeadershipBriefingInput {
  return {
    weekStart,
    pulse: pulse(),
    attention: [attentionEntry()],
    needsSupport: [person()],
    wins: [win()],
    consideredCount: 12,
    ...over,
  };
}

describe("buildLeadershipBriefing", () => {
  it("renders a titled briefing with the week label and action count", () => {
    const text = buildLeadershipBriefing(input());
    expect(text).toContain("Weekly Leadership Briefing");
    expect(text).toContain("Week of Jun 1");
    expect(text).toContain("based on 12 actions");
  });

  it("includes the pulse numbers on one line", () => {
    const text = buildLeadershipBriefing(input());
    expect(text).toContain("12 open · 2 overdue · 4 due this week");
    expect(text).toContain("3 completed this week");
  });

  it("lists the top attention items with reason, owner and due date", () => {
    const text = buildLeadershipBriefing(input());
    expect(text).toContain("[Overdue 4 days] Finalize fall syllabus — Avery Lin · Instructional Affairs · due Jun 1");
  });

  it("caps the attention section and notes the overflow", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      attentionEntry({ id: `a${i}`, title: `Item ${i}` })
    );
    const text = buildLeadershipBriefing(input({ attention: many }));
    expect(text).toContain("**Needs attention** (8)");
    expect(text).toContain("…and 3 more");
    // Only the first 5 titles appear.
    expect(text).toContain("Item 0");
    expect(text).not.toContain("Item 5");
  });

  it("summarizes who needs support with the friendly momentum label", () => {
    const text = buildLeadershipBriefing(input());
    expect(text).toContain("Jordan Patel — 6 open, 3 overdue (At Risk)");
  });

  it("lists wins with a checkmark and completion label", () => {
    const text = buildLeadershipBriefing(input());
    expect(text).toContain("✓ Launched mentor onboarding — Milo Wald (Jun 3)");
  });

  it("shows reassuring empty states for each section when nothing is pending", () => {
    const text = buildLeadershipBriefing(
      input({ attention: [], needsSupport: [], wins: [] })
    );
    expect(text).toContain("Nothing flagged");
    expect(text).toContain("healthy momentum");
    expect(text).toContain("None logged yet");
  });

  it("returns a short nothing-to-report note when there are no visible actions", () => {
    const text = buildLeadershipBriefing(input({ consideredCount: 0 }));
    expect(text).toContain("based on 0 actions");
    expect(text).toContain("nothing to report");
    // It should not render the full section scaffolding.
    expect(text).not.toContain("**Pulse**");
  });
});
