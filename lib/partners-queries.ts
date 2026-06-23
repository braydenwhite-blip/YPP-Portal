import type { Prisma, RegularInstructorAssignmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { whereActiveMember } from "@/lib/user-role-where";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { getActionsForEntity } from "@/lib/people-strategy/action-queries";

/**
 * Partner directory + pipeline reads.
 *
 * `listPartners()` keeps its original shape and adds the Phase 4 pipeline fields
 * (additive — existing callers ignore the extra keys). The pipeline board and
 * partner profile read through the richer helpers below.
 */

const INACTIVE_ASSIGNMENT_STATUSES: RegularInstructorAssignmentStatus[] = [
  "DECLINED",
  "REMOVED",
  "COMPLETED",
];

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
} satisfies Prisma.PartnerSelect;

const PARTNER_CLASS_SELECT = {
  id: true,
  title: true,
  status: true,
  startDate: true,
  endDate: true,
  meetingDays: true,
  meetingTime: true,
  timezone: true,
  deliveryMode: true,
  zoomLink: true,
  locationName: true,
  locationAddress: true,
  room: true,
  instructor: { select: { id: true, name: true, email: true } },
  chapter: { select: { id: true, name: true } },
  approval: {
    select: {
      status: true,
      reviewedAt: true,
      reviewNotes: true,
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  },
  regularInstructorAssignments: {
    where: { status: { notIn: INACTIVE_ASSIGNMENT_STATUSES } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      status: true,
      instructor: { select: { id: true, name: true, email: true } },
    },
  },
  _count: { select: { sessions: true, enrollments: true } },
} satisfies Prisma.ClassOfferingSelect;

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
        select: PARTNER_CLASS_SELECT,
        orderBy: { createdAt: "desc" },
        take: 25,
      },
    },
  });
}

export type PartnerDetail = NonNullable<Awaited<ReturnType<typeof getPartnerById>>>;
export type PartnerClass = PartnerDetail["classOfferings"][number];

export type PartnerNeedsAttentionItem = {
  code:
    | "NO_RELATIONSHIP_LEAD"
    | "FOLLOW_UP_OVERDUE"
    | "CLASS_REVIEW_PENDING"
    | "CLASS_CHANGES_REQUESTED"
    | "CLASS_MISSING_SESSIONS"
    | "CLASS_MISSING_MEETING_LINK"
    | "CLASS_MISSING_LOCATION"
    | "CLASS_ASSIGNMENT_GAP";
  label: string;
  detail?: string;
  href?: string;
  severity: "warning" | "danger";
};

function startOfDayMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function classStatusLabel(status: string): string {
  return status.replace(/_/g, " ").toLowerCase();
}

function classNeedsSetupAttention(cls: PartnerClass): boolean {
  return !["COMPLETED", "CANCELLED"].includes(cls.status);
}

/** Classes linked to one partner, newest first, with schedule / instructor / review context. */
export async function getClassesForPartner(partnerId: string) {
  return prisma.classOffering.findMany({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: PARTNER_CLASS_SELECT,
  });
}

/** Action Tracker items linked to a partner through the shared related-entity fields. */
export async function getActionsForPartner(partnerId: string, viewer: ActionViewer) {
  return getActionsForEntity("PARTNER", partnerId, viewer);
}

/**
 * Meeting Tracker records linked to a partner. The old Meetings Tracker was
 * removed, so this is always empty now — kept so existing callers still resolve.
 */
export async function getMeetingsForPartner(_partnerId: string, _limit = 50) {
  return [] as const;
}

