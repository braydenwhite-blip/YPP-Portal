"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/components/ui-v2";
import type { EditableMetricSnapshot } from "@/lib/chapters/metrics-tracker/catalog";

const EXPECTATION_COLOR = "#94a3b8";

export function formatMetricValue(
  unit: EditableMetricSnapshot["def"]["unit"],
  n: number
): string {
  if (unit === "currency") return `$${n.toLocaleString()}`;
  if (unit === "percent") return `${Math.round(n)}%`;
  if (unit === "hours") return `${n}h`;
  return n.toLocaleString();
}

function formatAxisTick(unit: EditableMetricSnapshot["def"]["unit"], value: number): string {
  if (unit === "currency") {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
    return `$${value}`;
  }
  if (unit === "percent") return `${value}%`;
  if (unit === "hours") return `${value}h`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

type ChartPoint = {
  month: string;
  performance: number;
  expectation: number | null;
};

function buildPoints(metric: EditableMetricSnapshot): ChartPoint[] {
  return metric.series.map((p) => ({
    month: p.month,
    performance: p.actual,
    expectation: p.target,
  }));
}

function hasExpectation(points: ChartPoint[]): boolean {
  return points.some((p) => p.expectation != null);
}

function ChartLegend({
  performanceColor,
  compact,
}: {
  performanceColor: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-ink-muted",
        compact ? "mt-1 px-0.5" : "mt-2"
      )}
    >
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: performanceColor }}
          aria-hidden
        />
        Performance
      </span>
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-block h-0 w-3 border-t-2 border-dashed"
          style={{ borderColor: EXPECTATION_COLOR }}
          aria-hidden
        />
        Expectation
      </span>
    </div>
  );
}

export function MetricPerformanceChart({
  metric,
  height = 140,
  compact = false,
  performanceColor,
}: {
  metric: EditableMetricSnapshot;
  height?: number;
  compact?: boolean;
  /** Performance series color — defaults to status green. */
  performanceColor?: string;
}) {
  const perfColor = performanceColor ?? "#0e7c52";
  const unit = metric.def.unit;
  const points = buildPoints(metric);
  const showExpectation = hasExpectation(points) && !metric.def.noTarget;
  const useBars = metric.def.chart === "bar" || metric.def.chart === "scatter";

  const tick = { fontSize: compact ? 9 : 11, fill: "#64748b" };
  const margin = compact
    ? { top: 6, right: 6, left: 0, bottom: 0 }
    : { top: 8, right: 12, left: 4, bottom: 4 };
  const yWidth = compact ? 32 : 40;

  const tooltip = (
    <Tooltip
      contentStyle={{
        borderRadius: 10,
        fontSize: 12,
        border: "1px solid #e8e4ef",
        boxShadow: "0 8px 24px rgba(46,16,101,0.08)",
      }}
      formatter={(value, name) => {
        const n = Number(value);
        const formatted = Number.isFinite(n) ? formatMetricValue(unit, n) : "—";
        const label = name === "performance" ? "Performance" : "Expectation";
        return [formatted, label];
      }}
      labelFormatter={(label) => `Month ${String(label).replace(/^M/, "")}`}
    />
  );

  const xAxis = (
    <XAxis
      dataKey="month"
      tick={tick}
      axisLine={{ stroke: "#cbd5e1" }}
      tickLine={{ stroke: "#cbd5e1" }}
      interval={0}
    />
  );

  const yAxis = (
    <YAxis
      tick={tick}
      width={yWidth}
      axisLine={{ stroke: "#cbd5e1" }}
      tickLine={{ stroke: "#cbd5e1" }}
      tickFormatter={(v) => formatAxisTick(unit, Number(v))}
    />
  );

  const grid = (
    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
  );

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        {useBars ? (
          <BarChart data={points} margin={margin} barGap={compact ? 1 : 2} barCategoryGap="22%">
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Bar
              dataKey="performance"
              fill={perfColor}
              radius={[2, 2, 0, 0]}
              name="performance"
              maxBarSize={compact ? 10 : 18}
            />
            {showExpectation ? (
              <Bar
                dataKey="expectation"
                fill={EXPECTATION_COLOR}
                radius={[2, 2, 0, 0]}
                name="expectation"
                maxBarSize={compact ? 10 : 18}
              />
            ) : null}
          </BarChart>
        ) : (
          <LineChart data={points} margin={margin}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Line
              type="monotone"
              dataKey="performance"
              stroke={perfColor}
              strokeWidth={compact ? 2 : 2.25}
              dot={compact ? { r: 2, fill: perfColor } : { r: 3, fill: perfColor }}
              activeDot={{ r: 4 }}
              name="performance"
            />
            {showExpectation ? (
              <Line
                type="monotone"
                dataKey="expectation"
                stroke={EXPECTATION_COLOR}
                strokeWidth={compact ? 1.75 : 2}
                strokeDasharray="5 4"
                dot={compact ? false : { r: 2.5, fill: EXPECTATION_COLOR }}
                connectNulls={false}
                name="expectation"
              />
            ) : null}
          </LineChart>
        )}
      </ResponsiveContainer>
      <ChartLegend performanceColor={perfColor} compact={compact} />
    </div>
  );
}
