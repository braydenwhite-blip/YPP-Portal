import type { MeetingStatus, MeetingType } from "@/lib/weekly-meetings/meeting-types";
import type {
  MeetingStatusBreakdown,
  MeetingTypeBar,
} from "@/lib/weekly-meetings/meeting-analytics";

const STATUS_ORDER: MeetingStatus[] = [
  "IN_PROGRESS",
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
];

const STATUS_LABELS: Record<MeetingStatus, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<MeetingStatus, string> = {
  IN_PROGRESS: "#f59e0b",
  SCHEDULED: "#6366f1",
  COMPLETED: "#16a34a",
  CANCELLED: "#c9c9d6",
};

/** Shared type → color map (legend, bars, group headers). */
export const MEETING_TYPE_COLORS: Record<MeetingType, string> = {
  OFFICER: "#6b21c8",
  WEEKLY_TEAM_IMPACT: "#0d9488",
  CHAPTER_IMPACT: "#f59e0b",
  GENERIC: "#64748b",
};

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function StatusDonut({ breakdown }: { breakdown: MeetingStatusBreakdown }) {
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
            meeting{total === 1 ? "" : "s"}
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
            <span className="flex-1 text-ink-muted">{STATUS_LABELS[status]}</span>
            <strong className="tabular-nums text-ink">{counts[status]}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeSnapshot({ bars }: { bars: MeetingTypeBar[] }) {
  const maxTotal = Math.max(...bars.map((b) => b.total), 1);

  return (
    <div>
      <p className="m-0 mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-700">
        By type
      </p>
      {bars.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">No meetings in this view yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {bars.map((bar) => {
            const widthPct = (bar.total / maxTotal) * 100;
            return (
              <div key={bar.type}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="font-semibold text-ink">{bar.label}</span>
                  <span className="tabular-nums text-ink-muted">{bar.total}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#f1f1f6]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(widthPct, 6)}%`,
                      background: MEETING_TYPE_COLORS[bar.type],
                    }}
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

/** Combined status donut + per-type bars — the meetings hub snapshot card. */
export function MeetingsHubAnalytics({
  breakdown,
  bars,
}: {
  breakdown: MeetingStatusBreakdown;
  bars: MeetingTypeBar[];
}) {
  return (
    <section className="rounded-[14px] border border-line-card bg-surface p-5 shadow-card sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <StatusDonut breakdown={breakdown} />
        <TypeSnapshot bars={bars} />
      </div>
    </section>
  );
}
