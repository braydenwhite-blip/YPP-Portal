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

// ─── Component ───────────────────────────────────────────────────────────────

export default function PipelineFunnelChart({ counts }: { counts: FunnelCounts }) {
  const get = (s: InstructorApplicationStatus): number => counts[s] ?? 0;

  // Stage definitions in funnel order (active pipeline stages)
  const activePipeline: FunnelStage[] = [
    { label: "Submitted", count: get("SUBMITTED") },
    { label: "Under Review", count: get("UNDER_REVIEW") },
    {
      label: "Review Complete",
      count: get("INFO_REQUESTED") + get("PRE_APPROVED"),
    },
    { label: "Interview Scheduled", count: get("INTERVIEW_SCHEDULED") },
    { label: "Interview Completed", count: get("INTERVIEW_COMPLETED") },
    { label: "Chair Review", count: get("CHAIR_REVIEW") },
    { label: "Approved", count: get("APPROVED") },
  ];

  // Terminal / side-exit stages shown below the funnel for reference
  const sideStages: FunnelStage[] = [
    { label: "Rejected", count: get("REJECTED"), isTerminal: true },
    { label: "On Hold", count: get("ON_HOLD"), isTerminal: true },
    { label: "Withdrawn", count: get("WITHDRAWN"), isTerminal: true },
  ];

  const maxCount = Math.max(...activePipeline.map((s) => s.count), 1);

  return (
    <div className="pipeline-funnel-panel card">
      <h2 className="pipeline-funnel-title section-title">Pipeline Funnel</h2>

      <div className="pipeline-funnel-stages" aria-label="Application pipeline funnel">
        {activePipeline.map((stage, i) => {
          const prevCount = i === 0 ? null : activePipeline[i - 1].count;
          const dropOff =
            prevCount === null
              ? null
              : prevCount === 0
              ? null
              : pct(stage.count, prevCount);
          const barWidth = `${Math.round((stage.count / maxCount) * 100)}%`;

          return (
            <div key={stage.label} className="pipeline-funnel-row">
              <div className="pipeline-funnel-label" title={stage.label}>
                {stage.label}
              </div>
              <div className="pipeline-funnel-bar-wrap" aria-hidden="true">
                <div
                  className="pipeline-funnel-bar"
                  style={{ width: barWidth }}
                />
              </div>
              <div className="pipeline-funnel-count">{stage.count}</div>
              <div
                className="pipeline-funnel-dropoff"
                aria-label={
                  dropOff === null
                    ? "First stage"
                    : `${dropOff} passed from previous stage`
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
    </div>
  );
}
