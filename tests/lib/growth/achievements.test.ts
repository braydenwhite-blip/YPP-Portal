import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENT_DEFINITIONS,
  achievementProgress,
  isAchievementEarned,
  evaluateAchievements,
  nextAchievements,
  getAchievementDefinition,
  achievementCategoryCounts,
  type AchievementInput,
} from "@/lib/growth/achievements";
import { isAchievementCategory } from "@/lib/growth/constants";

function input(eventCounts: AchievementInput["eventCounts"]): AchievementInput {
  return { eventCounts };
}

describe("achievement registry — integrity", () => {
  it("every definition is well-formed with a valid category and unique key", () => {
    const keys = new Set<string>();
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      expect(def.key).toBeTruthy();
      expect(keys.has(def.key)).toBe(false);
      keys.add(def.key);
      expect(isAchievementCategory(def.category)).toBe(true);
      expect(Object.keys(def.thresholds).length).toBeGreaterThan(0);
      expect(def.unlockHint.length).toBeGreaterThan(0);
    }
  });

  it("covers every growth dimension (no orphan category)", () => {
    const categories = new Set(ACHIEVEMENT_DEFINITIONS.map((d) => d.category));
    for (const c of [
      "LEADERSHIP",
      "IMPACT",
      "TEACHING",
      "MENTORSHIP",
      "PROJECT",
      "CHAPTER",
      "COMMUNITY",
    ]) {
      expect(categories.has(c as never)).toBe(true);
    }
  });
});

describe("achievement evaluation — deterministic & idempotent", () => {
  it("awards a single-threshold achievement when met", () => {
    const earned = evaluateAchievements(input({ CLASS_PUBLISHED: 1 }));
    expect(earned.map((e) => e.key)).toContain("first_class_taught");
  });

  it("does not award until a multi-threshold count is reached", () => {
    expect(isAchievementEarned(getAchievementDefinition("chapter_recruiter")!, input({ CHAPTER_MEMBER_RECRUITED: 4 }))).toBe(false);
    expect(isAchievementEarned(getAchievementDefinition("chapter_recruiter")!, input({ CHAPTER_MEMBER_RECRUITED: 5 }))).toBe(true);
  });

  it("returns earned achievements in stable display order", () => {
    const earned = evaluateAchievements(
      input({ LEADERSHIP_ROLE_EARNED: 1, CLASS_PUBLISHED: 1, MENTOR_MATCHED: 1 })
    );
    const orders = earned.map((e) => getAchievementDefinition(e.key)!.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("is idempotent — same input always yields the same set", () => {
    const i = input({ CLASS_PUBLISHED: 2, MENTOR_MATCHED: 1, CERTIFICATE_EARNED: 3 });
    expect(evaluateAchievements(i)).toEqual(evaluateAchievements(i));
  });

  it("awards nothing for an empty input", () => {
    expect(evaluateAchievements(input({}))).toEqual([]);
  });
});

describe("achievement progress — partial credit", () => {
  it("reports min ratio across thresholds, clamped to 1", () => {
    const def = getAchievementDefinition("chapter_recruiter")!; // need 5
    expect(achievementProgress(def, input({ CHAPTER_MEMBER_RECRUITED: 0 }))).toBe(0);
    expect(achievementProgress(def, input({ CHAPTER_MEMBER_RECRUITED: 3 }))).toBeCloseTo(0.6);
    expect(achievementProgress(def, input({ CHAPTER_MEMBER_RECRUITED: 9 }))).toBe(1);
  });
});

describe("nextAchievements — what can I unlock next?", () => {
  it("excludes earned, includes locked with progress + remaining", () => {
    const i = input({ CLASS_PUBLISHED: 1, CHAPTER_MEMBER_RECRUITED: 3 });
    const next = nextAchievements(i);
    const keys = next.map((n) => n.key);
    expect(keys).not.toContain("first_class_taught"); // earned

    const recruiter = next.find((n) => n.key === "chapter_recruiter");
    expect(recruiter).toBeDefined();
    expect(recruiter!.progress).toBeCloseTo(0.6);
    expect(recruiter!.remaining).toEqual([
      { type: "CHAPTER_MEMBER_RECRUITED", need: 5, have: 3 },
    ]);
  });

  it("sorts by progress desc (closest first), then stable order", () => {
    const next = nextAchievements(input({ CHAPTER_MEMBER_RECRUITED: 4 }));
    // chapter_recruiter is 80% done -> should lead the list.
    expect(next[0].key).toBe("chapter_recruiter");
    const progresses = next.map((n) => n.progress);
    expect(progresses).toEqual([...progresses].sort((a, b) => b - a));
  });

  it("honors limit + minProgress filters", () => {
    const next = nextAchievements(input({ CHAPTER_MEMBER_RECRUITED: 4 }), {
      limit: 1,
      minProgress: 0.5,
    });
    expect(next).toHaveLength(1);
    expect(next[0].key).toBe("chapter_recruiter");
  });
});

describe("achievementCategoryCounts", () => {
  it("tallies earned achievements by category", () => {
    const earned = evaluateAchievements(
      input({ CLASS_PUBLISHED: 1, INSTRUCTOR_TRAINING_COMPLETED: 1, MENTOR_MATCHED: 1 })
    );
    const counts = achievementCategoryCounts(earned);
    expect(counts.TEACHING).toBe(2); // first_class_taught + instructor_trained
    expect(counts.MENTORSHIP).toBe(1);
    expect(counts.PROJECT).toBe(0);
  });
});
