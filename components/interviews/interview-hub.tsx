import InterviewFilters from "@/components/interviews/interview-filters";
import InterviewNextAction from "@/components/interviews/interview-next-action";
import InterviewTaskCard from "@/components/interviews/interview-task-card";
import type { InterviewCommandCenterData, InterviewTask } from "@/lib/interviews/types";

type InterviewHubProps = {
  data: InterviewCommandCenterData;
};

function Section({
  title,
  empty,
  tasks,
}: {
  title: string;
  empty: string;
  tasks: InterviewTask[];
}) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {tasks.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {tasks.map((task) => (
            <InterviewTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function InterviewHub({ data }: InterviewHubProps) {
  const nextAction = data.sections.needsAction[0] ?? data.sections.blocked[0] ?? null;
  const needsActionTasks = [...data.sections.needsAction, ...data.sections.blocked];

  return (
    <div>
      <InterviewFilters filters={data.filters} canTeamView={data.viewer.canTeamView} />
      <InterviewNextAction task={nextAction} />
      <Section
        title="Needs My Action"
        empty="No interview actions currently require your input."
        tasks={needsActionTasks}
      />
      <Section
        title="Upcoming / Scheduled"
        empty="No upcoming interviews in this filter."
        tasks={data.sections.scheduled}
      />
      <Section
        title="Completed / Outcome Posted"
        empty="No completed interview items in this filter."
        tasks={data.sections.completed}
      />
    </div>
  );
}
