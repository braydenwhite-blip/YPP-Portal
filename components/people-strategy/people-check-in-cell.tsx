"use client";

import { cn } from "@/components/ui-v2";
import {
  calendarDotBackground,
  checkInCellStatus,
} from "@/lib/people-strategy/people-performance-selectors";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";

const STATUS_CLASS = {
  success: "text-[#0e7c52]",
  warning: "text-[#b45309]",
  danger: "text-[#c0392b]",
  info: "text-[#5a1da8]",
  brand: "text-[#6b21c8]",
  neutral: "text-[#9a9ab0]",
} as const;

/** Status-only check-in column — opens the manage drawer on click. */
export function PeopleCheckInCell({
  row,
  monthShortLabel,
  onOpenCheckIns,
}: {
  row: PeoplePerformanceRow;
  monthShortLabel: string;
  onOpenCheckIns: (row: PeoplePerformanceRow) => void;
}) {
  const status = checkInCellStatus(row.facts, monthShortLabel);
  const missingCount = row.calendarDots.filter((d) => d.state === "missing").length;

  return (
    <button
      type="button"
      onClick={() => onOpenCheckIns(row)}
      className="flex min-w-[148px] flex-col gap-2 rounded-lg border-0 bg-transparent p-0 text-left transition-colors hover:opacity-90"
      aria-label={`Manage check-ins for ${row.name || row.email}`}
    >
      <div className="flex items-center gap-1" aria-hidden>
        {row.calendarDots.map((dot) => (
          <span
            key={dot.monthKey}
            title={`${dot.monthLabel}: ${
              dot.state === "not_due"
                ? "Not due yet"
                : dot.state === "missing"
                  ? "Not started"
                  : dot.state === "completed"
                    ? "In progress"
                    : "Complete"
            }`}
            className="size-2.5 rounded-full"
            style={{ background: calendarDotBackground(dot) }}
          />
        ))}
      </div>
      <p
        className={cn(
          "m-0 text-[13px] font-semibold leading-snug",
          STATUS_CLASS[status.tone]
        )}
      >
        {status.text}
      </p>
      <span className="text-[12px] font-semibold text-[#5a1da8]">
        Manage check-ins
        {missingCount > 0 ? ` · ${missingCount} missing` : ""}
      </span>
    </button>
  );
}
