"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
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

import { PACE_STATUS_LABELS, type PaceStatus } from "@/lib/chapters/analytics-pace";
import { cn, ModalFooterV2, ModalV2, StatusBadge, Button } from "@/components/ui-v2";
import type {
  EditableCategorySnapshot,
  EditableMetricSnapshot,
} from "@/lib/chapters/metrics-tracker/catalog";

function tone(status: PaceStatus | "informational") {
  if (status === "informational") return "neutral" as const;
  if (status === "above") return "brand" as const;
  if (status === "on_track") return "success" as const;
  if (status === "needs_attention") return "warning" as const;
  return "danger" as const;
}

function statusLabel(status: PaceStatus | "informational") {
  if (status === "informational") return "No target";
  return PACE_STATUS_LABELS[status];
}

function statusAccent(status: PaceStatus | "informational") {
  // Match StatusBadge tones from app/ui-v2.css (complete / progress / blocked / brand / idle).
  if (status === "above")
    return { bar: "#6b21c8", soft: "#f3ecff", border: "border-l-brand-500" };
  if (status === "on_track")
    return { bar: "#0e7c52", soft: "#e7f6ee", border: "border-l-complete-700" };
  if (status === "needs_attention")
    return { bar: "#b45309", soft: "#fdf2e3", border: "border-l-progress-700" };
  if (status === "at_risk")
    return { bar: "#c0392b", soft: "#fdecea", border: "border-l-blocked-700" };
  return { bar: "#5c5c74", soft: "#f0f0f5", border: "border-l-idle-700" };
}

function fmt(unit: EditableMetricSnapshot["def"]["unit"], n: number) {
  if (unit === "currency") return `$${n.toLocaleString()}`;
  if (unit === "percent") return `${Math.round(n)}%`;
  if (unit === "hours") return `${n}h`;
  return n.toLocaleString();
}

