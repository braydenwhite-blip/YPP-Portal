import type { GrowthTag } from "@prisma/client";

import type { PillTone } from "@/components/people-strategy/pills";

/**
 * People Strategy — Growth Signals (Phase 8).
 *
 * Display metadata + pure helpers for the human-curated `GrowthTag` set. Kept
 * free of DB/session so it can be shared by the server loaders, the server
 * actions (for validation), and the client tag editor.
 */

export const GROWTH_TAG_VALUES: GrowthTag[] = [
  "READY_FOR_MORE",
  "POTENTIAL_TEAM_LEAD",
  "RELIABLE_EXECUTOR",
  "STRONG_COMMUNICATOR",
  "NEEDS_TRAINING",
  "AT_RISK_OF_DISENGAGING",
];

export interface GrowthTagMeta {
  label: string;
  tone: PillTone;
  /** Short, non-corporate explanation shown in the tag editor. */
  description: string;
  /** Positive (growth/opportunity) vs. watch (needs support) framing. */
  kind: "growth" | "watch";
}

export const GROWTH_TAG_META: Record<GrowthTag, GrowthTagMeta> = {
  READY_FOR_MORE: {
    label: "Ready for more",
    tone: "success",
    description: "Consistently delivering — a candidate for more responsibility.",
    kind: "growth",
  },
  POTENTIAL_TEAM_LEAD: {
    label: "Potential team lead",
    tone: "purple",
    description: "Shows leadership instincts; could lead a team or initiative.",
    kind: "growth",
  },
  RELIABLE_EXECUTOR: {
    label: "Reliable executor",
    tone: "info",
    description: "Dependable — work assigned to them gets done.",
    kind: "growth",
  },
  STRONG_COMMUNICATOR: {
    label: "Strong communicator",
    tone: "info",
    description: "Clear, proactive communicator others rally around.",
    kind: "growth",
  },
  NEEDS_TRAINING: {
    label: "Needs training",
    tone: "warning",
    description: "Would benefit from coaching or onboarding support.",
    kind: "watch",
  },
  AT_RISK_OF_DISENGAGING: {
    label: "At risk of disengaging",
    tone: "overdue",
    description: "Signs of pulling back — worth a supportive check-in.",
    kind: "watch",
  },
};

/** Tags that mark someone as a candidate for more responsibility. */
export const GROWTH_OPPORTUNITY_TAGS: GrowthTag[] = [
  "READY_FOR_MORE",
  "POTENTIAL_TEAM_LEAD",
];

export function isGrowthOpportunity(tags: GrowthTag[]): boolean {
  return tags.some((t) => GROWTH_OPPORTUNITY_TAGS.includes(t));
}

export function hasDisengagementRisk(tags: GrowthTag[]): boolean {
  return tags.includes("AT_RISK_OF_DISENGAGING");
}
