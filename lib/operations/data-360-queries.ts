import { prisma } from "@/lib/prisma";
import { isStrategicInitiativesEnabled } from "@/lib/feature-flags";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  deriveOperationalEntities,
  deriveWeeklyOperationalDigest,
  toActionLite,
  toDecisionLite,
  toMeetingLite,
  type OperationalEntityLite,
  type WeeklyOperationalDigest,
} from "@/lib/people-strategy/operational-digest";
import { loadDigestInputs } from "@/lib/people-strategy/operational-digest-queries";
import { getStrategicInitiativesOverview } from "@/lib/people-strategy/strategic-initiative-queries";

import {
  buildNeedsAttention,
  type ApplicantAttentionInput,
  type AttentionItem,
  type ClassSetupAttentionInput,
  type MentorshipAttentionInput,
  type PartnerAttentionInput,
  partnerIsActive,
  APPLICANT_STUCK_DAYS,
  MENTORSHIP_QUIET_DAYS,
} from "./attention";
import { buildExecutiveSnapshot, type DataMetric, type OrgWideCounts } from "./metrics";
import {
  buildUnifiedTimeline,
  type TimelineEvent,
} from "./timeline";
import {
  buildUnifiedWorkItems,
  groupWorkItems,
  workItemFromAction,
  type WorkBoard,
} from "./work-items";
import { nextStepFromWork } from "./entity-360";

/**
 * Data 360 — the page loader.
 *
 * ONE batched read (the digest pool the Command Center already uses) plus four
 * cheap cross-domain queries (partners, applicants, mentorships, classes),
 * then pure derivation into everything the page renders: the executive
 * snapshot, the unified Needs Attention queue, the work board, the unified
 * timeline, and the connected-data explorer. Officer-gate the caller.
 */

/** A connected-entity card for the explorer ("everything touching X"). */
export type ExplorerCard = {
  refKey: string;
  /** Drawer entity type, when this entity has a 360 panel. */
  entityType: "class" | "partner" | "person" | null;
  id: string;
  label: string;
  typeLabel: string;
  areaLabel: string;
  healthLabel: string;
  healthLevel: "healthy" | "attention" | "at_risk" | "critical";
  openActions: number;
  overdueActions: number;
  meetingCount: number;
  recentDecisions: number;
  /** The most pressing open work item's title, when one exists. */
  nextStep: string | null;
  /** The single worst health reason, when unhealthy. */
  risk: string | null;
  href: string | null;
};

/** A compact initiative card for the explorer (config-defined initiatives). */
export type ExplorerInitiative = {
  id: string;
  title: string;
  areaLabel: string;
  healthLabel: string;
  healthTone: "success" | "info" | "warning" | "overdue" | "neutral";
  progressPercent: number;
  openActions: number;
  meetingCount: number;
  owner: string | null;
  nextStep: string | null;
  risk: string | null;
  href: string;
};

export type Data360Payload = {
  generatedAtISO: string;
  snapshot: DataMetric[];
  attention: AttentionItem[];
  board: WorkBoard;
  timeline: TimelineEvent[];
  explorer: ExplorerCard[];
  initiatives: ExplorerInitiative[];
  digest: WeeklyOperationalDigest;
};

const ENTITY_TO_DRAWER: Record<string, ExplorerCard["entityType"]> = {
  CLASS_OFFERING: "class",
  PARTNER: "partner",
  USER: "person",
};

const HEALTH_TONE: Record<string, ExplorerInitiative["healthTone"]> = {
  healthy: "success",
  drifting: "info",
  at_risk: "warning",
  critical: "overdue",
  completed: "neutral",
  archived: "neutral",
};

// --- cross-domain attention inputs --------------------------------------------

async function loadPartnerInputs(): Promise<PartnerAttentionInput[]> {
  const partners = await prisma.partner.findMany({
    select: {
      id: true,
      name: true,
      stage: true,
      nextFollowUpAt: true,
      lastContactedAt: true,
      relationshipLead: { select: { name: true, email: true } },
    },
  });
  return partners.map((p) => ({
    id: p.id,
    name: p.name,
    stage: p.stage,
    nextFollowUpAt: p.nextFollowUpAt,
    lastContactedAt: p.lastContactedAt,
    relationshipLeadName: p.relationshipLead?.name ?? p.relationshipLead?.email ?? null,
  }));
}

