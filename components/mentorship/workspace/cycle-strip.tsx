import { cn } from "@/components/ui-v2";
import type { CycleStripStep } from "@/lib/mentorship/lifecycle";

/**
 * The current review cycle as a plain-language lifecycle — Reflection →
 * Mentor review → (Approval) → Released → Acknowledged. One glance answers:
 * where does the review stand, what already happened, who moves next.
 */
export function CycleStrip({
  steps,
  cycleLabel,
}: {
  steps: CycleStripStep[];
  cycleLabel: string | null;
}) {
  const current = steps.find((s) => s.state === "current") ?? null;
  const allDone = steps.every((s) => s.state === "done");

  return (
    <div className="rounded-[12px] border border-line-soft bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {cycleLabel ? (
          <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
            {cycleLabel} cycle
          </p>
        ) : null}
        <p className="m-0 text-[12.5px] font-semibold text-ink">
          {allDone ? "This month's loop is complete." : current?.detail ?? ""}
        </p>
      </div>
      <ol className="m-0 mt-3 flex list-none items-center gap-0 overflow-x-auto p-0">
        {steps.map((step, i) => (
          <li key={step.key} className="flex min-w-0 flex-1 items-center">
            <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  step.state === "done"
                    ? "border-complete-700 bg-complete-700 text-white"
                    : step.state === "current"
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-line bg-surface text-ink-muted"
                )}
              >
                {step.state === "done" ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[11.5px]",
                  step.state === "current"
                    ? "font-bold text-ink"
                    : step.state === "done"
                      ? "font-medium text-ink-muted"
                      : "text-ink-muted"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "mx-1.5 h-px min-w-3 flex-1 self-start translate-y-2.5",
                  step.state === "done" ? "bg-complete-700" : "bg-line"
                )}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
