import { describe, it, expect } from "vitest";

import { buildMeetingBrief, renderMeetingBriefText } from "@/lib/partners/meeting-brief";
import { DEFAULT_YPP_DESCRIPTION } from "@/lib/partners/outreach-email";

describe("buildMeetingBrief", () => {
  it("builds a structured brief from portal context", () => {
    const brief = buildMeetingBrief({
      partnerName: "Scarsdale Public Library",
      partnerType: "LIBRARY",
      contactName: "Jane Miller",
      contactTitle: "Youth Services Director",
      proposedAges: "3rd–8th graders",
      proposedSchedule: "Tuesdays after school",
      fallbackAsk: "start with a single pilot session.",
      meetingDateLabel: "Thu, Jul 10 at 2:00 PM",
      priorNotes: [{ dateLabel: "Jul 2", text: "Emailed; she replied interested." }],
    });
    expect(brief.contactLine).toContain("Jane Miller");
    expect(brief.theAsk).toContain("3rd–8th graders");
    expect(brief.theAsk).toContain("Tuesdays after school");
    expect(brief.fallbackAsks.length).toBeGreaterThan(0);
    expect(brief.fallbackAsks[0]).toContain("pilot");
    expect(brief.likelyObjections.length).toBeGreaterThan(0);
    expect(brief.priorTimeline).toHaveLength(1);
    expect(brief.meetingDateLabel).toBe("Thu, Jul 10 at 2:00 PM");
  });

  it("falls back to the default YPP description when none supplied", () => {
    const brief = buildMeetingBrief({ partnerName: "Town YMCA" });
    expect(brief.whatIsYpp).toBe(DEFAULT_YPP_DESCRIPTION);
  });

  it("inserts a type-specific objection for schools", () => {
    const brief = buildMeetingBrief({ partnerName: "Lincoln Elementary", partnerType: "SCHOOL" });
    expect(brief.likelyObjections.some((o) => o.objection.toLowerCase().includes("school day"))).toBe(true);
  });

  it("renders a plain-text brief with the key sections", () => {
    const text = renderMeetingBriefText(buildMeetingBrief({ partnerName: "Town YMCA" }));
    expect(text).toContain("THE ASK");
    expect(text).toContain("FALLBACK ASKS");
    expect(text).toContain("LIKELY OBJECTIONS");
    expect(text).toContain("AFTER THE MEETING");
  });
});
