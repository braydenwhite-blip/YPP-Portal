"use client";

import { cn } from "@/components/ui-v2";

interface StepperStep {
  label: string;
  complete: boolean;
  active: boolean;
  detail: string;
}

interface ApplicationProgressStepperProps {
  steps: StepperStep[];
}

/**
 * Compact horizontal progress strip — shows where the application is without
 * dominating the page. Active step detail sits under the strip.
 */
export default function ApplicationProgressStepper({
  steps,
}: ApplicationProgressStepperProps) {
  const active = steps.find((step) => step.active) ?? steps.find((step) => !step.complete);
  const activeIndex = active ? steps.indexOf(active) : steps.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 sm:gap-2">
        {steps.map((step, idx) => {
          const isPast = step.complete && !step.active;
          const isCurrent = step.active || idx === activeIndex;
          return (
            <li key={step.label} className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              {idx > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "hidden h-px w-3 shrink-0 sm:block sm:w-5",
                    isPast || isCurrent ? "bg-brand-300" : "bg-line"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
                  isPast && "bg-complete-50 text-complete-700",
                  isCurrent && !isPast && "bg-brand-50 text-brand-800 ring-1 ring-brand-200",
                  !isPast && !isCurrent && "bg-surface-soft text-ink-muted"
                )}
                title={step.detail}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                    isPast && "bg-complete-600 text-white",
                    isCurrent && !isPast && "bg-brand-600 text-white",
                    !isPast && !isCurrent && "bg-line text-ink-muted"
                  )}
                >
                  {isPast ? "✓" : idx + 1}
                </span>
                <span className="truncate">{step.label.replace(/^Application /, "")}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {active ? (
        <p className="m-0 text-[13px] leading-snug text-ink-muted">
          <span className="font-semibold text-ink">{active.label}:</span> {active.detail}
        </p>
      ) : null}
    </div>
  );
}
