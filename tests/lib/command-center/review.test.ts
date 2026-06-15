import { describe, expect, it } from "vitest";

import { buildReviewWorkspace } from "@/lib/command-center";
import type { WorkHubWeeklyReview } from "@/lib/work/work-hub";

import { makeInitiativeCard, makeQueueItem, makeSignals } from "../queue/fixtures";
import { makeEngine, NOW } from "./helpers";

const WEEKLY: WorkHubWeeklyReview = {
  completedThisWeek: 8,
  createdThisWeek: 4,
  fromMeetingsThisWeek: 3,
  overdue: 3,
  unowned: 2,
  blockedNeedingEscalation: [],
};

describe("buildReviewWorkspace", () => {
  const initiatives = [
    makeInitiativeCard({ id: "a", title: "On-track plan", healthTone: "success", owner: "Mia Ward", nextStep: "Ship it" }),
    makeInitiativeCard({ id: "b", title: "Blocked plan", healthTone: "danger", owner: "Alex Brooks", nextStep: "Unblock" }),
    makeInitiativeCard({ id: "c", title: "Summer Camps 2026", healthTone: "neutral", owner: null, nextStep: null }),
  ];
  const items = [makeQueueItem({ id: "f1", type: "follow_up" })];
  const vm = buildReviewWorkspace({
    engine: makeEngine(items, { summary: { overdue: 3, unowned: 2 } }),
    weeklyReview: WEEKLY,
    initiatives,
    decisionsWithoutActions: [],
    upcomingMeetings: 2,
    now: NOW,
  });

  it("translates the initiative read into operating states — never 'health'", () => {
    const statuses = Object.fromEntries(vm.initiativeRooms.map((room) => [room.id, room.statusLabel]));
    expect(statuses.a).toBe("On track");
    expect(statuses.b).toBe("Blocked");
    expect(statuses.c).toBe("Steady");
    for (const room of vm.initiativeRooms) {
      expect(room.statusLabel.toLowerCase()).not.toContain("health");
    }
  });

  it("writes a concrete weekly brief", () => {
    expect(vm.brief).toBe(
      "This week: 8 actions moved, 3 are overdue, 2 initiatives need next steps, and 1 meeting follow-up is unresolved."
    );
    expect(vm.summary.actionsMoved).toBe(8);
  });

  it("surfaces the unowned initiative as next week's focus and a review-session step", () => {
    expect(vm.focusNextWeek.some((focus) => focus.includes("Summer Camps 2026"))).toBe(true);
    const startSession = vm.reviewSession.find((step) => step.id === "owners");
    expect(startSession?.href).toBe("/delegate");
    expect(vm.startSessionHref).toBe("/work/queue?queue=weekly-review");
  });
});
