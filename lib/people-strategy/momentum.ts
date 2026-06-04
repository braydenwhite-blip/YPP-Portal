/**
 * People Strategy — Momentum scoring + Follow-Up drafting.
 *
 * Pure primitives (no DB, no session, no Prisma types) so they are trivially
 * unit-testable and safe to import from either the server loaders or client
 * components. The Command Center turns raw Action Tracker data into these
 * transparent, explainable signals.
 *
 * Design intent (see docs/portal-consolidation-plan.md → "People Strategy OS"):
 * momentum is a SUPPORT signal, not a punishment score. The factors are kept
 * deliberately simple and surfaced in the UI so a person can always see exactly
 * why they landed where they did.
 */

export type MomentumLabel =
  | "STRONG"
  | "STEADY"
  | "NEEDS_SUPPORT"
  | "AT_RISK"
  | "NO_SIGNAL";

/** Raw counts that feed the momentum score, computed by the loaders. */
export interface MomentumFactors {
  /** Open (not complete) items currently owned. */
  openCount: number;
  /** Items completed within the recent activity window. */
  completedRecent: number;
  /** Open items past their deadline. */
  overdue: number;
  /** Open items flagged / escalated for attention. */
  flagged: number;
  /** Any comment authored, or any owned item updated, within the window. */
  hasRecentActivity: boolean;
}

export interface MomentumResult {
  label: MomentumLabel;
  /** The transparent integer score the label is derived from. */
  score: number;
  factors: MomentumFactors;
}

/**
 * Score = momentum from follow-through, minus drag from slippage, plus a small
 * credit for simply being active. Weights are intentionally legible:
 *   +2 per recent completion · -2 per overdue · -1 per flagged · +1 if active.
 */
export function momentumScore(f: MomentumFactors): number {
  return (
    f.completedRecent * 2 -
    f.overdue * 2 -
    f.flagged * 1 +
    (f.hasRecentActivity ? 1 : 0)
  );
}

/**
 * Map factors → a supportive label. "No Recent Signal" is reserved for people
 * with no open work AND no recent activity — we genuinely have nothing to say,
 * which is different from "At Risk".
 */
export function scoreMomentum(f: MomentumFactors): MomentumResult {
  const score = momentumScore(f);

  let label: MomentumLabel;
  if (f.openCount === 0 && f.completedRecent === 0 && !f.hasRecentActivity) {
    label = "NO_SIGNAL";
  } else if (score >= 3) {
    label = "STRONG";
  } else if (score >= 1) {
    label = "STEADY";
  } else if (score >= -1) {
    label = "NEEDS_SUPPORT";
  } else {
    label = "AT_RISK";
  }

  return { label, score, factors: f };
}

export type MomentumTone = "success" | "info" | "warning" | "overdue" | "neutral";

/** Display metadata for each momentum label (label text, pill tone, why-copy). */
export const MOMENTUM_META: Record<
  MomentumLabel,
  { label: string; tone: MomentumTone; description: string }
> = {
  STRONG: {
    label: "Strong Momentum",
    tone: "success",
    description: "Completing work and staying active with little slipping.",
  },
  STEADY: {
    label: "Steady",
    tone: "info",
    description: "Moving things forward at a healthy, reliable pace.",
  },
  NEEDS_SUPPORT: {
    label: "Needs Support",
    tone: "warning",
    description: "A few items are slipping — a check-in would help.",
  },
  AT_RISK: {
    label: "At Risk",
    tone: "overdue",
    description: "Multiple overdue or flagged items and little recent activity.",
  },
  NO_SIGNAL: {
    label: "No Recent Signal",
    tone: "neutral",
    description: "No open work and nothing recent — may need a first assignment.",
  },
};

/**
 * Order momentum labels from most-concerning to healthiest, so the People
 * Momentum list can lead with the people who need attention.
 */
export const MOMENTUM_SEVERITY_ORDER: MomentumLabel[] = [
  "AT_RISK",
  "NEEDS_SUPPORT",
  "NO_SIGNAL",
  "STEADY",
  "STRONG",
];

// ---------------------------------------------------------------------------
// Follow-Up Generator
// ---------------------------------------------------------------------------

export type FollowUpTone = "reminder" | "accountability" | "support" | "recap";

export interface FollowUpContext {
  itemTitle: string;
  ownerName: string;
  /** Human due-date label, e.g. "Jun 10" (already formatted by the caller). */
  dueLabel: string;
  /** Positive when overdue; 0 or negative when not yet due. */
  daysOverdue: number;
  /** Optional meeting the commitment came from, for the recap tone. */
  meetingLabel?: string | null;
}

export const FOLLOW_UP_TONES: Array<{
  key: FollowUpTone;
  label: string;
  description: string;
}> = [
  {
    key: "reminder",
    label: "Friendly reminder",
    description: "Light, no-pressure nudge.",
  },
  {
    key: "accountability",
    label: "Accountability",
    description: "Clear, direct ask to close it out.",
  },
  {
    key: "support",
    label: "Offer help",
    description: "Check whether they're blocked or need support.",
  },
  {
    key: "recap",
    label: "Meeting recap",
    description: "Restate the commitment from a meeting.",
  },
];

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

/**
 * Draft a copyable follow-up message. Returns plain text only — the portal does
 * NOT send anything from here. The caller copies it into email/Slack/etc.
 */
export function generateFollowUp(tone: FollowUpTone, ctx: FollowUpContext): string {
  const name = firstName(ctx.ownerName);
  const overdue = ctx.daysOverdue > 0;
  const dayWord = ctx.daysOverdue === 1 ? "day" : "days";

  switch (tone) {
    case "reminder":
      return overdue
        ? `Hi ${name} — quick nudge on "${ctx.itemTitle}". It was due ${ctx.dueLabel} (${ctx.daysOverdue} ${dayWord} ago). No worries if it slipped — could you update the tracker when you get a sec? Thanks!`
        : `Hi ${name} — friendly heads-up that "${ctx.itemTitle}" is coming up (due ${ctx.dueLabel}). Let me know if you're on track. Thanks!`;

    case "accountability":
      return overdue
        ? `Hi ${name}, "${ctx.itemTitle}" is now ${ctx.daysOverdue} ${dayWord} overdue (due ${ctx.dueLabel}). Can you either complete it or post a new committed date in the tracker by end of day? If something's in the way, flag it so we can help.`
        : `Hi ${name}, confirming you're owning "${ctx.itemTitle}" (due ${ctx.dueLabel}). Please make sure it lands on time or update the tracker if the date needs to move.`;

    case "support":
      return overdue
        ? `Hey ${name} — I noticed "${ctx.itemTitle}" has been open past ${ctx.dueLabel}. Totally fine if it's been a busy stretch. Is anything blocking you on this, or is there a way I can help move it forward?`
        : `Hey ${name} — checking in on "${ctx.itemTitle}" (due ${ctx.dueLabel}). Do you have everything you need, or is there anything I can do to help?`;

    case "recap": {
      const source = ctx.meetingLabel
        ? `In ${ctx.meetingLabel}, you committed to`
        : `Following up on the commitment to`;
      return `Hi ${name} — ${source} "${ctx.itemTitle}", due ${ctx.dueLabel}.${
        overdue ? ` It's now ${ctx.daysOverdue} ${dayWord} past that.` : ""
      } Please update the tracker so the team knows where it stands. Thanks for following through!`;
    }

    default:
      return "";
  }
}
