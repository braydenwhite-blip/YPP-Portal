import { prisma } from "@/lib/prisma";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import { instructorApplicationVisibilityWhere } from "@/lib/applications/application-visibility";
import { isStrategicInitiativesEnabled } from "@/lib/feature-flags";
import {
  buildNeedsAttention,
  MENTORSHIP_QUIET_DAYS,
  type AttentionItem,
} from "@/lib/operations/attention";
import {
  loadClassSetupInputs,
  loadMentorshipInputs,
  loadPartnerInputs,
} from "@/lib/operations/data-360-queries";
import { buildUnifiedWorkItems } from "@/lib/operations/work-items";
import {
  canEditAction,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import {
  deriveActionAccountabilitySummary,
  deriveMeetingDecisionsWithoutActions,
  deriveWeeklyActionReview,
  type OwnerAccountability,
} from "@/lib/people-strategy/action-operations-intel";
import {
  deriveWeeklyOperationalDigest,
  meetingHref,
  toActionLite,
  toMeetingLite,
} from "@/lib/people-strategy/operational-digest";
import { loadDigestInputs } from "@/lib/people-strategy/operational-digest-queries";
import { getStrategicInitiativesOverview } from "@/lib/people-strategy/strategic-initiative-queries";
import { PARTNER_REQUEST_OPEN_STATUSES } from "@/lib/partners-constants";

import {
  sortWorkHubRows,
  workHubRowFromAdvisorCheckIn,
  workHubRowFromApplication,
  workHubRowFromCPApplication,
  workHubRowFromMeeting,
  workHubRowFromPartnerFollowUp,
  workHubRowFromPartnerRequest,
  workHubRowFromQuietMentorship,
  workHubRowFromWorkItem,
  type WorkHubRow,
  type WorkHubRowCapture,
} from "./work-hub-rows";

/**
 * Work Hub — the `/work` page loader (Knowledge OS V2, plan §15).
 *
 * One unified read over the systems that already track work: the operational
 * digest pool (visible tracker actions + the meeting window — the exact read
 * the Command Center and Data 360 use), the cross-domain attention inputs
 * (partners / applicants / mentorships / classes), open partner requests,
 * overdue advisor check-ins, and the strategic-initiative overview. Every
 * number on the page comes from these reads — no second source of truth,
 * no invented work items. Officer-gate the caller.
 */

export type WorkHubInitiativeCard = {
  id: string;
  title: string;
  statusLabel: string;
  healthLabel: string;
  healthTone: "success" | "info" | "warning" | "danger" | "neutral";
  /** Concrete reasons behind the health read (§19 — never a bare label). */
  healthReasons: string[];
  owner: string | null;
  openActions: number;
  overdueActions: number;
  progressLabel: string;
  nextStep: string | null;
  targetDateISO: string | null;
  pastTargetDate: boolean;
  /** Flagship or high-priority — feeds the Queue Engine's flagship signal. */
  flagship: boolean;
  href: string;
};

export type WorkHubWeeklyReview = {
  completedThisWeek: number;
  createdThisWeek: number;
  fromMeetingsThisWeek: number;
  overdue: number;
  unowned: number;
  blockedNeedingEscalation: Array<{ id: string; title: string; href: string }>;
};

export type WorkHubDecisionWithoutAction = {
  id: string;
  decision: string;
  meetingId: string;
  meetingTitle: string;
  meetingHref: string;
};

export type WorkHubData = {
  generatedAtISO: string;
  stats: {
    overdue: number;
    dueSoon: number;
    blocked: number;
    unowned: number;
    needsAttention: number;
    upcomingMeetings: number;
  };
  /** The unified "All Work" rows (actions, follow-ups, requests, check-ins, …). */
  rows: WorkHubRow[];
  /** Meetings tab rows (upcoming + past with open follow-ups). */
  meetingRows: WorkHubRow[];
  /** Initiatives tab cards (active/planning, worst health first). */
  initiatives: WorkHubInitiativeCard[];
  /** Needs Attention tab — the cross-domain queue with reasons. */
  attention: AttentionItem[];
  /** Action System 4.0 — per-owner accountability ("Who owns what"). */
  accountability: OwnerAccountability[];
  /** Action System 4.0 — the weekly action review counts. */
  weeklyReview: WorkHubWeeklyReview;
  /** Action System 4.0 — meeting decisions that never became actions. */
  decisionsWithoutActions: WorkHubDecisionWithoutAction[];
};

const HEALTH_TONE: Record<string, WorkHubInitiativeCard["healthTone"]> = {
  healthy: "success",
  drifting: "info",
  at_risk: "warning",
  critical: "danger",
  completed: "neutral",
  archived: "neutral",
};

function canOpenAdminRecords(viewer: ActionViewer): boolean {
  return viewer.primaryRole === "ADMIN" || viewer.roles.includes("ADMIN");
}

async function loadOpenPartnerRequests() {
  const requests = await prisma.partnerRequest.findMany({
    where: { status: { in: [...PARTNER_REQUEST_OPEN_STATUSES] } },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
      ownerId: true,
      partner: { select: { id: true, name: true } },
    },
  });
  // Owner names in one batch (PartnerRequest.ownerId has no relation field).
  const ownerIds = [...new Set(requests.map((r) => r.ownerId).filter(Boolean))] as string[];
  const owners =
    ownerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const ownerById = new Map(owners.map((u) => [u.id, u.name ?? u.email]));
  return requests.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    dueISO: r.dueAt ? r.dueAt.toISOString() : null,
    ownerId: r.ownerId,
    ownerName: r.ownerId ? (ownerById.get(r.ownerId) ?? null) : null,
    partnerId: r.partner.id,
    partnerName: r.partner.name,
  }));
}

