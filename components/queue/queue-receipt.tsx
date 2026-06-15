import Link from "next/link";

import { ButtonLink, cn } from "@/components/ui-v2";
import { QUEUE_DEFER_REASON_LABELS } from "@/lib/queue/types";

import {
  CheckCircleIcon,
  DeferIcon,
  DelegateIcon,
  DiscussIcon,
  SparkleIcon,
} from "./icons";
import { type SessionDecision, tallyDecisions } from "./session";

/**
 * QueueReceipt — the completion receipt after a queue session (Queue Engine §C).
 * Concrete counts only: resolved / delegated / to discuss / deferred, the
 * remaining open loops, the deferred items with their reasons, and a clear path
 * into the recommended next queue. No vague "great job" — operational closure.
 */

export function QueueReceipt({
  queueLabel,
  decisions,
  remaining,
  nextQueueHref,
  nextQueueLabel,
  onRestart,
  className,
}: {
  queueLabel: string;
  decisions: SessionDecision[];
  remaining: number;
  nextQueueHref?: string;
  nextQueueLabel?: string;
  onRestart?: () => void;
  className?: string;
}) {
  const tally = tallyDecisions(decisions);
  const stats = [
    { label: "Resolved", value: tally.resolved, Icon: CheckCircleIcon, tone: "text-success-700" },
    { label: "Delegated", value: tally.delegated, Icon: DelegateIcon, tone: "text-info-700" },
    { label: "To discuss", value: tally.discussed, Icon: DiscussIcon, tone: "text-brand-700" },
    { label: "Deferred", value: tally.deferred, Icon: DeferIcon, tone: "text-warning-700" },
  ];
  const deferred = decisions.filter((d) => d.resolution === "defer");
  const actionable = decisions.filter((d) => d.resolution !== "defer");

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-[20px] border border-line-soft bg-surface p-8 shadow-card",
        className
      )}
    >
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success-100 text-success-700">
          <CheckCircleIcon className="size-7" />
        </span>
        <h2 className="m-0 text-[22px] font-bold text-ink">Queue session complete</h2>
        <p className="m-0 text-[13.5px] text-ink-muted">
          You ran the <span className="font-semibold text-ink">{queueLabel}</span> — here&apos;s
          what you decided.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(({ label, value, Icon, tone }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 rounded-[12px] border border-line-soft bg-surface-soft p-4"
          >
            <Icon className={cn("size-5", tone)} />
            <span className="text-[24px] font-bold leading-none text-ink">{value}</span>
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-[12px] border border-line-soft bg-surface-soft px-4 py-3">
        <span className="text-[13px] text-ink-muted">Open loops remaining in this queue</span>
        <span className="text-[18px] font-bold text-ink">{remaining}</span>
      </div>

      {actionable.length > 0 ? (
        <section>
          <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">
            Follow through — open each to execute
          </p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {actionable.map((d) => (
              <li
                key={d.item.id}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-line-soft px-3.5 py-2"
              >
                <span className="min-w-0 truncate text-[13px] text-ink">{d.item.title}</span>
                <Link
                  href={d.item.primaryAction.href}
                  className="shrink-0 text-[12.5px] font-semibold text-brand-700 hover:underline"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {deferred.length > 0 ? (
        <section>
          <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">
            Deferred — with reasons
          </p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {deferred.map((d) => (
              <li
                key={d.item.id}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-warning-700/20 bg-warning-100/30 px-3.5 py-2"
              >
                <span className="min-w-0 truncate text-[13px] text-ink">{d.item.title}</span>
                <span className="shrink-0 text-[12px] font-semibold text-warning-700">
                  {d.reason ? QUEUE_DEFER_REASON_LABELS[d.reason] : "Deferred"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-line-soft pt-5">
        {nextQueueHref ? (
          <ButtonLink href={nextQueueHref} variant="primary" size="md">
            <SparkleIcon className="size-4" />
            {nextQueueLabel ? `Run ${nextQueueLabel}` : "Recommended next queue"}
          </ButtonLink>
        ) : null}
        {onRestart ? (
          <button
            type="button"
            onClick={onRestart}
            className="text-[13px] font-semibold text-brand-700 hover:underline"
          >
            Run this queue again
          </button>
        ) : null}
        <ButtonLink href="/work" variant="secondary" size="md">
          Back to Mission Control
        </ButtonLink>
      </footer>
    </div>
  );
}
