"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/components/ui-v2";
import { compileCheckIn } from "@/lib/people-strategy/check-in-actions";
import {
  checkInCellStatus,
  describeCompileResult,
} from "@/lib/people-strategy/people-performance-selectors";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";

const STATUS_CLASS: Record<
  "success" | "warning" | "danger" | "info" | "neutral" | "brand",
  string
> = {
  success: "text-[#0e7c52]",
  warning: "text-[#b45309]",
  danger: "text-[#c0392b]",
  info: "text-[#5a1da8]",
  brand: "text-[#6b21c8]",
  neutral: "text-[#9a9ab0]",
};

/** Check-in status + a dedicated compile button (purple = action needed, green = done). */
export function PeopleCheckInCell({
  row,
  monthLabel,
  monthShortLabel,
  nextLabel,
  nextUrgent,
  quarterlyEnabled,
}: {
  row: PeoplePerformanceRow;
  monthLabel: string;
  monthShortLabel: string;
  nextLabel: string;
  nextUrgent: boolean;
  quarterlyEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const [compiledLocally, setCompiledLocally] = useState(false);

  const status = checkInCellStatus(row.facts, monthShortLabel);
  const needsCompile = row.facts.needsCheckIn;
  const needsRecompile = !needsCompile && row.facts.monthFeedback.newSinceCheckIn;
  const needsAction = needsCompile || needsRecompile;
  const isComplete = compiledLocally || (!needsAction && quarterlyEnabled);

  function handleCompile(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!quarterlyEnabled || pending || isComplete) return;

    setNote(null);
    startTransition(async () => {
      try {
        const result = await compileCheckIn({
          userId: row.id,
          month: new Date(`${row.facts.currentMonthKey}-01T00:00:00.000Z`),
        });
        setCompiledLocally(true);
        setNote(
          describeCompileResult(monthLabel, {
            feedbackResponses: result.feedbackResponses,
            isRecompile: result.isRecompile,
            newResponses: result.newResponses,
          })
        );
        router.refresh();
      } catch (err) {
        setCompiledLocally(false);
        setNote(
          err instanceof Error ? `Could not compile: ${err.message}` : "Could not compile."
        );
      }
    });
  }

  const actionLabel = pending
    ? "Compiling…"
    : needsRecompile
      ? "Recompile check-in"
      : "Compile check-in";

  return (
    <div className="flex min-w-[148px] flex-col gap-2">
      <span
        className={cn(
          "text-[13px] font-semibold leading-snug",
          nextUrgent ? "text-[#c0392b]" : "text-[#3a3a52]"
        )}
      >
        Next · {nextLabel}
      </span>
      <p
        className={cn(
          "m-0 text-[12.5px] font-medium leading-snug",
          STATUS_CLASS[status.tone]
        )}
      >
        {compiledLocally ? `${monthShortLabel} compiled` : status.text}
      </p>

      {quarterlyEnabled ? (
        needsAction && !compiledLocally ? (
          <button
            type="button"
            onClick={handleCompile}
            disabled={pending}
            className={cn(
              "inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white transition-colors",
              "bg-[#6b21c8] hover:bg-[#5a1da8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6b21c8]",
              pending && "cursor-wait opacity-80"
            )}
            aria-label={`${actionLabel} for ${row.name || row.email}`}
          >
            {actionLabel}
          </button>
        ) : (
          <span
            className={cn(
              "inline-flex w-full items-center justify-center rounded-lg border px-3 py-2 text-[12.5px] font-semibold",
              isComplete
                ? "border-[#a7f3d0] bg-[#ecfdf5] text-[#0e7c52]"
                : "border-[#ebebf2] bg-[#fafafd] text-[#717189]"
            )}
            aria-label={
              isComplete
                ? `${monthShortLabel} check-in compiled for ${row.name || row.email}`
                : `Check-in status for ${row.name || row.email}`
            }
          >
            {isComplete ? `✓ ${monthShortLabel} compiled` : status.text}
          </span>
        )
      ) : (
        <span className="text-[12px] text-[#9a9ab0]">Check-ins not enabled</span>
      )}

      {note ? (
        <p className="m-0 text-[11px] leading-snug text-[#717189]" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}
