import "server-only";

import { requireLeadership } from "@/lib/authorization";
import type { SessionUser } from "@/lib/auth-supabase";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import {
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";

/**
 * The one gate for the mentorship command center (admin POV, review cycles,
 * development records inside the hub). Exactly the stack the Leadership
 * Development cockpit used: people-dashboard flag + officer tier + leadership
 * + performance-tab access. No new permission system.
 */

function toViewer(user: Pick<SessionUser, "id" | "roles" | "primaryRole" | "adminSubtypes">): ActionViewer {
  return {
    id: user.id,
    roles: user.roles,
    primaryRole: user.primaryRole,
    adminSubtypes: user.adminSubtypes,
  };
}

/** Non-throwing check for the hub page (decides whether to offer the POV). */
export async function hasMentorshipCommandAccess(
  user: Pick<SessionUser, "id" | "roles" | "primaryRole" | "adminSubtypes">
): Promise<boolean> {
  if (!isPeopleDashboardEnabled()) return false;
  const viewer = toViewer(user);
  if (!isOfficerTier(viewer)) return false;
  const leadership = await requireLeadership().catch(() => null);
  if (!leadership) return false;
  return getPeopleHubAccess(viewer).showPerformance;
}

/** Throwing guard for command-center pages and review-cycle mutations. */
export async function requireMentorshipCommandAccess(): Promise<SessionUser> {
  if (!isPeopleDashboardEnabled()) {
    throw new Error("Unauthorized");
  }
  const sessionUser = await requireLeadership();
  const viewer = toViewer(sessionUser);
  if (!isOfficerTier(viewer) || !getPeopleHubAccess(viewer).showPerformance) {
    throw new Error("Unauthorized");
  }
  return sessionUser;
}
