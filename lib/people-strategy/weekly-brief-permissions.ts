import type { ActionAssignmentRole, ActionItemVisibility } from "@prisma/client";

import {
  canEditAction,
  canViewAction,
  isLeadershipOrBoard,
  isOfficerTier,
  type ActionViewer,
} from "./action-permissions";

export type WeeklyBriefTeamAccess = {
  teamLeadId?: string | null;
  workstreamLeadUserIds?: readonly string[] | null;
  initiativeLeadUserIds?: readonly string[] | null;
};

export type WeeklyBriefTaskAccess = {
  leadId: string | null;
  createdById?: string | null;
  visibility: ActionItemVisibility;
  assignments: Array<{ userId: string; role: ActionAssignmentRole }>;
};

export type WeeklyBriefAccessShape = WeeklyBriefTeamAccess & {
  taskUpdates?: Array<{ actionItem: WeeklyBriefTaskAccess | null }>;
};

function idInList(id: string, ids?: readonly string[] | null): boolean {
  return Boolean(ids?.some((candidate) => candidate === id));
}

export function isConfiguredTeamLead(
  viewer: ActionViewer,
  access: WeeklyBriefTeamAccess
): boolean {
  return (
    access.teamLeadId === viewer.id ||
    idInList(viewer.id, access.workstreamLeadUserIds) ||
    idInList(viewer.id, access.initiativeLeadUserIds)
  );
}

export function canViewWeeklyBrief(
  viewer: ActionViewer,
  brief: WeeklyBriefAccessShape
): boolean {
  if (isOfficerTier(viewer) || isLeadershipOrBoard(viewer)) return true;
  if (isConfiguredTeamLead(viewer, brief)) return true;
  return (brief.taskUpdates ?? []).some(
    (update) => update.actionItem && canViewAction(viewer, update.actionItem)
  );
}

export function canEditWeeklyBriefOverall(
  viewer: ActionViewer,
  brief: WeeklyBriefAccessShape
): boolean {
  if (isOfficerTier(viewer) || isLeadershipOrBoard(viewer)) return true;
  return isConfiguredTeamLead(viewer, brief);
}

export function canEditWeeklyTaskUpdate(
  viewer: ActionViewer,
  action: WeeklyBriefTaskAccess
): boolean {
  if (isOfficerTier(viewer) || isLeadershipOrBoard(viewer)) return true;
  return canEditAction(viewer, action);
}

export function canFinalizeTeamMeeting(
  viewer: ActionViewer,
  brief: WeeklyBriefAccessShape
): boolean {
  if (isOfficerTier(viewer) || isLeadershipOrBoard(viewer)) return true;
  return isConfiguredTeamLead(viewer, brief);
}

export function canPrepareOfficerPresentation(
  viewer: ActionViewer,
  brief: WeeklyBriefAccessShape,
  action?: WeeklyBriefTaskAccess | null
): boolean {
  if (isOfficerTier(viewer) || isLeadershipOrBoard(viewer)) return true;
  if (isConfiguredTeamLead(viewer, brief)) return true;
  return Boolean(action && canEditAction(viewer, action));
}

export function canManageOfficerMeetingOutputs(viewer: ActionViewer): boolean {
  return isOfficerTier(viewer) || isLeadershipOrBoard(viewer);
}
