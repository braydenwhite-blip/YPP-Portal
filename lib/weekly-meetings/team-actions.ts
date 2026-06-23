"use server";

/**
 * Team configuration server actions (admin-only). Many-to-many membership.
 */
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireTeamAdmin } from "./permissions";
import {
  CreateTeamSchema,
  RemoveMemberSchema,
  TeamMemberSchema,
  UpdateTeamSchema,
} from "./schemas";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createTeam(input: unknown) {
  const viewer = await requireTeamAdmin();
  const data = CreateTeamSchema.parse(input);
  const slug = data.slug ?? slugify(data.name);
  if (!slug) throw new Error("Could not derive a slug from the team name");

  const max = await prisma.team.aggregate({ _max: { sortOrder: true } });
  const team = await prisma.team.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      createdById: viewer.id,
    },
  });
  revalidatePath("/admin/teams");
  return { ok: true, id: team.id };
}

export async function updateTeam(input: unknown) {
  await requireTeamAdmin();
  const data = UpdateTeamSchema.parse(input);
  await prisma.team.update({
    where: { id: data.teamId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
  });
  revalidatePath("/admin/teams");
  return { ok: true };
}

export async function archiveTeam(input: unknown) {
  await requireTeamAdmin();
  const { teamId } = UpdateTeamSchema.pick({ teamId: true }).parse(input);
  await prisma.team.update({ where: { id: teamId }, data: { status: "ARCHIVED" } });
  revalidatePath("/admin/teams");
  return { ok: true };
}

export async function addTeamMember(input: unknown) {
  await requireTeamAdmin();
  const data = TeamMemberSchema.parse(input);
  await prisma.teamMembership.upsert({
    where: { teamId_userId: { teamId: data.teamId, userId: data.userId } },
    create: {
      teamId: data.teamId,
      userId: data.userId,
      isLead: data.isLead ?? false,
      role: data.role,
    },
    update: {
      ...(data.isLead !== undefined ? { isLead: data.isLead } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
    },
  });
  revalidatePath("/admin/teams");
  return { ok: true };
}

export async function setMemberLead(input: unknown) {
  await requireTeamAdmin();
  const data = TeamMemberSchema.parse(input);
  await prisma.teamMembership.update({
    where: { teamId_userId: { teamId: data.teamId, userId: data.userId } },
    data: { isLead: data.isLead ?? false },
  });
  revalidatePath("/admin/teams");
  return { ok: true };
}

export async function removeTeamMember(input: unknown) {
  await requireTeamAdmin();
  const data = RemoveMemberSchema.parse(input);
  await prisma.teamMembership.deleteMany({
    where: { teamId: data.teamId, userId: data.userId },
  });
  revalidatePath("/admin/teams");
  return { ok: true };
}
