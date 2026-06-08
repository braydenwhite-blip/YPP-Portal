/**
 * Student Operating System / Growth Engine (Phase N1) — the /my-growth view.
 *
 * Read-only aggregator (plain async) that assembles the five answers the student
 * command center renders: Who am I? What am I working toward? What have I
 * achieved? What should I do next? What's blocked / recently accomplished. It
 * composes the Prisma reads (queries.ts) with the pure engine (hierarchy /
 * achievements / profile) — no business logic of its own, so it stays a thin,
 * deterministic shell over the unit-tested core.
 */

import { prisma } from "@/lib/prisma";
import {
  normalizeActionStatus,
  toPercent,
  type GrowthActionStatus,
  type GrowthTrackId,
} from "./constants";
import { loadGrowthEvents, loadGrowthHierarchy } from "./queries";
import {
  blockedActions,
  goalActions,
  goalProgress,
  milestoneProgress,
  nextActions,
  recentlyCompleted,
  summarizeHierarchy,
  visionProgress,
  type HierarchyGoal,
  type HierarchyMilestone,
  type HierarchySummary,
  type HierarchyVision,
} from "./hierarchy";
import {
  achievementCategoryCounts,
  evaluateAchievements,
  nextAchievements,
  type EarnedAchievement,
  type LockedAchievement,
} from "./achievements";
import { becomingSummary } from "./profile";
import { OPPORTUNITY_KIND_LABELS, isOpportunityKind } from "./constants";

export interface RenderAction {
  id: string;
  title: string;
  status: GrowthActionStatus;
  dueDate: string | null;
}

export interface RenderMilestone {
  id: string;
  title: string;
  status: string;
  percent: number;
  actions: RenderAction[];
}

export interface RenderGoal {
  id: string;
  title: string;
  status: string;
  track: GrowthTrackId;
  percent: number;
  targetDate: string | null;
  milestones: RenderMilestone[];
  directActions: RenderAction[];
}

export interface RenderVision {
  id: string;
  title: string;
  status: string;
  percent: number;
  goals: RenderGoal[];
}

export interface RenderOpportunity {
  key: string;
  kind: string;
  kindLabel: string;
  title: string;
  detail: string | null;
  href: string | null;
  reason: string;
  score: number;
}

export interface MyGrowthProfileView {
  headline: string | null;
  becoming: string;
  careerInterests: string[];
  leadershipInterests: string[];
  impactInterests: string[];
  skills: string[];
  confidenceAreas: string[];
  growthAreas: string[];
  achievementCount: number;
  completedExperiences: number;
}

export interface MyGrowthView {
  profile: MyGrowthProfileView;
  summary: HierarchySummary;
  visions: RenderVision[];
  looseGoals: RenderGoal[];
  achievements: { earned: EarnedAchievement[]; next: LockedAchievement[] };
  opportunities: RenderOpportunity[];
  nextActions: RenderAction[];
  blocked: RenderAction[];
  recentlyCompleted: RenderAction[];
  recentEvents: { type: string; title: string; track: string; occurredAt: string }[];
}

