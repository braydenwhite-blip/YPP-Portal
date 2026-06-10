import { addDays, formatMonthDay, startOfDay } from "@/lib/leadership-action-center/dates";

import type {
  ActionLite,
  DecisionLite,
  MeetingFollowUpLite,
  MeetingLite,
  WeeklyOperationalDigest,
} from "./operational-digest";
import type { InitiativeSummary } from "./strategic-initiative-summary";

/**
 * YPP Weekly Execution OS - pure derivations.
 *
 * This module reshapes the existing Action + Meetings 360 digest and the
 * Strategic Initiatives summaries into the weekly officer-meeting loop:
 * agenda, loose ends, communications, recap, and initiative attention.
 * No DB, no React, no AI calls; the same inputs always produce the same output.
 */

export type WeeklyAgendaSectionId =
  | "urgent_blockers"
  | "initiatives"
  | "due_this_week"
  | "decisions_needed"
  | "follow_ups_not_captured"
  | "people_partner_issues"
  | "communication_needed";

export type CommunicationAudience =
  | "instructor"
  | "applicant"
  | "mentor"
  | "partner"
  | "parent"
  | "officer"
  | "other";

export type WeeklyExecutionAgendaItem = {
  id: string;
  sectionId: WeeklyAgendaSectionId;
  title: string;
  why: string;
  owner: string | null;
  dueISO: string | null;
  relatedMeetingTitle: string | null;
  relatedEntityLabel: string | null;
  href: string;
  suggestedDiscussionQuestion: string;
  suggestedNextAction: string;
  initiativeTitle?: string | null;
};

export type WeeklyExecutionAgendaSection = {
  id: WeeklyAgendaSectionId;
  title: string;
  items: WeeklyExecutionAgendaItem[];
};

export type MeetingLooseEnd = {
  id: string;
  title: string;
  kind: "decision" | "follow_up" | "missing_owner" | "missing_due_date" | "communication";
  why: string;
  owner: string | null;
  dueISO: string | null;
  meetingTitle: string | null;
  href: string;
  actionHref?: string;
};

export type CommunicationNeededItem = {
  id: string;
  title: string;
  audience: CommunicationAudience;
  contactLabel: string;
  why: string;
  suggestedMessage: string;
  owner: string | null;
  href: string;
  source: "action" | "meeting_follow_up" | "decision" | "initiative" | "recap";
};

export type InitiativeAttentionItem = {
  id: string;
  title: string;
  owner: string | null;
  status: string;
  priority: string;
  currentMilestone: string | null;
  why: string;
  href: string;
  suggestedDiscussionQuestion: string;
  suggestedNextAction: string;
};

export type WeeklyRecap = {
  draft: string;
  completed: ActionLite[];
  newActions: ActionLite[];
  overdue: ActionLite[];
  blocked: ActionLite[];
  decisions: DecisionLite[];
  meetings: MeetingLite[];
  openFollowUps: MeetingFollowUpLite[];
  topPriorities: WeeklyExecutionAgendaItem[];
  initiatives: InitiativeAttentionItem[];
};

export type WeeklyExecutionOS = {
  snapshot: {
    urgent: number;
    blocked: number;
    dueThisWeek: number;
    meetingsThisWeek: number;
    decisionsNeeded: number;
    communicationsNeeded: number;
    initiativesNeedingAttention: number;
  };
  agendaSections: WeeklyExecutionAgendaSection[];
  looseEnds: MeetingLooseEnd[];
  communications: CommunicationNeededItem[];
  initiativesNeedingAttention: InitiativeAttentionItem[];
  recap: WeeklyRecap;
};

const SECTION_TITLES: Record<WeeklyAgendaSectionId, string> = {
  urgent_blockers: "Urgent blockers",
  initiatives: "Initiatives needing attention",
  due_this_week: "Due this week",
  decisions_needed: "Decisions needed",
  follow_ups_not_captured: "Follow-ups not captured",
  people_partner_issues: "People / partner issues",
  communication_needed: "Communication needed",
};

function shortDate(iso: string | null): string {
  return iso ? formatMonthDay(new Date(iso)) : "no due date";
}

function clean(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  return text || null;
}

function ownerText(owner: string | null): string {
  return owner ?? "an owner";
}

