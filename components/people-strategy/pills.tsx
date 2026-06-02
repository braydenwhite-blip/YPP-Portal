import type { ActionItemStatus } from "@prisma/client";

import { ACTION_STATUS_LABELS } from "@/lib/people-strategy/constants";

/**
 * Shared pill primitives for the People Strategy / Action Tracker surfaces.
 *
 * These replace the three near-identical inline `Pill` components that used to
 * live in all-actions, class-tracker-row, and officer-meetings, and the bespoke
 * inline status markers in the detail card. Every tone maps onto the existing
 * design-system `.pill.*` classes (globals.css) so colors stay tokenized and
 * consistent with the rest of the portal.
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

/** Status → pill tone mapping, shared by every Action Tracker surface so a
 *  status reads the same wherever it appears. */
const STATUS_TONE: Record<ActionItemStatus, PillTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  COMPLETE: "success",
  OVERDUE: "overdue",
};

export function StatusPill({ status }: { status: ActionItemStatus }) {
  return <Pill tone={STATUS_TONE[status] ?? "neutral"}>{ACTION_STATUS_LABELS[status]}</Pill>;
}
