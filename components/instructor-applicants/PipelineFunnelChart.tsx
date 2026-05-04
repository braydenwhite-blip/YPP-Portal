import { InstructorApplicationStatus } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export type FunnelCounts = Partial<Record<InstructorApplicationStatus, number>>;

interface FunnelStage {
  label: string;
  count: number;
  isTerminal?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function MinimalStatusTables({
  activePipeline,
  sideStages,
}: {
  activePipeline: FunnelStage[];
  sideStages: FunnelStage[];
}) {
  return (
    <div className="pipeline-status-simple">
      <p className="pipeline-status-simple-heading">In progress</p>
      <table className="pipeline-status-simple-table">
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col" className="pipeline-status-simple-num">
              People
            </th>
          </tr>
        </thead>
        <tbody>
          {activePipeline.map((stage) => (
            <tr key={stage.label}>
              <td>{stage.label}</td>
              <td className="pipeline-status-simple-num">{stage.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="pipeline-status-simple-heading pipeline-status-simple-heading-spaced">Other statuses</p>
      <table className="pipeline-status-simple-table">
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col" className="pipeline-status-simple-num">
              People
            </th>
          </tr>
        </thead>
        <tbody>
          {sideStages.map((stage) => (
            <tr key={stage.label}>
              <td>{stage.label}</td>
              <td className="pipeline-status-simple-num">{stage.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PipelineFunnelChart({
  counts,
  layout = "panel",
}: {
  counts: FunnelCounts;
  layout?: "panel" | "embedded" | "embeddedMinimal";
}) {
  const get = (s: InstructorApplicationStatus): number => counts[s] ?? 0;

  const activePipeline: FunnelStage[] = [
    { label: "Submitted", count: get("SUBMITTED") },
    { label: "Under review", count: get("UNDER_REVIEW") },
    {
      label: "Review complete",
      count: get("INFO_REQUESTED") + get("PRE_APPROVED"),
    },
    { label: "Interview scheduled", count: get("INTERVIEW_SCHEDULED") },
    { label: "Interview completed", count: get("INTERVIEW_COMPLETED") },
    { label: "Chair review", count: get("CHAIR_REVIEW") },
    { label: "Approved", count: get("APPROVED") },
  ];

  const sideStages: FunnelStage[] = [
    { label: "Rejected", count: get("REJECTED"), isTerminal: true },
    { label: "On hold", count: get("ON_HOLD"), isTerminal: true },
    { label: "Withdrawn", count: get("WITHDRAWN"), isTerminal: true },
  ];

  if (layout === "embeddedMinimal") {
    return (
      <div className="pipeline-funnel-embedded pipeline-funnel-embedded-minimal">
        <MinimalStatusTables activePipeline={activePipeline} sideStages={sideStages} />
      </div>
    );
  }

  const maxCount = Math.max(...activePipeline.map((s) => s.count), 1);

  const stages = (
    <>
      <div className="pipeline-funnel-stages" aria-label="Application pipeline funnel">
        {activePipeline.map((stage, i) => {
          const prevCount = i === 0 ? null : activePipeline[i - 1].count;
          const dropOff =
            prevCount === null ? null : prevCount === 0 ? null : pct(stage.count, prevCount);
          const barWidth = `${Math.round((stage.count / maxCount) * 100)}%`;

          return (
            <div key={stage.label} className="pipeline-funnel-row">
              <div className="pipeline-funnel-label" title={stage.label}>
                {stage.label}
              </div>
              <div className="pipeline-funnel-bar-wrap" aria-hidden="true">
                <div className="pipeline-funnel-bar" style={{ width: barWidth }} />
              </div>
              <div className="pipeline-funnel-count">{stage.count}</div>
              <div
                className="pipeline-funnel-dropoff"
                aria-label={
                  dropOff === null ? "First stage" : `${dropOff} passed from previous stage`
                }
              >
                {dropOff === null ? "—" : `${dropOff} passed`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pipeline-funnel-divider" />

      <div className="pipeline-funnel-exits" aria-label="Exit stages">
        {sideStages.map((stage) => (
          <div key={stage.label} className="pipeline-funnel-exit-row">
            <span className="pipeline-funnel-exit-label">{stage.label}</span>
            <span className="pipeline-funnel-exit-count">{stage.count}</span>
          </div>
        ))}
      </div>
    </>
  );

  if (layout === "embedded") {
    return (
      <div className="pipeline-funnel-embedded">
        <h3 className="pipeline-funnel-embedded-title">Status funnel</h3>
        <p className="pipeline-funnel-embedded-hint">
          Counts by application status (non-archived), independent of board filters.
        </p>
        {stages}
      </div>
    );
  }

  return (
    <div className="pipeline-funnel-panel card">
      <h2 className="pipeline-funnel-title section-title">Pipeline Funnel</h2>
      {stages}
    </div>
  );
}
