import type {
  ActionAssignmentRole,
  ActionItemVisibility,
} from "@prisma/client";

import {
  OFFICER_TIER_ROLES,
  hasAnyAdminSubtype,
  hasAnyRole,
  hasRole,
} from "@/lib/authorization";

/**
 * People Strategy — Action Item access policy.
 *
 * These are PURE predicates (no DB, no session) so they can be unit-tested and
 * reused both by the server actions (authoritative enforcement) and by the UI
 * (affordances). Server actions MUST call these against the trusted, server-
 * resolved session user — never trust a viewer supplied by the client.
 *
 * Tier mapping (see INTEGRATION_MAP.md → "Role tiers"):
 *   - Member            → any non-officer role (STUDENT, INSTRUCTOR, …)
 *   - Officer-tier+     → OFFICER_TIER_ROLES (ADMIN, STAFF, CHAPTER_PRESIDENT,
 *                         HIRING_CHAIR). All ADMIN-tier users (Sr. Leadership,
 *                         Leadership, Board/SUPER_ADMIN) carry ADMIN and pass.
 *   - Leadership / Board       → ADMIN + AdminSubtype Leadership or SUPER_ADMIN.
 *
 * VISIBILITY DECISION: an assigned person can always see the action in their
 * own My Actions list, including OFFICERS_ONLY items. That assignment does not
 * grant global tracker access; it only lets them see the work they personally
 * own, execute, or provide input on.
 */

export type ActionViewer = {
  id: string;
  roles: string[];
  primaryRole?: string | null;
  adminSubtypes?: string[];
};

/** Minimal projection of an ActionItem needed to decide access. */
export type ActionAccessShape = {
  leadId: string | null;
  createdById?: string | null;
  visibility: ActionItemVisibility;
  assignments: Array<{ userId: string; role: ActionAssignmentRole }>;
};

/** Officer-tier and above (includes every ADMIN-tier user). */
export function isOfficerTier(user: ActionViewer): boolean {
  return hasAnyRole(user.roles, [...OFFICER_TIER_ROLES], user.primaryRole ?? null);
}

/** Leadership or Board (SUPER_ADMIN stands in for Board). Both can view everything. */
export function isLeadershipOrBoard(user: ActionViewer): boolean {
  const isAdmin = hasRole(user.roles, "ADMIN", user.primaryRole ?? null);
  return isAdmin && hasAnyAdminSubtype(user.adminSubtypes ?? [], ["LEADERSHIP", "SUPER_ADMIN"]);
}

/**
 * Board only (SUPER_ADMIN stands in for Board). A plain Leadership does NOT pass —
 * mirrors the server-side `requireBoard()` guard for UI affordances (e.g.
 * showing the Board roll-up link). Authoritative enforcement stays server-side.
 */
export function isBoard(user: ActionViewer): boolean {
  const isAdmin = hasRole(user.roles, "ADMIN", user.primaryRole ?? null);
  return isAdmin && hasAnyAdminSubtype(user.adminSubtypes ?? [], ["SUPER_ADMIN"]);
}

/** True when the viewer is the lead or holds any assignment on the action. */
export function isAssignedToAction(
  user: ActionViewer,
  action: ActionAccessShape
): boolean {
  if (action.leadId && action.leadId === user.id) return true;
  return action.assignments.some((a) => a.userId === user.id);
}

/** True when the viewer holds a specific assignment role on the action. */
export function hasAssignmentRole(
  user: ActionViewer,
  action: ActionAccessShape,
  role: ActionAssignmentRole
): boolean {
  if (role === "LEAD" && action.leadId === user.id) return true;
  return action.assignments.some((a) => a.userId === user.id && a.role === role);
}

/**
 * Who can SEE an action.
 * - Leadership / Board: all actions.
 * - Officer-tier: all ALL_LEADERSHIP and OFFICERS_ONLY actions.
 * - Assigned member: their own LEAD, EXECUTING, or INPUT actions.
 * - Unassigned member: no global tracker visibility.
 */
export function canViewAction(user: ActionViewer, action: ActionAccessShape): boolean {
  if (isLeadershipOrBoard(user)) return true;

  const officer = isOfficerTier(user);
  if (isAssignedToAction(user, action)) return true;

  if (action.visibility === "OFFICERS_ONLY") {
    return officer;
  }

  if (officer) return true;
  return isAssignedToAction(user, action);
}

/** Only officer-tier and above may create actions. */
export function canCreateAction(user: ActionViewer): boolean {
  return isOfficerTier(user);
}

/**
 * Who can EDIT an action's core fields.
 * Must be able to view it AND be either officer-tier (full edit) or an assigned
 * LEAD / EXECUTING owner. INPUT-only members may comment and flag, but not edit.
 */
export function canEditAction(user: ActionViewer, action: ActionAccessShape): boolean {
  if (!canViewAction(user, action)) return false;
  if (isOfficerTier(user)) return true;
  if (action.leadId === user.id) return true;
  return hasAssignmentRole(user, action, "EXECUTING");
}

/** Only officer-tier and above may add / remove assignments. */
export function canAssignAction(user: ActionViewer): boolean {
  return isOfficerTier(user);
}

/** Anyone who can view it may flag. */
export function canFlagAction(user: ActionViewer, action: ActionAccessShape): boolean {
  return canViewAction(user, action);
}

/**
 * Who can remove an action from the open tracker.
 * Officers may remove anything they can see; creators and leads may remove their own.
 */
export function canDeleteAction(user: ActionViewer, action: ActionAccessShape): boolean {
  if (!canViewAction(user, action)) return false;
  if (isOfficerTier(user)) return true;
  if (action.createdById === user.id) return true;
  if (action.leadId === user.id) return true;
  return false;
}