export function deriveSuggestedDiscussionQuestion(input: {
  title: string;
  owner?: string | null;
  dueISO?: string | null;
  blocked?: boolean;
  missingContext?: boolean;
  initiativeTitle?: string | null;
}): string {
  if (!input.owner) return `Who should own "${input.title}" before the next meeting?`;
  if (!input.dueISO) return `What due date should ${input.owner} commit to for "${input.title}"?`;
  if (input.blocked) return `What decision or support would unblock "${input.title}"?`;
  if (input.initiativeTitle) return `What must happen this week to move ${input.initiativeTitle} forward?`;
  if (input.missingContext) return `What is the concrete next step for "${input.title}"?`;
  return `Is "${input.title}" still the right next move, and what changes this week?`;
}

function actionAgendaItem(
  action: ActionLite,
  sectionId: WeeklyAgendaSectionId,
  why: string
): WeeklyExecutionAgendaItem {
  return {
    id: `action:${sectionId}:${action.id}`,
    sectionId,
    title: action.title,
    why,
    owner: action.ownerName,
    dueISO: action.dueISO,
    relatedMeetingTitle: action.sourceMeetingTitle,
    relatedEntityLabel: action.relatedLabel,
    href: action.href,
    suggestedDiscussionQuestion: deriveSuggestedDiscussionQuestion({
      title: action.title,
      owner: action.ownerName,
      dueISO: action.dueISO,
      blocked: action.blocked,
      missingContext: !action.nextStep && !action.contextSummary,
    }),
    suggestedNextAction:
      action.nextStep ??
      (action.blocked
        ? `Ask ${ownerText(action.ownerName)} what support is needed to unblock it.`
        : `Confirm ${ownerText(action.ownerName)}'s next step and update the action.`),
  };
}

function decisionAgendaItem(decision: DecisionLite): WeeklyExecutionAgendaItem {
  return {
    id: `decision:${decision.id}`,
    sectionId: "decisions_needed",
    title: decision.decision,
    why: `Decision from ${decision.meetingTitle} has not become a tracked action yet.`,
    owner: decision.decidedByName,
    dueISO: decision.createdISO,
    relatedMeetingTitle: decision.meetingTitle,
    relatedEntityLabel: null,
    href: decision.href,
    suggestedDiscussionQuestion: `What action carries out this decision, and who owns it?`,
    suggestedNextAction: "Create a linked action from this decision before the meeting ends.",
  };
}

function followUpAgendaItem(followUp: MeetingFollowUpLite): WeeklyExecutionAgendaItem {
  return {
    id: `follow-up:${followUp.id}`,
    sectionId: "follow_ups_not_captured",
    title: followUp.title,
    why: `Follow-up from ${followUp.meetingTitle} is still not tracked as an action.`,
    owner: followUp.ownerName,
    dueISO: followUp.dueISO,
    relatedMeetingTitle: followUp.meetingTitle,
    relatedEntityLabel: followUp.relatedLabel,
    href: followUp.href,
    suggestedDiscussionQuestion: deriveSuggestedDiscussionQuestion({
      title: followUp.title,
      owner: followUp.ownerName,
      dueISO: followUp.dueISO,
    }),
    suggestedNextAction: `Convert this follow-up into a tracked action${followUp.ownerName ? ` for ${followUp.ownerName}` : ""}.`,
  };
}

function meetingAgendaItem(meeting: MeetingLite): WeeklyExecutionAgendaItem {
  return {
    id: `meeting:${meeting.id}`,
    sectionId: "due_this_week",
    title: meeting.title,
    why: `Upcoming ${meeting.categoryLabel.toLowerCase()} meeting needs a clean agenda.`,
    owner: meeting.facilitatorName,
    dueISO: meeting.startISO,
    relatedMeetingTitle: meeting.title,
    relatedEntityLabel: meeting.relatedLabel,
    href: meeting.href,
    suggestedDiscussionQuestion: `What decisions, owners, and follow-ups must this meeting produce?`,
    suggestedNextAction: "Confirm the agenda and make sure every follow-up becomes an action.",
  };
}

export function deriveInitiativeHealthReason(initiative: InitiativeSummary): string {
  const reasons = [
    initiative.healthExplanation.reasons?.[0],
    initiative.risk.factors[0]?.label,
    initiative.counts.overdueActions > 0
      ? `${initiative.counts.overdueActions} overdue action${initiative.counts.overdueActions === 1 ? "" : "s"}`
      : null,
    initiative.counts.blockedActions > 0
      ? `${initiative.counts.blockedActions} blocked action${initiative.counts.blockedActions === 1 ? "" : "s"}`
      : null,
    !initiative.ownerDeclared ? "no clear owner" : null,
  ].filter(Boolean);
  return clean(reasons[0]) ?? initiative.healthExplanation.headline;
}

