import type { ActionItemStatus, MentorshipCycleStage } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isMentorship2Enabled } from "@/lib/feature-flags";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";
import { getApplicationsQueue } from "@/lib/mentorship-2/recommendations/queries";
import type { MentorshipRelationshipFact } from "@/lib/mentorship/view-model";

import {
  queueItemsFromMentorshipApplications,
  queueItemsFromMentorshipFacts,
  type MentorshipApplicationLoopFact,
} from "./from-mentorship";
import type { QueueItem } from "./types";

/**
 * Server loader for the mentorship queue loops (Calm Mentorship, Phase 10).
 *
 * Role-precise on purpose: it reads only the ACTIVE pairings where the viewer is
 * literally the mentor or the chair (never an admin-oversight projection), so a
 * "review due" loop only ever lands on the person who owes the review. It maps
 * those Prisma rows into the canonical Phase-1 fact shape and hands them to the
 * pure folder, then appends the M2 matching loops when the flag is on. Defensive:
 * any failure degrades to the loops already gathered, never breaking My Queue.
 */

const OPEN_M2_BUCKETS = new Set([
  "new",
  "needsRecommendations",
  "hasRecommendations",
  "shortlisted",
  "held",
]);

/** Cycle-stage → the per-cycle boolean signals (same derivation as Phase 3). */
function cycleSignals(stage: MentorshipCycleStage, kickoffCompleted: boolean) {
  return {
    kickoffCompleted: kickoffCompleted || stage !== "KICKOFF_PENDING",
    reflectionDue: stage === "REFLECTION_DUE",
    reviewDue: stage === "REFLECTION_SUBMITTED",
    reviewPendingChairApproval: stage === "REVIEW_SUBMITTED",
    reviewChangesRequested: stage === "CHANGES_REQUESTED",
  };
}

function actionStatusToMentorshipCommitmentStatus(
  status: ActionItemStatus
): MentorshipRelationshipFact["commitments"][number]["status"] {
  switch (status) {
    case "COMPLETE":
      return "COMPLETE";
    case "IN_PROGRESS":
    case "OVERDUE":
      return "IN_PROGRESS";
    case "BLOCKED":
      return "BLOCKED";
    case "NOT_STARTED":
    case "DROPPED":
    default:
      return "OPEN";
  }
}

