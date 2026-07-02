/**
 * Client-safe DTOs for the partner operating-room detail page (Partner Automation).
 */

import type { StatusTone } from "@/components/ui-v2/status-badge";
import type { CpLane, PartnerNextAction } from "@/lib/partners/pipeline";
import type { LogisticsReadiness } from "@/lib/partners/logistics";
import type { OutreachEmailContext } from "@/lib/partners/outreach-email";
import type { MeetingBriefContext } from "@/lib/partners/meeting-brief";

export type PartnerTimelineEntry = {
  id: string;
  kind: string;
  kindLabel: string;
  body: string;
  dateLabel: string;
  authorName: string | null;
  followUpLabel: string | null;
};

export type PartnerIssueDTO = {
  id: string;
  body: string;
  dateLabel: string;
  severity: string;
  escalated: boolean;
  overdue: boolean; // open > 24h
};

/** A class offering connected to this partner, as the operating room shows it. */
export type PartnerClassDTO = {
  id: string;
  title: string;
  statusLabel: string;
  students: number;
  instructorName: string | null;
};

/** An open tracker action linked to this partner (visibility-filtered upstream). */
export type PartnerActionDTO = {
  id: string;
  title: string;
  statusLabel: string;
  overdue: boolean;
  ownerName: string | null;
  href: string;
};

export type PartnerDetailDTO = {
  id: string;
  name: string;
  typeLabel: string | null;
  stage: string;
  stageLabel: string;
  lane: CpLane;
  laneLabel: string;
  laneTone: StatusTone;
  chapterId: string | null;
  chapterLabel: string | null;
  canManage: boolean;
  contact: {
    name: string | null;
    title: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    location: string | null;
  };
  notes: string | null;
  nextAction: PartnerNextAction;
  meeting: { dateLabel: string | null; isPast: boolean };
  nextFollowUp: { label: string | null; overdue: boolean };
  logistics: { relevant: boolean; readiness: LogisticsReadiness };
  timeline: PartnerTimelineEntry[];
  openIssues: PartnerIssueDTO[];
  classCount: number;
  /** Connected classes (newest first, capped) — the concrete programs behind classCount. */
  connectedClasses: PartnerClassDTO[];
  /** Open tracker actions linked to this partner, overdue first (capped). */
  openActions: PartnerActionDTO[];
  emailContext: OutreachEmailContext;
  meetingBriefContext: MeetingBriefContext;
};
