"use client";

/**
 * Chapter Impact Meeting — Chapter Health Update table.
 *
 * The weekly operating ritual: every chapter metric as a concrete count vs its
 * target, this-week momentum, an inflow sparkline, a drilldown to the records,
 * and a workflow to start if there's a gap. "Chapter Health Update" is a plain
 * label — no synthetic score. Rows muted (grayed) when a metric isn't yet
 * relevant to the chapter's phase. Data comes from the same Data 360 layer.
 */

import Link from "next/link";

import { CardV2 } from "@/components/ui-v2/card";
import { StatusBadge, type StatusTone } from "@/components/ui-v2/status-badge";
import { Sparkline } from "@/components/data-360/charts/sparkline";
import type { ChapterHealthUpdate } from "@/lib/data-360/chapter-health-update";
import type { MetricTone } from "@/lib/data-360/types";

function toneToBadge(tone: MetricTone): StatusTone {
  switch (tone) {
    case "positive":
      return "success";
    case "warning":
      return "warning";
    case "danger":
      return "danger";
    default:
      return "neutral";
  }
}

function fmt(value: number | null, unit: "count" | "percent"): string {
  if (value === null) return "—";
  return unit === "percent" ? `${value}%` : String(value);
}

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) {
    return <span className="text-[12px] text-ink-muted">—</span>;
  }
  const up = delta > 0;
  return (
    <span className={`text-[12px] font-semibold ${up ? "text-success-700" : "text-danger-700"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

export function ChapterHealthUpdateTable({ update }: { update: ChapterHealthUpdate }) {
  if (!update) return null;

  return (
    <CardV2 padding="md">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[15px] font-bold text-ink">Chapter Health Update</h2>
        <Link
          href="/data-360?tab=chapters"
          className="text-[12px] font-semibold text-brand-700 hover:underline"
        >
          Open in Data 360 →
        </Link>
      </div>
      <p className="m-0 mb-3 text-[12.5px] text-ink-muted">
        {update.chapterName} · {update.phaseLabel} · every number is live from records, graded
        against the operating targets. Grayed rows aren&apos;t relevant to this phase yet.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line-soft text-[10.5px] uppercase tracking-[0.05em] text-ink-muted">
              <th className="py-2 pr-2 font-semibold">Metric</th>
              <th className="px-2 py-2 text-right font-semibold">Expected</th>
              <th className="px-2 py-2 text-right font-semibold">Current</th>
              <th className="px-2 py-2 text-right font-semibold">Δ wk</th>
              <th className="px-2 py-2 font-semibold">Status</th>
              <th className="px-2 py-2 font-semibold">Trend</th>
              <th className="px-2 py-2 font-semibold">Next</th>
            </tr>
          </thead>
          <tbody>
            {update.rows.map((r) => {
              const muted = !r.relevant;
              return (
                <tr
                  key={r.key}
                  className={`border-b border-line-soft/70 ${muted ? "opacity-45" : ""}`}
                >
                  <td className="py-2 pr-2 font-medium text-ink">{r.label}</td>
                  <td className="px-2 py-2 text-right text-ink-muted">{r.expectationLabel}</td>
                  <td className="px-2 py-2 text-right">
                    {r.href && !muted ? (
                      <Link
                        href={r.href}
                        className="font-semibold tabular-nums text-brand-700 hover:underline"
                      >
                        {fmt(r.current, r.unit)}
                      </Link>
                    ) : (
                      <span className="font-semibold tabular-nums text-ink">
                        {fmt(r.current, r.unit)}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <DeltaChip delta={muted ? null : r.deltaThisWeek} />
                  </td>
                  <td className="px-2 py-2">
                    {muted ? (
                      <span className="text-[11px] text-ink-muted">Not yet</span>
                    ) : (
                      <StatusBadge tone={toneToBadge(r.tone)}>{r.statusLabel}</StatusBadge>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {!muted && r.trend && r.trend.length > 0 ? (
                      <Sparkline
                        points={r.trend.map((p) => ({ t: p.t, value: p.value }))}
                        width={72}
                        height={22}
                      />
                    ) : (
                      <span className="text-[11px] text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {!muted && r.suggestionTemplateLabel && r.suggestionPrimaryHref ? (
                      <Link
                        href={r.suggestionPrimaryHref}
                        className="text-[11.5px] font-medium text-brand-700 hover:underline"
                      >
                        {r.suggestionTemplateLabel} →
                      </Link>
                    ) : (
                      <span className="text-[11px] text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CardV2>
  );
}
