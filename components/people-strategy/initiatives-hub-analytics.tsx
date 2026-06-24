import {
  INITIATIVE_HEALTH_META,
  type InitiativeHealthLevel,
} from "@/lib/people-strategy/strategic-initiative-health";
import {
  INITIATIVE_HEALTH_ORDER,
  type InitiativeAreaBar,
  type InitiativeHealthBreakdown,
} from "@/lib/people-strategy/initiatives-hub-grouping";

/** Shared health → color map (donut, group headers, dots). */
export const INITIATIVE_HEALTH_COLORS: Record<InitiativeHealthLevel, string> = {
  critical: "#e5484d",
  at_risk: "#f59e0b",
  drifting: "#6366f1",
  healthy: "#16a34a",
  completed: "#8b8b9e",
  archived: "#c9c9d6",
};

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function HealthDonut({ breakdown }: { breakdown: InitiativeHealthBreakdown }) {
  const { total, counts } = breakdown;
  const slices = INITIATIVE_HEALTH_ORDER.filter((level) => counts[level] > 0);
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative size-[108px] shrink-0">
        <svg width="108" height="108" viewBox="0 0 80 80" className="drop-shadow-sm">
          <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="#f1f1f6" strokeWidth="9" />
          {total > 0
            ? slices.map((level) => {
                const value = counts[level];
                const length = (value / total) * CIRCUMFERENCE;
                const segment = (
                  <circle
                    key={level}
                    cx="40"
                    cy="40"
                    r={RADIUS}
                    fill="none"
                    stroke={INITIATIVE_HEALTH_COLORS[level]}
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
            initiative{total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {INITIATIVE_HEALTH_ORDER.map((level) => (
          <div key={level} className="flex items-center gap-2 text-[13px]">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: INITIATIVE_HEALTH_COLORS[level] }}
            />
            <span className="flex-1 text-ink-muted">{INITIATIVE_HEALTH_META[level].label}</span>
            <strong className="tabular-nums text-ink">{counts[level]}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function AreaSnapshot({ bars }: { bars: InitiativeAreaBar[] }) {
  const top = bars.slice(0, 5);
  const maxTotal = Math.max(...top.map((b) => b.total), 1);

  return (
    <div>
      <p className="m-0 mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-700">
        By area
      </p>
      {top.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">No initiatives in this view yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {top.map((bar) => {
            const widthPct = (bar.total / maxTotal) * 100;
            return (
              <div key={bar.label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-semibold text-ink">{bar.label}</span>
                  <span className="tabular-nums text-ink-muted">{bar.total}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#f1f1f6]">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${Math.max(widthPct, 6)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Health donut + per-area bars — the Initiatives hub snapshot card. */
export function InitiativesHubAnalytics({
  breakdown,
  bars,
}: {
  breakdown: InitiativeHealthBreakdown;
  bars: InitiativeAreaBar[];
}) {
  return (
    <section className="rounded-[14px] border border-line-card bg-surface p-5 shadow-card sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <HealthDonut breakdown={breakdown} />
        <AreaSnapshot bars={bars} />
      </div>
    </section>
  );
}
