import "server-only";

/**
 * Review-cycle read layer.
 *
 * Each participant's stage is derived here — never stored — from the existing
 * review artifacts for the cycle's period: MonthlySelfReflection and
 * MentorGoalReview (monthly kind, keyed by mentorshipId + cycleMonth) or
 * QuarterlyReview (quarterly kind, keyed by userId + quarter), plus open
 * mentorship-linked actions for the follow-ups stage.
 */

import { prisma } from "@/lib/prisma";
import { countOpenActionsByRelatedEntity } from "@/lib/people-strategy/action-queries";

import { requireMentorshipCommandAccess } from "./command-access";
import { isCycleKind, type CycleKind, type ParticipantStage } from "./cycle-constants";
import {
  deriveParticipantStage,
  rollupCycleProgress,
  type CycleProgress,
  type ParticipantArtifacts,
} from "./cycle-progress";

export type CycleSummary = {
  id: string;
  name: string;
  kind: CycleKind;
  periodLabel: string;
  scopeLabel: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  closedAt: Date | null;
  progress: CycleProgress;
};

export type CycleParticipantDetail = {
  participantId: string;
  userId: string;
  name: string;
  contextLabel: string | null;
  mentorshipId: string | null;
  mentorName: string | null;
  stage: ParticipantStage;
  /** The period's MentorGoalReview id (for the chair CTA), when one exists. */
  reviewId: string | null;
  stageOverride: string | null;
};

export type CycleDetail = CycleSummary & {
  participants: CycleParticipantDetail[];
};

type CycleRow = {
  id: string;
  name: string;
  kind: string;
  periodLabel: string;
  scopeLabel: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  closedAt: Date | null;
};

type ParticipantRow = {
  id: string;
  cycleId: string;
  userId: string;
  mentorshipId: string | null;
  stageOverride: string | null;
  user: { name: string; email: string; primaryRole: string; chapter: { name: string } | null };
  mentorship: { mentor: { name: string | null; email: string } } | null;
};