/** Deterministic partner attention logic shared by the profile and tests. */
export function derivePartnerNeedsAttention(
  partner: PartnerDetail,
  now: Date = new Date()
): PartnerNeedsAttentionItem[] {
  const items: PartnerNeedsAttentionItem[] = [];

  if (!partner.relationshipLeadId) {
    items.push({
      code: "NO_RELATIONSHIP_LEAD",
      label: "Partner has no relationship lead",
      detail: "Assign one person to own follow-up and class coordination.",
      href: `/admin/partners/${partner.id}#edit`,
      severity: "warning",
    });
  }

  if (partner.nextFollowUpAt && partner.nextFollowUpAt.getTime() < startOfDayMs(now)) {
    items.push({
      code: "FOLLOW_UP_OVERDUE",
      label: "Partner follow-up is overdue",
      detail: `Due ${partner.nextFollowUpAt.toLocaleDateString()}`,
      href: `/admin/partners/${partner.id}`,
      severity: "danger",
    });
  }

  for (const cls of partner.classOfferings) {
    if (!classNeedsSetupAttention(cls)) continue;
    const classHref = `/admin/classes/${cls.id}`;
    const labelPrefix = `${cls.title}:`;
    const reviewStatus = cls.approval?.status ?? "NOT_REQUESTED";

    if (reviewStatus === "CHANGES_REQUESTED") {
      items.push({
        code: "CLASS_CHANGES_REQUESTED",
        label: `${labelPrefix} curriculum changes requested`,
        detail: "Resolve the reviewer notes before launch.",
        href: classHref,
        severity: "danger",
      });
    } else if (reviewStatus !== "APPROVED") {
      items.push({
        code: "CLASS_REVIEW_PENDING",
        label: `${labelPrefix} curriculum review pending`,
        detail: reviewStatus.replace(/_/g, " ").toLowerCase(),
        href: classHref,
        severity: "warning",
      });
    }

    if (cls._count.sessions === 0 && cls.status !== "DRAFT") {
      items.push({
        code: "CLASS_MISSING_SESSIONS",
        label: `${labelPrefix} no sessions scheduled`,
        detail: `Class is ${classStatusLabel(cls.status)}.`,
        href: classHref,
        severity: "danger",
      });
    }

    if ((cls.deliveryMode === "VIRTUAL" || cls.deliveryMode === "HYBRID") && !cls.zoomLink) {
      items.push({
        code: "CLASS_MISSING_MEETING_LINK",
        label: `${labelPrefix} missing virtual meeting link`,
        href: classHref,
        severity: "warning",
      });
    }

    if (cls.deliveryMode === "IN_PERSON" && !cls.locationName && !cls.locationAddress) {
      items.push({
        code: "CLASS_MISSING_LOCATION",
        label: `${labelPrefix} missing in-person location`,
        href: classHref,
        severity: "warning",
      });
    }

    if (cls.regularInstructorAssignments.length === 0) {
      items.push({
        code: "CLASS_ASSIGNMENT_GAP",
        label: `${labelPrefix} no instructor assignment workflow`,
        detail: "Lead instructor exists, but no active assignment row is tracking confirmation.",
        href: classHref,
        severity: "warning",
      });
    }
  }

  return items;
}

/** One-load partner 360 model for pages that want the record plus attention state. */
export async function getPartnerDetailModel(id: string) {
  const partner = await getPartnerById(id);
  if (!partner) return null;
  return {
    partner,
    needsAttention: derivePartnerNeedsAttention(partner),
  };
}

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

/**
 * Relationship-operations satellites for the partner profile (Knowledge OS
 * V2): structured contacts, requests with their lifecycle, and agreements
 * with per-condition status.
 */
export async function listPartnerRelations(partnerId: string) {
  const [contacts, requests, agreements] = await Promise.all([
    prisma.partnerContact.findMany({
      where: { partnerId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        title: true,
        email: true,
        phone: true,
        role: true,
        isPrimary: true,
      },
    }),
    prisma.partnerRequest.findMany({
      where: { partnerId },
      orderBy: [{ resolvedAt: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        details: true,
        status: true,
        ownerId: true,
        dueAt: true,
        resolvedAt: true,
        createdAt: true,
      },
    }),
    prisma.partnerAgreement.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        kind: true,
        status: true,
        title: true,
        effectiveAt: true,
        expiresAt: true,
        terms: true,
        conditions: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            description: true,
            status: true,
            dueAt: true,
            satisfiedAt: true,
          },
        },
      },
    }),
  ]);
  return { contacts, requests, agreements };
}

export type PartnerRelations = Awaited<ReturnType<typeof listPartnerRelations>>;

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
