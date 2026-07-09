import { describe, expect, it } from "vitest";

import { isQuarterlyCycle } from "@/lib/mentorship/quarterly-review";

describe("isQuarterlyCycle", () => {
  it("is true on every 3rd, 6th, 9th... cycle", () => {
    expect(isQuarterlyCycle(3)).toBe(true);
    expect(isQuarterlyCycle(6)).toBe(true);
    expect(isQuarterlyCycle(9)).toBe(true);
    expect(isQuarterlyCycle(12)).toBe(true);
  });

  it("is false on every other cycle, including 0", () => {
    expect(isQuarterlyCycle(0)).toBe(false);
    expect(isQuarterlyCycle(1)).toBe(false);
    expect(isQuarterlyCycle(2)).toBe(false);
    expect(isQuarterlyCycle(4)).toBe(false);
    expect(isQuarterlyCycle(5)).toBe(false);
  });
});