async function loadOverdueAdvisorCheckIns(now: Date) {
  const assignments = await prisma.studentAdvisorAssignment.findMany({
    where: { isActive: true, nextCheckInDueAt: { lt: now } },
    orderBy: { nextCheckInDueAt: "asc" },
    take: 100,
    select: {
      id: true,
      nextCheckInDueAt: true,
      advisorId: true,
      advisor: { select: { name: true, email: true } },
      student: { select: { id: true, name: true, email: true } },
    },
  });
  return assignments.map((a) => ({
    assignmentId: a.id,
    studentId: a.student.id,
    studentName: a.student.name ?? a.student.email,
    advisorId: a.advisorId,
    advisorName: a.advisor.name ?? a.advisor.email,
    nextCheckInISO: (a.nextCheckInDueAt as Date).toISOString(),
  }));
}

/** CP lifecycle statuses where the ball is in YPP's court — drives the Work Hub. */
const CP_OPEN_STATUSES = [
  "SUBMITTED",
  "INITIAL_REVIEW",
  "UNDER_REVIEW",
  "INTERVIEW_NEEDED",
  "INTERVIEW_COMPLETE",
  "INTERVIEW_COMPLETED",
  "DECISION_NEEDED",
  "RECOMMENDATION_SUBMITTED",
  "ACCEPTED",
  "APPROVED",
  "ONBOARDING",
] as const;

async function loadCPApplicationWork() {
  const applications = await prisma.chapterPresidentApplication.findMany({
    where: {
      archivedAt: null,
      status: { in: [...CP_OPEN_STATUSES] },
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
      reviewerId: true,
      reviewer: { select: { name: true, email: true } },
      applicant: { select: { name: true, email: true } },
    },
  });
  return applications.map((app) => ({
    id: app.id,
    status: app.status as string,
    displayName: formatApplicantDisplayName({
      preferredFirstName: app.preferredFirstName,
      lastName: app.lastName,
      legalName: app.legalName,
      applicant: { name: app.applicant?.name ?? null, email: app.applicant?.email ?? "" },
    }),
    reviewerId: app.reviewerId,
    reviewerName: app.reviewer?.name ?? app.reviewer?.email ?? null,
    submittedAt: app.createdAt,
    updatedAt: app.updatedAt,
    interviewScheduledAt: app.interviewScheduledAt,
    updatedISO: app.updatedAt.toISOString(),
  }));
}

async function loadApplicationWork(viewer: ActionViewer) {
  const visibilityWhere = await instructorApplicationVisibilityWhere(viewer.id);
  if (!visibilityWhere) return [];

  const applications = await prisma.instructorApplication.findMany({
    where: {
      AND: [
        { archivedAt: null },
        {
          status: {
            in: ["SUBMITTED", "UNDER_REVIEW", "INTERVIEW_COMPLETED", "CHAIR_REVIEW"],
          },
        },
        visibilityWhere,
      ],
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
      reviewerId: true,
      reviewer: { select: { name: true, email: true } },
      applicant: { select: { name: true, email: true } },
    },
  });
  return applications.map((app) => ({
    id: app.id,
    status: app.status as string,
    displayName: formatApplicantDisplayName({
      preferredFirstName: app.preferredFirstName,
      lastName: app.lastName,
      legalName: app.legalName,
      applicant: { name: app.applicant?.name ?? null, email: app.applicant?.email ?? "" },
    }),
    reviewerId: app.reviewerId,
    reviewerName: app.reviewer?.name ?? app.reviewer?.email ?? null,
    submittedAt: app.createdAt,
    updatedAt: app.updatedAt,
    interviewScheduledAt: app.interviewScheduledAt,
    updatedISO: app.updatedAt.toISOString(),
  }));
}

