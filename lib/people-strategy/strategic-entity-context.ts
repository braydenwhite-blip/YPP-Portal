import type { ActionItemWithRelations } from "./action-queries";
import type { MeetingCardDTO } from "./meetings-queries";
import {
  deriveStrategicContextForAction,
  deriveStrategicContextForMeeting,
  type StrategicContextInitiative,
  type StrategicContextProject,
} from "./strategic-context";
import {
  deriveTouchpointTimeline,
  type TouchpointTimeline,
} from "./strategic-touchpoint-timeline";

/**
 * Strategic context for an ENTITY (3.5, Phase G).
 *
 * An entity (partner / class / instructor / mentorship / person) is not a single
 * work item, so we ladder it up by aggregating the strategic context of the work
 * already attached to it: every action and meeting is run through the existing
 * per-item matchers and the unique initiatives / projects are collected. The
 * entity's own touchpoint timeline is derived from the same actions + meetings.
 *
 * Pure: callers pass the actions + meetings they already fetched
 * (getOperationalContextForEntity) — no new query, no new backend concept.
 */

export type StrategicEntityContext = {
  isStrategic: boolean;
  initiatives: StrategicContextInitiative[];
  projects: StrategicContextProject[];
  timeline: TouchpointTimeline;
  openActionCount: number;
  overdueActionCount: number;
  nextFollowUpISO: string | null;
};

const OPEN_STATUSES = new Set(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "OVERDUE"]);

export function deriveStrategicEntityContext(input: {
  actions?: ActionItemWithRelations[];
  meetings?: MeetingCardDTO[];
  now?: Date;
}): StrategicEntityContext {
  const actions = input.actions ?? [];
  const meetings = input.meetings ?? [];
  const now = input.now ?? new Date();

  const initiatives = new Map<string, StrategicContextInitiative>();
  const projects = new Map<string, StrategicContextProject>();

  const absorb = (ctx: {
    initiatives: StrategicContextInitiative[];
    projects: StrategicContextProject[];
  }) => {
    for (const initiative of ctx.initiatives) {
      if (!initiatives.has(initiative.id)) initiatives.set(initiative.id, initiative);
    }
    for (const project of ctx.projects) {
      if (!projects.has(project.id)) projects.set(project.id, project);
    }
  };

  for (const action of actions) {
    absorb(deriveStrategicContextForAction(action));
  }
  for (const meeting of meetings) {
    absorb(
      deriveStrategicContextForMeeting({
        title: meeting.title,
        purpose: meeting.purpose,
        category: meeting.category,
        relatedEntityType: meeting.relatedEntityType,
        relatedEntityId: meeting.relatedEntityId,
      }),
    );
  }

  const timeline = deriveTouchpointTimeline({ context: {}, actions, meetings, now });
  const openActionCount = actions.filter((a) => OPEN_STATUSES.has(a.status)).length;

  return {
    isStrategic: initiatives.size > 0 || projects.size > 0,
    initiatives: [...initiatives.values()],
    projects: [...projects.values()],
    timeline,
    openActionCount,
    overdueActionCount: timeline.counts.overdue,
    nextFollowUpISO: timeline.upcoming[0]?.dateISO ?? null,
  };
}
