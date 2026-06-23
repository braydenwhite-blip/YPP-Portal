/**
 * Team loaders (read side) for the Weekly Meetings module.
 */
import "server-only";

import { prisma } from "@/lib/prisma";

export type TeamMemberDTO = {
  userId: string;
  name: string;
  email: string;
  isLead: boolean;
  role: string | null;
};

export type TeamDTO = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  sortOrder: number;
  members: TeamMemberDTO[];
};

export type AssignableUser = { id: string; name: string; email: string };

export async function listTeams(opts?: { includeArchived?: boolean }): Promise<TeamDTO[]> {
  const teams = await prisma.team.findMany({
    where: opts?.includeArchived ? {} : { status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ isLead: "desc" }, { createdAt: "asc" }],
      },
    },
  });
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    status: t.status,
    sortOrder: t.sortOrder,
    members: t.memberships.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      isLead: m.isLead,
      role: m.role,
    })),
  }));
}

/** Teams a given user belongs to (active only). */
export async function listTeamsForUser(userId: string): Promise<TeamDTO[]> {
  const all = await listTeams();
  return all.filter((t) => t.members.some((m) => m.userId === userId));
}

/** Users that can be added to teams / assigned in meetings. */
export async function listAssignableUsers(): Promise<AssignableUser[]> {
  const users = await prisma.user.findMany({
    where: {
      primaryRole: { in: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR", "INSTRUCTOR", "MENTOR"] },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return users;
}
