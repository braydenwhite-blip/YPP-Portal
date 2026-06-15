import type { QueueEngine } from "@/lib/queue/engine";
import type { QueueItem } from "@/lib/queue/types";

import {
  dueLabel,
  initialsFromName,
  type OperationalTone,
  operationalState,
  pluralize,
} from "./shared";

/**
 * Follow Up — the communications / waiting-on operating desk. Who we're waiting
 * on, what's open, what's overdue, who needs outreach, and what to send or
 * assign next. Connects follow-ups to actions, meetings, applicants, and
 * partners. Never fakes unsupported sending — composer actions route into real
 * creation / logging flows.
 */

export type CcFollowUpType =
  | "all"
  | "overdue"
  | "applicant"
  | "meeting"
  | "owner_update"
  | "partner"
  | "class_readiness"
  | "instructor";

export type CcFollowUpItem = {
  id: string;
  title: string;
  personName: string | null;
  personInitials: string | null;
  category: CcFollowUpType;
  categoryLabel: string;
  stateLabel: string;
  stateTone: OperationalTone;
  dueLabel: string | null;
  ageLabel: string | null;
  overdue: boolean;
  relatedLabel: string | null;
  href: string;
};

export type CcTypeChip = { key: CcFollowUpType; label: string; count: number };

export type CcComposerTarget = {
  id: string;
  name: string;
  initials: string;
  reason: string;
};

export type FollowUpWorkspaceVM = {
  brief: string;
  summary: {
    open: number;
    overdue: number;
    waitingOnPeople: number;
    needOutreach: number;
    resolvedThisWeek: number;
  };
  typeChips: CcTypeChip[];
  waitingPeople: Array<{
    name: string;
    initials: string;
    owes: string;
    relatedLabel: string | null;
    ageLabel: string | null;
    stateTone: OperationalTone;
    href: string;
  }>;
  topFollowUps: CcFollowUpItem[];
  composerTargets: CcComposerTarget[];
  stale: CcFollowUpItem[];
  byType: Array<{ key: CcFollowUpType; label: string; count: number }>;
  items: CcFollowUpItem[];
};

const CATEGORY_LABEL: Record<CcFollowUpType, string> = {
  all: "All follow-ups",
  overdue: "Overdue",
  applicant: "Applicant",
  meeting: "Meeting",
  owner_update: "Owner update",
  partner: "Partner",
  class_readiness: "Class readiness",
  instructor: "Instructor",
};

function categoryFor(item: QueueItem): CcFollowUpType {
  switch (item.type) {
    case "application":
      return "applicant";
    case "partner_request":
    case "partner_follow_up":
      return "partner";
    case "class_setup":
      return "class_readiness";
    case "advisor_check_in":
    case "mentorship":
      return "instructor";
    case "follow_up":
    case "meeting":
    case "meeting_prep":
      return item.relatedMeeting ? "meeting" : "owner_update";
    default:
      return "owner_update";
  }
}

/** The follow-up / waiting-on universe — outreach work, not internal actions. */
function isFollowUpItem(item: QueueItem): boolean {
  if (item.signals.waitingOn) return true;
  return [
    "follow_up",
    "partner_follow_up",
    "partner_request",
    "advisor_check_in",
    "application",
    "mentorship",
    "class_setup",
  ].includes(item.type);
}

function toFollowUpItem(item: QueueItem, now: Date): CcFollowUpItem {
  const state = operationalState(item);
  const category = categoryFor(item);
  const personName = item.relatedPerson?.label ?? item.ownerName;
  return {
    id: item.id,
    title: item.title,
    personName,
    personInitials: personName ? initialsFromName(personName) : null,
    category,
    categoryLabel: CATEGORY_LABEL[category],
    stateLabel: state.label,
    stateTone: state.tone,
    dueLabel: dueLabel(item.dueISO, now),
    ageLabel: item.ageLabel,
    overdue: item.signals.overdue,
    relatedLabel: item.relatedInitiative?.title ?? item.relatedMeeting?.title ?? null,
    href: item.href,
  };
}

export function buildFollowUpWorkspace(input: {
  engine: QueueEngine;
  now: Date;
}): FollowUpWorkspaceVM {
  const { engine, now } = input;
  const source = engine.items.filter(isFollowUpItem);
  const items = source.map((item) => toFollowUpItem(item, now));

  const overdue = source.filter((i) => i.signals.overdue);
  const waiting = source.filter((i) => i.signals.waitingOn);
  const stale = source.filter((i) => i.signals.stale);

  const peopleNames = new Set<string>();
  for (const item of waiting) {
    const name = item.relatedPerson?.label ?? item.ownerName;
    if (name) peopleNames.add(name);
  }

  const categoryCounts = new Map<CcFollowUpType, number>();
  for (const item of items) {
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  }

  const chipKeys: CcFollowUpType[] = [
    "all",
    "overdue",
    "applicant",
    "meeting",
    "owner_update",
    "partner",
    "class_readiness",
    "instructor",
  ];
  const typeChips: CcTypeChip[] = chipKeys
    .map((key) => ({
      key,
      label: CATEGORY_LABEL[key],
      count:
        key === "all" ? items.length : key === "overdue" ? overdue.length : categoryCounts.get(key) ?? 0,
    }))
    .filter((chip) => chip.key === "all" || chip.key === "overdue" || chip.count > 0);

  const waitingPeople = waiting.slice(0, 5).map((item) => {
    const name = item.relatedPerson?.label ?? item.ownerName ?? "Unassigned";
    const state = operationalState(item);
    return {
      name,
      initials: initialsFromName(name),
      owes: item.title,
      relatedLabel: item.relatedInitiative?.title ?? item.relatedMeeting?.title ?? null,
      ageLabel: item.ageLabel,
      stateTone: state.tone,
      href: item.href,
    };
  });

  const composerTargets: CcComposerTarget[] = [...peopleNames].slice(0, 6).map((name) => ({
    id: name,
    name,
    initials: initialsFromName(name),
    reason: "Waiting on a reply",
  }));

  const brief =
    source.length === 0
      ? "No follow-ups are open. Review upcoming meetings next."
      : `${pluralize(source.length, "follow-up")} ${source.length === 1 ? "is" : "are"} open. ${
          overdue.length > 0 ? `${overdue.length} ${overdue.length === 1 ? "is" : "are"} overdue. ` : ""
        }${
          peopleNames.size > 0
            ? `${peopleNames.size} ${peopleNames.size === 1 ? "person is" : "people are"} blocking active work.`
            : ""
        }`.trim();

  return {
    brief,
    summary: {
      open: source.length,
      overdue: overdue.length,
      waitingOnPeople: peopleNames.size,
      needOutreach: stale.length,
      resolvedThisWeek: engine.summary.clearedThisWeek,
    },
    typeChips,
    waitingPeople,
    topFollowUps: items.slice(0, 6),
    composerTargets,
    stale: items.filter((item) => source.find((s) => s.id === item.id)?.signals.stale).slice(0, 4),
    byType: chipKeys
      .filter((key) => key !== "all" && key !== "overdue")
      .map((key) => ({ key, label: CATEGORY_LABEL[key], count: categoryCounts.get(key) ?? 0 }))
      .filter((entry) => entry.count > 0),
    items,
  };
}
