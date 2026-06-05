import { prisma } from "@/lib/prisma";
import { whereActiveMember } from "@/lib/user-role-where";

/** Active (non-archived) partners with their Relationship Lead and class count. */
export async function listPartners() {
  return prisma.partner.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      website: true,
      notes: true,
      relationshipLead: { select: { id: true, name: true, email: true } },
      _count: { select: { classOfferings: true } },
    },
  });
}

export type PartnerListItem = Awaited<ReturnType<typeof listPartners>>[number];

/** Lightweight partner options for a class-offering partner picker. */
export async function listPartnerOptions() {
  return prisma.partner.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Active members eligible to be a Relationship Lead (never applicants). */
export async function listRelationshipLeadOptions() {
  return prisma.user.findMany({
    where: { archivedAt: null, ...whereActiveMember() },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 500,
  });
}
