import { type FunnelCounts } from "./PipelineFunnelChart";

export interface ApplicantPipelineFilteredCounts {
  newApplications: number;
  needsReview: number;
  interviewStage: number;
  postInterview: number;
}

interface ApplicantPipelineOverviewProps {
  filteredCounts: ApplicantPipelineFilteredCounts;
  funnelCounts: FunnelCounts;
}

const RIBBON_SEGMENTS: Array<{
  key: keyof ApplicantPipelineFilteredCounts;
  label: string;
  color: string;
}> = [
  { key: "newApplications", label: "New", color: "#6b21c8" },
  { key: "needsReview", label: "Needs review", color: "#2563eb" },
  { key: "interviewStage", label: "Interview", color: "#059669" },
  { key: "postInterview", label: "Post-interview", color: "#4338ca" },
];

export default function ApplicantPipelineOverview({
  filteredCounts,
  funnelCounts,
}: ApplicantPipelineOverviewProps) {
  const total =
    filteredCounts.newApplications +
    filteredCounts.needsReview +
    filteredCounts.interviewStage +
    filteredCounts.postInterview;

  const overall = [
    { label: "Submitted", value: funnelCounts.SUBMITTED ?? 0 },
    { label: "Under review", value: funnelCounts.UNDER_REVIEW ?? 0 },
    {
      label: "Review complete",
      value: (funnelCounts.INFO_REQUESTED ?? 0) + (funnelCounts.PRE_APPROVED ?? 0),
    },
    { label: "Interview scheduled", value: funnelCounts.INTERVIEW_SCHEDULED ?? 0 },
    { label: "Interview completed", value: funnelCounts.INTERVIEW_COMPLETED ?? 0 },
    { label: "Chair review", value: funnelCounts.CHAIR_REVIEW ?? 0 },
    { label: "Approved", value: funnelCounts.APPROVED ?? 0 },
    { label: "Rejected", value: funnelCounts.REJECTED ?? 0 },
    { label: "On hold", value: funnelCounts.ON_HOLD ?? 0 },
    { label: "Withdrawn", value: funnelCounts.WITHDRAWN ?? 0 },
  ];

  return (
    <section className="card applicant-pipeline-overview" aria-label="Applicant pipeline summary">
      <div className="applicant-pipeline-overview-row" role="group" aria-label="Filtered board counts">
        <span className="applicant-pipeline-overview-pill applicant-pipeline-overview-pill-strong">
          Filtered <span className="applicant-pipeline-overview-pill-value">{total}</span>
        </span>

        {RIBBON_SEGMENTS.map((seg) => {
          const n = filteredCounts[seg.key];
          return (
            <span key={seg.key} className="applicant-pipeline-overview-pill">
              <span className="applicant-pipeline-overview-dot" style={{ background: seg.color }} aria-hidden />
              <span className="applicant-pipeline-overview-pill-label">{seg.label}</span>
              <span className="applicant-pipeline-overview-pill-value">{n}</span>
            </span>
          );
        })}
      </div>

      <div className="applicant-pipeline-overview-row" role="group" aria-label="Overall counts by status">
        <span className="applicant-pipeline-overview-pill applicant-pipeline-overview-pill-strong">
          Overall
        </span>
        {overall.map((row) => (
          <span key={row.label} className="applicant-pipeline-overview-pill">
            <span className="applicant-pipeline-overview-pill-label">{row.label}</span>
            <span className="applicant-pipeline-overview-pill-value">{row.value}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
