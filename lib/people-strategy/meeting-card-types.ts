/**
 * People Strategy — light meeting view-model types (legacy surface shim).
 *
 * The old Meetings Tracker query layer (`meetings-queries.ts`) was removed in the
 * weekly-meetings rebuild, but a handful of still-alive surfaces — the Strategic
 * Initiatives intelligence helpers (`strategic-*.ts`) and the operational
 * context/digest readers — typed their (now always-empty) `meetings` collections
 * against its `MeetingCardDTO` shape. These pure data types are kept here so that
 * code keeps compiling while the meeting collections feeding it are empty. No
 * Prisma runtime, no dependency on the dropped `OfficerMeeting` model.
 */

export type EffectiveMeetingStatus =
  | "upcoming"
  | "today"
  | "in_progress"
  | "completed"
  | "needs_follow_up"
  | "canceled";

export type EffectiveFollowUpStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "overdue"
  | "canceled";

export interface PersonDTO {
  id: string;
  name: string;
  initials: string;
}

export interface DecisionDTO {
  id: string;
  decision: string;
  rationale: string | null;
  decidedBy: PersonDTO | null;
  createdISO: string;
  linkedActionId: string | null;
}

export interface FollowUpDTO {
  id: string;
  title: string;
  description: string | null;
  owner: PersonDTO | null;
  dueISO: string | null;
  effectiveStatus: EffectiveFollowUpStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  area: string | null;
  areaLabel: string;
  linkedActionId: string | null;
  initiativeId: string | null;
  workstreamId: string | null;
  sourceActionId: string | null;
  sourceActionTitle: string | null;
  briefId: string | null;
  presentationExpectationId: string | null;
  presentationExpectationPrompt: string | null;
}

export interface LinkedActionDTO {
  id: string;
  title: string;
  owner: PersonDTO | null;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  deadlineISO: string;
  departmentName: string | null;
}

export interface MeetingCardDTO {
  id: string;
  title: string;
  purpose: string | null;
  meetingType?: string;
  meetingTypeLabel?: string;
  category: string | null;
  categoryLabel: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startISO: string;
  endISO: string | null;
  durationLabel: string | null;
  recurrence: string | null;
  location: string | null;
  relatedTeam?: string | null;
  relatedChapter?: string | null;
  strategicPriority?: string | null;
  summaryStatus?: string;
  rescheduleStatus?: string | null;
  escalationStatus?: string | null;
  facilitator: PersonDTO | null;
  attendeeCount: number;
  requiredAttendeeCount?: number;
  attendanceRecordedCount?: number;
  attendanceConcernCount?: number;
  participantIds: string[];
  effectiveStatus: EffectiveMeetingStatus;
  storedStatus: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  agendaCount: number;
  agendaDoneCount: number;
  decisionCount: number;
  openFollowUps: number;
  overdueFollowUps: number;
  openLinkedActions: number;
  linkedActionCount: number;
  hasNotes?: boolean;
  followUpCount?: number;
  followUpsNeedingOwner?: number;
  followUpsNeedingDueDate?: number;
  decisionsPreview?: DecisionDTO[];
  unconvertedFollowUps?: FollowUpDTO[];
  linkedActionsPreview?: LinkedActionDTO[];
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}
