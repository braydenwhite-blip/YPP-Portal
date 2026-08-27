"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
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
import { Button, ModalFooterV2, ModalV2, cn, StatusBadge } from "@/components/ui-v2";
import type {
  EditableCategorySnapshot,
  EditableMetricSnapshot,
  EditableScopeSnapshot,
  MetricsScope,
} from "@/lib/chapters/metrics-tracker/catalog";
import {
  MetricEditorModal,
  type MetricEditorState,
} from "@/components/chapter/metrics-tracker/metric-editor-modal";

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

type GroupAccent = {
  chip: string;
  chipActive: string;
  panel: string;
  dot: string;
  chartBar: string;
  chartSoft: string;
  cardBorder: string;
};

const GROUP_ACCENTS: GroupAccent[] = [
  // Intentionally not brand / complete / progress / blocked — those are reserved for StatusStrip.
  {
    chip: "bg-sky-50 text-sky-950 border-sky-100",
    chipActive: "bg-sky-600 text-white border-sky-600 shadow-sm",
    panel: "from-sky-50/80 to-white",
    dot: "bg-sky-500",
    chartBar: "#0284c7",
    chartSoft: "#e0f2fe",
    cardBorder: "border-l-sky-500",
  },
  {
    chip: "bg-indigo-50 text-indigo-950 border-indigo-100",
    chipActive: "bg-indigo-600 text-white border-indigo-600 shadow-sm",
    panel: "from-indigo-50/80 to-white",
    dot: "bg-indigo-500",
    chartBar: "#4f46e5",
    chartSoft: "#e0e7ff",
    cardBorder: "border-l-indigo-500",
  },
  {
    chip: "bg-teal-50 text-teal-950 border-teal-100",
    chipActive: "bg-teal-600 text-white border-teal-600 shadow-sm",
    panel: "from-teal-50/80 to-white",
    dot: "bg-teal-500",
    chartBar: "#0d9488",
    chartSoft: "#ccfbf1",
    cardBorder: "border-l-teal-500",
  },
  {
    chip: "bg-fuchsia-50 text-fuchsia-950 border-fuchsia-100",
    chipActive: "bg-fuchsia-600 text-white border-fuchsia-600 shadow-sm",
    panel: "from-fuchsia-50/70 to-white",
    dot: "bg-fuchsia-500",
    chartBar: "#c026d3",
    chartSoft: "#fae8ff",
    cardBorder: "border-l-fuchsia-500",
  },
  {
    chip: "bg-slate-50 text-slate-900 border-slate-200",
    chipActive: "bg-slate-700 text-white border-slate-700 shadow-sm",
    panel: "from-slate-50/80 to-white",
    dot: "bg-slate-500",
    chartBar: "#64748b",
    chartSoft: "#f1f5f9",
    cardBorder: "border-l-slate-400",
  },
];

type MetricGroup = {
  id: string;
  label: string;
  blurb: string;
  categoryId: string;
  metrics: EditableMetricSnapshot[];
  categories?: EditableCategorySnapshot[];
  status: PaceStatus;
  accent: GroupAccent;
};

const ORG_GROUP_DEFS: Array<{ id: string; label: string; blurb: string; keys: string[] }> = [
  {
    id: "growth",
    label: "Growth",
    blurb: "Revenue, classes, expansion, referrals",
    keys: [
      "revenue",
      "students_per_class",
      "classes_all_chapters",
      "expansion",
      "chapter_expansion",
      "referrals",
    ],
  },
  {
    id: "social",
    label: "Social & reach",
    blurb: "Applies and followers across channels",
    keys: [
      "social_apply",
      "instagram_followers",
      "tiktok_followers",
      "linkedin_recruit",
      "facebook_apply",
    ],
  },
  {
    id: "community",
    label: "Community",
    blurb: "Parent committees and newsletters",
    keys: ["parent_engagement", "newsletters"],
  },
  {
    id: "ops",
    label: "Operations",
    blurb: "Fix time and delivery quality",
    keys: ["mttr", "timeliness"],
  },
];

