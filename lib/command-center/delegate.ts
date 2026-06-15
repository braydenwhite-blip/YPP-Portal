import type { QueueEngine } from "@/lib/queue/engine";
import {
  selectOwnerAccountabilityQueue,
  selectWaitingQueue,
} from "@/lib/queue/selectors";
import type { OwnerLane, QueueItem, QueueSeverity } from "@/lib/queue/types";

import {
  countWhere,
  initialsFromName,
  isOverdue,
  isUnowned,
  isWaiting,
  nextFollowUpLabel,
  type OperationalState,
  type OperationalTone,
  ownerStatus,
  pluralize,
  waitingOnOwnerCount,
} from "./shared";

/**
 * Delegate — the ownership & accountability workspace. What needs an owner,
 * what's overdue and should be reassigned, who's waiting on whom, and who owns
 * too much. Operational, never a people-health page.
 */

export type CcAssignmentItem = {
  id: string;
  title: string;
  typeLabel: string;
  whyItMatters: string;
  priorityLabel: string;
  priorityTone: OperationalTone;
  suggestedOwnerName: string | null;
  suggestedOwnerInitials: string | null;
  assignHref: string;
};

export type CcOwnerLane = {
  ownerId: string | null;
  ownerName: string;
  initials: string;
  status: OperationalState;
  open: number;
  overdue: number;
  meetings: number;
  topActions: Array<{ id: string; title: string; href: string }>;
  moreCount: number;
  nextFollowUpLabel: string | null;
  nextFollowUpTitle: string | null;
  waitingOnMe: number;
};

export type CcBatchTool = {
  id: string;
  label: string;
  itemsLabel: string;
  href: string;
  disabled: boolean;
};

export type CcWaitingPerson = {
  name: string;
  initials: string;
  reason: string;
  count: number;
};

export type DelegateWorkspaceVM = {
  briefHeadline: string;
  briefSub: string;
  summary: {
    needOwnership: number;
    overdueItems: number;
    needsReassignment: number;
    waitingOnPeople: number;
  };
  assignmentQueue: CcAssignmentItem[];
  ownerLanes: CcOwnerLane[];
  batchTools: CcBatchTool[];
  waitingOn: CcWaitingPerson[];
};

const PRIORITY_BY_SEVERITY: Record<QueueSeverity, { label: string; tone: OperationalTone }> = {
  critical: { label: "High impact", tone: "danger" },
  high: { label: "High impact", tone: "warning" },
  medium: { label: "Medium", tone: "info" },
  low: { label: "Low", tone: "neutral" },
};

function delegateHref(item: QueueItem): string {
  const all = [item.primaryAction, ...item.secondaryActions];
  return all.find((action) => action.resolution === "delegate")?.href ?? item.primaryAction.href;
}

/** Lightest-load real owner — the deterministic default suggestion. */
function lightestOwner(ownerLanes: OwnerLane[]): OwnerLane | null {
  return (
    ownerLanes
      .filter((lane) => !lane.unowned && lane.ownerName)
      .sort((a, b) => a.overdue - b.overdue || a.open - b.open || a.ownerName.localeCompare(b.ownerName))[0] ?? null
  );
}

function buildAssignmentQueue(engine: QueueEngine): CcAssignmentItem[] {
  const suggestion = lightestOwner(engine.ownerLanes);
  return selectOwnerAccountabilityQueue(engine.items)
    .slice(0, 6)
    .map((item) => {
      const priority = PRIORITY_BY_SEVERITY[item.severity];
      return {
        id: item.id,
        title: item.title,
        typeLabel: item.typeLabel,
        whyItMatters: item.why,
        priorityLabel: priority.label,
        priorityTone: priority.tone,
        suggestedOwnerName: suggestion?.ownerName ?? null,
        suggestedOwnerInitials: suggestion ? initialsFromName(suggestion.ownerName) : null,
        assignHref: delegateHref(item),
      };
    });
}

