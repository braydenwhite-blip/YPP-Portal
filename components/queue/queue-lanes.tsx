import Link from "next/link";

import { cn } from "@/components/ui-v2";
import type { QueueItem, QueueTone } from "@/lib/queue/types";

import { ArrowRightIcon } from "./icons";

/**
 * QueueLanesGrid — the cockpit lanes overview: My Queue, Leadership, Waiting On,
 * Decisions, Meeting Prep, Recently Cleared. Each lane is a glanceable card with
 * a live count, the top loop, and a one-click run — not another list.
 */

const ACCENT: Record<QueueTone, { bar: string; chip: string }> = {
  danger: { bar: "bg-danger-700", chip: "bg-danger-100 text-danger-700" },
  warning: { bar: "bg-warning-700", chip: "bg-warning-100 text-warning-700" },
  info: { bar: "bg-info-700", chip: "bg-info-100 text-info-700" },
  brand: { bar: "bg-brand-600", chip: "bg-brand-100 text-brand-700" },
  success: { bar: "bg-success-700", chip: "bg-success-100 text-success-700" },
  neutral: { bar: "bg-line", chip: "bg-brand-50 text-brand-700" },
};

export function LaneCard({
  label,
  tagline,
  count,
  accent = "brand",
  topItem,
  runHref,
  footnote,
}: {
  label: string;
  tagline: string;
  count: number;
  accent?: QueueTone;
  topItem?: QueueItem | null;
  runHref?: string;
  footnote?: string;
}) {
  const tone = ACCENT[accent];
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-7 w-1 rounded-full", tone.bar)} aria-hidden />
          <span className="text-[14px] font-bold text-ink">{label}</span>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", tone.chip)}>{count}</span>
      </div>
      <p className="m-0 mt-1.5 text-[12px] leading-snug text-ink-muted">{tagline}</p>
      {topItem ? (
        <p className="m-0 mt-2.5 truncate text-[12.5px] font-semibold text-ink">
          <span className="text-ink-muted">Top: </span>
          {topItem.title}
        </p>
      ) : footnote ? (
        <p className="m-0 mt-2.5 text-[12.5px] font-semibold text-ink-muted">{footnote}</p>
      ) : null}
      {runHref && count > 0 ? (
        <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-700">
          Run queue <ArrowRightIcon className="size-3.5" />
        </span>
      ) : null}
    </>
  );

  const className =
    "flex flex-col rounded-[14px] border border-line-soft bg-surface/80 p-4 shadow-card backdrop-blur transition-all duration-200";

  if (runHref && count > 0) {
    return (
      <Link
        href={runHref}
        className={cn(className, "hover:-translate-y-0.5 hover:shadow-overlay motion-reduce:hover:translate-y-0")}
      >
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

export function QueueLanesGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}