function rollupGroupStatus(metrics: EditableMetricSnapshot[]): PaceStatus {
  const ranked = metrics
    .map((m) => m.status)
    .filter((s): s is PaceStatus => s !== "informational");
  if (ranked.length === 0) return "on_track";
  if (ranked.includes("at_risk")) return "at_risk";
  if (ranked.includes("needs_attention")) return "needs_attention";
  if (ranked.every((s) => s === "above")) return "above";
  return "on_track";
}

function buildGroups(scope: EditableScopeSnapshot): MetricGroup[] {
  if (scope.scope === "org") {
    const all = scope.categories.flatMap((c) =>
      c.metrics.map((metric) => ({ categoryId: c.def.id, metric }))
    );
    const byKey = new Map(all.map((x) => [x.metric.def.id, x]));
    const used = new Set<string>();
    const groups: MetricGroup[] = ORG_GROUP_DEFS.map((def, i) => {
      const items = def.keys
        .map((key) => byKey.get(key))
        .filter((x): x is { categoryId: string; metric: EditableMetricSnapshot } => Boolean(x));
      items.forEach(({ metric }) => used.add(metric.def.id));
      const metrics = items.map((x) => x.metric);
      return {
        id: def.id,
        label: def.label,
        blurb: def.blurb,
        categoryId: items[0]?.categoryId ?? scope.categories[0]?.def.id ?? "org_tracker",
        metrics,
        status: rollupGroupStatus(metrics),
        accent: GROUP_ACCENTS[i % GROUP_ACCENTS.length]!,
      };
    }).filter((g) => g.metrics.length > 0);

    const leftover = all.filter(({ metric }) => !used.has(metric.def.id));
    if (leftover.length > 0) {
      const metrics = leftover.map((x) => x.metric);
      groups.push({
        id: "other",
        label: "Other",
        blurb: "Additional tracked metrics",
        categoryId: leftover[0]!.categoryId,
        metrics,
        status: rollupGroupStatus(metrics),
        accent: GROUP_ACCENTS[4]!,
      });
    }
    return groups;
  }

  if (scope.scope === "chapter_president" && scope.chapterGroups?.length) {
    return scope.chapterGroups.map((chapter, i) => ({
      id: chapter.id,
      label: chapter.label,
      blurb: chapter.blurb,
      categoryId: chapter.categories[0]?.def.id ?? "partnerships",
      metrics: chapter.categories.flatMap((c) => c.metrics),
      categories: chapter.categories,
      status: chapter.status,
      accent: GROUP_ACCENTS[i % GROUP_ACCENTS.length]!,
    }));
  }

  return scope.categories.map((cat, i) => ({
    id: cat.def.id,
    label: cat.def.label,
    blurb: cat.def.description,
    categoryId: cat.def.id,
    metrics: cat.metrics,
    status: cat.status,
    accent: GROUP_ACCENTS[i % GROUP_ACCENTS.length]!,
  }));
}

