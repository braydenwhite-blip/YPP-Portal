import type { ReactNode } from "react";

export type StatusBadgeTone =
  | "needs-action"
  | "scheduled"
  | "completed"
  | "blocked"
  | "info"
  | "warning"
  | "neutral";

type StatusBadgeProps = {
  tone: StatusBadgeTone;
  children: ReactNode;
  className?: string;
};

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  const cls = `iv-status-badge is-${tone}${className ? ` ${className}` : ""}`;
  return <span className={cls}>{children}</span>;
}