export async function loadMentorshipQueueItems(
  viewer: ActionViewer,
  now: Date
): Promise<QueueItem[]> {
  const items: QueueItem[] = [];
  try {
    const pairings = await prisma.mentorship.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ mentorId: viewer.id }, { chairId: viewer.id }],
      },
      take: 200,
      select: {
        id: true,
        mentorId: true,
        menteeId: true,
        chairId: true,
        cycleStage: true,
        kickoffCompletedAt: true,
        mentor: { select: { name: true } },
        mentee: { select: { name: true } },
        sessions: {
          where: { completedAt: null, cancelledAt: null, scheduledAt: { gte: now } },
          orderBy: { scheduledAt: "asc" },
          take: 1,
          select: { id: true, type: true, title: true, scheduledAt: true },
        },
        actionItems: {
          where: { status: { not: "COMPLETE" }, dueAt: { lt: now } },
          take: 10,
          select: {
            id: true,
            title: true,
            status: true,
            ownerId: true,
            owner: { select: { name: true } },
            dueAt: true,
            linkedActionId: true,
          },
        },
        supportRequests: {
          where: { status: "OPEN", assignedToId: viewer.id },
          take: 10,
          select: {
            id: true,
            title: true,
            status: true,
            assignedToId: true,
            requesterId: true,
          },
        },
      },
    });
    const mentorshipIds = pairings.map((pairing) => pairing.id);
    const canonicalOverdueActions =
      mentorshipIds.length > 0
        ? await prisma.actionItem.findMany({
            where: {
              relatedEntityType: "MENTORSHIP",
              relatedEntityId: { in: mentorshipIds },
              status: { notIn: ["COMPLETE", "DROPPED"] },
              OR: [
                { deadlineEnd: { lt: now } },
                { deadlineEnd: null, deadlineStart: { lt: now } },
              ],
            },
            take: 200,
            select: {
              id: true,
              title: true,
              status: true,
              leadId: true,
              lead: { select: { name: true } },
              deadlineStart: true,
              deadlineEnd: true,
              relatedEntityId: true,
            },
          })
        : [];
    const canonicalOverdueActionsByMentorship = new Map<
      string,
      typeof canonicalOverdueActions
    >();
    for (const action of canonicalOverdueActions) {
      if (!action.relatedEntityId) continue;
      const list =
        canonicalOverdueActionsByMentorship.get(action.relatedEntityId) ?? [];
      list.push(action);
      canonicalOverdueActionsByMentorship.set(action.relatedEntityId, list);
    }

    const facts: MentorshipRelationshipFact[] = pairings.map((p) => {
      const sig = cycleSignals(p.cycleStage, Boolean(p.kickoffCompletedAt));
      const canonicalCommitments =
        canonicalOverdueActionsByMentorship.get(p.id) ?? [];
      const unlinkedLegacyCommitments = p.actionItems.filter(
        (action) => !action.linkedActionId
      );
      return {
        id: p.id,
        mentorId: p.mentorId,
        mentorName: p.mentor?.name ?? "Mentor",
        menteeId: p.menteeId,
        menteeName: p.mentee?.name ?? "Mentee",
        chairId: p.chairId,
        status: "ACTIVE",
        cycleStage: p.cycleStage,
        cycleNumber: 0,
        releasedColorStatus: null,
        kickoffCompleted: sig.kickoffCompleted,
        reflectionDue: sig.reflectionDue,
        reviewDue: sig.reviewDue,
        reviewPendingChairApproval: sig.reviewPendingChairApproval,
        reviewChangesRequested: sig.reviewChangesRequested,
        lastActivityISO: null,
        sessions: p.sessions.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title || "Mentorship session",
          scheduledISO: s.scheduledAt.toISOString(),
          completedISO: null,
          cancelledISO: null,
        })),
        goals: [],
        commitments: [
          ...canonicalCommitments.map((a) => ({
            id: a.id,
            title: a.title,
            status: actionStatusToMentorshipCommitmentStatus(a.status),
            ownerId: a.leadId,
            ownerName: a.lead?.name ?? null,
            dueISO: (a.deadlineEnd ?? a.deadlineStart).toISOString(),
          })),
          ...unlinkedLegacyCommitments.map((a) => ({
            id: a.id,
            title: a.title,
            status: a.status,
            ownerId: a.ownerId,
            ownerName: a.owner?.name ?? null,
            dueISO: a.dueAt?.toISOString() ?? null,
          })),
        ],
        feedback: [],
        support: p.supportRequests.map((r) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          assignedToId: r.assignedToId,
          requesterId: r.requesterId,
        })),
      };
    });

    const isAdmin = (viewer.roles ?? []).includes("ADMIN");
    const isChair = pairings.some((p) => p.chairId === viewer.id);
    items.push(
      ...queueItemsFromMentorshipFacts(
        { viewer: { userId: viewer.id, isAdmin, isChair }, relationships: facts },
        now
      )
    );

    if (isMentorship2Enabled() && isOfficerTier(viewer)) {
      const queue = await getApplicationsQueue();
      const apps: MentorshipApplicationLoopFact[] = queue
        .filter((a) => OPEN_M2_BUCKETS.has(a.bucket))
        .map((a) => ({
          id: a.id,
          applicantName: a.applicantName ?? a.applicantEmail,
          bucket: a.bucket as MentorshipApplicationLoopFact["bucket"],
        }));
      items.push(...queueItemsFromMentorshipApplications(apps));
    }
  } catch {
    return items;
  }
  return items;
}
