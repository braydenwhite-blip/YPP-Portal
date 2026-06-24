import { describe, expect, it } from "vitest";

import {
  isGamificationEnabled,
  isGamificationGatedPath,
} from "@/lib/gamification-gate";

describe("Gamification gate", () => {
  it("defaults OFF when ENABLE_GAMIFICATION is unset", () => {
    expect(isGamificationEnabled()).toBe(false);
  });

  const GATED = [
    "/achievements",
    "/achievements/badges",
    "/awards",
    "/badges",
    "/badges/123",
    "/certificates",
    "/challenges",
    "/challenges/daily",
    "/competitions",
    "/leaderboards",
    "/rewards",
    "/showcases",
    "/student-of-month",
    "/wall-of-fame",
    "/instructor-growth",
    "/instructor-growth/review",
    "/world",
    "/world/island/1",
    "/profile/xp",
    "/profile/certifications",
    "/chapter/leaderboard",
    "/chapter/achievements",
    "/chapters/leaderboard",
    "/instructor/certifications",
    "/instructor/certification-pathway",
    "/instructor/competition-builder",
    "/mentorship/awards",
    "/my-program/achievement-journey",
    "/my-program/certificate",
    "/reflections/streaks",
    "/learn/challenges",
  ];

  // Kept surfaces — including hubs that merely share a name-prefix with a gated
  // sub-path (exact-or-subpath matching must not catch the parent).
  const NOT_GATED = [
    "/",
    "/profile",
    "/profile/settings",
    "/chapter",
    "/chapters",
    "/instructor",
    "/instructor-onboarding",
    "/learn",
    "/learn/progress",
    "/reflections",
    "/my-program",
    "/mentorship",
    "/awards-banquet",
    "/badges-archive",
  ];

  it.each(GATED)("gates %s", (path) => {
    expect(isGamificationGatedPath(path)).toBe(true);
  });

  it.each(NOT_GATED)("does not gate %s", (path) => {
    expect(isGamificationGatedPath(path)).toBe(false);
  });
});
