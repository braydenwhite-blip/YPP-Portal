import type {
  ActionItemStatus,
  ActionPriority,
  ClassOfferingStatus,
  OfficerMeetingStatus,
} from "@prisma/client";

import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
} from "@/lib/people-strategy/constants";
import { actionTypeLabel } from "@/lib/people-strategy/action-types";

/**
 * Shared pill primitives for the People Strategy / Action Tracker surfaces.
 *
 * `Pill` is the small visual primitive; every tone maps onto the existing
 * design-system `.pill.*` classes (globals.css) so colors stay tokenized.
 *
 * `StatusPill` is the single source of truth for turning a status enum into a
 * pill, used by action detail, all-actions, my-actions, classes, and officer
 * meetings. It covers the three status domains the tracker renders — action
 * items, class offerings, and officer meetings — so no surface has to keep its
 * own tone/label table. The default call site (`<StatusPill status={...} />`)
 * stays trivially simple for the common action-item case.
 */

export type PillTone =
  | "neutral"
  | "info"
  | "success"
  | "overdue"
  | "warning"
  | "purple";

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`pill pill-${tone} pill-small${className ? ` ${className}` : ""}`}>
      {children}
    </span>
  );
}

const ACTION_STATUS_TONE: Record<ActionItemStatus, PillTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "warning",
  COMPLETE: "success",
  OVERDUE: "overdue",
  DROPPED: "neutral",
};

const ACTION_PRIORITY_TONE: Record<ActionPriority, PillTone> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "overdue",
};

/**
 * Priority badge. LOW and MEDIUM are intentionally quiet (LOW renders nothing
 * by default via `hideLow`, so the common case stays uncluttered); HIGH/URGENT
 * draw the eye on scannable lists.
 */
export function PriorityPill({
  priority,
  hideLow = false,
}: {
  priority: ActionPriority;
  hideLow?: boolean;
}) {
  if (hideLow && priority === "LOW") return null;
  return <Pill tone={ACTION_PRIORITY_TONE[priority]}>{ACTION_PRIORITY_LABELS[priority]}</Pill>;
}

/**
 * Action Type badge. Quiet by design (neutral tone) so it labels the KIND of
 * work without competing with the status/priority pills; renders nothing for an
 * untyped action so the common case stays uncluttered.
 */
export function ActionTypePill({ actionType }: { actionType: string | null }) {
  if (!actionType) return null;
  return <Pill tone="neutral">{actionTypeLabel(actionType)}</Pill>;
}

const CLASS_STATUS: Record<ClassOfferingStatus, { tone: PillTone; label: string }> = {
  DRAFT: { tone: "neutral", label: "Draft" },
  PUBLISHED: { tone: "info", label: "Published" },
  IN_PROGRESS: { tone: "success", label: "In progress" },
  COMPLETED: { tone: "neutral", label: "Completed" },
  CANCELLED: { tone: "overdue", label: "Cancelled" },
};

const MEETING_STATUS: Record<OfficerMeetingStatus, { tone: PillTone; label: string }> = {
  SCHEDULED: { tone: "purple", label: "Scheduled" },
  COMPLETED: { tone: "success", label: "Completed" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
};

type StatusPillProps =
  | { kind?: "action"; status: ActionItemStatus }
  | { kind: "class"; status: ClassOfferingStatus }
  | { kind: "meeting"; status: OfficerMeetingStatus };

export function StatusPill(props: StatusPillProps) {
  if (props.kind === "class") {
    const { tone, label } = CLASS_STATUS[props.status];
    return <Pill tone={tone}>{label}</Pill>;
  }
  if (props.kind === "meeting") {
    const { tone, label } = MEETING_STATUS[props.status];
    return <Pill tone={tone}>{label}</Pill>;
  }
  return (
    <Pill tone={ACTION_STATUS_TONE[props.status] ?? "neutral"}>
      {ACTION_STATUS_LABELS[props.status]}
    </Pill>
  );
}
