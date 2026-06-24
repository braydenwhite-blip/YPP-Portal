import { describe, it, expect } from "vitest";
import {
  LAUNCH_CHECKLIST,
  LAUNCH_CHECKLIST_BY_KEY,
  isLaunchChecklistKey,
  summarizeLaunchProgress,
} from "@/lib/chapters/launch-checklist";

describe("launch checklist template", () => {
  it("has the eleven canonical items with unique, ordered keys", () => {
    expect(LAUNCH_CHECKLIST).toHaveLength(11);
    const keys = LAUNCH_CHECKLIST.map((i) => i.key);
    expect(new Set(keys).size).toBe(11);
    const orders = LAUNCH_CHECKLIST.map((i) => i.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("starts by confirming the CP and ends by marking active", () => {
    const sorted = [...LAUNCH_CHECKLIST].sort((a, b) => a.order - b.order);
    expect(sorted[0].key).toBe("confirm_cp");
    expect(sorted[sorted.length - 1].key).toBe("mark_active");
  });

  it("only the gate steps are leadership-owned and non-action", () => {
    expect(LAUNCH_CHECKLIST_BY_KEY.approve_launch_plan.owner).toBe("leadership");
    expect(LAUNCH_CHECKLIST_BY_KEY.mark_active.owner).toBe("leadership");
    expect(LAUNCH_CHECKLIST_BY_KEY.confirm_cp.spawnsAction).toBe(false);
    // Concrete CP tasks spawn real actions.
    expect(LAUNCH_CHECKLIST_BY_KEY.schedule_kickoff.spawnsAction).toBe(true);
    expect(LAUNCH_CHECKLIST_BY_KEY.recruit_first_members.spawnsAction).toBe(true);
  });

  it("key guard works", () => {
    expect(isLaunchChecklistKey("schedule_kickoff")).toBe(true);
    expect(isLaunchChecklistKey("not_a_key")).toBe(false);
  });

  it("summarizes progress and finds the next step in order", () => {
    const none = summarizeLaunchProgress([]);
    expect(none.done).toBe(0);
    expect(none.percent).toBe(0);
    expect(none.nextItem?.key).toBe("confirm_cp");

    const some = summarizeLaunchProgress(["confirm_cp", "confirm_school_advisor"]);
    expect(some.done).toBe(2);
    expect(some.percent).toBe(Math.round((2 / 11) * 100));
    expect(some.nextItem?.key).toBe("add_founding_team");

    const all = summarizeLaunchProgress(LAUNCH_CHECKLIST.map((i) => i.key));
    expect(all.done).toBe(11);
    expect(all.percent).toBe(100);
    expect(all.nextItem).toBeNull();
  });
});
