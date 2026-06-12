import { RoleType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import { PARTNER_REQUEST_OPEN_STATUSES } from "@/lib/partners-constants";
import { loadData360 } from "@/lib/operations/data-360-queries";
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
  };
  attention: AttentionItem[];
  upcomingMeetings: MeetingLite[];
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

const DAY_MS = 24 * 60 * 60 * 1000;

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
    partnerFollowUpsOverdue,
    openPartnerRequests,
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
    prisma.partner.count({
      where: { archivedAt: null, nextFollowUpAt: { lt: now } },
    }),
    prisma.partnerRequest.count({
      where: { status: { in: [...PARTNER_REQUEST_OPEN_STATUSES] } },
    }),
  ]);

  const overdueActions = data360.digest.urgentActions
    .filter((action) => action.overdue)
    .slice(0, 6);

  return {
    brief: data360.brief,
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
    },
    attention: data360.attention.slice(0, 8),
    upcomingMeetings: data360.digest.upcomingMeetings.slice(0, 5),
    overdueActions,
    decisionQueue: chairQueue.map((app) => ({
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
        ? Math.max(0, Math.floor((now.getTime() - app.chairQueuedAt.getTime()) / DAY_MS))
        : null,
    })),
    recentActivity: data360.timeline.slice(0, 8),
  };
}
