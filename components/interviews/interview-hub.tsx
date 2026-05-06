import Link from "next/link";
import InterviewFilters from "@/components/interviews/interview-filters";
import InterviewNextAction from "@/components/interviews/interview-next-action";
import InterviewTaskCard from "@/components/interviews/interview-task-card";
import { EmptyState, SectionHeader, StatusBadge } from "@/components/interviews/ui";
import type {
  InterviewCommandCenterData,
  InterviewHubFilters,
  InterviewHubKpis,
  InterviewTask,
} from "@/lib/interviews/types";

type InterviewHubProps = {
  data: InterviewCommandCenterData;
};

type SectionKey = "needsAction" | "scheduled" | "completed";

const SECTION_META: Record<SectionKey, { kicker: string; title: string; helper: string; emptyTitle: string; emptyHelper: string }> = {
  needsAction: {
    kicker: "Action required",
    title: "Needs My Action",
    helper: "Tasks that move forward when you do.",
    emptyTitle: "No actions waiting",
    emptyHelper: "Nothing requires your input right now in this filter.",
  },
  scheduled: {
    kicker: "On the calendar",
    title: "Upcoming / Scheduled",
    helper: "Confirmed interviews coming up.",
    emptyTitle: "No upcoming interviews",
    emptyHelper: "Once an interview is scheduled, it'll show up here.",
  },
  completed: {
    kicker: "Done",
    title: "Completed / Outcome Posted",
    helper: "Interviews you've already wrapped up.",
    emptyTitle: "No completed interviews yet",
    emptyHelper: "Completed interviews will be archived here for reference.",
  },
};

function Section({
  sectionKey,
  tasks,
}: {
  sectionKey: SectionKey;
  tasks: InterviewTask[];
}) {
  const meta = SECTION_META[sectionKey];
  return (
    <section className="iv-section" aria-label={meta.title}>
      <SectionHeader
        kicker={meta.kicker}
        title={meta.title}
        helper={meta.helper}
        right={
          tasks.length > 0 ? (
            <StatusBadge tone={sectionKey === "needsAction" ? "needs-action" : sectionKey === "scheduled" ? "scheduled" : "completed"}>
              {tasks.length}
            </StatusBadge>
          ) : null
        }
      />
      {tasks.length === 0 ? (
        <EmptyState title={meta.emptyTitle} helper={meta.emptyHelper} />
      ) : (
        <div className="iv-hub-section-list">
          {tasks.map((task) => (
            <InterviewTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </section>
  );
}

function KpiTile({
  label,
  value,
  helper,
  tone,
  href,
  active,
}: {
  label: string;
  value: number;
  helper?: string;
  tone: "needs-action" | "scheduled" | "warning" | "success";
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`iv-kpi-tile iv-kpi-tile-accent-${tone}${active ? " is-active" : ""}`}
    >
      <span className="iv-kpi-tile-label">{label}</span>
      <span className="iv-kpi-tile-value">{value}</span>
      {helper ? <span className="iv-kpi-tile-helper">{helper}</span> : null}
    </Link>
  );
}

function buildKpiHref(filters: InterviewHubFilters, partial: Partial<InterviewHubFilters>) {
  const next = { ...filters, ...partial };
  const query = new URLSearchParams({
    scope: next.scope,
    view: next.view,
    state: next.state,
  });
  return `/interviews?${query.toString()}`;
}

function KpiStrip({ kpis, filters }: { kpis: InterviewHubKpis; filters: InterviewHubFilters }) {
  return (
    <div className="iv-kpi-strip" aria-label="Interview KPIs">
      <KpiTile
        label="Needs my action"
        value={kpis.needsAction}
        helper="Move forward when you do"
        tone="needs-action"
        href={buildKpiHref(filters, { state: "needs_action" })}
        active={filters.state === "needs_action"}
      />
      <KpiTile
        label="Scheduled"
        value={kpis.scheduledTotal}
        helper={kpis.scheduledToday > 0 ? `${kpis.scheduledToday} today` : "On the calendar"}
        tone="scheduled"
        href={buildKpiHref(filters, { state: "scheduled" })}
        active={filters.state === "scheduled"}
      />
      <KpiTile
        label="Today"
        value={kpis.scheduledToday}
        helper="Interviews on today's docket"
        tone="warning"
        href={buildKpiHref(filters, { state: "scheduled" })}
      />
      <KpiTile
        label="Completed this week"
        value={kpis.completedThisWeek}
        helper="Wrapped up in last 7 days"
        tone="success"
        href={buildKpiHref(filters, { state: "completed" })}
        active={filters.state === "completed"}
      />
    </div>
  );
}

export default function InterviewHub({ data }: InterviewHubProps) {
  const nextAction = data.sections.needsAction[0] ?? data.sections.blocked[0] ?? null;

  return (
    <div className="iv-section" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <KpiStrip kpis={data.kpis} filters={data.filters} />
      <InterviewNextAction task={nextAction} totalNeedsAction={data.kpis.needsAction} />
      <InterviewFilters
        filters={data.filters}
        canTeamView={data.viewer.canTeamView}
        kpis={data.kpis}
      />
      <Section sectionKey="needsAction" tasks={data.sections.needsAction.concat(data.sections.blocked)} />
      <Section sectionKey="scheduled" tasks={data.sections.scheduled} />
      <Section sectionKey="completed" tasks={data.sections.completed} />
    </div>
  );
}
