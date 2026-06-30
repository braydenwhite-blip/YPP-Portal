/**
 * Chapter Impact Meeting metrics (Partner Automation, Phase 1).
 *
 * Generates the partner numbers a Chapter President brings to Chapter Impact
 * Meetings — directly from Partner + PartnerNote data, never hand-typed. Pure
 * aggregation over plain input shapes so the loader maps prisma rows in and the
 * tests pass fixtures in. State metrics are point-in-time; event metrics
 * (emails, meetings, check-ins) honor an optional `since` window for the
 * "This week" toggle.
 */

import { isPartnerFollowUpDue, type PartnerWorkInput } from "@/lib/partners/pipeline";
import { asPartnerStage } from "@/lib/partners-constants";

export type PartnerMetricInput = PartnerWorkInput & {
  createdAt: Date;
};

export type PartnerNoteMetricInput = {
  id: string;
  partnerId: string;
  kind: string;
  createdAt: Date;
  metadata?: Record<string, unknown> | null;
};

export type PartnerImpactMetrics = {
  // Weeks 1–2: research & outreach
  researched: number;
  contacted: number;
  responses: number;
  noReply: number;
  interested: number;
  meetingsScheduled: number;
  followUpsDue: number;
  emailsSent: number;
  // Weeks 3–4: meetings & outcomes
  meetingsCompleted: number;
  outcomesByType: Record<string, number>;
  // Weeks 5–6: closing & logistics
  inFinalConversation: number;
  confirmed: number;
  closed: number;
  logisticsComplete: number;
  logisticsIncomplete: number;
  // Weeks 9–10: active operations
  activePartners: number;
  checkInsThisWeek: number;
  issuesUnresolved: number;
  issuesOver24h: number;
  escalations: number;
  // Roll-up
  blockers: number;
};

const DAY_MS = 86_400_000;

export function summarizePartnerImpact(
  partners: PartnerMetricInput[],
  notes: PartnerNoteMetricInput[],
  now: Date,
  opts: { since?: Date } = {}
): PartnerImpactMetrics {
  const since = opts.since ?? null;
  const inWindow = (n: PartnerNoteMetricInput) => !since || n.createdAt.getTime() >= since.getTime();

  // --- Partner-state metrics (point-in-time) --------------------------------
  let contacted = 0;
  let responses = 0;
  let noReply = 0;
  let interested = 0;
  let meetingsScheduled = 0;
  let followUpsDue = 0;
  let inFinalConversation = 0;
  let confirmed = 0;
  let closed = 0;
  let logisticsComplete = 0;
  let logisticsIncomplete = 0;
  let activePartners = 0;

  // Counts key off the underlying STAGE, not the board lane, so a partner who
  // replied (RESPONDED) is always counted as a response even when their
  // follow-up is overdue (which would put them in the FOLLOW_UP_DUE lane).
  for (const p of partners) {
    const stage = asPartnerStage(p.stage);
    if (isPartnerFollowUpDue(p, now)) followUpsDue += 1;

    const beyondResearch = stage !== "NOT_STARTED" && stage !== "RESEARCHING";
    if (beyondResearch || p.lastContactedAt) contacted += 1;

    switch (stage) {
      case "REACHED_OUT":
        noReply += 1;
        break;
      case "RESPONDED":
        responses += 1;
        interested += 1;
        break;
      case "MEETING_SCHEDULED":
        responses += 1;
        meetingsScheduled += 1;
        break;
      case "NEEDS_PROPOSAL":
      case "PROPOSAL_SENT":
      case "NEGOTIATING":
        responses += 1;
        inFinalConversation += 1;
        break;
      case "ACTIVE_PARTNERSHIP":
      case "COMPLETED":
        responses += 1;
        confirmed += 1;
        if (p.logisticsComplete === true) logisticsComplete += 1;
        else logisticsIncomplete += 1;
        if (stage === "ACTIVE_PARTNERSHIP") activePartners += 1;
        break;
      case "PAUSED":
      case "NOT_A_FIT":
        closed += 1;
        break;
      default:
        break;
    }
  }

  // --- Event metrics (from the timeline, windowed by `since`) ----------------
  let emailsSent = 0;
  let meetingsCompleted = 0;
  let checkInsThisWeek = 0;
  const outcomesByType: Record<string, number> = {};
  const resolvedIssueIds = new Set<string>();
  const issueNotes: PartnerNoteMetricInput[] = [];

  for (const n of notes) {
    if (n.kind === "ISSUE_RESOLVED") {
      const ref = n.metadata?.resolvesNoteId;
      if (typeof ref === "string") resolvedIssueIds.add(ref);
    }
    if (n.kind === "ISSUE") issueNotes.push(n);

    if (!inWindow(n)) continue;
    if (n.kind === "OUTREACH_SENT" || n.kind === "FOLLOW_UP_SENT") emailsSent += 1;
    if (n.kind === "MEETING_OUTCOME") {
      meetingsCompleted += 1;
      const outcome = typeof n.metadata?.outcome === "string" ? n.metadata.outcome : "OTHER";
      outcomesByType[outcome] = (outcomesByType[outcome] ?? 0) + 1;
    }
    if (n.kind === "CHECK_IN") checkInsThisWeek += 1;
  }

  // --- Issues (current state, not windowed) ---------------------------------
  const unresolved = issueNotes.filter((n) => !resolvedIssueIds.has(n.id));
  const issuesUnresolved = unresolved.length;
  const issuesOver24h = unresolved.filter((n) => now.getTime() - n.createdAt.getTime() > DAY_MS).length;
  const escalations = unresolved.filter((n) => n.metadata?.escalated === true).length;

  return {
    researched: partners.length,
    contacted,
    responses,
    noReply,
    interested,
    meetingsScheduled,
    followUpsDue,
    emailsSent,
    meetingsCompleted,
    outcomesByType,
    inFinalConversation,
    confirmed,
    closed,
    logisticsComplete,
    logisticsIncomplete,
    activePartners,
    checkInsThisWeek,
    issuesUnresolved,
    issuesOver24h,
    escalations,
    blockers: logisticsIncomplete + issuesOver24h,
  };
}