function MetricChart({
  metric,
  height = 140,
  compact = false,
  chartColors,
}: {
  metric: EditableMetricSnapshot;
  height?: number;
  compact?: boolean;
  chartColors?: { bar: string; soft: string };
}) {
  const fallback = statusAccent(metric.status);
  const bar = chartColors?.bar ?? fallback.bar;
  const soft = chartColors?.soft ?? fallback.soft;
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
          {!compact ? (
            <YAxis tick={tick} width={36} axisLine={false} tickLine={false} />
          ) : null}
          {tip}
          <Bar dataKey="have" fill={bar} radius={[3, 3, 0, 0]} name="Have" />
          {!compact ? (
            <Bar dataKey="goal" fill="#e2e8f0" radius={[3, 3, 0, 0]} name="Goal" />
          ) : null}
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
          {!compact ? (
            <YAxis tick={tick} width={36} axisLine={false} tickLine={false} />
          ) : null}
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
        {!compact ? (
          <YAxis tick={tick} width={36} axisLine={false} tickLine={false} />
        ) : null}
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

function MonthlyTargetsTable({ metric }: { metric: EditableMetricSnapshot }) {
  const m = metric.def;
  const months = ["M1", "M2", "M3", "M4", "M5", "M6"];
  return (
    <div className="overflow-x-auto rounded-[12px] border border-line-card bg-surface">
      <table className="w-full min-w-[420px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line-card bg-surface-soft">
            <th className="px-3 py-2 font-semibold text-ink-muted">Month</th>
            {months.map((mo) => (
              <th key={mo} className="px-2 py-2 text-center font-semibold text-ink-muted">
                {mo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-3 py-2 font-medium text-ink">Target</td>
            {months.map((mo, i) => {
              const display = m.targetDisplay?.[i];
              const num = m.monthlyTargets[i];
              const cell =
                display ??
                (m.noTarget || num == null
                  ? "—"
                  : fmt(m.unit, num));
              return (
                <td key={mo} className="px-2 py-2 text-center tabular-nums text-ink">
                  {cell}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type DetailState = {
  scope: MetricsScope;
  categoryId: string;
  metric: EditableMetricSnapshot;
  groupAccent?: GroupAccent;
};

function MetricDetailModal({
  state,
  onClose,
  canEdit,
  onEdit,
}: {
  state: DetailState | null;
  onClose: () => void;
  canEdit: boolean;
  onEdit: (state: DetailState) => void;
}) {
  const titleId = useId();
  if (!state) return null;
  const { metric } = state;
  const m = metric.def;
  const headerAccent = statusAccent(metric.status);

  return (
    <ModalV2 open={Boolean(state)} onClose={onClose} labelledBy={titleId} size="lg" className="max-w-[720px]">
      <div className="flex flex-col gap-5">
        <div className={cn("rounded-[12px] border-l-4 px-4 py-3", headerAccent.border)} style={{ background: headerAccent.soft }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="m-0 text-[18px] font-bold tracking-tight text-ink">
                {m.label}
              </h2>
              <p className="m-0 mt-1 text-[13px] text-ink-muted">
                {m.owner}
                {m.targetLabel.trim() ? ` · Target ${m.targetLabel}` : ""}
              </p>
            </div>
            <StatusBadge tone={tone(metric.status)}>{statusLabel(metric.status)}</StatusBadge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Have", v: fmt(m.unit, metric.actual) },
            {
              k: "Goal",
              v: metric.target != null && !m.noTarget ? fmt(m.unit, metric.target) : "—",
            },
            {
              k: "Pace",
              v: metric.percentOfTarget != null ? `${metric.percentOfTarget}%` : "—",
            },
            { k: "Resets", v: m.reset === "cumulative" ? "Cumulative" : "Monthly" },
          ].map((cell) => (
            <div
              key={cell.k}
              className="rounded-[12px] border border-line-card bg-surface px-3 py-2.5"
            >
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
                {cell.k}
              </p>
              <p className="m-0 mt-0.5 text-[20px] font-bold tabular-nums text-ink">{cell.v}</p>
            </div>
          ))}
        </div>

        {m.tracks ? (
          <p className="m-0 text-[13.5px] leading-relaxed text-ink-muted">{m.tracks}</p>
        ) : null}
        {m.why ? (
          <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
            <span className="font-semibold text-ink">Why it matters: </span>
            {m.why}
          </p>
        ) : null}

        <div>
          <p className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
            Monthly targets (M1–M6)
          </p>
          <MonthlyTargetsTable metric={metric} />
        </div>

        <div className="rounded-[12px] border border-line-card bg-surface px-2 py-3">
          <MetricChart
            metric={metric}
            height={220}
            chartColors={{ bar: headerAccent.bar, soft: headerAccent.soft }}
          />
        </div>

        <ModalFooterV2 className="w-full !justify-between">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canEdit ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                onClose();
                onEdit(state);
              }}
            >
              Edit metric
            </Button>
          ) : null}
        </ModalFooterV2>
      </div>
    </ModalV2>
  );
}

function MetricCard({
  metric,
  onOpen,
}: {
  metric: EditableMetricSnapshot;
  onOpen: () => void;
  /** Kept for call sites; cards follow status badge colors, not group accent. */
  groupAccent?: GroupAccent;
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
          <p className="m-0 mt-1 truncate text-[12px] text-ink-muted">{metric.def.owner}</p>
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
        <MetricChart
          metric={metric}
          height={84}
          compact
          chartColors={{ bar: accent.bar, soft: accent.soft }}
        />
      </div>
    </button>
  );
}

function StatusStrip({ metrics }: { metrics: EditableMetricSnapshot[] }) {
  const counts = useMemo(() => {
    const c = { above: 0, on_track: 0, needs_attention: 0, at_risk: 0, informational: 0 };
    for (const m of metrics) {
      if (m.status === "informational") c.informational += 1;
      else c[m.status] += 1;
    }
    return c;
  }, [metrics]);

  const items = [
    { key: "above", label: "Above", n: counts.above, className: "bg-brand-50 text-brand-700" },
    {
      key: "on_track",
      label: "On track",
      n: counts.on_track,
      className: "bg-complete-50 text-complete-700",
    },
    {
      key: "needs_attention",
      label: "Watch",
      n: counts.needs_attention,
      className: "bg-progress-50 text-progress-700",
    },
    { key: "at_risk", label: "At risk", n: counts.at_risk, className: "bg-blocked-50 text-blocked-700" },
  ] as const;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.key}
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
  );
}

const TABS: Array<{ scope: MetricsScope; label: string }> = [
  { scope: "org", label: "Organization" },
  { scope: "chapter_president", label: "Chapters" },
  { scope: "instructor", label: "Instructor" },
];

export function MetricsHubView({
  scopes,
  chapterMonth,
  monthLabel,
  canEdit = false,
}: {
  scopes: EditableScopeSnapshot[];
  chapterMonth: number;
  /** Calendar month name shown in the banner, e.g. "August". */
  monthLabel?: string;
  canEdit?: boolean;
}) {
  const [tab, setTab] = useState<MetricsScope>("org");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [editor, setEditor] = useState<MetricEditorState | null>(null);

  const active = useMemo(() => scopes.find((s) => s.scope === tab), [scopes, tab]);
  const groups = useMemo(() => (active ? buildGroups(active) : []), [active]);

  const selectedId =
    groupId && groups.some((g) => g.id === groupId) ? groupId : (groups[0]?.id ?? null);
  const selected = groups.find((g) => g.id === selectedId) ?? null;
  const allMetrics = useMemo(() => groups.flatMap((g) => g.metrics), [groups]);

  if (!active) return null;

  function selectTab(next: MetricsScope) {
    setTab(next);
    setGroupId(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg-tabs" role="tablist" aria-label="Metric scope">
          {TABS.map((t) => (
            <button
              key={t.scope}
              type="button"
              role="tab"
              aria-selected={t.scope === tab}
              className={cn("seg-tab", t.scope === tab && "active")}
              onClick={() => selectTab(t.scope)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canEdit && selected ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setEditor({
                mode: "create",
                scope: active.scope,
                categoryId: selected.categoryId,
              })
            }
          >
            Add metric
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line-card bg-surface px-4 py-3 shadow-sm">
        <p className="m-0 text-[13px] text-ink-muted">
          Targets and pace for {monthLabel ?? `Month ${chapterMonth}`}
          {tab === "chapter_president"
            ? " — pick a chapter on the left."
            : " — pick a group on the left."}
        </p>
        <StatusStrip metrics={allMetrics} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-2">
          {groups.map((g) => {
            const on = selected?.id === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupId(g.id)}
                className={cn(
                  "rounded-[12px] border px-3 py-3 text-left transition",
                  on ? g.accent.chipActive : cn(g.accent.chip, "hover:brightness-[0.98]")
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-bold">{g.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
                      on ? "bg-white/20 text-white" : "bg-white/70 text-ink"
                    )}
                  >
                    {g.metrics.length}
                  </span>
                </div>
                <p
                  className={cn(
                    "m-0 mt-1 line-clamp-2 text-[12px] leading-snug",
                    on ? "text-white/85" : "text-ink-muted"
                  )}
                >
                  {g.blurb}
                </p>
                <div className="mt-2">
                  <StatusBadge tone={tone(g.status)}>{statusLabel(g.status)}</StatusBadge>
                </div>
              </button>
            );
          })}
        </aside>

        <section
          className={cn(
            "rounded-[16px] border border-line-card bg-gradient-to-b p-4 shadow-sm sm:p-5",
            selected?.accent.panel ?? "from-surface-soft to-white"
          )}
        >
          {selected ? (
            <>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", selected.accent.dot)} />
                    <h2 className="m-0 text-[18px] font-bold tracking-tight text-ink">
                      {selected.label}
                    </h2>
                  </div>
                  <p className="m-0 mt-1 text-[13px] text-ink-muted">{selected.blurb}</p>
                </div>
                <p className="m-0 text-[12px] font-medium text-ink-muted">
                  Tap a card for the full chart
                </p>
              </div>
              {selected.categories ? (
                <div className="flex flex-col gap-6">
                  {selected.categories.map((cat) => (
                    <div key={cat.def.id}>
                      <div className="mb-3">
                        <h3 className="m-0 text-[15px] font-bold text-ink">{cat.def.label}</h3>
                        <p className="m-0 mt-0.5 text-[13px] text-ink-muted">{cat.def.description}</p>
                        {cat.def.notes?.map((note) => (
                          <p
                            key={note}
                            className="m-0 mt-2 max-w-2xl rounded-lg border border-warning-100 bg-warning-100/40 px-3 py-2 text-[12.5px] leading-snug text-ink-muted"
                          >
                            {note}
                          </p>
                        ))}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {cat.metrics.map((metric) => (
                          <MetricCard
                            key={`${selected.id}-${metric.def.id}`}
                            metric={metric}
                            onOpen={() =>
                              setDetail({
                                scope: active.scope,
                                categoryId: cat.def.id,
                                metric,
                                groupAccent: selected.accent,
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {selected.metrics.map((metric) => (
                    <MetricCard
                      key={metric.rowId}
                      metric={metric}
                      onOpen={() =>
                        setDetail({
                          scope: active.scope,
                          categoryId: selected.categoryId,
                          metric,
                          groupAccent: selected.accent,
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="m-0 text-[14px] text-ink-muted">No metrics in this scope yet.</p>
          )}
        </section>
      </div>

      <MetricDetailModal
        state={detail}
        onClose={() => setDetail(null)}
        canEdit={canEdit}
        onEdit={(s) =>
          setEditor({
            mode: "edit",
            scope: s.scope,
            categoryId: s.categoryId,
            metric: s.metric,
          })
        }
      />
      {canEdit ? <MetricEditorModal state={editor} onClose={() => setEditor(null)} /> : null}
    </div>
  );
}

/** @deprecated Prefer hub + detail modal; kept for deep links. */
export function MetricsCategoryView({
  category,
  scope,
  chapterMonth,
  monthLabel,
  canEdit = false,
}: {
  category: EditableCategorySnapshot;
  scope: MetricsScope;
  chapterMonth: number;
  monthLabel?: string;
  canEdit?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/metrics"
        className="text-[13px] font-semibold text-brand-700 no-underline hover:underline"
      >
        ← Metrics
      </Link>
      <MetricsHubView
        scopes={[
          {
            scope,
            label: category.def.label,
            blurb: category.def.description,
            icon: "",
            status: category.status,
            categories: [category],
          },
        ]}
        chapterMonth={chapterMonth}
        monthLabel={monthLabel}
        canEdit={canEdit}
      />
    </div>
  );
}
