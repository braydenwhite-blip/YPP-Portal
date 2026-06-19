"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AgendaItemKind } from "@prisma/client";

import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { toDateInputValue } from "@/lib/leadership-action-center/dates";
import { prisma } from "@/lib/prisma";
import { addFollowUp } from "./meetings-actions";
import {
  GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID,
  IMPACT_TEAMS,
  loadGlobalOperationsImpactAgendaForMeeting,
  type ImpactMeetingAgendaSection,
  type ImpactTeamId,
} from "./impact-meetings";

const MEETINGS_PATH = "/actions/meetings";

function ensureEnabled() {
  if (!isActionTrackerEnabled()) {
    throw new Error("Action Tracker is not enabled");
  }
}

function revalidateMeeting(meetingId: string) {
  revalidatePath(MEETINGS_PATH);
  revalidatePath(`${MEETINGS_PATH}/${meetingId}`);
}

function teamById(teamId: string) {
  return IMPACT_TEAMS.find((team) => team.id === teamId);
}

function agendaItemKind(section: ImpactMeetingAgendaSection): AgendaItemKind {
  if (section.blockers.length > 0) return "ESCALATED_BLOCKER";
  if (section.decisionsNeeded.length > 0) return "DECISION";
  if (section.deliverables.length > 0) return "DELIVERABLE_REVIEW";
  return "TEAM_STATUS";
}

