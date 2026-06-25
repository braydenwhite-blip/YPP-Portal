import { RoleType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import { PARTNER_REQUEST_OPEN_STATUSES } from "@/lib/partners-constants";
import { loadData360 } from "@/lib/operations/data-360-queries";
import { buildChiefOfStaffInsights } from "@/lib/help-agent/chief-of-staff";
import type { CoSInsight } from "@/lib/help-agent/types";
import type { AttentionItem } from "@/lib/operations/attention";
import type {
  ActionLite,
  MeetingLite,
} from "@/lib/people-strategy/operational-digest";
import type { TimelineEvent } from "@/lib/operations/timeline";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { whereUserHasRole } from "@/lib/user-role-where";

/**
 * Leadership Home cockpit reads (Knowledge OS V2, plan §7/§27.6).
 *
 * One loader for the executive front door. The heavy lifting is the existing
 * `loadData360` engine (Today's Brief, the cross-domain attention queue,
 * the weekly digest's overdue actions / upcoming meetings, the unified
 * timeline) — this module adds only the cockpit-specific targeted counts
 * (chair decision queue, advisor coverage, partner follow-ups) so every stat
 * card is a real count with a real filtered destination. No composite
 * scores; every number is explainable (§19).
 */

export type LeadershipHomeData = {
  /** Today's Brief — plain sentences, worst first. */
  brief: string[];
  /** Chief of Staff proactive insights — high-signal lines, worst first. */
  chiefOfStaff: CoSInsight[];
  stats: {
    overdueActions: number;
    blockedActions: number;
    unownedActions: number;
    upcomingMeetings: number;
    applicantsAwaitingDecision: number;
    studentsWithoutAdvisor: number;
    advisorCheckInsOverdue: number;
    partnerFollowUpsOverdue: number;
    openPartnerRequests: number;
    newCpApplications: number;
    chaptersLaunching: number;
    chapterSupportOpen: number;
    chaptersNoUpcomingMeeting: number;
    overdueChapterActions: number;
    launchPlansPendingApproval: number;
  };
  attention: AttentionItem[];
  upcomingMeetings: MeetingLite[];
  upcomingEvents: LeadershipHomeUpcomingEvent[];
  overdueActions: ActionLite[];
  decisionQueue: Array<{
    id: string;
    displayName: string;
    chapterName: string | null;
    track: string;
    daysInQueue: number | null;
  }>;
  recentActivity: TimelineEvent[];
};

export type LeadershipHomeUpcomingEventType =
  | "meeting"
  | "action"
  | "decision"
  | "advisor_check_in"
  | "partner_follow_up";

export type LeadershipHomeUpcomingEvent = {
  id: string;
  type: LeadershipHomeUpcomingEventType;
  label: string;
  title: string;
  detail: string;
  ownerLabel: string | null;
  startISO: string;
  href: string;
  ctaLabel: string;
  urgencyLabel: string | null;
  urgencyTone: "neutral" | "success" | "warning" | "danger" | "info" | "brand";
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFrom(now: Date, date: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

function overdueLabel(now: Date, date: Date): string | null {
  const days = daysFrom(now, date);
  if (days <= 0) return null;
  return `${days} day${days === 1 ? "" : "s"} overdue`;
}

export async function loadLeadershipHome(
  viewer: ActionViewer,
  options: { now?: Date } = {}
): Promise<LeadershipHomeData> {
  const now = options.now ?? new Date();

  const [
    data360,
    chairQueue,
    chairQueueTotal,
    studentsWithoutAdvisor,
    advisorCheckInsOverdue,
    advisorCheckInRows,
    partnerFollowUpsOverdue,
    partnerFollowUpRows,
    openPartnerRequests,
    newCpApplications,
    chaptersLaunching,
    chapterSupportOpen,
    chaptersNoUpcomingMeeting,
    overdueChapterActions,
    launchPlansPendingApproval,
  ] = await Promise.all([
    loadData360(viewer, { now }),
    prisma.instructorApplication.findMany({
      where: { status: "CHAIR_REVIEW", archivedAt: null },
      orderBy: { chairQueuedAt: "asc" },
      take: 6,
      select: {
        id: true,
        preferredFirstName: true,
        lastName: true,
        legalName: true,
        applicationTrack: true,
        chairQueuedAt: true,
        applicant: {
          select: { name: true, email: true, chapter: { select: { name: true } } },
        },
      },
    }),
    prisma.instructorApplication.count({
      where: { status: "CHAIR_REVIEW", archivedAt: null },
    }),
    prisma.user.count({
      where: {
        archivedAt: null,
        ...whereUserHasRole(RoleType.STUDENT),
        adviseeAssignments: { none: { isActive: true } },
      },
    }),
    prisma.user.count({
      where: {
        archivedAt: null,
        adviseeAssignments: {
          some: { isActive: true, nextCheckInDueAt: { lt: now } },
        },
      },
    }),
    prisma.studentAdvisorAssignment.findMany({
      where: { isActive: true, nextCheckInDueAt: { lt: now } },
      orderBy: { nextCheckInDueAt: "asc" },
      take: 6,
      select: {
        id: true,
        nextCheckInDueAt: true,
        student: { select: { id: true, name: true } },
        advisor: { select: { name: true } },
      },
    }),
    prisma.partner.count({
      where: { archivedAt: null, nextFollowUpAt: { lt: now } },
    }),
    prisma.partner.findMany({
      where: { archivedAt: null, nextFollowUpAt: { lt: now } },
      orderBy: { nextFollowUpAt: "asc" },
      take: 6,
      select: {
        id: true,
        name: true,
        nextFollowUpAt: true,
        relationshipLead: { select: { name: true } },
      },
    }),
    prisma.partnerRequest.count({
      where: { status: { in: [...PARTNER_REQUEST_OPEN_STATUSES] } },
    }),
    prisma.chapterPresidentApplication.count({
      where: { status: "SUBMITTED", archivedAt: null },
    }),
    prisma.chapter.count({
      where: { archivedAt: null, lifecycleStatus: { in: ["APPROVED", "LAUNCHING"] } },
    }),
    prisma.chapterSupportRequest.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    // Operating chapters with nothing on the calendar — a CP who has gone quiet.
    prisma.chapter.count({
      where: {
        archivedAt: null,
        lifecycleStatus: { in: ["LAUNCHING", "ACTIVE", "NEEDS_SUPPORT", "AT_RISK"] },
        meetings: { none: { scheduledAt: { gte: now } } },
      },
    }),
    // Overdue chapter actions (chapter "next steps" past their deadline).
    prisma.actionItem.count({
      where: {
        chapterId: { not: null },
        status: { notIn: ["COMPLETE", "DROPPED"] },
        OR: [
          { deadlineEnd: { lt: now } },
          { deadlineEnd: null, deadlineStart: { lt: now } },
        ],
      },
    }),
    // Launch plans submitted by a CP and waiting on leadership approval.
    prisma.chapter.count({
      where: {
        archivedAt: null,
        launchPlanSubmittedAt: { not: null },
        launchPlanApprovedAt: null,
      },
    }),
  ]);

  const overdueActions = data360.digest.urgentActions
    .filter((action) => action.overdue)
    .slice(0, 6);
  const upcomingMeetings = data360.digest.upcomingMeetings.slice(0, 8);
  const decisionQueue = chairQueue.map((app) => ({
    id: app.id,
    displayName: formatApplicantDisplayName({
      preferredFirstName: app.preferredFirstName,
      lastName: app.lastName,
      legalName: app.legalName,
      applicant: { name: app.applicant.name, email: app.applicant.email },
    }),
    chapterName: app.applicant.chapter?.name ?? null,
    track: app.applicationTrack,
    daysInQueue: app.chairQueuedAt
      ? Math.max(0, daysFrom(now, app.chairQueuedAt))
      : null,
  }));
  const upcomingEvents: LeadershipHomeUpcomingEvent[] = [
    ...upcomingMeetings.map((meeting) => ({
      id: `meeting:${meeting.id}`,
      type: "meeting" as const,
      label: "Meeting",
      title: meeting.title,
      detail: meeting.categoryLabel,
      ownerLabel: meeting.facilitatorName,
      startISO: meeting.startISO,
      href: meeting.href,
      ctaLabel: "Open",
      urgencyLabel: null,
      urgencyTone: "neutral" as const,
    })),
    ...data360.digest.urgentActions
      .filter((action) => action.dueISO)
      .slice(0, 8)
      .map((action) => ({
        id: `action:${action.id}`,
        type: "action" as const,
        label: "Action",
        title: action.title,
        detail: action.relatedLabel
          ? `${action.relatedTypeLabel ?? "Related"}: ${action.relatedLabel}`
          : "Action due date",
        ownerLabel: action.ownerName ?? "Unowned",
        startISO: action.dueISO,
        href: action.href,
        ctaLabel: "Open",
        urgencyLabel: action.overdue ? `${action.daysOverdue} day${action.daysOverdue === 1 ? "" : "s"} overdue` : null,
        urgencyTone: action.overdue ? ("danger" as const) : ("warning" as const),
      })),
    ...decisionQueue.map((app) => ({
      id: `decision:${app.id}`,
      type: "decision" as const,
      label: "Decision",
      title: app.displayName,
      detail: app.chapterName ? `${prettyTrack(app.track)} · ${app.chapterName}` : prettyTrack(app.track),
      ownerLabel: null,
      startISO:
        chairQueue.find((raw) => raw.id === app.id)?.chairQueuedAt?.toISOString() ??
        now.toISOString(),
      href: `/admin/instructor-applicants/${app.id}`,
      ctaLabel: "Decide",
      urgencyLabel:
        app.daysInQueue != null
          ? `${app.daysInQueue} day${app.daysInQueue === 1 ? "" : "s"} waiting`
          : "Waiting",
      urgencyTone: "warning" as const,
    })),
    ...advisorCheckInRows
      .filter((row) => row.nextCheckInDueAt)
      .map((row) => ({
        id: `advisor:${row.id}`,
        type: "advisor_check_in" as const,
        label: "Check-in",
        title: row.student.name,
        detail: "Advisor check-in due",
        ownerLabel: row.advisor.name,
        startISO: row.nextCheckInDueAt!.toISOString(),
        href: `/people/${row.student.id}`,
        ctaLabel: "Review",
        urgencyLabel: overdueLabel(now, row.nextCheckInDueAt!),
        urgencyTone: "info" as const,
      })),
    ...partnerFollowUpRows
      .filter((partner) => partner.nextFollowUpAt)
      .map((partner) => ({
        id: `partner:${partner.id}`,
        type: "partner_follow_up" as const,
        label: "Partner",
        title: partner.name,
        detail: "Relationship follow-up due",
        ownerLabel: partner.relationshipLead?.name ?? null,
        startISO: partner.nextFollowUpAt!.toISOString(),
        href: `/admin/partners/${partner.id}`,
        ctaLabel: "Follow up",
        urgencyLabel: overdueLabel(now, partner.nextFollowUpAt!),
        urgencyTone: "warning" as const,
      })),
  ].sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());

  return {
    brief: data360.brief,
    chiefOfStaff: buildChiefOfStaffInsights(data360, { now, limit: 4 }),
    stats: {
      overdueActions: data360.digest.counts.overdueActions,
      blockedActions: data360.digest.counts.blockedActions,
      unownedActions: data360.digest.counts.unassignedActions,
      upcomingMeetings: data360.digest.counts.upcomingMeetings,
      applicantsAwaitingDecision: chairQueueTotal,
      studentsWithoutAdvisor,
      advisorCheckInsOverdue,
      partnerFollowUpsOverdue,
      openPartnerRequests,
      newCpApplications,
      chaptersLaunching,
      chapterSupportOpen,
      chaptersNoUpcomingMeeting,
      overdueChapterActions,
      launchPlansPendingApproval,
    },
    attention: data360.attention.slice(0, 8),
    upcomingMeetings: upcomingMeetings.slice(0, 5),
    upcomingEvents: upcomingEvents.slice(0, 24),
    overdueActions,
    decisionQueue,
    recentActivity: data360.timeline.slice(0, 8),
  };
}

function prettyTrack(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}
