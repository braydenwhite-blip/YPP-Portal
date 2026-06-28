/**
 * Partner Meeting Workspace — checklist helpers (client-safe).
 * Every meeting should carry: agenda, proposal, notes, follow-up tasks,
 * next steps, assigned owner, linked partner, meeting outcome.
 */
import type { MeetingDetail } from "./meeting-types";

export type MeetingWorkspaceField =
  | "agenda"
  | "proposal"
  | "notes"
  | "followUps"
  | "nextSteps"
  | "owner"
  | "partner"
  | "outcome";

export const MEETING_WORKSPACE_FIELDS: Array<{
  key: MeetingWorkspaceField;
  label: string;
  hint: string;
}> = [
  { key: "agenda", label: "Agenda", hint: "Outline or structured agenda items" },
  { key: "proposal", label: "Proposal", hint: "Pre-read / proposal material" },
  { key: "notes", label: "Meeting notes", hint: "Discussion captured during the session" },
  { key: "followUps", label: "Follow-up tasks", hint: "Assigned tasks with owners" },
  { key: "nextSteps", label: "Next steps", hint: "What happens after this meeting" },
  { key: "owner", label: "Assigned owner", hint: "Who runs / owns the meeting" },
  { key: "partner", label: "Linked partner", hint: "Partner this meeting is about" },
  { key: "outcome", label: "Meeting outcome", hint: "What was decided or achieved" },
];

export type MeetingWorkspaceCheck = {
  key: MeetingWorkspaceField;
  label: string;
  complete: boolean;
  detail?: string;
};

export function assessMeetingWorkspace(meeting: MeetingDetail): MeetingWorkspaceCheck[] {
  const hasAgenda =
    Boolean(meeting.agenda?.trim()) || meeting.officerTopics.length > 0 || meeting.presentations.length > 0;

  return [
    {
      key: "agenda",
      label: "Agenda",
      complete: hasAgenda,
      detail: hasAgenda
        ? meeting.officerTopics.length > 0
          ? `${meeting.officerTopics.length} item${meeting.officerTopics.length === 1 ? "" : "s"}`
          : "Outline set"
        : undefined,
    },
    {
      key: "proposal",
      label: "Proposal",
      complete: Boolean(meeting.proposal?.trim()),
    },
    {
      key: "notes",
      label: "Meeting notes",
      complete: Boolean(meeting.notes?.trim()),
    },
    {
      key: "followUps",
      label: "Follow-up tasks",
      complete: meeting.followUps.length > 0,
      detail:
        meeting.followUps.length > 0
          ? `${meeting.followUps.filter((f) => f.status !== "COMPLETED").length} open`
          : undefined,
    },
    {
      key: "nextSteps",
      label: "Next steps",
      complete: Boolean(meeting.nextSteps?.trim()),
    },
    {
      key: "owner",
      label: "Assigned owner",
      complete: Boolean(meeting.facilitator?.name),
      detail: meeting.facilitator?.name ?? undefined,
    },
    {
      key: "partner",
      label: "Linked partner",
      complete: Boolean(meeting.partner?.name),
      detail: meeting.partner?.name ?? undefined,
    },
    {
      key: "outcome",
      label: "Meeting outcome",
      complete: Boolean(meeting.outcome?.trim()) || meeting.decisions.length > 0,
      detail: meeting.decisions.length > 0 ? `${meeting.decisions.length} decision${meeting.decisions.length === 1 ? "" : "s"}` : undefined,
    },
  ];
}

export function workspaceCompletionPercent(checks: MeetingWorkspaceCheck[]): number {
  if (checks.length === 0) return 0;
  return Math.round((checks.filter((c) => c.complete).length / checks.length) * 100);
}