function MetricChart({
  metric,
  height = 140,
  compact = false,
}: {
  metric: EditableMetricSnapshot;
  height?: number;
  compact?: boolean;
}) {
  const { bar, soft } = statusAccent(metric.status);
  const data = metric.series.map((p) => ({
    m: p.month,
    have: p.actual,
    goal: p.target ?? undefined,
  }));
  const tip = compact ? null : (
    <Tooltip
      contentStyle={{
        borderRadius: 10,
        fontSize: 12,
        border: "1px solid #e8e4ef",
        boxShadow: "0 8px 24px rgba(46,16,101,0.08)",
      }}
    />
  );
  const tick = { fontSize: compact ? 10 : 11, fill: "#94a3b8" };

  if (metric.def.chart === "bar" || metric.def.chart === "scatter") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          {!compact ? <CartesianGrid strokeDasharray="3 3" stroke="#f3f0f8" vertical={false} /> : null}
          <XAxis dataKey="m" tick={tick} axisLine={false} tickLine={false} />
          {!compact ? <YAxis tick={tick} width={36} axisLine={false} tickLine={false} /> : null}
          {tip}
          <Bar dataKey="have" fill={bar} radius={[3, 3, 0, 0]} name="Have" />
          {!compact ? <Bar dataKey="goal" fill="#e2e8f0" radius={[3, 3, 0, 0]} name="Goal" /> : null}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (metric.def.chart === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          {!compact ? <CartesianGrid strokeDasharray="3 3" stroke="#f3f0f8" vertical={false} /> : null}
          <XAxis dataKey="m" tick={tick} axisLine={false} tickLine={false} />
          {!compact ? <YAxis tick={tick} width={36} axisLine={false} tickLine={false} /> : null}
          {tip}
          <Area type="monotone" dataKey="have" stroke={bar} fill={soft} name="Have" />
          {!compact ? (
            <Line
              type="monotone"
              dataKey="goal"
              stroke="#94a3b8"
              strokeDasharray="4 4"
              dot={false}
              name="Goal"
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        {!compact ? <CartesianGrid strokeDasharray="3 3" stroke="#f3f0f8" vertical={false} /> : null}
        <XAxis dataKey="m" tick={tick} axisLine={false} tickLine={false} />
        {!compact ? <YAxis tick={tick} width={36} axisLine={false} tickLine={false} /> : null}
        {tip}
        <Line
          type="monotone"
          dataKey="have"
          stroke={bar}
          strokeWidth={compact ? 1.75 : 2.25}
          dot={compact ? false : { r: 3, fill: bar }}
          name="Have"
        />
        {!compact ? (
          <Line
            type="monotone"
            dataKey="goal"
            stroke="#94a3b8"
            strokeDasharray="4 4"
            dot={false}
            name="Goal"
          />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}

function MetricCard({
  metric,
  onOpen,
}: {
  metric: EditableMetricSnapshot;
  onOpen: () => void;
}) {
  const accent = statusAccent(metric.status);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full flex-col rounded-[14px] border border-line-card border-l-4 bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        accent.border
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 line-clamp-2 text-[14px] font-semibold leading-snug text-ink">
            {metric.def.label}
          </p>
          {metric.def.owner.trim() ? (
            <p className="m-0 mt-1 truncate text-[12px] text-ink-muted">{metric.def.owner}</p>
          ) : null}
        </div>
        <StatusBadge tone={tone(metric.status)}>{statusLabel(metric.status)}</StatusBadge>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[22px] font-bold tabular-nums tracking-tight text-ink">
          {fmt(metric.def.unit, metric.actual)}
        </span>
        <span className="text-[12px] text-ink-muted">
          {metric.def.targetLabel.trim()
            ? `Target: ${metric.def.targetLabel}`
            : metric.target != null && !metric.def.noTarget
              ? `/ ${fmt(metric.def.unit, metric.target)}`
              : "/ —"}
        </span>
      </div>
      <div className="mt-2 -mx-1 rounded-lg px-1" style={{ background: `${accent.soft}99` }}>
        <MetricChart metric={metric} height={84} compact />
      </div>
    </button>
  );
}

export function PersonMetricsPanel({
  personName,
  isSelf,
  monthLabel,
  categories,
}: {
  personName: string;
  isSelf: boolean;
  monthLabel: string;
  categories: EditableCategorySnapshot[];
}) {
  const [detail, setDetail] = useState<EditableMetricSnapshot | null>(null);
  const allMetrics = useMemo(() => categories.flatMap((c) => c.metrics), [categories]);

  const counts = useMemo(() => {
    const c = { above: 0, on_track: 0, needs_attention: 0, at_risk: 0 };
    for (const m of allMetrics) {
      if (m.status !== "informational") c[m.status] += 1;
    }
    return c;
  }, [allMetrics]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line-card bg-surface px-4 py-3 shadow-sm">
        <div>
          <p className="m-0 text-[15px] font-semibold text-ink">
            {isSelf
              ? "Your metrics"
              : personName.trim()
                ? `${personName.trim()}'s metrics`
                : "Their metrics"}
          </p>
          <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
            {isSelf
              ? `Quality, teaching impact, and growth for ${monthLabel}.`
              : personName.trim()
                ? `Quality, teaching impact, and growth for ${personName.trim()} · ${monthLabel}.`
                : `Quality, teaching impact, and growth for ${monthLabel}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { n: counts.above, label: "Above", className: "bg-brand-100 text-brand-800" },
              { n: counts.on_track, label: "On track", className: "bg-success-100 text-success-700" },
              {
                n: counts.needs_attention,
                label: "Watch",
                className: "bg-warning-100 text-warning-700",
              },
              { n: counts.at_risk, label: "At risk", className: "bg-danger-100 text-danger-700" },
            ] as const
          ).map((item) => (
            <span
              key={item.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                item.className
              )}
            >
              <span className="tabular-nums">{item.n}</span>
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {categories.map((cat) => (
        <section key={cat.def.id} className="flex flex-col gap-3">
          <div>
            <h2 className="m-0 text-[16px] font-bold tracking-tight text-ink">{cat.def.label}</h2>
            <p className="m-0 mt-0.5 text-[13px] text-ink-muted">{cat.def.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {cat.metrics.map((metric) => (
              <MetricCard
                key={metric.rowId}
                metric={metric}
                onOpen={() => setDetail(metric)}
              />
            ))}
          </div>
        </section>
      ))}

      {detail ? (
        <ModalV2
          open
          onClose={() => setDetail(null)}
          labelledBy="person-metric-detail-title"
          size="lg"
          className="max-w-[720px]"
        >
          <div className="flex flex-col gap-4">
            <div>
              <h2
                id="person-metric-detail-title"
                className="m-0 text-[18px] font-bold tracking-tight text-ink"
              >
                {detail.def.label}
              </h2>
              {detail.def.owner.trim() ? (
                <p className="m-0 mt-1 text-[13px] text-ink-muted">{detail.def.owner}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge tone={tone(detail.status)}>{statusLabel(detail.status)}</StatusBadge>
                <span className="text-[13px] text-ink-muted">
                  {fmt(detail.def.unit, detail.actual)}
                  {detail.target != null && !detail.def.noTarget
                    ? ` / ${fmt(detail.def.unit, detail.target)} target`
                    : ""}
                </span>
              </div>
            </div>
            {detail.def.tracks ? (
              <p className="m-0 text-[13.5px] leading-relaxed text-ink-muted">{detail.def.tracks}</p>
            ) : null}
            <div className="rounded-[12px] border border-line-card bg-surface px-2 py-3">
              <MetricChart metric={detail} height={220} />
            </div>
            <ModalFooterV2>
              <Button type="button" variant="secondary" onClick={() => setDetail(null)}>
                Close
              </Button>
            </ModalFooterV2>
          </div>
        </ModalV2>
      ) : null}
    </div>
  );
}
