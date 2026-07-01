import Link from "next/link";

import { METRIC_REGISTRY } from "@/lib/data-360/registry";
import {
  KPI_GROUP_LABELS,
  type AttentionGroup,
  type CategoryDatum,
  type Data360Overview,
  type Kpi,
  type KpiGroupKey,
  type MetricTone,
  type TimeSeries,
} from "@/lib/data-360/types";
import { LENS_GROUP_ORDER, type Data360Lens } from "@/lib/data-360/views";
import {
  WORKFLOW_HEALTH_LABELS,
  workflowData360DrilldownHref,
  type WorkflowAnalyticsInstance,
  type WorkflowGroupRow,
  type WorkflowTemplateRow,
} from "@/lib/data-360/workflow-analytics-core";
import {
  CHAPTER_EXPECTATION_LIST,
  expectationStatusLabel,
  type ChapterMetricKey,
} from "@/lib/data-360/expectations";
import type { ChapterComparisonRow } from "@/lib/data-360/chapter-metrics";
import type { WorkflowSuggestion } from "@/lib/data-360/suggestions";
import type { WorkflowIntelligence } from "@/lib/data-360/workflow-intelligence";
import type { MentorshipSnapshot } from "@/lib/data-360/mentorship-analytics";
import {
  mentorshipActionLine,
  type MentorshipMetric,
  type MentorshipMetricKey,
  type MentorshipSuggestion,
} from "@/lib/data-360/mentorship-analytics-core";

import { HealthDistributionBar } from "@/components/data-360/charts/health-distribution-bar";
import { Sparkline } from "@/components/data-360/charts/sparkline";
import { TrendChart, type TrendSeries } from "@/components/data-360/charts/trend-chart";

import { AreaChart, BarRows, KpiCard, Panel, toneColor } from "./primitives";

/**
 * Data 360 — section renderers. Overview is the deep surface; the other tabs
 * are populated with real data slices already loaded (never empty shells), each
 * pointing at the live portal pages that own the records.
 */

export type SectionData = {
  overview: Data360Overview;
  attention: AttentionGroup[];
  workflow: WorkflowIntelligence;
  mentorship: MentorshipSnapshot;
  lens: Data360Lens;
};

const nf = new Intl.NumberFormat("en-US");

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function kpisByGroup(kpis: Kpi[], group: KpiGroupKey): Kpi[] {
  return kpis.filter((k) => k.group === group);
}

function kpiValue(kpis: Kpi[], key: string): number {
  return kpis.find((k) => k.key === key)?.value ?? 0;
}

function seriesByKey(o: Data360Overview, key: string): TimeSeries | undefined {
  return o.series.find((s) => s.key === key);
}

function breakdownData(o: Data360Overview, key: string): CategoryDatum[] {
  return o.breakdowns.find((b) => b.key === key)?.data ?? [];
}

// --- shared blocks -----------------------------------------------------------

function KpiGroupBlock({ kpis, group }: { kpis: Kpi[]; group: KpiGroupKey }) {
  const items = kpisByGroup(kpis, group);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6f7c92]">
        {KPI_GROUP_LABELS[group]}
      </h4>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((k) => (
          <KpiCard key={k.key} kpi={k} />
        ))}
      </div>
    </div>
  );
}

