"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ModalV2 } from "@/components/ui-v2";
import type { ChapterOverviewModel, TrendPoint } from "@/lib/chapters/analytics-types";
import type { AnalyticsRangeMonths } from "@/lib/chapters/analytics-types";
import {
  ANALYTICS_CATEGORY_KEYS,
  CATEGORY_LABELS,
  PACE_STATUS_LABELS,
  type AnalyticsCategoryKey,
  type PaceStatus,
} from "@/lib/chapters/analytics-pace";

import { CATEGORY_ACCENT, PACE_COLORS, PaceLegend } from "./pace-styles";

function formatHeatValue(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Soft heatmap tile — wash + pace bar, no bordered pill. */
function HeatmapTile({
  display,
  actual,
  expected,
  status,
  label,
  onClick,
}: {
  display: string;
  actual: number;
  expected: number;
  status: PaceStatus;
  label: string;
  onClick: () => void;
}) {
  const c = PACE_COLORS[status];
  const isPercent = display.endsWith("%");
  const ratio = expected > 0 ? Math.min(1, Math.max(0, actual / expected)) : actual > 0 ? 1 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}: ${display} · ${PACE_STATUS_LABELS[status]}`}
      aria-label={`${label}: ${display}, ${PACE_STATUS_LABELS[status]}`}
      className={[
        "group relative mx-auto flex w-full max-w-[5.75rem] flex-col items-stretch gap-1.5 rounded-lg px-2 py-2",
        "transition duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        c.wash,
        c.washHover,
        c.ring,
      ].join(" ")}
    >
      <div className="flex items-baseline justify-center gap-0.5 tabular-nums leading-none">
        {isPercent ? (
          <span className={`text-[13px] font-semibold tracking-tight ${c.text}`}>{display}</span>
        ) : (
          <>
            <span className={`text-[13px] font-semibold tracking-tight ${c.text}`}>
              {formatHeatValue(actual)}
            </span>
            <span className={`text-[11px] font-medium ${c.muted}`}>/{formatHeatValue(expected)}</span>
          </>
        )}
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${c.bar}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </button>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#9aa2b1]">{label}</div>
      <div className="mt-0.5 text-[18px] font-bold tabular-nums" style={{ color: accent ?? "#111827" }}>
        {value}
      </div>
    </div>
  );
}

function DetailCard({
  title,
  accent,
  children,
  kpis,
  onOpen,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
  kpis: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[#e8e4f0] bg-white text-left shadow-[0_1px_2px_rgb(46_16_101/0.04)] transition hover:-translate-y-0.5 hover:border-[rgba(99,102,241,0.28)] hover:shadow-[0_10px_28px_rgba(59,15,110,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(99,102,241,0.45)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#f0ecf6] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          <h3 className="text-[14px] font-bold text-[#111827]">{title}</h3>
        </div>
        <span className="text-[11px] font-semibold text-[#6366f1] opacity-0 transition group-hover:opacity-100">
          View details
        </span>
      </div>
      <div className="pointer-events-none px-3 pt-3">{children}</div>
      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-[#f0ecf6] bg-[#fafafa] px-4 py-3 sm:grid-cols-4">
        {kpis}
      </div>
    </button>
  );
}

function categoryKpis(model: ChapterOverviewModel, category: AnalyticsCategoryKey) {
  switch (category) {
    case "students":
      return [
        { label: "Actual", value: String(model.current.students), accent: CATEGORY_ACCENT.students },
        { label: "Expectation", value: String(model.expected.students), accent: CATEGORY_ACCENT.students },
        {
          label: "Gap",
          value: model.kpis.students.gap > 0 ? `+${model.kpis.students.gap}` : String(model.kpis.students.gap),
          accent: model.kpis.students.gap < 0 ? "#dc2626" : "#111827",
        },
        { label: "Student retention", value: `${model.kpis.students.retention}%` },
      ];
    case "instructors":
      return [
        { label: "Actual", value: String(model.current.instructors), accent: CATEGORY_ACCENT.instructors },
        { label: "Expectation", value: String(model.expected.instructors), accent: CATEGORY_ACCENT.instructors },
        {
          label: "Utilization",
          value: `${model.kpis.instructors.utilization}%`,
          accent: CATEGORY_ACCENT.instructors,
        },
        { label: "Unassigned trained", value: String(model.kpis.instructors.unassignedTrained) },
      ];
    case "partners":
      return [
        { label: "Actual", value: String(model.current.partners), accent: CATEGORY_ACCENT.partners },
        { label: "Expectation", value: String(model.expected.partners), accent: CATEGORY_ACCENT.partners },
        {
          label: "Gap",
          value: model.kpis.partners.gap > 0 ? `+${model.kpis.partners.gap}` : String(model.kpis.partners.gap),
        },
        { label: "Pending meetings", value: String(model.kpis.partners.pendingMeetings) },
      ];
    case "quality":
      return [
        {
          label: "Instructor review avg",
          value:
            model.kpis.quality.instructorReviewAvg != null
              ? `${model.kpis.quality.instructorReviewAvg} / 5`
              : "—",
          accent: CATEGORY_ACCENT.quality,
        },
        {
          label: "Parent feedback",
          value:
            model.kpis.quality.parentFeedbackAvg != null
              ? `${model.kpis.quality.parentFeedbackAvg} / 5`
              : "—",
          accent: "#3b82f6",
        },
        { label: "Retention", value: `${model.kpis.quality.retention}%`, accent: "#f59e0b" },
        { label: "Follow-up flagged", value: String(model.kpis.quality.followUpFlagged) },
      ];
  }
}

function CategoryTrendChart({
  category,
  points,
  height = 220,
}: {
  category: AnalyticsCategoryKey;
  points: TrendPoint[];
  height?: number;
}) {
  const accent = CATEGORY_ACCENT[category];
  if (category === "quality") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={points.slice(-6).map((p) => ({
            label: p.label,
            retention: p.actual,
            expected: p.expected,
          }))}
        >
          <CartesianGrid stroke="rgba(15,20,32,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#9aa2b1", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#9aa2b1", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip />
          <Legend />
          <Bar dataKey="retention" name="Retention (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expected" name="Expectation" fill="#86efac" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points}>
        <CartesianGrid stroke="rgba(15,20,32,0.06)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#9aa2b1", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#9aa2b1", fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="actual" name="Actual" stroke={accent} strokeWidth={2.5} dot={{ r: 3 }} />
        <Line
          type="monotone"
          dataKey="expected"
          name="Expectation"
          stroke={accent}
          strokeDasharray="5 5"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CategoryDetailModal({
  open,
  category,
  model,
  onClose,
}: {
  open: boolean;
  category: AnalyticsCategoryKey | null;
  model: ChapterOverviewModel;
  onClose: () => void;
}) {
  if (!category) return null;
  const accent = CATEGORY_ACCENT[category];
  const monthCells = model.heatmap.filter((h) => h.category === category);
  const kpis = categoryKpis(model, category);
  const titleId = `analytics-category-${category}`;

  return (
    <ModalV2 open={open} onClose={onClose} labelledBy={titleId} size="lg" className="max-w-[720px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full" style={{ background: accent }} />
          <div>
            <h2 id={titleId} className="text-[18px] font-bold text-[#111827]">
              {CATEGORY_LABELS[category]}
            </h2>
            <p className="text-[12px] text-[#6b7280]">
              {model.chapterName} · month {model.monthsActive} pace
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-[18px] leading-none text-[#9aa2b1] hover:bg-[#f3f4f6]"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-[#f0ecf6] bg-[#fafafa] px-3 py-2.5">
            <Kpi label={k.label} value={k.value} accent={k.accent} />
          </div>
        ))}
      </div>

      {category === "instructors" ? (
        <div>
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span className="font-medium text-[#6b7280]">Instructor utilization</span>
            <span className="font-bold text-[#7c3aed]">{model.kpis.instructors.utilization}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#ede9fe]">
            <div
              className="h-full rounded-full bg-[#7c3aed]"
              style={{ width: `${Math.min(100, model.kpis.instructors.utilization)}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-[#f0ecf6] bg-white p-2">
        <CategoryTrendChart category={category} points={model.trends[category]} height={240} />
      </div>

      <div>
        <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[#9aa2b1]">
          Monthly status
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {monthCells.map((cell) => {
            const c = PACE_COLORS[cell.status];
            const isPercent = cell.display.endsWith("%");
            const ratio =
              cell.expected > 0
                ? Math.min(1, Math.max(0, cell.actual / cell.expected))
                : cell.actual > 0
                  ? 1
                  : 0;
            return (
              <div key={cell.monthKey} className={`rounded-xl px-2.5 py-2.5 text-center ${c.wash}`}>
                <div className={`text-[10px] font-semibold uppercase tracking-[0.05em] ${c.muted}`}>
                  {cell.label}
                </div>
                {isPercent ? (
                  <div className={`mt-1.5 text-[15px] font-semibold tabular-nums tracking-tight ${c.text}`}>
                    {cell.display}
                  </div>
                ) : (
                  <div className="mt-1.5 inline-flex items-baseline justify-center gap-0.5 tabular-nums leading-none">
                    <span className={`text-[15px] font-semibold tracking-tight ${c.text}`}>
                      {formatHeatValue(cell.actual)}
                    </span>
                    <span className={`text-[12px] font-medium ${c.muted}`}>
                      /{formatHeatValue(cell.expected)}
                    </span>
                  </div>
                )}
                <div className="mx-auto mt-2 h-[3px] w-full max-w-[3.5rem] overflow-hidden rounded-full bg-black/[0.06]">
                  <div
                    className={`h-full rounded-full ${c.bar}`}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
                <div className={`mt-1.5 text-[10px] font-medium ${c.muted}`}>
                  {PACE_STATUS_LABELS[cell.status]}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ModalV2>
  );
}

function exportOverviewCsv(model: ChapterOverviewModel) {
  const lines = [
    ["Category", ...model.months.map((m) => m.label)].join(","),
    ...ANALYTICS_CATEGORY_KEYS.map((cat) => {
      const cells = model.months.map((m) => {
        const cell = model.heatmap.find((h) => h.category === cat && h.monthKey === m.key);
        return cell ? `"${cell.display}"` : "";
      });
      return [CATEGORY_LABELS[cat], ...cells].join(",");
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${model.chapterName.replace(/\s+/g, "-").toLowerCase()}-analytics.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildOverviewHref(opts: {
  chapterId?: string;
  range?: AnalyticsRangeMonths;
  includeChapter: boolean;
}): string {
  const p = new URLSearchParams();
  if (opts.range && opts.range !== 6) p.set("range", String(opts.range));
  if (opts.includeChapter && opts.chapterId) p.set("chapter", opts.chapterId);
  const s = p.toString();
  return s ? `/chapter/impact?${s}` : "/chapter/impact";
}

/** Client-only Overview. Props must stay serializable (no functions). */
export function ChapterAnalyticsOverview({
  model,
  leaderboardHref,
  includeChapterInQuery = false,
}: {
  model: ChapterOverviewModel;
  leaderboardHref: string;
  /** When true, chapter switches write `?chapter=` into the URL (leadership). */
  includeChapterInQuery?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [chapterId, setChapterId] = useState(model.chapterId);
  const [range, setRange] = useState<AnalyticsRangeMonths>(model.rangeMonths);
  const [openCategory, setOpenCategory] = useState<AnalyticsCategoryKey | null>(null);

  const overviewHref = buildOverviewHref({
    chapterId: model.chapterId,
    range: model.rangeMonths,
    includeChapter: includeChapterInQuery,
  });

  const heatmapByCat = useMemo(() => {
    const map = {} as Record<AnalyticsCategoryKey, typeof model.heatmap>;
    for (const cat of ANALYTICS_CATEGORY_KEYS) {
      map[cat] = model.heatmap.filter((h) => h.category === cat);
    }
    return map;
  }, [model.heatmap]);

  function navigate(nextChapter: string, nextRange: AnalyticsRangeMonths) {
    startTransition(() => {
      window.location.href = buildOverviewHref({
        chapterId: nextChapter,
        range: nextRange,
        includeChapter: includeChapterInQuery,
      });
    });
  }

  return (
    <div className={`flex flex-col gap-5 ${pending ? "opacity-70" : ""}`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4f46e5]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-[#111827]">Chapter Analytics</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={overviewHref}
                className="rounded-full bg-[#4f46e5] px-3 py-1 text-[12px] font-semibold text-white"
              >
                Overview
              </Link>
              <Link
                href={leaderboardHref}
                className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[12px] font-semibold text-[#4b5563] hover:border-[#c7d2fe] hover:text-[#4338ca]"
              >
                Leaderboard
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] shadow-sm">
            <span className="text-[#9aa2b1]">Chapter</span>
            <select
              className="max-w-[180px] border-0 bg-transparent font-semibold text-[#111827] outline-none"
              value={chapterId}
              onChange={(e) => {
                const next = e.target.value;
                setChapterId(next);
                navigate(next, range);
              }}
            >
              {model.chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] shadow-sm">
            <span className="text-[#9aa2b1]">Range</span>
            <select
              className="border-0 bg-transparent font-semibold text-[#111827] outline-none"
              value={range}
              onChange={(e) => {
                const next = Number(e.target.value) as AnalyticsRangeMonths;
                setRange(next);
                navigate(chapterId, next);
              }}
            >
              <option value={3}>Last 3 Months</option>
              <option value={6}>Last 6 Months</option>
              <option value={12}>Last 12 Months</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => exportOverviewCsv(model)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] font-semibold text-[#374151] shadow-sm hover:border-[#c7d2fe]"
          >
            Export
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[#e8e4f0] bg-[#f8f9fc] px-4 py-2.5 text-[13px] text-[#4b5563]">
        <span>
          Chapter launched: <strong className="text-[#111827]">{model.launchedLabel}</strong>
        </span>
        <span>
          Months active: <strong className="text-[#111827]">{model.monthsActive}</strong>
        </span>
        <span className="text-[#6b7280]">
          Expectations calibrated to month {model.monthsActive} benchmarks
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#e8e4f0] bg-white shadow-[0_1px_2px_rgb(46_16_101/0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#f0ecf6] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[15px] font-bold text-[#111827]">Monthly Status by Category</h2>
          <PaceLegend compact />
        </div>
        <div className="overflow-x-auto px-2 pb-2 pt-1 sm:px-3">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.05em] text-[#9aa2b1]">
                <th className="px-3 py-2.5 font-semibold">Category</th>
                {model.months.map((m) => (
                  <th key={m.key} className="px-1 py-2.5 text-center font-semibold sm:px-1.5">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ANALYTICS_CATEGORY_KEYS.map((cat) => (
                <tr key={cat}>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setOpenCategory(cat)}
                      className="flex items-center gap-2 rounded-lg text-left transition hover:opacity-80"
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white"
                        style={{ background: CATEGORY_ACCENT[cat] }}
                      >
                        {cat === "students" ? "S" : cat === "instructors" ? "I" : cat === "partners" ? "P" : "Q"}
                      </span>
                      <span className="text-[13px] font-semibold text-[#111827]">{CATEGORY_LABELS[cat]}</span>
                    </button>
                  </td>
                  {heatmapByCat[cat].map((cell) => (
                    <td key={cell.monthKey} className="px-1 py-2 text-center sm:px-1.5">
                      <HeatmapTile
                        display={cell.display}
                        actual={cell.actual}
                        expected={cell.expected}
                        status={cell.status}
                        label={`${CATEGORY_LABELS[cat]} ${cell.label}`}
                        onClick={() => setOpenCategory(cat)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ANALYTICS_CATEGORY_KEYS.map((cat) => {
          const kpis = categoryKpis(model, cat);
          return (
            <DetailCard
              key={cat}
              title={CATEGORY_LABELS[cat]}
              accent={CATEGORY_ACCENT[cat]}
              onOpen={() => setOpenCategory(cat)}
              kpis={
                <>
                  {kpis.map((k) => (
                    <Kpi key={k.label} label={k.label} value={k.value} accent={k.accent} />
                  ))}
                </>
              }
            >
              {cat === "instructors" ? (
                <div className="mb-2 px-1">
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[#6b7280]">Instructor utilization</span>
                    <span className="font-bold text-[#7c3aed]">{model.kpis.instructors.utilization}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#ede9fe]">
                    <div
                      className="h-full rounded-full bg-[#7c3aed]"
                      style={{ width: `${Math.min(100, model.kpis.instructors.utilization)}%` }}
                    />
                  </div>
                </div>
              ) : null}
              <CategoryTrendChart
                category={cat}
                points={model.trends[cat]}
                height={cat === "instructors" ? 150 : 180}
              />
            </DetailCard>
          );
        })}
      </div>

      <CategoryDetailModal
        open={openCategory != null}
        category={openCategory}
        model={model}
        onClose={() => setOpenCategory(null)}
      />
    </div>
  );
}
