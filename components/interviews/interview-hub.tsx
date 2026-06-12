import InterviewFilters from "@/components/interviews/interview-filters";
import InterviewNextAction from "@/components/interviews/interview-next-action";
import InterviewTaskCard from "@/components/interviews/interview-task-card";
import { EmptyState, SectionHeader, StatusBadge } from "@/components/interviews/ui";
import { StatCardV2 } from "@/components/ui-v2";
import type {
  InterviewCommandCenterData,
  InterviewHubFilters,
  InterviewHubKpis,
  InterviewTask,
} from "@/lib/interviews/types";

type InterviewHubProps = {
  data: InterviewCommandCenterData;
};

type SectionKey = "needsAction" | "waiting" | "scheduled" | "completed";

const SECTION_META: Record<SectionKey, { kicker: string; title: string; helper: string; emptyTitle: string; emptyHelper: string }> = {
  needsAction: {
    kicker: "Action required",
    title: "Needs My Action",
    helper: "Tasks that move forward when you do.",
    emptyTitle: "No actions waiting",
    emptyHelper: "Nothing requires your input right now in this filter.",
  },
  waiting: {
    kicker: "Awaiting the other party",
    title: "Times Sent · Waiting to Confirm",
    helper: "Interview times have been sent — waiting on the other person to approve a time.",
    emptyTitle: "Nobody is waiting to confirm",
    emptyHelper: "Once you send interview times, candidates waiting to confirm show up here.",
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
    <section className="flex flex-col gap-3" aria-label={meta.title}>
      <SectionHeader
        kicker={meta.kicker}
        title={meta.title}
        helper={meta.helper}
        right={
          tasks.length > 0 ? (
            <StatusBadge
              tone={
                sectionKey === "needsAction"
                  ? "needs-action"
                  : sectionKey === "waiting"
                    ? "warning"
                    : sectionKey === "scheduled"
                      ? "scheduled"
                      : "completed"
              }
            >
              {tasks.length}
            </StatusBadge>
          ) : null
        }
      />
      {tasks.length === 0 ? (
        <EmptyState title={meta.emptyTitle} helper={meta.emptyHelper} />
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <InterviewTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </section>
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
    <div className="flex flex-wrap gap-3" aria-label="Interview counts">
      <StatCardV2
        label="Needs my action"
        value={kpis.needsAction}
        detail="moves forward when you act"
        tone={kpis.needsAction > 0 ? "attention" : "default"}
        href={buildKpiHref(filters, { state: "needs_action" })}
      />
      <StatCardV2
        label="Scheduled"
        value={kpis.scheduledTotal}
        detail={kpis.scheduledToday > 0 ? `${kpis.scheduledToday} today` : "on the calendar"}
        href={buildKpiHref(filters, { state: "scheduled" })}
      />
      <StatCardV2
        label="Today"
        value={kpis.scheduledToday}
        detail="on today's docket"
        href={buildKpiHref(filters, { state: "scheduled" })}
      />
      <StatCardV2
        label="Completed this week"
        value={kpis.completedThisWeek}
        detail="wrapped up in last 7 days"
        href={buildKpiHref(filters, { state: "completed" })}
      />
    </div>
  );
}

export default function InterviewHub({ data }: InterviewHubProps) {
  const nextAction = data.sections.needsAction[0] ?? data.sections.blocked[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <KpiStrip kpis={data.kpis} filters={data.filters} />
      <InterviewNextAction task={nextAction} totalNeedsAction={data.kpis.needsAction} />
      <InterviewFilters
        filters={data.filters}
        canTeamView={data.viewer.canTeamView}
        kpis={data.kpis}
      />
      <Section sectionKey="needsAction" tasks={data.sections.needsAction} />
      <Section sectionKey="waiting" tasks={data.sections.blocked} />
      <Section sectionKey="scheduled" tasks={data.sections.scheduled} />
      <Section sectionKey="completed" tasks={data.sections.completed} />
    </div>
  );
}
