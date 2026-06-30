/**
 * Partner operating-room loader (Partner Automation, Phase 1).
 *
 * Loads one partner as a focused operating room: overview + lane + next action,
 * contact info, the real PartnerNote timeline (with author names), open issues,
 * logistics readiness, and the pre-built contexts the client uses to generate
 * outreach emails and the meeting brief. Chapter scope is enforced by the caller
 * (requirePartnerAccess) — this loader returns null if the partner is gone.
 */

import { prisma } from "@/lib/prisma";
import {
  partnerTypeLabel,
  partnerNoteKindLabel,
  PARTNER_STAGE_LABELS,
  asPartnerStage,
} from "@/lib/partners-constants";
import {
  partnerCpLane,
  partnerNextAction,
  CP_LANE_LABELS,
  CP_LANE_TONE,
} from "@/lib/partners/pipeline";
import { isFollowUpDue } from "@/lib/partners/follow-up";
import {
  parseLogistics,
  logisticsReadiness,
  isLogisticsRelevant,
  isLogisticsComplete,
} from "@/lib/partners/logistics";
import { DEFAULT_YPP_DESCRIPTION } from "@/lib/partners/outreach-email";
import type { PartnerScope } from "@/lib/partners/permissions";
import type {
  PartnerDetailDTO,
  PartnerTimelineEntry,
  PartnerIssueDTO,
} from "@/lib/partners/detail-types";

const DAY_MS = 86_400_000;

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function metaString(meta: unknown, key: string): string | null {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const v = (meta as Record<string, unknown>)[key];
    if (typeof v === "string") return v;
  }
  return null;
}

