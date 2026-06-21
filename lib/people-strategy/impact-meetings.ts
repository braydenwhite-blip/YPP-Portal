import type { MeetingAgendaStatus, WeeklyBriefStatus } from "@prisma/client";

import type { ActionViewer } from "./action-permissions";
import {
  dateKey,
  generateWeeklyTeamBriefs,
  loadWeeklyBriefWorkspace,
  startOfUTCWeek,
  type BriefDeliverableDTO,
  type WeeklyBriefTaskUpdateDTO,
  type WeeklyBriefWorkspace,
} from "./weekly-team-briefs";

export const GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID = "global-operations-impact";
export const GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE = "GLOBAL_OPERATIONS_IMPACT_PRESENTATION";

export const IMPACT_TEAMS = [
  {
    id: "tech",
    name: "Tech",
    defaultArea: "TECHNOLOGY",
    helperContext: [
      "Portal updates",
      "Bugs fixed",
      "Features shipped",
      "Data or automation work",
      "Testing or rollout blockers",
    ],
    suggestedDeliverables: [
      "Feature screenshots",
      "Rollout notes",
      "Bug tracker",
      "Testing checklist",
    ],
  },
  {
    id: "fundraising",
    name: "Fundraising",
    defaultArea: "FINANCE",
    helperContext: [
      "Outreach completed",
      "Donor or sponsor progress",
      "Materials created",
      "Responses received",
      "Decisions needed",
    ],
    suggestedDeliverables: [
      "Outreach list",
      "Email draft",
      "Sponsor tracker",
      "Pitch deck",
    ],
  },
  {
    id: "expansion",
    name: "Expansion",
    defaultArea: "CHAPTERS",
    helperContext: [
      "New areas contacted",
      "Parent or alumni outreach",
      "Chapter leads",
      "Partner conversations",
      "Blockers",
    ],
    suggestedDeliverables: [
      "Parent tracker",
      "Expansion tracker",
      "Outreach scripts",
      "Chapter list",
    ],
  },
  {
    id: "socials",
    name: "Socials",
    defaultArea: "MARKETING",
    helperContext: [
      "Posts created",
      "Posts scheduled",
      "Campaign results",
      "Needed approvals",
      "Upcoming content",
    ],
    suggestedDeliverables: [
      "Post drafts",
      "Content calendar",
      "Graphics",
      "Analytics screenshot",
    ],
  },
] as const;

export type ImpactTeamId = (typeof IMPACT_TEAMS)[number]["id"];
export type ImpactUpdateReadiness =
  | "missing"
  | "draft"
  | "submitted"
  | "needs_revision"
  | "pulled_into_agenda"
  | "discussed";

export type ImpactMeetingAgendaAction = {
  id: string;
  title: string;
  ownerName: string | null;
  status: string | null;
  deadlineISO: string | null;
  href: string;
};

export type ImpactMeetingAgendaSection = {
  teamId: ImpactTeamId;
  teamName: string;
  helperContext: string[];
  suggestedDeliverables: string[];
  defaultArea: string;
  briefId: string | null;
  briefHref: string;
  weekKey: string;
  status: WeeklyBriefStatus | "NOT_GENERATED";
  readiness: ImpactUpdateReadiness;
  presenterName: string | null;
  presenterId: string | null;
  completedThisWeek: string[];
  deliverables: Array<BriefDeliverableDTO & { actionTitle: string }>;
  stillInProgress: string[];
  blockers: string[];
  decisionsNeeded: string[];
  nextWeekCommitments: string[];
  relatedActions: ImpactMeetingAgendaAction[];
  overdueOrAtRiskActions: ImpactMeetingAgendaAction[];
  peopleIssues: string[];
  filesAndLinks: Array<BriefDeliverableDTO & { actionTitle: string }>;
  commentsOrNotes: string[];
  needsAttention: string[];
  agendaItemId: string | null;
  agendaItemStatus: MeetingAgendaStatus | null;
  agendaItemNotes: string | null;
};

export type ImpactMeetingAgenda = {
  meetingId: string;
  meetingTitle: string;
  meetingDateISO: string;
  weekKey: string;
  sections: ImpactMeetingAgendaSection[];
  submittedTeams: string[];
  missingTeams: string[];
  needsAttention: string[];
};

