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

import { partnerCpLane, type PartnerWorkInput } from "@/lib/partners/pipeline";
import { isFollowUpDue } from "@/lib/partners/follow-up";

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

  for (const p of partners) {
    const lane = partnerCpLane(p, now);
    if (isFollowUpDue(p.nextFollowUpAt, now)) followUpsDue += 1;

    if (lane !== "RESEARCH") contacted += 1;
    else if (p.lastContactedAt) contacted += 1;

    switch (lane) {
      case "CONTACTED":
      case "FOLLOW_UP_DUE":
        noReply += 1;
        break;
      case "INTERESTED":
        interested += 1;
        responses += 1;
        break;
      case "MEETING":
        meetingsScheduled += 1;
        responses += 1;
        break;
      case "PROPOSAL":
        inFinalConversation += 1;
        responses += 1;
        break;
      case "CONFIRMED":
        confirmed += 1;
        responses += 1;
        if (p.logisticsComplete === true) logisticsComplete += 1;
        else logisticsIncomplete += 1;
        if (p.stage === "ACTIVE_PARTNERSHIP") activePartners += 1;
        break;
      case "CLOSED":
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
