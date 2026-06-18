import { describe, expect, it } from "vitest";

import { MEETING_TEMPLATES, findMeetingTemplate } from "@/lib/people-strategy/meeting-templates";
import { isMeetingCategory } from "@/lib/people-strategy/meeting-categories";
import { isMeetingType } from "@/lib/people-strategy/meeting-operating-model";

describe("MEETING_TEMPLATES", () => {
  it("has unique ids and valid categories", () => {
    const ids = MEETING_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of MEETING_TEMPLATES) {
      expect(isMeetingType(t.meetingType)).toBe(true);
      expect(isMeetingCategory(t.category)).toBe(true);
      expect(t.durationMinutes).toBeGreaterThan(0);
      expect(Array.isArray(t.agenda)).toBe(true);
    }
  });

  it("includes a blank template with an empty agenda", () => {
    const blank = findMeetingTemplate("t_blank");
    expect(blank).toBeTruthy();
    expect(blank?.agenda).toHaveLength(0);
  });

  it("pre-fills agenda items for the leadership sync", () => {
    const lead = findMeetingTemplate("t_officer");
    expect(lead?.meetingType).toBe("OFFICER_MEETING");
    expect(lead?.category).toBe("LEADERSHIP");
    expect(lead?.agenda.length).toBeGreaterThanOrEqual(4);
  });

  it("returns undefined for an unknown id", () => {
    expect(findMeetingTemplate("nope")).toBeUndefined();
  });
});
