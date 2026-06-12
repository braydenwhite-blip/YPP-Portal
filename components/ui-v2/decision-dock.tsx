import { cn } from "./cn";

export type DecisionOption = {
  /** The real decision action label ("Approve", "Request more information"). */
  label: string;
  /** One concrete sentence: what choosing this does. */
  description: string;
};

/**
 * Decision dock (master plan §16): the always-visible "what can the decider
 * do next" surface on decision-first record pages. It names the current
 * state, offers ONE primary route into the real decision workflow, and lists
 * the actual decision vocabulary (mapped 1:1 to server-side enums by the
 * caller) so the options are never a mystery. It deliberately does not
 * re-implement decision forms — committing stays in the workflow that owns
 * validation and side effects.
 */
export function DecisionDock({
  statusLabel,
  statusDetail,
  primaryAction,
  options,
  tone = "default",
  className,
}: {
  /** The decision state, concretely ("Decision needed", "Approved Jun 2"). */
  statusLabel: string;
  statusDetail?: string;
  /** The one main route forward (ButtonLink into the real workflow). */
  primaryAction?: React.ReactNode;
  /** The real decision vocabulary available at this stage. */
  options?: DecisionOption[];
  tone?: "default" | "attention";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[12px] border p-5 shadow-card",
        tone === "attention"
          ? "border-warning-700/30 bg-warning-100/40"
          : "border-line-soft bg-surface",
        className
      )}
      aria-label="Decision dock"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className={cn(
              "m-0 text-[11.5px] font-bold uppercase tracking-[0.06em]",
              tone === "attention" ? "text-warning-700" : "text-ink-muted"
            )}
          >
            Decision
          </p>
          <p className="m-0 text-[16px] font-bold text-ink">{statusLabel}</p>
          {statusDetail ? (
            <p className="m-0 text-[12.5px] text-ink-muted">{statusDetail}</p>
          ) : null}
        </div>
        {primaryAction ? <div className="shrink-0">{primaryAction}</div> : null}
      </div>
      {options && options.length > 0 ? (
        <div className="mt-4 grid gap-1.5 border-t border-line-soft pt-3 sm:grid-cols-2">
          {options.map((option) => (
            <p key={option.label} className="m-0 text-[12.5px] leading-snug">
              <span className="font-semibold text-ink">{option.label}</span>
              <span className="text-ink-muted"> — {option.description}</span>
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