export function deriveInitiativesNeedingAttention(
  initiatives: InitiativeSummary[] = [],
  now: Date = new Date()
): InitiativeSummary[] {
  const soon = addDays(now, 14).getTime();
  return [...initiatives]
    .filter((i) => {
      if (i.health.level === "completed" || i.health.level === "archived") return false;
      const targetSoon =
        i.targetDateISO != null && new Date(i.targetDateISO).getTime() <= soon;
      return (
        i.health.level === "critical" ||
        i.health.level === "at_risk" ||
        i.health.level === "drifting" ||
        i.priority === "flagship" ||
        targetSoon ||
        i.counts.overdueActions > 0 ||
        i.counts.blockedActions > 0 ||
        i.counts.openFollowUps > 0 ||
        i.counts.decisionsWithoutAction > 0 ||
        !i.ownerDeclared ||
        i.recommendations.length > 0
      );
    })
    .sort(
      (a, b) =>
        b.risk.score - a.risk.score ||
        b.counts.overdueActions - a.counts.overdueActions ||
        b.priorityWeight - a.priorityWeight ||
        a.title.localeCompare(b.title)
    );
}

export function deriveInitiativeAgendaItems(
  initiatives: InitiativeSummary[] = [],
  now: Date = new Date()
): InitiativeAttentionItem[] {
  return deriveInitiativesNeedingAttention(initiatives, now).map((initiative) => {
    const currentMilestone =
      initiative.milestones.find((m) => m.status !== "complete")?.title ?? null;
    const rec = initiative.recommendations[0];
    const why = deriveInitiativeHealthReason(initiative);
    return {
      id: `initiative:${initiative.id}`,
      title: initiative.title,
      owner: initiative.owner,
      status: initiative.health.label,
      priority: initiative.priorityLabel,
      currentMilestone,
      why,
      href: initiative.href,
      suggestedDiscussionQuestion:
        initiative.counts.blockedActions > 0
          ? `What leadership decision would unblock ${initiative.title}?`
          : !initiative.ownerDeclared
            ? `Who is accountable for ${initiative.title} this week?`
            : `What must happen this week to move ${initiative.title} forward?`,
      suggestedNextAction:
        rec?.title && rec.detail
          ? `${rec.title}: ${rec.detail}`
          : currentMilestone
            ? `Move the next milestone: ${currentMilestone}.`
            : "Define the next milestone and owner.",
    };
  });
}

function initiativeToAgendaItem(item: InitiativeAttentionItem): WeeklyExecutionAgendaItem {
  return {
    id: item.id,
    sectionId: "initiatives",
    title: item.title,
    why: item.why,
    owner: item.owner,
    dueISO: null,
    relatedMeetingTitle: null,
    relatedEntityLabel: null,
    href: item.href,
    suggestedDiscussionQuestion: item.suggestedDiscussionQuestion,
    suggestedNextAction: item.suggestedNextAction,
    initiativeTitle: item.title,
  };
}

export function deriveCommunicationAudience(value: {
  title: string;
  relatedType?: string | null;
  relatedLabel?: string | null;
  areaLabel?: string | null;
}): CommunicationAudience {
  const haystack = `${value.title} ${value.relatedType ?? ""} ${value.relatedLabel ?? ""} ${value.areaLabel ?? ""}`.toLowerCase();
  if (haystack.includes("instructor") || haystack.includes("curriculum")) return "instructor";
  if (haystack.includes("applicant") || haystack.includes("application")) return "applicant";
  if (haystack.includes("mentor") || haystack.includes("mentee")) return "mentor";
  if (haystack.includes("partner") || haystack.includes("school") || value.relatedType === "PARTNER") return "partner";
  if (haystack.includes("parent") || haystack.includes("family")) return "parent";
  if (haystack.includes("recap") || haystack.includes("officer")) return "officer";
  return "other";
}

