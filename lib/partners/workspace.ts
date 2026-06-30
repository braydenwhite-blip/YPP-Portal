/**
 * Partner Command Workspace loader (Partner Automation, Phase 1).
 *
 * Loads everything the CP-facing `/partners` workspace needs in one pass:
 * chapter-scoped partners decorated with their CP lane + next action + logistics
 * state, the pipeline lanes, Chapter Impact Meeting metrics (all-time + this
 * week), today's priorities, and the operating queues (follow-ups due, meetings,
 * waiting-on-response, logistics incomplete). Scope is enforced by
 * partnerScopeWhere so a CP only ever sees their chapter.
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { partnerTypeLabel, PARTNER_STAGE_LABELS, asPartnerStage } from "@/lib/partners-constants";
import {
  partnerCpLane,
  partnerNextAction,
  CP_BOARD_LANES,
  CP_LANE_LABELS,
  CP_LANE_HINTS,
  CP_LANE_TONE,
  type PartnerWorkInput,
} from "@/lib/partners/pipeline";
import { isFollowUpDue } from "@/lib/partners/follow-up";
import { isLogisticsComplete, isLogisticsRelevant } from "@/lib/partners/logistics";
import { summarizePartnerImpact, type PartnerNoteMetricInput } from "@/lib/partners/metrics";
import { getPartnerScope, partnerScopeWhere, type PartnerScope } from "@/lib/partners/permissions";
import { initials } from "@/lib/partners-operations-shared";
import type {
  PartnerCardDTO,
  PartnerLaneColumn,
  PartnerWorkspaceData,
} from "@/lib/partners/workspace-types";

const WORKSPACE_SELECT = {
  id: true,
  name: true,
  type: true,
  partnerType: true,
  stage: true,
  contactName: true,
  contactTitle: true,
  contactEmail: true,
  contactPhone: true,
  location: true,
  lastContactedAt: true,
  nextFollowUpAt: true,
  meetingDate: true,
  createdAt: true,
  logistics: true,
  chapterId: true,
  chapter: { select: { name: true } },
} satisfies Prisma.PartnerSelect;

type WorkspaceRow = Prisma.PartnerGetPayload<{ select: typeof WORKSPACE_SELECT }>;

function fmt(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Monday 00:00 UTC of the week containing `now` (matches the portal's week key). */
function startOfWeekUtc(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function workInput(row: WorkspaceRow): PartnerWorkInput {
  const logisticsComplete = isLogisticsRelevant(row.stage)
    ? isLogisticsComplete(row.logistics)
    : null;
  return {
    stage: row.stage,
    nextFollowUpAt: row.nextFollowUpAt,
    meetingDate: row.meetingDate,
    lastContactedAt: row.lastContactedAt,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    logisticsComplete,
  };
}

function toCard(row: WorkspaceRow, now: Date): PartnerCardDTO {
  const wi = workInput(row);
  const lane = partnerCpLane(wi, now);
  const overdue = isFollowUpDue(row.nextFollowUpAt, now);
  const contactLine = [row.contactName, row.contactTitle].filter(Boolean).join(" · ") || null;
  const logisticsRelevant = isLogisticsRelevant(row.stage);
  return {
    id: row.id,
    name: row.name,
    typeLabel: partnerTypeLabel(row.partnerType) ?? row.type ?? null,
    stageLabel: PARTNER_STAGE_LABELS[asPartnerStage(row.stage)],
    lane,
    laneLabel: CP_LANE_LABELS[lane],
    laneTone: CP_LANE_TONE[lane],
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactLine,
    lastContactedLabel: fmt(row.lastContactedAt),
    nextFollowUpLabel: fmt(row.nextFollowUpAt),
    nextFollowUpOverdue: overdue,
    meetingDateLabel: fmt(row.meetingDate),
    meetingDateMs: row.meetingDate ? row.meetingDate.getTime() : null,
    nextAction: partnerNextAction(wi, now),
    logisticsComplete: wi.logisticsComplete ?? null,
    logisticsIncomplete: logisticsRelevant && wi.logisticsComplete === false,
    chapterLabel: row.chapter?.name ?? null,
    initials: initials(row.name),
    href: `/partners/${row.id}`,
  };
}

export async function loadPartnerWorkspace(
  scopeInput?: PartnerScope,
  now: Date = new Date()
): Promise<PartnerWorkspaceData> {
  const scope = scopeInput ?? (await getPartnerScope());

  const rows = await prisma.partner.findMany({
    where: partnerScopeWhere(scope),
    orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    select: WORKSPACE_SELECT,
    take: 500,
  });

  const ids = rows.map((r) => r.id);
  const noteRows = ids.length
    ? await prisma.partnerNote.findMany({
        where: { partnerId: { in: ids } },
        select: { id: true, partnerId: true, kind: true, createdAt: true, metadata: true },
      })
    : [];
  const notes: PartnerNoteMetricInput[] = noteRows.map((n) => ({
    id: n.id,
    partnerId: n.partnerId,
    kind: n.kind,
    createdAt: n.createdAt,
    metadata: (n.metadata ?? null) as Record<string, unknown> | null,
  }));

  const cards = rows.map((r) => toCard(r, now));
  const weekStart = startOfWeekUtc(now);

  const metricInputs = rows.map((r) => ({ ...workInput(r), createdAt: r.createdAt }));
  const metrics = summarizePartnerImpact(metricInputs, notes, now);
  const metricsThisWeek = summarizePartnerImpact(metricInputs, notes, now, { since: weekStart });

  // Pipeline lanes (board columns).
  const byLane = new Map<string, PartnerCardDTO[]>();
  for (const c of cards) {
    const list = byLane.get(c.lane) ?? [];
    list.push(c);
    byLane.set(c.lane, list);
  }
  const lanes: PartnerLaneColumn[] = CP_BOARD_LANES.map((lane) => ({
    lane,
    label: CP_LANE_LABELS[lane],
    hint: CP_LANE_HINTS[lane],
    tone: CP_LANE_TONE[lane],
    cards: byLane.get(lane) ?? [],
  }));

  // Operating queues. followUpsDue keys off the FOLLOW_UP_DUE lane so the queue,
  // the metric (metrics.followUpsDue), and the board column all agree.
  const followUpsDue = cards.filter((c) => c.lane === "FOLLOW_UP_DUE");
  const meetingsUpcoming = cards
    .filter((c) => c.lane === "MEETING" && c.meetingDateMs != null)
    .sort((a, b) => (a.meetingDateMs ?? 0) - (b.meetingDateMs ?? 0));
  const waitingOnResponse = cards.filter((c) => c.lane === "CONTACTED" || c.lane === "FOLLOW_UP_DUE");
  const logisticsIncomplete = cards.filter((c) => c.logisticsIncomplete);

  // Today's single most useful recommendation.
  let recommendedAction: string | null = null;
  if (followUpsDue.length > 0) {
    recommendedAction = `Send ${followUpsDue.length} follow-up${followUpsDue.length === 1 ? "" : "s"} that are due.`;
  } else if (logisticsIncomplete.length > 0) {
    recommendedAction = `Confirm logistics for ${logisticsIncomplete.length} partner${logisticsIncomplete.length === 1 ? "" : "s"}.`;
  } else if (cards.some((c) => c.lane === "INTERESTED")) {
    recommendedAction = "Schedule meetings with interested partners.";
  } else if (cards.some((c) => c.nextAction.key === "GENERATE_EMAIL")) {
    recommendedAction = "Send intro emails to your researched leads.";
  } else if (metrics.researched < 25) {
    recommendedAction = `Research more leads — aim for 25+ (you have ${metrics.researched}).`;
  }

  const chapter = scope.ledChapterId
    ? await prisma.chapter.findUnique({
        where: { id: scope.ledChapterId },
        select: { name: true, president: { select: { name: true } } },
      })
    : null;

  return {
    canManage: true,
    scopeLabel: scope.isLeadership ? "All chapters" : chapter?.name ?? "Your chapter",
    chapterId: scope.ledChapterId,
    presidentName: chapter?.president?.name ?? scope.user.name ?? null,
    metrics,
    metricsThisWeek,
    lanes,
    cards,
    priorities: {
      followUpsDue: metrics.followUpsDue,
      meetingsThisWeek: meetingsUpcoming.length,
      waitingOnResponse: metrics.noReply,
      logisticsIncomplete: metrics.logisticsIncomplete,
      issuesOver24h: metrics.issuesOver24h,
      recommendedAction,
    },
    lists: {
      followUpsDue,
      meetingsUpcoming,
      waitingOnResponse,
      logisticsIncomplete,
    },
  };
}
