import { prisma } from "@/lib/prisma";
import { isProvisionalClockEnabled } from "@/lib/feature-flags";

import { loadPeopleDashboard, type PeopleDashboardRow } from "./people-dashboard";
import { roleExpectsMentor } from "./people-performance-selectors";
import { loadLeadershipEscalationQueue } from "./escalation-queue";
import { loadMentorshipHealth } from "./mentorship-health";
import { getMyActionItems, type ActionItemWithRelations } from "./action-queries";
import type { ActionViewer } from "./action-permissions";
import { computeProvisionalStatus } from "./provisional";
import {
  computeNeedsAttention,
  type AttentionAction,
  type AttentionItem,
  type AttentionPerson,
  type AttentionEscalation,
} from "./needs-attention";

/**
 * People Strategy — Needs Attention loader (read-only).
 *
 * Composes the existing People Strategy read-loaders — the People Dashboard, the
 * Leadership Escalation Queue, and Mentorship Health — and runs them through the
 * single deterministic `computeNeedsAttention` engine so the CPO / Board /
 * SUPER_ADMIN dashboard, Person 360, and the operations command center all draw
 * their attention queue from one source of truth instead of bespoke per-page
 * logic. No new query or schema — only what the dashboards already read.
 *
 * The underlying loaders are individually feature-flag gated (and return empty
 * lists when off), so this stays a no-op until the People Dashboard / Action
 * Tracker features are enabled.
 */

/** Parse a "YYYY-MM" month key into the first-of-month UTC date, or null. */
function monthKeyToDate(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

function dashboardRowToPerson(row: PeopleDashboardRow): AttentionPerson {
  const lastCheckInKey = row.recentCheckIns[0]?.monthKey ?? null;
  return {
    id: row.id,
    name: row.name,
    expectsMentor: roleExpectsMentor(row.role),
    hasMentor: row.mentorId != null,
    // The dashboard row does not carry the pairing start / kickoff or the
    // provisional clock, so those signals come from their own loaders; here we
    // surface the coverage, check-in, and workload facts the row does carry.
    mentorshipStartDate: null,
    kickoffCompleted: true,
    lastCheckInAt: lastCheckInKey ? monthKeyToDate(lastCheckInKey) : null,
    quarterlyReviewDueAt: null,
    hasCurrentQuarterReview: row.quarterly != null,
    provisional: null,
    activeActionCount: row.leadActions.length + row.executingActions.length,
    pendingMentorRecommendations: 0,
  };
}

/**
 * Load the unified People Strategy attention items. Merges people from the
 * dashboard with mentorship-coverage gaps (instructors with no active mentor that
 * may not yet have a dashboard footprint), de-duplicated by user id, and folds in
 * the live escalation queue.
 */
export async function loadPeopleStrategyAttention(
  now: Date = new Date()
): Promise<AttentionItem[]> {
  const [rows, escalationRows, mentorshipHealth] = await Promise.all([
    loadPeopleDashboard(now),
    loadLeadershipEscalationQueue(now),
    loadMentorshipHealth(now),
  ]);

  const peopleById = new Map<string, AttentionPerson>();
  for (const row of rows) {
    peopleById.set(row.id, dashboardRowToPerson(row));
  }

  // Coverage gaps from mentorship health: instructors with no active mentor who
  // may not have a dashboard row yet. Only add ones we have not already mapped.
  for (const member of mentorshipHealth.unmatched) {
    if (peopleById.has(member.id)) continue;
    peopleById.set(member.id, {
      id: member.id,
      name: member.name,
      expectsMentor: true,
      hasMentor: false,
      mentorshipStartDate: null,
      kickoffCompleted: true,
      lastCheckInAt: null,
      quarterlyReviewDueAt: null,
      hasCurrentQuarterReview: true,
      provisional: null,
      activeActionCount: 0,
      pendingMentorRecommendations: 0,
    });
  }

  const escalations: AttentionEscalation[] = escalationRows.map((row) => ({
    id: row.id,
    title: row.title,
    ageLabel: row.ageLabel,
    awaitingBoard: false,
  }));

  return computeNeedsAttention(
    {
      people: Array.from(peopleById.values()),
      escalations,
    },
    now
  );
}

/** Map a loaded action item to the engine's minimal action shape. */
function actionItemToAttention(item: ActionItemWithRelations): AttentionAction {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    deadlineStart: item.deadlineStart,
    deadlineEnd: item.deadlineEnd,
    flaggedAt: item.flaggedAt,
    resolvedAt: item.resolvedAt,
    updatedAt: item.updatedAt,
    hasOwner: item.leadId != null || item.assignments.some((a) => a.role === "LEAD"),
    officersOnly: item.visibility === "OFFICERS_ONLY",
  };
}

/**
 * Needs-attention items scoped to ONE person — for the "Needs attention for this
 * person" panel on Person 360 (`/people/[id]`). Combines the subject's own
 * actions (visibility-filtered for `viewer`) with their People Strategy facts
 * (mentor coverage, kickoff, last check-in, provisional clock) and runs them
 * through the same unified engine. The caller decides whether to show the
 * confidential person-level signals (see `filterAttentionForViewer`).
 */
export async function loadPersonAttention(
  subjectUserId: string,
  viewer: ActionViewer,
  now: Date = new Date()
): Promise<AttentionItem[]> {
  const [actionItems, user] = await Promise.all([
    getMyActionItems(subjectUserId, viewer),
    prisma.user.findUnique({
      where: { id: subjectUserId },
      select: {
        name: true,
        email: true,
        primaryRole: true,
        provisionalStart: true,
        provisionalConfirmedAt: true,
        menteePairs: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { startDate: "desc" },
          select: { startDate: true, kickoffCompletedAt: true },
        },
        peopleCheckIns: {
          orderBy: { month: "desc" },
          take: 1,
          select: { month: true },
        },
      },
    }),
  ]);

  if (!user) return [];

  const pair = user.menteePairs[0] ?? null;
  const provisional = isProvisionalClockEnabled()
    ? computeProvisionalStatus(user.provisionalStart, user.provisionalConfirmedAt, now)
    : null;
  const activeActionCount = actionItems.filter(
    (i) => i.status !== "COMPLETE" && i.status !== "DROPPED"
  ).length;

  const person: AttentionPerson = {
    id: subjectUserId,
    name: user.name ?? user.email,
    expectsMentor: roleExpectsMentor(user.primaryRole),
    hasMentor: pair != null,
    mentorshipStartDate: pair?.startDate ?? null,
    kickoffCompleted: pair?.kickoffCompletedAt != null,
    lastCheckInAt: user.peopleCheckIns[0]?.month ?? null,
    quarterlyReviewDueAt: null,
    hasCurrentQuarterReview: true,
    provisional,
    activeActionCount,
    pendingMentorRecommendations: 0,
  };

  return computeNeedsAttention(
    { actions: actionItems.map(actionItemToAttention), people: [person] },
    now
  );
}
