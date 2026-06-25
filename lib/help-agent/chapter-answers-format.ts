/**
 * Pure formatting for Help Agent chapter answers (no DB, no server-only) so the
 * matching + block-building logic is unit-testable. The DB reads live in
 * ./chapter-answers, which imports these helpers.
 */
import type { ChapterCommandCard } from "@/lib/chapters/leadership";
import { CHAPTER_HEALTH_LABELS } from "@/lib/chapters/health";
import type { CoSAnswerBlock, CoSAnswerItem, CoSTone } from "./types";

/** True when the question is about chapters / chapter presidents. */
export function isChapterQuestion(question: string): boolean {
  return /\bchapters?\b|\bchapter president\b|\bcps?\b/i.test(question);
}

export const HEALTH_TONE: Record<string, CoSTone> = {
  ON_TRACK: "success",
  NEEDS_SUPPORT: "warning",
  AT_RISK: "danger",
  PAUSED: "neutral",
};

export function cardItem(card: ChapterCommandCard, signal: string | null): CoSAnswerItem {
  return {
    label: card.name,
    detail: card.president ? `CP: ${card.president.name}` : "No Chapter President",
    signal,
    tone: HEALTH_TONE[card.health.label] ?? "neutral",
    href: `/admin/chapters/${card.id}`,
    entityType: null,
    entityId: null,
  };
}

/** Find the chapter whose name appears in the question (longest match wins). */
export function findNamedChapter(
  question: string,
  cards: ChapterCommandCard[]
): ChapterCommandCard | null {
  const q = question.toLowerCase();
  let best: ChapterCommandCard | null = null;
  let bestLen = 0;
  for (const card of cards) {
    const name = card.name.toLowerCase();
    // Match the chapter name, or its name minus a trailing " chapter".
    const stem = name.replace(/\s+chapter$/, "").trim();
    if (stem.length >= 3 && q.includes(stem)) {
      if (!best || stem.length > bestLen) {
        best = card;
        bestLen = stem.length;
      }
    }
  }
  return best;
}

export function buildNetworkBlocks(cards: ChapterCommandCard[]): CoSAnswerBlock[] {
  const needHelp = cards.filter(
    (c) => c.health.label === "NEEDS_SUPPORT" || c.health.label === "AT_RISK" || c.flags.waitingOnYpp
  );
  const noMeeting = cards.filter((c) => c.flags.noUpcomingMeeting);
  const waitingOnYpp = cards.filter((c) => c.flags.waitingOnYpp);

  return [
    {
      kind: "needs_attention",
      title: "Chapters that need help",
      subtitle: "Needs support, at risk, or waiting on leadership",
      items: needHelp.slice(0, 8).map((c) =>
        cardItem(c, c.blocker ?? CHAPTER_HEALTH_LABELS[c.health.label])
      ),
      emptyState: "No chapters are flagged for help right now.",
      moreHref: "/admin/chapters?view=needs_support",
      moreLabel: "Chapter command",
    },
    {
      kind: "meetings_need_followthrough",
      title: "Chapters with no upcoming meeting",
      subtitle: "Operating chapters with nothing on the calendar",
      items: noMeeting.slice(0, 8).map((c) => cardItem(c, "Schedule the next meeting")),
      emptyState: "Every operating chapter has a meeting scheduled.",
      moreHref: "/admin/chapters?view=no_upcoming_meeting",
      moreLabel: "View chapters",
    },
    {
      kind: "open_actions",
      title: "Waiting on leadership",
      subtitle: "Open support requests or launch plans pending approval",
      items: waitingOnYpp.slice(0, 8).map((c) => cardItem(c, c.blocker ?? "Awaiting leadership")),
      emptyState: "Nothing is waiting on national leadership.",
      moreHref: "/admin/chapters?view=waiting_on_ypp",
      moreLabel: "View chapters",
    },
  ];
}

/** Headline summarizing the network blocks. */
export function networkHeadline(blocks: CoSAnswerBlock[]): string {
  const needHelp = blocks[0]?.items.length ?? 0;
  const noMeeting = blocks[1]?.items.length ?? 0;
  return needHelp + noMeeting === 0
    ? "All chapters look healthy."
    : `${needHelp} chapter${needHelp === 1 ? "" : "s"} need help · ${noMeeting} without an upcoming meeting`;
}
