import { prisma } from "@/lib/prisma";
import type {
  LeadershipActionCategory,
  LeadershipActionItem,
  LeadershipActionPriority,
  LeadershipActionStatus,
  LeadershipMeeting,
  LeadershipMeetingKind,
  Prisma,
} from "@prisma/client";

import {
  endOfDay,
  endOfOperatingWeek,
  isOverdue,
  startOfDay,
  startOfOperatingWeek,
} from "./dates";

export type ActionItemWithRelations = LeadershipActionItem & {
  primaryOwner: { id: string; name: string | null; email: string } | null;
  meeting: { id: string; title: string; kind: LeadershipMeetingKind } | null;
  inputNeededFrom: Array<{
    user: { id: string; name: string | null; email: string };
  }>;
  _count?: { updates: number };
};

export type MeetingWithCounts = LeadershipMeeting & {
  owner: { id: string; name: string | null; email: string } | null;
  _count: { actionItems: number };
};

export interface ActionItemFilters {
  category?: LeadershipActionCategory[];
  status?: LeadershipActionStatus[];
  priority?: LeadershipActionPriority[];
  ownerId?: string;
  meetingId?: string;
  needsOfficerDiscussion?: boolean;
  weekStart?: Date;
  search?: string;
  includeArchived?: boolean;
  /** Only items with a deadline ≤ this date. */
  dueBefore?: Date;
}

const ACTION_ITEM_INCLUDE = {
  primaryOwner: { select: { id: true, name: true, email: true } },
  meeting: { select: { id: true, title: true, kind: true } },
  inputNeededFrom: {
    select: {
      user: { select: { id: true, name: true, email: true } },
    },
  },
  _count: { select: { updates: true } },
} satisfies Prisma.LeadershipActionItemInclude;

function buildWhere(filters: ActionItemFilters): Prisma.LeadershipActionItemWhereInput {
  const where: Prisma.LeadershipActionItemWhereInput = {};

  if (!filters.includeArchived) {
    where.archivedAt = null;
  }
  if (filters.category && filters.category.length > 0) {
    where.category = { in: filters.category };
  }
  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status };
  }
  if (filters.priority && filters.priority.length > 0) {
    where.priority = { in: filters.priority };
  }
  if (filters.ownerId) {
    where.OR = [
      { primaryOwnerId: filters.ownerId },
      { inputNeededFrom: { some: { userId: filters.ownerId } } },
    ];
  }
  if (filters.meetingId) {
    where.meetingId = filters.meetingId;
  }
  if (typeof filters.needsOfficerDiscussion === "boolean") {
    where.needsOfficerDiscussion = filters.needsOfficerDiscussion;
  }
  if (filters.weekStart) {
    where.weekStart = filters.weekStart;
  }
  if (filters.dueBefore) {
    where.dueDate = { lte: filters.dueBefore };
  }
  if (filters.search) {
    const term = filters.search.trim();
    if (term) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
            { notes: { contains: term, mode: "insensitive" } },
            { sourceLabel: { contains: term, mode: "insensitive" } },
          ],
        },
      ];
    }
  }

  return where;
}

export async function listActionItems(
  filters: ActionItemFilters = {}
): Promise<ActionItemWithRelations[]> {
  return prisma.leadershipActionItem.findMany({
    where: buildWhere(filters),
    include: ACTION_ITEM_INCLUDE,
    orderBy: [
      { status: "asc" },
      { dueDate: { sort: "asc", nulls: "last" } },
      { priority: "desc" },
      { createdAt: "desc" },
    ],
  });
}

export async function getActionItemById(id: string): Promise<
  | (ActionItemWithRelations & {
      updates: Array<{
        id: string;
        kind: string;
        body: string;
        createdAt: Date;
        author: { id: string; name: string | null; email: string } | null;
      }>;
    })
  | null
