import { getSession } from "@/lib/auth-supabase";
import { hasAnyRole } from "@/lib/authorization";
import { LEADERSHIP_ACTION_CENTER_ROLES } from "@/lib/org/role-sets";

/** Roles that can access the Leadership Action Center. Admins + STAFF. */
export const LEADERSHIP_ROLES = LEADERSHIP_ACTION_CENTER_ROLES;

export type LeadershipSession = {
  userId: string;
  roles: string[];
  primaryRole: string | null;
  /** True for ADMIN; STAFF gets read+update on tasks they own but cannot delete or import. */
  canManage: boolean;
};

/**
 * Resolve the current user and confirm they can see the Leadership Action
 * Center. Returns null if there's no session — callers should redirect.
 */
export async function getLeadershipSession(): Promise<LeadershipSession | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const roles = session.user.roles ?? [];
  const primaryRole = session.user.primaryRole ?? null;

  const allowed = hasAnyRole(roles, [...LEADERSHIP_ROLES], primaryRole);
  if (!allowed) return null;

  const isAdmin = hasAnyRole(roles, ["ADMIN"], primaryRole);

  return {
    userId: session.user.id,
    roles,
    primaryRole,
    canManage: isAdmin,
  };
}

/** Throws when the caller is not allowed to mutate Leadership Action Center data. */
export async function requireLeadershipManager(): Promise<LeadershipSession> {
  const session = await getLeadershipSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  if (!session.canManage) {
    throw new Error("Forbidden: admin access required");
  }
  return session;
}

/** Throws if the caller cannot read the Leadership Action Center. */
export async function requireLeadershipReader(): Promise<LeadershipSession> {
  const session = await getLeadershipSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
