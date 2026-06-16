import { describe, expect, it } from "vitest";

import {
  activeIndex,
  loopResolved,
  nextIdAfterSkip,
  visibleLoops,
} from "@/lib/queue/runner-logic";

import { makeQueueItem } from "./fixtures";

const a = makeQueueItem({ id: "wh:action:a", title: "A" });
const b = makeQueueItem({ id: "wh:action:b", title: "B" });
const c = makeQueueItem({ id: "dec:c", title: "C" });

describe("queue runner logic", () => {
  it("hides skipped loops but never removes them from source", () => {
    const skipped = new Set(["wh:action:b"]);
    const visible = visibleLoops([a, b, c], skipped);
    expect(visible.map((i) => i.id)).toEqual(["wh:action:a", "dec:c"]);
    // The source list is untouched — reopen the queue and B is still there.
    expect([a, b, c].map((i) => i.id)).toContain("wh:action:b");
  });

  it("resolves the active index, falling back to 0 when the id is gone", () => {
    expect(activeIndex([a, b, c], "dec:c")).toBe(2);
    expect(activeIndex([a, b, c], null)).toBe(0);
    expect(activeIndex([a, b, c], "missing")).toBe(0);
  });

  it("treats a loop as resolved ONLY when its source item is gone", () => {
    // Still present after a partial mutation (e.g. action marked blocked) → not resolved.
    expect(loopResolved([a, b, c], "wh:action:a")).toBe(false);
    // Gone from the refreshed source → genuinely resolved.
    expect(loopResolved([b, c], "wh:action:a")).toBe(true);
  });

  it("skips forward to the next loop, or to done at the end", () => {
    expect(nextIdAfterSkip([a, b, c], 0)).toBe("wh:action:b");
    expect(nextIdAfterSkip([a, b, c], 2)).toBeNull();
  });
});
