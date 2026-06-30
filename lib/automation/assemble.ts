// ============================================================================
// The PURE Automation Brain core
// ============================================================================
//
// `assembleChapterAutomation` takes a chapter's facts + the existing engine's
// blockers + student needs + impact prep (all computed by the Chapter OS) and
// produces the full automation read model: normalized items, the playbook
// interpretation, stage detection, readiness checklist, impact-meeting prep, and
// leadership escalations. No Prisma, no `server-only` — fully unit-testable
// (pass `now`). The server wrapper lives in `build-chapter-automation.ts`.

import {
  type AutomationItem,
  type AutomationWorkflow,
  type ChapterFacts,
  AUTOMATION_WORKFLOWS,
} from "@/lib/automation/types";
import type { ChapterBlocker } from "@/lib/chapters/needs-attention-rules";
import type { StudentCommunityNeed } from "@/lib/chapters/student-community";
import type { ImpactMeetingPrep } from "@/lib/chapters/impact-meeting";
import { interpretPlaybook, type PlaybookInterpretation } from "@/lib/automation/playbook";
import { detectChapterStages, type ChapterStageDetection } from "@/lib/automation/stage-detector";
import { computeChapterReadiness, type ChapterReadiness } from "@/lib/automation/readiness";
import { buildChapterImpactPrep, buildImpactMeetingItems, type ChapterImpactPrep } from "@/lib/automation/impact-meeting-prep";
import { buildCadenceItems, buildPlaybookPacingItem } from "@/lib/automation/rules/cadence";
import { blockersToAutomationItems } from "@/lib/automation/normalize/from-blockers";
import { studentNeedsToAutomationItems } from "@/lib/automation/normalize/from-student-needs";
import { buildChapterEscalations, type ChapterEscalation } from "@/lib/automation/escalation";
import { sortAutomationItems } from "@/lib/automation/rank";

// ---------------------------------------------------------------------------
// Dismissal overlay (read-model). Persistence is intentionally deferred — see
// the AutomationDismissal spec in the final report. When a future pass adds the
// table, pass the rows here to flip OPEN → DISMISSED/SNOOZED with no other change.
// ---------------------------------------------------------------------------

export type AutomationDismissalOverlay = {
  automationItemKey: string; // the AutomationItem.id
  action: "DISMISSED" | "SNOOZED";
  /** ISO; for SNOOZED, the item reappears after this time. */
  snoozedUntil?: string | null;
};

export type ChapterAutomation = {
  chapterId: string;
  chapterName: string;
  weekNumber: number;
  generatedAt: string;
  playbook: PlaybookInterpretation;
  stages: ChapterStageDetection;
  readiness: ChapterReadiness;
  impactPrep: ChapterImpactPrep;
  escalations: ChapterEscalation[];
  /** Open items, highest urgency first. */
  items: AutomationItem[];
  /** The top handful to act on today. */
  topPriorities: AutomationItem[];
  /** Items due/overdue for past playbook weeks. */
  overdue: AutomationItem[];
  /** Items relevant to the current playbook week. */
  thisWeek: AutomationItem[];
  byWorkflow: Record<AutomationWorkflow, AutomationItem[]>;
  /** Items suppressed by a dismissal/snooze overlay (for "show dismissed"). */
  suppressed: AutomationItem[];
  counts: {
    total: number;
    blocking: number;
    urgent: number;
    attention: number;
    info: number;
    escalations: number;
  };
};

export type AssembleInput = {
  facts: ChapterFacts;
  blockers: ChapterBlocker[];
  studentNeeds: StudentCommunityNeed[];
  impactPrep: ImpactMeetingPrep;
  now: Date;
  /** Whether the chapter week is anchored to a real date (else lower confidence). */
  weekAnchored?: boolean;
  dismissals?: AutomationDismissalOverlay[];
};

function emptyByWorkflow(): Record<AutomationWorkflow, AutomationItem[]> {
  const out = {} as Record<AutomationWorkflow, AutomationItem[]>;
  for (const w of AUTOMATION_WORKFLOWS) out[w] = [];
  return out;
}

/** Apply a dismissal/snooze overlay: returns [openItems, suppressedItems]. */
function applyOverlay(
  items: AutomationItem[],
  overlay: AutomationDismissalOverlay[],
  now: Date
): [AutomationItem[], AutomationItem[]] {
  if (overlay.length === 0) return [items, []];
  const byKey = new Map(overlay.map((o) => [o.automationItemKey, o]));
  const open: AutomationItem[] = [];
  const suppressed: AutomationItem[] = [];
  for (const item of items) {
    const o = byKey.get(item.id);
    if (!o) {
      open.push(item);
      continue;
    }
    if (o.action === "SNOOZED" && o.snoozedUntil && Date.parse(o.snoozedUntil) <= now.getTime()) {
      open.push(item); // snooze expired → back to open
      continue;
    }
    suppressed.push({ ...item, status: o.action });
  }
  return [open, suppressed];
}

/** The pure brain: facts + existing engine output → full automation read model. */
export function assembleChapterAutomation(input: AssembleInput): ChapterAutomation {
  const { facts, blockers, studentNeeds, impactPrep, now } = input;
  const week = facts.weekNumber;

  // Net-new intelligence.
  const playbook = interpretPlaybook(facts, { dataConfident: input.weekAnchored !== false });
  const stages = detectChapterStages(facts);
  const readiness = computeChapterReadiness(facts, now);
  const impact = buildChapterImpactPrep(impactPrep);

  // Items: normalize the existing engine + add net-new generated items.
  const normalized = [
    ...blockersToAutomationItems(blockers, facts.chapterId, now, week),
    ...studentNeedsToAutomationItems(studentNeeds, facts.chapterId, now, week),
  ];
  const generated = [...buildCadenceItems(facts, now), ...buildImpactMeetingItems(impact, facts, now)];
  const pacing = buildPlaybookPacingItem(facts, playbook, now);
  if (pacing) generated.push(pacing);

  // De-duplicate by id (stable ids make this safe across sources).
  const seen = new Set<string>();
  const merged: AutomationItem[] = [];
  for (const item of [...normalized, ...generated]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  const [openRaw, suppressed] = applyOverlay(merged, input.dismissals ?? [], now);
  const items = sortAutomationItems(openRaw);

  const byWorkflow = emptyByWorkflow();
  for (const item of items) byWorkflow[item.workflow].push(item);

  const overdue = items.filter((i) => i.playbookWeekRelevance != null && i.playbookWeekRelevance < week);
  const thisWeek = items.filter((i) => i.playbookWeekRelevance == null || i.playbookWeekRelevance === week);

  const escalations = buildChapterEscalations(facts, readiness, playbook, now);

  return {
    chapterId: facts.chapterId,
    chapterName: facts.chapterName,
    weekNumber: week,
    generatedAt: now.toISOString(),
    playbook,
    stages,
    readiness,
    impactPrep: impact,
    escalations,
    items,
    topPriorities: items.slice(0, 5),
    overdue,
    thisWeek,
    byWorkflow,
    suppressed,
    counts: {
      total: items.length,
      blocking: items.filter((i) => i.severity === "BLOCKING").length,
      urgent: items.filter((i) => i.severity === "URGENT").length,
      attention: items.filter((i) => i.severity === "ATTENTION").length,
      info: items.filter((i) => i.severity === "INFO").length,
      escalations: escalations.length,
    },
  };
}
