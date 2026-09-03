"use client";

import { useMemo, useState } from "react";

import { MetricMonthlyTargetsTable } from "@/components/chapter/metrics-tracker/metric-monthly-targets-table";
import {
  MetricPerformanceChart,
  formatMetricValue,
} from "@/components/chapter/metrics-tracker/metric-performance-chart";
import { PACE_STATUS_LABELS, type PaceStatus } from "@/lib/chapters/analytics-pace";
import type { EditableMetricSnapshot, MetricsScope } from "@/lib/chapters/metrics-tracker/catalog";
import type { PersonMetricsCategorySnapshot } from "@/lib/chapters/metrics-tracker/load";
import { cn, ModalFooterV2, ModalV2, StatusBadge, Button } from "@/components/ui-v2";

const SCOPE_SECTION: Record<
  MetricsScope,
  { title: string; blurb: string }
> = {
  org: {
    title: "Organization",
    blurb: "Org action items assigned to this person.",
  },
  chapter_president: {
    title: "Chapter leadership",
    blurb: "Chapter metrics assigned to this person.",
  },
  instructor: {
    title: "Instructor metrics",
    blurb: "Quality, teaching impact, and growth contribution.",
  },
};

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
          {formatMetricValue(metric.def.unit, metric.actual)}
        </span>
        <span className="text-[12px] text-ink-muted">
          {metric.def.targetLabel.trim()
            ? `Target: ${metric.def.targetLabel}`
            : metric.target != null && !metric.def.noTarget
              ? `/ ${formatMetricValue(metric.def.unit, metric.target)}`
              : "/ —"}
        </span>
      </div>
      <div className="mt-2 -mx-1 rounded-lg px-1" style={{ background: `${accent.soft}99` }}>
        <MetricPerformanceChart
          metric={metric}
          height={112}
          compact
          performanceColor={accent.bar}
        />
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
  categories: PersonMetricsCategorySnapshot[];
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

  const displayName = personName.trim();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line-card bg-surface px-4 py-3 shadow-sm">
        <div>
          <p className="m-0 text-[15px] font-semibold text-ink">
            {isSelf ? "Your metrics" : displayName ? `${displayName}'s metrics` : "Their metrics"}
          </p>
          <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
            {isSelf
              ? `Targets and pace for ${monthLabel} — only metrics assigned to you.`
              : displayName
                ? `Targets and pace for ${displayName} · ${monthLabel} — only metrics in their name.`
                : `Targets and pace for ${monthLabel}.`}
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

      {categories.map((cat, index) => {
        const section = SCOPE_SECTION[cat.scope];
        const showScopeSection =
          index === 0 || categories[index - 1]?.scope !== cat.scope;
        return (
          <section key={`${cat.scope}-${cat.def.id}`} className="flex flex-col gap-3">
            {showScopeSection ? (
              <div className={cn(index > 0 && "border-t border-line-card pt-5")}>
                <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  {section.title}
                </h2>
                <p className="m-0 mt-1 text-[13px] text-ink-muted">{section.blurb}</p>
              </div>
            ) : null}
            <div>
              <h3 className="m-0 text-[16px] font-bold tracking-tight text-ink">{cat.def.label}</h3>
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
        );
      })}

      {detail ? (
        <ModalV2
          open
          onClose={() => setDetail(null)}
          labelledBy="person-metric-detail-title"
          size="lg"
          className="max-w-[720px]"
        >
          <div className="flex flex-col gap-4">
            <div
              className={cn(
                "rounded-[12px] border-l-4 px-4 py-3",
                statusAccent(detail.status).border
              )}
              style={{ background: statusAccent(detail.status).soft }}
            >
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
                  {formatMetricValue(detail.def.unit, detail.actual)}
                  {detail.target != null && !detail.def.noTarget
                    ? ` / ${formatMetricValue(detail.def.unit, detail.target)} expectation`
                    : ""}
                </span>
              </div>
            </div>
            {detail.def.tracks ? (
              <p className="m-0 text-[13.5px] leading-relaxed text-ink-muted">{detail.def.tracks}</p>
            ) : null}
            {detail.def.why ? (
              <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
                <span className="font-semibold text-ink">Why it matters: </span>
                {detail.def.why}
              </p>
            ) : null}
            <div>
              <p className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
                Monthly expectations (M1–M6)
              </p>
              <MetricMonthlyTargetsTable metric={detail} />
            </div>
            <div className="rounded-[12px] border border-line-card bg-surface px-2 py-3">
              <MetricPerformanceChart
                metric={detail}
                height={220}
                performanceColor={statusAccent(detail.status).bar}
              />
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
