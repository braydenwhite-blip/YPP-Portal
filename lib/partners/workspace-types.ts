/**
 * Client-safe DTOs for the Partner Command Workspace (Partner Automation).
 * No prisma / server-only imports, so the client board + cards import these
 * types without dragging server modules into the browser bundle.
 */

import type { StatusTone } from "@/components/ui-v2/status-badge";
import type { CpLane, PartnerNextAction } from "@/lib/partners/pipeline";
import type { PartnerImpactMetrics } from "@/lib/partners/metrics";

export type PartnerCardDTO = {
  id: string;
  name: string;
  typeLabel: string | null;
  stageLabel: string;
  lane: CpLane;
  laneLabel: string;
  laneTone: StatusTone;
  contactName: string | null;
  contactEmail: string | null;
  contactLine: string | null;
  lastContactedLabel: string | null;
  nextFollowUpLabel: string | null;
  nextFollowUpOverdue: boolean;
  meetingDateLabel: string | null;
  /** Raw meeting time (epoch ms) for chronological sorting; null if unscheduled. */
  meetingDateMs: number | null;
  nextAction: PartnerNextAction;
  logisticsComplete: boolean | null;
  logisticsIncomplete: boolean;
  chapterLabel: string | null;
  initials: string;
  href: string;
};

export type PartnerLaneColumn = {
  lane: CpLane;
  label: string;
  hint: string;
  tone: StatusTone;
  cards: PartnerCardDTO[];
};

export type PartnerWorkspaceData = {
  canManage: boolean;
  /** "Scarsdale Chapter" for a CP, "All chapters" for leadership. */
  scopeLabel: string;
  chapterId: string | null;
  presidentName: string | null;
  metrics: PartnerImpactMetrics;
  metricsThisWeek: PartnerImpactMetrics;
  lanes: PartnerLaneColumn[];
  cards: PartnerCardDTO[];
  priorities: {
    followUpsDue: number;
    meetingsThisWeek: number;
    waitingOnResponse: number;
    logisticsIncomplete: number;
    issuesOver24h: number;
    recommendedAction: string | null;
  };
  lists: {
    followUpsDue: PartnerCardDTO[];
    meetingsUpcoming: PartnerCardDTO[];
    waitingOnResponse: PartnerCardDTO[];
    logisticsIncomplete: PartnerCardDTO[];
  };
};
