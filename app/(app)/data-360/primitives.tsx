import Link from "next/link";

import type {
  CategoryDatum,
  Kpi,
  MetricTone,
  TimeSeriesPoint,
} from "@/lib/data-360/types";

/**
 * Data 360 — dark-surface presentational primitives.
 *
 * Scoped to the `/data-360` route: a self-contained premium "terminal" surface
 * that reads as intentionally distinct from the (light) Home experience, built
 * with Tailwind arbitrary values so it touches no global CSS (`globals.css` is
 * frozen). Tone is cosmetic only — never a score.
 */

const TONE_COLOR: Record<MetricTone, string> = {
  default: "#8b94a7",
  accent: "#b47fff",
  positive: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
  muted: "#5f6b80",
};

export function toneColor(tone: MetricTone): string {
  return TONE_COLOR[tone];
}

// --- panel -------------------------------------------------------------------

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "p-4",
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-white/10 bg-[#0f1420] ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-2.5">
          <div className="min-w-0">
            {title ? (
              <h3 className="truncate text-[12px] font-semibold uppercase tracking-[0.07em] text-[#aeb6c6]">
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 text-[11px] text-[#5f6b80]">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// --- KPI card ----------------------------------------------------------------

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const color = toneColor(kpi.tone);

  const inner = (
    <div className="group relative flex h-full flex-col gap-1 overflow-hidden rounded-xl border border-white/10 bg-[#111726] px-3.5 py-3 transition-colors hover:border-white/25">
      <span
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: color }}
        aria-hidden
      />
      <div className="flex items-baseline justify-between gap-2">
        {kpi.available ? (
          <span className="text-[26px] font-bold leading-none tracking-tight tabular-nums text-[#e9eef5]">
            {kpi.display}
          </span>
        ) : (
          <span className="text-[15px] font-semibold leading-tight text-[#5f6b80]">
            Unavailable
          </span>
        )}
        {kpi.delta ? (
          <span className="shrink-0 text-[11px] font-semibold text-[#34d399]">
            {kpi.delta.label}
          </span>
        ) : null}
      </div>
      <span className="text-[12px] font-medium text-[#aeb6c6]">{kpi.label}</span>
      {kpi.hint ? (
        <span className="text-[10.5px] leading-tight text-[#5f6b80]">
          {kpi.hint}
        </span>
      ) : null}
      {kpi.href && kpi.available ? (
        <span className="mt-auto pt-1 text-[10.5px] text-[#7c89a0] opacity-0 transition-opacity group-hover:opacity-100">
          View records →
        </span>
      ) : null}
    </div>
  );

  if (kpi.href && kpi.available) {
    return (
      <Link href={kpi.href} className="block h-full" prefetch={false}>
        {inner}
      </Link>
    );
  }
  return inner;
}

// --- area chart (SVG, zero-dependency) ---------------------------------------

export function AreaChart({
  points,
  color = "#b47fff",
  height = 72,
}: {
  points: TimeSeriesPoint[];
  color?: string;
  height?: number;
}) {
  const W = 280;
  const H = height;
  const P = 5;

  if (points.length === 0) {
    return <div style={{ height }} aria-hidden />;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const n = points.length;
  const x = (i: number) => P + (i / (n - 1 || 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  const gradId = `d360grad-${color.replace("#", "")}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="Trend over the trailing 12 months"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// --- horizontal bar rows -----------------------------------------------------

export function BarRows({
  data,
  color = "#8b6fff",
  emptyLabel = "No data yet",
  max = 6,
}: {
  data: CategoryDatum[];
  color?: string;
  emptyLabel?: string;
  max?: number;
}) {
  const rows = data.slice(0, max);
  if (rows.length === 0) {
    return <p className="text-[12px] text-[#5f6b80]">{emptyLabel}</p>;
  }
  const peak = Math.max(...rows.map((d) => d.value), 1);

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((d) => {
        const body = (
          <>
            <span
              className="w-28 shrink-0 truncate text-[12px] text-[#c4ccda]"
              title={d.label}
            >
              {d.label}
            </span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(d.value / peak) * 100}%`, background: color }}
              />
            </span>
            <span className="w-9 shrink-0 text-right text-[12px] font-semibold tabular-nums text-[#e6edf3]">
              {d.value}
            </span>
          </>
        );
        return (
          <li key={d.key}>
            {d.href ? (
              <Link
                href={d.href}
                prefetch={false}
                className="flex items-center gap-2.5 rounded-md px-1 py-0.5 transition-colors hover:bg-white/[0.04]"
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-2.5 px-1 py-0.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
