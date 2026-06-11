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
import { buildTodaysBrief, latestActivityISO } from "./signals";
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
  /** Who is on the hook (class instructor / partner relationship lead). */
  owner: string | null;
  openActions: number;
  overdueActions: number;
  meetingCount: number;
  recentDecisions: number;
  /** Newest linked action/meeting touch, for the "last activity" read. */
  lastActivityISO: string | null;
  /** The most pressing open work item's title, when one exists. */
  nextStep: string | null;
  /** The single worst health reason, when unhealthy. */
  risk: string | null;
  href: string | null;
};

/** One searchable row in the Data 360 quick-find index. */
export type QuickFindEntry = {
  id: string;
  label: string;
  /** One context line (type · owner / date). */
  sub: string | null;
  typeLabel: string;
  /** Drawer target when one exists; otherwise href-only. */
  entityType: "person" | "class" | "partner" | "initiative" | "meeting" | "action" | null;
  entityId: string | null;
  href: string;
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
  /** Today's Brief — the org's state as plain sentences, worst first. */
  brief: string[];
  snapshot: DataMetric[];
  attention: AttentionItem[];
  board: WorkBoard;
  timeline: TimelineEvent[];
  explorer: ExplorerCard[];
  initiatives: ExplorerInitiative[];
  quickFind: QuickFindEntry[];
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
  enrichment: {
    nextStepByRef: Map<string, string>;
    ownerByRef: Map<string, string>;
    lastActivityByRef: Map<string, string>;
  }
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
    owner: enrichment.ownerByRef.get(entity.refKey) ?? null,
    openActions: entity.openActions,
    overdueActions: entity.overdueActions,
    meetingCount: entity.meetingCount,
    recentDecisions: entity.recentDecisions,
    lastActivityISO: enrichment.lastActivityByRef.get(entity.refKey) ?? null,
    nextStep: enrichment.nextStepByRef.get(entity.refKey) ?? null,
    risk: entity.health.level === "healthy" ? null : (entity.health.reasons[0] ?? null),
    href: entity.href,
  };
}

/**
 * Who owns each explorer entity — one query per entity TYPE present (a class's
 * instructor, a partner's relationship lead), never one per entity.
 */
async function loadExplorerOwners(
  entities: OperationalEntityLite[]
): Promise<Map<string, string>> {
  const owners = new Map<string, string>();
  const classIds = entities.filter((e) => e.type === "CLASS_OFFERING").map((e) => e.id);
  const partnerIds = entities.filter((e) => e.type === "PARTNER").map((e) => e.id);

  const tasks: Array<Promise<unknown>> = [];
  if (classIds.length > 0) {
    tasks.push(
      prisma.classOffering
        .findMany({
          where: { id: { in: classIds } },
          select: { id: true, instructor: { select: { name: true, email: true } } },
        })
        .then((rows) => {
          for (const c of rows) {
            const name = c.instructor?.name ?? c.instructor?.email;
            if (name) owners.set(`CLASS_OFFERING:${c.id}`, name);
          }
        })
    );
  }
  if (partnerIds.length > 0) {
    tasks.push(
      prisma.partner
        .findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, relationshipLead: { select: { name: true, email: true } } },
        })
        .then((rows) => {
          for (const p of rows) {
            const name = p.relationshipLead?.name ?? p.relationshipLead?.email;
            if (name) owners.set(`PARTNER:${p.id}`, name);
          }
        })
    );
  }
  await Promise.allSettled(tasks);
  return owners;
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

  // Explorer: every entity the operating data touches, enriched with its next
  // step, its owner, and its most recent touch.
  const entities = deriveOperationalEntities({ ...pool, now });
  const nextStepByRef = new Map<string, string>();
  const lastActivityByRef = new Map<string, string>();
  for (const entity of entities) {
    const related = actionLites.filter(
      (a) => a.relatedType === entity.type && a.relatedId === entity.id
    );
    const open = related.filter(
      (a) => a.status !== "COMPLETE" && a.status !== "DROPPED"
    );
    const step = nextStepFromWork(open.map(workItemFromAction));
    if (step) nextStepByRef.set(entity.refKey, step);

    const relatedMeetingDates = meetingLites
      .filter(
        (m) =>
          m.relatedType === entity.type &&
          m.relatedId === entity.id &&
          new Date(m.startISO).getTime() <= now.getTime()
      )
      .map((m) => m.startISO);
    const last = latestActivityISO([
      ...related.map((a) => a.completedISO ?? a.createdISO),
      ...relatedMeetingDates,
    ]);
    if (last) lastActivityByRef.set(entity.refKey, last);
  }
  const ownerByRef = await loadExplorerOwners(entities).catch(
    () => new Map<string, string>()
  );
  const explorer = entities.map((e) =>
    toExplorerCard(e, { nextStepByRef, ownerByRef, lastActivityByRef })
  );

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

  // Quick-find: a client-side index over everything this page loaded — typing
  // "Beth El" surfaces the partner, its classes, meetings, and work at once.
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const quickFind: QuickFindEntry[] = [
    ...explorer.map((e) => ({
      id: `qf:${e.refKey}`,
      label: e.label,
      sub: [e.typeLabel, e.owner].filter(Boolean).join(" · "),
      typeLabel: e.typeLabel,
      entityType: e.entityType,
      entityId: e.entityType ? e.id : null,
      href: e.href ?? "/operations/data-360",
    })),
    ...explorerInitiatives.map((s) => ({
      id: `qf:initiative:${s.id}`,
      label: s.title,
      sub: ["Initiative", s.owner].filter(Boolean).join(" · "),
      typeLabel: "Initiative",
      entityType: "initiative" as const,
      entityId: s.id,
      href: s.href,
    })),
    ...workItems.slice(0, 80).map((w) => ({
      id: `qf:${w.id}`,
      label: w.title,
      sub: [w.sourceLabel, w.ownerName].filter(Boolean).join(" · "),
      typeLabel: "Work",
      // Actions open their own panel; an unconverted follow-up opens its
      // source meeting's panel (its href is the meeting page).
      entityType: w.kind === "action" ? ("action" as const) : ("meeting" as const),
      entityId:
        w.kind === "action"
          ? w.id.replace(/^action:/, "")
          : (w.href.split("/").pop() ?? null),
      href: w.href,
    })),
    ...meetingLites.slice(0, 40).map((m) => ({
      id: `qf:meeting:${m.id}`,
      label: m.title,
      sub: `Meeting · ${fmtDay(m.startISO)}`,
      typeLabel: "Meeting",
      entityType: "meeting" as const,
      entityId: m.id,
      href: m.href,
    })),
  ];

  return {
    generatedAtISO: now.toISOString(),
    brief: buildTodaysBrief({ counts: digest.counts, org }),
    snapshot: buildExecutiveSnapshot({ counts: digest.counts, org }),
    attention,
    board,
    timeline,
    explorer,
    initiatives: explorerInitiatives,
    quickFind,
    digest,
  };
}