export type ImpactMeetingSummaryResult = {
  text: string;
  missingNotes: boolean;
  warnings: string[];
};

function textLines(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function fmtDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function hasUpdateContent(brief: WeeklyBriefWorkspace | null): boolean {
  if (!brief) return false;
  if (
    [
      brief.overallStatus,
      brief.lastCommitments,
      brief.blockersSummary,
      brief.decisionsNeeded,
      brief.nextActionsSummary,
      brief.nextCycleCommitments,
    ].some((value) => Boolean(value?.trim()))
  ) {
    return true;
  }
  return brief.taskUpdates.some((task) =>
    [
      task.statusNarrative,
      task.workCompleted,
      task.currentResult,
      task.remainingWork,
      task.blockerNote,
      task.decisionNeeded,
      task.nextAction,
    ].some((value) => Boolean(value?.trim())) || task.allDeliverables.length > 0
  );
}

function readinessForBrief(brief: WeeklyBriefWorkspace | null): ImpactUpdateReadiness {
  if (!brief || !hasUpdateContent(brief)) return "missing";
  if (brief.status === "DRAFT" || brief.status === "REOPENED") return "draft";
  if (brief.status === "SUBMITTED") return "submitted";
  if (brief.status === "PRESENTED") return "discussed";
  if (brief.status === "FINALIZED") return "discussed";
  return "submitted";
}

function actionForTask(task: WeeklyBriefTaskUpdateDTO): ImpactMeetingAgendaAction | null {
  if (!task.actionItemId) return null;
  return {
    id: task.actionItemId,
    title: task.taskTitle,
    ownerName: task.owner?.name ?? null,
    status: task.liveStatus,
    deadlineISO: task.deadlineISO,
    href: `/actions/${task.actionItemId}`,
  };
}

function taskIsOpen(task: WeeklyBriefTaskUpdateDTO): boolean {
  return task.liveStatus !== "COMPLETE" && task.liveStatus !== "DROPPED";
}

function taskIsOverdueOrAtRisk(task: WeeklyBriefTaskUpdateDTO, now: Date): boolean {
  if (!taskIsOpen(task)) return false;
  if (task.liveStatus === "OVERDUE" || task.liveStatus === "BLOCKED") return true;
  if (!task.deadlineISO) return false;
  return new Date(task.deadlineISO).getTime() < startOfUTCWeek(now).getTime();
}

function uniqueDeliverables(
  tasks: WeeklyBriefTaskUpdateDTO[]
): Array<BriefDeliverableDTO & { actionTitle: string }> {
  const byId = new Map<string, BriefDeliverableDTO & { actionTitle: string }>();
  for (const task of tasks) {
    const links = task.deliverables.length > 0 ? task.deliverables : task.allDeliverables;
    for (const link of links) {
      byId.set(link.id, { ...link, actionTitle: task.taskTitle });
    }
  }
  return Array.from(byId.values());
}

function inferPresenter(brief: WeeklyBriefWorkspace | null): {
  id: string | null;
  name: string | null;
} {
  if (!brief) return { id: null, name: null };
  const explicit =
    brief.taskUpdates.find((task) => task.officerMeetingPresenter)?.officerMeetingPresenter ??
    brief.taskUpdates.find((task) => task.teamMeetingPresenter)?.teamMeetingPresenter ??
    brief.teamLead ??
    brief.taskUpdates.find((task) => task.owner)?.owner ??
    null;
  return { id: explicit?.id ?? null, name: explicit?.name ?? null };
}

export function buildImpactMeetingAgendaSection(input: {
  team: (typeof IMPACT_TEAMS)[number];
  weekKey: string;
  brief: WeeklyBriefWorkspace | null;
  now?: Date;
}): ImpactMeetingAgendaSection {
  const now = input.now ?? new Date();
  const { team, weekKey, brief } = input;
  const presenter = inferPresenter(brief);
  const tasks = brief?.taskUpdates ?? [];
  const deliverables = uniqueDeliverables(tasks);
  const relatedActions = tasks
    .map(actionForTask)
    .filter((action): action is ImpactMeetingAgendaAction => Boolean(action));
  const overdueOrAtRiskActions = tasks
    .filter((task) => taskIsOverdueOrAtRisk(task, now))
    .map(actionForTask)
    .filter((action): action is ImpactMeetingAgendaAction => Boolean(action));
  const readiness = readinessForBrief(brief);
  const submitted = readiness === "submitted" || readiness === "pulled_into_agenda" || readiness === "discussed";

  const completedThisWeek = uniq([
    ...textLines(brief?.overallStatus),
    ...tasks.flatMap((task) => [
      ...textLines(task.workCompleted).map((line) => `${task.taskTitle}: ${line}`),
      ...textLines(task.currentResult).map((line) => `${task.taskTitle}: ${line}`),
    ]),
  ]);
  const stillInProgress = uniq([
    ...textLines(brief?.lastCommitments),
    ...tasks
      .filter(taskIsOpen)
      .flatMap((task) => [
        ...textLines(task.remainingWork).map((line) => `${task.taskTitle}: ${line}`),
        task.statusNarrative?.trim() ? `${task.taskTitle}: ${task.statusNarrative.trim()}` : "",
      ]),
  ]);
  const blockers = uniq([
    ...textLines(brief?.blockersSummary),
    ...tasks.flatMap((task) =>
      textLines(task.blockerNote).map((line) => `${task.taskTitle}: ${line}`)
    ),
  ]);
  const decisionsNeeded = uniq([
    ...textLines(brief?.decisionsNeeded),
    ...tasks.flatMap((task) =>
      textLines(task.decisionNeeded).map((line) => `${task.taskTitle}: ${line}`)
    ),
  ]);
  const nextWeekCommitments = uniq([
    ...textLines(brief?.nextActionsSummary),
    ...textLines(brief?.nextCycleCommitments),
    ...tasks.flatMap((task) =>
      textLines(task.nextAction).map((line) => `${task.taskTitle}: ${line}`)
    ),
  ]);
  const peopleIssues = tasks
    .filter((task) => task.escalationNeeded && !task.blockerNote?.trim())
    .map((task) => `${task.taskTitle}: escalation flagged`);
  const commentsOrNotes = uniq([
    ...textLines(brief?.teamObjective),
    ...tasks.flatMap((task) =>
      textLines(task.explanation).map((line) => `${task.taskTitle}: ${line}`)
    ),
  ]);

  const needsAttention: string[] = [];
  if (readiness === "missing") needsAttention.push(`${team.name} update missing`);
  if (readiness === "draft") needsAttention.push(`${team.name} update still in draft`);
  if (submitted && deliverables.length === 0) needsAttention.push(`${team.name} deliverable missing`);
  if (decisionsNeeded.length > 0) needsAttention.push(`${team.name} has a decision needed`);
  if (blockers.length > 0) needsAttention.push(`${team.name} blocker unresolved`);
  if (overdueOrAtRiskActions.length > 0) {
    needsAttention.push(`${team.name} has overdue or at-risk action work`);
  }
  for (const task of tasks) {
    if (task.nextAction?.trim() && !task.owner) {
      needsAttention.push(`${task.taskTitle} commitment has no owner`);
    }
    if (task.nextAction?.trim() && !task.deadlineISO) {
      needsAttention.push(`${task.taskTitle} commitment has no due date`);
    }
    if (task.officerReviewRequested && task.allDeliverables.length === 0) {
      needsAttention.push(`${task.taskTitle} requested officer review but has no deliverable link`);
    }
  }

  return {
    teamId: team.id,
    teamName: team.name,
    helperContext: [...team.helperContext],
    suggestedDeliverables: [...team.suggestedDeliverables],
    defaultArea: team.defaultArea,
    briefId: brief?.id ?? null,
    briefHref: `/operations/initiatives/${GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID}/teams/${team.id}/brief/${weekKey}`,
    weekKey,
    status: brief?.status ?? "NOT_GENERATED",
    readiness,
    presenterName: presenter.name,
    presenterId: presenter.id,
    completedThisWeek,
    deliverables,
    stillInProgress,
    blockers,
    decisionsNeeded,
    nextWeekCommitments,
    relatedActions,
    overdueOrAtRiskActions,
    peopleIssues,
    filesAndLinks: deliverables,
    commentsOrNotes,
    needsAttention: uniq(needsAttention),
    agendaItemId: null,
    agendaItemStatus: null,
    agendaItemNotes: null,
  };
}

export function buildImpactMeetingAgenda(input: {
  meetingId: string;
  meetingTitle: string;
  meetingDateISO: string;
  weekKey: string;
  sections: ImpactMeetingAgendaSection[];
}): ImpactMeetingAgenda {
  const submittedTeams = input.sections
    .filter((section) => section.readiness !== "missing" && section.readiness !== "draft")
    .map((section) => section.teamName);
  const missingTeams = input.sections
    .filter((section) => section.readiness === "missing" || section.readiness === "draft")
    .map((section) => section.teamName);
  const needsAttention = uniq(input.sections.flatMap((section) => section.needsAttention));
  return {
    meetingId: input.meetingId,
    meetingTitle: input.meetingTitle,
    meetingDateISO: input.meetingDateISO,
    weekKey: input.weekKey,
    sections: input.sections,
    submittedTeams,
    missingTeams,
    needsAttention,
  };
}

export async function loadGlobalOperationsImpactAgendaForMeeting(input: {
  meetingId: string;
  meetingTitle: string;
  meetingDate: Date;
  viewer: ActionViewer;
}): Promise<ImpactMeetingAgenda> {
  const weekStart = startOfUTCWeek(input.meetingDate);
  const weekKey = dateKey(weekStart);
  await generateWeeklyTeamBriefs(weekStart, {
    initiativeId: GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID,
    createdById: input.viewer.id,
    targetOfficerMeetingId: input.meetingId,
    forceEmptyTeam: true,
  });

  const workspaces = await Promise.all(
    IMPACT_TEAMS.map((team) =>
      loadWeeklyBriefWorkspace({
        initiativeId: GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID,
        workstreamId: team.id,
        weekStart,
        viewer: input.viewer,
        autoGenerate: false,
      })
    )
  );

  return buildImpactMeetingAgenda({
    meetingId: input.meetingId,
    meetingTitle: input.meetingTitle,
    meetingDateISO: input.meetingDate.toISOString(),
    weekKey,
    sections: IMPACT_TEAMS.map((team, index) =>
      buildImpactMeetingAgendaSection({
        team,
        weekKey,
        brief: workspaces[index],
        now: input.meetingDate,
      })
    ),
  });
}

export function attachImpactAgendaItemState(
  agenda: ImpactMeetingAgenda,
  items: Array<{
    id: string;
    status: MeetingAgendaStatus;
    notes: string | null;
    sourceInitiativeId: string | null;
    sourceWorkstreamId: string | null;
  }>
): ImpactMeetingAgenda {
  const byTeam = new Map(
    items
      .filter((item) => item.sourceInitiativeId === GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID)
      .map((item) => [item.sourceWorkstreamId, item])
  );
  return {
    ...agenda,
    sections: agenda.sections.map((section) => {
      const item = byTeam.get(section.teamId);
      if (!item) return section;
      const readiness =
        item.status === "DISCUSSED" || item.status === "CONVERTED"
          ? "discussed"
          : "pulled_into_agenda";
      return {
        ...section,
        readiness,
        agendaItemId: item.id,
        agendaItemStatus: item.status,
        agendaItemNotes: item.notes,
      };
    }),
  };
}

function bulletSection(title: string, lines: string[]): string | null {
  if (lines.length === 0) return null;
  return `### ${title}\n${lines.map((line) => `- ${line}`).join("\n")}`;
}

export function generateImpactMeetingAgendaText(agenda: ImpactMeetingAgenda): string {
  const header = `# Global Operations Impact Agenda - ${fmtDate(agenda.meetingDateISO)}`;
  const teamSections = agenda.sections.map((section) => {
    const lines = [
      `## ${section.teamName}`,
      `Presenter: ${section.presenterName ?? "Missing"}`,
      `Update status: ${section.readiness.replaceAll("_", " ")}`,
      section.readiness === "missing" || section.readiness === "draft"
        ? "- Missing update: request update or open the blank team update form."
        : null,
      bulletSection("Completed this week", section.completedThisWeek),
      bulletSection(
        "Deliverables to show",
        section.deliverables.map((link) => `${link.label} (${link.actionTitle}) - ${link.url}`)
      ),
      bulletSection("Decisions needed", section.decisionsNeeded),
      bulletSection("Blockers", section.blockers),
      bulletSection("Next week commitments", section.nextWeekCommitments),
      bulletSection(
        "Related actions",
        section.relatedActions.map((action) =>
          [action.title, action.ownerName ? `owner ${action.ownerName}` : null, action.status]
            .filter(Boolean)
            .join(" - ")
        )
      ),
      bulletSection(
        "Overdue or at-risk actions",
        section.overdueOrAtRiskActions.map((action) => action.title)
      ),
      bulletSection("Needs attention", section.needsAttention),
    ].filter((line): line is string => Boolean(line));
    return lines.join("\n");
  });

  const missing =
    agenda.missingTeams.length > 0
      ? `\n\n## Missing Updates\n${agenda.missingTeams.map((team) => `- ${team}`).join("\n")}`
      : "";
  return `${header}\n\nWeek of ${agenda.weekKey}${missing}\n\n${teamSections.join("\n\n")}`;
}

export function generateImpactMeetingSummary(input: {
  agenda: ImpactMeetingAgenda;
  notesText: string | null;
  decisions: Array<{ decision: string; decidedByName: string | null }>;
  followUps: Array<{
    title: string;
    ownerName: string | null;
    dueISO: string | null;
    status: string;
  }>;
}): ImpactMeetingSummaryResult {
  const { agenda } = input;
  const reviewedDeliverables = agenda.sections.flatMap((section) =>
    section.deliverables.map((link) => `${section.teamName}: ${link.label}`)
  );
  const blockers = agenda.sections.flatMap((section) =>
    section.blockers.map((blocker) => `${section.teamName}: ${blocker}`)
  );
  const carried = agenda.sections.flatMap((section) =>
    section.nextWeekCommitments.map((commitment) => `${section.teamName}: ${commitment}`)
  );
  const warnings = uniq([
    ...agenda.needsAttention,
    ...input.followUps
      .filter((followUp) => followUp.status !== "COMPLETED" && !followUp.ownerName)
      .map((followUp) => `${followUp.title} has no owner`),
    ...input.followUps
      .filter((followUp) => followUp.status !== "COMPLETED" && !followUp.dueISO)
      .map((followUp) => `${followUp.title} has no due date`),
  ]);

  const notes = input.notesText?.trim();
  const header = `# Impact Meeting Summary - ${fmtDate(agenda.meetingDateISO)}`;
  const blocks = [
    `## Teams Presented\n${
      agenda.submittedTeams.length
        ? agenda.submittedTeams.map((team) => `- ${team}`).join("\n")
        : "- None recorded"
    }`,
    agenda.missingTeams.length
      ? `## Teams Missing Updates\n${agenda.missingTeams.map((team) => `- ${team}`).join("\n")}`
      : null,
    reviewedDeliverables.length
      ? `## Deliverables Reviewed\n${reviewedDeliverables.map((item) => `- ${item}`).join("\n")}`
      : null,
    notes ? `## Main Discussion Points\n${notes}` : null,
    input.decisions.length
      ? `## Decisions Made\n${input.decisions
          .map((decision) =>
            decision.decidedByName
              ? `- ${decision.decision} - ${decision.decidedByName}`
              : `- ${decision.decision}`
          )
          .join("\n")}`
      : null,
    input.followUps.length
      ? `## Follow-up Actions Created\n${input.followUps
          .map((followUp) => {
            const meta = [
              followUp.ownerName ? `Owner: ${followUp.ownerName}` : "Owner missing",
              followUp.dueISO ? `Due: ${fmtDate(followUp.dueISO)}` : "Due date missing",
            ].join(", ");
            return `- ${followUp.title} (${meta})`;
          })
          .join("\n")}`
      : null,
    blockers.length ? `## Blockers\n${blockers.map((item) => `- ${item}`).join("\n")}` : null,
    carried.length
      ? `## Items Carried To Next Week\n${carried.map((item) => `- ${item}`).join("\n")}`
      : null,
  ].filter((block): block is string => Boolean(block));

  return {
    text: `${header}\n\n${blocks.join("\n\n")}`,
    missingNotes: !notes && input.decisions.length === 0 && input.followUps.length === 0,
    warnings,
  };
}
