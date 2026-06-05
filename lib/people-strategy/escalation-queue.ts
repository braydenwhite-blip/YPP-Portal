import type { ActionCommentType, ActionItemStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { formatDueDate } from "@/lib/leadership-action-center/dates";

import { ACTION_STATUS_LABELS } from "./constants";
import {
  escalationReason,
  escalationSince,
  formatEscalationAge,
  isEscalationEligible,
  type EscalationReason,
} from "./escalation";

/**
 * People Strategy — Leadership Escalation Queue (`/people`) data loader.
 *
 * Reads LIVE Action Tracker data and returns the flagged / OVERDUE items that
 * have been unresolved for 48h+ — the same set the escalation cron notifies on
 * — as fully display-ready, serializable rows (mirroring the read-query
 * convention in `people-dashboard.ts`). The full comment history travels with
 * each row so the Leadership can review it inline. Gated by ENABLE_ACTION_TRACKER;
 * returns an empty list when the feature is off.
 */

export interface EscalationComment {
  id: string;
  authorName: string;
  body: string;
  type: ActionCommentType;
  createdAtLabel: string;
}

export interface EscalationQueueRow {
  id: string;
  title: string;
  departmentName: string;
  status: ActionItemStatus;
  statusLabel: string;
  deadlineLabel: string;
  leadName: string | null;
  leadEmail: string | null;
  executors: Array<{ name: string | null; email: string | null }>;
  reason: EscalationReason;
  ageLabel: string;
  /** True once the escalation cron has notified the Leadership for this item. */
  notified: boolean;
  comments: EscalationComment[];
}

const COMMENT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/**
 * Load the Leadership Escalation Queue rows: unresolved, flagged-or-OVERDUE items
 * whose oldest trigger is 48h+ old, oldest (most urgent) first.
 */
export async function loadLeadershipEscalationQueue(
  now: Date = new Date()
): Promise<EscalationQueueRow[]> {
  if (!isActionTrackerEnabled()) return [];

  const items = await prisma.actionItem.findMany({
    where: {
      resolvedAt: null,
      OR: [{ flaggedAt: { not: null } }, { status: "OVERDUE" }],
    },
    select: {
      id: true,
      title: true,
      status: true,
      flaggedAt: true,
      deadlineStart: true,
      deadlineEnd: true,
      resolvedAt: true,
      escalatedToLeadershipAt: true,
      department: { select: { name: true } },
      lead: { select: { name: true, email: true } },
      assignments: {
        where: { role: "EXECUTING" },
        select: { user: { select: { name: true, email: true } } },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          type: true,
          createdAt: true,
          author: { select: { name: true, email: true } },
        },
      },
    },
    take: 500,
  });

  // Keep each row's escalation-clock start alongside it for sorting, then drop
  // it — the oldest (most urgent) escalation surfaces first.
  return items
    .filter((item) => isEscalationEligible(item, now))
    .map((item) => {
      const since = escalationSince(item);
      const row: EscalationQueueRow = {
        id: item.id,
        title: item.title,
        departmentName: item.department?.name ?? "Unassigned",
        status: item.status,
        statusLabel: ACTION_STATUS_LABELS[item.status],
        deadlineLabel: formatDueDate(item.deadlineEnd ?? item.deadlineStart),
        leadName: item.lead?.name ?? null,
        leadEmail: item.lead?.email ?? null,
        executors: item.assignments.map((a) => ({
          name: a.user.name,
          email: a.user.email,
        })),
        reason: escalationReason(item) ?? "Flagged",
        ageLabel: since ? formatEscalationAge(since, now) : "",
        notified: item.escalatedToLeadershipAt != null,
        comments: item.comments.map((c) => ({
          id: c.id,
          authorName: c.author?.name ?? c.author?.email ?? "System",
          body: c.body,
          type: c.type,
          createdAtLabel: c.createdAt.toLocaleString("en-US", COMMENT_DATE_FORMAT),
        })),
      };
      return { row, sinceMs: since ? since.getTime() : 0 };
    })
    .sort((a, b) => a.sinceMs - b.sinceMs)
    .map((entry) => entry.row);
}
