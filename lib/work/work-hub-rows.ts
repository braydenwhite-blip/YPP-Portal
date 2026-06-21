import type { Entity360Type } from "@/lib/operations/entity-360";
import type { WorkItem } from "@/lib/operations/work-items";
import type {
  MeetingLite,
} from "@/lib/people-strategy/operational-digest";
import type { RelatedEntityType } from "@/lib/people-strategy/constants";

/**
 * Work Hub — the unified row (Knowledge OS V2, plan §15).
 *
 * `/work` shows every kind of "someone has to do something" in ONE list:
 * tracker actions, meeting follow-ups, upcoming meetings, open partner
 * requests, partner follow-ups past their date, advisor check-ins overdue,
 * applications waiting on a concrete next step, and quiet mentorships.
 * This module is the PURE fold from each domain's existing lite shape into
 * one serializable row — no DB, no session; callers inject `now`. It does
 * NOT invent work: every row maps 1:1 to a real record with a real reason.
 */

export const WORK_HUB_KINDS = [
  "action",
  "follow_up",
  "meeting",
  "initiative",
  "partner_request",
  "partner_follow_up",
  "advisor_check_in",
  "application",
  "mentorship",
] as const;

export type WorkHubKind = (typeof WORK_HUB_KINDS)[number];

export const WORK_HUB_KIND_LABELS: Record<WorkHubKind, string> = {
  action: "Action",
  follow_up: "Meeting follow-up",
  meeting: "Meeting",
  initiative: "Initiative",
  partner_request: "Partner request",
  partner_follow_up: "Partner follow-up",
  advisor_check_in: "Advisor check-in",
  application: "Application",
  mentorship: "Mentorship follow-up",
};

export type WorkHubTone = "danger" | "warning" | "info" | "success" | "neutral";

/**
 * Inline Complete / Block payload for an action row the viewer may edit —
 * serializable inputs for the shared ActionStatusCapture (same server
 * actions as the detail card; permissions re-checked server-side).
 */
export type WorkHubRowCapture = {
  actionId: string;
  blockedReason: string | null;
  completionNote: string | null;
  completionOutcome: string | null;
  nextFollowUpISO: string | null;
};