function suggestedMessage(input: {
  title: string;
  audience: CommunicationAudience;
  owner: string | null;
  relatedLabel?: string | null;
}): string {
  const subject = input.relatedLabel ?? "this";
  switch (input.audience) {
    case "instructor":
      return `Hi, quick update on ${subject}: ${input.title}. Can you confirm the next step and any timing constraints?`;
    case "partner":
      return `Hi, following up on ${subject}: ${input.title}. What do you need from YPP to keep this moving?`;
    case "applicant":
      return `Hi, thanks for your patience. We are following up on ${subject}: ${input.title}. We will confirm next steps shortly.`;
    case "mentor":
      return `Hi, can you send a quick update on ${subject}? The current follow-up is: ${input.title}.`;
    case "parent":
      return `Hi, sharing a quick YPP update on ${subject}: ${input.title}. Please reply with any questions.`;
    case "officer":
      return `Hi team, please review: ${input.title}. ${input.owner ? `${input.owner} is the current owner.` : "We need to assign an owner."}`;
    default:
      return `Hi, following up on ${subject}: ${input.title}. Please confirm the next step.`;
  }
}

export function deriveCommunicationNeeded(input: {
  digest: WeeklyOperationalDigest;
  initiatives?: InitiativeSummary[];
}): CommunicationNeededItem[] {
  const out: CommunicationNeededItem[] = [];
  const push = (item: CommunicationNeededItem) => {
    if (!out.some((existing) => existing.id === item.id)) out.push(item);
  };

  for (const action of [...input.digest.triage.blocked, ...input.digest.triage.overdue]) {
    const text = `${action.title} ${action.nextStep ?? ""} ${action.contextSummary ?? ""}`.toLowerCase();
    if (!/(email|message|send|confirm|follow up|follow-up|ask|clarify|reply|communicat)/.test(text)) continue;
    const audience = deriveCommunicationAudience({
      title: action.title,
      relatedType: action.relatedType,
      relatedLabel: action.relatedLabel,
    });
    push({
      id: `action:${action.id}`,
      title: action.title,
      audience,
      contactLabel: action.relatedLabel ?? action.ownerName ?? audience,
      why: action.blocked ? "Blocked work likely needs an outside response." : "Overdue work mentions a communication step.",
      suggestedMessage: suggestedMessage({
        title: action.title,
        audience,
        owner: action.ownerName,
        relatedLabel: action.relatedLabel,
      }),
      owner: action.ownerName,
      href: action.href,
      source: "action",
    });
  }

  for (const followUp of input.digest.unresolvedMeetingFollowUps) {
    const audience = deriveCommunicationAudience({
      title: followUp.title,
      relatedType: followUp.relatedType,
      relatedLabel: followUp.relatedLabel,
      areaLabel: followUp.areaLabel,
    });
    if (
      audience === "other" &&
      !/(email|message|send|confirm|follow up|follow-up|ask|clarify|reply|communicat)/i.test(followUp.title)
    ) {
      continue;
    }
    push({
      id: `follow-up:${followUp.id}`,
      title: followUp.title,
      audience,
      contactLabel: followUp.relatedLabel ?? followUp.ownerName ?? audience,
      why: `Meeting follow-up from ${followUp.meetingTitle} still needs outreach or confirmation.`,
      suggestedMessage: suggestedMessage({
        title: followUp.title,
        audience,
        owner: followUp.ownerName,
        relatedLabel: followUp.relatedLabel,
      }),
      owner: followUp.ownerName,
      href: followUp.href,
      source: "meeting_follow_up",
    });
  }

  for (const initiative of input.initiatives ?? []) {
    const text = `${initiative.title} ${initiative.description} ${initiative.healthExplanation.headline}`.toLowerCase();
    if (!/(partner|instructor|applicant|parent|communication|curriculum|recap)/.test(text)) continue;
    const attention = deriveInitiativesNeedingAttention([initiative]);
    if (attention.length === 0) continue;
    const audience = deriveCommunicationAudience({ title: text, areaLabel: initiative.areaLabel });
    push({
      id: `initiative:${initiative.id}`,
      title: initiative.title,
      audience,
      contactLabel: audience === "officer" ? "YPP officers" : initiative.areaLabel,
      why: `Initiative needs attention: ${deriveInitiativeHealthReason(initiative)}`,
      suggestedMessage: suggestedMessage({
        title: initiative.recommendations[0]?.title ?? initiative.healthExplanation.headline,
        audience,
        owner: initiative.owner,
        relatedLabel: initiative.title,
      }),
      owner: initiative.owner,
      href: initiative.href,
      source: "initiative",
    });
  }

  push({
    id: "weekly-recap",
    title: "Send weekly officer recap",
    audience: "officer",
    contactLabel: "YPP officers",
    why: "The weekly recap keeps leadership aligned after the meeting.",
    suggestedMessage: "Hi team, here is the weekly YPP operations recap. Please update your action items and flag anything blocked.",
    owner: null,
    href: "/operations/weekly-execution",
    source: "recap",
  });

  return out;
}

