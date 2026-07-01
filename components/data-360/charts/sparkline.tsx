"use client";

/**
 * Data 360 — compact sparkline (recharts, fixed size).
 *
 * A tiny trend line for embedding next to a metric (entity workflow cards,
 * chapter rows, the meeting health table). Fixed-dimension LineChart — no
 * ResponsiveContainer — so it stays cheap when many render on one page. Real
 * points only; renders a flat baseline honestly when everything is zero.
 */

import { Line, LineChart, YAxis } from "recharts";

import { BRAND_LINE } from "./chart-theme";

export type SparkPoint = { t: string; value: number };

export function Sparkline({
  points,
  color = BRAND_LINE,
  width = 96,
  height = 28,
  strokeWidth = 1.6,
}: {
  points: SparkPoint[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}) {
  if (points.length === 0) {
    return <span style={{ display: "inline-block", width, height }} aria-hidden />;
  }
  const data = points.map((p, i) => ({ i, value: p.value }));
  const values = points.map((p) => p.value);
  const flat = values.every((v) => v === values[0]);

  return (
    <LineChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 3, right: 2, bottom: 3, left: 2 }}
      role="img"
      aria-label="Trend sparkline"
    >
      <YAxis hide domain={["dataMin", "dataMax"]} />
      <Line
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={flat ? 0.5 : 1}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
