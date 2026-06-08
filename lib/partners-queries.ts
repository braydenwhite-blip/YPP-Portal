import { prisma } from "@/lib/prisma";
import { whereActiveMember } from "@/lib/user-role-where";

/**
 * Partner directory + pipeline reads.
 *
 * `listPartners()` keeps its original shape and adds the Phase 4 pipeline fields
 * (additive — existing callers ignore the extra keys). The pipeline board and
 * partner profile read through the richer helpers below.
 */

const PARTNER_PIPELINE_SELECT = {
  id: true,
  name: true,
  type: true,
  website: true,
  notes: true,
  // Pipeline fields
  stage: true,
  priority: true,
  partnerType: true,
  source: true,
  contactName: true,
  contactTitle: true,
  contactEmail: true,
  contactPhone: true,
  location: true,
  lastContactedAt: true,
  nextFollowUpAt: true,
  meetingDate: true,
  requestedSubjects: true,
  requestedAgeGroups: true,
  requestedDates: true,
  programFormat: true,
  expectedStudents: true,
  instructorCountNeeded: true,
  constraints: true,
  outcome: true,
  createdAt: true,
  updatedAt: true,
  relationshipLeadId: true,
  relationshipLead: { select: { id: true, name: true, email: true } },
  _count: { select: { classOfferings: true } },
} as const;

/** Active (non-archived) partners with Relationship Lead, class count, and pipeline fields. */
export async function listPartners() {
  return prisma.partner.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: PARTNER_PIPELINE_SELECT,
  });
}

export type PartnerListItem = Awaited<ReturnType<typeof listPartners>>[number];

/** A single partner with its pipeline fields, for the profile page. */
export async function getPartnerById(id: string) {
  return prisma.partner.findFirst({
    where: { id, archivedAt: null },
    select: {
      ...PARTNER_PIPELINE_SELECT,
      classOfferings: {
        select: { id: true, title: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
    },
  });
}

export type PartnerDetail = NonNullable<Awaited<ReturnType<typeof getPartnerById>>>;

/** Append-only timeline notes for a partner, newest first. */
export async function listPartnerNotes(partnerId: string, take = 50) {
  return prisma.partnerNote.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, kind: true, body: true, authorId: true, createdAt: true },
  });
}

export type PartnerNoteItem = Awaited<ReturnType<typeof listPartnerNotes>>[number];

/** Resolve a set of author ids to display names (FK-less authorId on PartnerNote). */
export async function resolveAuthorNames(
  authorIds: (string | null)[]
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(authorIds.filter((x): x is string => Boolean(x))));
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.name || u.email || "Unknown"]));
}

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
