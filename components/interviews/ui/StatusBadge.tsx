import type { ReactNode } from "react";

import { cn } from "@/components/ui-v2";

export type StatusBadgeTone =
  | "needs-action"
  | "scheduled"
  | "completed"
  | "blocked"
  | "info"
  | "warning"
  | "neutral";

/**
 * Interview-domain status badge (Tailwind, Phase 3D). Keeps the concrete
 * tone vocabulary the interview workflow uses (needs-action / scheduled /
 * completed / blocked) on the ui-v2 semantic color set.
 */
const TONE_CLASS: Record<StatusBadgeTone, string> = {
  "needs-action": "border-brand-600/20 bg-brand-100 text-brand-700",
  scheduled: "border-info-700/20 bg-info-100 text-info-700",
  completed: "border-success-700/20 bg-success-100 text-success-700",
  blocked: "border-danger-700/20 bg-danger-100 text-danger-700",
  info: "border-info-700/20 bg-info-100 text-info-700",
  warning: "border-warning-700/20 bg-warning-100 text-warning-700",
  neutral: "border-line bg-surface-soft text-ink-muted",
};

type StatusBadgeProps = {
  tone: StatusBadgeTone;
  children: ReactNode;
  className?: string;
};

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-[1.4]",
        TONE_CLASS[tone],
        className
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}
