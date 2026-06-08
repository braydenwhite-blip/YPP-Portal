import { describe, expect, it } from "vitest";

import {
  GROWTH_TRACK_INFO,
  GROWTH_TRACK_ORDER,
  getGrowthTrackInfo,
  getPathwayForTrack,
} from "@/lib/growth/tracks";
import { GROWTH_TRACKS } from "@/lib/growth/constants";

describe("growth tracks — unification", () => {
  it("describes every GrowthTrack", () => {
    for (const id of GROWTH_TRACKS) {
      const info = getGrowthTrackInfo(id);
      expect(info.id).toBe(id);
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
    }
    expect(GROWTH_TRACK_ORDER).toEqual([...GROWTH_TRACKS]);
    expect(Object.keys(GROWTH_TRACK_INFO)).toHaveLength(GROWTH_TRACKS.length);
  });

  it("reuses the existing role-ladder config for ladder-backed tracks", () => {
    // Instructor + Leadership/Chapter/Hiring map onto the shared pathway tracks.
    expect(getPathwayForTrack("INSTRUCTOR")?.id).toBe("INSTRUCTOR");
    expect(getPathwayForTrack("LEADERSHIP")?.id).toBe("LEADERSHIP");
    expect(getPathwayForTrack("CHAPTER")?.id).toBe("LEADERSHIP");
    expect(getPathwayForTrack("HIRING")?.id).toBe("INSTRUCTOR");
    // Tracks without a formal ladder return null (no forked definition).
    expect(getPathwayForTrack("STUDENT")).toBeNull();
    expect(getPathwayForTrack("MENTORSHIP")).toBeNull();
    expect(getPathwayForTrack("ALUMNI")).toBeNull();
  });
});
