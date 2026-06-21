import { prisma } from "@/lib/prisma";
import type { AdminClassOperationsListItem } from "@/lib/admin-class-operations";
import {
  buildNeedsAction,
  classNextActionHref,
  deriveClassNextAction,
  deriveClassStatusLabel,
  deriveThisTermCounts,
  type ClassNextAction,
  type ClassSignals,
  type ClassStatusLabel,
  type NeedsActionItem,
  type ThisTermCounts,
} from "@/lib/class-next-action";
import {
  buildClassOperationsCard,
  sortClassOperationsCards,
  type ClassOperationsCardData,
} from "@/lib/classes/class-operations-cards";
import { countOpenActionsByRelatedEntity } from "@/lib/people-strategy/action-queries";
import { isActionTrackerEnabled } from "@/lib/feature-flags";

/**
 * Server-side composition for the Classes command center.
 *
 * Takes the already-loaded admin operations page (so the page never fetches the
 * class list twice) and enriches each class with the batched signals the
 * Next-Action helper needs — open/overdue actions, the next session, post-class
 * reflection, feedback, and co-instructors — without N+1 queries. Every enrich
 * query fails safe to an empty map so a missing table or a flag-off tracker can
 * never break the page; the row simply reads as having no signal there.
 */

/** Co-instructor / TA assignment statuses that count as "on the team". */
const ACTIVE_ASSIGNMENT_STATUSES = [
  "OFFERED",
  "INSTRUCTOR_CONFIRMED",
  "CHAPTER_CONFIRMED",
  "FULLY_CONFIRMED",
] as const;

export type ClassCommandRow = {
  id: string;
  title: string;
  status: string;
  /** Partner name when present, otherwise the chapter — the "Program / Partner" column. */
  programLabel: string | null;
  partnerName: string | null;
  instructorLabel: string;
  scheduleLabel: string;
  studentsLabel: string;
  statusLabel: ClassStatusLabel;
  nextAction: ClassNextAction;
  /** Where the row's one primary action lands. */
  href: string;
};

export type ClassCommandCenter = {
  rows: ClassCommandRow[];
  cards: ClassOperationsCardData[];
  counts: ThisTermCounts;
  needsAction: NeedsActionItem[];
};

async function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error("[class-command-center] enrich query failed", error);
    return fallback;
  }
}

async function countOverdueActions(ids: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!isActionTrackerEnabled() || ids.length === 0) return result;
  const groups = await prisma.actionItem.groupBy({
    by: ["relatedEntityId"],
    where: {
      relatedEntityType: "CLASS_OFFERING",
      relatedEntityId: { in: ids },
      status: "OVERDUE",
    },
    _count: { _all: true },
  });
  for (const group of groups) {
    if (group.relatedEntityId) result.set(group.relatedEntityId, group._count._all);
  }
  return result;
}

async function nextSessionByOffering(
  ids: string[],
  now: Date
): Promise<Map<string, Date>> {
  const result = new Map<string, Date>();
  if (ids.length === 0) return result;
  const groups = await prisma.classSession.groupBy({
    by: ["offeringId"],
    where: { offeringId: { in: ids }, isCancelled: false, date: { gte: now } },
    _min: { date: true },
  });
  for (const group of groups) {
    if (group._min.date) result.set(group.offeringId, group._min.date);
  }
  return result;
}

async function reflectedOfferingIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await prisma.classOutcome.findMany({
    where: { offeringId: { in: ids }, instructorReflectedAt: { not: null } },
    select: { offeringId: true },
  });
  return new Set(rows.map((r) => r.offeringId));
}

async function feedbackCountByOffering(ids: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (ids.length === 0) return result;
  const groups = await prisma.classFeedback.groupBy({
    by: ["offeringId"],
    where: { offeringId: { in: ids } },
    _count: { _all: true },
  });
  for (const group of groups) result.set(group.offeringId, group._count._all);
  return result;
}

async function coInstructorCountByOffering(ids: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (ids.length === 0) return result;
  const groups = await prisma.regularInstructorAssignment.groupBy({
    by: ["offeringId"],
    where: {
      offeringId: { in: ids },
      role: { not: "LEAD" },
      status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
    },
    _count: { _all: true },
  });
  for (const group of groups) result.set(group.offeringId, group._count._all);
  return result;
}

