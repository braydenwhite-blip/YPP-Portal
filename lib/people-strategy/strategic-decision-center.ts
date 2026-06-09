import { addDays } from "@/lib/leadership-action-center/dates";

import { isRelatedEntityType, relatedEntityTypeLabel } from "./constants";
import { meetingCategoryLabel } from "./meeting-categories";
import { meetingHref, type DigestDecisionInput } from "./operational-digest";

/**
 * YPP Execution OS — STRATEGIC DECISION CENTER (Phase C).
 *
 * Decisions already exist in the system (they are recorded against meetings), but
 * they are underpowered: a flat list with no sense of which ones became execution,
 * which are still in flight, and which are quietly dying. This module organizes
 * an initiative's real decisions into a leadership-grade Decision Center that
 * answers "what decisions shaped this initiative, which followed through, and what
 * still needs to become action?".
 *
 * HONESTY NOTE (the same rule the strategic timeline follows): we only categorize
 * from PROVABLE state — a decision's `createdAt`, and whether a tracker action is
 * linked to it (`hasLinkedAction`). We do NOT fabricate "reversed" or "outcome"
 * history; faithfully recording a reversal or a measured outcome requires a
 * persisted decision-status log this layer deliberately does not add. The
 * category union reserves those kinds for when such a log exists; the deriver only
 * emits what it can prove. Pure (only the injected `now`).
 */

/**
 * The provable follow-through state of a decision. `reversed` + `measured` are
 * reserved for a future persisted decision log and never emitted today.
 */
export type DecisionCategory =
  | "needs_follow_through"
  | "in_motion"
  | "followed_through"
  | "reversed"
  | "measured";

export const DECISION_CATEGORY_META: Record<
  DecisionCategory,
  { label: string; tone: "overdue" | "warning" | "info" | "success" | "neutral"; rank: number }
> = {
  needs_follow_through: { label: "Needs follow-through", tone: "warning", rank: 0 },
  in_motion: { label: "In motion", tone: "info", rank: 1 },
  followed_through: { label: "Followed through", tone: "success", rank: 2 },
  reversed: { label: "Reversed", tone: "neutral", rank: 3 },
  measured: { label: "Outcome measured", tone: "success", rank: 4 },
};

/** Days within which a decision is "recent" (and an unactioned one is critical). */
export const DECISION_RECENT_DAYS = 14;
/** Days within which an actioned decision still reads as actively "in motion". */
export const DECISION_IN_MOTION_DAYS = 30;

export type DecisionCenterItem = {
  id: string;
  decision: string;
  meetingId: string;
  meetingTitle: string;
  areaLabel: string;
  decidedByName: string | null;
  createdISO: string;
  ageDays: number;
  isRecent: boolean;
  hasLinkedAction: boolean;
  category: DecisionCategory;
  /** Recent + not yet converted to action — the decision most at risk of dying. */
  critical: boolean;
  relatedEntityLabel: string | null;
  href: string;
};

export type DecisionCenterStats = {
  total: number;
  needsFollowThrough: number;
  inMotion: number;
  followedThrough: number;
  critical: number;
  recent: number;
  /** 0–100 share of decisions that have become tracked action. */
  followThroughRate: number;
};

export type DecisionCenter = {
  stats: DecisionCenterStats;
  /** Recent, unconverted decisions — the act-now bucket. */
  critical: DecisionCenterItem[];
  /** Decisions with no linked action yet (open). */
  needsFollowThrough: DecisionCenterItem[];
  /** Decisions actioned recently (pending completion of the work). */
  inMotion: DecisionCenterItem[];
  /** Decisions that turned into tracked work some time ago. */
  followedThrough: DecisionCenterItem[];
  /** Every decision, newest first — the decision history. */
  history: DecisionCenterItem[];
};

function ageInDays(createdAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000));
}

function relatedLabel(d: DigestDecisionInput): string | null {
  if (d.relatedEntityType && d.relatedEntityId && isRelatedEntityType(d.relatedEntityType)) {
    return relatedEntityTypeLabel(d.relatedEntityType);
  }
  return null;
}

/** Categorize one decision from its provable state. Pure. */
export function categorizeDecision(d: DigestDecisionInput, now: Date): DecisionCenterItem {
  const ageDays = ageInDays(d.createdAt, now);
  const isRecent = d.createdAt.getTime() >= addDays(now, -DECISION_RECENT_DAYS).getTime();

  let category: DecisionCategory;
  if (!d.hasLinkedAction) category = "needs_follow_through";
  else if (ageDays <= DECISION_IN_MOTION_DAYS) category = "in_motion";
  else category = "followed_through";

  return {
    id: d.id,
    decision: d.decision,
    meetingId: d.meetingId,
    meetingTitle: d.meetingTitle,
    areaLabel: meetingCategoryLabel(d.meetingCategory),
    decidedByName: d.decidedByName,
    createdISO: d.createdAt.toISOString(),
    ageDays,
    isRecent,
    hasLinkedAction: d.hasLinkedAction,
    category,
    critical: !d.hasLinkedAction && isRecent,
    relatedEntityLabel: relatedLabel(d),
    href: meetingHref(d.meetingId),
  };
}

function newestFirst(a: DecisionCenterItem, b: DecisionCenterItem): number {
  return (
    new Date(b.createdISO).getTime() - new Date(a.createdISO).getTime() ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Build the full Decision Center for an initiative's classified decisions. Pure;
 * every bucket is deterministic and explainable from real state.
 */
export function deriveDecisionCenter(
  decisions: DigestDecisionInput[],
  now: Date = new Date()
): DecisionCenter {
  const items = decisions.map((d) => categorizeDecision(d, now));

  const needsFollowThrough = items
    .filter((i) => i.category === "needs_follow_through")
    .sort(newestFirst);
  const inMotion = items.filter((i) => i.category === "in_motion").sort(newestFirst);
  const followedThrough = items
    .filter((i) => i.category === "followed_through")
    .sort(newestFirst);
  const critical = items.filter((i) => i.critical).sort(newestFirst);
  const recent = items.filter((i) => i.isRecent).length;
  const actioned = inMotion.length + followedThrough.length;

  const stats: DecisionCenterStats = {
    total: items.length,
    needsFollowThrough: needsFollowThrough.length,
    inMotion: inMotion.length,
    followedThrough: followedThrough.length,
    critical: critical.length,
    recent,
    followThroughRate: items.length === 0 ? 0 : Math.round((actioned / items.length) * 100),
  };

  return {
    stats,
    critical,
    needsFollowThrough,
    inMotion,
    followedThrough,
    history: [...items].sort(newestFirst),
  };
}