export async function loadWorkHub(
  viewer: ActionViewer,
  options: { now?: Date } = {}
): Promise<WorkHubData> {
  const now = options.now ?? new Date();
  const showStrategic = isStrategicInitiativesEnabled();
  const adminRecordAccess = canOpenAdminRecords(viewer);

  const [
    pool,
    partners,
    mentorships,
    classSetups,
    initiatives,
    partnerRequests,
    advisorCheckIns,
    applications,
    cpApplications,
  ] = await Promise.all([
    loadDigestInputs(viewer, now),
    loadPartnerInputs().catch(() => []),
    loadMentorshipInputs().catch(() => []),
    loadClassSetupInputs(now).catch(() => []),
    showStrategic
      ? getStrategicInitiativesOverview(viewer, { now }).catch(() => [])
      : Promise.resolve([]),
    loadOpenPartnerRequests().catch(() => []),
    loadOverdueAdvisorCheckIns(now).catch(() => []),
    loadApplicationWork(viewer).catch(() => []),
    loadCPApplicationWork().catch(() => []),
  ]);

  const digest = deriveWeeklyOperationalDigest({ ...pool, now });

  const actionLites = pool.actions.map((a) => toActionLite(a, now, pool.labels));
  const meetingLites = pool.meetings.map((m) => toMeetingLite(m, now, pool.labels));
  const followUps = meetingLites.flatMap((m) => m.unconvertedFollowUps);
  const workItems = buildUnifiedWorkItems({ actions: actionLites, followUps, now });

  // "Mine" = the viewer leads the action or holds an EXECUTING assignment;
  // for follow-ups / requests / check-ins, the stored owner id.
  const myActionIds = new Set(
    pool.actions
      .filter(
        (a) =>
          a.leadId === viewer.id ||
          a.assignments.some(
            (assignment) =>
              assignment.role === "EXECUTING" && assignment.user.id === viewer.id
          )
      )
      .map((a) => `action:${a.id}`)
  );
  const myFollowUpIds = new Set(
    followUps.filter((f) => f.ownerId === viewer.id).map((f) => `follow_up:${f.id}`)
  );

  // Inline Complete / Block in the Work Hub preview rail — only for action
  // rows the viewer may edit (the server actions re-check on submit).
  const captureByRowId = new Map<string, WorkHubRowCapture>();
  for (const action of pool.actions) {
    const editable = canEditAction(viewer, {
      leadId: action.leadId,
      createdById: action.createdById,
      visibility: action.visibility,
      assignments: action.assignments.map((a) => ({
        userId: a.user.id,
        role: a.role,
      })),
    });
    if (!editable) continue;
    captureByRowId.set(`action:${action.id}`, {
      actionId: action.id,
      blockedReason: action.blockedReason ?? null,
      completionNote: action.completionNote ?? null,
      completionOutcome: action.completionOutcome ?? null,
      nextFollowUpISO: action.nextFollowUpAt ? action.nextFollowUpAt.toISOString() : null,
    });
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const rows: WorkHubRow[] = sortWorkHubRows([
    ...workItems
      .filter((item) => !item.completedISO && item.status !== "Completed")
      .map((item) =>
        workHubRowFromWorkItem(item, {
          mine: myActionIds.has(item.id) || myFollowUpIds.has(item.id),
          capture: captureByRowId.get(item.id) ?? null,
        })
      ),
    ...partnerRequests.map((request) =>
      workHubRowFromPartnerRequest(request, now, {
        mine: request.ownerId === viewer.id,
        canOpenAdminRecord: adminRecordAccess,
      })
    ),
    ...partners
      .filter((p) => p.nextFollowUpAt && p.nextFollowUpAt.getTime() < now.getTime())
      .map((p) =>
        workHubRowFromPartnerFollowUp(
          {
            id: p.id,
            name: p.name,
            nextFollowUpISO: (p.nextFollowUpAt as Date).toISOString(),
            leadName: p.relationshipLeadName,
          },
          now,
          { canOpenAdminRecord: adminRecordAccess }
        )
      ),
    ...advisorCheckIns.map((assignment) =>
      workHubRowFromAdvisorCheckIn(assignment, now, {
        mine: assignment.advisorId === viewer.id,
      })
    ),
    ...applications
      .map((application) =>
        workHubRowFromApplication(application, {
          mine: application.reviewerId === viewer.id,
        })
      )
      .filter((row): row is WorkHubRow => row !== null),
    ...cpApplications
      .map((application) =>
        workHubRowFromCPApplication(application, {
          mine: application.reviewerId === viewer.id,
        })
      )
      .filter((row): row is WorkHubRow => row !== null),
    ...mentorships
      .filter(
        (m) => now.getTime() - m.lastActivityAt.getTime() >= MENTORSHIP_QUIET_DAYS * dayMs
      )
      .map((m) =>
        workHubRowFromQuietMentorship(
          {
            id: m.id,
            mentorName: m.mentorName,
            menteeName: m.menteeName,
            menteeId: m.menteeId,
            quietDays: Math.floor(
              (now.getTime() - m.lastActivityAt.getTime()) / dayMs
            ),
          },
          { canOpenAdminRecord: adminRecordAccess }
        )
      ),
  ]);

  // "Mine" for a meeting = the viewer facilitates or attends it.
  const myMeetingIds = new Set(
    pool.meetings
      .filter((m) => m.participantIds.includes(viewer.id))
      .map((m) => m.id)
  );
  const meetingRows = sortWorkHubRows(
    meetingLites
      .map((meeting) =>
        workHubRowFromMeeting(meeting, now, { mine: myMeetingIds.has(meeting.id) })
      )
      .filter((row): row is WorkHubRow => row !== null)
  ).sort((a, b) => {
    // Within meetings: follow-up debt first, then soonest upcoming start.
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const aDue = a.dueISO ? new Date(a.dueISO).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueISO ? new Date(b.dueISO).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });

  const attention = buildNeedsAttention({
    reviewItems: digest.recommendedReviewOrder,
    partners,
    applicants: applications.map((app) => ({
      id: app.id,
      name: app.displayName,
      status: app.status,
      submittedAt: app.submittedAt,
      updatedAt: app.updatedAt,
      interviewScheduledAt: app.interviewScheduledAt,
    })),
    cpApplicants: cpApplications.map((app) => ({
      id: app.id,
      name: app.displayName,
      status: app.status,
      submittedAt: app.submittedAt,
      updatedAt: app.updatedAt,
      interviewScheduledAt: app.interviewScheduledAt,
    })),
    mentorships,
    classes: classSetups,
    now,
    limit: 20,
  });

  const initiativeCards: WorkHubInitiativeCard[] = initiatives
    .filter((s) => s.status === "active" || s.status === "planning")
    .map((s) => ({
      id: s.id,
      title: s.title,
      statusLabel: s.statusLabel,
      healthLabel: s.health.label,
      healthTone: HEALTH_TONE[s.health.level] ?? "neutral",
      healthReasons: s.healthExplanation.reasons.slice(0, 3),
      owner: s.ownership.ownerName,
      openActions: s.counts.openActions,
      overdueActions: s.counts.overdueActions,
      progressLabel: `${s.progress.percent}% of milestones`,
      nextStep: s.recommendations[0]?.title ?? null,
      targetDateISO: s.targetDateISO,
      pastTargetDate: s.pastTargetDate,
      flagship: s.priority === "flagship" || s.priority === "high",
      href: s.href,
    }));

  const weekly = deriveWeeklyActionReview(pool.actions, now);
  const weeklyReview: WorkHubWeeklyReview = {
    completedThisWeek: weekly.completedThisWeek.length,
    createdThisWeek: weekly.createdThisWeek.length,
    fromMeetingsThisWeek: weekly.fromMeetingsThisWeek.length,
    overdue: weekly.overdue.length,
    unowned: weekly.unowned.length,
    blockedNeedingEscalation: weekly.blockedNeedingEscalation.slice(0, 5).map((a) => ({
      id: a.id,
      title: a.title,
      href: `/actions/${a.id}`,
    })),
  };

  const decisionsWithoutActions = deriveMeetingDecisionsWithoutActions(
    pool.decisions.map((d) => ({
      id: d.id,
      decision: d.decision,
      linkedActionId: d.hasLinkedAction ? "linked" : null,
    }))
  )
    .slice(0, 6)
    .map((d) => {
      const source = pool.decisions.find((raw) => raw.id === d.id);
      return {
        id: d.id,
        decision: d.decision,
        meetingId: source?.meetingId ?? "",
        meetingTitle: source?.meetingTitle ?? "Meeting",
        meetingHref: source ? meetingHref(source.meetingId) : "/actions/meetings",
      };
    });

  const openRows = rows;
  const stats = {
    overdue: openRows.filter((row) => row.overdue).length,
    dueSoon: openRows.filter(
      (row) =>
        !row.overdue &&
        row.dueISO &&
        new Date(row.dueISO).getTime() <= now.getTime() + 7 * dayMs
    ).length,
    blocked: openRows.filter((row) => row.blocked).length,
    unowned: openRows.filter((row) => row.unassigned).length,
    needsAttention: attention.length,
    upcomingMeetings: digest.counts.upcomingMeetings,
  };

  return {
    generatedAtISO: now.toISOString(),
    stats,
    rows,
    meetingRows,
    initiatives: initiativeCards,
    attention,
    accountability: deriveActionAccountabilitySummary(pool.actions, now).slice(0, 10),
    weeklyReview,
    decisionsWithoutActions,
  };
}
