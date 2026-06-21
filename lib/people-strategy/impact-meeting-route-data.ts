import "server-only";

import type { ActionViewer } from "./action-permissions";
import { listActionAssignableUsers } from "./action-queries";
import {
  attachImpactAgendaItemState,
  generateImpactMeetingAgendaText,
  generateImpactMeetingSummary,
  GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE,
  loadGlobalOperationsImpactAgendaForMeeting,
  type ImpactMeetingAgenda,
  type ImpactMeetingSummaryResult,
} from "./impact-meetings";
import {
  getMeetingById,
  mapMeetingToDetailDTO,
  type MeetingDetailDTO,
} from "./meetings-queries";
import type { PersonOption } from "@/components/people-strategy/new-meeting-drawer";

function personName(p: { name: string | null; email: string | null }): string {
  return p.name ?? p.email ?? "Unknown";
}

export type ImpactMeetingRouteData = {
  detail: MeetingDetailDTO;
  agenda: ImpactMeetingAgenda;
  agendaText: string;
  summary: ImpactMeetingSummaryResult;
  people: PersonOption[];
};

export async function loadImpactMeetingRouteData(input: {
  meetingId: string;
  viewer: ActionViewer;
  now?: Date;
}): Promise<ImpactMeetingRouteData | null> {
  const now = input.now ?? new Date();
  const [meeting, assignableUsers] = await Promise.all([
    getMeetingById(input.meetingId),
    listActionAssignableUsers(),
  ]);
  if (!meeting) return null;

  const detail = mapMeetingToDetailDTO(meeting, now);
  if (detail.meetingType !== GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE) {
    return null;
  }

  const agenda = attachImpactAgendaItemState(
    await loadGlobalOperationsImpactAgendaForMeeting({
      meetingId: meeting.id,
      meetingTitle: detail.title,
      meetingDate: meeting.date,
      viewer: input.viewer,
    }),
    detail.agenda.map((item) => ({
      id: item.id,
      status: item.status,
      notes: item.notes,
      sourceInitiativeId: item.sourceInitiativeId,
      sourceWorkstreamId: item.sourceWorkstreamId,
    }))
  );

  const summary = generateImpactMeetingSummary({
    agenda,
    decisions: detail.decisions.map((decision) => ({
      decision: decision.decision,
      decidedByName: decision.decidedBy?.name ?? null,
    })),
    followUps: detail.followUps.map((followUp) => ({
      title: followUp.title,
      ownerName: followUp.owner?.name ?? null,
      dueISO: followUp.dueISO,
      status: followUp.effectiveStatus === "completed" ? "COMPLETED" : "OPEN",
    })),
    notesText: detail.notesText,
  });

  return {
    detail,
    agenda,
    agendaText: generateImpactMeetingAgendaText(agenda),
    summary,
    people: assignableUsers.map((user) => ({ id: user.id, name: personName(user) })),
  };
}