/** "2026-07" → first day of that month, UTC (the cycleMonth key). */
function periodToCycleMonth(periodLabel: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(periodLabel);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

type DerivedByParticipant = Map<string, { stage: ParticipantStage; reviewId: string | null }>;

/** Derive every participant's stage across a batch of cycles. */
async function deriveStages(
  cycles: CycleRow[],
  participants: ParticipantRow[]
): Promise<DerivedByParticipant> {
  const cycleById = new Map(cycles.map((c) => [c.id, c]));

  const mentorshipIds = new Set<string>();
  const quarterlyByQuarter = new Map<string, Set<string>>();
  const monthlyByMonth = new Map<string, Set<string>>();
  const allUserIds = new Set<string>();

  for (const p of participants) {
    const cycle = cycleById.get(p.cycleId);
    if (!cycle) continue;
    allUserIds.add(p.userId);
    if (cycle.kind === "quarterly") {
      const set = quarterlyByQuarter.get(cycle.periodLabel) ?? new Set<string>();
      set.add(p.userId);
      quarterlyByQuarter.set(cycle.periodLabel, set);
    } else if (p.mentorshipId) {
      mentorshipIds.add(p.mentorshipId);
      const set = monthlyByMonth.get(cycle.periodLabel) ?? new Set<string>();
      set.add(p.mentorshipId);
      monthlyByMonth.set(cycle.periodLabel, set);
    }
  }

  const monthClauses = [...monthlyByMonth.entries()]
    .map(([period, ids]) => {
      const cycleMonth = periodToCycleMonth(period);
      return cycleMonth ? { cycleMonth, mentorshipId: { in: [...ids] } } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c != null);

  const quarterClauses = [...quarterlyByQuarter.entries()].map(([quarter, ids]) => ({
    quarter,
    userId: { in: [...ids] },
  }));

  const [reflections, reviews, quarterlies, mentorshipActionCounts, userActionCounts] =
    await Promise.all([
      monthClauses.length
        ? prisma.monthlySelfReflection.findMany({
            where: { OR: monthClauses },
            select: { mentorshipId: true, cycleMonth: true },
          })
        : Promise.resolve([]),
      monthClauses.length
        ? prisma.mentorGoalReview.findMany({
            where: { OR: monthClauses },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              mentorshipId: true,
              cycleMonth: true,
              status: true,
              releasedToMenteeAt: true,
            },
          })
        : Promise.resolve([]),
      quarterClauses.length
        ? prisma.quarterlyReview.findMany({
            where: { OR: quarterClauses },
            select: { userId: true, quarter: true },
          })
        : Promise.resolve([]),
      countOpenActionsByRelatedEntity("MENTORSHIP", [...mentorshipIds]),
      countOpenActionsByRelatedEntity("USER", [...allUserIds]),
    ]);

  const reflectionKeys = new Set(
    reflections.map((r) => `${r.mentorshipId}|${r.cycleMonth.toISOString()}`)
  );
  const reviewByKey = new Map<string, (typeof reviews)[number]>();
  for (const review of reviews) {
    if (!review.mentorshipId || !review.cycleMonth) continue;
    const key = `${review.mentorshipId}|${review.cycleMonth.toISOString()}`;
    if (!reviewByKey.has(key)) reviewByKey.set(key, review); // newest first
  }
  const quarterlyKeys = new Set(quarterlies.map((q) => `${q.userId}|${q.quarter}`));

  const derived: DerivedByParticipant = new Map();
  for (const p of participants) {
    const cycle = cycleById.get(p.cycleId);
    if (!cycle) continue;
    const kind: CycleKind = isCycleKind(cycle.kind) ? cycle.kind : "monthly";

    const cycleMonthISO = periodToCycleMonth(cycle.periodLabel)?.toISOString();
    const key =
      p.mentorshipId && cycleMonthISO ? `${p.mentorshipId}|${cycleMonthISO}` : null;
    const review = key ? (reviewByKey.get(key) ?? null) : null;

    const openFollowUpCount =
      (p.mentorshipId ? (mentorshipActionCounts.get(p.mentorshipId) ?? 0) : 0) +
      (userActionCounts.get(p.userId) ?? 0);

    const artifacts: ParticipantArtifacts = {
      hasMentorship: p.mentorshipId != null,
      reflectionSubmitted: key ? reflectionKeys.has(key) : false,
      reviewStatus: review?.status ?? null,
      releasedToMentee: review?.releasedToMenteeAt != null,
      openFollowUpCount,
      quarterlyReviewExists: quarterlyKeys.has(`${p.userId}|${cycle.periodLabel}`),
      stageOverride: p.stageOverride,
    };

    derived.set(p.id, {
      stage: deriveParticipantStage(kind, artifacts),
      reviewId: review?.id ?? null,
    });
  }
  return derived;
}

const CYCLE_SELECT = {
  id: true,
  name: true,
  kind: true,
  periodLabel: true,
  scopeLabel: true,
  status: true,
  dueDate: true,
  createdAt: true,
  closedAt: true,
} as const;

const PARTICIPANT_SELECT = {
  id: true,
  cycleId: true,
  userId: true,
  mentorshipId: true,
  stageOverride: true,
  user: {
    select: {
      name: true,
      email: true,
      primaryRole: true,
      chapter: { select: { name: true } },
    },
  },
  mentorship: {
    select: { mentor: { select: { name: true, email: true } } },
  },
} as const;

function toSummary(
  cycle: CycleRow,
  participants: ParticipantRow[],
  derived: DerivedByParticipant
): CycleSummary {
  const stages = participants
    .filter((p) => p.cycleId === cycle.id)
    .map((p) => derived.get(p.id)?.stage)
    .filter((s): s is ParticipantStage => s != null);
  return {
    id: cycle.id,
    name: cycle.name,
    kind: isCycleKind(cycle.kind) ? cycle.kind : "monthly",
    periodLabel: cycle.periodLabel,
    scopeLabel: cycle.scopeLabel,
    status: cycle.status,
    dueDate: cycle.dueDate,
    createdAt: cycle.createdAt,
    closedAt: cycle.closedAt,
    progress: rollupCycleProgress(stages),
  };
}

/** All review cycles (active first), each with a derived progress rollup. */
export async function listReviewCycles(): Promise<CycleSummary[]> {
  await requireMentorshipCommandAccess();

  const cycles = await prisma.reviewCycle.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
    select: CYCLE_SELECT,
  });
  if (cycles.length === 0) return [];

  const participants = await prisma.reviewCycleParticipant.findMany({
    where: { cycleId: { in: cycles.map((c) => c.id) } },
    select: PARTICIPANT_SELECT,
  });
  const derived = await deriveStages(cycles, participants);
  return cycles.map((c) => toSummary(c, participants, derived));
}

