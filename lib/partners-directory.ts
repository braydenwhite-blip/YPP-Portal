import { prisma } from "@/lib/prisma";
import { countOpenActionsByRelatedEntity } from "@/lib/people-strategy/action-queries";
import {
  asPartnerStage,
  isActivePartnerStage,
  PARTNER_STAGE_LABELS,
  PARTNER_WON_STAGES,
  partnerStuckReasons,
  partnerTypeLabel,
} from "@/lib/partners-constants";

/**
 * Master Partner database reads (Knowledge OS V2 must-build, plan §10).
 *
 * The partner table is small (an organization's relationship list, not a
 * ledger), so this loads every non-archived partner once with its
 * relationship-operations satellites — primary contact, open requests,
 * agreements/conditions, upcoming partner-linked meetings, open actions —
 * and the page filters in memory. Concrete fields only: relationship lead,
 * last interaction, next follow-up, open asks. No "partner health" score.
 */

export const PARTNER_VIEW_FILTERS = [
  "all",
  "active",
  "follow-up",
  "meetings",
  "won",
  "parked",
] as const;
export type PartnerViewFilter = (typeof PARTNER_VIEW_FILTERS)[number];

export const PARTNER_VIEW_FILTER_LABELS: Record<PartnerViewFilter, string> = {
  all: "All partners",
  active: "Active conversations",
  "follow-up": "Needs follow-up",
  meetings: "Upcoming meetings",
  won: "Active partnerships",
  parked: "Parked",
};

export const PARTNER_FLAG_FILTERS = ["no-lead", "open-requests"] as const;
export type PartnerFlagFilter = (typeof PARTNER_FLAG_FILTERS)[number];

export const PARTNER_FLAG_FILTER_LABELS: Record<PartnerFlagFilter, string> = {
  "no-lead": "No relationship lead",
  "open-requests": "Open requests",
};

export function asPartnerViewFilter(value: string | undefined): PartnerViewFilter {
  return value && (PARTNER_VIEW_FILTERS as readonly string[]).includes(value)
    ? (value as PartnerViewFilter)
    : "all";
}

export function asPartnerFlagFilter(value: string | undefined): PartnerFlagFilter | null {
  return value && (PARTNER_FLAG_FILTERS as readonly string[]).includes(value)
    ? (value as PartnerFlagFilter)
    : null;
}

/** Serializable row for the client table. */
export type PartnerDirectoryRow = {
  id: string;
  name: string;
  /** Structured type label, falling back to the legacy free-text type. */
  typeLabel: string | null;
  location: string | null;
  stage: string;
  stageLabel: string;
  stageGroup: "active" | "won" | "parked";
  lead: { id: string; name: string } | null;
  /** Structured PartnerContact first; legacy contactName as fallback. */
  primaryContact: { name: string; title: string | null; email: string | null } | null;
  classCount: number;
  lastContactedISO: string | null;
  nextFollowUpISO: string | null;
  /** Concrete stuck reasons (overdue follow-up, no next step, no lead). */
  stuck: string[];
  openRequestCount: number;
  nextOpenRequest: { title: string; dueISO: string | null } | null;
  agreements: { total: number; signed: number; pendingConditions: number };
  upcomingMeetingCount: number;
  openActionCount: number;
};

export type PartnerDirectoryStats = {
  total: number;
  activeConversations: number;
  needsFollowUp: number;
  openRequests: number;
  upcomingMeetings: number;
};

export type PartnerDirectoryResult = {
  rows: PartnerDirectoryRow[];
  stats: PartnerDirectoryStats;
  /** Distinct type labels present, for the type filter chips. */
  typeLabels: string[];
};

