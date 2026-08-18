"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
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

import { ModalV2, cn } from "@/components/ui-v2";
import { setAnalyticsCategoryNote } from "@/lib/chapters/analytics-goals-actions";
import type { ChapterOverviewModel, TrendPoint } from "@/lib/chapters/analytics-types";
import type { AnalyticsRangeMonths } from "@/lib/chapters/analytics-types";
import {
  ANALYTICS_CATEGORY_KEYS,
  CATEGORY_LABELS,
  PACE_STATUS_LABELS,
  type AnalyticsCategoryKey,
} from "@/lib/chapters/analytics-pace";

import { CATEGORY_ACCENT, PACE_COLORS, PaceLegend } from "./pace-styles";

function formatHeatValue(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ink" | "muted" | "danger" | "good";
}) {
  const valueClass =
    tone === "danger"
      ? "text-blocked-700"
      : tone === "good"
        ? "text-complete-700"
        : tone === "muted"
          ? "text-ink-muted"
          : "text-ink";
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium text-ink-muted">{label}</div>
      <div className={cn("mt-0.5 text-[18px] font-bold tabular-nums", valueClass)}>{value}</div>
    </div>
  );
}

function ChartKeys({ variant }: { variant: "line" | "bar" }) {
  if (variant === "bar") {
    return (
      <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[#6b21c8]" />
          Retention
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-[#ece8f2] ring-1 ring-[#d4cde0]" />
          Goal
        </span>
      </span>
    );
  }
  return (
    <span className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] text-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="relative inline-flex h-[2px] w-4 items-center bg-[#6b21c8]">
          <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6b21c8]" />
        </span>
        Have
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-4 border-t-[1.75px] border-dashed border-[#8a8299]" />
        Goal
      </span>
    </span>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  percent,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  percent?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-line-card bg-surface px-2.5 py-2 text-[12px] shadow-card">
      <div className="mb-1 font-semibold text-ink">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <span className="size-1.5 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold tabular-nums text-ink">
            {percent ? `${Math.round(Number(entry.value ?? 0))}%` : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function DetailCard({
  title,
  children,
  kpis,
  onOpen,
  keys,
}: {
  title: string;
  children: React.ReactNode;
  kpis: React.ReactNode;
  onOpen: () => void;
  keys: "line" | "bar";
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-[14px] border border-line-card bg-surface text-left shadow-card transition hover:border-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h3 className="m-0 text-[14px] font-semibold text-ink">{title}</h3>
        <ChartKeys variant={keys} />
      </div>
      <div className="pointer-events-none px-3 pb-1">{children}</div>
      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-line-card px-4 py-3 sm:grid-cols-4">
        {kpis}
      </div>
    </button>
  );
}

function categoryKpis(model: ChapterOverviewModel, category: AnalyticsCategoryKey) {
  switch (category) {
    case "students":
      return [
        { label: "Have", value: String(model.current.students) },
        { label: "Goal", value: String(model.expected.students), tone: "muted" as const },
        {
          label: "Gap",
          value: model.kpis.students.gap > 0 ? `+${model.kpis.students.gap}` : String(model.kpis.students.gap),
          tone: (model.kpis.students.gap < 0 ? "danger" : "good") as const,
        },
        { label: "Retention", value: `${model.kpis.students.retention}%` },
      ];
    case "instructors":
      return [
        { label: "Have", value: String(model.current.instructors) },
        { label: "Goal", value: String(model.expected.instructors), tone: "muted" as const },
        {
          label: "Gap",
          value:
            model.current.instructors - model.expected.instructors > 0
              ? `+${model.current.instructors - model.expected.instructors}`
              : String(model.current.instructors - model.expected.instructors),
          tone: (model.current.instructors - model.expected.instructors < 0 ? "danger" : "good") as const,
        },
        { label: "Utilization", value: `${model.kpis.instructors.utilization}%` },
      ];
    case "partners":
      return [
        { label: "Have", value: String(model.current.partners) },
        { label: "Goal", value: String(model.expected.partners), tone: "muted" as const },
        {
          label: "Gap",
          value: model.kpis.partners.gap > 0 ? `+${model.kpis.partners.gap}` : String(model.kpis.partners.gap),
          tone: (model.kpis.partners.gap < 0 ? "danger" : "good") as const,
        },
        { label: "Pending meetings", value: String(model.kpis.partners.pendingMeetings) },
      ];
    case "quality":
      return [
        {
          label: "Reviews",
          value:
            model.kpis.quality.instructorReviewAvg != null
              ? `${model.kpis.quality.instructorReviewAvg} / 5`
              : "—",
        },
        {
          label: "Parent feedback",
          value:
            model.kpis.quality.parentFeedbackAvg != null
              ? `${model.kpis.quality.parentFeedbackAvg} / 5`
              : "—",
        },
        { label: "Retention", value: `${model.kpis.quality.retention}%` },
        { label: "Follow-ups", value: String(model.kpis.quality.followUpFlagged) },
      ];
  }
}

const HAVE_STROKE = "#6b21c8";
const GOAL_STROKE = "#8a8299";
const GOAL_BAR = "#ece8f2";

function CategoryTrendChart({
  category,
  points,
  height = 220,
}: {
  category: AnalyticsCategoryKey;
  points: TrendPoint[];
  height?: number;
}) {
  const tick = { fill: "#6b5f7a", fontSize: 11 };
  if (category === "quality") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={points.map((p) => ({
            label: p.label,
            have: p.actual,
            goal: p.expected,
          }))}
        >
          <CartesianGrid stroke="rgba(26,5,51,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
          <YAxis tick={tick} axisLine={false} tickLine={false} width={28} domain={[0, 100]} />
          <Tooltip content={(props) => <ChartTooltip {...props} percent />} />
          <Bar dataKey="have" name="Retention" fill={HAVE_STROKE} radius={[4, 4, 0, 0]} />
          <Bar dataKey="goal" name="Goal" fill={GOAL_BAR} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points}>
        <CartesianGrid stroke="rgba(26,5,51,0.06)" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
        <YAxis tick={tick} axisLine={false} tickLine={false} width={28} />
        <Tooltip content={(props) => <ChartTooltip {...props} />} />
        <Line
          type="monotone"
          dataKey="actual"
          name="Have"
          stroke={HAVE_STROKE}
          strokeWidth={2.25}
          dot={{ r: 3, fill: HAVE_STROKE, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="expected"
          name="Goal"
          stroke={GOAL_STROKE}
          strokeDasharray="4 4"
          strokeWidth={1.75}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function NotesEditor({
  chapterId,
  category,
  monthKey,
  initialValue,
}: {
  chapterId: string;
  category: AnalyticsCategoryKey;
  monthKey: string;
  initialValue: string | null;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function commit() {
    if (value === (initialValue ?? "")) return;
    startTransition(async () => {
      const res = await setAnalyticsCategoryNote({ chapterId, category, monthKey, body: value });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    });
  }

  return (
    <div className="rounded-xl border border-[#f0ecf6] bg-[#fafafa] p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#9aa2b1]">Notes this month</h3>
        {saved ? <span className="text-[10px] font-semibold text-[#16a34a]">Saved</span> : null}
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        disabled={pending}
        placeholder="Context, blockers, or plans for this category…"
        rows={3}
        className="w-full resize-none rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#111827] outline-none transition focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#ede9fe]"
      />
    </div>
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
  const currentMonthKey = model.months[model.months.length - 1]?.key ?? "";

  return (
    <ModalV2 open={open} onClose={onClose} labelledBy={titleId} size="lg" className="max-w-[760px] !p-0 overflow-hidden">
      <div
        className="flex items-start justify-between gap-3 px-6 py-5"
        style={{
          background: `linear-gradient(135deg, ${accent}1a 0%, ${accent}05 100%)`,
          borderBottom: `1px solid ${accent}33`,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-bold text-white shadow-sm"
            style={{ background: accent }}
          >
            {category === "students" ? "S" : category === "instructors" ? "I" : category === "partners" ? "P" : "Q"}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 id={titleId} className="text-[19px] font-bold tracking-tight text-[#111827]">
                {CATEGORY_LABELS[category]}
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-white"
                style={{ background: accent }}
              >
                Detailed view
              </span>
            </div>
            <p className="text-[12px] text-[#6b7280]">
              {model.chapterName} · month {model.monthsActive} pace
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-[18px] leading-none text-[#9aa2b1] hover:bg-white/70"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-[#f0ecf6] bg-[#fafafa] px-3 py-2.5">
              <Kpi label={k.label} value={k.value} tone={k.tone} />
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
        <div className="flex justify-end px-2 pt-2">
          <ChartKeys variant={category === "quality" ? "bar" : "line"} />
        </div>
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

        <NotesEditor
          chapterId={model.chapterId}
          category={category}
          monthKey={currentMonthKey}
          initialValue={model.notes[category]}
        />
      </div>
    </ModalV2>
  );
}

function exportOverviewCsv(model: ChapterOverviewModel) {
  const monthLabels = model.months.map((m) => m.label);
  const lines = [
    ["Chapter", model.chapterName].join(","),
    ["Category", "Series", ...monthLabels].join(","),
    ...ANALYTICS_CATEGORY_KEYS.flatMap((cat) => {
      const isQuality = cat === "quality";
      const have = model.months.map((m) => {
        const cell = model.heatmap.find((h) => h.category === cat && h.monthKey === m.key);
        if (!cell) return "";
        return isQuality ? `${Math.round(cell.actual)}%` : String(cell.actual);
      });
      const goal = model.months.map((m) => {
        const cell = model.heatmap.find((h) => h.category === cat && h.monthKey === m.key);
        if (!cell) return "";
        return isQuality ? `${Math.round(cell.expected)}%` : String(cell.expected);
      });
      const gap = model.months.map((m) => {
        const cell = model.heatmap.find((h) => h.category === cat && h.monthKey === m.key);
        if (!cell) return "";
        const delta = Math.round(cell.actual - cell.expected);
        return String(delta);
      });
      const label = CATEGORY_LABELS[cat];
      return [
        [label, isQuality ? "Retention" : "Have", ...have].join(","),
        [label, "Goal", ...goal].join(","),
        [label, "Gap", ...gap].join(","),
      ];
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
            {includeChapterInQuery ? (
              <Link
                href="/admin/chapters"
                className="mb-1 inline-block text-[12.5px] font-semibold text-brand-700 no-underline hover:underline"
              >
                ← Chapters
              </Link>
            ) : null}
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

      <section className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
        <div className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="m-0 text-[15px] font-semibold tracking-tight text-ink">Pace</h2>
            <p className="m-0 text-[12px] text-ink-muted">Have / goal for every chapter month</p>
          </div>
          <PaceLegend compact />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse">
            <thead>
              <tr className="border-y border-line-card">
                <th className="w-32 px-5 py-2 text-left text-[12px] font-medium text-ink-muted" />
                {model.months.map((m, i) => (
                  <th
                    key={m.key}
                    className={cn(
                      "px-2 py-2 text-center text-[12px] font-medium",
                      i === model.months.length - 1 ? "text-ink" : "text-ink-muted"
                    )}
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ANALYTICS_CATEGORY_KEYS.map((cat) => (
                <tr
                  key={cat}
                  tabIndex={0}
                  aria-label={`Open ${CATEGORY_LABELS[cat]} details`}
                  onClick={() => setOpenCategory(cat)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenCategory(cat);
                    }
                  }}
                  className="cursor-pointer border-b border-line-card last:border-b-0 hover:bg-surface-soft focus-visible:bg-surface-soft focus-visible:outline-none"
                >
                  <th
                    scope="row"
                    className="px-5 py-3 text-left text-[13.5px] font-semibold text-ink"
                  >
                    {CATEGORY_LABELS[cat]}
                  </th>
                  {heatmapByCat[cat].map((cell) => {
                    const isPercent = cat === "quality";
                    const colors = PACE_COLORS[cell.status];
                    return (
                      <td key={cell.monthKey} className="px-2 py-3 text-center">
                        <span className="inline-flex flex-col items-center gap-1">
                          <span className="tabular-nums leading-none">
                            <span className="text-[14px] font-semibold text-ink">
                              {isPercent ? `${Math.round(cell.actual)}%` : formatHeatValue(cell.actual)}
                            </span>
                            <span className="text-[12px] text-ink-muted">
                              /{isPercent ? `${Math.round(cell.expected)}%` : formatHeatValue(cell.expected)}
                            </span>
                          </span>
                          <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} aria-label={PACE_STATUS_LABELS[cell.status]} />
                        </span>
                      </td>
                    );
                  })}
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
              keys={cat === "quality" ? "bar" : "line"}
              onOpen={() => setOpenCategory(cat)}
              kpis={
                <>
                  {kpis.map((k) => (
                    <Kpi key={k.label} label={k.label} value={k.value} tone={k.tone} />
                  ))}
                </>
              }
            >
              <CategoryTrendChart
                category={cat}
                points={model.trends[cat]}
                height={180}
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
