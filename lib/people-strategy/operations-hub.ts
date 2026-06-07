import type { ActionItemStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { getInstructorReadiness, type InstructorReadiness } from "@/lib/instructor-readiness";

import {
  type ActionViewer,
  isLeadershipOrBoard,
  isOfficerTier,
} from "./action-permissions";
import {
  getActionsForEntities,
  getMyActionItems,
  relatedEntityRefKey,
  type ActionItemWithRelations,
} from "./action-queries";
import { effectiveStatus } from "./action-filters";
import { effectiveDeadline } from "./my-actions-selectors";
import {
  getMyTeachingClasses,
  listTrackerClasses,
  type TrackerClass,
} from "./class-tracker";
import { loadCommandCenter, type CommandCenterData } from "./command-center";
import { loadMentorshipHealth, type MentorshipHealth } from "./mentorship-health";
import {
  getMenteeSupport,
  getMenteeSupportMany,
  listActiveMentorships,
  type ActiveMentorshipSummary,
  type MenteeSupport,
} from "./connections";
import type { RelatedEntityRef } from "./constants";

/**
 * People Strategy Operating System — Operations Hub composer + loader.
 *
 * The derivation functions below are PURE (no DB, no session) so they can be
 * unit-tested and reused. `loadOperationsHub` resolves a trusted server viewer,
 * loads only what that viewer's role needs, and feeds the pure derivations.
 * Every load is wrapped in `safe()` so one empty / failing subsystem degrades to
 * an empty section instead of breaking the whole operating picture.
 */

const SETTLED_STATUSES: ReadonlySet<ActionItemStatus> = new Set<ActionItemStatus>([
  "COMPLETE",
  "DROPPED",
]);

// --- pure derivations --------------------------------------------------------

export type ClassActionSignal = {
  id: string;
  title: string;
  openCount: number;
  overdueCount: number;
};

export type ClassSignals = {
  /** Classes with at least one overdue linked action (worst first). */
  withOverdue: ClassActionSignal[];
  /** Classes with open linked actions but none overdue. */
  withOpen: ClassActionSignal[];
  /** Classes with no linked actions at all — no execution plan connected. */
  withNoActions: Array<{ id: string; title: string }>;
};

/**
 * Split classes into "has overdue work", "has open work", and "no plan yet" by
 * joining each class against its linked tracker actions. A class whose only
 * actions are settled (complete/dropped) is intentionally not flagged.
 */
export function deriveClassSignals(
  classes: TrackerClass[],
  actionsByRef: Map<string, ActionItemWithRelations[]>,
  now: Date
): ClassSignals {
  const withOverdue: ClassActionSignal[] = [];
  const withOpen: ClassActionSignal[] = [];
  const withNoActions: Array<{ id: string; title: string }> = [];

  for (const cls of classes) {
    const actions = actionsByRef.get(relatedEntityRefKey("CLASS_OFFERING", cls.id)) ?? [];
    if (actions.length === 0) {
      withNoActions.push({ id: cls.id, title: cls.title });
      continue;
    }
    let openCount = 0;
    let overdueCount = 0;
    for (const action of actions) {
      const status = effectiveStatus(action, now);
      if (!SETTLED_STATUSES.has(status)) openCount += 1;
      if (status === "OVERDUE") overdueCount += 1;
    }
    if (overdueCount > 0) {
      withOverdue.push({ id: cls.id, title: cls.title, openCount, overdueCount });
    } else if (openCount > 0) {
      withOpen.push({ id: cls.id, title: cls.title, openCount, overdueCount });
    }
  }

  withOverdue.sort((a, b) => b.overdueCount - a.overdueCount || b.openCount - a.openCount);
  withOpen.sort((a, b) => b.openCount - a.openCount);
  return { withOverdue, withOpen, withNoActions };
}

export type MentorshipGap = {
  id: string;
  menteeId: string;
  mentorName: string;
  menteeName: string;
};

/**
 * Active mentorships with no linked tracker action — relationships that exist
 * but are not connected to any execution plan.
 */
export function deriveMentorshipsWithoutActions(
  mentorships: ActiveMentorshipSummary[],
  actionsByRef: Map<string, ActionItemWithRelations[]>
): MentorshipGap[] {
  const gaps: MentorshipGap[] = [];
  for (const m of mentorships) {
    const actions = actionsByRef.get(relatedEntityRefKey("MENTORSHIP", m.id)) ?? [];
    if (actions.length === 0) {
      gaps.push({
        id: m.id,
        menteeId: m.menteeId,
        mentorName: m.mentorName,
        menteeName: m.menteeName,
      });
    }
  }
  return gaps;
}

export type InstructorGap = { id: string; name: string; classTitle: string };

/**
 * Lead instructors on active classes who have no active mentor supporting them.
 * De-duped by instructor (their first class is named for context).
 */
export function deriveInstructorsWithoutMentor(
  classes: TrackerClass[],
  supportByUserId: Map<string, MenteeSupport>
): InstructorGap[] {
  const seen = new Set<string>();
  const gaps: InstructorGap[] = [];
  for (const cls of classes) {
    const lead = cls.instructor;
    if (!lead?.id || seen.has(lead.id)) continue;
    seen.add(lead.id);
    if (!supportByUserId.has(lead.id)) {
      gaps.push({
        id: lead.id,
        name: lead.name ?? lead.email ?? "Unknown instructor",
        classTitle: cls.title,
      });
    }
  }
  return gaps;
}

export type OpenActionRow = {
  id: string;
  title: string;
  status: ActionItemStatus;
  deadline: Date;
  overdue: boolean;
};

/** The viewer's open actions (not complete/dropped), most-urgent deadline first. */
export function deriveOpenActions(
  actions: ActionItemWithRelations[],
  now: Date,
  limit = 8
): OpenActionRow[] {
  const rows = actions
    .map((action) => {
      const status = effectiveStatus(action, now);
      return {
        id: action.id,
        title: action.title,
        status,
        deadline: effectiveDeadline(action),
        overdue: status === "OVERDUE",
      };
    })
    .filter((row) => !SETTLED_STATUSES.has(row.status));
  rows.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  return rows.slice(0, limit);
}

// --- loader ------------------------------------------------------------------

export type OperationsHubRole =
  | "leadership"
  | "officer"
  | "mentor"
  | "instructor"
  | "member";

export type MentorMenteeRow = {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  openActionCount: number;
};

export type OperationsHubData = {
  role: OperationsHubRole;
  isOfficer: boolean;
  now: Date;
  // Officer / leadership operating picture.
  command: CommandCenterData | null;
  mentorshipHealth: MentorshipHealth | null;
  classSignals: ClassSignals | null;
  instructorsWithoutMentor: InstructorGap[];
  mentorshipsWithoutActions: MentorshipGap[];
  // Personal sections (mentor / instructor / member).
  myMentor: MenteeSupport | null;
  myOpenActions: OpenActionRow[];
  myClasses: TrackerClass[];
  myClassActionsByRef: Map<string, ActionItemWithRelations[]>;
  myReadiness: InstructorReadiness | null;
  myMentees: MentorMenteeRow[];
  /** Whether any section has content (drives the "nothing here yet" state). */
  hasData: boolean;
};

const EMPTY_HUB = (role: OperationsHubRole, now: Date): OperationsHubData => ({
  role,
  isOfficer: role === "officer" || role === "leadership",
  now,
  command: null,
  mentorshipHealth: null,
  classSignals: null,
  instructorsWithoutMentor: [],
  mentorshipsWithoutActions: [],
  myMentor: null,
  myOpenActions: [],
  myClasses: [],
  myClassActionsByRef: new Map(),
  myReadiness: null,
  myMentees: [],
  hasData: false,
});

/** Resolve a promise to a fallback if it rejects — section isolation. */
async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

function resolveRole(viewer: ActionViewer): OperationsHubRole {
  if (isLeadershipOrBoard(viewer)) return "leadership";
  if (isOfficerTier(viewer)) return "officer";
  if (viewer.roles.includes("MENTOR")) return "mentor";
  if (viewer.roles.includes("INSTRUCTOR")) return "instructor";
  return "member";
}

/** Mentees a mentor supports, each with their open linked-action count. */
async function loadMentorMentees(
  mentorId: string,
  viewer: ActionViewer,
  now: Date
): Promise<MentorMenteeRow[]> {
  const mentorships = await prisma.mentorship.findMany({
    where: { mentorId, status: "ACTIVE" },
    orderBy: [{ startDate: "desc" }],
    take: 100,
    select: {
      id: true,
      mentee: { select: { id: true, name: true, email: true } },
    },
  });
  if (mentorships.length === 0) return [];

  const refs: RelatedEntityRef[] = [];
  for (const m of mentorships) {
    refs.push({ type: "MENTORSHIP", id: m.id });
    refs.push({ type: "USER", id: m.mentee.id });
  }
  const actionsByRef = await safe(
    getActionsForEntities(refs, viewer),
    new Map<string, ActionItemWithRelations[]>()
  );

  return mentorships.map((m) => {
    const linked = [
      ...(actionsByRef.get(relatedEntityRefKey("MENTORSHIP", m.id)) ?? []),
      ...(actionsByRef.get(relatedEntityRefKey("USER", m.mentee.id)) ?? []),
    ];
    const openIds = new Set<string>();
    for (const action of linked) {
      if (!SETTLED_STATUSES.has(effectiveStatus(action, now))) openIds.add(action.id);
    }
    return {
      mentorshipId: m.id,
      menteeId: m.mentee.id,
      menteeName: m.mentee.name ?? m.mentee.email,
      openActionCount: openIds.size,
    };
  });
}

/**
 * Load the role-aware operating picture for `viewer`. Returns an empty hub when
 * the Action Tracker is off (the page itself also guards the Operations Hub
 * flag). Each subsystem is loaded independently so one failure or empty set
 * never breaks the page.
 */
export async function loadOperationsHub(
  viewer: ActionViewer,
  now: Date = new Date()
): Promise<OperationsHubData> {
  const role = resolveRole(viewer);
  if (!isActionTrackerEnabled()) return EMPTY_HUB(role, now);

  const hub = EMPTY_HUB(role, now);
  const officer = role === "officer" || role === "leadership";

  if (officer) {
    const [command, mentorshipHealth, classes, activeMentorships] = await Promise.all([
      safe(loadCommandCenter(viewer, now), null),
      safe(loadMentorshipHealth(now), null),
      safe(listTrackerClasses(), [] as TrackerClass[]),
      safe(listActiveMentorships(), [] as ActiveMentorshipSummary[]),
    ]);

    const refs: RelatedEntityRef[] = [
      ...classes.map((c) => ({ type: "CLASS_OFFERING" as const, id: c.id })),
      ...activeMentorships.map((m) => ({ type: "MENTORSHIP" as const, id: m.id })),
    ];
    const [actionsByRef, supportByUser] = await Promise.all([
      safe(getActionsForEntities(refs, viewer), new Map<string, ActionItemWithRelations[]>()),
      safe(
        getMenteeSupportMany(classes.map((c) => c.instructor.id)),
        new Map<string, MenteeSupport>()
      ),
    ]);

    hub.command = command;
    hub.mentorshipHealth = mentorshipHealth;
    hub.classSignals = deriveClassSignals(classes, actionsByRef, now);
    hub.mentorshipsWithoutActions = deriveMentorshipsWithoutActions(
      activeMentorships,
      actionsByRef
    );
    hub.instructorsWithoutMentor = deriveInstructorsWithoutMentor(classes, supportByUser);
  } else {
    // Personal operating picture for mentors / instructors / members.
    const [myActions, myMentor] = await Promise.all([
      safe(getMyActionItems(viewer.id, viewer), [] as ActionItemWithRelations[]),
      safe(getMenteeSupport(viewer.id), null),
    ]);
    hub.myOpenActions = deriveOpenActions(myActions, now);
    hub.myMentor = myMentor;

    if (role === "mentor") {
      hub.myMentees = await safe(loadMentorMentees(viewer.id, viewer, now), []);
    }

    if (role === "instructor" || viewer.roles.includes("INSTRUCTOR")) {
      const [classes, readiness] = await Promise.all([
        safe(getMyTeachingClasses(viewer.id), [] as TrackerClass[]),
        safe(getInstructorReadiness(viewer.id), null),
      ]);
      hub.myClasses = classes;
      hub.myReadiness = readiness;
      if (classes.length > 0) {
        const refs: RelatedEntityRef[] = classes.map((c) => ({
          type: "CLASS_OFFERING",
          id: c.id,
        }));
        hub.myClassActionsByRef = await safe(
          getActionsForEntities(refs, viewer),
          new Map<string, ActionItemWithRelations[]>()
        );
      }
    }
  }

  hub.hasData = hubHasData(hub);
  return hub;
}

export function hubHasData(hub: OperationsHubData): boolean {
  if (hub.command && hub.command.consideredCount > 0) return true;
  if (hub.mentorshipHealth && hub.mentorshipHealth.activePairs > 0) return true;
  if (hub.classSignals) {
    const { withOverdue, withOpen, withNoActions } = hub.classSignals;
    if (withOverdue.length || withOpen.length || withNoActions.length) return true;
  }
  if (hub.instructorsWithoutMentor.length) return true;
  if (hub.mentorshipsWithoutActions.length) return true;
  if (hub.myOpenActions.length) return true;
  if (hub.myClasses.length) return true;
  if (hub.myMentees.length) return true;
  if (hub.myMentor) return true;
  return false;
}