export type WorkHubRow = {
  /** Globally unique across kinds (`action:…`, `partner_request:…`). */
  id: string;
  kind: WorkHubKind;
  kindLabel: string;
  title: string;
  /** Display status ("Overdue 3d", "Decision needed", "Due Jun 12", …). */
  status: string;
  tone: WorkHubTone;
  ownerName: string | null;
  dueISO: string | null;
  /** "Urgent" / "High" — only when the source record has a real priority. */
  priorityLabel: string | null;
  /** Honest provenance line ("From meeting: …", "Partner pipeline", …). */
  sourceLabel: string | null;
  /** The meeting this work came from (or the meeting itself, for meeting
   *  rows) — `/work?entity=meeting:<id>` matches on it. */
  meetingId?: string | null;
  /** The connected entity, rendered as an EntityChip into its 360 preview. */
  entityType: Entity360Type | null;
  entityId: string | null;
  entityLabel: string | null;
  nextStep: string | null;
  overdue: boolean;
  blocked: boolean;
  unassigned: boolean;
  /** Owned/led by the viewer — powers the My Queue tab. */
  mine: boolean;
  /** The full record page. */
  href: string;
  /** One concrete quick action ("Log check-in", "Convert to action"). */
  quickActionLabel: string | null;
  quickActionHref: string | null;
  /** The row's OWN 360 preview target (rail / drawer), when one exists. */
  previewType: Entity360Type | null;
  previewId: string | null;
  /** Inline Complete / Block capture, present only when the viewer can edit. */
  capture?: WorkHubRowCapture | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days ahead a due date counts as "due soon" (mirrors the work-item fold). */
export const WORK_HUB_DUE_SOON_DAYS = 7;

const RELATED_TO_ENTITY_360: Partial<Record<RelatedEntityType, Entity360Type>> = {
  CLASS_OFFERING: "class",
  MENTORSHIP: "mentorship",
  USER: "person",
  INSTRUCTOR_APPLICATION: "applicant",
  PARTNER: "partner",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function daysPast(iso: string, now: Date): number {
  return Math.max(1, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS));
}

function workEntityHref(type: Entity360Type, id: string): string {
  return `/work?entity=${type}:${encodeURIComponent(id)}`;
}

/** Is a row's due date inside the due-soon window (and not already overdue)? */
export function rowIsDueSoon(row: WorkHubRow, now: Date): boolean {
  if (row.overdue || !row.dueISO) return false;
  const due = new Date(row.dueISO).getTime();
  return due <= now.getTime() + WORK_HUB_DUE_SOON_DAYS * DAY_MS;
}

// --- converters ----------------------------------------------------------------

/** Fold a unified work item (tracker action / meeting follow-up) into a row. */
export function workHubRowFromWorkItem(
  item: WorkItem,
  options: { mine?: boolean; capture?: WorkHubRowCapture | null } = {}
): WorkHubRow {
  const entityType = item.relatedType
    ? (RELATED_TO_ENTITY_360[item.relatedType] ?? null)
    : null;
  return {
    id: item.id,
    kind: item.kind,
    kindLabel: WORK_HUB_KIND_LABELS[item.kind],
    title: item.title,
    status: item.status,
    tone: item.tone,
    ownerName: item.ownerName,
    dueISO: item.dueISO,
    priorityLabel: PRIORITY_LABELS[item.priority] ?? null,
    sourceLabel: item.meetingTitle ? `From meeting: ${item.meetingTitle}` : null,
    meetingId: item.meetingId,
    entityType,
    entityId: entityType ? item.relatedId : null,
    entityLabel: item.relatedLabel,
    nextStep: item.nextStep,
    overdue: item.overdue,
    blocked: item.blocked,
    unassigned: item.unassigned,
    mine: options.mine ?? false,
    href: item.href,
    quickActionLabel: item.convertHref ? "Convert to action" : null,
    quickActionHref: item.convertHref ? `/actions/new?${item.convertHref}` : null,
    previewType: item.kind === "action" ? "action" : "meeting",
    previewId:
      item.kind === "action"
        ? item.id.replace(/^action:/, "")
        : (item.href.split("/").pop() ?? null),
    capture: options.capture ?? null,
  };
}

/**
 * Fold a meeting into a row for the Meetings tab: upcoming meetings show when
 * they start; past meetings appear only while follow-ups are still open.
 */
export function workHubRowFromMeeting(
  meeting: MeetingLite,
  now: Date,
  options: { mine?: boolean } = {}
): WorkHubRow | null {
  const start = new Date(meeting.startISO).getTime();
  const upcoming = start >= now.getTime();
  if (!upcoming && meeting.openFollowUps === 0) return null;

  let status: string;
  let tone: WorkHubTone;
  if (upcoming) {
    status = `Starts ${shortDate(meeting.startISO)}`;
    tone = "info";
  } else if (meeting.overdueFollowUps > 0) {
    status = `${meeting.overdueFollowUps} follow-up${meeting.overdueFollowUps === 1 ? "" : "s"} overdue`;
    tone = "danger";
  } else {
    status = `${meeting.openFollowUps} follow-up${meeting.openFollowUps === 1 ? "" : "s"} open`;
    tone = "warning";
  }
  const entityType = meeting.relatedType
    ? (RELATED_TO_ENTITY_360[meeting.relatedType] ?? null)
    : null;
  return {
    id: `meeting:${meeting.id}`,
    kind: "meeting",
    kindLabel: WORK_HUB_KIND_LABELS.meeting,
    title: meeting.title,
    status,
    tone,
    ownerName: meeting.facilitatorName,
    dueISO: meeting.startISO,
    priorityLabel: null,
    sourceLabel: meeting.categoryLabel || null,
    meetingId: meeting.id,
    entityType,
    entityId: entityType ? meeting.relatedId : null,
    entityLabel: meeting.relatedLabel ?? null,
    nextStep: upcoming
      ? null
      : meeting.openFollowUps > 0
        ? "Close out the open follow-ups"
        : null,
    overdue: meeting.overdueFollowUps > 0,
    blocked: false,
    unassigned: !meeting.facilitatorName,
    mine: options.mine ?? false,
    href: meeting.href,
    quickActionLabel: "Open meeting",
    quickActionHref: meeting.href,
    previewType: "meeting",
    previewId: meeting.id,
  };
}

/** An open partner request, owned or not, due or not. */
export function workHubRowFromPartnerRequest(
  request: {
    id: string;
    title: string;
    status: string;
    dueISO: string | null;
    ownerName: string | null;
    partnerId: string;
    partnerName: string;
  },
  now: Date,
  options: { mine?: boolean; canOpenAdminRecord?: boolean } = {}
): WorkHubRow {
  const overdue = Boolean(
    request.dueISO && new Date(request.dueISO).getTime() < now.getTime()
  );
  const href = options.canOpenAdminRecord
    ? `/admin/partners/${request.partnerId}#relationship-ops`
    : workEntityHref("partner", request.partnerId);
  return {
    id: `partner_request:${request.id}`,
    kind: "partner_request",
    kindLabel: WORK_HUB_KIND_LABELS.partner_request,
    title: request.title,
    status: overdue
      ? `Overdue ${daysPast(request.dueISO as string, now)}d`
      : request.dueISO
        ? `Due ${shortDate(request.dueISO)}`
        : "Open",
    tone: overdue ? "danger" : "neutral",
    ownerName: request.ownerName,
    dueISO: request.dueISO,
    priorityLabel: null,
    sourceLabel: "Partner pipeline",
    entityType: "partner",
    entityId: request.partnerId,
    entityLabel: request.partnerName,
    nextStep: null,
    overdue,
    blocked: false,
    unassigned: !request.ownerName,
    mine: options.mine ?? false,
    href,
    quickActionLabel: options.canOpenAdminRecord ? "Open partner" : "View partner work",
    quickActionHref: href,
    previewType: "partner",
    previewId: request.partnerId,
  };
}

/** A partner whose stored next-follow-up date has passed. */
export function workHubRowFromPartnerFollowUp(
  partner: {
    id: string;
    name: string;
    nextFollowUpISO: string;
    leadName: string | null;
  },
  now: Date,
  options: { mine?: boolean; canOpenAdminRecord?: boolean } = {}
): WorkHubRow {
  const href = options.canOpenAdminRecord
    ? `/admin/partners/${partner.id}`
    : workEntityHref("partner", partner.id);
  return {
    id: `partner_follow_up:${partner.id}`,
    kind: "partner_follow_up",
    kindLabel: WORK_HUB_KIND_LABELS.partner_follow_up,
    title: `Follow up with ${partner.name}`,
    status: `Overdue ${daysPast(partner.nextFollowUpISO, now)}d`,
    tone: "danger",
    ownerName: partner.leadName,
    dueISO: partner.nextFollowUpISO,
    priorityLabel: null,
    sourceLabel: "Partner pipeline",
    entityType: "partner",
    entityId: partner.id,
    entityLabel: partner.name,
    nextStep: null,
    overdue: true,
    blocked: false,
    unassigned: !partner.leadName,
    mine: options.mine ?? false,
    href,
    quickActionLabel: options.canOpenAdminRecord ? "Open partner" : "View partner work",
    quickActionHref: href,
    previewType: "partner",
    previewId: partner.id,
  };
}

/** An advisor check-in past its stored due date. */
export function workHubRowFromAdvisorCheckIn(
  assignment: {
    assignmentId: string;
    studentId: string;
    studentName: string;
    advisorName: string | null;
    nextCheckInISO: string;
  },
  now: Date,
  options: { mine?: boolean } = {}
): WorkHubRow {
  return {
    id: `advisor_check_in:${assignment.assignmentId}`,
    kind: "advisor_check_in",
    kindLabel: WORK_HUB_KIND_LABELS.advisor_check_in,
    title: `Check in with ${assignment.studentName}`,
    status: `Overdue ${daysPast(assignment.nextCheckInISO, now)}d`,
    tone: "danger",
    ownerName: assignment.advisorName,
    dueISO: assignment.nextCheckInISO,
    priorityLabel: null,
    sourceLabel: "Advising",
    entityType: "person",
    entityId: assignment.studentId,
    entityLabel: assignment.studentName,
    nextStep: null,
    overdue: true,
    blocked: false,
    unassigned: !assignment.advisorName,
    mine: options.mine ?? false,
    href: `/my-advisees/${assignment.assignmentId}`,
    quickActionLabel: "Log check-in",
    quickActionHref: `/my-advisees/${assignment.assignmentId}`,
    previewType: "person",
    previewId: assignment.studentId,
  };
}

/** The concrete next step per pipeline status (no vague "in progress"). */
const APPLICATION_NEXT_STEPS: Record<
  string,
  { status: string; nextStep: string; tone: WorkHubTone }
> = {
  SUBMITTED: {
    status: "Needs review",
    nextStep: "Assign a reviewer and start the review",
    tone: "warning",
  },
  UNDER_REVIEW: {
    status: "Review pending",
    nextStep: "Complete the application review",
    tone: "info",
  },
  INTERVIEW_COMPLETED: {
    status: "Interview done",
    nextStep: "Submit interview reviews, then send to chair",
    tone: "warning",
  },
  CHAIR_REVIEW: {
    status: "Decision needed",
    nextStep: "Chair decision in the review cockpit",
    tone: "danger",
  },
};

/** An application sitting on a leadership next step (not applicant-side waits). */
export function workHubRowFromApplication(
  application: {
    id: string;
    displayName: string;
    status: string;
    reviewerName: string | null;
    updatedISO: string;
  },
  options: { mine?: boolean } = {}
): WorkHubRow | null {
  const step = APPLICATION_NEXT_STEPS[application.status];
  if (!step) return null;
  return {
    id: `application:${application.id}`,
    kind: "application",
    kindLabel: WORK_HUB_KIND_LABELS.application,
    title: application.displayName,
    status: step.status,
    tone: step.tone,
    ownerName: application.reviewerName,
    dueISO: null,
    priorityLabel: null,
    sourceLabel: "Instructor pipeline",
    entityType: "applicant",
    entityId: application.id,
    entityLabel: application.displayName,
    nextStep: step.nextStep,
    overdue: application.status === "CHAIR_REVIEW",
    blocked: false,
    unassigned: !application.reviewerName,
    mine: options.mine ?? false,
    href: `/admin/instructor-applicants/${application.id}`,
    quickActionLabel: "Open application",
    quickActionHref: `/admin/instructor-applicants/${application.id}`,
    previewType: "applicant",
    previewId: application.id,
  };
}

/**
 * Chapter President pipeline → Work Hub. Mirrors the instructor application
 * mapping but with the CP lifecycle statuses and the CP admin cockpit href, so
 * leadership sees "3 CP applicants need first review" / "2 ready for final
 * decision" right next to instructor applications instead of on a buried page.
 */
const CP_APPLICATION_NEXT_STEPS: Record<
  string,
  { status: string; nextStep: string; tone: WorkHubTone; overdue?: boolean }
> = {
  SUBMITTED: {
    status: "Needs first review",
    nextStep: "Assign a reviewer and start the review",
    tone: "warning",
  },
  INITIAL_REVIEW: {
    status: "Review in progress",
    nextStep: "Finish the review and recommend the next step",
    tone: "info",
  },
  UNDER_REVIEW: {
    status: "Review in progress",
    nextStep: "Finish the review and recommend the next step",
    tone: "info",
  },
  INTERVIEW_NEEDED: {
    status: "Needs interview",
    nextStep: "Schedule the chapter president interview",
    tone: "warning",
  },
  INTERVIEW_COMPLETE: {
    status: "Interview done",
    nextStep: "Record interview notes and send to final decision",
    tone: "warning",
  },
  INTERVIEW_COMPLETED: {
    status: "Interview done",
    nextStep: "Record interview notes and send to final decision",
    tone: "warning",
  },
  DECISION_NEEDED: {
    status: "Decision needed",
    nextStep: "Chair makes the final decision",
    tone: "danger",
    overdue: true,
  },
  RECOMMENDATION_SUBMITTED: {
    status: "Decision needed",
    nextStep: "Chair makes the final decision",
    tone: "danger",
    overdue: true,
  },
  ACCEPTED: {
    status: "Needs onboarding",
    nextStep: "Create starter actions and schedule onboarding",
    tone: "info",
  },
  APPROVED: {
    status: "Needs onboarding",
    nextStep: "Create starter actions and schedule onboarding",
    tone: "info",
  },
  ONBOARDING: {
    status: "Onboarding in progress",
    nextStep: "Confirm onboarding tasks are complete",
    tone: "info",
  },
};

export function workHubRowFromCPApplication(
  application: {
    id: string;
    displayName: string;
    status: string;
    reviewerName: string | null;
    updatedISO: string;
  },
  options: { mine?: boolean } = {}
): WorkHubRow | null {
  const step = CP_APPLICATION_NEXT_STEPS[application.status];
  if (!step) return null;
  return {
    id: `cp-application:${application.id}`,
    kind: "application",
    kindLabel: "CP applicant",
    title: application.displayName,
    status: step.status,
    tone: step.tone,
    ownerName: application.reviewerName,
    dueISO: null,
    priorityLabel: null,
    sourceLabel: "Chapter President pipeline",
    entityType: null,
    entityId: null,
    entityLabel: application.displayName,
    nextStep: step.nextStep,
    overdue: step.overdue ?? false,
    blocked: false,
    unassigned: !application.reviewerName,
    mine: options.mine ?? false,
    href: `/admin/chapter-president-applicants/${application.id}`,
    quickActionLabel: "Open application",
    quickActionHref: `/admin/chapter-president-applicants/${application.id}`,
    previewType: null,
    previewId: null,
  };
}

/** A mentorship with no recorded activity for `quietDays` — needs a follow-up. */
export function workHubRowFromQuietMentorship(
  mentorship: {
    id: string;
    mentorName: string;
    menteeName: string;
    menteeId: string;
    quietDays: number;
  },
  options: { mine?: boolean; canOpenAdminRecord?: boolean } = {}
): WorkHubRow {
  const href = options.canOpenAdminRecord
    ? "/admin/mentorship"
    : workEntityHref("mentorship", mentorship.id);
  return {
    id: `mentorship:${mentorship.id}`,
    kind: "mentorship",
    kindLabel: WORK_HUB_KIND_LABELS.mentorship,
    title: `${mentorship.mentorName} ↔ ${mentorship.menteeName}`,
    status: `Quiet ${mentorship.quietDays} days`,
    tone: "warning",
    ownerName: mentorship.mentorName,
    dueISO: null,
    priorityLabel: null,
    sourceLabel: "Mentorship",
    entityType: "person",
    entityId: mentorship.menteeId,
    entityLabel: mentorship.menteeName,
    nextStep: "Check in with the pair or log recent activity",
    overdue: false,
    blocked: false,
    unassigned: false,
    mine: options.mine ?? false,
    href,
    quickActionLabel: options.canOpenAdminRecord ? "Open mentorship" : "View mentorship work",
    quickActionHref: href,
    previewType: "mentorship",
    previewId: mentorship.id,
  };
}

// --- sorting / filtering ---------------------------------------------------------

const TONE_WEIGHT: Record<WorkHubTone, number> = {
  danger: 4,
  warning: 3,
  info: 2,
  neutral: 1,
  success: 0,
};

/**
 * Triage order for the unified list: overdue first, then blocked, then by
 * tone severity, then earliest due date, then title — deterministic, so the
 * same data always renders the same list.
 */
export function sortWorkHubRows(rows: WorkHubRow[]): WorkHubRow[] {
  return [...rows].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.blocked !== b.blocked) return a.blocked ? -1 : 1;
    const tone = TONE_WEIGHT[b.tone] - TONE_WEIGHT[a.tone];
    if (tone !== 0) return tone;
    const aDue = a.dueISO ? new Date(a.dueISO).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueISO ? new Date(b.dueISO).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue || a.title.localeCompare(b.title);
  });
}

