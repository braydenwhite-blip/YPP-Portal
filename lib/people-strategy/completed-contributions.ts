import { prisma } from "@/lib/prisma";

/**
 * Recent completed contributions — the shared "positive memory" selector.
 *
 * The portal must recognize useful work, not only flag problems. Completed
 * actions collapse out of the active surfaces (the dashboard only loads
 * non-COMPLETE work), so this selector reads them back as a member's recent
 * contribution history. It is used across People/CPO rows, Person 360
 * contribution history, the Help Agent "recent contributions" answer, quarterly
 * review evidence, and Leadership Home positive insights.
 *
 * Everything here is deterministic and grounded in ActionItem records — no AI,
 * no scores, no vague "health". The summarizer is a pure function so it can be
 * unit-tested without a database.
 */

export type CompletedContributionRecord = {
  /** When the action transitioned to COMPLETE. */
  completedAt: Date;
  /** Whether the member led the action (vs. executed on it). */
  asLead: boolean;
};

export type CompletedContributionsSummary = {
  /** Completed within the lookback window. */
  total: number;
  thisWeek: number;
  thisMonth: number;
  /** Of the window total, how many the member personally led. */
  asLead: number;
  lastCompletedAtISO: string | null;
  /**
   * A specific, ready-to-render evidence label, or null when there is no recent
   * contribution history. Never a score — always a concrete count + timeframe.
   */
  label: string | null;
};

const DEFAULT_WINDOW_DAYS = 90;

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Pure summarizer: turn a member's completed-action records into a grounded
 * evidence summary. Records outside the window are ignored.
 */
export function summarizeCompletedContributions(
  records: CompletedContributionRecord[],
  now: Date = new Date()
): CompletedContributionsSummary {
  const weekStart = daysAgo(now, 7);
  const monthStart = daysAgo(now, 30);

  let total = 0;
  let thisWeek = 0;
  let thisMonth = 0;
  let asLead = 0;
  let lastCompletedAt: Date | null = null;

  for (const r of records) {
    total += 1;
    if (r.completedAt >= weekStart) thisWeek += 1;
    if (r.completedAt >= monthStart) thisMonth += 1;
    if (r.asLead) asLead += 1;
    if (!lastCompletedAt || r.completedAt > lastCompletedAt) {
      lastCompletedAt = r.completedAt;
    }
  }

  return {
    total,
    thisWeek,
    thisMonth,
    asLead,
    lastCompletedAtISO: lastCompletedAt ? lastCompletedAt.toISOString() : null,
    label: contributionLabel({ total, thisWeek, thisMonth }),
  };
}

/** Pick the most specific, recent-leaning evidence phrasing. */
function contributionLabel(input: { total: number; thisWeek: number; thisMonth: number }): string | null {
  const plural = (n: number) => (n === 1 ? "action" : "actions");
  if (input.thisWeek > 0) {
    return `${input.thisWeek} completed ${plural(input.thisWeek)} this week`;
  }
  if (input.thisMonth > 0) {
    return `${input.thisMonth} completed ${plural(input.thisMonth)} this month`;
  }
  if (input.total > 0) {
    return `${input.total} completed ${plural(input.total)} this quarter`;
  }
  return null;
}

/**
 * Load recent completed contributions for a set of members in one round-trip.
 * A member "contributed" to an action if they led it OR were an executing
 * assignee. Returns a Map keyed by user id; members with no recent completions
 * are present with an empty (label: null) summary so callers can render
 * "No recent contribution history" deterministically.
 */
export async function loadCompletedContributionsByMember(
  memberIds: string[],
  options: { now?: Date; windowDays?: number } = {}
): Promise<Map<string, CompletedContributionsSummary>> {
  const now = options.now ?? new Date();
  const windowStart = daysAgo(now, options.windowDays ?? DEFAULT_WINDOW_DAYS);
  const ids = new Set(memberIds);

  const result = new Map<string, CompletedContributionRecord[]>();
  for (const id of ids) result.set(id, []);

  if (ids.size === 0) {
    return new Map();
  }

  const completed = await prisma.actionItem.findMany({
    where: {
      status: "COMPLETE",
      completedAt: { not: null, gte: windowStart },
      OR: [
        { leadId: { in: [...ids] } },
        { assignments: { some: { role: "EXECUTING", userId: { in: [...ids] } } } },
      ],
    },
    select: {
      completedAt: true,
      leadId: true,
      assignments: { where: { role: "EXECUTING" }, select: { userId: true } },
    },
    orderBy: { completedAt: "desc" },
    take: 2000,
  });

  for (const action of completed) {
    if (!action.completedAt) continue;
    // Credit the lead.
    if (action.leadId && ids.has(action.leadId)) {
      result.get(action.leadId)!.push({ completedAt: action.completedAt, asLead: true });
    }
    // Credit each executing assignee (excluding the lead to avoid double-count).
    for (const a of action.assignments) {
      if (a.userId !== action.leadId && ids.has(a.userId)) {
        result.get(a.userId)!.push({ completedAt: action.completedAt, asLead: false });
      }
    }
  }

  const summaries = new Map<string, CompletedContributionsSummary>();
  for (const [id, records] of result) {
    summaries.set(id, summarizeCompletedContributions(records, now));
  }
  return summaries;
}
