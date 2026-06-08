import { describe, expect, it } from "vitest";

import {
  computeDashboardMetrics,
  computeDepartmentPulse,
  computeFollowUpStatus,
  computeMeetingStatus,
  groupMeetingsForWeek,
  openFollowUpCount,
  overdueFollowUpCount,
  weekRangeForOffset,
  type FollowUpView,
  type MeetingView,
} from "@/lib/people-strategy/meetings-status";

// Fixed "now": Monday, June 8 2026, 3:00 PM local.
const NOW = new Date(2026, 5, 8, 15, 0, 0);

function followUp(overrides: Partial<FollowUpView> = {}): FollowUpView {
  return {
    id: "f_" + Math.random().toString(36).slice(2),
    status: "OPEN",
    dueDate: new Date(2026, 5, 12, 12, 0, 0),
    area: "CHAPTERS",
    priority: "MEDIUM",
    ...overrides,
  };
}

function meeting(overrides: Partial<MeetingView> = {}): MeetingView {
  return {
    id: "m_" + Math.random().toString(36).slice(2),
    storedStatus: "SCHEDULED",
    start: new Date(2026, 5, 8, 18, 0, 0), // today 6pm
    end: new Date(2026, 5, 8, 19, 0, 0),
    category: "LEADERSHIP",
    followUps: [],
    decisionCount: 0,
    agendaCount: 0,
    agendaDoneCount: 0,
    openLinkedActionCount: 0,
    ...overrides,
  };
}

describe("computeFollowUpStatus", () => {
  it("is overdue when past due and not completed", () => {
    expect(
      computeFollowUpStatus({ status: "OPEN", dueDate: new Date(2026, 5, 6) }, NOW)
    ).toBe("overdue");
    expect(
      computeFollowUpStatus({ status: "IN_PROGRESS", dueDate: new Date(2026, 5, 6) }, NOW)
    ).toBe("overdue");
  });

  it("respects completion over an overdue date", () => {
    expect(
      computeFollowUpStatus({ status: "COMPLETED", dueDate: new Date(2026, 5, 1) }, NOW)
    ).toBe("completed");
  });

  it("maps open / in-progress when not yet due", () => {
    expect(
      computeFollowUpStatus({ status: "OPEN", dueDate: new Date(2026, 5, 12) }, NOW)
    ).toBe("open");
    expect(
      computeFollowUpStatus({ status: "IN_PROGRESS", dueDate: new Date(2026, 5, 12) }, NOW)
    ).toBe("in_progress");
  });

  it("treats a due-today item as still open (not overdue)", () => {
    expect(
      computeFollowUpStatus({ status: "OPEN", dueDate: new Date(2026, 5, 8, 9) }, NOW)
    ).toBe("open");
  });

  it("never overdue without a due date", () => {
    expect(computeFollowUpStatus({ status: "OPEN", dueDate: null }, NOW)).toBe("open");
  });
});

describe("open / overdue follow-up counts", () => {
  const m = meeting({
    followUps: [
      followUp({ status: "OPEN", dueDate: new Date(2026, 5, 5) }), // overdue
      followUp({ status: "IN_PROGRESS", dueDate: new Date(2026, 5, 14) }), // open
      followUp({ status: "COMPLETED", dueDate: new Date(2026, 5, 1) }), // done
    ],
  });
  it("counts open (not completed) follow-ups", () => {
    expect(openFollowUpCount(m)).toBe(2);
  });
  it("counts overdue follow-ups", () => {
    expect(overdueFollowUpCount(m, NOW)).toBe(1);
  });
});

describe("computeMeetingStatus", () => {
  it("canceled wins over everything", () => {
    expect(computeMeetingStatus(meeting({ storedStatus: "CANCELLED" }), NOW)).toBe("canceled");
  });

  it("completed with open follow-ups becomes needs_follow_up", () => {
    const m = meeting({
      storedStatus: "COMPLETED",
      followUps: [followUp({ status: "OPEN" })],
    });
    expect(computeMeetingStatus(m, NOW)).toBe("needs_follow_up");
  });

  it("completed with all follow-ups done is completed", () => {
    const m = meeting({
      storedStatus: "COMPLETED",
      followUps: [followUp({ status: "COMPLETED" })],
    });
    expect(computeMeetingStatus(m, NOW)).toBe("completed");
  });

  it("in progress when now is inside the meeting window", () => {
    const m = meeting({
      start: new Date(2026, 5, 8, 14, 30),
      end: new Date(2026, 5, 8, 15, 30),
    });
    expect(computeMeetingStatus(m, NOW)).toBe("in_progress");
  });

  it("today when scheduled later today", () => {
    const m = meeting({ start: new Date(2026, 5, 8, 18), end: new Date(2026, 5, 8, 19) });
    expect(computeMeetingStatus(m, NOW)).toBe("today");
  });

  it("upcoming when scheduled in the future", () => {
    const m = meeting({ start: new Date(2026, 5, 10, 18), end: new Date(2026, 5, 10, 19) });
    expect(computeMeetingStatus(m, NOW)).toBe("upcoming");
  });

  it("past scheduled meeting with open follow-ups needs follow-up", () => {
    const m = meeting({
      start: new Date(2026, 5, 5, 18),
      end: new Date(2026, 5, 5, 19),
      followUps: [followUp({ status: "OPEN", dueDate: new Date(2026, 5, 6) })],
    });
    expect(computeMeetingStatus(m, NOW)).toBe("needs_follow_up");
  });
});

