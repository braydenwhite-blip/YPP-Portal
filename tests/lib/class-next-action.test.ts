import { describe, expect, it } from "vitest";

import {
  buildNeedsAction,
  classNextActionHref,
  deriveClassNextAction,
  deriveClassStatusLabel,
  deriveThisTermCounts,
  type ClassSignals,
} from "@/lib/class-next-action";

const NOW = new Date("2026-06-14T12:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}
function daysAhead(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

/** A fully set-up, healthy, in-flight class. Override one field per scenario. */
function signals(overrides: Partial<ClassSignals> = {}): ClassSignals {
  return {
    status: "PUBLISHED",
    startDate: daysAhead(20),
    endDate: daysAhead(80),
    hasLeadInstructor: true,
    sessionCount: 6,
    nextSessionAt: daysAhead(20),
    enrolledCount: 14,
    partnerLinked: false,
    partnerConfirmationNeeded: false,
    openActionCount: 0,
    overdueActionCount: 0,
    hasReflection: false,
    feedbackCount: 0,
    ...overrides,
  };
}

describe("deriveClassNextAction — priority order", () => {
  it("1. missing lead instructor wins over everything else", () => {
    const next = deriveClassNextAction(
      signals({
        hasLeadInstructor: false,
        sessionCount: 0,
        enrolledCount: 0,
        partnerConfirmationNeeded: true,
        overdueActionCount: 3,
      }),
      NOW
    );
    expect(next.kind).toBe("assign_instructor");
    expect(next.priority).toBe(1);
    expect(next.urgent).toBe(true);
    expect(next.reason).toMatch(/instructor/i);
  });

  it("2. no schedule beats roster, partner, and actions", () => {
    const next = deriveClassNextAction(
      signals({
        sessionCount: 0,
        nextSessionAt: null,
        enrolledCount: 0,
        partnerConfirmationNeeded: true,
        overdueActionCount: 2,
      }),
      NOW
    );
    expect(next.kind).toBe("add_session");
    expect(next.priority).toBe(2);
  });

  it("3. missing roster beats partner confirmation and actions", () => {
    const next = deriveClassNextAction(
      signals({
        enrolledCount: 0,
        partnerConfirmationNeeded: true,
        overdueActionCount: 1,
      }),
      NOW
    );
    expect(next.kind).toBe("add_roster");
    expect(next.priority).toBe(3);
  });

  it("4. partner confirmation beats overdue actions", () => {
    const next = deriveClassNextAction(
      signals({ partnerLinked: true, partnerConfirmationNeeded: true, overdueActionCount: 4 }),
      NOW
    );
    expect(next.kind).toBe("confirm_partner");
    expect(next.priority).toBe(4);
  });

  it("5. overdue actions surface when setup is complete", () => {
    const next = deriveClassNextAction(signals({ overdueActionCount: 2 }), NOW);
    expect(next.kind).toBe("review_actions");
    expect(next.priority).toBe(5);
    expect(next.reason).toBe("2 actions overdue");
  });

  it("6. upcoming session soon surfaces a session plan", () => {
    const next = deriveClassNextAction(
      signals({ nextSessionAt: daysAhead(3) }),
      NOW
    );
    expect(next.kind).toBe("view_session_plan");
    expect(next.priority).toBe(6);
    expect(next.urgent).toBe(false);
  });

  it("does not nudge a session plan that is weeks away", () => {
    const next = deriveClassNextAction(signals({ nextSessionAt: daysAhead(40) }), NOW);
    expect(next.kind).toBe("view_class");
  });

  it("9. everything current resolves to view_class", () => {
    const next = deriveClassNextAction(signals({ nextSessionAt: daysAhead(40) }), NOW);
    expect(next.kind).toBe("view_class");
    expect(next.priority).toBe(9);
    expect(next.reason).toBe("");
  });
});

describe("deriveClassNextAction — completed classes", () => {
  it("7. completed class with no reflection asks for notes", () => {
    const next = deriveClassNextAction(
      signals({ status: "COMPLETED", endDate: daysAgo(2), hasReflection: false }),
      NOW
    );
    expect(next.kind).toBe("add_notes");
    expect(next.priority).toBe(7);
  });

  it("8. completed + reflected but no feedback asks for feedback", () => {
    const next = deriveClassNextAction(
      signals({
        status: "COMPLETED",
        endDate: daysAgo(2),
        hasReflection: true,
        feedbackCount: 0,
      }),
      NOW
    );
    expect(next.kind).toBe("request_feedback");
    expect(next.priority).toBe(8);
  });

  it("completed + reflected + feedback resolves to view_class", () => {
    const next = deriveClassNextAction(
      signals({
        status: "COMPLETED",
        endDate: daysAgo(2),
        hasReflection: true,
        feedbackCount: 9,
      }),
      NOW
    );
    expect(next.kind).toBe("view_class");
  });

  it("overdue actions still surface on a completed class before reflection", () => {
    const next = deriveClassNextAction(
      signals({
        status: "COMPLETED",
        endDate: daysAgo(2),
        hasReflection: false,
        overdueActionCount: 1,
      }),
      NOW
    );
    expect(next.kind).toBe("review_actions");
  });

  it("does not ask a completed class to assign an instructor or add sessions", () => {
    // A class whose end date has passed should never re-open delivery-time gaps.
    const next = deriveClassNextAction(
      signals({
        status: "IN_PROGRESS",
        startDate: daysAgo(60),
        endDate: daysAgo(1),
        hasLeadInstructor: false,
        sessionCount: 0,
        hasReflection: false,
      }),
      NOW
    );
    expect(next.kind).toBe("add_notes");
  });

  it("cancelled classes never demand action", () => {
    const next = deriveClassNextAction(
      signals({ status: "CANCELLED", hasLeadInstructor: false, sessionCount: 0 }),
      NOW
    );
    expect(next.kind).toBe("view_class");
    expect(next.urgent).toBe(false);
  });
});

describe("classNextActionHref", () => {
  it("routes each action to an existing admin class route", () => {
    expect(classNextActionHref("assign_instructor", "c1")).toBe("/admin/classes/c1/settings");
    expect(classNextActionHref("confirm_partner", "c1")).toBe("/admin/classes/c1/settings");
    expect(classNextActionHref("add_roster", "c1")).toBe("/admin/classes/c1/roster");
    expect(classNextActionHref("add_notes", "c1")).toBe("/admin/classes/c1/feedback");
    expect(classNextActionHref("request_feedback", "c1")).toBe("/admin/classes/c1/feedback");
    expect(classNextActionHref("add_session", "c1")).toBe("/admin/classes/c1");
    expect(classNextActionHref("view_class", "c1")).toBe("/admin/classes/c1");
  });
});

describe("deriveClassStatusLabel", () => {
  it("uses plain-English workflow language backed by facts", () => {
    expect(deriveClassStatusLabel(signals({ hasLeadInstructor: false }), NOW).label).toBe(
      "Missing instructor"
    );
    expect(deriveClassStatusLabel(signals({ sessionCount: 0 }), NOW).label).toBe("No schedule");
    expect(deriveClassStatusLabel(signals({ enrolledCount: 0 }), NOW).label).toBe("Roster missing");
    expect(
      deriveClassStatusLabel(signals({ partnerConfirmationNeeded: true }), NOW).label
    ).toBe("Partner confirmation needed");
    expect(deriveClassStatusLabel(signals({ overdueActionCount: 2 }), NOW).label).toBe(
      "2 actions overdue"
    );
    expect(deriveClassStatusLabel(signals({ nextSessionAt: daysAhead(2) }), NOW).label).toMatch(
      /^Next session/
    );
    expect(
      deriveClassStatusLabel(signals({ nextSessionAt: daysAhead(40), openActionCount: 1 }), NOW)
        .label
    ).toBe("1 action open");
    expect(deriveClassStatusLabel(signals({ nextSessionAt: daysAhead(40) }), NOW).label).toBe(
      "Ready for next session"
    );
  });

  it("describes completed and cancelled states", () => {
    expect(
      deriveClassStatusLabel(
        signals({ status: "COMPLETED", endDate: daysAgo(2), hasReflection: false }),
        NOW
      ).label
    ).toBe("Needs reflection");
    expect(
      deriveClassStatusLabel(
        signals({ status: "COMPLETED", endDate: daysAgo(2), hasReflection: true }),
        NOW
      ).label
    ).toBe("Completed");
    expect(deriveClassStatusLabel(signals({ status: "CANCELLED" }), NOW).label).toBe("Cancelled");
  });
});

describe("deriveThisTermCounts", () => {
  it("tallies factual counts without scoring", () => {
    const rows: ClassSignals[] = [
      signals({ status: "PUBLISHED", startDate: daysAhead(10) }), // active + upcoming
      signals({ status: "IN_PROGRESS", startDate: daysAgo(5) }), // active
      signals({ status: "DRAFT", startDate: daysAhead(15), hasLeadInstructor: false, sessionCount: 0 }), // upcoming + missing instr + schedule
      signals({ status: "PUBLISHED", startDate: daysAgo(2), openActionCount: 2 }), // active + open actions
      signals({ partnerLinked: true, status: "PUBLISHED", startDate: daysAgo(2) }), // active + partner
      signals({ status: "COMPLETED", endDate: daysAgo(3) }), // recently completed
      signals({ status: "COMPLETED", endDate: daysAgo(90) }), // old completed (not recent)
    ];
    const counts = deriveThisTermCounts(rows, NOW);
    expect(counts.active).toBe(4);
    expect(counts.upcoming).toBe(2);
    expect(counts.missingInstructor).toBe(1);
    expect(counts.missingSchedule).toBe(1);
    expect(counts.openActions).toBe(1);
    expect(counts.partnerConnected).toBe(1);
    expect(counts.recentlyCompleted).toBe(1);
  });
});

describe("buildNeedsAction", () => {
  it("surfaces only urgent issues, worst-first, capped", () => {
    const rows = [
      { ...signals({ overdueActionCount: 1 }), id: "a", title: "Greenburgh Nature", partnerName: "Greenburgh Nature Center" },
      { ...signals({ hasLeadInstructor: false }), id: "b", title: "STEM at Beth El", partnerName: "Beth El" },
      { ...signals({ enrolledCount: 0 }), id: "c", title: "Mohawk Sports Econ", partnerName: null },
      { ...signals({ nextSessionAt: daysAhead(2) }), id: "d", title: "Healthy Class", partnerName: null }, // not urgent
    ];
    const needs = buildNeedsAction(rows, NOW, 6);
    expect(needs.map((n) => n.id)).toEqual(["b", "c", "a"]); // priority 1, 3, 5
    expect(needs[0].action.kind).toBe("assign_instructor");
    expect(needs[0].context).toBe("Beth El");
    expect(needs[0].href).toBe("/admin/classes/b/settings");
    expect(needs.some((n) => n.id === "d")).toBe(false);
  });

  it("respects the cap", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      ...signals({ hasLeadInstructor: false }),
      id: `c${i}`,
      title: `Class ${i}`,
      partnerName: null,
    }));
    expect(buildNeedsAction(rows, NOW, 5)).toHaveLength(5);
  });
});
