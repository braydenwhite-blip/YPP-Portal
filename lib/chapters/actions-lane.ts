// The ACTIONS lane — what must be done now, grouped by what makes it urgent
// (overdue, blocked, waiting on leadership, no next move, flagged), each row
// showing owner + concrete status + the linked partner/student/instructor/
// meeting. Built entirely on the existing chapter-scoped action query
// (`getActionsForChapter`) — no new base query, no parallel task system.
//
// "Ownerless" isn't expressible: `ActionItem.leadId` is required and the
// chapter bridge always sets it to the CP, so there is no such thing as a
// truly unowned chapter action. "No next move" (no `nextFollowUpAt` set) is
// the practical stand-in — an action that is open but has nothing scheduled
// to move it forward.

import "server-only";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { getActionsForChapter, type ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import type { LaneRecord, RelatedRef } from "@/lib/chapters/lanes";
import type { RoomTone } from "@/lib/chapters/rooms";

export type ActionsLaneView = {
  headline: string;
  trackerEnabled: boolean;
  overdue: LaneRecord[];
  blocked: LaneRecord[];
  waitingOnLeadership: LaneRecord[];
  noNextMove: LaneRecord[];
  flagged: LaneRecord[];
  all: LaneRecord[];
  totalOpen: number;
};

const STATUS_TONE: Record<string, RoomTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  COMPLETE: "success",
  OVERDUE: "danger",
  BLOCKED: "danger",
  DROPPED: "neutral",
};

function isOpen(item: ActionItemWithRelations): boolean {
  return item.status !== "COMPLETE" && item.status !== "DROPPED";
}

function isOverdue(item: ActionItemWithRelations, now: Date): boolean {
  return item.status === "OVERDUE" || (isOpen(item) && item.deadlineStart != null && item.deadlineStart.getTime() < now.getTime());
}

const RELATED_HREF: Record<string, (id: string) => string> = {
  PARTNER: (id) => `/admin/partners/${id}`,
  INSTRUCTOR_APPLICATION: (id) => `/admin/instructor-applicants/${id}`,
  CLASS_OFFERING: (id) => `/admin/classes/${id}`,
  USER: (id) => `/people/${id}`,
  MENTORSHIP: (id) => `/mentorship/${id}`,
};
const RELATED_KIND: Record<string, RelatedRef["kind"]> = {
  PARTNER: "partner",
  INSTRUCTOR_APPLICATION: "instructor",
  CLASS_OFFERING: "class",
  USER: "student",
};

/** Resolve display names for the polymorphic relatedEntityType/Id links in one bounded batch per type. */
async function resolveRelatedNames(items: ActionItemWithRelations[]): Promise<Map<string, string>> {
  const idsByType = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item.relatedEntityType || !item.relatedEntityId) continue;
    const set = idsByType.get(item.relatedEntityType) ?? new Set<string>();
    set.add(item.relatedEntityId);
    idsByType.set(item.relatedEntityType, set);
  }

  const names = new Map<string, string>();
  const partnerIds = [...(idsByType.get("PARTNER") ?? [])];
  const userIds = [...(idsByType.get("USER") ?? [])];
  const applicantIds = [...(idsByType.get("INSTRUCTOR_APPLICATION") ?? [])];
  const classIds = [...(idsByType.get("CLASS_OFFERING") ?? [])];

  const [partners, users, applicants, classes] = await Promise.all([
    partnerIds.length ? prisma.partner.findMany({ where: { id: { in: partnerIds } }, select: { id: true, name: true } }) : [],
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
    applicantIds.length
      ? prisma.instructorApplication.findMany({ where: { id: { in: applicantIds } }, select: { id: true, applicant: { select: { name: true } } } })
      : [],
    classIds.length ? prisma.classOffering.findMany({ where: { id: { in: classIds } }, select: { id: true, title: true } }) : [],
  ]);

  for (const p of partners) names.set(`PARTNER:${p.id}`, p.name);
  for (const u of users) names.set(`USER:${u.id}`, u.name ?? "Member");
  for (const a of applicants) names.set(`INSTRUCTOR_APPLICATION:${a.id}`, a.applicant?.name ?? "Applicant");
  for (const c of classes) names.set(`CLASS_OFFERING:${c.id}`, c.title);

  return names;
}

