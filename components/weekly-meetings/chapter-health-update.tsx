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
import {
  mentorshipActionLine,
  type MentorshipMetric,
  type MentorshipMetricKey,
  type MentorshipSuggestion,
} from "@/lib/data-360/mentorship-analytics-core";
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

/** Advising rows the meeting reviews, gaps first, then a throughput pulse. */
const MEETING_MENTORSHIP_KEYS: MentorshipMetricKey[] = [
  "unassignedStudents",
  "overdueCheckIns",
  "kickoffsNeeded",
  "staleRecommendations",
  "studentsSupported",
  "checkInsThisWeek",
];

/** Scope an advising-cockpit href to this meeting's chapter, so a chapter's
 *  drilldown lands filtered to that chapter (org-wide viewers) rather than the
 *  whole org. Non-advising hrefs (e.g. /admin/students) are left untouched. */
function scopeAdvisingHref(href: string, chapterId: string): string {
  if (!href.startsWith("/operations/advising")) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}chapterId=${chapterId}`;
}

function MentorshipMeetingRows({
  metrics,
  suggestions,
  chapterId,
}: {
  metrics: MentorshipMetric[];
  suggestions: MentorshipSuggestion[];
  chapterId: string;
}) {
  const byKey = new Map(metrics.map((m) => [m.key, m] as const));
  const suggestionByKey = new Map(suggestions.map((s) => [s.metricKey, s] as const));
  const rows = MEETING_MENTORSHIP_KEYS.map((k) => byKey.get(k)).filter(
    (m): m is MentorshipMetric => Boolean(m)
  );
  if (rows.length === 0) return null;

  const gapCount = metrics.filter((m) => m.isGap).length;

  return (
    <>
      <tr className="border-b border-line-soft bg-surface-muted/40">
        <td colSpan={6} className="py-1.5 pr-2 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
          Mentorship · student advising
        </td>
        <td className="px-2 py-1.5 text-right">
          <Link
            href={scopeAdvisingHref("/operations/advising", chapterId)}
            className="text-[11px] font-medium text-brand-700 hover:underline"
          >
            Advising queue →
          </Link>
        </td>
      </tr>
      <tr className="border-b border-line-soft/70">
        <td colSpan={7} className="px-0 py-1.5">
          <p
            className={`m-0 text-[11.5px] leading-snug ${gapCount > 0 ? "text-ink" : "text-success-700"}`}
          >
            <span className="font-semibold">This week: </span>
            {mentorshipActionLine(metrics)}
          </p>
        </td>
      </tr>
      {rows.map((m) => {
        // Treat an ungraded metric (no status label — e.g. a target-zero metric
        // before advising is active) as informational so the Status cell shows
        // "—" instead of a blank StatusBadge pill.
        const informational = m.direction === "informational" || !m.statusLabel;
        const suggestion = m.isGap ? suggestionByKey.get(m.key) ?? null : null;
        return (
          <tr key={`mentorship:${m.key}`} className="border-b border-line-soft/70">
            <td className="py-2 pr-2 font-medium text-ink">{m.label}</td>
            <td className="px-2 py-2 text-right text-ink-muted">{m.expectationLabel}</td>
            <td className="px-2 py-2 text-right">
              {m.href ? (
                <Link
                  href={scopeAdvisingHref(m.href, chapterId)}
                  className="font-semibold tabular-nums text-brand-700 hover:underline"
                >
                  {m.value}
                </Link>
              ) : (
                <span className="font-semibold tabular-nums text-ink">{m.value}</span>
              )}
            </td>
            <td className="px-2 py-2 text-right">
              <span className="text-[12px] text-ink-muted">—</span>
            </td>
            <td className="px-2 py-2">
              {informational ? (
                <span className="text-[11px] text-ink-muted">—</span>
              ) : (
                <StatusBadge tone={toneToBadge(m.tone)}>{m.statusLabel}</StatusBadge>
              )}
            </td>
            <td className="px-2 py-2">
              <span className="text-[11px] text-ink-muted">—</span>
            </td>
            <td className="px-2 py-2">
              {suggestion ? (
                suggestion.covered ? (
                  <span
                    className="text-[11px] font-medium text-success-700"
                    title={`A ${suggestion.templateLabel} is already running for this gap.`}
                  >
                    Workflow running
                  </span>
                ) : (
                  <Link
                    href={scopeAdvisingHref(suggestion.primaryActionHref, chapterId)}
                    className="text-[11.5px] font-medium text-brand-700 hover:underline"
                    title={`Close this gap with the ${suggestion.templateLabel}.`}
                  >
                    {suggestion.primaryActionLabel} →
                  </Link>
                )
              ) : (
                <span className="text-[11px] text-ink-muted">—</span>
              )}
            </td>
          </tr>
        );
      })}
    </>
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
          Open in Connected data →
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
            {update.mentorship.relevant ? (
              <MentorshipMeetingRows
                metrics={update.mentorship.metrics}
                suggestions={update.mentorship.suggestions}
                chapterId={update.chapterId}
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </CardV2>
  );
}
