import Link from "next/link";
import { Kbd } from "@/components/interviews/ui";
import type { InterviewTask } from "@/lib/interviews/types";

type InterviewNextActionProps = {
  task: InterviewTask | null;
  totalNeedsAction: number;
};

export default function InterviewNextAction({ task, totalNeedsAction }: InterviewNextActionProps) {
  if (!task) {
    return (
      <div className="iv-hub-next-action" role="status">
        <span className="iv-hub-next-action-kicker">All clear</span>
        <h3 className="iv-hub-next-action-title">No urgent interview actions</h3>
        <p className="iv-hub-next-action-helper">
          You're caught up. New interview tasks will appear here as they come in.
        </p>
      </div>
    );
  }

  const remaining = Math.max(totalNeedsAction - 1, 0);

  return (
    <section className="iv-hub-next-action" aria-label="Next best action">
      <span className="iv-hub-next-action-kicker">Next best action</span>
      <h3 className="iv-hub-next-action-title">{task.title}</h3>
      <p className="iv-hub-next-action-helper">{task.subtitle}</p>
      <div className="iv-hub-next-action-row">
        <p className="iv-hub-next-action-detail">{task.detail}</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {remaining > 0 ? (
            <span className="iv-hint-cluster">
              <span>{remaining} more after this</span>
            </span>
          ) : null}
          <Link href={task.href} className="button small" style={{ textDecoration: "none" }}>
            Open task
          </Link>
        </div>
      </div>
      <p className="iv-hint-cluster" style={{ marginTop: 4 }}>
        <Kbd>G</Kbd>
        <span>then</span>
        <Kbd>I</Kbd>
        <span>opens the queue from anywhere</span>
      </p>
    </section>
  );
}