async function loadApplicantInputs(): Promise<ApplicantAttentionInput[]> {
  const applications = await prisma.instructorApplication.findMany({
    where: {
      status: {
        in: ["SUBMITTED", "UNDER_REVIEW", "INTERVIEW_COMPLETED", "CHAIR_REVIEW"],
      },
    },
    orderBy: { updatedAt: "asc" },
    take: 100,
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      interviewScheduledAt: true,
      preferredFirstName: true,
      lastName: true,
      legalName: true,
      applicant: { select: { name: true, email: true } },
    },
  });
  return applications.map((app) => {
    const composed = [app.preferredFirstName, app.lastName].filter(Boolean).join(" ").trim();
    return {
      id: app.id,
      name:
        composed || app.legalName || app.applicant?.name || app.applicant?.email || "Applicant",
      status: app.status,
      submittedAt: app.createdAt,
      updatedAt: app.updatedAt,
      interviewScheduledAt: app.interviewScheduledAt,
    };
  });
}

async function loadMentorshipInputs(): Promise<MentorshipAttentionInput[]> {
  const mentorships = await prisma.mentorship.findMany({
    where: { status: "ACTIVE" },
    take: 200,
    select: {
      id: true,
      startDate: true,
      kickoffCompletedAt: true,
      mentor: { select: { name: true, email: true } },
      mentee: { select: { id: true, name: true, email: true } },
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      sessions: {
        orderBy: { scheduledAt: "desc" },
        take: 1,
        select: { scheduledAt: true, completedAt: true },
      },
    },
  });
  return mentorships.map((m) => {
    // Last recorded activity = the newest of: pairing start, kickoff, latest
    // check-in, latest session touch.
    const candidates = [
      m.startDate,
      m.kickoffCompletedAt,
      m.checkIns[0]?.createdAt,
      m.sessions[0]?.completedAt ?? m.sessions[0]?.scheduledAt,
    ].filter((d): d is Date => d != null);
    const lastActivityAt = candidates.reduce(
      (latest, d) => (d.getTime() > latest.getTime() ? d : latest),
      candidates[0] ?? m.startDate
    );
    return {
      id: m.id,
      mentorName: m.mentor.name ?? m.mentor.email,
      menteeName: m.mentee.name ?? m.mentee.email,
      menteeId: m.mentee.id,
      lastActivityAt,
    };
  });
}

async function loadClassSetupInputs(now: Date): Promise<ClassSetupAttentionInput[]> {
  const offerings = await prisma.classOffering.findMany({
    where: {
      status: { in: ["DRAFT", "PUBLISHED", "IN_PROGRESS"] },
      endDate: { gte: now },
    },
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      instructor: { select: { name: true, email: true } },
      _count: { select: { sessions: true, enrollments: true } },
    },
  });
  return offerings.map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    instructorName: c.instructor?.name ?? c.instructor?.email ?? null,
    sessionCount: c._count.sessions,
    enrolledCount: c._count.enrollments,
  }));
}

// --- explorer ------------------------------------------------------------------

function toExplorerCard(
  entity: OperationalEntityLite,
  nextStepByRef: Map<string, string>
): ExplorerCard {
  return {
    refKey: entity.refKey,
    entityType: ENTITY_TO_DRAWER[entity.type] ?? null,
    id: entity.id,
    label: entity.label,
    typeLabel: entity.typeLabel,
    areaLabel: entity.areaLabel,
    healthLabel: entity.health.label,
    healthLevel: entity.health.level,
    openActions: entity.openActions,
    overdueActions: entity.overdueActions,
    meetingCount: entity.meetingCount,
    recentDecisions: entity.recentDecisions,
    nextStep: nextStepByRef.get(entity.refKey) ?? null,
    risk: entity.health.level === "healthy" ? null : (entity.health.reasons[0] ?? null),
    href: entity.href,
  };
}

// --- the loader ------------------------------------------------------------------

