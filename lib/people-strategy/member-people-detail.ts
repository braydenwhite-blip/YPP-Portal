import type { GoalRatingColor, QuarterlyReviewDecision } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { getMatrixLabel } from "@/lib/matrix";

import { getMyActionItems, type ActionItemWithRelations } from "./action-queries";
import type { ActionViewer } from "./action-permissions";

/**
 * People Strategy — per-member detail loader for the existing member detail
 * route (`/admin/instructors/[id]`). Compiles the LIVE Action Tracker /
 * Quarterly Review / Monthly Check-In data already in the schema for a single
 * subject — it does NOT create a duplicate profile system. Behind
 * ENABLE_PEOPLE_DASHBOARD (returns null when off).
 *
 * Confidential feedback responses are intentionally NOT loaded here — they are
 * fetched separately through `getFeedbackResponsesForSubject`, which enforces
 * `requireCPO()` so only CPO/Board can read them.
 */

/** A subject's active actions grouped by the role they hold on each item. */
export interface MemberActionsByRole {
  lead: ActionItemWithRelations[];
  executing: ActionItemWithRelations[];
  input: ActionItemWithRelations[];
}

export interface MemberQuarterlyEntry {
  id: string;
  quarter: string;
  performanceRating: GoalRatingColor;
  potentialRating: GoalRatingColor;
  matrixLabel: string;
  decision: QuarterlyReviewDecision;
  successionFlag: boolean;
  notes: string | null;
  createdAt: Date;
}

export interface MemberCheckInEntry {
  id: string;
  month: Date;
  performanceRating: GoalRatingColor | null;
  compiledNotes: string | null;
  createdAt: Date;
}

export interface MemberMentorInfo {
  name: string | null;
  email: string;
  status: string;
  startDate: Date | null;
}

export interface MemberPeopleStrategy {
  actions: MemberActionsByRole;
  latestQuarterly: MemberQuarterlyEntry | null;
  quarterlyHistory: MemberQuarterlyEntry[];
  checkInHistory: MemberCheckInEntry[];
  mentor: MemberMentorInfo | null;
}

/** An action is active until it is COMPLETE. */
function isActive(item: ActionItemWithRelations): boolean {
  return item.status !== "COMPLETE";
}

/** True when `subjectId` holds `role` on the item (lead tracked both ways). */
function subjectHasRole(
  item: ActionItemWithRelations,
  subjectId: string,
  role: "LEAD" | "EXECUTING" | "INPUT"
): boolean {
  if (role === "LEAD" && item.leadId === subjectId) return true;
  return item.assignments.some((a) => a.user.id === subjectId && a.role === role);
}

/**
 * Load the People Strategy detail for `subjectUserId`, filtered to what
 * `viewer` is allowed to see (action visibility is enforced by
 * `getMyActionItems`). Returns null when the dashboard flag is off.
 */
export async function loadMemberPeopleStrategy(
  subjectUserId: string,
  viewer: ActionViewer
): Promise<MemberPeopleStrategy | null> {
  if (!isPeopleDashboardEnabled()) return null;

  const [actionItems, user] = await Promise.all([
    getMyActionItems(subjectUserId, viewer),
    prisma.user.findUnique({
      where: { id: subjectUserId },
      select: {
        menteePairs: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { startDate: "desc" },
          select: {
            status: true,
            startDate: true,
            mentor: { select: { name: true, email: true } },
          },
        },
        quarterlyReviews: {
          orderBy: [{ quarter: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            quarter: true,
            performanceRating: true,
            potentialRating: true,
            decision: true,
            successionFlag: true,
            notes: true,
            createdAt: true,
          },
        },
        peopleCheckIns: {
          orderBy: { month: "desc" },
          select: {
            id: true,
            month: true,
            performanceRating: true,
            compiledNotes: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  const active = actionItems.filter(isActive);
  const actions: MemberActionsByRole = {
    lead: active.filter((i) => subjectHasRole(i, subjectUserId, "LEAD")),
    executing: active.filter((i) => subjectHasRole(i, subjectUserId, "EXECUTING")),
    input: active.filter((i) => subjectHasRole(i, subjectUserId, "INPUT")),
  };

  const quarterlyHistory: MemberQuarterlyEntry[] = (user?.quarterlyReviews ?? []).map(
    (r) => ({
      id: r.id,
      quarter: r.quarter,
      performanceRating: r.performanceRating,
      potentialRating: r.potentialRating,
      matrixLabel: getMatrixLabel(r.performanceRating, r.potentialRating),
      decision: r.decision,
      successionFlag: r.successionFlag,
      notes: r.notes,
      createdAt: r.createdAt,
    })
  );

  const checkInHistory: MemberCheckInEntry[] = (user?.peopleCheckIns ?? []).map((c) => ({
    id: c.id,
    month: c.month,
    performanceRating: c.performanceRating,
    compiledNotes: c.compiledNotes,
    createdAt: c.createdAt,
  }));

  const pair = user?.menteePairs[0] ?? null;
  const mentor: MemberMentorInfo | null = pair
    ? {
        name: pair.mentor?.name ?? null,
        email: pair.mentor?.email ?? "",
        status: pair.status,
        startDate: pair.startDate ?? null,
      }
    : null;

  return {
    actions,
    latestQuarterly: quarterlyHistory[0] ?? null,
    quarterlyHistory,
    checkInHistory,
    mentor,
  };
}