export const WORK_HUB_FLAGS = ["overdue", "due-soon", "blocked", "unowned"] as const;
export type WorkHubFlag = (typeof WORK_HUB_FLAGS)[number];

export const WORK_HUB_FLAG_LABELS: Record<WorkHubFlag, string> = {
  overdue: "Overdue",
  "due-soon": "Due soon",
  blocked: "Blocked",
  unowned: "Needs an owner",
};

export function asWorkHubFlag(value: string | undefined): WorkHubFlag | null {
  return (WORK_HUB_FLAGS as readonly string[]).includes(value ?? "")
    ? (value as WorkHubFlag)
    : null;
}

/** Apply a stat-card flag filter to the row list. */
export function filterWorkHubRowsByFlag(
  rows: WorkHubRow[],
  flag: WorkHubFlag,
  now: Date
): WorkHubRow[] {
  switch (flag) {
    case "overdue":
      return rows.filter((row) => row.overdue);
    case "due-soon":
      return rows.filter((row) => rowIsDueSoon(row, now));
    case "blocked":
      return rows.filter((row) => row.blocked);
    case "unowned":
      return rows.filter((row) => row.unassigned);
  }
}

/** Parse a `/work?entity=<type>:<id>` filter param ("partner:p1"). */
export function asWorkHubEntityFilter(
  value: string | undefined
): { type: Entity360Type; id: string } | null {
  if (!value) return null;
  const idx = value.indexOf(":");
  if (idx <= 0) return null;
  const type = value.slice(0, idx);
  const id = value.slice(idx + 1).trim();
  if (!id) return null;
  const known: readonly string[] = [
    "person",
    "class",
    "partner",
    "initiative",
    "meeting",
    "action",
    "mentorship",
    "applicant",
  ];
  if (!known.includes(type)) return null;
  return { type: type as Entity360Type, id };
}

/**
 * Rows connected to one entity (the record pages' "View in Work Hub" lens).
 * The meeting lens additionally matches rows whose work CAME FROM that
 * meeting (`meetingId`), so `/work?entity=meeting:<id>` answers "what did
 * this meeting create, and what's still open?".
 */
export function filterWorkHubRowsByEntity(
  rows: WorkHubRow[],
  entity: { type: Entity360Type; id: string }
): WorkHubRow[] {
  return rows.filter(
    (row) =>
      (row.entityType === entity.type && row.entityId === entity.id) ||
      (row.previewType === entity.type && row.previewId === entity.id) ||
      (entity.type === "meeting" && row.meetingId === entity.id)
  );
}

/** Case-insensitive search across title, owner, entity, status, and kind. */
export function searchWorkHubRows(rows: WorkHubRow[], query: string): WorkHubRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [row.title, row.ownerName, row.entityLabel, row.status, row.kindLabel]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(q))
  );
}
