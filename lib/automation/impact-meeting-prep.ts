// ============================================================================
// IMPACT MEETING PREP automation (Phase 12)
// ============================================================================
//
// The deterministic, week-keyed metric generator already exists
// (`lib/chapters/impact-meeting.ts:buildImpactMeetingPrep`). This wrapper REUSES
// that prep verbatim and adds the automation layer on top: it surfaces the
// "numbers below target this week" as structured evidence, an honest-answer
// prompt, and two automation items (prep due + numbers missing). It generates
// structured evidence, never fluffy prose.

import type { ImpactMeetingPrep } from "@/lib/chapters/impact-meeting";
import type { AutomationItem, ChapterFacts } from "@/lib/automation/types";
import { makeAutomationItem } from "@/lib/automation/build-item";
import { automationItemId } from "@/lib/automation/item-identity";

export type ImpactPrepMissingNumber = { group: string; label: string; value: string | number; detail?: string };

export type ChapterImpactPrep = {
  prep: ImpactMeetingPrep;
  /** Metrics flagged below a playbook target this week. */
  missingNumbers: ImpactPrepMissingNumber[];
  /** Top blockers to raise (from the prep). */
  topBlockers: string[];
  /** The single honest-answer prompt. */
  honestAnswerPrompt: string;
};

const HONEST_ANSWER_PROMPT =
  "What is one thing not going as expected, and what is your plan?";

/** Build the chapter impact-meeting prep + the metrics that are below target. */
export function buildChapterImpactPrep(prep: ImpactMeetingPrep): ChapterImpactPrep {
  const missingNumbers: ImpactPrepMissingNumber[] = [];
  for (const group of prep.groups) {
    for (const m of group.metrics) {
      if (m.attention) {
        missingNumbers.push({ group: group.title, label: m.label, value: m.value, detail: m.detail });
      }
    }
  }
  return {
    prep,
    missingNumbers,
    topBlockers: prep.blockers.slice(0, 5),
    honestAnswerPrompt: HONEST_ANSWER_PROMPT,
  };
}

/**
 * The automation items for impact-meeting prep: a weekly "prepare" item plus, if
 * any week-appropriate numbers are below target, a "numbers missing" item that
 * names exactly which metrics to gather.
 */
export function buildImpactMeetingItems(
  impact: ChapterImpactPrep,
  facts: ChapterFacts,
  now: Date
): AutomationItem[] {
  const items: AutomationItem[] = [];
  const week = facts.weekNumber;

  items.push(
    makeAutomationItem({
      type: "IMPACT_MEETING_PREP_DUE",
      chapterId: facts.chapterId,
      now,
      title: `Prep for this week's Chapter Impact Meeting (Week ${week})`,
      description: `Bring the Week ${week} numbers: ${impact.prep.focus}.`,
      why: `Chapter Presidents present a mandatory weekly impact meeting. Week ${week} focuses on "${impact.prep.focus}" — bring the real numbers and one honest answer.`,
      resolvesWhen: "Submit this week's impact entry / present the numbers.",
      primaryActionLabel: "Open impact prep",
      primaryActionHref: "/my-weekly-impact",
      secondaryActionLabel: "Meetings",
      secondaryActionHref: "/meetings",
      playbookWeekRelevance: week,
      currentWeek: week,
      sourceData: { week, focus: impact.prep.focus, weekLabel: impact.prep.weekLabel },
      idParts: { entityId: null, window: impact.prep.weekStartISO },
    })
  );

  if (impact.missingNumbers.length > 0) {
    items.push(
      makeAutomationItem({
        type: "IMPACT_MEETING_NUMBERS_MISSING",
        chapterId: facts.chapterId,
        now,
        title: `${impact.missingNumbers.length} metric(s) below target for the impact meeting`,
        description: `Below target: ${impact.missingNumbers.map((m) => m.label).join(", ")}.`,
        why: `These Week ${week} numbers are below the playbook target and will come up at the impact meeting: ${impact.missingNumbers
          .map((m) => `${m.label} (${m.value}${m.detail ? `, ${m.detail}` : ""})`)
          .join("; ")}.`,
        resolvesWhen: "Move each metric to its target, or bring a plan to the meeting.",
        primaryActionLabel: "Open operating system",
        primaryActionHref: "/chapter",
        playbookWeekRelevance: week,
        currentWeek: week,
        sourceData: { missing: impact.missingNumbers },
        id: automationItemId("IMPACT_MEETING_NUMBERS_MISSING", facts.chapterId, { window: impact.prep.weekStartISO }),
      })
    );
  }

  return items;
}