/** Active cycles only — the command-center strip. */
export async function listActiveReviewCycles(): Promise<CycleSummary[]> {
  const all = await listReviewCycles();
  return all.filter((c) => c.status === "active");
}

function participantDisplayName(p: ParticipantRow): string {
  return p.user.name || p.user.email;
}

function participantContextLabel(p: ParticipantRow): string | null {
  const role = p.user.primaryRole;
  const chapter = p.user.chapter?.name;
  if (!role) return chapter ?? null;
  const roleLabel = role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return chapter ? `${roleLabel} · ${chapter}` : roleLabel;
}

/** One cycle, fully expanded per participant. Null when it doesn't exist. */
export async function loadReviewCycle(id: string): Promise<CycleDetail | null> {
  await requireMentorshipCommandAccess();

  const cycle = await prisma.reviewCycle.findUnique({
    where: { id },
    select: CYCLE_SELECT,
  });
  if (!cycle) return null;

  const participants = await prisma.reviewCycleParticipant.findMany({
    where: { cycleId: cycle.id },
    orderBy: { addedAt: "asc" },
    select: PARTICIPANT_SELECT,
  });
  const derived = await deriveStages([cycle], participants);

  const details: CycleParticipantDetail[] = participants.map((p) => {
    const d = derived.get(p.id);
    return {
      participantId: p.id,
      userId: p.userId,
      name: participantDisplayName(p),
      contextLabel: participantContextLabel(p),
      mentorshipId: p.mentorshipId,
      mentorName: p.mentorship?.mentor
        ? p.mentorship.mentor.name || p.mentorship.mentor.email
        : null,
      stage: d?.stage ?? "waiting-review",
      reviewId: d?.reviewId ?? null,
      stageOverride: p.stageOverride,
    };
  });

  return { ...toSummary(cycle, participants, derived), participants: details };
}

export type CycleParticipation = {
  cycleId: string;
  cycleName: string;
  periodLabel: string;
  stage: ParticipantStage;
};

/** Active-cycle participations for one person (development record chips). */
export async function loadParticipationsForUser(
  userId: string
): Promise<CycleParticipation[]> {
  await requireMentorshipCommandAccess();

  const rows = await prisma.reviewCycleParticipant.findMany({
    where: { userId, cycle: { status: "active" } },
    orderBy: { addedAt: "desc" },
    take: 10,
    select: { ...PARTICIPANT_SELECT, cycle: { select: CYCLE_SELECT } },
  });
  if (rows.length === 0) return [];

  const cycles = rows.map((r) => r.cycle);
  const derived = await deriveStages(cycles, rows);

  return rows.map((r) => ({
    cycleId: r.cycle.id,
    cycleName: r.cycle.name,
    periodLabel: r.cycle.periodLabel,
    stage: derived.get(r.id)?.stage ?? "waiting-review",
  }));
}