describe("groupMeetingsForWeek", () => {
  it("buckets meetings into exactly one section each", () => {
    const today = meeting({ start: new Date(2026, 5, 8, 18), end: new Date(2026, 5, 8, 19) });
    const upcoming = meeting({ start: new Date(2026, 5, 11, 18), end: new Date(2026, 5, 11, 19) });
    const completed = meeting({ storedStatus: "COMPLETED", followUps: [followUp({ status: "COMPLETED" })] });
    const needs = meeting({ storedStatus: "COMPLETED", followUps: [followUp({ status: "OPEN" })] });

    const grouped = groupMeetingsForWeek([today, upcoming, completed, needs], NOW);
    expect(grouped.today).toHaveLength(1);
    expect(grouped.upcoming).toHaveLength(1);
    expect(grouped.completed).toHaveLength(1);
    expect(grouped.needsFollowUp).toHaveLength(1);
    const total =
      grouped.today.length +
      grouped.upcoming.length +
      grouped.completed.length +
      grouped.needsFollowUp.length;
    expect(total).toBe(4);
  });
});

describe("computeDashboardMetrics", () => {
  it("computes the six headline metrics", () => {
    const meetings = [
      meeting({
        start: new Date(2026, 5, 8, 18),
        end: new Date(2026, 5, 8, 19),
        decisionCount: 2,
        followUps: [
          followUp({ status: "OPEN", dueDate: new Date(2026, 5, 5) }), // overdue
          followUp({ status: "OPEN", dueDate: new Date(2026, 5, 13) }), // open
        ],
      }),
      meeting({
        storedStatus: "COMPLETED",
        start: new Date(2026, 5, 9, 15),
        end: new Date(2026, 5, 9, 16),
        decisionCount: 1,
        followUps: [followUp({ status: "OPEN", dueDate: new Date(2026, 5, 4) })], // overdue → needs_follow_up
      }),
    ];
    const metrics = computeDashboardMetrics(meetings, NOW);
    expect(metrics.meetingsThisWeek).toBe(2);
    expect(metrics.meetingsToday).toBe(1);
    expect(metrics.needsFollowUp).toBe(1);
    expect(metrics.openMeetingActions).toBe(3);
    expect(metrics.overdueFollowUps).toBe(2);
    expect(metrics.decisionsLogged).toBe(3);
  });

  it("returns all zeros for no meetings", () => {
    expect(computeDashboardMetrics([], NOW)).toEqual({
      meetingsThisWeek: 0,
      meetingsToday: 0,
      needsFollowUp: 0,
      openMeetingActions: 0,
      overdueFollowUps: 0,
      decisionsLogged: 0,
    });
  });
});

describe("computeDepartmentPulse", () => {
  it("aggregates by area and sorts most-loaded first", () => {
    const meetings = [
      meeting({
        category: "MENTORSHIP",
        followUps: [
          followUp({ area: "MENTORSHIP", status: "OPEN", dueDate: new Date(2026, 5, 4) }), // overdue
          followUp({ area: "MENTORSHIP", status: "OPEN", dueDate: new Date(2026, 5, 14) }),
          followUp({ area: "MENTORSHIP", status: "COMPLETED", dueDate: new Date(2026, 5, 1) }), // ignored
        ],
      }),
      meeting({
        followUps: [followUp({ area: "CHAPTERS", status: "OPEN", dueDate: new Date(2026, 5, 13) })],
      }),
      meeting({
        category: "CLASSES",
        followUps: [followUp({ area: null, status: "OPEN", dueDate: new Date(2026, 5, 13) })], // falls back to meeting category
      }),
    ];
    const pulse = computeDepartmentPulse(meetings, NOW);
    expect(pulse[0]).toEqual({ area: "MENTORSHIP", open: 2, overdue: 1 });
    expect(pulse.map((r) => r.area)).toContain("CLASSES"); // null area used meeting category
    const chapters = pulse.find((r) => r.area === "CHAPTERS");
    expect(chapters).toEqual({ area: "CHAPTERS", open: 1, overdue: 0 });
  });
});

describe("weekRangeForOffset", () => {
  it("returns the Mon–Sun operating week containing now for offset 0", () => {
    const { start, end } = weekRangeForOffset(0, NOW);
    expect(start.getDay()).toBe(1); // Monday
    expect(end.getDay()).toBe(0); // Sunday
    expect(start.getDate()).toBe(8);
    expect(end.getDate()).toBe(14);
  });

  it("shifts by whole weeks", () => {
    const prev = weekRangeForOffset(-1, NOW);
    expect(prev.start.getDate()).toBe(1);
    const next = weekRangeForOffset(1, NOW);
    expect(next.start.getDate()).toBe(15);
  });
});
