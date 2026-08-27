import { describe, expect, it } from "vitest";

import { mergeWaitlistOrder } from "@/lib/hiring-waitlist/merge-order";

describe("mergeWaitlistOrder", () => {
  it("keeps saved order for people still waitlisted", () => {
    const merged = mergeWaitlistOrder(
      ["instructor:b", "instructor:a"],
      [
        { key: "instructor:a", waitlistedAt: "2026-01-01T00:00:00.000Z" },
        { key: "instructor:b", waitlistedAt: "2026-01-02T00:00:00.000Z" },
      ]
    );
    expect(merged).toEqual(["instructor:b", "instructor:a"]);
  });

  it("appends newcomers by waitlistedAt ascending", () => {
    const merged = mergeWaitlistOrder(
      ["instructor:a"],
      [
        { key: "instructor:a", waitlistedAt: "2026-01-01T00:00:00.000Z" },
        { key: "cp:new-old", waitlistedAt: "2026-01-03T00:00:00.000Z" },
        { key: "cp:new-older", waitlistedAt: "2026-01-02T00:00:00.000Z" },
      ]
    );
    expect(merged).toEqual(["instructor:a", "cp:new-older", "cp:new-old"]);
  });

  it("drops people who left the waitlist", () => {
    const merged = mergeWaitlistOrder(
      ["instructor:gone", "instructor:still"],
      [{ key: "instructor:still", waitlistedAt: "2026-01-01T00:00:00.000Z" }]
    );
    expect(merged).toEqual(["instructor:still"]);
  });
});