function TrendCard({ series, color }: { series?: TimeSeries; color: string }) {
  if (!series) return null;
  const first = series.points[0]?.label ?? "";
  const last = series.points[series.points.length - 1]?.label ?? "";
  return (
    <Panel
      title={series.label}
      action={
        series.href ? (
          <Link
            href={series.href}
            prefetch={false}
            className="text-[11px] text-[#7c89a0] transition-colors hover:text-[#b47fff]"
          >
            Open →
          </Link>
        ) : null
      }
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[24px] font-bold tabular-nums text-[#e9eef5]">
            {nf.format(series.total)}
          </div>
          <div className="text-[11px] text-[#5f6b80]">
            {series.added > 0
              ? `+${nf.format(series.added)} in the last 12 months`
              : "No change in the last 12 months"}
          </div>
        </div>
      </div>
      <div className="mt-2">
        <AreaChart points={series.points} color={color} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[#5f6b80]">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </Panel>
  );
}

function EmptyMini({ label }: { label: string }) {
  return <p className="py-4 text-center text-[12px] text-[#5f6b80]">{label}</p>;
}

function AttentionPanel({ groups }: { groups: AttentionGroup[] }) {
  const total = groups.reduce((s, g) => s + g.facts.length, 0);
  return (
    <Panel
      title="Needs attention"
      subtitle={total > 0 ? `${total} factual flags — concrete facts, no scores` : undefined}
    >
      {total === 0 ? (
        <EmptyMini label="Nothing needs attention right now." />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-1 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#c4ccda]">
                  {g.label}
                </span>
                <span className="text-[10.5px] text-[#5f6b80]">{g.hint}</span>
              </div>
              <ul className="flex flex-col">
                {g.facts.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={f.href}
                      prefetch={false}
                      className="flex items-start justify-between gap-3 rounded-md px-1.5 py-1 transition-colors hover:bg-white/[0.04]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] text-[#dbe2ec]">
                          {f.title}
                        </span>
                        <span className="block truncate text-[11px] text-[#7c89a0]">
                          {f.detail}
                        </span>
                      </span>
                      <span className="mt-0.5 shrink-0 text-[#5f6b80]">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RecentPanel({ items }: { items: Data360Overview["recent"] }) {
  return (
    <Panel title="Recent activity">
      {items.length === 0 ? (
        <EmptyMini label="No recent records." />
      ) : (
        <ul className="flex flex-col">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={it.href}
                prefetch={false}
                className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/[0.04]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] text-[#dbe2ec]">{it.title}</span>
                  <span className="block truncate text-[11px] text-[#7c89a0]">
                    {it.kind} · {it.detail}
                  </span>
                </span>
                <span className="shrink-0 text-[10.5px] text-[#5f6b80]">{shortDate(it.atISO)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// --- Overview (deep) ---------------------------------------------------------

export function OverviewSection({ data }: { data: SectionData }) {
  const { overview, attention, workflow, lens } = data;
  const groupOrder = LENS_GROUP_ORDER[lens];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        {groupOrder.map((group) => (
          <KpiGroupBlock key={group} kpis={overview.kpis} group={group} />
        ))}
      </div>

      <WorkflowHealthStrip wf={workflow} />

      <div className="grid gap-3 lg:grid-cols-2">
        <TrendCard series={seriesByKey(overview, "students_over_time")} color="#b47fff" />
        <TrendCard series={seriesByKey(overview, "chapters_over_time")} color="#5ec5ff" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Classes by category">
          <BarRows data={breakdownData(overview, "classes_by_category")} color="#b47fff" />
        </Panel>
        <Panel title="People by role">
          <BarRows data={breakdownData(overview, "people_by_role")} color="#5ec5ff" />
        </Panel>
        <Panel title="Chapters by lifecycle">
          <BarRows data={breakdownData(overview, "chapters_by_status")} color="#34d399" />
        </Panel>
        <Panel title="Partners by stage">
          <BarRows data={breakdownData(overview, "partners_by_stage")} color="#fbbf24" />
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AttentionPanel groups={attention} />
        </div>
        <RecentPanel items={overview.recent} />
      </div>
    </div>
  );
}

// --- People ------------------------------------------------------------------

export function PeopleSection({ data }: { data: SectionData }) {
  const { overview } = data;
  return (
    <div className="flex flex-col gap-5">
      <KpiGroupBlock kpis={overview.kpis} group="people" />
      <div className="grid gap-3 lg:grid-cols-2">
        <TrendCard series={seriesByKey(overview, "students_over_time")} color="#b47fff" />
        <Panel title="People by role">
          <BarRows data={breakdownData(overview, "people_by_role")} color="#5ec5ff" max={10} />
        </Panel>
      </div>
    </div>
  );
}

// --- Programs ----------------------------------------------------------------

export function ProgramsSection({ data }: { data: SectionData }) {
  const { overview } = data;
  return (
    <div className="flex flex-col gap-5">
      <KpiGroupBlock kpis={overview.kpis} group="programs" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Classes by category" subtitle="Active and completed offerings by passion area">
          <BarRows data={breakdownData(overview, "classes_by_category")} color="#b47fff" max={10} />
        </Panel>
        <Panel title="Where this drills down">
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-[#c4ccda]">
            <li>
              <Link className="hover:text-[#b47fff]" href="/admin/classes" prefetch={false}>
                Class operations →
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#b47fff]" href="/programs" prefetch={false}>
                Programs catalog →
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#b47fff]" href="/courses" prefetch={false}>
                Course library →
              </Link>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

// --- Chapters ----------------------------------------------------------------

export function ChaptersSection({ data }: { data: SectionData }) {
  const { overview, workflow } = data;
  return (
    <div className="flex flex-col gap-5">
      <KpiGroupBlock kpis={overview.kpis} group="chapters" />

      <ChapterComparisonGrid rows={workflow.chapterComparison.rows} />

      <div className="grid gap-3 lg:grid-cols-2">
        <TrendCard series={seriesByKey(overview, "chapters_over_time")} color="#5ec5ff" />
        <Panel title="Chapters by lifecycle">
          <BarRows data={breakdownData(overview, "chapters_by_status")} color="#34d399" max={10} />
        </Panel>
      </div>

      <WorkflowSuggestionsPanel suggestions={workflow.suggestions} />

      <Panel title="Chapters by state" subtitle="Geographic distribution (interactive map arrives in Phase 3)">
        <BarRows data={breakdownData(overview, "chapters_by_state")} color="#b47fff" max={16} />
      </Panel>
    </div>
  );
}

// --- Fundraising (unavailable, honest) ---------------------------------------

export function FundraisingSection() {
  const def = METRIC_REGISTRY.find((m) => m.key === "fundraising_total");
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Fundraising">
        <div className="flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-md border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-2.5 py-1 text-[12px] font-semibold text-[#fbbf24]">
            Data unavailable
          </div>
          <p className="max-w-2xl text-[13px] leading-relaxed text-[#c4ccda]">
            {def?.unavailableReason ??
              "No fundraising data source exists in the portal yet."}
          </p>
          <p className="max-w-2xl text-[12.5px] leading-relaxed text-[#7c89a0]">
            When a fundraising / donation / campaign model (or a MetricSnapshot
            feed) is added, this view will show total raised, raised this period,
            raised over time, and a breakdown by campaign — all sourced from real
            records, with no synthetic targets or scores.
          </p>
        </div>
      </Panel>
    </div>
  );
}

// --- Performance / output ----------------------------------------------------

export function PerformanceSection({ data }: { data: SectionData }) {
  const { overview } = data;
  const kpis = overview.kpis;
  const throughput: CategoryDatum[] = [
    { key: "open", label: "Open actions", value: kpiValue(kpis, "open_actions"), href: "/actions/all" },
    {
      key: "overdue",
      label: "Overdue",
      value: kpiValue(kpis, "overdue_actions"),
      href: "/actions/all?status=OVERDUE",
    },
    {
      key: "completed",
      label: "Completed",
      value: kpiValue(kpis, "completed_actions"),
      href: "/actions/all",
    },
    {
      key: "meetings",
      label: "Meetings done",
      value: kpiValue(kpis, "meetings_completed"),
      href: "/meetings",
    },
  ];
  return (
    <div className="flex flex-col gap-5">
      <KpiGroupBlock kpis={kpis} group="work" />
      <KpiGroupBlock kpis={kpis} group="pipeline" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Work throughput" subtitle={`Counts for ${overview.range.label.toLowerCase()}`}>
          <BarRows data={throughput} color="#b47fff" max={6} />
        </Panel>
        <Panel title="Where this drills down">
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-[#c4ccda]">
            <li>
              <Link className="hover:text-[#b47fff]" href="/actions/all" prefetch={false}>
                Action tracker →
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#b47fff]" href="/meetings" prefetch={false}>
                Meetings hub →
              </Link>
            </li>
            <li>
              <Link className="hover:text-[#b47fff]" href="/admin/instructor-applicants" prefetch={false}>
                Hiring pipeline →
              </Link>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

// --- Geography ---------------------------------------------------------------

export function GeographySection({ data }: { data: SectionData }) {
  const { overview } = data;
  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Chapters by state"
        subtitle="The factual geographic distribution today. An interactive map (chapters, partners, student density) is Phase 3."
      >
        <BarRows data={breakdownData(overview, "chapters_by_state")} color="#5ec5ff" max={24} />
      </Panel>
    </div>
  );
}

// --- Workflow building blocks ------------------------------------------------

function toTrendSeries(ts: TimeSeries, color?: string): TrendSeries {
  return { key: ts.key, label: ts.label, color, points: ts.points };
}

function WfStat({
  label,
  value,
  href,
  tone = "default",
  hint,
}: {
  label: string;
  value: number;
  href?: string | null;
  tone?: MetricTone;
  hint?: string;
}) {
  const color = toneColor(tone);
  const inner = (
    <div className="group relative flex h-full flex-col gap-1 overflow-hidden rounded-xl border border-white/10 bg-[#111726] px-3.5 py-3 transition-colors hover:border-white/25">
      <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: color }} aria-hidden />
      <span className="text-[24px] font-bold leading-none tabular-nums text-[#e9eef5]">
        {nf.format(value)}
      </span>
      <span className="text-[12px] font-medium text-[#aeb6c6]">{label}</span>
      {hint ? <span className="text-[10.5px] leading-tight text-[#5f6b80]">{hint}</span> : null}
    </div>
  );
  return href ? (
    <Link href={href} prefetch={false} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function WorkflowHealthStrip({ wf }: { wf: WorkflowIntelligence }) {
  const { overview } = wf;
  return (
    <Panel
      title="Workflow health"
      subtitle="Concrete, reason-based status from the workflow engine — every number opens the filtered list"
      action={
        <Link
          href="/workflows"
          prefetch={false}
          className="text-[11px] text-[#7c89a0] transition-colors hover:text-[#b47fff]"
        >
          Open workflows →
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-[13px] text-[#aeb6c6]">
            <b className="text-[#e9eef5] tabular-nums">{overview.active}</b> active
          </span>
          <span className="text-[13px] text-[#aeb6c6]">
            <b className="text-[#e9eef5] tabular-nums">{overview.health.needsAttention}</b> need
            attention
          </span>
          <span className="text-[12px] text-[#5f6b80]">
            avg age {overview.averageAgeDays}d · {overview.chaptersWithWorkflows} chapters
          </span>
        </div>
        <HealthDistributionBar counts={overview.health.counts} theme="dark" />
      </div>
    </Panel>
  );
}

function WorkflowKpiRow({ wf }: { wf: WorkflowIntelligence }) {
  const { overview } = wf;
  const c = overview.health.counts;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <WfStat label="Active workflows" value={overview.active} href="/workflows" tone="accent" />
      <WfStat
        label="Blocked"
        value={c.BLOCKED}
        href={workflowData360DrilldownHref({ health: "BLOCKED" })}
        tone={c.BLOCKED > 0 ? "danger" : "muted"}
        hint="target 0"
      />
      <WfStat
        label="Overdue"
        value={c.OVERDUE}
        href={workflowData360DrilldownHref({ health: "OVERDUE" })}
        tone={c.OVERDUE > 0 ? "danger" : "muted"}
        hint="target 0"
      />
      <WfStat
        label="Stalled"
        value={c.STALLED}
        href={workflowData360DrilldownHref({ health: "STALLED" })}
        tone={c.STALLED > 0 ? "warning" : "muted"}
      />
      <WfStat
        label="Actions created"
        value={overview.linkedWork.actionsCreated}
        tone="default"
        hint={`${overview.linkedWork.workflowsWithActions} workflows`}
      />
      <WfStat
        label="Meetings created"
        value={overview.linkedWork.meetingsCreated}
        tone="default"
        hint={`${overview.linkedWork.workflowsWithMeetings} workflows`}
      />
    </div>
  );
}

function WorkflowTrendsPanel({ wf }: { wf: WorkflowIntelligence }) {
  const byKey = new Map(wf.trends.map((t) => [t.key, t]));
  const started = byKey.get("wf_started");
  const completed = byKey.get("wf_completed");
  const steps = byKey.get("wf_steps_completed");
  const actions = byKey.get("wf_actions_created");
  const meetings = byKey.get("wf_meetings_created");

  const flow: TrendSeries[] = [];
  if (started) flow.push(toTrendSeries(started, "#8b3fe8"));
  if (completed) flow.push(toTrendSeries(completed, "#34d399"));
  if (steps) flow.push(toTrendSeries(steps, "#5ec5ff"));

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Panel title="Workflow operating trends" subtitle="Week by week — started vs completed vs steps closed">
          <TrendChart series={flow} theme="dark" height={220} showLegend />
        </Panel>
      </div>
      <div className="flex flex-col gap-3">
        <MiniTrendStat ts={actions} color="#fbbf24" href="/actions?source=workflow" />
        <MiniTrendStat ts={meetings} color="#f472b6" href="/meetings" />
      </div>
    </div>
  );
}

function MiniTrendStat({
  ts,
  color,
  href,
}: {
  ts?: TimeSeries;
  color: string;
  href: string;
}) {
  if (!ts) return null;
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#111726] px-3.5 py-3 transition-colors hover:border-white/25"
    >
      <div>
        <div className="text-[22px] font-bold leading-none tabular-nums text-[#e9eef5]">
          {nf.format(ts.total)}
        </div>
        <div className="mt-1 text-[11.5px] text-[#aeb6c6]">{ts.label}</div>
      </div>
      <Sparkline points={ts.points.map((p) => ({ t: p.t, value: p.value }))} color={color} width={90} height={34} />
    </Link>
  );
}

function WorkflowGroupTable({
  title,
  subtitle,
  rows,
  keyLabel,
}: {
  title: string;
  subtitle?: string;
  rows: WorkflowGroupRow[];
  keyLabel: string;
}) {
  return (
    <Panel title={title} subtitle={subtitle} bodyClassName="p-0">
      {rows.length === 0 ? (
        <EmptyMini label="No workflows yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.06em] text-[#6f7c92]">
                <th className="px-3 py-2 font-semibold">{keyLabel}</th>
                <th className="px-2 py-2 text-right font-semibold">Total</th>
                <th className="px-2 py-2 text-right font-semibold">Blocked</th>
                <th className="px-2 py-2 text-right font-semibold">Overdue</th>
                <th className="px-2 py-2 text-right font-semibold">Attn</th>
                <th className="px-2 py-2 text-right font-semibold">On track</th>
                <th className="px-2 py-2 text-right font-semibold">Avg age</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 14).map((r) => {
                const nameCell = (
                  <span className="font-medium text-[#e6edf3]">{r.label}</span>
                );
                return (
                  <tr key={r.key} className="border-b border-white/[0.05] text-[#c4ccda]">
                    <td className="px-3 py-2">
                      {r.href ? (
                        <Link href={r.href} prefetch={false} className="hover:text-[#b47fff]">
                          {nameCell}
                        </Link>
                      ) : (
                        nameCell
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-[#e6edf3]">{r.total}</td>
                    <td className={`px-2 py-2 text-right tabular-nums ${r.blocked > 0 ? "text-[#f87171]" : "text-[#5f6b80]"}`}>
                      {r.blocked}
                    </td>
                    <td className={`px-2 py-2 text-right tabular-nums ${r.overdue > 0 ? "text-[#fb923c]" : "text-[#5f6b80]"}`}>
                      {r.overdue}
                    </td>
                    <td className={`px-2 py-2 text-right tabular-nums ${r.needsAttention > 0 ? "text-[#fbbf24]" : "text-[#5f6b80]"}`}>
                      {r.needsAttention}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-[#34d399]">{r.onTrack}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-[#8b94a7]">{r.averageAgeDays}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function WorkflowTemplatePanel({ rows }: { rows: WorkflowTemplateRow[] }) {
  return (
    <Panel
      title="Workflow templates"
      subtitle="Which playbooks are actually being used — usage, health, and downstream work"
      bodyClassName="p-0"
    >
      {rows.length === 0 ? (
        <EmptyMini label="No workflow templates in use yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.06em] text-[#6f7c92]">
                <th className="px-3 py-2 font-semibold">Template</th>
                <th className="px-2 py-2 text-right font-semibold">Active</th>
                <th className="px-2 py-2 text-right font-semibold">Done</th>
                <th className="px-2 py-2 text-right font-semibold">Blocked</th>
                <th className="px-2 py-2 text-right font-semibold">Overdue</th>
                <th className="px-2 py-2 text-right font-semibold">Chapters</th>
                <th className="px-2 py-2 text-right font-semibold">Actions</th>
                <th className="px-2 py-2 text-right font-semibold">Avg age</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 16).map((r) => (
                <tr key={r.key} className="border-b border-white/[0.05] text-[#c4ccda]">
                  <td className="px-3 py-2">
                    <Link href={r.href ?? "/workflows"} prefetch={false} className="font-medium text-[#e6edf3] hover:text-[#b47fff]">
                      {r.label}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#e6edf3]">{r.active}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#34d399]">{r.completed}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${r.blocked > 0 ? "text-[#f87171]" : "text-[#5f6b80]"}`}>
                    {r.blocked}
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums ${r.overdue > 0 ? "text-[#fb923c]" : "text-[#5f6b80]"}`}>
                    {r.overdue}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#8b94a7]">{r.chaptersUsing}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#8b94a7]">{r.actionsCreated}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[#8b94a7]">{r.averageAgeDays}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

const HEALTH_PILL_COLOR: Record<string, string> = {
  BLOCKED: "#f87171",
  OVERDUE: "#fb923c",
  STALLED: "#a78bfa",
  NEEDS_ATTENTION: "#fbbf24",
};

function WorkflowNeedsAttentionQueue({
  items,
  total,
}: {
  items: WorkflowAnalyticsInstance[];
  total: number;
}) {
  return (
    <Panel
      title="Workflows needing attention"
      subtitle={
        total > 0
          ? `${total} workflow${total === 1 ? "" : "s"} off track — worst first. Open each to reassign, escalate, or unblock.`
          : undefined
      }
      bodyClassName={items.length === 0 ? "p-4" : "p-0"}
    >
      {items.length === 0 ? (
        <EmptyMini label="Every active workflow is on track." />
      ) : (
        <ul className="flex flex-col">
          {items.map((i) => {
            const color = HEALTH_PILL_COLOR[i.health] ?? "#8b94a7";
            return (
              <li key={i.id} className="border-b border-white/[0.05] last:border-0">
                <Link
                  href={`/workflows/${i.id}`}
                  prefetch={false}
                  className="flex items-start justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{ background: `${color}1f`, color }}
                      >
                        {WORKFLOW_HEALTH_LABELS[i.health]}
                      </span>
                      <span className="truncate text-[13px] font-medium text-[#e6edf3]">{i.title}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-[#7c89a0]">
                      {i.chapterName ?? "No chapter"}
                      {i.templateName ? ` · ${i.templateName}` : ""}
                      {i.ownerName ? ` · ${i.ownerName}` : " · unassigned"}
                    </div>
                    {i.healthReasons[0] ? (
                      <div className="mt-0.5 truncate text-[11.5px]" style={{ color }}>
                        {i.healthReasons[0]}
                      </div>
                    ) : null}
                    {i.nextStepTitle ? (
                      <div className="mt-0.5 truncate text-[11px] text-[#8b94a7]">
                        Next: {i.nextStepTitle}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] text-[#8b94a7]">{i.completionPercent}%</div>
                    <div className="mt-0.5 text-[10.5px] text-[#5f6b80]">{i.ageDays}d old</div>
                    {i.linkedActionCount + i.linkedMeetingCount > 0 ? (
                      <div className="mt-0.5 text-[10px] text-[#5f6b80]">
                        {i.linkedActionCount > 0 ? `${i.linkedActionCount}A ` : ""}
                        {i.linkedMeetingCount > 0 ? `${i.linkedMeetingCount}M` : ""}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function WorkflowSuggestionsPanel({ suggestions }: { suggestions: WorkflowSuggestion[] }) {
  return (
    <Panel
      title="Data-triggered suggestions"
      subtitle="Deterministic: a real metric gap → the blueprint that closes it. No scores, no guesses."
      bodyClassName={suggestions.length === 0 ? "p-4" : "p-0"}
    >
      {suggestions.length === 0 ? (
        <EmptyMini label="No metric gaps trip a workflow suggestion right now." />
      ) : (
        <ul className="flex flex-col">
          {suggestions.slice(0, 12).map((s) => (
            <li key={s.id} className="border-b border-white/[0.05] px-3 py-2.5 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-[#e6edf3]">{s.chapterName}</span>
                <span className="inline-flex items-center rounded bg-[#8b3fe8]/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#b47fff]">
                  {s.templateLabel}
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-[#aeb6c6]">{s.reason}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-[11px]">
                <Link href={s.primaryActionHref} prefetch={false} className="text-[#b47fff] hover:underline">
                  {s.primaryActionLabel} →
                </Link>
                {s.sourceHref ? (
                  <Link href={s.sourceHref} prefetch={false} className="text-[#7c89a0] hover:text-[#b47fff]">
                    View records
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// --- Workflows section -------------------------------------------------------

export function WorkflowsSection({ data }: { data: SectionData }) {
  const wf = data.workflow;
  return (
    <div className="flex flex-col gap-5">
      <WorkflowKpiRow wf={wf} />
      <WorkflowHealthStrip wf={wf} />
      <WorkflowTrendsPanel wf={wf} />
      <div className="grid gap-3 lg:grid-cols-2">
        <WorkflowGroupTable
          title="Workflows by chapter"
          subtitle="Where operating work is concentrated"
          rows={wf.byChapter}
          keyLabel="Chapter"
        />
        <WorkflowGroupTable
          title="Workflows by entity type"
          subtitle="Which parts of the org generate the most process"
          rows={wf.byEntityType}
          keyLabel="Entity type"
        />
      </div>
      <WorkflowTemplatePanel rows={wf.byTemplate} />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WorkflowNeedsAttentionQueue items={wf.needsAttention} total={wf.needsAttentionTotal} />
        </div>
        <WorkflowSuggestionsPanel suggestions={wf.suggestions} />
      </div>
    </div>
  );
}

// --- Mentorship section ------------------------------------------------------

/** Target-zero advising gaps, in priority order (drilldowns + red when > 0). */
const MENTORSHIP_GAP_KEYS: MentorshipMetricKey[] = [
  "unassignedStudents",
  "overdueCheckIns",
  "kickoffsNeeded",
  "staleRecommendations",
  "overloadedAdvisors",
];

/** Informational throughput metrics — how much advising work is moving. */
const MENTORSHIP_VOLUME_KEYS: MentorshipMetricKey[] = [
  "studentsSupported",
  "activeAdvisors",
  "openRecommendations",
  "checkInsThisWeek",
  "recommendationsCompletedThisWeek",
];

function MentorshipMetricStat({ m }: { m: MentorshipMetric }) {
  const gapMetric = m.direction === "target-zero";
  // Only show the "target 0" benchmark when the metric is actually being graded.
  // An ungraded target-zero metric (status "none", e.g. unassigned students
  // before advising has started) is muted — printing "target 0" there would
  // read as a breached target when it is intentionally not evaluated.
  const hint = gapMetric
    ? m.status === "none"
      ? undefined
      : m.value === 0
      ? "target 0 · on target"
      : "target 0"
    : m.expectationLabel !== "—"
    ? m.expectationLabel
    : undefined;
  return <WfStat label={m.label} value={m.value} href={m.href} tone={m.tone} hint={hint} />;
}

function MentorshipSuggestionsPanel({ suggestions }: { suggestions: MentorshipSuggestion[] }) {
  const open = suggestions.filter((s) => !s.covered);
  const covered = suggestions.filter((s) => s.covered);
  return (
    <Panel
      title="Advising suggestions"
      subtitle="Deterministic: a real advising gap → the workflow that closes it. Already-running work is marked, not repeated."
      bodyClassName={suggestions.length === 0 ? "p-4" : "p-0"}
    >
      {suggestions.length === 0 ? (
        <EmptyMini label="No advising gap trips a workflow suggestion right now." />
      ) : (
        <ul className="flex flex-col">
          {[...open, ...covered].slice(0, 12).map((s) => (
            <li key={s.id} className="border-b border-white/[0.05] px-3 py-2.5 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-[#e6edf3]">{s.metricLabel}</span>
                {s.covered ? (
                  <span className="inline-flex items-center rounded bg-[#34d399]/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#34d399]">
                    Workflow running
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded bg-[#8b3fe8]/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#b47fff]">
                    {s.templateLabel}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11.5px] text-[#aeb6c6]">{s.reason}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-[11px]">
                <Link href={s.primaryActionHref} prefetch={false} className="text-[#b47fff] hover:underline">
                  {s.primaryActionLabel} →
                </Link>
                {s.sourceHref ? (
                  <Link href={s.sourceHref} prefetch={false} className="text-[#7c89a0] hover:text-[#b47fff]">
                    View records
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** The breached gap metrics, worst first — the "act now" queue for the tab. */
function ActionNowStrip({ metrics }: { metrics: MentorshipMetric[] }) {
  const gaps = metrics.filter((m) => m.isGap).sort((a, b) => b.value - a.value);
  if (gaps.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#34d399]/25 bg-[#34d399]/[0.06] px-3.5 py-3">
        <span className="text-[15px]">✓</span>
        <p className="m-0 text-[12.5px] text-[#c4ccda]">
          Nothing needs action right now — every advising target is on track.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {gaps.map((m) => (
        <Link
          key={m.key}
          href={m.href ?? "/operations/advising"}
          prefetch={false}
          className="group flex items-center justify-between gap-3 rounded-xl border border-[#f87171]/25 bg-[#f87171]/[0.05] px-3.5 py-3 transition-colors hover:border-[#f87171]/50"
        >
          <div className="min-w-0">
            <div className="text-[22px] font-bold leading-none tabular-nums text-[#f87171]">
              {nf.format(m.value)}
            </div>
            <div className="mt-1 text-[12px] font-medium text-[#e6edf3]">{m.label}</div>
          </div>
          <span className="shrink-0 text-[11px] text-[#7c89a0] transition-colors group-hover:text-[#f87171]">
            Open lane →
          </span>
        </Link>
      ))}
    </div>
  );
}

export function MentorshipSection({ data }: { data: SectionData }) {
  const m = data.mentorship;
  const byKey = new Map(m.metrics.map((x) => [x.key, x] as const));
  const pick = (keys: MentorshipMetricKey[]) =>
    keys.map((k) => byKey.get(k)).filter((x): x is MentorshipMetric => Boolean(x));

  const trendSeries: TrendSeries[] = [
    { key: "checkIns", label: "Check-ins logged", color: "#34d399", points: m.trends.checkIns },
    { key: "recsOpened", label: "Recommendations opened", color: "#8b3fe8", points: m.trends.recommendationsOpened },
    { key: "recsCompleted", label: "Recommendations completed", color: "#5ec5ff", points: m.trends.recommendationsCompleted },
  ];

  // The honest empty state: no advising relationships means no coverage/cadence
  // metrics to grade. Show only the teaching panel — never a wall of zeros or a
  // full-student "unassigned" count that contradicts "advising hasn't started".
  if (!m.advisingActive) {
    return (
      <div className="flex flex-col gap-5">
        <Panel
          title="Advising health"
          subtitle="The student-advising vertical of the operating loop — advisors, check-ins, and recommendations."
          action={
            <Link
              href="/operations/advising"
              prefetch={false}
              className="text-[11px] text-[#7c89a0] transition-colors hover:text-[#b47fff]"
            >
              Open advising queue →
            </Link>
          }
        >
          <p className="text-[12.5px] leading-relaxed text-[#8b94a7]">
            No advisor relationships are on record yet
            {m.totalStudents > 0
              ? ` — ${m.totalStudents} student${m.totalStudents === 1 ? "" : "s"} could be paired with an advisor to start.`
              : "."}{" "}
            Once advising starts, coverage, check-in cadence, and recommendation follow-through appear
            here, graded against conservative targets. Metrics stay honest — nothing is invented.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel
        title="Advising health"
        subtitle="The student-advising vertical of the operating loop — advisors, check-ins, and recommendations. Every number opens the advising queue."
        action={
          <Link
            href="/operations/advising"
            prefetch={false}
            className="text-[11px] text-[#7c89a0] transition-colors hover:text-[#b47fff]"
          >
            Open advising queue →
          </Link>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-[13px] text-[#aeb6c6]">
              <b className="text-[#e9eef5] tabular-nums">{m.totalStudents}</b> students
            </span>
            <span className="text-[13px] text-[#aeb6c6]">
              <b className="text-[#e9eef5] tabular-nums">{m.totalAssignments}</b> advising relationships
            </span>
            <span className={`text-[12px] ${m.gapCount > 0 ? "text-[#fbbf24]" : "text-[#34d399]"}`}>
              {m.gapCount === 0
                ? "Every advising target is on track."
                : `${m.gapCount} advising ${m.gapCount === 1 ? "target is" : "targets are"} off.`}
            </span>
          </div>
          <p className="m-0 text-[12.5px] leading-relaxed text-[#c4ccda]">
            {mentorshipActionLine(m.metrics)}
          </p>
        </div>
      </Panel>

      <div>
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#6f7c92]">
          What needs action now
        </p>
        <ActionNowStrip metrics={m.metrics} />
      </div>

      <div>
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#6f7c92]">
          Coverage &amp; cadence · target zero
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {pick(MENTORSHIP_GAP_KEYS).map((metric) => (
            <MentorshipMetricStat key={metric.key} m={metric} />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#6f7c92]">
          Throughput · this reporting week
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {pick(MENTORSHIP_VOLUME_KEYS).map((metric) => (
            <MentorshipMetricStat key={metric.key} m={metric} />
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Advising operating trends"
            subtitle="Week by week — check-ins logged, recommendations opened, and recommendations completed"
          >
            <TrendChart series={trendSeries} theme="dark" height={220} showLegend />
          </Panel>
        </div>
        <MentorshipSuggestionsPanel suggestions={m.suggestions} />
      </div>
    </div>
  );
}

// --- Chapter comparison grid -------------------------------------------------

function metricCellTone(tone: MetricTone): string {
  switch (tone) {
    case "positive":
      return "#34d399";
    case "warning":
      return "#fbbf24";
    case "danger":
      return "#f87171";
    case "muted":
      return "#5f6b80";
    default:
      return "#c4ccda";
  }
}

function ChapterComparisonGrid({ rows }: { rows: ChapterComparisonRow[] }) {
  const cols = CHAPTER_EXPECTATION_LIST;
  return (
    <Panel
      title="Chapter comparison"
      subtitle="Expectations row on top; every cell opens the records behind it. Muted = not yet relevant for that chapter's phase."
      bodyClassName="p-0"
    >
      {rows.length === 0 ? (
        <EmptyMini label="No chapters on record." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/10 text-[9.5px] uppercase tracking-[0.05em] text-[#6f7c92]">
                <th className="sticky left-0 z-10 bg-[#0f1420] px-3 py-2 font-semibold">Chapter</th>
                {cols.map((c) => (
                  <th key={c.key} className="px-2 py-2 text-right font-semibold" title={c.description}>
                    {c.shortLabel}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-white/10 bg-white/[0.03] text-[10px]">
                <th className="sticky left-0 z-10 bg-[#0f1420] px-3 py-1.5 text-left font-semibold text-[#8b94a7]">
                  Expectation
                </th>
                {cols.map((c) => (
                  <th key={c.key} className="px-2 py-1.5 text-right font-medium text-[#8b94a7]">
                    {c.expectationLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.chapterId} className="border-b border-white/[0.05]">
                  <td className="sticky left-0 z-10 bg-[#0f1420] px-3 py-2">
                    <Link
                      href={`/chapter/organization?chapterId=${r.chapterId}`}
                      prefetch={false}
                      className="font-medium text-[#e6edf3] hover:text-[#b47fff]"
                    >
                      {r.chapterName}
                    </Link>
                    <div className="text-[10px] text-[#5f6b80]">{r.phaseLabel}</div>
                  </td>
                  {cols.map((c) => {
                    const cell = r.metrics[c.key as ChapterMetricKey];
                    const muted = cell.status === "none";
                    const color = metricCellTone(cell.tone);
                    const display =
                      cell.value === null
                        ? "—"
                        : c.unit === "percent"
                        ? `${cell.value}%`
                        : nf.format(cell.value);
                    const body = (
                      <span
                        className="tabular-nums"
                        style={{ color: muted ? "#3f4757" : color, fontWeight: muted ? 400 : 600 }}
                        title={
                          muted
                            ? "Not yet relevant for this chapter's phase"
                            : expectationStatusLabel(cell.status)
                        }
                      >
                        {display}
                      </span>
                    );
                    return (
                      <td key={c.key} className="px-2 py-2 text-right">
                        {cell.href && !muted ? (
                          <Link href={cell.href} prefetch={false} className="hover:underline">
                            {body}
                          </Link>
                        ) : (
                          body
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// --- Data Dictionary ---------------------------------------------------------

export function DictionarySection() {
  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Data dictionary"
        subtitle="Every Phase-1 metric: what it means, where it comes from, and where it drills down. The registry is the single source of truth."
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 text-[10.5px] uppercase tracking-[0.06em] text-[#6f7c92]">
                <th className="px-4 py-2 font-semibold">Metric</th>
                <th className="px-4 py-2 font-semibold">Group</th>
                <th className="px-4 py-2 font-semibold">Source</th>
                <th className="px-4 py-2 font-semibold">Cadence</th>
                <th className="px-4 py-2 font-semibold">Visibility</th>
                <th className="px-4 py-2 font-semibold">Drill-down</th>
                <th className="px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_REGISTRY.map((m) => (
                <tr
                  key={m.key}
                  className="border-b border-white/[0.05] align-top text-[12px] text-[#c4ccda]"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-[#e6edf3]">{m.name}</div>
                    <div className="text-[11px] text-[#7c89a0]">{m.description}</div>
                  </td>
                  <td className="px-4 py-2.5 text-[#aeb6c6]">{KPI_GROUP_LABELS[m.group]}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-[#8b94a7]">{m.source}</td>
                  <td className="px-4 py-2.5 capitalize text-[#aeb6c6]">{m.cadence}</td>
                  <td className="px-4 py-2.5 capitalize text-[#aeb6c6]">{m.visibility}</td>
                  <td className="px-4 py-2.5">
                    {m.drilldown ? (
                      <Link
                        href={m.drilldown}
                        prefetch={false}
                        className="text-[#7c89a0] hover:text-[#b47fff]"
                      >
                        {m.drilldown}
                      </Link>
                    ) : (
                      <span className="text-[#5f6b80]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {m.available ? (
                      <span className="inline-flex items-center rounded bg-[#34d399]/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#34d399]">
                        Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded bg-[#fbbf24]/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-[#fbbf24]">
                        Unavailable
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