export function deriveMeetingLooseEnds(digest: WeeklyOperationalDigest): MeetingLooseEnd[] {
  const out: MeetingLooseEnd[] = [];
  for (const decision of digest.decisionsNeedingAction) {
    out.push({
      id: `decision:${decision.id}`,
      title: decision.decision,
      kind: "decision",
      why: "Decision has not been converted into a tracked action.",
      owner: decision.decidedByName,
      dueISO: decision.createdISO,
      meetingTitle: decision.meetingTitle,
      href: decision.href,
    });
  }
  for (const followUp of digest.unresolvedMeetingFollowUps) {
    out.push({
      id: `follow-up:${followUp.id}`,
      title: followUp.title,
      kind: !followUp.ownerName
        ? "missing_owner"
        : !followUp.dueISO
          ? "missing_due_date"
          : "follow_up",
      why: !followUp.ownerName
        ? "Follow-up has no owner."
        : !followUp.dueISO
          ? "Follow-up has no due date."
          : "Follow-up has not been converted into an action.",
      owner: followUp.ownerName,
      dueISO: followUp.dueISO,
      meetingTitle: followUp.meetingTitle,
      href: followUp.href,
    });
  }
  return out;
}

export function deriveWeeklyAgenda(input: {
  digest: WeeklyOperationalDigest;
  initiatives?: InitiativeSummary[];
  now?: Date;
}): WeeklyExecutionAgendaSection[] {
  const now = input.now ?? new Date();
  const initiativeItems = deriveInitiativeAgendaItems(input.initiatives ?? [], now);
  const groups: Record<WeeklyAgendaSectionId, WeeklyExecutionAgendaItem[]> = {
    urgent_blockers: [
      ...input.digest.triage.overdue.map((a) =>
        actionAgendaItem(a, "urgent_blockers", `Overdue since ${shortDate(a.dueISO)}.`)
      ),
      ...input.digest.triage.blocked.map((a) =>
        actionAgendaItem(a, "urgent_blockers", a.nextStep ?? "Blocked and needs leadership support.")
      ),
      ...input.digest.triage.unassigned.map((a) =>
        actionAgendaItem(a, "urgent_blockers", "No executor is assigned.")
      ),
    ],
    initiatives: initiativeItems.map(initiativeToAgendaItem),
    due_this_week: [
      ...input.digest.triage.dueSoon.map((a) =>
        actionAgendaItem(a, "due_this_week", `Due this week (${shortDate(a.dueISO)}).`)
      ),
      ...input.digest.upcomingMeetings.map(meetingAgendaItem),
    ],
    decisions_needed: input.digest.decisionsNeedingAction.map(decisionAgendaItem),
    follow_ups_not_captured: input.digest.unresolvedMeetingFollowUps.map(followUpAgendaItem),
    people_partner_issues: [
      ...input.digest.criticalEntities.map((entity) => ({
        id: `entity:${entity.refKey}`,
        sectionId: "people_partner_issues" as const,
        title: entity.label,
        why: entity.health.reasons[0] ?? `${entity.label} needs leadership attention.`,
        owner: null,
        dueISO: null,
        relatedMeetingTitle: null,
        relatedEntityLabel: entity.typeLabel,
        href: entity.href ?? "/operations/command-center",
        suggestedDiscussionQuestion: `What support does ${entity.label} need this week?`,
        suggestedNextAction: entity.health.reasons[0]
          ? `Assign a next step for ${entity.health.reasons[0]}.`
          : "Assign a next step.",
      })),
    ],
    communication_needed: [],
  };

  groups.communication_needed = deriveCommunicationNeeded(input).map((item) => ({
    id: `communication:${item.id}`,
    sectionId: "communication_needed",
    title: item.title,
    why: item.why,
    owner: item.owner,
    dueISO: null,
    relatedMeetingTitle: null,
    relatedEntityLabel: item.contactLabel,
    href: item.href,
    suggestedDiscussionQuestion: `What should we communicate to ${item.contactLabel}, and who sends it?`,
    suggestedNextAction: item.suggestedMessage,
  }));

  return (Object.keys(SECTION_TITLES) as WeeklyAgendaSectionId[]).map((id) => ({
    id,
    title: SECTION_TITLES[id],
    items: groups[id].slice(0, id === "communication_needed" ? 6 : 8),
  }));
}