export async function loadPartnerDetail(
  partnerId: string,
  scope: PartnerScope,
  now: Date = new Date()
): Promise<PartnerDetailDTO | null> {
  const partner = await prisma.partner.findFirst({
    where: { id: partnerId, archivedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      partnerType: true,
      stage: true,
      notes: true,
      contactName: true,
      contactTitle: true,
      contactEmail: true,
      contactPhone: true,
      website: true,
      location: true,
      lastContactedAt: true,
      nextFollowUpAt: true,
      meetingDate: true,
      requestedAgeGroups: true,
      requestedDates: true,
      logistics: true,
      chapterId: true,
      chapter: { select: { name: true, city: true, state: true, president: { select: { name: true } } } },
      pipelineNotes: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, kind: true, body: true, createdAt: true, authorId: true, metadata: true },
      },
      _count: { select: { classOfferings: true } },
    },
  });
  if (!partner) return null;

  // Resolve note author names in one query (FK-less authorId per repo convention).
  const authorIds = Array.from(
    new Set(partner.pipelineNotes.map((n) => n.authorId).filter((id): id is string => !!id))
  );
  const authors = authorIds.length
    ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const authorName = new Map(authors.map((a) => [a.id, a.name ?? a.email ?? "Someone"]));

  const wi = {
    stage: partner.stage,
    nextFollowUpAt: partner.nextFollowUpAt,
    meetingDate: partner.meetingDate,
    lastContactedAt: partner.lastContactedAt,
    contactName: partner.contactName,
    contactEmail: partner.contactEmail,
    logisticsComplete: isLogisticsRelevant(partner.stage) ? isLogisticsComplete(partner.logistics) : null,
  };
  const lane = partnerCpLane(wi, now);

  const timeline: PartnerTimelineEntry[] = partner.pipelineNotes.map((n) => {
    const followUpIso = metaString(n.metadata, "followUpAt");
    return {
      id: n.id,
      kind: n.kind,
      kindLabel: partnerNoteKindLabel(n.kind),
      body: n.body,
      dateLabel: fmtShort(n.createdAt),
      authorName: n.authorId ? authorName.get(n.authorId) ?? null : null,
      followUpLabel: followUpIso ? fmtShort(new Date(followUpIso)) : null,
    };
  });

  // Open issues = ISSUE notes whose id is not referenced by an ISSUE_RESOLVED note.
  const resolvedIds = new Set(
    partner.pipelineNotes
      .filter((n) => n.kind === "ISSUE_RESOLVED")
      .map((n) => metaString(n.metadata, "resolvesNoteId"))
      .filter((v): v is string => !!v)
  );
  const openIssues: PartnerIssueDTO[] = partner.pipelineNotes
    .filter((n) => n.kind === "ISSUE" && !resolvedIds.has(n.id))
    .map((n) => {
      const meta = (n.metadata ?? {}) as Record<string, unknown>;
      return {
        id: n.id,
        body: n.body,
        dateLabel: fmtShort(n.createdAt),
        severity: typeof meta.severity === "string" ? meta.severity : "MEDIUM",
        escalated: meta.escalated === true,
        overdue: now.getTime() - n.createdAt.getTime() > DAY_MS,
      };
    });

  const chapterLocation = partner.chapter
    ? [partner.chapter.city, partner.chapter.state].filter(Boolean).join(", ") || partner.chapter.name
    : partner.location ?? null;
  const presidentName = partner.chapter?.president?.name ?? scope.user.name ?? null;

  const emailContext = {
    partnerName: partner.name,
    contactName: partner.contactName,
    contactTitle: partner.contactTitle,
    chapterName: partner.chapter?.name ?? null,
    chapterLocation,
    presidentName,
    presidentEmail: scope.user.email ?? null,
    yppDescription: DEFAULT_YPP_DESCRIPTION,
    proposedAges: partner.requestedAgeGroups,
    proposedSchedule: partner.requestedDates,
    fallbackAsk: null,
    meetingDateLabel: fmtDate(partner.meetingDate),
  };

  const meetingBriefContext = {
    partnerName: partner.name,
    partnerType: partner.partnerType,
    contactName: partner.contactName,
    contactTitle: partner.contactTitle,
    chapterName: partner.chapter?.name ?? null,
    chapterLocation,
    presidentName,
    yppDescription: DEFAULT_YPP_DESCRIPTION,
    proposedAges: partner.requestedAgeGroups,
    proposedSchedule: partner.requestedDates,
    fallbackAsk: null,
    meetingDateLabel: fmtDate(partner.meetingDate),
    priorNotes: timeline.slice(0, 6).map((t) => ({ dateLabel: t.dateLabel, text: t.body })),
  };

  return {
    id: partner.id,
    name: partner.name,
    typeLabel: partnerTypeLabel(partner.partnerType) ?? partner.type ?? null,
    stage: asPartnerStage(partner.stage),
    stageLabel: PARTNER_STAGE_LABELS[asPartnerStage(partner.stage)],
    lane,
    laneLabel: CP_LANE_LABELS[lane],
    laneTone: CP_LANE_TONE[lane],
    chapterId: partner.chapterId,
    chapterLabel: partner.chapter?.name ?? null,
    canManage: true,
    contact: {
      name: partner.contactName,
      title: partner.contactTitle,
      email: partner.contactEmail,
      phone: partner.contactPhone,
      website: partner.website,
      location: partner.location,
    },
    notes: partner.notes,
    nextAction: partnerNextAction(wi, now),
    meeting: {
      dateLabel: fmtDate(partner.meetingDate),
      isPast: !!partner.meetingDate && partner.meetingDate.getTime() < now.getTime(),
    },
    nextFollowUp: {
      label: fmtDate(partner.nextFollowUpAt),
      overdue: isFollowUpDue(partner.nextFollowUpAt, now),
    },
    logistics: {
      relevant: isLogisticsRelevant(partner.stage),
      readiness: logisticsReadiness(parseLogistics(partner.logistics)),
    },
    timeline,
    openIssues,
    classCount: partner._count.classOfferings,
    emailContext,
    meetingBriefContext,
  };
}
