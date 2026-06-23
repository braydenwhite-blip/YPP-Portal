import type { ActionItemStatus } from "@prisma/client";

import type {
  ActionStatusBreakdown,
  DepartmentBar,
} from "@/lib/people-strategy/action-analytics";
import { departmentHeaderColor } from "@/lib/people-strategy/actions-hub-grouping";
import { ACTION_STATUS_LABELS } from "@/lib/people-strategy/constants";

const STATUS_ORDER: ActionItemStatus[] = [
  "COMPLETE",
  "IN_PROGRESS",
  "NOT_STARTED",
  "OVERDUE",
];

const STATUS_COLORS: Record<ActionItemStatus, string> = {
  COMPLETE: "#6b21c8",
  IN_PROGRESS: "#f59e0b",
  NOT_STARTED: "#c9c9d6",
  BLOCKED: "#f59e0b",
  OVERDUE: "#e5484d",
  DROPPED: "#c9c9d6",
};

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function StatusDonut({ breakdown }: { breakdown: ActionStatusBreakdown }) {
  const { total, counts } = breakdown;
  const slices = STATUS_ORDER.filter((s) => counts[s] > 0);
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative size-[108px] shrink-0">
        <svg width="108" height="108" viewBox="0 0 80 80" className="drop-shadow-sm">
          <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="#f1f1f6" strokeWidth="9" />
          {total > 0
            ? slices.map((status) => {
                const value = counts[status];
                const length = (value / total) * CIRCUMFERENCE;
                const segment = (
                  <circle
                    key={status}
                    cx="40"
                    cy="40"
                    r={RADIUS}
                    fill="none"
                    stroke={STATUS_COLORS[status]}
                    strokeWidth="9"
                    strokeLinecap="butt"
                    strokeDasharray={`${Math.max(length - 2, 0.001)} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 40 40)"
                  />
                );
                offset += length;
                return segment;
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-extrabold tracking-tight text-ink">{total}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            actions
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="flex items-center gap-2 text-[13px]">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: STATUS_COLORS[status] }}
            />
            <span className="flex-1 text-ink-muted">{ACTION_STATUS_LABELS[status]}</span>
            <strong className="tabular-nums text-ink">{counts[status]}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepartmentSnapshot({ bars }: { bars: DepartmentBar[] }) {
  const top = bars.slice(0, 3);
  const maxTotal = Math.max(...top.map((b) => b.total), 1);

  return (
    <div>
      <p className="m-0 mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-700">
        By department
      </p>
      {top.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">No actions match the current filters.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {top.map((bar) => {
            const widthPct = (bar.total / maxTotal) * 100;
            const overduePct = bar.total > 0 ? (bar.overdue / bar.total) * 100 : 0;
            const color = departmentHeaderColor(bar.slug ?? null);
            return (
              <div key={bar.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-semibold text-ink">{bar.name}</span>
                  <span className="tabular-nums text-ink-muted">
                    {bar.total}
                    {bar.overdue > 0 ? (
                      <span className="font-semibold text-[#e5484d]"> · {bar.overdue} overdue</span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#f1f1f6]">
                  <div
                    className="flex h-full rounded-full"
                    style={{
                      width: `${Math.max(widthPct, 6)}%`,
                      background: color,
                    }}
                  >
                    {overduePct > 0 ? (
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ef4444] to-[#dc2626]"
                        style={{ width: `${overduePct}%` }}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Combined status donut + department bars — mockup-faithful snapshot card. */
export function ActionsHubAnalytics({
  breakdown,
  bars,
}: {
  breakdown: ActionStatusBreakdown;
  bars: DepartmentBar[];
}) {
  return (
    <section className="rounded-[14px] border border-line-card bg-surface p-5 shadow-card sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <StatusDonut breakdown={breakdown} />
        <DepartmentSnapshot bars={bars} />
      </div>
    </section>
  );
}
