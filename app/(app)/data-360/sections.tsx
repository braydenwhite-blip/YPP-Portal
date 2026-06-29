import Link from "next/link";

import { METRIC_REGISTRY } from "@/lib/data-360/registry";
import {
  KPI_GROUP_LABELS,
  type AttentionGroup,
  type CategoryDatum,
  type Data360Overview,
  type Kpi,
  type KpiGroupKey,
  type TimeSeries,
} from "@/lib/data-360/types";
import { LENS_GROUP_ORDER, type Data360Lens } from "@/lib/data-360/views";

import { AreaChart, BarRows, KpiCard, Panel } from "./primitives";

/**
 * Data 360 — section renderers. Overview is the deep surface; the other tabs
 * are populated with real data slices already loaded (never empty shells), each
 * pointing at the live portal pages that own the records.
 */

export type SectionData = {
  overview: Data360Overview;
  attention: AttentionGroup[];
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
  const { overview, attention, lens } = data;
  const groupOrder = LENS_GROUP_ORDER[lens];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        {groupOrder.map((group) => (
          <KpiGroupBlock key={group} kpis={overview.kpis} group={group} />
        ))}
      </div>

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
  const { overview } = data;
  return (
    <div className="flex flex-col gap-5">
      <KpiGroupBlock kpis={overview.kpis} group="chapters" />
      <div className="grid gap-3 lg:grid-cols-2">
        <TrendCard series={seriesByKey(overview, "chapters_over_time")} color="#5ec5ff" />
        <Panel title="Chapters by lifecycle">
          <BarRows data={breakdownData(overview, "chapters_by_status")} color="#34d399" max={10} />
        </Panel>
      </div>
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