export async function loadData360(
  viewer: ActionViewer,
  options: { now?: Date } = {}
): Promise<Data360Payload> {
  const now = options.now ?? new Date();
  const showStrategic = isStrategicInitiativesEnabled();

  const [pool, partners, applicants, mentorships, classSetups, initiatives] =
    await Promise.all([
      loadDigestInputs(viewer, now),
      loadPartnerInputs().catch(() => [] as PartnerAttentionInput[]),
      loadApplicantInputs().catch(() => [] as ApplicantAttentionInput[]),
      loadMentorshipInputs().catch(() => [] as MentorshipAttentionInput[]),
      loadClassSetupInputs(now).catch(() => [] as ClassSetupAttentionInput[]),
      showStrategic
        ? getStrategicInitiativesOverview(viewer, { now }).catch(() => [])
        : Promise.resolve([]),
    ]);

  const digest = deriveWeeklyOperationalDigest({ ...pool, now });

  // Full (unsliced) projections for the board, timeline, and explorer.
  const actionLites = pool.actions.map((a) => toActionLite(a, now, pool.labels));
  const meetingLites = pool.meetings.map((m) => toMeetingLite(m, now, pool.labels));
  const followUps = meetingLites.flatMap((m) => m.unconvertedFollowUps);

  const workItems = buildUnifiedWorkItems({ actions: actionLites, followUps, now });
  const board = groupWorkItems(workItems, now);

  const timeline = buildUnifiedTimeline({
    actions: actionLites,
    meetings: meetingLites,
    decisions: pool.decisions.map(toDecisionLite),
    now,
    limit: 60,
  });

  // Explorer: every entity the operating data touches, with its next step.
  const entities = deriveOperationalEntities({ ...pool, now });
  const nextStepByRef = new Map<string, string>();
  for (const entity of entities) {
    const related = actionLites.filter(
      (a) =>
        a.relatedType === entity.type &&
        a.relatedId === entity.id &&
        a.status !== "COMPLETE" &&
        a.status !== "DROPPED"
    );
    const step = nextStepFromWork(related.map(workItemFromAction));
    if (step) nextStepByRef.set(entity.refKey, step);
  }
  const explorer = entities.map((e) => toExplorerCard(e, nextStepByRef));

  const explorerInitiatives: ExplorerInitiative[] = initiatives
    .filter((s) => s.status === "active" || s.status === "planning")
    .map((s) => ({
      id: s.id,
      title: s.title,
      areaLabel: s.areaLabel,
      healthLabel: s.health.label,
      healthTone: HEALTH_TONE[s.health.level] ?? "neutral",
      progressPercent: s.progress.percent,
      openActions: s.counts.openActions,
      meetingCount: s.counts.meetingCount,
      owner: s.ownership.ownerName,
      nextStep: s.recommendations[0]?.title ?? null,
      risk: s.risk.factors[0]?.label ?? null,
      href: s.href,
    }));

  const attention = buildNeedsAttention({
    reviewItems: digest.recommendedReviewOrder,
    partners,
    applicants,
    mentorships,
    classes: classSetups,
    now,
    limit: 14,
  });

  const activeInitiatives = initiatives.filter((s) => s.status === "active").length;
  const initiativesAtRisk = initiatives.filter(
    (s) => s.health.level === "at_risk" || s.health.level === "critical"
  ).length;
  const dayMs = 24 * 60 * 60 * 1000;
  const org: OrgWideCounts = {
    activeClasses: classSetups.filter((c) => c.status !== "DRAFT").length,
    activeInitiatives,
    initiativesAtRisk,
    applicantsInReview: applicants.length,
    applicantsStuck: applicants.filter(
      (a) =>
        now.getTime() - a.updatedAt.getTime() >= APPLICANT_STUCK_DAYS * dayMs &&
        !(a.interviewScheduledAt && a.interviewScheduledAt.getTime() > now.getTime())
    ).length,
    activeMentorships: mentorships.length,
    mentorshipsQuiet: mentorships.filter(
      (m) => now.getTime() - m.lastActivityAt.getTime() >= MENTORSHIP_QUIET_DAYS * dayMs
    ).length,
    partnersNeedingFollowUp: partners.filter(
      (p) =>
        partnerIsActive(p) &&
        (!p.nextFollowUpAt || p.nextFollowUpAt.getTime() < now.getTime())
    ).length,
  };

  return {
    generatedAtISO: now.toISOString(),
    snapshot: buildExecutiveSnapshot({ counts: digest.counts, org }),
    attention,
    board,
    timeline,
    explorer,
    initiatives: explorerInitiatives,
    digest,
  };
}
