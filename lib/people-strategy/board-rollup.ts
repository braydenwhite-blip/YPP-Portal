import type { ActionCommentType, ActionItemStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { formatDueDate } from "@/lib/leadership-action-center/dates";

import { ACTION_STATUS_LABELS } from "./constants";
import { formatEscalationAge } from "./escalation";

/**
 * People Strategy — Board Escalation Roll-up list (`/people/board-rollup`).
 *
 * Reads LIVE Action Tracker data and returns the items the escalation cron has
 * rolled up to the Board (`boardRolledUpAt` set) and that remain unresolved, as
 * fully display-ready, serializable rows. The full comment history — including
 * the system "Rolled up to the Board" audit entry — travels with each row.
 * Gated by ENABLE_ACTION_TRACKER; returns [] when the feature is off. ACCESS to
 * the data is enforced at the page (`requireBoard()`), never here.
 */

export interface BoardRollupComment {
  id: string;
  authorName: string;
  body: string;
  type: ActionCommentType;
  createdAtLabel: string;
}

export interface BoardRollupRow {
  id: string;
  title: string;
  departmentName: string;
  status: ActionItemStatus;
  statusLabel: string;
  deadlineLabel: string;
  leadName: string | null;
  leadEmail: string | null;
  executors: Array<{ name: string | null; email: string | null }>;
  /** How long the item sat at the Leadership before being rolled up, e.g. "8 days". */
  leadershipAgeLabel: string;
  rolledUpAtLabel: string;
  comments: BoardRollupComment[];
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/**
 * Load the Board Roll-up rows: rolled-up, still-unresolved items, most recently
 * rolled up first.
 */
export async function loadBoardRollupList(
  now: Date = new Date()
): Promise<BoardRollupRow[]> {
  if (!isActionTrackerEnabled()) return [];

  const items = await prisma.actionItem.findMany({
    where: {
      boardRolledUpAt: { not: null },
      resolvedAt: null,
    },
    orderBy: { boardRolledUpAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      escalatedToLeadershipAt: true,
      boardRolledUpAt: true,
      deadlineStart: true,
      deadlineEnd: true,
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

  return items.map((item) => ({
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
    leadershipAgeLabel: item.escalatedToLeadershipAt
      ? formatEscalationAge(item.escalatedToLeadershipAt, now)
      : "",
    rolledUpAtLabel: item.boardRolledUpAt
      ? item.boardRolledUpAt.toLocaleString("en-US", DATE_FORMAT)
      : "",
    comments: item.comments.map((c) => ({
      id: c.id,
      authorName: c.author?.name ?? c.author?.email ?? "System",
      body: c.body,
      type: c.type,
      createdAtLabel: c.createdAt.toLocaleString("en-US", DATE_FORMAT),
    })),
  }));
}
