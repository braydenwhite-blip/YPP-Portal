"use client";

/**
 * Data 360 — multi-series week-by-week trend chart (recharts).
 *
 * Themed to the brand; used for chapter-growth trends, workflow operating
 * trends, and chapter comparison (one line per chapter). Data is real week
 * buckets from the server — the chart never invents points. Honest sparse-data
 * state when a series has no non-zero values.
 */

import { useId, useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_SURFACES, seriesColor, type ChartTheme } from "./chart-theme";

export type TrendPoint = { t: string; label: string; value: number };
export type TrendSeries = {
  key: string;
  label: string;
  color?: string;
  points: TrendPoint[];
};

type Row = { t: string; label: string } & Record<string, number | string>;

function mergeRows(series: TrendSeries[]): Row[] {
  const byT = new Map<string, Row>();
  const order: string[] = [];
  for (const s of series) {
    for (const p of s.points) {
      let row = byT.get(p.t);
      if (!row) {
        row = { t: p.t, label: p.label };
        byT.set(p.t, row);
        order.push(p.t);
      }
      row[s.key] = p.value;
    }
  }
  return order.map((t) => byT.get(t) as Row);
}

/** Compact "Jun 23" tick from a "Week of Jun 23, 2026" label. */
function shortTick(label: string): string {
  return label.replace(/^Week of\s*/, "").replace(/,\s*\d{4}$/, "");
}

export function TrendChart({
  series,
  theme = "dark",
  height = 220,
  area = false,
  showLegend,
}: {
  series: TrendSeries[];
  theme?: ChartTheme;
  height?: number;
  /** Fill under a single-series line for a calmer "area" look. */
  area?: boolean;
  showLegend?: boolean;
}) {
  const gradId = useId().replace(/:/g, "");
  const surface = CHART_SURFACES[theme];
  const rows = useMemo(() => mergeRows(series), [series]);
  const labelByT = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of series) for (const p of s.points) m.set(p.t, p.label);
    return m;
  }, [series]);

  const hasData = series.some((s) => s.points.some((p) => p.value > 0));
  const legend = showLegend ?? series.length > 1;

  if (rows.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[12px]"
        style={{ height, color: surface.text }}
      >
        No data yet.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            {series.map((s, i) => {
              const color = s.color ?? seriesColor(i);
              return (
                <linearGradient key={s.key} id={`${gradId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid stroke={surface.grid} vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(t: string) => shortTick(labelByT.get(t) ?? t)}
            tick={{ fill: surface.text, fontSize: 10.5 }}
            axisLine={{ stroke: surface.grid }}
            tickLine={false}
            minTickGap={18}
          />
          <YAxis
            tick={{ fill: surface.text, fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
            width={34}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: surface.tooltipBg,
              border: `1px solid ${surface.tooltipBorder}`,
              borderRadius: 10,
              fontSize: 12,
              color: surface.text,
            }}
            labelFormatter={(label) => labelByT.get(String(label)) ?? String(label)}
            cursor={{ stroke: surface.axis, strokeDasharray: "3 3" }}
          />
          {legend ? (
            <Legend wrapperStyle={{ fontSize: 11, color: surface.text }} iconType="plainline" />
          ) : null}
          {series.map((s, i) => {
            const color = s.color ?? seriesColor(i);
            return area && series.length === 1 ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradId}-${s.key})`}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            ) : (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={1.9}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
                connectNulls
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
      {!hasData ? (
        <p className="mt-1 text-center text-[11px]" style={{ color: surface.text }}>
          No activity in this window yet.
        </p>
      ) : null}
    </div>
  );
}
