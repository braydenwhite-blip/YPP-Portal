import { describe, it, expect } from "vitest";

import { PORTAL_SETTINGS_DEFAULTS } from "@/lib/portal-settings/defaults";
import { mergePortalSettings } from "@/lib/portal-settings/merge";

describe("mergePortalSettings", () => {
  it("returns the defaults when there are no stored rows", () => {
    expect(mergePortalSettings([])).toEqual(PORTAL_SETTINGS_DEFAULTS);
  });

  it("layers a stored override over the defaults (other keys untouched)", () => {
    const merged = mergePortalSettings([
      { key: "chapterOs", value: { deliberableRowCap: 3 } },
    ]);
    expect(merged.chapterOs.deliberableRowCap).toBe(3);
    // A sibling key in the same group keeps its default.
    expect(merged.chapterOs.partnerSinceContactStuckDays).toBe(
      PORTAL_SETTINGS_DEFAULTS.chapterOs.partnerSinceContactStuckDays
    );
    // Other groups are untouched.
    expect(merged.classFeedback).toEqual(PORTAL_SETTINGS_DEFAULTS.classFeedback);
  });

  it("coerces numeric strings (form values arrive as strings)", () => {
    const merged = mergePortalSettings([
      { key: "classFeedback", value: { goodFeedbackMinRating: "4.5", goodFeedbackMinResponses: "3" } },
    ]);
    expect(merged.classFeedback.goodFeedbackMinRating).toBe(4.5);
    expect(merged.classFeedback.goodFeedbackMinResponses).toBe(3);
  });

  it("falls back to defaults when a stored group is invalid", () => {
    const merged = mergePortalSettings([
      // rowCap below the min(1) bound → whole group fails validation → defaults.
      { key: "chapterOs", value: { deliberableRowCap: 0 } },
    ]);
    expect(merged.chapterOs).toEqual(PORTAL_SETTINGS_DEFAULTS.chapterOs);
  });

  it("ignores unknown keys", () => {
    const merged = mergePortalSettings([{ key: "somethingElse", value: { x: 1 } }]);
    expect(merged).toEqual(PORTAL_SETTINGS_DEFAULTS);
  });

  it("does not mutate the shared defaults constant", () => {
    mergePortalSettings([{ key: "chapterOs", value: { deliberableRowCap: 99 } }]);
    expect(PORTAL_SETTINGS_DEFAULTS.chapterOs.deliberableRowCap).toBe(8);
  });
});
