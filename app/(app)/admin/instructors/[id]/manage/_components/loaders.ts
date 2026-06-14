import { cache } from "react";

import { getSession } from "@/lib/auth-supabase";
import {
  isProvisionalClockEnabled,
  isPeopleDashboardEnabled,
  isQuarterlyReviewsEnabled,
  isActionTrackerEnabled,
  isOperationsHubEnabled,
  isStrategicInitiativesEnabled,
  isLeadershipRolesEnabled,
} from "@/lib/feature-flags";
import { getInstructorOpsProfile } from "@/lib/instructor-ops";
import { loadInstructorProfileDetail, listAllTags } from "@/lib/instructor-ops-actions";
import { loadInstructorLeadership } from "@/lib/leadership/queries";
import { getLatestQuarterlyReview } from "@/lib/people-strategy/quarterly-review-actions";
import { loadMemberPeopleStrategy } from "@/lib/people-strategy/member-people-detail";
import { loadProvisionalStatus } from "@/lib/people-strategy/provisional";
import {
  getFeedbackRequestStatusForSubject,
  getFeedbackResponsesForSubject,
  isLeadershipOrBoard,
  type FeedbackRequestStatus,
  type SubjectFeedbackResponse,
} from "@/lib/people-strategy/feedback-requests";
import { getOperationalContextForEntity } from "@/lib/people-strategy/operational-context-queries";
import { canCreateAction } from "@/lib/people-strategy/action-permissions";

export const getManageProfile = cache(async (id: string) => getInstructorOpsProfile(id));

export async function requireManageAdmin() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return null;
  }
  return session;
}

export type ManageFlags = {
  quarterlyReviewsEnabled: boolean;
  peopleDashboardEnabled: boolean;
  provisionalEnabled: boolean;
  leadershipRolesEnabled: boolean;
  operationsEnabled: boolean;
  strategicInitiativesEnabled: boolean;
  viewerIsLeadershipOrBoard: boolean;
  canSubmitQuarterlyReview: boolean;
  canRequestFeedback: boolean;
};

export function getManageFlags(session: NonNullable<Awaited<ReturnType<typeof requireManageAdmin>>>): ManageFlags {
  const viewerIsLeadershipOrBoard = session.user ? isLeadershipOrBoard(session.user) : false;
  return {
    quarterlyReviewsEnabled: isQuarterlyReviewsEnabled(),
    peopleDashboardEnabled: isPeopleDashboardEnabled(),
    provisionalEnabled: isProvisionalClockEnabled(),
    leadershipRolesEnabled: isLeadershipRolesEnabled(),
    operationsEnabled: isOperationsHubEnabled() && isActionTrackerEnabled(),
    strategicInitiativesEnabled: isStrategicInitiativesEnabled(),
    viewerIsLeadershipOrBoard,
    canSubmitQuarterlyReview: viewerIsLeadershipOrBoard,
    canRequestFeedback: viewerIsLeadershipOrBoard,
  };
}

export const loadManageOverviewData = cache(async (id: string) => {
  const session = await requireManageAdmin();
  if (!session) return null;

  const flags = getManageFlags(session);
  const [profile, detail, allTags] = await Promise.all([
    getManageProfile(id),
    loadInstructorProfileDetail(id),
    listAllTags(),
  ]);
  if (!profile) return null;

  return { session, flags, profile, detail, allTags };
});

export const loadManagePipelineData = cache(async (id: string) => {
  const session = await requireManageAdmin();
  if (!session) return null;

  const profile = await getManageProfile(id);
  if (!profile) return null;

  return { session, profile };
});

export const loadManageTeachingData = cache(async (id: string) => {
  const session = await requireManageAdmin();
  if (!session) return null;

  const profile = await getManageProfile(id);
  if (!profile) return null;

  return { session, profile };
});

export const loadManageStrategyData = cache(async (id: string) => {
  const session = await requireManageAdmin();
  if (!session) return null;

  const flags = getManageFlags(session);
  const operationsViewer = {
    id: session.user?.id ?? "",
    roles: session.user?.roles ?? [],
    primaryRole: session.user?.primaryRole ?? null,
    adminSubtypes: session.user?.adminSubtypes ?? [],
  };

  const [profile, leadership, latestQuarterlyReview, peopleStrategy] = await Promise.all([
    getManageProfile(id),
    flags.leadershipRolesEnabled ? loadInstructorLeadership(id) : Promise.resolve(null),
    flags.quarterlyReviewsEnabled ? getLatestQuarterlyReview(id) : Promise.resolve(null),
    flags.peopleDashboardEnabled
      ? loadMemberPeopleStrategy(id, operationsViewer)
      : Promise.resolve(null),
  ]);
  if (!profile) return null;

  const opsContext = flags.operationsEnabled
    ? await getOperationalContextForEntity("USER", id, operationsViewer)
    : null;

  let feedbackResponses: SubjectFeedbackResponse[] | null = null;
  if (flags.peopleDashboardEnabled && flags.viewerIsLeadershipOrBoard) {
    feedbackResponses = await getFeedbackResponsesForSubject(id).catch(() => null);
  }

  const feedbackStatus: FeedbackRequestStatus | null = flags.peopleDashboardEnabled
    ? await getFeedbackRequestStatusForSubject(id)
    : null;

  const provisionalStatus = flags.provisionalEnabled
    ? await loadProvisionalStatus(id)
    : null;

  return {
    session,
    flags,
    profile,
    leadership,
    latestQuarterlyReview,
    peopleStrategy,
    opsContext,
    canCreatePersonAction: canCreateAction(operationsViewer),
    feedbackResponses,
    feedbackStatus,
    provisionalStatus,
  };
});

export const loadManageNotesData = cache(async (id: string) => {
  const session = await requireManageAdmin();
  if (!session) return null;

  const [profile, detail] = await Promise.all([
    getManageProfile(id),
    loadInstructorProfileDetail(id),
  ]);
  if (!profile) return null;

  return { session, profile, detail };
});

export function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}
