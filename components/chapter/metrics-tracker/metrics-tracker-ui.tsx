"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { PACE_STATUS_LABELS, type PaceStatus } from "@/lib/chapters/analytics-pace";
import {
  MetricPerformanceChart,
  formatMetricValue,
} from "@/components/chapter/metrics-tracker/metric-performance-chart";
import { MetricMonthlyTargetsTable } from "@/components/chapter/metrics-tracker/metric-monthly-targets-table";
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
  // Soft pastels idle + selected — selected keeps dark text, stronger border, left accent.
  {
    chip: "border-sky-200/80 bg-gradient-to-br from-sky-50 to-cyan-50/50 text-sky-950",
    chipActive:
      "border-sky-400 bg-gradient-to-br from-sky-100 to-cyan-50 text-sky-950 shadow-sm shadow-sky-200/60 ring-1 ring-sky-300/50 border-l-[3px] border-l-sky-500",
    panel: "from-sky-50/90 via-cyan-50/40 to-white",
    dot: "bg-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.18)]",
    chartBar: "#0284c7",
    chartSoft: "#e0f2fe",
    cardBorder: "border-l-sky-500",
  },
  {
    chip: "border-violet-200/80 bg-gradient-to-br from-violet-50 to-indigo-50/50 text-violet-950",
    chipActive:
      "border-violet-400 bg-gradient-to-br from-violet-100 to-indigo-50 text-violet-950 shadow-sm shadow-violet-200/60 ring-1 ring-violet-300/50 border-l-[3px] border-l-violet-500",
    panel: "from-violet-50/90 via-indigo-50/40 to-white",
    dot: "bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.18)]",
    chartBar: "#7c3aed",
    chartSoft: "#ede9fe",
    cardBorder: "border-l-violet-500",
  },
  {
    chip: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-50/50 text-emerald-950",
    chipActive:
      "border-emerald-400 bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-950 shadow-sm shadow-emerald-200/60 ring-1 ring-emerald-300/50 border-l-[3px] border-l-emerald-500",
    panel: "from-emerald-50/90 via-teal-50/40 to-white",
    dot: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]",
    chartBar: "#059669",
    chartSoft: "#d1fae5",
    cardBorder: "border-l-emerald-500",
  },
  {
    chip: "border-rose-200/80 bg-gradient-to-br from-rose-50 to-orange-50/40 text-rose-950",
    chipActive:
      "border-rose-400 bg-gradient-to-br from-rose-100 to-orange-50 text-rose-950 shadow-sm shadow-rose-200/60 ring-1 ring-rose-300/50 border-l-[3px] border-l-rose-500",
    panel: "from-rose-50/90 via-orange-50/35 to-white",
    dot: "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.16)]",
    chartBar: "#e11d48",
    chartSoft: "#ffe4e6",
    cardBorder: "border-l-rose-500",
  },
  {
    chip: "border-amber-200/80 bg-gradient-to-br from-amber-50 to-yellow-50/50 text-amber-950",
    chipActive:
      "border-amber-400 bg-gradient-to-br from-amber-100 to-yellow-50 text-amber-950 shadow-sm shadow-amber-200/60 ring-1 ring-amber-300/50 border-l-[3px] border-l-amber-500",
    panel: "from-amber-50/90 via-yellow-50/40 to-white",
    dot: "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.18)]",
    chartBar: "#d97706",
    chartSoft: "#fef3c7",
    cardBorder: "border-l-amber-500",
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
            { k: "Performance", v: formatMetricValue(m.unit, metric.actual) },
            {
              k: "Expectation",
              v: metric.target != null && !m.noTarget ? formatMetricValue(m.unit, metric.target) : "—",
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
          <MetricMonthlyTargetsTable metric={metric} />
        </div>

        <div className="rounded-[12px] border border-line-card bg-surface px-2 py-3">
          <MetricPerformanceChart
            metric={metric}
            height={220}
            performanceColor={headerAccent.bar}
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
            ? " — pick a chapter, then review chapter and instructor metrics."
            : " — pick a group on the left."}
        </p>
        <StatusStrip metrics={allMetrics} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-2.5">
          {groups.map((g) => {
            const on = selected?.id === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupId(g.id)}
                className={cn(
                  "rounded-[14px] border px-3.5 py-3.5 text-left transition-all duration-200",
                  on
                    ? g.accent.chipActive
                    : cn(g.accent.chip, "hover:-translate-y-px hover:shadow-sm")
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-bold tracking-tight">{g.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                      on ? "bg-black/5 text-ink" : "bg-white/80 text-ink/80"
                    )}
                  >
                    {g.metrics.length}
                  </span>
                </div>
                <p
                  className={cn(
                    "m-0 mt-1.5 line-clamp-2 text-[12px] leading-snug",
                    on ? "text-ink-muted" : "text-ink-muted"
                  )}
                >
                  {g.blurb}
                </p>
                <div className="mt-2.5">
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
                  {selected.categories.map((cat, index) => {
                    const showInstructorSection =
                      cat.def.scope === "instructor" &&
                      selected.categories?.[index - 1]?.def.scope === "chapter_president";
                    return (
                    <div key={cat.def.id}>
                      {showInstructorSection ? (
                        <div className="mb-4 border-t border-line-card pt-5">
                          <h3 className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                            Instructor metrics
                          </h3>
                          <p className="m-0 mt-1 text-[13px] text-ink-muted">
                            Per-instructor quality, teaching impact, and growth within this chapter.
                          </p>
                        </div>
                      ) : null}
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
                                scope: cat.def.scope,
                                categoryId: cat.def.id,
                                metric,
                                groupAccent: selected.accent,
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                    );
                  })}
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