function buildOwnerLanes(engine: QueueEngine, now: Date): CcOwnerLane[] {
  return engine.ownerLanes
    .filter((lane) => !lane.unowned)
    .slice(0, 4)
    .map((lane) => {
      const meetings = lane.items.filter(
        (item) => item.type === "meeting" || item.type === "meeting_prep"
      ).length;
      const top = lane.items.slice(0, 3);
      const soonest = [...lane.items]
        .filter((item) => item.dueISO)
        .sort((a, b) => new Date(a.dueISO!).getTime() - new Date(b.dueISO!).getTime())[0];
      return {
        ownerId: lane.ownerId,
        ownerName: lane.ownerName,
        initials: initialsFromName(lane.ownerName),
        status: ownerStatus(lane),
        open: lane.open,
        overdue: lane.overdue,
        meetings,
        topActions: top.map((item) => ({ id: item.id, title: item.title, href: item.href })),
        moreCount: Math.max(0, lane.open - top.length),
        nextFollowUpLabel: nextFollowUpLabel(lane, now),
        nextFollowUpTitle: soonest?.title ?? null,
        waitingOnMe: waitingOnOwnerCount(lane),
      };
    });
}

function buildWaitingPeople(items: QueueItem[]): CcWaitingPerson[] {
  const byPerson = new Map<string, { count: number; reasons: Set<string> }>();
  for (const item of selectWaitingQueue(items)) {
    const name = item.relatedPerson?.label ?? item.ownerName;
    if (!name) continue;
    const entry = byPerson.get(name) ?? { count: 0, reasons: new Set<string>() };
    entry.count += 1;
    if (item.signals.needsDecision) entry.reasons.add("decisions");
    else if (item.type === "follow_up" || item.type === "partner_follow_up") entry.reasons.add("updates");
    else entry.reasons.add("input");
    byPerson.set(name, entry);
  }
  return [...byPerson.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([name, entry]) => ({
      name,
      initials: initialsFromName(name),
      reason: `Waiting on ${[...entry.reasons].join(", ")}`,
      count: entry.count,
    }));
}

export function buildDelegateWorkspace(input: {
  engine: QueueEngine;
  now: Date;
}): DelegateWorkspaceVM {
  const { engine, now } = input;
  const items = engine.items;

  const needOwnership = countWhere(items, isUnowned);
  const overdueItems = countWhere(items, isOverdue);
  const needsReassignment = countWhere(items, (i) => isOverdue(i) && !i.signals.missingOwner);
  const waitingOnPeople = buildWaitingPeople(items);

  const topUnowned =
    selectOwnerAccountabilityQueue(items).find((i) => i.signals.flagshipInitiative) ??
    selectOwnerAccountabilityQueue(items)[0] ??
    null;
  const highImpactName = topUnowned
    ? topUnowned.relatedInitiative?.title ?? topUnowned.title
    : null;

  return {
    briefHeadline:
      needOwnership > 0
        ? `${pluralize(needOwnership, "item")} need ownership.`
        : "Every active item has an owner.",
    briefSub:
      highImpactName && needOwnership > 0
        ? `${highImpactName} is the highest-impact unowned item.`
        : "Keep ownership clear and work moving forward.",
    summary: {
      needOwnership,
      overdueItems,
      needsReassignment,
      waitingOnPeople: waitingOnPeople.reduce((sum, person) => sum + person.count, 0),
    },
    assignmentQueue: buildAssignmentQueue(engine),
    ownerLanes: buildOwnerLanes(engine, now),
    batchTools: [
      {
        id: "assign-missing",
        label: "Assign missing owners",
        itemsLabel: pluralize(needOwnership, "item"),
        href: "/work/queue?queue=owner-accountability",
        disabled: needOwnership === 0,
      },
      {
        id: "reassign-overdue",
        label: "Reassign overdue items",
        itemsLabel: pluralize(needsReassignment, "item"),
        href: "/work?flag=overdue#browse-all",
        disabled: needsReassignment === 0,
      },
      {
        id: "add-to-meeting",
        label: "Add to next meeting",
        itemsLabel: pluralize(countWhere(items, (i) => i.resolutions.includes("discuss")), "item"),
        href: "/meet",
        disabled: countWhere(items, (i) => i.resolutions.includes("discuss")) === 0,
      },
      {
        id: "mark-reviewed",
        label: "Mark reviewed",
        itemsLabel: "Open the weekly review",
        href: "/review",
        disabled: false,
      },
    ],
    waitingOn: waitingOnPeople,
  };
}
