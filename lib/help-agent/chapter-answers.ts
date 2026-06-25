/**
 * Help Agent — chapter answers (deterministic, real data).
 *
 * Lets the Chief of Staff answer chapter questions ("what chapters need help?",
 * "which CPs haven't scheduled meetings?", "what's the next step for X chapter?",
 * "what happened in the last chapter meeting?") from the live chapter command
 * data and a single chapter's workspace — no AI required, no hallucination.
 */
import "server-only";

import { loadLeadershipChapters } from "@/lib/chapters/leadership";
import { loadChapterWorkspace } from "@/lib/chapters/workspace";
import { CHAPTER_HEALTH_LABELS } from "@/lib/chapters/health";
import { chapterLifecycleLabel, type ChapterLifecycle } from "@/lib/chapters/lifecycle";
import type { CoSAnswer, CoSAnswerBlock, CoSAnswerItem } from "./types";
import {
  HEALTH_TONE,
  buildNetworkBlocks,
  findNamedChapter,
  isChapterQuestion,
  networkHeadline,
} from "./chapter-answers-format";

export { isChapterQuestion } from "./chapter-answers-format";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function buildNamedChapterBlocks(chapterId: string): Promise<CoSAnswerBlock[]> {
  const ws = await loadChapterWorkspace(chapterId);
  if (!ws) return [];

  const summaryItems: CoSAnswerItem[] = [
    {
      label: "Next step",
      detail: ws.nextStep,
      signal: chapterLifecycleLabel(ws.chapter.lifecycleStatus as ChapterLifecycle),
      tone: HEALTH_TONE[ws.health.label] ?? "neutral",
      href: `/admin/chapters/${ws.chapter.id}`,
    },
    {
      label: "Health",
      detail: ws.health.reasons[0] ?? CHAPTER_HEALTH_LABELS[ws.health.label],
      signal: CHAPTER_HEALTH_LABELS[ws.health.label],
      tone: ws.health.tone,
      href: `/admin/chapters/${ws.chapter.id}`,
    },
  ];

  const lastMeeting = ws.meetings.past[0] ?? null;
  const nextMeeting = ws.meetings.upcoming[0] ?? null;
  if (lastMeeting) {
    summaryItems.push({
      label: "Last meeting",
      detail: `${lastMeeting.title} · ${fmtDate(lastMeeting.scheduledAt)}`,
      signal: null,
      tone: "neutral",
      href: `/meetings/${lastMeeting.id}`,
    });
  }
  summaryItems.push({
    label: "Next meeting",
    detail: nextMeeting ? `${nextMeeting.title} · ${fmtDate(nextMeeting.scheduledAt)}` : "None scheduled",
    signal: nextMeeting ? null : "No upcoming meeting",
    tone: nextMeeting ? "neutral" : "warning",
    href: nextMeeting ? `/meetings/${nextMeeting.id}` : `/admin/chapters/${ws.chapter.id}`,
  });

  const blocks: CoSAnswerBlock[] = [
    {
      kind: "entity_summary",
      title: ws.chapter.name,
      subtitle: `${ws.signals.memberCount} members · ${ws.signals.openActions} open actions`,
      items: summaryItems,
      moreHref: `/admin/chapters/${ws.chapter.id}`,
      moreLabel: "Open chapter",
    },
  ];

  if (ws.actions.open.length > 0) {
    blocks.push({
      kind: "open_actions",
      title: "Open chapter actions",
      subtitle: "What's outstanding for this chapter",
      items: ws.actions.open.slice(0, 6).map((a) => ({
        label: a.title,
        detail: null,
        signal: a.status.replace(/_/g, " ").toLowerCase(),
        tone: a.status === "BLOCKED" || a.status === "OVERDUE" ? "danger" : "neutral",
        href: `/actions/${a.id}`,
      })),
      moreHref: "/actions?who=all",
      moreLabel: "Action tracker",
    });
  }

  if (ws.supportRequests.length > 0) {
    const open = ws.supportRequests.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS");
    blocks.push({
      kind: "needs_attention",
      title: "Support requests",
      subtitle: "Asks to national leadership",
      items: (open.length > 0 ? open : ws.supportRequests).slice(0, 5).map((r) => ({
        label: r.title,
        detail: r.assignedTo ? `Owner: ${r.assignedTo.name}` : "No owner yet",
        signal: r.status.replace(/_/g, " ").toLowerCase(),
        tone: r.status === "OPEN" ? "warning" : "neutral",
        href: `/admin/chapters/${ws.chapter.id}`,
      })),
    });
  }

  return blocks;
}

/**
 * Build a deterministic chapter answer. Returns null when there are no chapters
 * at all, so the caller can fall back to the generic Chief of Staff answer.
 */
export async function answerChapterQuestion(
  question: string,
  options: { now?: Date; aiAvailable?: boolean }
): Promise<CoSAnswer | null> {
  const now = options.now ?? new Date();
  const { cards } = await loadLeadershipChapters();
  if (cards.length === 0) return null;

  const named = findNamedChapter(question, cards);

  let blocks: CoSAnswerBlock[];
  let headline: string;
  if (named) {
    blocks = await buildNamedChapterBlocks(named.id);
    if (blocks.length === 0) blocks = buildNetworkBlocks(cards);
    headline = `${named.name}: ${named.nextStep}`;
  } else {
    blocks = buildNetworkBlocks(cards);
    headline = networkHeadline(blocks);
  }

  return {
    question,
    headline,
    blocks,
    narrative: null,
    aiUsed: false,
    aiAvailable: options.aiAvailable ?? false,
    generatedAtISO: now.toISOString(),
  };
}
