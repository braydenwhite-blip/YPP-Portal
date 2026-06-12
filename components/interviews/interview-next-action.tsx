import Link from "next/link";
import { Kbd } from "@/components/interviews/ui";
import { buttonVariants, cn } from "@/components/ui-v2";
import type { InterviewTask } from "@/lib/interviews/types";

type InterviewNextActionProps = {
  task: InterviewTask | null;
  totalNeedsAction: number;
};

const CALLOUT_CLASS =
  "flex flex-col gap-1 rounded-[12px] border border-brand-600/20 bg-brand-50 p-5";

export default function InterviewNextAction({ task, totalNeedsAction }: InterviewNextActionProps) {
  if (!task) {
    return (
      <div className={CALLOUT_CLASS} role="status">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">
          All clear
        </span>
        <h3 className="text-[16px] font-bold text-ink">No urgent interview actions</h3>
        <p className="text-[13px] text-ink-muted">
          You&apos;re caught up. New interview tasks will appear here as they come in.
        </p>
      </div>
    );
  }

  const remaining = Math.max(totalNeedsAction - 1, 0);

  return (
    <section className={CALLOUT_CLASS} aria-label="Next best action">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">
        Next best action
      </span>
      <h3 className="text-[16px] font-bold text-ink">{task.title}</h3>
      <p className="text-[13px] text-ink-muted">{task.subtitle}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink">{task.detail}</p>
        <div className="inline-flex items-center gap-2.5">
          {remaining > 0 ? (
            <span className="text-[12px] text-ink-muted">{remaining} more after this</span>
          ) : null}
          <Link
            href={task.href}
            className={cn(buttonVariants({ variant: "primary", size: "sm" }), "no-underline")}
          >
            Open task
          </Link>
        </div>
      </div>
      <p className="mt-1 inline-flex items-center gap-2 text-[12px] text-ink-muted">
        <Kbd>G</Kbd>
        <span>then</span>
        <Kbd>I</Kbd>
        <span>opens the queue from anywhere</span>
      </p>
    </section>
  );
}
