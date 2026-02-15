"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type SessionUser = {
  id: string;
  roles: string[];
  primaryRole: string;
};

export function hasRole(roles: string[] | undefined | null, role: string): boolean {
  if (!roles) return false;
  return roles.includes(role);
}

export function hasAnyRole(
  roles: string[] | undefined | null,
  requiredRoles: string[]
): boolean {
  if (!roles || requiredRoles.length === 0) return false;
  return requiredRoles.some((role) => roles.includes(role));
}

export async function requireSessionUser(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return {
    id: session.user.id,
    roles: session.user.roles ?? [],
    primaryRole: session.user.primaryRole,
  };
}

export async function requireAnyRole(requiredRoles: string[]): Promise<SessionUser> {
  const sessionUser = await requireSessionUser();
  if (!hasAnyRole(sessionUser.roles, requiredRoles)) {
    throw new Error("Unauthorized");
  }
  return sessionUser;
}