export async function getMyGrowthView(userId: string): Promise<MyGrowthView> {
  const [profileRow, hierarchy, events, opportunityRows, recentEventRows] =
    await Promise.all([
      prisma.growthProfile.findUnique({ where: { userId } }),
      loadGrowthHierarchy(userId),
      loadGrowthEvents(userId),
      prisma.growthOpportunity.findMany({
        where: { userId, status: "SUGGESTED" },
        orderBy: [{ score: "desc" }, { key: "asc" }],
        select: {
          key: true,
          kind: true,
          title: true,
          detail: true,
          href: true,
          reason: true,
          score: true,
        },
      }),
      prisma.growthProgressEvent.findMany({
        where: { userId },
        orderBy: { occurredAt: "desc" },
        take: 8,
        select: { type: true, title: true, track: true, occurredAt: true },
      }),
    ]);

  const earned = evaluateAchievements({ eventCounts: events.counts });
  const next = nextAchievements({ eventCounts: events.counts }, { limit: 6, minProgress: 0 });
  const categoryCounts = achievementCategoryCounts(earned);
  const topCategory =
    (Object.keys(categoryCounts) as (keyof typeof categoryCounts)[])
      .filter((c) => categoryCounts[c] > 0)
      .sort((a, b) => categoryCounts[b] - categoryCounts[a])[0] ?? null;

  const careerInterests = profileRow?.careerInterests ?? [];
  const leadershipInterests = profileRow?.leadershipInterests ?? [];
  const impactInterests = profileRow?.impactInterests ?? [];

  const profile: MyGrowthProfileView = {
    headline: profileRow?.headline ?? null,
    becoming: becomingSummary({
      careerInterests,
      leadershipInterests,
      impactInterests,
      topAchievementCategory: topCategory,
      completedExperiences: profileRow?.completedExperiences ?? events.completedExperiences,
    }),
    careerInterests,
    leadershipInterests,
    impactInterests,
    skills: profileRow?.skills ?? [],
    confidenceAreas: profileRow?.confidenceAreas ?? [],
    growthAreas: profileRow?.growthAreas ?? [],
    achievementCount: earned.length,
    completedExperiences: profileRow?.completedExperiences ?? events.completedExperiences,
  };

  const allGoals = [
    ...hierarchy.visions.flatMap((v) => v.goals),
    ...hierarchy.looseGoals,
  ];
  const allActions = allGoals.flatMap((g) => goalActions(g));

  return {
    profile,
    summary: summarizeHierarchy(hierarchy.visions, hierarchy.looseGoals),
    visions: hierarchy.visions.map((v) => renderVision(v, hierarchy.goalTrackById)),
    looseGoals: hierarchy.looseGoals.map((g) =>
      renderGoal(g, hierarchy.goalTrackById)
    ),
    achievements: { earned, next },
    opportunities: opportunityRows.map(renderOpportunity),
    nextActions: nextActions(allActions, 5).map(renderAction),
    blocked: blockedActions(allActions).map(renderAction),
    recentlyCompleted: recentlyCompleted(allActions, 5).map(renderAction),
    recentEvents: recentEventRows.map((e) => ({
      type: e.type,
      title: e.title,
      track: e.track,
      occurredAt: e.occurredAt.toISOString(),
    })),
  };
}

/* --------------------------------- mappers --------------------------------- */

function renderAction(a: {
  id: string;
  title?: string;
  status: string;
  dueDate?: string | Date | null;
}): RenderAction {
  return {
    id: a.id,
    title: a.title ?? "Action",
    status: normalizeActionStatus(a.status),
    dueDate: a.dueDate ? new Date(a.dueDate).toISOString() : null,
  };
}

function renderMilestone(m: HierarchyMilestone): RenderMilestone {
  return {
    id: m.id,
    title: m.title ?? "Milestone",
    status: m.status ?? "ACTIVE",
    percent: toPercent(milestoneProgress(m).ratio),
    actions: (m.actions ?? []).map(renderAction),
  };
}

function renderGoal(
  g: HierarchyGoal,
  trackById: Map<string, GrowthTrackId>
): RenderGoal {
  return {
    id: g.id,
    title: g.title ?? "Goal",
    status: g.status ?? "ACTIVE",
    track: trackById.get(g.id) ?? "STUDENT",
    percent: toPercent(goalProgress(g).ratio),
    targetDate: g.targetDate ? new Date(g.targetDate).toISOString() : null,
    milestones: (g.milestones ?? []).map(renderMilestone),
    directActions: (g.directActions ?? []).map(renderAction),
  };
}

function renderVision(
  v: HierarchyVision,
  trackById: Map<string, GrowthTrackId>
): RenderVision {
  return {
    id: v.id,
    title: v.title ?? "Vision",
    status: v.status ?? "ACTIVE",
    percent: toPercent(visionProgress(v).ratio),
    goals: (v.goals ?? []).map((g) => renderGoal(g, trackById)),
  };
}

function renderOpportunity(o: {
  key: string;
  kind: string;
  title: string;
  detail: string | null;
  href: string | null;
  reason: string;
  score: number;
}): RenderOpportunity {
  return {
    key: o.key,
    kind: o.kind,
    kindLabel: isOpportunityKind(o.kind) ? OPPORTUNITY_KIND_LABELS[o.kind] : o.kind,
    title: o.title,
    detail: o.detail,
    href: o.href,
    reason: o.reason,
    score: o.score,
  };
}