function agendaItemDescription(section: ImpactMeetingAgendaSection) {
  const parts = [
    `Weekly Impact Update for ${section.teamName}.`,
    `Status: ${section.readiness.replaceAll("_", " ")}.`,
    section.completedThisWeek.length
      ? `Completed: ${section.completedThisWeek.slice(0, 4).join("; ")}.`
      : null,
    section.deliverables.length
      ? `Deliverables: ${section.deliverables.map((d) => d.label).join(", ")}.`
      : "Deliverables: none linked yet.",
    section.decisionsNeeded.length
      ? `Decisions needed: ${section.decisionsNeeded.join("; ")}.`
      : null,
    section.blockers.length ? `Blockers: ${section.blockers.join("; ")}.` : null,
    section.nextWeekCommitments.length
      ? `Next commitments: ${section.nextWeekCommitments.join("; ")}.`
      : null,
    section.needsAttention.length
      ? `Needs attention: ${section.needsAttention.join("; ")}.`
      : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join("\n");
}

const PullImpactAgendaSchema = z.object({
  meetingId: z.string().trim().min(1),
});

export async function pullGlobalImpactUpdatesIntoAgenda(
  input: z.input<typeof PullImpactAgendaSchema>
) {
  ensureEnabled();
  const viewer = await requireOfficer();
  const data = PullImpactAgendaSchema.parse(input);
  const meeting = await prisma.officerMeeting.findUnique({
    where: { id: data.meetingId },
    select: { id: true, title: true, date: true },
  });
  if (!meeting) throw new Error("Meeting not found");

  const agenda = await loadGlobalOperationsImpactAgendaForMeeting({
    meetingId: meeting.id,
    meetingTitle: meeting.title ?? "Global Operations Impact Meeting",
    meetingDate: meeting.date,
    viewer: {
      id: viewer.id,
      roles: viewer.roles,
      primaryRole: viewer.primaryRole,
      adminSubtypes: viewer.adminSubtypes,
    },
  });

  const max = await prisma.meetingAgendaItem.aggregate({
    where: { officerMeetingId: meeting.id },
    _max: { sortOrder: true },
  });
  let nextSortOrder = (max._max.sortOrder ?? -1) + 1;
  const pulledIds: string[] = [];

  for (const section of agenda.sections) {
    const existing = await prisma.meetingAgendaItem.findFirst({
      where: {
        officerMeetingId: meeting.id,
        sourceInitiativeId: GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID,
        sourceWorkstreamId: section.teamId,
      },
      select: { id: true },
    });
    const common = {
      title:
        section.readiness === "missing" || section.readiness === "draft"
          ? `${section.teamName} - Missing impact update`
          : `${section.teamName} Impact Update`,
      description: agendaItemDescription(section),
      ownerId: section.presenterId,
      presenterId: section.presenterId,
      itemKind: agendaItemKind(section),
      sourceInitiativeId: GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID,
      sourceWorkstreamId: section.teamId,
      briefId: section.briefId,
      requestedDecision: section.decisionsNeeded[0] ?? null,
      readinessState: section.readiness,
    };

    if (existing) {
      const item = await prisma.meetingAgendaItem.update({
        where: { id: existing.id },
        data: common,
        select: { id: true },
      });
      pulledIds.push(item.id);
    } else {
      const item = await prisma.meetingAgendaItem.create({
        data: {
          officerMeetingId: meeting.id,
          sortOrder: nextSortOrder,
          ...common,
        },
        select: { id: true },
      });
      nextSortOrder += 1;
      pulledIds.push(item.id);
    }
  }

  await prisma.officerMeeting.update({
    where: { id: meeting.id },
    data: { agendaText: null },
  });

  revalidateMeeting(meeting.id);
  return { pulledIds };
}

const CarryImpactTeamSchema = z.object({
  meetingId: z.string().trim().min(1),
  teamId: z.string().trim().min(1),
  prompt: z.string().trim().max(2000).optional(),
});

export async function carryImpactTeamToNextWeek(input: z.input<typeof CarryImpactTeamSchema>) {
  ensureEnabled();
  const viewer = await requireOfficer();
  const data = CarryImpactTeamSchema.parse(input);
  const team = teamById(data.teamId);
  if (!team) throw new Error("Unknown Impact team");

  const meeting = await prisma.officerMeeting.findUnique({
    where: { id: data.meetingId },
    select: { id: true, date: true, title: true },
  });
  if (!meeting) throw new Error("Meeting not found");

  const dueDate = new Date(meeting.date);
  dueDate.setUTCDate(dueDate.getUTCDate() + 7);
  const prompt =
    data.prompt?.trim() ||
    `Carry unresolved ${team.name} Impact Meeting items into next week's update.`;

  const existing = await prisma.teamPresentationExpectation.findFirst({
    where: {
      sourceMeetingId: meeting.id,
      initiativeId: GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID,
      workstreamId: team.id,
      status: "OPEN",
      prompt,
    },
    select: { id: true },
  });

  if (existing) {
    revalidateMeeting(meeting.id);
    return { id: existing.id, created: false };
  }

  const created = await prisma.teamPresentationExpectation.create({
    data: {
      initiativeId: GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID,
      workstreamId: team.id,
      kind: "SHOW_STATUS",
      prompt,
      requiredQuestion: `What changed for ${team.name}, what is still unresolved, and what must leadership decide next?`,
      dueDate,
      dueWeekStart: dueDate,
      returnToNextAgenda: true,
      sourceMeetingId: meeting.id,
      createdById: viewer.id,
    },
    select: { id: true },
  });

  revalidateMeeting(meeting.id);
  return { id: created.id, created: true };
}

const CreateImpactFollowUpActionSchema = z.object({
  meetingId: z.string().trim().min(1),
  teamId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(10_000).optional(),
  ownerId: z.string().trim().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  briefId: z.string().trim().optional(),
});

export async function createImpactFollowUpAction(
  input: z.input<typeof CreateImpactFollowUpActionSchema>
) {
  ensureEnabled();
  const data = CreateImpactFollowUpActionSchema.parse(input);
  const team = teamById(data.teamId);
  if (!team) throw new Error("Unknown Impact team");

  const meeting = await prisma.officerMeeting.findUnique({
    where: { id: data.meetingId },
    select: { id: true },
  });
  if (!meeting) throw new Error("Meeting not found");

  const created = await addFollowUp({
    meetingId: data.meetingId,
    title: data.title,
    description:
      data.description?.trim() ||
      `Follow-up action created from the ${team.name} Impact Meeting section.`,
    ownerId: data.ownerId,
    dueDate: toDateInputValue(new Date(`${data.dueDate}T00:00:00`)),
    priority: "HIGH",
    area: team.defaultArea,
    createAction: true,
    initiativeId: GLOBAL_OPERATIONS_IMPACT_INITIATIVE_ID,
    workstreamId: team.id,
    briefId: data.briefId,
  });

  revalidateMeeting(data.meetingId);
  return created;
}
