import type {
  LeadershipActionCategory,
  LeadershipActionPriority,
  LeadershipActionStatus,
} from "@prisma/client";
import {
  CATEGORY_STYLES,
  PRIORITY_STYLES,
  STATUS_STYLES,
} from "@/lib/leadership-action-center/constants";
import { daysUntil, formatDueDate, isOverdue } from "@/lib/leadership-action-center/dates";

const PILL: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};

export function CategoryBadge({
  category,
  size = "default",
}: {
  category: LeadershipActionCategory;
  size?: "default" | "small";
}) {
  const style = CATEGORY_STYLES[category];
  return (
    <span
      style={{
        ...PILL,
        background: style.bg,
        color: style.fg,
        border: `1px solid ${style.border}`,
        padding: size === "small" ? "2px 8px" : PILL.padding,
        fontSize: size === "small" ? 11 : PILL.fontSize,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: style.accent,
        }}
      />
      {style.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: LeadershipActionStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span style={{ ...PILL, background: style.bg, color: style.fg }}>
      {style.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: LeadershipActionPriority }) {
  if (priority === "NORMAL") return null;
  const style = PRIORITY_STYLES[priority];
  return (
    <span style={{ ...PILL, background: style.bg, color: style.fg }}>
      {style.label}
    </span>
  );
}

export function DueDateBadge({ dueDate }: { dueDate: Date | null | undefined }) {
  if (!dueDate) {
    return (
      <span style={{ color: "#94a3b8", fontSize: 13 }}>—</span>
    );
  }
  const overdue = isOverdue(dueDate);
  const days = daysUntil(dueDate);
  let suffix = "";
  if (overdue) {
    suffix = ` (${Math.abs(days ?? 0)}d overdue)`;
  } else if (days === 0) {
    suffix = " (today)";
  } else if (days === 1) {
    suffix = " (tomorrow)";
  } else if (days !== null && days > 0 && days <= 7) {
    suffix = ` (in ${days}d)`;
  }
  return (
    <span
      style={{
        ...PILL,
        background: overdue ? "#fee2e2" : days !== null && days <= 1 ? "#fef3c7" : "#f1f5f9",
        color: overdue ? "#991b1b" : days !== null && days <= 1 ? "#92400e" : "#334155",
      }}
    >
      {formatDueDate(dueDate)}
      {suffix}
    </span>
  );
}

export function OfficerDiscussionBadge({
  needs,
  date,
}: {
  needs: boolean;
  date: Date | null | undefined;
}) {
  if (!needs) return null;
  return (
    <span
      style={{
        ...PILL,
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
      }}
      title={date ? `Officer discussion: ${formatDueDate(date)}` : "Needs officer discussion"}
    >
      ★ Officers{date ? ` · ${formatDueDate(date)}` : ""}
    </span>
  );
}
