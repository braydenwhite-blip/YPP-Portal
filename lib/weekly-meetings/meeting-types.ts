/**
 * Client-safe meeting types + labels.
 *
 * These carry no `server-only`/prisma dependency so they can be imported from
 * client components (e.g. the create-meeting form, the meeting runner). The
 * server-side loaders live in `./meetings`, which re-exports everything here.
 */
import type { MeetingLinkedAction } from "@/lib/people-strategy/action-queries";
import type { ChapterMeetingContext } from "@/lib/chapters/meeting-context";
import type { ImpactCoverage } from "./impact-link";

export type MeetingType = "OFFICER" | "WEEKLY_TEAM_IMPACT" | "CHAPTER_IMPACT" | "GENERIC";
export type MeetingStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  OFFICER: "Officer Meeting",
  WEEKLY_TEAM_IMPACT: "Weekly Team Impact",
  CHAPTER_IMPACT: "Chapter Impact Presentations",
  GENERIC: "Meeting",
};

export type PersonDTO = { id: string; name: string } | null;

/** Lightweight content counts shown on the meetings hub cards. */
export type MeetingCounts = {
  attendees: number;
  decisions: number;
  followUps: number;
  topics: number;
};

export type MeetingListItem = {
  id: string;
  type: MeetingType;
  typeLabel: string;
  status: MeetingStatus;
  title: string;
  scheduledISO: string;
  facilitator: PersonDTO;
  scopeLabel: string | null;
  counts: MeetingCounts;
};

export type PresentationDTO = {
  rowId: string;
  scopeLabel: string;
  person: string;
  item: string;
  evidenceNext: string | null;
  decisionNeeded: boolean;
  sendToBoard: boolean;
};

export type OfficerTopicDTO = {
  id: string;
  sortOrder: number;
  title: string;
  detail: string | null;
  status: "OPEN" | "DISCUSSED" | "DECIDED" | "DEFERRED";
  decisionNeeded: boolean;
  sendToBoard: boolean;
  decision: string | null;
  nextSteps: string | null;
  owners: { id: string; name: string }[];
};

export type AttendeeDTO = {
  id: string;
  userId: string;
  name: string;
  present: boolean;
  isOptional: boolean;
};

export type DecisionDTO = {
  id: string;
  decision: string;
  rationale: string | null;
  decidedBy: PersonDTO;
  createdISO: string;
  /** The tracked action carrying out this decision, if one has been created. */
  linkedActionId: string | null;
};

export type FollowUpDTO = {
  id: string;
  title: string;
  detail: string | null;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  dueISO: string | null;
  owner: PersonDTO;
  /** The tracked action carrying out this follow-up, if one has been created. */
  linkedActionId: string | null;
};

export type MeetingDetail = {
  id: string;
  type: MeetingType;
  typeLabel: string;
  status: MeetingStatus;
  title: string;
  purpose: string | null;
  scheduledISO: string;
  notes: string | null;
  facilitator: PersonDTO;
  scopeLabel: string | null;
  weekKey: string | null;
  weekLabel: string | null;
  attendees: AttendeeDTO[];
  presentations: PresentationDTO[];
  /** For impact meetings: who in scope has reported for the week (else null). */
  impactCoverage: ImpactCoverage | null;
  officerTopics: OfficerTopicDTO[];
  decisions: DecisionDTO[];
  followUps: FollowUpDTO[];
  boardRows: PresentationDTO[];
  boardTopics: OfficerTopicDTO[];
  /** Every tracked action that originated from this meeting. */
  linkedActions: MeetingLinkedAction[];
  /**
   * When this meeting is scoped to a chapter, the chapter's operating picture
   * (CP, active goals, open chapter actions) so the runner is chapter-aware.
   */
  chapterContext: ChapterMeetingContext | null;
};
