"use client";

/**
 * Week selector for the Weekly Impact form. Prev/next step one reporting week
 * at a time; the date input jumps to any week (the server snaps the picked date
 * to that week's Monday). All navigation is URL-driven via `?week=`.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/components/ui-v2/cn";

const stepCls =
  "inline-flex h-9 items-center rounded-full border border-line-soft bg-surface px-3 text-[13px] font-semibold text-brand-800 no-underline transition-colors hover:border-brand-300 hover:bg-brand-50";

export function WeekNavigator({
  weekKey,
  weekLabel,
  prevKey,
  nextKey,
  currentKey,
  weekState,
}: {
  weekKey: string;
  weekLabel: string;
  prevKey: string;
  nextKey: string;
  currentKey: string;
  weekState: "past" | "current" | "future";
}) {
  const router = useRouter();
  const hrefFor = (key: string) =>
    key === currentKey ? "/my-weekly-impact" : `/my-weekly-impact?week=${key}`;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-line-card bg-surface px-3 py-2 shadow-card">
      <Link href={hrefFor(prevKey)} className={stepCls} aria-label="Previous week">
        ← Prev
      </Link>
      <Link href={hrefFor(nextKey)} className={stepCls} aria-label="Next week">
        Next →
      </Link>

      <div className="mx-1 flex items-center gap-2">
        <span className="text-[14px] font-bold text-ink">{weekLabel}</span>
        {weekState !== "current" && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              weekState === "past"
                ? "bg-idle-50 text-idle-700"
                : "bg-info-100 text-info-700"
            )}
          >
            {weekState === "past" ? "Back-fill" : "Ahead"}
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <input
          type="date"
          value={weekKey}
          aria-label="Jump to a week"
          className="h-9 rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink focus:border-brand-500 focus:outline-none"
          onChange={(e) => {
            if (e.target.value) router.push(`/my-weekly-impact?week=${e.target.value}`);
          }}
        />
        {weekState !== "current" && (
          <Link href="/my-weekly-impact" className={stepCls}>
            This week
          </Link>
        )}
      </div>
    </div>
  );
}