function actionToLaneRecord(item: ActionItemWithRelations, relatedNames: Map<string, string>): LaneRecord {
  const related: RelatedRef[] = [];
  if (item.relatedEntityType && item.relatedEntityId && RELATED_HREF[item.relatedEntityType]) {
    const name = relatedNames.get(`${item.relatedEntityType}:${item.relatedEntityId}`) ?? "View record";
    related.push({
      kind: RELATED_KIND[item.relatedEntityType] ?? "action",
      id: item.relatedEntityId,
      label: name,
      href: RELATED_HREF[item.relatedEntityType](item.relatedEntityId),
    });
  }
  if (item.meeting) {
    related.push({ kind: "meeting", id: item.meeting.id, label: item.meeting.title, href: `/meetings/${item.meeting.id}` });
  }

  const overdueDays = item.deadlineStart ? Math.floor((Date.now() - item.deadlineStart.getTime()) / 86_400_000) : null;
  const statusLabel =
    item.status === "BLOCKED" && item.blockedReason
      ? `Blocked: ${item.blockedReason}`
      : item.status === "OVERDUE" || (overdueDays != null && overdueDays > 0 && isOpen(item))
      ? `Overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`
      : item.status === "IN_PROGRESS"
      ? "In progress"
      : item.status === "NOT_STARTED"
      ? "Not started"
      : item.status;

  return {
    id: item.id,
    name: item.title,
    subtitle: item.goalCategory,
    owner: item.lead ? { name: item.lead.name ?? "Unassigned" } : null,
    status: { label: statusLabel, tone: STATUS_TONE[item.status] ?? "neutral" },
    nextStep: item.nextFollowUpAt ? `Next: ${item.nextFollowUpAt.toLocaleDateString()}` : "No next move scheduled",
    related,
    href: `/actions/${item.id}`,
  };
}

/** A chapter's open support requests to national leadership, as lane records (the "waiting on leadership" half of Actions). */
async function loadSupportRequestRecords(chapterId: string): Promise<LaneRecord[]> {
  const requests = await prisma.chapterSupportRequest.findMany({
    where: { chapterId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    orderBy: [{ createdAt: "desc" }],
    take: 20,
    select: { id: true, title: true, status: true, assignedTo: { select: { name: true } }, createdAt: true },
  });
  return requests.map((r) => ({
    id: r.id,
    name: r.title,
    subtitle: "Support request to leadership",
    owner: r.assignedTo ? { name: r.assignedTo.name ?? "Leadership" } : null,
    status: { label: r.status === "IN_PROGRESS" ? "Leadership is on it" : "Waiting for leadership", tone: r.status === "IN_PROGRESS" ? "info" : "warning" },
    nextStep: r.assignedTo ? "Awaiting a response" : "Waiting for leadership to pick this up",
    related: [],
    href: "/chapter/settings",
  }));
}

/**
 * Load the chapter's Actions lane: every real, chapter-scoped ActionItem
 * (via `getActionsForChapter`) plus open support requests to leadership,
 * grouped by what makes each one urgent. Honest empty state when the Action
 * Tracker feature flag is off (`getActionsForChapter` returns []).
 */
export async function loadChapterActionsLane(
  chapterId: string,
  viewer: ActionViewer,
  filter?: { relatedType?: string; relatedId?: string }
): Promise<ActionsLaneView> {
  const [rawItems, supportRequestRecords] = await Promise.all([
    getActionsForChapter(chapterId, viewer),
    loadSupportRequestRecords(chapterId),
  ]);
  // Optional "related to one entity" filter — how a Partner/Instructor/Student
  // lane row's "Related actions" link narrows this lane to just its own items.
  const items =
    filter?.relatedType && filter?.relatedId
      ? rawItems.filter((i) => i.relatedEntityType === filter.relatedType && i.relatedEntityId === filter.relatedId)
      : rawItems;
  const now = new Date();
  const open = items.filter(isOpen);

  const relatedNames = await resolveRelatedNames(items);
  const toRecord = (item: ActionItemWithRelations) => actionToLaneRecord(item, relatedNames);

  const overdue = open.filter((i) => isOverdue(i, now));
  const blocked = open.filter((i) => i.status === "BLOCKED");
  const noNextMove = open.filter((i) => i.nextFollowUpAt == null && !isOverdue(i, now) && i.status !== "BLOCKED");
  const flagged = open.filter((i) => i.flaggedAt != null);

  return {
    headline: `${open.length} open · ${overdue.length} overdue · ${blocked.length} blocked`,
    trackerEnabled: isActionTrackerEnabled(),
    overdue: overdue.map(toRecord),
    blocked: blocked.map(toRecord),
    waitingOnLeadership: filter ? blocked.map(toRecord) : [...blocked.map(toRecord), ...supportRequestRecords],
    noNextMove: noNextMove.map(toRecord),
    flagged: flagged.map(toRecord),
    all: open.map(toRecord),
    totalOpen: open.length,
  };
}