function bulletLines(items: string[], empty: string): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : [`- ${empty}`];
}

export function deriveWeeklyRecap(input: {
  digest: WeeklyOperationalDigest;
  agendaSections: WeeklyExecutionAgendaSection[];
  initiatives?: InitiativeSummary[];
  now?: Date;
}): WeeklyRecap {
  const digest = input.digest;
  const initiatives = deriveInitiativeAgendaItems(input.initiatives ?? [], input.now);
  const topPriorities = input.agendaSections.flatMap((s) => s.items).slice(0, 6);
  const newActions = digest.newActionsThisWeek ?? [];
  const completed = digest.recentlyCompletedActions;
  const overdue = digest.triage.overdue;
  const blocked = digest.triage.blocked;
  const decisions = digest.decisionsNeedingAction;
  const meetings = digest.recentMeetings;
  const openFollowUps = digest.unresolvedMeetingFollowUps;

  const lines: string[] = [
    "Hi team,",
    "",
    "Here is the weekly YPP operations recap.",
    "",
    "Wins / completed:",
    ...bulletLines(completed.map((a) => `${a.title}${a.ownerName ? ` (${a.ownerName})` : ""}`), "No completed actions were logged this week."),
    "",
    "Needs attention:",
    ...bulletLines(
      [...overdue, ...blocked].slice(0, 8).map((a) => `${a.title} - ${a.blocked ? "blocked" : `overdue ${a.daysOverdue}d`}`),
      "No overdue or blocked actions are currently surfaced."
    ),
    "",
    "Initiative updates:",
    ...bulletLines(
      initiatives.slice(0, 6).map((i) => {
        const milestone = i.currentMilestone ? ` Next milestone: ${i.currentMilestone}.` : "";
        return `${i.title}: ${i.why}.${milestone} Next step: ${i.suggestedNextAction}`;
      }),
      "No initiatives need leadership attention this week."
    ),
    "",
    "Decisions made / needing action:",
    ...bulletLines(decisions.map((d) => `${d.decision} - convert to an action from ${d.meetingTitle}.`), "No unconverted decisions are currently surfaced."),
    "",
    "New action items:",
    ...bulletLines(newActions.map((a) => `${a.title}${a.ownerName ? ` - ${a.ownerName}` : ""}`), "No new actions were created this week."),
    "",
    "Upcoming this week:",
    ...bulletLines(digest.upcomingMeetings.map((m) => `${m.title} - ${shortDate(m.startISO)}`), "No upcoming meetings are scheduled in the current window."),
    "",
    "Please update your action items and flag anything blocked.",
  ];

  return {
    draft: lines.join("\n"),
    completed,
    newActions,
    overdue,
    blocked,
    decisions,
    meetings,
    openFollowUps,
    topPriorities,
    initiatives,
  };
}

export function deriveWeeklyExecutionOS(input: {
  digest: WeeklyOperationalDigest;
  initiatives?: InitiativeSummary[];
  now?: Date;
}): WeeklyExecutionOS {
  const now = input.now ?? new Date();
  const agendaSections = deriveWeeklyAgenda({ ...input, now });
  const communications = deriveCommunicationNeeded(input);
  const looseEnds = deriveMeetingLooseEnds(input.digest);
  const initiativesNeedingAttention = deriveInitiativeAgendaItems(input.initiatives ?? [], now);
  const urgent = input.digest.triage.overdue.length + input.digest.triage.blocked.length;
  return {
    snapshot: {
      urgent,
      blocked: input.digest.triage.blocked.length,
      dueThisWeek: input.digest.triage.dueSoon.length,
      meetingsThisWeek: input.digest.counts.meetingsThisWeek,
      decisionsNeeded: input.digest.decisionsNeedingAction.length,
      communicationsNeeded: communications.length,
      initiativesNeedingAttention: initiativesNeedingAttention.length,
    },
    agendaSections,
    looseEnds,
    communications,
    initiativesNeedingAttention,
    recap: deriveWeeklyRecap({
      digest: input.digest,
      agendaSections,
      initiatives: input.initiatives,
      now,
    }),
  };
}

export function isDueWithinDays(iso: string | null, now: Date, days: number): boolean {
  if (!iso) return false;
  const due = startOfDay(new Date(iso)).getTime();
  const start = startOfDay(now).getTime();
  return due >= start && due <= startOfDay(addDays(now, days)).getTime();
}
