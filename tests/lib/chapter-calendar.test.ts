import { describe, expect, it } from "vitest";

import {
  buildChapterCalendarIcs,
  generateSeriesOccurrences,
  slugifyChapterName,
} from "@/lib/chapter-calendar";

describe("chapter-calendar", () => {
  it("slugifies chapter names into clean public slugs", () => {
    expect(slugifyChapterName("  North Philly @ YPP!  ")).toBe("north-philly-ypp");
    expect(slugifyChapterName("Chapter___One")).toBe("chapter-one");
  });

  it("generates weekly recurring occurrences across selected weekdays", () => {
    const occurrences = generateSeriesOccurrences({
      startDate: new Date(2026, 2, 2, 15, 0, 0),
      endDate: new Date(2026, 2, 2, 16, 30, 0),
      recurrenceFrequency: "WEEKLY",
      recurrenceInterval: 1,
      recurrenceDays: ["MONDAY", "WEDNESDAY"],
      recurrenceCount: 4,
      recurrenceUntil: null,
    });

    expect(occurrences).toHaveLength(4);
    expect(occurrences.map((occurrence) => occurrence.startDate.getDay())).toEqual([1, 3, 1, 3]);
    expect(
      occurrences.map((occurrence) => occurrence.startDate.toISOString().slice(0, 10))
    ).toEqual(["2026-03-02", "2026-03-04", "2026-03-09", "2026-03-11"]);
  });

  it("generates calendar ICS output for timed and all-day chapter entries", () => {
    const ics = buildChapterCalendarIcs(
      [
        {
          id: "event-1",
          source: "EVENT",
          title: "Chapter Kickoff",
          description: "Bring your ideas.",
          startDate: new Date("2026-04-02T18:00:00.000Z").toISOString(),
          endDate: new Date("2026-04-02T19:30:00.000Z").toISOString(),
          allDay: false,
          location: "Room 101",
          meetingUrl: "https://example.com/kickoff",
          visibility: "PUBLIC",
          chapterName: "Philadelphia",
          chapterSlug: "philadelphia",
          eventTypeLabel: "WORKSHOP",
          eventTypeColor: "#3b82f6",
          isCancelled: false,
          link: "/my-chapter/calendar?eventId=event-1",
          eventId: "event-1",
          milestoneId: null,
          seriesId: null,
          userRsvpStatus: null,
          isSubscribed: true,
        },
        {
          id: "milestone-1",
          source: "MILESTONE",
          title: "Application Deadline",
          description: null,
          startDate: new Date("2026-04-05T00:00:00.000Z").toISOString(),
          endDate: new Date("2026-04-05T00:00:00.000Z").toISOString(),
          allDay: true,
          location: null,
          meetingUrl: null,
          visibility: "INTERNAL",
          chapterName: "Philadelphia",
          chapterSlug: "philadelphia",
          eventTypeLabel: "CHAPTER MILESTONE",
          eventTypeColor: "#b45309",
          isCancelled: true,
          link: null,
          eventId: null,
          milestoneId: "milestone-1",
          seriesId: null,
          userRsvpStatus: null,
          isSubscribed: true,
        },
      ],
      "Philadelphia Chapter Calendar"
    );

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("X-WR-CALNAME:Philadelphia Chapter Calendar");
    expect(ics).toContain("SUMMARY:Chapter Kickoff");
    expect(ics).toContain("LOCATION:Room 101");
    expect(ics).toContain("URL:https://example.com/kickoff");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260405");
    expect(ics).toContain("STATUS:CANCELLED");
  });
});
