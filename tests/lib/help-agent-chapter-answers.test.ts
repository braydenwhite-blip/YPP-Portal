import { describe, expect, it } from "vitest";

import type { ChapterCommandCard } from "@/lib/chapters/leadership";
import {
  buildNetworkBlocks,
  findNamedChapter,
  isChapterQuestion,
  networkHeadline,
} from "@/lib/help-agent/chapter-answers-format";

function card(overrides: Partial<ChapterCommandCard> & Pick<ChapterCommandCard, "id" | "name">): ChapterCommandCard {
  return {
    city: null,
    state: null,
    partnerSchool: null,
    lifecycleStatus: "ACTIVE",
    president: { id: "p1", name: "Pat Lead" },
    health: { label: "ON_TRACK", tone: "success", score: 90, reasons: [] },
    memberCount: 10,
    nextStep: "On track",
    blocker: null,
    lastActivityAt: new Date("2026-06-01T00:00:00.000Z"),
    upcomingMeetingAt: new Date("2026-07-01T00:00:00.000Z"),
    flags: {
      noUpcomingMeeting: false,
      waitingOnCp: false,
      waitingOnYpp: false,
      recentlyLaunched: false,
      highPerforming: false,
    },
    ...overrides,
  } as ChapterCommandCard;
}

describe("help-agent chapter answers", () => {
  it("recognises chapter-intent questions", () => {
    expect(isChapterQuestion("What chapters need help?")).toBe(true);
    expect(isChapterQuestion("Which CPs haven't scheduled meetings?")).toBe(true);
    expect(isChapterQuestion("Who is overdue on their advisor check-in?")).toBe(false);
  });

  it("matches a named chapter in the question (longest wins)", () => {
    const cards = [
      card({ id: "c1", name: "Austin Chapter" }),
      card({ id: "c2", name: "Austin North Chapter" }),
    ];
    expect(findNamedChapter("what's the next step for Austin North?", cards)?.id).toBe("c2");
    expect(findNamedChapter("status of the Dallas chapter?", cards)).toBeNull();
  });

  it("builds need-help / no-meeting / waiting blocks from real signals", () => {
    const cards = [
      card({ id: "c1", name: "Healthy Chapter" }),
      card({
        id: "c2",
        name: "Struggling Chapter",
        health: { label: "AT_RISK", tone: "danger", score: 20, reasons: ["No meeting in 30 days"] },
        blocker: "2 overdue actions",
      }),
      card({
        id: "c3",
        name: "Quiet Chapter",
        flags: {
          noUpcomingMeeting: true,
          waitingOnCp: false,
          waitingOnYpp: false,
          recentlyLaunched: false,
          highPerforming: false,
        },
      }),
      card({
        id: "c4",
        name: "Waiting Chapter",
        flags: {
          noUpcomingMeeting: false,
          waitingOnCp: false,
          waitingOnYpp: true,
          recentlyLaunched: false,
          highPerforming: false,
        },
        blocker: "1 open support request",
      }),
    ];

    const blocks = buildNetworkBlocks(cards);
    const needHelp = blocks.find((b) => b.title === "Chapters that need help")!;
    const noMeeting = blocks.find((b) => b.title === "Chapters with no upcoming meeting")!;
    const waiting = blocks.find((b) => b.title === "Waiting on leadership")!;

    expect(needHelp.items.map((i) => i.label).sort()).toEqual([
      "Struggling Chapter",
      "Waiting Chapter",
    ]);
    expect(noMeeting.items.map((i) => i.label)).toEqual(["Quiet Chapter"]);
    expect(waiting.items.map((i) => i.label)).toEqual(["Waiting Chapter"]);
    expect(needHelp.items[0]?.href).toMatch(/^\/admin\/chapters\//);
  });

  it("headline reports zero when all chapters are healthy", () => {
    const blocks = buildNetworkBlocks([card({ id: "c1", name: "Healthy Chapter" })]);
    expect(networkHeadline(blocks)).toBe("All chapters look healthy.");
  });
});
