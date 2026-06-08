/**
 * Student Operating System / Growth Engine (Phase N1) — shared read helpers.
 *
 * Plain async functions (no "use server") that load Growth* rows from Prisma and
 * reshape them into the pure-engine input types (hierarchy nodes, event counts).
 * Used by recompute (engine inputs) and the dashboards. Keeping the Prisma reads
 * here means the pure engine never imports the client and stays unit-testable.
 */

import { prisma } from "@/lib/prisma";
import {
  GROWTH_EVENT_DEFINITIONS,
  isGrowthEventType,
  tallyEventCounts,
  type GrowthEventType,
} from "./events";
import {
  type HierarchyGoal,
  type HierarchyVision,
} from "./hierarchy";
import type { GrowthTrackId } from "./constants";

const actionSelect = {
  id: true,
  title: true,
  status: true,
  order: true,
  dueDate: true,
  completedAt: true,
  goalId: true,
  milestoneId: true,
} as const;

export interface LoadedHierarchy {
  visions: HierarchyVision[];
  /** Goals with no parent vision (skip-level). */
  looseGoals: HierarchyGoal[];
  /** goalId -> track, so stalled-goal nudges can pick the right opportunity kind. */
  goalTrackById: Map<string, GrowthTrackId>;
}

/**
 * Load a user's full Vision -> Goal -> Milestone -> Action tree, shaped for the
 * pure rollup helpers. Direct actions are filtered to `milestoneId = null` so a
 * milestone's actions are never double-counted under its goal.
 */
export async function loadGrowthHierarchy(userId: string): Promise<LoadedHierarchy> {
  const [visionRows, goalRows] = await Promise.all([
    prisma.growthVision.findMany({
      where: { userId },
      orderBy: { order: "asc" },
      select: { id: true, title: true, status: true, order: true },
    }),
    prisma.growthGoal.findMany({
      where: { userId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        status: true,
        order: true,
        visionId: true,
        targetDate: true,
        track: true,
        milestones: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            status: true,
            order: true,
            actions: { orderBy: { order: "asc" }, select: actionSelect },
          },
        },
        actions: {
          where: { milestoneId: null },
          orderBy: { order: "asc" },
          select: actionSelect,
        },
      },
    }),
  ]);

  const goalTrackById = new Map<string, GrowthTrackId>();
  const goalsByVision = new Map<string, HierarchyGoal[]>();
  const looseGoals: HierarchyGoal[] = [];

  for (const g of goalRows) {
    goalTrackById.set(g.id, g.track as GrowthTrackId);
    const goal: HierarchyGoal = {
      id: g.id,
      title: g.title,
      status: g.status,
      order: g.order,
      targetDate: g.targetDate,
      milestones: g.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        order: m.order,
        actions: m.actions.map(toHierarchyAction),
      })),
      directActions: g.actions.map(toHierarchyAction),
    };
    if (g.visionId) {
      const list = goalsByVision.get(g.visionId) ?? [];
      list.push(goal);
      goalsByVision.set(g.visionId, list);
    } else {
      looseGoals.push(goal);
    }
  }

  const visions: HierarchyVision[] = visionRows.map((v) => ({
    id: v.id,
    title: v.title,
    status: v.status,
    order: v.order,
    goals: goalsByVision.get(v.id) ?? [],
  }));

  return { visions, looseGoals, goalTrackById };
}

function toHierarchyAction(a: {
  id: string;
  title: string;
  status: string;
  order: number;
  dueDate: Date | null;
  completedAt: Date | null;
  goalId: string | null;
  milestoneId: string | null;
}) {
  return {
    id: a.id,
    title: a.title,
    status: a.status,
    order: a.order,
    dueDate: a.dueDate,
    completedAt: a.completedAt,
    goalId: a.goalId,
    milestoneId: a.milestoneId,
  };
}

export interface LoadedEvents {
  counts: Partial<Record<GrowthEventType, number>>;
  completedExperiences: number;
  lastEventAt: Date | null;
}

/** Load a user's events and tally them into engine inputs + profile counters. */
export async function loadGrowthEvents(userId: string): Promise<LoadedEvents> {
  const rows = await prisma.growthProgressEvent.findMany({
    where: { userId },
    select: { type: true, occurredAt: true },
    orderBy: { occurredAt: "desc" },
  });
  const counts = tallyEventCounts(rows.map((r) => r.type));
  // A "completed experience" is an event whose definition marks it as one.
  let completedExperiences = 0;
  for (const r of rows) {
    if (isGrowthEventType(r.type) && GROWTH_EVENT_DEFINITIONS[r.type].countsAsExperience) {
      completedExperiences += 1;
    }
  }
  return {
    counts,
    completedExperiences,
    lastEventAt: rows.length > 0 ? rows[0].occurredAt : null,
  };
}