> {
  return prisma.leadershipActionItem.findUnique({
    where: { id },
    include: {
      ...ACTION_ITEM_INCLUDE,
      updates: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

export interface DashboardSnapshot {
  now: Date;
  weekStart: Date;
  weekEnd: Date;
  dueToday: ActionItemWithRelations[];
  dueThisWeek: ActionItemWithRelations[];
  overdue: ActionItemWithRelations[];
  blocked: ActionItemWithRelations[];
  needsOfficerDiscussion: ActionItemWithRelations[];
  completedThisWeek: ActionItemWithRelations[];
  upcomingMeetings: MeetingWithCounts[];
  categoryCounts: Record<LeadershipActionCategory, number>;
  totalOpen: number;
}

/**
 * One-shot dashboard query. Deliberately bounded to "this operating week"
 * + a tight overdue/blocked window so the page can render with a single
 * Prisma round-trip per section.
 */
export async function getDashboardSnapshot(now: Date = new Date()): Promise<DashboardSnapshot> {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfOperatingWeek(now);
  const weekEnd = endOfOperatingWeek(now);

  const [
    dueToday,
    dueThisWeek,
    overdueRaw,
    blocked,
    needsOfficerDiscussion,
    completedThisWeek,
    upcomingMeetings,
    categoryGroup,
    totalOpen,
  ] = await Promise.all([
    prisma.leadershipActionItem.findMany({
      where: {
        archivedAt: null,
        status: { not: "COMPLETE" },
        dueDate: { gte: todayStart, lte: todayEnd },
      },
      include: ACTION_ITEM_INCLUDE,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    prisma.leadershipActionItem.findMany({
      where: {
        archivedAt: null,
        status: { not: "COMPLETE" },
        dueDate: { gte: todayStart, lte: weekEnd },
      },
      include: ACTION_ITEM_INCLUDE,
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    }),
    prisma.leadershipActionItem.findMany({
      where: {
        archivedAt: null,
        status: { not: "COMPLETE" },
        dueDate: { lt: todayStart },
      },
      include: ACTION_ITEM_INCLUDE,
      orderBy: [{ dueDate: "asc" }],
      take: 50,
    }),
    prisma.leadershipActionItem.findMany({
      where: { archivedAt: null, status: "BLOCKED" },
      include: ACTION_ITEM_INCLUDE,
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 25,
    }),
    prisma.leadershipActionItem.findMany({
      where: {
        archivedAt: null,
        needsOfficerDiscussion: true,
        status: { not: "COMPLETE" },
      },
      include: ACTION_ITEM_INCLUDE,
      orderBy: [
        { officerDiscussionDate: { sort: "asc", nulls: "last" } },
        { dueDate: "asc" },
      ],
      take: 25,
    }),
    prisma.leadershipActionItem.findMany({
      where: {
        archivedAt: null,
        status: "COMPLETE",
        completedAt: { gte: weekStart, lte: weekEnd },
      },
      include: ACTION_ITEM_INCLUDE,
      orderBy: [{ completedAt: "desc" }],
      take: 25,
    }),
    prisma.leadershipMeeting.findMany({
      where: {
        archivedAt: null,
        OR: [{ scheduledAt: { gte: now } }, { scheduledAt: null }],
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { actionItems: true } },
      },
      orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { title: "asc" }],
      take: 8,
    }),
    prisma.leadershipActionItem.groupBy({
      by: ["category"],
      _count: { _all: true },
      where: { archivedAt: null, status: { not: "COMPLETE" } },
    }),
    prisma.leadershipActionItem.count({
      where: { archivedAt: null, status: { not: "COMPLETE" } },
    }),
  ]);

  // Filter overdue defensively (Prisma already did the work, but `isOverdue`
  // is the contract used by the UI badges so we keep them aligned).
  const overdue = overdueRaw.filter((item) => isOverdue(item.dueDate, now));

  const categoryCounts: Record<LeadershipActionCategory, number> = {
    INSTRUCTION: 0,
    TECHNOLOGY: 0,
    COMMUNICATION: 0,
    STAFF_MANAGEMENT: 0,
  };
  for (const row of categoryGroup) {
    categoryCounts[row.category as LeadershipActionCategory] = row._count._all;
  }

  return {
    now,
    weekStart,
    weekEnd,
    dueToday,
    dueThisWeek,
    overdue,
    blocked,
    needsOfficerDiscussion,
    completedThisWeek,
    upcomingMeetings,
    categoryCounts,
    totalOpen,
  };
}

export async function listMeetings(
  options: { includeArchived?: boolean; upcomingOnly?: boolean } = {}
): Promise<MeetingWithCounts[]> {
  const where: Prisma.LeadershipMeetingWhereInput = {};
  if (!options.includeArchived) {
    where.archivedAt = null;
  }
  if (options.upcomingOnly) {
    where.OR = [{ scheduledAt: { gte: new Date() } }, { scheduledAt: null }];
  }

  return prisma.leadershipMeeting.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { actionItems: true } },
    },
    orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { title: "asc" }],
  });
}

export async function getMeetingWithItems(meetingId: string): Promise<
  | (MeetingWithCounts & {
      actionItems: ActionItemWithRelations[];
    })
  | null
> {
  const meeting = await prisma.leadershipMeeting.findUnique({
    where: { id: meetingId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { actionItems: true } },
      actionItems: {
        where: { archivedAt: null },
        include: ACTION_ITEM_INCLUDE,
        orderBy: [
          { needsOfficerDiscussion: "desc" },
          { status: "asc" },
          { dueDate: { sort: "asc", nulls: "last" } },
        ],
      },
    },
  });
  return meeting;
}

/** Lightweight user list for owner / input pickers. */
export async function listLeadershipUsers(): Promise<
  Array<{ id: string; name: string | null; email: string; primaryRole: string | null }>
> {
  return prisma.user.findMany({
    where: {
      archivedAt: null,
      OR: [
        { primaryRole: "ADMIN" },
        { primaryRole: "STAFF" },
        { roles: { some: { role: { in: ["ADMIN", "STAFF"] } } } },
      ],
    },
    select: { id: true, name: true, email: true, primaryRole: true },
    orderBy: [{ name: "asc" }],
    take: 100,
  });
}
