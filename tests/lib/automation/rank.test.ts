import { describe, it, expect } from "vitest";
import { computeUrgency, sortAutomationItems } from "@/lib/automation/rank";
import { makeAutomationItem } from "@/lib/automation/build-item";
import { addDays } from "@/lib/automation/date-helpers";

const NOW = new Date("2026-06-24T12:00:00.000Z");

describe("automation/rank", () => {
  it("scores by severity baseline", () => {
    expect(computeUrgency({ severity: "BLOCKING", dueAt: null, now: NOW })).toBe(80);
    expect(computeUrgency({ severity: "INFO", dueAt: null, now: NOW })).toBe(20);
  });

  it("adds weight for overdue work", () => {
    const score = computeUrgency({ severity: "URGENT", dueAt: addDays(NOW, -5), now: NOW });
    expect(score).toBe(80); // 60 + min(20, 5*4)
  });

  it("adds a nudge for due-soon work", () => {
    const score = computeUrgency({ severity: "ATTENTION", dueAt: addDays(NOW, 1), now: NOW });
    expect(score).toBe(48); // 40 + (10 - 1*2)
  });

  it("adds playbook pressure when behind", () => {
    const score = computeUrgency({
      severity: "INFO",
      dueAt: null,
      now: NOW,
      playbookWeekRelevance: 4,
      currentWeek: 7,
    });
    expect(score).toBe(29); // 20 + min(10, 3*3)
  });

  it("sorts by urgency, highest first", () => {
    const low = makeAutomationItem({
      type: "PARTNER_WEEKLY_CHECKIN_DUE",
      chapterId: "c",
      now: NOW,
      title: "low",
      description: "",
      why: "",
      resolvesWhen: "",
      primaryActionLabel: "x",
      primaryActionHref: "/x",
    });
    const high = makeAutomationItem({
      type: "PARTNER_LOGISTICS_INCOMPLETE",
      chapterId: "c",
      now: NOW,
      title: "high",
      description: "",
      why: "",
      resolvesWhen: "",
      primaryActionLabel: "x",
      primaryActionHref: "/x",
      severity: "BLOCKING",
    });
    const sorted = sortAutomationItems([low, high]);
    expect(sorted[0].title).toBe("high");
    expect(sorted[0].urgency).toBeGreaterThanOrEqual(sorted[1].urgency);
  });
});
