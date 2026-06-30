// ============================================================================
// Universal Workflow Engine — permissions
// ============================================================================
//
// Thin, domain-specific wrappers over the shared authorization guards
// (lib/authorization.ts), mirroring lib/weekly-meetings/permissions.ts. Running
// workflows is officer-tier; designing templates is leadership/admin-tier.

import "server-only";

import {
  requireLeadership,
  requireOfficer,
  requireSessionUser,
  type SessionUser,
} from "@/lib/authorization";
import { hasAnyRole, hasAnyAdminSubtype } from "@/lib/authorization-roles";

/** Officers run and own workflow instances. */
export async function requireWorkflowRunner(): Promise<SessionUser> {
  return requireOfficer();
}

/** Leadership/admins design and publish reusable templates. */
export async function requireTemplateManager(): Promise<SessionUser> {
  return requireLeadership();
}

/** Any signed-in officer can view; used by read loaders that already scope. */
export async function requireWorkflowViewer(): Promise<SessionUser> {
  return requireSessionUser();
}

/** Pure predicate (client-safe shape) — may the viewer manage templates? */
export function canManageTemplates(viewer: SessionUser): boolean {
  return (
    hasAnyRole(viewer.roles, ["ADMIN"], viewer.primaryRole) ||
    hasAnyAdminSubtype(viewer.adminSubtypes, ["SUPER_ADMIN", "LEADERSHIP"])
  );
}
