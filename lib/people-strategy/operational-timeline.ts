import type { ActionItemWithRelations } from "./action-queries";
import type { MeetingCardDTO } from "./meeting-card-types";
import type {
  DecisionContextDTO,
  FollowUpContextDTO,
} from "./operational-context-queries";

/**
 * People Strategy Execution OS — Entity operational TIMELINE.
 *
 * The story of one YPP entity (a class / instructor / mentorship / partner /
 * person) as a single chronological stream: every meeting it was discussed in,
 * every action created and completed, every decision and open follow-up. A
 * leader can read the whole arc — "what's happened here, and what's pending" —
 * instead of piecing it together from separate panels.
 *
 * PURE: it composes data the entity context already loaded (no new query, no
 * DB), so an entity page derives the timeline for free alongside its panel.
 */

export type OperationalTimelineEventType =
  | "meeting"
  | "action_created"
  | "action_completed"
  | "decision"
  | "follow_up"
  | "health_signal";

export type OperationalTimelineSeverity = "neutral" | "positive" | "watch" | "critical";

export type OperationalTimelineEvent = {
  id: string;
  type: OperationalTimelineEventType;
  occurredAt: Date;
  title: string;
  description?: string;
  href?: string;
  severity: OperationalTimelineSeverity;
  source?: { type: string; id: string; label: string };
};

function describeMeeting(m: MeetingCardDTO): string {
  const bits = [m.categoryLabel];
  if (m.decisionCount > 0) bits.push(`${m.decisionCount} decision${m.decisionCount === 1 ? "" : "s"}`);
  if (m.linkedActionCount > 0) {
    bits.push(`${m.linkedActionCount} action${m.linkedActionCount === 1 ? "" : "s"}`);
  }
  return bits.join(" · ");
}

/**
 * Build the entity's operational timeline (newest first) from its already-loaded
 * context. Each action contributes a "created" event and, when complete, a second
 * "completed" event; decisions and open follow-ups carry their source meeting.
 * Deterministic — ties break on the stable event id. Pure.
 */
export function deriveOperationalTimeline(input: {
  meetings: MeetingCardDTO[];
  actions: ActionItemWithRelations[];
  decisions: DecisionContextDTO[];
  followUps: FollowUpContextDTO[];
  now?: Date;
  limit?: number;
}): OperationalTimelineEvent[] {
  const now = input.now ?? new Date();
  const events: OperationalTimelineEvent[] = [];

  for (const m of input.meetings) {
    events.push({
      id: `meeting:${m.id}`,
      type: "meeting",
      occurredAt: new Date(m.startISO),
      title: m.title,
      description: describeMeeting(m),
      href: `/meetings/${m.id}`,
      severity: m.effectiveStatus === "needs_follow_up" ? "watch" : "neutral",
    });
  }

  for (const a of input.actions) {
    events.push({
      id: `action_created:${a.id}`,
      type: "action_created",
      occurredAt: a.createdAt,
      title: a.title,
      description: a.lead?.name ? `Lead: ${a.lead.name}` : undefined,
      href: `/actions/${a.id}`,
      severity: "neutral",
    });
    if (a.status === "COMPLETE") {
      events.push({
        id: `action_completed:${a.id}`,
        type: "action_completed",
        occurredAt: a.completedAt ?? a.updatedAt,
        title: a.title,
        href: `/actions/${a.id}`,
        severity: "positive",
      });
    }
  }

  for (const d of input.decisions) {
    events.push({
      id: `decision:${d.id}`,
      type: "decision",
      occurredAt: new Date(d.createdISO),
      title: d.decision,
      description: d.decidedByName ? `Decided by ${d.decidedByName}` : undefined,
      href: `/meetings/${d.meetingId}`,
      severity: "neutral",
      source: { type: "meeting", id: d.meetingId, label: d.meetingTitle },
    });
  }

  for (const f of input.followUps) {
    events.push({
      id: `follow_up:${f.id}`,
      type: "follow_up",
      occurredAt: f.dueISO ? new Date(f.dueISO) : now,
      title: f.title,
      description: `${f.meetingTitle}${f.ownerName ? ` · ${f.ownerName}` : ""}`,
      href: `/meetings/${f.meetingId}`,
      severity: f.effectiveStatus === "overdue" ? "critical" : "watch",
      source: { type: "meeting", id: f.meetingId, label: f.meetingTitle },
    });
  }

  events.sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || a.id.localeCompare(b.id)
  );
  return typeof input.limit === "number" ? events.slice(0, input.limit) : events;
}