export async function loadPartnerDirectory(): Promise<PartnerDirectoryResult> {
  const now = new Date();

  const partners = await prisma.partner.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      partnerType: true,
      location: true,
      stage: true,
      relationshipLeadId: true,
      relationshipLead: { select: { id: true, name: true, email: true } },
      lastContactedAt: true,
      nextFollowUpAt: true,
      contactName: true,
      contactTitle: true,
      contactEmail: true,
      contacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: { name: true, title: true, email: true },
      },
      requests: {
        where: { status: { in: ["OPEN", "IN_NEGOTIATION"] } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        select: { title: true, dueAt: true },
      },
      agreements: {
        select: { status: true, conditions: { select: { status: true } } },
      },
      _count: { select: { classOfferings: true } },
    },
  });

  const ids = partners.map((p) => p.id);
  // The new Meeting model does not link to partners, so partner-scoped upcoming
  // meeting counts resolve to empty.
  const [meetingGroups, openActionCounts] = await Promise.all([
    Promise.resolve([] as Array<{ relatedEntityId: string | null; _count: { _all: number } }>),
    countOpenActionsByRelatedEntity("PARTNER", ids),
  ]);
  const upcomingMeetings = new Map<string, number>();
  for (const group of meetingGroups) {
    if (group.relatedEntityId) {
      upcomingMeetings.set(group.relatedEntityId, group._count._all);
    }
  }

  const rows: PartnerDirectoryRow[] = partners.map((partner) => {
    const stage = asPartnerStage(partner.stage);
    const stageGroup: PartnerDirectoryRow["stageGroup"] = isActivePartnerStage(stage)
      ? "active"
      : (PARTNER_WON_STAGES as readonly string[]).includes(stage)
        ? "won"
        : "parked";
    const structuredContact = partner.contacts[0] ?? null;
    const primaryContact = structuredContact
      ? structuredContact
      : partner.contactName
        ? {
            name: partner.contactName,
            title: partner.contactTitle,
            email: partner.contactEmail,
          }
        : null;
    const signed = partner.agreements.filter((a) => a.status === "SIGNED").length;
    const pendingConditions = partner.agreements.reduce(
      (sum, a) => sum + a.conditions.filter((c) => c.status === "PENDING").length,
      0
    );

    return {
      id: partner.id,
      name: partner.name,
      typeLabel: partnerTypeLabel(partner.partnerType) ?? partner.type,
      location: partner.location,
      stage,
      stageLabel: PARTNER_STAGE_LABELS[stage],
      stageGroup,
      lead: partner.relationshipLead
        ? {
            id: partner.relationshipLead.id,
            name: partner.relationshipLead.name ?? partner.relationshipLead.email,
          }
        : null,
      primaryContact,
      classCount: partner._count.classOfferings,
      lastContactedISO: partner.lastContactedAt?.toISOString() ?? null,
      nextFollowUpISO: partner.nextFollowUpAt?.toISOString() ?? null,
      stuck: partnerStuckReasons(
        {
          stage: partner.stage,
          nextFollowUpAt: partner.nextFollowUpAt,
          relationshipLeadId: partner.relationshipLeadId,
        },
        now
      ),
      openRequestCount: partner.requests.length,
      nextOpenRequest: partner.requests[0]
        ? {
            title: partner.requests[0].title,
            dueISO: partner.requests[0].dueAt?.toISOString() ?? null,
          }
        : null,
      agreements: { total: partner.agreements.length, signed, pendingConditions },
      upcomingMeetingCount: upcomingMeetings.get(partner.id) ?? 0,
      openActionCount: openActionCounts.get(partner.id) ?? 0,
    };
  });

  const stats: PartnerDirectoryStats = {
    total: rows.length,
    activeConversations: rows.filter((r) => r.stageGroup === "active").length,
    needsFollowUp: rows.filter((r) => r.stuck.length > 0).length,
    openRequests: rows.reduce((sum, r) => sum + r.openRequestCount, 0),
    upcomingMeetings: rows.filter((r) => r.upcomingMeetingCount > 0).length,
  };

  const typeLabels = Array.from(
    new Set(rows.map((r) => r.typeLabel).filter((t): t is string => Boolean(t)))
  ).sort();

  return { rows, stats, typeLabels };
}

/** Apply the URL filters to the loaded rows (pure; unit-testable). */
export function filterPartnerRows(
  rows: PartnerDirectoryRow[],
  params: {
    view: PartnerViewFilter;
    flag: PartnerFlagFilter | null;
    type?: string;
    q?: string;
  }
): PartnerDirectoryRow[] {
  const q = params.q?.trim().toLowerCase();
  return rows.filter((row) => {
    if (params.view === "active" && row.stageGroup !== "active") return false;
    if (params.view === "follow-up" && row.stuck.length === 0) return false;
    if (params.view === "meetings" && row.upcomingMeetingCount === 0) return false;
    if (params.view === "won" && row.stageGroup !== "won") return false;
    if (params.view === "parked" && row.stageGroup !== "parked") return false;
    if (params.flag === "no-lead" && row.lead !== null) return false;
    if (params.flag === "open-requests" && row.openRequestCount === 0) return false;
    if (params.type && row.typeLabel !== params.type) return false;
    if (q) {
      const haystack = [
        row.name,
        row.typeLabel,
        row.location,
        row.lead?.name,
        row.primaryContact?.name,
        row.primaryContact?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
