import { StatusBadge, type StatusTone } from "@/components/ui-v2";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { effectiveDeadline, isActionOverdue } from "@/lib/people-strategy/my-actions-selectors";

/**
 * Shared presentation bits for the YPP Portal action surfaces (My Actions,
 * All Actions, …). One place for the status → tone/label/rail mapping and the
 * initials avatar so every board reads the same and stays in sync with the
 * tracker. Pure render helpers — no data access.
 */

// Left-rail accent per effective status (mockup-faithful, small + named).
export const STATUS_RAIL: Record<string, string> = {
  OVERDUE: "#e5484d",
  BLOCKED: "#e5484d",
  IN_PROGRESS: "#6b21c8",
  NOT_STARTED: "#c9c9d6",
  COMPLETE: "#0e9f6e",
  DROPPED: "#c9c9d6",
};

export const STATUS_TONE: Record<string, StatusTone> = {
  OVERDUE: "danger",
  BLOCKED: "danger",
  IN_PROGRESS: "info",
  NOT_STARTED: "neutral",
  COMPLETE: "success",
  DROPPED: "neutral",
};

export const STATUS_LABEL: Record<string, string> = {
  OVERDUE: "Overdue",
  BLOCKED: "Blocked",
  IN_PROGRESS: "In progress",
  NOT_STARTED: "Not started",
  COMPLETE: "Done",
  DROPPED: "Dropped",
};

const AVATAR_COLORS = ["#6b21c8", "#0e9f6e", "#d9a300", "#2563eb", "#db2777", "#0891b2"];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function InitialsAvatar({ name, size = 21 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: avatarColor(name) }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Status pill for an action, computed from its effective (deadline-aware) status. */
export function ActionStatusBadge({ item, now }: { item: ActionItemWithRelations; now: Date }) {
  const status = effectiveStatus(item, now);
  return <StatusBadge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</StatusBadge>;
}

/** Due label + whether it should read as danger (overdue). */
export function dueLabel(item: ActionItemWithRelations, now: Date): { label: string; danger: boolean } {
  if (isActionOverdue(item, now)) return { label: "Overdue", danger: true };
  return { label: formatMonthDay(effectiveDeadline(item)), danger: false };
}