async function curriculumMentorByInstructor(
  instructorIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [...new Set(instructorIds.filter(Boolean))];
  if (unique.length === 0) return result;
  const rows = await prisma.mentorship.findMany({
    where: {
      menteeId: { in: unique },
      status: "ACTIVE",
      programGroup: "INSTRUCTOR",
    },
    select: {
      menteeId: true,
      mentor: { select: { name: true, email: true } },
    },
    orderBy: { startDate: "desc" },
  });
  for (const row of rows) {
    if (result.has(row.menteeId)) continue;
    result.set(row.menteeId, row.mentor.name ?? row.mentor.email ?? "Mentor");
  }
  return result;
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function instructorLabel(item: AdminClassOperationsListItem, coCount: number): string {
  const total = (item.instructor ? 1 : 0) + coCount;
  if (total === 0) return "No instructor";
  if (total === 1) return item.instructor?.name ?? item.instructor?.email ?? "1 instructor";
  return `${total} instructors`;
}

function scheduleLabel(
  item: AdminClassOperationsListItem,
  nextSessionAt: Date | null
): string {
  if (nextSessionAt) return `Next session ${shortDate(nextSessionAt)}`;
  if (item._count.sessions === 0) return "No schedule";
  return `${shortDate(item.startDate)} – ${shortDate(item.endDate)}`;
}

function programLabel(item: AdminClassOperationsListItem): string | null {
  return item.partner?.name ?? item.chapter?.name ?? null;
}

/**
 * Build the full command-center view model from a loaded operations page.
 *
 * Note on partner confirmation: the schema has no partner-confirmation flag, so
 * `partnerConfirmationNeeded` is always false in live data today. The helper and
 * its tests still cover the state so the "Confirm partner" slot is ready the
 * moment a `Partner.confirmedAt` (or equivalent) field is added — see the
 * follow-up note in the final report.
 */
export async function loadClassCommandCenter(
  items: AdminClassOperationsListItem[],
  now: Date = new Date()
): Promise<ClassCommandCenter> {
  const ids = items.map((item) => item.id);

  const [openActions, overdueActions, nextSessions, reflected, feedbackCounts, coInstructors, mentors] =
    await Promise.all([
      safe(() => countOpenActionsByRelatedEntity("CLASS_OFFERING", ids), new Map<string, number>()),
      safe(() => countOverdueActions(ids), new Map<string, number>()),
      safe(() => nextSessionByOffering(ids, now), new Map<string, Date>()),
      safe(() => reflectedOfferingIds(ids), new Set<string>()),
      safe(() => feedbackCountByOffering(ids), new Map<string, number>()),
      safe(() => coInstructorCountByOffering(ids), new Map<string, number>()),
      safe(
        () => curriculumMentorByInstructor(items.map((item) => item.instructor?.id ?? "")),
        new Map<string, string>()
      ),
    ]);

  const signalRows: Array<ClassSignals & { id: string; title: string; partnerName: string | null }> =
    [];
  const rows: ClassCommandRow[] = [];
  const cards: ClassOperationsCardData[] = [];

  for (const item of items) {
    const nextSessionAt = nextSessions.get(item.id) ?? null;
    const signals: ClassSignals = {
      status: item.status,
      startDate: item.startDate,
      endDate: item.endDate,
      hasLeadInstructor: item.instructor != null,
      sessionCount: item._count.sessions,
      nextSessionAt,
      enrolledCount: item.confirmedCount,
      partnerLinked: item.partner != null,
      partnerConfirmationNeeded: false,
      openActionCount: openActions.get(item.id) ?? 0,
      overdueActionCount: overdueActions.get(item.id) ?? 0,
      hasReflection: reflected.has(item.id),
      feedbackCount: feedbackCounts.get(item.id) ?? 0,
    };

    const nextAction = deriveClassNextAction(signals, now);
    rows.push({
      id: item.id,
      title: item.title,
      status: item.status,
      programLabel: programLabel(item),
      partnerName: item.partner?.name ?? null,
      instructorLabel: instructorLabel(item, coInstructors.get(item.id) ?? 0),
      scheduleLabel: scheduleLabel(item, nextSessionAt),
      studentsLabel: `${item.confirmedCount} ${item.confirmedCount === 1 ? "student" : "students"}`,
      statusLabel: deriveClassStatusLabel(signals, now),
      nextAction,
      href: classNextActionHref(nextAction.kind, item.id),
    });

    signalRows.push({ ...signals, id: item.id, title: item.title, partnerName: item.partner?.name ?? null });

    cards.push(
      buildClassOperationsCard(item, {
        signals,
        curriculumMentorName: item.instructor
          ? mentors.get(item.instructor.id) ?? null
          : null,
        href: classNextActionHref(nextAction.kind, item.id),
      })
    );
  }

  return {
    rows,
    cards: sortClassOperationsCards(cards),
    counts: deriveThisTermCounts(signalRows, now),
    needsAction: buildNeedsAction(signalRows, now, 6),
  };
}
